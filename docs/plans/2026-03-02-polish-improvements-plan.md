# Polish & Ship Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address 10 quality, security, and polish improvements to prepare WoWDraft for production.

**Architecture:** Incremental improvements to existing Express/Pug/Vue stack. Centralized error middleware in app.js, server-side validation in route handlers, extracted Vue components as static JS files, CSS section organization, and responsive/loading CSS additions.

**Tech Stack:** Express.js, Pug, Vue 2, MongoDB, CSS3

---

### Task 1: Commit Current Work

Preserve all uncommitted work before making improvement changes.

**Files:**
- All currently modified files (14 files + 1 untracked)

**Step 1: Stage and commit**

```bash
git add public/stylesheets/style.css routes/draft.js routes/league.js routes/leagues.js routes/players.js services/playerpool.js views/create_league.pug views/create_team.pug views/layout.pug views/league.pug views/league_rankings.pug views/league_teams.pug views/leagues.pug views/proplayers.pug views/league_settings.pug docs/plans/2026-03-02-polish-improvements-design.md docs/plans/2026-03-02-polish-improvements-plan.md
git commit -m "feat: UI overhaul — settings page, form redesigns, player table, and CSS additions"
```

**Step 2: Verify**

```bash
git status
```
Expected: clean working tree

---

### Task 2: Restore Admin Check on generateReport

**Files:**
- Modify: `routes/draft.js:105-110`
- Test: `test/league.test.js` (existing tests should still pass)

**Step 1: Write the fix**

Replace the current `generateReport` route (lines 105-110 in `routes/draft.js`):

```javascript
// API: Generate report (admin only)
router.post('/api/:leagueID/generateReport', function (req, res) {
  if (!req.session.loggedin) return res.status(403).json({ error: 'Not logged in' });

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
    .catch(() => res.status(404).json({ error: 'League not found' }));
});
```

**Step 2: Run tests**

```bash
npx mocha --timeout 10000
```
Expected: all 31 tests pass

**Step 3: Commit**

```bash
git add routes/draft.js
git commit -m "fix: restore admin authorization check on generateReport endpoint"
```

---

### Task 3: Add Centralized Error Handling Middleware

**Files:**
- Modify: `app.js:66-76` (replace existing error handler)
- Modify: `routes/leagues.js` (replace silent catches with next(err))
- Modify: `routes/draft.js` (replace silent catches with next(err))
- Modify: `routes/players.js` (replace silent catches with next(err))

**Step 1: Update the error handler in app.js**

Replace the existing error handler (lines 70-76) with:

```javascript
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
```

**Step 2: Update route error handlers**

In `routes/leagues.js`, replace all silent catches. The pattern is:
- `.catch(() => res.redirect('/404'))` → `.catch((err) => next(err))`
- `.catch(() => res.json([]))` → `.catch((err) => next(err))`
- `.catch((err) => res.json({ err }))` → `.catch((err) => next(err))`

Add `next` parameter to all route handlers that need it. Specifically update these routes:
- `GET /` (line 11) — add next param, `.catch` on line 19
- `GET /api/guilds/search` (line 32) — both `.catch` blocks (lines 52, 69)
- `GET /:leagueID` (line 74) — `.catch` on line 87
- `GET /:leagueID/teams` (line 91) — `.catch` on line 103
- `GET /:leagueID/newTeam` (line 107) — `.catch` on line 117
- `GET /:leagueID/rankings` (line 121) — `.catch` on line 133
- `GET /api/:leagueID` (line 137) — `.catch` on line 140
- `GET /api/:leagueID/teams` (line 144) — `.catch` on line 147
- `POST /api/:leagueID/newTeam` (line 214) — `.catch` on line 227
- `POST /api/:leagueID/activity_report` (line 231) — `.catch` on line 242
- `POST /api/:leagueID/startSeason` (line 246) — `.catch` on line 261
- `GET /api/:leagueID/standings` (line 265) — `.catch` on line 274
- `GET /:leagueID/settings` (line 278) — `.catch` on line 290

In `routes/draft.js`:
- `GET /:leagueID/start` (line 8) — `.catch` on line 19
- `GET /:leagueID/skip` (line 23) — `.catch` block lines 36-39
- `GET /api/:leagueID/draftInfo` (line 43) — `.catch` on line 46
- `POST /api/:leagueID/draftPlayer` (line 50) — `.catch` block lines 99-101

