# Guild-Scoped Drafting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static global player pool with guild-scoped drafting, where each league's player pool is stored on the league document and populated from either WCL or seed data using the same schema.

**Architecture:** A new player pool service builds the pool from WCL guilds or the seed `proplayers` DB, always producing the same data shape. The draft UI reads from `league.player_pool` instead of querying the global DB directly. League creation includes guild selection and raid zone checkboxes. Report generation passes zone IDs and time windows to WCL queries.

**Tech Stack:** Express 4, MongoDB, Warcraft Logs GraphQL API v2, Pug + Vue 2

---

### Task 1: Raid Zone Data & WCL Class Map

**Files:**
- Create: `data/zones.js`
- Create: `data/classes.js`
- Create: `test/data.test.js`

Static lookup data used throughout the feature. Zone IDs map to WCL API zone IDs. Class IDs map WCL numeric class IDs to names and default roles.

**Step 1: Create `data/zones.js`**

```javascript
// Raid zones by game version, keyed by WCL zone ID
// These IDs correspond to WCL API zone identifiers
const ZONES = {
  classic: [
    { id: 1000, name: 'Molten Core' },
    { id: 1001, name: "Onyxia's Lair" },
    { id: 1002, name: 'Blackwing Lair' },
    { id: 1003, name: "Zul'Gurub" },
    { id: 1004, name: "Temple of Ahn'Qiraj" },
    { id: 1005, name: "Ruins of Ahn'Qiraj" },
    { id: 1006, name: 'Naxxramas' },
  ],
  retail: [
    { id: 38, name: "Nerub'ar Palace" },
    { id: 37, name: 'Amirdrassil' },
  ],
};

function getZonesForVersion(gameVersion) {
  return ZONES[gameVersion] || ZONES.retail;
}

module.exports = { ZONES, getZonesForVersion };
```

**Step 2: Create `data/classes.js`**

```javascript
// WCL class IDs → name + default role
const WCL_CLASSES = {
  1: { name: 'Warrior', defaultTag: 'dps', specs: ['Arms', 'Fury', 'Protection'] },
  2: { name: 'Paladin', defaultTag: 'healers', specs: ['Holy', 'Protection', 'Retribution'] },
  3: { name: 'Hunter', defaultTag: 'dps', specs: ['Beast Mastery', 'Marksmanship', 'Survival'] },
  4: { name: 'Rogue', defaultTag: 'dps', specs: ['Assassination', 'Combat', 'Subtlety'] },
  5: { name: 'Priest', defaultTag: 'healers', specs: ['Discipline', 'Holy', 'Shadow'] },
  6: { name: 'Death Knight', defaultTag: 'dps', specs: ['Blood', 'Frost', 'Unholy'] },
  7: { name: 'Shaman', defaultTag: 'healers', specs: ['Elemental', 'Enhancement', 'Restoration'] },
  8: { name: 'Mage', defaultTag: 'dps', specs: ['Arcane', 'Fire', 'Frost'] },
  9: { name: 'Warlock', defaultTag: 'dps', specs: ['Affliction', 'Demonology', 'Destruction'] },
  10: { name: 'Monk', defaultTag: 'healers', specs: ['Brewmaster', 'Mistweaver', 'Windwalker'] },
  11: { name: 'Druid', defaultTag: 'dps', specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] },
  12: { name: 'Demon Hunter', defaultTag: 'dps', specs: ['Havoc', 'Vengeance'] },
  13: { name: 'Evoker', defaultTag: 'dps', specs: ['Devastation', 'Preservation', 'Augmentation'] },
};

function resolveClass(classID) {
  return WCL_CLASSES[classID] || { name: 'Unknown', defaultTag: 'dps', specs: ['Unknown'] };
}

module.exports = { WCL_CLASSES, resolveClass };
```

**Step 3: Write tests in `test/data.test.js`**

