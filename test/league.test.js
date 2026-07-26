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

  describe('joinEligibility', function () {
    it('should reject anonymous visitors with not_logged_in', function () {
      const logic = new LeagueLogic(makeLeague(), { loggedin: false });
      expect(logic.joinEligibility()).to.deep.equal({ canJoin: false, reason: 'not_logged_in' });
      expect(logic.canMakeTeam()).to.equal(false);
    });

    it('should allow a logged in user with no team while Setting Up', function () {
      const logic = new LeagueLogic(makeLeague(), { loggedin: true, username: 'newbie#0001' });
      expect(logic.joinEligibility()).to.deep.equal({ canJoin: true, reason: null });
      expect(logic.canMakeTeam()).to.equal(true);
    });

    it('should reject an existing manager with already_manager', function () {
      const logic = new LeagueLogic(makeLeague(), { loggedin: true, username: 'user#5678' });
      expect(logic.joinEligibility()).to.deep.equal({ canJoin: false, reason: 'already_manager' });
      expect(logic.canMakeTeam()).to.equal(false);
    });

    it('should reject joins once the league is Active with wrong_status', function () {
      const logic = new LeagueLogic(makeLeague({ status: 'Active' }), { loggedin: true, username: 'newbie#0001' });
      expect(logic.joinEligibility()).to.deep.equal({ canJoin: false, reason: 'wrong_status' });
      expect(logic.canMakeTeam()).to.equal(false);
    });
  });

  describe('identity and ownership', function () {
    const idSession = { loggedin: true, username: 'admin#1234', user_id: 'discord:111' };

    function idLeague(overrides = {}) {
      return makeLeague({
        admin: { id: 'discord:111', name: 'admin#1234' },
        teams: [
          { id: 't1', name: 'Team A', manager: 'admin#1234', manager_id: 'discord:111', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
          { id: 't2', name: 'Team B', manager: 'user#5678', manager_id: 'discord:222', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
        ],
        ...overrides,
      });
    }

    it('should match the admin by user_id when both sides carry ids', function () {
      const logic = new LeagueLogic(idLeague(), idSession);
      expect(logic.sessionIsAdmin()).to.equal(true);
    });

    it('should reject an impostor who shares the admin display name but not the id', function () {
      const logic = new LeagueLogic(idLeague(), { loggedin: true, username: 'admin#1234', user_id: 'discord:999' });
      expect(logic.sessionIsAdmin()).to.equal(false);
    });

    it('should still recognise the admin after a Discord display-name change', function () {
      const logic = new LeagueLogic(idLeague(), { loggedin: true, username: 'renamed', user_id: 'discord:111' });
      expect(logic.sessionIsAdmin()).to.equal(true);
    });

    it('should fall back to name matching for legacy leagues with no admin id', function () {
      const logic = new LeagueLogic(makeLeague(), idSession);
      expect(logic.sessionIsAdmin()).to.equal(true);
    });

    it('should fall back to name matching for legacy sessions with no user_id', function () {
      const logic = new LeagueLogic(idLeague(), { loggedin: true, username: 'admin#1234' });
      expect(logic.sessionIsAdmin()).to.equal(true);
    });

    it('should never treat an anonymous visitor as admin', function () {
      const logic = new LeagueLogic(makeLeague({ admin: {} }), { loggedin: false });
      expect(logic.sessionIsAdmin()).to.equal(false);
    });

    it('should stamp manager and manager_id on a newly created team', function () {
      const league = idLeague({ teams: [] });
      const logic = new LeagueLogic(league, idSession);
      expect(logic.addTeam({ name: 'Team X' })).to.equal(true);
      expect(league.teams[0].manager).to.equal('admin#1234');
      expect(league.teams[0].manager_id).to.equal('discord:111');
    });

    it('should block a duplicate team by manager_id even after a rename', function () {
      const logic = new LeagueLogic(idLeague(), { loggedin: true, username: 'renamed', user_id: 'discord:222' });
      expect(logic.joinEligibility()).to.deep.equal({ canJoin: false, reason: 'already_manager' });
    });

    it('should block a duplicate team on a legacy team doc via name fallback', function () {
      const league = makeLeague();
      const logic = new LeagueLogic(league, { loggedin: true, username: 'user#5678', user_id: 'discord:222' });
      expect(logic.joinEligibility()).to.deep.equal({ canJoin: false, reason: 'already_manager' });
    });

    it('should allow a fresh id-bearing user to join an id-keyed league', function () {
      const logic = new LeagueLogic(idLeague(), { loggedin: true, username: 'newbie#0001', user_id: 'discord:333' });
      expect(logic.joinEligibility()).to.deep.equal({ canJoin: true, reason: null });
    });

    it('should gate the draft clock on manager_id when ids are present', function () {
      const league = idLeague({ draft: { pick_order: [1], pick_index: 0, picks: [], status: 1 } });
      expect(new LeagueLogic(league, idSession).isCurrentTeamManager()).to.equal(false);
      expect(new LeagueLogic(league, { loggedin: true, username: 'whatever', user_id: 'discord:222' }).isCurrentTeamManager()).to.equal(true);
    });

    it('should gate the draft clock by name for a legacy team with an id-bearing session', function () {
      const league = makeLeague({ draft: { pick_order: [1], pick_index: 0, picks: [], status: 1 } });
      const logic = new LeagueLogic(league, { loggedin: true, username: 'user#5678', user_id: 'discord:222' });
      expect(logic.isCurrentTeamManager()).to.equal(true);
    });
  });
});
