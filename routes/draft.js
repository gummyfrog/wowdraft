const express = require('express');
const db = require('../db');
const LeagueLogic = require('./league');
const { generateReport } = require('../services/reports');
const router = express.Router();

// Start draft (admin only)
router.get('/:leagueID/start', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      leaguelogic.startDraft();

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${req.params.leagueID}/`));
    })
    .catch((err) => next(err));
});

// Skip turn (admin only)
router.get('/:leagueID/skip', function (req, res, next) {
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
    .catch((err) => next(err));
});

// API: Get draft info (polled by frontend)
router.get('/api/:leagueID/draftInfo', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league.draft))
    .catch((err) => next(err));
});

// API: Draft a player
router.post('/api/:leagueID/draftPlayer', function (req, res, next) {
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
    .catch((err) => next(err));
});

// API: Generate report (admin only) — kicks off async, returns immediately
router.post('/api/:leagueID/generateReport', function (req, res) {
  if (!req.session.loggedin) return res.status(403).json({ error: 'Not logged in' });

  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      if (!leaguelogic.sessionIsAdmin()) {
        return res.status(403).json({ error: 'Admin only' });
      }

      // Fire and forget — client polls /reportStatus for progress
      generateReport(req.params.leagueID)
        .catch((err) => console.error(`Report generation failed for ${req.params.leagueID}:`, err.message));

      res.json({ started: true });
    })
    .catch(() => res.status(404).json({ error: 'League not found' }));
});

// API: Report generation status
router.get('/api/:leagueID/reportStatus', function (req, res, next) {
  db.leagues().findOne({ code: req.params.leagueID }, { projection: { report_status: 1 } })
    .then((league) => {
      if (!league) return res.status(404).json({ error: 'League not found' });
      res.json(league.report_status || { state: 'idle' });
    })
    .catch((err) => next(err));
});

module.exports = router;
