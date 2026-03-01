# WoWDraft

Fantasy football for World of Warcraft. Create leagues, draft real WoW raiders based on their raid performance, and compete with friends.

## Quick Start

### Prerequisites

- Node.js 16+
- Docker (for local MongoDB)

### Setup

1. Clone and install:
   ```bash
   git clone https://github.com/gummyfrog/wowdraft.git
   cd wowdraft
   npm install
   ```

2. Start MongoDB:
   ```bash
   docker-compose up -d
   ```

3. Copy the environment config:
   ```bash
   cp .env.example .env
   ```

4. Seed the database with mock player data:
   ```bash
   npm run seed
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

### Authentication

By default, the app runs in **guest mode** — click Login and you'll be assigned a guest username automatically. To enable Discord OAuth, set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in your `.env` file.

### Configuration

See `.env.example` for all available options:

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `DISCORD_CLIENT_ID` | _(empty)_ | Discord OAuth app ID (leave blank for guest mode) |
| `DISCORD_CLIENT_SECRET` | _(empty)_ | Discord OAuth app secret |
| `SESSION_SECRET` | `wowdraft-dev-secret` | Express session secret |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `debug`) |
| `PORT` | `3000` | Server port |

## How It Works

1. **Create a League** — pick a faction, set draft rounds, customize your league's look
2. **Register Teams** — friends join and create their teams
3. **Draft Players** — snake-draft style, pick real WoW raiders from raid log data
4. **Compete** — track performance based on raid rankings

## Project Structure

```
wowdraft/
├── app.js              # Express app setup & route mounting
├── db.js               # Shared MongoDB connection module
├── bin/www             # Server entry point
├── routes/
│   ├── index.js        # Root redirect & error pages
│   ├── auth.js         # Discord OAuth & guest mode
│   ├── leagues.js      # League & team CRUD
│   ├── draft.js        # Draft actions & polling
│   ├── players.js      # Player search & browse
│   ├── admin.js        # Debug admin panel
│   └── league.js       # LeagueLogic class (draft ordering)
├── views/              # Pug templates with inline Vue.js
├── public/             # Static assets (CSS, images, fonts)
├── scripts/
│   └── seed.js         # Database seeder with mock WoW data
├── docker-compose.yml  # Local MongoDB
└── .env.example        # Environment variable template
```
