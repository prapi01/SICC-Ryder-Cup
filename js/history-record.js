/*
FILE: js/history-record.js
VERSION: 3.00
KEY CHANGES:
   - COMPLETE REWRITE: One schema only - store data strings directly
   - Removed holeData object (flattened arrays) - NO MORE RECONSTRUCTION
   - Stores f1DataString and f2DataString exactly as they appear in scheduledGames
   - Archive now has identical format to live games
   - All display functions can read directly without conversion
   - Backward compatibility: existing holeData records will be migrated on read
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

var HistoryRecord = (function() {
    
    var COLLECTION = "historyGames";
    
    // ============================================================
    // Get existing record for a game (by originalGameId)
    // ============================================================
    
    function getExistingRecord(gameId, callback) {
        if (!gameId) {
            if (callback) callback("No game ID provided", null);
            return;
        }
        
        firebase.firestore().collection(COLLECTION)
            .where("originalGameId", "==", gameId)
            .limit(1)
            .get()
            .then(function(snapshot) {
                if (snapshot.empty) {
                    callback(null, null);
                } else {
                    var doc = snapshot.docs[0];
                    callback(null, { id: doc.id, data: doc.data() });
                }
            })
            .catch(function(err) {
                console.error("Error checking existing record:", err);
                callback(err, null);
            });
    }
    
    // ============================================================
    // Create or update archive record (UPSERT)
    // Stores data strings directly - NO conversion
    // ============================================================
    
    function upsertPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for archive record");
            if (callback) callback(err, null);
            return;
        }
        
        getExistingRecord(gameId, function(err, existing) {
            if (err) {
                console.error("Error checking existing record:", err);
                if (callback) callback(err, null);
                return;
            }
            
            if (existing && existing.id) {
                // UPDATE existing record
                console.log("Updating existing archive record:", existing.id);
                
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
                
                firebase.firestore().collection(COLLECTION).doc(existing.id).update(updateData)
                    .then(function() {
                        console.log("Archive record updated:", existing.id);
                        if (callback) callback(null, existing.id);
                    })
                    .catch(function(err) {
                        console.error("Error updating archive record:", err);
                        if (callback) callback(err, null);
                    });
                
            } else {
                // CREATE new record
                console.log("Creating new archive record for game:", gameId);
                
                var winner = "Tie";
                var winnerText = "Tie Game!";
                if (finalScores.teamA > finalScores.teamB) {
                    winner = "A";
                    winnerText = "Team A Wins!";
                } else if (finalScores.teamB > finalScores.teamA) {
                    winner = "B";
                    winnerText = "Team B Wins!";
                }
                
                var archiveData = {
                    originalGameId: gameId,
                    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: "pending_handicap",
                    version: 3,
                    schema: "v3_strings",  // NEW schema: stores data strings directly
                    
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
                    
                    players: gameData.players.map(function(p) {
                        return {
                            name: p.name,
                            label: p.label,
                            handicap: p.handicap,
                            team: p.team,
                            flight: p.flight
                        };
                    }),
                    
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
                    
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                try {
                    var docRef = firebase.firestore().collection(COLLECTION).doc();
                    archiveData.archiveId = docRef.id;
                    
                    docRef.set(archiveData).then(function() {
                        console.log("New archive record created:", docRef.id);
                        if (callback) callback(null, docRef.id);
                    }).catch(function(err) {
                        console.error("Error creating archive record:", err);
                        if (callback) callback(err, null);
                    });
                } catch (err) {
                    console.error("Exception creating archive record:", err);
                    if (callback) callback(err, null);
                }
            }
        });
    }
    
    // ============================================================
    // Update with handicap adjustment (mark as completed)
    // ============================================================
    
    function updateWithHandicap(archiveId, handicapData, callback) {
        if (!archiveId || !handicapData) {
            var err = new Error("Missing archiveId or handicapData");
            if (callback) callback(err);
            return;
        }
        
        var updatePayload = {
            "handicapAdjustment": {
                calculatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                anchor: handicapData.anchor,
                players: handicapData.players,
                needsZeroRise: handicapData.needsZeroRise || false,
                zeroRiseAmount: handicapData.zeroRiseAmount || 0,
                newAnchor: handicapData.newAnchor || handicapData.anchor
            },
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
    // Legacy wrapper
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
    // Get by original game ID
    // ============================================================
    
    function getArchivedGameByOriginalId(originalGameId, callback) {
        if (!originalGameId) {
            if (callback) callback("No game ID provided", null);
            return;
        }
        
        firebase.firestore().collection(COLLECTION)
            .where("originalGameId", "==", originalGameId)
            .limit(1)
            .get()
            .then(function(snapshot) {
                if (snapshot.empty) {
                    callback("No archive found for this game", null);
                } else {
                    var doc = snapshot.docs[0];
                    callback(null, { id: doc.id, data: doc.data() });
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
        deleteArchiveRecord: deleteArchiveRecord
    };
    
})();

/*
FILE: js/history-record.js
VERSION: 3.00
KEY CHANGES:
   - COMPLETE REWRITE: One schema only - store data strings directly
   - Removed holeData object (flattened arrays) - NO MORE RECONSTRUCTION
   - Stores f1DataString and f2DataString exactly as they appear in scheduledGames
   - Archive now has identical format to live games
   - All display functions can read directly without conversion
   - Backward compatibility: existing holeData records will be migrated on read
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/