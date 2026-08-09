/**
 * Test-game factory — mirrors setup-game.html `createNewGame()` exactly so the
 * record is indistinguishable from a real setup (only extra fields: testGame,
 * testRunId for cleanup auditing).
 *
 * Data model (v5):
 *  - f1.d / f2.d : 162-char flight strings (18 holes × 9 chars:
 *    'T'/'F' saved flag + 4×2-digit player scores)
 *  - results: initialized empty results (objects, not nested arrays)
 *  - signatures: nested { f1: {...}, f2: {...} }
 */

const { createDocument, getDocument, deleteDocument } = require('./firestore');

const COLLECTION = 'scheduledGames';

function generateGameId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return 'GM_' + yy + mm + dd + '_' + hh + min + '_' + random;
}

// All-par 18-hole course keeps arithmetic trivial (par 4 everywhere).
const COURSE = {
  name: 'AUTOTEST COURSE',
  par: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  si: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
};

// 8 players: 2 flights × (2×Team A + 2×Team B). Handicaps strictly ordered so
// team rows sort deterministically (team A low→high, then team B low→high).
const PLAYERS = [
  { name: 'AutoA1', label: 'A1', team: 'A', flight: 1, handicap: 24 },
  { name: 'AutoA2', label: 'A2', team: 'A', flight: 1, handicap: 18 },
  { name: 'AutoB1', label: 'B1', team: 'B', flight: 1, handicap: 10 },
  { name: 'AutoB2', label: 'B2', team: 'B', flight: 1, handicap: 15 },
  { name: 'AutoC1', label: 'C1', team: 'A', flight: 2, handicap: 20 },
  { name: 'AutoC2', label: 'C2', team: 'A', flight: 2, handicap: 16 },
  { name: 'AutoD1', label: 'D1', team: 'B', flight: 2, handicap: 8 },
  { name: 'AutoD2', label: 'D2', team: 'B', flight: 2, handicap: 12 }
];

const ANCHOR = 'AutoD1'; // lowest handicap player (setup default anchor)

// SICC Bukit — real course (par 71), read from the Firestore `courses` collection
// (id iTph634Zg0h768bJleyO). Used for realistic real-game scenarios.
const SICC_BUKIT = {
  name: 'SICC Bukit Course',
  par: [4, 3, 4, 5, 3, 4, 4, 4, 4, 4, 4, 3, 5, 3, 5, 4, 3, 5],
  si: [13, 15, 7, 3, 17, 1, 5, 11, 9, 14, 2, 8, 6, 16, 10, 4, 18, 12]
};

// Real players from the SICC Bukit game screenshot (Anchor B5 dropped — it was a
// duplicate of JG). 2 flights × (2×Team A + 2×Team B), real handicaps.
const REAL_BUKIT_PLAYERS = [
  { name: 'ACH', label: 'A1', team: 'A', flight: 1, handicap: 2 },
  { name: 'CK', label: 'A2', team: 'A', flight: 1, handicap: 10 },
  { name: 'OCB', label: 'B1', team: 'B', flight: 1, handicap: 1 },
  { name: 'JO', label: 'B2', team: 'B', flight: 1, handicap: 10 },
  { name: 'KF', label: 'A3', team: 'A', flight: 2, handicap: 2 },
  { name: 'YHM', label: 'A4', team: 'A', flight: 2, handicap: 14 },
  { name: 'Piti', label: 'B3', team: 'B', flight: 2, handicap: 10 },
  { name: 'JG', label: 'B4', team: 'B', flight: 2, handicap: 0 }
];

function defaultDataString() {
  // 18 holes × ('F' + 4×2-digit par=04) = 162 chars, all unsaved
  return Array(18).fill('F04040404').join('');
}

