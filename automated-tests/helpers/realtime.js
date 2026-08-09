/**
 * Browser-side helpers for the realtime smoke.
 *
 * Each "device" = its own Playwright context → isolated localStorage → distinct
 * device identity (deviceId, deviceSessions) → true multi-device operation.
 *
 * rAF patch: the app's setup commit uses a double-requestAnimationFrame gate;
 * patched to fire synchronously (verified workaround, 2026-08-07) so the
 * "Updating game..." step never hangs in automated/headless browsers.
 *
 * sessionStorage patch: pre-game.html reads `sessionStorage.currentGameId` to
 * know which game to load, so we set it via addInitScript on every navigation
 * (including the app's ?v= cache-busting redirects).
 */

const { BASE_URL } = require('./env');

const RAF_PATCH =
  "window.requestAnimationFrame = window.requestAnimationFrame || (cb => { cb(performance.now()); return 1; });";

/**
 * Pre-seed the device identity in localStorage so SessionManager.getShortDeviceName()
 * returns the cached value instantly (it would otherwise hit Firestore's deviceMapping
 * allocation loop, which hangs once all DEV-01..99 short names are taken by accumulated
 * mappings — a known app issue surfaced by repeated automated runs). Seeding also means
 * the harness never writes new deviceMapping docs.
 */
function initScriptForGame(gameId, deviceId, shortName) {
  return `
    ${RAF_PATCH}
    try {
      localStorage.setItem('deviceId', '${deviceId}');
      localStorage.setItem('shortDeviceName', '${shortName}');
      sessionStorage.setItem('currentGameId', '${gameId}');
    } catch (e) {}
  `;
}

/** Create an isolated device context pre-wired for a game (deviceIndex 0..3). */
async function newDeviceContext(browser, gameId, deviceIndex) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const deviceId = `dev_autotest_${Date.now()}_${deviceIndex}`;
  const shortName = `DEV-${String(90 + deviceIndex).padStart(2, '0')}`; // DEV-90..93, distinct
  await context.addInitScript(initScriptForGame(gameId, deviceId, shortName));
  return context;
}

/**
 * Open pre-game.html and wait for the role buttons (game loaded).
 * The app occasionally stalls on the initial Firestore load under heavy parallel
 * device startup (4 devices boot at once). Retry by reloading — addInitScript
 * re-injects sessionStorage.currentGameId on every navigation, so a reload is safe.
 */
async function openPreGame(context, { retries = 2, roleButtonsTimeout = 40000 } = {}) {
  const page = await context.newPage();
  for (let attempt = 0; ; attempt++) {
    await page.goto(`${BASE_URL}/pre-game.html`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('.role-btn', { timeout: roleButtonsTimeout });
      return page;
    } catch (e) {
      if (attempt >= retries) {
        throw new Error(`pre-game role buttons did not render after ${retries + 1} attempts`, { cause: e });
      }
      console.warn(`[REALTIME] pre-game load attempt ${attempt + 1} timed out — reloading`);
    }
  }
}

/**
 * Select a role and click TEE OFF, then wait for the target page.
 * roles: 'update1' → real-game.html (Flight 1 scorer), 'update2' → real-game.html
 * (Flight 2 scorer), 'view' → view-game.html (live observer).
 */
async function selectRoleAndTeeOff(page, role, expectedPath) {
  await page.evaluate((r) => {
    if (window.toggleRole) window.toggleRole(r);
  }, role);
  await page.waitForSelector('.btn-teeoff:not([disabled])', { timeout: 20000 });
  await page.click('.btn-teeoff');
  // Cloudflare Pages serves the .html files under clean URLs (/real-game, /view-game)
  await page.waitForURL((url) => url.pathname.replace(/\.html$/, '').includes(expectedPath), { timeout: 40000 });
}

async function openScorer(context, { role, gameId }) {
  const page = await openPreGame(context);
  await selectRoleAndTeeOff(page, role, 'real-game');
  return page;
}

async function openViewer(context, { gameId }) {
  const page = await openPreGame(context);
  await selectRoleAndTeeOff(page, 'view', 'view-game');
  return page;
}