In `routes/players.js`:
- `GET /:leagueID` (line 7) — `.catch` on line 30
- `GET /api/:leagueID/:tag/:page` (line 55) — `.catch` on line 63
- `GET /api/:leagueID/:tag/search/:name` (line 67) — `.catch` on line 75
- `GET /api/:leagueID/:tag/guild/:guild/:page` (line 79) — `.catch` on line 88

**Step 3: Run tests**

```bash
npx mocha --timeout 10000
```
Expected: all tests pass

**Step 4: Commit**

```bash
git add app.js routes/leagues.js routes/draft.js routes/players.js
git commit -m "feat: add centralized error middleware, replace silent catches with next(err)"
```

---

### Task 4: Remove Debug console.log Statements

**Files:**
- Modify: `routes/league.js:173` — remove `console.log(mini_player)`
- Modify: `views/league.pug:342-343` — remove `console.log(roles_drafted)` and `console.log(reqs)`
- Modify: `views/league_rankings.pug:187` — remove `console.log(league)`
- Modify: `public/javascripts/identity.js:6,9` — remove debug logs

Keep legitimate logs:
- `app.js:81` (`console.log('App ready')`) — startup, keep
- `db.js:13` (`console.log('Connected to Database')`) — startup, keep
- `services/scheduler.js` — tagged `[Scheduler]` logs, keep
- `scripts/seed.js` — seed script output, keep

**Step 1: Remove each debug log**

In `routes/league.js:173`, delete the line:
```javascript
		console.log(mini_player);
```

In `views/league.pug`, delete lines 342-343:
```javascript
			  		console.log(roles_drafted);
			  		console.log(reqs);
```

In `views/league_rankings.pug:187`, delete:
```javascript
		console.log(league);
```

In `public/javascripts/identity.js`, remove the two console.log lines (lines 6 and 9).

**Step 2: Run tests**

```bash
npx mocha --timeout 10000
```

**Step 3: Commit**

```bash
git add routes/league.js views/league.pug views/league_rankings.pug public/javascripts/identity.js
git commit -m "chore: remove debug console.log statements from production code"
```

---

### Task 5: Add Server-Side Input Validation

**Files:**
- Modify: `routes/leagues.js` — POST `/api/create` (around line 151) and POST `/api/:leagueID/settings` (around line 294)

**Step 1: Write the failing test**

Create test file `test/validation.test.js`:

```javascript
const { expect } = require('chai');

describe('Input validation helpers', function () {
  // We'll test the validation logic inline since routes need DB
  // These test the validation bounds that the routes enforce

  function validateLeagueInput(body) {
    var errors = [];
    var season_length = parseInt(body.season_length);
    var rounds = parseInt(body.rounds);
    var req_dps = parseInt(body.req_dps);
    var req_healers = parseInt(body.req_healers);
    var req_tanks = parseInt(body.req_tanks);

    if (isNaN(season_length) || season_length < 1 || season_length > 52) errors.push('season_length must be 1-52');
    if (isNaN(rounds) || rounds < 1 || rounds > 20) errors.push('rounds must be 1-20');
    if (isNaN(req_dps) || req_dps < 0 || req_dps > 20) errors.push('req_dps must be 0-20');
    if (isNaN(req_healers) || req_healers < 0 || req_healers > 20) errors.push('req_healers must be 0-20');
    if (isNaN(req_tanks) || req_tanks < 0 || req_tanks > 20) errors.push('req_tanks must be 0-20');
    return errors;
  }

  it('should accept valid input', function () {
    var errors = validateLeagueInput({
      season_length: '8', rounds: '10', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.have.length(0);
  });

  it('should reject negative season_length', function () {
    var errors = validateLeagueInput({
      season_length: '-1', rounds: '10', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.include('season_length must be 1-52');
  });

  it('should reject rounds over 20', function () {
    var errors = validateLeagueInput({
      season_length: '8', rounds: '99', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.include('rounds must be 1-20');
  });

  it('should reject non-numeric input', function () {
    var errors = validateLeagueInput({
      season_length: 'abc', rounds: '10', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.include('season_length must be 1-52');
  });
});
```

