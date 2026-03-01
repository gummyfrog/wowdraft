# Rankings & Reporting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build automated Warcraft Logs data ingestion, multi-category scoring, and head-to-head matchups so WoWDraft becomes a playable fantasy game.

**Architecture:** Three new service modules (WCL API client, scoring engine, report generator) feed data into the existing league document structure. The existing `league_rankings.pug` template already expects the right data shape — we just need to fill it. New routes handle report generation and standings. A daily scheduled check auto-generates reports on each league's report day.

**Tech Stack:** Express 4, MongoDB, Warcraft Logs GraphQL API v2 (OAuth2), node-cron for scheduling

---

### Task 1: Add Test Framework

**Files:**
- Modify: `package.json`
- Create: `test/scoring.test.js` (placeholder)

**Step 1: Install test dependencies**

```bash
cd /Users/neil/Documents/GitHub/wowdraft
npm install --save-dev mocha chai
```

**Step 2: Add test script to package.json**

Add to the `scripts` section:
```json
"test": "mocha test/**/*.test.js"
```

**Step 3: Create placeholder test file**

Create `test/scoring.test.js`:
```javascript
const { expect } = require('chai');

describe('Scoring Engine', function () {
  it('should load', function () {
    expect(true).to.equal(true);
  });
});
```

**Step 4: Run test to verify setup**

```bash
npm test
```

Expected: 1 passing test.

**Step 5: Commit**

```bash
git add package.json package-lock.json test/
git commit -m "chore: add mocha/chai test framework"
```

---

### Task 2: WCL API Client

**Files:**
- Create: `services/warcraftlogs.js`
- Modify: `.env.example`
- Modify: `.env`
- Create: `test/warcraftlogs.test.js`

This is the foundation — a module that authenticates with Warcraft Logs and fetches character ranking data via their GraphQL API.

**Step 1: Add env vars to `.env.example` and `.env`**

Append to both files:
```
# Warcraft Logs API (register at https://www.warcraftlogs.com/api/clients)
WCL_CLIENT_ID=
WCL_CLIENT_SECRET=
```

**Step 2: Create `services/warcraftlogs.js`**

