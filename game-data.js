// FILE: js/game-data.js - VERSION 1.01
// String-based data manager for SICC Ryder Cup

var GameData = (function() {
    
    var gameId = null;
    var gameMode = null;
    var editableFlight = null;
    var currentCourse = null;
    var currentPlayers = [];
    
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
    
    var dataCallbacks = [];
    var errorCallbacks = [];
    
    // Generate default data string (all F, all scores = par)
    function generateDefaultData(parArray) {
        if (!parArray || parArray.length !== 18) {
            // Default par 4 for all holes if course not loaded
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
    
    // Parse hole data from string
    function parseHoleData(dataString, holeNumber) {
        if (!dataString || dataString.length !== 162) {
            return null;
        }
        
        var startIndex = (holeNumber - 1) * 9;
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
    
    // Update hole data string
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
        
        var startIndex = (holeNumber - 1) * 9;
        var newData = existingData.substr(0, startIndex) + newHoleSegment + existingData.substr(startIndex + 9);
        
        return newData;
    }
    
    // Set course and generate default data
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
    
    function setFlightData(flight, data, saveEvent, crossEvent) {
        if (flight === 1) {
            flight1Data.data = data;
            flight1Data.saveEvent = saveEvent || false;
            flight1Data.crossEvent = crossEvent || false;
        } else {
            flight2Data.data = data;
            flight2Data.saveEvent = saveEvent || false;
            flight2Data.crossEvent = crossEvent || false;
        }
    }
    
    function getModeDisplay() {
        if (gameMode === "real") return "LIVE";
        if (gameMode === "preview") return "PREVIEW";
        if (gameMode === "practice") return "PRACTICE";
        return "READY";
    }
    
    function getModeClass() {
        if (gameMode === "real") return "status-real";
        if (gameMode === "preview") return "status-preview";
        if (gameMode === "practice") return "status-practice";
        return "status-real";
    }
    
    function getGameMetadata() {
        return {
            gameMode: gameMode,
            editableFlight: editableFlight,
            gameId: gameId
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
    
    function saveCurrentHole(holeNumber, scores, parArray, callback) {
        var flight = (editableFlight === 1) ? 1 : 2;
        
        // Get current data for this flight
        var flightData = (flight === 1) ? flight1Data.data : flight2Data.data;
        
        // Update the hole data with saved flag = true
        var newData = updateHoleData(flightData, holeNumber, scores, true);
        
        // Prepare update for Firebase
        var collection = (gameMode === "practice") ? "practiceGames" : "scheduledGames";
        var updatePayload = {};
        var flightField = (flight === 1) ? "flight1" : "flight2";
        
        updatePayload[flightField + ".data"] = newData;
        updatePayload[flightField + ".saveEvent"] = true;
        
        // Set crossEvent for the other flight
        var otherFlightField = (flight === 1) ? "flight2" : "flight1";
        updatePayload[otherFlightField + ".crossEvent"] = true;
        updatePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        firebase.firestore().collection(collection).doc(gameId).update(updatePayload)
            .then(function() {
                // Update local data
                if (flight === 1) {
                    flight1Data.data = newData;
                    flight1Data.saveEvent = true;
                    flight2Data.crossEvent = true;
                } else {
                    flight2Data.data = newData;
                    flight2Data.saveEvent = true;
                    flight1Data.crossEvent = true;
                }
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
        
        var collection = (gameMode === "practice") ? "practiceGames" : "scheduledGames";
        firebase.firestore().collection(collection).doc(gameId).get()
            .then(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    if (data.flight1) {
                        flight1Data.data = data.flight1.data || flight1Data.data;
                        flight1Data.saveEvent = data.flight1.saveEvent || false;
                        flight1Data.crossEvent = data.flight1.crossEvent || false;
                    }
                    if (data.flight2) {
                        flight2Data.data = data.flight2.data || flight2Data.data;
                        flight2Data.saveEvent = data.flight2.saveEvent || false;
                        flight2Data.crossEvent = data.flight2.crossEvent || false;
                    }
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
        
        var userRole = session.userRole || activeGame.role;
        
        if (userRole === "update1") {
            editableFlight = 1;
        } else if (userRole === "update2") {
            editableFlight = 2;
        } else if (userRole === "view") {
            editableFlight = null;
        } else {
            if (gameMode === "preview" || gameMode === "practice") {
                editableFlight = 1;
            } else {
                editableFlight = null;
            }
        }
        
        var collection = activeGame.collection || (gameMode === "practice" ? "practiceGames" : "scheduledGames");
        
        firebase.firestore().collection(collection).doc(gameId).get()
            .then(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    
                    if (data.flight1) {
                        flight1Data.data = data.flight1.data || generateDefaultData(currentCourse ? currentCourse.par : null);
                        flight1Data.saveEvent = data.flight1.saveEvent || false;
                        flight1Data.crossEvent = data.flight1.crossEvent || false;
                    }
                    if (data.flight2) {
                        flight2Data.data = data.flight2.data || generateDefaultData(currentCourse ? currentCourse.par : null);
                        flight2Data.saveEvent = data.flight2.saveEvent || false;
                        flight2Data.crossEvent = data.flight2.crossEvent || false;
                    }
                    
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
    
    return {
        setCourse: setCourse,
        setPlayers: setPlayers,
        getFlightData: getFlightData,
        setFlightData: setFlightData,
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
        clearSaveEvent: clearSaveEvent
    };
})();