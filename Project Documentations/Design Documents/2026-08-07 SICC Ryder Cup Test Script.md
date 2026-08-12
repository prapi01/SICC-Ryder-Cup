# SICC Ryder Cup — Two-Device Realtime Test Script

- **Version:** 1.2
- **Date:** 2026-08-07
- **Scope:** Manual test script for the production app, focusing on realtime 2-device operation, game completion, handicap adjustment, history archiving, admin functions, and **calculation-logic verification** (match / T-1 / T-2 / Strk / TR / handicap for any score input).
- **App under test:** SICC Ryder Cup (Cloudflare Pages + Firebase)

---

## 1. Purpose & Main Focus Areas

The app is designed for **2 devices** updating Firebase in real time. This script verifies the four critical flows plus admin tooling:

1. **Real-time score/result updates** as the game proceeds (both devices see live changes without refresh).
2. **Game completed situation** — when **both flights** sign their respective scorecards.
3. **Handicap adjustment** after the game is completed.
4. **History record creation** — capturing all relevant data for archive.
5. **Admin functions** — hidden admin, game management, record tools, validation, player management.
6. **Calculation-logic verification** — verifying the scoring engine (match / T-1 / T-2 / Strk / TR / handicap) is **correct for any score input**, using logic invariants and the app's own recalc/validate tools.

---

## 2. Pre-Requisites

| Item | Detail |
|------|--------|
| **2 mobile devices** (or 2 browsers / 2 incognito windows on a desktop) | Needed for the 2-device flow. A 3rd device/`VIEW` role is optional but recommended. |
| **Same deployment** on all devices | Both devices must open the **same URL** so they write to the same Firebase project (see Environment). |
| **Firebase rules** | Storage rules deployed (scoped to `celebration/`) so the celebration photo flow works. |
| **Test course & roster** | A test course with **known Par/SI**, and the 8 default players with set handicaps — see **Section 4** (Test Game Data). |
| **Clean app state** | Clear site data / `localStorage` on each device so each gets a fresh device session. |
| **Network** | Stable internet (Firestore realtime + Storage). |

### 2.1 Test Environment

| URL | Firebase project | When to use |
|-----|------------------|-------------|
| `https://<hash>.sicc-ryder-cup.pages.dev` (preview) | **DEV** (`sicc-ryder-cup-dev`) | Daily testing — safe, won't touch prod data. |
| `https://staging.sicc-ryder-cup.pages.dev` | **DEV** | Staging environment. |
| `https://sicc-ryder-cup.pages.dev` | **PROD** (`sicc-ryder-cup`) | **Only** final acceptance, and be aware it uses real data. |

> ⚠️ **Never run destructive tests on PROD.** Use the preview/staging (DEV) for all routine testing.

---

## 3. Device Setup

1. **Device A** → open the test URL → it shows a device tag (e.g., `DEV-01`) → will be the **Flight 1 (F1) scorer**.
2. **Device B** → open the same URL → gets its own device tag (e.g., `DEV-02`) → will be the **Flight 2 (F2) scorer**.
3. *(Optional)* **Device C** → open the URL → will use the **VIEW** role to observe both flights.
4. Record which device is A/B/C and their device tags for the log.

---

## 4. Test Game Data & Calculation-Logic Verification

> **Core principle:** the actual scores are **irrelevant** to verifying the engine — *any* score is a possible real game score, and what matters is that the **calculation logic is correct**. This section uses **two layers**:
>
> 1. **Primary — logic invariants + the app's own recalc/validate** (§4.3): works for **any** score data with no hand-computation. The app recomputes match / T-1 / T-2 / Strk / TR / handicap from the raw data strings and compares to the stored results, and we assert invariants that must hold regardless of scores.
> 2. **Sanity — deterministic all-PAR / all-BOGEY** (§4.4): a hand-checkable input used as one quick sanity scenario only.

