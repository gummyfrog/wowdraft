const express = require('express');
const axios = require('axios');
const router = express.Router();

const clientId = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;

// Guest mode: if no Discord credentials, auto-login
const guestMode = !clientId;

router.get('/login', function (req, res) {
  if (guestMode) {
    req.session.loggedin = true;
    req.session.username = 'Guest#' + Math.floor(1000 + Math.random() * 9000);
    return res.redirect('/');
  }
  res.render('login', {
    title: 'Login',
    user_session_auth: req.session.loggedin,
    user_session_name: req.session.username,
  });
});

router.get('/logout', function (req, res) {
  req.session.loggedin = false;
  req.session.username = null;
  res.redirect('/');
});

router.get('/auth', function (req, res) {
  if (guestMode) {
    req.session.loggedin = true;
    req.session.username = 'Guest#' + Math.floor(1000 + Math.random() * 9000);
    return res.redirect('/');
  }

  const { code } = req.query;
  if (!code) return res.redirect('/login');

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('code', code);
  params.append('grant_type', 'authorization_code');

  const redirectUri =
    process.env.NODE_ENV === 'production'
      ? 'https://wowdraft.herokuapp.com/auth'
      : `http://localhost:${process.env.PORT || 3000}/auth`;
  params.append('redirect_uri', redirectUri);
  params.append('scope', 'identify');

  axios
    .post('https://discord.com/api/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    .then((authResult) => {
      axios
        .get('https://discord.com/api/users/@me', {
          headers: {
            authorization: `${authResult.data.token_type} ${authResult.data.access_token}`,
          },
        })
        .then((userResult) => {
          const user = userResult.data;
          req.session.loggedin = true;
          req.session.username = user.username + '#' + user.discriminator;
          res.redirect('/');
        })
        .catch(() => res.redirect('/404'));
    })
    .catch(() => res.redirect('/404'));
});

module.exports = router;
