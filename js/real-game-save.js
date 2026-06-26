/*
FILE: js/real-game-save.js
VERSION: 1.26
KEY CHANGES from v1.25:
   - CHANGED: wruBackground() now checks firestoreChanged flag on WRV completion
   - ADDED: If Firestore changed during WRV, trigger cache refresh after WRV completes
   - ADDED: Clear firestoreChanged flag after processing
   - This ensures cache refresh happens AFTER WRV completes, not during
   - PRESERVED: ALL v1.25 functions and API unchanged
   - PRESERVED: ALL existing functionality
DEPENDS ON: RealGameState, RealGameUtils, GameData, GameLoader, GameTeam, GameMatch, GameStroke, GameOrder, Firebase, WRV.js
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_SAVE_VERSION = "1.26";

var RealGameSave = (function() {
    
    console.log("[REAL-GAME-SAVE] Initializing v1.26 - Firestore changed flag check on WRV completion");
    
    // ============================================================
    // Helper: Get Firestore instance
    // ============================================================
    function getDb() {
        return firebase.firestore();
    }
    
    // ============================================================
    // Helper: WRV update with Promise wrapper (async/await compatible)
    // ============================================================
    function wru(collection, docId, data) {
        return new Promise(function(resolve, reject) {
            if (typeof WRV !== 'undefined' && WRV.update) {
                WRV.update(collection, docId, data, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            } else {
                // Fallback: direct update
                console.warn('[RealGameSave] WRV not available, using direct update');
                var db = getDb();
                db.collection(collection).doc(docId).update(data)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
    
    // ============================================================
    // Helper: WRV update - BACKGROUND (fire and forget)
    // Does NOT block the calling function
    // v1.23: Added optional callback parameter for cache refresh
    // v1.24: Added WRV flag to prevent cache refresh during WRV
    // v1.26: Added firestoreChanged flag check on WRV completion
    // ============================================================
    function wruBackground(collection, docId, data, logLabel, callback) {
        // v1.24: Set WRV flag to prevent real-time listener from refreshing cache
        RealGameState.setWRVInProgress(true);
        console.log('[RealGameSave] WRV flag set: true' + (logLabel ? ' (' + logLabel + ')' : ''));
        
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update(collection, docId, data, function(err, result) {
                // v1.24: Clear WRV flag when WRV completes
                RealGameState.setWRVInProgress(false);
                console.log('[RealGameSave] WRV flag set: false' + (logLabel ? ' (' + logLabel + ')' : ''));
                
                if (err) {
                    console.warn('[RealGameSave] BACKGROUND WRV failed' + (logLabel ? ' (' + logLabel + ')' : '') + ':', err);
                } else {
                    console.log('[RealGameSave] BACKGROUND WRV success' + (logLabel ? ' (' + logLabel + ')' : ''));
                    
                    // v1.26: Check if Firestore changed during WRV
                    if (RealGameState.isFirestoreChanged()) {
                        console.log('[RealGameSave] Firestore changed during WRV - refreshing cache');
                        RealGameState.setFirestoreChanged(false);
                        
                        var gameId = getGameId();
                        if (gameId && typeof GameLoader !== 'undefined') {
                            GameLoader.loadGame(gameId, "scheduledGames", function(loadResult) {
                                if (loadResult.success) {
                                    console.log('[RealGameSave] Cache refreshed after WRV completion');
                                    if (callback) callback(null, result);
                                } else {
                                    console.warn('[RealGameSave] Failed to refresh cache after WRV:', loadResult.error);
                                    if (callback) callback(err, result);
                                }
                            });
                        } else {
                            if (callback) callback(err, result);
                        }
                    } else {
                        if (callback) callback(err, result);
                    }
                }
            });
        } else {
            // Fallback: direct update in background
            console.warn('[RealGameSave] WRV not available, using direct background update');
            var db = getDb();
            db.collection(collection).doc(docId).update(data)
                .then(function() {
                    // v1.24: Clear WRV flag on success
                    RealGameState.setWRVInProgress(false);
                    console.log('[RealGameSave] WRV flag set: false' + (logLabel ? ' (' + logLabel + ')' : ''));
                    console.log('[RealGameSave] BACKGROUND direct update success' + (logLabel ? ' (' + logLabel + ')' : ''));
                    
                    // v1.26: Check if Firestore changed during WRV
                    if (RealGameState.isFirestoreChanged()) {
                        console.log('[RealGameSave] Firestore changed during direct update - refreshing cache');
                        RealGameState.setFirestoreChanged(false);
                        
                        var gameId = getGameId();
                        if (gameId && typeof GameLoader !== 'undefined') {
                            GameLoader.loadGame(gameId, "scheduledGames", function(loadResult) {
                                if (loadResult.success) {
                                    console.log('[RealGameSave] Cache refreshed after direct update');
                                    if (callback) callback(null, true);
                                } else {
                                    console.warn('[RealGameSave] Failed to refresh cache after direct update:', loadResult.error);
                                    if (callback) callback(null, true);
                                }
                            });
                        } else {
                            if (callback) callback(null, true);
                        }
                    } else {
                        if (callback) callback(null, true);
                    }
                })
                .catch(function(err) {
                    // v1.24: Clear WRV flag on failure
                    RealGameState.setWRVInProgress(false);
                    console.log('[RealGameSave] WRV flag set: false' + (logLabel ? ' (' + logLabel + ')' : ''));
                    console.warn('[RealGameSave] BACKGROUND direct update failed' + (logLabel ? ' (' + logLabel + ')' : '') + ':', err);
                    if (callback) callback(err, false);
                });
        }
    }
    
    // ============================================================
    // Private Helpers
    // ============================================================
    
    function getGameId() {
        return RealGameState.getGameId();
    }
    
    function getCurrentHole() {
        return RealGameState.getCurrentHole();
    }
    
    function getEditableFlight() {
        return RealGameState.getEditableFlight();
    }
    
    function getAllPlayers() {
        return RealGameState.getAllPlayers();
    }
    
    function getCoursePar() {
        return RealGameState.getCoursePar();
    }
    
    function getCourseSi() {
        return RealGameState.getCourseSi();
    }
    
    function getStartingHole() {
        return RealGameState.getStartingHole();
    }
    
    function getTeamGameFormat() {
        return RealGameState.getTeamGameFormat();
    }
    
    function isGameComplete() {
        return RealGameState.isGameComplete();
    }
    
    function isCelebrationTriggered() {
        return RealGameState.isCelebrationTriggered();
    }
    
    function isTakeoverDetected() {
        return RealGameState.isTakeoverDetected();
    }
    
    function isViewOtherFlight() {
        return RealGameState.isViewOtherFlight();
    }
    
    function isSaveInProgress() {
        return RealGameState.isSaveInProgress();
    }
    
    function getLocalChanges() {
        return RealGameState.getLocalChanges();
    }
    
    function getDebugTargetHole() {
        return RealGameState.getDebugTargetHole();
    }
    
    function incrementDebugCounter(counterName) {
        RealGameState.incrementDebugCounter(counterName);
    }
    
    function getDebugCallCounters() {
        return RealGameState.getDebugCallCounters();
    }
    
    // ============================================================
    // v1.04: Calculate lastSyncedPosition from saved holes
    // ============================================================
    function calculateLastSyncedPosition(cache) {
        if (!cache || !cache.savedHoles) return -1;
        
        var holes1 = cache.savedHoles[1] || [];
        var holes2 = cache.savedHoles[2] || [];
        var playOrder = RealGameUtils.getPlayOrder();
        var lastSyncedPosition = -1;
        
        for (var i = 0; i < playOrder.length; i++) {
            var hole = playOrder[i];
            if (holes1.indexOf(hole) !== -1 && holes2.indexOf(hole) !== -1) {
                lastSyncedPosition = i;
            } else {
                break;
            }
        }
        
        console.log("[SAVE-v1.20] calculateLastSyncedPosition: playOrder length=" + playOrder.length + ", result=" + lastSyncedPosition);
        return lastSyncedPosition;
    }
    
    // ============================================================
    // Save Button UI Functions
    // ============================================================
    
    function updateSaveButtonState() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (!saveBtn) return;
        
        var viewOtherFlight = RealGameState.isViewOtherFlight();
        var canEdit = RealGameState.getCanEdit();
        var takeoverDetected = RealGameState.isTakeoverDetected();
        var isGameCompleteFlag = RealGameState.isGameComplete();
        
        if (viewOtherFlight) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
            return;
        }
        
        if (!canEdit || takeoverDetected) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            return;
        }
        
        var editableFlight = RealGameState.getEditableFlight();
        var currentHole = RealGameState.getCurrentHole();
        
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        var isCurrentSaved = cache && cache.savedHoles && cache.savedHoles[editableFlight] ? 
            cache.savedHoles[editableFlight].indexOf(currentHole) !== -1 : false;
        
        var localChanges = RealGameState.getLocalChanges();
        var hasUnsavedChanges = false;
        for (var key in localChanges) {
            if (key.startsWith(editableFlight + "_" + currentHole + "_")) {
                hasUnsavedChanges = true;
                break;
            }
        }
        var shouldDisable = isCurrentSaved && !hasUnsavedChanges;
        saveBtn.disabled = shouldDisable;
        saveBtn.style.opacity = shouldDisable ? '0.5' : '1';
        saveBtn.style.cursor = shouldDisable ? 'not-allowed' : 'pointer';
    }
    
    function setSaveButtonIdle() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (!saveBtn) return;
        
        var currentHole = RealGameState.getCurrentHole();
        var viewOtherFlight = RealGameState.isViewOtherFlight();
        var canEdit = RealGameState.getCanEdit();
        var takeoverDetected = RealGameState.isTakeoverDetected();
        
        if (viewOtherFlight) {
            saveBtn.disabled = true;
            saveBtn.innerText = 'SAVE H' + currentHole;
            saveBtn.style.opacity = '0.5';
            return;
        }
        
        if (!canEdit || takeoverDetected) {
            saveBtn.disabled = true;
            saveBtn.innerText = 'SAVE H' + currentHole;
            saveBtn.style.opacity = '0.5';
            return;
        }
        
        saveBtn.innerText = 'SAVE H' + currentHole;
        saveBtn.style.background = '';
        saveBtn.style.borderColor = '';
        saveBtn.style.color = '';
        updateSaveButtonState();
        RealGameState.setSaveInProgress(false);
    }
    
    function setSaveButtonPending() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (saveBtn) {
            var canEdit = RealGameState.getCanEdit();
            var takeoverDetected = RealGameState.isTakeoverDetected();
            var viewOtherFlight = RealGameState.isViewOtherFlight();
            if (canEdit && !takeoverDetected && !viewOtherFlight) {
                saveBtn.innerText = 'SAVING...';
                saveBtn.disabled = true;
                saveBtn.style.background = '#2a2a2a';
                saveBtn.style.borderColor = '#444444';
                saveBtn.style.setProperty('color', '#ff6666', 'important');
            }
        }
        RealGameState.setSaveInProgress(true);
    }
    
    function setSaveButtonRetry() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (saveBtn) {
            var canEdit = RealGameState.getCanEdit();
            var takeoverDetected = RealGameState.isTakeoverDetected();
            var viewOtherFlight = RealGameState.isViewOtherFlight();
            if (canEdit && !takeoverDetected && !viewOtherFlight) {
                saveBtn.innerText = 'RETRY';
                saveBtn.disabled = false;
                saveBtn.style.background = '#2a2a2a';
                saveBtn.style.borderColor = '#ffaa44';
                saveBtn.style.color = '#ffaa44';
            }
        }
        RealGameState.setSaveInProgress(false);
    }
    
    function flashSaveButtonSuccess() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (saveBtn) {
            saveBtn.style.background = '#ff4444';
            saveBtn.style.color = '#ffffff';
            setTimeout(function() {
                if (saveBtn) {
                    saveBtn.style.background = '';
                    saveBtn.style.color = '';
                }
            }, 300);
        }
    }
    
    // ============================================================
    // writeSingleHoleToFirestore - v1.23: WRV with cache refresh
    // ============================================================
    
    async function writeSingleHoleToFirestore(holeNumber, resultsData, cache) {
        var gameId = RealGameState.getGameId();
        var position = resultsData.position;
        var isTarget = (holeNumber === getDebugTargetHole());
        
        if(isTarget) {
            incrementDebugCounter('write');
            console.log(`[DEBUG-WRITE] === WRITE #${getDebugCallCounters().write} for HOLE ${holeNumber} (TARGET) ===`);
            console.log(`[DEBUG-WRITE] Position: ${position}`);
            console.log(`[DEBUG-WRITE] f1IntraMatches: ${resultsData.f1IntraMatches ? Object.keys(resultsData.f1IntraMatches).length + ' entries' : 'null'}`);
            console.log(`[DEBUG-WRITE] f2IntraMatches: ${resultsData.f2IntraMatches ? Object.keys(resultsData.f2IntraMatches).length + ' entries' : 'null'}`);
            console.log(`[DEBUG-WRITE] matchResults: ${resultsData.matchResults ? resultsData.matchResults.length + ' values' : 'null'}`);
            console.log(`[DEBUG-WRITE] trA: ${resultsData.trA}, trB: ${resultsData.trB}`);
            if(resultsData.f2IntraMatches) {
                console.log(`[DEBUG-WRITE] f2IntraMatches sample:`, resultsData.f2IntraMatches);
            }
        }
        
        var updatePayload = {};
        
        if (resultsData.matchResults !== null) {
            updatePayload[`results.matchResults.${position}`] = resultsData.matchResults;
        }
        
        if (resultsData.f1IntraMatches !== null) {
            updatePayload[`results.f1IntraMatches.${position}`] = resultsData.f1IntraMatches;
        }
        
        if (resultsData.f2IntraMatches !== null) {
            updatePayload[`results.f2IntraMatches.${position}`] = resultsData.f2IntraMatches;
            if(isTarget) console.log(`[DEBUG-WRITE] Adding f2IntraMatches to payload at position ${position}`);
        } else {
            if(isTarget) console.warn(`[DEBUG-WRITE] f2IntraMatches is NULL - NOT adding to payload!`);
        }
        
        updatePayload["results.game1.pointsA"] = cache.results.game1.pointsA;
        updatePayload["results.game1.pointsB"] = cache.results.game1.pointsB;
        updatePayload["results.game2.pointsA"] = cache.results.game2.pointsA;
        updatePayload["results.game2.pointsB"] = cache.results.game2.pointsB;
        updatePayload["results.game2.flight1.leader"] = cache.results.game2.flight1.leader;
        updatePayload["results.game2.flight2.leader"] = cache.results.game2.flight2.leader;
        updatePayload["results.game2.displayT2"] = cache.results.game2.displayT2;
        updatePayload["results.game2.flight2.cumulativePoints"] = cache.results.game2.flight2.cumulativePoints;
        updatePayload["results.game3.leader"] = cache.results.game3.leader;
        updatePayload["results.game3.displayStrk"] = cache.results.game3.displayStrk;
        updatePayload["results.game3.pointsA"] = cache.results.game3.pointsA;
        updatePayload["results.game3.pointsB"] = cache.results.game3.pointsB;
        
        // v1.03: Ensure TR values are properly set before writing
        if (resultsData.trA !== undefined && resultsData.trA !== null) {
            cache.results.tr.teamA[position] = resultsData.trA;
        }
        if (resultsData.trB !== undefined && resultsData.trB !== null) {
            cache.results.tr.teamB[position] = resultsData.trB;
        }
        cache.results.tr.teamAGreen[position] = resultsData.trAGreen || false;
        cache.results.tr.teamBGreen[position] = resultsData.trBGreen || false;
        
        if(isTarget) {
            console.log(`[DEBUG-WRITE] TR values: teamA[${position}]=${cache.results.tr.teamA[position]}, teamB[${position}]=${cache.results.tr.teamB[position]}`);
        }
        
        updatePayload["results.tr.teamA"] = cache.results.tr.teamA;
        updatePayload["results.tr.teamB"] = cache.results.tr.teamB;
        updatePayload["results.tr.teamAGreen"] = cache.results.tr.teamAGreen;
        updatePayload["results.tr.teamBGreen"] = cache.results.tr.teamBGreen;
        
        var fullDisplayT1 = new Array(18).fill("AS");
        if (cache.results.game2.displayT1) {
            for (var i = 0; i < 18; i++) {
                if (cache.results.game2.displayT1[i] !== undefined && cache.results.game2.displayT1[i] !== null) {
                    fullDisplayT1[i] = cache.results.game2.displayT1[i];
                }
            }
        }
        updatePayload["results.game2.displayT1"] = fullDisplayT1;
        
        var fullFlight1Leader = new Array(18).fill("AS");
        if (cache.results.game2.flight1.leader) {
            for (var i = 0; i < 18; i++) {
                if (cache.results.game2.flight1.leader[i] !== undefined && cache.results.game2.flight1.leader[i] !== null) {
                    fullFlight1Leader[i] = cache.results.game2.flight1.leader[i];
                }
            }
        }
        updatePayload["results.game2.flight1.leader"] = fullFlight1Leader;
        
        var fullFlight1Cumulative = new Array(18).fill(0);
        if (cache.results.game2.flight1.cumulativePoints) {
            for (var i = 0; i < 18; i++) {
                if (cache.results.game2.flight1.cumulativePoints[i] !== undefined && cache.results.game2.flight1.cumulativePoints[i] !== null) {
                    fullFlight1Cumulative[i] = cache.results.game2.flight1.cumulativePoints[i];
                }
            }
        }
        updatePayload["results.game2.flight1.cumulativePoints"] = fullFlight1Cumulative;
        
        if (resultsData.flight1ClinchedHole !== undefined && resultsData.flight1ClinchedHole !== null) {
            updatePayload["results.game2.flight1.clinchedHole"] = resultsData.flight1ClinchedHole;
        }
        if (resultsData.flight2ClinchedHole !== undefined && resultsData.flight2ClinchedHole !== null) {
            updatePayload["results.game2.flight2.clinchedHole"] = resultsData.flight2ClinchedHole;
        }
        
        if (resultsData.clinchedAtUpdates && Object.keys(resultsData.clinchedAtUpdates).length > 0) {
            updatePayload["results.clinchedAt"] = resultsData.updatedClinched;
        } else {
            updatePayload["results.clinchedAt"] = resultsData.updatedClinched;
        }
        
        var now = new Date().toISOString();
        updatePayload["results.lastComputedAt"] = now;
        updatePayload["results.playerTotals"] = cache.results.playerTotals;
        
        // v1.04: ADD savedHoles to payload
        if (cache.savedHoles) {
            updatePayload["savedHoles"] = cache.savedHoles;
            if(isTarget) console.log(`[DEBUG-WRITE] Added savedHoles to payload: f1=${cache.savedHoles[1]?.length || 0}, f2=${cache.savedHoles[2]?.length || 0}`);
        }
        
        // v1.04: ADD lastSyncedPosition to payload
        var lastSyncedPos = calculateLastSyncedPosition(cache);
        updatePayload["lastSyncedPosition"] = lastSyncedPos;
        if(isTarget) console.log(`[DEBUG-WRITE] Added lastSyncedPosition=${lastSyncedPos} to payload`);
        
        if(isTarget) {
            console.log(`[DEBUG-WRITE] Payload keys being sent to Firestore:`, Object.keys(updatePayload));
            console.log(`[DEBUG-WRITE] TR in payload: teamA[${position}]=${updatePayload["results.tr.teamA"][position]}, teamB[${position}]=${updatePayload["results.tr.teamB"][position]}`);
        }
        
        // ============================================================
        // v1.23: WRITE IN BACKGROUND with callback - refresh cache on success
        // ============================================================
        wruBackground("scheduledGames", gameId, updatePayload, "singleHole_" + holeNumber, function(err, result) {
            if (!err) {
                console.log(`[CASCADE-DEBUG] WRV verification passed for hole ${holeNumber} (cascade write verified)`);
                // Cache refresh will be triggered by WRV completion if needed
                // This ensures data is verified
            } else {
                console.warn(`[CASCADE-DEBUG] WRV verification failed for hole ${holeNumber}:`, err);
            }
        });
        if(isTarget) console.log(`[DEBUG-WRITE] INITIATED - Firestore update in background for hole ${holeNumber}`);
        console.log(`[CASCADE-DEBUG] Results save initiated for hole ${holeNumber} (background)`);
        
        return true;
    }
    
    // ============================================================
    // writeNewHoleData - v1.23: WRV with cache refresh
    // ============================================================
    
    async function writeNewHoleData(position, holeNumber, cache, renderAllCallback) {
        var gameId = RealGameState.getGameId();
        var allPlayers = RealGameState.getAllPlayers();
        var courseSi = RealGameState.getCourseSi();
        var startingHole = RealGameState.getStartingHole();
        var teamGameFormat = RealGameState.getTeamGameFormat();
        var coursePar = RealGameState.getCoursePar();
        var isTarget = (holeNumber === getDebugTargetHole());
        
        console.log(`[DEBUG-FLOW] =========================================`);
        console.log(`[DEBUG-FLOW] writeNewHoleData START: hole=${holeNumber}, position=${position}`);
        console.log(`[DEBUG-FLOW] =========================================`);
        
        if (isTarget) {
            console.log(`[DEBUG-FLOW] *** TARGET HOLE ${holeNumber} (position ${position}) ***`);
        }
        
        // Ensure results structure is complete
        console.log(`[DEBUG-FLOW] --- Ensuring results structure is complete ---`);
        RealGameUtils.ensureResultsStructure(cache);
        
        // Get flight data
        var f1Hole = cache.flight1Data ? cache.flight1Data[holeNumber] : null;
        var f2Hole = cache.flight2Data ? cache.flight2Data[holeNumber] : null;
        var f1Available = (f1Hole && f1Hole.saved);
        var f2Available = (f2Hole && f2Hole.saved);
        var crossAvailable = f1Available && f2Available;
        
        console.log(`[DEBUG-FLOW] f1Available=${f1Available}, f2Available=${f2Available}, crossAvailable=${crossAvailable}`);
        
        // Build remainingHolesByPosition array
        var remainingHolesByPosition = new Array(18);
        for (var pos = 0; pos < 18; pos++) {
            var holeForPos = RealGameUtils.getHoleAtPosition(pos);
            remainingHolesByPosition[pos] = RealGameUtils.getRemainingHolesFromPlayOrder(holeForPos);
        }
        
        // Calculate team game results (T-1, T-2) for all positions
        var teamGameResults = typeof GameTeam !== 'undefined' ? GameTeam.calculateWithClinched(
            allPlayers, cache.f1DataString, cache.f2DataString, 
            courseSi, startingHole, teamGameFormat, remainingHolesByPosition
        ) : null;
        
        var existingClinched = cache.results.clinchedAt || {};
        var deviceId = typeof SessionManager !== 'undefined' ? SessionManager.getDeviceIdDisplay() : "unknown";
        var cascadeVersion = window.REAL_GAME_VERSION || "6.12";
        var holesPlayed = position + 1;
        var remainingHoles = RealGameUtils.getRemainingHolesFromPlayOrder(holeNumber);
        
        var clinchedAtUpdates = {};
        
        // ============================================================
        // FLIGHT 1 INTRA-FLIGHT MATCHES
        // ============================================================
        var f1IntraMatchesForHole = null;
        if (f1Available && typeof GameMatch !== 'undefined') {
            console.log(`[DEBUG-FLOW] --- F1 INTRA: Calculating for flight 1, hole ${holeNumber}, holesPlayed=${holesPlayed}`);
            var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
            var intra1Result = GameMatch.calculateIntraFlightWithClinch(
                1, flight1Players, cache.f1DataString, courseSi, startingHole, holesPlayed, coursePar,
                remainingHoles, holeNumber, deviceId, cascadeVersion, existingClinched
            );
            f1IntraMatchesForHole = intra1Result.intraMatches;
            for (var matchKey in intra1Result.clinchedAtUpdates) {
                clinchedAtUpdates[matchKey] = intra1Result.clinchedAtUpdates[matchKey];
            }
            var matchCount = Object.keys(f1IntraMatchesForHole || {}).length;
            console.log(`[DEBUG-FLOW] --- F1 INTRA RESULT: ${matchCount} matches, ${Object.keys(intra1Result.clinchedAtUpdates).length} clinch updates`);
            if (isTarget && f1IntraMatchesForHole) {
                console.log(`[DEBUG-FLOW] --- F1 INTRA DATA:`, f1IntraMatchesForHole);
            }
        } else {
            console.log(`[DEBUG-FLOW] --- F1 INTRA: SKIPPED (f1Available=false)`);
        }
        
        // ============================================================
        // FLIGHT 2 INTRA-FLIGHT MATCHES
        // ============================================================
        var f2IntraMatchesForHole = null;
        if (f2Available && typeof GameMatch !== 'undefined') {
            console.log(`[DEBUG-FLOW] --- F2 INTRA: Calculating for flight 2, hole ${holeNumber}, holesPlayed=${holesPlayed}`);
            var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
            var intra2Result = GameMatch.calculateIntraFlightWithClinch(
                2, flight2Players, cache.f2DataString, courseSi, startingHole, holesPlayed, coursePar,
                remainingHoles, holeNumber, deviceId, cascadeVersion, existingClinched
            );
            f2IntraMatchesForHole = intra2Result.intraMatches;
            for (var matchKey in intra2Result.clinchedAtUpdates) {
                clinchedAtUpdates[matchKey] = intra2Result.clinchedAtUpdates[matchKey];
            }
            var matchCount = Object.keys(f2IntraMatchesForHole || {}).length;
            console.log(`[DEBUG-FLOW] --- F2 INTRA RESULT: ${matchCount} matches, ${Object.keys(intra2Result.clinchedAtUpdates).length} clinch updates`);
            if (isTarget && f2IntraMatchesForHole) {
                console.log(`[DEBUG-FLOW] --- F2 INTRA DATA:`, f2IntraMatchesForHole);
            }
        } else {
            console.log(`[DEBUG-FLOW] --- F2 INTRA: SKIPPED (f2Available=false)`);
        }
        
        // ============================================================
        // CROSS-FLIGHT MATCH RESULTS
        // ============================================================
        var matchResultsArray = null;
        var game1PointsA = 0, game1PointsB = 0;
        
        if (crossAvailable && typeof GameMatch !== 'undefined') {
            console.log(`[DEBUG-FLOW] --- CROSS: Calculating cross-flight matches, holesToAccumulate=${holesPlayed}`);
            var crossResult = GameMatch.calculateCrossFlightWithClinch(
                cache.f1DataString, cache.f2DataString, allPlayers, courseSi, startingHole, 
                holesPlayed, coursePar,
                remainingHoles, holeNumber, deviceId, cascadeVersion, existingClinched
            );
            matchResultsArray = crossResult.matchResultsArray;
            for (var matchKey in crossResult.clinchedAtUpdates) {
                clinchedAtUpdates[matchKey] = crossResult.clinchedAtUpdates[matchKey];
            }
            console.log(`[DEBUG-FLOW] --- CROSS RESULT: ${matchResultsArray ? matchResultsArray.length : 0} values, ${Object.keys(crossResult.clinchedAtUpdates).length} clinch updates`);
            
            var matchResultsObj = crossResult.matchResultsObj;
            var matchCount = 0;
            for (var key in matchResultsObj) {
                if (key.indexOf("_vs_") !== -1 && matchCount < 16) {
                    var firstPlayerName = key.split("_vs_")[0];
                    var firstPlayer = allPlayers.find(function(p) { return p.name === firstPlayerName; });
                    if (firstPlayer && firstPlayer.team === "A") {
                        var value = matchResultsObj[key];
                        if (value > 0) game1PointsA += 1;
                        else if (value < 0) game1PointsB += 1;
                        else { game1PointsA += 0.5; game1PointsB += 0.5; }
                        matchCount++;
                    }
                }
            }
            console.log(`[DEBUG-FLOW] --- CROSS POINTS: game1PointsA=${game1PointsA}, game1PointsB=${game1PointsB}`);
        } else {
            console.log(`[DEBUG-FLOW] --- CROSS: SKIPPED (crossAvailable=false)`);
        }
        
        // ============================================================
        // STROKE GAME - v1.06: FIXED 0 value handling
        // ============================================================
        var strkLeader = "AS";
        var strkDisplay = "AS";
        if (crossAvailable && typeof GameStroke !== 'undefined') {
            var strokeResults = GameStroke.calculate(allPlayers, cache.f1DataString, cache.f2DataString, courseSi, startingHole, coursePar);
            strkLeader = strokeResults.leader[position] === "A" ? "A" : strokeResults.leader[position] === "B" ? "B" : "AS";
            strkDisplay = strokeResults.displayStrk?.[position] || "AS";
            
            // v1.05: Assign stroke values to cache BEFORE payload
            cache.results.game3.leader[position] = strkLeader;
            cache.results.game3.displayStrk[position] = strkDisplay;
            cache.results.game3.nettA[position] = strokeResults.nettA?.[position] || 0;
            cache.results.game3.nettB[position] = strokeResults.nettB?.[position] || 0;
            
            // v1.06: FIXED - Use !== undefined check to preserve 0 values
            // Previously: strokeResults.pointsA?.[position] || 0.5 would convert 0 to 0.5
            cache.results.game3.pointsA[position] = strokeResults.pointsA?.[position] !== undefined ? strokeResults.pointsA[position] : 0.5;
            cache.results.game3.pointsB[position] = strokeResults.pointsB?.[position] !== undefined ? strokeResults.pointsB[position] : 0.5;
            
            console.log(`[DEBUG-FLOW] --- STROKE: strkLeader=${strkLeader}, strkDisplay=${strkDisplay}, pointsA=${cache.results.game3.pointsA[position]}, pointsB=${cache.results.game3.pointsB[position]} (ASSIGNED TO CACHE)`);
        } else {
            console.log(`[DEBUG-FLOW] --- STROKE: SKIPPED (crossAvailable=false)`);
        }
        
        // ============================================================
        // TEAM GAME T-1, T-2 - v1.05: ASSIGN TO CACHE BEFORE PAYLOAD
        // ============================================================
        var cumulativeF1 = teamGameResults ? teamGameResults.flight1Cumulative[position] : 0;
        var cumulativeF2 = teamGameResults ? teamGameResults.flight2Cumulative[position] : 0;
        var t1Leader = teamGameResults ? teamGameResults.flight1Leaders[position] : "AS";
        var t2Leader = teamGameResults ? teamGameResults.flight2Leaders[position] : "AS";
        var t1Display = teamGameResults ? teamGameResults.displayT1[position] : "AS";
        var t2Display = teamGameResults ? teamGameResults.displayT2[position] : "AS";
        
        // v1.05: ASSIGN T-2 display to cache BEFORE payload
        if (teamGameResults) {
            cache.results.game2.displayT1[position] = t1Display;
            cache.results.game2.displayT2[position] = t2Display;
            cache.results.game2.flight1.leader[position] = t1Leader;
            cache.results.game2.flight2.leader[position] = t2Leader;
            cache.results.game2.flight1.cumulativePoints[position] = cumulativeF1;
            cache.results.game2.flight2.cumulativePoints[position] = cumulativeF2;
            cache.t1Row[position] = t1Display;
            cache.t2Row[position] = t2Display;
        }
        
        console.log(`[DEBUG-FLOW] --- TEAM GAME: T-1=${t1Display}, T-2=${t2Display} (ASSIGNED TO CACHE)`);
        
        // Points
        var flight1PointsA = (cumulativeF1 > 0) ? 1 : (cumulativeF1 < 0) ? 0 : 0.5;
        var flight1PointsB = (cumulativeF1 > 0) ? 0 : (cumulativeF1 < 0) ? 1 : 0.5;
        var flight2PointsA = (cumulativeF2 > 0) ? 1 : (cumulativeF2 < 0) ? 0 : 0.5;
        var flight2PointsB = (cumulativeF2 > 0) ? 0 : (cumulativeF2 < 0) ? 1 : 0.5;
        var game2PointsA = flight1PointsA + flight2PointsA;
        var game2PointsB = flight1PointsB + flight2PointsB;
        
        var game3PointsA = (strkLeader === "A") ? 1 : (strkLeader === "B") ? 0 : 0.5;
        var game3PointsB = (strkLeader === "A") ? 0 : (strkLeader === "B") ? 1 : 0.5;
        
        var trA, trB, trAGreen, trBGreen;
        if (crossAvailable) {
            trA = game1PointsA + game2PointsA + game3PointsA;
            trB = game1PointsB + game2PointsB + game3PointsB;
            trAGreen = (trA > trB);
            trBGreen = (trB > trA);
            console.log(`[DEBUG-FLOW] --- TR: ${trA} - ${trB}, trAGreen=${trAGreen}, trBGreen=${trBGreen}`);
        } else {
            trA = null;
            trB = null;
            trAGreen = false;
            trBGreen = false;
            console.log(`[DEBUG-FLOW] --- TR: null (crossAvailable=false)`);
        }
        
        // v1.03: ENSURE TR VALUES ARE ASSIGNED TO CACHE BEFORE PAYLOAD BUILD
        if (!cache.results.tr) {
            cache.results.tr = { 
                teamA: new Array(18).fill(null), 
                teamB: new Array(18).fill(null), 
                teamAGreen: new Array(18).fill(false), 
                teamBGreen: new Array(18).fill(false) 
            };
        }
        cache.results.tr.teamA[position] = trA;
        cache.results.tr.teamB[position] = trB;
        cache.results.tr.teamAGreen[position] = trAGreen;
        cache.results.tr.teamBGreen[position] = trBGreen;
        
        if (isTarget) {
            console.log(`[DEBUG-FLOW] --- TR assigned to cache: teamA[${position}]=${trA}, teamB[${position}]=${trB}`);
        }
        
        // ClinchedAt
        var isCascadeStartHole = false;
        var updatedClinched = typeof GameMatch !== 'undefined' ? GameMatch.updateClinchedAt(existingClinched, clinchedAtUpdates, holeNumber, isCascadeStartHole) : existingClinched;
        console.log(`[DEBUG-FLOW] --- CLINCHED: ${Object.keys(clinchedAtUpdates).length} new updates, total ${Object.keys(updatedClinched).length}`);
        
        // Calculate playerTotals before building payload
        console.log(`[DEBUG-FLOW] --- Calculating playerTotals...`);
        var highestBothSaved = RealGameUtils.getHighestBothSaved(cache);
        var playerTotals = RealGameUtils.calculatePlayerTotals(allPlayers, coursePar, highestBothSaved);
        cache.results.playerTotals = playerTotals;
        console.log(`[DEBUG-FLOW] --- playerTotals calculated: ${Object.keys(playerTotals).length} players`);
        
        // ============================================================
        // BUILD PAYLOAD AND WRITE TO FIRESTORE
        // ============================================================
        var updatePayload = {};
        
        if (f1IntraMatchesForHole !== null) {
            updatePayload[`results.f1IntraMatches.${position}`] = f1IntraMatchesForHole;
            console.log(`[DEBUG-FLOW] --- Adding f1IntraMatches at position ${position}`);
        }
        if (f2IntraMatchesForHole !== null) {
            updatePayload[`results.f2IntraMatches.${position}`] = f2IntraMatchesForHole;
            console.log(`[DEBUG-FLOW] --- Adding f2IntraMatches at position ${position}`);
        }
        if (matchResultsArray !== null) {
            updatePayload[`results.matchResults.${position}`] = matchResultsArray;
            console.log(`[DEBUG-FLOW] --- Adding matchResults at position ${position}`);
        }
        
        // Team game arrays - now using cache values (already assigned above)
        updatePayload["results.game1.pointsA"] = cache.results.game1.pointsA;
        updatePayload["results.game1.pointsB"] = cache.results.game1.pointsB;
        updatePayload["results.game2.pointsA"] = cache.results.game2.pointsA;
        updatePayload["results.game2.pointsB"] = cache.results.game2.pointsB;
        updatePayload["results.game2.flight1.leader"] = cache.results.game2.flight1.leader;
        updatePayload["results.game2.flight2.leader"] = cache.results.game2.flight2.leader;
        updatePayload["results.game2.displayT1"] = cache.results.game2.displayT1;
        updatePayload["results.game2.displayT2"] = cache.results.game2.displayT2;
        updatePayload["results.game2.flight1.cumulativePoints"] = cache.results.game2.flight1.cumulativePoints;
        updatePayload["results.game2.flight2.cumulativePoints"] = cache.results.game2.flight2.cumulativePoints;
        
        // Stroke game arrays - now using cache values (already assigned above)
        updatePayload["results.game3.leader"] = cache.results.game3.leader;
        updatePayload["results.game3.displayStrk"] = cache.results.game3.displayStrk;
        updatePayload["results.game3.pointsA"] = cache.results.game3.pointsA;
        updatePayload["results.game3.pointsB"] = cache.results.game3.pointsB;
        updatePayload["results.game3.nettA"] = cache.results.game3.nettA;
        updatePayload["results.game3.nettB"] = cache.results.game3.nettB;
        
        // TR arrays
        updatePayload["results.tr.teamA"] = cache.results.tr.teamA;
        updatePayload["results.tr.teamB"] = cache.results.tr.teamB;
        updatePayload["results.tr.teamAGreen"] = cache.results.tr.teamAGreen;
        updatePayload["results.tr.teamBGreen"] = cache.results.tr.teamBGreen;
        
        if (isTarget) {
            console.log(`[DEBUG-FLOW] --- TR payload: teamA[${position}]=${updatePayload["results.tr.teamA"][position]}, teamB[${position}]=${updatePayload["results.tr.teamB"][position]}`);
            console.log(`[DEBUG-FLOW] --- displayStrk payload: ${updatePayload["results.game3.displayStrk"][position]}`);
            console.log(`[DEBUG-FLOW] --- displayT2 payload: ${updatePayload["results.game2.displayT2"][position]}`);
            console.log(`[DEBUG-FLOW] --- game3.pointsA[${position}]: ${updatePayload["results.game3.pointsA"][position]}`);
            console.log(`[DEBUG-FLOW] --- game3.pointsB[${position}]: ${updatePayload["results.game3.pointsB"][position]}`);
        }
        
        if (Object.keys(clinchedAtUpdates).length > 0) {
            updatePayload["results.clinchedAt"] = updatedClinched;
        }
        
        if (teamGameResults && teamGameResults.flight1ClinchedHole !== null) {
            updatePayload["results.game2.flight1.clinchedHole"] = teamGameResults.flight1ClinchedHole;
        }
        if (teamGameResults && teamGameResults.flight2ClinchedHole !== null) {
            updatePayload["results.game2.flight2.clinchedHole"] = teamGameResults.flight2ClinchedHole;
        }
        
        updatePayload["results.lastComputedAt"] = new Date().toISOString();
        updatePayload["results.playerTotals"] = cache.results.playerTotals;
        
        // v1.04: ADD savedHoles to payload
        if (cache.savedHoles) {
            updatePayload["savedHoles"] = cache.savedHoles;
            console.log(`[DEBUG-FLOW] --- Adding savedHoles to payload: f1=${cache.savedHoles[1]?.length || 0}, f2=${cache.savedHoles[2]?.length || 0}`);
        }
        
        // v1.04: ADD lastSyncedPosition to payload
        var lastSyncedPos = calculateLastSyncedPosition(cache);
        updatePayload["lastSyncedPosition"] = lastSyncedPos;
        console.log(`[DEBUG-FLOW] --- Adding lastSyncedPosition=${lastSyncedPos} to payload`);
        
        updatePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        console.log(`[DEBUG-FLOW] --- PAYLOAD SUMMARY: ${Object.keys(updatePayload).length} fields`);
        console.log(`[DEBUG-FLOW] --- Has f1IntraMatches: ${!!updatePayload[`results.f1IntraMatches.${position}`]}`);
        console.log(`[DEBUG-FLOW] --- Has f2IntraMatches: ${!!updatePayload[`results.f2IntraMatches.${position}`]}`);
        console.log(`[DEBUG-FLOW] --- Has matchResults: ${!!updatePayload[`results.matchResults.${position}`]}`);
        console.log(`[DEBUG-FLOW] --- Has playerTotals: ${!!updatePayload["results.playerTotals"]}`);
        console.log(`[DEBUG-FLOW] --- Has TR teamA: ${!!updatePayload["results.tr.teamA"][position]}`);
        console.log(`[DEBUG-FLOW] --- Has TR teamB: ${!!updatePayload["results.tr.teamB"][position]}`);
        console.log(`[DEBUG-FLOW] --- Has savedHoles: ${!!updatePayload["savedHoles"]}`);
        console.log(`[DEBUG-FLOW] --- Has lastSyncedPosition: ${updatePayload["lastSyncedPosition"] !== undefined}`);
        console.log(`[DEBUG-FLOW] --- Has game3.displayStrk: ${!!updatePayload["results.game3.displayStrk"][position]}`);
        console.log(`[DEBUG-FLOW] --- Has game2.displayT2: ${!!updatePayload["results.game2.displayT2"][position]}`);
        console.log(`[DEBUG-FLOW] --- Has game3.pointsA: ${updatePayload["results.game3.pointsA"][position] !== undefined}`);
        console.log(`[DEBUG-FLOW] --- Has game3.pointsB: ${updatePayload["results.game3.pointsB"][position] !== undefined}`);
        console.log(`[DEBUG-FLOW] =========================================`);
        console.log(`[DEBUG-FLOW] writeNewHoleData COMPLETE for hole ${holeNumber}`);
        console.log(`[DEBUG-FLOW] =========================================`);
        
        // ============================================================
        // v1.23: WRITE IN BACKGROUND with callback - refresh cache on success
        // This writes T-1, T-2, and Strk together
        // ============================================================
        wruBackground("scheduledGames", gameId, updatePayload, "newHole_" + holeNumber, function(err, result) {
            if (!err) {
                console.log(`[DEBUG-FLOW] WRV verification passed for hole ${holeNumber} - T-1, T-2, Strk verified`);
                // Cache refresh will be triggered by WRV completion if needed
                // This ensures data is verified
            } else {
                console.warn(`[DEBUG-FLOW] WRV verification failed for hole ${holeNumber}:`, err);
            }
        });
        console.log(`[DEBUG-FLOW] Firestore write INITIATED in background for hole ${holeNumber}`);
        
        return true;
    }
    
    // ============================================================
    // v1.20: updateLocalCacheWithResults - FIXED game1 points
    // ============================================================
    
    function updateLocalCacheWithResults(resultsData) {
        var position = resultsData.position;
        var holeNumber = RealGameUtils.getHoleAtPosition(position);
        var isTarget = (holeNumber === getDebugTargetHole());
        
        console.log(`[DEBUG-CACHE] updateLocalCacheWithResults: hole=${holeNumber}, position=${position}`);
        
        if(isTarget) {
            RealGameState.incrementDebugCounter('update');
            console.log(`[DEBUG-CACHE] === UPDATE #${getDebugCallCounters().update} for HOLE ${holeNumber} (position ${position}) (TARGET) ===`);
            console.log(`[DEBUG-CACHE] Received f1IntraMatches: ${resultsData.f1IntraMatches ? Object.keys(resultsData.f1IntraMatches).length + ' entries' : 'null'}`);
            console.log(`[DEBUG-CACHE] Received f2IntraMatches: ${resultsData.f2IntraMatches ? Object.keys(resultsData.f2IntraMatches).length + ' entries' : 'null'}`);
            console.log(`[DEBUG-CACHE] Received matchResults: ${resultsData.matchResults ? resultsData.matchResults.length + ' values' : 'null'}`);
            console.log(`[DEBUG-CACHE] Received trA: ${resultsData.trA}, trB: ${resultsData.trB}`);
            console.log(`[DEBUG-CACHE] Received strkDisplay: ${resultsData.strkDisplay}`);
            console.log(`[DEBUG-CACHE] Received t2Display: ${resultsData.t2Display}`);
            if(resultsData.f2IntraMatches) {
                console.log(`[DEBUG-CACHE] f2IntraMatches content:`, resultsData.f2IntraMatches);
            }
        }
        
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) {
            console.warn("[DEBUG-CACHE] No cache available");
            return;
        }
        
        if (!cache.results) {
            cache.results = RealGameUtils.initializeEmptyResults();
        }
        
        if (resultsData.matchResults !== null) {
            if (!cache.results.matchResults) cache.results.matchResults = new Array(18);
            cache.results.matchResults[position] = resultsData.matchResults;
        }
        
        if (resultsData.f1IntraMatches !== null) {
            if (!cache.results.f1IntraMatches) cache.results.f1IntraMatches = new Array(18);
            cache.results.f1IntraMatches[position] = resultsData.f1IntraMatches;
        }
        
        if (resultsData.f2IntraMatches !== null) {
            if (!cache.results.f2IntraMatches) cache.results.f2IntraMatches = new Array(18);
            cache.results.f2IntraMatches[position] = resultsData.f2IntraMatches;
        }
        
        // ============================================================
        // v1.20: FIX - Update game1 points (Match Game) for cascade
        // This was the missing piece - game1 points were never updated
        // during cascade, causing TR values to remain static
        // ============================================================
        if (!cache.results.game1) {
            cache.results.game1 = { matches: {}, pointsA: new Array(18).fill(8), pointsB: new Array(18).fill(8) };
        }
        if (!cache.results.game1.pointsA) {
            cache.results.game1.pointsA = new Array(18).fill(8);
        }
        if (!cache.results.game1.pointsB) {
            cache.results.game1.pointsB = new Array(18).fill(8);
        }
        if (resultsData.game1PointsA !== undefined && resultsData.game1PointsA !== null) {
            cache.results.game1.pointsA[position] = resultsData.game1PointsA;
        }
        if (resultsData.game1PointsB !== undefined && resultsData.game1PointsB !== null) {
            cache.results.game1.pointsB[position] = resultsData.game1PointsB;
        }
        console.log(`[DEBUG-CACHE] game1.pointsA[${position}]=${cache.results.game1.pointsA[position]}, game1.pointsB[${position}]=${cache.results.game1.pointsB[position]}`);
        
        // Update game2 points
        if (!cache.results.game2.pointsA) cache.results.game2.pointsA = new Array(18).fill(1);
        cache.results.game2.pointsA[position] = resultsData.game2PointsA;
        
        if (!cache.results.game2.pointsB) cache.results.game2.pointsB = new Array(18).fill(1);
        cache.results.game2.pointsB[position] = resultsData.game2PointsB;
        
        // Update game2 flight data
        if (!cache.results.game2.flight1.leader) cache.results.game2.flight1.leader = new Array(18).fill("AS");
        cache.results.game2.flight1.leader[position] = resultsData.t1Leader;
        
        if (!cache.results.game2.flight2.leader) cache.results.game2.flight2.leader = new Array(18).fill("AS");
        cache.results.game2.flight2.leader[position] = resultsData.t2Leader;
        
        if (!cache.results.game2.displayT1) cache.results.game2.displayT1 = new Array(18).fill("AS");
        cache.results.game2.displayT1[position] = resultsData.t1Display;
        
        if (!cache.results.game2.displayT2) cache.results.game2.displayT2 = new Array(18).fill("AS");
        cache.results.game2.displayT2[position] = resultsData.t2Display;
        
        if (!cache.results.game2.flight1.cumulativePoints) cache.results.game2.flight1.cumulativePoints = new Array(18).fill(0);
        cache.results.game2.flight1.cumulativePoints[position] = resultsData.cumulativeF1 !== undefined ? resultsData.cumulativeF1 : 0;
        
        if (!cache.results.game2.flight2.cumulativePoints) cache.results.game2.flight2.cumulativePoints = new Array(18).fill(0);
        cache.results.game2.flight2.cumulativePoints[position] = resultsData.cumulativeF2 !== undefined ? resultsData.cumulativeF2 : 0;
        
        // Update game3 (Stroke) data
        if (!cache.results.game3.leader) cache.results.game3.leader = new Array(18).fill("AS");
        cache.results.game3.leader[position] = resultsData.strkLeader;
        
        if (!cache.results.game3.displayStrk) cache.results.game3.displayStrk = new Array(18).fill("AS");
        cache.results.game3.displayStrk[position] = resultsData.strkDisplay;
        
        if (!cache.results.game3.pointsA) cache.results.game3.pointsA = new Array(18).fill(0.5);
        cache.results.game3.pointsA[position] = resultsData.game3PointsA;
        
        if (!cache.results.game3.pointsB) cache.results.game3.pointsB = new Array(18).fill(0.5);
        cache.results.game3.pointsB[position] = resultsData.game3PointsB;
        
        // Update TR values
        if (!cache.results.tr) {
            cache.results.tr = { 
                teamA: new Array(18).fill(null), 
                teamB: new Array(18).fill(null), 
                teamAGreen: new Array(18).fill(false), 
                teamBGreen: new Array(18).fill(false) 
            };
        }
        cache.results.tr.teamA[position] = resultsData.trA;
        cache.results.tr.teamB[position] = resultsData.trB;
        cache.results.tr.teamAGreen[position] = resultsData.trAGreen || false;
        cache.results.tr.teamBGreen[position] = resultsData.trBGreen || false;
        
        // Update clinch data
        cache.results.game2.flight1.clinchedHole = resultsData.flight1ClinchedHole;
        cache.results.game2.flight2.clinchedHole = resultsData.flight2ClinchedHole;
        cache.results.clinchedAt = resultsData.updatedClinched;
        
        // Update display rows
        if (resultsData.t1Display !== undefined && resultsData.t1Display !== null) {
            cache.t1Row[position] = resultsData.t1Display;
        }
        if (resultsData.t2Display !== undefined && resultsData.t2Display !== null) {
            cache.t2Row[position] = resultsData.t2Display;
        }
        if (resultsData.strkDisplay !== undefined && resultsData.strkDisplay !== null) {
            cache.strkRow[position] = resultsData.strkDisplay;
        }
        
        // Recalculate player totals
        var allPlayers = RealGameState.getAllPlayers();
        var coursePar = RealGameState.getCoursePar();
        var highestBothSaved = RealGameUtils.getHighestBothSaved(cache);
        var playerTotals = RealGameUtils.calculatePlayerTotals(allPlayers, coursePar, highestBothSaved);
        cache.results.playerTotals = playerTotals;
        
        // Update lastSyncedPosition
        if (cache.savedHoles) {
            var newLastSyncedPos = calculateLastSyncedPosition(cache);
            cache.lastSyncedPosition = newLastSyncedPos;
            console.log(`[DEBUG-CACHE] Updated lastSyncedPosition=${newLastSyncedPos} in cache`);
        }
    }
    
    // ============================================================
    // performSave - v1.25: Removed pre-calculation cache refresh
    // ============================================================
    
    function performSave(saveHoleCallback, renderAllCallback) {
        return new Promise(function(resolve, reject) {
            var currentHole = RealGameState.getCurrentHole();
            var editableFlight = RealGameState.getEditableFlight();
            var canEdit = RealGameState.getCanEdit();
            var takeoverDetected = RealGameState.isTakeoverDetected();
            var viewOtherFlight = RealGameState.isViewOtherFlight();
            var gameId = RealGameState.getGameId();
            var allPlayers = RealGameState.getAllPlayers();
            var coursePar = RealGameState.getCoursePar();
            var courseSi = RealGameState.getCourseSi();
            var startingHole = RealGameState.getStartingHole();
            var teamGameFormat = RealGameState.getTeamGameFormat();
            
            RealGameState.incrementDebugCounter('save');
            console.log(`[DEBUG-SAVE] =========================================`);
            console.log(`[DEBUG-SAVE] performSave #${getDebugCallCounters().save}: hole=${currentHole}, flight=${editableFlight}`);
            console.log(`[DEBUG-SAVE] =========================================`);
            
            if (!canEdit || takeoverDetected) {
                reject(new Error("Role was taken over. Cannot save."));
                return;
            }
            
            if (viewOtherFlight) {
                reject(new Error("Cannot save while viewing other flight."));
                return;
            }
            
            var flight = editableFlight;
            var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
            var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            
            if (!saveHoleCallback) {
                reject(new Error("saveHoleCallback is required"));
                return;
            }
            
            var scores = saveHoleCallback(flight, currentHole);
            
            console.log(`[DEBUG-SAVE] Scores: a1=${scores.a1}, a2=${scores.a2}, b1=${scores.b1}, b2=${scores.b2}`);
            
            if (typeof GameData !== 'undefined') {
                GameData.saveCurrentHole(currentHole, scores, coursePar, async function(success) {
                    if (success) {
                        RealGameState.removeLocalChangesForHole(flight, currentHole);
                        
                        console.log(`[DEBUG-SAVE] GameData.saveCurrentHole SUCCESS`);
                        // v1.25: REMOVED manual cache refresh before writeNewHoleData()
                        // Cache is already updated by GameData.saveCurrentHole() (v4.04)
                        // This prevents stale data from overwriting cache before calculations
                        console.log(`[DEBUG-SAVE] Using current cache (already updated by GameData)`);
                        
                        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
                        if (!cache) {
                            reject(new Error("No cache available"));
                            return;
                        }
                        
                        var currentPosition = RealGameUtils.getHolePosition(currentHole);
                        var lastSyncedPos = cache.lastSyncedPosition;
                        
                        console.log(`[DEBUG-SAVE] currentPosition=${currentPosition}, lastSyncedPos=${lastSyncedPos}`);
                        console.log(`[DEBUG-SAVE] isNewHole = ${currentPosition >= lastSyncedPos}`);
                        
                        // v1.23: REMOVED separate T-1 write
                        // T-1, T-2, Strk are all written together in writeNewHoleData()
                        // This ensures all three rows are verified before cache refresh
                        console.log(`[DEBUG-SAVE] --- T-1, T-2, Strk will be written by writeNewHoleData ---`);
                        
                        if (renderAllCallback) renderAllCallback();
                        
                        // ============================================================
                        // writeNewHoleData - ALWAYS call for ALL saves
                        // v1.06: Now properly handles stroke points 0 values
                        // v1.23: Now triggers cache refresh on WRV success (T-1, T-2, Strk)
                        // ============================================================
                        console.log(`[DEBUG-SAVE] --- CALLING writeNewHoleData for position ${currentPosition} ---`);
                        
                        try {
                            await writeNewHoleData(currentPosition, currentHole, cache, renderAllCallback);
                            console.log(`[DEBUG-SAVE] writeNewHoleData INITIATED for hole ${currentHole}`);
                        } catch (error) {
                            console.error(`[DEBUG-SAVE] writeNewHoleData FAILED:`, error);
                            reject(new Error(`Failed to write match data for hole ${currentHole}`));
                            return;
                        }
                        
                        // ============================================================
                        // CASCADE (only for previous holes)
                        // ============================================================
                        if (currentPosition < lastSyncedPos) {
                            console.log(`[DEBUG-SAVE] --- CASCADE: Recalculating positions ${currentPosition} to ${lastSyncedPos} ---`);
                            
                            var currentCache = cache;
                            var cascadeResultsQueue = [];
                            var playOrder = RealGameUtils.getPlayOrder();
                            
                            for (var pos = currentPosition; pos <= lastSyncedPos; pos++) {
                                var holeToUpdate = playOrder[pos];
                                
                                if (currentCache.savedHoles[1].indexOf(holeToUpdate) === -1 || 
                                    currentCache.savedHoles[2].indexOf(holeToUpdate) === -1) {
                                    console.log(`[DEBUG-SAVE] Skipping hole ${holeToUpdate} (not saved by both flights)`);
                                    continue;
                                }
                                
                                console.log(`[DEBUG-SAVE] Processing hole ${holeToUpdate} (position ${pos})`);
                                
                                var updatedClinched = currentCache.results?.clinchedAt || {};
                                var updatedFlight1Clinched = currentCache.results?.game2?.flight1?.clinchedHole || null;
                                var updatedFlight2Clinched = currentCache.results?.game2?.flight2?.clinchedHole || null;
                                
                                if (typeof RealGameCascade !== 'undefined' && RealGameCascade.calculateHoleResultsWithCumulative) {
                                    var loopResultsData = RealGameCascade.calculateHoleResultsWithCumulative(
                                        holeToUpdate, updatedClinched, updatedFlight1Clinched, updatedFlight2Clinched, holeToUpdate
                                    );
                                    
                                    if (loopResultsData) {
                                        // v1.20: updateLocalCacheWithResults now updates game1 points too
                                        updateLocalCacheWithResults(loopResultsData);
                                        if (renderAllCallback) renderAllCallback();
                                        cascadeResultsQueue.push({
                                            hole: holeToUpdate,
                                            resultsData: loopResultsData
                                        });
                                    }
                                }
                                
                                currentCache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : cache;
                            }
                            
                            console.log(`[DEBUG-SAVE] Cascade complete: ${cascadeResultsQueue.length} holes to write`);
                            
                            var pendingData = {
                                gameId: gameId,
                                pendingWrites: cascadeResultsQueue.map(function(item) {
                                    return {
                                        hole: item.hole,
                                        resultsData: item.resultsData
                                    };
                                })
                            };
                            savePendingWrites(pendingData);
                            
                            var finalCache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : cache;
                            
                            if (typeof GameStroke !== 'undefined') {
                                var freshStrokeResults = GameStroke.calculate(
                                    allPlayers,
                                    finalCache.f1DataString,
                                    finalCache.f2DataString,
                                    courseSi,
                                    startingHole,
                                    coursePar
                                );
                                
                                console.log('[DEBUG-SAVE] Recalculating all stroke game positions');
                                for (var pos = 0; pos < 18; pos++) {
                                    finalCache.results.game3.leader[pos] = freshStrokeResults.leader[pos];
                                    finalCache.results.game3.displayStrk[pos] = freshStrokeResults.displayStrk[pos];
                                    finalCache.results.game3.nettA[pos] = freshStrokeResults.nettA[pos];
                                    finalCache.results.game3.nettB[pos] = freshStrokeResults.nettB[pos];
                                    finalCache.results.game3.pointsA[pos] = freshStrokeResults.pointsA[pos];
                                    finalCache.results.game3.pointsB[pos] = freshStrokeResults.pointsB[pos];
                                }
                            }
                            
                            for (var q = 0; q < cascadeResultsQueue.length; q++) {
                                var item = cascadeResultsQueue[q];
                                console.log(`[DEBUG-SAVE] Writing cascade hole ${item.hole} to Firestore...`);
                                
                                try {
                                    await writeSingleHoleToFirestore(item.hole, item.resultsData, finalCache);
                                    console.log(`[DEBUG-SAVE] Cascade write INITIATED for hole ${item.hole}`);
                                    
                                    pendingData.pendingWrites = pendingData.pendingWrites.filter(function(w) {
                                        return w.hole !== item.hole;
                                    });
                                    savePendingWrites(pendingData);
                                    
                                } catch (error) {
                                    console.error(`[DEBUG-SAVE] Failed to write hole ${item.hole}:`, error);
                                    reject(new Error(`Failed to write hole ${item.hole}`));
                                    return;
                                }
                            }
                            
                            savePendingWrites(null);
                        } else {
                            console.log(`[DEBUG-SAVE] --- No cascade needed (new hole or position >= lastSyncedPos)`);
                        }
                        
                        // ============================================================
                        // UPDATE METADATA
                        // ============================================================
                        if (typeof RealGameInit !== 'undefined' && RealGameInit.updateGameMetadata) {
                            await RealGameInit.updateGameMetadata(editableFlight, currentHole);
                        }
                        
                        if (typeof Ticker !== 'undefined') {
                            Ticker.refresh();
                        }
                        
                        console.log(`[DEBUG-SAVE] =========================================`);
                        console.log(`[DEBUG-SAVE] performSave COMPLETE for hole ${currentHole}`);
                        console.log(`[DEBUG-SAVE] =========================================`);
                        
                        resolve(true);
                    } else {
                        console.error(`[DEBUG-SAVE] GameData.saveCurrentHole FAILED`);
                        reject(new Error("Save failed"));
                    }
                });
            } else {
                reject(new Error("GameData not available"));
            }
        });
    }
    
    // ============================================================
    // saveHole
    // ============================================================
    
    function saveHole(saveHoleCallback, renderAllCallback) {
        if (RealGameState.isSaveInProgress()) return;
        
        var viewOtherFlight = RealGameState.isViewOtherFlight();
        var canEdit = RealGameState.getCanEdit();
        var takeoverDetected = RealGameState.isTakeoverDetected();
        var isGameCompleteFlag = RealGameState.isGameComplete();
        
        if (viewOtherFlight) {
            if (typeof Modal !== 'undefined') {
                Modal.alert("Cannot save while viewing other flight. Tap the flight button to return to scoring.");
            }
            return;
        }
        if (!canEdit) {
            if (typeof Modal !== 'undefined') {
                Modal.alert("You can no longer edit - your role was taken over.");
            }
            return;
        }
        if (takeoverDetected) {
            if (typeof Modal !== 'undefined') {
                Modal.alert("Your role was taken over. Cannot save.");
            }
            return;
        }
        if (isGameCompleteFlag) {
            if (typeof Modal !== 'undefined') {
                Modal.alert("Game already complete.");
            }
            return;
        }
        
        var currentHole = RealGameState.getCurrentHole();
        console.log(`[DEBUG-SAVE] saveHole called for hole ${currentHole}`);
        setSaveButtonPending();
        
        performSave(saveHoleCallback, renderAllCallback).then(function() {
            flashSaveButtonSuccess();
            setSaveButtonIdle();
            var debugDiv = document.getElementById("debug");
            if (debugDiv) {
                debugDiv.innerHTML = "✓ Saved";
                setTimeout(function() {
                    if (debugDiv.innerHTML === "✓ Saved") {
                        debugDiv.innerHTML = "";
                    }
                }, 1500);
            }
            if (renderAllCallback) renderAllCallback();
        }).catch(function(error) {
            console.error("Save error:", error);
            setSaveButtonRetry();
            var debugDiv = document.getElementById("debug");
            if (debugDiv) {
                debugDiv.innerHTML = "✗ Save failed. Click RETRY.";
            }
        });
    }
    
    // ============================================================
    // Pending Writes Helpers
    // ============================================================
    
    function getPendingWritesKey() {
        var gameId = RealGameState.getGameId();
        return "pendingCascade_" + gameId;
    }
    
    function savePendingWrites(queueData) {
        var gameId = RealGameState.getGameId();
        if (!gameId) return;
        var key = getPendingWritesKey();
        if (queueData && queueData.pendingWrites && queueData.pendingWrites.length > 0) {
            queueData.timestamp = Date.now();
            localStorage.setItem(key, JSON.stringify(queueData));
            console.log(`[CASCADE-DEBUG] Saved pending writes to localStorage: ${queueData.pendingWrites.length} holes pending`);
        } else {
            localStorage.removeItem(key);
            console.log(`[CASCADE-DEBUG] Cleared pending writes from localStorage`);
        }
    }
    
    function loadPendingWrites() {
        var gameId = RealGameState.getGameId();
        if (!gameId) return null;
        var key = getPendingWritesKey();
        var stored = localStorage.getItem(key);
        if (!stored) return null;
        
        try {
            var data = JSON.parse(stored);
            if (Date.now() - data.timestamp > 3600000) {
                localStorage.removeItem(key);
                return null;
            }
            console.log(`[CASCADE-DEBUG] Loaded pending writes from localStorage: ${data.pendingWrites.length} holes pending`);
            return data;
        } catch(e) {
            localStorage.removeItem(key);
            return null;
        }
    }
    
    async function processPendingWrites(renderAllCallback) {
        var pendingData = loadPendingWrites();
        if (!pendingData) return false;
        
        console.log(`[CASCADE-DEBUG] Resuming ${pendingData.pendingWrites.length} pending writes...`);
        
        var debugDiv = document.getElementById("debug");
        if (debugDiv) {
            debugDiv.innerHTML = `⏳ Resuming ${pendingData.pendingWrites.length} pending updates...`;
        }
        
        var resultsCache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!resultsCache) {
            resultsCache = { results: RealGameUtils.initializeEmptyResults() };
        }
        if (!resultsCache.results) {
            resultsCache.results = RealGameUtils.initializeEmptyResults();
        }
        
        for (var i = 0; i < pendingData.pendingWrites.length; i++) {
            var pending = pendingData.pendingWrites[i];
            var holeNum = pending.hole;
            
            console.log(`[CASCADE-DEBUG] Writing pending hole ${holeNum}...`);
            
            try {
                await writeSingleHoleToFirestore(holeNum, pending.resultsData, resultsCache);
                console.log(`[CASCADE-DEBUG] Pending write INITIATED for hole ${holeNum}`);
                
                pendingData.pendingWrites.splice(i, 1);
                i--;
                savePendingWrites(pendingData);
                
            } catch (error) {
                console.error(`[CASCADE-DEBUG] Failed to write pending hole ${holeNum}:`, error);
                if (debugDiv) {
                    debugDiv.innerHTML = `❌ Failed to write hole ${holeNum}. Will retry on next load.`;
                }
                return false;
            }
        }
        
        console.log(`[CASCADE-DEBUG] All pending writes processed`);
        if (debugDiv) {
            debugDiv.innerHTML = "✓ All updates processed";
            setTimeout(function() {
                if (debugDiv.innerHTML === "✓ All updates processed") {
                    debugDiv.innerHTML = "";
                }
            }, 3000);
        }
        
        savePendingWrites(null);
        if (renderAllCallback) renderAllCallback();
        return true;
    }
    
    // ============================================================
    // Public API - UNCHANGED
    // ============================================================
    
    return {
        updateSaveButtonState: updateSaveButtonState,
        setSaveButtonIdle: setSaveButtonIdle,
        setSaveButtonPending: setSaveButtonPending,
        setSaveButtonRetry: setSaveButtonRetry,
        flashSaveButtonSuccess: flashSaveButtonSuccess,
        performSave: performSave,
        saveHole: saveHole,
        writeNewHoleData: writeNewHoleData,
        writeSingleHoleToFirestore: writeSingleHoleToFirestore,
        updateLocalCacheWithResults: updateLocalCacheWithResults,
        getPendingWritesKey: getPendingWritesKey,
        savePendingWrites: savePendingWrites,
        loadPendingWrites: loadPendingWrites,
        processPendingWrites: processPendingWrites,
        calculateLastSyncedPosition: calculateLastSyncedPosition
    };
    
})();

// Make available globally
window.RealGameSave = RealGameSave;

/*
FILE: js/real-game-save.js
VERSION: 1.26
KEY CHANGES from v1.25:
   - CHANGED: wruBackground() now checks firestoreChanged flag on WRV completion
   - ADDED: If Firestore changed during WRV, trigger cache refresh after WRV completes
   - ADDED: Clear firestoreChanged flag after processing
   - This ensures cache refresh happens AFTER WRV completes, not during
   - PRESERVED: ALL v1.25 functions and API unchanged
   - PRESERVED: ALL existing functionality
DEPENDS ON: RealGameState, RealGameUtils, GameData, GameLoader, GameTeam, GameMatch, GameStroke, GameOrder, Firebase, WRV.js
STATUS: Ready for integration
*/