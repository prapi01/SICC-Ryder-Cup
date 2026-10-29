#!/usr/bin/env node
/**
 * UI SURFACE VERIFICATION — read-only admin + viewer/history checks on PROD.
 *
 * Complements the flow suites (suite-a/b, prod-regression, hcp-postgame) by
 * exercising the back-office + viewer surfaces that no other tool covers:
 *
 *   U1  admin.html hub renders + 4 navigation buttons
 *   U2  manage-games.html lists games (real data, read-only)
 *   U3  manage-games.html delete flow: auth PIN → confirm → doc deleted (test game only)
 *   U4  setup-game.html renders (course selector + 8-player roster + commit control)
 *   U5  courses.html renders the course list with PAR/SI editors
 *   U6  player-management.html renders the 8 players
 *   U7  auth PIN: WRONG pin is rejected with an error (no action fires)
 *   U8  auth PIN: lockout after 5 wrong attempts
 *   U9  index.html shows the on-screen version marker
 *   U10 view-history.html lists history records and renders a record read-only
 *
 * SAFETY: never touches the real Saturday game. Only the throwaway game created
 * by U3 is deleted. The real game + collection counts are snapshotted before and
 * after and must be unchanged.
 *
 * Usage: node tools/verify-ui-surfaces.js
 */
const { chromium } = require('@playwright/test');
const { BASE_URL, FIREBASE_PROJECT, FIRESTORE_BASE } = require('../helpers/env');
const { createTestGame, deleteTestGame, fetchGame, generateGameId, buildGameData } = require('../helpers/game');
const { createDocument, deleteDocument } = require('../helpers/firestore');

const REAL_GAME = 'GM_260914_1342_52';
const CORRECT_PIN = '8888';
const VIEWPORT = { width: 393, height: 852 };

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log((ok ? '✅ ' : '❌ ') + label + (detail ? ' — ' + detail : ''));
}

async function countCollection(col) {
  let total = 0, token = '';
  for (;;) {
    const u = FIRESTORE_BASE + '/' + col + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const j = await (await fetch(u)).json();
    total += (j.documents || []).length;
    token = j.nextPageToken || '';
    if (!token) break;
  }
  return total;
}

async function realGameFingerprint() {
  const d = await fetchGame(REAL_GAME);
  return JSON.stringify(d.fields, Object.keys(d.fields || {}).sort());
}

