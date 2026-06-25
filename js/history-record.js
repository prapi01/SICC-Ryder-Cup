/*
FILE: js/history-record.js
VERSION: 3.07
KEY CHANGES from v3.06:
   - CHANGED: Firestore writes now use WRV.write() and WRV.update() for reliability
   - ADDED: Fallback to direct write/update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/

window.HISTORY_RECORD_VERSION = "3.07";

/**
 * history-record.js - Handles history record operations
 * All writes use WRV for reliability
 */

// Make sure WRV is loaded
if (typeof WRV === 'undefined') {
    console.warn('[HistoryRecord] WRV not loaded - using fallback direct writes');
}

/**
 * Create a history record from game data
 * @param {string} gameId - The game ID
 * @param {object} gameData - The game data
 * @param {function} callback - Callback (err, result)
 */
function createHistoryRecord(gameId, gameData, callback) {
    if (!gameId || !gameData) {
        if (callback) callback(new Error('Missing gameId or gameData'));
        return;
    }
    
    var archiveId = gameId + '_H';
    console.log('[HistoryRecord] Creating history record:', archiveId);
    
    // Prepare history record
    var historyData = {
        gameId: gameId,
        archiveId: archiveId,
        courseName: gameData.courseName || 'SICC Bukit Course',
        gameDate: gameData.gameDate || new Date().toISOString().split('T')[0],
        teamAName: gameData.teamAName || 'Team A',
        teamBName: gameData.teamBName || 'Team B',
        teamAPlayers: gameData.teamAPlayers || [],
        teamBPlayers: gameData.teamBPlayers || [],
        teamAScore: gameData.teamAScore || 0,
        teamBScore: gameData.teamBScore || 0,
        adjustedHandicaps: gameData.adjustedHandicaps || {},
        matchResults: gameData.matchResults || {},
        f1IntraMatches: gameData.f1IntraMatches || {},
        f2IntraMatches: gameData.f2IntraMatches || {},
        status: gameData.status || 'completed',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        completedAt: gameData.completedAt || firebase.firestore.FieldValue.serverTimestamp(),
        signatures: gameData.signatures || {},
        celebration: {
            imageRef: '',
            imageUrl: '',
            capturedAt: null
        }
    };
    
    // Use WRV for reliable Firestore write
    if (typeof WRV !== 'undefined' && WRV.write) {
        WRV.write('historyGames', archiveId, historyData, function(err, result) {
            if (err) {
                console.error('[HistoryRecord] WRV write failed:', err);
                if (callback) callback(err);
            } else {
                console.log('[HistoryRecord] WRV write successful');
                if (callback) callback(null, result);
            }
        });
    } else {
        // Fallback: direct write
        console.warn('[HistoryRecord] WRV not available, using direct write');
        var db = firebase.firestore();
        db.collection('historyGames').doc(archiveId).set(historyData)
            .then(function() {
                console.log('[HistoryRecord] Direct write successful');
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error('[HistoryRecord] Direct write failed:', err);
                if (callback) callback(err);
            });
    }
}

/**
 * Update celebration pointer in history record
 * @param {string} archiveId - The archive ID (gameId_H)
 * @param {string} imageUrl - The image download URL
 * @param {function} callback - Callback (err, result)
 */
function updateCelebrationPointer(archiveId, imageUrl, callback) {
    if (!archiveId || !imageUrl) {
        if (callback) callback(new Error('Missing archiveId or imageUrl'));
        return;
    }
    
    console.log('[HistoryRecord] Updating celebration pointer for:', archiveId);
    
    var updateData = {
        'celebration.imageRef': 'celebrations/' + archiveId + '.jpg',
        'celebration.imageUrl': imageUrl,
        'celebration.capturedAt': firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Use WRV for reliable Firestore write
    if (typeof WRV !== 'undefined' && WRV.update) {
        WRV.update('historyGames', archiveId, updateData, function(err, result) {
            if (err) {
                console.error('[HistoryRecord] WRV update celebration pointer failed:', err);
                if (callback) callback(err);
            } else {
                console.log('[HistoryRecord] WRV update celebration pointer successful');
                if (callback) callback(null, result);
            }
        });
    } else {
        // Fallback: direct update
        console.warn('[HistoryRecord] WRV not available, using direct update');
        var db = firebase.firestore();
        db.collection('historyGames').doc(archiveId).update(updateData)
            .then(function() {
                console.log('[HistoryRecord] Direct update celebration pointer successful');
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error('[HistoryRecord] Direct update celebration pointer failed:', err);
                if (callback) callback(err);
            });
    }
}

/**
 * Get history record
 * @param {string} archiveId - The archive ID (gameId_H)
 * @param {function} callback - Callback (err, data)
 */
function getHistoryRecord(archiveId, callback) {
    if (!archiveId) {
        if (callback) callback(new Error('Missing archiveId'));
        return;
    }
    
    console.log('[HistoryRecord] Getting history record:', archiveId);
    
    var db = firebase.firestore();
    db.collection('historyGames').doc(archiveId).get()
        .then(function(doc) {
            if (!doc.exists) {
                if (callback) callback(new Error('History record not found'));
                return;
            }
            
            var data = doc.data();
            data.id = doc.id;
            console.log('[HistoryRecord] History record retrieved');
            if (callback) callback(null, data);
        })
        .catch(function(err) {
            console.error('[HistoryRecord] Get history record failed:', err);
            if (callback) callback(err);
        });
}

/**
 * Update history record with game data
 * @param {string} archiveId - The archive ID (gameId_H)
 * @param {object} updateData - The data to update
 * @param {function} callback - Callback (err, result)
 */
function updateHistoryRecord(archiveId, updateData, callback) {
    if (!archiveId || !updateData) {
        if (callback) callback(new Error('Missing archiveId or updateData'));
        return;
    }
    
    console.log('[HistoryRecord] Updating history record:', archiveId);
    
    updateData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
    
    // Use WRV for reliable Firestore write
    if (typeof WRV !== 'undefined' && WRV.update) {
        WRV.update('historyGames', archiveId, updateData, function(err, result) {
            if (err) {
                console.error('[HistoryRecord] WRV update history record failed:', err);
                if (callback) callback(err);
            } else {
                console.log('[HistoryRecord] WRV update history record successful');
                if (callback) callback(null, result);
            }
        });
    } else {
        // Fallback: direct update
        console.warn('[HistoryRecord] WRV not available, using direct update');
        var db = firebase.firestore();
        db.collection('historyGames').doc(archiveId).update(updateData)
            .then(function() {
                console.log('[HistoryRecord] Direct update history record successful');
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error('[HistoryRecord] Direct update history record failed:', err);
                if (callback) callback(err);
            });
    }
}

// Make functions available globally
window.createHistoryRecord = createHistoryRecord;
window.updateCelebrationPointer = updateCelebrationPointer;
window.getHistoryRecord = getHistoryRecord;
window.updateHistoryRecord = updateHistoryRecord;

/*
FILE: js/history-record.js
VERSION: 3.07
KEY CHANGES from v3.06:
   - CHANGED: Firestore writes now use WRV.write() and WRV.update() for reliability
   - ADDED: Fallback to direct write/update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/