```javascript
const { expect } = require('chai');
const { ZONES, getZonesForVersion } = require('../data/zones');
const { WCL_CLASSES, resolveClass } = require('../data/classes');

describe('Zone Data', function () {
  it('should have classic and retail zones', function () {
    expect(ZONES.classic).to.be.an('array').with.length.greaterThan(0);
    expect(ZONES.retail).to.be.an('array').with.length.greaterThan(0);
  });

  it('each zone should have id and name', function () {
    for (const zones of Object.values(ZONES)) {
      for (const zone of zones) {
        expect(zone).to.have.property('id');
        expect(zone).to.have.property('name');
      }
    }
  });

  it('getZonesForVersion should return correct zones', function () {
    expect(getZonesForVersion('classic')).to.equal(ZONES.classic);
    expect(getZonesForVersion('retail')).to.equal(ZONES.retail);
    expect(getZonesForVersion('unknown')).to.equal(ZONES.retail);
  });
});

describe('Class Data', function () {
  it('should have entries for class IDs 1-13', function () {
    for (let i = 1; i <= 13; i++) {
      expect(WCL_CLASSES[i]).to.have.property('name');
      expect(WCL_CLASSES[i]).to.have.property('defaultTag');
      expect(WCL_CLASSES[i]).to.have.property('specs');
    }
  });

  it('resolveClass should return class info', function () {
    const warrior = resolveClass(1);
    expect(warrior.name).to.equal('Warrior');
    expect(warrior.defaultTag).to.equal('dps');
  });

  it('resolveClass should handle unknown IDs', function () {
    const unknown = resolveClass(999);
    expect(unknown.name).to.equal('Unknown');
  });
});
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests passing.

**Step 5: Commit**

```bash
git add data/zones.js data/classes.js test/data.test.js
git commit -m "feat: add raid zone and WCL class lookup data"
```

---

### Task 2: Player Pool Service

**Files:**
- Create: `services/playerpool.js`
- Create: `test/playerpool.test.js`

This service builds `league.player_pool` from either the seed `proplayers` DB or from WCL guild rosters. Both paths produce the same player schema.

**Step 1: Create `services/playerpool.js`**

```javascript
const db = require('../db');
const { getClient } = require('./warcraftlogs');
const { resolveClass } = require('../data/classes');

/**
 * Normalize a seed player (from proplayers DB) into player_pool format.
 */
function normalizeSeedPlayer(player) {
  return {
    name: player.name,
    class: player.class,
    guild: player.guild,
    tag: player.tag,
    faction: player.faction,
    drafted: [],
    active: true,
    avgParse: player.avgParse || null,
    avgDps: player.avgDps || null,
    avgSpeed: player.avgSpeed || null,
    rankings: player.rankings || [],
  };
}

/**
 * Normalize a WCL guild member into player_pool format.
 */
function normalizeWCLPlayer(member, guildName, faction) {
  const classInfo = resolveClass(member.classID);
  return {
    name: member.name,
    class: classInfo.name,
    guild: guildName,
    tag: classInfo.defaultTag,
    faction: faction,
    drafted: [],
    active: true,
    avgParse: null,
    avgDps: null,
    avgSpeed: null,
    rankings: [{ spec: classInfo.specs[0], rankPercent: 0, encounter_data: { encounter: { name: 'Unknown' } } }],
  };
}

/**
 * Build player pool from seed proplayers DB.
 * Fetches players whose guild matches one of the selected guilds.
 */
async function buildPoolFromSeed(guilds, faction) {
  const guildNames = guilds.map(g => g.name);
  const pool = [];

  for (const tag of ['dps', 'healers', 'tanks']) {
    const query = {
      guild: { $in: guildNames },
    };
    // Only filter by faction if specified (0 or 1)
    if (faction === 0 || faction === 1) {
      query.faction = faction;
    }

    const players = await db.players(tag).find(query).toArray();
    for (const p of players) {
      pool.push(normalizeSeedPlayer(p));
    }
  }

  return pool;
}

/**
 * Build player pool from WCL guild rosters.
 * Fetches member lists from WCL API for each guild.
 */
async function buildPoolFromWCL(guilds, serverSlug, serverRegion, gameVersion, faction) {
  const wcl = getClient();
  if (!wcl) return [];

  const pool = [];
  const seen = new Set();

  for (const guild of guilds) {
    try {
      const guildData = await wcl.getGuildMembers(
        guild.name,
        serverSlug,
        serverRegion,
        gameVersion
      );

      if (guildData && guildData.members && guildData.members.data) {
        for (const member of guildData.members.data) {
          if (seen.has(member.name)) continue;
          seen.add(member.name);
          pool.push(normalizeWCLPlayer(member, guild.name, faction));
        }
      }
    } catch (err) {
      console.error(`Failed to fetch guild ${guild.name}:`, err.message);
    }
  }

  return pool;
}

