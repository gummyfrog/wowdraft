# UI Overhaul Design

## Philosophy

Tight, information-dense, fun. Abuse grids and columns. Class colors and icons give players personality. Leagues feel like events. Incremental approach — one view at a time, same Pug/Vue 2/CSS stack.

## 1. League Header (all league sub-pages)

Replace the current tall `draft_info` component banner with a compact bar reused on all league pages (home, teams, rankings, players).

- **Row 1**: 32px league icon (circle) + league name (h1 in league color) + status badge (colored pill: Active, Setting Up, Drafted, etc.)
- **Row 2**: Metadata chips separated by `·` — server, faction, draft style, report day, week number (if active season), organizer
- **Row 3**: Nav tabs — Home | Teams | Rankings | Players — with active state highlighting current page
- Description moves to the league home page body, not the header
- The `draft_info` Vue component is gutted to just this presentational header
- "Start Drafting" and "Register Your Team" CTAs move to league home body

## 2. Draft Experience

### Requirements Tracker

Visible during draft (especially when it's your turn):
- Shows unfilled role slots: "Need: 1 Tank, 2 DPS"
- Filled slots show the drafted player name + class icon
- Updates live as players are drafted

### Player Table

Dense table rows replacing the current tall cards:
- **Class icon** (existing 32px class images)
- **Name in class color** (gold for paladin, blue for mage, etc.)
- **Guild** as a visible column
- **Role badge** — small colored pill: DPS / Tank / Healer
- **Avg parse** — color-coded WCL-style (gray < 25, green < 50, blue < 75, purple < 95, orange < 99, gold >= 99)
- **Active/Inactive** — inactive rows dimmed opacity + strikethrough, not just a tiny badge
- **Draft button** on the right (only when it's your turn)
- Sortable by any column
- Role filter tabs at top (All / DPS / Tanks / Healers)
- Guild filter dropdown (players are guild-scoped)
- Draft action gets a small CSS animation/flash on success

## 3. Team Cards (league home)

Replace full-width stacked blocks with a 2-3 column CSS grid of compact cards:
- Team icon + name (team color) + manager name
- Record badge if season is active (e.g. "3W-1L")
- Roster list: class icon + class-colored name + role icon per player
- Unfilled roster slots shown as dim "Empty" placeholders during draft phase
- Card border/accent uses the team's custom color

## 4. Leagues Listing

Compact event-poster cards in a grid (not a table — flashy, fun):
- Faction banner image as short background strip (existing banner_Orc.png etc.)
- League name in the league's custom color, overlaid on the banner
- Status badge, team count (e.g. "4/6 teams"), draft style
- Organizer name small at bottom
- Whole card is clickable to enter the league

## 5. Rankings & Matchups

### Weekly View — Head-to-Head Cards

Each matchup as a horizontal card:
- Team A on the left, score in the center, Team B on the right
- Winner side highlighted/glowing
- Stacked vertically for the week
- Per-player breakdown expandable within each matchup

### Season Bracket View

Visual bracket showing all weeks' matchups connected:
- Results animate in on load (CSS animations)
- Week navigation (prev/next) to browse results
- Full season progression visible

## 6. Navigation

- League sub-nav pulled out of Vue component into a proper tab bar in the compact header
- Global header: "All Leagues" + "New League" stay
- Add breadcrumb showing current league name when inside a league page
- Active tab highlighted on current page

## Cross-Cutting

- Existing dark theme, WoW class colors, font stack (Montserrat, Open Sans) preserved
- Incremental: each view is an independent task
- Wowhead assets available for spec icons or additional art if needed
- No new JS dependencies
- Same Pug templates + Vue 2 inline components + CSS approach
