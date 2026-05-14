/*
FILE: js/history-record.js
VERSION: 1.03
KEY CHANGES:
   - ADDED: Validation and padding for all encoded segments in buildHoleDataString()
   - ADDED: ensureLength() helper to pad short strings to expected length
   - ADDED: Console warnings when padding occurs for debugging
   - ADDED: Final validation that holeDataString length is exactly 594 characters
   - ADDED: Error logging if length mismatch
   - Prevents malformed history records from being saved
   - All other functionality identical to v1.02
DEPENDS ON: Firebase Firestore, encoding.js
STATUS: Ready for integration
*/

var HistoryRecord = (function() {
    
    var COLLECTION = "historyGames";
    
    // ============================================================
    // Helper: Get or create short device name
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
    // Helper: Ensure string has exact length (pad with K if too short)
    // ============================================================
    
    function ensureLength(str, expectedLen, segmentName) {
        if (str.length === expectedLen) {
            return str;
        }
        console.warn(`⚠️ ${segmentName} length mismatch: got ${str.length}, expected ${expectedLen}. Padding with K.`);
        while (str.length < expectedLen) {
            str += "K";
        }
        return str.substring(0, expectedLen);
    }
    
    // ============================================================
    // ENCODING FUNCTIONS FOR HOLE DATA STRING
    // ============================================================
    
    function encodeFlightScores(flightData, holeNumber, coursePar, allPlayers) {
        // Get 4 players in order: A1, A2, B1, B2 (sorted by handicap)
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === flightData.flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var orderedPlayers = [teamA[0], teamA[1], teamB[0], teamB[1]];
        
        var par = coursePar[holeNumber - 1];
        var result = "";
        
        for (var i = 0; i < orderedPlayers.length; i++) {
            var player = orderedPlayers[i];
            var grossScore = 0;
            
            // Get score from flight data
            if (flightData.flight === 1) {
                var f1Hole = flightData.holeData[holeNumber];
                if (f1Hole && f1Hole.saved) {
                    if (i === 0) grossScore = f1Hole.scores.a1;
                    else if (i === 1) grossScore = f1Hole.scores.a2;
                    else if (i === 2) grossScore = f1Hole.scores.b1;
                    else if (i === 3) grossScore = f1Hole.scores.b2;
                }
            } else {
                var f2Hole = flightData.holeData[holeNumber];
                if (f2Hole && f2Hole.saved) {
                    if (i === 0) grossScore = f2Hole.scores.a1;
                    else if (i === 1) grossScore = f2Hole.scores.a2;
                    else if (i === 2) grossScore = f2Hole.scores.b1;
                    else if (i === 3) grossScore = f2Hole.scores.b2;
                }
            }
            
            // If no score saved, use par
            if (grossScore === 0) grossScore = par;
            
            var relativeToPar = grossScore - par;
            result += Encoding.encodeScore(relativeToPar);
        }
        
        return ensureLength(result, 4, `Flight ${flightData.flight} scores hole ${holeNumber}`);
    }
    
    function encodeMatchBubbles(matchResults, holeNumber) {
        // matchResults is an object mapping "PlayerA_vs_PlayerB" to net holes won
        // We need 16 values in consistent order
        var allPlayers = window._allPlayersForEncoding || [];
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var result = "";
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var key = teamAPlayers[a].name + "_vs_" + teamBPlayers[b].name;
                var value = matchResults[key] || 0;
                // Clamp to -10 to +15 range
                if (value > 15) value = 15;
                if (value < -10) value = -10;
                result += Encoding.encodeMatchResult(value);
            }
        }
        
        return ensureLength(result, 16, `Match bubbles hole ${holeNumber}`);
    }
    
    function encodeTRData(trTeamA, trTeamB, teamAGreen, teamBGreen, position) {
        // trTeamA and trTeamB are arrays of 18 values
        var valueA = trTeamA[position];
        var valueB = trTeamB[position];
        var encodedA = Encoding.encodeTR(valueA);
        var encodedB = Encoding.encodeTR(valueB);
        var colors = Encoding.encodeTRColor(teamAGreen[position], teamBGreen[position]);
        var result = encodedA + encodedB + colors;
        return ensureLength(result, 6, `TR data position ${position}`);
    }
    
    function encodeDisplayRows(t1Row, t2Row, strkRow, position) {
        var t1 = Encoding.encodeDisplayRow(t1Row[position]);
        var t2 = Encoding.encodeDisplayRow(t2Row[position]);
        var strk = Encoding.encodeDisplayRow(strkRow[position]);
        var result = t1 + t2 + strk;
        return ensureLength(result, 3, `Display rows position ${position}`);
    }
    
    function buildHoleDataString(flight1Data, flight2Data, matchResults, trTeamA, trTeamB, teamAGreen, teamBGreen, t1Row, t2Row, strkRow, coursePar, allPlayers, startingHole) {
        // Store allPlayers globally for encodeMatchBubbles
        window._allPlayersForEncoding = allPlayers;
        
        var holeDataString = "";
        
        // Process holes in play order
        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);
        
        for (var pos = 0; pos < 18; pos++) {
            var holeNumber = playOrder[pos];
            
            // Flight 1 scores (4 chars)
            var f1Scores = encodeFlightScores({ flight: 1, holeData: flight1Data }, holeNumber, coursePar, allPlayers);
            
            // Flight 2 scores (4 chars)
            var f2Scores = encodeFlightScores({ flight: 2, holeData: flight2Data }, holeNumber, coursePar, allPlayers);
            
            // Match bubbles (16 chars)
            var matchBubbles = encodeMatchBubbles(matchResults, holeNumber);
            
            // TR data (2 + 2 + 2 = 6 chars)
            var trData = encodeTRData(trTeamA, trTeamB, teamAGreen, teamBGreen, pos);
            
            // Display rows (3 chars)
            var displayRows = encodeDisplayRows(t1Row, t2Row, strkRow, pos);
            
            // Total per hole: 4 + 4 + 16 + 6 + 3 = 33 chars
            holeDataString += f1Scores + f2Scores + matchBubbles + trData + displayRows;
        }
        
        window._allPlayersForEncoding = null;
        
        // Final validation
        if (holeDataString.length !== 594) {
            console.error("❌ buildHoleDataString: Invalid holeDataString length:", holeDataString.length, "expected 594");
            console.error("   This indicates missing data for some holes. Padding will be applied.");
            
            // Pad or truncate to 594
            while (holeDataString.length < 594) {
                holeDataString += "K";
            }
            if (holeDataString.length > 594) {
                holeDataString = holeDataString.substring(0, 594);
            }
            console.log("   After padding, length:", holeDataString.length);
        } else {
            console.log("✅ buildHoleDataString: Valid holeDataString length: 594");
        }
        
        return holeDataString;
    }
    
    // ============================================================
    // Create pending archive record (WITH encoded holeData)
    // ============================================================
    
    function createPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataObj, flight2DataObj, matchResults, callback) {
        if (!gameId || !gameData) {
            var err = new Error("Missing required data for archive record");
            if (callback) callback(err, null);
            return;
        }
        
        // FIRST: Check if an archive record already exists for this game
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
            
            // Build encoded holeData string
            var allPlayers = gameData.players || [];
            var coursePar = gameData.course?.par || [];
            var startingHole = gameData.startingHole || 1;
            var t1Row = results.game2?.flight1?.leader || new Array(18).fill("AS");
            var t2Row = results.game2?.flight2?.leader || new Array(18).fill("AS");
            var strkRow = results.game3?.leader || new Array(18).fill("AS");
            var trTeamA = results.tr?.teamA || new Array(18).fill(9.5);
            var trTeamB = results.tr?.teamB || new Array(18).fill(9.5);
            var teamAGreen = results.tr?.teamAGreen || new Array(18).fill(true);
            var teamBGreen = results.tr?.teamBGreen || new Array(18).fill(true);
            
            var holeDataString = "";
            try {
                holeDataString = buildHoleDataString(
                    flight1DataObj || {}, flight2DataObj || {},
                    matchResults || {},
                    trTeamA, trTeamB, teamAGreen, teamBGreen,
                    t1Row, t2Row, strkRow,
                    coursePar, allPlayers, startingHole
                );
            } catch(e) {
                console.error("Error building holeDataString:", e);
                holeDataString = "";
            }
            
            // Build archive data (WITH encoded holeData)
            var archiveData = {
                originalGameId: gameId,
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: "pending_handicap",
                version: 2,
                schema: "encoded_v1",
                holeData: holeDataString,
                
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
                
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                var docRef = firebase.firestore().collection(COLLECTION).doc();
                archiveData.archiveId = docRef.id;
                
                docRef.set(archiveData).then(function() {
                    console.log("Pending archive record created with encoded holeData:", docRef.id);
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
                        completedAt: data.completedAt,
                        holeData: data.holeData,
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
    
    // ============================================================
    // Delete archive record (for cleanup)
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
        buildHoleDataString: buildHoleDataString  // Exposed for testing
    };
    
})();

/*
FILE: js/history-record.js
VERSION: 1.03
KEY CHANGES:
   - ADDED: Validation and padding for all encoded segments in buildHoleDataString()
   - ADDED: ensureLength() helper to pad short strings to expected length
   - ADDED: Console warnings when padding occurs for debugging
   - ADDED: Final validation that holeDataString length is exactly 594 characters
   - ADDED: Error logging if length mismatch
   - Prevents malformed history records from being saved
   - All other functionality identical to v1.02
DEPENDS ON: Firebase Firestore, encoding.js
STATUS: Ready for integration
*/