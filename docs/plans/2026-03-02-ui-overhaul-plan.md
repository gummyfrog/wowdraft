# UI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the WoWDraft UI to be tight, information-dense, and fun — compact league headers, grid team cards, dense player tables, event-poster league listings, and head-to-head matchup + bracket visualizations.

**Architecture:** Incremental view-by-view changes. Same Pug + Vue 2 inline components + CSS stack. New CSS rules appended to `style.css`. Each task targets one view/component and is independently shippable.

**Tech Stack:** Pug templates, Vue 2 (CDN), CSS3 (Grid, Flexbox, animations), Font Awesome 5, Express.js routes

---

### Task 1: Compact League Header + Navigation Bar

The `draft_info` Vue component is duplicated across `league.pug`, `league_teams.pug`, and `league_rankings.pug`. Currently it's a tall block with banner, name, description, metadata paragraphs, and nav links jumbled together. Replace it with a compact 3-row header: icon+name+status, metadata chips, nav tabs.

**Files:**
- Modify: `views/league.pug` — rewrite `draft_info` component template, move description/CTAs to body
- Modify: `views/league_teams.pug` — rewrite `draft_info` component template
- Modify: `views/league_rankings.pug` — rewrite `draft_info` component template
- Modify: `views/proplayers.pug` — add league header (currently has no header at all)
- Modify: `routes/players.js` — pass full league object to proplayers view
- Modify: `public/stylesheets/style.css` — add compact header CSS

**Step 1: Add compact header CSS to `style.css`**

Append to end of `public/stylesheets/style.css`:

```css
/*
  Compact League Header
*/

.league-header {
  border: 2px solid #555555;
  background-image: linear-gradient(#161616, #0a0a0a);
  margin-bottom: 15px;
}

.league-header-top {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  gap: 10px;
}

.league-header-icon {
  height: 32px;
  width: 32px;
  clip-path: circle(50%);
  flex-shrink: 0;
}

.league-header-name {
  font-size: 1.4em;
  flex-grow: 1;
}

.status-badge {
  font-size: 0.8em;
  font-weight: bold;
  padding: 3px 10px;
  border-radius: 10px;
  flex-shrink: 0;
  text-shadow: none;
}

.status-badge.setting-up { background: #40BC40; color: #000; }
.status-badge.in-progress { background: #C41E3A; color: #fff; }
.status-badge.drafted { background: #FF8000; color: #000; }
.status-badge.active { background: #00B7FF; color: #000; }
.status-badge.completed { background: #888; color: #fff; }

.league-header-meta {
  padding: 4px 15px 8px;
  font-size: 0.85em;
  opacity: 0.7;
}

.meta-chip {
  font-family: 'Montserrat', sans-serif;
}

.meta-sep {
  margin: 0 6px;
  opacity: 0.5;
}

.league-header-nav {
  display: flex;
  border-top: 1px solid #333;
}

.league-header-nav a {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  color: #aaa;
  text-decoration: none;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.9em;
  border-right: 1px solid #333;
  transition: background 0.15s, color 0.15s;
}

.league-header-nav a:last-child {
  border-right: none;
}

.league-header-nav a:hover {
  background: rgba(255,255,255,0.05);
  color: #fff;
}

.league-header-nav a.active {
  color: #00B7FF;
  border-bottom: 2px solid #00B7FF;
}
```

**Step 2: Rewrite the `draft_info` component in `league.pug`**

Replace the existing `draft_info` component template (the long one with `league_wrapper`, `league_body`, `league_information`, `startbutton`, `create_team_box`) with:

```javascript
Vue.component('draft_info', {
  props: ['league_info', 'status_slug', 'current_page'],
  template: `
  <div class="league-header">
    <div class="league-header-top">
      <img class="league-header-icon" :src="'/images/league_icons/' + league_info.icon">
      <h1 class="league-header-name" :style="'color:'+league_info.color1">{{league_info.name}}</h1>
      <span class="status-badge" :class="status_slug">{{league_info.status}}</span>
    </div>
    <div class="league-header-meta">
      <span class="meta-chip">{{league_info.server || 'Any Server'}}</span>
      <span class="meta-sep">&middot;</span>
      <span class="meta-chip">{{league_info.faction || 'Any'}}</span>
      <span class="meta-sep">&middot;</span>
      <span class="meta-chip">{{league_info.style || 'Snake'}} Draft</span>
      <span class="meta-sep">&middot;</span>
      <span class="meta-chip">{{league_info.report_day || 'Monday'}} reports</span>
      <span class="meta-sep">&middot;</span>
      <span class="meta-chip">Org: {{league_info.admin.name}}</span>
    </div>
    <div class="league-header-nav">
      <a :href="'/leagues/' + league_info.code" :class="{active: current_page === 'home'}"><i class="fas fa-home"></i> Home</a>
      <a :href="'/leagues/' + league_info.code + '/teams'" :class="{active: current_page === 'teams'}"><i class="fas fa-flag"></i> Teams</a>
      <a :href="'/leagues/' + league_info.code + '/rankings'" :class="{active: current_page === 'rankings'}"><i class="fas fa-calendar-alt"></i> Rankings</a>
      <a :href="'/proplayers/' + league_info.code" :class="{active: current_page === 'players'}"><i class="fas fa-list"></i> Players</a>
    </div>
  </div>
  `
})
```