**Step 2: Run test to verify it passes**

```bash
npx mocha test/validation.test.js --timeout 10000
```
Expected: 4 passing

**Step 3: Add validation to POST /api/create in routes/leagues.js**

After `if (!req.session.loggedin) return res.redirect('/403');` (line 152), add:

```javascript
  // Validate numeric inputs
  var season_length = parseInt(req.body.season_length);
  var rounds = parseInt(req.body.rounds);
  var req_dps = parseInt(req.body.req_dps);
  var req_healers = parseInt(req.body.req_healers);
  var req_tanks = parseInt(req.body.req_tanks);

  if (isNaN(season_length) || season_length < 1 || season_length > 52) return res.status(400).json({ error: 'Season length must be 1-52 weeks' });
  if (isNaN(rounds) || rounds < 1 || rounds > 20) return res.status(400).json({ error: 'Rounds must be 1-20' });
  if (isNaN(req_dps) || req_dps < 0 || req_dps > 20) return res.status(400).json({ error: 'DPS requirement must be 0-20' });
  if (isNaN(req_healers) || req_healers < 0 || req_healers > 20) return res.status(400).json({ error: 'Healer requirement must be 0-20' });
  if (isNaN(req_tanks) || req_tanks < 0 || req_tanks > 20) return res.status(400).json({ error: 'Tank requirement must be 0-20' });
```

**Step 4: Add validation to POST /api/:leagueID/settings in routes/leagues.js**

Inside the settings update handler, validate `season_length` before saving (around the `parseInt` on line 309). Replace with:

```javascript
          updates[field] = field === 'season_length'
            ? (function() {
                var val = parseInt(req.body[field]);
                if (isNaN(val) || val < 1 || val > 52) return league.season_length;
                return val;
              })()
            : req.body[field];
```

**Step 5: Run all tests**

```bash
npx mocha --timeout 10000
```
Expected: all tests pass (31 existing + 4 new = 35)

**Step 6: Commit**

```bash
git add routes/leagues.js test/validation.test.js
git commit -m "feat: add server-side validation for numeric league inputs"
```

---

### Task 6: Add Client-Side Form Validation (HTML5 Attributes)

**Files:**
- Modify: `views/create_league.pug` — add min/max/required to numeric inputs
- Modify: `views/create_team.pug` — ensure required on team name

**Step 1: Verify existing attributes**

`create_league.pug` already has most HTML5 validation attributes (`required`, `min`, `max`, `type='number'`). Verify and add any missing ones:

- Line 65: `req_tanks` — already has `min="0" max="10"` ✓
- Line 68: `req_healers` — already has `min="0" max="10"` ✓
- Line 71: `req_dps` — already has `min="0" max="10"` ✓
- Line 76: `rounds` — already has `:min="totalRequired" max="15" required` ✓
- Line 79: `season_length` — already has `min="2" max="20" required` ✓

`create_team.pug`:
- Line 22: team name — already has `required` ✓
- Needs `maxlength` validation for motto ✓ (already has `maxlength="15"`)

The forms already have good client-side validation. This task is already done — verify and skip.

**Step 2: Commit (only if changes needed)**

If no changes needed, skip this task.

---

### Task 7: Extract Shared draft_info Component to JS File

The `draft_info` Vue component is duplicated in 5 templates: `league.pug`, `proplayers.pug`, `league_rankings.pug`, `league_teams.pug`, and `league_settings.pug`. Extract it once.

**Files:**
- Create: `public/javascripts/components/draft-info.js`
- Modify: `views/league.pug` — remove inline draft_info component, add script tag
- Modify: `views/proplayers.pug` — remove inline draft_info component, add script tag
- Modify: `views/league_rankings.pug` — remove inline draft_info component, add script tag
- Modify: `views/league_teams.pug` — remove inline draft_info component, add script tag
- Modify: `views/league_settings.pug` — remove inline draft_info component, add script tag
- Modify: `views/layout.pug` — add script tag for shared component

**Step 1: Create the shared component file**

Create `public/javascripts/components/draft-info.js`:

