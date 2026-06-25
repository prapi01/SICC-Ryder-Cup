/*
FILE: js/real-game-init.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - CHANGED: Firestore writes now use WRV.write() for reliability
   - ADDED: Fallback to direct write if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, celebration-photo.js
STATUS: Ready for integration
*/

window.REAL_GAME_INIT_VERSION = "1.03";

/**
 * real-game-init.js - Handles game initialization for real-game.html
 * All writes use WRV for reliability
 */

// Make sure WRV is loaded
if (typeof WRV === 'undefined') {
    console.warn('[RealGameInit] WRV not loaded - using fallback direct writes');
}

/**
 * Initialize a new game
 * @param {string} gameId - The game ID
 * @param {object} config - Game configuration
 * @param {function} callback - Callback (err, result)
 */
function initGame(gameId, config, callback) {
    if (!gameId) {
        if (callback) callback(new Error('Missing gameId'));
        return;
    }
    
    console.log('[RealGameInit] Initializing game:', gameId);
    
    // Prepare game data
    var gameData = {
        gameId: gameId,
        status: 'active',
        currentHole: 1,
        lastSyncedPosition: 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Merge with provided config
    if (config) {
        if (config.courseName) gameData.courseName = config.courseName;
        if (config.gameDate) gameData.gameDate = config.gameDate;
        if (config.teamAName) gameData.teamAName = config.teamAName;
        if (config.teamBName) gameData.teamBName = config.teamBName;
        if (config.teamAPlayers) gameData.teamAPlayers = config.teamAPlayers;
        if (config.teamBPlayers) gameData.teamBPlayers = config.teamBPlayers;
        if (config.adjustedHandicaps) gameData.adjustedHandicaps = config.adjustedHandicaps;
        if (config.f1IntraMatches) gameData.f1IntraMatches = config.f1IntraMatches;
        if (config.f2IntraMatches) gameData.f2IntraMatches = config.f2IntraMatches;
        if (config.matchFormat) gameData.matchFormat = config.matchFormat;
        if (config.holes) gameData.holes = config.holes;
        if (config.teamAScore !== undefined) gameData.teamAScore = config.teamAScore;
        if (config.teamBScore !== undefined) gameData.teamBScore = config.teamBScore;
    }
    
    // Check for celebration photo at game start (H1)
    if (typeof checkAndRenameCelebrationPhoto === 'function') {
        console.log('[RealGameInit] 🔍 Checking celebration photo at game start (H1)');
        checkAndRenameCelebrationPhoto(gameId);
    }
    
    // Use WRV for reliable Firestore write
    if (typeof WRV !== 'undefined' && WRV.write) {
        WRV.write('scheduledGames', gameId, gameData, function(err, result) {
            if (err) {
                console.error('[RealGameInit] WRV write failed:', err);
                if (callback) callback(err);
            } else {
                console.log('[RealGameInit] WRV write successful');
                if (callback) callback(null, result);
            }
        });
    } else {
        // Fallback: direct write
        console.warn('[RealGameInit] WRV not available, using direct write');
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).set(gameData)
            .then(function() {
                console.log('[RealGameInit] Direct write successful');
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error('[RealGameInit] Direct write failed:', err);
                if (callback) callback(err);
            });
    }
}

/**
 * Update game status during initialization
 * @param {string} gameId - The game ID
 * @param {string} status - New status
 * @param {function} callback - Callback (err, result)
 */
function updateInitStatus(gameId, status, callback) {
    if (!gameId || !status) {
        if (callback) callback(new Error('Missing gameId or status'));
        return;
    }
    
    console.log('[RealGameInit] Updating status to:', status);
    
    var updateData = {
        status: status,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Use WRV for reliable Firestore write
    if (typeof WRV !== 'undefined' && WRV.update) {
        WRV.update('scheduledGames', gameId, updateData, function(err, result) {
            if (err) {
                console.error('[RealGameInit] WRV update status failed:', err);
                if (callback) callback(err);
            } else {
                console.log('[RealGameInit] WRV update status successful');
                if (callback) callback(null, result);
            }
        });
    } else {
        // Fallback: direct update
        console.warn('[RealGameInit] WRV not available, using direct update');
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).update(updateData)
            .then(function() {
                console.log('[RealGameInit] Direct update status successful');
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error('[RealGameInit] Direct update status failed:', err);
                if (callback) callback(err);
            });
    }
}

// Make functions available globally
window.initGame = initGame;
window.updateInitStatus = updateInitStatus;

/*
FILE: js/real-game-init.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - CHANGED: Firestore writes now use WRV.write() for reliability
   - ADDED: Fallback to direct write if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, celebration-photo.js
STATUS: Ready for integration
*/