/**
 * Build the player pool for a league.
 * Uses WCL if configured, otherwise falls back to seed data.
 */
async function buildPlayerPool(league) {
  const guilds = league.guilds || [];
  const serverSlug = (league.server || '').toLowerCase().replace(/\s/g, '-');
  const serverRegion = league.region || 'us';
  const gameVersion = league.game_version || 'retail';
  const faction = league.faction === 'Alliance' ? 0 : league.faction === 'Horde' ? 1 : null;

  const wcl = getClient();
  if (wcl && guilds.length > 0) {
    return buildPoolFromWCL(guilds, serverSlug, serverRegion, gameVersion, faction);
  }

  // Fallback: build from seed data
  if (guilds.length > 0) {
    return buildPoolFromSeed(guilds, faction);
  }

  return [];
}

module.exports = {
  buildPlayerPool,
  buildPoolFromSeed,
  buildPoolFromWCL,
  normalizeSeedPlayer,
  normalizeWCLPlayer,
};
```

**Step 2: Write tests in `test/playerpool.test.js`**

```javascript
const { expect } = require('chai');
const { normalizeSeedPlayer, normalizeWCLPlayer } = require('../services/playerpool');

describe('Player Pool Service', function () {
  describe('normalizeSeedPlayer', function () {
    it('should normalize a seed player to pool format', function () {
      const seed = {
        name: 'Arthas',
        class: 'Warrior',
        guild: 'APES',
        tag: 'dps',
        faction: 0,
        drafted: ['some-league'],
        avgParse: 85,
        avgDps: 1500,
        avgSpeed: 72,
        rankings: [{ spec: 'Fury', rankPercent: 90, encounter_data: { encounter: { name: 'Ragnaros' } } }],
      };

      const result = normalizeSeedPlayer(seed);
      expect(result.name).to.equal('Arthas');
      expect(result.class).to.equal('Warrior');
      expect(result.guild).to.equal('APES');
      expect(result.tag).to.equal('dps');
      expect(result.drafted).to.deep.equal([]);
      expect(result.active).to.equal(true);
      expect(result.avgParse).to.equal(85);
      expect(result.rankings).to.have.length(1);
    });
  });

  describe('normalizeWCLPlayer', function () {
    it('should normalize a WCL member to pool format', function () {
      const member = { name: 'Thrall', classID: 7 };
      const result = normalizeWCLPlayer(member, 'Grizzly', 1);
      expect(result.name).to.equal('Thrall');
      expect(result.class).to.equal('Shaman');
      expect(result.guild).to.equal('Grizzly');
      expect(result.tag).to.equal('healers');
      expect(result.faction).to.equal(1);
      expect(result.drafted).to.deep.equal([]);
      expect(result.active).to.equal(true);
      expect(result.avgParse).to.be.null;
      expect(result.rankings).to.have.length(1);
      expect(result.rankings[0].spec).to.equal('Elemental');
    });

    it('should handle unknown class IDs', function () {
      const member = { name: 'Mystery', classID: 999 };
      const result = normalizeWCLPlayer(member, 'Guild', 0);
      expect(result.class).to.equal('Unknown');
      expect(result.tag).to.equal('dps');
    });
  });
});
```

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests passing.

**Step 4: Commit**

```bash
git add services/playerpool.js test/playerpool.test.js
git commit -m "feat: add player pool service for unified seed/WCL player normalization"
```

---

### Task 3: Update Seed with Player Pool

**Files:**
- Modify: `scripts/seed.js`

Update the demo league to include `player_pool` containing all seed players from selected guilds. Also add `guilds` and `raids` fields.

**Step 1: Update `buildDemoLeague` in `scripts/seed.js`**

After the teams are built and before the return statement, add a `player_pool` that contains all seed players from the demo guilds. Also add `guilds` and `raids` fields.

Find the return statement in `buildDemoLeague` (around line 380) and add these fields to the returned league object:

```javascript
guilds: [
  { name: 'Grizzly' },
  { name: 'Fusion' },
  { name: 'Classic Guild' },
],
raids: [
  { id: 1000, name: 'Molten Core' },
  { id: 1002, name: 'Blackwing Lair' },
  { id: 1006, name: 'Naxxramas' },
],
```

Add a `player_pool` field built from the DPS, healer, and tank players. Add this function inside `buildDemoLeague`, before the return:

```javascript
// Build player_pool from all Horde players (since demo is Horde faction)
const playerPool = [];
const allPlayers = [...dpsPlayers, ...healerPlayers, ...tankPlayers];
const demoGuilds = ['Grizzly', 'Fusion', 'Classic Guild', 'Spirit', 'BEEF',
  'Warlords of Draenor', 'Vanguard', 'Bonk', 'Death and Taxes', 'Ascent'];
