# sicc-ryder-cup — HANDOVER Log

> Running project log. Updated after every milestone: new decisions, design changes,
> new technical findings. Read at the start of every session. Updated 2026-11-01.

## Current status (2026-11-01)
- **✅ WRAP 2026-11-01 (21:10 SGT) — milestone closed. Photo pipeline is WORKING; ONE test remains.**
  **Where things stand:** the iPhone→GitHub photo upload and the VIEW feature are **both working** and
  **repeatedly device-tested by the user** ("tested the UploadPhoto and the URL viewer many times ...
  all successful"). The uploader is now named **`UploadPhoto-C.jpg`** (14 actions; the old
  `UploadPhoto-004` is the same build). Repo `main` is `a48c4a0`, clean, pushed, `C.jpg` = 635,029 B.
  **The ONLY outstanding verification: the v1.22 game-day guard in a LIVE round** — a real mid-round
  upload **plus** a viewer/celebration opened afterwards, in the same round. That is precisely the
  combination that failed on the previous game day, so it is the one thing NOT claimed as proven.
  **Practical routine (use this from now on):**
  1. Upload with **`UploadPhoto-C.jpg`** → the run's VIEW sheet shows the photo that landed.
  2. To confirm independently, open **`https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg`** —
     `max-age=0, must-revalidate`, so it is **always current**; its md5 equals the repo blob's.
  3. **Never judge an upload from the GitHub web view** — `blob/...?raw=true` redirects to
     `raw.githubusercontent.com`, which caches **`max-age=300`**, and a reload does **not** bypass a
     fresh `max-age`. Verified ignorable bypasses: `?v=`, `?cb=<ns>`, `Cache-Control: no-cache`,
     `Pragma: no-cache`.
  **Open decisions parked by the user (do NOT act without asking):** (a) `checkPhotoChanged()`'s dead
  `content-length` half → ~18 redundant re-uploads/round, harmless, left alone deliberately;
  (b) **PAT rotation** — explicitly deferred by the user ("ignore the PAT rotation");
  (c) tab-close data-loss risk on scorers (2026-10-29).
- **2026-11-01 — 📌 RESUME HERE (fresh chat):** read this file's **Current status** section only; the
  milestone is closed and nothing is mid-flight. The next real action is the **live-round rehearsal**
  above, which needs a game in progress. Do **not** re-derive the CDN/cache findings — they are settled
  and recorded (section on the 5-minute window + the `checkPhotoChanged()` entry).
- **2026-11-01 — ✅ UPLOADER FINALISED: renamed to `UploadPhoto-C.jpg`, device-tested repeatedly, ALL
  SUCCESSFUL.** The shortcut was renamed by the user from `UploadPhoto-004` to **`UploadPhoto-C.jpg`**
  (verified installed: pk=159, **14 actions**), and the library now holds exactly two upload-related
  shortcuts — **`UploadPhoto-C.jpg`** plus the user's own `Rename To C.jpg`. All the `UploadPhoto-001/002/003/004`
  variants are gone; the tidy-up task is **complete**. **User report: "I have tested the UploadPhoto and
  the URL viewer many times ... all successful".** Corroborated by the repo: **5 more real uploads landed
  on 2026-11-01 at 17:05, 17:07, 17:58, 18:00 and 18:05**, on top of the earlier pair at 16:12.
  **`UploadPhoto-004` below is a historical name for the SAME 14-action build — read it as
  `UploadPhoto-C.jpg` for all current work.**
- **2026-11-01 — iPhone uploader: ✅ VIEW FIXED and confirmed working on the device; deliver
  `UploadPhoto-004` (now `UploadPhoto-C.jpg`).** The upload path had been working all along — the failures seen during this session
  were **mine** (local test runs overwriting `C.jpg`, then a wrong restore). The genuine defect was the
  **VIEW result dialog**, and its cause is now proven: `is.workflow.actions.showresult` had `Text` as a
  raw **`WFTextTokenAttachment`**, where Shortcuts requires a **`WFTextTokenString` containing a `\ufffc`
  placeholder**. Symptom: the sheet opened **completely empty** (just Cancel/Done). Confirmed by
  comparing against the user's own working shortcuts — `Music Quiz` and `Make GIF` both use
  `WFTextTokenString`; `UploadPhoto-003` was the **only** shortcut in the library using the attachment
  form. **`UploadPhoto-004`** fixes it and also points the VIEW read-back at
  `raw.githubusercontent.com/<commit-sha>/...` (returns `content-type: image/jpeg`, so Shortcuts renders it
  as a photo; the Contents API + `Accept: application/vnd.github.raw` returns a **non-image** type and
  renders blank). **User confirmed: "view showing the uploaded photo correctly".**
  Delivered byte-identical to `~/Downloads/` + iCloud `Upload/` (sha256 `406d8b14...`, 24,088 B, 14 actions).
- **2026-11-01 — ⚠️ MY COMMIT CHURN ON `main` — and a CORRECTION to my own first account of it.**
  Diagnosing the above drove a large volume of throwaway commits straight onto `main`, and scratch files
  were committed (`_flowtest.txt`, `images/celebration/_semtest.txt`, `images/celebration/_probe.txt`,
  plus ~55 more `tmp-*`/`_*` probes). Those junk files are all gone from the tip. The final count was
  **405 commits since baseline `9671a4f`** (an earlier "~169" note under-counted).
  **⚠️ CORRECTION — my first write-up called `Update celebration photo` ×126 the "worst offender" and
  implied it was my pollution. That was WRONG.** That string is **the uploader shortcut's own PUT
  message** (documented in this log as such), so those 126 commits are **production device uploads from
  the iPhone — 2 of them landed TODAY at 16:12 while this cleanup was in flight**. Verified discriminator:
  **none of the 126 carry a `Co-authored-by` trailer**, whereas **all 38** of my genuine commits do.
  The 405 splits as: **38 mine** (conventional/WRAP subjects, trailer present) + **126 device uploads** +
  **~241 a mix of my session test churn** (`c`/`t`/`x`/`cleanup`/`probe`/`timing …`) **and the user's own
  manual reverts** via the GitHub web UI (`Restore … (revert AI test uploads)`, `Remove test file`,
  `Add files via upload`). **I cannot cleanly attribute those ~241 from the log alone**, and I should not
  have implied I could. **Standing rule: experiment on a branch — never commit test churn to `main`.**
