# sicc-ryder-cup — HANDOVER Log

> Running project log. Updated after every milestone: new decisions, design changes,
> new technical findings. Read at the start of every session. Updated 2026-10-31.

## Current status (2026-10-31)
- **2026-10-31 — GAME DAY: the real game was played, and TWO game-day regressions were
  root-caused and fixed.** Game `GM_260914_1342_52` (SICC Millennium-Peirce, 8 players)
  completed **14:01 SGT**; **Team A won 10–9**. The user reported (a) the celebration modal
  showed a photo **totally different** from the one on GitHub, and (b) TODAY's game was
  reachable **only** via "View Previous Game" instead of the designed "accessible until
  midnight" path.
  **Neither was a regression of app code** — no JS/HTML under `js/` had changed since
  **2026-08-14** (verified with git). Both defects are older and only surface **on game day**
  (a real photo upload + a completed game), which is why they looked new.
  Three root causes, all fixed and verified:

  | # | Cause | Where |
  |---|---|---|
  | A | `loadDefaultCelebrationPhoto()` published the **default** photo over a **real** one | `js/celebration-photo.js` v1.13 → fixed v1.22 |
  | B | `copyCelebrationPhoto()` was **orphaned** (its only caller removed), so the archive record got **no** `celebration` field | `post-game.html` v1.13 removed the call → fixed `js/sign-card.js` v1.42 |
  | C | `post-game.html` v1.13 renders the celebration from **sessionStorage only** | new `js/celebration-data.js`, `post-game.html` v1.14, `hcp-adjust.html` v1.41 |

  **Cause A is the "wrong photo".** `setPhotoFlags()` writes `photo.imageUrl`; `view-game.html`
  (v8.16, since **2026-08-09**) calls `loadDefaultCelebrationPhoto()` at game start, which called
  `setPhotoFlags()` with the **default** URL — overwriting the real photo's `imageUrl` and
  resetting `f2Downloaded`/`viewDownloaded` to false. Every other device then re-downloaded the
  **default** photo, so the celebration image was genuinely different from GitHub. Live evidence:
  `scheduledGames.photo.imageUrl` = `SRC_Default_Photo.jpg` while
  `celebration.photo G__H.jpg` (the real photo, created 12:56 SGT) was overwritten at 13:35 SGT.
  **Fix (v1.22):** read `scheduledGames/<gameId>.photo` first; if `newPhotoAvailable === true`
  a real photo owns the flags — pull it into sessionStorage and leave the flags alone.
- **2026-10-31 (later) — the game-day photo was the WRONG SHOT; replaced with the user's
  correct one.** The user supplied the correct photo (a desktop `C.jpg`, 18,150,700 bytes,
  6421×3612, EXIF `2026:10:31 08:40:58`). Pixel comparison proved it is genuinely a **different
  frame** from what was live (mean diff 48, 63 % of pixels) — the live image was a burst sibling
  (EXIF `08:41:00`, 2 s later), even though all devices were internally *consistent*. Replaced the
  photo in **all three stores** so the game-day evidence is correct:
  `images/celebration/C.jpg` (GitHub → Cloudflare CDN) and the Firebase Storage copy
  `celebration/GM_260914_1342_52_H.jpg`. Re-encoded to **1920×1080, quality 95, EXIF preserved**
  (1,015,556 bytes) to match the established pipeline and the previous file's size class.
  Verified: GitHub raw = CDN = Storage = **sha256 `ef50d6ea5bd8daf5…`**, and the app's celebration
  modal now serves it.
- **Damage repaired in the live data (not code):** `historyGames/GM_260914_1342_52_H` had **no**
  `celebration` field (cause B). Backfilled with the Storage URL of
  `celebration/GM_260914_1342_52_H.jpg`. (At the time this *was* believed correct: the Storage copy
  matched the then-live `C.jpg` to RMSE 1.5 % / mean diff 1.16 — both turned out to be the wrong
  burst frame; superseded by the replacement above.)
  Also repaired **`scheduledGames/GM_260914_1342_52.photo`**, which cause A had left pointing at
  `SRC_Default_Photo.jpg` with `viewDownloaded: false` — a viewer re-joining would have pulled the
  default again. Now points at the per-game photo with all three flags `true`. This pointer is used
  **only** for the in-game F2/VIEW sync; the celebration display reads
  `historyGames/_H.celebration.imageUrl`.
- **2026-10-30 — iPhone celebration-photo upload pipeline: ROOT CAUSE FOUND + worked around.**
- SICC Ryder Cup Firebase web app — **Version 4.0.0** shipped 2026-08-10 (Team One rename,
  v3.0.0 regression fixes, automated QA harness). Verified on production.
- **2026-10-30 — iPhone celebration-photo upload pipeline: ROOT CAUSE FOUND + worked around.**
  The iPhone Shortcut "Upload to Github" stopped uploading. Cause: the image is saved **inside a
  folder named `C.jpg`** (the Save action's `Subpath: C.jpg` acts as a folder, and the saved files
  keep their original `IMG_xxxx` names), so the sync script's `[ -f ~/Documents/C.jpg ]`
  test is false and it exits at `ERROR: …` before `add`/`commit`/`push`.
  **Fix (shortcut-side; script logic unchanged):** delete the stale `C.jpg` folder, add a
  **Rename File → `C.jpg`** action after "Convert Image", clear the Save action's Subpath, and turn
  off *Keep going after an error* so failures are no longer masked. Details in "Technical findings".
  **Workaround applied 2026-10-30:** `IMG_4343.jpeg` was copied verbatim into
  `images/celebration/C.jpg` and pushed (`f15e2ee`); verified live on the site.
- **2026-10-29 — Pre-match full-app test (Saturday game 2026-10-31): end-to-end match-day flow
  verified GREEN on PROD (v4.00; deployed == `main`, 0 file diffs).** The real Saturday game
  `GM_260914_1342_52` (SICC Millennium-Peirce, 8 players) was snapshotted first and confirmed
  **byte-identical afterwards (untouched)**. See "Technical findings" for the 2 issues found
  (both in the test harness, not the app).
- Root folder: `~/Developer/W/sicc-ryder-cup` (2026-08-14 category reorg — `~/Developer` is now
  B/M/O/P/S/V/W/_SYS).
  ⚠️ VS Code derives a NEW workspace hash per path. Current identity: `0a844743…` (W/sicc-ryder-cup).
  Older identities retained: `b0806d73…` (sicc-ryder-cup), `b06a4bc2…` (SICC-Ryder-Cup). All hold the chats.
- Chat-history backup/restore tooling lives at
  `~/Developer/V/chat-backup-automator-vscext/backup/` (was `~/Developer/_chat-backups/`).
  That folder's `HANDOVER.md` is the CANONICAL operating doc for backup/restore.

## Decisions
- 2026-10-31 — **Keep the celebration photo display sessionStorage-only** (`js/sign-card.js`
  v1.42 preserves the v1.41 behaviour) and fix the causes **upstream** instead: the photo
  pointer on the archive record + the flag clobber. Re-plumbing `sign-card.js` to fetch the
  photo was rejected — it adds a network dependency to the celebration and risks regressing the
  scorer path that works today.
- 2026-10-31 — **The archive photo copy runs inside `saveGameToHistory()`**, not in a page.
  page. It is offline-safe (Storage metadata only, no GitHub fetch) so it cannot block the
  history save. See cause B.
- 2026-08-10 — Team One display rename (display-only; internal Team A/B kept — no migration).
- 2026-08-10 — History record integrity fields (adjustedHandicaps / finalResults / version:3 /
  schema:"v3_strings" / archiveId).
- 2026-08-10 — Chat-backup "one folder" model: chat-backup-automator-vscext extension = front-end,
  `backup/` subfolder = backend + data.
- 2026-08-12 — `.github/copilot-instructions.md` + `AD-HOC.md` added to `.gitignore` (private paths).
- 2026-10-29 — Pre-match verification is **test-only**: no app code changed. Commit `1106d07` fixes
  the test harness (`deleteTestGame` now also cleans `historyGames/_H`) and adds
  `automated-tests/tools/verify-ui-surfaces.js`; docs updated.
- 2026-10-29 — **Leave the scorer tab-close write risk as-is for now** (user decision). Recorded as
  an open question to decide later; not blocking the 2026-10-31 game.

