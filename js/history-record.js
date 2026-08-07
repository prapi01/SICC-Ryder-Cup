/*
FILE: js/history-record.js
VERSION: 3.11
KEY CHANGES from v3.10:
   - CHANGED: updateWithHandicap() now uses WRV.write() with merge: true instead of WRV.update()
   - REASON: WRV.update() fails on documents not in WRV's local cache
   - REASON: WRV.write() with merge: true works on any document, cached or not
   - REASON: Ensures handicap data is reliably saved to existing history records
   - PRESERVED: ALL other functionality from v3.10 unchanged
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
    // Create or update archive record (UPSERT with fixed ID)
    // Stores data strings directly - NO conversion
    // NEW v3.02: Uses fixed document ID (gameId + "_H")
    // v3.04: Uses WRV for reliability
    // v3.06: Added celebration field for photo pointer
    // v3.07: Retrieve photo URL from localStorage when creating/updating
    // v3.08: Removed signedAt/captainName, fixed status to "completed" when both signed
    // v3.09: REMOVED localStorage photo URL check - use fixed convention instead
    // v3.10: REMOVED celebration.imageUrl: null and adjustedHandicaps: null
    // ============================================================
    
    function upsertPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for archive record");
            if (callback) callback(err, null);
            return;
        }
        
        var docId = getHistoryDocId(gameId);
        
        // v3.09: Photo path is fixed by convention - no localStorage check needed
        var photoPath = getPhotoPathForHistory(gameId);
        
        // v3.08: Determine status based on signatures
        var f1Signed = signatures?.f1?.signed === true;
        var f2Signed = signatures?.f2?.signed === true;
        var bothSigned = f1Signed && f2Signed;
        var recordStatus = bothSigned ? "completed" : "pending_handicap";
        
        console.log('[HistoryRecord] Status determined:', recordStatus, '(f1Signed=' + f1Signed + ', f2Signed=' + f2Signed + ')');
        
        // Check if record already exists
        firebase.firestore().collection(COLLECTION).doc(docId).get()
            .then(function(doc) {
                var isUpdate = doc.exists;
                
                if (isUpdate) {
                    // UPDATE existing record
                    console.log("Updating existing archive record:", docId);
                    
                    // v3.10: Build celebration field with photo path (NO imageUrl: null)
                    var celebrationData = {
                        imageRef: photoPath,
                        status: 'pending',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // v3.08: Build signatures with ONLY signed field
                    var signatureData = {
                        f1: {
                            signed: f1Signed
                        },
                        f2: {
                            signed: f2Signed
                        }
                    };
                    
                    var updateData = {
                        status: recordStatus,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        finalResults: {
                            teamAScore: finalScores.teamA,
                            teamBScore: finalScores.teamB,
                            winner: finalScores.teamA > finalScores.teamB ? "A" : (finalScores.teamB > finalScores.teamA ? "B" : "Tie"),
                            winnerText: finalScores.teamA > finalScores.teamB ? "Team A Wins!" : (finalScores.teamB > finalScores.teamA ? "Team One Wins!" : "Tie Game!")
                        },
                        signatures: signatureData,
                        // Store data strings directly - NO conversion
                        f1DataString: flight1DataString || "",
                        f2DataString: flight2DataString || "",
                        results: results,
                        // v3.10: celebration field with photo path (NO imageUrl: null)
                        celebration: celebrationData
                    };
                    
                    // Use WRV for reliable Firestore update
                    wru(COLLECTION, docId, updateData, function(err) {
                        if (err) {
                            console.error("Error updating archive record:", err);
                            if (callback) callback(err, null);
                        } else {
                            console.log("Archive record updated:", docId);
                            if (callback) callback(null, docId);
                        }
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
                        winnerText = "Team One Wins!";
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
                    
                    // v3.10: Build celebration field with photo path (NO imageUrl: null)
                    var celebrationData = {
                        imageRef: photoPath,
                        status: 'pending',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // v3.08: Build signatures with ONLY signed field
                    var signatureData = {
                        f1: {
                            signed: f1Signed
                        },
                        f2: {
                            signed: f2Signed
                        }
                    };
                    
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
                        
                        // Store data strings directly - NO conversion needed
                        f1DataString: flight1DataString || "",
                        f2DataString: flight2DataString || "",
                        results: results,
                        
                        // v3.10: adjustedHandicaps field OMITTED entirely (will be added by updateWithHandicap)
                        
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        archiveId: docId,
                        
                        // v3.10: celebration field with photo path (NO imageUrl: null)
                        celebration: celebrationData
                    };
                    
                    // Use WRV for reliable Firestore write
                    wrw(COLLECTION, docId, archiveData, function(err) {
                        if (err) {
                            console.error("Error creating archive record:", err);
                            if (callback) callback(err, null);
                        } else {
                            console.log("New archive record created:", docId);
                            if (callback) callback(null, docId);
                        }
                    });
                }
            })
            .catch(function(err) {
                console.error("Error in upsertPendingRecord:", err);
                if (callback) callback(err, null);
            });
    }
    
    // ============================================================
    // v3.05: Update with handicap adjustment (mark as completed)
    // Now preserves "*multiple*" value for newAnchor
    // v3.11: Uses WRV.write() with merge: true instead of WRV.update()
    // ============================================================
    
    function updateWithHandicap(archiveId, handicapData, startingPlayers, callback) {
        if (!archiveId || !handicapData) {
            var err = new Error("Missing archiveId or handicapData");
            if (callback) callback(err);
            return;
        }
        
        var multipleNewAnchor = getMultipleNewAnchor();
        
        // v3.05: Preserve "*multiple*" value or use fallback
        var newAnchorValue = handicapData.newAnchor;
        
        // If newAnchor is null or undefined, use anchor as fallback
        if (newAnchorValue === null || newAnchorValue === undefined) {
            newAnchorValue = handicapData.anchor;
        }
        // If newAnchor is "*multiple*", keep it as-is (don't convert)
        // Otherwise, use the provided value
        
        // Build complete adjustedHandicaps record
        var adjustedHandicaps = {
            calculatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            anchor: handicapData.anchor,
            needsZeroRise: handicapData.needsZeroRise || false,
            zeroRiseAmount: handicapData.zeroRiseAmount || 0,
            newAnchor: newAnchorValue,  // v3.05: Preserves "*multiple*" value
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
        
        // v3.11: Use WRV.write() with merge: true instead of WRV.update()
        // WRV.update() fails on documents not in WRV's local cache
        // WRV.write() with merge: true works on any document, cached or not
        if (typeof WRV !== 'undefined' && WRV.write) {
            WRV.write(COLLECTION, archiveId, updatePayload, function(err, result) {
                if (err) {
                    console.error("Error updating archive record:", err);
                    if (callback) callback(err);
                } else {
                    console.log("Archive record completed with handicap:", archiveId);
                    if (callback) callback(null);
                }
            }, true);  // merge: true
        } else {
            // Fallback: direct Firestore update
            console.warn('[HistoryRecord] WRV not available, using direct update');
            var db = getDb();
            db.collection(COLLECTION).doc(archiveId).update(updatePayload)
                .then(function() {
                    console.log("Archive record completed with handicap:", archiveId);
                    if (callback) callback(null);
                })
                .catch(function(err) {
                    console.error("Error updating archive record:", err);
                    if (callback) callback(err);
                });
        }
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
    // v3.09: Public API
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
        getHistoryDocId: getHistoryDocId,
        getMultipleNewAnchor: getMultipleNewAnchor,  // v3.05: Exposed for other files
        getPhotoPathForHistory: getPhotoPathForHistory  // v3.09: Exposed for other files
    };
    
})();

/*
FILE: js/history-record.js
VERSION: 3.11
KEY CHANGES from v3.10:
   - CHANGED: updateWithHandicap() now uses WRV.write() with merge: true instead of WRV.update()
   - REASON: WRV.update() fails on documents not in WRV's local cache
   - REASON: WRV.write() with merge: true works on any document, cached or not
   - REASON: Ensures handicap data is reliably saved to existing history records
   - PRESERVED: ALL other functionality from v3.10 unchanged
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/