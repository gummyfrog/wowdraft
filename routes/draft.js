const express = require('express');
const { ObjectId } = require('mongodb');
const db = require('../db');
const LeagueLogic = require('./league');
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
  var tag = req.body.tag.toLowerCase();
  var playerID = new ObjectId(req.body.player_id);

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      db.players(tag).findOne({ _id: playerID })
        .then((player) => {
          var leaguelogic = new LeagueLogic(league, req.session);

          if (leaguelogic.draftPlayer(player)) {
            player.drafted.push(leagueID);
            db.players(tag).updateOne(
              { _id: playerID },
              { $set: { drafted: player.drafted } }
            );
          }

          db.leagues().updateOne(
            { code: leagueID },
            { $set: leaguelogic.league }
          ).then(() => res.redirect(`/leagues/${leagueID}/`));
        });
    })
    .catch((err) => console.log('league err', err));
});

module.exports = router;
