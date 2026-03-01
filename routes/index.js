const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  res.redirect('/leagues');
});

router.get('/404', function (req, res) {
  res.render('404page', {
    title: 'Oops!',
    user_session_auth: req.session.loggedin,
    user_session_name: req.session.username,
  });
});

router.get('/403', function (req, res) {
  res.render('403page', {
    title: 'Oops!',
    user_session_auth: req.session.loggedin,
    user_session_name: req.session.username,
  });
});

module.exports = router;
