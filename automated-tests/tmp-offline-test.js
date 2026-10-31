const { chromium } = require('@playwright/test');
const PROBE = '_connectivityProbe';   // scratch collection - app never reads this

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();
  await page.goto('https://sicc-ryder-cup.pages.dev/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.firestore, { timeout: 20000 });
  await page.waitForTimeout(3000);

  console.log('SDK version visible:', await page.evaluate(() => (window.firebase && firebase.SDK_VERSION) || 'n/a'));

  // go OFFLINE
  await ctx.setOffline(true);
  console.log('\n>>> network set OFFLINE');

  const off = await page.evaluate(async (PROBE) => {
    const t0 = Date.now();
    try {
      await firebase.firestore().collection(PROBE).doc('probe').set({ when: new Date().toISOString(), marker: 'offline-write' });
      return { result: 'RESOLVED (no error)', ms: Date.now() - t0 };
    } catch (e) {
      return { result: 'REJECTED: ' + e.message, ms: Date.now() - t0 };
    }
  }, PROBE);
  console.log('write while offline  :', off.result, `(${off.ms} ms)`);

  // does the SDK say it is offline?
  const inFlight = await page.evaluate(async (PROBE) => {
    // second write, to see if the SDK surfaces failure at all
    const t0 = Date.now();
    try {
      await firebase.firestore().collection(PROBE).doc('probe2').set({ marker: 'offline-write-2' });
      return 'RESOLVED (no error)';
    } catch (e) { return 'REJECTED: ' + e.message; }
  }, PROBE);
  console.log('second offline write :', inFlight);

  // back ONLINE and see whether the queued writes flush
  await ctx.setOffline(false);
  console.log('\n>>> network restored ONLINE, waiting 8s for any queued flush...');
  await page.waitForTimeout(8000);

  await browser.close();
  console.log('\n(cleanup of the probe docs happens in the next step)');
})();
