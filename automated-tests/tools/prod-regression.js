#!/usr/bin/env node
/**
 * PRODUCTION FULL REGRESSION — real SICC Bukit game end-to-end on PROD.
 *
 *   flow : create real game (H1) → open F1/F2 scorers + LIVE viewer →
 *          score all 18 holes with real scores → verify fidelity →
 *          sign both → GAME COMPLETED → auto history record (_H) →
 *          viewer celebration shows the PHOTO (restored in v1.41) →
 *          cold viewer (fresh join) also has default photo + back-link.
 *
 *   checks: P-series:
 *     P1 data-string fidelity (all 18 holes, real scores)
 *     P2 GAME COMPLETED on F1/F2
 *     P3 auto history record with finalResults + A-integrity
 *     P4 LIVE viewer: sessionStorage celebrationPhoto populated
 *     P5 LIVE viewer: celebration modal shows <img> photo (not emoji-only)
 *     P6 COLD viewer: default photo loaded at init + celebration shows photo
 *     P7 viewer bottom menu is standard back-link (design compliance)
 *
 * Usage:  node tools/prod-regression.js   → PROD (default BASE_URL)
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT } = require('../helpers/env');
const {
  createRealBukitGame, deleteTestGame, fetchGame, SICC_BUKIT, REAL_BUKIT_PLAYERS
} = require('../helpers/game');
const { getDocument } = require('../helpers/firestore');
const {
  newDeviceContext, makeDeviceContext, openScorer, openViewer, saveCurrentHole, expectFlightDataSaved,
  nextHole, setPlayerScoreOnScorer
} = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 }; // iPhone 14 Pro

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
// sorted by handicap ascending (verified against the real record).
function flightOrder(flight) {
  const teamA = REAL_BUKIT_PLAYERS.filter((p) => p.flight === flight && p.team === 'A');
  const teamB = REAL_BUKIT_PLAYERS.filter((p) => p.flight === flight && p.team === 'B')
    .sort((a, b) => a.handicap - b.handicap);
  return [...teamA, ...teamB];
}

function expectedBlock(flight, naturalHole) {
  const s = (n) => String(n).padStart(2, '0');
  return 'T' + flightOrder(flight).map((p) => s(SCORES[p.name][naturalHole - 1])).join('');
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

let results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log((ok ? '✅ ' : '❌ ') + label + (detail ? ' — ' + detail : ''));
}

async function main() {
  console.log('PROD FULL REGRESSION — base:', BASE_URL, '| project:', FIREBASE_PROJECT);
  const gameId = await createRealBukitGame({ testRunId: 'reg-' + Date.now() });
  const historyId = gameId + '_H';
  console.log('game:', gameId, '| course:', SICC_BUKIT.name);
  console.log('players:', REAL_BUKIT_PLAYERS.map((p) => p.label).join(', '));

  const browser = await chromium.launch({ headless: true });
  try {
    const c1 = await newDeviceContext(browser, gameId, 0, VIEWPORT);
    const c2 = await newDeviceContext(browser, gameId, 1, VIEWPORT);
    const c3 = await newDeviceContext(browser, gameId, 2, VIEWPORT); // live viewer
    const p1 = await openScorer(c1, { role: 'update1', gameId });
    const p2 = await openScorer(c2, { role: 'update2', gameId });
    const v1 = await openViewer(c3, { gameId });
    console.log('F1/F2 scorers + LIVE viewer open.\nFilling real scores...');

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
    console.log('\nAll 18 holes filled.');

    // P1: data-string fidelity
    const live = await fetchGame(gameId);
    const f1 = live.f1.d, f2 = live.f2.d;
    let fid = true, mism = [];
    for (let hole = 1; hole <= 18; hole++) {
      const e1 = expectedBlock(1, hole), e2 = expectedBlock(2, hole);
      if (f1.slice((hole - 1) * 9, hole * 9) !== e1) { fid = false; mism.push('f1 H' + hole); }
      if (f2.slice((hole - 1) * 9, hole * 9) !== e2) { fid = false; mism.push('f2 H' + hole); }
    }
    check('P1 data-string fidelity (all 18 holes)', fid, fid ? '14:5 pattern' : mism.join(','));

    // P2: sign both → GAME COMPLETED
    for (const [label, page] of [['F1', p1], ['F2', p2]]) {
      await page.waitForSelector('#signConfirmBtnNew', { timeout: 20000 });
      await page.click('#signConfirmBtnNew');
      console.log('  ' + label + ': SIGN CARD clicked');
    }
    const compF1 = await p1.waitForSelector('#gameCompleteModal', { timeout: 40000 }).then(() => true).catch(() => false);
    const compF2 = await p2.waitForSelector('#gameCompleteModal', { timeout: 20000 }).then(() => true).catch(() => false);
    check('P2 GAME COMPLETED (F1/F2)', compF1 && compF2, compF1 ? (compF2 ? 'both' : 'F1 only') : 'none');

    // P3: auto history record + integrity
    let hist = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      hist = await getDocument('historyGames', historyId).catch(() => null);
      if (hist) break;
    }
    check('P3 auto history record', !!hist, hist ? historyId : 'not created');
    if (hist) {
      const tr = hist.results && hist.results.tr;
      const a = tr && tr.teamA, b = tr && tr.teamB;
      check('P3a final 14:5 + TR=19/hole', !!a && a[17] === 14 && b[17] === 5 && a.every((x, i) => x + b[i] === 19), a ? a[17] + ':' + b[17] : 'no tr');
      const fr = hist.finalResults;
      check('P3b finalResults', !!fr && fr.teamAScore === 14 && fr.teamBScore === 5, fr ? JSON.stringify(fr) : 'absent');
      check('P3c both signed', !!(hist.signatures && hist.signatures.f1.signed && hist.signatures.f2.signed), '');
      check('P3d archive==live strings', !!hist.f1DataString && hist.f1DataString === f1 && hist.f2DataString === f2, '');
    }

    // P4: LIVE viewer — default photo in sessionStorage
    let photoLen = 0;
    for (let i = 0; i < 40; i++) {
      photoLen = await v1.evaluate(() => (sessionStorage.getItem('celebrationPhoto') || '').length);
      if (photoLen > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    check('P4 live viewer photo in sessionStorage', photoLen > 0, photoLen ? photoLen + ' chars' : 'empty');

    // P5: LIVE viewer celebration modal shows the photo
    let p5ok = false, p5detail = 'modal not shown';
    try {
      await v1.evaluate(() => { if (typeof showCelebrationModal === 'function') showCelebrationModal(); });
      await v1.waitForSelector('#celebrationModal', { timeout: 8000 });
      const insp = await v1.evaluate(() => {
        const modal = document.getElementById('celebrationModal');
        if (!modal) return { present: false };
        const img = modal.querySelector('img');
        const hasEmojiOnly = modal.innerHTML.includes('🏆') && !img;
        return {
          present: true,
          hasImg: !!img,
          imgIsData: img ? img.src.startsWith('data:image') : false,
          imgLen: img ? img.src.length : 0,
          hasEmojiOnly,
          text: modal.textContent.slice(0, 80)
        };
      });
      p5ok = insp.present && insp.hasImg && insp.imgIsData && insp.imgLen > 100;
      p5detail = insp.hasImg ? ('photo img ' + insp.imgLen + ' chars') : (insp.hasEmojiOnly ? 'emoji-only 🏆 (no img)' : 'no img, no emoji');
    } catch (e) { p5detail = 'error: ' + e.message; }
    check('P5 live viewer celebration shows PHOTO', p5ok, p5detail);

    // P6: COLD viewer (fresh join after completion, direct cold view of the game)
    const c4 = await makeDeviceContext(browser, gameId, 'dev_autotest_cold', 'DEV-96', VIEWPORT);
    const v2 = await c4.newPage();
    await v2.goto(BASE_URL + '/view-game.html?gameId=' + gameId, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let photoLen2 = 0;
    for (let i = 0; i < 40; i++) {
      photoLen2 = await v2.evaluate(() => (sessionStorage.getItem('celebrationPhoto') || '').length);
      if (photoLen2 > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    check('P6a cold viewer default photo loaded at init', photoLen2 > 0, photoLen2 ? photoLen2 + ' chars' : 'empty');
    let p6ok = false, p6detail = 'modal not shown';
    try {
      // wait for the game cache to be ready (allPlayers populated) before showing celebration
      await v2.waitForFunction(() => window.allPlayers && window.allPlayers.length === 8, null, { timeout: 25000 });
      await v2.evaluate(() => { if (typeof showCelebrationModal === 'function') showCelebrationModal(); });
      await v2.waitForSelector('#celebrationModal', { timeout: 8000 });
      const insp = await v2.evaluate(() => {
        const modal = document.getElementById('celebrationModal');
        const img = modal && modal.querySelector('img');
        return { hasImg: !!img, imgIsData: img ? img.src.startsWith('data:image') : false, imgLen: img ? img.src.length : 0 };
      });
      p6ok = insp.hasImg && insp.imgIsData && insp.imgLen > 100;
      p6detail = insp.hasImg ? ('photo img ' + insp.imgLen + ' chars') : 'no img';
    } catch (e) { p6detail = 'error: ' + e.message; }
    check('P6b cold viewer celebration shows PHOTO', p6ok, p6detail);

    // P7: viewer bottom menu standard back-link (design compliance)
    const menu = await v2.evaluate(() => {
      const c = document.getElementById('bottomMenuContainer');
      const link = c && c.querySelector('.back-link, #menuLink');
      const pill = c && c.querySelector('button#menuBtn');
      return { hasBackLink: !!link, hasPillButton: !!pill };
    });
    check('P7 viewer bottom menu = standard back-link', menu.hasBackLink && !menu.hasPillButton, JSON.stringify(menu));

    await browser.close();
    await deleteTestGame(gameId);
    await deleteTestGame(historyId).catch(() => {});
    console.log('\n=== REGRESSION SUMMARY ===');
    const pass = results.filter((r) => r.ok).length;
    console.log(pass + '/' + results.length + ' passed');
    if (pass !== results.length) {
      results.filter((r) => !r.ok).forEach((r) => console.log('  FAILED:', r.label));
    }
    process.exit(pass === results.length ? 0 : 1);
  } catch (e) {
    console.error('ERROR:', e.message);
    await browser.close().catch(() => {});
    await deleteTestGame(gameId).catch(() => {});
    await deleteTestGame(historyId).catch(() => {});
    process.exit(3);
  }
}

main();
