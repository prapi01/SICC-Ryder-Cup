# SICC Ryder Cup — Release Notes

## Version 4.0.0 (2026-08-10)

This release is a **correctness + stability** release with one major feature. It
introduces the **Team One** rename, fixes regressions introduced in
**Version 3.0.0**, restores data integrity for completed games, adds
design-standard compliance to the viewer, and ships the automated QA harness
used to prove it all on live production.

---

### ✨ Major feature — Team One

The second team is now displayed as **"Team One"** (short form **"One" / "O"**)
throughout the app's user-facing UI, replacing the old "Team B" label.

- **Player Management** table: team badge shows **One** (the dropdown keeps the
  full "Team One").
- **Team selectors** (setup-game, util record management): compact **O** when
  closed, **Team One** in the open list.
- **View History**: TR header **"TEAM ONE"**, T-2/Strk margins use the **O#**
  short form, winner text **"Team One Wins!"**.
- **Display-only rename** — internal values remain Team A / B, so there is no
  data migration and it is fully backward compatible. Shipped with the storage
  rules fix.

### 🐛 Critical fixes (Version 3.0.0 regressions)

1. **Game completion restored (`submitSignature`).**
   Version 3.0.0 (sign-card v1.40) removed `submitSignature`, but
   `real-game-nav.js` still calls it on SIGN CARD. Games were stuck on the
   waiting screen forever. Restored and hardened:
   - Writes `signatures.f{n}.signed = true` (with retries).
   - Watches until **both flights** are signed, then F2 (single-writer, once)
     triggers `saveGameToHistory` → the `_H` history record auto-creates.
   - Verified live on production (score → sign → GAME COMPLETED → history).

2. **Celebration photo restored.** Version 3.0.0 also removed the photo from the
   celebration screen (same regression commit) — the screen only showed the 🏆
   emoji. Restored, and the **default celebration photo now loads on ALL
   devices at game start** (scorers *and* viewer), per the photo-management
   design (v5.0). No more emoji-only celebration.

3. **History record integrity.** Auto-created history records now include:
   - `adjustedHandicaps` — computed from raw data at signing time
     (`HandicapAdjustment.calculateAllAdjustmentsFromRaw`), matching the real
     record values exactly.
   - `finalResults` — `teamAScore` / `teamBScore` / `winner` / `winnerText`.
   - `version: 3`, `schema: "v3_strings"`, `archiveId`.
   - Verified **byte-for-byte** against the real SICC Bukit record
     (`GM_260606_1010_13_H`, final 14 : 5).

### 🎨 UI / design compliance

4. **Viewer "Back to Main Menu"** now uses the standard back-link design
   (border-top divider, centered, muted) instead of the non-compliant pill
   button — consistent with the rest of the app.

### 🧪 Automated QA harness (new)

5. Added the automated test suite under `automated-tests/`:
   - **Step Runner** — 5-window live harness (F1/F2 scorers + V1/V2 viewers +
     controls) on the ultrawide display, per-flight stepping / GO AUTO.
   - **Real-data scenarios** — real SICC Bukit game & scores (validated against
     the real record), shotgun (H10) full flow.
   - **Rejoin (R-series)** and **cascade (C-series)** scenario suites.
   - **Production regressions** — `prod-regression` (12/12 PASS) and
     `hcp-postgame-regression` (9/9 PASS), both verified live on
     `https://sicc-ryder-cup.pages.dev`.

### ✅ Verified on production
- Real-game scoring → signing → completion → auto history (14 : 5, TR=19/hole,
  both flights signed, finalResults present).
- Viewer celebration shows the photo; cold-viewer also shows the photo.
- Handicap adjustment computed in the history record; `hcp-adjust.html` and
  `post-game.html` render correctly.

---

### Prior versions
- **Version 3.0.0** — (known to contain the regressions fixed above; superseded by 4.0.0)
- **Version 2.0.x** — earlier gameplay/scoring release.
- **Version 1.0.x** — initial release.
