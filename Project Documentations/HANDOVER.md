# sicc-ryder-cup — HANDOVER Log

> Running project log. Updated after every milestone: new decisions, design changes,
> new technical findings. Read at the start of every session. Updated 2026-10-30.

## Current status (2026-10-30)
- SICC Ryder Cup Firebase web app — **Version 4.0.0** shipped 2026-08-10 (Team One rename,
  v3.0.0 regression fixes, automated QA harness). Verified on production.
- **2026-10-30 — iPhone celebration-photo upload pipeline: ROOT CAUSE FOUND (not yet fixed).**
  The iPhone Shortcut "Upload to Github" stopped uploading. Cause: its `Receive Images` action has
  **Select Multiple** on, so the "Save File → a-Shell, Subpath `C.jpg`" action saves the image
  **into a folder named `C.jpg`** instead of writing a file named `C.jpg`; the sync script's
  `[ -f ~/Documents/C.jpg ]` test is then false and it exits at `ERROR: C.jpg missing` before
  `add`/`commit`/`push`. **Fix: turn OFF *Select Multiple* in the `Receive Images` action**
  (approved: shortcut-side only; script logic unchanged), delete the stale `C.jpg` folder, and turn
  off *Keep going after an error* so failures are no longer masked. Details in "Technical findings".
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
  **Fix (approved): shortcut-side only** — turn OFF *Select Multiple* in the `Receive Images` action,
  delete the stale `C.jpg` folder so the next run writes a real file, and turn OFF *Keep going after
  an error* on the a-Shell "Execute Command" action so a failure is no longer masked by a trailing
  `--- Sync Complete! ---`. Script logic is unchanged and correct for a single file.
- 2026-10-30 — **The iPhone's script vs the Mac mirror.** The phone copy of
  `sync_celebration.sh` (v1.2, obtained from the user) is **byte-identical to the Mac mirror**
  `~/Documents/a-shell/sync_celebration.sh` (md5 `b12b6bb0…`), but **differs from the repo copy**
  `iOS/sync_celebration.sh` (md5 `1f9845af…`). The repo copy is a reduced variant: no `Version:`,
  no `cd` guard, no git-identity block, **no `C.jpg` check**, and `lg2 pull` instead of
  `fetch`+`merge`. It has `lg2 add`/`commit`/`push` but no `mv` of `~/Documents/C.jpg` into
  `images/celebration/C.jpg`, so it could not upload the photo even if it ran.
  ⚠️ The phone's output text `ERROR: C.jpg missing` is **not produced by either script copy**
  (the shared v1.2 prints `ERROR: C.jpg not found in Documents folder!`; the repo copy has no check
  at all) — so the script actually executing on the phone is a **third, newer revision not present
  on the Mac**, or the script was edited on the phone since the Mac copy last synced.
  The repo's `iOS/sync_celebration.sh` should therefore be treated as **not canonical**.
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
- (2026-10-29) Track: real-time **tab-close data loss** risk on scorers (online-only Firestore).
  Mitigation options: enable offline persistence, or a small "saving… keep page open" guard on
  the scorer. Not blocking Saturday; needs a decision before any change.
- Re-run rename+clean for the `W/sicc-ryder-cup` identity to make chat-title date prefixes consistent?
- Confirm each of the 13 per-project `AD-HOC.md` "Rename & Clean chat sessions" tasks completes as
  each project is opened (the next chat session in that folder drives it, then empties the file).
- If `deepseek` / the old SICC container are ever un-archived, re-add them via the web app.

## Next steps
- **Fix the iPhone shortcut (user-side, 2026-10-30):** in "Upload to Github", open the
  `Receive Images` action and turn **OFF *Select Multiple***; then delete the stale
  `Documents/C.jpg/` folder in a-Shell **before** the next run so the save writes a real file (a
  Save action will not replace a folder of the same name); optionally turn off *Keep going after an
  error* on the a-Shell "Execute Command" action so failures are visible. Then verify: share one
  photo → expect a new `Update celebration photo` commit and the site
  `images/celebration/C.jpg` updating.
- Saturday 2026-10-31: play the real game `GM_260914_1342_52` (SICC Millennium-Peirce) — flow
  verified green 2026-10-29 on v4.00.
- Decide whether to mitigate the scorer tab-close write risk (see Open questions).
- Open each project once so its `AD-HOC.md` rename+clean task runs (then it self-empties).
- See `backup/HANDOVER.md` for chat backup/restore operating instructions.