// Rotate the initial (all-par) string for a shotgun start. Data strings are in
// PLAY ORDER (position 0 = natural startingHole … position 17 = startingHole−1),
// each 9-char block = 'F' + 4×2-digit PAR for that natural hole. All-par AUTOTEST
// (start 1) is unaffected.
function rotatedDataString(par, startingHole) {
  const order = [];
  for (let i = startingHole; i <= 18; i++) order.push(i);
  for (let i = 1; i < startingHole; i++) order.push(i);
  return order.map((h) => {
    const s = String(par[h - 1]).padStart(2, '0');
    return 'F' + s + s + s + s;
  }).join('');
}

function emptyResults() {
  return {
    version: 1,
    f1IntraMatches: {},
    f2IntraMatches: {},
    matchResults: {},
    clinchedAt: {},
    game1: { matches: {}, pointsA: Array(18).fill(8), pointsB: Array(18).fill(8) },
    game2: {
      flight1: { leader: Array(18).fill('AS'), cumulativePoints: Array(18).fill(0) },
      flight2: { leader: Array(18).fill('AS'), cumulativePoints: Array(18).fill(0) },
      pointsA: Array(18).fill(1),
      pointsB: Array(18).fill(1),
      displayT1: Array(18).fill('AS'),
      displayT2: Array(18).fill('AS')
    },
    game3: {
      leader: Array(18).fill('AS'),
      nettA: Array(18).fill(0),
      nettB: Array(18).fill(0),
      pointsA: Array(18).fill(0.5),
      pointsB: Array(18).fill(0.5),
      displayStrk: Array(18).fill('AS')
    },
    tr: {
      teamA: Array(18).fill(0),
      teamB: Array(18).fill(0),
      teamAGreen: Array(18).fill(false),
      teamBGreen: Array(18).fill(false)
    },
    computedUpToHole: 0,
    lastComputedAt: null
  };
}

function buildGameData({ testRunId, course = COURSE, players = PLAYERS, startingHole = 1 }) {
  const ds = rotatedDataString(course.par, startingHole);
  const anchor = players.reduce((a, b) => (b.handicap < a.handicap ? b : a)).name;
  return {
    date: new Date().toISOString().split('T')[0],
    course: course,
    players: players.map((p) => ({ name: p.name, handicap: p.handicap, team: p.team, flight: p.flight, label: p.label })),
    status: 'scheduled',
    gameType: 'real',
    startingHole: startingHole,
    teamGameFormat: 'tournament',
    anchor: anchor,
    updatedAt: new Date().toISOString(),
    f1: { d: ds, se: false, x: false },
    f2: { d: ds, se: false, x: false },
    locks: { f1: null, f2: null },
    currentHoleF1: startingHole,
    currentHoleF2: startingHole,
    results: emptyResults(),
    createdAt: new Date().toISOString(),
    lastSyncedPosition: -1,
    savedHoles: { '1': [], '2': [] },
    gameStarted: false,
    signatures: {
      f1: { signed: false, signedAt: null, captainName: null },
      f2: { signed: false, signedAt: null, captainName: null }
    },
    testGame: true,
    testRunId: testRunId
  };
}

async function createTestGame({ testRunId }) {
  const gameId = generateGameId();
  await createDocument(COLLECTION, gameId, buildGameData({ testRunId }));
  return gameId;
}

async function createRealBukitGame({ testRunId, startingHole = 1 }) {
  const gameId = generateGameId();
  await createDocument(COLLECTION, gameId, buildGameData({ testRunId, course: SICC_BUKIT, players: REAL_BUKIT_PLAYERS, startingHole }));
  return gameId;
}

async function fetchGame(gameId) {
  return getDocument(COLLECTION, gameId);
}

async function deleteTestGame(gameId) {
  if (gameId) await deleteDocument(COLLECTION, gameId);
}

module.exports = {
  COLLECTION,
  COURSE,
  PLAYERS,
  ANCHOR,
  SICC_BUKIT,
  REAL_BUKIT_PLAYERS,
  generateGameId,
  buildGameData,
  createTestGame,
  createRealBukitGame,
  fetchGame,
  deleteTestGame
};
