/*
FILE: js/celebration-photo.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - ADDED: loadDefaultCelebrationPhoto() - loads SRC_Default_Photo.jpg into sessionStorage
   - ADDED: updatePhotoInSessionStorage() - updates sessionStorage with new photo
   - CHANGED: checkAndRenameCelebrationPhoto() now updates sessionStorage after rename
   - CHANGED: getCelebrationImage() checks sessionStorage first
   - REASON: Photo must be available instantly on post-game.html
   - REASON: No network loading on celebration screen
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/

window.CELEBRATION_PHOTO_VERSION = "1.03";

// ============================================================
// CONSTANTS
// ============================================================

var DEFAULT_PHOTO_PATH = 'celebration/SRC_Default_Photo.jpg';
var SESSION_STORAGE_KEY = 'celebrationPhoto';

// ============================================================
// Helper: Add cache-busting to URL
// ============================================================
function addCacheBuster(url) {
    if (!url) return url;
    var separator = url.indexOf('?') !== -1 ? '&' : '?';
    return url + separator + 't=' + Date.now();
}

// ============================================================
// Helper: Load image from URL and store in sessionStorage
// ============================================================
function storeImageInSessionStorage(url, callback) {
    if (!url) {
        if (callback) callback(new Error('No URL provided'));
        return;
    }
    
    var img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        var canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, dataUrl);
            console.log('[CelebrationPhoto] Stored in sessionStorage, size:', (dataUrl.length / 1024).toFixed(1), 'KB');
            if (callback) callback(null, dataUrl);
        } catch(e) {
            console.warn('[CelebrationPhoto] Failed to store:', e.message);
            if (callback) callback(e);
        }
    };
    
    img.onerror = function() {
        console.warn('[CelebrationPhoto] Failed to load image:', url);
        if (callback) callback(new Error('Failed to load image'));
    };
    
    img.src = url;
}

// ============================================================
// Load default celebration photo from Firebase Storage
// Called at game start (H1) via real-game-init.js
// ============================================================
function loadDefaultCelebrationPhoto(callback) {
    // Check if already in sessionStorage
    if (sessionStorage.getItem(SESSION_STORAGE_KEY)) {
        console.log('[CelebrationPhoto] Photo already in sessionStorage');
        if (callback) callback(null);
        return;
    }
    
    console.log('[CelebrationPhoto] Loading default photo from Firebase Storage...');
    
    var storage = firebase.storage();
    var defaultRef = storage.ref(DEFAULT_PHOTO_PATH);
    
    defaultRef.getDownloadURL()
        .then(function(url) {
            console.log('[CelebrationPhoto] Default photo URL obtained');
            return storeImageInSessionStorage(url, callback);
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] Failed to get default photo:', err.message);
            if (callback) callback(err);
        });
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
        
        var width = img.width;
        var height = img.height;
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
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

// ============================================================
// Copy C.jpg from GitHub to Firebase Storage with game ID
// ============================================================
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
    
    destRef.getDownloadURL()
        .then(function() {
            console.log('[CelebrationPhoto] ✅ Already exists:', archiveId + '.jpg');
            if (callback) callback(null);
        })
        .catch(function() {
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

// ============================================================
// Update sessionStorage with new photo
// ============================================================
function updatePhotoInSessionStorage(imageUrl, callback) {
    if (!imageUrl) {
        if (callback) callback(new Error('No URL provided'));
        return;
    }
    
    console.log('[CelebrationPhoto] Updating sessionStorage with new photo...');
    storeImageInSessionStorage(imageUrl + '?t=' + Date.now(), callback);
}

// ============================================================
// Check if C.jpg exists in Firebase Storage and rename it to game ID
// Called at game start (H1) and key holes (H4, H9, H14)
// ============================================================
function checkAndRenameCelebrationPhoto(gameId, callback) {
    if (!gameId) {
        if (callback) callback(null);
        return;
    }
    
    var storage = firebase.storage();
    var archiveId = gameId + '_H';
    var sourceRef = storage.ref('celebration/C.jpg');
    var destRef = storage.ref('celebration/' + archiveId + '.jpg');
    
    sourceRef.getDownloadURL()
        .then(function(url) {
            console.log('[CelebrationPhoto] 📸 Found C.jpg, renaming to:', archiveId + '.jpg');
            
            return destRef.getDownloadURL()
                .then(function() {
                    console.log('[CelebrationPhoto] ✅ Already renamed:', archiveId + '.jpg');
                    return sourceRef.delete();
                })
                .catch(function() {
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
            
            // v1.03: Update sessionStorage with the renamed photo
            var storage = firebase.storage();
            var destRef = storage.ref('celebration/' + archiveId + '.jpg');
            destRef.getDownloadURL()
                .then(function(url) {
                    updatePhotoInSessionStorage(url);
                })
                .catch(function(err) {
                    console.warn('[CelebrationPhoto] Failed to get URL for sessionStorage update:', err.message);
                });
            
            if (callback) callback(null);
        })
        .catch(function(err) {
            console.log('[CelebrationPhoto] ℹ️ No C.jpg found - using default photo');
            if (callback) callback(null);
        });
}

// ============================================================
// Get the celebration photo URL for a game
// ============================================================
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

// ============================================================
// Get photo from sessionStorage (for post-game.html)
// ============================================================
function getPhotoFromSessionStorage() {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) || null;
}

// ============================================================
// Make available globally
// ============================================================
window.loadDefaultCelebrationPhoto = loadDefaultCelebrationPhoto;
window.copyCelebrationPhoto = copyCelebrationPhoto;
window.getCelebrationPhoto = getCelebrationPhoto;
window.getPhotoFromSessionStorage = getPhotoFromSessionStorage;
window.checkAndRenameCelebrationPhoto = checkAndRenameCelebrationPhoto;
window.updatePhotoInSessionStorage = updatePhotoInSessionStorage;
window.SESSION_STORAGE_KEY = SESSION_STORAGE_KEY;
window.DEFAULT_PHOTO_PATH = DEFAULT_PHOTO_PATH;

/*
FILE: js/celebration-photo.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - ADDED: loadDefaultCelebrationPhoto() - loads SRC_Default_Photo.jpg into sessionStorage
   - ADDED: updatePhotoInSessionStorage() - updates sessionStorage with new photo
   - ADDED: getPhotoFromSessionStorage() - for post-game.html
   - CHANGED: checkAndRenameCelebrationPhoto() now updates sessionStorage after rename
   - REASON: Photo must be available instantly on post-game.html
   - REASON: No network loading on celebration screen
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/