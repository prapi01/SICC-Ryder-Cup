/*
FILE: js/real-game-save.js
VERSION: 1.22
KEY CHANGES from v1.21:
   - CHANGED: Firestore writes now use WRV.write() and WRV.update() for reliability
   - ADDED: Fallback to direct write/update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, celebration-photo.js
STATUS: Ready for integration
*/

window.REAL_GAME_SAVE_VERSION = "1.22";

/**
 * real-game-save.js - Handles all save operations for real-game.html
 * All writes use WRV for reliability
 */

// Make sure WRV is loaded
if (typeof WRV === 'undefined') {
    console.warn('[RealGameSave] WRV not loaded - using fallback direct writes');
}

/**
 * Save game data to Firestore using WRV
 * @param {string} gameId - The game ID
 * @param {object} data - The data to save
 * @param {function} callback - Callback (err, result)
 */
function saveGameData(gameId, data, callback) {
    if (!gameId || !data) {
        if (callback) callback(new Error('Missing gameId or data'));
        return;
    }
    
    console.log('[RealGameSave] Saving game data for:', gameId);
    
    // Use WRV for reliable Firestore write
    if (typeof WRV !== 'undefined' && WRV.write) {
        WRV.write('scheduledGames', gameId, data, function(err, result) {
            if (err) {
                console.error('[RealGameSave] WRV write failed:', err);
                if (callback) callback(err);
            } else {
                console.log('[RealGameSave] WRV write successful');
                if (callback) callback(null, result);
            }
        });
    } else {
        // Fallback: direct write
        console.warn('[RealGameSave] WRV not available, using direct write');
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).set(data, { merge: true })
            .then(function() {
                console.log('[RealGameSave] Direct write successful');
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error('[RealGameSave] Direct write failed:', err);
                if (callback) callback(err);
            });
    }
}

/**
 * Update game data in Firestore using WRV
 * @param {string} gameId - The game ID
 * @param {object} updateData - The data to update
 * @param {function} callback - Callback (err, result)
 */
function updateGameData(gameId, updateData, callback) {
    if (!gameId || !updateData) {
        if (callback) callback(new Error('Missing gameId or updateData'));
        return;
    }
    
    console.log('[RealGameSave] Updating game data for:', gameId);
    
    // Use WRV for reliable Firestore write
    if (typeof WRV !== 'undefined' && WRV.update) {
        WRV.update('scheduledGames', gameId, updateData, function(err, result) {
            if (err) {
                console.error('[RealGameSave] WRV update failed:', err);
                if (callback) callback(err);
            } else {
                console.log('[RealGameSave] WRV update successful');
                if (callback) callback(null, result);
            }
        });
    } else {
        // Fallback: direct update
        console.warn('[RealGameSave] WRV not available, using direct update');
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).update(updateData)
            .then(function() {
                console.log('[RealGameSave] Direct update successful');
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error('[RealGameSave] Direct update failed:', err);
                if (callback) callback(err);
            });
    }
}

/**
 * Perform save operation at key checkpoints (H1, H4, H9, H14, H17)
 * @param {string} gameId - The game ID
 * @param {number} currentHole - The current hole number
 * @param {object} gameState - The current game state
 * @param {function} callback - Callback (err, result)
 */
