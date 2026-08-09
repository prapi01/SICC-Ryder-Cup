#!/usr/bin/env node
/**
 * SIGN-FLOW A/B TEST — verifies the sign-card → Game-Complete (celebration) flow.
 *
 * Control  : BASE_URL=<prod>                → expects FAIL (current v1.40 bug)
 * Treatment: BASE_URL=http://localhost:8000 → expects PASS (branch with restored
 *            submitSignature)
 *
 * Flow: create test game → open F1/F2 scorers (iPhone 14 Pro viewport) → fill
 * all 18 holes (serialized) → sign modal appears → click SIGN CARD on both →
 * wait for the 🏆 GAME COMPLETED modal (the app's own realtime listener).
 *
 * Exit: 0 = PASS (modal appeared on both) · 2 = FAIL (no modal) · 3 = error
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT } = require('../helpers/env');
const { createTestGame, deleteTestGame, fetchGame } = require('../helpers/game');
const {
  newDeviceContext, openScorer, saveCurrentHole, expectFlightDataSaved, nextHole
} = require('../helpers/realtime');

const VIEWPORT = { width: 393, height: 852 }; // iPhone 14 Pro

async function main() {
  console.log('SIGN-FLOW TEST — base:', BASE_URL, '| firestore project:', FIREBASE_PROJECT);
  const gameId = await createTestGame({ testRunId: 'sign-' + Date.now() });
  console.log('game:', gameId);

  const browser = await chromium.launch({ headless: true });
  try {
    const c1 = await newDeviceContext(browser, gameId, 0, VIEWPORT);
    const c2 = await newDeviceContext(browser, gameId, 1, VIEWPORT);
    const p1 = await openScorer(c1, { role: 'update1', gameId });
    const p2 = await openScorer(c2, { role: 'update2', gameId });
    console.log('scorers open. Filling 18 holes (serialized)...');

    for (let hole = 1; hole <= 18; hole++) {
      const ci = (hole - 1) * 9;
      await saveCurrentHole(p1, { flight: 1, charIndex: ci, timeout: 30000 });
      await expectFlightDataSaved(p2, { flight: 1, charIndex: ci, timeout: 20000 });
      await saveCurrentHole(p2, { flight: 2, charIndex: ci, timeout: 30000 });
      await expectFlightDataSaved(p1, { flight: 2, charIndex: ci, timeout: 20000 });
      await nextHole(p1);
      await nextHole(p2);
      process.stdout.write('H' + hole + (hole % 6 === 0 ? '\n' : ' '));
    }
    console.log('\n18 holes filled. Expecting SIGN CARD modal on both...');

    // Click SIGN CARD on both flights (real UI interaction)
    for (const [label, page] of [['F1', p1], ['F2', p2]]) {
      const hasModal = await page.locator('#signConfirmBtnNew').count();
      if (hasModal) {
        await page.click('#signConfirmBtnNew');
        console.log(label + ': clicked SIGN CARD → waiting screen');
      } else {
        console.log(label + ': ❌ sign modal NOT found — flow broke before signing');
        await browser.close();
        await deleteTestGame(gameId);
        process.exit(2);
      }
    }

    // Success = the app's own realtime listener shows the GAME COMPLETED modal
    const ok1 = await p1.waitForSelector('#gameCompleteModal', { timeout: 30000 })
      .then(() => true).catch(() => false);
    console.log('GAME COMPLETED modal on F1:', ok1 ? '✅ PRESENT' : '❌ ABSENT');
    const ok2 = await p2.waitForSelector('#gameCompleteModal', { timeout: 5000 })
      .then(() => true).catch(() => false);
    console.log('GAME COMPLETED modal on F2:', ok2 ? '✅ PRESENT' : '❌ ABSENT');

    const doc = await fetchGame(gameId);
    console.log('firestore signatures:', JSON.stringify((doc && doc.signatures) || null));

    const result = ok1 && ok2 ? 'PASS' : 'FAIL';
    console.log('RESULT:', result);
    await browser.close();
    await deleteTestGame(gameId);
    process.exit(result === 'PASS' ? 0 : 2);
  } catch (e) {
    console.error('ERROR:', e.message);
    await browser.close().catch(() => {});
    await deleteTestGame(gameId).catch(() => {});
    process.exit(3);
  }
}

main();