```javascript
Vue.component('draft_info', {
  props: ['league_info', 'status_slug', 'current_page', 'is_admin'],
  template:
    '<div class="league-header">' +
      '<div class="league-header-top">' +
        '<img class="league-header-icon" :src="\'/images/league_icons/\' + league_info.icon">' +
        '<h1 class="league-header-name" :style="\'color:\'+league_info.color1">{{league_info.name}}</h1>' +
        '<span class="status-badge" :class="status_slug">{{league_info.status}}</span>' +
      '</div>' +
      '<div class="league-header-meta">' +
        '<span class="meta-chip">{{league_info.game_version === \'classic\' ? \'Classic\' : \'Retail\'}}</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">{{(league_info.region || \'us\').toUpperCase()}}</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">{{league_info.style || \'Snake\'}} Draft</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">{{league_info.report_day || \'Monday\'}} reports</span>' +
        '<span class="meta-sep">&middot;</span>' +
        '<span class="meta-chip">Org: {{league_info.admin.name}}</span>' +
      '</div>' +
      '<div class="league-header-nav">' +
        '<a :href="\'/leagues/\' + league_info.code" :class="{active: current_page === \'home\'}"><i class="fas fa-home"></i> Home</a>' +
        '<a :href="\'/leagues/\' + league_info.code + \'/teams\'" :class="{active: current_page === \'teams\'}"><i class="fas fa-flag"></i> Teams</a>' +
        '<a :href="\'/leagues/\' + league_info.code + \'/rankings\'" :class="{active: current_page === \'rankings\'}"><i class="fas fa-calendar-alt"></i> Rankings</a>' +
        '<a :href="\'/proplayers/\' + league_info.code" :class="{active: current_page === \'players\'}"><i class="fas fa-list"></i> Players</a>' +
        '<a :href="\'/leagues/\' + league_info.code + \'/settings\'" :class="{active: current_page === \'settings\'}"><i class="fas fa-cog"></i> {{is_admin ? \'Settings\' : \'Info\'}}</a>' +
      '</div>' +
    '</div>'
});
```

**Step 2: Add script tag to layout.pug**

In `views/layout.pug`, after the Vue script tag (line 6), add:

```pug
		script(src='/javascripts/components/draft-info.js')
```

**Step 3: Remove the inline draft_info component from each view**

Remove the `Vue.component('draft_info', {...})` block from:
- `views/league.pug` — lines 134-163
- `views/proplayers.pug` — lines 103-132
- `views/league_rankings.pug` — lines 132-161
- `views/league_teams.pug` — lines 58-87
- `views/league_settings.pug` — lines 105-134

**Step 4: Verify the app works**

```bash
npm start &
# Check that pages still load correctly
curl -s http://localhost:3000/leagues | head -5
kill %1
```

**Step 5: Run tests**

```bash
npx mocha --timeout 10000
```

**Step 6: Commit**

```bash
mkdir -p public/javascripts/components
git add public/javascripts/components/draft-info.js views/layout.pug views/league.pug views/proplayers.pug views/league_rankings.pug views/league_teams.pug views/league_settings.pug
git commit -m "refactor: extract shared draft_info component to external JS file"
```

---

### Task 8: Organize CSS with Section Headers

**Files:**
- Modify: `public/stylesheets/style.css`

**Step 1: Add descriptive labels to existing empty comment blocks**

The CSS already has `/* */` dividers. Replace them with descriptive section headers. The main sections based on the selectors that follow each divider:

Replace each empty `/* */` comment with a descriptive header matching this format:
```css
/* ============================================
   Section Name
   ============================================ */
```

Sections (by approximate line number):
- Line 1: `Variables & Reset` (`:root`, `*`, `body`)
- Line 79: `Layout & Navigation` (`header`, `footer`, `#logged-in`)
- Line 101: `Legacy Player Cards` (`.player`, `.parseBadge`)
- Line 257: `WoW Class Colors` (`.druid`, `.hunter`, etc.)
- Line 311: `Legacy Team Cards` (`.team`, `.team_head`)
- Line 380: `Draft UI` (`.draft`, `.picks`, `.pick`)
- Line 651: `Compact League Header` (already labeled)
- Line 741: `Team Cards Grid` (already labeled)
- Line 835: `Dense Player Table` (already labeled)
- Line 899: `Player Class Text Colors` (already labeled)
- Line 922: `Player Table Enhancements` (already labeled)
- Lines 972+: Continue labeling remaining unlabeled sections

