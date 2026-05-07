// FILE: js/game-data.js - VERSION 1.06
// String-based data manager for SICC Ryder Cup
// SUPPORT: previewSandboxes collection for PREVIEW mode

var GameData = (function() {
    
    var gameId = null;
    var gameMode = null;
    var editableFlight = null;
    var currentCourse = null;
    var currentPlayers = [];
    var startingHole = 1;
    var isPreviewSandbox = false;
    
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
    
    // ============================================================
    // Parse hole data from string
    // ============================================================
    
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
    
    // Update hole data string (works for ANY hole number)
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
    
    // ============================================================
    // Set course and generate default data
    // ============================================================
    
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
            isPreviewSandbox: isPreviewSandbox
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
    
    // Get collection name based on mode
    function getCollectionName() {
        if (isPreviewSandbox) {
            return "previewSandboxes";
        }
        return "scheduledGames";
    }
    
    // Save ANY hole number, ALWAYS set crossEvent for other flight
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
                console.log("Save successful - crossEvent set for other flight");
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
                    
                    console.log("Refresh completed - startingHole:", startingHole);
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
        
        // Check if this is a preview sandbox
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
                    
                    if (data.f1) {
                        flight1Data.data = data.f1.d || generateDefaultData(currentCourse ? currentCourse.par : null);
                        flight1Data.saveEvent = data.f1.se || false;
                        flight1Data.crossEvent = data.f1.x || false;
                    } else if (data.flight1) {
                        // Fallback for old structure
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
                    
                    console.log("Game loaded - startingHole:", startingHole, "isPreviewSandbox:", isPreviewSandbox);
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
        getPlayOrder: getPlayOrder,
        getNaturalOrder: getNaturalOrder,
        getDisplayHoleOrder: getDisplayHoleOrder,
        getNaturalOrderMapping: getNaturalOrderMapping,
        getHoleAtStoragePosition: getHoleAtStoragePosition,
        getStorageIndexForHole: getStorageIndexForHole
    };
})();