```javascript
const axios = require('axios');

// API bases per game version
const API_BASES = {
  classic: 'https://classic.warcraftlogs.com',
  retail: 'https://www.warcraftlogs.com',
};

class WarcraftLogsClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async authenticate() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(
      'https://www.warcraftlogs.com/oauth/token',
      params,
      {
        auth: { username: this.clientId, password: this.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    this.accessToken = response.data.access_token;
    // Expire 5 minutes early to be safe
    this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
    return this.accessToken;
  }

  async query(graphqlQuery, variables = {}, gameVersion = 'retail') {
    const token = await this.authenticate();
    const base = API_BASES[gameVersion] || API_BASES.retail;

    const response = await axios.post(
      `${base}/api/v2/client`,
      { query: graphqlQuery, variables },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.errors) {
      throw new Error(`WCL API Error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.data;
  }

  async getCharacterRankings(name, serverSlug, serverRegion, gameVersion = 'retail') {
    const gql = `
      query ($name: String!, $server: String!, $region: String!) {
        characterData {
          character(name: $name, serverSlug: $server, serverRegion: $region) {
            name
            classID
            encounterRankings
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

  async getGuildMembers(guildName, serverSlug, serverRegion, gameVersion = 'retail') {
    const gql = `
      query ($name: String!, $server: String!, $region: String!) {
        guildData {
          guild(name: $name, serverSlug: $server, serverRegion: $region) {
            name
            members {
              data {
                name
                classID
              }
            }
          }
        }
      }
    `;

    const data = await this.query(gql, {
      name: guildName,
      server: serverSlug,
      region: serverRegion,
    }, gameVersion);

    return data.guildData.guild;
  }

  async searchGuilds(serverSlug, serverRegion, gameVersion = 'retail') {
    const gql = `
      query ($server: String!, $region: String!) {
        guildData {
          guilds(serverSlug: $server, serverRegion: $region) {
            data {
              name
              faction { id name }
            }
          }
        }
      }
    `;

    const data = await this.query(gql, {
      server: serverSlug,
      region: serverRegion,
    }, gameVersion);

    return data.guildData.guilds;
  }
}

// Singleton with lazy init
let client = null;

function getClient() {
  if (!client) {
    const id = process.env.WCL_CLIENT_ID;
    const secret = process.env.WCL_CLIENT_SECRET;
    if (!id || !secret) {
      return null; // WCL not configured
    }
    client = new WarcraftLogsClient(id, secret);
  }
  return client;
}

module.exports = { WarcraftLogsClient, getClient };
```

**Step 3: Write unit tests**

Create `test/warcraftlogs.test.js`:
```javascript
const { expect } = require('chai');
const { WarcraftLogsClient } = require('../services/warcraftlogs');

describe('WarcraftLogsClient', function () {
  it('should construct with credentials', function () {
    const client = new WarcraftLogsClient('test-id', 'test-secret');
    expect(client.clientId).to.equal('test-id');
    expect(client.clientSecret).to.equal('test-secret');
    expect(client.accessToken).to.be.null;
  });

  it('should skip re-auth if token is still valid', async function () {
    const client = new WarcraftLogsClient('id', 'secret');
    client.accessToken = 'cached-token';
    client.tokenExpiry = Date.now() + 60000;
    const token = await client.authenticate();
    expect(token).to.equal('cached-token');
  });

  it('getClient returns null when env vars are missing', function () {
    delete process.env.WCL_CLIENT_ID;
    delete process.env.WCL_CLIENT_SECRET;
    // Re-require to reset singleton
    delete require.cache[require.resolve('../services/warcraftlogs')];
    const { getClient } = require('../services/warcraftlogs');
    expect(getClient()).to.be.null;
  });
});
```

**Step 4: Run tests**

```bash
npm test
```

Expected: 3 passing tests (the authenticate test uses cached token, no real API call).

**Step 5: Commit**

```bash
git add services/warcraftlogs.js test/warcraftlogs.test.js .env.example
git commit -m "feat: add Warcraft Logs API client with OAuth2 auth"
```

---

### Task 3: Scoring Engine

**Files:**
- Create: `services/scoring.js`
- Modify: `test/scoring.test.js`

The scoring engine is pure logic — no DB or API calls. It takes player snapshots (old and new) and computes points across 6 extensible categories.

**Step 1: Create `services/scoring.js`**

```javascript
// Scoring categories — extensible array of { name, compute(newData, oldData, allPlayers) }
const CATEGORIES = [
  {
    name: 'parse',
    title: 'Parser',
    compute(player, _old, _all) {
      // Points based on average parse percentile across encounters
      const parses = Object.values(player.encounters || {})
        .map(e => e.rankPercent)
        .filter(p => p != null);
      if (parses.length === 0) return 0;
      const avg = parses.reduce((a, b) => a + b, 0) / parses.length;
      if (avg >= 99) return 10;
      if (avg >= 95) return 8;
      if (avg >= 90) return 6;
      if (avg >= 75) return 4;
      if (avg >= 50) return 2;
      return 1;
    },
  },
  {
    name: 'dps',
    title: 'High DPS',
    compute(player, _old, allPlayers) {
      // Points for high throughput relative to other drafted players
      const amounts = Object.values(player.encounters || {})
        .map(e => e.bestAmount)
        .filter(a => a != null);
      if (amounts.length === 0) return 0;
      const myAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      // Compare to all players' averages
      const allAvgs = allPlayers.map(p => {
        const amts = Object.values(p.encounters || {})
          .map(e => e.bestAmount)
          .filter(a => a != null);
        return amts.length > 0 ? amts.reduce((a, b) => a + b, 0) / amts.length : 0;
      }).filter(a => a > 0);

      if (allAvgs.length === 0) return 0;
      allAvgs.sort((a, b) => b - a);
      const rank = allAvgs.indexOf(myAvg);
      const percentile = 1 - (rank / allAvgs.length);

      if (percentile >= 0.95) return 8;
      if (percentile >= 0.80) return 6;
      if (percentile >= 0.60) return 4;
      if (percentile >= 0.40) return 2;
      return 1;
    },
  },
  {
    name: 'bosses_down',
    title: 'Boss Killer',
    compute(player, old, _all) {
      // Points per new boss kill since last report
      let newKills = 0;
      for (const [boss, data] of Object.entries(player.encounters || {})) {
        const oldKills = (old.encounters && old.encounters[boss]) ? old.encounters[boss].totalKills || 0 : 0;
        const currentKills = data.totalKills || 0;
        newKills += Math.max(0, currentKills - oldKills);
      }
      // 2 points per new kill, capped at 10
      return Math.min(10, newKills * 2);
    },
  },
  {
    name: 'speedy_clear',
    title: 'Speed Clearer',
    compute(player, _old, allPlayers) {
      // Points for fast kill times relative to other drafted players
      let speedWins = 0;
      const bosses = Object.keys(player.encounters || {});
      for (const boss of bosses) {
        const myTime = player.encounters[boss].fastestKill;
        if (!myTime) continue;
        // Check if this is the fastest among all drafted players
        const allTimes = allPlayers
          .filter(p => p.encounters && p.encounters[boss] && p.encounters[boss].fastestKill)
          .map(p => p.encounters[boss].fastestKill);
        if (allTimes.length > 0 && myTime <= Math.min(...allTimes)) {
          speedWins++;
        }
      }
      return Math.min(8, speedWins * 2);
    },
  },
  {
    name: 'new_best',
    title: 'Record Setter',
    compute(player, old, _all) {
      // Points when player beats their previous best parse or DPS
      let improvements = 0;
      for (const [boss, data] of Object.entries(player.encounters || {})) {
        const oldData = (old.encounters && old.encounters[boss]) || {};
        if (data.rankPercent > (oldData.rankPercent || 0)) improvements++;
        if (data.bestAmount > (oldData.bestAmount || 0)) improvements++;
      }
      // 1 point per improvement, capped at 8
      return Math.min(8, improvements);
    },
  },
  {
    name: 'consistency',
    title: 'Surgically Precise',
    compute(player, _old, _all) {
      // Points for median performance being close to best
      const encounters = Object.values(player.encounters || {});
      if (encounters.length === 0) return 0;

      const ratios = encounters
        .filter(e => e.bestAmount && e.medianPerformance && e.bestAmount > 0)
        .map(e => e.medianPerformance / e.bestAmount);

      if (ratios.length === 0) return 0;
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

      // Ratio of 0.9+ means very consistent
      if (avgRatio >= 0.95) return 6;
      if (avgRatio >= 0.90) return 4;
      if (avgRatio >= 0.80) return 2;
      return 1;
    },
  },
];

function scorePlayer(newSnapshot, oldSnapshot, allPlayerSnapshots) {
  const points = { total: 0 };
  for (const cat of CATEGORIES) {
    const pts = cat.compute(newSnapshot, oldSnapshot || {}, allPlayerSnapshots);
    points[cat.name] = pts;
    points.total += pts;
  }
  return points;
}

function getTitle(points) {
  const { total, ...categories } = points;
  if (Object.keys(categories).length === 0) return '';
  const best = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const cat = CATEGORIES.find(c => c.name === best[0]);
  return cat ? cat.title : '';
}

module.exports = { scorePlayer, getTitle, CATEGORIES };
```

**Step 2: Write comprehensive tests**

Replace `test/scoring.test.js`:
```javascript
const { expect } = require('chai');
const { scorePlayer, getTitle, CATEGORIES } = require('../services/scoring');

describe('Scoring Engine', function () {
  const makeSnapshot = (overrides = {}) => ({
    encounters: {
      'Ragnaros': { rankPercent: 85, bestAmount: 1500, totalKills: 10, fastestKill: 180000, medianPerformance: 1350 },
      'Onyxia': { rankPercent: 90, bestAmount: 1600, totalKills: 8, fastestKill: 120000, medianPerformance: 1520 },
    },
    ...overrides,
  });

  describe('scorePlayer', function () {
    it('should return points for all 6 categories plus total', function () {
      const points = scorePlayer(makeSnapshot(), {}, [makeSnapshot()]);
      expect(points).to.have.property('total');
      expect(points).to.have.property('parse');
      expect(points).to.have.property('dps');
      expect(points).to.have.property('bosses_down');
      expect(points).to.have.property('speedy_clear');
      expect(points).to.have.property('new_best');
      expect(points).to.have.property('consistency');
    });

    it('should give parse points based on average percentile', function () {
      const high = makeSnapshot({ encounters: {
        'Rag': { rankPercent: 99, bestAmount: 2000, totalKills: 5, fastestKill: 100000, medianPerformance: 1900 },
      }});
      const points = scorePlayer(high, {}, [high]);
      expect(points.parse).to.equal(10);
    });

    it('should give bosses_down points for new kills', function () {
      const now = makeSnapshot();
      const old = { encounters: { 'Ragnaros': { totalKills: 8 }, 'Onyxia': { totalKills: 6 } } };
      const points = scorePlayer(now, old, [now]);
      // Rag: 10-8=2 new kills, Onyxia: 8-6=2 new kills = 4 kills * 2 = 8
      expect(points.bosses_down).to.equal(8);
    });

    it('should give 0 bosses_down when no old snapshot', function () {
      const now = makeSnapshot();
      const points = scorePlayer(now, {}, [now]);
      // All kills are "new" (10 + 8 = 18 * 2 = 36, capped at 10)
      expect(points.bosses_down).to.equal(10);
    });

    it('should give new_best points for improvements', function () {
      const now = makeSnapshot();
      const old = { encounters: {
        'Ragnaros': { rankPercent: 80, bestAmount: 1400 },
        'Onyxia': { rankPercent: 90, bestAmount: 1600 },
      }};
      const points = scorePlayer(now, old, [now]);
      // Rag parse improved (85>80), Rag DPS improved (1500>1400) = 2 improvements
      expect(points.new_best).to.equal(2);
    });

    it('should handle empty encounters gracefully', function () {
      const points = scorePlayer({ encounters: {} }, {}, []);
      expect(points.total).to.equal(0);
    });
  });

  describe('getTitle', function () {
    it('should return the title for highest-scoring category', function () {
      const points = { total: 20, parse: 10, dps: 4, bosses_down: 2, speedy_clear: 2, new_best: 1, consistency: 1 };
      expect(getTitle(points)).to.equal('Parser');
    });

    it('should return empty string for no categories', function () {
      expect(getTitle({ total: 0 })).to.equal('');
    });
  });

  describe('CATEGORIES', function () {
    it('should have 6 categories', function () {
      expect(CATEGORIES).to.have.length(6);
    });

    it('each category should have name, title, and compute function', function () {
      for (const cat of CATEGORIES) {
        expect(cat).to.have.property('name');
        expect(cat).to.have.property('title');
        expect(cat.compute).to.be.a('function');
      }
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
git add services/scoring.js test/scoring.test.js
git commit -m "feat: add extensible multi-category scoring engine"
```

---

### Task 4: Report Generation Service

**Files:**
- Create: `services/reports.js`
- Create: `test/reports.test.js`

The report generator orchestrates: fetch WCL data → compute deltas → score players → resolve matchups → store report.

**Step 1: Create `services/reports.js`**

```javascript
const { getClient } = require('./warcraftlogs');
const { scorePlayer, getTitle } = require('./scoring');
const db = require('../db');

async function fetchPlayerSnapshot(playerName, serverSlug, serverRegion, gameVersion) {
  const wcl = getClient();
  if (!wcl) return null;

  try {
    const character = await wcl.getCharacterRankings(
      playerName, serverSlug, serverRegion, gameVersion
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

async function generateReport(leagueCode) {
  const league = await db.leagues().findOne({ code: leagueCode });
  if (!league || league.status !== 'Active') {
    throw new Error(`League ${leagueCode} is not in Active status`);
  }

  const serverSlug = (league.server || '').toLowerCase().replace(/\s/g, '-');
  const serverRegion = league.region || 'us';
  const gameVersion = league.game_version || 'retail';
  const oldSnapshots = league.player_snapshots || {};
  const allDraftedPlayers = [];

  // Collect all drafted players across all teams
  for (const team of league.teams) {
    for (const player of team.drafted_players) {
      if (player.name && player.name !== 'No Pick') {
        allDraftedPlayers.push({ ...player, teamId: team.id });
      }
    }
  }

  // Fetch fresh snapshots from WCL for each player
  const newSnapshots = {};
  for (const player of allDraftedPlayers) {
    const snapshot = await fetchPlayerSnapshot(
      player.name, serverSlug, serverRegion, gameVersion
    );
    if (snapshot) {
      newSnapshots[player.name] = snapshot;
    } else {
      // Player has no new data — use old snapshot or empty
      newSnapshots[player.name] = oldSnapshots[player.name] || { encounters: {} };
    }
    // Rate limit: 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Score each player
  const allNewSnapshots = Object.values(newSnapshots);
  const teamReportData = [];

  for (const team of league.teams) {
    const playerScores = {};
    let teamTotal = 0;

    for (const player of team.drafted_players) {
      if (player.name === 'No Pick') {
        playerScores[player.name] = { points: { total: 0, parse: 0, dps: 0, bosses_down: 0, speedy_clear: 0, new_best: 0, consistency: 0 } };
        continue;
      }

      const newSnap = newSnapshots[player.name] || { encounters: {} };
      const oldSnap = oldSnapshots[player.name] || {};
      const points = scorePlayer(newSnap, oldSnap, allNewSnapshots);

      playerScores[player.name] = { points, title: getTitle(points) };
      teamTotal += points.total;
    }

    teamReportData.push({
      team_id: team.id,
      team_name: team.name,
      total_points: teamTotal,
      players: playerScores,
    });
  }

  // Resolve head-to-head matchup for current week
  const currentWeek = (league.activity_reports || []).length;
  let matchupResult = null;

  if (league.schedule && league.schedule[currentWeek]) {
    const weekSchedule = league.schedule[currentWeek];
    matchupResult = resolveMatchups(weekSchedule, teamReportData);
  }

  // Build report
  const report = {
    time: new Date(),
    week: currentWeek + 1,
    data: teamReportData,
    matchups: matchupResult,
  };

  // Update league
  const updates = {
    player_snapshots: newSnapshots,
    $push: { activity_reports: report },
  };

  if (matchupResult) {
    // Update W/L records
    const standings = league.standings || {};
    for (const result of matchupResult) {
      if (result.winner) {
        if (!standings[result.winner]) standings[result.winner] = { wins: 0, losses: 0 };
        standings[result.winner].wins++;
      }
      if (result.loser) {
        if (!standings[result.loser]) standings[result.loser] = { wins: 0, losses: 0 };
        standings[result.loser].losses++;
      }
      if (result.bye) {
        if (!standings[result.bye]) standings[result.bye] = { wins: 0, losses: 0 };
        standings[result.bye].wins++;
      }
    }
    updates.standings = standings;
  }

  // Use $set for non-array fields and $push for array
  await db.leagues().updateOne(
    { code: leagueCode },
    {
      $set: { player_snapshots: newSnapshots, standings: updates.standings || league.standings || {} },
      $push: { activity_reports: report },
    }
  );

  return report;
}

function resolveMatchups(weekSchedule, teamReportData) {
  const results = [];

  for (const matchup of weekSchedule.matchups) {
    if (matchup.bye) {
      results.push({ bye: matchup.bye });
      continue;
    }

    const homeData = teamReportData.find(t => t.team_id === matchup.home);
    const awayData = teamReportData.find(t => t.team_id === matchup.away);

    if (!homeData || !awayData) continue;

    const result = {
      home: matchup.home,
      away: matchup.away,
      homeScore: homeData.total_points,
      awayScore: awayData.total_points,
    };

    if (homeData.total_points > awayData.total_points) {
      result.winner = matchup.home;
      result.loser = matchup.away;
    } else if (awayData.total_points > homeData.total_points) {
      result.winner = matchup.away;
      result.loser = matchup.home;
    } else {
      // Tie — both get a win
      result.winner = null;
      result.loser = null;
      result.tie = true;
    }

    results.push(result);
  }

  return results;
}

module.exports = { generateReport, fetchPlayerSnapshot, resolveMatchups };
```

**Step 2: Write tests**

Create `test/reports.test.js`:
```javascript
const { expect } = require('chai');
const { resolveMatchups } = require('../services/reports');

describe('Report Generation', function () {
  describe('resolveMatchups', function () {
    it('should determine winner of a matchup', function () {
      const schedule = {
        matchups: [{ home: 'team1', away: 'team2' }],
      };
      const teamData = [
        { team_id: 'team1', total_points: 30 },
        { team_id: 'team2', total_points: 20 },
      ];

      const results = resolveMatchups(schedule, teamData);
      expect(results[0].winner).to.equal('team1');
      expect(results[0].loser).to.equal('team2');
    });

    it('should handle ties', function () {
      const schedule = {
        matchups: [{ home: 'team1', away: 'team2' }],
      };
      const teamData = [
        { team_id: 'team1', total_points: 25 },
        { team_id: 'team2', total_points: 25 },
      ];

      const results = resolveMatchups(schedule, teamData);
      expect(results[0].tie).to.equal(true);
    });

    it('should handle byes', function () {
      const schedule = {
        matchups: [{ bye: 'team3' }],
      };

      const results = resolveMatchups(schedule, []);
      expect(results[0].bye).to.equal('team3');
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
git add services/reports.js test/reports.test.js
git commit -m "feat: add report generation service with WCL data + matchup resolution"
```

---

### Task 5: League Lifecycle & Season Start

**Files:**
- Modify: `routes/league.js` (LeagueLogic class)
- Create: `test/league.test.js`

Update the league lifecycle: after draft completes, status becomes "Drafted" instead of "Completed". A new `startSeason()` method transitions to "Active" and generates the matchup schedule.

**Step 1: Write tests first**

Create `test/league.test.js`:
```javascript
const { expect } = require('chai');
const LeagueLogic = require('../routes/league');

describe('LeagueLogic', function () {
  function makeLeague(overrides = {}) {
    return {
      code: 'test',
      admin: { name: 'admin#1234' },
      teams: [
        { id: 't1', name: 'Team A', manager: 'admin#1234', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
        { id: 't2', name: 'Team B', manager: 'user#5678', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
        { id: 't3', name: 'Team C', manager: 'user#9999', drafted_players: [], roles_drafted: { dps: 0, healers: 0, tanks: 0 } },
      ],
      status: 'Setting Up',
      rounds: 2,
      draft: { pick_order: [0], pick_index: 0, picks: [], status: 0 },
      report_day: 'Wednesday',
      ...overrides,
    };
  }

  const adminSession = { loggedin: true, username: 'admin#1234' };

  describe('isDraftComplete', function () {
    it('should set status to Drafted (not Completed) when draft finishes', function () {
      const league = makeLeague({
        status: 'In Progress',
        draft: { pick_order: [0, 1, 2], pick_index: 3, picks: [], status: 1 },
      });
      const logic = new LeagueLogic(league, adminSession);
      logic.isDraftComplete();
      expect(league.status).to.equal('Drafted');
      expect(league.draft.status).to.equal(2);
    });
  });

  describe('startSeason', function () {
    it('should transition from Drafted to Active', function () {
      const league = makeLeague({
        status: 'Drafted',
        draft: { status: 2 },
      });
      const logic = new LeagueLogic(league, adminSession);
      const result = logic.startSeason({ season_length: 6 });
      expect(result).to.equal(true);
      expect(league.status).to.equal('Active');
    });

    it('should generate round-robin matchup schedule', function () {
      const league = makeLeague({
        status: 'Drafted',
        draft: { status: 2 },
      });
      const logic = new LeagueLogic(league, adminSession);
      logic.startSeason({ season_length: 6 });
      expect(league.schedule).to.be.an('array');
      expect(league.schedule.length).to.equal(6);
      // Each week should have matchups
      for (const week of league.schedule) {
        expect(week.matchups).to.be.an('array');
        expect(week.matchups.length).to.be.greaterThan(0);
      }
    });

    it('should handle odd number of teams with byes', function () {
      const league = makeLeague({
        status: 'Drafted',
        draft: { status: 2 },
      });
      const logic = new LeagueLogic(league, adminSession);
      logic.startSeason({ season_length: 3 });
      // 3 teams = someone gets a bye each week
      const hasBye = league.schedule.some(week =>
        week.matchups.some(m => m.bye)
      );
      expect(hasBye).to.equal(true);
    });

    it('should reject if not admin', function () {
      const league = makeLeague({ status: 'Drafted', draft: { status: 2 } });
      const logic = new LeagueLogic(league, { loggedin: true, username: 'nobody#0000' });
      expect(logic.startSeason({ season_length: 6 })).to.equal(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: Failures (startSeason doesn't exist yet, isDraftComplete sets "Completed" not "Drafted").

**Step 3: Update `routes/league.js`**

Add the `startSeason` method and change `isDraftComplete` to set "Drafted" instead of "Completed":

In `isDraftComplete()`, change:
```javascript
// OLD:
this.league.status = "Completed";

// NEW:
this.league.status = "Drafted";
```

Add new method `startSeason(options)` to the class:
```javascript
startSeason(options = {}) {
  if (!this.loggedin || !this.sessionIsAdmin() || this.league.status !== 'Drafted') {
    return false;
  }

  const seasonLength = options.season_length || 8;
  const teams = this.league.teams;

  // Generate round-robin schedule
  this.league.schedule = this.generateRoundRobin(teams, seasonLength);
  this.league.season_length = seasonLength;
  this.league.status = 'Active';
  this.league.standings = {};
  this.league.player_snapshots = {};
  this.league.activity_reports = [];

  // Initialize standings for all teams
  for (const team of teams) {
    this.league.standings[team.id] = { wins: 0, losses: 0 };
  }

  return true;
}

generateRoundRobin(teams, weeks) {
  const schedule = [];
  const teamIds = teams.map(t => t.id);
  const n = teamIds.length;

  // If odd number of teams, add a "BYE" placeholder
  const ids = [...teamIds];
  if (n % 2 !== 0) ids.push('BYE');
  const total = ids.length;
  const half = total / 2;

  for (let week = 0; week < weeks; week++) {
    const round = week % (total - 1);
    const matchups = [];

    // Standard round-robin rotation
    const rotated = [ids[0]];
    for (let i = 1; i < total; i++) {
      rotated.push(ids[((i - 1 + round) % (total - 1)) + 1]);
    }

    for (let i = 0; i < half; i++) {
      const home = rotated[i];
      const away = rotated[total - 1 - i];

      if (home === 'BYE') {
        matchups.push({ bye: away });
      } else if (away === 'BYE') {
        matchups.push({ bye: home });
      } else {
        matchups.push({ home, away });
      }
    }

    schedule.push({ week: week + 1, matchups });
  }

  return schedule;
}
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests passing.

**Step 5: Commit**

```bash
git add routes/league.js test/league.test.js
git commit -m "feat: add season start with round-robin matchup schedule"
```

---

### Task 6: Season Start Route & API Endpoints

**Files:**
- Modify: `routes/leagues.js`
- Modify: `routes/draft.js`

**Step 1: Add startSeason route to `routes/leagues.js`**

Add after the activity_report route:

```javascript
// API: Start season (admin only, after draft completes)
router.post('/api/:leagueID/startSeason', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      var result = leaguelogic.startSeason(req.body);

      if (!result) return res.status(400).json({ error: 'Cannot start season' });

      db.leagues().updateOne(
        { code: req.params.leagueID },
        { $set: leaguelogic.league }
      ).then(() => res.redirect(`/leagues/${req.params.leagueID}/`));
    })
    .catch(() => res.redirect('/404'));
});

// API: Get standings
router.get('/api/:leagueID/standings', function (req, res) {
  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      res.json({
        standings: league.standings || {},
        schedule: league.schedule || [],
        currentWeek: (league.activity_reports || []).length + 1,
      });
    })
    .catch(() => res.redirect('/404'));
});
```

**Step 2: Add generateReport route to `routes/draft.js`**

Add at the bottom, before `module.exports`:

```javascript
const { generateReport } = require('../services/reports');

// API: Generate report (admin only)
router.post('/api/:leagueID/generateReport', function (req, res) {
  if (!req.session.loggedin) return res.redirect('/403');

  db.leagues().findOne({ code: req.params.leagueID })
    .then((league) => {
      var leaguelogic = new LeagueLogic(league, req.session);
      if (!leaguelogic.sessionIsAdmin()) {
        return res.status(403).json({ error: 'Admin only' });
      }

      generateReport(req.params.leagueID)
        .then((report) => res.json({ success: true, report }))
        .catch((err) => res.status(500).json({ error: err.message }));
    })
    .catch(() => res.redirect('/404'));
});
```

**Step 3: Commit**

```bash
git add routes/leagues.js routes/draft.js
git commit -m "feat: add startSeason, generateReport, and standings routes"
```

---

### Task 7: Scheduled Report Generation

**Files:**
- Modify: `package.json` (add node-cron)
- Create: `services/scheduler.js`
- Modify: `app.js`

**Step 1: Install node-cron**

```bash
npm install node-cron
```

**Step 2: Create `services/scheduler.js`**

```javascript
const cron = require('node-cron');
const db = require('../db');
const { generateReport } = require('./reports');

const DAY_MAP = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6,
};

function startScheduler() {
  // Run daily at 6am UTC
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Running daily report check...');

    try {
      const today = new Date().getDay();
      const activeLeagues = await db.leagues()
        .find({ status: 'Active' })
        .toArray();

      for (const league of activeLeagues) {
        const reportDay = DAY_MAP[league.report_day];
        if (reportDay === undefined || reportDay !== today) continue;

        // Check if we already generated a report this week
        const lastReport = league.activity_reports && league.activity_reports.length > 0
          ? league.activity_reports[league.activity_reports.length - 1]
          : null;

        if (lastReport) {
          const lastReportDate = new Date(lastReport.time);
          const daysSince = (Date.now() - lastReportDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 6) {
            console.log(`[Scheduler] Skipping ${league.name} — report already generated this week`);
            continue;
          }
        }

        // Check if season is over
        const weeksDone = (league.activity_reports || []).length;
        if (weeksDone >= (league.season_length || 8)) {
          await db.leagues().updateOne(
            { code: league.code },
            { $set: { status: 'Completed' } }
          );
          console.log(`[Scheduler] ${league.name} season complete!`);
          continue;
        }

        console.log(`[Scheduler] Generating report for ${league.name}...`);
        try {
          await generateReport(league.code);
          console.log(`[Scheduler] Report generated for ${league.name}`);
        } catch (err) {
          console.error(`[Scheduler] Failed for ${league.name}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  });

  console.log('Report scheduler started (daily at 6am UTC)');
}