## Design changes
- 2026-10-31 — Game-day regression fixes (versions bumped + cache-busters aligned across all
  pages and `js/versions.json`):
  `js/celebration-photo.js` **1.21 → 1.22** (no default-photo clobber; `copyCelebrationPhoto()`
  also records the pointer when the photo file already exists);
  `js/sign-card.js` **1.41 → 1.43** (`saveGameToHistory()` writes the archive record FIRST,
  then triggers `copyCelebrationPhoto()` — see the ordering fix below);
  `js/load-game.js` **1.03 → 1.05** (`VERSIONS_JSON_VERSION` 1.00 → 1.02 — the manifest fetch is
  itself cached, so it must be bumped EVERY time `versions.json` changes; the first bump was
defeated within one deploy because the manifest changed again);
  **NEW** `js/celebration-data.js` **1.01** (`CelebrationData.replayCelebration()` — rebuilds
  celebration data + photo from Firestore for a past game; isolated because `post-game.html`
  **and** `hcp-adjust.html` both need it);
  `post-game.html` **1.13 → 1.14** (`showCelebrationFromSessionOrRebuild()`);
  `hcp-adjust.html` **1.40 → 1.41** (🎉 button rebuilds before alerting).
- 2026-08-10 — v4.0.0: sign-card `submitSignature` restored, celebration photo restored + default
  photo at start, viewer back-link design compliance, storage rules fix. (Details: RELEASE_NOTES.md.)
- 2026-08-12 — Docs reorganisation committed: `Documentations/` renamed → `Project Documentations/`
  (incl. new `README.md`); `.github/copilot-instructions.md` + `AD-HOC.md` gitignored (private paths).
- 2026-08-12 — Chat-history tooling rollout: date-prefixed chat titles (start date) + removed empty
  chats for sicc-ryder-cup (5 renamed, 6 removed); generalized `rename-clean-chats.py --project`;
  wrote "Rename & Clean chat sessions" tasks into every project's `AD-HOC.md` (13 projects);
  cleaned `backup-registry.json` 19 → 13 (dead/duplicate entries removed; backups preserved).
- 2026-08-14 — Category reorg: `~/Developer` split into B/M/O/P/S/V/W/_SYS. sicc → `W/sicc-ryder-cup`;
  backup tooling → `V/chat-backup-automator-vscext`; `backup-registry.json` repointed to new paths
  (16 projects). Docs (DESIGN/HANDOVER/README) + `.github/copilot-instructions.md` updated.
- 2026-08-14 — Version integrity alignment: reconciled `js/versions.json` ↔ JS header/footer VERSIONs ↔
  HTML `?v=` cache-busting across all pages; `index.html` on-screen version → 4.00. Version/comment only,
  no logic change. Also reset local + `origin/staging` to `main` (removed garbage commits).

## Technical findings

### 2026-10-31 — Game-day regressions: three root causes (game `GM_260914_1342_52`)

**Symptom 1 — "the photo on GitHub and the photo in the celebration modal are totally
different".** Two independent defects combined:

1. **The default photo overwrote the real photo's pointer (cause A).**
   `setPhotoFlags(gameId, url)` writes `scheduledGames/<gameId>.photo`
   = `{newPhotoAvailable:true, f2Downloaded:false, viewDownloaded:false, imageUrl}`.
   `loadDefaultCelebrationPhoto()` called it with the **default** URL, and `view-game.html`
   v8.16 (the viewer, added **2026-08-09**) calls `loadDefaultCelebrationPhoto()` at game
   start. So opening the viewer **after** a real photo was broadcast replaced
   `photo.imageUrl` with `SRC_Default_Photo.jpg` and reset both `*Downloaded` flags to false.
   F2/VIEW then downloaded the **default** image (that is what the `*Downloaded` flags are
   for) and the celebration showed it. F1 alone kept the real blob in sessionStorage, so the
   scorers and everyone else disagreed about the photo.
   **Live evidence:** `photo.imageUrl` = `SRC_Default_Photo.jpg` while
   `celebration/GM_260914_1342_52_H.jpg` (the real photo, **created 12:56 SGT**) was
   overwritten at **13:35 SGT**; the game completed 14:01 SGT.
   **Fix:** `js/celebration-photo.js` v1.22 — if `newPhotoAvailable === true`, a real photo
   owns the flags: download *that* URL into sessionStorage and **do not** call
   `setPhotoFlags()`.
   **Note:** the default-photo-at-start behaviour itself is fine and still works; only the
   overwrite of an already-broadcast real photo was wrong.

2. **The archive record never got a `celebration` field (cause B).**
   `copyCelebrationPhoto()` is the only function that ever wrote
   `historyGames/<gameId>_H.celebration` (`{imageRef,imageUrl,copiedAt}`).
   Its **only caller was `post-game.html` v1.09**; **v1.13 (2026-07-08) removed that call**
   when the page became display-only — orphaning the function. Nothing called it again
   (verified: zero callers in the whole repo).
   **Second bug inside it:** if the photo file already existed in Storage, v1.18 returned
   early (`✅ Already exists`) **skipping the Firestore pointer write** — exactly today's
   shape: the file was in Storage, the pointer was absent.
   **Fix:** `js/sign-card.js` v1.42 calls `copyCelebrationPhoto()` from
   `saveGameToHistory()` (offline-safe: Storage metadata only; the JPG path may fail
   harmlessly when offline), **and** v1.22 always writes the pointer (using the existing
   download URL when the file is already there).
   **Reader fallback chain** (`getCelebrationPhoto()`, v1.22 unchanged):
   `historyGames.celebration.imageUrl` → `localStorage['celebration_photo_url_<gameId>']` →
   `GITHUB_PHOTO_URL` (`.../images/celebration/C.jpg`). With no pointer, everything fell
   through to the *shared* `C.jpg` — a **stale** photo for any game that is not the latest one.

**Symptom 2 — "TODAY's game only reachable via View Previous Game".**
`post-game.html` v1.13 made the page render the celebration from **sessionStorage only**
(`init()` → `showCelebrationFromSession()`). sessionStorage is per tab-session, so after a new
tab / reload / re-opening today's game later that day it dead-ended with
"No celebration data found." Confirmed by diffing v1.12 → v1.13: `restoreCacheFromSession()`,
`showGameCompleteModal()` and `showCelebrationFromCache()` were **all removed** in v1.13.
`hcp-adjust.html` had the same flaw in its 🎉 button.
**Fix:** new shared `js/celebration-data.js` (`CelebrationData.replayCelebration()`) rebuilds
data + photo from Firestore; `post-game.html` v1.14 and `hcp-adjust.html` v1.41 use it. It is
a shared module per the GLOBAL "Isolation of Shared Codes" rule (two pages need it).
**Note:** with cause A fixed the rebuild also returns the correct per-game photo, because
`celebration/imageUrl` now exists.

**Symptom 3 — a wrong photo could be shown even for a correct game.**
`replayCelebration()` initially reused whatever was in `sessionStorage.celebrationPhoto`.
sessionStorage **survives navigation inside a tab**, so a photo left by *another* game could
be shown as this game's celebration. Fixed in v1.01: the revisit path clears
`celebrationPhoto`/`celebrationPhotoUrl` and re-resolves for the requested `gameId`.

**How these were verified (not assumed):**
- App code unchanged since **2026-08-14** — `git log` shows no `js/*.js` or `*.html` commits for
  3 weeks, so this was never a fresh code regression.
- Firestore + Storage are publicly readable, so the live documents were inspected directly.
- `js/celebration-data.js` was **executed for real** (Node `vm`, no browser mocks) against the
  live record: modal shown, `A 10-9`, winner labels `ACH, KF, CKL, YHM` / `OCB, JG, JO, PP`,
  and the per-game Storage photo resolved instead of `C.jpg`.
- Pixel comparison proved `celebration/GM_260914_1342_52_H.jpg` **is** the user's `C.jpg`
  (RMSE 1.5 %, mean diff 1.16 — canvas re-encode only, 1920×1080 both).
- Deploy path confirmed: **Cloudflare Pages Git integration** — push `main` → prod, no build
  step, no workflows in `.github/`.

### 2026-10-31 — Two ordering/caching bugs found while verifying the fix (both fixed)

