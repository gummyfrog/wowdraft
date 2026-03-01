const express = require('express');
const db = require('../db');
const router = express.Router();

if (process.env.NODE_ENV === 'debug') {
  router.get('/', function (req, res) {
    if (!req.session.loggedin) return res.redirect('/');

    db.leagues().find().toArray()
      .then((leagues) => {
        res.render('admin', {
          title: 'All Leagues ADMIN MODE',
          leagues: JSON.stringify(leagues),
          user_session_auth: req.session.loggedin,
          user_session_name: req.session.username,
        });
      });
  });

  router.get('/leagues/delete/:leagueID', function (req, res) {
    if (!req.session.loggedin) return res.redirect('/');

    db.leagues().deleteOne({ code: req.params.leagueID })
      .then(() => res.redirect('/admin'));
  });

  router.get('/flush', function (req, res) {
    if (!req.session.loggedin) return res.redirect('/');

    db.players('dps').drop();
    db.players('healers').drop();
    db.players('tanks').drop();
    res.redirect('/admin');
  });
}

module.exports = router;
