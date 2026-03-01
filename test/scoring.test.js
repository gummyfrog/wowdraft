const { expect } = require('chai');
const { scorePlayer, getTitle, CATEGORIES } = require('../services/scoring');

describe('Scoring Engine', function () {
  const makeSnapshot = (overrides = {}) => ({
    encounters: {
      'Ragnaros': { rankPercent: 85, bestAmount: 1500, totalKills: 10, fastestKill: 180000, medianPerformance: 1350 },
      'Onyxia': { rankPercent: 90, bestAmount: 1600, totalKills: 8, fastestKill: 120000, medianPerformance: 1520 },
    },
    ...overrides,
  });

  describe('scorePlayer', function () {
    it('should return points for all 6 categories plus total', function () {
      const points = scorePlayer(makeSnapshot(), {}, [makeSnapshot()]);
      expect(points).to.have.property('total');
      expect(points).to.have.property('parse');
      expect(points).to.have.property('dps');
      expect(points).to.have.property('bosses_down');
      expect(points).to.have.property('speedy_clear');
      expect(points).to.have.property('new_best');
      expect(points).to.have.property('consistency');
    });

    it('should give parse points based on average percentile', function () {
      const high = makeSnapshot({ encounters: {
        'Rag': { rankPercent: 99, bestAmount: 2000, totalKills: 5, fastestKill: 100000, medianPerformance: 1900 },
      }});
      const points = scorePlayer(high, {}, [high]);
      expect(points.parse).to.equal(10);
    });

    it('should give bosses_down points for new kills', function () {
      const now = makeSnapshot();
      const old = { encounters: { 'Ragnaros': { totalKills: 8 }, 'Onyxia': { totalKills: 6 } } };
      const points = scorePlayer(now, old, [now]);
      expect(points.bosses_down).to.equal(8);
    });

    it('should give 0 bosses_down when no old snapshot', function () {
      const now = makeSnapshot();
      const points = scorePlayer(now, {}, [now]);
      expect(points.bosses_down).to.equal(10);
    });

    it('should give new_best points for improvements', function () {
      const now = makeSnapshot();
      const old = { encounters: {
        'Ragnaros': { rankPercent: 80, bestAmount: 1400 },
        'Onyxia': { rankPercent: 90, bestAmount: 1600 },
      }};
      const points = scorePlayer(now, old, [now]);
      expect(points.new_best).to.equal(2);
    });

    it('should handle empty encounters gracefully', function () {
      const points = scorePlayer({ encounters: {} }, {}, []);
      expect(points.total).to.equal(0);
    });
  });

  describe('getTitle', function () {
    it('should return the title for highest-scoring category', function () {
      const points = { total: 20, parse: 10, dps: 4, bosses_down: 2, speedy_clear: 2, new_best: 1, consistency: 1 };
      expect(getTitle(points)).to.equal('Parser');
    });

    it('should return empty string for no categories', function () {
      expect(getTitle({ total: 0 })).to.equal('');
    });
  });

  describe('CATEGORIES', function () {
    it('should have 6 categories', function () {
      expect(CATEGORIES).to.have.length(6);
    });

    it('each category should have name, title, and compute function', function () {
      for (const cat of CATEGORIES) {
        expect(cat).to.have.property('name');
        expect(cat).to.have.property('title');
        expect(cat.compute).to.be.a('function');
      }
    });
  });
});