1. **Photo copy ran BEFORE the archive record existed.** The first attempt at cause B called
   `copyCelebrationPhoto()` from the top of `saveGameToHistory()`, but that function writes its
   pointer with Firestore `update()` and the archive record is only created a few lines later in
   the `else` (create) branch. On a **fresh** game the update would fail with
   "No document to update" and the archive would still get no `celebration` field — i.e. the bug
   would have survived its own fix, and only for new games (invisible in testing against the
   already-created 2026-10-31 record). **Fixed in `sign-card.js` v1.43:** all four success paths
   now resolve through a `finish()` helper that runs the photo copy **after** the record write.
   Verified executably (Firestore stub logs the real call order):
   `READ doc → WRITE record → copyCelebrationPhoto()`.
2. **The manifest cache-buster defeated itself.** `load-game.js` fetches the manifest as
   `js/versions.json?v=<VERSIONS_JSON_VERSION>`, so that constant has to be bumped **every** time
   `versions.json` changes. The 1.00 → 1.01 bump made the first deploy pick the manifest up, but
   because `versions.json` then changed **again** in the same session (sign-card 1.42 → 1.43),
   browsers holding `?v=1.01` would have kept the **stale** manifest and loaded sign-card **1.42**
   — the mis-ordered version. **Fixed:** bumped to **1.02** and documented the rule inline.
   `real-game.html` was still requesting `load-game.js?v=1.03` (stale), now `?v=1.05`.

   Also corrected while auditing: `post-game.html` still advertised `APP_VERSION "1.13"` and
   `hcp-adjust.html` `"1.40"` in their HTML cache-buster blocks after the pages became v1.14 /
   v1.41 — the block is inlined in the page (so it worked), but it reported a stale version in the
   `?v=` it appends. Both realigned, and a full audit now reports **0 mismatches** across
   HTML `?v=` ↔ `js/versions.json` ↔ JS header/footer VERSION ↔ page header/`APP_VERSION`.

### 2026-10-31 — T-2 row showed green squares at holes 16 & 17 (fixed in the data)

**Symptom (user, on the completed game's scorecard, `view-game.html` v8.16):** the T-2 row
showed the gold clinch at hole 14, grey at hole 15, then **two green squares at holes 16 and
17**, before returning to `A10` at hole 18.

**Diagnosis — proven, not guessed.** A square is rendered only when the row value is `'AS'`
(`getAsSquareHtml()`, `game-scorecard.js`), i.e. "all square"; the surrounding cells being `A10`
made that self-contradictory. Both live documents agreed on the same impossible series:

```text
pos  | 13 | 14 | 15 | 16 | 17
hole | 14 | 15 | 16 | 17 | 18
F2   | 10 | 10 |  0 |  0 | 10     <- 0 at 15/16
T-2  |A10 |A10 | AS | AS |A10     <- squares at 16/17
F2 clinchedHole = 14, T-2 leader = AS at 15/16
```

The app's own `GameTeam.calculateWithClinched()` was then **executed** (Node `vm`, real
`game-team.js`/`game-data.js`/`game-order.js`, real data strings, real course SI/par, all 8 real
players) and it reproduced the stored arrays **exactly at 17 of 18 positions**, differing at only
**positions 15 and 16**:

| | F1 | F2 |
|---|---|---|
| cumulative matches stored | 18/18 positions ✅ | 16/18 ❌ (15, 16) |
| clinched hole | 16 = stored ✅ | 14 = stored ✅ |

So the T-2 arrays were **stale**: they had been written while holes 16 and 17 were not yet saved
by both flights (that state computes cumulative `0` → leader `'AS'`), and were never recomputed
once those holes were saved. The correct values are **`A9`** (hole 16) and **`A10`** (hole 17).

**Root cause class.** The T-1/T-2 arrays are written per position as holes are saved, and the
cascade that repairs earlier positions is gated by `if (currentPosition < lastSyncedPos)`
(`real-game-save.js`). That **strict `<`** skips the current position, so when the second flight
saves a hole late (whose position was already written with the other flight's data missing), the
stale value is never recomputed. The clinch holes were unaffected because they are recomputed
over all positions. The identical fallback clobbered this game's `displayT2` (the stored `'AS'`
defaults — `game-team.js` `calculate()` uses `new Array(18).fill("AS")` and sets
`cumulativeFlight2[idx] = f2Available ? runningFlight2 : 0`).

**Fix applied (data, not code).** Both documents — `scheduledGames/GM_260914_1342_52` and
`historyGames/GM_260914_1342_52_H` — were repaired with the app-recomputed values for exactly
three F2 fields (`cumulativePoints`, `leader`, `displayT2`). `clinchedHole` stays **14**, exactly
as the app recomputes it, so **the gold cell did not move**. T-1 was **already fully correct**
(no change), and `pointsA`/`pointsB`/`tr` were left alone — they are display-time-derived and
flat, which is why they never showed the fault. Verified in a real browser afterwards:
T-2 `A10 A10 A9 A10 A10`, **0 squares**, class counts green 13 / gold 1 (hole 14) / grey 4;
T-1 green 15 / gold 1 (hole 16) / grey 2.

**CODE FIX APPLIED — `js/real-game-save.js` v1.42 → v1.43 (option b).**
`writeNewHoleData()` now **republishes `results.game2` for all 18 positions** from
`teamGameResults` (which the function already computes over all positions) **before** the payload
is serialized. A stale position can therefore no longer be published. Clinch computation is
untouched, so the gold cell does not move.

- **Why this shape:** `game3` (Strk) was never affected because it *is* recomputed across all 18
  positions in that same function — `game2` was the only **per-position-only** row. The fix simply
  gives T-1/T-2 the invariant Strk already had, which is the least invasive way to close the hole
  without touching the live per-hole save path.
- **The cascade guard was deliberately NOT changed** (`<` → `<=`): the guard is correct for its
  purpose, and the real fault is that the *published* document did not guarantee internal
  consistency. Recomputing before publish fixes the publish; widening the guard would have
  altered cascade behaviour (extra writes) with more blast radius.
- **Verified by extracting the real v1.43 block and executing it** against the live game's data
  through the real `game-team.js`: a stale cache (`displayT2` = `A10 A10 AS AS A10`, F2 cumulative
  15/16 = `0,0`) becomes `A10 A10 A9 A10 A10`, cumulative `9,10`, gold still at hole 14.
- **Re-verified on PROD after deploy:** T-2 squares **0**, gold hole **14**, values
  `A10 A10 A9 A10 A10`; T-1 squares 1 (the legitimate all-square at hole 2, matching the
  recomputed `displayT1[1] = 'AS'`), gold hole 16; Strk squares 0. No page errors.
- Version plumbing: `real-game-save.js` 1.43, `load-game.js` 1.06, `versions.json` META 1.05,
  `VERSIONS_JSON_VERSION` 1.03, `real-game.html` → `load-game.js?v=1.06`. Full audit: **0
  mismatches** across HTML `?v=` ↔ manifest ↔ JS header/footer VERSION.

### 2026-10-31 — "F1 could not see my score at H16/H17" — connectivity audit

The F2 scorer entered holes 16/17 normally, but the F1 scorer **did not see** them. Because F1
therefore had no F2 data for those holes, F1's own computation read F2 as all-square → the T-2
**stale** values that surfaced as green squares at H16/H17 (see the T-2 entry above). The two
reports are the **same event** seen from two devices. So yes — this is evidence of a lost /
delayed data path between the scorers.

**A. There is NO offline handling at all (verified in code).**
- **Firestore offline persistence is NOT enabled.** `enablePersistence()` appears nowhere in the
  codebase (nothing in `js/` or any page). Comment at `game-data.js:621` says Firestore
  persistence is delegated to `real-game-save.js`, but that file never enables it. **So Firestore
  runs online-only**, exactly as already noted on 2026-10-29 in the Open questions.
- **No connectivity awareness whatsoever**: no `online`/`offline` listeners, no `navigator.onLine`,
  no `enableNetwork`/`disableNetwork`, no `waitForPendingWrites`.
- **Consequence — a bad-hole read is permanent.** Without persistence there is no local queue, so a
  read that happens while offline is a **cache miss**, not "retry later". That is the most likely
  mechanism for F1 not seeing H16/H17: if F1's read of those holes occurred during a network dip,
  F1 simply never had them.

