/**
 * End-to-end verification of the deployed session.js v1.02 fix:
 * a BRAND-NEW device (no localStorage seed, no deviceMapping entry) must get a
 * DEV-## short name and render pre-game role buttons quickly — no ~2 min hang.
 * Creates a test game, opens one unseeded context, asserts, cleans up.
 */
const { chromium } = require('@playwright/test');
const { BASE_URL } = require('../helpers/env');
const { createTestGame, deleteTestGame } = require('../helpers/game');

(async () => {
  const runId = 'verify-' + Date.now();
  const gameId = await createTestGame({ testRunId: runId });
  console.log('created test game', gameId);
  let ok = false;
  try {
    const browser = await chromium.launch();
    // NOTE: NO addInitScript seed — this context is a fresh device.
    const context = await browser.newContext();
    await context.addInitScript((gid) => {
      window.requestAnimationFrame = window.requestAnimationFrame || (cb => { cb(performance.now()); return 1; });
      try { sessionStorage.setItem('currentGameId', gid); } catch (e) {}
    }, gameId);

    const page = await context.newPage();
    const t0 = Date.now();
    await page.goto(`${BASE_URL}/pre-game.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.role-btn', { timeout: 60000 });
    const elapsed = Date.now() - t0;

    const state = await page.evaluate(() => ({
      shortDeviceName: localStorage.getItem('shortDeviceName'),
      deviceTag: document.getElementById('deviceTag')?.textContent,
      roleButtons: document.querySelectorAll('.role-btn').length,
      teeOffDisabled: document.querySelector('.btn-teeoff')?.disabled
    }));

    console.log('=== FRESH DEVICE (unseeded) ===');
    console.log('role buttons rendered in:', elapsed + 'ms');
    console.log(JSON.stringify(state, null, 2));
    ok = state.roleButtons >= 2 && /^DEV-\d\d$/.test(state.shortDeviceName || '');
    console.log(ok ? 'PASS — fresh device allocated a name + rendered pre-game' : 'FAIL');
    console.log(state.shortDeviceName ? 'allocated short name: ' + state.shortDeviceName : 'no short name cached');

    await context.close();
    await browser.close();
  } catch (e) {
    console.error('VERIFY FAILED:', e.message);
  } finally {
    // Always clean up the test game, even on failure
    try { await deleteTestGame(gameId); console.log('deleted test game', gameId); } catch (e) { console.error('cleanup failed:', e.message); }
    process.exit(ok ? 0 : 1);
  }
})();
