/*
FILE: js/history-record.js
VERSION: 2.00
KEY CHANGES:
   - REMOVED: All encoding functions (encoding.js no longer required)
   - NEW: Stores hole data as simple JSON arrays instead of encoded string
   - NEW: buildHoleDataObject() creates structured object with all hole data
   - NEW: f1Scores, f2Scores, matchResults, trTeamA, trTeamB, teamAGreen, teamBGreen, t1Row, t2Row, strkRow
   - No encoding/decoding bugs - pure JavaScript arrays
   - Backward compatible: old records without holeData object will show error
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

var HistoryRecord = (function() {
    
    var COLLECTION = "historyGames";
    
    // ============================================================
    // Helper: Check if record already exists
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
    // Build hole data object from cache
    // ============================================================
    
    function buildHoleDataObject(flight1Data, flight2Data, matchResults, trTeamA, trTeamB, teamAGreen, teamBGreen, t1Row, t2Row, strkRow, allPlayers, startingHole) {
        
        // Get ordered players for score mapping
        function getOrderedPlayers(flight) {
            var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
            var teamA = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var teamB = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
            return [teamA[0], teamA[1], teamB[0], teamB[1]];
        }
        
        var f1OrderedPlayers = getOrderedPlayers(1);
        var f2OrderedPlayers = getOrderedPlayers(2);
        
        // Initialize arrays
        var f1Scores = [];
        var f2Scores = [];
        var matchResultsArray = [];
        
        // Process holes in natural order (1-18) for simplicity
        for (var hole = 1; hole <= 18; hole++) {
            // Flight 1 scores
            var f1HoleScores = [];
            for (var i = 0; i < f1OrderedPlayers.length; i++) {
                var player = f1OrderedPlayers[i];
                var score = 0;
                if (flight1Data[hole] && flight1Data[hole].saved) {
                    if (i === 0) score = flight1Data[hole].scores.a1;
                    else if (i === 1) score = flight1Data[hole].scores.a2;
                    else if (i === 2) score = flight1Data[hole].scores.b1;
                    else if (i === 3) score = flight1Data[hole].scores.b2;
                }
                f1HoleScores.push(score);
            }
            f1Scores.push(f1HoleScores);
            
            // Flight 2 scores
            var f2HoleScores = [];
            for (var i = 0; i < f2OrderedPlayers.length; i++) {
                var player = f2OrderedPlayers[i];
                var score = 0;
                if (flight2Data[hole] && flight2Data[hole].saved) {
                    if (i === 0) score = flight2Data[hole].scores.a1;
                    else if (i === 1) score = flight2Data[hole].scores.a2;
                    else if (i === 2) score = flight2Data[hole].scores.b1;
                    else if (i === 3) score = flight2Data[hole].scores.b2;
                }
                f2HoleScores.push(score);
            }
            f2Scores.push(f2HoleScores);
            
            // Match results for this hole (16 values)
            var holeMatchResults = [];
            var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
            
            for (var a = 0; a < teamAPlayers.length; a++) {
                for (var b = 0; b < teamBPlayers.length; b++) {
                    var key = teamAPlayers[a].name + "_vs_" + teamBPlayers[b].name;
                    var value = matchResults[key] || 0;
                    holeMatchResults.push(value);
                }
            }
            matchResultsArray.push(holeMatchResults);
        }
        
        // Build display rows arrays (convert "AS" to "S" for storage, but keep original for viewer)
        var t1RowArray = [];
        var t2RowArray = [];
        var strkRowArray = [];
        
        for (var pos = 0; pos < 18; pos++) {
            t1RowArray.push(t1Row[pos] === "AS" ? "S" : t1Row[pos]);
            t2RowArray.push(t2Row[pos] === "AS" ? "S" : t2Row[pos]);
            strkRowArray.push(strkRow[pos] === "AS" ? "S" : strkRow[pos]);
        }
        
        return {
            f1Scores: f1Scores,           // 18 x 4 array
            f2Scores: f2Scores,           // 18 x 4 array
            matchResults: matchResultsArray,  // 18 x 16 array
            trTeamA: trTeamA,             // array of 18 numbers
            trTeamB: trTeamB,             // array of 18 numbers
            teamAGreen: teamAGreen,       // array of 18 booleans
            teamBGreen: teamBGreen,       // array of 18 booleans
            t1Row: t1RowArray,            // array of 18 strings ("A", "B", "S")
            t2Row: t2RowArray,            // array of 18 strings
            strkRow: strkRowArray         // array of 18 strings
        };
    }
    
    // ============================================================
    // Create pending archive record (NO ENCODING)
    // ============================================================
    
    function createPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataObj, flight2DataObj, matchResults, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for archive record");
            if (callback) callback(err, null);
            return;
        }
        
        // Check if an archive record already exists
        getExistingRecord(gameId, function(err, existing) {
            if (err) {
                console.error("Error checking existing record:", err);
                if (callback) callback(err, null);
                return;
            }
            
            if (existing && existing.id) {
                console.log("Archive record already exists for game:", gameId, "ID:", existing.id);
                if (callback) callback(null, existing.id);
                return;
            }
            
            console.log("No existing archive record found. Creating new one for game:", gameId);
            
            // Determine winner
            var winner = "Tie";
            var winnerText = "Tie Game!";
            if (finalScores.teamA > finalScores.teamB) {
                winner = "A";
                winnerText = "Team A Wins!";
            } else if (finalScores.teamB > finalScores.teamA) {
                winner = "B";
                winnerText = "Team B Wins!";
            }
            
            // Get data for hole data object
            var allPlayers = gameData.players || [];
            var startingHole = gameData.startingHole || 1;
            var trTeamA = results.tr?.teamA || new Array(18).fill(9.5);
            var trTeamB = results.tr?.teamB || new Array(18).fill(9.5);
            var teamAGreen = results.tr?.teamAGreen || new Array(18).fill(true);
            var teamBGreen = results.tr?.teamBGreen || new Array(18).fill(true);
            var t1Row = results.game2?.flight1?.leader || new Array(18).fill("AS");
            var t2Row = results.game2?.flight2?.leader || new Array(18).fill("AS");
            var strkRow = results.game3?.leader || new Array(18).fill("AS");
            
            // Build hole data object (NO ENCODING)
            var holeDataObject = {};
            try {
                holeDataObject = buildHoleDataObject(
                    flight1DataObj || {},
                    flight2DataObj || {},
                    matchResults || {},
                    trTeamA, trTeamB, teamAGreen, teamBGreen,
                    t1Row, t2Row, strkRow,
                    allPlayers, startingHole
                );
                console.log("Hole data object built successfully");
            } catch(e) {
                console.error("Error building hole data object:", e);
            }
            
            // Build archive data
            var archiveData = {
                originalGameId: gameId,
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: "pending_handicap",
                version: 3,
                schema: "json_v1",
                
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
                
                // NEW: Simple JSON arrays - NO ENCODING
                holeData: holeDataObject,
                
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                var docRef = firebase.firestore().collection(COLLECTION).doc();
                archiveData.archiveId = docRef.id;
                
                docRef.set(archiveData).then(function() {
                    console.log("Pending archive record created (JSON format):", docRef.id);
                    if (callback) callback(null, docRef.id);
                }).catch(function(err) {
                    console.error("Error creating archive record:", err);
                    if (callback) callback(err, null);
                });
            } catch (err) {
                console.error("Exception creating archive record:", err);
                if (callback) callback(err, null);
            }
        });
    }
    
    // ============================================================
    // Update archive record with handicap adjustment
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
    // Get list of archived games
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
                        completedAt: data.completedAt,
                        hasHoleData: !!data.holeData,
                        version: data.version
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
    // Get archived game by original game ID
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
        updateWithHandicap: updateWithHandicap,
        getArchivedGame: getArchivedGame,
        getArchivedGames: getArchivedGames,
        getArchivedGameByOriginalId: getArchivedGameByOriginalId,
        getExistingRecord: getExistingRecord,
        deleteArchiveRecord: deleteArchiveRecord,
        buildHoleDataObject: buildHoleDataObject
    };
    
})();

/*
FILE: js/history-record.js
VERSION: 2.00
KEY CHANGES:
   - REMOVED: All encoding functions (encoding.js no longer required)
   - NEW: Stores hole data as simple JSON arrays instead of encoded string
   - NEW: buildHoleDataObject() creates structured object with all hole data
   - NEW: f1Scores, f2Scores, matchResults, trTeamA, trTeamB, teamAGreen, teamBGreen, t1Row, t2Row, strkRow
   - No encoding/decoding bugs - pure JavaScript arrays
   - Backward compatible: old records without holeData object will show error
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/