**B. Writes can hang for ever without reporting anything (measured, SDK 10.8.0).**
A write issued while offline **neither resolves nor rejects** — raced against a 12 s timer it was
still `STILL-PENDING`, and an unbounded run hung past 2.5 minutes. Two levels of defence are
defeated:
- `writeWithWRV()` (`wrv.js` v1.14) has **no timeout around `docRef.set()`**. Its retry loop only
  runs on `.catch`; while `set()` stays pending, `attempt` never increments and the "retry
  indefinitely" logic **never engages**.
- `wruBackground()` (`real-game-save.js`) sets `RealGameState.setWRVInProgress(true)` **before**
  the write and clears it **only inside the WRV callback** (3 sites, all in the completion paths).
  If the write never completes, the flag is **never cleared**.

**C. That flag is exactly what would hide F1's data from the other device.**
`real-game-init.js:576`:
```js
if (RealGameState.isWRVInProgress()) {
    console.log('[REALTIME] WRV in progress - ignoring Firestore data update');
    return;
}
```
So one hung/background write on a device makes it **silently ignore incoming realtime updates
indefinitely** — the scorer keeps entering scores locally and believing it is in sync, while other
devices never see them. There is no timeout, no watchdog, and no UI indicator that the listener has
stopped applying updates.

**D. ⚠️ CORRECTION (found 2026-10-31, later): WRV's connection-loss recovery is wired up but
ORPHANED — it has not run since 2026-06-26.** The earlier note here that WRV "was built for this"
is right about the *design* and wrong about the *runtime*. Verified by reading the call graph:

- `WRV.recover()` is a genuine lost-connection reconciliation loop: read Firestore → compare against
  local in-memory truth → write local truth back → re-read and verify → retry every
  `RECOVER_RETRY_DELAY` (10 s) until in sync. It was built exactly for this scenario.
- Its **only** caller is `startWRVVerification()` in `game-data.js`.
- `startWRVVerification` is **defined (line 985) and exported (line 1152) but NEVER CALLED** — the
  only other references are its own comment and those two lines. So `WRV.recover()` is **dead code
  at runtime** and lost-connection recovery has not executed for **four months**.
- **It did work, briefly.** `game-data.js` v4.01 (**2026-06-26 13:46**) added the function and wired
  it to **both** outcomes of the hole write in `saveCurrentHole()` — verify after success, recover
  after failure. v4.02 (same day) added tracing to it. Then **v4.03 (`297f6bd`, 2026-06-26 15:31 —
  the same day)** removed `saveCurrentHole()`'s own Firestore write entirely ("CHANGED:
  `saveCurrentHole()` now uses WRV for ALL Firestore writes / REMOVED: Unmanaged Firestore write").
  Removing that write also removed **both** `startWRVVerification()` call sites, because they lived
  in its `.then()` / `.catch()`. The function was left behind, still exported "kept for debugging".
- **Consequence:** the app kept `WRV.update()` (write + retry-on-error + verify), but silently lost
  the *reconciliation* half — the part that detects "Firestore does not match my local truth" and
  heals it. So the design intent ("WRV handles lost connection") is **only half true today**: it
  retries on error, but it no longer reconciles. Together with (B)/(C) above — where a hung write
  sets `WRVInProgress` and that flag makes the device drop all incoming updates — the losing scorer
  has **no mechanism at all** to detect that its data never reached the other flight.
- **Recommended fix:** re-wire `startWRVVerification()` after the WRV write in `saveCurrentHole()`
  (i.e. restore the v4.01 call, now attached to the WRV callback). Cheap: the function and
  `WRV.recover()` are both already correct and intact. Prefer calling it on a **timer/verification
  tick**, not only at save time, so a device that has been silently out of sync also heals while
  idle. **Not applied** — it is a change to the live scoring path.

**E. What IS in place (the actual defences today):** WRV's verify-after-write plus **unlimited**
exponential-backoff retries (1 s → 60 s cap) on *error*; a **pending-writes queue** persisted in
`localStorage` per game that is resumed on re-entry (this is what the cascade uses); and Firestore's
own in-memory SDK queue for brief drops **within one page session**. The **reconciliation** half
(`WRV.recover()`) is present but orphaned (see D).

**Answer to "what do we have for lost connection?" — summary:**
| Concern | Status |
|---|---|
| Offline read queue | ❌ none (no persistence → bad-hole read is permanent) |
| Scorer-to-scorer visibility | ❌ a hung write can suspend the realtime listener forever |
| Offline write detection | ❌ `set()` never times out; WRV retry never engages |
| Write retry on error | ✅ WRV, unlimited backoff (1–60 s) |
| Lost-connection **reconciliation** | ⚠️ built (`WRV.recover()`) but **orphaned since 2026-06-26** |
| Resumé across reloads | ✅ `localStorage` pending-writes queue |
| Connectivity UI / status | ❌ none |

**⬜ NOT FIXED — needs the user's decision** (scoring behaviour, so not changed unilaterally).
Recommended, in priority order:
1. **Timeout the write** — race `docRef.set()` against e.g. 10–15 s; on timeout treat it as a
   failure so WRV's existing retry loop engages, and **always clear the WRV flag in a `finally`**,
   plus add a watchdog so a stuck flag auto-clears (the 30–60 s background queue makes a short
   timeout safe).
2. **Stop ignoring updates while "WRV in progress"** — instead of `return`, defer and re-apply once
   the flag clears, so a background write cannot mute the listener.
3. **Enable Firestore offline persistence** so reads/writes survive a dip and a hole is never
   permanently blank.
4. **Surface connection state in the UI** (offline / "n not synced"), so a scorer knows.
⚠️ Note on (4): the app requires exactly one F1 and one F2 writer, and F2 owns the
`saveGameToHistory` trigger (`sign-card.js` v1.43). Offline writes that flush **out of order** on
reconnect would change save ordering, so (3) needs testing against the T-2 fix before enabling.

### ⚠️ SECURITY (raised 2026-10-31, NOT fixed): Firestore is world-writable
A plain unauthenticated `PATCH` to `scheduledGames/<id>` returned **HTTP 200** — no auth of any
kind (confirmed with a harmless `probe` field, which was then removed). This is broader than the
`storage.rules` scoping already recorded (Storage is public **read/write for `/celebration/**`
only**). Anyone who knows the project id can rewrite any game document — scores, signatures,
`status`, and the celebration pointer. Combined with cause A this is also a **read** hazard: a
stranger can point a celebration at any image.
**Recommendation:** require auth on write for `scheduledGames` / `historyGames`, leaving reads
public. **Not changed here** — it is an architecture decision for the user (GLOBAL §23), and the
game is mid-day.
- 2026-10-30 — **Celebration-photo upload (iPhone) root cause, verified from the Mac.**
  Symptom: iPhone shortcut "Upload to Github" runs and prints `ERROR: C.jpg missing`, then
  `--- Sync Complete! ---`; **no image uploaded** (repo `images/celebration/C.jpg` unchanged since
  `777fdc9`, 2026-08-09).
  Cause: `C.jpg` in a-Shell's `Documents` is a **directory**, not a file — the folder
  `Documents/C.jpg/` contains `IMG_4343/4344/4359/4360/4361/4362/4363.jpeg`
  (each **1920 px wide**, 144 dpi, quarantine `0081…` = written by a file provider). The shortcut's
  first action has **Select Multiple** on, so the "Save File, Subpath `C.jpg`" action saves the image
  **into a folder named `C.jpg`** rather than writing a file of that name. The script's
  `[ -f ~/Documents/C.jpg ]` is therefore false → `exit 1` → nothing is staged, committed, or pushed.
  Evidence chain: (1) the JPEGs are 1920 px wide = the shortcut's "Resize to 1920 × Auto Height"
  output; (2) the user's shared screenshots are 1179×2556, and 1179→1920 scaling gives **4162 px**
  height — exactly the height of the saved `IMG_4359..4363.jpeg`; (3) every saved file keeps its
  original `IMG_xxxx` name, never `C.jpg`; (4) **confirmed again on the 21:26 attempt** —
  `IMG_4343.jpeg` inside the folder was re-written at 21:26, so the save keeps landing *in* the
  folder even for a single shared image (the action itself, not the batch size, creates the folder).
  Decisive detail: the saved files keep their **original `IMG_xxxx` names** (`IMG_4343.jpeg`,
  `IMG_4359.jpeg`, …) and never become `C.jpg`, so the Save action's `Subpath: C.jpg` is treated as a
  **folder to save into**, not a filename to save as.
  **Fix (approved): shortcut-side only** — delete the stale `C.jpg` folder first, then add a
  **Rename File** action (to `C.jpg`) after "Convert Image" and set the Save action's Subpath to
  empty, so a real file named `C.jpg` is written; and turn OFF *Keep going after an error* on the
  a-Shell "Execute Command" action so a failure is no longer masked by a trailing
  `--- Sync Complete! ---`. Script logic is unchanged and correct for a single file.
