/*
FILE: js/history-record.js
VERSION: 3.07
KEY CHANGES from v3.06:
   - ADDED: Helper function getStoredPhotoUrlForHistory() - retrieves photo URL from localStorage
   - CHANGED: upsertPendingRecord() CREATE now checks localStorage for existing photo URL
   - CHANGED: upsertPendingRecord() UPDATE now checks localStorage for existing photo URL
   - REASON: Photo is uploaded at H17, but history record is created AFTER game completion
   - REASON: Photo URL must persist in localStorage until history record is created
   - REASON: celebration-photo.js stores the URL, history-record.js retrieves it
   - PRESERVED: ALL other functionality from v3.06 unchanged
DEPENDS ON: Firebase Firestore, WRV.js, celebration-photo.js (for localStorage key)
STATUS: Ready for integration
*/

var HistoryRecord = (function() {
    
    var COLLECTION = "historyGames";
    
    // ============================================================
    // v3.07: Get stored photo URL from localStorage (from celebration-photo.js)
    // ============================================================
    function getStoredPhotoUrlForHistory(gameId) {
        if (!gameId) return null;
        
        try {
            var key = 'celebration_photo_url_' + gameId;
            var url = localStorage.getItem(key);
            if (url) {
                console.log('[HistoryRecord] Retrieved photo URL from localStorage for game:', gameId);
            }
            return url;
        } catch(e) {
            console.warn('[HistoryRecord] Failed to retrieve photo URL from localStorage:', e.message);
            return null;
        }
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
    // ============================================================
    
    function upsertPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for archive record");
            if (callback) callback(err, null);
            return;
        }
        
        var docId = getHistoryDocId(gameId);
        
        // v3.07: Check if there's a photo URL stored in localStorage
        var storedPhotoUrl = getStoredPhotoUrlForHistory(gameId);
        var hasPhoto = storedPhotoUrl !== null && storedPhotoUrl !== undefined;
        
        if (hasPhoto) {
            console.log('[HistoryRecord] Found stored photo URL for game:', gameId);
        } else {
            console.log('[HistoryRecord] No stored photo URL found for game:', gameId);
        }
        
        // Check if record already exists
        firebase.firestore().collection(COLLECTION).doc(docId).get()
            .then(function(doc) {
                var isUpdate = doc.exists;
                
                if (isUpdate) {
                    // UPDATE existing record
                    console.log("Updating existing archive record:", docId);
                    
                    // v3.07: Build celebration field with stored photo URL if available
                    var celebrationData = {
                        imageRef: hasPhoto ? 'celebration/' + docId + '.jpg' : null,
                        imageUrl: hasPhoto ? storedPhotoUrl : null,
                        status: hasPhoto ? 'uploaded' : 'pending',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
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
                        results: results,
                        // v3.07: celebration field with stored photo URL
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
                    
                    // v3.07: Build celebration field with stored photo URL if available
                    var celebrationData = {
                        imageRef: hasPhoto ? 'celebration/' + docId + '.jpg' : null,
                        imageUrl: hasPhoto ? storedPhotoUrl : null,
                        status: hasPhoto ? 'uploaded' : 'pending',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
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
                        archiveId: docId,
                        
                        // v3.07: celebration field with stored photo URL
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
        
        // Use WRV for reliable Firestore update
        wru(COLLECTION, archiveId, updatePayload, function(err) {
            if (err) {
                console.error("Error updating archive record:", err);
                if (callback) callback(err);
            } else {
                console.log("Archive record completed with handicap:", archiveId);
                if (callback) callback(null);
            }
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
        getHistoryDocId: getHistoryDocId,
        getMultipleNewAnchor: getMultipleNewAnchor,  // v3.05: Exposed for other files
        getStoredPhotoUrlForHistory: getStoredPhotoUrlForHistory  // v3.07: Exposed for debugging
    };
    
})();

/*
FILE: js/history-record.js
VERSION: 3.07
KEY CHANGES from v3.06:
   - ADDED: Helper function getStoredPhotoUrlForHistory() - retrieves photo URL from localStorage
   - CHANGED: upsertPendingRecord() CREATE now checks localStorage for existing photo URL
   - CHANGED: upsertPendingRecord() UPDATE now checks localStorage for existing photo URL
   - REASON: Photo is uploaded at H17, but history record is created AFTER game completion
   - REASON: Photo URL must persist in localStorage until history record is created
   - REASON: celebration-photo.js stores the URL, history-record.js retrieves it
   - PRESERVED: ALL other functionality from v3.06 unchanged
DEPENDS ON: Firebase Firestore, WRV.js, celebration-photo.js (for localStorage key)
STATUS: Ready for integration
*/