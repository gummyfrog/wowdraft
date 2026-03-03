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
  });
});