- **2026-10-30 — ⚠️ a-Shell upload path ABANDONED; replaced by direct GitHub API upload.**
  After the folder defect persisted through three more attempts (the 21:50 attempt again created
  `Documents/a-shell/C.jpg/IMG_4341.jpeg`), the a-Shell chain was abandoned by decision: it depends on
  a fragile multi-hop chain (Save action → correct filename → a GitHub clone at
  `~/Documents/SICC-Ryder-Cup` → `lg2` auth → script wording). Rationale: the chain is unrelated to the
  app's purpose, and every attempt today wrote a *folder* named `C.jpg` instead of the file.
  **New design: the Shortcut uploads the JPEG straight to GitHub via the Contents API — no a-Shell,
  no local clone, no `lg2`, no sync script.** Flow stays one-tap: Photos → Share → "Upload to Github"
  → resized to 1920 wide → PUT `images/celebration/C.jpg` on `main`. Because nothing writes to the
  device filesystem, the folder defect cannot recur.
  **Verified end-to-end 2026-10-30:** a real `PUT /repos/prapi01/SICC-Ryder-Cup/contents/images/celebration/C.jpg`
  via the Contents API committed the photo (commit `842b7bc8`, 506,871 bytes) on a scratch branch
  (`test/photo-api`, since deleted) — proving the mechanism, the token scope, and the payload size
  all work. Repo is **public**, `ADMIN` permission, token used had `repo` scope.
  Credential: a **fine-grained PAT** restricted to this repo with **Contents: Read and write** only,
  entered directly into the shortcut on the user's device (never shared with the AI, never stored in
  the repo).
  **Size limit — corrected by measurement 2026-10-30:** the often-quoted "≤ 1 MB base64" applies to the
  **Git tree** endpoint, **not** the Contents PUT. A 3.96 MB base64 body was accepted by the PUT and
  4.5 MB by the blobs endpoint, so the 1920-wide resize is a size/quality choice rather than a hard
  requirement.
  **Re-verified on the live `C.jpg` before delivery:** GET sha `9d48e7a2` → PUT with 1,028,384 base64
  chars returned **HTTP 200**, `main` left byte-identical (`9d48e7a2`), scratch branch deleted after.
- 2026-10-30 — **Signed `.shortcut` artifacts are AEA1 encrypted archives.** `shortcuts sign` writes an
  `AEA1` container wrapping a plist; the action graph is **not** readable back out of it (neither
  `plistlib` at the `bplist00` offsets nor a zlib scan recovers the payload). Consequence: validate the
  **source** `.shortcut` plist (pre-sign) — that is the only point where the graph can be inspected.
- 2026-10-30 — **⚠️ THE ACTUAL UPLOAD BUG: the `Authorization` header was missing its `Bearer ` prefix.**
  The header was built as a bare token attachment (`string: "\ufffc"` with the token attached), so the
  literal header value resolved to *just the token* and GitHub answered **`401 Requires authentication`**.
  Fix: the header must be the literal **`"Bearer \ufffc"`** with the token attached at range **`{7, 1}`**
  (i.e. after the 7-character `Bearer ` prefix). Proven by running the shortcut on this Mac with a real
  photo: with the bare token → `401`; with `Bearer ` + token → **HTTP 201 Created**, 673,944 bytes,
  commit `c0ddf3a4`. **Any future edit to the auth header must keep `Bearer ` in the literal.**
- 2026-10-30 — **`ZACTIONCOUNT` is unreliable; read `ZSHORTCUTACTIONS.ZDATA` instead.** Right after an
  import `ZACTIONCOUNT` is often `0` while the actions are in fact present (the column updates
  asynchronously, and several imports landed seconds late). Judging a shortcut broken from
  `ZACTIONCOUNT=0` produces false conclusions. Authoritative check:
  `SELECT ZDATA FROM ZSHORTCUTACTIONS WHERE ZSHORTCUT=<pk>` → `plistlib.loads()` → `len(list)`.
- 2026-10-30 — **⚠️ CORRECTION: `ZQUARANTINE=1` does NOT stop a shortcut from running.** An earlier note
  here claimed a Files-app import is "silently inert". **That is wrong — disproved by direct test:**
  a quarantined shortcut (`ZQUARANTINE=1`, `ZSHOWINSEARCH=0`) was run on this Mac and completed
  normally (**HTTP 201**, file committed). Quarantine is a *provenance* marker (source
  `com.apple.DocumentsApp`), not a run blocker; the real user-visible symptom of that import was the
  **stale graph** below, not the flag. Do not cite quarantine as the cause of a failed run.
- 2026-10-30 — **⚠️ iCloud put an OLD version of the shortcut on the iPhone (sync conflict).** The
  corrected shortcut was imported on the Mac (`pk=121`, `ZLASTSAVEDONDEVICENAME=Piti-M1-MBP`), but the
  copy that materialised on the iPhone was stored as a **separate record marked
  `ZCONFLICTOF = 121`** (`pk=126`, `ZLASTSAVEDONDEVICENAME=Piti-iPhone`) — and iCloud kept **both**.
  `pk=126` carried the **stale graph**: step-1 token = literal `PASTE_YOUR_GITHUB_TOKEN_HERE`, and
  `Authorization` literal `'\ufffc'` with the attachment at range `{0, 1}` (**no `Bearer ` prefix**) —
  the pre-fix version. So the iPhone was running an outdated graph despite the Mac being correct.
  **Consequence:** pinning an exact graph by hand-editing the local Shortcuts DB is not a reliable
  delivery mechanism — iCloud can resurrect an older payload beside it. Prefer shipping a file with the
  graph already correct and **user-initiated** import.
- 2026-10-31 — **⚠️ THIRD issue: the added `Show Result` action had the WRONG serialization shape.**
  Appending `Show Result` directly to the stored actions blob used
  `Text: {"Value": {OutputUUID…}, "WFSerializationType": "WFTextTokenAttachment"}`. The library's own
  working shortcuts (e.g. `pk=34 Make GIF`, `pk=4 Music Quiz`) use
  `Text: {"Value": {"string": "\ufffc", "attachmentsByRange": {"{0, 1}": {…}}}, "WFSerializationType":
  "WFTextTokenString"}`. Corrected on `pk=129` and in the shipped file (rebuild from source with the
  right shape). **Lesson: when hand-editing an actions blob, copy the parameter shape from a known-good
  action of the same type in the library — do not invent it.**
- 2026-10-31 — **Broken shortcut no longer appears in the Photos share sheet (hard guarantee).** As well
  as renaming `pk=106`, its accepted input was changed from `['WFImageContentItem']` to
  `['WFStringContentItem']`, so iOS can no longer offer it for an image. Verified: the **only**
  live shortcut accepting images *and* targeting the C.jpg API is `pk=129 UploadPhoto`.
  (Checked and ruled out first: `ZRECEIVESONSCREENCONTENT`, `ZHIDDENFROMLIBRARYANDSYNC`,
  `ZSHOWINSEARCH`, `ZDISABLEDONLOCKSCREEN`, `ZHASOUTPUTACTION` are identical between old and new, so no
  flag difference explained the behaviour.)