function performSave(gameId, currentHole, gameState, callback) {
    console.log('[RealGameSave] Performing save at H' + currentHole);
    
    // Prepare data to save
    var saveData = {
        currentHole: currentHole,
        lastSyncedPosition: currentHole,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Add game state data if provided
    if (gameState) {
        if (gameState.teamAScore !== undefined) saveData.teamAScore = gameState.teamAScore;
        if (gameState.teamBScore !== undefined) saveData.teamBScore = gameState.teamBScore;
        if (gameState.matchResults) saveData.matchResults = gameState.matchResults;
        if (gameState.holes) saveData.holes = gameState.holes;
        if (gameState.signatures) saveData.signatures = gameState.signatures;
        if (gameState.status) saveData.status = gameState.status;
    }
    
    // Also check for celebration photo at key holes
    var photoCheckHoles = [4, 9, 14];
    if (photoCheckHoles.indexOf(currentHole) !== -1) {
        if (typeof checkAndRenameCelebrationPhoto === 'function') {
            console.log('[RealGameSave] 🔍 Checking celebration photo at H' + currentHole);
            checkAndRenameCelebrationPhoto(gameId);
        } else {
            console.warn('[RealGameSave] checkAndRenameCelebrationPhoto not available');
        }
    }
    
    // Use updateGameData with WRV
    updateGameData(gameId, saveData, function(err, result) {
        if (err) {
            console.error('[RealGameSave] Save failed at H' + currentHole, err);
            if (callback) callback(err);
        } else {
            console.log('[RealGameSave] Save successful at H' + currentHole);
            if (callback) callback(null, result);
        }
    });
}

/**
 * Save initial game state at H1
 * @param {string} gameId - The game ID
 * @param {object} initialData - Initial game data
 * @param {function} callback - Callback (err, result)
 */
function saveInitialState(gameId, initialData, callback) {
    console.log('[RealGameSave] Saving initial state for:', gameId);
    
    // Prepare initial data
    var data = {
        gameId: gameId,
        status: 'active',
        currentHole: 1,
        lastSyncedPosition: 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Merge with provided initial data
    if (initialData) {
        Object.assign(data, initialData);
    }
    
    // Also check for celebration photo at game start (H1)
    if (typeof checkAndRenameCelebrationPhoto === 'function') {
        console.log('[RealGameSave] 🔍 Checking celebration photo at game start (H1)');
        checkAndRenameCelebrationPhoto(gameId);
    }
    
    // Use saveGameData with WRV
    saveGameData(gameId, data, function(err, result) {
        if (err) {
            console.error('[RealGameSave] Initial save failed:', err);
            if (callback) callback(err);
        } else {
            console.log('[RealGameSave] Initial save successful');
            if (callback) callback(null, result);
        }
    });
}

/**
 * Save hole 17 data (special checkpoint before finish)
 * @param {string} gameId - The game ID
 * @param {object} holeData - The hole 17 data
 * @param {function} callback - Callback (err, result)
 */
function saveHole17(gameId, holeData, callback) {
    console.log('[RealGameSave] Saving H17 data for:', gameId);
    
    var updateData = {
        lastSyncedPosition: 17,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (holeData) {
        if (holeData.teamAScore !== undefined) updateData.teamAScore = holeData.teamAScore;
        if (holeData.teamBScore !== undefined) updateData.teamBScore = holeData.teamBScore;
        if (holeData.matchResults) updateData.matchResults = holeData.matchResults;
        if (holeData.holes) updateData.holes = holeData.holes;
    }
    
    // Also check for celebration photo at H17
    if (typeof checkAndRenameCelebrationPhoto === 'function') {
        console.log('[RealGameSave] 🔍 Checking celebration photo at H17');
        checkAndRenameCelebrationPhoto(gameId);
    }
    
    // Use updateGameData with WRV
    updateGameData(gameId, updateData, function(err, result) {
        if (err) {
            console.error('[RealGameSave] H17 save failed:', err);
            if (callback) callback(err);
        } else {
            console.log('[RealGameSave] H17 save successful');
            if (callback) callback(null, result);
        }
    });
}

// Make functions available globally
window.saveGameData = saveGameData;
window.updateGameData = updateGameData;
window.performSave = performSave;
window.saveInitialState = saveInitialState;
window.saveHole17 = saveHole17;

/*
FILE: js/real-game-save.js
VERSION: 1.22
KEY CHANGES from v1.21:
   - CHANGED: Firestore writes now use WRV.write() and WRV.update() for reliability
   - ADDED: Fallback to direct write/update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, celebration-photo.js
STATUS: Ready for integration
*/