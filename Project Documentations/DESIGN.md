# sicc-ryder-cup — Main Design (DESIGN.md)

**Status:** Active (Firebase web app) · **Latest release:** Version 4.0.0 (2026-08-10) · **Updated:** 2026-10-30
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
- **2026-10-29 — Match-day flow verification + test tooling:** the full production suite was run
  green before the 2026-10-31 game (see HANDOVER "Technical findings"). New read-only tool
  `automated-tests/tools/verify-ui-surfaces.js` covers the admin + viewer/history surfaces.
  `deleteTestGame()` now removes both the `scheduledGames` doc and the `historyGames/<gameId>_H`
  archive. Recorded nuance: Firestore runs **online-only** (no offline persistence), so a scorer
  tab closed mid-save can lose a not-yet-ACKed write (open question in HANDOVER). **No app logic
  changed.**
- **2026-10-30 — Celebration-photo upload pipeline (iPhone Shortcut + a-Shell): root cause found.**
  The shortcut's `Receive Images` action has **Select Multiple** on; the "Save File → a-Shell,
  Subpath `C.jpg`" action then saves the image **into a folder named `C.jpg`** instead of writing a
  file of that name, so the sync script's `[ -f ~/Documents/C.jpg ]` test fails, the script aborts
  before `add`/`commit`/`push`, and nothing reaches GitHub (last celebration commit `777fdc9`,
  2026-08-09). Confirmed on the 21:26 attempt: `IMG_4343.jpeg` was re-written *inside* the folder.
  **Superseded 2026-10-30 — the whole a-Shell path was abandoned (see the redesign entry below).** The
  `Select Multiple OFF` rule only ever masked the defect; the true cause is that the Save action's
  `WFFileDestinationPath` is always interpreted as a **folder**, so `C.jpg` was created as a directory.
  No shortcut-side toggle can fix that.
  Corrected facts: the shortcut saves into **a-Shell's `Documents`** folder (iCloud-synced; on the Mac
  it appears as `~/Documents/a-shell/`), not `~/Documents/SICC-Ryder-Cup/`; and the resize width is
  **1920** (the "1280" in the full design doc §10.7.11 is stale). `iOS/sync_celebration.sh` now holds
  the **canonical v1.2** script taken from the phone/Mac copy (previously the repo shipped a
  different, incomplete variant that lacked the `C.jpg` move).
- **2026-10-30 — ⚠️ Upload pipeline REDESIGNED: direct GitHub API upload (a-Shell path dropped).**
  The folder defect persisted (the 21:50 attempt created `C.jpg/IMG_4341.jpeg` again), so the a-Shell
  chain — Save action → filename → local clone at `~/Documents/SICC-Ryder-Cup` → `lg2` auth → script —
  was **abandoned by decision**. New design: the Shortcut resizes to **1920 px wide** and PUTs the JPEG
  **straight to GitHub** via the Contents API (`PUT /repos/prapi01/SICC-Ryder-Cup/contents/images/celebration/C.jpg`
  on `main`) — no a-Shell, no local clone, no `lg2`, no sync script, and nothing written to the device
  filesystem, so the folder defect **cannot recur**. It stays one-tap:
  Photos → Share → "Upload to Github" → done. Credential is a **fine-grained PAT** limited to this repo
  with **Contents: Read and write**, entered on the device only (never stored in the repo).
  Verified 2026-10-30 by a real Contents-API PUT (commit `842b7bc8`, 506,871 bytes) on a scratch branch,
  and re-verified end-to-end on the live `C.jpg` pipeline before delivery (GET sha `9d48e7a2` → PUT of
  1,028,384 base64 chars = **HTTP 200**).
  **Corrected constraint (measured, 2026-10-30):** the widely-documented **≤ 1 MB base64 limit does NOT
  apply to the Contents API PUT**. The PUT accepted a 3.96 MB base64 body, and the sibling blobs endpoint
  accepted 4.5 MB. The 1920-wide resize is therefore a **quality/size choice, not a hard requirement** —
  a full-resolution photo would also be accepted. `WFImageCompressionQuality = 0.9` keeps a 1536×1024
  source at ~771 KB (1,028,384 base64 chars), which is comfortably under GitHub's ~100 MB hard file cap.
  ⚠️ **`?branch=` is IGNORED on the Contents API** — a PUT with `?branch=x` commits to the **default
  branch**. The branch must be a `branch` key in the **JSON body**. This silently put 8 test files on
  `main` during verification (removed in `a28bf39`); always pass the branch in the body.
  **Shortcut delivery (2026-10-30):** the signed `.shortcut` is delivered to
  `~/Library/Mobile Documents/com~apple~CloudDocs/Upload/CelebrationPhotoUpload.shortcut` (iCloud Drive)
  with a copy in `~/Downloads/`. Signed artifacts are **AEA1 encrypted archives** — the action graph
  cannot be read back out of a signed file, so verify the **source** plist before signing.