For the unlabeled `/* */` blocks in the newer CSS (lines 972-2603), read the selectors after each block to determine the correct label.

**Step 2: Commit**

```bash
git add public/stylesheets/style.css
git commit -m "chore: add descriptive section headers to style.css for navigability"
```

---

### Task 9: Add Loading States

**Files:**
- Modify: `public/stylesheets/style.css` — add spinner CSS class
- Modify: `views/league.pug` — add loading state to generateReport button (already has `generating` state)
- Modify: `views/proplayers.pug` — add loading indicator when fetching players

**Step 1: Add spinner CSS**

Add to `public/stylesheets/style.css`:

```css
/* ============================================
   Loading States
   ============================================ */

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #00B7FF;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  opacity: 0.6;
}
```

**Step 2: Add loading state to proplayers.pug**

In `views/proplayers.pug`, add a `loading` data property (set to `true` initially in the Vue data), and wrap the player table with `v-if="!loading"`. Add a loading overlay `v-if="loading"`.

In the Vue data object, add:
```javascript
loading: true,
```

In each fetch method (`fetchData`, `fetchPlayer`, `fetchGuild`), set `self.loading = true` before fetch and `self.loading = false` in the `.then()`.

In the template, before the player table:
```pug
			div.loading-overlay(v-if="loading")
				div.loading-spinner
```

**Step 3: Commit**

```bash
git add public/stylesheets/style.css views/proplayers.pug
git commit -m "feat: add loading spinner for player table fetches"
```

---

### Task 10: Mobile Responsiveness

**Files:**
- Modify: `public/stylesheets/style.css` — add media queries

**Step 1: Add responsive breakpoints**

Add to the end of `public/stylesheets/style.css`:

```css
/* ============================================
   Mobile Responsiveness
   ============================================ */

@media (max-width: 768px) {
  /* League header stacks vertically */
  .league-header-top {
    flex-wrap: wrap;
  }

  .league-header-meta {
    flex-wrap: wrap;
    gap: 4px;
  }

  .league-header-nav {
    flex-wrap: wrap;
    gap: 0;
  }

  .league-header-nav a {
    font-size: 0.8em;
    padding: 6px 8px;
  }

  /* Team card grid goes single column */
  .teams-grid {
    grid-template-columns: 1fr;
  }

  /* League card grid goes single column */
  .league-cards-grid {
    grid-template-columns: 1fr;
  }

  /* Create league layout stacks */
  .create-league-layout,
  .create-team-layout {
    flex-direction: column;
  }

  .create-league-preview {
    order: -1;
  }

  .preview-sticky {
    position: static;
  }

  /* Player table: hide DPS column on mobile */
  .player-table .dps-value {
    display: none;
  }

  /* Bracket scrolls horizontally (already does, ensure min-width) */
  .bracket-weeks {
    min-width: 600px;
  }

  /* Matchup cards stack */
  .matchup-card {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  #content {
    padding: 8px;
  }

  header {
    padding: 10px 15px;
  }

  .league-header-name {
    font-size: 1.1em;
  }

  .form-section {
    padding: 10px;
  }
}
```

**Step 2: Run tests**

```bash
npx mocha --timeout 10000
```

**Step 3: Commit**

```bash
git add public/stylesheets/style.css
git commit -m "feat: add mobile responsive breakpoints for league pages"
```

---

## Summary of Tasks

| # | Task | Files | Type |
|---|------|-------|------|
| 1 | Commit current work | all modified | git |
| 2 | Restore admin check on generateReport | routes/draft.js | security fix |
| 3 | Centralized error middleware | app.js, routes/*.js | error handling |
| 4 | Remove debug console.log | routes/league.js, views/*.pug, identity.js | cleanup |
| 5 | Server-side input validation | routes/leagues.js, test/validation.test.js | validation |
| 6 | Client-side form validation | views/create_*.pug | validation (verify only) |
| 7 | Extract shared draft_info component | public/js/components/*, views/*.pug, layout.pug | refactor |
| 8 | CSS section headers | style.css | organization |
| 9 | Loading states | style.css, proplayers.pug | UX |
| 10 | Mobile responsiveness | style.css | UX |
