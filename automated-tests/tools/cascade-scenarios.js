#!/usr/bin/env node
/**
 * CASCADE scenarios (C-series) — back-navigation edit & recompute, on the branch.
 *
 *   C1  : F1 fills to H12, back-navs to H7, changes ACH 5→6, re-saves →
 *         recompute H7→H12 (T-1, Strk, cross), T-2 UNCHANGED, H1–H6 frozen
 *   C2a : F2 fills to H12, back-navs to H8, changes KF 6→7, re-saves →
 *         T-1 UNCHANGED, T-2 + Strk recomputed H8→H12 (F2 has both teams)
 *   C5  : invariants TR=19/hole + match=16/hole hold after every cascade
 *   C8  : F2 + viewer see the edited hole live (no refresh)
 *   C10 : after F1 signs, back-nav edit on F1 is BLOCKED (locked)
 *
 * Requires the branch (C10 needs submitSignature) →
 *   BASE_URL=http://localhost:8000 node tools/cascade-scenarios.js
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT } = require('../helpers/env');
const { createRealBukitGame, deleteTestGame, fetchGame, SICC_BUKIT, REAL_BUKIT_PLAYERS } = require('../helpers/game');
const {
  makeDeviceContext, openScorer, openViewer, saveCurrentHole, nextHole,
  setPlayerScoreOnScorer, getCurrentHole, expectFlightDataSaved
} = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 };

// Real gross scores (natural hole 1..18) — same source as shotgun-bukit
const SCORES = {
  ACH:  [7, 4, 6, 5, 4, 6, 5, 3, 4, 4, 5, 4, 5, 4, 6, 6, 4, 5],
  CK:   [6, 3, 6, 7, 4, 5, 5, 4, 7, 5, 4, 3, 7, 6, 6, 4, 3, 6],
  OCB:  [7, 4, 5, 6, 3, 7, 5, 5, 7, 5, 5, 4, 5, 4, 6, 5, 3, 5],
  JO:   [6, 5, 4, 7, 5, 8, 6, 6, 4, 6, 8, 3, 7, 3, 8, 5, 3, 7],
  KF:   [5, 5, 5, 7, 2, 4, 6, 5, 5, 5, 6, 5, 5, 6, 7, 4, 3, 6],
  YHM:  [5, 4, 4, 5, 4, 6, 6, 4, 7, 5, 8, 5, 6, 4, 6, 10, 3, 8],
  Piti: [5, 3, 5, 6, 3, 6, 5, 5, 7, 7, 5, 3, 7, 4, 7, 5, 4, 6],
  JG:   [3, 5, 5, 6, 4, 9, 6, 5, 6, 4, 4, 4, 5, 4, 6, 5, 4, 5]
};

function flightOrder(flight) {
  const teamA = REAL_BUKIT_PLAYERS.filter((p) => p.flight === flight && p.team === 'A');
  const teamB = REAL_BUKIT_PLAYERS.filter((p) => p.flight === flight && p.team === 'B').sort((a, b) => a.handicap - b.handicap);
  return [...teamA, ...teamB];
}
function posInFlight(flight, name) {
  return flightOrder(flight).findIndex((p) => p.name === name);
}

async function setScoreToTarget(page, playerName, hole) {
  const target = SCORES[playerName][hole - 1];
  const par = SICC_BUKIT.par[hole - 1];
  const delta = target - par;
  if (delta !== 0) await setPlayerScoreOnScorer(page, { playerName, delta });
}

async function fillCurrentHoleScores(page, flight, hole) {
  for (const p of REAL_BUKIT_PLAYERS.filter((x) => x.flight === flight)) {
    await setScoreToTarget(page, p.name, hole);
  }
}

async function fillTo(p1, p2, upToHole) {
  for (let h = 1; h <= upToHole; h++) {
    const ci = (h - 1) * 9;
    await fillCurrentHoleScores(p1, 1, h);
    await saveCurrentHole(p1, { flight: 1, charIndex: ci, timeout: 30000 });
    await expectFlightDataSaved(p2, { flight: 1, charIndex: ci, timeout: 20000 });
    await fillCurrentHoleScores(p2, 2, h);
    await saveCurrentHole(p2, { flight: 2, charIndex: ci, timeout: 30000 });
    await expectFlightDataSaved(p1, { flight: 2, charIndex: ci, timeout: 20000 });
    await nextHole(p1);
    await nextHole(p2);
    process.stdout.write('H' + h + (h % 6 === 0 ? '\n' : ' '));
  }
  console.log('filled both flights to H' + upToHole);
}

async function navigateToHole(page, target) {
  let cur = await getCurrentHole(page);
  let guard = 0;
  while (cur !== target && guard < 30) {
    await page.evaluate(() => window.prevHole());
    await new Promise((r) => setTimeout(r, 150));
    cur = await getCurrentHole(page);
    guard++;
  }
  return cur;
}

/** Wait until a specific 2-digit player score in a flight's data string matches. */
async function expectFlightScore(page, flight, charIndex, playerPos, value, timeout = 20000) {
  return page.waitForFunction(
    ({ flight, charIndex, playerPos, value }) => {
      const c = window.GameLoader && window.GameLoader.getLocalCache();
      if (!c) return false;
      const s = flight === 1 ? c.f1DataString : c.f2DataString;
      const off = charIndex + 1 + playerPos * 2;
      return typeof s === 'string' && s.slice(off, off + 2) === String(value).padStart(2, '0');
    },
    { flight, charIndex, playerPos, value },
    { timeout }
  ).then(() => true).catch(() => false);
}

