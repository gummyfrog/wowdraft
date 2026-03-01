const express = require('express');
const db = require('../db');
const LeagueLogic = require('./league');
const router = express.Router();

// Player search page
router.get('/:leagueID', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      res.render('proplayers', {
        title: league.name,
        leagueID: req.params.leagueID,
        onClock: leaguelogic.isCurrentTeamManager(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// API: List players by role (paginated)
router.get('/api/:leagueID/:tag/:page', function (req, res) {
  var { leagueID, tag, page } = req.params;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      var faction = league.faction === 'Horde' ? 1 : 0;

      db.players(tag).find({
        drafted: { $nin: [leagueID] },
        faction: faction,
      }).skip(parseInt(page * 10)).limit(10).toArray()
        .then((proplayers) => res.json(proplayers))
        .catch((err) => res.json(err));
    })
    .catch((err) => res.json(err));
});

// API: Search player by name
router.get('/api/:leagueID/:tag/search/:name', function (req, res) {
  var { leagueID, tag, name } = req.params;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      var faction = league.faction === 'Horde' ? 1 : 0;

      db.players(tag).find({
        drafted: { $nin: [leagueID] },
        faction: faction,
        name: { $regex: name, $options: 'i' },
      }).limit(10).toArray()
        .then((proplayers) => res.json(proplayers))
        .catch((err) => res.json(err));
    })
    .catch((err) => res.json(err));
});

// API: Search player by guild (paginated)
router.get('/api/:leagueID/:tag/guild/:guild/:page', function (req, res) {
  var { leagueID, tag, guild, page } = req.params;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      var faction = league.faction === 'Horde' ? 1 : 0;

      db.players(tag).find({
        drafted: { $nin: [leagueID] },
        faction: faction,
        guild: { $regex: guild, $options: 'i' },
      }).skip(parseInt(page * 10)).limit(10).toArray()
        .then((proplayers) => res.json(proplayers))
        .catch((err) => res.json(err));
    })
    .catch((err) => res.json(err));
});

module.exports = router;
