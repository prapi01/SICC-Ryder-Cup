/*
FILE: js/game-data.js
VERSION: 2.05
KEY CHANGES from v2.04:
   - ADDED: getLastHole(startingHole) - returns the last hole based on starting hole
   - ADDED: isLastHole(holeNumber, startingHole) - returns true if hole is the last hole
   - ADDED: isFirstHole(holeNumber, startingHole) - returns true if hole is the first hole
   - ADDED: getPlayOrderWithLastHole() - returns play order with last hole highlighted
   - These utilities are shared across all game files for consistent last-hole logic
   - All existing functions unchanged
DEPENDS ON: None
STATUS: Ready for integration
*/

// FILE: js/game-data.js - VERSION 2.05
// String-based data manager for SICC Ryder Cup
// ADDED: getMatchValueFromResults() for shared match bubble logic
// ADDED: last hole utilities based on starting hole

var GameData = (function() {
    
    var gameId = null;
    var gameMode = null;
    var editableFlight = null;
    var currentCourse = null;
    var currentPlayers = [];
    var startingHole = 1;
    var isPreviewSandbox = false;
    var teamGameFormat = "tournament";
    
    var flight1Data = {
        data: "",
        saveEvent: false,
        crossEvent: false
    };
    
    var flight2Data = {
        data: "",
        saveEvent: false,
        crossEvent: false
    };
    
    var locks = {
        f1: null,
        f2: null
    };
    
    var dataCallbacks = [];
    var errorCallbacks = [];
    
    // ============================================================
    // SHOTGUN START HELPER FUNCTIONS
    // ============================================================
    
    function getStartingHole() {
        return startingHole;
    }
    
    function setStartingHole(hole) {
        startingHole = hole;
    }
    
    function getTeamGameFormat() {
        return teamGameFormat;
    }
    
    function getPlayOrder() {
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    function getNaturalOrder() {
        var order = [];
        for (var i = 1; i <= 18; i++) order.push(i);
        return order;
    }
    
    // ============================================================
    // v2.05: LAST HOLE UTILITIES (based on starting hole)
    // ============================================================
    
    /**
     * Get the last hole of the game based on starting hole
     * @param {number} startHole - The starting hole (1-18)
     * @returns {number} - The last hole number
     * 
     * Examples:
     * - startHole = 1  → lastHole = 18
     * - startHole = 10 → lastHole = 9
     * - startHole = 5  → lastHole = 4
     */
    function getLastHole(startHole) {
        var start = (startHole !== undefined) ? startHole : startingHole;
        return (start === 1) ? 18 : start - 1;
    }
    
    /**
     * Check if a given hole is the last hole of the game
     * @param {number} holeNumber - The hole to check
     * @param {number} startHole - The starting hole (optional, defaults to current)
     * @returns {boolean} - True if this is the last hole
     */
    function isLastHole(holeNumber, startHole) {
        var start = (startHole !== undefined) ? startHole : startingHole;
        return holeNumber === getLastHole(start);
    }
    
    /**
     * Check if a given hole is the first hole of the game
     * @param {number} holeNumber - The hole to check
     * @param {number} startHole - The starting hole (optional, defaults to current)
     * @returns {boolean} - True if this is the first hole
     */
    function isFirstHole(holeNumber, startHole) {
        var start = (startHole !== undefined) ? startHole : startingHole;
        return holeNumber === start;
    }
    
    /**
     * Get the play order with the last hole marked (for debugging)
     * @returns {Array} - Array of holes with 'last' flag
     */
    function getPlayOrderWithLastHole() {
        var order = getPlayOrder();
        var lastHole = getLastHole();
        return order.map(function(hole) {
            return { hole: hole, isLast: (hole === lastHole) };
        });
    }
    
    function getStorageIndexForHole(actualHoleNumber) {
        if (startingHole === 1) {
            return actualHoleNumber - 1;
        }
        var playOrder = getPlayOrder();
        for (var i = 0; i < playOrder.length; i++) {
            if (playOrder[i] === actualHoleNumber) return i;
        }
        return actualHoleNumber - 1;
    }
    
    function getHoleAtStoragePosition(storageIndex) {
        if (startingHole === 1) {
            return storageIndex + 1;
        }
        var playOrder = getPlayOrder();
        return playOrder[storageIndex];
    }
    
    function getNaturalOrderMapping() {
        var mapping = [];
        for (var hole = 1; hole <= 18; hole++) {
            mapping.push(getStorageIndexForHole(hole));
        }
        return mapping;
    }
    
    function getDisplayOrder(preference) {
        if (preference === "natural") {
            return getNaturalOrder();
        } else {
            return getPlayOrder();
        }
    }
    
    function getDisplayHoleOrder(preference) {
        if (preference === "natural") {
            return getNaturalOrder();
        } else {
            return getPlayOrder();
        }
    }
    
    // ============================================================
    // v2.04: Convert storage positions to actual hole numbers
    // ============================================================
    
    function getSavedHolesFromString(dataString) {
        var saved = [];
        if (!dataString) return saved;
        
        var i = 0;
        var storagePos = 0;
        while (i < dataString.length && storagePos < 18) {
            if (dataString[i] === 'T') {
                var actualHole = getHoleAtStoragePosition(storagePos);
                saved.push(actualHole);
                i += 9;
            } else if (dataString[i] === 'F') {
                i += 9;
            } else {
                i++;
            }
            storagePos++;
        }
        return saved;
    }
    
    // ============================================================
    // Consistent Match Index for Match Bubbles
    // ============================================================
    
    function getMatchIndex(playerName, opponentName, allPlayers) {
        if (!allPlayers || allPlayers.length === 0) {
            console.warn('getMatchIndex: no players provided');
            return -1;
        }
        
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var aIndex = -1;
        var bIndex = -1;
        
        for (var i = 0; i < teamAPlayers.length; i++) {
            if (teamAPlayers[i].name === playerName) {
                aIndex = i;
                break;
            }
        }
        
        for (var i = 0; i < teamBPlayers.length; i++) {
            if (teamBPlayers[i].name === opponentName) {
                bIndex = i;
                break;
            }
        }
        
        if (aIndex === -1 || bIndex === -1) {
            return -1;
        }
        
        return (aIndex * teamBPlayers.length) + bIndex;
    }
    
    function getMatchValueFromResults(results, player, opponent, holeNumber, allPlayers, getHolePositionFn) {
        if (!results || !results.matchResults) return 0;
        
        var position = getHolePositionFn(holeNumber);
        var matchResultsArray = results.matchResults[position];
        if (!matchResultsArray) return 0;
        
        var teamAPlayer, teamBPlayer;
        if (player.team === "A" && opponent.team === "B") {
            teamAPlayer = player;
            teamBPlayer = opponent;
        } else if (player.team === "B" && opponent.team === "A") {
            teamAPlayer = opponent;
            teamBPlayer = player;
        } else {
            return 0;
        }
        
        var matchIndex = getMatchIndex(teamAPlayer.name, teamBPlayer.name, allPlayers);
        if (matchIndex === -1) return 0;
        
        var value = matchResultsArray[matchIndex] || 0;
        
        if (player.team === "B") {
            return -value;
        }
        return value;
    }
    
    // ============================================================
    // Generate default data string (all F, all scores = par)
    // ============================================================
    
    function generateDefaultData(parArray) {
        if (!parArray || parArray.length !== 18) {
            var defaultPar = "04";
            var result = "";
            for (var i = 0; i < 18; i++) {
                result += "F" + defaultPar + defaultPar + defaultPar + defaultPar;
            }
            return result;
        }
        
        var result = "";
        for (var h = 0; h < 18; h++) {
            var par = parArray[h];
            var parStr = par.toString().padStart(2, '0');
            result += "F" + parStr + parStr + parStr + parStr;
        }
        return result;
    }
    
    function rotateDataString(naturalData, startingHoleVal) {
        if (startingHoleVal === 1) return naturalData;
        
        var blocks = [];
        for (var i = 0; i < 18; i++) {
            blocks.push(naturalData.substr(i * 9, 9));
        }
        
        var rotated = [];
        for (var i = startingHoleVal - 1; i < 18; i++) rotated.push(blocks[i]);
        for (var i = 0; i < startingHoleVal - 1; i++) rotated.push(blocks[i]);
        
        return rotated.join('');
    }
    
    function parseHoleData(dataString, holeNumber) {
        if (!dataString || dataString.length !== 162) {
            return null;
        }
        
        var storageIndex = getStorageIndexForHole(holeNumber);
        var startIndex = storageIndex * 9;
        
        if (startIndex + 9 > dataString.length) {
            return null;
        }
        
        var holeSegment = dataString.substr(startIndex, 9);
        var savedFlag = holeSegment.charAt(0);
        var scores = {
            a1: parseInt(holeSegment.substr(1, 2), 10),
            a2: parseInt(holeSegment.substr(3, 2), 10),
            b1: parseInt(holeSegment.substr(5, 2), 10),
            b2: parseInt(holeSegment.substr(7, 2), 10)
        };
        
        return {
            saved: savedFlag === 'T',
            scores: scores
        };
    }
    
    function updateHoleData(existingData, holeNumber, scores, isSaved) {
        if (!existingData || existingData.length !== 162) {
            existingData = generateDefaultData(currentCourse ? currentCourse.par : null);
        }
        
        var savedFlag = isSaved ? 'T' : 'F';
        var a1Str = scores.a1.toString().padStart(2, '0');
        var a2Str = scores.a2.toString().padStart(2, '0');
        var b1Str = scores.b1.toString().padStart(2, '0');
        var b2Str = scores.b2.toString().padStart(2, '0');
        
        var newHoleSegment = savedFlag + a1Str + a2Str + b1Str + b2Str;
        
        var storageIndex = getStorageIndexForHole(holeNumber);
        var startIndex = storageIndex * 9;
        var newData = existingData.substr(0, startIndex) + newHoleSegment + existingData.substr(startIndex + 9);
        
        return newData;
    }
    
    function initializeEmptyResults() {
        return {
            version: 1,
            matchResults: new Array(18),
            f1IntraMatches: new Array(18),
            f2IntraMatches: new Array(18),
            game1: { matches: {}, pointsA: new Array(18).fill(8), pointsB: new Array(18).fill(8) },
            game2: {
                flight1: { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null },
                flight2: { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null },
                pointsA: new Array(18).fill(1),
                pointsB: new Array(18).fill(1)
            },
            game3: { leader: new Array(18).fill("AS"), nettA: new Array(18).fill(0), nettB: new Array(18).fill(0), pointsA: new Array(18).fill(0.5), pointsB: new Array(18).fill(0.5) },
            tr: { 
                teamA: new Array(18).fill(null), 
                teamB: new Array(18).fill(null), 
                teamAGreen: new Array(18).fill(false), 
                teamBGreen: new Array(18).fill(false) 
            },
            lastComputedAt: null,
            clinchedAt: {},
            playerTotals: {}
        };
    }
    
    function resetFullGame(gameIdParam, startingHoleParam, courseParArray, callback) {
        if (!gameIdParam) {
            console.error("resetFullGame: No gameId provided");
            if (callback) callback(false);
            return;
        }
        
        var naturalData = generateDefaultData(courseParArray);
        var rotatedData = rotateDataString(naturalData, startingHoleParam);
        var freshResults = initializeEmptyResults();
        
        var collection = isPreviewSandbox ? "previewSandboxes" : "scheduledGames";
        
        var resetData = {
            "f1.d": rotatedData,
            "f1.se": false,
            "f1.x": false,
            "f2.d": rotatedData,
            "f2.se": false,
            "f2.x": false,
            "locks.f1": null,
            "locks.f2": null,
            "currentHoleF1": 1,
            "currentHoleF2": 1,
            "gameStarted": false,
            "results": freshResults,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        firebase.firestore().collection(collection).doc(gameIdParam).update(resetData)
            .then(function() {
                console.log("Full game reset completed");
                flight1Data.data = rotatedData;
                flight1Data.saveEvent = false;
                flight1Data.crossEvent = false;
                flight2Data.data = rotatedData;
                flight2Data.saveEvent = false;
                flight2Data.crossEvent = false;
                locks.f1 = null;
                locks.f2 = null;
                if (callback) callback(true);
            })
            .catch(function(e) {
                console.error("Full reset error:", e);
                if (callback) callback(false);
            });
    }
    
    function setCourse(course) {
        currentCourse = course;
        if (course && course.par) {
            var defaultData = generateDefaultData(course.par);
            if (!flight1Data.data || flight1Data.data.length !== 162) {
                flight1Data.data = defaultData;
            }
            if (!flight2Data.data || flight2Data.data.length !== 162) {
                flight2Data.data = defaultData;
            }
        }
    }
    
    function setPlayers(players) {
        currentPlayers = players;
    }
    
    function getFlightData(flight) {
        return flight === 1 ? flight1Data : flight2Data;
    }
    
    function getLocks() {
        return locks;
    }
    
    function isFlightLocked(flight, deviceId) {
        var lock = flight === 1 ? locks.f1 : locks.f2;
        if (!lock) return false;
        if (lock.ex && lock.ex < Date.now()) return false;
        if (deviceId && lock.did === deviceId) return false;
        return true;
    }
    
    function getModeDisplay() {
        if (gameMode === "real") return "LIVE";
        if (gameMode === "preview") return "PREVIEW";
        return "READY";
    }
    
    function getModeClass() {
        if (gameMode === "real") return "status-real";
        if (gameMode === "preview") return "status-preview";
        return "status-real";
    }
    
    function getGameMetadata() {
        return {
            gameMode: gameMode,
            editableFlight: editableFlight,
            gameId: gameId,
            startingHole: startingHole,
            isPreviewSandbox: isPreviewSandbox,
            teamGameFormat: teamGameFormat
        };
    }
    
    function setCallbacks(dataCallback, errorCallback) {
        if (dataCallback) dataCallbacks.push(dataCallback);
        if (errorCallback) errorCallbacks.push(errorCallback);
    }
    
    function notifyDataChanged() {
        for (var i = 0; i < dataCallbacks.length; i++) {
            try {
                dataCallbacks[i]();
            } catch(e) {
                console.error("Data callback error:", e);
            }
        }
    }
    
    function notifyError(msg) {
        for (var i = 0; i < errorCallbacks.length; i++) {
            try {
                errorCallbacks[i](msg);
            } catch(e) {}
        }
    }
    
    function hasPendingCrossEvent() {
        return flight1Data.crossEvent || flight2Data.crossEvent;
    }
    
    function hasPendingSaveEvent() {
        return flight1Data.saveEvent || flight2Data.saveEvent;
    }
    
    function clearCrossEvent() {
        flight1Data.crossEvent = false;
        flight2Data.crossEvent = false;
    }
    
    function clearSaveEvent() {
        flight1Data.saveEvent = false;
        flight2Data.saveEvent = false;
    }
    
    function getCollectionName() {
        if (isPreviewSandbox) {
            return "previewSandboxes";
        }
        return "scheduledGames";
    }
    
    function saveCurrentHole(holeNumber, scores, parArray, callback) {
        var flight = (editableFlight === 1) ? 1 : 2;
        
        var flightData = (flight === 1) ? flight1Data.data : flight2Data.data;
        var newData = updateHoleData(flightData, holeNumber, scores, true);
        
        var collection = getCollectionName();
        var updatePayload = {};
        var flightField = (flight === 1) ? "f1" : "f2";
        var otherFlightField = (flight === 1) ? "f2" : "f1";
        
        updatePayload[flightField + ".d"] = newData;
        updatePayload[flightField + ".se"] = true;
        updatePayload[otherFlightField + ".x"] = true;
        updatePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        firebase.firestore().collection(collection).doc(gameId).update(updatePayload)
            .then(function() {
                if (flight === 1) {
                    flight1Data.data = newData;
                    flight1Data.saveEvent = true;
                    flight2Data.crossEvent = true;
                } else {
                    flight2Data.data = newData;
                    flight2Data.saveEvent = true;
                    flight1Data.crossEvent = true;
                }
                console.log("Save successful");
                notifyDataChanged();
                if (callback) callback(true);
            })
            .catch(function(err) {
                console.error("Save error:", err);
                notifyError("Save failed: " + err.message);
                if (callback) callback(false);
            });
    }
    
    function forceRefresh() {
        if (!gameId) return;
        
        var collection = getCollectionName();
        firebase.firestore().collection(collection).doc(gameId).get()
            .then(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    
                    if (data.f1) {
                        flight1Data.data = data.f1.d || flight1Data.data;
                        flight1Data.saveEvent = data.f1.se || false;
                        flight1Data.crossEvent = data.f1.x || false;
                    }
                    if (data.f2) {
                        flight2Data.data = data.f2.d || flight2Data.data;
                        flight2Data.saveEvent = data.f2.se || false;
                        flight2Data.crossEvent = data.f2.x || false;
                    }
                    
                    if (data.locks) {
                        locks.f1 = data.locks.f1 || null;
                        locks.f2 = data.locks.f2 || null;
                    }
                    
                    if (data.startingHole) {
                        startingHole = data.startingHole;
                    } else {
                        startingHole = 1;
                    }
                    
                    if (data.teamGameFormat) {
                        teamGameFormat = data.teamGameFormat;
                    } else {
                        teamGameFormat = "tournament";
                    }
                    
                    console.log("Refresh completed");
                    notifyDataChanged();
                }
            })
            .catch(function(err) {
                console.error("Refresh error:", err);
            });
    }
    
    function loadGameFromSession(session, callback) {
        var activeGame = session.activeGame;
        if (!activeGame || !activeGame.gameId) {
            notifyError("No active game in session");
            if (callback) callback(false);
            return;
        }
        
        gameId = activeGame.gameId;
        gameMode = activeGame.gameMode || activeGame.gameType || "real";
        editableFlight = null;
        
        isPreviewSandbox = (activeGame.collection === "previewSandboxes");
        
        var userRole = session.userRole || activeGame.role;
        
        if (userRole === "update1") {
            editableFlight = 1;
        } else if (userRole === "update2") {
            editableFlight = 2;
        } else if (userRole === "view") {
            editableFlight = null;
        } else {
            if (gameMode === "preview") {
                editableFlight = 1;
            } else {
                editableFlight = null;
            }
        }
        
        var collection = getCollectionName();
        
        firebase.firestore().collection(collection).doc(gameId).get()
            .then(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    
                    if (data.startingHole) {
                        startingHole = data.startingHole;
                    } else {
                        startingHole = 1;
                    }
                    
                    if (data.teamGameFormat) {
                        teamGameFormat = data.teamGameFormat;
                    } else {
                        teamGameFormat = "tournament";
                    }
                    
                    if (data.f1) {
                        flight1Data.data = data.f1.d || generateDefaultData(currentCourse ? currentCourse.par : null);
                        flight1Data.saveEvent = data.f1.se || false;
                        flight1Data.crossEvent = data.f1.x || false;
                    } else if (data.flight1) {
                        flight1Data.data = data.flight1.data || generateDefaultData(currentCourse ? currentCourse.par : null);
                        flight1Data.saveEvent = data.flight1.saveEvent || false;
                        flight1Data.crossEvent = data.flight1.crossEvent || false;
                    }
                    
                    if (data.f2) {
                        flight2Data.data = data.f2.d || generateDefaultData(currentCourse ? currentCourse.par : null);
                        flight2Data.saveEvent = data.f2.se || false;
                        flight2Data.crossEvent = data.f2.x || false;
                    } else if (data.flight2) {
                        flight2Data.data = data.flight2.data || generateDefaultData(currentCourse ? currentCourse.par : null);
                        flight2Data.saveEvent = data.flight2.saveEvent || false;
                        flight2Data.crossEvent = data.flight2.crossEvent || false;
                    }
                    
                    if (data.locks) {
                        locks.f1 = data.locks.f1 || null;
                        locks.f2 = data.locks.f2 || null;
                    }
                    
                    console.log("Game loaded");
                    notifyDataChanged();
                    if (callback) callback(true);
                } else {
                    notifyError("Game document not found");
                    if (callback) callback(false);
                }
            })
            .catch(function(err) {
                console.error("Load game error:", err);
                notifyError("Failed to load game: " + err.message);
                if (callback) callback(false);
            });
    }
    
    // ============================================================
    // Public API - v2.05: Added last hole utilities
    // ============================================================
    
    return {
        setCourse: setCourse,
        setPlayers: setPlayers,
        getFlightData: getFlightData,
        getLocks: getLocks,
        isFlightLocked: isFlightLocked,
        parseHoleData: parseHoleData,
        getModeDisplay: getModeDisplay,
        getModeClass: getModeClass,
        getGameMetadata: getGameMetadata,
        setCallbacks: setCallbacks,
        saveCurrentHole: saveCurrentHole,
        forceRefresh: forceRefresh,
        loadGameFromSession: loadGameFromSession,
        hasPendingCrossEvent: hasPendingCrossEvent,
        hasPendingSaveEvent: hasPendingSaveEvent,
        clearCrossEvent: clearCrossEvent,
        clearSaveEvent: clearSaveEvent,
        getStartingHole: getStartingHole,
        setStartingHole: setStartingHole,
        getTeamGameFormat: getTeamGameFormat,
        getPlayOrder: getPlayOrder,
        getNaturalOrder: getNaturalOrder,
        getDisplayHoleOrder: getDisplayHoleOrder,
        getNaturalOrderMapping: getNaturalOrderMapping,
        getHoleAtStoragePosition: getHoleAtStoragePosition,
        getStorageIndexForHole: getStorageIndexForHole,
        resetFullGame: resetFullGame,
        initializeEmptyResults: initializeEmptyResults,
        getSavedHolesFromString: getSavedHolesFromString,
        // v2.05: Last hole utilities
        getLastHole: getLastHole,
        isLastHole: isLastHole,
        isFirstHole: isFirstHole,
        getPlayOrderWithLastHole: getPlayOrderWithLastHole,
        // Match index functions
        getMatchIndex: getMatchIndex,
        getMatchValueFromResults: getMatchValueFromResults
    };
})();

/*
FILE: js/game-data.js
VERSION: 2.05
KEY CHANGES from v2.04:
   - ADDED: getLastHole(startingHole) - returns the last hole based on starting hole
   - ADDED: isLastHole(holeNumber, startingHole) - returns true if hole is the last hole
   - ADDED: isFirstHole(holeNumber, startingHole) - returns true if hole is the first hole
   - ADDED: getPlayOrderWithLastHole() - returns play order with last hole highlighted
   - These utilities are shared across all game files for consistent last-hole logic
   - All existing functions unchanged
DEPENDS ON: None
STATUS: Ready for integration
*/