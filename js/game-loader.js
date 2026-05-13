/*
FILE: js/game-loader.js
VERSION: 1.01
KEY CHANGES:
   - FIXED: Intra-flight results now recalculated in recalculateDerivedData()
   - Added intra-flight recalculation for both flights when cache updates
   - Ensures match bubbles update correctly after either flight saves a hole
   - Cross-flight recalculation already present and working
DEPENDS ON: Firebase Firestore, js/game-data.js, js/game-match.js, js/game-team.js, js/game-stroke.js
STATUS: Ready for integration
*/

var GameLoader = (function() {
    
    // ============================================================
    // Private State
    // ============================================================
    
    var localCache = {
        gameId: null,
        collection: null,
        course: null,
        players: [],
        startingHole: 1,
        teamGameFormat: "tournament",
        f1DataString: "",
        f2DataString: "",
        flight1Data: {},
        flight2Data: {},
        savedHoles: { 1: [], 2: [] },
        results: null,
        signatures: { f1: false, f2: false },
        submitted: { f1: false, f2: false },
        locks: { f1: null, f2: null },
        gameStarted: false,
        
        // Derived data (recalculated on load and on cache update)
        t1Row: Array(18).fill('_'),
        t2Row: Array(18).fill('_'),
        strkRow: Array(18).fill('0'),
        matchResults: {
            intraF1: {},
            intraF2: {},
            cross: {}
        },
        flight1Cumulative: Array(18).fill(0),
        flight2Cumulative: Array(18).fill(0),
        lastSyncedHole: 0
    };
    
    var syncStatus = {
        pending: false,
        error: null
    };
    
    var snapshotUnsubscribe = null;
    var dataCallbacks = [];
    
    // ============================================================
    // Helper Functions
    // ============================================================
    
    function getPlayOrder(startingHole) {
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    function getHolePosition(holeNumber, startingHole) {
        var playOrder = getPlayOrder(startingHole);
        for (var i = 0; i < playOrder.length; i++) {
            if (playOrder[i] === holeNumber) return i;
        }
        return holeNumber - 1;
    }
    
    function getHoleAtStoragePosition(position, startingHole) {
        var playOrder = getPlayOrder(startingHole);
        return playOrder[position];
    }
    
    function parseFlightData(dataString, startingHole) {
        var result = {};
        var playOrder = getPlayOrder(startingHole);
        
        for (var pos = 0; pos < 18; pos++) {
            var actualHole = playOrder[pos];
            var startIdx = pos * 9;
            var segment = dataString.substring(startIdx, startIdx + 9);
            
            if (segment.length === 9) {
                result[actualHole] = {
                    saved: segment[0] === 'T',
                    scores: {
                        a1: parseInt(segment.substring(1, 3), 10),
                        a2: parseInt(segment.substring(3, 5), 10),
                        b1: parseInt(segment.substring(5, 7), 10),
                        b2: parseInt(segment.substring(7, 9), 10)
                    }
                };
            }
        }
        return result;
    }
    
    function updateSavedHolesList() {
        localCache.savedHoles = { 1: [], 2: [] };
        for (var h = 1; h <= 18; h++) {
            if (localCache.flight1Data[h] && localCache.flight1Data[h].saved) {
                localCache.savedHoles[1].push(h);
            }
            if (localCache.flight2Data[h] && localCache.flight2Data[h].saved) {
                localCache.savedHoles[2].push(h);
            }
        }
    }
    
    function calculateLastSyncedHole() {
        var playOrder = getPlayOrder(localCache.startingHole);
        var lastSynced = 0;
        for (var i = 0; i < playOrder.length; i++) {
            var hole = playOrder[i];
            var f1Saved = localCache.flight1Data[hole] && localCache.flight1Data[hole].saved;
            var f2Saved = localCache.flight2Data[hole] && localCache.flight2Data[hole].saved;
            if (f1Saved && f2Saved) {
                lastSynced = hole;
            } else {
                break;
            }
        }
        return lastSynced;
    }
    
    function recalculateDerivedData() {
        if (!localCache.players.length || !localCache.f1DataString || !localCache.f2DataString) {
            return;
        }
        
        var courseSi = localCache.course?.si || [];
        var startingHole = localCache.startingHole;
        var teamGameFormat = localCache.teamGameFormat;
        var allPlayers = localCache.players;
        var flight1DataStr = localCache.f1DataString;
        var flight2DataStr = localCache.f2DataString;
        var coursePar = localCache.course?.par || [];
        
        // Update saved holes list
        updateSavedHolesList();
        
        // Calculate last synced hole
        localCache.lastSyncedHole = calculateLastSyncedHole();
        
        // ============================================================
        // FIXED: Recalculate intra-flight results for both flights
        // ============================================================
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        var maxHoleF1 = localCache.savedHoles[1].length > 0 ? Math.max.apply(null, localCache.savedHoles[1]) : 0;
        var maxHoleF2 = localCache.savedHoles[2].length > 0 ? Math.max.apply(null, localCache.savedHoles[2]) : 0;
        
        // Flight 1 intra-flight
        if (maxHoleF1 > 0) {
            try {
                localCache.matchResults.intraF1 = GameMatch.calculateIntraFlight(
                    1, flight1Players, flight1DataStr, courseSi, startingHole, maxHoleF1, coursePar
                );
            } catch(e) { console.warn("Intra-flight F1 recalc error:", e); }
        } else {
            localCache.matchResults.intraF1 = {};
        }
        
        // Flight 2 intra-flight
        if (maxHoleF2 > 0) {
            try {
                localCache.matchResults.intraF2 = GameMatch.calculateIntraFlight(
                    2, flight2Players, flight2DataStr, courseSi, startingHole, maxHoleF2, coursePar
                );
            } catch(e) { console.warn("Intra-flight F2 recalc error:", e); }
        } else {
            localCache.matchResults.intraF2 = {};
        }
        
        // Cross-flight (only when both flights have saved the same holes)
        if (localCache.lastSyncedHole > 0) {
            try {
                localCache.matchResults.cross = GameMatch.calculateCrossFlight(
                    flight1DataStr, flight2DataStr, allPlayers, courseSi, startingHole, 
                    localCache.lastSyncedHole, coursePar
                );
            } catch(e) { console.warn("Cross-flight recalc error:", e); }
        } else {
            localCache.matchResults.cross = {};
        }
        
        // Recalculate team game (T-1, T-2 rows)
        try {
            var teamResults = GameTeam.calculate(
                allPlayers, flight1DataStr, flight2DataStr, courseSi, startingHole, teamGameFormat
            );
            localCache.t1Row = teamResults.t1Row;
            localCache.t2Row = teamResults.t2Row;
            localCache.flight1Cumulative = teamResults.flight1Cumulative;
            localCache.flight2Cumulative = teamResults.flight2Cumulative;
        } catch(e) { console.warn("Team game recalc error:", e); }
        
        // Recalculate stroke game (Strk row)
        try {
            var strokeResults = GameStroke.calculate(
                allPlayers, flight1DataStr, flight2DataStr, courseSi, startingHole
            );
            localCache.strkRow = strokeResults;
        } catch(e) { console.warn("Stroke game recalc error:", e); }
    }
    
    // ============================================================
    // Public Functions
    // ============================================================
    
    function markWritePending() {
        syncStatus.pending = true;
        syncStatus.error = null;
    }
    
    function markWriteComplete() {
        syncStatus.pending = false;
        syncStatus.error = null;
    }
    
    function markWriteFailed(error) {
        syncStatus.pending = true;
        syncStatus.error = error;
    }
    
    function getSyncStatus() {
        return { pending: syncStatus.pending, error: syncStatus.error };
    }
    
    function getLocalCache() {
        return localCache;
    }
    
    function getTRForHole(holeNumber) {
        if (!localCache.results || !localCache.results.tr) return { teamA: 9.5, teamB: 9.5, teamAGreen: true, teamBGreen: true };
        
        var position = getHolePosition(holeNumber, localCache.startingHole);
        var computedUpTo = localCache.results.computedUpToHole || 0;
        
        if (position >= computedUpTo) {
            return { teamA: 9.5, teamB: 9.5, teamAGreen: true, teamBGreen: true };
        }
        
        return {
            teamA: localCache.results.tr.teamA[position],
            teamB: localCache.results.tr.teamB[position],
            teamAGreen: localCache.results.tr.teamAGreen[position],
            teamBGreen: localCache.results.tr.teamBGreen[position]
        };
    }
    
    function getMatchValue(playerName, opponentName) {
        var intraKey = playerName + "_vs_" + opponentName;
        if (localCache.matchResults.intraF1[intraKey] !== undefined) return localCache.matchResults.intraF1[intraKey];
        if (localCache.matchResults.intraF2[intraKey] !== undefined) return localCache.matchResults.intraF2[intraKey];
        if (localCache.matchResults.cross[intraKey] !== undefined) return localCache.matchResults.cross[intraKey];
        return 0;
    }
    
    function updateLocalCacheFromSnapshot(data) {
        if (data.f1 && data.f1.d) localCache.f1DataString = data.f1.d;
        if (data.f2 && data.f2.d) localCache.f2DataString = data.f2.d;
        if (data.results) localCache.results = data.results;
        if (data.signatures) {
            localCache.signatures.f1 = data.signatures.f1?.signed === true;
            localCache.signatures.f2 = data.signatures.f2?.signed === true;
        }
        if (data.submitted) {
            localCache.submitted.f1 = data.submitted.f1 === true;
            localCache.submitted.f2 = data.submitted.f2 === true;
        }
        if (data.locks) localCache.locks = data.locks;
        if (data.gameStarted !== undefined) localCache.gameStarted = data.gameStarted;
        
        // Reparse flight data
        localCache.flight1Data = parseFlightData(localCache.f1DataString, localCache.startingHole);
        localCache.flight2Data = parseFlightData(localCache.f2DataString, localCache.startingHole);
        
        // Recalculate all derived data (includes intra-flight, cross-flight, team, stroke)
        recalculateDerivedData();
        
        // Notify callbacks
        for (var i = 0; i < dataCallbacks.length; i++) {
            try { dataCallbacks[i](localCache); } catch(e) {}
        }
    }
    
    function loadGame(gameId, collection, callback) {
        if (!gameId || !collection) {
            if (callback) callback({ success: false, error: "Missing gameId or collection" });
            return;
        }
        
        localCache.gameId = gameId;
        localCache.collection = collection;
        
        var db = firebase.firestore();
        
        db.collection(collection).doc(gameId).get().then(function(doc) {
            if (!doc.exists) {
                if (callback) callback({ success: false, error: "Game not found" });
                return;
            }
            
            var data = doc.data();
            
            // Populate localCache from Firestore
            localCache.course = data.course || null;
            localCache.players = data.players || [];
            localCache.startingHole = data.startingHole || 1;
            localCache.teamGameFormat = data.teamGameFormat || "tournament";
            localCache.f1DataString = data.f1?.d || "";
            localCache.f2DataString = data.f2?.d || "";
            localCache.results = data.results || null;
            localCache.signatures = {
                f1: data.signatures?.f1?.signed === true,
                f2: data.signatures?.f2?.signed === true
            };
            localCache.submitted = {
                f1: data.submitted?.f1 === true,
                f2: data.submitted?.f2 === true
            };
            localCache.locks = data.locks || { f1: null, f2: null };
            localCache.gameStarted = data.gameStarted === true;
            
            // Parse flight data
            localCache.flight1Data = parseFlightData(localCache.f1DataString, localCache.startingHole);
            localCache.flight2Data = parseFlightData(localCache.f2DataString, localCache.startingHole);
            
            // Recalculate all derived data
            recalculateDerivedData();
            
            // Set sync status to green (no pending writes)
            markWriteComplete();
            
            // Set up snapshot listener for real-time sync
            if (snapshotUnsubscribe) snapshotUnsubscribe();
            snapshotUnsubscribe = db.collection(collection).doc(gameId).onSnapshot(function(snapshot) {
                if (snapshot.exists) {
                    updateLocalCacheFromSnapshot(snapshot.data());
                }
            }, function(error) {
                console.warn("Snapshot listener error:", error);
            });
            
            if (callback) callback({ success: true, cache: localCache });
            
        }).catch(function(error) {
            console.error("Load game error:", error);
            if (callback) callback({ success: false, error: error.message });
        });
    }
    
    function addDataCallback(callback) {
        if (callback) dataCallbacks.push(callback);
    }
    
    function unload() {
        if (snapshotUnsubscribe) {
            snapshotUnsubscribe();
            snapshotUnsubscribe = null;
        }
        dataCallbacks = [];
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        loadGame: loadGame,
        getLocalCache: getLocalCache,
        getTRForHole: getTRForHole,
        getMatchValue: getMatchValue,
        getSyncStatus: getSyncStatus,
        markWritePending: markWritePending,
        markWriteComplete: markWriteComplete,
        markWriteFailed: markWriteFailed,
        addDataCallback: addDataCallback,
        unload: unload,
        getPlayOrder: getPlayOrder,
        getHolePosition: getHolePosition,
        getHoleAtStoragePosition: getHoleAtStoragePosition,
        // Expose recalculateDerivedData for manual triggers if needed
        recalculateDerivedData: recalculateDerivedData
    };
    
})();

/*
FILE: js/game-loader.js
VERSION: 1.01
KEY CHANGES:
   - FIXED: Intra-flight results now recalculated in recalculateDerivedData()
   - Added intra-flight recalculation for both flights when cache updates
   - Ensures match bubbles update correctly after either flight saves a hole
   - Cross-flight recalculation already present and working
DEPENDS ON: Firebase Firestore, js/game-data.js, js/game-match.js, js/game-team.js, js/game-stroke.js
STATUS: Ready for integration
*/