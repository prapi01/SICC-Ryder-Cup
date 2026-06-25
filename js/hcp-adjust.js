/*
FILE: js/hcp-adjust.js
VERSION: 1.24
KEY CHANGES from v1.23:
   - CHANGED: Firestore writes now use WRV.update() for reliability
   - ADDED: Fallback to direct update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, history-record.js
STATUS: Ready for integration
*/

window.HCP_ADJUST_VERSION = "1.24";

/**
 * hcp-adjust.js - Handles handicap adjustment and anchor changes
 * All writes use WRV for reliability
 */

// Make sure WRV is loaded
if (typeof WRV === 'undefined') {
    console.warn('[HCPAdjust] WRV not loaded - using fallback direct writes');
}

/**
 * Update adjusted handicaps in both scheduledGames and historyGames
 * @param {string} gameId - The game ID
 * @param {object} adjustedHandicaps - The adjusted handicaps data
 * @param {function} callback - Callback (err, result)
 */
function updateAdjustedHandicaps(gameId, adjustedHandicaps, callback) {
    if (!gameId || !adjustedHandicaps) {
        if (callback) callback(new Error('Missing gameId or adjustedHandicaps'));
        return;
    }
    
    console.log('[HCPAdjust] Updating adjusted handicaps for:', gameId);
    
    var archiveId = gameId + '_H';
    var updateData = {
        adjustedHandicaps: adjustedHandicaps,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Use WRV for reliable Firestore writes
    var db = firebase.firestore();
    var updates = [];
    
    // Update scheduledGames
    updates.push(new Promise(function(resolve, reject) {
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('scheduledGames', gameId, updateData, function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[HCPAdjust] WRV not available, using direct update for scheduledGames');
            db.collection('scheduledGames').doc(gameId).update(updateData)
                .then(resolve)
                .catch(reject);
        }
    }));
    
    // Update historyGames
    updates.push(new Promise(function(resolve, reject) {
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('historyGames', archiveId, updateData, function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[HCPAdjust] WRV not available, using direct update for historyGames');
            db.collection('historyGames').doc(archiveId).update(updateData)
                .then(resolve)
                .catch(reject);
        }
    }));
    
    // Wait for all updates to complete
    Promise.all(updates)
        .then(function(results) {
            console.log('[HCPAdjust] Adjusted handicaps updated successfully');
            if (callback) callback(null, results);
        })
        .catch(function(err) {
            console.error('[HCPAdjust] Update failed:', err);
            if (callback) callback(err);
        });
}

/**
 * Update anchor change in both scheduledGames and historyGames
 * @param {string} gameId - The game ID
 * @param {object} anchorData - The anchor change data
 * @param {function} callback - Callback (err, result)
 */
function updateAnchorChange(gameId, anchorData, callback) {
    if (!gameId || !anchorData) {
        if (callback) callback(new Error('Missing gameId or anchorData'));
        return;
    }
    
    console.log('[HCPAdjust] Updating anchor change for:', gameId);
    
    var archiveId = gameId + '_H';
    var updateData = {
        anchorChange: anchorData,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Use WRV for reliable Firestore writes
    var db = firebase.firestore();
    var updates = [];
    
    // Update scheduledGames
    updates.push(new Promise(function(resolve, reject) {
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('scheduledGames', gameId, updateData, function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[HCPAdjust] WRV not available, using direct update for scheduledGames');
            db.collection('scheduledGames').doc(gameId).update(updateData)
                .then(resolve)
                .catch(reject);
        }
    }));
    
    // Update historyGames
    updates.push(new Promise(function(resolve, reject) {
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('historyGames', archiveId, updateData, function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[HCPAdjust] WRV not available, using direct update for historyGames');
            db.collection('historyGames').doc(archiveId).update(updateData)
                .then(resolve)
                .catch(reject);
        }
    }));
    
    // Wait for all updates to complete
    Promise.all(updates)
        .then(function(results) {
            console.log('[HCPAdjust] Anchor change updated successfully');
            if (callback) callback(null, results);
        })
        .catch(function(err) {
            console.error('[HCPAdjust] Anchor change update failed:', err);
            if (callback) callback(err);
        });
}

/**
 * Get adjusted handicaps for a game
 * @param {string} gameId - The game ID
 * @param {function} callback - Callback (err, data)
 */
function getAdjustedHandicaps(gameId, callback) {
    if (!gameId) {
        if (callback) callback(new Error('Missing gameId'));
        return;
    }
    
    console.log('[HCPAdjust] Getting adjusted handicaps for:', gameId);
    
    var db = firebase.firestore();
    db.collection('scheduledGames').doc(gameId).get()
        .then(function(doc) {
            if (!doc.exists) {
                if (callback) callback(new Error('Game not found'));
                return;
            }
            
            var data = doc.data();
            var adjustedHandicaps = data.adjustedHandicaps || {};
            console.log('[HCPAdjust] Adjusted handicaps retrieved');
            if (callback) callback(null, adjustedHandicaps);
        })
        .catch(function(err) {
            console.error('[HCPAdjust] Get adjusted handicaps failed:', err);
            if (callback) callback(err);
        });
}

/**
 * Initialize viewer mode (read-only)
 * @param {string} gameId - The game ID
 * @param {function} callback - Callback (err, data)
 */
function initForViewer(gameId, callback) {
    if (!gameId) {
        if (callback) callback(new Error('Missing gameId'));
        return;
    }
    
    console.log('[HCPAdjust] Initializing viewer mode for:', gameId);
    
    var db = firebase.firestore();
    db.collection('scheduledGames').doc(gameId).get()
        .then(function(doc) {
            if (!doc.exists) {
                if (callback) callback(new Error('Game not found'));
                return;
            }
            
            var data = doc.data();
            // Viewer mode - only display saved data (read-only)
            console.log('[HCPAdjust] Viewer mode initialized');
            if (callback) callback(null, data);
        })
        .catch(function(err) {
            console.error('[HCPAdjust] Viewer init failed:', err);
            if (callback) callback(err);
        });
}

// Make functions available globally
window.updateAdjustedHandicaps = updateAdjustedHandicaps;
window.updateAnchorChange = updateAnchorChange;
window.getAdjustedHandicaps = getAdjustedHandicaps;
window.initForViewer = initForViewer;

/*
FILE: js/hcp-adjust.js
VERSION: 1.24
KEY CHANGES from v1.23:
   - CHANGED: Firestore writes now use WRV.update() for reliability
   - ADDED: Fallback to direct update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, history-record.js
STATUS: Ready for integration
*/