/** Wait until a flight's data string has its hole marked saved (realtime, no reload). */
async function expectFlightDataSaved(page, { flight, charIndex = 0, timeout = 10000 }) {
  await page.waitForFunction(
    ({ flight, charIndex }) => {
      const c = window.GameLoader && window.GameLoader.getLocalCache();
      if (!c) return false;
      const s = flight === 1 ? c.f1DataString : c.f2DataString;
      return typeof s === 'string' && s.charAt(charIndex) === 'T';
    },
    { flight, charIndex },
    { timeout }
  );
}

/** Wait until a player card's score value equals expected (realtime, no reload). */
async function expectPlayerScore(page, { playerName, expected, timeout = 10000 }) {
  await page.waitForFunction(
    ({ playerName, expected }) => {
      const sel = `.player-card[data-player-name="${playerName}"] .score-value`;
      const el = document.querySelector(sel);
      return el && String(el.textContent.trim()) === String(expected);
    },
    { playerName, expected },
    { timeout }
  );
}

/**
 * Read invariants for a computed hole:
 *  - trSum   = teamA[hole-1] + teamB[hole-1]  (expected 19 per hole)
 *  - matches = number of entries in results.matchResults (expected 16)
 */
async function readInvariants(page, { hole }) {
  return page.evaluate((hole) => {
    const c = window.GameLoader && window.GameLoader.getLocalCache();
    if (!c || !c.results) return { trSum: null, matches: null, reason: 'no cache' };
    // matchResults is keyed by hole position; each entry holds 16 cross-match values
    const holeMatches = (c.results.matchResults || {})[hole - 1] || {};
    const matches = Object.keys(holeMatches).length;
    let tA = null;
    let tB = null;
    if (window.GameLoader.getTRForHole) {
      const tr = window.GameLoader.getTRForHole(hole);
      if (typeof tr.teamA === 'number' && !Number.isNaN(tr.teamA)) tA = tr.teamA;
      if (typeof tr.teamB === 'number' && !Number.isNaN(tr.teamB)) tB = tr.teamB;
    }
    return {
      trSum: tA !== null && tB !== null ? tA + tB : null,
      tA,
      tB,
      matches
    };
  }, hole);
}

/** Save the current hole on a scorer page (click SAVE, fallback to direct call). */
async function saveCurrentHole(page, { flight, timeout = 20000 }) {
  const saveBtn = page.locator('#compactSaveBtn, .compact-save-btn').first();
  try {
    await saveBtn.waitFor({ state: 'visible', timeout: 15000 });
    if (await saveBtn.isEnabled().catch(() => true)) {
      await saveBtn.click();
    } else {
      await page.evaluate(() => { if (window._saveHoleCallback) window._saveHoleCallback(); });
    }
  } catch (e) {
    await page.evaluate(() => { if (window._saveHoleCallback) window._saveHoleCallback(); });
  }
  // wait until the hole is persisted locally (cache data string flag → 'T')
  await page.waitForFunction(
    ({ flight, charIndex }) => {
      const c = window.GameLoader && window.GameLoader.getLocalCache();
      if (!c) return false;
      const s = flight === 1 ? c.f1DataString : c.f2DataString;
      return typeof s === 'string' && s.charAt(charIndex) === 'T';
    },
    { flight, charIndex: 0 },
    { timeout }
  );
}

/** Set a player's score on a scorer page by clicking +/- (creates a local change). */
async function setPlayerScoreOnScorer(page, { playerName, delta }) {
  const inc = delta > 0 ? '.inc-btn' : '.dec-btn';
  const card = page.locator(`.player-card[data-player-name="${playerName}"]`).first();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  const times = Math.abs(delta);
  for (let i = 0; i < times; i++) {
    await card.locator(inc).click();
  }
}

module.exports = {
  newDeviceContext,
  openPreGame,
  selectRoleAndTeeOff,
  openScorer,
  openViewer,
  expectFlightDataSaved,
  expectPlayerScore,
  readInvariants,
  saveCurrentHole,
  setPlayerScoreOnScorer
};