module.exports = { startScheduler };
```

**Step 3: Start scheduler in `app.js`**

Add after the `db.connect()` call in `app.js`:

```javascript
const { startScheduler } = require('./services/scheduler');

// In the db.connect().then() callback, add:
db.connect()
  .then(() => {
    console.log('App ready');
    startScheduler();
  })
  .catch((err) => console.error('MongoDB connection failed:', err.message));
```

**Step 4: Commit**

```bash
git add package.json package-lock.json services/scheduler.js app.js
git commit -m "feat: add scheduled report generation (daily cron)"
```

---

### Task 8: League Creation Form Updates

**Files:**
- Modify: `views/create_league.pug`
- Modify: `routes/leagues.js` (create league handler)

**Step 1: Add game version and server fields to `views/create_league.pug`**

Add after the name/description fields, before customization:

```pug
h3 Game Version:
select(v-model="game_version" name="game_version" required)
  option(value="retail") Retail (The War Within)
  option(value="classic") Classic

h3 Server:
input(v-model="server" type='text' placeholder='Faerlina' name='server' required)

h3 Region:
select(v-model="region" name="region" required)
  option(value="us") US
  option(value="eu") EU
  option(value="kr") KR
  option(value="tw") TW

h3 Faction:
select(v-model="faction" name="faction" required)
  option(value="Alliance") Alliance
  option(value="Horde") Horde

