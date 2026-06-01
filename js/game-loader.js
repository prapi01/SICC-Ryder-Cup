/*
FILE: js/game-loader.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: Added t1Row, t2Row, strkRow to return object (were missing)
   - FIXED: Added t1Display, t2Display, strkDisplay to return object (were missing)
   - ALL existing functionality preserved
DEPENDS ON: Firebase Firestore, js/game-data.js
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
    // Helper: Parse saved holes from data string
    // ============================================================
    function getSavedHolesFromString(dataString) {
        var saved = [];
        if (!dataString) return saved;
        
        // Parse T/F pattern
        var i = 0;
        var holeNum = 1;
        while (i < dataString.length && holeNum <= 18) {
            if (dataString[i] === 'T') {
                saved.push(holeNum);
                // Skip the 8 score characters (a1,a2,b1,b2)
                i += 9; // 'T' + 8 scores
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
    // Helper: Build cache from Firestore document
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
        
        // Parse flight data for each hole
        var flight1Data = {};
        var flight2Data = {};
        for (var h = 1; h <= 18; h++) {
            flight1Data[h] = GameData.parseHoleData(f1DataString, h);
            flight2Data[h] = GameData.parseHoleData(f2DataString, h);
        }
        
        // Get saved holes
        var savedHoles = {
            1: getSavedHolesFromString(f1DataString),
            2: getSavedHolesFromString(f2DataString)
        };
        
        // Calculate last synced hole (highest hole where both flights have saved)
        var lastSyncedHole = 0;
        for (var h = 1; h <= 18; h++) {
            if (savedHoles[1].indexOf(h) !== -1 && savedHoles[2].indexOf(h) !== -1) {
                lastSyncedHole = h;
            } else {
                break;
            }
        }
        
        // Build t1Row, t2Row, strkRow from results
        var t1Row = new Array(18).fill('_');
        if (results?.game2?.flight1?.leader) {
            for (var i = 0; i < 18; i++) {
                if (results.game2.flight1.leader[i]) {
                    t1Row[i] = results.game2.flight1.leader[i];
                }
            }
        }
        
        var t2Row = new Array(18).fill('_');
        if (results?.game2?.flight2?.leader) {
            for (var i = 0; i < 18; i++) {
                if (results.game2.flight2.leader[i]) {
                    t2Row[i] = results.game2.flight2.leader[i];
                }
            }
        }
        
        var strkRow = new Array(18).fill('_');
        if (results?.game3?.leader) {
            for (var i = 0; i < 18; i++) {
                if (results.game3.leader[i]) {
                    strkRow[i] = results.game3.leader[i];
                }
            }
        }
        
        // Build display arrays from results (NEW v1.05)
        var t1Display = null;
        var t2Display = null;
        var strkDisplay = null;
        
        if (results?.game2?.displayT1) {
            t1Display = results.game2.displayT1;
        }
        if (results?.game2?.displayT2) {
            t2Display = results.game2.displayT2;
        }
        if (results?.game3?.displayStrk) {
            strkDisplay = results.game3.displayStrk;
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
            // FIXED v1.05: Added missing properties
            t1Row: t1Row,
            t2Row: t2Row,
            strkRow: strkRow,
            t1Display: t1Display,
            t2Display: t2Display,
            strkDisplay: strkDisplay,
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
            
            // Notify callbacks
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
            
            // Notify callbacks
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
        // Notify callbacks
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
    // ============================================================
    function getHolePosition(holeNumber, startingHole) {
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
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: Added t1Row, t2Row, strkRow to return object (were missing)
   - FIXED: Added t1Display, t2Display, strkDisplay to return object (were missing)
   - ALL existing functionality preserved
DEPENDS ON: Firebase Firestore, js/game-data.js
STATUS: Ready for integration
*/