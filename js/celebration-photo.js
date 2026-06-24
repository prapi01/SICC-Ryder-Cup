/*
FILE: js/celebration-photo.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Centralized celebration photo management
   - Copies C.jpg from GitHub to Firebase Storage
   - Stores pointer in history record
   - Checks for C.jpg at key points in the game
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/

window.CELEBRATION_PHOTO_VERSION = "1.00";

/**
 * Copy C.jpg from GitHub to Firebase Storage with game ID
 * Called at celebration time (SEE RESULTS)
 * 
 * @param {string} gameId - The game ID (e.g., GM_260624_0902_70_R)
 * @param {function} callback - Optional callback
 */
function copyCelebrationPhoto(gameId, callback) {
    if (!gameId) {
        if (callback) callback(null);
        return;
    }
    
    var storage = firebase.storage();
    var archiveId = gameId + '_H';
    var destRef = storage.ref('celebration/' + archiveId + '.jpg');
    var sourceUrl = 'https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg';
    
    console.log('[CelebrationPhoto] 📸 Copying C.jpg to:', archiveId + '.jpg');
    
    // Check if already copied
    destRef.getDownloadURL()
        .then(function() {
            console.log('[CelebrationPhoto] ✅ Already exists:', archiveId + '.jpg');
            if (callback) callback(null);
        })
        .catch(function() {
            // File doesn't exist, copy it
            fetch(sourceUrl)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('Failed to fetch C.jpg from GitHub');
                    }
                    return response.blob();
                })
                .then(function(blob) {
                    return destRef.put(blob);
                })
                .then(function(snapshot) {
                    return snapshot.ref.getDownloadURL();
                })
                .then(function(url) {
                    var db = firebase.firestore();
                    return db.collection('historyGames').doc(archiveId).update({
                        'celebration.imageRef': 'celebration/' + archiveId + '.jpg',
                        'celebration.imageUrl': url,
                        'celebration.copiedAt': firebase.firestore.FieldValue.serverTimestamp()
                    });
                })
                .then(function() {
                    console.log('[CelebrationPhoto] ✅ Copied to:', archiveId + '.jpg');
                    if (callback) callback(null);
                })
                .catch(function(err) {
                    console.warn('[CelebrationPhoto] ⚠️ Copy failed:', err.message);
                    if (callback) callback(err);
                });
        });
}

/**
 * Check if C.jpg exists in Firebase Storage and rename it to game ID
 * Called at game start (H1) and key holes (H4, H9, H14)
 * 
 * @param {string} gameId - The game ID
 * @param {function} callback - Optional callback
 */
function checkAndRenameCelebrationPhoto(gameId, callback) {
    if (!gameId) {
        if (callback) callback(null);
        return;
    }
    
    var storage = firebase.storage();
    var archiveId = gameId + '_H';
    var sourceRef = storage.ref('celebration/C.jpg');
    var destRef = storage.ref('celebration/' + archiveId + '.jpg');
    
    // Check if C.jpg exists in Firebase Storage
    sourceRef.getDownloadURL()
        .then(function(url) {
            console.log('[CelebrationPhoto] 📸 Found C.jpg, renaming to:', archiveId + '.jpg');
            
            // Check if destination already exists
            return destRef.getDownloadURL()
                .then(function() {
                    console.log('[CelebrationPhoto] ✅ Already renamed:', archiveId + '.jpg');
                    // Delete the source C.jpg
                    return sourceRef.delete();
                })
                .catch(function() {
                    // Destination doesn't exist, copy it
                    return fetch(url)
                        .then(function(response) { return response.blob(); })
                        .then(function(blob) { return destRef.put(blob); })
                        .then(function(snapshot) { return snapshot.ref.getDownloadURL(); })
                        .then(function(destUrl) {
                            var db = firebase.firestore();
                            return db.collection('historyGames').doc(archiveId).update({
                                'celebration.imageRef': 'celebration/' + archiveId + '.jpg',
                                'celebration.imageUrl': destUrl,
                                'celebration.copiedAt': firebase.firestore.FieldValue.serverTimestamp()
                            });
                        })
                        .then(function() {
                            return sourceRef.delete();
                        });
                });
        })
        .then(function() {
            console.log('[CelebrationPhoto] ✅ Renamed to:', archiveId + '.jpg');
            if (callback) callback(null);
        })
        .catch(function(err) {
            // No C.jpg - that's fine
            console.log('[CelebrationPhoto] ℹ️ No C.jpg found');
            if (callback) callback(null);
        });
}

/**
 * Get the celebration photo URL for a game
 * 
 * @param {string} gameId - The game ID
 * @param {function} callback - Callback with (err, url)
 */
function getCelebrationPhoto(gameId, callback) {
    var archiveId = gameId + '_H';
    var db = firebase.firestore();
    
    db.collection('historyGames').doc(archiveId).get()
        .then(function(doc) {
            if (doc.exists) {
                var url = doc.data()?.celebration?.imageUrl;
                if (url) {
                    if (callback) callback(null, url);
                } else {
                    // Fallback to C.jpg from GitHub
                    if (callback) callback(null, 'https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg');
                }
            } else {
                if (callback) callback(null, 'https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg');
            }
        })
        .catch(function(err) {
            if (callback) callback(err);
        });
}

// Make available globally
window.copyCelebrationPhoto = copyCelebrationPhoto;
window.getCelebrationPhoto = getCelebrationPhoto;
window.checkAndRenameCelebrationPhoto = checkAndRenameCelebrationPhoto;

/*
FILE: js/celebration-photo.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Centralized celebration photo management
   - Copies C.jpg from GitHub to Firebase Storage
   - Stores pointer in history record
   - Checks for C.jpg at key points in the game
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/