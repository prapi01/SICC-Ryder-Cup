# sicc-ryder-cup — Main Design (DESIGN.md)

**Status:** Active (Firebase web app) · **Latest release:** Version 4.0.0 (2026-08-10) · **Updated:** 2026-08-14
**Full design:** `Design Documents/SICC Ryder Cup Complete Design Documentation.md`.

## Stack
- Firebase (Hosting, Firestore, Storage); plain HTML + JS per page (no framework).
- Live site: https://sicc-ryder-cup.pages.dev (verified in v4.0.0 production QA).
- Repo: https://github.com/prapi01/sicc-ryder-cup · Root folder: `~/Developer/W/sicc-ryder-cup`

## Core architecture
- One page per screen (`index.html`, `real-game.html`, `view-history.html`, `post-game.html`,
  `hcp-adjust.html`, `player-management.html`, `admin.html`, `setup-game.html`, etc.); shared
  logic is isolated in `js/*.js` modules (e.g. `game-scorecard.js`, `real-game-save.js`,
  `sign-card.js`, `session.js`, `history-record.js`, `util-*` tools).
- Firestore for games/scores/history; Storage for photos; real-time sync for live scoring.
- Automated QA harness under `automated-tests/` (Playwright): Step Runner (5-window live harness),
  real-data / shotgun / rejoin / cascade scenarios, and production regression tools.

## Key design facts / decisions
- **2026-08-10 (v4.0.0) — "Team One" rename:** the second team displays as **Team One**
  (short "One" / "O") throughout the UI (player management, team selectors, view history TR header,
  T-2/Strk margins, winner text "Team One Wins!"). Display-only — internal values stay Team A/B,
  so no data migration (fully backward compatible).
- **2026-08-10 — History record integrity:** auto-created `_H` history records include
  `adjustedHandicaps` (computed at signing time), `finalResults` (`teamAScore`/`teamBScore`/`winner`/
  `winnerText`), `version: 3`, `schema: "v3_strings"`, `archiveId`. Verified byte-for-byte against the
  real SICC Bukit record `GM_260606_1010_13_H` (final 14 : 5).
- **2026-08-10 — Game completion:** restored `submitSignature` (F2 single-writer triggers
  `saveGameToHistory` after both flights sign); celebration photo restored and the default photo
  loads on all devices at game start (scorers + viewer).
- **2026-08-10 — Storage rules fix** shipped with the Team One rename.
- **2026-08-14 — Version / cache-busting alignment (system integrity):** `js/versions.json`
  is the single source of truth for the `load-game.js` universal loader (used by `real-game.html`).
  Aligned it with every JS file's header/footer `VERSION:` and every HTML `<script …?v=>` cache-busting
  token (previously inconsistent — some pages had stale `?v=` that could serve old cached JS, and 7 pages
  had no cache-busting at all). `index.html` on-screen version bumped 3.67 → 4.00 to match the 4.0.0
  release. Display/comment-only — **no logic changed**.
- (Older decisions: see `RELEASE_NOTES.md` and the full design doc.)

## Related docs
- `Design Documents/SICC Ryder Cup Complete Design Documentation.md` — full design
- `Project Documentations/HANDOVER.md` — running project log
- `RELEASE_NOTES.md` — release history (current: Version 4.0.0)
- `Project Documentations/APP Development Rules.md` — coding / UI rules
- `.github/instructions/rules.instructions.md` — assistant working rules