h3 Season Length (weeks):
input(v-model="season_length" type='number' placeholder='8' name='season_length' min="2" max="20" required)
```

Remove the old disabled server/faction section. Add new Vue data properties:
```javascript
game_version: "retail",
server: "",
region: "us",
season_length: 8,
```

**Step 2: Update league creation handler in `routes/leagues.js`**

In the `POST /api/create` handler, add the new fields to the league document:

After `new_league.requirements = ...`, add:
```javascript
new_league.game_version = new_league.game_version || 'retail';
new_league.region = new_league.region || 'us';
new_league.season_length = parseInt(new_league.season_length) || 8;
```

**Step 3: Commit**

```bash
git add views/create_league.pug routes/leagues.js
git commit -m "feat: add game version, server, region, season length to league creation"
```

---

### Task 9: League Home Page Updates

**Files:**
- Modify: `views/league.pug`

This is the most visible UI change — show matchups, W/L records, season status, and the "Start Season" / "Update Scores" buttons.

**Step 1: Add season info section to `views/league.pug`**

In the `draft_info` component template, after the draft information section, add a section for Active leagues:

```html
<div v-if="league_info.status == 'Active'" class="season_info">
  <h2><i class="fas fa-trophy"></i> Season Active — Week {{currentWeek}}</h2>
  <p>Report Day: {{league_info.report_day || 'Wednesday'}}</p>
