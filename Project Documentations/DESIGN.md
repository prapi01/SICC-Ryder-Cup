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
  `~/Library/Mobile Documents/com~apple~CloudDocs/Upload/UploadPhoto.shortcut` (iCloud Drive)
  with a copy in `~/Downloads/`. Signed artifacts are **AEA1 encrypted archives** — the action graph
  cannot be read back out of a signed file, so verify the **source** plist before signing.
  **2026-11-01 delivery:** the v3 (13-action) file is sha256 **`c1803ef9...`** / 23,881 B in **both**
  locations (byte-identical, verified), signed with `--mode anyone`; the previous `37d8a8b7...` is
  backed up. Always re-verify both copies match the built artifact — the device may sync from either.
  **⚠️ 2026-10-31 — verify the DELIVERED ARTIFACT, not just the local install.** The delivered copies
  had drifted into an **older 8-action graph** (no `Show Result`, no no-input guard) while the Mac held a
  working **10-action** graph. Because a signed file's graph is unreadable, that drift went unnoticed
  across several rounds. Always check the action count/graph of the artifact the device will actually run.
  **⚠️ 2026-10-31 — keep the Shortcuts library audited, and snapshot its DB correctly.** Repeated signed-artifact
  imports leave rows the Shortcuts UI does not show (orphaned action blobs, run events and icons). The
  library must keep **exactly one image-accepting uploader**, and library hygiene must not be judged by
  **name**: several unrelated shortcuts match `Photo`/`Upload`. Two hard rules: (a) take a consistent
  snapshot with `sqlite3 <db> ".backup <dest>"` — a plain `cp` omits the `-wal` and therefore reports
  **stale counts**; (b) quit the Shortcuts app before any surgery, and beware the `AFTER DELETE` CoreData
  trigger on `ZSHORTCUTRUNEVENT` (see the HANDOVER finding for the verified workaround). After any such
  surgery, **run the uploader for real** — DB cleanliness is not evidence the graph still works.
- **2026-11-01 — Uploader v4 (current): NO comparison at all; the run SHOWS the uploaded photo.**
  **✅ NOW NAMED `UploadPhoto-C.jpg`** (user rename, 2026-11-01; verified installed pk=159, 14 actions).
  The `UploadPhoto-004` name used throughout these docs refers to **this same 14-action build** — read
  them as synonyms. The library now holds exactly `UploadPhoto-C.jpg` + `Rename To C.jpg`.
  **Device-tested repeatedly by the user: "all successful"; 7 real uploads landed on 2026-11-01.**
  **14 actions** (v3 was 13; the user added a trailing `Stop and output`). Chain: token → resize 1920 /
  JPEG 0.9 / base64 → `GET` current `sha` → `PUT` (**`branch: main` in the JSON body**) → read
  `commit.sha` **from the PUT's own response** → **read the file back from GitHub and display it**.
  The `IF`/`ELSE` block is **deleted**.
  **Hard rule — never compare anything in the shortcut.** The Contents API `PUT` is **idempotent and
  always returns HTTP 200 + `content.sha`**; a sha/"did it change" comparison therefore **cannot
  prevent a failure and can only invent one**, which is exactly what v2 did (a fully successful upload
  took the `Else` branch and printed "⚠️ UPLOAD FAILED"). The user's own rule — *"why compare anything?
  when the user uploads, just make sure it lands"* — is now the design. The displayed photo **is** the
  proof, so no separate success test is needed or wanted.
  **Design decisions, each measured:**
  - **⚠️ CORRECTED 2026-11-01 — the read-back MUST use `raw.githubusercontent.com` with an IMMUTABLE
    commit-sha URL.** The previous entry here claimed the Contents API with
    `Accept: application/vnd.github.raw` could be rendered as an image by Shortcuts. **That is false,
    and it caused an empty result dialog on the device.** Measured:
    `Accept: application/vnd.github.raw` returns the right **bytes** but
    `content-type: application/vnd.github.raw; charset=utf-8` — **not an image** — so Shortcuts has
    nothing renderable and the sheet opens **blank**. `Accept: image/jpeg` is rejected with **415**, and
    `media.githubusercontent.com` **404s** for this path.
    `https://raw.githubusercontent.com/prapi01/SICC-Ryder-Cup/<commit-sha>/images/celebration/C.jpg`
    returns **`content-type: image/jpeg`** (byte-identical content) and **does** render.
    **Use the commit sha**, read from the PUT's own `commit.sha`: it makes the URL immutable, so that
    host's `max-age=300` cannot serve a stale image. **Do not use `main` in that URL** — branch URLs are
    mutable and cached.
  - **⚠️ The result dialog's `Text` MUST be a `WFTextTokenString` containing a `\ufffc` placeholder,
    with the attachment in `attachmentsByRange`.** A bare `WFTextTokenAttachment` renders an **empty**
    dialog. This was the actual cause of the blank sheet (see HANDOVER). Copy the shape from a working
    shortcut rather than hand-rolling it.
  - **The `?cb=<sha>` cache-buster on the read-back is NOT needed with a commit-sha URL** and does
    nothing for `raw.githubusercontent.com` anyway (verified: it ignores cache-buster query strings).
  - **The pre-upload `GET sha` must stay** — the Contents API rejects an update to an existing file
    without it (verified: `422 Invalid request. "sha" wasn't supplied.`). It is a *requirement*, not a
    check.
  - **How to build/rebuild it:** assemble the actions as a **binary plist** and sign with
    `shortcuts sign --mode anyone` (**`--mode anyone` is the mode that worked on the device**; the CLI
    default was never used for a successful delivery). Feed the signer a **plist**, not JSON — JSON is
    rejected outright. A signed file is an **AEA1 encrypted archive**, so its graph is unreadable
    afterwards: validate the **unsigned** plist (action count + zero dangling `ActionOutput` refs)
    before signing.
  - **⚠️ There is exactly ONE photo slot: `C.jpg`.** The app hardcodes it
    (`js/celebration-photo.js`, `js/util-photo.js`, `util-record-management.html`) and
    `images/celebration/` holds only `C.jpg`. The multiple "Upload Photo" entries seen in the iPhone
    share sheet were **leftover test shortcuts**, not slots — do not design a slot picker.