for (const p of allPlayers) {
  if (p.faction === 1 && demoGuilds.includes(p.guild)) {
    playerPool.push({
      name: p.name,
      class: p.class,
      guild: p.guild,
      tag: p.tag,
      faction: p.faction,
      drafted: [],
      active: true,
      avgParse: p.avgParse,
      avgDps: p.avgDps,
      avgSpeed: p.avgSpeed,
      rankings: p.rankings,
    });
  }
}

// Mark drafted players in the pool
for (const team of teams) {
  for (const dp of team.drafted_players) {
    const poolPlayer = playerPool.find(p => p.name === dp.name);
    if (poolPlayer) poolPlayer.drafted.push('demo');
  }
}
```

Then add `player_pool: playerPool,` to the return object.

**Step 2: Run seed and verify**

```bash
npm run seed
```

Expected: Seed completes. Output should show player count. Verify with a quick DB check:

```bash
node -e "require('dotenv').config(); const {MongoClient}=require('mongodb'); MongoClient.connect(process.env.MONGO_URI||'mongodb://localhost:27017').then(c=>{c.db('wowdraft').collection('leagues').findOne({code:'demo'}).then(l=>{console.log('player_pool length:', l.player_pool.length); console.log('guilds:', l.guilds); console.log('raids:', l.raids); c.close()})})"
```

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests still passing.

**Step 4: Commit**

```bash
git add scripts/seed.js
git commit -m "feat: add player_pool, guilds, and raids to seed demo league"
```

---

### Task 4: Player Browse Backend

**Files:**
- Modify: `routes/players.js`

Change all player browse/search routes to read from `league.player_pool` instead of the global `proplayers` DB. This is the core change that makes the draft guild-scoped.

**Step 1: Rewrite `routes/players.js`**

Replace the entire file:

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
      var onClock = leaguelogic.isCurrentTeamManager();
      res.render('proplayers', {
        title: league.name,
        leagueID: req.params.leagueID,
        onClock: onClock,
        user_session_auth: req.session.loggedin,
        user_session_name: req.session.username,
      });
    })
    .catch(() => res.redirect('/404'));
});

/**
 * Filter and paginate a league's player pool in memory.
 */
function filterPool(league, tag, page, extraFilter) {
  const leagueCode = league.code;
  const pool = league.player_pool || [];
  const PAGE_SIZE = 10;

  let filtered = pool.filter(p =>
    p.tag === tag &&
    !p.drafted.includes(leagueCode)
  );

  if (extraFilter) {
    filtered = filtered.filter(extraFilter);
  }

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return paginated;
}

// API: List players by role (paginated)
router.get('/api/:leagueID/:tag/:page', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      const page = parseInt(req.params.page) || 0;
      const tag = req.params.tag.toLowerCase();
      const players = filterPool(league, tag, page);
      res.json(players);
    })
    .catch(() => res.json([]));
});

// API: Search players by name
router.get('/api/:leagueID/:tag/search/:name', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      const tag = req.params.tag.toLowerCase();
      const nameRegex = new RegExp(req.params.name, 'i');
      const players = filterPool(league, tag, 0, p => nameRegex.test(p.name));
      res.json(players);
    })
    .catch(() => res.json([]));
});

// API: Search players by guild (paginated)
router.get('/api/:leagueID/:tag/guild/:guild/:page', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      const tag = req.params.tag.toLowerCase();
      const page = parseInt(req.params.page) || 0;
      const guildRegex = new RegExp(req.params.guild, 'i');
      const players = filterPool(league, tag, page, p => guildRegex.test(p.guild));
      res.json(players);
    })
    .catch(() => res.json([]));
});

module.exports = router;
```

