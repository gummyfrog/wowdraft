const { expect } = require('chai');
const { resolveMatchups, fetchPlayerSnapshot, buildPlayerEntry } = require('../services/reports');

describe('Report Generation', function () {
  describe('resolveMatchups', function () {
    it('should determine winner of a matchup', function () {
      const schedule = {
        matchups: [{ home: 'team1', away: 'team2' }],
      };
      const teamData = [
        { team_id: 'team1', total_points: 30 },
        { team_id: 'team2', total_points: 20 },
      ];

      const results = resolveMatchups(schedule, teamData);
      expect(results[0].winner).to.equal('team1');
      expect(results[0].loser).to.equal('team2');
    });

    it('should handle ties', function () {
      const schedule = {
        matchups: [{ home: 'team1', away: 'team2' }],
      };
      const teamData = [
        { team_id: 'team1', total_points: 25 },
        { team_id: 'team2', total_points: 25 },
      ];

      const results = resolveMatchups(schedule, teamData);
      expect(results[0].tie).to.equal(true);
    });

    it('should handle byes', function () {
      const schedule = {
        matchups: [{ bye: 'team3' }],
      };

      const results = resolveMatchups(schedule, []);
      expect(results[0].bye).to.equal('team3');
    });

    it('should skip matchups with missing team data', function () {
      const schedule = {
        matchups: [{ home: 'team1', away: 'nonexistent' }],
      };
      const teamData = [
        { team_id: 'team1', total_points: 30 },
      ];

      const results = resolveMatchups(schedule, teamData);
      expect(results).to.have.length(0);
    });

    it('should handle multiple matchups in one week', function () {
      const schedule = {
        matchups: [
          { home: 'team1', away: 'team2' },
          { home: 'team3', away: 'team4' },
          { bye: 'team5' },
        ],
      };
      const teamData = [
        { team_id: 'team1', total_points: 30 },
        { team_id: 'team2', total_points: 20 },
        { team_id: 'team3', total_points: 15 },
        { team_id: 'team4', total_points: 40 },
      ];

      const results = resolveMatchups(schedule, teamData);
      expect(results).to.have.length(3);
      expect(results[0].winner).to.equal('team1');
      expect(results[1].winner).to.equal('team4');
      expect(results[2].bye).to.equal('team5');
    });
  });

  describe('fetchPlayerSnapshot', function () {
    it('should return null when no zoneID is provided', async function () {
      const result = await fetchPlayerSnapshot('Arthas', 'area-52', 'us', 'retail', {});
      expect(result).to.be.null;
    });

    it('should return null with empty options', async function () {
      const result = await fetchPlayerSnapshot('Arthas', 'area-52', 'us', 'retail');
      expect(result).to.be.null;
    });
  });

  describe('buildPlayerEntry', function () {
    const snap = {
      encounters: {
        'Ragnaros': { rankPercent: 85, bestAmount: 1500, totalKills: 10, fastestKill: 180000, medianPercent: 80 },
      },
      zoneAllStars: { points: 800, possiblePoints: 1000, rankPercent: 80, spec: 'Fire' },
    };

    it('should persist points, title and details for a drafted player', function () {
      const entry = buildPlayerEntry('Arthas', { Arthas: snap }, {}, [snap]);
      expect(entry).to.have.all.keys('points', 'title', 'details');
      expect(entry.points).to.have.all.keys(
        'total', 'parse', 'dps', 'bosses_down', 'speedy_clear', 'new_best', 'consistency', 'all_stars'
      );
      expect(entry.points).to.not.have.property('details');
      expect(entry.title).to.be.a('string').and.not.equal('');
      expect(entry.details.parse.avg).to.equal(85);
      expect(entry.details.bosses_down.new_kills).to.equal(10);
    });

    it('should leave No Pick slots bare with zero points', function () {
      const entry = buildPlayerEntry('No Pick', {}, {}, []);
      expect(entry).to.have.all.keys('points');
      expect(entry.points.total).to.equal(0);
      expect(entry).to.not.have.property('title');
      expect(entry).to.not.have.property('details');
    });

    it('should score a player with no fresh snapshot as zero', function () {
      const entry = buildPlayerEntry('Missing', {}, {}, [snap]);
      expect(entry.points.total).to.equal(0);
      expect(entry.details.parse.avg).to.be.null;
    });
  });
});
