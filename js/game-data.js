/*
FILE: js/game-data.js
VERSION: 2.09
KEY CHANGES from v2.08:
   - CHANGED: Firestore writes now use WRV.update() for reliability
   - ADDED: Fallback to direct update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/

window.GAME_DATA_VERSION = "2.09";

/**
 * GameData - Handles all game data operations with WRV
 */
var GameData = (function() {
    
    /**
     * Save hole data with WRV
     * @param {string} gameId - The game ID
     * @param {object} holeData - The hole data to save
     * @param {function} callback - Callback (err, result)
     */
    function saveHole(gameId, holeData, callback) {
        if (!gameId || !holeData) {
            if (callback) callback(new Error('Missing gameId or holeData'));
            return;
        }
        
        console.log('[GameData] Saving hole data for:', gameId, 'Hole:', holeData.holeNumber);
        
        var updateData = {};
        var holeKey = 'holes.' + holeData.holeNumber;
        updateData[holeKey] = holeData;
        updateData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
        
        // Use WRV for reliable Firestore write
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('scheduledGames', gameId, updateData, function(err, result) {
                if (err) {
                    console.error('[GameData] WRV save failed:', err);
                    if (callback) callback(err);
                } else {
                    console.log('[GameData] WRV save successful for hole:', holeData.holeNumber);
                    if (callback) callback(null, result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[GameData] WRV not available, using direct update');
            var db = firebase.firestore();
            db.collection('scheduledGames').doc(gameId).update(updateData)
                .then(function() {
                    console.log('[GameData] Direct save successful for hole:', holeData.holeNumber);
                    if (callback) callback(null);
                })
                .catch(function(err) {
                    console.error('[GameData] Direct save failed:', err);
                    if (callback) callback(err);
                });
        }
    }
    
    /**
     * Save match data with WRV
     * @param {string} gameId - The game ID
     * @param {object} matchData - The match data to save
     * @param {function} callback - Callback (err, result)
     */
    function saveMatchData(gameId, matchData, callback) {
        if (!gameId || !matchData) {
            if (callback) callback(new Error('Missing gameId or matchData'));
            return;
        }
        
        console.log('[GameData] Saving match data for:', gameId);
        
        var updateData = {};
        
        // Update match results
        if (matchData.matchResults) {
            updateData.matchResults = matchData.matchResults;
        }
        
        // Update team scores
        if (matchData.teamAScore !== undefined) {
            updateData.teamAScore = matchData.teamAScore;
        }
        if (matchData.teamBScore !== undefined) {
            updateData.teamBScore = matchData.teamBScore;
        }
        
        // Update hole data if provided
        if (matchData.holeData) {
            var holeKey = 'holes.' + matchData.holeData.holeNumber;
            updateData[holeKey] = matchData.holeData;
        }
        
        updateData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
        
        // Use WRV for reliable Firestore write
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('scheduledGames', gameId, updateData, function(err, result) {
                if (err) {
                    console.error('[GameData] WRV save match data failed:', err);
                    if (callback) callback(err);
                } else {
                    console.log('[GameData] WRV save match data successful');
                    if (callback) callback(null, result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[GameData] WRV not available, using direct update');
            var db = firebase.firestore();
            db.collection('scheduledGames').doc(gameId).update(updateData)
                .then(function() {
                    console.log('[GameData] Direct save match data successful');
                    if (callback) callback(null);
                })
                .catch(function(err) {
                    console.error('[GameData] Direct save match data failed:', err);
                    if (callback) callback(err);
                });
        }
    }
    
    /**
     * Get game data from Firestore
     * @param {string} gameId - The game ID
     * @param {function} callback - Callback (err, data)
     */
    function getGame(gameId, callback) {
        if (!gameId) {
            if (callback) callback(new Error('Missing gameId'));
            return;
        }
        
        console.log('[GameData] Getting game data for:', gameId);
        
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    if (callback) callback(new Error('Game not found'));
                    return;
                }
                
                var data = doc.data();
                data.id = doc.id;
                console.log('[GameData] Game data retrieved successfully');
                if (callback) callback(null, data);
            })
            .catch(function(err) {
                console.error('[GameData] Get game failed:', err);
                if (callback) callback(err);
            });
    }
    
    /**
     * Update game status with WRV
     * @param {string} gameId - The game ID
     * @param {string} status - New status
     * @param {function} callback - Callback (err, result)
     */
    function updateStatus(gameId, status, callback) {
        if (!gameId || !status) {
            if (callback) callback(new Error('Missing gameId or status'));
            return;
        }
        
        console.log('[GameData] Updating status for:', gameId, 'to:', status);
        
        var updateData = {
            status: status,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (status === 'completed') {
            updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // Use WRV for reliable Firestore write
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('scheduledGames', gameId, updateData, function(err, result) {
                if (err) {
                    console.error('[GameData] WRV update status failed:', err);
                    if (callback) callback(err);
                } else {
                    console.log('[GameData] WRV update status successful');
                    if (callback) callback(null, result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[GameData] WRV not available, using direct update');
            var db = firebase.firestore();
            db.collection('scheduledGames').doc(gameId).update(updateData)
                .then(function() {
                    console.log('[GameData] Direct update status successful');
                    if (callback) callback(null);
                })
                .catch(function(err) {
                    console.error('[GameData] Direct update status failed:', err);
                    if (callback) callback(err);
                });
        }
    }
    
    // Public API
    return {
        saveHole: saveHole,
        saveMatchData: saveMatchData,
        getGame: getGame,
        updateStatus: updateStatus,
        version: '2.09'
    };
    
})();

// Make available globally
window.GameData = GameData;

/*
FILE: js/game-data.js
VERSION: 2.09
KEY CHANGES from v2.08:
   - CHANGED: Firestore writes now use WRV.update() for reliability
   - ADDED: Fallback to direct update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/