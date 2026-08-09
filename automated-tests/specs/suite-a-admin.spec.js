/**
 * Suite A — Admin & Record Integrity (on-demand).
 * Phase 1 smoke: create a scheduled game via the same schema the app writes,
 * verify the starting point (N-series subset), then delete it.
 *
 * Run: npm run suite:a
 */

const { test, expect } = require('@playwright/test');
const { createTestGame, fetchGame, deleteTestGame } = require('../helpers/game');

test.describe('Suite A — N-series smoke (create → verify → cleanup)', () => {
  const runId = 'suiteA-' + Date.now();
  let gameId;

  test('creates a scheduled game that is a correct starting point', async () => {
    gameId = await createTestGame({ testRunId: runId });
    console.log(`[SUITE-A] created test game ${gameId}`);

    const doc = await fetchGame(gameId);
    expect(doc, 'game doc should exist').not.toBeNull();

    // --- N1–N5: setup fidelity ---
    expect(doc.status).toBe('scheduled');
    expect(doc.gameType).toBe('real');
    expect(doc.startingHole).toBe(1);
    expect(doc.course.name).toBeTruthy();
    expect(doc.course.par).toHaveLength(18);
    expect(doc.players).toHaveLength(8);
    expect(doc.players.filter((p) => p.team === 'A')).toHaveLength(4);
    expect(doc.players.filter((p) => p.team === 'B')).toHaveLength(4);
    expect(doc.players.filter((p) => p.flight === 1)).toHaveLength(4);
    expect(doc.players.filter((p) => p.flight === 2)).toHaveLength(4);

    // --- N6–N13: clean initial data state ---
    expect(doc.f1.d).toHaveLength(162);
    expect(doc.f1.d.charAt(0)).toBe('F'); // hole 1 unsaved
    expect(doc.f2.d).toHaveLength(162);
    expect(doc.f2.d.charAt(0)).toBe('F');
    expect(doc.savedHoles['1']).toEqual([]);
    expect(doc.savedHoles['2']).toEqual([]);
    expect(doc.gameStarted).toBe(false);
    expect(doc.currentHoleF1).toBe(1);
    expect(doc.currentHoleF2).toBe(1);
    expect(doc.signatures.f1.signed).toBe(false);
    expect(doc.signatures.f2.signed).toBe(false);

    // --- results initialized ---
    expect(doc.results.tr.teamA).toHaveLength(18);
    expect(doc.results.tr.teamB).toHaveLength(18);
    expect(doc.results.matchResults).toBeDefined();
    expect(Object.keys(doc.results.matchResults)).toHaveLength(0);
  });

  test.afterAll(async () => {
    if (gameId) {
      await deleteTestGame(gameId);
      console.log(`[SUITE-A] deleted test game ${gameId}`);
    }
  });
});
