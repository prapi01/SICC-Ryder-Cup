#!/usr/bin/env node
/** Probe: exact cascade recompute scope after an F1 edit at H7 (filled to H12). */
const { chromium } = require('@playwright/test');
const { createRealBukitGame, deleteTestGame, fetchGame, SICC_BUKIT, REAL_BUKIT_PLAYERS } = require('../helpers/game');
const { makeDeviceContext, openScorer, saveCurrentHole, nextHole, setPlayerScoreOnScorer, getCurrentHole, expectFlightDataSaved } = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 };
const SCORES = {
  ACH: [7,4,6,5,4,6,5,3,4,4,5,4,5,4,6,6,4,5], CK: [6,3,6,7,4,5,5,4,7,5,4,3,7,6,6,4,3,6],
  OCB: [7,4,5,6,3,7,5,5,7,5,5,4,5,4,6,5,3,5], JO: [6,5,4,7,5,8,6,6,4,6,8,3,7,3,8,5,3,7],
  KF: [5,5,5,7,2,4,6,5,5,5,6,5,5,6,7,4,3,6], YHM: [5,4,4,5,4,6,6,4,7,5,8,5,6,4,6,10,3,8],
  Piti: [5,3,5,6,3,6,5,5,7,7,5,3,7,4,7,5,4,6], JG: [3,5,5,6,4,9,6,5,6,4,4,4,5,4,6,5,4,5]
};
async function setScore(page, name, hole) {
  const t = SCORES[name][hole-1], par = SICC_BUKIT.par[hole-1], d = t - par;
  if (d !== 0) await setPlayerScoreOnScorer(page, { playerName: name, delta: d });
}
async function fill(p1, p2, up) {
  for (let h = 1; h <= up; h++) {
    const ci = (h-1)*9;
    for (const p of REAL_BUKIT_PLAYERS.filter(x => x.flight === 1)) await setScore(p1, p.name, h);
    await saveCurrentHole(p1, { flight: 1, charIndex: ci, timeout: 30000 });
    await expectFlightDataSaved(p2, { flight: 1, charIndex: ci, timeout: 20000 });
    for (const p of REAL_BUKIT_PLAYERS.filter(x => x.flight === 2)) await setScore(p2, p.name, h);
    await saveCurrentHole(p2, { flight: 2, charIndex: ci, timeout: 30000 });
    await expectFlightDataSaved(p1, { flight: 2, charIndex: ci, timeout: 20000 });
    await nextHole(p1); await nextHole(p2);
  }
}
async function waitStable(gameId, key, expectChanged, timeoutMs = 15000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const doc = await fetchGame(gameId);
    const a = doc.results.tr.teamA[6];
    if (expectChanged && last !== null && a !== last) return { doc, stable: true };
    if (!expectChanged && a !== undefined && a !== null && a !== last && last !== null) return { doc, stable: true };
    last = a;
    await new Promise(r => setTimeout(r, 500));
  }
  return { doc: await fetchGame(gameId), stable: false };
}

async function main() {
  const gameId = await createRealBukitGame({ testRunId: 'probeC-' + Date.now() });
  const browser = await chromium.launch({ headless: true });
  try {
    const c1 = await makeDeviceContext(browser, gameId, 'dev_autotest_pc_f1', 'DEV-90', VIEWPORT);
    const c2 = await makeDeviceContext(browser, gameId, 'dev_autotest_pc_f2', 'DEV-91', VIEWPORT);
    const p1 = await openScorer(c1, { role: 'update1', gameId });
    const p2 = await openScorer(c2, { role: 'update2', gameId });
    const isCascade = (t) => /CASCADE|SAVE|DEBUG-CACHE|cascade|lastSyncedPos|Recomputing/i.test(t);
    p1.on('console', (m) => { const t = m.text(); if (isCascade(t)) console.log('[F1]', t.slice(0, 200)); });
    p2.on('console', (m) => { const t = m.text(); if (isCascade(t)) console.log('[F2]', t.slice(0, 200)); });
    await fill(p1, p2, 12);
    console.log('filled to H12. waiting for results to stabilize...');
    await new Promise(r => setTimeout(r, 4000));
    const before = await fetchGame(gameId);
    console.log('BEFORE tr.teamA[6..11]:', JSON.stringify(before.results.tr.teamA.slice(6, 12)));
    console.log('BEFORE tr.teamB[6..11]:', JSON.stringify(before.results.tr.teamB.slice(6, 12)));
    console.log('BEFORE computedUpToHole:', before.results.computedUpToHole);
    console.log('BEFORE f1.d H7:', before.f1.d.slice(54, 63));

    // edit H7
    await p1.evaluate(() => { for (let i = 0; i < 6; i++) window.prevHole(); });
    await new Promise(r => setTimeout(r, 300));
    console.log('current hole:', await getCurrentHole(p1));
    await setPlayerScoreOnScorer(p1, { playerName: 'ACH', delta: 1 });
    await saveCurrentHole(p1, { flight: 1, charIndex: 54, timeout: 30000 });
    console.log('re-saved H7 (ACH 5→6). current hole now:', await getCurrentHole(p1));

    // navigate F1 forward back to H12 (original position) — does the cascade complete?
    for (let i = 0; i < 6; i++) {
      await p1.evaluate(() => window.nextHole());
      await new Promise((r) => setTimeout(r, 600));
      if ((await getCurrentHole(p1)) === 12) break;
    }
    console.log('after navigating forward, current hole:', await getCurrentHole(p1));

    // poll for change at H12
    const { doc: after, stable } = await waitStable(gameId, null, true, 15000);
    console.log('AFTER  tr.teamA[6..11]:', JSON.stringify(after.results.tr.teamA.slice(6, 12)));
    console.log('AFTER  tr.teamB[6..11]:', JSON.stringify(after.results.tr.teamB.slice(6, 12)));
    console.log('AFTER  computedUpToHole:', after.results.computedUpToHole);
    console.log('AFTER  f1.d H7:', after.f1.d.slice(54, 63));
    console.log('H7 tr changed (stable):', stable ? 'yes' : 'NO — timed out waiting');
    for (let i = 6; i < 12; i++) {
      const dA = after.results.tr.teamA[i] !== before.results.tr.teamA[i];
      const dB = after.results.tr.teamB[i] !== before.results.tr.teamB[i];
      console.log('H' + (i+1), dA || dB ? 'CHANGED' : 'same');
    }
    // Local caches vs Firestore
    const dump = (label, page) => page.evaluate(() => {
      const c = window.GameLoader && GameLoader.getLocalCache();
      return c && c.results && c.results.tr ? { A: c.results.tr.teamA.slice(6, 12), B: c.results.tr.teamB.slice(6, 12) } : null;
    }).then((v) => console.log(label, 'LOCAL tr[6..11] A:', v && JSON.stringify(v.A), 'B:', v && JSON.stringify(v.B)));
    await dump('[F1]', p1);
    await dump('[F2]', p2);
    console.log('FIREBASE   tr[6..11] A:', JSON.stringify(after.results.tr.teamA.slice(6, 12)), 'B:', JSON.stringify(after.results.tr.teamB.slice(6, 12)));
    await browser.close();
  } catch (e) { console.error('ERR', e.message); await browser.close().catch(() => {}); }
  await deleteTestGame(gameId);
}
main();