async function getGame(gameId) { return fetchGame(gameId); }

/** Ensure the editing page's local cache has BOTH flights' saved holes up to `upToHole`
 *  (so calculateLastSyncedPosition sees the full range for the cascade). */
async function waitBothFlightsInCache(page, upToHole, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate((up) => {
      const c = window.GameLoader && window.GameLoader.getLocalCache();
      const s1 = (c && c.savedHoles && c.savedHoles[1]) || [];
      const s2 = (c && c.savedHoles && c.savedHoles[2]) || [];
      for (let h = 1; h <= up; h++) if (!s1.includes(h) || !s2.includes(h)) return false;
      return true;
    }, upToHole);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---------------------------------------------------------------------------
async function scenarioC1(browser, gameId) {
  console.log('\n=== C1: F1 edits H7 (current H12) → cascade H7→H12, T-2 frozen ===');
  const dF1 = { deviceId: 'dev_autotest_c1_f1', shortName: 'DEV-90' };
  const dF2 = { deviceId: 'dev_autotest_c1_f2', shortName: 'DEV-91' };
  const dV1 = { deviceId: 'dev_autotest_c1_v1', shortName: 'DEV-92' };
  const cF1 = await makeDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const cF2 = await makeDeviceContext(browser, gameId, dF2.deviceId, dF2.shortName, VIEWPORT);
  const cV1 = await makeDeviceContext(browser, gameId, dV1.deviceId, dV1.shortName, VIEWPORT);
  const pF1 = await openScorer(cF1, { role: 'update1', gameId });
  const pF2 = await openScorer(cF2, { role: 'update2', gameId });
  const pV1 = await openViewer(cV1, { gameId });
  const cascadeLogs = [];
  pF1.on('console', (m) => { const t = m.text(); if (/Cascade complete|updateLocalCacheWithResults|Recomputing positions/.test(t)) cascadeLogs.push(t); });

  await fillTo(pF1, pF2, 12);
  const before = await getGame(gameId);
  const bTrA = before.results.tr.teamA.slice(), bTrB = before.results.tr.teamB.slice();
  await waitBothFlightsInCache(pF1, 12);
  console.log('C1 editing-page cache settled (both flights to H12).');

  const landed = await navigateToHole(pF1, 7);
  console.log('F1 back-nav landed on H', landed);
  // ACH H7: 5 → 8 (delta +3 — big enough to force downstream recompute)
  await setPlayerScoreOnScorer(pF1, { playerName: 'ACH', delta: 3 });
  await saveCurrentHole(pF1, { flight: 1, charIndex: 6 * 9, timeout: 30000 });
  console.log('F1 changed ACH H7 5→8 + re-saved.');

  const liveF2 = await expectFlightScore(pF2, 1, 6 * 9, posInFlight(1, 'ACH'), 8);
  const liveV1 = await expectFlightScore(pV1, 1, 6 * 9, posInFlight(1, 'ACH'), 8);
  console.log('C8 F2 sees ACH H7=8 live:', liveF2 ? '✅' : '❌', '| V1 sees:', liveV1 ? '✅' : '❌');

  await new Promise((r) => setTimeout(r, 3000));
  const after = await getGame(gameId);
  const aTrA = after.results.tr.teamA, aTrB = after.results.tr.teamB;

  // Frozen before edited hole (H1-H6)
  let frozen = true;
  for (let i = 0; i < 6; i++) if (aTrA[i] !== bTrA[i] || aTrB[i] !== bTrB[i]) { console.log('❌ H' + (i + 1) + ' changed (should be frozen)'); frozen = false; }
  // Full-range recompute = the app's own cascade logs show all 6 holes (7..12)
  const cc = cascadeLogs.find((l) => l.includes('Cascade complete'));
  const holes = cc && cc.match(/Cascade complete: (\d+) holes/);
  const fullRange = !!holes && parseInt(holes[1], 10) === 6;
  const reached12 = cascadeLogs.some((l) => l.includes('hole=12'));
  console.log('C1 frozen H1-H6:', frozen ? '✅' : '❌', '| cascade range logs:', cc ? cc.trim().slice(0, 60) : '(none)');
  console.log('C1 full-range recompute (6 holes, incl H12):', fullRange && reached12 ? '✅' : '❌');

  // T-1 recomputed (displayT1), T-2 frozen (displayT2) — F1 edit
  const d1b = JSON.stringify(before.results.game2.displayT1), d1a = JSON.stringify(after.results.game2.displayT1);
  const d2b = JSON.stringify(before.results.game2.displayT2), d2a = JSON.stringify(after.results.game2.displayT2);
  const t1changed = d1b !== d1a, t2frozen = d2b === d2a;
  console.log('C1 T-1 (displayT1) recomputed:', t1changed ? '✅' : '❌', '| T-2 (displayT2) frozen:', t2frozen ? '✅' : '❌');

  let inv = true;
  for (let i = 0; i < 12; i++) if (aTrA[i] + aTrB[i] !== 19) inv = false;
  const mr = after.results.matchResults || {};
  const m16 = Object.values(mr).every((v) => Object.keys(v).length === 16);
  console.log('C5 TR=19/hole (1-12):', inv ? '✅' : '❌', '| match=16/hole:', m16 ? '✅' : '❌');

  const pass = liveF2 && liveV1 && frozen && fullRange && reached12 && t1changed && t2frozen && inv && m16;
  await pF1.close(); await pF2.close(); await pV1.close();
  console.log('C1:', pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ---------------------------------------------------------------------------
async function scenarioC2a(browser, gameId) {
  console.log('\n=== C2a: F2 edits H8 (current H12) → T-2+Strk recompute, T-1 frozen ===');
  const dF1 = { deviceId: 'dev_autotest_c2_f1', shortName: 'DEV-93' };
  const dF2 = { deviceId: 'dev_autotest_c2_f2', shortName: 'DEV-94' };
  const cF1 = await makeDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const cF2 = await makeDeviceContext(browser, gameId, dF2.deviceId, dF2.shortName, VIEWPORT);
  const pF1 = await openScorer(cF1, { role: 'update1', gameId });
  const pF2 = await openScorer(cF2, { role: 'update2', gameId });
  const cascadeLogs = [];
  pF2.on('console', (m) => { const t = m.text(); if (/Cascade complete|updateLocalCacheWithResults|Recomputing positions/.test(t)) cascadeLogs.push(t); });
  const f1SyncLogs = [];
  pF1.on('console', (m) => { const t = m.text(); if (/Realtime|refresh|loadGame|WRV|sync/.test(t)) f1SyncLogs.push(t.slice(0, 140)); });

  await fillTo(pF1, pF2, 12);
  const before = await getGame(gameId);
  await waitBothFlightsInCache(pF2, 12);
  console.log('C2a editing-page cache settled (both flights to H12).');

  const landed = await navigateToHole(pF2, 8);
  console.log('F2 back-nav landed on H', landed);
  // Force a fresh cache load so the editing page KNOWS the other flight's latest
  // saved holes (a well-synced device would) — removes realtime-sync-lag flakiness.
  await pF2.evaluate((gid) => new Promise((res) => window.GameLoader.loadGame(gid, 'scheduledGames', () => res())), gameId);
  await waitBothFlightsInCache(pF2, 12);
  // KF H8: 5 → 8 (delta +3 — force downstream recompute)
  await setPlayerScoreOnScorer(pF2, { playerName: 'KF', delta: 3 });
  await saveCurrentHole(pF2, { flight: 2, charIndex: 7 * 9, timeout: 30000 });
  console.log('F2 changed KF H8 5→8 + re-saved.');

  const liveF1 = await expectFlightScore(pF1, 2, 7 * 9, posInFlight(2, 'KF'), 8);
  console.log('C8 F1 sees KF H8=8 live:', liveF1 ? '✅' : '❌');
  // diagnostics: what does F1's cache actually have for f2DataString H8?
  const f1Diag = await pF1.evaluate(() => {
    const c = window.GameLoader && window.GameLoader.getLocalCache();
    return {
      hasF2: !!(c && c.f2DataString),
      h8: c && c.f2DataString ? c.f2DataString.slice(63, 72) : null,
      keys: c ? Object.keys(c).filter((k) => /f2|DataString/i.test(k)).join(',') : null
    };
  });
  console.log('F1 diag:', JSON.stringify(f1Diag), '| F1 sync logs tail:', f1SyncLogs.slice(-8).join(' ;; ').slice(0, 400));

  await new Promise((r) => setTimeout(r, 3000));
  const after = await getGame(gameId);
  const aTrA = after.results.tr.teamA, aTrB = after.results.tr.teamB;
  const bTrA = before.results.tr.teamA, bTrB = before.results.tr.teamB;

  // T-2 recomputed (displayT2), T-1 frozen (displayT1) — F2 edit
  const d1b = JSON.stringify(before.results.game2.displayT1), d1a = JSON.stringify(after.results.game2.displayT1);
  const d2b = JSON.stringify(before.results.game2.displayT2), d2a = JSON.stringify(after.results.game2.displayT2);
  const t1frozen = d1b === d1a, t2changed = d2b !== d2a;
  console.log('C2a T-1 (displayT1) frozen:', t1frozen ? '✅' : '❌', '| T-2 (displayT2) recomputed:', t2changed ? '✅' : '❌');

  // Strk (game3) recomputed, and F2's edit touched BOTH teams' nett
  const b3 = before.results.game3, a3 = after.results.game3;
  const g3changed = JSON.stringify(b3) !== JSON.stringify(a3);
  const nettAC = JSON.stringify(b3.nettA) !== JSON.stringify(a3.nettA);
  const nettBC = JSON.stringify(b3.nettB) !== JSON.stringify(a3.nettB);
  console.log('C2a Strk recomputed:', g3changed ? '✅' : '❌', '| nettA changed:', nettAC ? '✅' : '❌', '| nettB changed:', nettBC ? '✅' : '❌');

  // frozen before H8 (H1-H7), and full range via app cascade logs (H8..H12 = 5 holes)
  let frozen = true;
  for (let i = 0; i < 7; i++) if (aTrA[i] !== bTrA[i] || aTrB[i] !== bTrB[i]) { console.log('❌ H' + (i + 1) + ' changed (should be frozen)'); frozen = false; }
  const cc = cascadeLogs.find((l) => l.includes('Cascade complete'));
  const holes = cc && cc.match(/Cascade complete: (\d+) holes/);
  const fullRange = !!holes && parseInt(holes[1], 10) === 5;
  const reached12 = cascadeLogs.some((l) => l.includes('hole=12'));
  console.log('C2a frozen H1-H7:', frozen ? '✅' : '❌', '| cascade range logs:', cc ? cc.trim().slice(0, 60) : '(none)');
  console.log('C2a full-range recompute (5 holes, incl H12):', fullRange && reached12 ? '✅' : '❌');

  let inv = true;
  for (let i = 0; i < 12; i++) if (aTrA[i] + aTrB[i] !== 19) inv = false;
  console.log('C5 TR=19/hole (1-12):', inv ? '✅' : '❌');

  const pass = liveF1 && t1frozen && t2changed && g3changed && frozen && fullRange && reached12 && inv;
  await pF1.close(); await pF2.close();
  console.log('C2a:', pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ---------------------------------------------------------------------------
async function scenarioC10(browser, gameId) {
  console.log('\n=== C10: signed flight is locked — back-nav edit blocked ===');
  const dF1 = { deviceId: 'dev_autotest_c10_f1', shortName: 'DEV-95' };
  const dF2 = { deviceId: 'dev_autotest_c10_f2', shortName: 'DEV-96' };
  const cF1 = await makeDeviceContext(browser, gameId, dF1.deviceId, dF1.shortName, VIEWPORT);
  const cF2 = await makeDeviceContext(browser, gameId, dF2.deviceId, dF2.shortName, VIEWPORT);
  const pF1 = await openScorer(cF1, { role: 'update1', gameId });
  const pF2 = await openScorer(cF2, { role: 'update2', gameId });

  await fillTo(pF1, pF2, 18);
  await pF1.waitForSelector('#signConfirmBtnNew', { timeout: 15000 });
  await pF1.click('#signConfirmBtnNew');
  console.log('F1 signed.');

  const f1Before = (await getGame(gameId)).f1.d;
  const landed = await navigateToHole(pF1, 10).catch(() => null);
  console.log('F1 after sign — back-nav landed on H', landed);
  // attempt to edit a signed hole
  await setPlayerScoreOnScorer(pF1, { playerName: 'ACH', delta: 1 }).catch(() => {});
  await saveCurrentHole(pF1, { flight: 1, charIndex: 9 * 9, timeout: 5000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  const f1After = (await getGame(gameId)).f1.d;

  const blocked = f1After === f1Before;
  console.log('C10 signed-flight edit blocked (f1.d unchanged):', blocked ? '✅' : '❌');
  await pF1.close(); await pF2.close();
  console.log('C10:', blocked ? '✅ PASS' : '❌ FAIL');
  return blocked;
}

// ---------------------------------------------------------------------------
async function main() {
  const ONLY = (process.env.ONLY || '').toUpperCase();
  console.log('CASCADE SCENARIOS — base:', BASE_URL, '| project:', FIREBASE_PROJECT, ONLY ? '| ONLY ' + ONLY : '');
  const browser = await chromium.launch({ headless: true });
  const results = {};
  const games = [];
  try {
    for (const [name, fn] of [['C1', scenarioC1], ['C2a', scenarioC2a], ['C10', scenarioC10]]) {
      if (ONLY && name !== ONLY) continue;
      const gameId = await createRealBukitGame({ testRunId: 'cascade-' + name + '-' + Date.now() });
      games.push(gameId);
      try { results[name] = await fn(browser, gameId); }
      catch (e) { console.log(name + ': ERROR —', e.message); results[name] = false; }
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