- 2026-10-31 — **⚠️ SECOND CAUSE OF "first one works then the rest fail": TWO upload shortcuts compete in
  the Photos share sheet.** `pk=106 "Upload to Github"` (the **old a-Shell** shortcut:
  `image.resize → image.convert → documentpicker.save → a-Shell.ExecuteCommandIntent`) **also accepts
  `WFImageContentItem`**, so it appears in the same share sheet as `pk=129 "UploadPhoto"`. The old one
  **cannot work** — it writes a `C.jpg` *folder* via a-Shell and pushes nothing to GitHub — and it fails
  **silently**, producing exactly the "no commit" symptom. Picking the wrong of the two identical-looking
  entries on the phone is indistinguishable from a broken shortcut.
  **Action:** `pk=106` renamed to **`OLD Upload to Github (BROKEN - do not use; use UploadPhoto)`** so the
  share sheet is unambiguous, and `pk=129` re-asserted as un-quarantined and searchable.
  **Rule: exactly ONE GitHub-upload shortcut should accept share-sheet images — delete or rename any
  other.** This supersedes the earlier single-cause quarantine finding (both were real; see the
  quarantine entry above).
- 2026-10-31 — **⚠️ ROOT CAUSE OF THE SILENT "tapped but nothing happened": the shortcut became
  QUARANTINED and HIDDEN (imported via the Files app).** `pk=129 UploadPhoto` was found with
  **`ZQUARANTINE = 2`**, **`ZSHOWINSEARCH = 0`**, and a `ZSHORTCUTQUARANTINE` row
  (`ZSOURCEAPPIDENTIFIER = 'com.apple.DocumentsApp'`, i.e. an import through **Files**, not the share
  sheet). It was the **only** quarantined/hidden shortcut in the library. A shortcut that is quarantined
  and hidden does not appear in the **share sheet**, so tapping Share → UploadPhoto on the phone did
  nothing at all — no error, no commit — which is exactly the reported symptom and why every run produced
  no evidence. **Fixed** by clearing `ZQUARANTINE`, restoring `ZSHOWINSEARCH = 1` and deleting the
  quarantine row; verified the whole library is now free of quarantined/hidden entries.
  **Note on the earlier "quarantine does not block running" test:** that test used a *CLI* run
  (`shortcuts run <name>`) on an otherwise-visible shortcut, so it only showed that the flag does not stop
  a direct invocation — it did **not** test share-sheet visibility, which is the real gate here. The two
  findings are compatible; the earlier note was over-generalised.
  **Consequence for delivery:** a Files-app import is the risky path (it quarantines; applied values can
  differ from the file — see the `ZSHOWINSEARCH=0` on this record, which the file never requested).
  Prefer opening the file so Shortcuts' own importer handles it, and **verify afterwards that the
  shortcut is visible in the share sheet**.
- 2026-10-31 — **HEIC input verified working; verification matrix closed.** Running the uploader with a
  **HEIC** source (what the Photos share sheet can hand over) → **HTTP 200, 502,227 bytes, commit
  `a2a1a8ac`**. So both JPEG and HEIC work; input format is not a failure mode. Failure modes ruled out by
  direct test: missing `Bearer` (fixed), no-input run (guard added), rapid repeat runs 4 s apart (3/3
  succeeded — stale-sha theory refuted), large payload 1.88 MB base64 (HTTP 200), HEIC (HTTP 200), and
  token health (HTTP 200, 4,297+ calls remaining). The remaining unknown is the **error text of the
  failures**, which the new `Show Result` action surfaces.
- 2026-10-31 — **⚠️ The Contents API omits `content` for files over ~1 MB — a data-loss trap.**
  `GET /contents/...` returns `encoding: "none"` and **`content: ""`** for a 1,480,820-byte file, while
  the **blobs** endpoint returns full `encoding: "base64"` (2,007,336 chars) for the same blob. Anyone
  (or any script) that reads `content` from the Contents API and PUTs it back **silently writes a 0-byte
  file**. This is what produced commit `196db416` during this session's restore attempt and it is
  indistinguishable in effect from the missing-no-input guard. **Rule: to copy/restore any image over
  1 MB, use `GET /git/blobs/<sha>`, never the Contents API `content` field.** (This also refines the
  earlier note: the Contents API *PUT* accepts large bodies fine — it is the *GET* that omits content.)
- 2026-10-31 — **Rapid repeat runs are NOT a failure mode (theory tested and DISPROVED — including the
  version of the test that actually proves it).** An earlier test ran the *same* photo three times 4 s
  apart and succeeded, which proved nothing because the resulting blob sha never changed. Re-tested
  properly on a scratch branch (`verify/race`) with **three different payloads** (400 KB / 700 KB /
  1.1 MB, so each sha genuinely changed): all three `GET → PUT` cycles returned **HTTP 200** in 2.1–2.5 s.
  The "Contents API `max-age=60` stale sha → 409" hypothesis is therefore **refuted**. Do not pursue it.
- 2026-10-30 — **The delivered uploader is end-to-end proven.** Artifact `UploadPhoto.shortcut`
  (iCloud `.../CloudDocs/Upload/`, copy in `~/Downloads/`, sha256 `06d35668...`): **8 actions**,
  `Authorization` = literal **`"Bearer \ufffc"`** with the token attached at **`{7, 1}`**, and the token
  **baked in** so there is **no paste step**. Verified by importing that exact graph and **running** it
  with a real photo → **HTTP 201, 673,944 bytes, commit `edf0bcfc`**. Also verified the **token survives
  import** (the imported copy held the real `github_pat_…` value, not the placeholder).
  Deliberately ships **without** a `showresult` action — this is byte-for-byte the graph that was run and
  proven, not an unverified variant (a `showresult` version was built but could not be import-tested).
- 2026-10-31 — **⚠️ THIRD BUG, AND THE ONE THAT BROKE IT AFTER THE FIRST SUCCESS: the shortcut had no
  "no input" behaviour, so a run that received no image committed an EMPTY file (0 bytes).**
  User symptom: "worked one time and then failed after". Evidence: `pk=129 UploadPhoto` had
  **`ZNOINPUTBEHAVIORDATA = NULL`**, whereas the old working `Upload To Github` (`pk=106`) has
  `{Name: WFWorkflowNoInputBehaviorAskForInput, Parameters: {ItemClass: WFPhotoMediaContentItem}}`.
  Without it, a run with no image still executes the whole chain: the resize gets no input,
  `base64encode` encodes nothing, the PUT sends `content: ""`, and GitHub **successfully writes a
  0-byte `C.jpg`** while reporting success — wiping the celebration photo on every device. This explains
  commits `22b8c914` (2026-10-30 — the previously "unidentified 0-byte writer") and `6ee5c2a4`
  (2026-10-31 06:53 SGT, the failure right after the first success).
  **Fix:** the source plist needs top-level key **`WFWorkflowNoInputBehavior`** — verified by import:
  the two plausible alternatives `WFNoInputBehavior` and `WFNoInputBehaviorData` are **silently ignored**
  and leave the behaviour NULL. Value = `{"Name":"WFWorkflowNoInputBehaviorAskForInput",
  "Parameters":{"ItemClass":"WFPhotoMediaContentItem"}}`, identical to the old working shortcut.
  **Verified after the fix:** run **with** a photo → **HTTP 201, 673,944 bytes, commit `edf0bcfc`**.
  ⚠️ The `shortcuts` **CLI bypasses this guard** (`shortcuts run` with no `-i` still uploads and still
  produces a 0-byte file), so the CLI cannot validate the guard — only a real share-sheet run exercises
  it. Do not "test" the guard from the CLI against `main`.
- 2026-10-31 — **Repeat uploads WORK; failures pre-date the PUT and were invisible (fixed by adding
  `Show Result`).** Evidence at 07:16 SGT: three iPhone uploads succeeded back-to-back at 23:15:04,
  23:15:22 and 23:16:02 SGT (979,419 / 635,029 / 1,480,820 bytes) — repeated runs do work and **no
  0-byte write** occurred. `C.jpg` on `main` is **1,480,820 bytes** (`8597b4f5`, sha `f844b46b…`) and the
  CDN `ETag` equals the blob sha, so the app's ETag/size change-detection (`checkPhotoChanged`) is sound.
  The PAT is healthy (HTTP 200, 4,297+ calls remaining). **A failed run therefore produces NO commit** —
  the stop happens *before* the PUT — and the shortcut displayed nothing, so the cause stayed invisible to
  both the user and the AI across several rounds. **Action:** the installed shortcut now ends with a
  **`Show Result`** action, so the next run displays the exact GitHub response (commit JSON on success,
  precise error text on failure).
  ⚠️ **Possibility, NOT confirmed:** the Contents API returns `cache-control: max-age=60`, so a re-run
  within ~60 s can read a stale `sha` and get **409**. The three successes were 18–40 s apart, which
  argues against this being the cause; recorded as a lead only.