Key changes from the old version:
- Removed `{ ObjectId } = require('mongodb')` — no longer querying proplayers DB
- Removed faction filtering (player_pool is already scoped to the league)
- Added `filterPool()` helper for in-memory filtering + pagination
- All routes load the league first, then filter `league.player_pool`

**Step 2: Run tests**

```bash
npm test
```

Expected: All tests still passing.

**Step 3: Commit**

```bash
git add routes/players.js
git commit -m "feat: player browse reads from league.player_pool instead of global DB"
```

---

### Task 5: Draft Route Updates

**Files:**
- Modify: `routes/draft.js`

Change the `draftPlayer` route to find players from `league.player_pool` instead of the `proplayers` DB, and mark them as drafted in the pool.

**Step 1: Update the draftPlayer route in `routes/draft.js`**

Replace the `POST /api/:leagueID/draftPlayer` route (lines 49-76):

```javascript
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
```

Also remove the `const { ObjectId } = require('mongodb');` import at the top of the file (line 2) since it's now only needed in the fallback path and imported inline there.

**Step 2: Run tests**

```bash
npm test
```

Expected: All tests still passing.

**Step 3: Commit**

```bash
git add routes/draft.js
git commit -m "feat: draft reads from league.player_pool with fallback to proplayers DB"
```

---

### Task 6: Player Browse UI Updates

**Files:**
- Modify: `views/proplayers.pug`

Update the draft form to send `player_name` instead of `player_id` + `tag`. Handle nullable stats (avgParse, avgDps, avgSpeed) for WCL-sourced players.

**Step 1: Update the draft form in the `player-item` component**

In `views/proplayers.pug`, find the draft form (around lines 76-80):

```html
<form v-if="!{onClock}" action="" method="post">
    <input type="hidden" name="player_id" :value="player._id">
    <input type="hidden" name="tag" :value="player.tag">
    <button class="draft_button" type="submit" :formaction="'/leagues/api/'+leagueID+'/draftPlayer'">
```

Replace with:

```html
<form v-if="!{onClock}" action="" method="post">
    <input type="hidden" name="player_name" :value="player.name">
    <button class="draft_button" type="submit" :formaction="'/leagues/api/'+leagueID+'/draftPlayer'">
```

**Step 2: Handle nullable stats in the player-item template**

Find the stats display section (around lines 52-67) and wrap each stat with a `v-if` check:

Replace the `avgParse` badge:
```html
<h2 v-if="player.avgParse != null" class="badge parsebadge" :style="parseStyle(player.avgParse)"> {{Math.round(player.avgParse)}} </h2>
```

Replace the `avgDps` badge:
```html
<h2 v-if="player.avgDps != null" class="badge dpsbadge"> {{Math.round(player.avgDps)}} </h2>
```

Replace the `avgSpeed` badge:
```html
<h2 v-if="player.avgSpeed != null" class="badge speedbadge"> {{Math.round(player.avgSpeed)}} </h2>
```

Add an "active" indicator (after the guild display):
```html
<span v-if="player.active === false" class="inactive_badge">Inactive</span>
```

**Step 3: Commit**

```bash
git add views/proplayers.pug
git commit -m "feat: update draft UI to use player_name and handle nullable stats"
```

---

### Task 7: Guild Search Route

**Files:**
- Modify: `routes/leagues.js`

Add a guild search endpoint that returns guild names from WCL or from the seed `proplayers` DB.

**Step 1: Add guild search route to `routes/leagues.js`**

Add after the standings route, before `module.exports`:

