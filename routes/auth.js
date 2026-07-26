const express = require('express');
const axios = require('axios');
const router = express.Router();

const clientId = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;

// Guest mode: if no Discord credentials, auto-login
const guestMode = !clientId;

// Only relative, single-slash paths are accepted (no protocol-relative redirects)
function safeNext(next) {
  if (typeof next !== 'string') return null;
  if (next.charAt(0) !== '/' || next.charAt(1) === '/') return null;
  return next;
}

function consumeReturnTo(req) {
  const dest = req.session.returnTo || '/';
  delete req.session.returnTo;
  return dest;
}

router.get('/login', function (req, res) {
  const next = safeNext(req.query.next);
  if (next) req.session.returnTo = next;

  if (guestMode) {
    req.session.loggedin = true;
    req.session.username = 'Guest#' + Math.floor(1000 + Math.random() * 9000);
    return res.redirect(consumeReturnTo(req));
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
    return res.redirect(consumeReturnTo(req));
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
          res.redirect(consumeReturnTo(req));
        })
        .catch(() => res.redirect('/404'));
    })
    .catch(() => res.redirect('/404'));
});

module.exports = router;
