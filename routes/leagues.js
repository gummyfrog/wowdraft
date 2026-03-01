const express = require('express');
const short = require('short-uuid');
const db = require('../db');
const LeagueLogic = require('./league');
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
      res.render('league_teams', {
        title: league.name,
        league: JSON.stringify(league),
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
      res.render('league_rankings', {
        title: league.name,
        league: JSON.stringify(league),
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
  new_league.requirements = { dps: 5, healers: 2, tanks: 2 };

  db.leagues().insertOne(new_league)
    .then(() => res.redirect('/leagues'))
    .catch(() => res.redirect('/403'));
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

module.exports = router;
