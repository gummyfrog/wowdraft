const express = require('express');
const db = require('../db');
const LeagueLogic = require('./league');
const router = express.Router();

// Player search page
router.get('/:leagueID', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      var onClock = leaguelogic.isCurrentTeamManager();

      var yourTeam = null;
      var teamIndex = league.teams.findIndex(function(t) { return t.manager === req.session.username; });
      if (teamIndex !== -1) {
        yourTeam = league.teams[teamIndex];
      }

      res.render('proplayers', {
        title: league.name,
        leagueID: req.params.leagueID,
        league: JSON.stringify(league),
        yourTeam: JSON.stringify(yourTeam),
        onClock: onClock,
        organizer: leaguelogic.sessionIsAdmin(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch((err) => next(err));
});

/**
 * Filter and paginate a league's player pool in memory.
 */
function filterPool(league, tag, page, extraFilter) {
  const leagueCode = league.code;
  const pool = league.player_pool || [];
  const PAGE_SIZE = 10;

  let filtered = pool.filter(p =>
    (p.tags ? p.tags.includes(tag) : p.tag === tag) &&
    !p.drafted.includes(leagueCode)
  );

  if (extraFilter) {
    filtered = filtered.filter(extraFilter);
  }

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return paginated;
}

// API: List players by role (paginated)
router.get('/api/:leagueID/:tag/:page', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      const page = parseInt(req.params.page) || 0;
      const tag = req.params.tag.toLowerCase();
      const players = filterPool(league, tag, page);
      res.json(players);
    })
    .catch((err) => next(err));
});

// API: Search players by name
router.get('/api/:leagueID/:tag/search/:name', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      const tag = req.params.tag.toLowerCase();
      const nameRegex = new RegExp(req.params.name, 'i');
      const players = filterPool(league, tag, 0, p => nameRegex.test(p.name));
      res.json(players);
    })
    .catch((err) => next(err));
});

// API: Search players by guild (paginated)
router.get('/api/:leagueID/:tag/guild/:guild/:page', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      const tag = req.params.tag.toLowerCase();
      const page = parseInt(req.params.page) || 0;
      const guildRegex = new RegExp(req.params.guild, 'i');
      const players = filterPool(league, tag, page, p => guildRegex.test(p.guild));
      res.json(players);
    })
    .catch((err) => next(err));
});

module.exports = router;
