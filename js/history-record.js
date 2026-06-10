/*
FILE: js/history-record.js
VERSION: 3.03
KEY CHANGES from v3.02:
   - ADDED: Preserves anchorRaw and perfRaw values in adjustedHandicaps
   - ADDED: Stores derived data (raw results for Anc and Perf columns)
   - Ensures all calculated handicap data is saved to Firestore
   - Prevents loss of raw values when viewing completed games
   - All existing functionality preserved
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

var HistoryRecord = (function() {
    
    var COLLECTION = "historyGames";
    
    // ============================================================
    // Generate fixed document ID from game ID
    // Format: gameId + "_H"
    // Example: GM_260605_1503_42_H
    // ============================================================
    
    function getHistoryDocId(gameId) {
        return gameId + "_H";
    }
    
    // ============================================================
    // Check if history record exists (by fixed document ID)
    // ============================================================
    
    function recordExists(gameId, callback) {
        if (!gameId) {
            if (callback) callback("No game ID provided", false);
            return;
        }
        
        var docId = getHistoryDocId(gameId);
        
        firebase.firestore().collection(COLLECTION).doc(docId).get()
            .then(function(doc) {
                callback(null, doc.exists, doc.id);
            })
            .catch(function(err) {
                console.error("Error checking record existence:", err);
                callback(err, false);
            });
    }
    
    // ============================================================
    // Get existing record for a game (by fixed document ID)
    // ============================================================
    
    function getExistingRecord(gameId, callback) {
        if (!gameId) {
            if (callback) callback("No game ID provided", null);
            return;
        }
        
        var docId = getHistoryDocId(gameId);
        
        firebase.firestore().collection(COLLECTION).doc(docId).get()
            .then(function(doc) {
                if (doc.exists) {
                    callback(null, { id: doc.id, data: doc.data() });
                } else {
                    callback(null, null);
                }
            })
            .catch(function(err) {
                console.error("Error checking existing record:", err);
                callback(err, null);
            });
    }
    
    // ============================================================
    // Create or update archive record (UPSERT with fixed ID)
    // Stores data strings directly - NO conversion
    // NEW v3.02: Uses fixed document ID (gameId + "_H")
    // ============================================================
    
    function upsertPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for archive record");
            if (callback) callback(err, null);
            return;
        }
        
        var docId = getHistoryDocId(gameId);
        
        // Check if record already exists
        firebase.firestore().collection(COLLECTION).doc(docId).get()
            .then(function(doc) {
                var isUpdate = doc.exists;
                
                if (isUpdate) {
                    // UPDATE existing record
                    console.log("Updating existing archive record:", docId);
                    
                    var updateData = {
                        status: "pending_handicap",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        finalResults: {
                            teamAScore: finalScores.teamA,
                            teamBScore: finalScores.teamB,
                            winner: finalScores.teamA > finalScores.teamB ? "A" : (finalScores.teamB > finalScores.teamA ? "B" : "Tie"),
                            winnerText: finalScores.teamA > finalScores.teamB ? "Team A Wins!" : (finalScores.teamB > finalScores.teamA ? "Team B Wins!" : "Tie Game!")
                        },
                        signatures: {
                            f1: {
                                signed: signatures.f1?.signed === true,
                                signedAt: signatures.f1?.signedAt || null,
                                captainName: signatures.f1?.captainName || null
                            },
                            f2: {
                                signed: signatures.f2?.signed === true,
                                signedAt: signatures.f2?.signedAt || null,
                                captainName: signatures.f2?.captainName || null
                            }
                        },
                        // Store data strings directly - NO conversion
                        f1DataString: flight1DataString || "",
                        f2DataString: flight2DataString || "",
                        results: results
                    };
                    
                    return firebase.firestore().collection(COLLECTION).doc(docId).update(updateData)
                        .then(function() {
                            console.log("Archive record updated:", docId);
                            if (callback) callback(null, docId);
                        });
                    
                } else {
                    // CREATE new record
                    console.log("Creating new archive record for game:", gameId, "with ID:", docId);
                    
                    var winner = "Tie";
                    var winnerText = "Tie Game!";
                    if (finalScores.teamA > finalScores.teamB) {
                        winner = "A";
                        winnerText = "Team A Wins!";
                    } else if (finalScores.teamB > finalScores.teamA) {
                        winner = "B";
                        winnerText = "Team B Wins!";
                    }
                    
                    // Store starting handicaps for all players
                    var playersWithStartingHcp = gameData.players.map(function(p) {
                        return {
                            name: p.name,
                            label: p.label,
                            handicap: p.handicap,  // STARTING handicap at game time
                            team: p.team,
                            flight: p.flight
                        };
                    });
                    
                    var archiveData = {
                        originalGameId: gameId,
                        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: "pending_handicap",
                        version: 3,
                        schema: "v3_strings",
                        
                        gameInfo: {
                            date: gameData.date,
                            course: {
                                name: gameData.course.name,
                                id: gameData.course.id,
                                par: gameData.course.par,
                                si: gameData.course.si
                            },
                            startingHole: gameData.startingHole || 1,
                            teamGameFormat: gameData.teamGameFormat || "tournament"
                        },
                        
                        // Store players with their STARTING handicaps
                        players: playersWithStartingHcp,
                        
                        finalResults: {
                            teamAScore: finalScores.teamA,
                            teamBScore: finalScores.teamB,
                            winner: winner,
                            winnerText: winnerText
                        },
                        
                        signatures: {
                            f1: {
                                signed: signatures.f1?.signed === true,
                                signedAt: signatures.f1?.signedAt || null,
                                captainName: signatures.f1?.captainName || null
                            },
                            f2: {
                                signed: signatures.f2?.signed === true,
                                signedAt: signatures.f2?.signedAt || null,
                                captainName: signatures.f2?.captainName || null
                            }
                        },
                        
                        // Store data strings directly - NO conversion needed
                        f1DataString: flight1DataString || "",
                        f2DataString: flight2DataString || "",
                        results: results,
                        
                        // Placeholder for handicap adjustment (to be filled later)
                        adjustedHandicaps: null,
                        
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        archiveId: docId
                    };
                    
                    return firebase.firestore().collection(COLLECTION).doc(docId).set(archiveData)
                        .then(function() {
                            console.log("New archive record created:", docId);
                            if (callback) callback(null, docId);
                        });
                }
            })
            .catch(function(err) {
                console.error("Error in upsertPendingRecord:", err);
                if (callback) callback(err, null);
            });
    }
    
    // ============================================================
    // Update with handicap adjustment (mark as completed)
    // v3.03: Now preserves anchorRaw and perfRaw values
    // ============================================================
    
    function updateWithHandicap(archiveId, handicapData, startingPlayers, callback) {
        if (!archiveId || !handicapData) {
            var err = new Error("Missing archiveId or handicapData");
            if (callback) callback(err);
            return;
        }
        
        // Build complete adjustedHandicaps record
        var adjustedHandicaps = {
            calculatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            anchor: handicapData.anchor,
            needsZeroRise: handicapData.needsZeroRise || false,
            zeroRiseAmount: handicapData.zeroRiseAmount || 0,
            newAnchor: handicapData.newAnchor || handicapData.anchor,
            players: []
        };
        
        // Merge starting handicaps with adjustment data
        if (startingPlayers && startingPlayers.length > 0) {
            for (var i = 0; i < startingPlayers.length; i++) {
                var player = startingPlayers[i];
                var adjustment = handicapData.players.find(function(p) { return p.name === player.name; });
                
                // v3.03: Preserve anchorRaw and perfRaw values
                adjustedHandicaps.players.push({
                    name: player.name,
                    label: player.label,
                    startingHcp: player.handicap,           // Stored permanently
                    anchorAdj: adjustment ? adjustment.anchorAdj : 0,
                    perfAdj: adjustment ? adjustment.perfAdj : 0,
                    finalHcp: adjustment ? adjustment.newHcp : player.handicap,
                    anchorRaw: adjustment ? adjustment.anchorRaw : 0,   // ← ADDED v3.03
                    perfRaw: adjustment ? adjustment.perfRaw : 0        // ← ADDED v3.03
                });
            }
        } else {
            // Fallback: use only adjustment data if starting players not provided
            adjustedHandicaps.players = handicapData.players.map(function(p) {
                return {
                    name: p.name,
                    label: p.name.substring(0, 3).toUpperCase(),
                    startingHcp: p.currentHcp,
                    anchorAdj: p.anchorAdj || 0,
                    perfAdj: p.perfAdj || 0,
                    finalHcp: p.newHcp,
                    anchorRaw: p.anchorRaw || 0,   // ← ADDED v3.03
                    perfRaw: p.perfRaw || 0        // ← ADDED v3.03
                };
            });
        }
        
        var updatePayload = {
            "adjustedHandicaps": adjustedHandicaps,
            "status": "completed",
            "updatedAt": firebase.firestore.FieldValue.serverTimestamp()
        };
        
        firebase.firestore().collection(COLLECTION).doc(archiveId).update(updatePayload)
            .then(function() {
                console.log("Archive record completed with handicap:", archiveId);
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error("Error updating archive record:", err);
                if (callback) callback(err);
            });
    }
    
    // ============================================================
    // Legacy wrapper (maintains backward compatibility)
    // ============================================================
    
    function createPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        upsertPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback);
    }
    
    // ============================================================
    // Get archived game by ID
    // ============================================================
    
    function getArchivedGame(archiveId, callback) {
        if (!archiveId) {
            if (callback) callback("No archive ID provided", null);
            return;
        }
        
        firebase.firestore().collection(COLLECTION).doc(archiveId).get()
            .then(function(doc) {
                if (doc.exists) {
                    callback(null, doc.data());
                } else {
                    callback("Game not found", null);
                }
            })
            .catch(function(err) {
                console.error("Error getting archived game:", err);
                callback(err, null);
            });
    }
    
    // ============================================================
    // Get list of completed games
    // ============================================================
    
    function getArchivedGames(limit, callback) {
        var maxResults = limit || 50;
        
        firebase.firestore().collection(COLLECTION)
            .where("status", "==", "completed")
            .orderBy("completedAt", "desc")
            .limit(maxResults)
            .get()
            .then(function(snapshot) {
                var games = [];
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    games.push({
                        id: doc.id,
                        date: data.gameInfo?.date,
                        courseName: data.gameInfo?.course?.name,
                        winner: data.finalResults?.winnerText,
                        teamAScore: data.finalResults?.teamAScore,
                        teamBScore: data.finalResults?.teamBScore,
                        completedAt: data.completedAt
                    });
                });
                callback(null, games);
            })
            .catch(function(err) {
                console.error("Error getting archived games:", err);
                callback(err, null);
            });
    }
    
    // ============================================================
    // Get by original game ID (using fixed ID format)
    // ============================================================
    
    function getArchivedGameByOriginalId(originalGameId, callback) {
        if (!originalGameId) {
            if (callback) callback("No game ID provided", null);
            return;
        }
        
        var docId = getHistoryDocId(originalGameId);
        
        firebase.firestore().collection(COLLECTION).doc(docId).get()
            .then(function(doc) {
                if (doc.exists) {
                    callback(null, { id: doc.id, data: doc.data() });
                } else {
                    callback("No archive found for this game", null);
                }
            })
            .catch(function(err) {
                console.error("Error finding archived game:", err);
                callback(err, null);
            });
    }
    
    // ============================================================
    // Delete archive record
    // ============================================================
    
    function deleteArchiveRecord(archiveId, callback) {
        if (!archiveId) {
            if (callback) callback("No archive ID provided");
            return;
        }
        
        firebase.firestore().collection(COLLECTION).doc(archiveId).delete()
            .then(function() {
                console.log("Archive record deleted:", archiveId);
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error("Error deleting archive record:", err);
                if (callback) callback(err);
            });
    }
    
    // ============================================================
    // Get stored adjustedHandicaps (for history display)
    // ============================================================
    
    function getAdjustedHandicaps(archiveId, callback) {
        if (!archiveId) {
            if (callback) callback("No archive ID provided", null);
            return;
        }
        
        firebase.firestore().collection(COLLECTION).doc(archiveId).get()
            .then(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    var adjustedHandicaps = data.adjustedHandicaps || null;
                    callback(null, adjustedHandicaps);
                } else {
                    callback("Game not found", null);
                }
            })
            .catch(function(err) {
                console.error("Error getting adjusted handicaps:", err);
                callback(err, null);
            });
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        createPendingRecord: createPendingRecord,
        upsertPendingRecord: upsertPendingRecord,
        updateWithHandicap: updateWithHandicap,
        getArchivedGame: getArchivedGame,
        getArchivedGames: getArchivedGames,
        getArchivedGameByOriginalId: getArchivedGameByOriginalId,
        getExistingRecord: getExistingRecord,
        recordExists: recordExists,
        deleteArchiveRecord: deleteArchiveRecord,
        getAdjustedHandicaps: getAdjustedHandicaps,
        getHistoryDocId: getHistoryDocId
    };
    
})();

/*
FILE: js/history-record.js
VERSION: 3.03
KEY CHANGES from v3.02:
   - ADDED: Preserves anchorRaw and perfRaw values in adjustedHandicaps
   - ADDED: Stores derived data (raw results for Anc and Perf columns)
   - Ensures all calculated handicap data is saved to Firestore
   - Prevents loss of raw values when viewing completed games
   - All existing functionality preserved
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/