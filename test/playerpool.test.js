const { expect } = require('chai');
const { normalizeSeedPlayer, normalizeWCLPlayer, buildPlayerPool } = require('../services/playerpool');

describe('Player Pool Service', function () {
  describe('normalizeSeedPlayer', function () {
    it('should normalize a seed player to pool format', function () {
      const seed = {
        name: 'Arthas',
        class: 'Warrior',
        guild: 'APES',
        tag: 'dps',
        faction: 0,
        drafted: ['some-league'],
        avgParse: 85,
        avgDps: 1500,
        avgSpeed: 72,
        rankings: [{ spec: 'Fury', rankPercent: 90, encounter_data: { encounter: { name: 'Ragnaros' } } }],
      };

      const result = normalizeSeedPlayer(seed);
      expect(result.name).to.equal('Arthas');
      expect(result.class).to.equal('Warrior');
      expect(result.guild).to.equal('APES');
      expect(result.tag).to.equal('dps');
      expect(result.drafted).to.deep.equal([]);
      expect(result.active).to.equal(true);
      expect(result.avgParse).to.equal(85);
      expect(result.rankings).to.have.length(1);
    });

    it('should handle missing optional fields', function () {
      const seed = {
        name: 'Test',
        class: 'Mage',
        guild: 'Guild',
        tag: 'dps',
        faction: 1,
        drafted: [],
      };

      const result = normalizeSeedPlayer(seed);
      expect(result.avgParse).to.be.null;
      expect(result.avgDps).to.be.null;
      expect(result.avgSpeed).to.be.null;
      expect(result.rankings).to.deep.equal([]);
    });

    it('should preserve faction from seed data', function () {
      const alliance = normalizeSeedPlayer({ name: 'A', class: 'Mage', guild: 'G', tag: 'dps', faction: 0, drafted: [] });
      expect(alliance.faction).to.equal(0);

      const horde = normalizeSeedPlayer({ name: 'B', class: 'Mage', guild: 'G', tag: 'dps', faction: 1, drafted: [] });
      expect(horde.faction).to.equal(1);
    });
  });

  describe('normalizeWCLPlayer', function () {
    it('should normalize a WCL member to pool format', function () {
      const member = { name: 'Thrall', classID: 7 };
      const result = normalizeWCLPlayer(member, 'Grizzly', 'Horde');
      expect(result.name).to.equal('Thrall');
      expect(result.class).to.equal('Shaman');
      expect(result.guild).to.equal('Grizzly');
      expect(result.tag).to.equal('healers');
      expect(result.tags).to.deep.equal(['healers', 'dps']);
      expect(result.faction).to.equal('Horde');
      expect(result.drafted).to.deep.equal([]);
      expect(result.active).to.equal(true);
      expect(result.avgParse).to.be.null;
      expect(result.rankings).to.have.length(1);
      expect(result.rankings[0].spec).to.equal('Elemental');
    });

    it('should handle unknown class IDs', function () {
      const member = { name: 'Mystery', classID: 999 };
      const result = normalizeWCLPlayer(member, 'Guild', null);
      expect(result.class).to.equal('Unknown');
      expect(result.tag).to.equal('dps');
      expect(result.tags).to.deep.equal(['dps']);
    });

    it('should carry guild faction to player', function () {
      const member = { name: 'Jaina', classID: 8 };
      const result = normalizeWCLPlayer(member, 'Alliance Guild', 'Alliance');
      expect(result.faction).to.equal('Alliance');
    });

    it('should handle null faction gracefully', function () {
      const member = { name: 'Neutral', classID: 1 };
      const result = normalizeWCLPlayer(member, 'Guild', null);
      expect(result.faction).to.be.null;
    });

    it('should include tanks in tags for tank-capable classes', function () {
      // Warrior (1), DK (6), Demon Hunter (12) should all have 'tanks' in tags
      expect(normalizeWCLPlayer({ name: 'W', classID: 1 }, 'G', null).tags).to.include('tanks');
      expect(normalizeWCLPlayer({ name: 'D', classID: 6 }, 'G', null).tags).to.include('tanks');
      expect(normalizeWCLPlayer({ name: 'DH', classID: 12 }, 'G', null).tags).to.include('tanks');
      // Mage (8) should NOT have tanks
      expect(normalizeWCLPlayer({ name: 'M', classID: 8 }, 'G', null).tags).to.not.include('tanks');
    });
  });

  describe('buildPlayerPool', function () {
    it('should return empty array when no guilds selected', async function () {
      const league = { guilds: [], server: 'area-52', region: 'us', game_version: 'retail' };
      const pool = await buildPlayerPool(league);
      expect(pool).to.deep.equal([]);
    });

    it('should return empty array when guilds is undefined', async function () {
      const league = { server: 'area-52', region: 'us', game_version: 'retail' };
      const pool = await buildPlayerPool(league);
      expect(pool).to.deep.equal([]);
    });

    it('should default game_version to retail', async function () {
      const league = { guilds: [] };
      const pool = await buildPlayerPool(league);
      expect(pool).to.deep.equal([]);
    });

    describe('pool_status writes (seed fallback, no WCL client)', function () {
      const db = require('../db');
      let build;
      let origLeagues;
      let origPlayers;
      let updates;
      let seedPlayers;

      before(function () {
        // No WCL credentials -> getClient() returns null -> seed fallback
        delete process.env.WCL_CLIENT_ID;
        delete process.env.WCL_CLIENT_SECRET;
        delete require.cache[require.resolve('../services/warcraftlogs')];
        delete require.cache[require.resolve('../services/playerpool')];
        build = require('../services/playerpool').buildPlayerPool;

        origLeagues = db.leagues;
        origPlayers = db.players;
        db.leagues = function () {
          return {
            updateOne: async function (filter, update) {
              updates.push({ filter, update });
              return { matchedCount: 1 };
            },
          };
        };
        db.players = function (tag) {
          return { find: function () { return { toArray: async function () { return seedPlayers[tag] || []; } }; } };
        };
      });

      after(function () {
        db.leagues = origLeagues;
        db.players = origPlayers;
      });

      beforeEach(function () {
        updates = [];
        seedPlayers = { dps: [], healers: [], tanks: [] };
      });

      function lastStatus() {
        const withStatus = updates.filter(u => u.update.$set.pool_status);
        return withStatus[withStatus.length - 1].update.$set.pool_status;
      }

      it('falls back to seed data when no WCL client is configured', async function () {
        seedPlayers.dps = [
          { name: 'Arthas', class: 'Warrior', guild: 'APES', tag: 'dps', avgParse: 90 },
        ];
        const pool = await build({ guilds: [{ name: 'APES' }], server: 'Area 52', region: 'us', rounds: 0 });
        expect(pool).to.have.length(1);
        expect(pool[0].name).to.equal('Arthas');
        expect(pool[0].guild).to.equal('APES');
      });

      it('writes an error pool_status when no players have logs', async function () {
        seedPlayers.dps = [
          { name: 'Arthas', class: 'Warrior', guild: 'APES', tag: 'dps' },
          { name: 'Jaina', class: 'Mage', guild: 'APES', tag: 'dps' },
        ];
        const pool = await build({ code: 'ABC123', guilds: [{ name: 'APES' }], rounds: 1 });

        expect(pool).to.have.length(2);
        expect(pool.every(p => p.active === false)).to.equal(true);
        const status = lastStatus();
        expect(status.state).to.equal('error');
        expect(status.message).to.include('No active raiders');
        expect(updates.some(u => u.update.$set.player_pool)).to.equal(false);
      });

      it('writes an error pool_status when too few active players for the round count', async function () {
        seedPlayers.dps = [
          { name: 'Arthas', class: 'Warrior', guild: 'APES', tag: 'dps', avgParse: 90 },
        ];
        await build({ code: 'ABC123', guilds: [{ name: 'APES' }], rounds: 2 });

        const status = lastStatus();
        expect(status.state).to.equal('error');
        expect(status.message).to.include('Not enough active raiders');
        expect(status.message).to.include('need at least 4');
      });

      it('writes an error pool_status when role requirements are not covered', async function () {
        seedPlayers.dps = [
          { name: 'Arthas', class: 'Warrior', guild: 'APES', tag: 'dps', avgParse: 90 },
          { name: 'Jaina', class: 'Mage', guild: 'APES', tag: 'dps', avgDps: 50000 },
        ];
        await build({ code: 'ABC123', guilds: [{ name: 'APES' }], rounds: 1, requirements: { tanks: 1, healers: 0, dps: 1 } });

        const status = lastStatus();
        expect(status.state).to.equal('error');
        expect(status.message).to.include('active tank-capable');
      });

      it('persists player_pool and a done pool_status on success', async function () {
        seedPlayers.dps = [
          { name: 'Arthas', class: 'Warrior', guild: 'APES', tag: 'dps', avgParse: 90 },
          { name: 'Jaina', class: 'Mage', guild: 'APES', tag: 'dps', avgDps: 50000 },
        ];
        seedPlayers.healers = [
          { name: 'Anduin', class: 'Priest', guild: 'APES', tag: 'healers' },
        ];
        const pool = await build({ code: 'ABC123', guilds: [{ name: 'APES' }], rounds: 1 });

        expect(pool).to.have.length(3);
        const final = updates[updates.length - 1];
        expect(final.filter).to.deep.equal({ code: 'ABC123' });
        expect(final.update.$set.player_pool).to.have.length(3);
        expect(final.update.$set.pool_status).to.deep.equal({
          state: 'done', active: 2, inactive: 1, total: 3,
        });
      });

      it('does not touch the DB when the league has no code', async function () {
        seedPlayers.dps = [
          { name: 'Arthas', class: 'Warrior', guild: 'APES', tag: 'dps', avgParse: 90 },
          { name: 'Jaina', class: 'Mage', guild: 'APES', tag: 'dps', avgParse: 80 },
        ];
        const pool = await build({ guilds: [{ name: 'APES' }], rounds: 1 });
        expect(pool).to.have.length(2);
        expect(updates).to.deep.equal([]);
      });
    });
  });
});
