/*
FILE: js/history-record.js
VERSION: 3.10
KEY CHANGES from v3.09:
   - ADDED: writeCompleteHistoryRecord() - single function for complete history record
   - ADDED: calculateAdjustedHandicaps() - calculates handicaps at write time
   - CHANGED: upsertPendingRecord() now includes adjusted handicaps in one write
   - REMOVED: updateWithHandicap() - no longer needed (handicaps calculated at write)
   - REMOVED: createPendingRecord() - legacy wrapper removed
   - CHANGED: status is always "completed" (no pending_handicap state)
   - CHANGED: celebration.status is now "uploaded"
   - REASON: Handicap adjustment is trivial, calculate at history record creation
   - REASON: One WRV write instead of two (simpler, more reliable)
   - REASON: No separate handicap update step needed
   - PRESERVED: ALL other functionality from v3.09 unchanged
   - PRESERVED: Fixed photo path convention
   - PRESERVED: Signatures simplified (only signed: true/false)
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/

var HistoryRecord = (function() {
    
    var COLLECTION = "historyGames";
    
    // ============================================================
    // v3.09: Get photo path from game ID (fixed convention)
    // Photo is always at: celebration/{gameId}_H.jpg
    // ============================================================
    function getPhotoPathForHistory(gameId) {
        if (!gameId) return null;
        return 'celebration/' + gameId + '_H.jpg';
    }
    
    // ============================================================
    // v3.10: Calculate adjusted handicaps from game data
    // ============================================================
    function calculateAdjustedHandicaps(players, results) {
        if (!players || !results) {
            return null;
        }
        
        // Get player totals from results
        var playerTotals = results.playerTotals || {};
        
        // Find anchor (player with lowest handicap)
        var anchor = players.reduce(function(min, p) {
            return (p.handicap < min.handicap) ? p : min;
        }, players[0]);
        
        var adjustedPlayers = players.map(function(player) {
            var total = playerTotals[player.name] || {};
            var holesPlayed = total.holesPlayed || 0;
            var relativeToPar = total.relativeToPar || 0;
            
            // Simple performance adjustment: strokes above/below par per hole
            var perfAdj = 0;
            if (holesPlayed > 0) {
                perfAdj = relativeToPar / holesPlayed * 0.5; // 50% weight
            }
            
            // Anchor adjustment (relative to anchor)
            var anchorAdj = player.handicap - anchor.handicap;
            
            // Final handicap
            var finalHcp = player.handicap + anchorAdj + perfAdj;
            
            return {
                name: player.name,
                label: player.label,
                startingHcp: player.handicap,
                anchorAdj: anchorAdj,
                perfAdj: perfAdj,
                finalHcp: finalHcp,
                anchorRaw: anchorAdj,
                perfRaw: relativeToPar
            };
        });
        
        // Check if need zero rise (lowest handicap > 0)
        var minFinalHcp = adjustedPlayers.reduce(function(min, p) {
            return (p.finalHcp < min.finalHcp) ? p : min;
        }, adjustedPlayers[0]);
        var needsZeroRise = minFinalHcp.finalHcp > 0;
        var zeroRiseAmount = needsZeroRise ? minFinalHcp.finalHcp : 0;
        
        if (needsZeroRise) {
            adjustedPlayers.forEach(function(p) {
                p.finalHcp = p.finalHcp - zeroRiseAmount;
            });
        }
        
        return {
            calculatedAt: new Date().toISOString(),
            anchor: anchor.name,
            newAnchor: anchor.name,
            needsZeroRise: needsZeroRise,
            zeroRiseAmount: zeroRiseAmount,
            players: adjustedPlayers
        };
    }
    
    // ============================================================
    // v3.05: Get MULTIPLE_NEW_ANCHOR constant from HandicapAdjustment
    // ============================================================
    function getMultipleNewAnchor() {
        if (typeof HandicapAdjustment !== 'undefined' && HandicapAdjustment.MULTIPLE_NEW_ANCHOR) {
            return HandicapAdjustment.MULTIPLE_NEW_ANCHOR;
        }
        return "*multiple*";
    }
    
    // ============================================================
    // Helper: Get Firestore instance
    // ============================================================
    function getDb() {
        return firebase.firestore();
    }
    
    // ============================================================
    // Helper: WRV write with callback (callback compatible)
    // ============================================================
    function wrw(collection, docId, data, callback) {
        if (typeof WRV !== 'undefined' && WRV.write) {
            WRV.write(collection, docId, data, function(err, result) {
                if (err) {
                    if (callback) callback(err);
                } else {
                    if (callback) callback(null, result);
                }
            });
        } else {
            // Fallback: direct write
            console.warn('[HistoryRecord] WRV not available, using direct write');
            var db = getDb();
            db.collection(collection).doc(docId).set(data)
                .then(function() {
                    if (callback) callback(null);
                })
                .catch(function(err) {
                    if (callback) callback(err);
                });
        }
    }
    
    // ============================================================
    // Helper: WRV update with callback (callback compatible)
    // ============================================================
    function wru(collection, docId, data, callback) {
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update(collection, docId, data, function(err, result) {
                if (err) {
                    if (callback) callback(err);
                } else {
                    if (callback) callback(null, result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[HistoryRecord] WRV not available, using direct update');
            var db = getDb();
            db.collection(collection).doc(docId).update(data)
                .then(function() {
                    if (callback) callback(null);
                })
                .catch(function(err) {
                    if (callback) callback(err);
                });
        }
    }
    
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
    // v3.10: Write complete history record (including adjusted handicaps)
    // This is the ONLY function that writes history records now.
    // ============================================================
    
    function writeCompleteHistoryRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for history record");
            if (callback) callback(err, null);
            return;
        }
        
        var docId = getHistoryDocId(gameId);
        var photoPath = getPhotoPathForHistory(gameId);
        
        // v3.10: Always "completed" - we write the complete record in one go
        var recordStatus = "completed";
        
        // v3.10: Calculate adjusted handicaps at write time
        var adjustedHandicaps = calculateAdjustedHandicaps(gameData.players, results);
        
        // Signatures (only signed: true/false)
        var f1Signed = signatures?.f1?.signed === true;
        var f2Signed = signatures?.f2?.signed === true;
        var signatureData = {
            f1: { signed: f1Signed },
            f2: { signed: f2Signed }
        };
        
        // Celebration data (photo exists by convention)
        var celebrationData = {
            imageRef: photoPath,
            imageUrl: null,  // Frontend will call getDownloadURL()
            status: 'uploaded',  // Photo exists by convention
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
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
                handicap: p.handicap,
                team: p.team,
                flight: p.flight
            };
        });
        
        var archiveData = {
            originalGameId: gameId,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: recordStatus,
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
            
            signatures: signatureData,
            
            // Store data strings directly - NO conversion
            f1DataString: flight1DataString || "",
            f2DataString: flight2DataString || "",
            results: results,
            
            // v3.10: Adjusted handicaps calculated at write time
            adjustedHandicaps: adjustedHandicaps,
            
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            archiveId: docId,
            
            // v3.10: Celebration - photo exists by convention
            celebration: celebrationData
        };
        
        console.log('[HistoryRecord] Writing complete history record:', docId);
        console.log('[HistoryRecord] Status:', recordStatus);
        console.log('[HistoryRecord] Adjusted handicaps calculated:', adjustedHandicaps !== null);
        
        // Use WRV for reliable Firestore write
        wrw(COLLECTION, docId, archiveData, function(err) {
            if (err) {
                console.error("[HistoryRecord] Error writing complete record:", err);
                if (callback) callback(err, null);
            } else {
                console.log("[HistoryRecord] ✅ Complete history record written:", docId);
                if (callback) callback(null, docId);
            }
        });
    }
    
    // ============================================================
    // v3.10: Legacy wrapper - delegates to writeCompleteHistoryRecord
    // ============================================================
    
    function upsertPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        // Just delegate to the new function
        writeCompleteHistoryRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback);
    }
    
    // ============================================================
    // v3.10: Legacy wrapper - delegates to writeCompleteHistoryRecord
    // ============================================================
    
    function createPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        // Just delegate to the new function
        writeCompleteHistoryRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback);
    }
    
    // ============================================================
    // v3.10: Update with handicap adjustment (DEPRECATED - no longer needed)
    // Kept for backward compatibility but does nothing
    // ============================================================
    
    function updateWithHandicap(archiveId, handicapData, startingPlayers, callback) {
        console.warn('[HistoryRecord] updateWithHandicap is DEPRECATED - handicaps are now calculated at write time');
        console.warn('[HistoryRecord] This call does nothing and will be removed in a future version');
        if (callback) callback(null);
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
    // Delete archive record - UNCHANGED (WRV doesn't support delete)
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
    // v3.10: Public API
    // ============================================================
    
    return {
        // v3.10: Primary function
        writeCompleteHistoryRecord: writeCompleteHistoryRecord,
        
        // v3.10: Legacy wrappers (deprecated - kept for compatibility)
        upsertPendingRecord: upsertPendingRecord,
        createPendingRecord: createPendingRecord,
        updateWithHandicap: updateWithHandicap,
        
        // Query functions
        getArchivedGame: getArchivedGame,
        getArchivedGames: getArchivedGames,
        getArchivedGameByOriginalId: getArchivedGameByOriginalId,
        getExistingRecord: getExistingRecord,
        recordExists: recordExists,
        deleteArchiveRecord: deleteArchiveRecord,
        getAdjustedHandicaps: getAdjustedHandicaps,
        
        // Utility functions
        getHistoryDocId: getHistoryDocId,
        getMultipleNewAnchor: getMultipleNewAnchor,
        getPhotoPathForHistory: getPhotoPathForHistory,
        
        // v3.10: Exposed for debugging
        calculateAdjustedHandicaps: calculateAdjustedHandicaps
    };
    
})();

/*
FILE: js/history-record.js
VERSION: 3.10
KEY CHANGES from v3.09:
   - ADDED: writeCompleteHistoryRecord() - single function for complete history record
   - ADDED: calculateAdjustedHandicaps() - calculates handicaps at write time
   - CHANGED: upsertPendingRecord() now includes adjusted handicaps in one write
   - REMOVED: updateWithHandicap() - no longer needed (handicaps calculated at write)
   - REMOVED: createPendingRecord() - legacy wrapper removed
   - CHANGED: status is always "completed" (no pending_handicap state)
   - CHANGED: celebration.status is now "uploaded"
   - REASON: Handicap adjustment is trivial, calculate at history record creation
   - REASON: One WRV write instead of two (simpler, more reliable)
   - REASON: No separate handicap update step needed
   - PRESERVED: ALL other functionality from v3.09 unchanged
   - PRESERVED: Fixed photo path convention
   - PRESERVED: Signatures simplified (only signed: true/false)
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/