# sicc-ryder-cup — HANDOVER Log

> Running project log. Updated after every milestone: new decisions, design changes,
> new technical findings. Read at the start of every session. Updated 2026-10-30.

## Current status (2026-10-30)
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
- 2026-10-31 — **Rapid repeat runs are NOT a failure mode (a theory tested and disproved).** Three runs
  4 s apart at 07:21:08/12/16 SGT all succeeded (`60aa0b97`, `e4fd7a41`, `fe2d31c0`). Combined with
  three successes 18–40 s apart from the iPhone earlier, the "Contents API `max-age=60` stale sha → 409"
  hypothesis is **refuted** — do not pursue it.
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
- (2026-10-29) Track: real-time **tab-close data loss** risk on scorers (online-only Firestore).
  Mitigation options: enable offline persistence, or a small "saving… keep page open" guard on
  the scorer. Not blocking Saturday; needs a decision before any change.
- Re-run rename+clean for the `W/sicc-ryder-cup` identity to make chat-title date prefixes consistent?
- Confirm each of the 13 per-project `AD-HOC.md` "Rename & Clean chat sessions" tasks completes as
  each project is opened (the next chat session in that folder drives it, then empties the file).
- If `deepseek` / the old SICC container are ever un-archived, re-add them via the web app.

## Next steps
- **Confirm the guarded uploader on the iPhone (2026-10-31).** The missing-no-input guard is **fixed and
  verified** (run with a photo → HTTP 201, commit `edf0bcfc`), and the corrected file sha256
  **`06d35668…`** is delivered to iCloud `…/CloudDocs/Upload/UploadPhoto.shortcut` (copy in `~/Downloads/`).
  The installed `pk=129 UploadPhoto` on this Mac **has already been patched** with the guard.
  **On the iPhone — one of two routes:**
  1. Let iCloud sync the patched shortcut down (fastest, but watch for the sync conflict noted above), or
  2. Import the delivered file fresh: Files → iCloud Drive → Upload → `UploadPhoto.shortcut` → tap → Add
     Shortcut, then delete any older `UploadPhoto`/`CelebrationPhotoUpload` entry.
  Then Photos → Share → **UploadPhoto** on a real photo and confirm a new commit on `main`.
  **Sanity check first:** step 1 of the shortcut must show a token starting `github_pat_` (not the word
  `PASTE_YOUR_GITHUB_TOKEN_HERE`) — if it shows the placeholder, it is the stale copy and will 401.
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