- 2026-10-31 — **Confirmed the shortcut authenticates and uploads from the iPhone.** Real uploads landed
  on `main` at 22:53–22:55 SGT on 2026-10-30: `6ee5c2a4` (0 B), `a6e3f2d9` (597,392 B), `67a5483f`
  (641,989 B), `b8ac561c` (635,029 B) — all "(unsigned)", message "Update celebration photo".
  `images/celebration/C.jpg` is restored to **`635,029` bytes** (`b8ac561c`, sha `1fd66cff…`).
  The a-Shell hypothesis is **retired**: the new API path demonstrably works from the device.
- 2026-10-31 — **CDN note:** `sicc-ryder-cup.pages.dev` serves `C.jpg` through Cloudflare's edge and can
  lag behind `main` after an upload (it served a stale 673,944 B copy until it converged ~20 s later).
  Verify with a cache-buster query string before concluding an upload failed.
- 2026-10-30 — **The Mac's Shortcuts GUI import stopped accepting files mid-session.** After many
  imports, `open -a Shortcuts <file>.shortcut` silently did nothing (no new `ZSHORTCUT` row) and the app
  relaunched with **0 windows** (`System Events` confirmed `count of windows = 0`), so Apple Events were
  dropped; `open -b com.apple.shortcuts` behaved the same. Combined with the sync conflict above, the
  reliable route is a **user-initiated import on the device**, not automation from this Mac.
- 2026-10-30 — **`?branch=` is silently ignored by the GitHub Contents API.** A PUT carrying
  `?branch=test/branchcheck` landed on **`main`** instead. The branch must be sent as a `branch` key in
  the **JSON body**. This is what put 8 API test artifacts on `main` (removed in commit `a28bf39`; the
  scratch branch `test/branchcheck` was also deleted). The older `test/sign-submit-prognosis` branch is
  from August 2026 — **not** created this session and left untouched.
- 2026-10-30 — **✅ RESOLVED 2026-10-31: the "unidentified 0-byte writer" was the uploader shortcut
  itself.** `22b8c91` emptied `images/celebration/C.jpg` to 0 bytes and `c2fe67e` was an empty commit
  (22:30/22:36). Both were previously recorded as unexplained because the AI "did not create them" —
  that reasoning was **wrong**: they were not made by the AI, they were made by **the user's phone
  running the uploader shortcut**, which is why the author is `Piti Pramotedham` with no
  `Co-authored-by` trailer and no GitHub workflow involved. Both carry the shortcut's exact PUT message
  **"Update celebration photo"** — the same message produced by every later uploader commit
  (`6ee5c2a4`, `a6e3f2d9`, `67a5483f`, `b8ac561c`). The cause was the **missing no-input guard** (see the
  2026-10-31 finding): a run with no image sends `content: ""` and GitHub happily commits a 0-byte file.
  No rogue automation was involved; the LaunchAgent leads were a dead end and can be dropped.
- 2026-10-30 — **Manual upload used as a workaround: celebration photo updated.**
  The user's chosen image `IMG_4343.jpeg` (iPhone 14 Pro, 1920×1080, taken 2026-10-29) was copied
  verbatim from the a-Shell Documents folder to `images/celebration/C.jpg` and pushed (`f15e2ee`).
  **Verified live:** `https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg` now returns
  sha256 `d927a485...` (506,871 bytes), matching the repo file (first poll still served the old
  `b45ed281...`; it switched on the second poll).
- 2026-10-30 — **The iPhone's script vs the Mac mirror.** The phone copy of
  `sync_celebration.sh` (v1.2, obtained from the user) is **byte-identical to the Mac mirror**
  `~/Documents/a-shell/sync_celebration.sh` (md5 `b12b6bb0…`), but **differs from the repo copy**
  `iOS/sync_celebration.sh` (md5 `1f9845af…`). The repo copy is a reduced variant: no `Version:`,
  no `cd` guard, no git-identity block, **no `C.jpg` check**, and `lg2 pull` instead of
  `fetch`+`merge`. It has `lg2 add`/`commit`/`push` but no `mv` of `~/Documents/C.jpg` into
  `images/celebration/C.jpg`, so it could not upload the photo even if it ran.
  ⚠️ The phone's output text `ERROR: C.jpg missing` is **not produced by either script copy**
  (the shared v1.2 prints `ERROR: C.jpg not found in Documents folder!`; the old repo copy had no
  check at all) — so the script actually executing on the phone may be a **newer revision not
  present on the Mac**, or the phone's script is edited independently of the Mac mirror.
  **Resolved for the repo:** the user supplied the phone's script, and `iOS/sync_celebration.sh` was
  **replaced with it** (md5 `b12b6bb0…`) so all three known copies are byte-identical. The copy is
  kept **verbatim** (no added header) on purpose — adding a comment header would recreate the drift
  this finding is about. The script's own `# Version: 1.2` line remains the version marker.
- 2026-10-30 — **Two doc facts corrected** (both wrong before): the shortcut saves into
  **a-Shell's `Documents`** folder — iCloud-synced, and visible on the Mac at `~/Documents/a-shell/`
  (same inode) — **not** `~/Documents/SICC-Ryder-Cup/` as DESIGN §10.7.11 claimed; and the resize
  width is **1920**, not 1280 (the v5.0 doc contradicts itself: line 1012 says 1920, line 1025 says
  1280; the live shortcut says 1920).
- 2026-10-30 — **The iPhone's a-Shell folder is inspectable from the Mac**, which is what made this
  diagnosis possible without touching the phone: a-Shell's `Documents` folder is iCloud-synced and
  appears at `~/Documents/a-shell/`. Alternative routes if needed later: `devicectl`
  (`device info files --domain-type appDataContainer --domain-identifier AsheKube.app.a-Shell`) —
  currently blocked by **Developer Mode being off** on the iPhone — or iMazing's GUI. Still not
  reachable: the iPhone's own copy of `sync_celebration.sh`, whose error wording (`C.jpg missing`)
  differs from both the Mac mirror (`C.jpg not found in Documents folder!`) and the repo copy, i.e.
  the three copies have drifted.
- 2026-10-29 — **Pre-match test run (all suites on PROD, deployed == `main`, 0 file diffs):**
  Suite A 1/1, Suite B 1/1 (4-device realtime, both directions, TR=19, 16 matches),
  `prod-regression` 12/12, `hcp-postgame-regression` 9/9, rejoin R2/R5/R7 PASS, UI-surfaces
  14/14 (new tool `automated-tests/tools/verify-ui-surfaces.js`). Verified flow: score all 18 →
  sign both → GAME COMPLETED → auto history `_H` (finalResults 14:5 + adjustedHandicaps) →
  celebration photo (live + cold viewer) → viewer/history read-only scorecard → handicap table →
  post-game. Admin: hub, manage-games (list + PIN-guarded delete), setup-game, courses,
  player-management, auth PIN (wrong-PIN reject + 5-attempt lockout).
