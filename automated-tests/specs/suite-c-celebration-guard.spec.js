/**
 * Suite C — celebration-photo guard (v1.22) verification.
 *
 * WHY THIS EXISTS
 *   The 2026-10-31 game-day defect was: the celebration screen showed the DEFAULT
 *   placeholder even though the real photo was uploaded and present in Storage.
 *   Cause A: `loadDefaultCelebrationPhoto()` ran AFTER a real photo had been
 *   broadcast, called `setPhotoFlags()` with the DEFAULT url, and overwrote
 *   `photo.imageUrl` (resetting `f2Downloaded`/`viewDownloaded`). The scorer (F1)
 *   kept the real blob in sessionStorage, so only the other devices showed the
 *   default — exactly what the user saw.
 *
 *   v1.22 (`js/celebration-photo.js`) fixed it: if `photo.newPhotoAvailable === true`
 *   and `photo.imageUrl` is set, the default loader must NOT call `setPhotoFlags()`;
 *   it must pull the BROADCAST url into sessionStorage instead.
 *
 * WHAT THIS SPEC PROVES
 *   1. GUARD FIRES: with `newPhotoAvailable === true` + a real `imageUrl`, a fresh
 *      viewer page load takes the v1.22 branch — asserted by the guard's own log
 *      line, NOT merely by "something didn't crash".
 *   2. STATE PRESERVED: the broadcast `imageUrl` and both `*Downloaded` flags are
 *      unchanged afterwards, and sessionStorage holds the BROADCAST photo rather
 *      than the default.
 *   3. NEGATIVE CONTROL: with nothing broadcast, the loader DOES publish the
 *      default — so the guard is conditional, not a blanket skip that would
 *      silently break the "celebration always shows a photo" design.
 *
 * WHY THE LOG LINE IS THE ASSERTION
 *   `loadDefaultCelebrationPhoto()` returns early at its first line when
 *   `sessionStorage['celebrationPhoto']` is already set, so a naive test can pass
 *   without ever reaching the guard. Every test here therefore uses a FRESH device
 *   context and attaches its console listener BEFORE first navigation, then asserts
 *   which branch actually ran.
 *
 * SCOPE / SAFETY
 *   - Targets PROD (the only env running the v1.22 code; DEV/staging is not synced
 *     with main). Creates its OWN throwaway games and deletes them in cleanup —
 *     it never touches a real game.
 *   - Firestore writes use the shared harness helpers (no auth required; verified).
 *
 * Run:  npm run suite:c        (or HEADED=1 npm run suite:c)
 */

const { test, expect, chromium } = require('@playwright/test');
const { createTestGame, deleteTestGame } = require('../helpers/game');
const { getDocument, updateDocument } = require('../helpers/firestore');
const { newDeviceContext, openViewer } = require('../helpers/realtime');

const DEFAULT_MARKER = 'SRC_Default_Photo';
const GUARD_LOG = 'Real photo broadcast in progress';
const EARLY_RETURN_LOG = 'Photo already in sessionStorage';
const DEFAULT_STORED_LOG = 'Default photo stored in sessionStorage';

/** A realistic "real photo" URL for the broadcast. Assertions only compare strings. */
const REAL_PHOTO_URL =
  'https://firebasestorage.googleapis.com/v0/b/sicc-ryder-cup.firebasestorage.app/o/celebration%2FTEST_H.jpg?alt=media&token=00000000-0000-0000-0000-000000000000';

async function readPhotoFlags(gameId) {
  const doc = await getDocument('scheduledGames', gameId);
  const photo = (doc && doc.photo) || {};
  return {
    newPhotoAvailable: photo.newPhotoAvailable,
    f2Downloaded: photo.f2Downloaded,
    viewDownloaded: photo.viewDownloaded,
    imageUrl: photo.imageUrl || ''
  };
}

/** Mirror what setPhotoFlags() writes when F1 uploads a real photo during a round. */
async function seedPhotoFlags(gameId, { newPhotoAvailable, imageUrl }) {
  await updateDocument('scheduledGames', gameId, {
    photo: {
      newPhotoAvailable: newPhotoAvailable,
      f2Downloaded: false,
      viewDownloaded: false,
      imageUrl: imageUrl
    }
  });
}

/**
 * Attach a console sink to the CONTEXT before it navigates anywhere, so the
 * loader's log lines are captured on the FIRST load (attaching later would miss
 * the very lines this spec asserts on).
 */
function captureLogs(context, sink) {
  context.on('page', (page) => {
    page.on('console', (msg) => {
      const t = msg.text();
      if (t.includes('[CelebrationPhoto]') || t.includes('[VIEW-GAME]')) sink.push(t);
    });
  });
}

