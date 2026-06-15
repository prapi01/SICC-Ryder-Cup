/*
FILE: js/game-loader.js
VERSION: 1.10
KEY CHANGES from v1.09:
   - FIXED: Converts sparse Firestore objects to proper arrays when building cache
   - displayT1, displayT2, flight1.leader, flight2.leader, cumulativePoints are now always arrays
   - Prevents "slice is not a function" errors and missing data issues
   - Maintains backward compatibility with existing caches
DEPENDS ON: Firebase Firestore, js/game-data.js, js/game-order.js
STATUS: Ready for integration
*/

// ============================================================
// GameLoader - Centralized data loading and caching
// ============================================================

var GameLoader = (function() {
    
    // Private variables
    var currentGameId = null;
    var currentCollection = null;
    var currentCache = null;
    var unsubscribe = null;
    var dataCallbacks = [];
    
    // ============================================================
    // Helper: Convert sparse Firestore object to array
    // v1.10: Critical fix for T-1 data corruption
    // ============================================================
    function sparseToArray(sparseObj, defaultValue, length) {
        var arr = new Array(length).fill(defaultValue);
        if (!sparseObj) return arr;
        
        // If it's already an array, return a copy
        if (Array.isArray(sparseObj)) {
            for (var i = 0; i < Math.min(sparseObj.length, length); i++) {
                if (sparseObj[i] !== undefined && sparseObj[i] !== null) {
                    arr[i] = sparseObj[i];
                }
            }
            return arr;
        }
        
        // It's a sparse object with numeric keys (Firestore format)
        for (var key in sparseObj) {
            var idx = parseInt(key);
            if (!isNaN(idx) && idx >= 0 && idx < length && sparseObj[key] !== undefined && sparseObj[key] !== null) {
                arr[idx] = sparseObj[key];
            }
        }
        return arr;
    }
    
    // ============================================================
    // Helper: Parse saved holes from data string
    // Uses GameData.getSavedHolesFromString() which handles starting hole conversion
    // ============================================================
    function getSavedHolesFromString(dataString) {
        if (typeof GameData !== 'undefined' && GameData.getSavedHolesFromString) {
            return GameData.getSavedHolesFromString(dataString);
        }
        
        var saved = [];
        if (!dataString) return saved;
        
        var i = 0;
        var holeNum = 1;
        while (i < dataString.length && holeNum <= 18) {
            if (dataString[i] === 'T') {
                saved.push(holeNum);
                i += 9;
            } else if (dataString[i] === 'F') {
                break;
            } else {
                i++;
            }
            holeNum++;
        }
        return saved;
    }
    
    // ============================================================
    // v1.09: Delegate to GameOrder for play order and conversions
    // ============================================================
    
    function getPlayOrder(startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayOrder) {
            // Ensure GameOrder has the correct starting hole
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getPlayOrder();
        }
        // Fallback
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    function getPlayPosition(holeNumber, startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayPosition) {
            // Ensure GameOrder has the correct starting hole
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getPlayPosition(holeNumber);
        }
        // Fallback
        var playOrder = getPlayOrder(startingHole);
        for (var i = 0; i < playOrder.length; i++) {
            if (playOrder[i] === holeNumber) return i;
        }
        return holeNumber - 1;
    }
    
    function getNaturalHole(playPosition, startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getNaturalHole) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getNaturalHole(playPosition);
        }
        // Fallback
        var playOrder = getPlayOrder(startingHole);
        return playOrder[playPosition] || 0;
    }
    
    // ============================================================
    // Helper: Get consecutive synced last PLAY POSITION
    // v1.09: Uses GameOrder for play order
    // ============================================================
    function getConsecutiveSyncedLastPosition(savedHolesF1, savedHolesF2, startingHole) {
        var playOrder = getPlayOrder(startingHole);
        var lastSyncedPosition = -1;
        
        for (var i = 0; i < playOrder.length; i++) {
            var hole = playOrder[i];
            if (savedHolesF1.indexOf(hole) !== -1 && savedHolesF2.indexOf(hole) !== -1) {
                lastSyncedPosition = i;
            } else {
                break;
            }
        }
        
        console.log('[GAME-LOADER] getConsecutiveSyncedLastPosition: startingHole=' + startingHole + ', lastSyncedPosition=' + lastSyncedPosition);
        return lastSyncedPosition;
    }
    
    // ============================================================
    // Helper: Calculate last synced hole using PLAY ORDER
    // Returns PLAY POSITION (0-17) for internal use
    // ============================================================
    function calculateLastSyncedPosition(savedHolesF1, savedHolesF2, startingHole) {
        var playOrder = getPlayOrder(startingHole);
        var lastSyncedPosition = -1;
        
        for (var i = 0; i < playOrder.length; i++) {
            var hole = playOrder[i];
            if (savedHolesF1.indexOf(hole) !== -1 && savedHolesF2.indexOf(hole) !== -1) {
                lastSyncedPosition = i;
            } else {
                break;
            }
        }
        
        console.log('[GAME-LOADER] calculateLastSyncedPosition: startingHole=' + startingHole + ', lastSyncedPosition=' + lastSyncedPosition);
        return lastSyncedPosition;
    }
    
    // ============================================================
    // Helper: Build cache from Firestore document
    // v1.10: Converts sparse Firestore objects to arrays
    // ============================================================
    function buildCacheFromDoc(docData) {
        var course = docData.course || {};
        var players = docData.players || [];
        var startingHole = docData.startingHole || 1;
        var teamGameFormat = docData.teamGameFormat || "tournament";
        var f1DataString = docData.f1?.d || "";
        var f2DataString = docData.f2?.d || "";
        var results = docData.results || null;
        var signatures = docData.signatures || { f1: false, f2: false };
        var submitted = docData.submitted || { f1: false, f2: false };
        var locks = docData.locks || { f1: null, f2: null };
        var gameStarted = docData.gameStarted || false;
        var gameComplete = (signatures.f1 && signatures.f2) || false;
        
        // Update GameOrder with starting hole
        if (typeof GameOrder !== 'undefined' && GameOrder.setStartingHole) {
            GameOrder.setStartingHole(startingHole);
        }
        
        // Parse flight data for each hole
        var flight1Data = {};
        var flight2Data = {};
        for (var h = 1; h <= 18; h++) {
            flight1Data[h] = GameData.parseHoleData(f1DataString, h);
            flight2Data[h] = GameData.parseHoleData(f2DataString, h);
        }
        
        // Get saved holes - uses GameData which now uses GameOrder
        var savedHoles = {
            1: getSavedHolesFromString(f1DataString),
            2: getSavedHolesFromString(f2DataString)
        };
        
        // Calculate last synced PLAY POSITION (0-17)
        var lastSyncedPosition = calculateLastSyncedPosition(savedHoles[1], savedHoles[2], startingHole);
        
        // For backward compatibility, provide natural hole of last synced position
        var lastSyncedHole = (lastSyncedPosition >= 0) ? getNaturalHole(lastSyncedPosition, startingHole) : 0;
        
        // ============================================================
        // v1.10: Convert sparse Firestore objects to arrays
        // This fixes the T-1 data corruption issue
        // ============================================================
        
        // Build displayT1 array
        var displayT1 = null;
        if (results?.game2?.displayT1) {
            displayT1 = sparseToArray(results.game2.displayT1, "AS", 18);
        }
        
        // Build displayT2 array
        var displayT2 = null;
        if (results?.game2?.displayT2) {
            displayT2 = sparseToArray(results.game2.displayT2, "AS", 18);
        }
        
        // Build flight1.leader array
        var flight1Leader = null;
        if (results?.game2?.flight1?.leader) {
            flight1Leader = sparseToArray(results.game2.flight1.leader, "AS", 18);
        }
        
        // Build flight1.cumulativePoints array
        var flight1Cumulative = null;
        if (results?.game2?.flight1?.cumulativePoints) {
            flight1Cumulative = sparseToArray(results.game2.flight1.cumulativePoints, 0, 18);
        }
        
        // Build flight2.leader array
        var flight2Leader = null;
        if (results?.game2?.flight2?.leader) {
            flight2Leader = sparseToArray(results.game2.flight2.leader, "AS", 18);
        }
        
        // Build flight2.cumulativePoints array
        var flight2Cumulative = null;
        if (results?.game2?.flight2?.cumulativePoints) {
            flight2Cumulative = sparseToArray(results.game2.flight2.cumulativePoints, 0, 18);
        }
        
        // Build displayStrk array
        var displayStrk = null;
        if (results?.game3?.displayStrk) {
            displayStrk = sparseToArray(results.game3.displayStrk, "AS", 18);
        }
        
        // Build t1Row from flight1.leader (or use existing)
        var t1Row = new Array(18).fill('_');
        if (flight1Leader) {
            for (var i = 0; i < 18; i++) {
                if (flight1Leader[i] && flight1Leader[i] !== 'AS') {
                    t1Row[i] = flight1Leader[i];
                } else if (flight1Leader[i] === 'AS') {
                    t1Row[i] = 'AS';
                }
            }
        }
        
        // Build t2Row from flight2.leader
        var t2Row = new Array(18).fill('_');
        if (flight2Leader) {
            for (var i = 0; i < 18; i++) {
                if (flight2Leader[i] && flight2Leader[i] !== 'AS') {
                    t2Row[i] = flight2Leader[i];
                } else if (flight2Leader[i] === 'AS') {
                    t2Row[i] = 'AS';
                }
            }
        }
        
        // Build strkRow from displayStrk
        var strkRow = new Array(18).fill('_');
        if (displayStrk) {
            for (var i = 0; i < 18; i++) {
                if (displayStrk[i] && displayStrk[i] !== 'AS') {
                    strkRow[i] = displayStrk[i];
                } else if (displayStrk[i] === 'AS') {
                    strkRow[i] = 'AS';
                }
            }
        }
        
        // Update results with converted arrays
        if (results) {
            if (!results.game2) results.game2 = {};
            if (!results.game2.flight1) results.game2.flight1 = {};
            if (!results.game2.flight2) results.game2.flight2 = {};
            if (!results.game3) results.game3 = {};
            
            results.game2.displayT1 = displayT1;
            results.game2.displayT2 = displayT2;
            results.game2.flight1.leader = flight1Leader;
            results.game2.flight1.cumulativePoints = flight1Cumulative;
            results.game2.flight2.leader = flight2Leader;
            results.game2.flight2.cumulativePoints = flight2Cumulative;
            results.game3.displayStrk = displayStrk;
        }
        
        // Build clinchedAt
        var clinchedAt = results?.clinchedAt || {};
        
        return {
            gameId: currentGameId,
            collection: currentCollection,
            course: course,
            players: players,
            startingHole: startingHole,
            teamGameFormat: teamGameFormat,
            f1DataString: f1DataString,
            f2DataString: f2DataString,
            flight1Data: flight1Data,
            flight2Data: flight2Data,
            savedHoles: savedHoles,
            t1Row: t1Row,
            t2Row: t2Row,
            strkRow: strkRow,
            t1Display: displayT1,
            t2Display: displayT2,
            strkDisplay: displayStrk,
            lastSyncedPosition: lastSyncedPosition,
            lastSyncedHole: lastSyncedHole,
            results: results,
            clinchedAt: clinchedAt,
            signatures: signatures,
            submitted: submitted,
            locks: locks,
            gameStarted: gameStarted,
            gameComplete: gameComplete
        };
    }
    
    // ============================================================
    // Load game data from Firestore
    // ============================================================
    function loadGame(gameId, collection, callback) {
        if (!gameId) {
            if (callback) callback({ success: false, error: "No game ID provided" });
            return;
        }
        
        currentGameId = gameId;
        currentCollection = collection || "scheduledGames";
        
        var gameRef = db.collection(currentCollection).doc(gameId);
        
        gameRef.get().then(function(doc) {
            if (!doc.exists) {
                if (callback) callback({ success: false, error: "Game not found" });
                return;
            }
            
            var docData = doc.data();
            currentCache = buildCacheFromDoc(docData);
            
            for (var i = 0; i < dataCallbacks.length; i++) {
                try {
                    dataCallbacks[i](currentCache);
                } catch(e) {
                    console.error("Callback error:", e);
                }
            }
            
            if (callback) callback({ success: true, cache: currentCache });
        }).catch(function(error) {
            console.error("Error loading game:", error);
            if (callback) callback({ success: false, error: error.message });
        });
    }
    
    // ============================================================
    // Subscribe to real-time updates
    // ============================================================
    function subscribe(gameId, collection, callback) {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        
        if (!gameId) {
            if (callback) callback({ success: false, error: "No game ID provided" });
            return;
        }
        
        currentGameId = gameId;
        currentCollection = collection || "scheduledGames";
        
        var gameRef = db.collection(currentCollection).doc(gameId);
        
        unsubscribe = gameRef.onSnapshot(function(doc) {
            if (!doc.exists) {
                if (callback) callback({ success: false, error: "Game not found" });
                return;
            }
            
            var docData = doc.data();
            currentCache = buildCacheFromDoc(docData);
            
            for (var i = 0; i < dataCallbacks.length; i++) {
                try {
                    dataCallbacks[i](currentCache);
                } catch(e) {
                    console.error("Callback error:", e);
                }
            }
            
            if (callback) callback({ success: true, cache: currentCache });
        }, function(error) {
            console.error("Firestore subscription error:", error);
            if (callback) callback({ success: false, error: error.message });
        });
        
        return unsubscribe;
    }
    
    // ============================================================
    // Get current cache
    // ============================================================
    function getLocalCache() {
        return currentCache;
    }
    
    // ============================================================
    // Set local cache (for preloaded data)
    // ============================================================
    function setLocalCache(cache) {
        currentCache = cache;
        // Update GameOrder with starting hole from cache
        if (cache && cache.startingHole && typeof GameOrder !== 'undefined' && GameOrder.setStartingHole) {
            GameOrder.setStartingHole(cache.startingHole);
        }
        for (var i = 0; i < dataCallbacks.length; i++) {
            try {
                dataCallbacks[i](currentCache);
            } catch(e) {
                console.error("Callback error:", e);
            }
        }
    }
    
    // ============================================================
    // Add data update callback
    // ============================================================
    function addDataCallback(callback) {
        if (typeof callback === 'function') {
            dataCallbacks.push(callback);
        }
    }
    
    // ============================================================
    // Remove data update callback
    // ============================================================
    function removeDataCallback(callback) {
        var index = dataCallbacks.indexOf(callback);
        if (index !== -1) {
            dataCallbacks.splice(index, 1);
        }
    }
    
    // ============================================================
    // Get TR for a specific hole
    // ============================================================
    function getTRForHole(holeNumber) {
        if (!currentCache || !currentCache.results) {
            return { teamA: 9.5, teamB: 9.5, teamAGreen: true, teamBGreen: true };
        }
        
        var position = getHolePosition(holeNumber, currentCache.startingHole);
        var tr = currentCache.results.tr || {};
        
        return {
            teamA: tr.teamA?.[position] !== undefined ? tr.teamA[position] : 9.5,
            teamB: tr.teamB?.[position] !== undefined ? tr.teamB[position] : 9.5,
            teamAGreen: tr.teamAGreen?.[position] !== undefined ? tr.teamAGreen[position] : true,
            teamBGreen: tr.teamBGreen?.[position] !== undefined ? tr.teamBGreen[position] : true
        };
    }
    
    // ============================================================
    // Helper: Get hole position based on starting hole
    // v1.09: Delegates to GameOrder
    // ============================================================
    function getHolePosition(holeNumber, startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayPosition) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getPlayPosition(holeNumber);
        }
        // Fallback
        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);
        
        for (var i = 0; i < playOrder.length; i++) {
            if (playOrder[i] === holeNumber) return i;
        }
        return holeNumber - 1;
    }
    
    // ============================================================
    // Unsubscribe from Firestore
    // ============================================================
    function unload() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        currentGameId = null;
        currentCollection = null;
        currentCache = null;
        dataCallbacks = [];
    }
    
    // ============================================================
    // Public API
    // ============================================================
    return {
        loadGame: loadGame,
        subscribe: subscribe,
        getLocalCache: getLocalCache,
        setLocalCache: setLocalCache,
        addDataCallback: addDataCallback,
        removeDataCallback: removeDataCallback,
        getTRForHole: getTRForHole,
        unload: unload
    };
    
})();

// Make available globally
window.GameLoader = GameLoader;

/*
FILE: js/game-loader.js
VERSION: 1.10
KEY CHANGES from v1.09:
   - FIXED: Converts sparse Firestore objects to proper arrays when building cache
   - displayT1, displayT2, flight1.leader, flight2.leader, cumulativePoints are now always arrays
   - Prevents "slice is not a function" errors and missing data issues
   - Maintains backward compatibility with existing caches
DEPENDS ON: Firebase Firestore, js/game-data.js, js/game-order.js
STATUS: Ready for integration
*/