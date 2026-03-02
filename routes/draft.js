const express = require('express');
const db = require('../db');
const LeagueLogic = require('./league');
const { generateReport } = require('../services/reports');
const router = express.Router();

// Start draft (admin only)
router.get('/:leagueID/start', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      leaguelogic.startDraft();

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${req.params.leagueID}/`));
    })
    .catch(() => res.redirect('/404'));
});

// Skip turn (admin only)
router.get('/:leagueID/skip', function (req, res) {
  var leagueID = req.params.leagueID;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      leaguelogic.skip();

      db.leagues().updateOne(
        { code: leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${leagueID}/`));
    })
    .catch((err) => {
      console.log(err);
      res.redirect('/403');
    });
});

// API: Get draft info (polled by frontend)
router.get('/api/:leagueID/draftInfo', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league.draft))
    .catch(() => res.redirect('/404'));
});

// API: Draft a player
router.post('/api/:leagueID/draftPlayer', function (req, res) {
  var leagueID = req.params.leagueID;
  var playerName = req.body.player_name;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      // Find player in the league's player pool
      var player = (league.player_pool || []).find(p => p.name === playerName);

      if (!player) {
        // Fallback: try the old proplayers DB (for leagues without player_pool)
        var tag = (req.body.tag || 'dps').toLowerCase();
        var playerID = req.body.player_id;
        if (playerID) {
          const { ObjectId } = require('mongodb');
          db.players(tag).findOne({ _id: new ObjectId(playerID) })
            .then((dbPlayer) => {
              if (!dbPlayer) return res.redirect(`/leagues/${leagueID}/`);
              var leaguelogic = new LeagueLogic(league, req.session);
              if (leaguelogic.draftPlayer(dbPlayer)) {
                dbPlayer.drafted.push(leagueID);
                db.players(tag).updateOne(
                  { _id: new ObjectId(playerID) },
                  { $set: { drafted: dbPlayer.drafted } }
                );
              }
              db.leagues().updateOne(
                { code: leagueID },
                { $set: leaguelogic.league }
              ).then(() => res.redirect(`/leagues/${leagueID}/`));
            });
          return;
        }
        return res.redirect(`/leagues/${leagueID}/`);
      }

      var leaguelogic = new LeagueLogic(league, req.session);

      if (leaguelogic.draftPlayer(player)) {
        // Mark drafted in the player pool
        var poolPlayer = league.player_pool.find(p => p.name === playerName);
        if (poolPlayer) poolPlayer.drafted.push(leagueID);
      }

      db.leagues().updateOne(
        { code: leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${leagueID}/`));
    })
    .catch((err) => {
      console.log('draft err', err);
      res.redirect(`/leagues/${leagueID}/`);
    });
});

// API: Generate report
router.post('/api/:leagueID/generateReport', function (req, res) {
  generateReport(req.params.leagueID)
    .then((report) => res.json({ success: true, report }))
    .catch((err) => res.status(500).json({ error: err.message }));
});

module.exports = router;