```javascript
const { getClient } = require('../services/warcraftlogs');

// API: Search guilds (for league creation)
router.get('/api/guilds/search', function (req, res) {
  const q = (req.query.q || '').toLowerCase();
  const serverSlug = (req.query.server || '').toLowerCase().replace(/\s/g, '-');
  const serverRegion = req.query.region || 'us';
  const gameVersion = req.query.game_version || 'retail';

  const wcl = getClient();
  if (wcl && serverSlug) {
    // Search WCL for guilds on this server
    wcl.searchGuilds(serverSlug, serverRegion, gameVersion)
      .then((result) => {
        const guilds = (result && result.data) || [];
        const filtered = q
          ? guilds.filter(g => g.name.toLowerCase().includes(q))
          : guilds;
        res.json(filtered.slice(0, 20).map(g => ({
          name: g.name,
          faction: g.faction ? g.faction.name : null,
        })));
      })
      .catch(() => res.json([]));
  } else {
    // Fallback: return distinct guild names from seed proplayers DB
    const tags = ['dps', 'healers', 'tanks'];
    const guildSet = new Set();

    Promise.all(tags.map(tag =>
      db.players(tag).distinct('guild')
    )).then((results) => {
      for (const guilds of results) {
        for (const g of guilds) guildSet.add(g);
      }
      let guilds = [...guildSet].sort();
      if (q) {
        guilds = guilds.filter(g => g.toLowerCase().includes(q));
      }
      res.json(guilds.slice(0, 20).map(g => ({ name: g, faction: null })));
    }).catch(() => res.json([]));
  }
});
```

**Step 2: Run tests**

```bash
npm test
```

Expected: All tests still passing.

**Step 3: Commit**

```bash
git add routes/leagues.js
git commit -m "feat: add guild search route (WCL or seed fallback)"
```

---

### Task 8: League Creation Backend

**Files:**
- Modify: `routes/leagues.js`

Update the POST `/api/create` handler to populate `player_pool`, `guilds`, and `raids` on the league when it's created.

**Step 1: Update the create league handler in `routes/leagues.js`**

The handler needs to:
1. Parse the guilds and raids from the form body
2. Build the player pool using the playerpool service
3. Store everything on the league document

Replace the `POST /api/create` handler:

```javascript
const { buildPlayerPool } = require('../services/playerpool');

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
  new_league.game_version = new_league.game_version || 'retail';
  new_league.region = new_league.region || 'us';
  new_league.season_length = parseInt(new_league.season_length) || 8;

  // Parse guilds from form (comma-separated or JSON array)
  var guildNames = [];
  if (new_league.guilds) {
    if (typeof new_league.guilds === 'string') {
      guildNames = new_league.guilds.split(',').map(g => g.trim()).filter(Boolean);
    } else if (Array.isArray(new_league.guilds)) {
      guildNames = new_league.guilds;
    }
  }
  new_league.guilds = guildNames.map(name => ({ name }));

  // Parse raids from form (array of zone IDs)
  if (new_league.raids) {
    if (typeof new_league.raids === 'string') {
      try { new_league.raids = JSON.parse(new_league.raids); } catch (e) { new_league.raids = []; }
    }
  } else {
    // Default: all zones for this game version
    const { getZonesForVersion } = require('../data/zones');
    new_league.raids = getZonesForVersion(new_league.game_version);
  }

  // Build player pool
  buildPlayerPool(new_league)
    .then((pool) => {
      new_league.player_pool = pool;
      return db.leagues().insertOne(new_league);
    })
    .then(() => res.redirect('/leagues'))
    .catch((err) => {
      console.error('League creation failed:', err.message);
      res.redirect('/403');
    });
});
```

Note: The existing `const { buildPlayerPool } = require(...)` import should be added near the top of the file with the other requires.

**Step 2: Run tests**

```bash
npm test
```

Expected: All tests still passing.

**Step 3: Commit**

```bash
git add routes/leagues.js
git commit -m "feat: populate player_pool, guilds, and raids on league creation"
```

---

### Task 9: League Creation UI

**Files:**
- Modify: `views/create_league.pug`

Add guild search/add UI and raid zone checkboxes to the league creation form.

**Step 1: Add guild selection UI to `views/create_league.pug`**

After the Season Length field and before the Activity Report Day field, add:

