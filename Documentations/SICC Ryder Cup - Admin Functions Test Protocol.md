# SICC Ryder Cup — Admin Functions Test Protocol

**Version:** 1.0 · **Date:** 2026-08-10 · **Author:** Automated QA
**Target build:** `main` @ `d4b3745` (deployed to `https://sicc-ryder-cup.pages.dev`)

---

## 1. Purpose & Scope

Define a repeatable, evidence-based test protocol for the **admin (back-office) function surface** of the SICC Ryder Cup app, so we can raise overall production confidence (~85% → 90%+) for the areas outside the already-verified match-day loop.

**In scope (admin pages/behaviours):**

| # | Page / Module | Role |
|---|---|---|
| A | `admin.html` (v1.20) | Admin hub: navigation to sub-pages, device tag, zoom toggle |
| B | `index-hidden.js` (hidden admin) | Hidden admin modal from `index.html` (Duplicate Master, Manage Games, Refresh) |
| C | `manage-games.html` | List games; **Edit**, **Delete** (PIN-gated), **Copy to new date**, view-all |
| D | `setup-game.html` | Create new game / Edit existing (`mode=edit`); roster, course, format, anchor, commit |
| E | `courses.html` (v1.37) | List / add / edit / delete courses; per-hole Par & SI |
| F | `player-management.html` | List / add / edit / delete players; label rules, labelHistory |
| G | `util-record-management.html` | Ops tabs: COPY, COMPARE, VALIDATE, PLAYERS, PHOTO, DELETE |
| H | `js/auth-pin.js` | PIN gate (PIN `8888`), session (5 min), attempts/lockout |

**Out of scope:** real-game scoring, sign-card, viewer, history (covered by `prod-regression.js` / `hcp-postgame-regression.js`); physical iOS Safari (Chromium viewport only — noted as residual risk).

---

## 2. Environment & Preconditions

- **Target:** PROD `https://sicc-ryder-cup.pages.dev` (Firebase project `sicc-ryder-cup`).
  - For **destructive** cases (delete/copy/fix), run against **DEV** first (`BASE_URL=http://localhost:8000`, project `sicc-ryder-cup-dev`) or use clearly-prefixed test records + guaranteed cleanup.
- **Browser/device:** Chromium (headless for automation; headed on D6 for visual), **iPhone 14 Pro viewport 393×852**.
- **Isolation:** one fresh browser context per test case (independent `localStorage`/`sessionStorage`).
- **Auth PIN:** `8888` (see `js/auth-pin.js` `AUTH_PIN`). Session 5 min, max 5 attempts, 30 s lockout.
- **Test data:** all created records use a run token (`adm-<ts>`) prefix in the ID; every case has an explicit cleanup step (delete via helpers or util DELETE tab).
- **Helpers available:** `automated-tests/helpers/game.js`, `realtime.js`, `firestore.js` (get/delete), `env.js` (BASE_URL / project).
- **Non-destructive rule:** nothing in PROD may be deleted or overwritten without a backup step (util VALIDATE has a backup/fix path — always run Backup before Fix on PROD).

---

## 3. Test Protocol Structure

Each test case is defined by:

```
ID      — unique id (e.g. C3)
Title   — what is tested
Pre     — setup required
Steps   — numbered actions (UI) + optional direct Firestore verification
Expect  — expected result (UI state + Firestore document shape)
Risk    — destructive? (DEV-first / backup required)
Auto    — automation readiness (Ready = can be scripted now with existing helpers)
```

**Pass criteria:** every case's `Expect` holds; no page console errors (captured); no orphaned test records after cleanup. A case FAILS on any divergence; failures are reproduced on DEV before being considered a production bug.

---

## 4. Test Case Groups

### Group A — Admin Hub (`admin.html`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| A1 | Hub renders + nav | Load `admin.html`; verify 4 buttons | Buttons: Setup Game, Manage Games, Courses, Player Management; Back link; device tag shows short name; no console errors | Ready |
| A2 | Zoom toggle | Tap zoom toggle | Toggle state flips; no error; setting persisted per `settings.js` | Ready |
| A3 | Hidden admin from hub? | (hub itself has no hidden modal) | N/A — hidden admin lives on `index.html` (Group B) | — |