Update the component usage in the Pug template to pass `current_page`:

```pug
draft_info(
  v-bind:league_info="league_info",
  v-bind:status_slug="statusSlug",
  current_page="home"
)
```

Move the league description into the league home body (after the `draft_info` component, before `draft_progress`). Add a simple description line if the league has one:

```pug
p(v-if="league_info.description").league-description.
  "{{league_info.description}}"
```

The "Start Drafting" and "Register Your Team" CTAs stay where they currently are (they were already moved to body in a previous session).

**Step 3: Update `draft_info` in `league_teams.pug`**

Replace the `draft_info` component definition with the same compact version as Step 2 (copy-paste). Change the component usage:

```pug
draft_info(
  v-bind:league_info="league_info",
  current_page="teams"
)
```

Add `statusSlug` computed property and pass `status_slug` prop (the teams page currently doesn't compute it):

In the Vue instance `computed` section, add:
```javascript
statusSlug() {
  return this.league_info.status.toLowerCase().replace(" ", '-');
}
```

Update component usage:
```pug
draft_info(
  v-bind:league_info="league_info",
  v-bind:status_slug="statusSlug",
  current_page="teams"
)
```

**Step 4: Update `draft_info` in `league_rankings.pug`**

Same compact component definition. Update usage:

```pug
draft_info(
  v-bind:league_info="league_info",
  v-bind:status_slug="statusSlug",
  current_page="rankings"
)
```

Add `statusSlug` computed to the rankings Vue instance.

**Step 5: Add league header to `proplayers.pug`**

The player browser currently has no league header at all. Add the compact header.

Modify `routes/players.js`: in the `GET /:leagueID` handler, pass the full league object:

```javascript
res.render('proplayers', {
  title: league.name,
  leagueID: req.params.leagueID,
  league: JSON.stringify(league),
  onClock: onClock,
  user_session_auth: req.session.loggedin,
  user_session_name: req.session.username,
});
```

In `proplayers.pug`, add the `draft_info` component definition (same as Step 2) and add it above the filtering section:

```pug
div#proplayers
  draft_info(
    v-bind:league_info="league_info",
    v-bind:status_slug="statusSlug",
    current_page="players"
  )
  div#player-filtering
    ...
```

Add to Vue instance data:
```javascript
league_info: league,
```

Add to Vue instance computed:
```javascript
statusSlug() {
  return this.league_info.status.toLowerCase().replace(" ", '-');
}
```

And at the top of the script block:
```javascript
var league = JSON.parse('!{league}');
```

**Step 6: Verify**

Run: `npm start`

Visit each league sub-page and confirm:
- Compact header shows icon + name + status badge on one line
- Metadata chips show below
- Nav tabs show with correct active state per page
- Player browser now has the league header
- No layout breakage

**Step 7: Commit**

```bash
git add views/league.pug views/league_teams.pug views/league_rankings.pug views/proplayers.pug routes/players.js public/stylesheets/style.css
git commit -m "feat: compact league header with nav tabs across all league pages"
```

---

### Task 2: Team Cards Grid

Replace the stacked full-width team cards on the league home page with a responsive 2-3 column grid of compact cards showing icon, name, manager, record, and roster.

**Files:**
- Modify: `views/league.pug` — rewrite `team-item` component, add grid wrapper
- Modify: `public/stylesheets/style.css` — add team grid CSS

**Step 1: Add team grid CSS**

Append to `style.css`:

```css
/*
  Team Cards Grid
*/

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  padding: 0;
  list-style: none;
}

.team-card {
  border: 2px solid #555;
  background-image: linear-gradient(#161616, #0a0a0a);
  border-radius: 4px;
  overflow: hidden;
}

.team-card-head {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  gap: 8px;
  border-bottom: 1px solid #333;
}

.team-card-head img {
  height: 28px;
  width: 28px;
  flex-shrink: 0;
}

.team-card-head h2 {
  font-size: 1.1em;
  flex-grow: 1;
}

.team-card-head .team-record {
  font-size: 0.85em;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.team-card-manager {
  padding: 4px 10px;
  font-size: 0.85em;
  opacity: 0.7;
  border-bottom: 1px solid #222;
}

.team-card-motto {
  padding: 4px 10px;
  font-size: 0.85em;
  font-style: italic;
  border-bottom: 1px solid #222;
}

.team-card-roster {
  padding: 6px 10px;
}

.roster-player {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}

.roster-player img {
  height: 20px;
  width: 20px;
}

.roster-player .player-name {
  font-size: 0.9em;
}

.roster-player .player-guild {
  font-size: 0.75em;
  opacity: 0.5;
  margin-left: auto;
}

.roster-empty {
  opacity: 0.3;
  padding: 3px 0;
  font-size: 0.85em;
  font-style: italic;
}
```

**Step 2: Rewrite team-item component in `league.pug`**

Replace the existing `team-item` component:

```javascript
Vue.component('team-item', {
  props: ['team', 'index', 'record'],
  template: `
  <div class="team-card" :style="'border-color:' + (team.color2 || '#555')">
    <div class="team-card-head">
      <img :src="'/images/icons/'+team.icon+'.png'">
      <h2 :style="'color:'+team.color2">{{team.name}}</h2>
      <span v-if="record" class="team-record">{{record}}</span>
    </div>
    <div class="team-card-manager">{{team.manager}}</div>
    <div v-if="team.motto" class="team-card-motto" :style="'color:'+team.color2">{{team.motto}}</div>
    <div class="team-card-roster">
      <div v-for="player in team.drafted_players" class="roster-player">
        <img :src="'/images/classes/'+player.class+'.png'">
        <img :src="'/images/roles/'+player.role+'.png'">
        <span class="player-name" :class="player.class">{{player.name}}</span>
        <span class="player-guild">{{player.guild}}</span>
      </div>
      <div v-if="team.drafted_players.length === 0" class="roster-empty">No players drafted yet</div>
    </div>
  </div>
  `
})
```

Update the Pug template to use a grid wrapper and pass record:

```pug
div.title-bar
  h2.
    <i class="fas fa-flag"></i>
    Registered Teams

div.teams-grid
  team-item(
    v-for="(team, index) in teams"
    v-bind:team="team"
    v-bind:index="index"
    v-bind:record="getRecord(team.id)"
  )
```

Remove the old `teams_wrapper` div and `ol#teams`.

**Step 3: Verify**

Run `npm start`, visit a league home page. Confirm:
- Teams display in a grid (2-3 columns depending on viewport)
- Each card shows icon, name (in team color), manager, motto, record, roster
- Roster shows class icon + role icon + class-colored name + guild
- Card border uses team color
- Empty state shows "No players drafted yet"

**Step 4: Commit**

```bash
git add views/league.pug public/stylesheets/style.css
git commit -m "feat: team cards as responsive grid with roster and record display"
```

---

### Task 3: Dense Player Browser Table

Replace the tall player cards in the draft browser with a dense sortable table. Add a requirements tracker showing what roles the team still needs.

**Files:**
- Modify: `views/proplayers.pug` — rewrite player display as table, add requirements tracker
- Modify: `public/stylesheets/style.css` — add player table CSS
- Modify: `routes/players.js` — pass team/requirements data for the requirements tracker

**Step 1: Add player table CSS**

Append to `style.css`:

```css
/*
  Dense Player Table
*/

.player-table {
  width: 100%;
  border-collapse: collapse;
}

.player-table th {
  text-align: left;
  padding: 6px 10px;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.6;
  border-bottom: 2px solid #555;
  cursor: pointer;
  user-select: none;
}

.player-table th:hover {
  opacity: 1;
}

.player-table th .sort-arrow {
  margin-left: 4px;
  font-size: 0.8em;
}

.player-row {
  border-bottom: 1px solid #222;
  transition: background 0.1s;
}

.player-row:hover {
  background: rgba(255,255,255,0.03);
}

.player-row td {
  padding: 6px 10px;
  vertical-align: middle;
}

.player-row.inactive {
  opacity: 0.35;
}

.player-row.inactive .player-name-cell {
  text-decoration: line-through;
}

.player-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.player-name-cell img {
  height: 22px;
  width: 22px;
}

.player-name-text {
  font-weight: 500;
}

.role-pill {
  font-size: 0.75em;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
  text-shadow: none;
}

.role-pill.dps { background: #C41E3A; color: #fff; }
.role-pill.tanks { background: #00B7FF; color: #000; }
.role-pill.healers { background: #40BC40; color: #000; }

.parse-value {
  font-weight: 700;
  font-family: 'Roboto Mono', monospace;
}

.draft-btn {
  border: none;
  border-radius: 8px;
  background: #00B7FF;
  color: #000;
  padding: 4px 12px;
  cursor: pointer;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.85em;
  font-weight: 600;
  transition: transform 0.1s, opacity 0.1s;
}

.draft-btn:hover {
  opacity: 0.85;
  transform: scale(0.97);
}

.draft-flash {
  animation: draftFlash 0.4s ease-out;
}

@keyframes draftFlash {
  0% { background: rgba(0, 183, 255, 0.3); }
  100% { background: transparent; }
}

/*
  Requirements Tracker
*/

.requirements-tracker {
  display: flex;
  gap: 12px;
  padding: 10px 15px;
  border: 2px solid #555;
  background-image: linear-gradient(#161616, #0a0a0a);
  margin-bottom: 10px;
  align-items: center;
}

.req-slot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9em;
}

.req-slot.fulfilled {
  opacity: 0.4;
}

.req-slot .req-count {
  font-weight: 700;
  font-family: 'Roboto Mono', monospace;
}

.req-label {
  font-family: 'Montserrat', sans-serif;
  font-size: 0.85em;
  margin-right: 15px;
  opacity: 0.7;
}

/*
  Player Filters (updated)
*/

.player-filters {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 15px;
  border: 2px solid #555;
  background-image: linear-gradient(#161616, #0a0a0a);
  margin-bottom: 2px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group label {
  font-size: 0.8em;
  opacity: 0.6;
  text-transform: uppercase;
  font-family: 'Montserrat', sans-serif;
}

.role-tabs {
  display: flex;
  gap: 0;
}

.role-tab {
  padding: 4px 12px;
  border: 1px solid #555;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.85em;
}

.role-tab:first-child { border-radius: 4px 0 0 4px; }
.role-tab:last-child { border-radius: 0 4px 4px 0; }

.role-tab.active {
  background: #00B7FF;
  color: #000;
  border-color: #00B7FF;
}

.player-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
```

**Step 2: Update `routes/players.js` to pass requirements and team data**

In the `GET /:leagueID` handler, add the user's team requirements info:

```javascript
var yourTeam = null;
var teamIndex = league.teams.findIndex(t => t.manager === req.session.username);
if (teamIndex !== -1) {
  yourTeam = league.teams[teamIndex];
}

res.render('proplayers', {
  title: league.name,
  leagueID: req.params.leagueID,
  league: JSON.stringify(league),
  yourTeam: JSON.stringify(yourTeam),
  onClock: onClock,
  user_session_auth: req.session.loggedin,
  user_session_name: req.session.username,
});
```

**Step 3: Rewrite `proplayers.pug` template**

Replace the filtering/display section and Vue components with the dense table layout:

```pug
div#proplayers
  draft_info(
    v-bind:league_info="league_info",
    v-bind:status_slug="statusSlug",
    current_page="players"
  )

  div(v-if="yourTeam && league_info.requirements").requirements-tracker
    span.req-label Need:
    span.req-slot(:class="{fulfilled: tanksFilled}")
      span.req-count {{tanksNeeded}}
      span Tanks
    span.req-slot(:class="{fulfilled: dpsFilled}")
      span.req-count {{dpsNeeded}}
      span DPS
    span.req-slot(:class="{fulfilled: healersFilled}")
      span.req-count {{healersNeeded}}
      span Healers

  div.player-filters
    div.filter-group
      div.role-tabs
        button.role-tab(:class="{active: tag === 'dps'}" @click="setTag('dps')") DPS
        button.role-tab(:class="{active: tag === 'tanks'}" @click="setTag('tanks')") Tanks
        button.role-tab(:class="{active: tag === 'healers'}" @click="setTag('healers')") Healers
    div.filter-group
      label Name:
      input(type="text" v-model="playername" @input="debouncedFetch" placeholder="Search...")
    div.filter-group
      label Guild:
      input(type="text" v-model="guild" @input="debouncedFetch" placeholder="Filter guild...")
    div.player-pagination
      button(@click="pageDown" :disabled="page === 0").pageButton
        i.fas.fa-chevron-left
      span Page {{page + 1}}
      button(@click="pageUp").pageButton
        i.fas.fa-chevron-right

  div#player-display
    table.player-table
      thead
        tr
          th(@click="sortBy('class')") Class
          th(@click="sortBy('name')") Name
          th(@click="sortBy('guild')") Guild
          th Role
          th(@click="sortBy('avgParse')") Parse
          th(v-if="onClock")
      tbody
        tr(v-for="player in sortedPlayers" :class="['player-row', {inactive: player.active === false}]")
          td
            div.player-name-cell
              img(:src="'/images/classes/'+player.class+'.png'")
          td
            div.player-name-cell
              span.player-name-text(:class="player.class") {{player.name}}
          td {{player.guild}}
          td
            span.role-pill(:class="player.tag") {{player.tag === 'dps' ? 'DPS' : player.tag === 'tanks' ? 'Tank' : 'Healer'}}
          td
            span(v-if="player.avgParse != null" :style="'color:' + parseColor(player.avgParse)").parse-value {{Math.round(player.avgParse)}}
            span(v-else).parse-value --
          td(v-if="onClock")
            form(v-if="player.active !== false" :action="'/leagues/api/' + leagueID + '/draftPlayer'" method="post")
              input(type="hidden" name="player_name" :value="player.name")
              button(type="submit").draft-btn Draft
            span(v-else style="opacity:0.4") Inactive

    h2(v-if="!found") Player(s) not found.
```

Update the Vue instance:

```javascript
var league = JSON.parse('!{league}');
var yourTeam = JSON.parse('!{yourTeam}');
var onClock = !{onClock};

// ... draft_info component definition (same as Task 1) ...

var app = new Vue({
  el: '#proplayers',
  data: {
    players: [],
    found: true,
    page: 0,
    tag: "dps",
    leagueID: leagueID,
    league_info: league,
    yourTeam: yourTeam,
    onClock: onClock,
    playername: "",
    guild: "",
    sortKey: '',
    sortAsc: true,
    lastSource: "generic",
    debounceTimer: null,
  },
  computed: {
    statusSlug() {
      return this.league_info.status.toLowerCase().replace(" ", '-');
    },
    sortedPlayers() {
      if (!this.sortKey) return this.players;
      var key = this.sortKey;
      var asc = this.sortAsc;
      return this.players.slice().sort(function(a, b) {
        var va = a[key], vb = b[key];
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
      });
    },
    tanksNeeded() {
      if (!this.yourTeam || !this.league_info.requirements) return 0;
      return Math.max(0, this.league_info.requirements.tanks - (this.yourTeam.roles_drafted ? this.yourTeam.roles_drafted.tanks : 0));
    },
    dpsFilled() { return this.dpsNeeded === 0; },
    tanksFilled() { return this.tanksNeeded === 0; },
    healersFilled() { return this.healersNeeded === 0; },
    dpsNeeded() {
      if (!this.yourTeam || !this.league_info.requirements) return 0;
      return Math.max(0, this.league_info.requirements.dps - (this.yourTeam.roles_drafted ? this.yourTeam.roles_drafted.dps : 0));
    },
    healersNeeded() {
      if (!this.yourTeam || !this.league_info.requirements) return 0;
      return Math.max(0, this.league_info.requirements.healers - (this.yourTeam.roles_drafted ? this.yourTeam.roles_drafted.healers : 0));
    },
  },
  methods: {
    parseColor(parse) {
      parse = parseInt(parse);
      if (parse < 25) return '#666';
      if (parse < 50) return '#1eff00';
      if (parse < 75) return '#0070dd';
      if (parse < 95) return '#a335ee';
      if (parse < 99) return '#ff8000';
      return '#e5cc80';
    },
    sortBy(key) {
      if (this.sortKey === key) {
        this.sortAsc = !this.sortAsc;
      } else {
        this.sortKey = key;
        this.sortAsc = true;
      }
    },
    setTag(tag) {
      this.tag = tag;
      this.page = 0;
      this.fetchSource();
    },
    debouncedFetch() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.fetchSource(), 300);
    },
    // ... keep existing fetchSource, fetchData, fetchPlayer, fetchGuild, pageDown, pageUp methods ...
    // Remove the jQuery parseStyle coloring from .then() chains (now handled by parseColor computed)
  }
})
```

**Step 4: Verify**

Run `npm start`, visit `/proplayers/{leagueID}`:
- League header appears at top with Players tab active
- Requirements tracker shows needed roles
- Players display as dense table rows with class icon, name (class-colored), guild, role pill, parse (color-coded)
- Inactive players are dimmed with strikethrough
- Sort by clicking column headers
- Role tabs filter correctly
- Pagination works

**Step 5: Commit**

```bash
git add views/proplayers.pug routes/players.js public/stylesheets/style.css
git commit -m "feat: dense player table with role pills, sort, and requirements tracker"
```

---

### Task 4: Leagues Listing Event Cards

Replace the plain league listing with flashy event-poster cards in a grid.

**Files:**
- Modify: `views/leagues.pug` — rewrite `league-item` component, use grid
- Modify: `public/stylesheets/style.css` — add league card CSS

**Step 1: Add league card CSS**

Append to `style.css`:

```css
/*
  League Event Cards
*/

.league-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  padding: 15px 0;
  list-style: none;
}

.league-card {
  position: relative;
  border: 2px solid #555;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  background-image: linear-gradient(#161616, #0a0a0a);
}

.league-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

.league-card-banner {
  height: 60px;
  width: 100%;
  object-fit: cover;
  display: block;
  opacity: 0.4;
}

.league-card-body {
  padding: 12px 15px;
}

.league-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.league-card-top img {
  height: 28px;
  width: 28px;
  clip-path: circle(50%);
}

.league-card-top h2 {
  font-size: 1.15em;
  flex-grow: 1;
}

.league-card-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.8em;
  opacity: 0.7;
}

.league-card-meta span {
  font-family: 'Montserrat', sans-serif;
}

.league-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 15px;
  border-top: 1px solid #333;
  font-size: 0.8em;
  opacity: 0.6;
}
```

**Step 2: Rewrite leagues.pug**

```pug
extends layout

block content

  div#content
    div#about
      h1 Welcome to WowDraft Beta!
      h3 It's like Fantasy Football, but for World of Warcraft.
      br
      h3 Get started by logging in with Discord and making a league for you and your friends, or joining one that hasn't drafted yet!

    div#leagues
      div.league-cards-grid
        league-item(
          v-for="(league, index) in leagues"
          v-bind:league_info="league"
          v-bind:index="index"
        )

  script.
    var leagues = !{leagues}

    Vue.component('league-item', {
      props: ['league_info', 'index'],
      computed: {
        statusSlug() {
          return this.league_info.status.toLowerCase().replace(" ", '-');
        },
        teamCount() {
          return (this.league_info.teams || []).length;
        }
      },
      methods: {
        goToLeague() {
          window.location.href = '/leagues/' + this.league_info.code;
        }
      },
      template: `
      <div class="league-card" @click="goToLeague">
        <img class="league-card-banner" :src="'/images/league_icons/' + league_info.icon">
        <div class="league-card-body">
          <div class="league-card-top">
            <img :src="'/images/league_icons/' + league_info.icon">
            <h2 :style="'color:' + (league_info.color1 || '#fff')">{{league_info.name}}</h2>
            <span class="status-badge" :class="statusSlug">{{league_info.status}}</span>
          </div>
          <div class="league-card-meta">
            <span>{{league_info.style || 'Snake'}} Draft</span>
            <span>&middot;</span>
            <span>{{league_info.rounds}} Picks</span>
            <span>&middot;</span>
            <span>{{teamCount}} Teams</span>
          </div>
        </div>
        <div class="league-card-footer">
          <span>Organized by {{league_info.admin.name}}</span>
          <span>{{league_info.report_day || 'Monday'}} reports</span>
        </div>
      </div>
      `
    })

    var app = new Vue({
      el: '#leagues',
      data: {
        leagues: leagues.reverse()
      }
    })
```

**Step 3: Verify**

Visit `/leagues`. Confirm:
- Leagues display as event-poster cards in a grid
- Banner image as a dim strip at top of each card
- League name in custom color, status badge
- Metadata chips (draft style, picks, team count)
- Footer with organizer and report day
- Hover lifts card slightly
- Clicking card navigates to league

**Step 4: Commit**

```bash
git add views/leagues.pug public/stylesheets/style.css
git commit -m "feat: flashy event-poster league cards in responsive grid"
```

---

### Task 5: Head-to-Head Matchup Cards

Replace the plain text matchup results on the rankings page with visual head-to-head cards.

**Files:**
- Modify: `views/league_rankings.pug` — rewrite matchup display section
- Modify: `public/stylesheets/style.css` — add matchup card CSS

**Step 1: Add matchup card CSS**

Append to `style.css`:

```css
/*
  Head-to-Head Matchup Cards
*/

.matchups-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}

.matchup-card {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  border: 2px solid #555;
  background-image: linear-gradient(#161616, #0a0a0a);
  border-radius: 4px;
  overflow: hidden;
}

.matchup-team {
  padding: 12px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.matchup-team.home {
  justify-content: flex-end;
  text-align: right;
}

.matchup-team.away {
  justify-content: flex-start;
}

.matchup-team.winner {
  background: rgba(0, 183, 255, 0.08);
}

.matchup-team.winner .matchup-team-name {
  color: #00B7FF;
  font-weight: 600;
}

.matchup-team img {
  height: 24px;
  width: 24px;
}

.matchup-team-name {
  font-family: 'Montserrat', sans-serif;
  font-size: 1em;
}

.matchup-score {
  padding: 8px 15px;
  text-align: center;
  border-left: 1px solid #333;
  border-right: 1px solid #333;
  min-width: 80px;
}

.matchup-score-numbers {
  font-family: 'Roboto Mono', monospace;
  font-size: 1.1em;
  font-weight: 700;
}

.matchup-vs {
  font-size: 0.7em;
  opacity: 0.5;
  display: block;
}

.matchup-result {
  font-size: 0.7em;
  font-weight: 600;
  margin-top: 2px;
}

.matchup-bye {
  padding: 10px 15px;
  border: 2px solid #555;
  background-image: linear-gradient(#161616, #0a0a0a);
  border-radius: 4px;
  opacity: 0.6;
  text-align: center;
  font-style: italic;
}

.week-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 15px;
}

.week-selector button {
  border: 1px solid #555;
  background: transparent;
  color: #aaa;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.week-selector button:hover:not(:disabled) {
  background: rgba(255,255,255,0.05);
  color: #fff;
}

.week-selector button:disabled {
  opacity: 0.3;
  cursor: default;
}

.week-selector h1 {
  font-size: 1.2em;
}
```

**Step 2: Rewrite matchup section in `league_rankings.pug`**

Replace the current matchup display:

```pug
div(v-if="activity_report && activity_report.matchups").matchups-section
  div.title-bar
    h2.
      <i class="fas fa-trophy"></i>
      Matchup Results
  div.matchups-container
    div(v-for="m in activity_report.matchups")
      div(v-if="m.bye").matchup-bye
        | {{getTeamName(m.bye)}} — Bye Week
      div(v-else).matchup-card
        div.matchup-team.home(:class="{winner: m.winner === m.home}")
          span.matchup-team-name {{getTeamName(m.home)}}
          img(:src="getTeamIcon(m.home)")
        div.matchup-score
          span.matchup-vs VS
          div.matchup-score-numbers {{m.homeScore}} - {{m.awayScore}}
          div(v-if="m.winner").matchup-result
            | {{getTeamName(m.winner)}} wins!
          div(v-if="m.tie").matchup-result Tie!
        div.matchup-team.away(:class="{winner: m.winner === m.away}")
          img(:src="getTeamIcon(m.away)")
          span.matchup-team-name {{getTeamName(m.away)}}
```

Add `getTeamIcon` method to the Vue instance:

```javascript
getTeamIcon: function(teamId) {
  for (var x = 0; x < this.teams.length; x++) {
    if (this.teams[x].id == teamId) return '/images/icons/' + this.teams[x].icon + '.png';
  }
  return '';
},
```

**Step 3: Verify**

Visit `/leagues/{code}/rankings`. Confirm:
- Matchup cards show home team on left, away on right
- Score centered between them
- Winner side has blue tint and highlighted name
- Bye weeks show as dimmed italic text
- Week navigation still works

**Step 4: Commit**

```bash
git add views/league_rankings.pug public/stylesheets/style.css
git commit -m "feat: head-to-head matchup cards with winner highlighting"
```

---

### Task 6: Season Bracket View

Add a visual bracket showing the full season's matchup progression. This is a new section on the rankings page below the weekly view.

**Files:**
- Modify: `views/league_rankings.pug` — add bracket section
- Modify: `public/stylesheets/style.css` — add bracket CSS

**Step 1: Add bracket CSS**

Append to `style.css`:

```css
/*
  Season Bracket
*/

.bracket-section {
  margin-top: 30px;
}

.bracket-container {
  overflow-x: auto;
  padding: 15px;
  border: 2px solid #555;
  background-image: linear-gradient(#161616, #0a0a0a);
}

.bracket-weeks {
  display: flex;
  gap: 20px;
  min-width: max-content;
}

.bracket-week {
  min-width: 200px;
}

.bracket-week-label {
  font-size: 0.8em;
  text-transform: uppercase;
  opacity: 0.5;
  margin-bottom: 8px;
  text-align: center;
  font-family: 'Montserrat', sans-serif;
}

.bracket-matchup {
  border: 1px solid #444;
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
  animation: bracketFadeIn 0.4s ease-out both;
}

.bracket-matchup:nth-child(2) { animation-delay: 0.05s; }
.bracket-matchup:nth-child(3) { animation-delay: 0.1s; }
.bracket-matchup:nth-child(4) { animation-delay: 0.15s; }

@keyframes bracketFadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.bracket-team-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 6px;
  font-size: 0.85em;
  border-bottom: 1px solid #333;
}

.bracket-team-row:last-child {
  border-bottom: none;
}

.bracket-team-row.bracket-winner {
  background: rgba(0, 183, 255, 0.1);
}

.bracket-team-row.bracket-winner .bracket-team-name {
  color: #00B7FF;
  font-weight: 600;
}

.bracket-team-name {
  flex-grow: 1;
  font-family: 'Montserrat', sans-serif;
}

.bracket-team-score {
  font-family: 'Roboto Mono', monospace;
  font-weight: 700;
  min-width: 30px;
  text-align: right;
}

.bracket-bye {
  padding: 4px 8px;
  font-size: 0.8em;
  opacity: 0.4;
  font-style: italic;
  text-align: center;
}
```

**Step 2: Add bracket section to `league_rankings.pug`**

After the matchup results section, add:

```pug
div(v-if="activity_reports.length > 0").bracket-section
  div.title-bar
    h2.
      <i class="fas fa-sitemap"></i>
      Season Bracket
  div.bracket-container
    div.bracket-weeks
      div(v-for="(report, weekIndex) in activity_reports" :key="weekIndex").bracket-week
        div.bracket-week-label Week {{weekIndex + 1}}
        div(v-if="report.matchups")
          div(v-for="m in report.matchups" :key="m.home || m.bye")
            div(v-if="m.bye").bracket-matchup
              div.bracket-bye {{getTeamName(m.bye)}} — Bye
            div(v-else).bracket-matchup
              div.bracket-team-row(:class="{'bracket-winner': m.winner === m.home}")
                span.bracket-team-name {{getTeamName(m.home)}}
                span.bracket-team-score {{m.homeScore}}
              div.bracket-team-row(:class="{'bracket-winner': m.winner === m.away}")
                span.bracket-team-name {{getTeamName(m.away)}}
                span.bracket-team-score {{m.awayScore}}
        div(v-else)
          div.bracket-matchup
            div.bracket-bye Pending...
```

**Step 3: Verify**

Visit `/leagues/{code}/rankings`. Confirm:
- Season bracket appears below the weekly matchup cards
- Each week is a column with its matchups
- Winner highlighted in blue
- Scrolls horizontally for many weeks
- Matchups animate in with a fade

**Step 4: Commit**

```bash
git add views/league_rankings.pug public/stylesheets/style.css
git commit -m "feat: season bracket view with animated matchup cards"
```

---

### Task 7: Update Team Cards on Rankings and Teams Pages

Update the team display on `league_teams.pug` and `league_rankings.pug` to use the new compact card style from Task 2, and update the rankings team cards to show points more clearly.

**Files:**
- Modify: `views/league_teams.pug` — use new team-card and mini_player styles, add grid layout
- Modify: `views/league_rankings.pug` — update team-item to use compact card style with points
- Modify: `public/stylesheets/style.css` — add rankings-specific team card CSS

**Step 1: Add rankings team card CSS**

Append to `style.css`:

```css
/*
  Rankings Team Cards
*/

.rankings-teams {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ranking-card {
  border: 2px solid #555;
  background-image: linear-gradient(#161616, #0a0a0a);
  border-radius: 4px;
}

.ranking-card-head {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid #333;
}

.ranking-card-head img {
  height: 26px;
  width: 26px;
}

.ranking-card-head h2 {
  font-size: 1.05em;
  flex-grow: 1;
}

.ranking-points {
  display: flex;
  gap: 15px;
  align-items: center;
}

.ranking-points-total {
  font-family: 'Roboto Mono', monospace;
  font-weight: 700;
  font-size: 1.1em;
}

.ranking-points-week {
  font-size: 0.85em;
  opacity: 0.6;
}

.ranking-roster {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 2px;
  padding: 6px;
}

.ranking-player {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
}

.ranking-player img {
  height: 18px;
  width: 18px;
}

.ranking-player .rp-name {
  flex-grow: 1;
  font-size: 0.85em;
}

.ranking-player .rp-points {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.85em;
  font-weight: 600;
}

.ranking-player .rp-title {
  font-size: 0.75em;
  opacity: 0.5;
  margin-left: 4px;
}

.ranking-player.absent {
  opacity: 0.25;
}
```

**Step 2: Update `league_teams.pug`**

Replace the team list with a grid:

```pug
extends layout

block content
  div#teams
    div#content
      draft_info(
        v-bind:league_info="league_info",
        v-bind:status_slug="statusSlug",
        current_page="teams"
      )

      div.teams-grid
        team-item(
          v-for="(team, index) in teams"
          v-bind:team="team"
          v-bind:index="index"
        )
```

Use the same `team-card` component from Task 2 (same `team-item` and `mini_player` definitions), plus the compact `draft_info` from Task 1. Add `statusSlug` computed.

**Step 3: Update `league_rankings.pug` team-item**

Rewrite the team-item component:

```javascript
Vue.component('team-item', {
  props: ['team', 'team_index', 'activity_report', 'total_points', 'get_index', 'highest_points'],
  template: `
  <div class="ranking-card" :style="'border-color:' + (team.color2 || '#555')">
    <div class="ranking-card-head">
      <img :src="'/images/icons/'+team.icon+'.png'">
      <h2 :style="'color:'+team.color2">{{team.name}}</h2>
      <div class="ranking-points">
        <span class="ranking-points-week">{{Math.round(activity_report.data[get_index(team.id)].total_points)}} pts this week</span>
        <span class="ranking-points-total" :style="'color:'+team.color2">
          <i class="fas fa-star"></i> {{total_points(get_index(team.id))}}
        </span>
      </div>
    </div>
    <div class="ranking-roster">
      <mini_player
        v-for="(player, index) in team.drafted_players"
        v-bind:player="player"
        v-bind:team_activity="activity_report.data[get_index(team.id)].players"
        v-bind:index="index"
        v-bind:team_color="team.color2"
        v-bind:highest_points="highest_points">
    </div>
  </div>
  `
})
```

Update mini_player for rankings to use compact layout:

```javascript
Vue.component('mini_player', {
  props: ['player', 'team_activity', 'team_color', 'highest_points'],
  template: `
  <div v-if="team_activity[player.name] && team_activity[player.name].points.total > 0" class="ranking-player">
    <img :src="'/images/classes/'+player.class+'.png'">
    <span :class="'rp-name '+player.class">{{player.name}}</span>
    <span class="rp-title">{{highest_points(team_activity[player.name].points)}}</span>
    <span class="rp-points" :style="'color:'+team_color">{{team_activity[player.name].points.total}}</span>
  </div>
  <div v-else class="ranking-player absent">
    <img :src="'/images/classes/'+player.class+'.png'">
    <span :class="'rp-name '+player.class">{{player.name}}</span>
    <span class="rp-points">Absent</span>
  </div>
  `
})
```

**Step 4: Verify**

Visit `/leagues/{code}/teams` and `/leagues/{code}/rankings`. Confirm:
- Teams page uses grid cards with compact header
- Rankings page shows team cards with points prominently displayed
- Player roster in rankings uses compact rows with points and titles
- Absent players dimmed

**Step 5: Commit**

```bash
git add views/league_teams.pug views/league_rankings.pug public/stylesheets/style.css
git commit -m "feat: compact team cards on teams page, improved rankings layout"
```

---

### Task 8: Global Navigation + Layout Polish

Update the global header layout and add breadcrumbs within league pages.

**Files:**
- Modify: `views/layout.pug` — clean up header layout, improve nav styling
- Modify: `public/stylesheets/style.css` — updated header CSS

**Step 1: Add header CSS**

Append to `style.css`:

```css
/*
  Updated Global Header
*/

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

#navigation {
  display: flex;
  gap: 15px;
}

#navigation a {
  text-decoration: none;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.9em;
  padding: 4px 10px;
  border-radius: 4px;
  transition: background 0.15s;
}

#navigation a:hover {
  background: rgba(255,255,255,0.08);
}

.user-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-controls a {
  font-size: 0.85em;
}
```

**Step 2: Update `layout.pug` header**

Replace the header section:

```pug
header
  div#navigation
    a(href="/leagues").
      <i class="fas fa-book"></i> All Leagues
    a(href="/leagues/create").
      <i class="fas fa-plus"></i> New League

  div.user-controls
    div#logged-in
      span
        p#username
      a(href="/logout").
        logout <i class="fas fa-sign-out-alt"></i>
    div#logged-out
      a(href="/login").
        login <i class="fas fa-sign-in-alt"></i>
```

Remove the `br` between nav links. Use flexbox instead of float for login/logout.

**Step 3: Remove old float-based CSS**

Remove or override the old `#logged-in, #logged-out { float: right; }` rules.

**Step 4: Verify**

Visit any page. Confirm:
- Header shows nav links on left, login/user on right
- Clean horizontal layout, no broken wrapping
- All pages still render correctly

**Step 5: Commit**

```bash
git add views/layout.pug public/stylesheets/style.css
git commit -m "feat: clean up global header layout with flexbox"
```

---

### Task 9: Smoke Test All Views

Final verification pass across all views to catch any styling regressions.

**Step 1: Manual verification checklist**

Visit each page and verify no regressions:

1. `/` — Home page, welcome text renders
2. `/leagues` — Event poster cards in grid
3. `/leagues/create` — Create form still works (unchanged)
4. `/leagues/{code}` — Compact header, description in body, team grid cards, draft progress, standings, season info
5. `/leagues/{code}/teams` — Compact header (Teams active), team grid cards
6. `/leagues/{code}/rankings` — Compact header (Rankings active), team ranking cards, h2h matchup cards, season bracket
7. `/proplayers/{code}` — Compact header (Players active), requirements tracker, dense player table, filters, pagination
8. `/leagues/{code}/newTeam` — Create team form still works (unchanged)
9. `/login` — Login page renders (unchanged)

**Step 2: Run existing tests**

```bash
npm test
```

All tests should still pass (UI changes don't affect backend tests).

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: ui polish pass and regression fixes"
```
