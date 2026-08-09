#!/usr/bin/env node
/**
 * HANDICAP → POST-GAME PRODUCTION REGRESSION — closes the handicap gap.
 *
 * Real SICC Bukit game end-to-end on PROD, then verifies the handicap
 * adjustment was COMPUTED into the auto history record (restored v1.42
 * behavior) and that hcp-adjust + post-game render on the live site.
 *
 *   flow : create real game → score all 18 (real scores) → sign both →
 *          GAME COMPLETED → auto history record → verify adjustedHandicaps →
 *          hcp-adjust.html renders table → post-game.html renders.
 *
 *   checks:
 *     H1 history has adjustedHandicaps (not null)
 *     H2 adjustedHandicaps has 8 players
 *     H3 per-player finalHcp MATCHES the real record GM_260606_1010_13_H
 *     H4 record has version=3, schema='v3_strings', archiveId
 *     H5 core integrity intact (final 14:5, TR=19/hole, finalResults, signed)
 *     G1 hcp-adjust.html?gameId= renders the adjustment table (8 rows)
 *     G2 post-game.html renders the celebration/results
 *
 * Usage:  node tools/hcp-postgame-regression.js  → PROD (default BASE_URL)
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT } = require('../helpers/env');
const {
  createRealBukitGame, deleteTestGame, fetchGame, SICC_BUKIT, REAL_BUKIT_PLAYERS
} = require('../helpers/game');
const { getDocument } = require('../helpers/firestore');
const {
  newDeviceContext, makeDeviceContext, openScorer, saveCurrentHole, expectFlightDataSaved,
  nextHole, setPlayerScoreOnScorer
} = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 };

// Real gross scores (name → natural-hole-1..18)
const SCORES = {
  ACH:  [7,4,6,5,4,6,5,3,4,4,5,4,5,4,6,6,4,5], CK: [6,3,6,7,4,5,5,4,7,5,4,3,7,6,6,4,3,6],
  OCB:  [7,4,5,6,3,7,5,5,7,5,5,4,5,4,6,5,3,5], JO: [6,5,4,7,5,8,6,6,4,6,8,3,7,3,8,5,3,7],
  KF:   [5,5,5,7,2,4,6,5,5,5,6,5,5,6,7,4,3,6], YHM: [5,4,4,5,4,6,6,4,7,5,8,5,6,4,6,10,3,8],
  Piti: [5,3,5,6,3,6,5,5,7,7,5,3,7,4,7,5,4,6], JG: [3,5,5,6,4,9,6,5,6,4,4,4,5,4,6,5,4,5]
};

// Ground truth final handicaps from the REAL record GM_260606_1010_13_H
const EXPECTED_FINAL = { JG: 0, ACH: 1, OCB: 1, KF: 3, CK: 7, Piti: 8, YHM: 11, JO: 11 };

function flightOrder(flight) {
  const tA = REAL_BUKIT_PLAYERS.filter(p => p.flight === flight && p.team === 'A');
  const tB = REAL_BUKIT_PLAYERS.filter(p => p.flight === flight && p.team === 'B').sort((a, b) => a.handicap - b.handicap);
  return [...tA, ...tB];
}

async function setScoreToTarget(page, playerName, naturalHole) {
  const target = SCORES[playerName][naturalHole - 1];
  const par = SICC_BUKIT.par[naturalHole - 1];
  const delta = target - par;
  if (delta !== 0) await setPlayerScoreOnScorer(page, { playerName, delta });
}

async function fillFlight(page, flight, naturalHole) {
  for (const p of REAL_BUKIT_PLAYERS.filter(x => x.flight === flight)) {
    await setScoreToTarget(page, p.name, naturalHole);
  }
}

let results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log((ok ? '✅ ' : '❌ ') + label + (detail ? ' — ' + detail : ''));
}

async function main() {
  console.log('HCP/POST-GAME REGRESSION — base:', BASE_URL, '| project:', FIREBASE_PROJECT);
  const gameId = await createRealBukitGame({ testRunId: 'hcp-' + Date.now() });
  const historyId = gameId + '_H';
  console.log('game:', gameId, '| course:', SICC_BUKIT.name);

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
    console.log('\nAll 18 holes filled.');

    // Sign both
    for (const page of [p1, p2]) {
      await page.waitForSelector('#signConfirmBtnNew', { timeout: 20000 });
      await page.click('#signConfirmBtnNew');
    }
    console.log('both signed → GAME COMPLETED');

    // Wait for auto history record
    let hist = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      hist = await getDocument('historyGames', historyId).catch(() => null);
      if (hist) break;
    }
    check('H1 history record created with adjustedHandicaps', !!hist && !!hist.adjustedHandicaps, hist && hist.adjustedHandicaps ? 'present' : (hist ? 'record ok but adjustedHandicaps null' : 'no record'));
    if (hist) {
      const ah = hist.adjustedHandicaps;
      if (ah && ah.players) {
        check('H2 adjustedHandicaps has 8 players', ah.players.length === 8, ah.players.length + ' players');
        // H3: compare per-player finalHcp to real record
        let allMatch = true, detail = [];
        for (const p of ah.players) {
          const exp = EXPECTED_FINAL[p.name];
          const got = p.finalHcp;
          const match = exp !== undefined && got === exp;
          if (!match) { allMatch = false; detail.push(p.name + '=' + got + '(want ' + exp + ')'); }
        }
        check('H3 final handicaps match REAL record', allMatch, allMatch ? 'all 8 match' : detail.join(', '));
        check('H3b anchor/newAnchor', ah.anchor && ah.newAnchor, JSON.stringify({ anchor: ah.anchor, newAnchor: ah.newAnchor, needsZeroRise: ah.needsZeroRise, zeroRiseAmount: ah.zeroRiseAmount }));
        check('H4 record version/schema/archiveId', hist.version === 3 && hist.schema === 'v3_strings' && hist.archiveId === historyId, 'v' + hist.version + ' ' + hist.schema + ' ' + hist.archiveId);
      }
      const tr = hist.results && hist.results.tr;
      const a = tr && tr.teamA, b = tr && tr.teamB;
      check('H5 core: final 14:5 + TR=19', !!a && a[17] === 14 && b[17] === 5 && a.every((x, i) => x + b[i] === 19), a ? a[17] + ':' + b[17] : 'no tr');
      check('H5b finalResults + signed', !!(hist.finalResults && hist.signatures && hist.signatures.f1.signed && hist.signatures.f2.signed), '');
    }

    // G1: hcp-adjust.html renders the table (live PROD)
    let g1ok = false, g1detail = 'no table';
    try {
      const c3 = await makeDeviceContext(browser, gameId, 'dev_autotest_hcp', 'DEV-95', VIEWPORT);
      const hp = await c3.newPage();
      await hp.goto(BASE_URL + '/hcp-adjust.html?gameId=' + gameId, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await hp.waitForSelector('#hcpTableContainer table', { timeout: 20000 });
      const tbl = await hp.evaluate(() => {
        const t = document.querySelector('#hcpTableContainer table');
        const rows = t ? Array.from(t.querySelectorAll('tbody tr')) : [];
        return { rowCount: rows.length, text: t ? t.textContent.slice(0, 200) : '' };
      });
      const playerRows = tbl.rowCount; // 2 team-header rows + 8 players = 10
      g1ok = tbl.rowCount >= 8 && tbl.text.includes('New');
      g1detail = tbl.rowCount + ' rows, has New col';
    } catch (e) { g1detail = 'error: ' + e.message; }
    check('G1 hcp-adjust.html renders adjustment table', g1ok, g1detail);

    // G2: post-game.html renders (with celebrationData in sessionStorage)
    let g2ok = false, g2detail = 'no content';
    try {
      const c4 = await makeDeviceContext(browser, gameId, 'dev_autotest_pg', 'DEV-94', VIEWPORT);
      const pg = await c4.newPage();
      await pg.goto(BASE_URL + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pg.evaluate((gid) => {
        sessionStorage.setItem('celebrationData', JSON.stringify({
          winner: 'A', teamAScore: 14, teamBScore: 5,
          winningPlayers: { teamA: [], teamB: [] }, gameId: gid
        }));
      }, gameId);
      await pg.goto(BASE_URL + '/post-game.html?gameId=' + gameId, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pg.waitForSelector('#celebrationModal', { timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));
      const insp = await pg.evaluate(() => {
        const modal = document.getElementById('celebrationModal');
        if (!modal) return { hasModal: false, text: '' };
        const text = modal.textContent;
        return {
          hasModal: true,
          hasTeamA: text.includes('Team A'),
          has14: text.includes('14') && text.includes('5'),
          hasHcpBtn: !!modal.querySelector('#celebrationHandicapBtn'),
          text: text.slice(0, 120)
        };
      });
      g2ok = insp.hasModal && insp.hasTeamA && insp.has14 && insp.hasHcpBtn;
      g2detail = insp.hasModal ? ('renders celebration modal: ' + (insp.hasTeamA && insp.has14 ? 'Team A 14:5' : insp.text.replace(/\s+/g, ' ').slice(0, 60)) + (insp.hasHcpBtn ? ' + HCP button' : '')) : 'no modal';
    } catch (e) { g2detail = 'error: ' + e.message; }
    check('G2 post-game.html renders results', g2ok, g2detail);

    await browser.close();
    await deleteTestGame(gameId).catch(() => {});
    await deleteTestGame(historyId).catch(() => {});
    console.log('\n=== HCP/POST-GAME REGRESSION SUMMARY ===');
    const pass = results.filter(r => r.ok).length;
    console.log(pass + '/' + results.length + ' passed');
    if (pass !== results.length) results.filter(r => !r.ok).forEach(r => console.log('  FAILED:', r.label));
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