### Group B — Hidden Admin Modal (`index.html` + `index-hidden.js`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| B1 | Trigger modal | Load `index.html`; long-press / tap the app title (per `attachAdminHandler`) | `#adminModal` appears with 3 actions: **Duplicate Master**, **Manage Games**, **Refresh** | Manual trigger (long-press) — can simulate via JS `showAdminModal()` |
| B2 | Duplicate Master | Open modal → tap Duplicate Master (requires `MASTER_RECORD` in `scheduledGames`) | New game doc created from master (new generated id `GM_...`); navigates / shows new game; duplicate has fresh `createdAt/updatedAt`; cleanup deletes it | Ready (needs MASTER_RECORD present; check + restore) |
| B3 | Manage Games (hidden) | Open modal → tap Manage Games | Redirects `manage-games.html?showAll=true` | Ready |
| B4 | Refresh | Open modal → tap Refresh | `refreshGameList()` reloads without page nav; no duplicate listeners | Ready |
| B5 | Close / dismiss | Tap Close or overlay | Modal removed; no state leak | Ready |

### Group C — Manage Games (`manage-games.html`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| C1 | List renders | Create 2–3 test games (varying dates) → load `manage-games.html` | Games listed with date, course, format, players count; Edit + Delete buttons per row | Ready |
| C2 | Edit flow | Tap Edit on a test game | Saves `sessionStorage.editGameData`, redirects `setup-game.html?mode=edit`; game fields pre-populated | Ready |
| C3 | Delete — wrong PIN | Tap Delete → enter wrong PIN (e.g. 0000) | PIN modal shows error; game NOT deleted; attempt counter increments | Ready |
| C4 | Delete — correct PIN | Tap Delete → enter `8888` | Confirmation dialog → confirm → game removed from `scheduledGames`; page reloads to empty/next list | Ready (destructive: use DEV or test record) |
| C5 | Delete — session persistence | Delete one game; delete a 2nd without re-entering PIN (within 5 min) | 2nd delete does not prompt PIN (session auth) | Ready |
| C6 | Delete — lockout | Enter wrong PIN 5× | After 5 failures: locked 30 s; further input blocked with message; after 30 s attempts allowed again | Ready |
| C7 | Copy to new date | On a test game → Copy → set new date | New game `GM_...` created with same data but new date/id; source unchanged; cleanup both | Ready (destructive: cleanup) |
| C8 | View all toggle | Toggle show-all / today | Filter changes list scope correctly | Ready |
| C9 | Back link | Tap Back to Game Settings | Returns `admin.html` | Ready |

### Group D — Setup Game (`setup-game.html`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| D1 | Create new — happy path | Setup → pick course, 8 players, teams/flights, format, starting hole → commit | New `scheduledGames` doc with correct shape (f1/f2 empty 162-char strings, players 8, course, startingHole, anchor, results null/empty); redirects as configured | Ready |
| D2 | Create — validation (team/flight) | Invalid team/flight distribution (e.g. uneven) → commit | `validateTeamFlight()` blocks with message; no write | Ready |
| D3 | Create — date validation | Invalid date → commit | `validateDate()` blocks; no write | Ready |
| D4 | Latest handicaps prefill | Pre-create history records with known final handicaps → open setup | `loadLatestHandicapsFromHistory` prefills player handicaps from `historyGames` | Ready |
| D5 | Anchor selection | Roster with ≥1 zero-hcp player → commit | Anchor modal appears; choosing anchor sets `anchor` field correctly | Ready |
| D6 | Shotgun start hole | Set starting hole 10 → commit | `rotateDataString` produces correctly rotated par/data; `startingHole=10` stored | Ready |
| D7 | Edit — dirty check | `mode=edit` via C2 → change a field → navigate away | `beforeunload` / modal warns unsaved changes; "Update & Save" commits | Ready |
| D8 | Edit — clean exit | Open edit, no changes → back | No dirty warning; returns to manage-games | Ready |
| D9 | Edit — commit shape | Edit existing game (change a score-less field) → save | `performFirestoreUpdate` updates same doc; data strings/results preserved | Ready |
| D10 | Default players update | Commit a game with roster → verify `playerInformation` players doc updated with defaults | `updateDefaultPlayers` writes/merges; no data loss on existing players | Ready |
| D11 | Archive old games | Set up old completed game → commit new game | `archiveOldGames` moves old docs to `trashGames` and removes from `scheduledGames` (verify + cleanup) | Ready (destructive) |
| D12 | Cancel / back | Setup → back | Returns `admin.html` (new) or `manage-games.html` (edit); no partial write | Ready |

