/** Debug: load pre-game.html on a FRESH (unseeded) device, capture console + state. */
const { chromium } = require('@playwright/test');
const { BASE_URL } = require('../helpers/env');
const { createTestGame, deleteTestGame } = require('../helpers/game');

(async () => {
  const gameId = process.env.GAME_ID || (await createTestGame({ testRunId: 'dbg-' + Date.now() }));
  console.log('using game', gameId);
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    await context.addInitScript((gid) => {
      window.requestAnimationFrame = window.requestAnimationFrame || (cb => { cb(performance.now()); return 1; });
      try { sessionStorage.setItem('currentGameId', gid); } catch (e) {}
    }, gameId);

    const page = await context.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

    await page.goto(`${BASE_URL}/pre-game.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(15000);

    const state = await page.evaluate(() => ({
      url: location.href,
      shortDeviceName: localStorage.getItem('shortDeviceName'),
      deviceId: localStorage.getItem('deviceId'),
      sessionId: localStorage.getItem('sessionId'),
      roleButtons: document.querySelectorAll('.role-btn').length,
      deviceTag: document.getElementById('deviceTag')?.textContent,
      sessionManager: typeof window.SessionManager !== 'undefined' ? Object.keys(window.SessionManager) : 'none'
    }));
    console.log('=== STATE ===');
    console.log(JSON.stringify(state, null, 2));
    console.log('=== CONSOLE (last 35) ===');
    console.log(logs.slice(-35).join('\n'));

    await browser.close();
  } finally {
    if (process.env.GAME_ID === undefined && gameId) await deleteTestGame(gameId);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
