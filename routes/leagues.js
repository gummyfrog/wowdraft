const express = require('express');
const short = require('short-uuid');
const db = require('../db');
const LeagueLogic = require('./league');
const { getClient } = require('../services/warcraftlogs');
const { buildPlayerPool } = require('../services/playerpool');
const wclCache = require('../services/wcl-cache');
const { getZonesForVersion } = require('../data/zones');
const router = express.Router();

// List all leagues
router.get('/', function (req, res, next) {
  db.leagues().find().toArray()
    .then((leagues) => {
      res.render('leagues', {
        title: 'All Leagues',
        leagues: JSON.stringify(leagues),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch((err) => next(err));
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
router.get('/api/guilds/search', function (req, res, next) {
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
      .catch((err) => next(err));
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
    }).catch((err) => next(err));
  }
});

// API: Game versions (static list)
router.get('/api/game-versions', function (req, res) {
  res.json(wclCache.getGameVersions());
});

// API: Regions for a game version
router.get('/api/regions', function (req, res, next) {
  const gameVersion = req.query.game_version || 'retail';
  wclCache.getRegions(gameVersion)
    .then((regions) => {
      if (regions) {
        // Normalize slugs to lowercase for consistency with existing code
        return res.json(regions.map(r => ({
          id: r.id, name: r.name, slug: r.slug.toLowerCase(),
        })));
      }
      // Fallback when WCL is not configured. IDs are placeholder-only —
      // without WCL the /api/servers call also returns [] so these IDs
      // are never used as GraphQL variables.
      res.json([
        { id: 1, name: 'US', slug: 'us' },
        { id: 2, name: 'EU', slug: 'eu' },
        { id: 3, name: 'KR', slug: 'kr' },
        { id: 4, name: 'TW', slug: 'tw' },
      ]);
    })
    .catch((err) => next(err));
});

// API: Servers for a region
router.get('/api/servers', function (req, res, next) {
  const regionId = parseInt(req.query.region_id);
  const gameVersion = req.query.game_version || 'retail';
  if (isNaN(regionId)) return res.status(400).json({ error: 'region_id required' });

  wclCache.getServers(regionId, gameVersion)
    .then((servers) => {
      if (servers) {
        servers.sort((a, b) => a.name.localeCompare(b.name));
        return res.json(servers);
      }
      // Fallback: no servers available without WCL
      res.json([]);
    })
    .catch((err) => next(err));
});

// API: Zones for a game version (latest expansion)
router.get('/api/zones', function (req, res, next) {
  const gameVersion = req.query.game_version || 'retail';

  // Try WCL: get the latest expansion, then its zones
  wclCache.getExpansions(gameVersion)
    .then((expansions) => {
      if (!expansions || expansions.length === 0) {
        return res.json(getZonesForVersion(gameVersion));
      }
      // Latest expansion = highest ID
      const latest = expansions.reduce((a, b) => a.id > b.id ? a : b);
      return wclCache.getZones(latest.id, gameVersion)
        .then((zones) => {
          if (zones && zones.length > 0) return res.json(zones);
          return res.json(getZonesForVersion(gameVersion));
        });
    })
    .catch(() => {
      // Fallback to static zones on any WCL error
      res.json(getZonesForVersion(gameVersion));
    });
});

// League home page
router.get('/:leagueID', function (req, res, next) {
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
    .catch((err) => next(err));
});

// League teams page
router.get('/:leagueID/teams', function (req, res, next) {
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
    .catch((err) => next(err));
});

// New team form
router.get('/:leagueID/newTeam', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.render('create_team', {
        title: league.name,
        leagueID: req.params.leagueID,
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch((err) => next(err));
});

// Rankings page
router.get('/:leagueID/rankings', function (req, res, next) {
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
    .catch((err) => next(err));
});

// API: Get league JSON
router.get('/api/:leagueID', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league))
    .catch((err) => next(err));
});

// API: Get teams JSON
router.get('/api/:leagueID/teams', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league.teams))
    .catch((err) => next(err));
});

// API: Create league
router.post('/api/create', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  // Validate numeric inputs
  var season_length = parseInt(req.body.season_length);
  var rounds = parseInt(req.body.rounds);
  var req_dps = parseInt(req.body.req_dps);
  var req_healers = parseInt(req.body.req_healers);
  var req_tanks = parseInt(req.body.req_tanks);

  if (isNaN(season_length) || season_length < 1 || season_length > 52) return res.status(400).json({ error: 'Season length must be 1-52 weeks' });
  if (isNaN(rounds) || rounds < 1 || rounds > 20) return res.status(400).json({ error: 'Rounds must be 1-20' });
  if (isNaN(req_dps) || req_dps < 0 || req_dps > 20) return res.status(400).json({ error: 'DPS requirement must be 0-20' });
  if (isNaN(req_healers) || req_healers < 0 || req_healers > 20) return res.status(400).json({ error: 'Healer requirement must be 0-20' });
  if (isNaN(req_tanks) || req_tanks < 0 || req_tanks > 20) return res.status(400).json({ error: 'Tank requirement must be 0-20' });

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
  new_league.region_id = parseInt(new_league.region_id) || null;
  new_league.server = new_league.server || null;
  new_league.server_id = parseInt(new_league.server_id) || null;
  new_league.rounds = parseInt(new_league.rounds) || 10;
  new_league.season_length = parseInt(new_league.season_length) || 8;

  // Parse guilds from form (JSON array of {name, faction} objects)
  if (new_league.guilds) {
    if (typeof new_league.guilds === 'string') {
      try { new_league.guilds = JSON.parse(new_league.guilds); } catch (e) { new_league.guilds = []; }
    }
    if (!Array.isArray(new_league.guilds)) new_league.guilds = [];
    new_league.guilds = new_league.guilds.map(g => ({ name: g.name, faction: g.faction || null }));
  } else {
    new_league.guilds = [];
  }

  // Parse raids from form (array of zone IDs)
  if (new_league.raids) {
    if (typeof new_league.raids === 'string') {
      try { new_league.raids = JSON.parse(new_league.raids); } catch (e) { new_league.raids = []; }
    }
  } else {
    // Default: all zones for this game version
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
router.post('/api/:leagueID/newTeam', function (req, res, next) {
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
    .catch((err) => next(err));
});

// API: Activity report
router.post('/api/:leagueID/activity_report', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      if (!league.activity_reports) league.activity_reports = [];
      league.activity_reports.push({ time: new Date(), data: req.body.data });

      return db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: { activity_reports: league.activity_reports } }
      ).then(() => res.json({ msg: 'Accepted' }));
    })
    .catch((err) => next(err));
});

// API: Start season (admin only, after draft completes)
router.post('/api/:leagueID/startSeason', function (req, res, next) {
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
    .catch((err) => next(err));
});

// API: Get standings
router.get('/api/:leagueID/standings', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.json({
        standings: league.standings || {},
        schedule: league.schedule || [],
        currentWeek: (league.activity_reports || []).length + 1,
      });
    })
    .catch((err) => next(err));
});

// Settings page
router.get('/:leagueID/settings', function (req, res, next) {
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
    .catch((err) => next(err));
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
          if (field === 'season_length') {
            var val = parseInt(req.body[field]);
            updates[field] = (isNaN(val) || val < 1 || val > 52) ? league.season_length : val;
          } else {
            updates[field] = req.body[field];
          }
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