- **2026-10-31 — Uploader v2 (superseded 2026-11-01; kept for the evidence it produced).** The shortcut
  was **19 actions**: token → resize 1920 / JPEG 0.9 / base64 → `GET` current `sha` → `PUT`
  (**`branch: main` in the JSON body**) → read back `content.sha` → **IF** a new sha came back →
  **read the file back from GitHub and display it** (**ELSE** → fetch GitHub's `message` and display it).
  **What v2 got right (kept in v3):** the raw read-back; the discovery that Shortcuts **continues past
  an HTTP error** (a 404 download did not stop the next action), so a failed upload still "completes";
  and the `IF`/`ELSE`/`END IF` encoding (`WFControlFlowMode` 0/1/2 sharing one `GroupingIdentifier`).
  **What v2 got wrong:** the sha comparison itself — see the v3 hard rule above.
- **2026-10-31 — VS Code tool cap (`"only supports 128 tools"`).** Not app code, but it was degrading
  this project's own AI workflow. Root cause: a **hard-coded** `var lJ=128` in VS Code's agent host
  (`ByokLmProxyService`, `vs/platform/agentHost/node/agentHostMain.js`) that **silently drops** tools
  beyond 128 when routing to a BYOK model (every request went to `deepseek-v4-flash`). It is **not**
  configurable: `chat.virtualTools.threshold` is a different mechanism (virtual toolsets) and does not
  raise the ceiling. **Fix: reduce the tool count below 128.** Disabling the built-in **GitHub MCP
  server** is the intended lever (the **`gh` CLI** already covers PRs/issues) — but note the two
  same-named settings: the agent host reads **`chat.agentHost.githubMcpServer.enabled`**, *not* the
  Copilot extension's `github.copilot.chat.githubMcpServer.enabled`. Setting the wrong one changes
  nothing at all. Also measured: the **agent host is an app-level process**, so it only picks up config
  on a **full VS Code restart** — a window reload restarts the extension host only, and leaves the
  agent host (and its stale MCP state) untouched. Counted budget: core **38**, `firebase` **66**,
  `github-mcp-server` **18**, `cloudflare` **4**, Pylance **6** = **131**. See HANDOVER for the evidence.
  **⚠️ Neither GitHub setting actually works (verified 2026-10-31 22:37, after a full app restart —
  count still 131).** The mechanism that *is* proven on this machine is the per-server enablement gate:
  `globalStorage/agent-host-storage.json` → `customizationEnablement.global["mcpServers#<name>"] = false`
  (that is how `supabase` shows as `disabled (stopped)`, and it is what the warning's **"Configure
  Tools"** link writes). Failing that, the decisive lever is **`.mcp.json`**: `firebase` alone supplies
  **65 of 131** tools — about **half the entire budget** — so removing it alone clears the cap with
  large margin. **Acceptance test: the `sending N of M tools` count must fall below 128 — never the
  setting being written.**
  **✅ RESOLVED 2026-10-31 22:55 — via the "Configure Tools" UI, by disabling `firebase`.** Verified:
  14 drop lines before the toggle, **0** after. **Standing rule: manage VS Code tool/MCP enablement
  through Configure Tools only.** Settings keys do not control it (the two `...githubMcpServer.enabled`
  variants are red herrings for this purpose), and hand-editing storage fails because the host
  **prunes any enablement key it does not already know**. The authoritative store is
  `globalStorage/state.vscdb` → `ItemTable.mcp.enablement`, a JSON array of `[key, enabled]` pairs whose
  keys encode the **config-source path** (e.g. `workspace-dot-mcp.0.firebase`), **not** the server name —
  which is why the key cannot be guessed. The agent host is also **app-scoped**: config changes need a
  full quit-and-reopen, not a window reload.
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
  **⚠️ `GITHUB_PHOTO_URL` stays pointed at the Cloudflare CDN — verified correct 2026-11-01.**
  `checkPhotoChanged()` compares the CDN's `ETag` and `content-length` against `localStorage` to decide
  whether to re-pull the photo. **The CDN `ETag` IS content-derived** (measured: `66ff11a5…` @ 294,112 B
  → `b048020b…` @ 641,989 B; prod vs staging differ for different content), so this check is sound and
  **must not be "fixed"** by repointing it at `raw.githubusercontent.com` — that idea was proposed on a
  false premise and retracted. **Do distinguish two different things:** the ETag *value* tracks content
  correctly, but the *file* the CDN serves can sit behind the repo while a Pages deploy is pending
  (measured hours-long lag). Lag is a propagation property of Pages, not an ETag defect, and it was
  **not** the cause of the 2026-10-31 placeholder incident (that was cause A).
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
- **2026-11-01 — LIVE-GAME PHOTO PIPELINE: the app reads a FIREBASE copy, not GitHub, and the refresh
  step is what guarantees freshness.** This is the architecture behind "will the app see the new `C.jpg`?",
  verified in code and against live services:
  1. **Detection (in-round, F1 only):** `triggerPhotoCheck()` ([real-game-save.js:256]) runs after **every**
     hole save — cascade and normal paths, **no hole limit** — so it fires at the **final hole** as well.
     It calls `checkAndRenameCelebrationPhoto()` → `checkPhotoChanged()`, which `HEAD`s
     **`GITHUB_PHOTO_URL`** (the **Pages CDN**, `max-age=0, must-revalidate`) and compares the **ETag**.
  2. **Snapshot:** on a change the CDN image is downloaded (`addCacheBuster()`), compressed, uploaded to
     **Firebase Storage** at the fixed path `celebration/<gameId>_H.jpg`, verified, and
     `scheduledGames/<gameId>.photo` is set to `{newPhotoAvailable:true, f2Downloaded:false,
     viewDownloaded:false, imageUrl}`.
  3. **At game end:** `sign-card.js` calls **`copyCelebrationPhoto()`**, which **re-reads the same CDN URL**
     and writes `historyGames/<gameId>_H.celebration.imageUrl`. **This refresh step is what makes a late
     upload visible.**
  4. **Readers use the Firebase copy only:** `getCelebrationPhoto()` reads
     `historyGames/<gameId>_H.celebration.imageUrl`; Viewer **and** Celebration both go through it.
     Firebase Storage sends **`cache-control: private, max-age=0`** and the app appends `?t=` — so there is
     **no client-side stale-cache path**.
  **Consequence:** GitHub/CDN staleness **cannot** reach the celebration, because at celebration time the
  app never reads GitHub — it reads Firebase, which the app itself wrote by downloading from the CDN.
  **Verified on real PROD data:** `scheduledGames/GM_260914_1342_52` has `photo.newPhotoAvailable: true`
  with `photo.imageUrl` **and** `celebration.imageUrl` identical, both pointing at
  `celebration/GM_260914_1342_52_H.jpg` — steps 2 and 3 both completed for a real game.
  **Two properties to keep in mind, both deliberate:** the check runs **every** hole (≈18 redundant
  re-uploads per round — harmless), and the **CDN must have deployed the photo before the check runs** —
  measured deploy latency **~20 s**, negligible against a multi-hour round.
  **⚠️ TWO KNOWN TRAPS (both bit us):** (a) **`loadDefaultCelebrationPhoto()` must never overwrite a
  broadcast photo** — that was Cause A of the game-day placeholder bug, fixed in **v1.22**; (b) the
  **photo slot is shared** (`celebration/C.jpg` is a single file and the archive stores only a
  **pointer**), so the CDN copy and the Storage snapshot must be replaced together or a historical game
  silently keeps the wrong photo.
- **2026-10-31 — T-2 row could show a stale "all square" (green squares) at holes whose data was
  saved late.** The T-1/T-2 result arrays are written per position, and the cascade that repairs
  earlier positions is gated by `if (currentPosition < lastSyncedPos)` — a **strict `<`** that skips
  the current position. If the second flight saves a hole after that position was already written
  with the other flight's data missing, the stale value survives. A row value of `'AS'` renders as
  the green `as-square` (`getAsSquareHtml()`, whose CSS background is hard-coded `#4caf50`, so it
  ignores the `score-grey` class). Reproduced exactly with the app's own `GameTeam.
  calculateWithClinched()` on the 2026-10-31 game: only F2 positions 15/16 were stale (`0`/`'AS'`
  instead of `9`/`10`). The live documents were repaired with the app-computed values, **and the
  code was fixed**: `real-game-save.js` **v1.43** now republishes `results.game2` for all 18
  positions before serializing the payload (the same invariant `game3`/Strk already had), so a
  stale position cannot be published again. Clinch computation is unchanged, so the gold cell does
  not move; the cascade guard was deliberately left alone to avoid changing live save behaviour.
- **2026-10-31 — Connection-loss handling is minimal, and a hung write can mute the realtime
  listener.** Firestore **offline persistence is not enabled anywhere**, and there is no
  `online`/`offline` awareness, so a read taken during a network dip is a permanent cache miss — a
  scorer can be left without another flight's hole data (observed 2026-10-31: F1 could not see F2's
  H16/H17, which is also what produced the stale T-2 row). A write issued while offline **never
  resolves or rejects** (measured, SDK 10.8.0), which defeats two defences: `writeWithWRV()`'s
  retry loop only runs on `.catch`, and `wruBackground()`'s `WRVInProgress` flag is cleared only in
  the write callback — so the flag stays set and `real-game-init.js` then **silently ignores all
  incoming realtime updates** (`if (RealGameState.isWRVInProgress()) return;`). What *is* in place:
  WRV verify-after-write + unlimited backoff retries (1–60 s) on error, and a `localStorage`
  pending-writes queue resumed on re-entry.
  **WRV's lost-connection RECONCILIATION (`WRV.recover()`) — was orphaned, now RESTORED.**
  It was dead code from **2026-06-26 to 2026-10-31**: `game-data.js` **v4.03 (2026-06-26 15:31)**
  removed `saveCurrentHole()`'s own Firestore write, which also removed the v4.01
  `startWRVVerification()` call sites that sat in that write's `.then()`/`.catch()` — leaving the
  function defined and exported but never called. During that window the app retried writes **on
  error** but never detected or healed silently-lost data (the 2026-10-31 incident: F1 could not
  see F2's H16/H17). **Fixed in `game-data.js` v4.14 / `wrv.js` v1.15:** the reconcile runs
  **after each score save (15 s delay**, so the consolidated write lands first**)** and on an
  **idle 60 s tick**, so a silently-out-of-sync device heals without saving. It writes **only the
  own flight's** `f<n>.d`/`f<n>.se` with **local truth**, so one scorer can never overwrite the
  other's holes, and it stops once in sync. `wrv.js` v1.15 also fixes `recover()` never calling
  `options.onComplete`.
  **Delivery hardening applied 2026-10-31** (`wrv.js` 1.16 / `real-game-save.js` 1.44 /
  `real-game-init.js` 1.17): (a) background writes pass `timeoutMs: 20000` so a hung offline write
  fails and WRV's backoff retry engages instead of blocking for ever; (b) `WRVInProgress` is now an
  outstanding-*counter* with a **120 s watchdog**, so it can never stay set and mute the device;
  (c) a snapshot arriving mid-write is **deferred and replayed**, not dropped (re-entrancy-guarded
  because the replay re-enters the handler). **Still open:** enabling Firestore offline persistence
  (needs testing against the T-2 fix — reconnect-flushed out-of-order writes would change save
  ordering) and surfacing connection state in the UI.
- **2026-10-31 — ⚠️ OPEN: iPhone photo-upload shortcut NOT working (handed off).** The one-click
  Photos-share-sheet uploader (Shortcut → `PUT contents/images/celebration/C.jpg` on `main`) is the
  only unresolved item from this session. It has been through **several successive distinct causes**
  — a-Shell writing into a folder named `C.jpg`; a missing `Bearer ` prefix prefix (401); an orphaned
  edge-function target removed from `wrangler.toml`; a missing `WFWorkflowNoInputBehavior` so a
  no-input run committed a **0-byte** `C.jpg`; the shortcut becoming **quarantined/hidden** (invisible
  in the share sheet) after a Files-app import; **two** competing image-accepting upload shortcuts;
  and an **iCloud sync-conflict clone** carrying the stale graph. Each was fixed and verified by
  running it, yet the user still reports failure, so the next step is to establish the **artifact
  identity** and the **actual error text** rather than revisit the same graph. Handoff details live
  in `AD-HOC.md` (gitignored). Standing rules that must not be forgotten: exactly ONE upload shortcut
  may accept share-sheet images; never import via the **Files** app (it quarantines); `?branch=` is
  ignored by the Contents API (branch must be in the JSON body); and to restore any image **> 1 MB**
  use `GET /git/blobs/<sha>` because the Contents API GET returns `content: ""`.
  **⚠️ 2026-10-31 — STANDING RULE: never leave a test shortcut where it can sync to the iPhone.**
  iOS Shortcuts are **synced per-device**; deleting a shortcut from the Mac's library does **NOT**
  delete it from the phone, and the Mac has **no interface to delete a shortcut on the device**. Eleven
  test shortcuts created during debugging (`After404S`, `ErrOutS`, `OkTestS`, `ErrTestS`, `FailTestS`,
  `ReadbackTestS`, `UploadPhoto 3/4`, `UploadPhoto_signed`, `UploadPhotoFinal`, `Upload-Photo 2`)
  survived a Mac-side cleanup and were still offered in the iPhone's share sheet, **each of them
  writing the same `C.jpg`** — so a wrong pick is indistinguishable from a broken shortcut.
  **Rules, in order of preference:**
  1. **Do not create test shortcuts on the Mac at all.** Test the HTTP layer with `curl` against the
     Contents API, and the action graph by reading the plist from
     `~/Library/Shortcuts/Shortcuts.sqlite` (`ZSHORTCUTACTIONS.ZDATA`). Neither touches the device.
  2. If a test *must* be imported to verify Shortcuts-engine behaviour, **name it so it cannot be
     confused** (e.g. `ZZ-test-<what>`), and **delete it on the iPhone** as part of the same task —
     the Mac delete alone is incomplete.
  3. **Cleanup is not complete until the iPhone's share sheet is checked.** The Mac library being clean
     is **not** evidence the device is clean; assert it explicitly and say which device you verified.
  **Never report a shortcut cleanup as done on the basis of the Mac library alone** — that is exactly
  the error made here.
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
