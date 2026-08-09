#!/usr/bin/env node
/**
 * SICC Ryder Cup — Interactive Step Runner (Phase 2)
 *
 * Per protocol §12 [A]: drives Suite B from a dedicated control window. 5 headed
 * browser windows: F1, F2, V1, V2 (isolated device identities) + a CONTROL
 * window hosting the panel + live log (no longer overlaying F1).
 *
 * Panel controls:
 *   Score mode: [P]ar · [B]ogey · [A]lternate (odd=par, even=bogey) · [M]anual
 *   [▶ NEXT STEP]   save the current hole on ONE flight (alternating F1→F2→…),
 *                   advance that flight; full verify when the hole completes (F2)
 *   [⚡ GO AUTO]     same alternating pattern through H1..H18, stop at Sign Card
 *   [🔁 Rejoin K]   kill + relaunch F2 with the same device identity (re-sync)
 *   [🔁 Rejoin N]   rejoin F2 as a NEW device (re-sync)
 *   [✖ QUIT]        cleanup (delete test game) and exit
 *
 * Auto-verifies after each save: TR=19/hole, match=16, realtime to V1/V2,
 * and Firestore persistence. Fails loudly on any mismatch.
 *
 * Run:  npm run run:step   (needs macOS — headed Chromium; run unsandboxed)
 */

const { chromium } = require('@playwright/test');
const { execFile } = require('child_process');
const readline = require('readline');
const { BASE_URL } = require('./helpers/env');
const {
  createTestGame,
  createRealBukitGame,
  deleteTestGame,
  fetchGame,
  PLAYERS,
  SICC_BUKIT,
  REAL_BUKIT_PLAYERS
} = require('./helpers/game');
const {
  newDeviceContext,
  openScorer,
  openViewer,
  saveCurrentHole,
  setPlayerScoreOnScorer,
  expectFlightDataSaved,
  readInvariants,
  nextHole
} = require('./helpers/realtime');

// ---------------------------------------------------------------------------
// Scenario: SR_SCENARIO=real → real SICC Bukit game + real player scores
// ---------------------------------------------------------------------------
const SCENARIO = (process.env.SR_SCENARIO || 'auto').toLowerCase();
const SCENARIO_PLAYERS = SCENARIO === 'real' ? REAL_BUKIT_PLAYERS : PLAYERS;

// Real gross scores from the SICC Bukit game (natural hole 1..18)
const REAL_SCORES = {
  ACH:  [7, 4, 6, 5, 4, 6, 5, 3, 4, 4, 5, 4, 5, 4, 6, 6, 4, 5],
  CK:   [6, 3, 6, 7, 4, 5, 5, 4, 7, 5, 4, 3, 7, 6, 6, 4, 3, 6],
  OCB:  [7, 4, 5, 6, 3, 7, 5, 5, 7, 5, 5, 4, 5, 4, 6, 5, 3, 5],
  JO:   [6, 5, 4, 7, 5, 8, 6, 6, 4, 6, 8, 3, 7, 3, 8, 5, 3, 7],
  KF:   [5, 5, 5, 7, 2, 4, 6, 5, 5, 5, 6, 5, 5, 6, 7, 4, 3, 6],
  YHM:  [5, 4, 4, 5, 4, 6, 6, 4, 7, 5, 8, 5, 6, 4, 6, 10, 3, 8],
  Piti: [5, 3, 5, 6, 3, 6, 5, 5, 7, 7, 5, 3, 7, 4, 7, 5, 4, 6],
  JG:   [3, 5, 5, 6, 4, 9, 6, 5, 6, 4, 4, 4, 5, 4, 6, 5, 4, 5]
};

