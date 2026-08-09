#!/usr/bin/env node
/**
 * REJOIN / RECOVERY scenarios (R-series) — headless, on the branch build.
 *
 *   R1 : F1 leaves mid-game (H5), F2 continues (H10), F1 rejoins (same deviceId)
 *        → re-syncs both flights, current hole, lock recovery (R3), can continue
 *   R2 : F1 leaves (H5); F2 completes all 18 + signs; F1 rejoins → fills its
 *        flight, signs → GAME COMPLETED
 *   R5 : multiple leave/rejoin cycles stay stable
 *   R7 : viewer leaves, F1 keeps scoring, viewer rejoins → re-syncs, read-only
 *
 * Requires the branch (R2 needs submitSignature) →
 *   BASE_URL=http://localhost:8000 node tools/rejoin-scenarios.js
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT } = require('../helpers/env');
const { createTestGame, deleteTestGame, fetchGame } = require('../helpers/game');
const {
  makeDeviceContext, reopenDeviceContext, openScorer, openViewer,
  saveCurrentHole, expectFlightDataSaved, getCurrentHole, readInvariants, nextHole
} = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 };

async function fillFlightTo(page, flight, upToHole) {
  for (let h = 1; h <= upToHole; h++) {
    await saveCurrentHole(page, { flight, charIndex: (h - 1) * 9, timeout: 30000 });
    await nextHole(page);
  }
}

// ---------------------------------------------------------------------------
async function scenarioR1(browser, gameId) {
  console.log('\n=== R1: F1 leaves mid-game, F2 continues, F1 rejoins ===');
  const dF1 = { deviceId: 'dev_autotest_r1_f1', shortName: 'DEV-90' };
  const dF2 = { deviceId: 'dev_autotest_r1_f2', shortName: 'DEV-91' };
  const cF1 = await makeDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const cF2 = await makeDeviceContext(browser, gameId, dF2.deviceId, dF2.shortName, VIEWPORT);
  const pF1 = await openScorer(cF1, { role: 'update1', gameId });
  const pF2 = await openScorer(cF2, { role: 'update2', gameId });

  await fillFlightTo(pF1, 1, 5);
  console.log('F1 saved H1-5.');
  await pF1.close();
  console.log('F1 page closed (device left).');

  await fillFlightTo(pF2, 2, 10);
  console.log('F2 saved H1-10 while F1 away.');

  // F1 rejoins with the SAME deviceId
  const cF1b = await reopenDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const pF1b = await openScorer(cF1b, { role: 'update1', gameId });
  console.log('F1 reopened (same deviceId).');
  // Let the realtime re-sync settle (probe: current hole 1 → 6 within ~1.5s)
  await new Promise((r) => setTimeout(r, 2500));

  let pass = true;
  // Own flight data H1-5 preserved
  for (const ci of [0, 9, 18, 27, 36]) {
    const ok = await expectFlightDataSaved(pF1b, { flight: 1, charIndex: ci, timeout: 15000 }).then(() => true).catch(() => false);
    if (!ok) { console.log('❌ F1 lost its own H' + (ci / 9 + 1)); pass = false; }
  }
  // F2's flight data H1-10 synced across
  for (const ci of [0, 9, 18, 27, 36, 45, 54, 63, 72, 81]) {
    const ok = await expectFlightDataSaved(pF1b, { flight: 2, charIndex: ci, timeout: 15000 }).then(() => true).catch(() => false);
    if (!ok) { console.log('❌ F1 missing F2 H' + (ci / 9 + 1)); pass = false; }
  }
  console.log('F1 re-sync own H1-5 + F2 H1-10:', pass ? '✅' : '❌');

  const hole = await getCurrentHole(pF1b);
  console.log('F1 current hole after rejoin:', hole, '(expected 6)');
  if (hole !== 6) pass = false;

  // R3: lock recovery — F1 still owns its flight lock (keyed by short device name)
  const doc = await fetchGame(gameId);
  const lock = doc.locks && doc.locks.f1;
  const owned = !!(lock && typeof lock === 'object' && lock.did && lock.did.includes(dF1.shortName));
  console.log('R3 locks.f1.did:', lock && lock.did, '| F1 shortName:', dF1.shortName, owned ? '✅' : '❌');
  if (!owned) pass = false;

  // Can continue — save H6 and confirm it persists
  await saveCurrentHole(pF1b, { flight: 1, charIndex: 45, timeout: 30000 });
  await nextHole(pF1b);
  const d2 = await fetchGame(gameId);
  const h6 = (d2.savedHoles && d2.savedHoles['1'] || []).includes(6);
  console.log('F1 continued: H6 saved after rejoin:', h6 ? '✅' : '❌');
  if (!h6) pass = false;

  await pF2.close();
  await pF1b.close();
  console.log('R1:', pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ---------------------------------------------------------------------------
async function scenarioR2(browser, gameId) {
  console.log('\n=== R2: F1 leaves; F2 completes + signs; F1 rejoins, signs → completion ===');
  const dF1 = { deviceId: 'dev_autotest_r2_f1', shortName: 'DEV-92' };
  const dF2 = { deviceId: 'dev_autotest_r2_f2', shortName: 'DEV-93' };
  const cF1 = await makeDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const cF2 = await makeDeviceContext(browser, gameId, dF2.deviceId, dF2.shortName, VIEWPORT);
  const pF1 = await openScorer(cF1, { role: 'update1', gameId });
  const pF2 = await openScorer(cF2, { role: 'update2', gameId });

  await fillFlightTo(pF1, 1, 5);
  await pF1.close();
  console.log('F1 closed after H5.');

  await fillFlightTo(pF2, 2, 18);
  console.log('F2 completed H1-18.');
  await pF2.waitForSelector('#signConfirmBtnNew', { timeout: 15000 });
  await pF2.click('#signConfirmBtnNew');
  console.log('F2 signed → waiting for F1.');

  // F1 rejoins (same deviceId)
  const cF1b = await reopenDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const pF1b = await openScorer(cF1b, { role: 'update1', gameId });
  const okOwn = await expectFlightDataSaved(pF1b, { flight: 1, charIndex: 36, timeout: 15000 }).then(() => true).catch(() => false);
  const okF2 = await expectFlightDataSaved(pF1b, { flight: 2, charIndex: 153, timeout: 15000 }).then(() => true).catch(() => false);
  console.log('F1 re-sync own H5:', okOwn ? '✅' : '❌', '| F2 H18:', okF2 ? '✅' : '❌');

  // F1 fills remaining H6-18 then signs → both signed → completion
  await fillFlightTo(pF1b, 1, 18);
  await pF1b.waitForSelector('#signConfirmBtnNew', { timeout: 15000 });
  await pF1b.click('#signConfirmBtnNew');
  console.log('F1 signed (after rejoin).');
  const completed = await pF1b.waitForSelector('#gameCompleteModal', { timeout: 30000 }).then(() => true).catch(() => false);
  console.log('GAME COMPLETED modal:', completed ? '✅' : '❌');

  await pF2.close();
  await pF1b.close();
  const pass = okOwn && okF2 && completed;
  console.log('R2:', pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ---------------------------------------------------------------------------
async function scenarioR5(browser, gameId) {
  console.log('\n=== R5: multiple leave/rejoin cycles ===');
  const dF1 = { deviceId: 'dev_autotest_r5_f1', shortName: 'DEV-94' };
  let pass = true;
  let cF = await makeDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  let pF = await openScorer(cF, { role: 'update1', gameId });
  for (let cycle = 1; cycle <= 2; cycle++) {
    await fillFlightTo(pF, 1, cycle); // save H{cycle}
    await pF.close();
    cF = await reopenDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
    pF = await openScorer(cF, { role: 'update1', gameId });
    const ok = await expectFlightDataSaved(pF, { flight: 1, charIndex: (cycle - 1) * 9, timeout: 15000 }).then(() => true).catch(() => false);
    console.log('cycle', cycle, ': reopened, H' + cycle + ' intact:', ok ? '✅' : '❌');
    if (!ok) pass = false;
  }
  const inv = await (async () => {
    // Both flights need data for a valid invariants check — have F2 save H1-2 too
    const dF2 = { deviceId: 'dev_autotest_r5_f2', shortName: 'DEV-97' };
    const cF2 = await makeDeviceContext(browser, gameId, dF2.deviceId, dF2.shortName, VIEWPORT);
    const pF2 = await openScorer(cF2, { role: 'update2', gameId });
    await fillFlightTo(pF2, 2, 2);
    await expectFlightDataSaved(pF, { flight: 2, charIndex: 9, timeout: 15000 });
    const r = await readInvariants(pF, { hole: 2 });
    await pF2.close();
    return r;
  })();
  console.log('invariants at H2 (after 2 leave/rejoin cycles + F2 fills):', JSON.stringify(inv));
  if (inv.trSum !== 19 || inv.matches !== 16) pass = false;
  await pF.close();
  console.log('R5:', pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ---------------------------------------------------------------------------
async function scenarioR7(browser, gameId) {
  console.log('\n=== R7: viewer leaves, rejoins, stays read-only ===');
  const dF1 = { deviceId: 'dev_autotest_r7_f1', shortName: 'DEV-95' };
  const dV1 = { deviceId: 'dev_autotest_r7_v1', shortName: 'DEV-96' };
  const cF1 = await makeDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const cV1 = await makeDeviceContext(browser, gameId, dV1.deviceId, dV1.shortName, VIEWPORT);
  const pF1 = await openScorer(cF1, { role: 'update1', gameId });
  const pV1 = await openViewer(cV1, { gameId });

  await fillFlightTo(pF1, 1, 1);
  const v1ok = await expectFlightDataSaved(pV1, { flight: 1, charIndex: 0, timeout: 15000 }).then(() => true).catch(() => false);
  console.log('V1 saw F1 H1 live:', v1ok ? '✅' : '❌');
  await pV1.close();
  console.log('V1 closed.');

  await fillFlightTo(pF1, 1, 3);
  const cV1b = await reopenDeviceContext(browser, gameId, dV1.deviceId, dV1.shortName, VIEWPORT);
  const pV1b = await openViewer(cV1b, { gameId });
  const v2ok = await expectFlightDataSaved(pV1b, { flight: 1, charIndex: 18, timeout: 15000 }).then(() => true).catch(() => false);
  console.log('V1 rejoined, saw F1 H3:', v2ok ? '✅' : '❌');

  const hasSave = await pV1b.evaluate(() => !!document.querySelector('#compactSaveBtn, .compact-save-btn'));
  const incPresent = await pV1b.evaluate(() => !!document.querySelector('.inc-btn, .dec-btn'));
  console.log('V1 read-only: save control present:', hasSave ? '❌' : '✅ (none)', '| inc/dec present (display):', incPresent);

  await pF1.close();
  await pV1b.close();
  const pass = v1ok && v2ok && !hasSave;
  console.log('R7:', pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('REJOIN SCENARIOS — base:', BASE_URL, '| project:', FIREBASE_PROJECT);
  const browser = await chromium.launch({ headless: true });
  const results = {};
  const games = [];
  try {
    for (const [name, fn] of [['R1', scenarioR1], ['R2', scenarioR2], ['R5', scenarioR5], ['R7', scenarioR7]]) {
      const gameId = await createTestGame({ testRunId: 'rejoin-' + name + '-' + Date.now() });
      games.push(gameId);
      try {
        results[name] = await fn(browser, gameId);
      } catch (e) {
        console.log(name + ': ERROR —', e.message);
        results[name] = false;
      }
    }
  } finally {
    await browser.close();
  }
  console.log('\n=== SUMMARY ===');
  for (const k of Object.keys(results)) console.log(k, results[k] ? '✅ PASS' : '❌ FAIL');
  const all = Object.values(results).every(Boolean);
  console.log('OVERALL:', all ? 'PASS' : 'FAIL');
  for (const g of games) await deleteTestGame(g).catch(() => {});
  console.log('cleaned', games.length, 'games');
  process.exit(all ? 0 : 1);
}

main();