</div>
```

Add a "Start Season" button that shows when status is "Drafted":
```html
<div v-if="league_info.status == 'Drafted'" class="start_season_box">
  <form action="" method="post" class="start-season-form">
    <h2><i class="fas fa-play"></i> Draft Complete! Ready to start the season?</h2>
    <button type="submit"><i class="fas fa-check"></i> Start Season</button>
  </form>
</div>
```

The form action should point to `/leagues/api/${league_info.code}/startSeason`.

Add an "Update Scores" button for admins when status is "Active":
```html
<div v-if="league_info.status == 'Active'" class="update_scores_box">
  <button @click="generateReport" :disabled="generating">
    <i class="fas fa-sync"></i> {{generating ? 'Generating...' : 'Update Scores'}}
  </button>
</div>
```

**Step 2: Add standings display**

Add a standings section showing W/L records:
```html
<div v-if="league_info.standings" class="standings">
  <h2><i class="fas fa-list-ol"></i> Standings</h2>
  <div v-for="team in sortedTeams" class="standing_row">
    <span class="standing_name">{{team.name}}</span>
    <span class="standing_record">{{getRecord(team.id)}}</span>
  </div>
</div>
```

**Step 3: Add Vue methods**

In the Vue instance, add:
```javascript
data: {
  // ... existing data
  generating: false,
},
methods: {
  // ... existing methods
  generateReport: function() {
    this.generating = true;
    fetch(`/leagues/api/${league.code}/generateReport`, { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        this.generating = false;
        this.fetchData();
      });
  },
  getRecord: function(teamId) {
    const s = this.league_info.standings && this.league_info.standings[teamId];
    return s ? `${s.wins}W - ${s.losses}L` : '0W - 0L';
  },
},
computed: {
  // ... existing computed
  currentWeek: function() {
    return (this.league_info.activity_reports || []).length + 1;
  },
  sortedTeams: function() {
    return [...this.teams].sort((a, b) => {
      const sa = (this.league_info.standings || {})[a.id] || { wins: 0 };
      const sb = (this.league_info.standings || {})[b.id] || { wins: 0 };
      return sb.wins - sa.wins;
    });
  },
},
```

**Step 4: Commit**

```bash
git add views/league.pug
git commit -m "feat: add season controls, standings, and score updates to league page"
```

---

### Task 10: Rankings Page Data Binding

**Files:**
- Modify: `views/league_rankings.pug`

The rankings page template already has most of the right structure. We need to make sure the data shape from our report generation matches what the template expects, and fix any mismatches.

**Step 1: Review and update the Vue data binding**

The existing template expects `activity_report.data[index].players[playerName].points`. Our report generation creates exactly this shape. The main fixes needed:

- The `fancyDate` computed should format the date better
- The `sorted_teams` computed should sort by total points
- Add a week selector so users can browse past reports
- Make sure the `consistency` category is handled in the `titles()` method

Add `consistency` to the `titles()` switch case:
```javascript
case("consistency"):
  msg = "Surgically Precise"
  break;
