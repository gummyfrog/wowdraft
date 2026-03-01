# WoWDraft: Rankings, Reporting & Head-to-Head Design

**Date:** 2026-03-02
**Goal:** Build automated data ingestion from Warcraft Logs, multi-category scoring, and head-to-head matchups to make WoWDraft a real, playable fantasy game.

## Core Loop

Draft players from real WoW guilds → weekly reports pull raid performance from Warcraft Logs → score across 6 categories → head-to-head matchups determine W/L → season standings.

## 1. WCL API Integration

**Module:** `services/warcraftlogs.js`

- OAuth2 client credentials flow against `https://www.warcraftlogs.com/oauth/token`
- GraphQL queries to `https://www.warcraftlogs.com/api/v2/client` (Retail) or `https://classic.warcraftlogs.com/api/v2/client` (Classic)
- Key query: `characterData.character(name, serverSlug, serverRegion).encounterRankings` — returns per-boss: rankPercent, bestAmount (DPS/HPS), totalKills, fastestKill, medianPerformance
- Rate limiting: 1 req/sec with exponential backoff on 429s
- Token caching with automatic refresh on expiry

**Env vars:**
```
WCL_CLIENT_ID=
WCL_CLIENT_SECRET=
```

## 2. Guild-Scoped Drafting

The draftable player pool is scoped to specific guilds, not an entire server. This creates meaningful scarcity — like NFL teams providing the player pool in fantasy football.

**League creation adds:**
- Game version: Classic or Retail
- Guild selection: search WCL, add 2-5 guilds
- Raid selection: multi-select which raids count for scoring (default: all current)

**Player pool population:**
- Query WCL for active raiders in the selected guilds
- "Active" = has logged kills within the last 4 weeks
- Store in the league's player pool (replaces the global `proplayers` DB for that league)

## 3. Multi-Category Scoring

Six point categories, designed to be extensible:

| Category | Source | How |
|----------|--------|-----|
| Parse | `rankPercent` | Points by percentile bracket: 99=10, 95+=8, 90+=6, 75+=4, 50+=2 |
| DPS/HPS | `bestAmount` | Points for throughput relative to other drafted players |
| Boss Kills | `totalKills` delta | Points per new kill since last report |
| Speed Clear | `fastestKill` | Bonus for fastest kill per boss among drafted players |
| New Best | `bestAmount`/`rankPercent` delta | Points when player beats their previous best |
| Consistency | `medianPerformance` vs `bestAmount` | Points for reliable performance (median close to best) |

Per-player points object:
```javascript
{ total: 42, parse: 16, dps: 8, bosses_down: 6, speedy_clear: 4, new_best: 6, consistency: 2 }
```

**Titles:** Highest-scoring category earns a title badge ("Boss Killer", "Record Setter", "Speed Clearer", etc.) — already partially built in `league_rankings.pug`.

**Extensibility:** Categories are defined as a config array, each with a `name`, `compute(playerNew, playerOld, allPlayers)` function, and `maxPoints`. New categories can be added without changing the scoring engine.

## 4. Head-to-Head Matchups

After the draft, the league enters an Active scoring phase with weekly head-to-head matchups:

- Round-robin schedule generated at season start
- Each week, teams are paired; higher weekly score wins
- W/L record displayed on league page and rankings page
- Odd number of teams: one bye (auto-win) per week

Schedule stored on league:
```javascript
league.schedule = [
  { week: 1, matchups: [{home: "teamId1", away: "teamId2"}, {bye: "teamId3"}] },
  ...
]
```

## 5. Report Generation

**Trigger:** Automatic on the league's report day, plus manual "Update Scores" button for admin.

**Flow:**
1. Snapshot each drafted player's current WCL stats
2. Fetch fresh data from WCL for each player across enabled raids
3. Compute deltas vs. previous snapshot
4. Score across 6 categories
5. Resolve head-to-head matchup (compare team weekly totals)
6. Store report in `league.activity_reports`
7. Update player snapshots for next comparison

**Previous snapshot storage:**
```javascript
league.player_snapshots = {
  "PlayerName": {
    encounters: {
      "Ragnaros": { rankPercent: 87, bestAmount: 1523, totalKills: 12, fastestKill: 180000 },
      ...
    },
    lastUpdated: "2024-01-15T..."
  }
}
```

**Scheduling:** Server runs a daily check. If today matches a league's report day and no report exists for this week, auto-generate.

## 6. League Lifecycle

```
Setting Up → Drafting → Active (Scoring) → Completed
```

After draft completes, admin sees "Start Season":
1. Confirm guild/raid settings
2. Set report day (default: Wednesday)
3. Set season length (default: 8 weeks)
4. "Start Season" → generates matchup schedule, moves to Active

## 7. Routes & Services

**New service files:**
- `services/warcraftlogs.js` — WCL API client (auth, queries, rate limiting)
- `services/scoring.js` — scoring engine (extensible category system)
- `services/reports.js` — report generation orchestrator

**New routes:**
- `POST /leagues/api/:id/generateReport` — admin triggers report
- `GET /leagues/api/:id/matchups` — matchup schedule
- `GET /leagues/api/:id/standings` — W/L standings
- `GET /leagues/api/:id/guilds/search` — search WCL for guilds (league setup)
- `POST /leagues/api/:id/startSeason` — begin scoring phase

**UI updates:**
- League creation form: game version, guild search/select, raid selection
- League home: current matchup, W/L record, "Update Scores" button
- Rankings page: feed real data into existing template

## 8. Rolling Time Window

Reports use a rolling 7-day window. Since drafted players come from different guilds with different raid schedules, we compare snapshots rather than tracking specific raid nights. Any activity within the reporting period counts.

## Future (Not in v1)

- Waiver wire (drop/pick up players between reports)
- Trading between teams
- Discord webhook notifications for weekly results
- League-configurable scoring weights
- Salary cap / auction draft
- Playoffs bracket