### Group E — Courses (`courses.html`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| E1 | List renders | Load page (seeds `DEFAULT_COURSE` if `courses` empty) | Course list with name + par detail; edit/delete per item | Ready |
| E2 | Add course | Add new course; set 18 holes par/SI | `saveCourse()` → `db.collection("courses").add(courseData)`; new doc appears; par/SI arrays length 18 | Ready |
| E3 | Edit course | Edit existing → change one hole par | `update` on same doc; par/SI updated; UI reflects | Ready |
| E4 | Delete course | Delete a test course | `db.collection("courses").doc(id).delete()`; removed from list | Ready (destructive: test course only) |
| E5 | Par/SI integrity | Add course with a hole par out of valid range | Validation (if any) blocks, or store and verify value; document behaviour | Ready |
| E6 | Course referenced by games | Delete course that a game references | Verify graceful handling (game shows stale course or handled) — document expected | Manual/Risk |

### Group F — Player Management (`player-management.html`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| F1 | List renders | Load page | Players listed with label, handicap, cooldown state | Ready |
| F2 | Add player | Add player (name, label, hcp) | `savePlayers` persists to `playerInformation/players`; appears in list | Ready |
| F3 | Edit player | Edit existing | Inline edit; save writes changes | Ready |
| F4 | Delete player | Delete test player | Removed from `players` array; doc saved | Ready (destructive) |
| F5 | Label — auto-generate | Add player without label | `generateLabel` creates 2–3 char label | Ready |
| F6 | Label — already in use | Try to set a label used by another active player | `validateLabelChange` blocks with message; no save | Ready |
| F7 | Label — cooldown | Edit label of a player recently changed | Cooldown blocks (or warns) per `getCooldownRemaining`/`canChangeLabel` | Ready |
| F8 | Label history | Change a player's label | `labelHistory` object merged into `playerInformation/players`; old label retained | Ready |
| F9 | Label — used-labels consistency | Verify labels not duplicated across active players after edits | No two active players share a label; usedLabels data consistent | Ready |

### Group G — Util Record Management (`util-record-management.html`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| G1 | COPY tab | Select a `scheduledGames` record → Copy | New duplicate doc created with new id; source untouched; cleanup | Ready |
| G2 | COMPARE tab | Select 2 records → Compare | Diff shown; identical strings → match; differing → mismatch listed | Ready |
| G3 | VALIDATE — load | Select record → Load | Invariants recomputed & displayed (match=16/hole, TR=19/hole) using `loadValidateRecords` + `loadAndValidate` | Ready |
| G4 | VALIDATE — backup | On a record → Backup | Backup snapshot persisted before any fix | Ready |
| G5 | VALIDATE — fix | On a record with stale results → Fix | Recomputes + persists results/TR/handicaps; verifies via re-load; on PROD: Backup first | Ready (destructive) |
| G6 | PLAYERS tab | Load players list | Shows players; consistent with `playerInformation` | Ready |
| G7 | PHOTO tab | Check/upload path | Photo verify/upload functions (`checkAndRenameCelebrationPhoto` etc.) present; no errors | Ready/Manual |
| G8 | DELETE tab | Select record → Delete (with confirm) | Record removed from chosen collection (test record only) | Ready (destructive) |
| G9 | Tab switching | Switch all 6 tabs | Each tab content activates cleanly; version badges populate; no console errors | Ready |