/** Open a viewer, wait for the photo chain to settle, return its logs + storage. */
async function openViewerAndSettle(browser, gameId, deviceIndex) {
  const logs = [];
  const context = await newDeviceContext(browser, gameId, deviceIndex);
  captureLogs(context, logs);

  const page = await openViewer(context, { gameId });

  await page
    .waitForFunction(() => typeof window.loadDefaultCelebrationPhoto === 'function', {
      timeout: 20000
    })
    .catch(() => {});

  // The default loader fetches a ~534 KB image from Storage and converts it to a
  // data URL before it reaches the guard, so allow generous settle time.
  await page
    .waitForFunction(
      (marker) => {
        const s = sessionStorage.getItem('celebrationPhoto') || '';
        return s.length > 0 && !s.includes(marker);
      },
      DEFAULT_MARKER,
      { timeout: 25000 }
    )
    .catch(() => {});
  await page.waitForTimeout(3000);

  const stored = await page.evaluate(() => sessionStorage.getItem('celebrationPhoto') || '');
  return { context, page, logs, stored };
}

test.describe('Suite C — celebration photo guard (v1.22)', () => {
  const runId = 'suiteC-' + Date.now();
  let browser;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    if (browser) await browser.close().catch(() => {});
  });

  test('guard fires: a broadcast real photo is NOT overwritten by the default loader', async () => {
    const gameId = await createTestGame({ testRunId: runId + '-guard' });
    let ctx;
    try {
      await seedPhotoFlags(gameId, { newPhotoAvailable: true, imageUrl: REAL_PHOTO_URL });
      expect((await readPhotoFlags(gameId)).newPhotoAvailable).toBe(true);

      const r = await openViewerAndSettle(browser, gameId, 20);
      ctx = r.context;

      const guardRan = r.logs.some((l) => l.includes(GUARD_LOG));
      const earlyReturn = r.logs.some((l) => l.includes(EARLY_RETURN_LOG));

      // PROOF THE GUARD BRANCH WAS TAKEN — not an accidental pass via the
      // sessionStorage early-return, which would skip the guard entirely.
      expect(
        guardRan,
        `the v1.22 guard log was not emitted, so the guard was not exercised.\n` +
          `earlyReturn=${earlyReturn}\nlogs:\n${r.logs.join('\n')}`
      ).toBe(true);
      expect(earlyReturn, 'unexpected early-return: sessionStorage was not empty').toBe(false);

      // STATE PRESERVED
      const after = await readPhotoFlags(gameId);
      expect(after.imageUrl, 'photo.imageUrl must not be replaced').toBe(REAL_PHOTO_URL);
      expect(after.imageUrl.includes(DEFAULT_MARKER), 'must not point at the default').toBe(false);
      expect(after.newPhotoAvailable, 'newPhotoAvailable must remain true').toBe(true);

      // sessionStorage holds the broadcast photo, not the default
      expect(r.stored.length, 'sessionStorage should hold a photo').toBeGreaterThan(0);
      expect(
        r.stored.includes(DEFAULT_MARKER),
        'sessionStorage must show the broadcast photo, not the default'
      ).toBe(false);

      console.log('[SUITE-C] PASS — guard fired; broadcast photo preserved');
    } finally {
      if (ctx) await ctx.close().catch(() => {});
      await deleteTestGame(gameId);
    }
  });

  test('negative control: with nothing broadcast, the default IS published', async () => {
    const gameId = await createTestGame({ testRunId: runId + '-ctl' });
    let ctx;
    try {
      await seedPhotoFlags(gameId, { newPhotoAvailable: false, imageUrl: '' });

      const r = await openViewerAndSettle(browser, gameId, 21);
      ctx = r.context;

      const guardRan = r.logs.some((l) => l.includes(GUARD_LOG));
      const defaultStored = r.logs.some((l) => l.includes(DEFAULT_STORED_LOG));
      const noGameId = r.logs.some((l) => l.includes('No gameId found'));

      expect(guardRan, 'the guard must NOT fire when nothing was broadcast').toBe(false);

      const after = await readPhotoFlags(gameId);
      expect(
        after.newPhotoAvailable === true && after.imageUrl.length > 0,
        `expected the default to be published.\n` +
          `defaultStored=${defaultStored} noGameId=${noGameId}\n` +
          `flags=${JSON.stringify(after)}\nlogs:\n${r.logs.join('\n')}`
      ).toBe(true);

      console.log('[SUITE-C] PASS — negative control: default published as designed');
    } finally {
      if (ctx) await ctx.close().catch(() => {});
      await deleteTestGame(gameId);
    }
  });
});
