# Polish & Ship Improvements Design

**Date:** 2026-03-02
**Branch:** polish-and-ship

## Overview

Ten improvements identified during codebase review, addressing security, code quality, validation, UI polish, and maintainability.

## 1. Security Fix — Restore Admin Check on `generateReport`

Restore the login + admin authorization check removed from `POST /api/:leagueID/generateReport` in `routes/draft.js`. Without this, any unauthenticated user can trigger expensive WarcraftLogs API calls.

## 2. Error Handling — Centralized Middleware

Add Express error-handling middleware in `app.js`:
- Logs errors with route context (method, path, params)
- Returns 500 JSON for API routes (`/api/...`), redirects to error page for page routes
- Replace silent `.catch(() => res.json([]))` patterns across routes with `next(err)` calls

## 3. Remove Debug `console.log`

Clean up stray `console.log(mini_player)` in `routes/league.js` and any other debug logs left in production code.

## 4. Input Validation (Server-Side)

Add validation for numeric inputs in league creation/settings:
- `season_length`: positive integer, 1–52
- `rounds`: positive integer, 1–20
- `req_dps`, `req_healers`, `req_tanks`: non-negative integers, max 20
- Return 400 with clear error message on invalid input

## 5. Client-Side Form Validation

Add HTML5 `required`, `min`, `max`, `type="number"` attributes to create league and create team forms. Browser-native validation, no extra JS.

## 6. CSS Organization

Add section comment headers to `style.css` (Layout, Navigation, Cards, Forms, League Pages, Draft, Brackets, etc.) to make the ~1,800-line file navigable. No file splitting — avoids build tooling changes.

## 7. Extract Inline Vue.js

Move largest inline `<script>` blocks from `league.pug` and `proplayers.pug` into separate `.js` files under `public/javascripts/`. Reference with `script(src=...)`. Makes them cacheable and easier to maintain.

## 8. Mobile Responsiveness

Audit new card layouts and bracket view for small screens. Add CSS media queries for bracket horizontal scroll, card grids, and table layouts.

## 9. Loading States

Add CSS spinner class and `v-if="loading"` patterns in Vue components for API-driven views (player pool, report generation, draft actions).

## 10. Commit Strategy

Commit current uncommitted work first to preserve it, then commit each improvement as a separate clean commit.
