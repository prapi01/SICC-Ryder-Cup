/**
 * Suite B — Actual Game realtime smoke (Phase 1).
 *
 * Flow:
 *   1. Create a test game (Firestore, same schema as the app).
 *   2. Open 4 isolated device contexts: F1 (Flight 1 scorer), F2 (Flight 2
 *      scorer), V1 + V2 (live observers). Each goes through pre-game.html and
 *      TEE OFFs with its role.
 *   3. F1 edits a score (A1: 4→5) and saves Hole 1.
 *   4. Assert the OTHER 3 devices updated LIVE (no reload):
 *        - F2: its GameLoader cache reflects the saved flight-1 hole
 *        - V1/V2: the A1 player card score shows 5
 *   5. Invariant check: hole-1 TR sums to 19, matchResults has 16 entries.
 *   6. Cleanup: delete the test game.
 *
 * Run: npm run suite:b   (or HEADED=1 npm run suite:b)
 */

const { test, expect, chromium } = require('@playwright/test');
const { createTestGame, deleteTestGame } = require('../helpers/game');
const {
  newDeviceContext,
  openScorer,
  openViewer,
  expectFlightDataSaved,
  expectPlayerScore,
  readInvariants,
  saveCurrentHole,
  setPlayerScoreOnScorer
} = require('../helpers/realtime');

test.describe('Suite B — realtime smoke (F1/F2/V1/V2)', () => {
  const runId = 'suiteB-' + Date.now();
  let gameId;
  let browser;
  let contexts = [];
  let f1, f2, v1, v2;

  test.beforeAll(async () => {
    gameId = await createTestGame({ testRunId: runId });
    console.log(`[SUITE-B] created test game ${gameId}`);

    browser = await chromium.launch();

    const cF1 = await newDeviceContext(browser, gameId, 0);
    const cF2 = await newDeviceContext(browser, gameId, 1);
    const cV1 = await newDeviceContext(browser, gameId, 2);
    const cV2 = await newDeviceContext(browser, gameId, 3);
    contexts = [cF1, cF2, cV1, cV2];

    console.log('[SUITE-B] teeing off 4 devices (F1, F2, V1, V2)...');
    [f1, f2, v1, v2] = await Promise.all([
      openScorer(cF1, { role: 'update1', gameId }),
      openScorer(cF2, { role: 'update2', gameId }),
      openViewer(cV1, { gameId }),
      openViewer(cV2, { gameId })
    ]);
    console.log('[SUITE-B] all 4 devices in-game');
  });

  test('S-smoke: F1 saves H1 → all devices live; F2 saves H1 → all devices live; invariants', async () => {
    // ---------- Direction 1: F1 → F2/V1/V2 ----------
    await f1.waitForSelector('.player-card', { timeout: 30000 });

    // Edit A1 4→5 (proves the score-edit path works)
    await setPlayerScoreOnScorer(f1, { playerName: 'AutoA1', delta: 1 });

    // Save Hole 1 on F1
    await saveCurrentHole(f1, { flight: 1 });
    console.log('[SUITE-B] F1 saved hole 1 (A1=5)');

    // Realtime propagation, NO reload on any page
    await expectFlightDataSaved(f2, { flight: 1, charIndex: 0 });
    console.log('[SUITE-B] F2 cache updated live (flight 1 hole 1)');
    await expectPlayerScore(v1, { playerName: 'AutoA1', expected: 5 });
    console.log('[SUITE-B] V1 rendered A1=5 live');
    await expectPlayerScore(v2, { playerName: 'AutoA1', expected: 5 });
    console.log('[SUITE-B] V2 rendered A1=5 live');

    // ---------- Direction 2: F2 → F1/V1/V2 ----------
    await f2.waitForSelector('.player-card', { timeout: 30000 });

    // Edit D1 4→5 on Flight 2
    await setPlayerScoreOnScorer(f2, { playerName: 'AutoD1', delta: 1 });

    // Save Hole 1 on F2
    await saveCurrentHole(f2, { flight: 2 });
    console.log('[SUITE-B] F2 saved hole 1 (D1=5)');

    // Realtime propagation back to F1 + viewers (cache-level, flight 2)
    await expectFlightDataSaved(f1, { flight: 2, charIndex: 0 });
    console.log('[SUITE-B] F1 cache updated live (flight 2 hole 1)');
    await expectFlightDataSaved(v1, { flight: 2, charIndex: 0 });
    console.log('[SUITE-B] V1 cache updated live (flight 2 hole 1)');
    await expectFlightDataSaved(v2, { flight: 2, charIndex: 0 });
    console.log('[SUITE-B] V2 cache updated live (flight 2 hole 1)');

    // ---------- Invariants (cross-flight data now exists for hole 1) ----------
    // TR totals 19 per hole; matchResults[0] holds all 16 cross-match values for hole 1
    await f1.waitForFunction((hole) => {
      const c = window.GameLoader && window.GameLoader.getLocalCache();
      const holeMatches = c && c.results && c.results.matchResults ? c.results.matchResults[hole - 1] : null;
      return holeMatches && Object.keys(holeMatches).length === 16;
    }, 1, { timeout: 15000 });
    const inv = await readInvariants(f1, { hole: 1 });
    console.log('[SUITE-B] invariants @hole1:', JSON.stringify(inv));
    expect(inv.trSum).toBe(19);
    expect(inv.matches).toBe(16);
  });

  test.afterAll(async () => {
    for (const c of contexts) await c.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (gameId) {
      await deleteTestGame(gameId);
      console.log(`[SUITE-B] deleted test game ${gameId}`);
    }
  });
});