// ---------------------------------------------------------------------------
// Dedicated control window (hosts the panel + live log, not the F1 overlay)
// ---------------------------------------------------------------------------
const CONTROLS_PAGE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>SICC-CONTROLS</title>
<style>
  html,body{margin:0;height:100%;background:#121212;color:#e6e6e6;font:13px/1.5 system-ui,-apple-system,sans-serif}
  body{display:flex;flex-direction:column;padding:14px;box-sizing:border-box;gap:10px}
  #hdr{font-weight:800;color:#4caf50;font-size:16px;display:flex;justify-content:space-between;align-items:center;letter-spacing:.5px}
  #srHole{color:#ffd866;background:#000;border:1px solid #4caf50;border-radius:8px;padding:2px 10px;font:bold 15px ui-monospace,monospace}
  #srMode{color:#ffd866;font-weight:600}
  .row{display:flex;gap:6px;flex-wrap:wrap}
  button{flex:1;min-width:56px;background:#1e1e1e;border:1px solid #333;color:#e0e0e0;border-radius:8px;padding:11px 8px;font-weight:700;cursor:pointer;font-size:13px}
  button:hover{border-color:#4caf50}
  #nextBtn{background:#1a3a1a;color:#4caf50}
  #goBtn{background:#3a2a1a;color:#ffaa44}
  #quitBtn{background:#3a1a1a;color:#ff6b6b}
  #srLog{flex:1;min-height:0;background:#000;border:1px solid #333;border-radius:8px;padding:10px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0}
</style>
</head>
<body>
  <div id="hdr">SICC STEP RUNNER <span id="srHole">—</span></div>
  <div id="srMode">Mode: PAR</div>
  <div class="row">
    <button onclick="srMode('P')">P</button>
    <button onclick="srMode('B')">B</button>
    <button onclick="srMode('A')">A</button>
    <button onclick="srMode('M')">M</button>
  </div>
  <div class="row">
    <button id="nextBtn" onclick="srAction('next')">▶ NEXT STEP</button>
    <button id="goBtn" onclick="srAction('goauto')">⚡ GO AUTO</button>
  </div>
  <div class="row">
    <button onclick="srAction('rejoinK')">🔁 Rejoin K</button>
    <button onclick="srAction('rejoinN')">🔁 Rejoin N</button>
    <button id="quitBtn" onclick="srAction('quit')">✖ QUIT</button>
  </div>
  <pre id="srLog"></pre>
</body>
</html>`;

/** Open the dedicated control window (hosts the panel + live log). */
async function openControlsWindow(browser) {
  const ctx = await browser.newContext({ viewport: { width: LAYOUT.ctrlW, height: 900 } });
  const page = await ctx.newPage();
  await page.setContent(CONTROLS_PAGE_HTML);
  await page.exposeFunction('__srAction', (action) => { resolveAction(action); });
  await page.evaluate(() => {
    window.srAction = (t) => window.__srAction({ type: t });
    window.srMode = (m) => window.__srAction({ type: 'mode', mode: m });
  });
  return { ctx, page };
}

const MODE_NAMES = { P: 'PAR', B: 'BOGEY', A: 'ALTERNATE', M: 'MANUAL' };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  gameId: null,
  browser: null,
  contexts: { f1: null, f2: null, v1: null, v2: null, controls: null },
  pages: { f1: null, f2: null, v1: null, v2: null, controls: null },
  hole: 1,
  flightTurn: 1,       // which flight the next NEXT STEP acts on (1 or 2, alternating)
  mode: 'P',
  running: true,
  rejoinCount: 0
};

let actionResolver = null;
function resolveAction(a) {
  if (actionResolver) {
    const r = actionResolver;
    actionResolver = null;
    r(a);
  }
}
function waitForAction() {
  return new Promise((res) => { actionResolver = res; });
}

// ---------------------------------------------------------------------------
const DEVICE_W = 393; // iPhone 14 Pro logical width — the app's primary target viewport
const DEVICE_H = 852; // iPhone 14 Pro logical height
const APP_MAX_W = 500; // app's .container max-width (real-game.html)

// Desktop / window layout (macOS Spaces)
// ---------------------------------------------------------------------------
const LAYOUT = {
  desktop: process.env.SR_DESKTOP || '6',      // target Space
  processName: process.env.SR_PROCESS || 'Google Chrome for Testing',
  winW: parseInt(process.env.SR_WIN_W || String(DEVICE_W), 10),  // per-window width
  winH: parseInt(process.env.SR_WIN_H || String(DEVICE_H), 10), // per-window height
  startX: parseInt(process.env.SR_X0 || '0', 10),
  y: parseInt(process.env.SR_Y || '25', 10),    // below the menu bar
  gap: parseInt(process.env.SR_GAP || '8', 10),
  ctrlW: parseInt(process.env.SR_CTRL_W || '640', 10)  // control-window width
};
const DESKTOP_KEY_CODES = { 1: 18, 2: 19, 3: 20, 4: 21, 5: 23, 6: 22, 7: 26, 8: 28, 9: 25 };

function runApple(script) {
  // execFile passes the script as ONE argv element (no shell), so embedded
  // newlines/quotes survive — the JSON.stringify+shell path mangled them.
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], (err, stdout, stderr) => resolve({ err, stdout, stderr }));
  });
}

/** Detect the rightmost (ultrawide) display origin so windows land on it. */
async function detectLayout() {
  try {
    const desktop = await runApple('tell application "Finder" to get bounds of window of desktop');
    const m = desktop.stdout.match(/(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);
    const totalW = m ? parseInt(m[3], 10) : 0;
    let uwW = 0;
    const prof = await new Promise((res) => execFile('system_profiler', ['SPDisplaysDataType'], (e, out) => res(out || '')));
    const u = prof.match(/(\d+) x (\d+) \(UW/);
    if (u) uwW = parseInt(u[1], 10);
    const originX = totalW - uwW; // assume the ultrawide is the rightmost display
    return { totalW, uwW, originX };
  } catch (e) {
    return { totalW: 0, uwW: 0, originX: 0 };
  }
}

/** Wait for the user to press Enter in the terminal (e.g. after switching Space). */
function pressEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

/** Switch to the target macOS Space (Control+N) — Space must already exist.
 *  Activates Finder first so the frontmost app (e.g. VS Code) can't swallow the
 *  Mission Control shortcut. */
async function switchToDesktop(n) {
  const code = DESKTOP_KEY_CODES[String(n)];
  if (!code) return;
  await runApple('tell application "Finder" to activate');
  await new Promise((r) => setTimeout(r, 400));
  await runApple(`tell application "System Events" to key code ${code} using control down`);
  await new Promise((r) => setTimeout(r, 2000));
  log(`Switched to Desktop ${n} (Control+${n})`);
}

/** Position the 5 windows on the current Space by page title:
 *  F1 F2 V1 V2 across the ultrawide (393px apart) + CONTROL window on the right.
 *  Position-only: Playwright already sized each window to fit its viewport. */
async function layoutWindows() {
  const { winW, y, gap, startX, processName } = LAYOUT;
  const x0 = startX;
  const x1 = x0 + winW + gap;
  const x2 = x1 + winW + gap;
  const x3 = x2 + winW + gap;
  const xCtrl = x3 + winW + gap;
  const script = `
tell application "System Events"
  tell process "${processName}"
    repeat with w in windows
      try
        set n to name of w
        if n contains "SICC-F1" then
          set position of w to {${x0}, ${y}}
        else if n contains "SICC-F2" then
          set position of w to {${x1}, ${y}}
        else if n contains "SICC-V1" then
          set position of w to {${x2}, ${y}}
        else if n contains "SICC-V2" then
          set position of w to {${x3}, ${y}}
        else if n contains "SICC-CONTROLS" then
          set position of w to {${xCtrl}, ${y}}
        end if
      end try
    end repeat
  end tell
end tell`;
  const r = await runApple(script);
  if (r.err) log('layoutWindows warning: ' + r.err.message);
  log(`Windows positioned on Desktop ${LAYOUT.desktop}: F1 F2 V1 V2 @ ${x0}.., controls @ x=${xCtrl}`);
}

// ---------------------------------------------------------------------------
// Panel rendering
// ---------------------------------------------------------------------------
const logLines = [];
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logLines.push(line);
  if (logLines.length > 40) logLines.shift();
  console.log(line);
  if (state.pages.controls) {
    state.pages.controls.evaluate(({ lines, hole, flight, mode }) => {
      const holeEl = document.getElementById('srHole');
      const modeEl = document.getElementById('srMode');
      const logEl = document.getElementById('srLog');
      if (holeEl) holeEl.textContent = hole > 18 ? 'DONE' : 'F' + flight + ' H' + hole;
      if (modeEl) modeEl.textContent = 'Mode: ' + mode;
      if (logEl) logEl.textContent = lines.join('\n');
    }, { lines: logLines.slice(), hole: state.hole, flight: state.flightTurn, mode: MODE_NAMES[state.mode] }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Scoring + steps
// ---------------------------------------------------------------------------
function flightPlayers(flight) {
  return SCENARIO_PLAYERS.filter((p) => p.flight === flight).map((p) => p.name);
}

function holeIsBogey(hole) {
  if (state.mode === 'B') return true;
  if (state.mode === 'A') return hole % 2 === 0; // odd=par, even=bogey
  return false; // P=par, M=manual (no auto edit)
}

async function scoreFlight(page, flight, hole) {
  if (SCENARIO === 'real') {
    // Enter the real player scores for this hole (delta from the hole's par)
    const par = SICC_BUKIT.par[hole - 1];
    for (const name of flightPlayers(flight)) {
      const target = REAL_SCORES[name][hole - 1];
      const delta = target - par;
      if (delta !== 0) await setPlayerScoreOnScorer(page, { playerName: name, delta });
    }
    return;
  }
  if (!holeIsBogey(hole)) return; // par / manual → default scores already par
  for (const name of flightPlayers(flight)) {
    await setPlayerScoreOnScorer(page, { playerName: name, delta: 1 }); // par→bogey
  }
}

async function saveFlight(page, flight, hole) {
  const charIndex = (hole - 1) * 9;
  await scoreFlight(page, flight, hole);
  await saveCurrentHole(page, { flight, charIndex });
  log(`  F${flight} saved H${hole}`);
}

async function verifyStep(hole) {
  const charIndex = (hole - 1) * 9;

  // Realtime propagation (no reload)
  await expectFlightDataSaved(state.pages.v1, { flight: 1, charIndex });
  await expectFlightDataSaved(state.pages.v1, { flight: 2, charIndex });
  await expectFlightDataSaved(state.pages.v2, { flight: 1, charIndex });
  await expectFlightDataSaved(state.pages.v2, { flight: 2, charIndex });

  // Invariants
  const inv = await readInvariants(state.pages.f1, { hole });
  const ok = inv.trSum === 19 && inv.matches === 16;
  log(`  verify H${hole}: TR=${inv.trSum}/19 ${inv.trSum === 19 ? '✅' : '❌'}, match=${inv.matches}/16 ${inv.matches === 16 ? '✅' : '❌'}`);
  if (!ok) throw new Error('Invariant FAILED at hole ' + hole + ': ' + JSON.stringify(inv));

  // Firestore persistence
  const doc = await fetchGame(state.gameId);
  const h1 = (doc.savedHoles['1'] || []).includes(hole);
  const h2 = (doc.savedHoles['2'] || []).includes(hole);
  log(`  firestore: F1=${h1 ? '✅' : '❌'} F2=${h2 ? '✅' : '❌'} H${hole} persisted`);
  if (!h1 || !h2) throw new Error('Firestore persistence FAILED at hole ' + hole);
}

async function doNextStep() {
  if (state.hole > 18) {
    log('All 18 holes saved on both flights. Next phase: Sign Card (T-series) + History (A-series).');
    return;
  }
  const flight = state.flightTurn; // 1 or 2, alternating each click
  const hole = state.hole;
  const ci = (hole - 1) * 9;
  const page = flight === 1 ? state.pages.f1 : state.pages.f2;
  log(`--- STEP: F${flight} H${hole} (mode ${MODE_NAMES[state.mode]}) ---`);

  // Acting flight saves the current hole…
  await saveFlight(page, flight, hole);

  // …then wait for it to propagate to the OTHER flight + both viewers (avoids a
  // stale-cache overwrite — the race that clobbered H1 earlier).
  const other = flight === 1 ? state.pages.f2 : state.pages.f1;
  await expectFlightDataSaved(other, { flight, charIndex: ci, timeout: 15000 });
  await expectFlightDataSaved(state.pages.v1, { flight, charIndex: ci, timeout: 15000 });
  await expectFlightDataSaved(state.pages.v2, { flight, charIndex: ci, timeout: 15000 });

  // A hole is only complete once BOTH flights have saved it (F2's turn).
  if (flight === 2) {
    await verifyStep(hole);
  } else {
    log(`  F1 H${hole} saved + propagated (full verify after F2 saves it).`);
  }

  // Advance ONLY this flight to the next hole
  await nextHole(page);
  log(`  F${flight} advanced to H${hole + 1}`);

  // Alternate turns; the hole counter advances after every F2 save
  if (flight === 1) {
    state.flightTurn = 2;
  } else {
    state.flightTurn = 1;
    state.hole += 1;
  }
  log(`  → next: F${state.flightTurn} H${state.hole}`);
}

async function goAuto() {
  log('GO AUTO — stepping F1/F2 through all 18 holes…');
  let steps = 0;
  while (state.hole <= 18 && state.running && steps < 40) {
    await doNextStep();
    steps += 1;
    await new Promise((r) => setTimeout(r, 300));
  }
  log('GO AUTO complete. Ready at Sign Card.');
}

async function rejoinF2(kind) {
  const hole = Math.max(1, state.hole - 1);
  const charIndex = (hole - 1) * 9;
  await state.pages.f2.close();
  if (kind === 'N') {
    state.rejoinCount += 1;
    state.contexts.f2 = await newDeviceContext(state.browser, state.gameId, 90 + state.rejoinCount, { width: DEVICE_W, height: DEVICE_H });
    log('Rejoin(N): F2 relaunched as a NEW device…');
  } else {
    state.contexts.f2 = await newDeviceContext(state.browser, state.gameId, 1, { width: DEVICE_W, height: DEVICE_H });
    log('Rejoin(K): F2 relaunched with SAME identity…');
  }
  state.pages.f2 = await openScorer(state.contexts.f2, { role: 'update2', gameId: state.gameId });
  // Verify re-sync to current state (latest saved hole on both flights)
  if (state.hole > 1) {
    await expectFlightDataSaved(state.pages.f2, { flight: 1, charIndex, timeout: 20000 });
    await expectFlightDataSaved(state.pages.f2, { flight: 2, charIndex, timeout: 20000 });
    log(`Rejoin(${kind}): F2 re-synced to H${hole} (both flights) ✅`);
  } else {
    log(`Rejoin(${kind}): F2 in-game (no holes saved yet)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  state.gameId = SCENARIO === 'real'
    ? await createRealBukitGame({ testRunId: 'step-' + Date.now() })
    : await createTestGame({ testRunId: 'step-' + Date.now() });
  console.log('Step Runner — test game:', state.gameId, '| scenario:', SCENARIO, SCENARIO === 'real' ? '(' + SICC_BUKIT.name + ', real scores)' : '');

  // Option 3: no system shortcut changes. The user is on the target Space
  // (windows are laid out on the CURRENT Space). Pause until they confirm.
  console.log(`Target Space: Desktop ${LAYOUT.desktop} (windows will open + be arranged on the current Space).`);
  await pressEnter(`Switch to Desktop ${LAYOUT.desktop} now, then press Enter to open the 4 browser windows → `);

  // Auto-detect the ultrawide origin (unless overridden by env). The viewport is
  // fixed at iPhone 14 Pro 393×852, so the window width is 393 (letterboxing is
  // caused by windows wider than the viewport — avoid it). A boundary pad keeps
  // the first window off the exact display edge (macOS snaps it 40px left there).
  const d = await detectLayout();
  const pad = parseInt(process.env.SR_XPAD || '40', 10);
  if (!process.env.SR_X0 && d.originX > 0) LAYOUT.startX = d.originX + pad;
  if (!process.env.SR_WIN_W && d.uwW > 0) LAYOUT.winW = DEVICE_W;
  log(`Layout: ultrawide x=${d.originX} width=${d.uwW} → ${LAYOUT.winW}px/window, starting x=${LAYOUT.startX} (+${pad}px pad)`);

  state.browser = await chromium.launch({ headless: false });

  const DEVICE_VIEWPORT = { width: DEVICE_W, height: DEVICE_H }; // iPhone 14 Pro
  state.contexts.f1 = await newDeviceContext(state.browser, state.gameId, 0, DEVICE_VIEWPORT);
  state.contexts.f2 = await newDeviceContext(state.browser, state.gameId, 1, DEVICE_VIEWPORT);
  state.contexts.v1 = await newDeviceContext(state.browser, state.gameId, 2, DEVICE_VIEWPORT);
  state.contexts.v2 = await newDeviceContext(state.browser, state.gameId, 3, DEVICE_VIEWPORT);

  log('Teeing off F1, F2, V1, V2…');
  [state.pages.f1, state.pages.f2, state.pages.v1, state.pages.v2] = await Promise.all([
    openScorer(state.contexts.f1, { role: 'update1', gameId: state.gameId }),
    openScorer(state.contexts.f2, { role: 'update2', gameId: state.gameId }),
    openViewer(state.contexts.v1, { gameId: state.gameId }),
    openViewer(state.contexts.v2, { gameId: state.gameId })
  ]);

  // Tag each window with a stable title so layoutWindows can identify them
  await state.pages.f1.evaluate(() => { document.title = 'SICC-F1'; });
  await state.pages.f2.evaluate(() => { document.title = 'SICC-F2'; });
  await state.pages.v1.evaluate(() => { document.title = 'SICC-V1'; });
  await state.pages.v2.evaluate(() => { document.title = 'SICC-V2'; });

  // Dedicated control window (replaces the old F1 overlay panel)
  const ctrl = await openControlsWindow(state.browser);
  state.contexts.controls = ctrl.ctx;
  state.pages.controls = ctrl.page;
  log('Control window opened (panel + log live).');

  // Arrange the 5 windows on the target Space
  await new Promise((r) => setTimeout(r, 1000));
  await layoutWindows();

  log('Step Runner ready. Controls are in the dedicated window (right side).');
  log(`Score mode ${MODE_NAMES[state.mode]}. Press NEXT STEP or GO AUTO.`);

  while (state.running) {
    const action = await waitForAction();
    try {
      if (action.type === 'mode') {
        state.mode = action.mode;
        log('Score mode → ' + MODE_NAMES[state.mode]);
      } else if (action.type === 'next') {
        await doNextStep();
      } else if (action.type === 'goauto') {
        await goAuto();
      } else if (action.type === 'rejoinK') {
        await rejoinF2('K');
      } else if (action.type === 'rejoinN') {
        await rejoinF2('N');
      } else if (action.type === 'quit') {
        state.running = false;
        log('Quitting…');
      }
    } catch (e) {
      log('❌ ERROR: ' + e.message);
      log('(continue with NEXT STEP / GO AUTO, or QUIT)');
    }
  }
}

main()
  .catch((e) => { console.error('Step Runner crashed:', e); })
  .finally(async () => {
    if (state.browser) await state.browser.close().catch(() => {});
    if (state.gameId) {
      await deleteTestGame(state.gameId);
      console.log('Step Runner — deleted test game', state.gameId);
    }
    process.exit(0);
  });