The game outcome depends on **course SI** and each player's **handicap**. Handicap is applied as **absolute** (player plays off their own handicap) or **relative** (compared to the opponent / anchor) depending on the game being calculated:

| Game | Handicap mode |
|------|---------------|
| **Match game** (16 matches) | **Relative** — strokes = difference between the two players' handicaps |
| **Team game T-1 / T-2** | **Tournament** = **absolute** (own handicap); **Relative** = vs the flight's lowest handicap |
| **Stroke game (Strk)** | **Absolute** — cumulative nett = total gross − total team handicap |
| **Handicap adjustment (post-game)** | **Relative** — vs the anchor (lowest-handicap player): Anchor Adj (±1 per 2 holes won/lost vs anchor) + Performance Adj (from 4 matches) |

### 4.1 Deterministic test course
Add/select a test course with a **known Par and SI** so results are hand-computable. Sample course (all Par 4):

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|------|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|----|----|
| Par  | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4  | 4  | 4  | 4  | 4  | 4  | 4  | 4  | 4  |
| SI   | 11| 5 |15 | 1 | 9 |17 | 3 |13 | 7 | 18 | 8  | 16 | 4  | 12 | 2  | 10 | 6  | 14 |

> If not adding a test course, use the **real course's SI/Par** and apply the same method below.

### 4.2 Test roster (use the app's default 8 players)

| Team | Flight | Name | Label | Handicap |
|------|--------|------|-------|----------|
| A | F1 | Ang C H | ACH | 1 |
| A | F1 | Chenh Hoe | CH | 10 |
| A | F2 | C K | CK | 8 |
| A | F2 | Yip H M | YHM | 12 |
| One | F1 | Jeff Goh | JG | 0 |
| One | F1 | Ong C B | OCB | 1 |
| One | F2 | Piti | P | 8 |
| One | F2 | James Ong | JO | 11 |

> Team A total hcp = **31**; Team One total hcp = **20**. Anchor = **JG (0)** (lowest).

### 4.3 Primary verification — logic invariants + the app's recalc/validate (any scores)

