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
  }

  async getCharacterRankings(name, serverSlug, serverRegion, gameVersion = 'retail', options = {}) {
    const { zoneID } = options;

    const rankArgs = zoneID ? `(zoneID: ${zoneID})` : '';

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
            members {
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

  async searchGuilds(serverSlug, serverRegion, gameVersion = 'retail') {
    const gql = `
      query ($server: String!, $region: String!) {
        guildData {
          guilds(serverSlug: $server, serverRegion: $region) {
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

    return data.guildData.guilds;
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
      .map(z => ({ id: z.id, name: z.name }));
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