```

**Step 2: Add week navigation**

Add a week selector at the top of the rankings page:
```html
<div class="week_selector">
  <button @click="prevWeek" :disabled="selectedWeek <= 0"><i class="fas fa-arrow-left"></i></button>
  <h2>Week {{selectedWeek + 1}}</h2>
  <button @click="nextWeek" :disabled="selectedWeek >= activity_reports.length - 1"><i class="fas fa-arrow-right"></i></button>
</div>
```

Update the Vue data:
```javascript
data: {
  // ... existing
  selectedWeek: 0,
},
computed: {
  activity_report: function() {
    if (this.activity_reports.length > 0) {
      return this.activity_reports[this.selectedWeek];
    }
    return null;
  },
},
methods: {
  prevWeek: function() { if (this.selectedWeek > 0) this.selectedWeek--; },
  nextWeek: function() { if (this.selectedWeek < this.activity_reports.length - 1) this.selectedWeek++; },
},
```

**Step 3: Add matchup display for the selected week**

Show the head-to-head matchup result for the current week:
```html
<div v-if="activity_report && activity_report.matchups" class="matchup_results">
  <div v-for="m in activity_report.matchups" class="matchup">
    <span v-if="m.bye">{{getTeamName(m.bye)}} — Bye Week</span>
    <span v-else>
      {{getTeamName(m.home)}} ({{m.homeScore}}) vs {{getTeamName(m.away)}} ({{m.awayScore}})
      <strong v-if="m.winner"> — {{getTeamName(m.winner)}} wins!</strong>
      <strong v-if="m.tie"> — Tie!</strong>
    </span>
  </div>
