#!/usr/bin/env node
/**
 * REAL SICC BUKIT scenario — enters a real game's scores (from the screenshot)
 * into the app and reports the app-computed team result, so it can be compared
 * against the known real outcome.
 *
 *   game : SICC Bukit Course (real par/SI) + 8 real players (Anchor B5 dropped)
 *   input: real per-player per-hole gross scores (delta from each hole's par)
 *   out  : app-computed results.tr (final teamA/teamB), matchResults, data strings
 *
 * Usage:  node tools/real-bukit.js          → against PROD (default)
 *         BASE_URL=http://localhost:8000 node tools/real-bukit.js  → branch build
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT } = require('../helpers/env');
const {
  createRealBukitGame, deleteTestGame, fetchGame, SICC_BUKIT, REAL_BUKIT_PLAYERS
} = require('../helpers/game');
const {
  newDeviceContext, openScorer, saveCurrentHole, expectFlightDataSaved,
  nextHole, setPlayerScoreOnScorer
} = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 }; // iPhone 14 Pro

// Real gross scores from the SICC Bukit game (name → 18 hole scores)
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

async function setScoreToTarget(page, playerName, hole, par) {
  const target = SCORES[playerName][hole - 1];
  const delta = target - par;
  if (delta === 0) return;
  await setPlayerScoreOnScorer(page, { playerName, delta });
}

async function fillFlight(page, flight, hole) {
  const par = SICC_BUKIT.par[hole - 1];
  for (const p of REAL_BUKIT_PLAYERS.filter((x) => x.flight === flight)) {
    await setScoreToTarget(page, p.name, hole, par);
  }
}

async function main() {
  console.log('REAL SICC BUKIT scenario — base:', BASE_URL, '| project:', FIREBASE_PROJECT);
  const gameId = await createRealBukitGame({ testRunId: 'bukit-' + Date.now() });
  console.log('game:', gameId, '| course:', SICC_BUKIT.name, '| par:', SICC_BUKIT.par.join(','));
  console.log('players:', REAL_BUKIT_PLAYERS.map((p) => p.label).join(', '));

  const browser = await chromium.launch({ headless: true });
  try {
    const c1 = await newDeviceContext(browser, gameId, 0, VIEWPORT);
    const c2 = await newDeviceContext(browser, gameId, 1, VIEWPORT);
    const p1 = await openScorer(c1, { role: 'update1', gameId });
    const p2 = await openScorer(c2, { role: 'update2', gameId });
    console.log('scorers open. Filling real scores...');
    for (let hole = 1; hole <= 18; hole++) {
      const ci = (hole - 1) * 9;
      await fillFlight(p1, 1, hole);
      await saveCurrentHole(p1, { flight: 1, charIndex: ci, timeout: 30000 });
      await expectFlightDataSaved(p2, { flight: 1, charIndex: ci, timeout: 20000 });
      await fillFlight(p2, 2, hole);
      await saveCurrentHole(p2, { flight: 2, charIndex: ci, timeout: 30000 });
      await expectFlightDataSaved(p1, { flight: 2, charIndex: ci, timeout: 20000 });
      await nextHole(p1);
      await nextHole(p2);
      process.stdout.write('H' + hole + (hole % 6 === 0 ? '\n' : ' '));
    }
    console.log('\nAll 18 holes filled with real scores.');

    const doc = await fetchGame(gameId);
    const tr = doc.results && doc.results.tr;
    const mr = doc.results && doc.results.matchResults;
    const f1d = doc.f1 && doc.f1.d;
    const f2d = doc.f2 && doc.f2.d;

    console.log('\n=== APP-COMPUTED RESULT ===');
    if (tr) {
      console.log('teamA final :', tr.teamA ? tr.teamA[17] : 'n/a');
      console.log('teamB final :', tr.teamB ? tr.teamB[17] : 'n/a');
      console.log('teamA/hole  :', JSON.stringify(tr.teamA));
      console.log('teamB/hole  :', JSON.stringify(tr.teamB));
      const a = tr.teamA && tr.teamA[17], b = tr.teamB && tr.teamB[17];
      console.log('WINNER      :', a > b ? 'Team A' : (b > a ? 'Team B' : 'Tie'), `(${a} : ${b})`);
    }
    if (mr) console.log('matchResults holes computed:', Object.keys(mr).length);
    if (f1d) {
      console.log('\nf1.d (flight 1):', f1d.length, 'chars');
      console.log('  hole1:', f1d.slice(0, 9), '| hole18:', f1d.slice(153, 162));
    }
    if (f2d) {
      console.log('f2.d (flight 2):', f2d.length, 'chars');
      console.log('  hole1:', f2d.slice(0, 9), '| hole18:', f2d.slice(153, 162));
    }

    await browser.close();
    await deleteTestGame(gameId);
    console.log('\n(cleaned up test game', gameId, ')');
  } catch (e) {
    console.error('ERROR:', e.message);
    await browser.close().catch(() => {});
    await deleteTestGame(gameId).catch(() => {});
    process.exit(3);
  }
}

main();
