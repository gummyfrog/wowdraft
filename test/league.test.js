const { expect } = require('chai');
const LeagueLogic = require('../routes/league');

describe('LeagueLogic', function () {
  function makeLeague(overrides = {}) {
    return {
      code: 'test',
      admin: { name: 'admin#1234' },
      teams: [
        { id: 't1', name: 'Team A', manager: 'admin#1234', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
        { id: 't2', name: 'Team B', manager: 'user#5678', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
        { id: 't3', name: 'Team C', manager: 'user#9999', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
      ],
      status: 'Setting Up',
      rounds: 2,
      draft: { pick_order: [0], pick_index: 0, picks: [], status: 0 },
      report_day: 'Wednesday',
      ...overrides,
    };
  }

  const adminSession = { loggedin: true, username: 'admin#1234' };

  describe('isDraftComplete', function () {
    it('should set status to Drafted (not Completed) when draft finishes', function () {
      const league = makeLeague({
        status: 'In Progress',
        draft: { pick_order: [0, 1, 2], pick_index: 3, picks: [], status: 1 },
      });
      const logic = new LeagueLogic(league, adminSession);
      logic.isDraftComplete();
      expect(league.status).to.equal('Drafted');
      expect(league.draft.status).to.equal(2);
    });
  });

  describe('startSeason', function () {
    it('should transition from Drafted to Active', function () {
      const league = makeLeague({
        status: 'Drafted',
        draft: { status: 2 },
      });
      const logic = new LeagueLogic(league, adminSession);
      const result = logic.startSeason({ season_length: 6 });
      expect(result).to.equal(true);
      expect(league.status).to.equal('Active');
    });

    it('should generate round-robin matchup schedule', function () {
      const league = makeLeague({
        status: 'Drafted',
        draft: { status: 2 },
      });
      const logic = new LeagueLogic(league, adminSession);
      logic.startSeason({ season_length: 6 });
      expect(league.schedule).to.be.an('array');
      expect(league.schedule.length).to.equal(6);
      // Each week should have matchups
      for (const week of league.schedule) {
        expect(week.matchups).to.be.an('array');
        expect(week.matchups.length).to.be.greaterThan(0);
      }
    });

    it('should handle odd number of teams with byes', function () {
      const league = makeLeague({
        status: 'Drafted',
        draft: { status: 2 },
      });
      const logic = new LeagueLogic(league, adminSession);
      logic.startSeason({ season_length: 3 });
      // 3 teams = someone gets a bye each week
      const hasBye = league.schedule.some(week =>
        week.matchups.some(m => m.bye)
      );
      expect(hasBye).to.equal(true);
    });

    it('should reject if not admin', function () {
      const league = makeLeague({ status: 'Drafted', draft: { status: 2 } });
      const logic = new LeagueLogic(league, { loggedin: true, username: 'nobody#0000' });
      expect(logic.startSeason({ season_length: 6 })).to.equal(false);
    });
  });
});