- **2026-11-01 — HISTORY CLEANUP DONE (405 → 38 commits), content PROVEN identical.** Replayed only the
  38 real commits with `git commit-tree`, each carrying its **own original tree** (preserving author and
  committer dates), then `--force-with-lease`. **`main` is now `d70fa21e`; its tree `119d9746…` is
  byte-identical to the pre-cleanup tree — all 132 blobs match, 132 files on disk, 0 empty commits.**
  **ℹ️ SCOPE OF THE REWRITE — and why it is now fully safe:** it **collapsed the 126 production
  device-upload commits into the 38**, so that individual upload history is no longer in `main`'s
  ancestry. **No photo BYTES were destroyed**, and this is now **permanently protected** — see the
  `archive/photo-uploads` branch entry below. The 58 scratch paths that do not exist at the tip
  (`tmp-*`, `_*`, `__probe__.txt`) were all deleted deliberately before the cleanup — no real content
  lost.
  **Two mechanisms were REJECTED after testing on a clone, never on the real repo:**
  - `git filter-repo --commit-callback` + `commit.skip()` — **destroys content**, not just commits: it
    collapsed 2593 commits → 3 and left only **5 of 132 files** (`C.jpg` gone). A nested `def` in
    `--commit-callback` is also silently never invoked — the callback takes a **body**, not a function.
  - `git filter-branch --prune-empty --commit-filter` — git refuses the combination outright
    (*"Cannot set --prune-empty and --commit-filter at the same time"*).
  **Desync risk checked and cleared:** `staging`, `agents/bugfix-wrong-calculations`,
  `feature/team-one-rename`, `test/sign-submit-prognosis` all contain **0 commits after the baseline**,
  so rewriting `main` cannot desynchronise them. **Never use `commits?path=` to verify a push** (CDN
  cache) — read `git/ref/heads/main`. **Safety nets:** remote branches/tags
  `backup/main-pre-cleanup-20261101-121850` → `3cd69bd1` and
  `backup/main-pre-cleanup-20261101-144625` → `24bb6b25`, plus local refs
  `backup-local-pre-cleanup` / `backup-local-tag-pre-cleanup` → `24bb6b2`.
  **Note for readers:** this cleanup **re-hashed the 38 kept commits** (they now have new sha's), and the
  removed junk commits are gone from `main`. **Every commit sha recorded ABOVE in this log (older
  entries) therefore refers to the PRE-cleanup history** — those objects still resolve because the
  `backup/*` refs keep them alive, but they are **not** ancestors of the current `main`. To inspect one,
  pass it together with a backup ref, e.g. `git show 24bb6b2:js/celebration-photo.js`. Shas written from
  here on refer to the cleaned history.
- **2026-11-01 — `archive/photo-uploads` branch created — the upload history is now PERMANENT.**
  The cleanup above left the 126 device-upload commits reachable only through the `backup/*` refs, which
  would have lost them if blob garbage-collection ever ran. **Fixed properly:** a permanent branch
  **`archive/photo-uploads` → `24bb6b25831edce09fa603db3a6e01898a5a5d06`** (the exact pre-cleanup tip, so
  **zero reconstruction risk**) is **pushed to the remote**. It holds the **full 2,593-commit history**,
  including **all 127 device-upload commits** and **54 distinct `C.jpg` versions** back to 37 KB.
  **Verified from the remote:** the ref equals the old tip, and **0 of the upload commits are missing
  their `C.jpg`**. **This is the answer to "where did the upload history go?"** — it did not go anywhere;
  `main` is clean and the archive keeps every upload. **Do not delete this branch.**
  To recover any historical photo: `git fetch origin archive/photo-uploads` then
  `git show origin/archive/photo-uploads:images/celebration/C.jpg`, or browse the branch on GitHub.
- **2026-11-01 — "the 2nd upload is not working": it DID work — that was a BROWSER cache window, not an
  upload failure.** The two uploads landed at **16:12:08** (`dc8cb66`, 525,990 B) and **16:12:35**
  (`cd84e62`, 517,461 B) — **only 27 seconds apart**. `main`'s `C.jpg` blob (`21069a19…`) is
  **byte-identical to `cd84e62`'s**, i.e. **GitHub holds upload #2** — confirmed three ways: the Contents
  API, `raw.githubusercontent.com`, and the Pages CDN **all serve 517,461 B**. The stale view was the
  **GitHub browser view** only, which redirects `blob/…?raw=true` → `raw/refs/heads/main/…` →
  **`raw.githubusercontent.com`**, and that host sends **`cache-control: max-age=300` (5 minutes)**.
  Every reload inside that window re-served upload **#1** from the browser cache — **reloading does not
  bypass a still-fresh `max-age`.** The window expired at **16:17:08**. **Lesson: never judge an upload by
  the GitHub web view within ~5 minutes of it; verify with `git/ref/heads/main` or the Contents API.**
  This is the SAME trap as the earlier "the shortcut is lying?" false alarm — the browser is the slow
  observer, not the source of truth.
- **2026-11-01 — the app is IMMUNE to that browser-cache path (this is why game day is safe).** The app
  never requests `raw.githubusercontent.com`: `GITHUB_PHOTO_URL` points at the **Pages CDN**, which sends
  **`cache-control: public, max-age=0, must-revalidate`** — a browser is **forbidden** to reuse a stale
  copy and must revalidate every time; and when the app actually **downloads**, it appends a
  cache-buster via `addCacheBuster()` (`js/celebration-photo.js` :430, :609). So a photo that is live on
  `main` **cannot** be masked for the app, however long the browser holds its own copy.
- **2026-11-01 — latent (currently harmless) defect found in `checkPhotoChanged()`.** It probes with
  `fetch(GITHUB_PHOTO_URL, { method: 'HEAD' })` and compares `content-length`, but the CDN's **HEAD
  response omits `content-length`** (verified: HEAD has none, GET has `517461`). So `currentSize` is
  `null` while `SIZE_STORAGE_KEY` stores `currentSize || ''` = `''`, and `null !== ''` is **always true**
  → the function reports "changed" on **every** run. **Today that is protective, not harmful** — the app
  always re-downloads, and that is precisely what makes a stale copy impossible. It does mean the size
  half of the check is dead and the ETag half is never exercised. **Do not "optimise" this without a
  device test** — tightening it could make the app *skip* a real change. Status: **open decision.**
- **2026-11-01 — ✅ ASSURANCE: will the app pick up `C.jpg` during a LIVE game? — traced end-to-end, and
  YES, with one honest caveat.** The chain, verified in code and against the live services:
  1. **Check runs at EVERY hole save, F1 only** — `triggerPhotoCheck()` ([real-game-save.js:256]) is called
     from both the cascade and normal save paths and has **no hole limit**, so it fires at the **final
     hole** too. That matters: a photo uploaded at H17 **is** seen by the time the game ends.
  2. **Detection: `checkPhotoChanged()`** fetches `HEAD` on the Pages CDN and compares the **ETag**. Its
     always-"changed" size bug (above) makes it **re-download every time** — noisy, but it **cannot miss a
     change**.
  3. **Download** → compress → **upload to Firebase Storage** at the fixed path `celebration/<gameId>_H.jpg`
     → **verify** → write `scheduledGames/<gameId>.photo` = `{newPhotoAvailable:true, f2Downloaded:false,
     viewDownloaded:false, imageUrl}`.
  4. **At game end** `sign-card.js` runs `copyCelebrationPhoto()`, which re-reads the **same CDN URL** with
     `addCacheBuster()`, uploads to that same Storage path, and writes
     `historyGames/<gameId>_H.celebration.imageUrl` — **so the celebration reads the Firebase copy, which
     was refreshed from GitHub by this step.**
  5. **Both Viewer and Celebration read the FIREBASE copy**, not GitHub: `getCelebrationPhoto()` reads
     `historyGames/<gameId>_H.celebration.imageUrl`. Firebase Storage sends
     **`cache-control: private, max-age=0`** and the app appends `?t=`/`&t=` — so **no stale-cache path
     exists on the client side.**
  **EVIDENCE THE WHOLE CHAIN WORKS ON REAL DATA:** `scheduledGames/GM_260914_1342_52` in PROD reads
  `photo.newPhotoAvailable: true` with `photo.imageUrl` and `celebration.imageUrl` **identical and both
  pointing at `celebration/GM_260914_1342_52_H.jpg`** — i.e. step 3 and step 4 both completed for a real
  game.
  **CAVEATS, stated plainly (not hidden):**
  - **CDN deploy latency is real but small: measured ~20 s** for a new file to reach the CDN (~150 s
    observed for the 18:05 photo). A photo uploaded **seconds** before the celebration is therefore the
    only risky timing — and a normal round finishes **hours** after the H17 upload.
  - **The `checkPhotoChanged()` size bug means redundant uploads** (up to ~18 per round). Harmless to
    correctness, but if it were ever "optimised" the safety margin shrinks — hence the open decision.
  - **v1.22's guard has still never been exercised by a real mid-round upload plus a later viewer open.**
    The automated suite covers the guard's logic and the device runs cover the upload, but the two have
    not yet been combined in a live round. **This is the one genuinely unverified step.**
  **MEASUREMENT LESSON (new, reusable):** a Pages deploy **cannot** be detected by HTTP status — Pages
  serves `index.html` with **HTTP 200 for ANY missing path** (verified: a nonsense path returned 200 and
  53,021 B). A status-based probe reported a false "live in 1 s". **Poll the CONTENT, not the status.**
- **2026-11-01 — how to avoid the 5-minute stale window when checking a photo by hand.** The GitHub web
  view and `raw.githubusercontent.com` both send **`max-age=300`**, and **that window CANNOT be bypassed
  from the browser** — measured, not assumed:
  - A **cache-buster query string does NOT create a new cache object.** `?v=1`, `?v=2` and `?cb=<ns>`
    all returned `x-cache: HIT` against the **same** Fastly object (Fastly ignores the query string as a
    cache key).
  - **`Cache-Control: no-cache` and `Pragma: no-cache` request headers are ignored** — still
    `x-cache: HIT`, same object. So even a hard reload does not necessarily help inside the window.
  - The **only** reliably fresh GitHub URL is a **committed path that changes on every upload** (the
    `raw.githubusercontent.com/<commit-sha>/…` form, which is exactly what `UploadPhoto-004`'s VIEW
    read-back already uses).
  **✅ THE PRACTICAL ANSWER — use the CDN URL the app itself uses:**
  `https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg` — it sends
  **`max-age=0, must-revalidate`**, so the browser is **obliged** to fetch the current bytes on every
  load. **Verified byte-for-byte:** its md5 (`7fe33e30…`) is **identical to the repo blob's md5**, so it
  is not merely fresher — it is exactly what GitHub holds. **Bookmark that URL for manual photo checks;
  never judge an upload from the GitHub web view.**
- **2026-11-01 — the game-day "celebration showed the placeholder" bug is ALREADY FIXED AND DEPLOYED.
  It was never a CDN problem.** Re-analysed and confirmed against the live evidence: the photo was
  uploaded at **08:41** and the game ended **14:01** — over 5 hours later, so no deploy lag can explain
  it. The cause is **Cause A** (already documented below): `loadDefaultCelebrationPhoto()` ran **after**
  the real photo was broadcast, called `setPhotoFlags()` with the **default** URL, overwrote
  `photo.imageUrl` with `SRC_Default_Photo.jpg` and reset `f2Downloaded`/`viewDownloaded` — so F2/VIEW
  correctly downloaded the *default* image. **`js/celebration-photo.js` v1.22 fixes this** (guard:
  "Real photo broadcast in progress - keeping it, not setting default flags") and is **verified live on
  the CDN** (deployed sha `92a12ae10fc9` = repo, version string `1.22`, guard present). It landed
  **2026-10-31 16:13**, i.e. ~2 h **after** that game — **the game was played on the pre-fix build.**
  **⚠️ No code change is needed for this symptom.** The only real gap: v1.22 has never been exercised
  under live game-day conditions (needs a mid-round upload *plus* a viewer opening after the broadcast).
  See the dedicated finding for the full timeline and the retracted false lead.
- **2026-11-01 — ⚠️ RETRACTED FALSE LEAD: "Cloudflare Pages deploy lag explains the placeholder".**
  I proposed an 80-minute deploy lag as the cause; **the user correctly rejected it** — a round takes
  ~4.5 h and the photo was up 5 h 20 m before the celebration, so a lag of that size cannot be causal.
  Also retracted: a proposal to repoint `GITHUB_PHOTO_URL` at `raw.githubusercontent.com`. The CDN
  **ETag is content-derived** after all (`66ff11a5…` at 294,112 B → `b048020b…` at 641,989 B; prod and
  staging differ for different content), so the app's ETag check is **correct** and needs no change.
  **Method rule: check the timeline against the symptom's own clock before proposing a cause.**
  Separately, real Pages **deploy latency does exist** (measured: a commit pushed 12:19 was still
  undeployed at 14:03) — but it is **not** the cause of this bug.
- **2026-11-01 — iPhone uploader: FALSE NEGATIVE FIXED (deletion, 19 → 13 actions), delivered, NOT yet
  imported.** Root cause is settled: the Contents API `PUT` is **idempotent and always returns HTTP 200
  with a `content.sha`**, so the old `If` block's **sha comparison took the `Else` branch on a fully
  successful upload** and printed "⚠️ UPLOAD FAILED". The user's own instinct — *"why compare anything?
  when the user uploads, just make sure it lands"* — was correct. **The upload path was never broken.**
  The new graph **deletes the check entirely**: upload → read the new sha **from the PUT's own
  response** → show the photo back from GitHub. A false negative is now impossible.
  Verified: 0 dangling refs; the exact chain replayed live (210 KB JPEG, `PUT` 200, sha echoed,
  byte-identical photo returned). Delivered byte-identical to `~/Downloads/` + iCloud `Upload/`
  (`c1803ef9...`), previous version backed up. **⚠️ Still to do: import on the iPhone and confirm.**
- **⚠️ OPEN — token rotation is blocked on a decision** (must not be attempted blind on game day).
  The photo PAT is baked into the shortcut and was used in plaintext while testing, so it *should* be
  rotated; but rebuilding the shortcut needs the new token, and the phone needs the new shortcut to
  upload — a circular hand-off. See Open questions.
- **⚠️ OPEN — 11 of my test shortcuts remain on the iPhone** and must be deleted there (the Mac cannot
  do it): `After404S`, `ErrOutS`, `OkTestS`, `ErrTestS`, `FailTestS`, `ReadbackTestS`, `UploadPhoto 3`,
  `UploadPhoto 4`, `UploadPhoto_signed`, `UploadPhotoFinal`, `Upload-Photo 2`. **Keep `UploadPhoto`
  and the user's own `Rename To C.jpg`.** Each writes the same `C.jpg`, so picking the wrong one is
  indistinguishable from a broken shortcut.
- **⚠️ NEXT: the in-app VIEW screen** (user-approved, not started). It must read via the Contents API
  `Accept: application/vnd.github.raw` — **never** the CDN or `raw.githubusercontent.com`, which are
  both verified stale right after an upload.
- **2026-10-31 (evening) — VS Code tool cap FIXED** (hard-coded 128-tool BYOK cap in the agent host,
  resolved by disabling the built-in GitHub MCP server via Configure Tools; the `gh` CLI covers the
  same ground). See the dedicated finding for the authoritative store.
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
- 2026-11-01 — **Photo-upload shortcut: NO success check at all** (user decision). The shortcut
  uploads, then **shows the photo back from GitHub unconditionally** — it never compares anything.
  Rationale: the `PUT` is idempotent and always reports HTTP 200 + `content.sha`, so a comparison
  can only **invent** a failure (which is exactly what the old `If`/`Else` did). Removing the check
  makes a false negative impossible; the shown photo *is* the proof. Options put to the user were
  (A) no check and (B) keep a truthy-only "did the PUT return a `content.sha`" check; **A chosen.**
  The user **rejected** the two intermediate designs I proposed (a photo-slot `Menu` and a sha
  comparison) with the reasoning: *"why is there a need to compare anything? when the user upload,
  just make sure it lands."*
- 2026-11-01 — **Photo slot `Menu` DISCARDED (my misread, corrected).** I proposed a Menu so the
  shortcut could write `A/B/C/D.jpg` slots, having read the user's screenshot of **multiple "Upload
  Photo" entries in the iOS share sheet** as evidence of multiple photo slots. It was not: those
  were **my own leftover test shortcuts** (see the per-device sync finding). Verified: **there is
  exactly ONE slot — `C.jpg`** — and the app hardcodes it in 4 places
  (`js/celebration-photo.js:40`, `js/util-photo.js:49`, `util-record-management.html:1142,1148`);
  `images/celebration/` contains **only** `C.jpg` (+ an empty `Archive` dir). No `A/B/D` exist.
- 2026-11-01 — **Photo-upload token rotation is BLOCKED pending a user decision.** The token is
  baked into the shortcut and was used in plaintext during testing, so it should be rotated — but
  rebuilding the shortcut with a new token creates a **circular hand-off**: the phone must run the
  *new* shortcut to upload the *new* photo, while the shortcut-rebuild needs that upload. Attempting
  it would risk the celebration photo on game day. See Open questions.
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
- 2026-11-01 — **Photo-upload shortcut rebuilt to remove the false negative** (19 → 13 actions).
  Delivered **byte-identical** to both locations (sha256 `c1803ef9...`, 23,881 B, `--mode anyone`):
  `~/Downloads/UploadPhoto.shortcut` and iCloud `Upload/UploadPhoto.shortcut`. The previous version
  (sha256 `37d8a8b7...`) is backed up. **Not yet imported onto the iPhone** — device validation
  pending. See Technical findings for the action map and the live replay that verified it.
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
- 2026-11-01 — **✅ iPhone VIEW: the empty result dialog — root cause is the `Text` SERIALIZATION TYPE.**
  Symptom: the shortcut ran and the upload succeeded, but the result sheet was **completely empty**
  (a bare Cancel/Done panel) — and at the same time the user's browser showed the **old** `C.jpg`.
  **Cause:** `is.workflow.actions.showresult` was given
  `Text = {"Value": {"OutputUUID": …, "Type": "ActionOutput", "OutputName": "Contents of URL"}, "WFSerializationType": "WFTextTokenAttachment"}`
  — a **bare attachment**. Shortcuts requires **`WFTextTokenString` with a `\ufffc` placeholder** in the
  string and the attachment in `attachmentsByRange`. With the wrong shape the dialog opens with **nothing
  renderable to display**, which is exactly what an "empty" sheet looks like.
  **Proof it is the discriminator:** every `showresult` in the user's library — `Music Quiz` (×3) and
  `Make GIF` — uses `WFTextTokenString`; `UploadPhoto-003` was the **only** one using
  `WFTextTokenAttachment`. The shape was copied from a *working* shortcut (`Make GIF`) to build
  `UploadPhoto-004`.
  **Second, independent fix in the same build — the VIEW read-back URL.** The Contents API with
  `Accept: application/vnd.github.raw` returns the correct **bytes** but
  `content-type: application/vnd.github.raw; charset=utf-8` — **not an image**, so Shortcuts cannot
  render it. Fetching `https://raw.githubusercontent.com/prapi01/SICC-Ryder-Cup/<commit-sha>/images/celebration/C.jpg`
  returns `content-type: image/jpeg` (measured, byte-identical content) and **does** render. Using the
  **commit sha** (read from the `PUT`'s own `commit.sha`) rather than `main` makes the URL **immutable**,
  so the `max-age=300` on that host cannot serve a stale image.
  **Also confirmed:** the CDN's **ETag is content-derived** (`66ff11a5…` at 294,112 B → `b048020b…` at
  641,989 B; prod vs staging differ for different content), so the **app's** `checkPhotoChanged()` ETag
  comparison is correct and needs no change. `raw.githubusercontent.com` **ignores cache-buster query
  strings** (verified) and is `max-age=300`.
  **Files:** the shortcut graph only. A rebuild recipe (installed graph → fixed plist → sign → deliver)
  is kept in this session's state folder as `rebuild-shortcut.sh`; it is not committed.
- 2026-11-01 — **✅ GAME-DAY "PLACEHOLDER AT CELEBRATION" — FULL TIMELINE, AND WHY NO CODE CHANGE IS NEEDED.**
  Symptom reported by the user: the browser showed the **new** `C.jpg`, but the Celebration screen still
  showed the earlier **placeholder cartoon**. The following is the settled explanation, reconstructed
  from git history plus the live Firestore evidence recorded in Cause A.
  **Timeline (all times SGT, 2026-10-31):**

  | Time | Event |
  |---|---|
  | 08:41 | Last `C.jpg` commit before play — the real photo the user uploaded |
  | 12:56 | Firebase Storage `celebration/GM_260914_1342_52_H.jpg` **created** (the real photo) |
  | 13:35 | **Overwritten with `SRC_Default_Photo.jpg`** ← the defect fires here |
  | 14:01 | Game completed → celebration modal shown → **placeholder visible** |

  **Cause:** `loadDefaultCelebrationPhoto()` (invoked by the viewer, `view-game.html` v8.16, since
  2026-08-09) ran **after** a real photo had been broadcast, and called `setPhotoFlags()` with the
  **default** URL. That overwrote `photo.imageUrl` with the default and reset `f2Downloaded` /
  `viewDownloaded` to `false` — so F2 and VIEW, honouring those flags, downloaded the **default** image
  by design. F1 alone kept the real blob in `sessionStorage`, which is why the scorer and the other
  devices disagreed.
  **Fix:** `js/celebration-photo.js` **v1.22**, landed **2026-10-31 16:13** — **~2 h after that game.**
  **Verified live on the CDN** (deployed sha `92a12ae10fc9` = repo; version string `1.22`; the guard
  line is present). **The game was played on the pre-fix build, so this is expected to recur no more.**
  **⚠️ Residual risk:** v1.22 was written after that game and has **never** run under live game-day
  conditions — the guard's branch needs a mid-round upload *plus* a viewer opening after the broadcast.
  That specific condition should be verified deliberately before the next game (see Next steps).
  **Files:** [js/celebration-photo.js](../../js/celebration-photo.js) (`loadDefaultCelebrationPhoto`,
  `setPhotoFlags`), [view-game.html](../../view-game.html) (`checkPhotoForView`),
  [js/sign-card.js](../../js/sign-card.js) (`showCelebrationScreen`, reads `sessionStorage
  ['celebrationPhoto']`).
  **Retracted false leads from this same investigation — do not repeat them:**
  - **"Deploy lag explains it."** Wrong: 08:41 → 14:01 is 5 h 20 m; the user rejected it on that basis
    and was right.
  - **"The CDN ETag is deployment-derived, not content-derived."** Wrong: I verified `66ff11a5…`
    (294,112 B) → `b048020b…` (641,989 B), and prod vs staging differ for different content. The ETag
    **is** content-derived, so `checkPhotoChanged()` is correct.
  - **"Repoint `GITHUB_PHOTO_URL` at `raw.githubusercontent.com`."** Not needed for this bug; proposed on
    the bad premise above.
  **Still true, and worth keeping separate:** Cloudflare Pages deploys of `main` can run **hours** behind
  (measured 2026-11-01: a commit pushed 12:19 was still undeployed at 14:03). That is a real operational
  fact for pages that must reflect a deploy, but it is **not** the cause of this symptom.
  **Method rule for next time: before proposing a cause, check the timeline against the symptom's own
  clock.**
- 2026-10-31 — **⚠️ THE UPLOADER WAS NOT BROKEN — THE DELIVERED ARTIFACT WAS STALE (root cause).**
  The whole "it used to work and now it's broken" loop resolves to an **artifact/device mismatch**, not
  a broken graph. Evidence:
  - **Nine runs of the INSTALLED graph (`pk=129`, 10 actions) from this Mac all uploaded successfully**
    (commits `ff11e15`, `a680984`, `c117e03`, `b7e12a7`), including **two consecutive runs 2 s apart**
    and **three back-to-back runs with genuinely different payloads** (distinct JPEGs → distinct new
    blob shas each time). The "first works, the rest fail" signature **did not reproduce**.
  - **The delivered files were a DIFFERENT, older graph.** `~/Downloads/UploadPhoto.shortcut` and the
    iCloud `Upload/UploadPhoto.shortcut` (both sha256 `8421de23…`, 23,453 B) held **8 actions with no
    `Show Result` and no no-input guard**. The Mac's installed `pk=129` held **10 actions with both**.
    **Consequence:** on a device carrying the 8-action copy, a no-image run commits a **0-byte `C.jpg`**
    (wiping the celebration on every device) and reports **nothing** — silent *and* destructive. That is
    the exact reported symptom, and it explains why every graph fix "verified by running it" still left
    the user seeing failures.
  - **Signed `.shortcut` files are AEA1 archives** — the graph cannot be read back out of them. The
    delivered artifact's action count was therefore **never verifiable**; only the installed DB row was.
    **Rule: verify the artifact the user actually holds, not just the local install.**
  - **Two live share-sheet uploaders existed** before this session (`pk=106` old a-Shell + `pk=129`);
    `pk=106` has since been removed. Now **exactly one** shortcut both accepts images and targets the
    C.jpg API — re-verified after every import.
- 2026-10-31 — **⚠️ `raw.githubusercontent.com` AND the Cloudflare CDN are BOTH stale right after an
  upload — neither can back a "show me what's on GitHub NOW" view.** Measured:
  > **⚠️ 2026-11-01 NUANCE — this finding is about immediate freshness after a write, and it still
  > holds. But do NOT generalise it into "the CDN ETag is unusable":** the CDN ETag **is**
  > content-derived (verified: `66ff11a5…` @ 294,112 B → `b048020b…` @ 641,989 B; prod vs staging differ
  > for different content), so the app's `checkPhotoChanged()` ETag comparison is sound. The staleness
  > above is a **propagation/lag** effect, not a broken ETag. `raw.githubusercontent.com` also
  > **ignores cache-buster query strings** and sends `cache-control: max-age=300` (both re-verified
  > 2026-11-01) — which is why the VIEW uses an **immutable commit-sha URL** instead.
  - `raw.githubusercontent.com/…/C.jpg` → `cache-control: max-age=300`, and it **IGNORES cache-buster
    query strings**. Immediately after a restore it still served the **previous** file for minutes
    (served a 37,244-byte test image while `main` held the 1,015,556-byte real photo).
  - `sicc-ryder-cup.pages.dev/…/C.jpg` (the URL the **app itself** uses; `celebrate-photo.js`
    `GITHUB_PHOTO_URL`) → `cache-control: public, max-age=0, must-revalidate`, but **still served the
    stale file immediately after an upload** in testing. CDN lag is real, not theoretical.
  - **The ONLY immediately-fresh, byte-exact source is the Contents API with
    `Accept: application/vnd.github.raw`:** returns the current bytes, `etag` = the blob sha, and —
    verified in Shortcuts with `--output-type public.jpeg` — the response **is accepted as an image**
    and its bytes are **identical** to the file on `main` (`sha256` match, 37,394 B test).
  - **Consequence for the VIEW feature:** the view must read through the **API raw** media type. A view
    built on the CDN or on `raw.githubusercontent.com` would confidently show the **old** photo right
    after a successful upload — the single most confusing possible outcome.
- 2026-10-31 — **✅ Shortcuts CONTINUES after an HTTP error (verified), so an IF/ELSE failure branch is
  reachable.** Proven with a runnable test graph: an action *after* a 404 `Get Contents of URL` still
  executed (`after404.txt` contained `AFTER-DOWNLOAD-REACHED`). This matters twice: (a) a failed PUT
  does **not** abort the shortcut, so the new failure branch can print GitHub's `message`; (b) it
  confirms why the old graph's silent failure was possible — **nothing stops the chain**, so without
  an explicit check a bad upload "completes" normally.
  Note: a passing action is not evidence the earlier one succeeded — only the **returned `content.sha`**
  distinguishes a real upload from a no-op.
- 2026-10-31 23:3x — **⚠️ CORRECTION: my "same photo twice → no new commits" finding was INVALID —
  the upload path was never the problem.** The claim came from reading the **`commits?path=` LIST
  endpoint**, which is **CDN-cached** and so reported a stale before/after pair. Re-measured with the
  **uncached** `git/ref/heads/main`, the commit SHA changed on **every run**:
  `a3005820 → 53747a7f → f1fa6ca0 → bc6c88f0`. Method rule: to verify a write, read **`git/ref` or
  `git/trees`, never `commits?path=`**.
  | Test | Result |
  |---|---|
  | Identical photo ×5, the shortcut's own token | **HTTP 200 + `content.sha` every time** |
  | Identical bytes ×3, direct API | HTTP 201/200/200, **`content.sha` present every time** |
  | Commit SHA on `main`, consecutive runs (`git/ref`) | **changed on every run** |
- 2026-10-31 — **✅ ROOT CAUSE OF THE USER-VISIBLE FAILURE: a FALSE NEGATIVE, not a failed upload.**
  The Contents API `PUT` is **idempotent and always reports success** — identical content does not
  error, it returns the existing `content.sha` with HTTP 200. The old shortcut fetched the file's sha
  *before* uploading, uploaded, and then its `If` block **compared** values; a fully successful upload
  therefore took the `Else` branch and printed "⚠️ UPLOAD FAILED — GitHub returned no new file."
  The user's own diagnosis — *"why compare anything? just make sure it lands"* — was correct.
  **A sha/change comparison in the shortcut can only invent failures; it can never prevent one.**
  Verified response shapes (probed live, throwaway file):
  | Outcome | Response |
  |---|---|
  | PUT success | `200`, keys `[commit, content]`, **`content.sha` present**, **no `message` key** |
  | PUT failure | non-2xx body has `message` (+`status`, `documentation_url`), **no `content`/`commit`** |
- 2026-11-01 — **The fix is a DELETION, not a rebuild: 19 actions → 13, with every surviving
  action's wiring untouched.** The old graph already contained each action the new design needs, so
  dropping the `If` group and re-pointing one value solved it with **zero invented serialization**.
  | Kept | Role |
  |---|---|
  | 0–7 | token → resize 1920 → JPEG q0.9 → base64 → `GET` sha → `PUT` (**unchanged**) |
  | 8–10 | read `content.sha` from the **PUT's own response** (dictionary → `content` → `sha`) |
  | 11–12 | `GET` photo (`Accept: application/vnd.github.raw`) → **Show Result** |
  | Deleted | 8 `Output`; 12/15/18 the `If` group; 16/17 the failure message |
  The `?cb=<sha>` cache-buster on the photo `GET` keeps its **exact** existing wiring — the sha now
  arrives from the PUT response instead of a second fetch, so the shown URL is always unique.
  **Verified before signing:** 13 kept UUIDs, 12 `ActionOutput` refs, **0 dangling refs**, 0 refs
  pointing at dropped actions, `cb=` still bound to the PUT's sha output, `vnd.github.raw` present.
  **Verified by replaying the exact chain live** (output to a temp path, never `C.jpg`): resize →
  JPEG → base64 (209,937 B) → `PUT` 200 → `content.sha` echoed → `GET ?cb=<sha>` returned
  **209,937 bytes, byte-identical**, JPEG magic intact.
  **Compression note:** a 1920-px q0.9 JPEG of a real photo lands at **~210 KB** — an order of
  magnitude below the **~1 MB** inline-content boundary, so the read path is never in the danger zone.
- 2026-11-01 — **✅ Shortcut build/sign pipeline reproduced and validated** (needed because the old
  script survived only in a previous session's log):
  - `shortcuts sign` **rejects JSON** ("data couldn't be read because it isn't in the correct
    format"). Feed it a **binary plist** (`plistlib.FMT_BINARY`) → succeeds.
  - Use **`--mode anyone`** — the mode used for the delivery that worked on the phone (139 prior
    invocations), not the CLI default.
  - Output is a valid **AEA1** archive (`aea id` returns an identifier); the payload is **encrypted**,
    so a signed file's action graph **cannot be read back out**. Confirmed the working delivered file
    behaves identically — so the action count of any *signed* artifact is **not statically
    verifiable**; validate the unsigned plist before signing.
  - Proven header for this project: `WFWorkflowClientVersion "4610.0.4"`,
    `WFWorkflowMinimumClientVersion 900` (+`...String "900"`), and
    `WFWorkflowInputContentItemClasses ["WFImageContentItem"]`.
  - **Correctly-sized image content that Shortcuts will actually render:** the `Resize Image` action
    with only `WFImageResizeWidth: 1920` works (the empty `WFImageResizeHeight` is fine).
  - **Measured GET/PUT asymmetry that explains a silent failure:** `PUT` responses are **~1.9 KB**
    (no inline content), but `GET /contents/...` **inlines the whole file as base64** — **~1.4 MB**
    at a 1 MB photo — and the moment the file exceeds **~1 MB** the `content` field becomes **`""`**
    with `"encoding":"none"` (measured: 1000 KB → 1.38 MB inline; 1100 KB → 0.8 KB, content empty).
  - **Caveat on my own testing:** two of my earlier experiments were **invalid** and their conclusions
    were withdrawn — (a) "8 runs, 1 success" used the *same* photo, so unchanged sha proved nothing
    about failure; (b) a "stale GET" theory (Contents API `cache-control: max-age=60`) was **not**
    reproducible: in 12 controlled write-then-read cycles the Contents GET and the git tree agreed
    **12/12**, and `?cb=`/`Cache-Control: no-cache` made no difference.
- 2026-10-31 — **⚠️ CORRECTION: the "shortcut cleanup" was NOT complete — test shortcuts were still on
  the iPhone.** Earlier this session the cleanup was reported as done (`4 stray shortcuts deleted + 18
  orphaned action blobs, 29 orphaned run events, 20 orphaned icons`). That was true **of the Mac only**.
  The user then photographed the **iPhone's Shortcuts app** showing **11 of those test shortcuts still
  present**, plus a redundant `Upload-Photo 2` in the Photos share sheet:
  `After404S`, `ErrOutS`, `OkTestS`, `ErrTestS`, `FailTestS`, `ReadbackTestS`, `UploadPhoto 3`,
  `UploadPhoto 4`, `UploadPhoto_signed`, `UploadPhotoFinal`, `Upload-Photo 2`.
  **Root cause: iOS Shortcuts are synced per-device.** Deleting a row from the Mac's
  `Shortcuts.sqlite` does **not** delete it from the phone, and the Mac has **no interface to delete a
  shortcut on the device**. The Mac library was verified clean (`57` shortcuts, exactly one
  `UploadPhoto`) while the device was not — the check and the claim were about the wrong machine.
  **Why it matters:** every one of those variants writes the **same `C.jpg`**, so choosing the wrong
  one in the share sheet is **indistinguishable from a broken shortcut** — the precise confusion that
  has dogged this feature.
  **Corrected facts on the device:** the genuine **`UploadPhoto`** is present and healthy — **19
  actions**, no-input guard present (`ZNOINPUTBEHAVIORDATA` set), accepts images, `ZSHOWINSEARCH=1`.
  **`Rename To C.jpg`** (pk=104) is the **user's own** shortcut (created **2026-05-15**, 3 run events)
  and must **not** be deleted. `C.jpg` on `main` verified intact
  (`4709b6e5d31b6c099d5a91944fe6fbddc76905a4`, `1,015,556` B) and both delivered `.shortcut` files are
  byte-identical (sha256 `37d8a8b7…`), so nothing stale is being re-synced.
  **Standing rule added to DESIGN:** never leave a test shortcut where it can sync to the phone; prefer
  `curl` + plist inspection over creating Shortcuts at all; and **cleanup is not complete until the
  iPhone's share sheet is checked** — never report it done from the Mac library alone.
  **OUTSTANDING (user-side, Mac cannot do it):** delete the 11 test shortcuts on the iPhone via
  Shortcuts → Select → Delete, keeping `UploadPhoto` and `Rename To C.jpg`.
- 2026-10-31 — **⚠️ Mac Shortcuts GUI import is UNRELIABLE AND LATE — the source of duplicate installs.**
  `open -a Shortcuts <file>.shortcut` repeatedly appeared to do nothing, then imported **12–25 s later**
  (sometimes several queued imports landing together). This created five stray `UploadPhoto*` rows in one
  session. Because a stray image-accepting uploader is **indistinguishable from a broken shortcut** in the
  share sheet, each import **must** be followed by a library check and cleanup. Two supporting facts:
  - **A fresh import starts with `ZSHOWINSEARCH=0`** and settles to `1` on its own shortly after. This is
    **transient** — it matches the documented quarantine hazard. **Compare against a known-good row
    (e.g. `pk=104`) and wait before "fixing" it**; acting on the transient value is guesswork.
  - **`DELETE FROM ZSHORTCUT` works via plain SQL** *for a row whose actions are already gone*
    (`ZSHORTCUTACTIONS` empty) — the failure seen earlier was a CoreData trigger firing on a row that
    still had actions, not a general block. Quitting Shortcuts first, then deleting, was reliable.
- 2026-10-31 — **✅ Library cleanup done: 57 shortcuts, ZERO orphans, exactly ONE uploader; uploader
  re-verified AFTER the DB surgery.** The import churn above left rows behind that the Shortcuts UI does
  not show. Removed **18 orphaned `ZSHORTCUTACTIONS` blobs, 29 orphaned `ZSHORTCUTRUNEVENT` rows and 20
  orphaned `ZSHORTCUTICON` rows** (four stray shortcuts had already been deleted from the UI earlier).
  Final state, re-checked on a **WAL-aware `.backup`**: **57 / 57 / 57** rows for
  `ZSHORTCUT` / `ZSHORTCUTACTIONS` / `ZSHORTCUTICON`, **923** run events, **0 orphans in all three
  tables**, `PRAGMA integrity_check` = `ok`, all four `Z_DA_*` CoreData triggers present, and the app
  and CLI both list **57**.
  - **"Image-accepting uploaders" must not be judged by name.** Four shortcuts match `%Photo%`/`%Upload%`
    — `Resize Photo`, `2840ResizePhotoShortcut`, a NAS-monitor shortcut and `UploadPhoto` — but only
    **`pk=147 UploadPhoto`** takes share-sheet input. `Resize Photo` / `2840ResizePhotoShortcut` are
    **long-standing** (`2025-11-04`, `ZSHORTCUTRUNEVENT` history) and were **left untouched**; the NAS
    one (`pk=76`) is unrelated. Only `pk=147` was created by this work (`2026-10-31 21:20:47`).
  - **⚠️ A plain `cp` of `Shortcuts.sqlite` under-reports.** The first integrity check ran against a
    `cp`'d copy and claimed **59 shortcuts and 14 orphan action blobs** — purely because the **2.2 MB
    `-wal` was not copied**, so the copy showed pre-cleanup state. **Always take a consistent snapshot
    with `sqlite3 <db> ".backup <dest>"`** before drawing a conclusion about this database.
  - The uploader was then **run for real** (`shortcuts run "UploadPhoto" -i …`): it committed a new blob
    (`978,367` B — a re-encode at q0.9, so a new sha is expected) → the PUT round-trip is intact after
    the surgery. `C.jpg` was restored immediately and is back at blob
    `4709b6e5d31b6c099d5a91944fe6fbddc76905a4`, `1,015,556` B.
- 2026-10-31 — **✅ The `128 tools` warning root cause: a HARD-CODED cap in VS Code's agent host, hit by
  BYOK models.** The UI shows *"The model only supports 128 tools, 3 tools were not provided to the
  model."*; the backing log line is
  `[ByokLmProxyService] sending 128 of 131 tools to deepseek/deepseek-flash (limit 128); dropped 3 tool(s)`
  — **1,091 occurrences in one day**. Mechanism (read from `vs/platform/agentHost/node/agentHostMain.js`):
  the constant is **`var lJ=128`**, and `function Vve(o,i=lJ)` keeps the tools **already used in the
  conversation first**, then fills the remainder in list order, silently discarding the rest. Key facts:
  - It is **not a setting** — `chat.virtualTools.threshold` (default 128) is a *different* mechanism
    (grouping tools into virtual toolsets) and **does not raise this ceiling**. The only fix is to get
    the tool count **below 128**.
  - **⚠️ SELF-CORRECTION (2026-10-31 22:20) — the first "fix" was the WRONG SETTING and could never
    have worked.** VS Code ships **two** independently-gated GitHub MCP servers whose names differ by
    three characters:
    | Setting | Read by | Effect on the tool count |
    |---|---|---|
    | `github.copilot.chat.githubMcpServer.enabled` (default `false`) | the **Copilot extension** | **none** — the agent host never reads it |
    | **`chat.agentHost.githubMcpServer.enabled`** (default **`true`**) | the **agent host** | **this is the one that matters** |
    Evidence: the host's constant is literally `"chat.agentHost.githubMcpServer.enabled"`, its gate is
    `_isGitHubMcpServerEnabled(){ return getRootValue(...,"githubMcpServerEnabled") !== false }`, the
    registration carries `agentHost:{key:"githubMcpServerEnabled"}, default:true`, and the host bundle
    contains **zero** references to `chat.githubMcpServer`. The tell that was missed: the tool count
    stayed at exactly **131** — impossible if 18 tools had really been removed. The fix was reported off
    the setting being *written*, not off the count *falling*.
  - **Correct setting now applied:** `"chat.agentHost.githubMcpServer.enabled": false`, with the
    extension setting and `...readonly` **restored to their original `true`**. Confirmed propagated this
    time — the host's own persisted `globalStorage/agent-host-config.json` reads
    `githubMcpServerEnabled = false`.
  - **⚠️ A WINDOW RELOAD CANNOT APPLY IT — the agent host is an APP-LEVEL process, not per-window.**
    Measured: VS Code main `PID 39835` and the agent host `PID 40873` have both been alive since
    **Oct 30 11:30** (~35 h) while the extension host restarted **17 times**. The host is therefore
    still holding its in-memory "GitHub MCP = on" from Oct 30, and `github-mcp-server` still reached
    `connected` at **22:11:10**, *after* the config write. **This needs a full quit-and-reopen of
    VS Code**, not a reload. It is **not yet verified** that a restart suffices — if the server arrives
    via the *connectors* path rather than the built-in path, it will survive the restart.
  - **Tool budget, counted (total 131):** core agent-host **38** · **`firebase` MCP 65** ·
    `github-mcp-server` **18** · `cloudflare` **4** · Python/Pylance extension **6**. **`firebase` alone
    is half the budget** — dropping it is a far bigger lever (−65) than the GitHub server (−18).
  - Also loaded: `cloudflare` connector, `pylance mcp server` (observed **failing** — `mcpState: error`,
    `transport failure … http://localhost:52747/stream`), `supabase` (disabled). A failing server
    probably contributes **0** tools, so it was ranked below the above rather than blamed first.
  - **⚠️ SECOND FAILURE (2026-10-31 22:37) — the setting is STILL not the lever, even after a FULL app
    restart.** Verified a real restart happened (new PIDs `40135`/`41141` at 22:33:50; new log dir
    `logs/20261031T223350`) and the host's persisted config reads `githubMcpServerEnabled = false` —
    yet the count is **still exactly 131** (14 drop lines, 22:35–22:37) and
    `MCP server 'github-mcp-server' connected` at **22:34:11** with `mcpSource: "builtin"`.
    So `chat.agentHost.githubMcpServer.enabled=false` reaches the config file but does **not** stop the
    server. Next mechanism found, and it is the one that is **already proven on this machine**:
    `globalStorage/agent-host-storage.json` → `customizationEnablement.global` holds
    **`"mcpServers#supabase": false`**, and the log correspondingly shows
    `MCP server 'supabase' disabled (stopped)`. The gate is
    `_isMcpServerEnabledForSdk(){ let n = customizationEnablementService.resolve(...); return n.kind==="resolved" && n.enabled }`,
    keyed by `Wve(name) => "mcpServers#" + name`. This is what the warning's **"Configure Tools"** link writes.
  - **Tool budget by component (total 131):** `firebase` **66**, core agent-host **38**,
    `github-mcp-server` **18**, Python/Pylance **6**, `cloudflare` **4**. **`firebase` alone is ~50 % of
    the budget** — the single biggest lever by a wide margin.
  - **Action taken (2026-10-31 22:45) — both servers disabled via the PROVEN gate.** Added
    `"mcpServers#github-mcp-server": false` and `"mcpServers#firebase": false` to
    `globalStorage/agent-host-storage.json` → `customizationEnablement.global` (backup at
    `/tmp/agent-host-storage.json.bak`). Chosen over editing `.mcp.json` (which **is** git-tracked)
    because the gate is identical in effect but **reversible and touches no repo file**.
    **Expected after restart: 131 − 18 − 65 = 48.** Re-enabling is one edit of the same key to `true`.
  - **⚠️ THAT APPROACH FAILED TOO (2026-10-31 22:51) — VS Code PRUNES hand-written enablement keys.**
    After a genuine restart (new log dir `20261031T225014`), the count was still **131**. Cause: the
    host **deleted both of my hand-added keys on startup**, leaving only `mcpServers#supabase` — i.e.
    the **one** entry it already had in its own catalog (`customizationEnablementLru`). The
    `agent-host-storage.json` file is **not** the authoritative store, and only keys the host already
    knows about survive. Do not hand-edit it.
  - **✅ RESOLVED — and the working path was the UI, not any setting (2026-10-31 22:55).** The user
    toggled **firebase** off in **Configure Tools → Connected Sources**. The host logged
    `Reconciling MCP server 'firebase' enablement: disable` → `MCP server 'firebase' disabled (stopped)`,
    and the warning **stopped immediately**: **14 drop lines before** the toggle (22:35–22:54:13),
    **0 after** (22:54:46 → 22:57:45, with completed turns in between, so it is not an activity gap).
  - **The authoritative enablement store is `globalStorage/state.vscdb` → `ItemTable` key
    `mcp.enablement`** — a JSON array of `[key, enabled]` pairs. The working entry is
    **`["workspace-dot-mcp.0.firebase", false]`**. Note the key format: it encodes the **config source
    path** (`workspace-dot-mcp.0.<server>`), *not* the server name — which is exactly why guessing it
    was futile. `chat.agentHost.toolSetEnablement` (tool sets) lives in the same table.
  - **Lesson / rule:** for VS Code's own tool + MCP enablement, **use the "Configure Tools" UI.** No
    settings key and no hand-edited storage file reliably works. Three separate setting/file attempts
    failed; the single UI toggle worked.
  - **Cleanup done:** both test settings I added (`chat.agentHost.githubMcpServer.enabled`,
    `github.copilot.chat.agentDebugLog.fileLogging.enabled`) were **removed**, and `settings.json` is
    now **identical to the pre-session backup** (`...bak-githubmcp-20261031-203831`) — verified by
    deep-comparing the two JSON documents. No residue from the failed attempts remains in the user
    settings.
- 2026-10-31 — **Uploader v2 (19 actions) was delivered and "run-verified" — but the verification
  missed the defect and v2 is now SUPERSEDED by v3 (2026-11-01).** v2's structure:
  token (step 1) → resize 1920/JPEG 0.9/base64 → `GET` current `sha` → `PUT` (with **`branch: main` in
  the JSON body**, never `?branch=`) → `output` → read back `content.sha` → **IF sha has a value** →
  `GET` the file via **API raw** → **display the image** (**ELSE** → fetch GitHub's `message` →
  display it → **END IF**). What was verified then: uploads land (new sha each run), the displayed bytes
  are **byte-identical** to `main`, the no-input guard is present
  (`WFWorkflowNoInputBehavior` = `...AskForInput`), the token is baked in (93 chars, `github_pat_...`),
  and `ZSHOWINSEARCH=1`. Delivered identically to `~/Downloads/` and iCloud `Upload/`
  (sha256 `37d8a8b7...`).
  **What that verification missed — and the lesson:** every test was run from the **Mac**, where the
  upload always succeeded, so the `IF` **never once took its failure branch** in testing and the defect
  hid behind a green light. The comparison itself was the bug (see the v3 entry), and the only way it
  could be caught was by testing the **false-negative path**, not the happy path. **"It ran and the
  upload landed" is not evidence the shortcut reports correctly.**
- 2026-10-31 — **`C.jpg` is byte-verified restored after every test.** The test runs above each
  overwrote the live photo; it was restored each time and finally left as
  **`1,015,556` bytes, blob sha `4709b6e5d31b6c099d5a91944fe6fbddc76905a4`** (the user's correct
  game-day photo, sha256 `ef50d6ea5bd8daf5…`), confirmed on `main`. Restores used the Contents API with
  **full base64** (1,015,556 B encodes fine — the earlier `content: ""` trap applies only to *reads*
  of >1 MB files, not to writes, which is why the write path works and the read path does not).
- 2026-10-31 — **⚠️ CORRECTION to my own earlier reasoning (2026-10-31 evening).** Having seen
  `ZSHOWINSEARCH=0` on a freshly imported shortcut, I wrote `UPDATE ZSHORTCUT SET ZSHOWINSEARCH=1` and
  treated it as a fix. **That was guesswork.** Comparing against a known-good long-standing row
  (`pk=104`, same input class, same device, in daily use) showed the row was **already correct** —
  `showInSearch=1`, `quarantine=NULL`, `remoteStatus=0`, `hidden=0` — the `0` was the **transient
  import value** noted above and settled by itself. The write changed nothing real. **Lesson: when a
  flag disagrees with expectations, compare against a known-good row of the same class and WAIT for the
  store to settle before touching it.**

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
- **✅ FIX APPLIED — the recovery is re-wired (this was a refactor accident being undone, not a new
  architecture).** `game-data.js` **4.13 → 4.14**, `wrv.js` **1.14 → 1.15**:
  - `saveCurrentHole()` now calls a new `scheduleWRVReconcile()` **after** a score save, delayed
    **15 s** so the consolidated write in `real-game-save.js` lands first (this replaces the v4.01
    call sites that were lost with the removed raw write — deliberately re-attached to the *delay*
    rather than to a write that no longer exists, avoiding competing writes).
  - `startWRVReconcileLoop()` runs an **idle tick every 60 s** (started on game load, stopped at
    game end) so a device that has been **silently** out of sync also self-heals while not saving
    — which is exactly the reported symptom (the scorer kept entering scores and believed it was in
    sync).
  - `wrv.js` v1.15: `recover()` now **actually calls `options.onComplete`** (it accepted the
    callback but never invoked it), via a new `finishRecovery()` that also releases the
    `activeRecoveries` key. Before this, `game-data.js`'s `wrvRecoveryKeys` dedupe key was never
    released, so the guard could only ever suppress one repeat.
  - **Safety (verified by running the real `recover()` against a Firestore stub):** it detects the
    mismatch, writes **local truth** (not the server value), and rewrites **only the own flight's**
    `f<n>.d` / `f<n>.se` — `f1.d` was never touched, so one scorer can never overwrite the other's
    holes. It fired `onComplete` once and **stopped once in sync** (1 write, not a loop → no write
    storm). It adds **no competing write**: `game-data.js` still makes no Firestore write of its
    own, and the reconcile only fires when a game is loaded and the device can score.
  - **Verified on PROD after deploy:** on `real-game` (the scorer page) `WRV` is present,
    `WRV.recover` is a function, `WRV_VERSION 1.15`, and all five hooks
    (`scheduleWRVReconcile` / `startWRVReconcileLoop` / `stopWRVReconcileLoop` /
    `startWRVVerification` / `WRV.recover`) are live functions. `view-game` correctly does **not**
    load `wrv.js` (display-only).
  - **No regression:** re-checked the scorecard (T-2 `A10 A10 A9 A10 A10`, **0 squares**, gold on
    hole 14; T-1 gold 16; Strk gold 18) and the celebration (Team A 10–9, correct per-game photo),
    no page errors.

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
| Lost-connection **reconciliation** | ✅ **FIXED** — `WRV.recover()` re-wired (was orphaned 2026-06-26 → 2026-10-31) |
| Resumé across reloads | ✅ `localStorage` pending-writes queue |
| Connectivity UI / status | ❌ none |

**✅ ITEMS 1 AND 2 FIXED (2026-10-31).** Both were the same underlying hang, and both are small,
contained changes to the *delivery* of updates — no scoring logic touched.

**Fix 1 — a hung write can no longer sit pending for ever.**
`wrv.js` **1.15 → 1.16**, `real-game-save.js` **1.43 → 1.44**:
- `WRV.write()/update()` accept `options.timeoutMs`, and the **whole attempt** (`set` + verify read)
  is raced against it. Default **0 = unchanged** for every other caller.
- `wruBackground()` now passes **`timeoutMs: 20000`**, so an offline write fails instead of hanging
  and the existing exponential-backoff retry (1 s → 60 s, unlimited) actually engages.
- The `WRVInProgress` flag is now managed by `beginWRVWrite()`/`endWRVWrite()` with an
  **outstanding-write counter** (cascade + consolidated writes overlap, so a single boolean was
  wrong), and a **watchdog** force-clears the flag after **`WRV_STALE_MS` 120 s**. The direct-write
  fallback path uses the same helpers.
- **Proven by running the real code against a never-settling stub:** with no timeout the callback
  never fires (the reported hang); with `timeoutMs=1500` the retry loop engages (2+ attempts in 5 s).

**Fix 2 — realtime updates are DEFERRED, not dropped.**
`real-game-init.js` **1.16 → 1.17**:
- The `onSnapshot` handler is extracted to `handleSnapshot(doc)` and keeps the latest snapshot.
- `if (isWRVInProgress()) return;` (which discarded the update) is replaced by
  `deferredUpdate = true` + a 1 s re-check interval, and `applyDeferredUpdate()` **replays** the held
  snapshot once the write settles. It is called at every flag-clear site plus from the interval, so
  a deferred update can never be stranded.
- **A re-entrancy guard (`applyingDeferred`) was required:** the replay re-enters `handleSnapshot()`,
  which itself calls `applyDeferredUpdate()` at its clear sites; without the guard that path recursed
  into itself until the stack blew.
- **Verified by simulating the exact logic:** a snapshot arriving mid-write stays deferred and is
  then **applied automatically** when the write settles (not dropped), and the guard yields exactly
  one apply with no runaway recursion.

**PROD verification after deploy** (all three surfaces, no page errors):
| Check | Result |
|---|---|
| `real-game` (scorer) | `WRV` loaded, `recover`/`write` functions, watchdog + reconcile hooks exported, `WRVInProgress` false at idle ✅ |
| Scorecard | T-2 `A10 A10 A9 A10 A10`, **0 squares**, gold 14; T-1 gold 16; Strk gold 18 — unchanged ✅ |
| Celebration | Team A 10–9, correct per-game photo ✅ |

⬜ **Still open from the same audit:**
3. **Enable Firestore offline persistence** so reads survive a dip (a bad read is still a permanent
   cache miss today). ⚠️ Must be tested against the T-2 fix — reconnect-flushed writes arriving
   **out of order** would change save ordering, and F2 owns the `saveGameToHistory` trigger.
4. **Surface connection state in the UI** (offline / "n not synced") so a scorer knows.
5. Pre-existing cosmetic: `real-game.html` logs `WRV loaded: false` because it checks the global
   from an inline script that runs **before** `load-game.js` loads the modules. Harmless but
   misleading during debugging.

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
- **⚠️ Token rotation — needs a decision (raise before any game day).** The photo PAT is baked into the
  shortcut and was used in plaintext during testing, so it **should** be rotated. But rotating forces a
  rebuild, and a rebuild needs the new token **before** the phone can upload — while the phone needs the
  new shortcut to upload anything at all. Only the user can mint the token (`github.com/settings/tokens`
  → fine-grained, **Contents: Read and write** on this one repo). **Recommended, low-risk sequence:**
  1. Mint a new PAT (do **not** revoke the old one yet).
  2. I rebuild the shortcut with the new token and re-deliver; import it on the phone.
  3. Confirm one successful phone upload.
  4. **Only then** revoke the old token.
  Doing it in that order keeps a working uploader at all times; revoking first would leave a window with
  no working uploader. **Not to be done blind on game day.**
- **iPhone uploader — what remains unknown.** Every step reproducible from this Mac is green (chain
  replayed live, 0 dangling refs, delivered artifacts byte-identical, only one image-accepting uploader
  in the library). **The one fact never obtained is the phone's own result text.** With the comparison
  gone, the new shortcut shows the uploaded photo on success — so a phone run now yields the evidence
  directly instead of a guess.
- **Was the phone running a stale copy?** The last-delivered generation was re-signed from the source
  graph, but the phone's installed action count has **never been read** (the Mac cannot inspect the
  device). The next phone run settles it: 13 actions + a displayed photo = correct build in use.
- ~~Was my "same photo twice → no commit" reproduction valid?~~ **CLOSED 2026-11-01 — NO, it was
  invalid.** It came from the CDN-cached `commits?path=` list endpoint; the uncached `git/ref` showed
  the commit SHA changing on every run. Corrected in Technical findings.
- ~~Tool cap: is the count now under 128?~~ **CLOSED 2026-10-31 22:55 — fixed by the user.** ✅
  Disabling **firebase** via **Configure Tools** dropped the count below the 128 cap; **0 drop lines**
  after the toggle (vs 14 before). Three setting/file-based attempts by the AI all failed — see the
  Technical findings for the root cause (VS Code prunes hand-written enablement keys; the real store is
  `state.vscdb` → `mcp.enablement`, keyed by config-source path, not server name).

  **Process note — do not repeat:** each failed attempt was reported off the *setting being written*
  rather than off the *tool count falling*. The `sending N of M tools` count is the only valid
  acceptance test.
- **VIEW feature — shortcut half DONE 2026-11-01; in-app half approved and NOT started.** The shortcut
  now shows the exact photo that landed on GitHub. The in-app half (user approved 2026-11-01) must read
  through the Contents API with `Accept: application/vnd.github.raw`; the CDN and
  `raw.githubusercontent.com` are both stale right after an upload and would show the wrong photo.
- **Connection-loss hardening — reconciliation DONE, these remain** (audit 2026-10-31):
  ✅ **done:** `WRV.recover()` reconciliation re-wired (save-time + 60 s idle tick) and
  `onComplete` firing fixed.
  ✅ **items 1 and 2 DONE (2026-10-31):** write timeout (`timeoutMs` 20 s on background writes) +
  `WRVInProgress` counter + 120 s watchdog (`wrv.js` 1.16 / `real-game-save.js` 1.44), and
  **defer instead of drop** with a re-entrancy-guarded replay (`real-game-init.js` 1.17).
  ⬜ **still open:** (c) Firestore offline persistence so a dropped read is not permanent, needs
  testing against the T-2 fix because reconnect-flushed out-of-order writes would change save
  ordering; (d) surface connection state in the UI.
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
- **PRIORITY 1 — v1.22 game-day guard: ✅ VERIFIED by automated test (2026-11-01).**
  `automated-tests/specs/suite-c-celebration-guard.spec.js` (`npm run suite:c`) proves the fix:
  1. **Guard fires** — with `photo.newPhotoAvailable === true` + a real `imageUrl`, a fresh viewer page
     load emits the guard's own log line (`Real photo broadcast in progress`) and does **not** take the
     sessionStorage early-return.
  2. **State preserved** — `photo.imageUrl` is unchanged, `newPhotoAvailable` stays `true`, and
     `sessionStorage['celebrationPhoto']` holds the **broadcast** photo, not `SRC_Default_Photo`.
  3. **Negative control** — with nothing broadcast, the default **is** published, so the guard is
     conditional and has not silently disabled the "always show a photo" design.
  The spec asserts on the **log line**, not merely on "nothing broke": `loadDefaultCelebrationPhoto()`
  returns early when `sessionStorage['celebrationPhoto']` is already set, so a naive test could pass
  without ever reaching the guard. **Verified non-vacuous** — pointing the expected log string at a
  value that cannot occur makes test 1 fail as intended. Both tests create and delete their own
  throwaway games; PROD was confirmed clean afterwards.
  **Residual (genuine, and now small):** the test seeds the flags directly rather than driving a real
  iPhone upload mid-round. The remaining gap is therefore only the upload→flags step itself, which the
  `UploadPhoto-004` device run already covers. A full dress rehearsal across a real 18-hole round is
  still the only way to cover the whole chain at once.
- **PRIORITY 2 — import `UploadPhoto-004` on the iPhone and confirm one upload.**
**⚠️ SUPERSEDED — `UploadPhoto-004` is the current build and VIEW is confirmed working. See below.**
The chain is now proven end-to-end on the device: **user confirmed "view showing the uploaded photo
correctly"** (2026-11-01), and **repeatedly since — "tested the UploadPhoto and the URL viewer many
times ... all successful"**. **The tidy-up is DONE and the shortcut is renamed to `UploadPhoto-C.jpg`:**
1. **✅ DONE — shortcut tidy-up.** The library holds exactly **`UploadPhoto-C.jpg`** (pk=159, **14
   actions**) plus the user's own `Rename To C.jpg`. `UploadPhoto-001/002/003/004` are **all removed** —
   verified by querying the installed library directly.
2. **✅ DONE — repeated real uploads confirmed.** 7 real uploads landed on 2026-11-01 (16:12 ×2;
   17:05, 17:07, 17:58, 18:00, 18:05), each a commit on `main`, and the VIEW sheet shows the photo.
   **Verify a landing with `gh api repos/prapi01/SICC-Ryder-Cup/git/ref/heads/main` — do NOT use
   `commits?path=images/celebration/C.jpg` (CDN-cached).**
3. **⬜ REMAINING — the v1.22 game-day verification (PRIORITY 1 above)** — the one genuinely unproven
   path: a real mid-round upload **plus** a viewer/celebration opened afterwards, in one live round.
- **⚠️ CORRECTION to the "in-app VIEW" note below:** it says to read via the **Contents API
  `Accept: application/vnd.github.raw`** — that is **WRONG and was the cause of the blank VIEW dialog**
  (`content-type: application/vnd.github.raw`, not an image). The working form, and what
  `UploadPhoto-C.jpg` ships, is **`raw.githubusercontent.com/<commit-sha>/...`**. Do **not** re-introduce
  the Contents-API read-back.
- **Decide the photo-PAT rotation** (see Open questions) — recommended sequence: mint new token → I
  rebuild + re-deliver → confirm one phone upload → **then** revoke the old one.
- **Build the in-app VIEW screen** (approved 2026-11-01). Shortcut half is done. It must read via the
  **Contents API `Accept: application/vnd.github.raw`** — never the CDN or `raw.githubusercontent.com`
  (both verified stale right after an upload).
- **Delete the leftover a-Shell artifacts:** the `C.jpg` folder in `~/Documents/a-shell/` and
  `iOS/sync_celebration.sh` (dead code — the API path replaced it).
- **All other 2026-10-31 fixes are committed, pushed and live on PROD** (Cloudflare Pages deploys on push
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
- **Never tap/run the uploader without a photo** as a "test". The guard is present and verified in the
  **delivered** graph now, but until the phone is confirmed to run it, a no-image run **wipes `C.jpg`
  to 0 bytes**.
  **⚠️ CORRECT recovery recipe — you MUST use the blobs API, not the Contents API:**
  `GET /repos/prapi01/SICC-Ryder-Cup/contents/images/celebration/C.jpg?ref=<good-commit>` returns
  **`content: ""` with `encoding: "none"` for any file over ~1 MB** (usually `encoding: "base64"` for
  smaller files). Writing that empty string back via PUT therefore **writes a 0-byte file** — exactly the
  mistake made on 2026-10-31 (`196db416`), which deepened the damage instead of repairing it.
  Instead: take the good commit's **blob sha**, then
  `GET /repos/prapi01/SICC-Ryder-Cup/git/blobs/<blob-sha>` → returns full `encoding: base64` content
  regardless of size (verified: 2,007,336 base64 chars for the 1,480,820-byte photo), and PUT that back
  with the current contents `sha`. Preferred good commits for `C.jpg`: **`8597b4f5`** (1,480,820 bytes,
  blob `f844b46b...`, restored as `16bfeec6`) or `b8ac561c` (635,029 bytes).
  **A simpler local path now exists:** the correct game-day photo is also at blob sha
  **`4709b6e5`** (1,015,556 B) — a plain `GET` of the **blobs** endpoint returns its full base64, which
  can be PUT straight back (this is how it was restored five times this session).
- Saturday 2026-10-31: play the real game `GM_260914_1342_52` (SICC Millennium-Peirce) — flow
  verified green 2026-10-29 on v4.00.
- Decide whether to mitigate the scorer tab-close write risk (see Open questions).
- Open each project once so its `AD-HOC.md` rename+clean task runs (then it self-empties).
- See `backup/HANDOVER.md` for chat backup/restore operating instructions.
- **All other 2026-10-31 fixes are committed, pushed and live on PROD** (Cloudflare Pages deploys on push
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
- Saturday 2026-10-31: play the real game `GM_260914_1342_52` (SICC Millennium-Peirce) — flow
  verified green 2026-10-29 on v4.00.
- Decide whether to mitigate the scorer tab-close write risk (see Open questions).
- Open each project once so its `AD-HOC.md` rename+clean task runs (then it self-empties).
- See `backup/HANDOVER.md` for chat backup/restore operating instructions.
