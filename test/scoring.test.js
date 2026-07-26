const { expect } = require('chai');
const { scorePlayer, getTitle, CATEGORIES } = require('../services/scoring');

describe('Scoring Engine', function () {
  const makeSnapshot = (overrides = {}) => ({
    encounters: {
      'Ragnaros': { rankPercent: 85, bestAmount: 1500, totalKills: 10, fastestKill: 180000, medianPercent: 80 },
      'Onyxia': { rankPercent: 90, bestAmount: 1600, totalKills: 8, fastestKill: 120000, medianPercent: 88 },
    },
    zoneAllStars: { points: 800, possiblePoints: 1000, rankPercent: 80, spec: 'Fire' },
    ...overrides,
  });

  describe('scorePlayer', function () {
    it('should return points for all 7 categories plus total', function () {
      const points = scorePlayer(makeSnapshot(), {}, [makeSnapshot()]);
      expect(points).to.have.property('total');
      expect(points).to.have.property('parse');
      expect(points).to.have.property('dps');
      expect(points).to.have.property('bosses_down');
      expect(points).to.have.property('speedy_clear');
      expect(points).to.have.property('new_best');
      expect(points).to.have.property('consistency');
      expect(points).to.have.property('all_stars');
    });

    it('should give parse points based on average percentile', function () {
      const high = makeSnapshot({ encounters: {
        'Rag': { rankPercent: 99, bestAmount: 2000, totalKills: 5, fastestKill: 100000, medianPercent: 98 },
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

    it('should give all_stars points based on zone All-Star ratio', function () {
      const high = makeSnapshot({ zoneAllStars: { points: 900, possiblePoints: 1000, rankPercent: 90, spec: 'Fire' } });
      const points = scorePlayer(high, {}, [high]);
      expect(points.all_stars).to.equal(6);

      const mid = makeSnapshot({ zoneAllStars: { points: 650, possiblePoints: 1000, rankPercent: 65, spec: 'Fire' } });
      const midPoints = scorePlayer(mid, {}, [mid]);
      expect(midPoints.all_stars).to.equal(4);

      const low = makeSnapshot({ zoneAllStars: { points: 100, possiblePoints: 1000, rankPercent: 10, spec: 'Fire' } });
      const lowPoints = scorePlayer(low, {}, [low]);
      expect(lowPoints.all_stars).to.equal(1);

      const none = makeSnapshot({ zoneAllStars: null });
      const nonePoints = scorePlayer(none, {}, [none]);
      expect(nonePoints.all_stars).to.equal(0);
    });

    it('should give consistency points based on medianPercent/rankPercent ratio', function () {
      const consistent = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 90, medianPercent: 88, bestAmount: 1500, totalKills: 5, fastestKill: 100000 },
        'Boss2': { rankPercent: 85, medianPercent: 83, bestAmount: 1400, totalKills: 5, fastestKill: 110000 },
      }});
      const points = scorePlayer(consistent, {}, [consistent]);
      expect(points.consistency).to.equal(6);

      const spikey = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 95, medianPercent: 50, bestAmount: 2000, totalKills: 5, fastestKill: 100000 },
      }});
      const spikeyPts = scorePlayer(spikey, {}, [spikey]);
      expect(spikeyPts.consistency).to.equal(1);
    });

    it('should give consistency 0 when encounters have no medianPercent', function () {
      const noMedian = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 90, medianPercent: 0, bestAmount: 1500, totalKills: 5, fastestKill: 100000 },
      }});
      const points = scorePlayer(noMedian, {}, [noMedian]);
      expect(points.consistency).to.equal(0);
    });

    it('should give all_stars 0 when possiblePoints is zero', function () {
      const snap = makeSnapshot({ zoneAllStars: { points: 50, possiblePoints: 0, rankPercent: 50, spec: 'Fire' } });
      const points = scorePlayer(snap, {}, [snap]);
      expect(points.all_stars).to.equal(0);
    });

    it('should give speedy_clear points when player has fastest kill', function () {
      const fast = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 80, medianPercent: 75, bestAmount: 1500, totalKills: 5, fastestKill: 90000 },
      }});
      const slow = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 70, medianPercent: 65, bestAmount: 1200, totalKills: 5, fastestKill: 150000 },
      }});
      const points = scorePlayer(fast, {}, [fast, slow]);
      expect(points.speedy_clear).to.equal(2);
    });

    it('should give speedy_clear 0 when player is not fastest', function () {
      const slow = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 70, medianPercent: 65, bestAmount: 1200, totalKills: 5, fastestKill: 150000 },
      }});
      const fast = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 80, medianPercent: 75, bestAmount: 1500, totalKills: 5, fastestKill: 90000 },
      }});
      const points = scorePlayer(slow, {}, [slow, fast]);
      expect(points.speedy_clear).to.equal(0);
    });

    it('should give dps points relative to other players', function () {
      const top = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 99, medianPercent: 98, bestAmount: 5000, totalKills: 5, fastestKill: 100000 },
      }});
      const bottom = makeSnapshot({ encounters: {
        'Boss1': { rankPercent: 30, medianPercent: 25, bestAmount: 500, totalKills: 5, fastestKill: 200000 },
      }});
      const topPoints = scorePlayer(top, {}, [top, bottom]);
      const bottomPoints = scorePlayer(bottom, {}, [top, bottom]);
      expect(topPoints.dps).to.be.greaterThan(bottomPoints.dps);
    });

    it('should give parse tier points at each threshold', function () {
      const make = (pct) => makeSnapshot({ encounters: { 'Boss': { rankPercent: pct, medianPercent: pct, bestAmount: 1000, totalKills: 1, fastestKill: 100000 } } });

      expect(scorePlayer(make(99), {}, [make(99)]).parse).to.equal(10);
      expect(scorePlayer(make(95), {}, [make(95)]).parse).to.equal(8);
      expect(scorePlayer(make(90), {}, [make(90)]).parse).to.equal(6);
      expect(scorePlayer(make(75), {}, [make(75)]).parse).to.equal(4);
      expect(scorePlayer(make(50), {}, [make(50)]).parse).to.equal(2);
      expect(scorePlayer(make(30), {}, [make(30)]).parse).to.equal(1);
    });
  });

  describe('scorePlayer details', function () {
    it('should expose a details object keyed like the points categories', function () {
      const { details } = scorePlayer(makeSnapshot(), {}, [makeSnapshot()]);
      expect(details).to.be.an('object');
      expect(Object.keys(details).sort()).to.deep.equal(
        ['all_stars', 'bosses_down', 'consistency', 'dps', 'new_best', 'parse', 'speedy_clear']
      );
      expect(details.parse).to.have.property('avg');
      expect(details.dps).to.have.all.keys('avg', 'percentile');
      expect(details.bosses_down).to.have.property('new_kills');
      expect(details.speedy_clear).to.have.property('fastest_bosses');
      expect(details.new_best).to.have.property('improvements');
      expect(details.consistency).to.have.property('ratio');
      expect(details.all_stars).to.have.all.keys('points', 'possible');
    });

    it('should report the average parse behind the parse score', function () {
      const { parse, details } = scorePlayer(makeSnapshot(), {}, [makeSnapshot()]);
      // (85 + 90) / 2
      expect(details.parse.avg).to.equal(87.5);
      expect(parse).to.equal(4);
    });

    it('should report new_kills behind the bosses_down score', function () {
      const now = makeSnapshot();
      const old = { encounters: { 'Ragnaros': { totalKills: 8 }, 'Onyxia': { totalKills: 6 } } };
      const { bosses_down, details } = scorePlayer(now, old, [now]);
      expect(details.bosses_down.new_kills).to.equal(4);
      expect(bosses_down).to.equal(8);
    });

    it('should report dps average and percentile, and all-star raw points', function () {
      const snap = makeSnapshot();
      const { details } = scorePlayer(snap, {}, [snap]);
      // (1500 + 1600) / 2
      expect(details.dps.avg).to.equal(1550);
      expect(details.dps.percentile).to.equal(1);
      expect(details.all_stars.points).to.equal(800);
      expect(details.all_stars.possible).to.equal(1000);
      expect(details.speedy_clear.fastest_bosses).to.equal(2);
      expect(details.new_best.improvements).to.equal(4);
      expect(details.consistency.ratio).to.equal(0.96);
    });

    it('should null out details when the inputs are missing', function () {
      const { details } = scorePlayer({ encounters: {}, zoneAllStars: null }, {}, []);
      expect(details.parse.avg).to.be.null;
      expect(details.dps.avg).to.be.null;
      expect(details.dps.percentile).to.be.null;
      expect(details.consistency.ratio).to.be.null;
      expect(details.all_stars.points).to.be.null;
      expect(details.all_stars.possible).to.be.null;
      expect(details.bosses_down.new_kills).to.equal(0);
      expect(details.speedy_clear.fastest_bosses).to.equal(0);
      expect(details.new_best.improvements).to.equal(0);
    });

    it('should not change any category points for the standard fixture', function () {
      const points = scorePlayer(makeSnapshot(), {}, [makeSnapshot()]);
      expect(points.parse).to.equal(4);
      expect(points.dps).to.equal(8);
      expect(points.bosses_down).to.equal(10);
      expect(points.speedy_clear).to.equal(4);
      expect(points.new_best).to.equal(4);
      expect(points.consistency).to.equal(6);
      expect(points.all_stars).to.equal(6);
      expect(points.total).to.equal(42);
    });

    it('should keep getTitle working when details are attached', function () {
      const points = scorePlayer(makeSnapshot(), {}, [makeSnapshot()]);
      expect(getTitle(points)).to.equal('Boss Killer');
    });
  });

  describe('getTitle', function () {
    it('should return the title for highest-scoring category', function () {
      const points = { total: 20, parse: 10, dps: 4, bosses_down: 2, speedy_clear: 2, new_best: 1, consistency: 1, all_stars: 0 };
      expect(getTitle(points)).to.equal('Parser');
    });

    it('should return empty string for no categories', function () {
      expect(getTitle({ total: 0 })).to.equal('');
    });

    it('should return All-Star title when all_stars is highest', function () {
      const points = { total: 20, parse: 1, dps: 1, bosses_down: 1, speedy_clear: 1, new_best: 1, consistency: 1, all_stars: 6 };
      expect(getTitle(points)).to.equal('All-Star');
    });
  });

  describe('CATEGORIES', function () {
    it('should have 7 categories', function () {
      expect(CATEGORIES).to.have.length(7);
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
