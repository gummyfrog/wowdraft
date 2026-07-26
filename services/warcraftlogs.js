const axios = require('axios');

const API_BASES = {
  classic: 'https://classic.warcraftlogs.com',
  retail: 'https://www.warcraftlogs.com',
};

const GAME_VERSIONS = [
  { id: 'retail', name: 'Retail', base: 'https://www.warcraftlogs.com' },
  { id: 'classic', name: 'Classic', base: 'https://classic.warcraftlogs.com' },
];

class WarcraftLogsClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async authenticate() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(
      'https://www.warcraftlogs.com/oauth/token',
      params,
      {
        auth: { username: this.clientId, password: this.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
    return this.accessToken;
  }

  async query(graphqlQuery, variables = {}, gameVersion = 'retail') {
    const token = await this.authenticate();
    const base = API_BASES[gameVersion] || API_BASES.retail;

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(
          `${base}/api/v2/client`,
          { query: graphqlQuery, variables },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.errors) {
          throw new Error(`WCL API Error: ${JSON.stringify(response.data.errors)}`);
        }

        return response.data.data;
      } catch (err) {
        const status = err.response && err.response.status;
        if (status === 429 && attempt < MAX_RETRIES) {
          const wait = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
          console.log(`[WCL] Rate limited (429), retrying in ${wait / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }
        throw err;
      }
    }
  }

  async getCharacterRankings(name, serverSlug, serverRegion, gameVersion = 'retail', options = {}) {
    const { zoneID, difficulty } = options;

    const argParts = [];
    if (zoneID) argParts.push(`zoneID: ${zoneID}`);
    if (difficulty) argParts.push(`difficulty: ${difficulty}`);
    const rankArgs = argParts.length > 0 ? `(${argParts.join(', ')})` : '';

    const gql = `
      query ($name: String!, $server: String!, $region: String!) {
        characterData {
          character(name: $name, serverSlug: $server, serverRegion: $region) {
            name
            classID
            zoneRankings${rankArgs}
          }
        }
      }
    `;

    const data = await this.query(gql, {
      name,
      server: serverSlug,
      region: serverRegion,
    }, gameVersion);

    return data.characterData.character;
  }

  async getGuildMembers(guildName, serverSlug, serverRegion, gameVersion = 'retail') {
    const gql = `
      query ($name: String!, $server: String!, $region: String!) {
        guildData {
          guild(name: $name, serverSlug: $server, serverRegion: $region) {
            name
            members(limit: 100) {
              data {
                name
                classID
              }
            }
          }
        }
      }
    `;

    const data = await this.query(gql, {
      name: guildName,
      server: serverSlug,
      region: serverRegion,
    }, gameVersion);

    return data.guildData.guild;
  }

  async batchGetCharacterRankings(names, serverSlug, serverRegion, gameVersion = 'retail', options = {}) {
    if (names.length === 0) return {};
    const { zoneID, difficulty } = options;

    const argParts = [];
    if (zoneID) argParts.push(`zoneID: ${zoneID}`);
    if (difficulty) argParts.push(`difficulty: ${difficulty}`);
    const rankArgs = argParts.length > 0 ? `(${argParts.join(', ')})` : '';

    // Build dynamic variables and aliased fields
    const varDefs = names.map((_, i) => `$n${i}: String!`).join(', ');
    const fields = names.map((_, i) =>
      `char${i}: character(name: $n${i}, serverSlug: $server, serverRegion: $region) { name classID zoneRankings${rankArgs} }`
    ).join('\n        ');

    const gql = `
      query (${varDefs}, $server: String!, $region: String!) {
        characterData {
          ${fields}
        }
      }
    `;

    const variables = { server: serverSlug, region: serverRegion };
    names.forEach((name, i) => { variables[`n${i}`] = name; });

    const data = await this.query(gql, variables, gameVersion);
    const results = {};
    names.forEach((name, i) => {
      results[name] = data.characterData[`char${i}`] || null;
    });
    return results;
  }

  async getGuildAttendance(guildName, serverSlug, serverRegion, gameVersion = 'retail', zoneID) {
    const zoneArg = zoneID ? `(zoneID: ${zoneID}, limit: 1)` : '(limit: 1)';
    const gql = `
      query ($name: String!, $server: String!, $region: String!) {
        guildData {
          guild(name: $name, serverSlug: $server, serverRegion: $region) {
            name
            attendance${zoneArg} {
              data { code }
            }
          }
        }
      }
    `;

    const data = await this.query(gql, {
      name: guildName,
      server: serverSlug,
      region: serverRegion,
    }, gameVersion);

    const guild = data.guildData.guild;
    if (!guild) return { found: false, active: false };
    const reports = guild.attendance && guild.attendance.data;
    return { found: true, active: Array.isArray(reports) && reports.length > 0 };
  }

  async batchCheckGuildActivity(guildNames, serverSlug, serverRegion, gameVersion = 'retail', zoneID) {
    if (guildNames.length === 0) return {};
    const zoneArg = zoneID ? `(zoneID: ${zoneID}, limit: 1)` : '(limit: 1)';

    // Build aliased query — each guild gets its own field
    const varDefs = guildNames.map((_, i) => `$g${i}: String!`).join(', ');
    const fields = guildNames.map((_, i) =>
      `g${i}: guild(name: $g${i}, serverSlug: $server, serverRegion: $region) { name attendance${zoneArg} { data { code } } }`
    ).join('\n        ');

    const gql = `
      query (${varDefs}, $server: String!, $region: String!) {
        guildData {
          ${fields}
        }
      }
    `;

    const variables = { server: serverSlug, region: serverRegion };
    guildNames.forEach((name, i) => { variables[`g${i}`] = name; });

    const data = await this.query(gql, variables, gameVersion);
    const results = {};
    guildNames.forEach((name, i) => {
      const guild = data.guildData[`g${i}`];
      if (!guild) { results[name] = false; return; }
      const reports = guild.attendance && guild.attendance.data;
      results[name] = Array.isArray(reports) && reports.length > 0;
    });
    return results;
  }

  async searchGuilds(serverSlug, serverRegion, gameVersion = 'retail') {
    // Fetch multiple pages to get a fuller guild list
    const allGuilds = [];
    const MAX_PAGES = 5;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const gql = `
        query ($server: String!, $region: String!) {
          guildData {
            guilds(serverSlug: $server, serverRegion: $region, limit: 100, page: ${page}) {
              has_more_pages
              data {
                name
                faction { id name }
              }
            }
          }
        }
      `;

      const data = await this.query(gql, {
        server: serverSlug,
        region: serverRegion,
      }, gameVersion);

      const result = data.guildData.guilds;
      const pageData = (result && result.data) || [];
      allGuilds.push(...pageData);

      // Stop if this page was not full (no more data)
      // Also respect has_more_pages if the API returns it
      if (pageData.length < 100) break;
      if (result && result.has_more_pages === false) break;
    }

    console.log(`[WCL] Guild search for ${serverSlug}/${serverRegion}: found ${allGuilds.length} guilds`);
    return { data: allGuilds };
  }

  async getRegions(gameVersion = 'retail') {
    const gql = `{
      worldData {
        regions { id name slug }
      }
    }`;
    const data = await this.query(gql, {}, gameVersion);
    return data.worldData.regions;
  }

  async getServers(regionId, gameVersion = 'retail') {
    const gql = `query ($id: Int!) {
      worldData {
        region(id: $id) {
          servers(limit: 500) {
            data { id name slug }
          }
        }
      }
    }`;
    const data = await this.query(gql, { id: regionId }, gameVersion);
    return data.worldData.region.servers.data;
  }

  async getExpansions(gameVersion = 'retail') {
    const gql = `{
      worldData {
        expansions { id name }
      }
    }`;
    const data = await this.query(gql, {}, gameVersion);
    return data.worldData.expansions;
  }

  async getZones(expansionId, gameVersion = 'retail') {
    const gql = `query ($id: Int!) {
      worldData {
        expansion(id: $id) {
          zones {
            id name
            difficulties { id name }
            encounters { id }
          }
        }
      }
    }`;
    const data = await this.query(gql, { id: expansionId }, gameVersion);
    // Filter to actual raids: must have a Normal or Heroic difficulty + more than 1 encounter
    // Excludes M+ (Dungeon difficulty), Delves (no raid difficulties), and
    // "Complete Raids" composites (1 encounter)
    return data.worldData.expansion.zones
      .filter(z => {
        const diffs = (z.difficulties || []).map(d => d.name);
        const hasRaidDiff = diffs.includes('Normal') || diffs.includes('Heroic');
        return hasRaidDiff && z.encounters && z.encounters.length > 1;
      })
      .map(z => ({ id: z.id, name: z.name, encounters: z.encounters.map(e => e.id) }));
  }

  async getActiveGuilds(encounterIds, serverSlug, serverRegion, gameVersion = 'retail', difficulty = 4) {
    if (!encounterIds || encounterIds.length === 0) return [];

    const fields = encounterIds.map((id, i) =>
      `enc${i}: encounter(id: ${id}) { fightRankings(serverSlug: $server, serverRegion: $region, difficulty: ${difficulty}) }`
    ).join('\n        ');

    const gql = `
      query ($server: String!, $region: String!) {
        worldData {
          ${fields}
        }
      }
    `;

    const data = await this.query(gql, {
      server: serverSlug,
      region: serverRegion,
    }, gameVersion);

    const guildMap = new Map();
    for (let i = 0; i < encounterIds.length; i++) {
      const enc = data.worldData[`enc${i}`];
      if (!enc || !enc.fightRankings) continue;

      // Parse rankings — handle multiple possible structures
      const fr = enc.fightRankings;
      const rankings = Array.isArray(fr) ? fr : (fr.rankings || []);
      for (const r of rankings) {
        const guildName = (r.guild && r.guild.name) || r.guildName || (typeof r.guild === 'string' ? r.guild : null);
        if (!guildName) continue;
        if (!guildMap.has(guildName)) {
          // Extract faction — structure varies, be defensive
          let faction = null;
          if (r.guild && r.guild.faction != null) {
            const fid = typeof r.guild.faction === 'object' ? r.guild.faction.id : r.guild.faction;
            faction = fid === 0 ? 'Alliance' : fid === 1 ? 'Horde' : null;
          } else if (r.faction != null) {
            faction = r.faction === 0 ? 'Alliance' : r.faction === 1 ? 'Horde' : null;
          }
          guildMap.set(guildName, { name: guildName, faction });
        }
      }
    }

    console.log(`[WCL] Active guilds for ${serverSlug}/${serverRegion}: ${guildMap.size} from ${encounterIds.length} encounters`);
    return Array.from(guildMap.values());
  }
}

let client = null;

function getClient() {
  if (!client) {
    const id = process.env.WCL_CLIENT_ID;
    const secret = process.env.WCL_CLIENT_SECRET;
    if (!id || !secret) {
      return null;
    }
    client = new WarcraftLogsClient(id, secret);
  }
  return client;
}

module.exports = { WarcraftLogsClient, getClient, GAME_VERSIONS };
