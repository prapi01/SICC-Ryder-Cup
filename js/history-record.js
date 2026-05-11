/*
FILE: js/history-record.js
VERSION: 1.00
PURPOSE: History Record Manager for SICC Ryder Cup
          - Create archive records when games complete (pending_handicap status)
          - Update records with handicap adjustment data (completed status)
          - Retrieve archived games for "View Previous Games" feature
          - Clean separation from game logic
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

var HistoryRecord = (function() {
    
    var COLLECTION = "historyGames";
    
    // ============================================================
    // Create initial archive record (without handicap adjustment)
    // ============================================================
    
    function createPendingRecord(gameId, gameData, results, finalScores, signatures, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for archive record");
            if (callback) callback(err, null);
            return;
        }
        
        // Determine winner based on final scores
        var winner = "Tie";
        var winnerText = "Tie Game!";
        if (finalScores.teamA > finalScores.teamB) {
            winner = "A";
            winnerText = "Team A Wins!";
        } else if (finalScores.teamB > finalScores.teamA) {
            winner = "B";
            winnerText = "Team B Wins!";
        }
        
        // Build archive data (without handicap adjustment)
        var archiveData = {
            originalGameId: gameId,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "pending_handicap",
            
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
            
            results: {
                version: results.version || 1,
                game1: {
                    pointsA: results.game1?.pointsA || new Array(18).fill(8),
                    pointsB: results.game1?.pointsB || new Array(18).fill(8)
                },
                game2: {
                    flight1: {
                        leader: results.game2?.flight1?.leader || new Array(18).fill("AS"),
                        cumulativePoints: results.game2?.flight1?.cumulativePoints || new Array(18).fill(0)
                    },
                    flight2: {
                        leader: results.game2?.flight2?.leader || new Array(18).fill("AS"),
                        cumulativePoints: results.game2?.flight2?.cumulativePoints || new Array(18).fill(0)
                    }
                },
                game3: {
                    leader: results.game3?.leader || new Array(18).fill("AS"),
                    nettA: results.game3?.nettA || new Array(18).fill(0),
                    nettB: results.game3?.nettB || new Array(18).fill(0)
                },
                tr: {
                    teamA: results.tr?.teamA || new Array(18).fill(9.5),
                    teamB: results.tr?.teamB || new Array(18).fill(9.5),
                    teamAGreen: results.tr?.teamAGreen || new Array(18).fill(true),
                    teamBGreen: results.tr?.teamBGreen || new Array(18).fill(true)
                },
                computedUpToHole: results.computedUpToHole || 0
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
            
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            var docRef = firebase.firestore().collection(COLLECTION).doc();
            archiveData.archiveId = docRef.id;
            
            docRef.set(archiveData).then(function() {
                console.log("Pending archive record created:", docRef.id);
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
    
    // ============================================================
    // Update archive record with handicap adjustment data
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
                console.log("Archive record updated with handicap data:", archiveId);
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error("Error updating archive record:", err);
                if (callback) callback(err);
            });
    }
    
    // ============================================================
    // Get archived game by ID (for viewing)
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
    // Get list of archived games (for history view)
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
    // Get a single archived game by original game ID
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
    
    return {
        createPendingRecord: createPendingRecord,
        updateWithHandicap: updateWithHandicap,
        getArchivedGame: getArchivedGame,
        getArchivedGames: getArchivedGames,
        getArchivedGameByOriginalId: getArchivedGameByOriginalId
    };
})();

/*
FILE: js/history-record.js
VERSION: 1.00
KEY CHANGES:
   - Initial release
   - Creates pending archive records (without handicap adjustment)
   - Updates records with handicap adjustment data
   - Retrieves archived games for history view
   - Clean separation from game logic
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/