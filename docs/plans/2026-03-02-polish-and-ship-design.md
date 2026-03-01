# WoWDraft: Polish & Ship Design

**Date:** 2026-03-02
**Goal:** Clean up the codebase and make it runnable locally out of the box, while keeping the existing Express + Pug + Vue 2 stack.

## Priorities

1. Code cleanup & structure (split monolith routes, remove unused deps)
2. Seed data & local dev (mock players, Docker Compose for MongoDB, guest mode)

## 1. Route Restructuring

Split `routes/index.js` (~450 lines) into focused route files:

```
routes/
  index.js       - root redirect + error pages
  auth.js        - Discord OAuth + guest mode
  leagues.js     - leagues + teams CRUD, view, listing
  players.js     - player search/browse endpoints
  draft.js       - draft actions + draft info polling
  admin.js       - admin/debug endpoints
```

Each file uses its own Express Router, mounted in `app.js`. The existing `routes/league.js` (LeagueLogic class with draft ordering) stays and gets minor cleanup.

## 2. Database Layer & Configuration

**`db.js`** - shared module that:
- Uses `dotenv` to load credentials from `.env`
- Connects to MongoDB (Atlas via URI in prod, localhost in dev)
- Exports collection handles: `leagues`, `dps`, `healers`, `tanks`
- Handles connection errors gracefully

**`.env.example`**:
```
MONGO_URI=mongodb://localhost:27017
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
SESSION_SECRET=wowdraft-dev-secret
NODE_ENV=development
PORT=3000
```

## 3. Guest Mode

When `DISCORD_CLIENT_ID` is not set, auth routes return a mock user session (`{ username: "Guest#1234" }`). All auth-gated pages work normally without real Discord OAuth.

## 4. Seed Data & Local Dev

**`scripts/seed.js`**:
- Connects to local MongoDB
- Populates `dps`, `healers`, `tanks` collections with ~100-200 realistic WoW Classic players each
- Varied classes, guilds, specs, parse percentages, encounter rankings
- Creates a sample league with teams for immediate demo

**`docker-compose.yml`** - MongoDB 6 only:
```yaml
services:
  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - wowdraft-data:/data/db
```

**Dev workflow:**
```bash
docker-compose up -d
npm run seed
npm run dev
```

## 5. Dependency Cleanup

**Remove:** `socket.io`, `ws`, `graphql-request` (unused)
**Add:** `dotenv`, `nodemon` (dev)
**New npm scripts:**
```json
{
  "dev": "nodemon ./bin/www",
  "seed": "node scripts/seed.js"
}
```

## Non-Goals

- No frontend changes (Vue component extraction, jQuery removal, mobile fixes)
- No real-time WebSocket integration
- No new features
- No migration away from Pug templates
