require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MongoStore = require('connect-mongo');
const { v4: uuidv4 } = require('uuid');
var db = require('./db');
var { startScheduler } = require('./services/scheduler');

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
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET || 'wowdraft-dev-secret',
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: 'wowdraft',
    collectionName: 'sessions',
    ttl: 30 * 24 * 60 * 60,
  }),
}));

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
  var status = err.status || 500;
  console.error('[%s %s] %s', req.method, req.originalUrl, err.message);

  // API routes return JSON errors
  if (req.originalUrl.startsWith('/leagues/api/') || req.originalUrl.startsWith('/proplayers/api/')) {
    return res.status(status).json({ error: err.message || 'Server error' });
  }

  // Page routes render error page
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(status);
  res.render('error');
});

// connect to DB then export
db.connect()
  .then(() => {
    console.log('App ready');
    startScheduler();
  })
  .catch((err) => console.error('MongoDB connection failed:', err.message));

module.exports = app;
