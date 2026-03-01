const { expect } = require('chai');
const { normalizeSeedPlayer, normalizeWCLPlayer } = require('../services/playerpool');

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
  });

  describe('normalizeWCLPlayer', function () {
    it('should normalize a WCL member to pool format', function () {
      const member = { name: 'Thrall', classID: 7 };
      const result = normalizeWCLPlayer(member, 'Grizzly', 1);
      expect(result.name).to.equal('Thrall');
      expect(result.class).to.equal('Shaman');
      expect(result.guild).to.equal('Grizzly');
      expect(result.tag).to.equal('healers');
      expect(result.faction).to.equal(1);
      expect(result.drafted).to.deep.equal([]);
      expect(result.active).to.equal(true);
      expect(result.avgParse).to.be.null;
      expect(result.rankings).to.have.length(1);
      expect(result.rankings[0].spec).to.equal('Elemental');
    });

    it('should handle unknown class IDs', function () {
      const member = { name: 'Mystery', classID: 999 };
      const result = normalizeWCLPlayer(member, 'Guild', 0);
      expect(result.class).to.equal('Unknown');
      expect(result.tag).to.equal('dps');
    });
  });
});
