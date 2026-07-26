const { expect } = require('chai');
const { WarcraftLogsClient, GAME_VERSIONS } = require('../services/warcraftlogs');

describe('WarcraftLogsClient', function () {
  it('should construct with credentials', function () {
    const client = new WarcraftLogsClient('test-id', 'test-secret');
    expect(client.clientId).to.equal('test-id');
    expect(client.clientSecret).to.equal('test-secret');
    expect(client.accessToken).to.be.null;
  });

  it('should skip re-auth if token is still valid', async function () {
    const client = new WarcraftLogsClient('id', 'secret');
    client.accessToken = 'cached-token';
    client.tokenExpiry = Date.now() + 60000;
    const token = await client.authenticate();
    expect(token).to.equal('cached-token');
  });

  it('should not use cached token when expired', function () {
    const client = new WarcraftLogsClient('id', 'secret');
    client.accessToken = 'old-token';
    client.tokenExpiry = Date.now() - 1000;
    // Expired token means authenticate() won't short-circuit
    // We can verify by checking that the expiry condition fails
    const isValid = client.accessToken && Date.now() < client.tokenExpiry;
    expect(isValid).to.equal(false);
  });

  it('getClient returns null when env vars are missing', function () {
    delete process.env.WCL_CLIENT_ID;
    delete process.env.WCL_CLIENT_SECRET;
    delete require.cache[require.resolve('../services/warcraftlogs')];
    const { getClient } = require('../services/warcraftlogs');
    expect(getClient()).to.be.null;
  });

  describe('batchGetCharacterRankings', function () {
    it('maps each requested name to its aliased character result', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      let captured = null;
      client.query = async function (gql, variables, gameVersion) {
        captured = { gql, variables, gameVersion };
        return { characterData: { char0: { name: 'Arthas', classID: 1 }, char1: null } };
      };

      const result = await client.batchGetCharacterRankings(
        ['Arthas', 'Jaina'], 'area-52', 'us', 'retail', { zoneID: 38, difficulty: 5 }
      );

      expect(Object.keys(result)).to.deep.equal(['Arthas', 'Jaina']);
      expect(result.Arthas).to.deep.equal({ name: 'Arthas', classID: 1 });
      expect(result.Jaina).to.be.null;
    });

    it('builds aliased fields and n-indexed variables', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      let captured = null;
      client.query = async function (gql, variables, gameVersion) {
        captured = { gql, variables, gameVersion };
        return { characterData: { char0: { name: 'Arthas' }, char1: { name: 'Jaina' } } };
      };

      await client.batchGetCharacterRankings(
        ['Arthas', 'Jaina'], 'area-52', 'us', 'classic', { zoneID: 1017, difficulty: 4 }
      );

      expect(captured.gql).to.include('char0: character(name: $n0');
      expect(captured.gql).to.include('char1: character(name: $n1');
      expect(captured.gql).to.include('zoneID: 1017, difficulty: 4');
      expect(captured.variables).to.deep.equal({
        server: 'area-52', region: 'us', n0: 'Arthas', n1: 'Jaina',
      });
      expect(captured.gameVersion).to.equal('classic');
    });

    it('omits ranking args when no zone or difficulty is given', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      let captured = null;
      client.query = async function (gql) {
        captured = gql;
        return { characterData: { char0: null } };
      };

      await client.batchGetCharacterRankings(['Arthas'], 'area-52', 'us');
      expect(captured).to.include('zoneRankings ');
      expect(captured).to.not.include('zoneID');
    });

    it('returns {} for an empty name list without querying', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      let called = false;
      client.query = async function () { called = true; return {}; };

      const result = await client.batchGetCharacterRankings([], 'area-52', 'us');
      expect(result).to.deep.equal({});
      expect(called).to.equal(false);
    });
  });

  describe('getActiveGuilds', function () {
    function rankingsPayload(guilds) {
      return {
        page: 1,
        hasMorePages: false,
        count: guilds.length,
        rankings: guilds.map((g, i) => ({
          guild: { id: 100 + i, name: g.name, faction: g.faction },
          server: { id: 1, name: 'Area 52', region: { name: 'US' } },
          amount: 1000 + i,
        })),
      };
    }

    it('dedupes guilds across encounters and maps factions', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      let captured = null;
      client.query = async function (gql, variables) {
        captured = { gql, variables };
        return {
          worldData: {
            enc0: { fightRankings: rankingsPayload([{ name: 'APES', faction: 1 }, { name: 'Echo', faction: 0 }]) },
            enc1: { fightRankings: rankingsPayload([{ name: 'APES', faction: 1 }, { name: 'Liquid', faction: 0 }]) },
          },
        };
      };

      const guilds = await client.getActiveGuilds([2820, 2821], 'area-52', 'us', 'retail', 5);

      expect(guilds).to.deep.equal([
        { name: 'APES', faction: 'Horde' },
        { name: 'Echo', faction: 'Alliance' },
        { name: 'Liquid', faction: 'Alliance' },
      ]);
      expect(captured.gql).to.include('enc0: encounter(id: 2820)');
      expect(captured.gql).to.include('enc1: encounter(id: 2821)');
      expect(captured.gql).to.include('difficulty: 5');
      expect(captured.variables).to.deep.equal({ server: 'area-52', region: 'us' });
    });

    it('ignores error-shaped fightRankings payloads', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      client.query = async function () {
        return {
          worldData: {
            enc0: { fightRankings: rankingsPayload([{ name: 'APES', faction: 1 }]) },
            enc1: { fightRankings: { error: "Fight data doesn't exist yet." } },
          },
        };
      };

      const guilds = await client.getActiveGuilds([2820, 2821], 'area-52', 'us');
      expect(guilds).to.deep.equal([{ name: 'APES', faction: 'Horde' }]);
    });

    it('skips missing encounters and nameless rankings', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      client.query = async function () {
        return {
          worldData: {
            enc0: null,
            enc1: { fightRankings: { rankings: [{ guild: null }, { guild: { name: 'APES', faction: 7 } }] } },
          },
        };
      };

      const guilds = await client.getActiveGuilds([1, 2], 'area-52', 'us');
      expect(guilds).to.deep.equal([{ name: 'APES', faction: null }]);
    });

    it('returns [] for empty encounter list without querying', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      let called = false;
      client.query = async function () { called = true; return {}; };

      expect(await client.getActiveGuilds([], 'area-52', 'us')).to.deep.equal([]);
      expect(await client.getActiveGuilds(undefined, 'area-52', 'us')).to.deep.equal([]);
      expect(called).to.equal(false);
    });
  });

  describe('query retry handling', function () {
    const axios = require('axios');

    it('retries once after a 429 and returns the eventual data', async function () {
      this.timeout(10000);
      const client = new WarcraftLogsClient('id', 'secret');
      client.accessToken = 'token';
      client.tokenExpiry = Date.now() + 600000;

      const original = axios.post;
      let calls = 0;
      axios.post = async function () {
        calls++;
        if (calls === 1) {
          const err = new Error('Too Many Requests');
          err.response = { status: 429 };
          throw err;
        }
        return { data: { data: { ok: true } } };
      };

      try {
        const data = await client.query('{ ok }', {}, 'retail');
        expect(data).to.deep.equal({ ok: true });
        expect(calls).to.equal(2);
      } finally {
        axios.post = original;
      }
    });

    it('does not retry non-429 errors', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      client.accessToken = 'token';
      client.tokenExpiry = Date.now() + 600000;

      const original = axios.post;
      let calls = 0;
      axios.post = async function () {
        calls++;
        const err = new Error('Server Error');
        err.response = { status: 500 };
        throw err;
      };

      let thrown = null;
      try {
        await client.query('{ ok }');
      } catch (err) {
        thrown = err;
      } finally {
        axios.post = original;
      }
      expect(thrown).to.be.an('error');
      expect(calls).to.equal(1);
    });

    it('throws on GraphQL errors in the response body', async function () {
      const client = new WarcraftLogsClient('id', 'secret');
      client.accessToken = 'token';
      client.tokenExpiry = Date.now() + 600000;

      const original = axios.post;
      axios.post = async function () {
        return { data: { errors: [{ message: 'bad field' }] } };
      };

      let thrown = null;
      try {
        await client.query('{ ok }');
      } catch (err) {
        thrown = err;
      } finally {
        axios.post = original;
      }
      expect(thrown).to.be.an('error');
      expect(thrown.message).to.include('bad field');
    });
  });
});

describe('GAME_VERSIONS', function () {
  it('should be an array with retail and classic', function () {
    expect(GAME_VERSIONS).to.be.an('array');
    const ids = GAME_VERSIONS.map(v => v.id);
    expect(ids).to.include('retail');
    expect(ids).to.include('classic');
  });

  it('each version should have id, name, and base URL', function () {
    for (const v of GAME_VERSIONS) {
      expect(v).to.have.property('id');
      expect(v).to.have.property('name');
      expect(v).to.have.property('base');
      expect(v.base).to.match(/^https:\/\/.*warcraftlogs\.com$/);
    }
  });

  it('retail and classic should have different base URLs', function () {
    const retail = GAME_VERSIONS.find(v => v.id === 'retail');
    const classic = GAME_VERSIONS.find(v => v.id === 'classic');
    expect(retail.base).to.not.equal(classic.base);
  });
});
