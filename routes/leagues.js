const express = require('express');
const short = require('short-uuid');
const db = require('../db');
const LeagueLogic = require('./league');
const { getClient } = require('../services/warcraftlogs');
const { buildPlayerPool } = require('../services/playerpool');
const router = express.Router();

// List all leagues
router.get('/', function (req, res) {
  db.leagues().find().toArray()
    .then((leagues) => {
      res.render('leagues', {
        title: 'All Leagues',
        leagues: JSON.stringify(leagues),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    });
});

// Create league form
router.get('/create', function (req, res) {
  res.render('create_league', {
    title: 'League Creation',
    user_session_auth: req.session.loggedin,
    user_session_name: req.session.username,
  });
});

// API: Search guilds (for league creation)
router.get('/api/guilds/search', function (req, res) {
  const q = (req.query.q || '').toLowerCase();
  const serverSlug = (req.query.server || '').toLowerCase().replace(/\s/g, '-');
  const serverRegion = req.query.region || 'us';
  const gameVersion = req.query.game_version || 'retail';

  const wcl = getClient();
  if (wcl && serverSlug) {
    // Search WCL for guilds on this server
    wcl.searchGuilds(serverSlug, serverRegion, gameVersion)
      .then((result) => {
        const guilds = (result && result.data) || [];
        const filtered = q
          ? guilds.filter(g => g.name.toLowerCase().includes(q))
          : guilds;
        res.json(filtered.slice(0, 20).map(g => ({
          name: g.name,
          faction: g.faction ? g.faction.name : null,
        })));
      })
      .catch(() => res.json([]));
  } else {
    // Fallback: return distinct guild names from seed proplayers DB
    const tags = ['dps', 'healers', 'tanks'];
    const guildSet = new Set();

    Promise.all(tags.map(tag =>
      db.players(tag).distinct('guild')
    )).then((results) => {
      for (const guilds of results) {
        for (const g of guilds) guildSet.add(g);
      }
      let guilds = [...guildSet].sort();
      if (q) {
        guilds = guilds.filter(g => g.toLowerCase().includes(q));
      }
      res.json(guilds.map(g => ({ name: g, faction: null })));
    }).catch(() => res.json([]));
  }
});

// League home page
router.get('/:leagueID', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      res.render('league', {
        title: league.name,
        league: JSON.stringify(league),
        organizer: leaguelogic.sessionIsAdmin(),
        canMakeTeam: leaguelogic.canMakeTeam(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// League teams page
router.get('/:leagueID/teams', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      res.render('league_teams', {
        title: league.name,
        league: JSON.stringify(league),
        organizer: leaguelogic.sessionIsAdmin(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// New team form
router.get('/:leagueID/newTeam', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.render('create_team', {
        title: league.name,
        leagueID: req.params.leagueID,
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// Rankings page
router.get('/:leagueID/rankings', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      res.render('league_rankings', {
        title: league.name,
        league: JSON.stringify(league),
        organizer: leaguelogic.sessionIsAdmin(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// API: Get league JSON
router.get('/api/:leagueID', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league))
    .catch(() => res.redirect('/404'));
});

// API: Get teams JSON
router.get('/api/:leagueID/teams', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league.teams))
    .catch(() => res.redirect('/404'));
});

// API: Create league
router.post('/api/create', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  var new_league = req.body;
  new_league.code = short.generate();
  new_league.admin = { name: req.session.username };
  new_league.teams = [];
  new_league.status = 'Setting Up';
  new_league.draft = {
    pick_order: [0],
    pick_index: 0,
    picks: [],
    status: 0,
  };
  new_league.requirements = {
    dps: parseInt(new_league.req_dps) || 5,
    healers: parseInt(new_league.req_healers) || 3,
    tanks: parseInt(new_league.req_tanks) || 2,
  };
  delete new_league.req_dps;
  delete new_league.req_healers;
  delete new_league.req_tanks;
  new_league.game_version = new_league.game_version || 'retail';
  new_league.region = new_league.region || 'us';
  new_league.rounds = parseInt(new_league.rounds) || 10;
  new_league.season_length = parseInt(new_league.season_length) || 8;

  // Parse guilds from form (comma-separated or JSON array)
  var guildNames = [];
  if (new_league.guilds) {
    if (typeof new_league.guilds === 'string') {
      guildNames = new_league.guilds.split(',').map(g => g.trim()).filter(Boolean);
    } else if (Array.isArray(new_league.guilds)) {
      guildNames = new_league.guilds;
    }
  }
  new_league.guilds = guildNames.map(name => ({ name }));

  // Parse raids from form (array of zone IDs)
  if (new_league.raids) {
    if (typeof new_league.raids === 'string') {
      try { new_league.raids = JSON.parse(new_league.raids); } catch (e) { new_league.raids = []; }
    }
  } else {
    // Default: all zones for this game version
    const { getZonesForVersion } = require('../data/zones');
    new_league.raids = getZonesForVersion(new_league.game_version);
  }

  // Build player pool
  buildPlayerPool(new_league)
    .then((pool) => {
      new_league.player_pool = pool;
      return db.leagues().insertOne(new_league);
    })
    .then(() => res.redirect('/leagues'))
    .catch((err) => {
      console.error('League creation failed:', err.message);
      res.redirect('/403');
    });
});

// API: Create team
router.post('/api/:leagueID/newTeam', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      leaguelogic.addTeam(req.body);

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${req.params.leagueID}/`));
    })
    .catch(() => res.redirect('/404'));
});

// API: Activity report
router.post('/api/:leagueID/activity_report', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      if (!league.activity_reports) league.activity_reports = [];
      league.activity_reports.push({ time: new Date(), data: req.body.data });

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: { activity_reports: league.activity_reports } }
      ).then(() => res.json({ msg: 'Accepted' }));
    })
    .catch((err) => res.json({ err }));
});

// API: Start season (admin only, after draft completes)
router.post('/api/:leagueID/startSeason', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      var result = leaguelogic.startSeason(req.body);

      if (!result) return res.status(400).json({ error: 'Cannot start season' });

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${req.params.leagueID}/`));
    })
    .catch(() => res.redirect('/404'));
});

// API: Get standings
router.get('/api/:leagueID/standings', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.json({
        standings: league.standings || {},
        schedule: league.schedule || [],
        currentWeek: (league.activity_reports || []).length + 1,
      });
    })
    .catch(() => res.redirect('/404'));
});

// Settings page
router.get('/:leagueID/settings', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      res.render('league_settings', {
        title: league.name + ' - Settings',
        league: JSON.stringify(league),
        organizer: leaguelogic.sessionIsAdmin(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// API: Update league settings (admin only)
router.post('/api/:leagueID/settings', function (req, res) {
  if (!req.session.loggedin) return res.status(403).json({ error: 'Not logged in' });

  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      if (!leaguelogic.sessionIsAdmin()) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      var updates = {};
      var allowed = ['description', 'report_day', 'season_length', 'draft_notes'];
      for (var field of allowed) {
        if (req.body[field] !== undefined) {
          updates[field] = field === 'season_length'
            ? parseInt(req.body[field]) || league.season_length
            : req.body[field];
        }
      }

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: updates }
      ).then(() => res.json({ success: true }));
    })
    .catch(() => res.status(500).json({ error: 'Server error' }));
});

module.exports = router;