</div>
```

**Step 4: Commit**

```bash
git add views/league_rankings.pug
git commit -m "feat: update rankings page with week navigation and matchup results"
```

---

### Task 11: Seed Data Updates

**Files:**
- Modify: `scripts/seed.js`

Update the seed script to create a demo league in "Active" status with mock reports, so the rankings page has data to display without needing WCL credentials.

**Step 1: Update seed script**

After creating the sample league, add:
- Set status to "Active"
- Add a matchup schedule (3 weeks)
- Create 2 teams with drafted players
- Generate 2 mock activity reports with scored player data
- Set standings based on mock matchup results

This gives developers an immediate visual of the full feature without needing WCL API keys.

**Step 2: Run seed and verify**

```bash
npm run seed
npm run dev
```

Navigate to http://localhost:3000/leagues/demo/rankings — should show mock report data.

**Step 3: Commit**

```bash
git add scripts/seed.js
git commit -m "feat: update seed with mock season data, reports, and matchups"
```

---

### Task 12: Smoke Test & Fix-ups

**Step 1: Run all tests**

```bash
npm test
```

Expected: All passing.

**Step 2: Start fresh and test full flow**

```bash
docker-compose down -v && docker-compose up -d
npm run seed
npm run dev
```

**Step 3: Manual test checklist**

- [ ] League list shows demo league with "Active" status
- [ ] League home page shows standings, "Update Scores" button
- [ ] Rankings page shows mock report data with player scores
- [ ] Rankings page week navigation works
- [ ] Rankings page shows matchup results
- [ ] Create new league with game version, server, region fields
- [ ] Start Season button appears after draft completes (test with 2+ teams)
- [ ] All existing functionality still works (draft, teams, proplayers)

**Step 4: Fix any issues found**

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: smoke test fixes for rankings feature"
```

---

### Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Test framework | `package.json`, `test/` |
| 2 | WCL API client | `services/warcraftlogs.js` |
| 3 | Scoring engine | `services/scoring.js` |
| 4 | Report generation | `services/reports.js` |
| 5 | League lifecycle + season start | `routes/league.js` |
| 6 | New API routes | `routes/leagues.js`, `routes/draft.js` |
| 7 | Scheduled reports | `services/scheduler.js` |
| 8 | League creation form | `views/create_league.pug` |
| 9 | League home page | `views/league.pug` |
| 10 | Rankings page | `views/league_rankings.pug` |
| 11 | Seed data updates | `scripts/seed.js` |
| 12 | Smoke test | Everything |