- **2026-10-31 — Celebration pipeline: three game-day defects fixed (photo + today's-game access).**
  Both reported symptoms were **not** code regressions — no `js/`/HTML commit since 2026-08-14 —
  but older defects that only surface **on game day** (a real photo broadcast + a completed game).
  See HANDOVER "Technical findings" for full evidence; summary:
  1. **The default photo overwrote the real photo's pointer.** `loadDefaultCelebrationPhoto()`
     → `setPhotoFlags()` wrote the **default** `imageUrl` into `scheduledGames.photo` and reset
     `f2Downloaded`/`viewDownloaded`, so other devices pulled the default image. `view-game.html`
     has called this at game start since **2026-08-09**, but it only bites when a real photo was
     **already broadcast** — i.e. on a real game day. Fixed in `celebration-photo.js` v1.22: when
     `newPhotoAvailable === true` the real photo owns the flags and is used instead.
  2. **The archive record never received a `celebration` field.** `copyCelebrationPhoto()` was the
     only writer and its sole caller lived in `post-game.html`; **v1.13 (2026-07-08)** removed that
     call when the page became display-only, orphaning it (zero callers since). Readers therefore
     fell back to the **shared** `images/celebration/C.jpg` — which is `getCelebrationPhoto()`'s
     documented last resort (design v1.07). The function also skipped the Firestore write entirely
     when the photo file already existed in Storage. Fixed: `sign-card.js` v1.42 calls it from
     `saveGameToHistory()`, and v1.22 always records the pointer.
     **Ordering matters:** `copyCelebrationPhoto()` writes with Firestore `update()`, so it must run
     **after** the archive record is created; `sign-card.js` v1.43 resolves its success paths through
     a `finish()` helper that copies the photo only once the record exists.
  3. **`post-game.html` rendered the celebration from sessionStorage only** (v1.13), so TODAY's game
     dead-ended once the playing session ended — contradicting the design that keeps TODAY's game
     accessible until midnight. `hcp-adjust.html`'s 🎉 button had the same flaw. Fixed with the new
     shared **`js/celebration-data.js`** (`CelebrationData.replayCelebration()`), which rebuilds the
     data + photo from Firestore. Isolated as a shared module because two pages need it.
  **Photo resolution (unchanged, for reference):** `getCelebrationPhoto()` falls back
  `historyGames.celebration.imageUrl` → `localStorage['celebration_photo_url_<gameId>']` →
  `GITHUB_PHOTO_URL` (shared `C.jpg`). The `localStorage` link is populated per game by
  `storePhotoUrlForHistory()` (not by the default-photo path).
  **Repair:** the live `historyGames/GM_260914_1342_52_H` record was backfilled with its
  `celebration` pointer, and `scheduledGames/GM_260914_1342_52.photo` (left pointing at
  `SRC_Default_Photo.jpg` by cause A, with `viewDownloaded: false`) was repointed at the per-game
  photo with all flags `true`.
  **Photo history is a shared, single slot:** `celebration/C.jpg` is **one** file standing in for
  "the latest celebration photo", and `copyCelebrationPhoto()` snapshots it into Storage as
  `celebration/<gameId>_H.jpg`. Both the CDN copy and the Storage snapshot therefore have to be
  **replaced together or a historical game silently keeps the wrong photo** — the archive only holds
  a pointer, never the image. (Done once on 2026-10-31 when the uploaded shot turned out to be the
  wrong frame of the burst.)
- **2026-10-31 — ⚠️ OPEN (unfixed): Firestore is publicly writable.** An unauthenticated `PATCH`
  to `scheduledGames/<id>` returned **HTTP 200** (verified with a harmless probe field, since
  removed). Anyone can rewrite scores, signatures, `status`, and celebration pointers. Storage had
  already been scoped to `/celebration/**` (public read/write); Firestore has **no** equivalent
  guard. Writes should require auth while reads stay public — **an architecture decision for the
  user, not changed here** (GLOBAL §23).
- (Older decisions: see `RELEASE_NOTES.md` and the full design doc.)

## Related docs
- `Design Documents/SICC Ryder Cup Complete Design Documentation.md` — full design
- `Project Documentations/HANDOVER.md` — running project log
- `RELEASE_NOTES.md` — release history (current: Version 4.0.0)
- `Project Documentations/APP Development Rules.md` — coding / UI rules
- `.github/instructions/rules.instructions.md` — assistant working rules
