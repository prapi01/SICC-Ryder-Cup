#!/usr/bin/env node
/** Probe: what current hole does a rejoining F1 scorer land on? */
const { chromium } = require('@playwright/test');
const { BASE_URL } = require('../helpers/env');
const { createTestGame, deleteTestGame, fetchGame } = require('../helpers/game');
const { makeDeviceContext, reopenDeviceContext, openScorer, saveCurrentHole, nextHole, getCurrentHole } = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 };

async function main() {
  console.log('PROBE rejoin current hole — base:', BASE_URL);
  const gameId = await createTestGame({ testRunId: 'probe-' + Date.now() });
  const D = { deviceId: 'dev_autotest_probe_f1', shortName: 'DEV-99' };
  const browser = await chromium.launch({ headless: true });
  try {
    const c1 = await makeDeviceContext(browser, gameId, D.deviceId, D.shortName, VIEWPORT);
    const p1 = await openScorer(c1, { role: 'update1', gameId });
    for (let h = 1; h <= 5; h++) {
      await saveCurrentHole(p1, { flight: 1, charIndex: (h - 1) * 9, timeout: 30000 });
      await nextHole(p1);
    }
    console.log('F1 saved H1-5; current hole before close:', await getCurrentHole(p1));
    await p1.close();
    console.log('closed. reopening same deviceId...');
    const c1b = await reopenDeviceContext(browser, gameId, D.deviceId, D.shortName, VIEWPORT);
    const p1b = await openScorer(c1b, { role: 'update1', gameId });
    for (const ms of [100, 1500, 4000]) {
      await new Promise((r) => setTimeout(r, ms));
      console.log('+', ms, 'ms → getCurrentHole =', await getCurrentHole(p1b));
    }
    const doc = await fetchGame(gameId);
    console.log('firestore currentHoleF1:', doc.currentHoleF1, '| savedHoles[1]:', JSON.stringify(doc.savedHoles && doc.savedHoles['1']));
    console.log('page cache savedHoles[1]:', JSON.stringify(await p1b.evaluate(() => {
      const c = window.GameLoader && GameLoader.getLocalCache();
      return c ? c.savedHoles : null;
    })));
    await browser.close();
  } catch (e) { console.error('ERR', e.message); await browser.close().catch(() => {}); }
  await deleteTestGame(gameId);
}
main();
