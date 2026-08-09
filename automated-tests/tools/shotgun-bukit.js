#!/usr/bin/env node
/**
 * SHOTGUN SICC BUKIT scenario — full game starting at Hole 10, real scores,
 * full flow → completion → history record integrity check.
 *
 *   game : SICC Bukit Course + 8 real players, startingHole = 10 (shotgun)
 *   flow : pre-game → TEE OFF → score all 18 in PLAY ORDER (10→18,1→9) →
 *          sign both → GAME COMPLETED → saveGameToHistory() → historyGames/_H
 *   check: A-series history-record integrity (fields, invariants, data fidelity)
 *
 * Requires the branch build (sign needs submitSignature) → run with
 *   BASE_URL=http://localhost:8000 node tools/shotgun-bukit.js
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT } = require('../helpers/env');
const {
  createRealBukitGame, fetchGame, SICC_BUKIT, REAL_BUKIT_PLAYERS
} = require('../helpers/game');
const { getDocument } = require('../helpers/firestore');
const {
  newDeviceContext, openScorer, saveCurrentHole, expectFlightDataSaved,
  nextHole, setPlayerScoreOnScorer
} = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 };
const START = 10;

// Real gross scores from the SICC Bukit game (name → natural-hole-1..18 scores)
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

// Player order within a flight's data string: Team A (as listed), then Team B
// sorted by handicap ascending (verified against the real record GM_260606_1010_13_H).
function flightOrder(flight) {
  const teamA = REAL_BUKIT_PLAYERS.filter((p) => p.flight === flight && p.team === 'A');
  const teamB = REAL_BUKIT_PLAYERS.filter((p) => p.flight === flight && p.team === 'B')
    .sort((a, b) => a.handicap - b.handicap);
  return [...teamA, ...teamB];
}

// Expected 9-char block for a play position (T + 4×2-digit scores in flight order)
function expectedBlock(flight, naturalHole) {
  const s = (n) => String(n).padStart(2, '0');
  return 'T' + flightOrder(flight).map((p) => s(SCORES[p.name][naturalHole - 1])).join('');
}

function playOrder(startingHole) {
  const o = [];
  for (let i = startingHole; i <= 18; i++) o.push(i);
  for (let i = 1; i < startingHole; i++) o.push(i);
  return o;
}

async function setScoreToTarget(page, playerName, naturalHole) {
  const target = SCORES[playerName][naturalHole - 1];
  const par = SICC_BUKIT.par[naturalHole - 1];
  const delta = target - par;
  if (delta !== 0) await setPlayerScoreOnScorer(page, { playerName, delta });
}

async function fillFlight(page, flight, naturalHole) {
  for (const p of REAL_BUKIT_PLAYERS.filter((x) => x.flight === flight)) {
    await setScoreToTarget(page, p.name, naturalHole);
  }
}

let kept = [];

async function main() {
  console.log('SHOTGUN SICC BUKIT — base:', BASE_URL, '| project:', FIREBASE_PROJECT, '| start hole:', START);
  const order = playOrder(START);
  console.log('play order:', order.join(','));

  const gameId = await createRealBukitGame({ testRunId: 'shotgun-' + Date.now(), startingHole: START });
  const historyId = gameId + '_H';
  kept = [gameId, historyId];
  console.log('game:', gameId);

  const browser = await chromium.launch({ headless: true });
  try {
    const c1 = await newDeviceContext(browser, gameId, 0, VIEWPORT);
    const c2 = await newDeviceContext(browser, gameId, 1, VIEWPORT);
    const p1 = await openScorer(c1, { role: 'update1', gameId });
    const p2 = await openScorer(c2, { role: 'update2', gameId });
    console.log('scorers open. Filling real scores in play order...');

    for (let pos = 0; pos < 18; pos++) {
      const naturalHole = order[pos];
      await fillFlight(p1, 1, naturalHole);
      await saveCurrentHole(p1, { flight: 1, charIndex: pos * 9, timeout: 30000 });
      await expectFlightDataSaved(p2, { flight: 1, charIndex: pos * 9, timeout: 20000 });
      await fillFlight(p2, 2, naturalHole);
      await saveCurrentHole(p2, { flight: 2, charIndex: pos * 9, timeout: 30000 });
      await expectFlightDataSaved(p1, { flight: 2, charIndex: pos * 9, timeout: 20000 });
      await nextHole(p1);
      await nextHole(p2);
      process.stdout.write('H' + naturalHole + (pos % 6 === 5 ? '\n' : ' '));
    }
    console.log('\nAll 18 play positions filled.');

    // Verify data strings match expected real scores BEFORE signing
    const live = await fetchGame(gameId);
    const f1 = live.f1.d, f2 = live.f2.d;
    let ok = true;
    for (let pos = 0; pos < 18; pos++) {
      const nat = order[pos];
      const e1 = expectedBlock(1, nat), e2 = expectedBlock(2, nat);
      if (f1.slice(pos * 9, pos * 9 + 9) !== e1) { console.log('❌ f1 pos', pos, 'hole', nat, 'got', f1.slice(pos * 9, pos * 9 + 9), 'want', e1); ok = false; }
      if (f2.slice(pos * 9, pos * 9 + 9) !== e2) { console.log('❌ f2 pos', pos, 'hole', nat, 'got', f2.slice(pos * 9, pos * 9 + 9), 'want', e2); ok = false; }
    }
    console.log('data-string fidelity:', ok ? '✅ ALL 18 positions match real scores' : '❌ MISMATCH');
    if (!ok) throw new Error('score entry mismatch');

    // Sign both flights (real UI) — branch submitSignature writes signatures
    for (const [label, page] of [['F1', p1], ['F2', p2]]) {
      await page.waitForSelector('#signConfirmBtnNew', { timeout: 15000 });
      await page.click('#signConfirmBtnNew');
      console.log(label + ': SIGN CARD clicked → waiting screen');
    }
    const completed = await p1.waitForSelector('#gameCompleteModal', { timeout: 30000 })
      .then(() => true).catch(() => false);
    console.log('GAME COMPLETED modal on F1:', completed ? '✅' : '❌');

    // FIX-TEST: the restored submitSignature auto-creates the history record on F2
    // when BOTH flights are signed — no manual saveGameToHistory call needed.
    console.log('waiting for AUTO-created history record', historyId, '...');
    let hist = null;
    for (let i = 0; i < 45; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      hist = await getDocument('historyGames', historyId).catch(() => null);
      if (hist) break;
    }
    if (!hist) {
      console.log('❌ history record NOT created automatically');
      await browser.close();
      process.exit(4);
    }

    // ---- A-series integrity report ----
    console.log('\n=== HISTORY RECORD INTEGRITY ===', historyId);
    console.log('A1 exists+completed:', hist.status === 'completed' ? '✅' : '❌ ' + hist.status);
    const gi = hist.gameInfo || {};
    console.log('A2 course:', gi.course && gi.course.name, '| date:', gi.date, '| startingHole:', gi.startingHole, '| anchor:', gi.anchor);
    console.log('   startingHole==10:', gi.startingHole === 10 ? '✅' : '❌');
    console.log('A3 players:', (hist.players || []).length, (hist.players || []).length === 8 ? '✅' : '❌');
    const hf1 = hist.f1DataString || '', hf2 = hist.f2DataString || '';
    console.log('A4 f1/f2 strings:', hf1.length, '/', hf2.length, (hf1.length === 162 && hf2.length === 162 ? '✅' : '❌'));
    let fid = true;
    for (let pos = 0; pos < 18; pos++) {
      if (hf1.slice(pos * 9, pos * 9 + 9) !== f1.slice(pos * 9, pos * 9 + 9)) { fid = false; }
      if (hf2.slice(pos * 9, pos * 9 + 9) !== f2.slice(pos * 9, pos * 9 + 9)) { fid = false; }
    }
    console.log('A11 archive==live strings:', fid ? '✅' : '❌');
    const tr = hist.results && hist.results.tr;
    const mr = hist.results && hist.results.matchResults;
    console.log('A5 results.tr present:', tr ? '✅' : '❌', '| matchResults holes:', mr ? Object.keys(mr).length : 0);
    const a = tr && tr.teamA, b = tr && tr.teamB;
    let inv = true;
    if (tr) for (let i = 0; i < 18; i++) if (a[i] + b[i] !== 19) inv = false;
    console.log('A12 TR=19/hole:', inv ? '✅' : '❌', '| final', a && a[17], ':', b && b[17]);
    console.log('A13 final TR:', a && a[17], 'vs', b && b[17]);
    const fr = hist.finalResults;
    console.log('A6 finalResults:', fr ? JSON.stringify({ teamAScore: fr.teamAScore, teamBScore: fr.teamBScore, winner: fr.winner }) : '❌ absent');
    console.log('A7 signatures:', JSON.stringify(hist.signatures));
    console.log('A8 adjustedHandicaps:', hist.adjustedHandicaps ? JSON.stringify(hist.adjustedHandicaps).slice(0, 200) : '(null — no handicap step run in this flow)');

    await browser.close();
    console.log('\nRecords kept (DEV project) — game:', gameId, '| history:', historyId);
  } catch (e) {
    console.error('ERROR:', e.message);
    await browser.close().catch(() => {});
    process.exit(3);
  }
}

main();
