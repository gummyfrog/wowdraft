# Guild-Scoped Drafting Design

**Date:** 2026-03-02
**Goal:** Replace the static global player pool with guild-scoped drafting, raid zone selection, and time-windowed report generation.

## Core Idea

The draftable player pool is scoped to specific guilds, not a global DB. League admins select guilds during setup, players are fetched and stored on the league document, and the draft reads from that pool. The creation flow is identical regardless of whether WCL is configured — the data source differs but the UI and data shape do not.

## 1. Unified League Creation Flow

The flow is the same whether WCL API keys are present or not:

1. Admin fills out name, server, region, game version
2. Admin selects raid zones (checkboxes, default all selected)
3. Admin selects guilds — searches WCL if configured, otherwise shows guilds from the seed `proplayers` DB
4. On submit, player pool is populated from whichever source into `league.player_pool`
5. Everything downstream (draft, scoring, reports) reads from `league.player_pool`

The admin never sees a difference. The backend transparently switches data sources.

## 2. Player Pool

Stored directly on the league document as `league.player_pool[]`. Each entry has the same schema regardless of source:

```javascript
league.player_pool = [
  {
    name: "Arthas",
    guild: "APES",
    classID: 1,
    class: "warrior",
    active: true,       // kills in selected raids within last 4 weeks
    faction: 0,
    tag: "dps",         // role: dps, healers, or tanks
    rankings: [],       // encounter rankings
    drafted: [],        // league codes that drafted this player
  },
]
```

- **WCL source**: Fetched from `getGuildMembers()` + `getCharacterRankings()` per player
- **Seed source**: Copied from `proplayers` DB collections, reformatted to match the same schema
- **Draft reads from one place**: `league.player_pool`, always

The global `proplayers` DB remains as a seed/fallback data source only. It is never read during drafts directly.

## 3. Guild Selection

Leagues store their selected guilds:

```javascript
league.guilds = [
  { name: "APES", serverSlug: "faerlina", serverRegion: "us" },
  { name: "Grizzly", serverSlug: "faerlina", serverRegion: "us" },
]
```

- 2-5 guilds per league
- Guild search endpoint: `GET /leagues/api/:id/guilds/search?q=name`
  - WCL configured: proxies to WCL `searchGuilds` / `guildData.guilds`
  - WCL not configured: searches distinct guild names from `proplayers` DB

## 4. Raid Zone Selection

Leagues store selected raid zones:

```javascript
league.raids = [
  { id: 1000, name: "Molten Core" },
  { id: 1001, name: "Blackwing Lair" },
]
```

- A static map of zone names → WCL zone IDs is stored in the codebase, keyed by game version
- Default: all zones selected
- Admin deselects zones they don't want
- Zones affect: player ranking fetches (scoped to selected zones), scoring (only encounters in selected zones count), active flag (kills in selected zones within 4 weeks)

## 5. Rolling Time Window

Report generation scopes WCL queries to a 7-day rolling window:

- `getCharacterRankings()` in `services/warcraftlogs.js` gains optional `zoneID` and `timeframe` parameters
- `fetchPlayerSnapshot()` in `services/reports.js` passes the league's selected zone IDs and a 7-day time window
- Scoring engine is unchanged — it scores whatever encounters are in the snapshot
- Snapshot storage format is unchanged
- Seed/demo data has no time dimension (mock data is fine as-is)

## 6. Code Changes

| Area | What Changes |
|------|-------------|
| `routes/players.js` | Browse/search reads from `league.player_pool` instead of `proplayers` DB |
| `routes/leagues.js` | Creation handler populates `player_pool` from WCL or seed source; guild search endpoint |
| `services/warcraftlogs.js` | `getCharacterRankings` gains zone/timeframe params |
| `services/reports.js` | `fetchPlayerSnapshot` passes zone/timeframe from league config |
| `views/create_league.pug` | Guild search/add UI, raid zone checkboxes |
| `views/proplayers.pug` | Reads from league pool instead of global DB |
| `scripts/seed.js` | Demo league gets `player_pool` in the new format |

## 7. What Doesn't Change

- Scoring engine (`services/scoring.js`) — operates on snapshot data, doesn't care about source
- Matchup resolution — same logic
- League lifecycle — same states
- Draft ordering logic (`routes/league.js`) — same algorithm, different data source
- Scheduler (`services/scheduler.js`) — same trigger logic
