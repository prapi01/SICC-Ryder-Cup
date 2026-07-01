/*
FILE: js/celebration-photo.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - CHANGED: Now uses canvas with JPEG quality 0.90 (same as util-photo.js)
   - CHANGED: Uploads compressed image instead of raw blob
   - ADDED: Cache-busting to GitHub source URL
   - PRESERVED: All existing functionality from v1.01
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/

window.CELEBRATION_PHOTO_VERSION = "1.02";

// ============================================================
// Helper: Add cache-busting to URL
// ============================================================
function addCacheBuster(url) {
    if (!url) return url;
    var separator = url.indexOf('?') !== -1 ? '&' : '?';
    return url + separator + 't=' + Date.now();
}

// ============================================================
// Helper: Load image from URL and compress with quality 0.90
// ============================================================
function loadAndCompressImage(url, callback) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        
        // Use original dimensions - NO RESIZING
        var width = img.width;
        var height = img.height;
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export with JPEG quality 0.90 (same as util-photo.js)
        canvas.toBlob(function(blob) {
            if (!blob) {
                callback(new Error('Failed to compress image'));
                return;
            }
            callback(null, blob);
        }, 'image/jpeg', 0.90);
    };
    
    img.onerror = function() {
        callback(new Error('Failed to load image from: ' + url));
    };
    
    img.src = url;
}

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
    var sourceUrl = addCacheBuster('https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg');
    
    console.log('[CelebrationPhoto] 📸 Copying C.jpg to:', archiveId + '.jpg');
    console.log('[CelebrationPhoto] Source URL:', sourceUrl);
    
    // Check if already copied
    destRef.getDownloadURL()
        .then(function() {
            console.log('[CelebrationPhoto] ✅ Already exists:', archiveId + '.jpg');
            if (callback) callback(null);
        })
        .catch(function() {
            // File doesn't exist, copy it with compression
            loadAndCompressImage(sourceUrl, function(err, blob) {
                if (err) {
                    console.warn('[CelebrationPhoto] ⚠️ Failed to load/compress:', err.message);
                    if (callback) callback(err);
                    return;
                }
                
                console.log('[CelebrationPhoto] Compressed size:', (blob.size / 1024).toFixed(1), 'KB');
                
                return destRef.put(blob)
                    .then(function(snapshot) {
                        return snapshot.ref.getDownloadURL();
                    })
                    .then(function(url) {
                        var updateData = {
                            'celebration.imageRef': 'celebration/' + archiveId + '.jpg',
                            'celebration.imageUrl': url,
                            'celebration.copiedAt': firebase.firestore.FieldValue.serverTimestamp()
                        };
                        
                        // Use WRV for reliable Firestore write
                        if (typeof WRV !== 'undefined' && WRV.update) {
                            return new Promise(function(resolve, reject) {
                                WRV.update('historyGames', archiveId, updateData, function(err, result) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(result);
                                    }
                                });
                            });
                        } else {
                            // Fallback: direct update
                            console.warn('[CelebrationPhoto] WRV not available, using direct update');
                            var db = firebase.firestore();
                            return db.collection('historyGames').doc(archiveId).update(updateData);
                        }
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
                    // Destination doesn't exist, copy it with compression
                    return loadAndCompressImage(url, function(err, blob) {
                        if (err) {
                            console.warn('[CelebrationPhoto] ⚠️ Failed to load/compress:', err.message);
                            return Promise.reject(err);
                        }
                        
                        console.log('[CelebrationPhoto] Compressed size:', (blob.size / 1024).toFixed(1), 'KB');
                        
                        return destRef.put(blob)
                            .then(function(snapshot) { return snapshot.ref.getDownloadURL(); })
                            .then(function(destUrl) {
                                var updateData = {
                                    'celebration.imageRef': 'celebration/' + archiveId + '.jpg',
                                    'celebration.imageUrl': destUrl,
                                    'celebration.copiedAt': firebase.firestore.FieldValue.serverTimestamp()
                                };
                                
                                return new Promise(function(resolve, reject) {
                                    if (typeof WRV !== 'undefined' && WRV.update) {
                                        WRV.update('historyGames', archiveId, updateData, function(err, result) {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                resolve(result);
                                            }
                                        });
                                    } else {
                                        console.warn('[CelebrationPhoto] WRV not available, using direct update');
                                        var db = firebase.firestore();
                                        db.collection('historyGames').doc(archiveId).update(updateData)
                                            .then(resolve)
                                            .catch(reject);
                                    }
                                });
                            })
                            .then(function() {
                                return sourceRef.delete();
                            });
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
VERSION: 1.02
KEY CHANGES from v1.01:
   - CHANGED: Now uses canvas with JPEG quality 0.90 (same as util-photo.js)
   - CHANGED: Uploads compressed image instead of raw blob
   - ADDED: Cache-busting to GitHub source URL
   - PRESERVED: All existing functionality from v1.01
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/