```pug
h3 Guilds:
div.guild_search
	input(v-model="guildSearch" type='text' placeholder='Search for a guild...' @keyup.enter="searchGuilds")
	button(type='button' @click="searchGuilds") Search
div.guild_results(v-if="guildResults.length > 0")
	div.guild_result(v-for="g in guildResults" @click="addGuild(g.name)")
		span {{g.name}}
		span.guild_faction(v-if="g.faction")  ({{g.faction}})
div.selected_guilds
	div.selected_guild(v-for="(g, i) in selectedGuilds")
		span {{g}}
		button(type='button' @click="removeGuild(i)") x
input(type='hidden' name='guilds' :value="selectedGuilds.join(',')")

h3 Raids:
div.raid_selection
	label(v-for="zone in availableZones")
		input(type='checkbox' :value="zone.id" v-model="selectedRaidIds")
		span  {{zone.name}}
input(type='hidden' name='raids' :value="JSON.stringify(selectedRaids)")
```

**Step 2: Update Vue data and methods**

Add to the Vue `data` object:

```javascript
guildSearch: "",
guildResults: [],
selectedGuilds: [],
selectedRaidIds: [],
```

Add methods:

```javascript
methods: {
  searchGuilds: function() {
    if (!this.guildSearch) return;
    fetch('/leagues/api/guilds/search?q=' + encodeURIComponent(this.guildSearch) + '&server=' + encodeURIComponent(this.server) + '&region=' + this.region + '&game_version=' + this.game_version)
      .then(function(res) { return res.json(); })
      .then(function(guilds) { app.guildResults = guilds; });
  },
  addGuild: function(name) {
    if (this.selectedGuilds.length >= 5) return;
    if (!this.selectedGuilds.includes(name)) {
      this.selectedGuilds.push(name);
    }
    this.guildResults = [];
    this.guildSearch = "";
  },
  removeGuild: function(index) {
    this.selectedGuilds.splice(index, 1);
  },
},
```

Add a `computed` property for available zones and selected raids:

```javascript
computed: {
  availableZones: function() {
    var zones = {
      classic: [
        { id: 1000, name: 'Molten Core' },
        { id: 1001, name: "Onyxia's Lair" },
        { id: 1002, name: 'Blackwing Lair' },
        { id: 1003, name: "Zul'Gurub" },
        { id: 1004, name: "Temple of Ahn'Qiraj" },
        { id: 1005, name: "Ruins of Ahn'Qiraj" },
        { id: 1006, name: 'Naxxramas' },
      ],
      retail: [
        { id: 38, name: "Nerub'ar Palace" },
        { id: 37, name: 'Amirdrassil' },
      ],
    };
    return zones[this.game_version] || zones.retail;
  },
  selectedRaids: function() {
    return this.availableZones.filter(z => this.selectedRaidIds.includes(z.id));
  },
},
```

Add a `watch` to auto-select all raids when game version changes:

```javascript
watch: {
  game_version: function() {
    this.selectedRaidIds = this.availableZones.map(z => z.id);
  },
},
```

And initialize `selectedRaidIds` in the `mounted` hook:

```javascript
mounted: function() {
  this.selectedRaidIds = this.availableZones.map(z => z.id);
},
```

**Step 3: Commit**

```bash
git add views/create_league.pug
git commit -m "feat: add guild search and raid zone selection to league creation form"
```

---

### Task 10: WCL Query Updates (Zone & Timeframe)

**Files:**
- Modify: `services/warcraftlogs.js`
- Modify: `services/reports.js`

Add optional `zoneID` and `timeframe` parameters to WCL character ranking queries, and use them during report generation.

**Step 1: Update `getCharacterRankings` in `services/warcraftlogs.js`**

Change the method signature and GraphQL query:

```javascript
async getCharacterRankings(name, serverSlug, serverRegion, gameVersion = 'retail', options = {}) {
  const { zoneID, timeframe } = options;

  // Build the encounterRankings arguments
  let rankArgs = '';
  const argParts = [];
  if (zoneID) argParts.push(`zoneID: ${zoneID}`);
  if (timeframe) argParts.push(`timeframe: ${timeframe}`);
  if (argParts.length > 0) rankArgs = `(${argParts.join(', ')})`;

  const gql = `
    query ($name: String!, $server: String!, $region: String!) {
      characterData {
        character(name: $name, serverSlug: $server, serverRegion: $region) {
          name
          classID
          encounterRankings${rankArgs}
          zoneRankings
        }
      }
    }
  `;

  const data = await this.query(gql, {
    name,
    server: serverSlug,
    region: serverRegion,
  }, gameVersion);

  return data.characterData.character;
}
```