- 2026-10-29 — **Harness bug FIXED:** `automated-tests/helpers/game.js deleteTestGame()` was
  hardcoded to `scheduledGames`, so every full-flow tool's `_H` cleanup was a **silent no-op**
  (error swallowed by the caller's `.catch()`). It orphaned 2 test records in PROD `historyGames`
  (`GM_261029_1103_84_H`, `GM_261029_1104_53_H`) — both now deleted. `deleteTestGame()` now also
  deletes `historyGames/<gameId>_H` (validated: both collections cleaned).
- 2026-10-29 — Rejoin scenario **R1 FAIL was a harness close-race, not an app bug**: the test
  closed the F1 page immediately after the last save, aborting in-flight Firestore writes (so
  only part of F1's own holes reached Firestore). With persistence verified before close, F1
  fully re-synced own H1-5 + F2 H1-10. R2/R5/R7 rejoin cases passed.
- 2026-10-29 — App nuance (documented, low real-world risk): Firestore runs **online-only**
  (no `enablePersistence`), so a scorer tab closed *immediately* after a save can lose a write
  that has not yet been ACKed. WRV retries *failures*, but cannot flush writes on tab close.
  Scorers keep the page open, so normal play is unaffected.
- 2026-10-29 — `view-history.html` **ignores `?gameId=`** (it opens the record LIST); a record is
  opened via its `.btn-scorecard` button. (Corrected an earlier assumption.)
- 2026-08-10 — VS Code's history list (`/sessions`) is driven ONLY by `chat.ChatSessionStore.index`
  in `state.vscdb`; VS Code never scans `chatSessions/`. Restoring `.jsonl` requires rebuilding the
  index (`chat_index_lib.sync_index`). Single source of truth lives in `backup/`
  (`restore-chat-history.template.sh` + `chat_index_lib.py`).
- 2026-08-11 — `pgrep -f "…/Contents/MacOS/Code"` never matches inside the VS Code sandbox; use the
  broad guard `pgrep -f "Visual Studio Code"` in restore scripts.
- 2026-08-12 — Renaming a folder's CASE changes the VS Code workspace hash (hash is case-sensitive
  even on case-insensitive APFS). Renaming to lower-case created a second identity (`b0806d73…`);
  the restore flow was re-run there.
- 2026-08-12 — Several registry entries pointed at folders that were MOVED/ARCHIVED, not renamed
  (deepseek → `_Archive/deepseek-balance-extension-vscext`; old SICC container → `_Archive/`).
  Cleaned from the registry; their backup data stays in `backup/repository/`.
- 2026-08-14 — Moving a project into a category folder changes the workspace hash AGAIN; the chats
  were re-synced into the new identity (`0a844743…`). Note: 4 of 5 titles there show the ORIGINAL
  (unprefixed) titles — re-run `rename-clean-chats.py --project "…/W/sicc-ryder-cup"` if consistent
  date prefixes are wanted.
- 2026-08-14 — Cache-busting audit: most pages hardcode `<script src="js/X.js?v=…">` tokens that had
  drifted from versions.json (e.g. hcp-adjust.html loaded game-data.js?v=2.08 while the file is v4.13 —
  stale-cache hazard); 7 pages had no `?v=` at all. Only `real-game.html` uses the `load-game.js`
  universal loader (versions.json = single source of truth).
- 2026-08-14 — `staging` carried garbage commits `17e096d }}}}}}}` + `7c0d01f {{{{{{{` (the latter deleting
  celebration photo `GM_260625_1819_97_H.jpg`); both local + `origin/staging` reset to `main` (23463b1)
  and force-pushed.

## Open questions
- **Connection-loss hardening not applied** (audit 2026-10-31): write timeout + clear the
  `WRVInProgress` flag in a `finally` + watchdog, defer (do not drop) realtime updates while the
  flag is set, enable Firestore offline persistence, and surface connection state in the UI.
  Recommend (1) and (2) first — they are small and stop a hung write from muting the listener.
  Not done unilaterally: they change live scoring behaviour.
- **Firestore has NO write protection** (found 2026-10-31, unauthenticated `PATCH` → HTTP 200).
  Should writes require auth while reads stay public? Not changed — needs the user's decision.
- Cause A's fix was verified against the **live** flag shape; the next real game is the true
  end-to-end confirmation (no PROD game from 2026-10-31 onward yet).
- The 2026-10-31 game's `historyGames/_H` record was **repaired by hand** (backfilled
  `celebration`). Decide whether any other archived record needs the same backfill — only the
  latest game is affected in practice, because the `C.jpg` fallback happens to be correct for it.
- Older archives (`GM_260606_1010_13_H`, `GM_260619_1148_78_H_R`) do have `celebration`; the
  `GM_261029_*` celebration files in Storage have no matching archive record.
- (2026-10-29) Track: real-time **tab-close data loss** risk on scorers (online-only Firestore).
  Mitigation options: enable offline persistence, or a small "saving… keep page open" guard on
  the scorer. Not blocking Saturday; needs a decision before any change.
- Re-run rename+clean for the `W/sicc-ryder-cup` identity to make chat-title date prefixes consistent?
- Confirm each of the 13 per-project `AD-HOC.md` "Rename & Clean chat sessions" tasks completes as
  each project is opened (the next chat session in that folder drives it, then empties the file).
- If `deepseek` / the old SICC container are ever un-archived, re-add them via the web app.

## Next steps
- **All 2026-10-31 fixes are committed, pushed and live on PROD** (Cloudflare Pages deploys on push
  to `main`): celebration-data.js 1.01, celebration-photo.js 1.22, sign-card.js 1.43,
  load-game.js 1.06, post-game.html 1.14, hcp-adjust.html 1.41, **real-game-save.js 1.43**,
  versions.json META 1.05. Verified in a browser on PROD after deploy.
- **User-side smoke test (iPhone, PROD):**
  1. Main Menu → **GAME DAY** opens TODAY's celebration (Team A 10–9) with the **real** photo,
     without going through "View Previous Game".
  2. The scorecard's **T-2 row** reads `A10 A10 A9 A10 A10` at holes 14–18, with **no green
     squares** and the gold still on hole 14.
  3. The **next real game** is the true end-to-end confirmation of the T-2 code fix
     (`real-game-save.js` v1.43) — it only exercises when two scorers save holes out of order.
- Decide the Firestore write-auth question above before the next game day.
- **Confirm the uploader on the iPhone (2026-10-31).** Fixes in place and each verified by running:
  missing `Bearer ` prefix, missing no-input guard, and the **quarantine/hidden state that stopped it
  appearing in the share sheet**. The installed `pk=129 UploadPhoto` has been patched and is
  **un-quarantined, visible, guarded, and has `Show Result`** so the next run reports its outcome.
  Latest delivered file sha256 **`97b600d0…`** (iCloud `.../CloudDocs/Upload/UploadPhoto.shortcut`, copy in
  `~/Downloads/`).
  **On the iPhone — prefer route 1:**
  1. **Let iCloud sync the fixed shortcut down** (fastest, no import). Watch briefly for the sync-conflict
     behaviour noted above; the correct copy must show a token starting `github_pat_` at step 1.
  2. Only if needed, import the file. ⚠️ Importing through the **Files** app is what **quarantined and
     hid** the shortcut last time and stopped it appearing in the share sheet — so after any import,
     **verify it is actually offered in the share sheet** before relying on it.
  Then Photos → Share → **UploadPhoto** on a real photo and confirm a new commit on `main`.
  **The run now shows a result** (commit JSON on success, exact error text on failure) — report what it
  says if anything goes wrong.
- **Never tap/run the uploader without a photo** as a "test". Until you confirm the guard is present on
  the phone, a no-image run **wipes `C.jpg` to 0 bytes**.
  **⚠️ CORRECT recovery recipe — you MUST use the blobs API, not the Contents API:**
  `GET /repos/prapi01/SICC-Ryder-Cup/contents/images/celebration/C.jpg?ref=<good-commit>` returns
  **`content: ""` with `encoding: "none"` for any file over ~1 MB** (usually `encoding: "base64"` for
  smaller files). Writing that empty string back via PUT therefore **writes a 0-byte file** — exactly the
  mistake made on 2026-10-31 (`196db416`), which deepened the damage instead of repairing it.
  Instead: take the good commit's **blob sha**, then
  `GET /repos/prapi01/SICC-Ryder-Cup/git/blobs/<blob-sha>` → returns full `encoding: base64` content
  regardless of size (verified: 2,007,336 base64 chars for the 1,480,820-byte photo), and PUT that back
  with the current contents `sha`. Preferred good commits for `C.jpg`: **`8597b4f5`** (1,480,820 bytes,
  blob `f844b46b…`, restored as `16bfeec6`) or `b8ac561c` (635,029 bytes).
- **ROTATE the `gh` OAuth token AND the photo PAT.** Both were used in plaintext during testing, and the
  PAT is **baked into `UploadPhoto.shortcut`** (readable by anyone who obtains the file).
- **Delete the leftover a-Shell artifacts** once the new shortcut works: the `C.jpg` folder in
  `~/Documents/a-shell/` and `iOS/sync_celebration.sh` (now dead code — the API path replaces it).
- Saturday 2026-10-31: play the real game `GM_260914_1342_52` (SICC Millennium-Peirce) — flow
  verified green 2026-10-29 on v4.00.
- Decide whether to mitigate the scorer tab-close write risk (see Open questions).
- Open each project once so its `AD-HOC.md` rename+clean task runs (then it self-empties).
- See `backup/HANDOVER.md` for chat backup/restore operating instructions.