**The calculation basis (verified against the code):**
- **Nett per hole (absolute):** a player receives **1 stroke on hole h** if `handicap ≥ SI(h)`; nett = gross − 1 on those holes, else gross.
- **Match game — 16 matches (relative):** each A player vs each One player; the higher-handicapped player gives strokes equal to the **handicap difference** on holes where `diff ≥ SI(h)`; lower nett wins the hole (halve if equal). Points = **16 points/hole** — each currently-up match gives its team 1 point (halve = 0.5/0.5); final totals = 16 (won = 1, halve = 0.5).
- **Team game T-1 / T-2 (relative to flight):** per flight, the 2 players are sorted by nett → **best vs best, 2nd vs 2nd** (±1/0 each) → flight total (−2…+2) → running cumulative. Effective hcp = own − flightMinHcp in **Relative**; own hcp in **Tournament (absolute)**. Points = **1 point/hole each** to the **cumulative flight leader** (0.5/0.5 if tied). Display = `A n` / `O n` / `AS`.
- **Stroke game (absolute):** cumulative nett per team = (sum of all 4 players' gross) − **total team hcp**; the running leader gets **1 point/hole** (0.5/0.5 tie).
- **TR (Total Result):** per hole = Match(16) + T-1(1) + T-2(1) + Strk(1) = **19 points** split between the teams (`trA = game1Points + game2Points + game3Points`); final = the hole-18 snapshot (e.g., 7.5 vs 11.5 = 19).
- **Handicap adjustment (relative to anchor):** anchor = lowest-handicap player. For each player, an 18-hole match vs the anchor (strokes = hcp difference). **Anchor Adj** = ±1 per **2 holes** won/lost vs anchor (won → CUT, lost → ADD). **Perf Adj** from their 4 match points (≥ 3.5 → CUT 1; ≤ 0.5 → ADD 1). **New Hcp = Old + Perf Adj + Anchor Adj**; zero-rise applied so the lowest New = 0 (new anchor).

**Invariants that MUST hold for ANY score data:**

| # | Invariant | When |
|---|-----------|------|
| I1 | `trA + trB = 19` (Match 16 + T-1 1 + T-2 1 + Strk 1) | every hole (cross data available) |
| I2 | Final total TR = 19 | final |
| I3 | Match game totals = 16 points (won 1 / halve 0.5) | final |
| I4 | T-1 + T-2 = 2 points per hole (1 each) | every hole |
| I5 | Strk = 1 point per hole | every hole |
| I6 | T-1/T-2 point goes to the **cumulative** flight leader (not per-hole winner) | every hole |
| I7 | `New Hcp = Old + Perf Adj + Anchor Adj`; lowest New = 0 (new anchor) | post-game |
| I8 | Recalc/Validate mismatch count = 0 | on record |

**Use the app's own Recalculate/Validate (the strongest logic check):**
1. Open **Record Management (`util-record-management.html`)** for the completed game.
2. Run **Validate** — the tool **recomputes match / T-1 / T-2 / Strk / clinch / TR / handicap from the raw f1/f2 data strings** and compares them to the stored results. Pass = mismatch count **0**.
3. Run **Fix** on a deliberately corrupted record (tamper one score), then re-validate → the tool detects and rebuilds it; validation passes again.
4. Because it recomputes from raw data, this verifies the calculation **logic for any score input** — not just the all-PAR scenario.

> ⚠️ **Known edge case (2026-08-07 finding):** the **Fix tool's handicap recalculation** reads the cached `results.matchResults[17]` (hole 18 of the cross-flight match game) instead of recomputing it from the raw f1/f2 strings. If a record is missing `matchResults` (e.g., a partially-saved game, a legacy/migrated record, or F2 data injected outside the app flow), Fix logs `No matchResults data found at hole 18 in cache` and writes **all-zero** handicap adjustments (perf/anchor) instead of the correct ones. **Core calculation logic is unaffected** (Validate recomputes match/T-1/T-2/Strk/TR/handicap correctly from raw data); this is a Fix-tool robustness gap, not a calculation bug. Normal games completed via the app have `matchResults` populated, so Fix works. Tracked as a follow-up.

### 4.4 Sanity scenario (optional) — all-PAR / all-BOGEY
Enter the **same score for every player on every hole**:
- **Scenario 1 — All PAR:** every player scores **Par** on every hole.
- **Scenario 2 — All BOGEY:** every player scores **Par + 1** on every hole.

With gross fixed, every result is a **pure function of course SI + handicap** → hand-computable. Use as a quick sanity check (worked examples in §4.5); the primary verification is §4.3.

**Nett rule (absolute):** a player receives **1 stroke on hole h** if `handicap ≥ SI(h)`. Nett = Gross − 1 on those holes, else Gross.

**Match rule (relative):** in each A-vs-B match, the higher-handicapped player gives strokes equal to the **handicap difference**, on holes where `diff ≥ SI(h)`. Lower nett wins the hole (halve if equal).

**What to verify with this scenario:**
1. **Match game:** all 16 match results match your hand-computed winners/margins (incl. each player's 4-match total and any clinch flags).
2. **Team game T-1 / T-2:** per hole, best-2 nett per flight wins; running margin; final `displayT1/displayT2` (shows `O#` when Team One leads).
3. **Stroke game (Strk):** cumulative nett per team = (holes × team gross) − total team hcp. Team with lower cumulative nett wins each hole. Expect **Team A** to win the stroke game with these handicaps (A total 31 > One 20).
4. **TR:** at every hole, Match + T-1 + T-2 + Strk = **19 points** across both teams. Final Team A vs Team One TR = your hand total.
5. **Handicap adjustment:** anchor JG (0); verify Anchor Adj, Perf Adj, Raw, New Hcp for each player; confirm the **new anchor** (lowest new hcp) and zero-rise logic.

### 4.5 Worked examples (sample course, all-PAR)
- **Strokes received (absolute):** hcp 10 (CH) gets a stroke on holes where `SI ≤ 10` → H2(SI5), H4(SI1), H5(SI9), H7(SI3), H9(SI7), H13(SI4), H15(SI2), H16(SI10) — nett Par−1 there, Par elsewhere.
- **Match Ang (1) vs JG (0):** diff 1 → Ang gets a stroke on SI 1 only (H4) → **Ang wins 1-up**.
- **Match CH (10) vs OCB (1):** diff 9 → CH gets strokes on SI 1–9 (9 holes) → CH wins those holes (margin per layout).
- **Stroke game:** cumulative nett A = 18×(4×4) − 31 = 257; nett One = 18×16 − 20 = 268 → **A wins by 11 strokes** (nett).
- **Handicap adjustment (method):** New Hcp = Old + Perf Adj + Anchor Adj (both from 0.5-point/1-stroke-per-2-holes rules); verify against the app's table.

### 4.6 Using the assumptions in the test cases
When running **Section 5**, the primary logic checks are the **invariants in §4.3** plus the **recalc/validate** step — they hold for **any** scores you enter, so there is no need to force Par/Bogey. If you also want the hand-computed sanity check, enter the **same chosen score (Par or Bogey) for every player on every hole** and compare the app's output (scorecard, T-1/T-2/Strk, TR header, final results, handicap table) to the worked examples in §4.5. Any deviation = a defect.

## 5. Test Cases

> Mark each step ✅ Pass / ❌ Fail / ⚠️ Partial, and note the device + timestamp.

### A. Set Up New Game & Pre-Game

| # | Step | Expected Result |
|---|------|-----------------|
| A1 | On one device, open **Game Settings → Set Up New Game**. | Form loads: Date, Course, Format, 8 players (4 per team). Team selectors show `A`/`O`; open list shows `A`/`One`. |
| A2 | Select **Game Date = today**, **Course**, **Starting Hole**, **Team Game = Tournament**. | All selectors update correctly; no console errors. |
| A3 | Add/confirm 8 players — 4 in Team A, 4 in Team One, 2 per flight per team. | Validation passes; **Commit** succeeds; game appears as "today's game". |
| A4 | Verify **team assignment** persists (`A` vs `One`, stored as `B` internally). | Player Management + Setup both reflect the teams. |
| A5 | From Home, tap **GAME DAY / NEXT GAME** → **Pre-Game**. | Pre-game shows 8 players grouped **TEAM A** and **TEAM ONE**, with flights. |
| A6 | On pre-game, **Device A selects `SCORE F1`**, **Device B selects `SCORE F2`**. | Each device locks its flight; roles assigned. |
| A7 | On a 3rd device, use the **VIEW** role (or open view-game later). | VIEW sees the game without an editing role. |

### B. Real-Time Scoring (CORE)

| # | Step | Expected Result |
|---|------|-----------------|
| B1 | Both devices enter **real-game** for the same game. | F1 device edits **Flight 1** only; F2 device edits **Flight 2** only; both see the same hole/play order. |
| B2 | **Device A** enters scores for Flight 1 players on Hole 1 and taps **SAVE**. | Score saves; on **Device B** the Flight 1 scores/Hole 1 **update automatically** (no refresh). |
| B3 | **Device B** enters Flight 2 scores on Hole 1 and saves. | Updates appear live on **Device A** and any **VIEW** device. |
| B4 | Continue for several holes (e.g., H1–H9). | Match results, T-1/T-2/Strk rows, and TR values update in real time on all devices; **AS squares** render for tied holes; margins show **`O#`** when Team One leads. |
| B5 | Open the **scorecard** on both devices. | T-1/T-2/Strk rows show `O3`/`O1` style values (Team One = `O`); header shows `TEAM A | TEAM ONE`. |
| B6 | **Concurrency / locks:** on a fresh device, try to select a flight that is already locked by another device. | Role is **blocked / unavailable** (lock held by the other device). |
| B7 | *(Optional)* Force a **role takeover** scenario (e.g., second device tries same flight). | Takeover modal appears on the losing device; it can switch to **VIEWER**. |
| B8 | **Realtime reliability:** leave devices on the scorecard and save scores from the other device. | No manual refresh needed; no duplicate/conflicting writes; **WRV** verification passes (no "verify failed" errors). |
| B9 | Navigate holes (play order) on both devices. | Both stay in sync on the current hole; saved-holes indicators match. |

### C. Game Completed (Both Flights Sign)

| # | Step | Expected Result |
|---|------|-----------------|
| C1 | Score **all 18 holes** on both flights (or to the last hole, shotgun start). | All holes saved on F1 and F2. |
| C2 | **Device A** completes Flight 1 → **sign/submit the Flight 1 card**. | Status shows "F1 signed; waiting for F2"; **Device B** sees this update in real time. |
| C3 | **Device B** completes Flight 2 → **sign/submit the Flight 2 card**. | **GAME COMPLETED** modal appears ("Both cards have been signed!"); celebration triggers. |
| C4 | Verify **winner / final scores** (Team A vs Team One). | Final TR totals and winner text (`Team One Wins!` if Team One won) are correct. |
| C5 | *(Realtime)* Both devices observe the completion. | Both devices transition to completion/celebration consistently. |

### D. Handicap Adjustment (After Completion)

| # | Step | Expected Result |
|---|------|-----------------|
| D1 | After completion, open/reach **Handicap Adjustment** (`hcp-adjust.html`). | Table shows each player: Old, Anchor (Anc), Performance (Perf), Raw, New Hcp — grouped under **TEAM A** and **TEAM ONE**. |
| D2 | Confirm the **anchor** player(s) and adjustments. | Anchor/performance adjustments compute correctly; zero-rise Raw column appears when applicable. |
| D3 | **Save/confirm** the handicap adjustment. | `adjustedHandicaps` are persisted with the record; no errors. |
| D4 | Re-open the adjustment later (from history). | It renders as **read-only** with the stored values. |

### E. History Record Creation (Archive)

| # | Step | Expected Result |
|---|------|-----------------|
| E1 | After game completion + handicap, verify the **history record** was created. | A record exists in the **`historyGames`** collection (doc id = game id + `_H`), with status **completed**. |
| E2 | Verify **all archive fields** are captured: game info, course, players (name/label/handicap/team/flight), F1 & F2 raw data strings, results (match/T-1/T-2/Strk/TR per hole), winner/final scores, signatures, adjusted handicaps, celebration photo. | No missing fields; data strings match what was played. |
| E3 | Open **Previous Games / View History** on a device. | The completed game appears with the archived scorecard; T-1/T-2/Strk show **`O#`**; winner text correct. |
| E4 | Open the **celebration replay** / photo from history. | Celebration + photo load correctly (Storage rule allows `celebration/`). |

### F. Post-Game & Viewing

| # | Step | Expected Result |
|---|------|-----------------|
| F1 | From history, open a completed game → **view-game**. | Full scorecard (players, par, SI, T-1/T-2/Strk, TR) renders correctly with `O#`. |
| F2 | Verify **read-only** after completion. | No editing controls available on a completed game. |
| F3 | Verify **view-history** list sorts/labels completed games correctly. | Completed games identifiable (status, date, course). |

### G. Admin Functions

| # | Step | Expected Result |
|---|------|-----------------|
| G1 | **Hidden admin** — on Home, **Cmd/Ctrl+Click**, double-click, or long-press (800ms) the golf icon. | Admin modal opens. |
| G2 | **Duplicate master record** (hidden admin). | Creates a `MASTER_RECORD` copy in `scheduledGames` correctly; game id format `GM_YYMMDD_HHMM_XX`. |
| G3 | **Game Settings (admin.html)** — adjust settings. | Changes persist (courses, format defaults). |
| G4 | **Manage Games** — view scheduled games. | List loads from Firestore; statuses correct. |
| G5 | **Player Management** — add / edit / delete a player. | Save writes to Firestore (used-labels sync); team badge shows `A`/`O`; Edit modal lists `Team A`/`Team One`. |
| G6 | **Record Management (`util-record-management.html`)** — open the completed game's record. | Record tools load: validate, fix, copy, compare, delete, photo. |
| G7 | **Validate** a completed record. | Validation passes (TR, match, T-1/T-2/Strk, clinch, handicap, photo); mismatch counts = 0. Team One headers + `O#` margins display correctly. |
| G8 | **Fix** a deliberately-corrupted record (e.g., tamper a score), then re-validate. | Tool detects the mismatch and can rebuild/fix it; after fix, validation passes. |
| G9 | **Copy** a record to a new id. | Copy created; identical when compared (`compare` = identical). |
| G10 | **Delete** a test record (use a throwaway/test record only). | Deletion confirmed and removed from Firestore. |
| G11 | **Celebration photo** (admin photo panel). | Upload/download/delete work against Storage; flags update correctly. |

---

## 6. Edge Cases & Data-Integrity Checks

| # | Check | Expected Result |
|---|-------|-----------------|
| E1 | Restart / reload a device mid-game. | Device reconnects to the game from Firestore; no data loss; role/lock handled. |
| E2 | Kill one device, keep the other scoring. | Other device continues; on relaunch the first re-syncs. |
| E3 | Two devices save the **same hole** simultaneously. | No corruption; latest valid write wins (WRV + locks). |
| E4 | **All-Square** holes. | `AS` green squares render; TR totals still sum correctly (19/hole). |
| E5 | **Team One leading** margins. | Scorecard shows `O#` (e.g., `O3`), not `B#`; historical records also render `O#`. |
| E6 | **Offline** moment during a save. | Firebase retry/write-verify handles it; user sees retry UI, no silent data loss. |
| E7 | **Historical records created BEFORE the rename** (stored `B#`). | They still display as `O#` (render-time transform) — no data migration needed. |
| E8 | **Storage** celebration photo upload on F1 → download on F2 / VIEW. | Photo flags flow correctly; no 403 errors (rules allow `celebration/`). |

---

## 7. Result Log Template

| # | Test Case | Device | Result (✅/❌/⚠️) | Notes / Evidence |
|---|-----------|--------|------------------|------------------|
| A1 | ... | A | ✅ | ... |
| B2 | ... | A & B | ✅ | Real-time update seen on B without refresh |
| ... | ... | ... | ... | ... |

---

## 8. Acceptance Criteria

- All **B** (realtime) and **C** (completion) core cases pass on 2 devices.
- **D** (handicap), **E** (history archive), and **F** (viewing) produce complete, correct data.
- All **G** admin functions operate without error (using throwaway records where destructive).
- No console errors, no WRV "verify failed", no Firebase 403/404 on Storage.
- Team One rename displays correctly throughout (`Team One`/`TEAM ONE`/`O#`), including on historical records.

---

## 9. Document History

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-08-07 | Initial two-device realtime test script covering scoring, completion, handicap, history, admin |
| 1.1 | 2026-08-07 | Reframed Section 4: calculation-logic verification is **score-independent** — primary = logic invariants + the app's recalc/validate (any scores); all-PAR / all-BOGEY demoted to an optional sanity scenario |
| 1.2 | 2026-08-07 | Documented Fix-tool edge case: handicap recalculation reads cached `results.matchResults[17]`; on records missing it, Fix writes all-zero handicaps (core logic unaffected; normal games OK). Tracked as follow-up |