**Step 2: Update `fetchPlayerSnapshot` in `services/reports.js`**

Add league parameter to pass zone/timeframe context:

```javascript
async function fetchPlayerSnapshot(playerName, serverSlug, serverRegion, gameVersion, options = {}) {
  const wcl = getClient();
  if (!wcl) return null;

  try {
    const character = await wcl.getCharacterRankings(
      playerName, serverSlug, serverRegion, gameVersion, options
    );

    if (!character || !character.encounterRankings) return null;

    // Transform WCL encounterRankings into our snapshot format
    const encounters = {};
    const rankings = character.encounterRankings;

    if (Array.isArray(rankings)) {
      for (const ranking of rankings) {
        const bossName = ranking.encounter ? ranking.encounter.name : `Boss_${ranking.encounterID}`;
        encounters[bossName] = {
          rankPercent: ranking.rankPercent || 0,
          bestAmount: ranking.bestAmount || 0,
          totalKills: ranking.totalKills || 0,
          fastestKill: ranking.fastestKill || 0,
          medianPerformance: ranking.medianPerformance || 0,
        };
      }
    }

    return { encounters };
  } catch (err) {
    console.error(`Failed to fetch WCL data for ${playerName}:`, err.message);
    return null;
  }
}
```

**Step 3: Update `generateReport` in `services/reports.js`**

In the `generateReport` function, where it calls `fetchPlayerSnapshot` (around line 65), pass zone IDs from the league:

```javascript
// Build WCL query options from league settings
const wclOptions = {};
if (league.raids && league.raids.length > 0) {
  // Use the first selected zone ID for scoping
  // WCL encounterRankings takes a single zoneID
  wclOptions.zoneID = league.raids[0].id;
}

// For each player...
const snapshot = await fetchPlayerSnapshot(
  player.name, serverSlug, serverRegion, gameVersion, wclOptions
);
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests still passing (existing tests don't pass zone/timeframe, which defaults to empty).

**Step 5: Commit**

```bash
git add services/warcraftlogs.js services/reports.js
git commit -m "feat: add zone ID and timeframe support to WCL queries and report generation"
```

---

### Task 11: Smoke Test

**Step 1: Run all tests**

```bash
npm test
```

Expected: All passing.

**Step 2: Re-seed and start the app**

```bash
npm run seed
npm run dev
```

**Step 3: Manual test checklist**

- [ ] `http://localhost:3000/leagues/demo` — League page loads, shows Active status
- [ ] `http://localhost:3000/leagues/demo/rankings` — Rankings page shows mock data
- [ ] `http://localhost:3000/proplayers/demo` — Player browse shows players from `player_pool`
- [ ] Player browse pagination works (next/prev)
- [ ] Player browse role tabs work (DPS/healers/tanks)
- [ ] Player browse search by name works
- [ ] Player browse search by guild works
- [ ] `http://localhost:3000/leagues/create` — Create form shows guild search + raid checkboxes
- [ ] Guild search returns results (from seed guilds)
- [ ] Raid checkboxes show correct zones for selected game version
- [ ] Creating a league populates player_pool from selected guilds
- [ ] Draft works with player_pool (player is drafted, disappears from browse)

**Step 4: Fix any issues found**

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: smoke test fixes for guild-scoped drafting"
```

---

### Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Zone data + class map | `data/zones.js`, `data/classes.js` |
| 2 | Player pool service | `services/playerpool.js` |
| 3 | Seed data updates | `scripts/seed.js` |
| 4 | Player browse backend | `routes/players.js` |
| 5 | Draft route updates | `routes/draft.js` |
| 6 | Player browse UI | `views/proplayers.pug` |
| 7 | Guild search route | `routes/leagues.js` |
| 8 | League creation backend | `routes/leagues.js` |
| 9 | League creation UI | `views/create_league.pug` |
| 10 | WCL query updates | `services/warcraftlogs.js`, `services/reports.js` |
| 11 | Smoke test | Everything |