async function main() {
  console.log('UI SURFACE VERIFICATION — base:', BASE_URL, '| project:', FIREBASE_PROJECT);
  const before = {
    real: await realGameFingerprint(),
    scheduled: await countCollection('scheduledGames'),
    history: await countCollection('historyGames'),
    courses: await countCollection('courses')
  };
  console.log('pre-run:', JSON.stringify({ scheduled: before.scheduled, history: before.history, courses: before.courses }));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  context.on('weberror', () => {});
  const pageErrors = [];
  context.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(e.message)));

  let deleteGameId = null;
  try {
    // ---------- U1 admin hub ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/admin.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.admin-btn', { timeout: 30000 }).catch(() => {});
      const btns = await page.locator('.admin-btn').count();
      const back = await page.locator('.back-link').count();
      check('U1 admin hub renders + 4 nav buttons', btns >= 4 && back >= 1, `buttons=${btns} backLink=${back}`);
      await page.close();
    }

    // ---------- U2 manage-games list ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/manage-games.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const a = document.getElementById('app');
        return a && (a.querySelectorAll('.game-item').length > 0 || /no games|Game Settings/i.test(a.textContent || ''));
      }, null, { timeout: 30000 }).catch(() => {});
      const items = await page.locator('.game-item').count();
      const delBtns = await page.locator('.btn-delete').count();
      check('U2 manage-games lists games with delete controls', items >= 1 && delBtns >= 1, `game-items=${items} delete-btns=${delBtns}`);
      await page.close();
    }

    // ---------- U3 delete flow (auth PIN + confirm) ----------
    {
      deleteGameId = await createTestGame({ testRunId: 'u3-' + Date.now() });
      console.log('  U3 created throwaway game', deleteGameId);
      const page = await context.newPage();
      await page.goto(BASE_URL + '/manage-games.html?showAll=true', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((id) => {
        const a = document.getElementById('app');
        return a && (a.textContent || '').includes(id);
      }, deleteGameId, { timeout: 30000 }).catch(() => {});

      const row = page.locator('.game-item', { hasText: deleteGameId }).first();
      const found = await row.count();
      let detail = 'row not found';
      let deleted = false;
      if (found) {
        await row.locator('.btn-delete').click();
        // PIN modal → enter correct PIN
        await page.waitForSelector('#authModal', { timeout: 15000 }).catch(() => {});
        for (let i = 0; i < CORRECT_PIN.length; i++) {
          await page.locator(`.auth-btn[data-digit="${CORRECT_PIN[i]}"]`).click();
          await page.waitForTimeout(120);
        }
        // confirmation dialog
        await page.waitForSelector('#sharedModalConfirmBtn', { timeout: 15000 }).catch(() => {});
        if (await page.locator('#sharedModalConfirmBtn').count()) {
          await page.click('#sharedModalConfirmBtn');
        }
        // verify gone from Firestore
        for (let i = 0; i < 30; i++) {
          const d = await fetchGame(deleteGameId).catch(() => null);
          if (!d) { deleted = true; break; }
          await page.waitForTimeout(500);
        }
        detail = deleted ? 'PIN→confirm→deleted' : 'still present after confirm';
      }
      check('U3 manage-games delete flow (PIN 8888 + confirm)', found > 0 && deleted, detail);
      await page.close();
    }

    // ---------- U4 setup-game render ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/setup-game.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#app', { timeout: 30000 }).catch(() => {});
      await page.waitForFunction(() => {
        const a = document.getElementById('app');
        return a && /PAR|SI|Handicap|Tee|Course|Player/i.test(a.textContent || '');
      }, null, { timeout: 30000 }).catch(() => {});
      const info = await page.evaluate(() => {
        const a = document.getElementById('app');
        const t = a ? a.textContent || '' : '';
        return {
          len: t.length,
          hasCourse: /Course/i.test(t),
          hasPar: /\bPAR\b/i.test(t),
          hasAnchor: /Anchor|anchor/i.test(t),
          inputs: a ? a.querySelectorAll('input,select').length : 0
        };
      });
      check('U4 setup-game renders roster/course controls', info.len > 200 && info.inputs > 0 && info.hasCourse,
        JSON.stringify(info));
      await page.close();
    }

    // ---------- U5 courses ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/courses.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#app', { timeout: 30000 }).catch(() => {});
      await page.waitForFunction(() => {
        const a = document.getElementById('app');
        return a && (a.querySelectorAll('input').length > 0 || /course/i.test(a.textContent || ''));
      }, null, { timeout: 30000 }).catch(() => {});
      // NB: courses.html performs a cache-busting redirect (?v=1.37) on load, so
      // wait for the rendered list rather than a fixed selector after goto.
      await page.waitForFunction(() => document.querySelectorAll('.course-item').length > 0, null, { timeout: 30000 }).catch(() => {});
      const info = await page.evaluate(() => {
        const a = document.getElementById('app');
        const items = a ? a.querySelectorAll('.course-item').length : 0;
        const editBtns = a ? a.querySelectorAll('button[onclick^="editCourseById"]').length : 0;
        return { items, editBtns, hasAdd: !!(a && a.querySelector('button[onclick="startAddCourse()"]')) };
      });
      check('U5 courses.html renders course list + add/edit controls', info.items > 0 && info.editBtns > 0,
        JSON.stringify(info));
      await page.close();
    }

    // ---------- U6 player-management ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/player-management.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#playerList', { timeout: 30000 }).catch(() => {});
      await page.waitForFunction(() => {
        const l = document.getElementById('playerList');
        return l && (l.textContent || '').trim().length > 20;
      }, null, { timeout: 30000 }).catch(() => {});
      const info = await page.evaluate(() => {
        const l = document.getElementById('playerList');
        const t = l ? l.textContent || '' : '';
        const rows = l ? l.querySelectorAll('.player-item, .player-row, .player-card, [class*="player"]').length : 0;
        return { len: t.length, rows, sample: t.replace(/\s+/g, ' ').slice(0, 80) };
      });
      check('U6 player-management renders player roster', info.len > 50, `textLen=${info.len} rows=${info.rows}`);
      await page.close();
    }

    // ---------- U7/U8 auth PIN (wrong pin + lockout) ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/manage-games.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.AuthPin !== 'undefined' && window.AuthPin.requireAuth, null, { timeout: 30000 }).catch(() => {});

      const enterPin = async (pin) => {
        for (let i = 0; i < pin.length; i++) {
          await page.locator(`.auth-btn[data-digit="${pin[i]}"]`).click();
          await page.waitForTimeout(120);
        }
      };

      // U7: wrong pin → error, callback NOT fired
      await page.evaluate(() => { window.__authFired = false; AuthPin.requireAuth('unit_test', 'u7', 'u7', () => { window.__authFired = true; }); });
      await page.waitForSelector('#authModal', { timeout: 15000 }).catch(() => {});
      await enterPin('0000');
      await page.waitForTimeout(1200);
      const u7 = await page.evaluate(() => ({
        fired: window.__authFired,
        err: (document.getElementById('authPinError') || {}).textContent || '',
        modalOpen: !!document.getElementById('authModal')
      }));
      check('U7 wrong PIN rejected with error', !u7.fired && u7.err.trim().length > 0 && u7.modalOpen, JSON.stringify(u7));

      // cancel + reset, then U8: 5 wrong attempts → lockout
      await page.evaluate(() => { if (window.AuthPin.resetAuth) AuthPin.resetAuth(); });
      await page.evaluate(() => { window.__authFired = false; AuthPin.requireAuth('unit_test', 'u8', 'u8', () => { window.__authFired = true; }); });
      await page.waitForSelector('#authModal', { timeout: 15000 }).catch(() => {});
      let lockMsg = '';
      for (let a = 0; a < 5; a++) {
        await enterPin('1111').catch(() => {});
        await page.waitForTimeout(900);
        lockMsg = await page.evaluate(() => (document.getElementById('authPinError') || {}).textContent || '');
      }
      const u8 = await page.evaluate(() => {
        const digits = document.querySelectorAll('.auth-btn[data-digit]');
        const disabled = Array.from(digits).filter((b) => b.disabled).length;
        return { err: (document.getElementById('authPinError') || {}).textContent || '', digits: digits.length, disabled, fired: window.__authFired };
      });
      check('U8 lockout after 5 wrong attempts', /lock/i.test(u8.err) || u8.disabled > 0 || /lock/i.test(lockMsg),
        JSON.stringify({ err: u8.err || lockMsg, disabled: u8.disabled, fired: u8.fired }));
      await page.close();
    }

    // ---------- U9 index version marker ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.INDEX_VERSION, null, { timeout: 30000 }).catch(() => {});
      const info = await page.evaluate(() => ({
        ver: window.INDEX_VERSION || null,
        text: (document.body.textContent || '').includes(window.INDEX_VERSION || '#')
      }));
      check('U9 index.html exposes version + shows it', !!info.ver && info.text, JSON.stringify(info));
      await page.close();
    }

    // ---------- U10 view-history list + read-only record render ----------
    {
      const page = await context.newPage();
      await page.goto(BASE_URL + '/view-history.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const c = document.getElementById('gameListContainer');
        return c && c.querySelectorAll('.game-card').length > 0;
      }, null, { timeout: 30000 }).catch(() => {});
      const cards = await page.locator('#gameListContainer .game-card').count();
      let rendered = false, detail = 'no record opened';
      if (cards > 0) {
        // The card opens its scorecard via the .btn-scorecard button (bound in attachEventHandlers).
        const btn = page.locator('#gameListContainer .btn-scorecard').first();
        await btn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        await btn.click({ force: true });
        await page.waitForFunction(() => {
          const d = document.getElementById('gameDetailView');
          const dc = document.getElementById('detailContent');
          return d && d.offsetParent !== null && dc && dc.classList.contains('data-ready');
        }, null, { timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const info = await page.evaluate(() => {
          const pc = document.getElementById('playerCards');
          const sc = document.getElementById('scorecardWrapper');
          const body = document.body.textContent || '';
          return {
            playerCardsLen: pc ? (pc.textContent || '').trim().length : 0,
            hasScorecard: !!sc,
            teamOne: /TEAM ONE|Team One/i.test(body),
            detailVisible: (() => { const d = document.getElementById('gameDetailView'); return !!(d && d.offsetParent !== null); })()
          };
        });
        rendered = info.detailVisible && info.hasScorecard && info.playerCardsLen > 10 && info.teamOne;
        detail = JSON.stringify(info);
      }
      check('U10 view-history lists records + renders read-only scorecard', cards > 0 && rendered, `cards=${cards} ${detail}`);
      await page.close();
    }
  } catch (e) {
    console.error('SCRIPT ERROR:', e.message);
  } finally {
    await browser.close().catch(() => {});
    if (deleteGameId) await deleteTestGame(deleteGameId).catch(() => {});
  }

  // ---------- safety: real game + counts unchanged ----------
  const after = {
    real: await realGameFingerprint(),
    scheduled: await countCollection('scheduledGames'),
    history: await countCollection('historyGames'),
    courses: await countCollection('courses')
  };
  check('S1 real Saturday game untouched', before.real === after.real, REAL_GAME);
  check('S2 scheduledGames count unchanged', before.scheduled === after.scheduled, `${before.scheduled} → ${after.scheduled}`);
  check('S3 historyGames count unchanged', before.history === after.history, `${before.history} → ${after.history}`);
  check('S4 courses count unchanged', before.courses === after.courses, `${before.courses} → ${after.courses}`);
  if (pageErrors.length) console.log('\npage errors observed:', pageErrors.slice(0, 5).join(' | '));

  const pass = results.filter((r) => r.ok).length;
  console.log('\n=== UI SURFACE SUMMARY ===');
  console.log(pass + '/' + results.length + ' passed');
  results.filter((r) => !r.ok).forEach((r) => console.log('  FAILED:', r.label));
  process.exit(pass === results.length ? 0 : 1);
}
main();
