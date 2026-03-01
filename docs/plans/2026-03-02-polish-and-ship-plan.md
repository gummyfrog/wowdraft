# WoWDraft Polish & Ship Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the monolith routes file, add dotenv config, create seed data with Docker Compose for local MongoDB, and add guest mode — making the app runnable out of the box.

**Architecture:** Keep existing Express + Pug + Vue 2 stack. Extract route handlers from the single `routes/index.js` into focused route files. Create a shared `db.js` module for MongoDB connections. Add a seed script for mock WoW player data.

**Tech Stack:** Express 4, MongoDB (local via Docker), Pug, dotenv, nodemon

---

### Task 1: Dependency Cleanup

**Files:**
- Modify: `package.json`

**Step 1: Remove unused dependencies**

```bash
cd /Users/neil/Documents/GitHub/wowdraft
npm uninstall socket.io ws graphql-request jsonfile mongoose
```

Remove `socket.io`, `ws`, `graphql-request` (never used in code). Remove `jsonfile` (unused). Remove `mongoose` (the app uses the raw `mongodb` driver, not mongoose — mongoose is imported nowhere).

**Step 2: Add new dependencies**

```bash
npm install dotenv
npm install --save-dev nodemon
```

**Step 3: Add npm scripts to package.json**

Update the `scripts` section to:
```json
"scripts": {
  "start": "node ./bin/www",
  "dev": "nodemon ./bin/www",
  "seed": "node scripts/seed.js"
}
```

**Step 4: Verify the app still starts**

```bash
npm start
```

Expected: Server starts on port 3000 (will fail to connect to MongoDB — that's fine, we're fixing that next).

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused deps, add dotenv and nodemon"
```

---

### Task 2: Add dotenv Configuration & Database Module

**Files:**
- Create: `.env.example`
- Create: `.env`
- Create: `db.js`
- Modify: `.gitignore`

**Step 1: Create `.env.example`**

```
# MongoDB connection
MONGO_URI=mongodb://localhost:27017

# Discord OAuth (leave blank for guest mode)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Session
SESSION_SECRET=wowdraft-dev-secret

# Server
NODE_ENV=development
PORT=3000
```

**Step 2: Create `.env` (identical to .env.example for local dev)**

Copy `.env.example` to `.env` with the same defaults.

**Step 3: Update `.gitignore`**

Add `.env` to gitignore (keep `.env.example` tracked). Current gitignore has:
```
node_modules/
db/
.DS_Store
.gitignore
```

Add:
```
.env
```

**Step 4: Create `db.js` — shared database connection module**

This module connects to MongoDB and exports collection references. It uses `MONGO_URI` from `.env`. The key architectural change: instead of all routes living inside a `MongoClient.connect().then()` callback, the DB connects once and exports handles.

```javascript
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';

const client = new MongoClient(uri);

let leaguesDB;
let playersDB;

async function connect() {
  await client.connect();
  console.log('Connected to Database');
  leaguesDB = client.db('wowdraft');
  playersDB = client.db('proplayers');
}

function leagues() {
  return leaguesDB.collection('leagues');
}

function players(tag) {
  return playersDB.collection(tag);
}

module.exports = { connect, leagues, players };
```

**Step 5: Commit**

```bash
git add .env.example .gitignore db.js
git commit -m "feat: add dotenv config and shared db module"
```

---

### Task 3: Create Auth Route with Guest Mode

**Files:**
- Create: `routes/auth.js`

**Step 1: Create `routes/auth.js`**

Extract the Discord OAuth logic (lines 476-553 of current `routes/index.js`) into its own file. Add guest mode: when `DISCORD_CLIENT_ID` is not set, `/auth` auto-logs in as a guest.

```javascript
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
```

**Step 2: Commit**

```bash
git add routes/auth.js
git commit -m "feat: extract auth routes with guest mode fallback"
```

---

### Task 4: Create Leagues Route (Leagues + Teams)

**Files:**
- Create: `routes/leagues.js`

**Step 1: Create `routes/leagues.js`**

Extract all league and team routes from `routes/index.js`. This file handles:
- League listing, viewing, creation
- Team creation, listing
- League rankings
- Activity reports

Uses the `db.js` module instead of closure-scoped DB references.

```javascript
const express = require('express');
const short = require('short-uuid');
const db = require('../db');
const LeagueLogic = require('./league');
const router = express.Router();

