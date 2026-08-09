# SICC Ryder Cup — Automated Test Harness

Phase 1: skeleton + smoke. Two suites (see protocol doc §0.5, v1.7).

## Suites

| Suite | Scope | Command | When |
| ----- | ----- | ------- | ---- |
| **A** | Admin & Record Integrity (N-series subset) | `npm run suite:a` | On-demand — "if it's working, it's working" |
| **B** | Actual Game realtime smoke (F1/F2/V1/V2) | `npm run suite:b` | Regression / every change |
| both | | `npm test` | CI |

## Setup

```bash
cd automated-tests
npm install
npm run install:playwright   # downloads Chromium
```

## Environment

Set via env vars (see `.env.example`):

- `BASE_URL` — default `https://sicc-ryder-cup.pages.dev` (PROD, the only env with current code;
  staging/preview = DEV is out of scope). Override to target a preview build.
- `FIREBASE_PROJECT` — derived from hostname (staging/preview/localhost → `sicc-ryder-cup-dev`,
  else `sicc-ryder-cup`). Set explicitly to override.
- `HEADED=1` — headed mode (useful for the Step Runner / visual debugging).
- `TEST_MODE` — `headless` (default) | `step` (interactive Step Runner — Phase 2+).

## How a test game is handled

- Each run creates a game in `scheduledGames` via Firestore REST using the **exact schema**
  `setup-game.html` writes, tagged `testGame: true` + `testRunId`.
- Suite B opens **4 isolated browser contexts** (each = its own device identity / localStorage):
  F1, F2, V1, V2. All go through `pre-game.html` and TEE OFF with their role.
- The game is **always deleted** in `afterAll`, even on failure.

## Design notes

- `requestAnimationFrame` is patched to fire synchronously (the app's setup commit uses a
  double-rAF gate that never fires in headless/background tabs).
- `sessionStorage.currentGameId` is injected via `addInitScript` so `pre-game.html` knows which
  game to load (survives the app's `?v=` cache-busting redirect).
- Each device context **pre-seeds `localStorage.deviceId` + `shortDeviceName`**. This avoids
  `SessionManager.getShortDeviceName()`'s Firestore `deviceMapping` allocation loop, which hangs
  once **all 99 DEV-## short names are taken** (a real app bottleneck: mappings accumulate and
  are never cleaned; each check is a ~1-2s Firestore query, so a fresh device can stall ~2 min).
  Seeding also means the harness never writes new `deviceMapping` docs (no further pollution).
  See `tools/probe-device-mapping.js` to monitor the accumulation in the target project.
- Realtime asserts read `GameLoader.getLocalCache()` / player-card DOM **without reloading** —
  a manual refresh would be a FAIL (per protocol §4).

## Structure

```text
automated-tests/
  playwright.config.js
  helpers/
    env.js        # BASE_URL / project / mode resolution
    firestore.js  # Firestore REST CRUD (value proto conversion)
    game.js       # test-game factory (schema-faithful) + cleanup
    realtime.js   # device contexts (seeded identity), pre-game tee-off, realtime asserts
  specs/
    suite-a-admin.spec.js      # Suite A smoke
    suite-b-realtime.spec.js   # Suite B smoke
  tools/
    check-leftovers.js         # leftover test games in scheduledGames
    probe-device-mapping.js    # DEV-## short-name accumulation monitor
```
