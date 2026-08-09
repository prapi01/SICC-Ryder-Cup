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

function defaultDataString() {
  // 18 holes × ('F' + 4×2-digit par=04) = 162 chars, all unsaved
  return Array(18).fill('F04040404').join('');
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

function buildGameData({ testRunId }) {
  const ds = defaultDataString();
  return {
    date: new Date().toISOString().split('T')[0],
    course: COURSE,
    players: PLAYERS.map((p) => ({ name: p.name, handicap: p.handicap, team: p.team, flight: p.flight, label: p.label })),
    status: 'scheduled',
    gameType: 'real',
    startingHole: 1,
    teamGameFormat: 'tournament',
    anchor: ANCHOR,
    updatedAt: new Date().toISOString(),
    f1: { d: ds, se: false, x: false },
    f2: { d: ds, se: false, x: false },
    locks: { f1: null, f2: null },
    currentHoleF1: 1,
    currentHoleF2: 1,
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
  generateGameId,
  buildGameData,
  createTestGame,
  fetchGame,
  deleteTestGame
};