### Group H — Auth PIN (`js/auth-pin.js`)

| ID | Title | Steps | Expect | Auto |
|---|---|---|---|---|
| H1 | Correct PIN | Enter `8888` | Auth success; action callback fires | Ready |
| H2 | Wrong PIN | Enter wrong PIN | Error shown; not authenticated; attempts tracked | Ready |
| H3 | Session timeout | Authenticate; wait >5 min (simulate) | `isAuthenticated()` false; next protected action prompts PIN again | Ready |
| H4 | Lockout | 5 wrong attempts | Locked 30 s; input rejected with message; auto-unlock after 30 s | Ready |
| H5 | Reset on cancel/close | Open modal → cancel | `resetAuth()` clears pending action; no side effects | Ready |

---

## 5. Data Model Assertions (Firestore)

Every case asserts the resulting document shape (via `helpers/firestore.js`):

- **`scheduledGames/{id}`** (game): `gameInfo{date,course{name,par,si},startingHole,teamGameFormat}`, `players[8]` with `{name,label,handicap,team,flight,anchor?}`, `f1.d`/`f2.d` (162-char), `results`, `signatures`, `anchor`, `createdAt/updatedAt`.
- **`historyGames/{id}_H`**: as verified in `hcp-postgame-regression.js` (status completed, version 3, schema `v3_strings`, adjustedHandicaps, finalResults, archiveId).
- **`courses/{id}`**: `name`, `par[18]`, `si[18]`.
- **`playerInformation/players`**: `players[]`, `labelHistory{}`, `usedLabels` (if any), `updatedAt`.
- **`trashGames/{id}`**: moved-from record keeps `_originalCollection = "scheduledGames"`.

**Invariants (any record):** data-string length 162; player count 8; TR sums 19/hole; match results 16/hole (matches util VALIDATE).

---

## 6. Execution Order & Priority

1. **P0 (blocking, run first):** C1, C2, D1, D2, D3, D5, D6, E1, E2, F1, F5, F6, H1, H2 — core CRUD + validation + auth.
2. **P1:** C3–C6, C7, D4, D7–D10, E3–E5, F2–F4, F7–F9, G1–G3, G6, G9, H3–H5.
3. **P2 (destructive/risky, DEV-first):** D11 (archive), G5 (fix), G8 (delete), E4/E6 (course delete), C4 (delete).
4. **Visual pass:** headed on D6 (window layout) for A1, C1, D1, E1, F1, G9.

Destructive cases always: **DEV first → backup → PROD test-record only → cleanup**.

---

## 7. Reporting & Sign-off

- Output: `PASS/FAIL` per case with evidence (screenshot on fail, Firestore doc snapshot).
- Roll-up: `passed/total` per group + overall (target ≥ 95% of P0/P1 green before ship).
- Console-error capture is a mandatory PASS condition (mirrors `prod-regression.js` approach).
- Residual risks logged separately: physical iOS Safari, realtime network stress, manual long-press trigger.

---

## 8. Automation Mapping (existing harness)

| Protocol group | Reusable pieces |
|---|---|
| A, B | `makeDeviceContext` + direct `goto` + `showAdminModal()` |
| C, D | `helpers/game.js` (create/fetch/delete), `helpers/firestore.js`; `AuthPin` driven via page evaluate + click |
| E, F | `helpers/firestore.js` seed + assertions |
| G | util functions via page evaluate (`loadValidateRecords`, `loadAndValidate`, copy/compare/delete) |
| H | `AuthPin.authenticateWithPin` via evaluate; clock simulation for timeout/lockout |

**Suggested next step:** scaffold `automated-tests/tools/admin-smoke.js` implementing the P0 set (C1,C2,D1,D2,D3,D5,D6,E1,E2,F1,F5,F6,H1,H2) — read-only + test-record CRUD with auto-cleanup.