// List all leagues
router.get('/', function (req, res) {
  db.leagues().find().toArray()
    .then((leagues) => {
      res.render('leagues', {
        title: 'All Leagues',
        leagues: JSON.stringify(leagues),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    });
});

// Create league form
router.get('/create', function (req, res) {
  res.render('create_league', {
    title: 'League Creation',
    user_session_auth: req.session.loggedin,
    user_session_name: req.session.username,
  });
});

// League home page
router.get('/:leagueID', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      res.render('league', {
        title: league.name,
        league: JSON.stringify(league),
        organizer: leaguelogic.sessionIsAdmin(),
        canMakeTeam: leaguelogic.canMakeTeam(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// League teams page
router.get('/:leagueID/teams', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.render('league_teams', {
        title: league.name,
        league: JSON.stringify(league),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// New team form
router.get('/:leagueID/newTeam', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.render('create_team', {
        title: league.name,
        leagueID: req.params.leagueID,
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// Rankings page
router.get('/:leagueID/rankings', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.render('league_rankings', {
        title: league.name,
        league: JSON.stringify(league),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// API: Get league JSON
router.get('/api/:leagueID', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league))
    .catch(() => res.redirect('/404'));
});

// API: Get teams JSON
router.get('/api/:leagueID/teams', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => res.json(league.teams))
    .catch(() => res.redirect('/404'));
});

// API: Create league
router.post('/api/create', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  var new_league = req.body;
  new_league.code = short.generate();
  new_league.admin = { name: req.session.username };
  new_league.teams = [];
  new_league.status = 'Setting Up';
  new_league.draft = {
    pick_order: [0],
    pick_index: 0,
    picks: [],
    status: 0,
  };
  new_league.requirements = { dps: 5, healers: 2, tanks: 2 };

  db.leagues().insertOne(new_league)
    .then(() => res.redirect('/leagues'))
    .catch(() => res.redirect('/403'));
});

// API: Create team
router.post('/api/:leagueID/newTeam', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      leaguelogic.addTeam(req.body);

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${req.params.leagueID}/`));
    })
    .catch(() => res.redirect('/404'));
});

// API: Activity report
router.post('/api/:leagueID/activity_report', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      if (!league.activity_reports) league.activity_reports = [];
      league.activity_reports.push({ time: new Date(), data: req.body.data });

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: { activity_reports: league.activity_reports } }
      ).then(() => res.json({ msg: 'Accepted' }));
    })
    .catch((err) => res.json({ err }));
});

module.exports = router;
```

**Step 2: Commit**

```bash
git add routes/leagues.js
git commit -m "feat: extract leagues and teams routes"
```

---

### Task 5: Create Draft Route

**Files:**
- Create: `routes/draft.js`

**Step 1: Create `routes/draft.js`**

Extract draft-related routes: start draft, skip turn, draft player, get draft info.

```javascript
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
```

**Step 2: Commit**

```bash
git add routes/draft.js
git commit -m "feat: extract draft routes"
```

---

### Task 6: Create Players Route

**Files:**
- Create: `routes/players.js`

**Step 1: Create `routes/players.js`**

Extract player search/browse endpoints.

```javascript
const express = require('express');
const db = require('../db');
const LeagueLogic = require('./league');
const router = express.Router();

// Player search page
router.get('/:leagueID', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      res.render('proplayers', {
        title: league.name,
        leagueID: req.params.leagueID,
        onClock: leaguelogic.isCurrentTeamManager(),
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

// API: List players by role (paginated)
router.get('/api/:leagueID/:tag/:page', function (req, res) {
  var { leagueID, tag, page } = req.params;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      var faction = league.faction === 'Horde' ? 1 : 0;

      db.players(tag).find({
        drafted: { $nin: [leagueID] },
        faction: faction,
      }).skip(parseInt(page * 10)).limit(10).toArray()
        .then((proplayers) => res.json(proplayers))
        .catch((err) => res.json(err));
    })
    .catch((err) => res.json(err));
});

// API: Search player by name
router.get('/api/:leagueID/:tag/search/:name', function (req, res) {
  var { leagueID, tag, name } = req.params;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      var faction = league.faction === 'Horde' ? 1 : 0;

      db.players(tag).find({
        drafted: { $nin: [leagueID] },
        faction: faction,
        name: { $regex: name, $options: 'i' },
      }).limit(10).toArray()
        .then((proplayers) => res.json(proplayers))
        .catch((err) => res.json(err));
    })
    .catch((err) => res.json(err));
});

// API: Search player by guild (paginated)
router.get('/api/:leagueID/:tag/guild/:guild/:page', function (req, res) {
  var { leagueID, tag, guild, page } = req.params;

  db.leagues().findOne({ code: leagueID })
    .then((league) => {
      var faction = league.faction === 'Horde' ? 1 : 0;

      db.players(tag).find({
        drafted: { $nin: [leagueID] },
        faction: faction,
        guild: { $regex: guild, $options: 'i' },
      }).skip(parseInt(page * 10)).limit(10).toArray()
        .then((proplayers) => res.json(proplayers))
        .catch((err) => res.json(err));
    })
    .catch((err) => res.json(err));
});

module.exports = router;
```

**Important note:** The player search API paths change slightly. The old paths were:
- `/api/proplayers/:leagueID/:tag/:page` → now `/proplayers/api/:leagueID/:tag/:page`
- `/api/proplayer/:leagueID/:tag/:name/` → now `/proplayers/api/:leagueID/:tag/search/:name`
- `/api/proplayer/guild/:leagueID/:tag/:guild/:page` → now `/proplayers/api/:leagueID/:tag/guild/:guild/:page`

We need to update the Pug template `views/proplayers.pug` fetch calls to match the new paths. Check for `fetch(` calls in that file and update the URL prefixes.

**Step 2: Update `views/proplayers.pug` fetch URLs**

Find all `fetch('/api/proplayer` and `fetch('/api/proplayers` calls and update them to use the new `/proplayers/api/` prefix. Also check `views/league.pug` for any API calls that need updating.

**Step 3: Commit**

```bash
git add routes/players.js
git commit -m "feat: extract player search routes"
```

---

### Task 7: Create Admin Route

**Files:**
- Create: `routes/admin.js`

**Step 1: Create `routes/admin.js`**

Extract the debug-mode admin routes.

```javascript
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
```

**Step 2: Commit**

```bash
git add routes/admin.js
git commit -m "feat: extract admin routes"
```

---

### Task 8: Rewrite index.js and app.js to Wire Everything Together

**Files:**
- Modify: `routes/index.js` (gut and replace)
- Modify: `app.js`

**Step 1: Rewrite `routes/index.js`**

Strip it down to just the root redirect and error pages:

```javascript
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
```

**Step 2: Rewrite `app.js`**

Add dotenv, session middleware (moved from index.js), mount all route files, connect DB on startup.

```javascript
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

// session middleware (was in routes/index.js)
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
```

**Step 3: Update Pug template API URLs**

Check ALL Pug/JS files for `fetch('/api/` calls and update paths to match new route mounts:

Old → New path mappings:
- `/api/leagues/create` → `/leagues/api/create`
- `/api/leagues/:id` → `/leagues/api/:id`
- `/api/leagues/:id/teams` → `/leagues/api/:id/teams`
- `/api/leagues/:id/draftInfo` → `/leagues/api/:id/draftInfo`
- `/api/leagues/:id/newTeam` → `/leagues/api/:id/newTeam`
- `/api/leagues/:id/draftPlayer` → `/leagues/api/:id/draftPlayer`
- `/api/leagues/:id/activity_report` → `/leagues/api/:id/activity_report`
- `/api/proplayers/:id/:tag/:page` → `/proplayers/api/:id/:tag/:page`
- `/api/proplayer/:id/:tag/:name` → `/proplayers/api/:id/:tag/search/:name`
- `/api/proplayer/guild/:id/:tag/:guild/:page` → `/proplayers/api/:id/:tag/guild/:guild/:page`

Search all `.pug` files and `public/javascripts/` for these patterns and update them.

Also check: form `action` attributes in `create_league.pug` and `create_team.pug`.

**Step 4: Delete `routes/users.js`** (unused stub file)

**Step 5: Verify the app boots**

```bash
npm run dev
```

Expected: App starts, logs "Connected to Database" (if MongoDB running) or "MongoDB connection failed" (if not yet running — that's OK).

**Step 6: Commit**

```bash
git add app.js routes/index.js routes/
git commit -m "feat: wire up split routes, move session to app.js"
```

---

### Task 9: Docker Compose for Local MongoDB

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create `docker-compose.yml`**

```yaml
services:
  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - wowdraft-data:/data/db

volumes:
  wowdraft-data:
```

**Step 2: Test that MongoDB starts**

```bash
docker-compose up -d
```

Expected: MongoDB container starts and is accessible on port 27017.

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose for local MongoDB"
```

---

### Task 10: Seed Script with Mock WoW Player Data

**Files:**
- Create: `scripts/seed.js`

**Step 1: Create `scripts/seed.js`**

This is the most creative task. The seed script should generate realistic WoW Classic player data across all 9 classes, with appropriate specs for each role (DPS, Healers, Tanks), realistic guild names, varied parse percentages, and encounter rankings.

The script should:
1. Connect to local MongoDB
2. Clear existing data in `dps`, `healers`, `tanks` collections
3. Generate ~150 DPS players, ~80 healers, ~60 tanks
4. Each player has: name, class, guild, tag, faction, drafted (empty array), avgParse, avgDps, avgSpeed, rankings array
5. Create one sample league with 2 teams ready to draft
6. Print a summary of what was seeded

Key data requirements:
- **Classes by role:**
  - DPS: Warrior (Arms/Fury), Rogue (Combat/Assassination), Mage (Fire/Frost/Arcane), Warlock (Destruction/Affliction), Hunter (Marksmanship/Beast Mastery), Druid (Balance), Shaman (Elemental/Enhancement), Priest (Shadow), Paladin (Retribution)
  - Healers: Priest (Holy/Discipline), Druid (Restoration), Shaman (Restoration), Paladin (Holy)
  - Tanks: Warrior (Protection), Druid (Feral), Paladin (Protection)
- **Encounters:** Classic raid bosses (Ragnaros, Onyxia, Nefarian, C'Thun, Kel'Thuzad, etc.)
- **Guilds:** Thematic WoW guild names (~15-20 guilds split between Alliance/Horde)
- Both factions (faction: 0 for Alliance, 1 for Horde) with roughly equal numbers

**Step 2: Run the seed**

```bash
npm run seed
```

Expected output: Summary of seeded players and sample league.

**Step 3: Test the full flow**

```bash
npm run dev
```

Visit http://localhost:3000 — should see the sample league. Navigate to proplayers page and verify player data loads.

**Step 4: Commit**

```bash
git add scripts/seed.js
git commit -m "feat: add seed script with mock WoW Classic player data"
```

---

### Task 11: Update README

**Files:**
- Modify: `readme.md`

**Step 1: Rewrite README with setup instructions**

Replace the current "Messy First Draft" readme with proper setup instructions:

```markdown
# WoWDraft

Fantasy football for World of Warcraft. Create leagues, draft real WoW raiders based on their raid performance, and compete with friends.

## Quick Start

### Prerequisites
- Node.js 16+
- Docker (for local MongoDB)

### Setup

1. Clone and install:
   ```bash
   git clone <repo-url>
   cd wowdraft
   npm install
   ```

2. Start MongoDB:
   ```bash
   docker-compose up -d
   ```

3. Seed the database with mock player data:
   ```bash
   npm run seed
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

### Authentication

By default, the app runs in **guest mode** — click Login and you'll be assigned a guest username. To enable Discord OAuth, set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in your `.env` file.

### Configuration

Copy `.env.example` to `.env` and customize as needed. See `.env.example` for all available options.
```

**Step 2: Commit**

```bash
git add readme.md
git commit -m "docs: rewrite README with setup instructions"
```

---

### Task 12: Smoke Test Full Flow

**Step 1: Start fresh**

```bash
docker-compose down -v
docker-compose up -d
npm run seed
npm run dev
```

**Step 2: Manual smoke test checklist**

- [ ] Homepage redirects to /leagues
- [ ] Sample league appears in league list
- [ ] Click Login → get guest username
- [ ] Click into sample league → league page renders
- [ ] Navigate to proplayers → player list loads
- [ ] Navigate to teams → teams page renders
- [ ] Create a new league → redirects to /leagues
- [ ] Create a team in a league → team appears

**Step 3: Fix any issues found**

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```
