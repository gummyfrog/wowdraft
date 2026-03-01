require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
const { v4: uuidv4 } = require('uuid');
var db = require('./db');

var indexRouter = require('./routes/index');
var authRouter = require('./routes/auth');
var leaguesRouter = require('./routes/leagues');
var draftRouter = require('./routes/draft');
var playersRouter = require('./routes/players');
var adminRouter = require('./routes/admin');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// session middleware (moved from routes/index.js)
app.use(session({
  genid: function () { return uuidv4(); },
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET || 'wowdraft-dev-secret',
}));

// default session values
app.use(function (req, res, next) {
  if (!req.session.loggedin) {
    req.session.loggedin = false;
  }
  next();
});

// force https in production
app.use(function (req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
  }
  next();
});

// routes
app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/leagues', leaguesRouter);
app.use('/leagues', draftRouter);
app.use('/proplayers', playersRouter);
app.use('/admin', adminRouter);

// 404 handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// connect to DB then export
db.connect()
  .then(() => console.log('App ready'))
  .catch((err) => console.error('MongoDB connection failed:', err.message));

module.exports = app;
