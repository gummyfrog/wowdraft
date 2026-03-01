const { expect } = require('chai');
const { resolveMatchups } = require('../services/reports');

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
  });
});
