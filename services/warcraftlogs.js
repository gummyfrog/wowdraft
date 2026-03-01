const axios = require('axios');

const API_BASES = {
  classic: 'https://classic.warcraftlogs.com',
  retail: 'https://www.warcraftlogs.com',
};

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

  async getCharacterRankings(name, serverSlug, serverRegion, gameVersion = 'retail') {
    const gql = `
      query ($name: String!, $server: String!, $region: String!) {
        characterData {
          character(name: $name, serverSlug: $server, serverRegion: $region) {
            name
            classID
            encounterRankings
            zoneRankings
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

module.exports = { WarcraftLogsClient, getClient };
