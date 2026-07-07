/*
FILE: js/celebration-photo.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - REMOVED: PHOTO_CHECK_HOLES constant (no longer needed)
   - REMOVED: isPhotoCheckHole() function (no longer needed)
   - CHANGED: checkAndRenameCelebrationPhoto() now checks at EVERY hole
   - REMOVED: Designated hole check logic
   - REASON: ETag check makes photo check cheap and fast at every hole
   - REASON: No need to limit to specific holes anymore
   - PRESERVED: ALL other functionality from v1.04 unchanged
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/

window.CELEBRATION_PHOTO_VERSION = "1.05";

// ============================================================
// CONSTANTS
// ============================================================

var DEFAULT_PHOTO_PATH = 'celebration/SRC_Default_Photo.jpg';
var SESSION_STORAGE_KEY = 'celebrationPhoto';

// v1.04: ETag storage keys (preserved)
var ETAG_STORAGE_KEY = 'celebration_photo_etag';
var SIZE_STORAGE_KEY = 'celebration_photo_size';

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
// v1.04: Check if C.jpg has changed using ETag/MD5Hash
// ============================================================
function checkPhotoChanged(callback) {
    var storage = firebase.storage();
    var photoRef = storage.ref('celebration/C.jpg');
    
    photoRef.getMetadata()
        .then(function(metadata) {
            var currentETag = metadata.md5Hash || metadata.etag || null;
            var currentSize = metadata.size;
            
            if (!currentETag) {
                console.warn('[CelebrationPhoto] No ETag available, forcing download');
                callback(true, metadata);
                return;
            }
            
            var cachedETag = localStorage.getItem(ETAG_STORAGE_KEY);
            var cachedSize = localStorage.getItem(SIZE_STORAGE_KEY);
            
            var changed = (currentETag !== cachedETag) || 
                          (currentSize !== parseInt(cachedSize || '0'));
            
            if (changed) {
                localStorage.setItem(ETAG_STORAGE_KEY, currentETag);
                localStorage.setItem(SIZE_STORAGE_KEY, String(currentSize));
                console.log('[CelebrationPhoto] Photo changed! ETag:', currentETag);
                callback(true, metadata);
            } else {
                console.log('[CelebrationPhoto] Photo unchanged, ETag:', currentETag);
                callback(false, metadata);
            }
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] Failed to check photo metadata:', err.message);
            // On error, assume changed to be safe
            callback(true, null);
        });
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
// v1.05: Check if C.jpg exists and rename it to game ID
// Called at EVERY hole save (ETag check makes it cheap)
// v1.05: Removed designated hole check - checks every time
// ============================================================
function checkAndRenameCelebrationPhoto(gameId, holeNumber, callback) {
    // Handle optional parameters
    if (typeof holeNumber === 'function') {
        callback = holeNumber;
        holeNumber = undefined;
    }
    
    // v1.05: NO designated hole check - check at EVERY hole
    // ETag makes it cheap and fast
    
    if (!gameId) {
        if (callback) callback(null);
        return;
    }
    
    console.log('[CelebrationPhoto] 📸 Checking photo for game:', gameId, 'at hole:', holeNumber || 'unknown');
    
    // v1.04: First check if photo has changed using ETag
    checkPhotoChanged(function(changed, metadata) {
        if (!changed) {
            console.log('[CelebrationPhoto] Photo unchanged - skipping download');
            if (callback) callback(null);
            return;
        }
        
        console.log('[CelebrationPhoto] Photo changed - downloading and renaming...');
        
        var storage = firebase.storage();
        var archiveId = gameId + '_H';
        var sourceRef = storage.ref('celebration/C.jpg');
        var destRef = storage.ref('celebration/' + archiveId + '.jpg');
        
        // Check if already renamed
        destRef.getDownloadURL()
            .then(function() {
                console.log('[CelebrationPhoto] ✅ Already renamed:', archiveId + '.jpg');
                // Update sessionStorage with existing photo
                destRef.getDownloadURL()
                    .then(function(url) {
                        updatePhotoInSessionStorage(url);
                    })
                    .catch(function(err) {
                        console.warn('[CelebrationPhoto] Failed to get URL for sessionStorage update:', err.message);
                    });
                if (callback) callback(null);
                return;
            })
            .catch(function() {
                // Not renamed yet - download and upload
                sourceRef.getDownloadURL()
                    .then(function(url) {
                        console.log('[CelebrationPhoto] 📸 Found C.jpg, renaming to:', archiveId + '.jpg');
                        return loadAndCompressImage(url, function(err, blob) {
                            if (err) {
                                console.warn('[CelebrationPhoto] ⚠️ Failed to load/compress:', err.message);
                                return Promise.reject(err);
                            }
                            
                            console.log('[CelebrationPhoto] Compressed size:', (blob.size / 1024).toFixed(1), 'KB');
                            
                            return destRef.put(blob)
                                .then(function(snapshot) {
                                    return snapshot.ref.getDownloadURL();
                                })
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
                                    console.log('[CelebrationPhoto] ✅ Renamed to:', archiveId + '.jpg');
                                    // Update sessionStorage with the renamed photo
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
                                    console.warn('[CelebrationPhoto] ⚠️ Copy failed:', err.message);
                                    if (callback) callback(err);
                                });
                        });
                    })
                    .catch(function(err) {
                        console.log('[CelebrationPhoto] ℹ️ No C.jpg found - using default photo');
                        if (callback) callback(null);
                    });
            });
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
// v1.05: Expose functions (removed isPhotoCheckHole)
// ============================================================
window.loadDefaultCelebrationPhoto = loadDefaultCelebrationPhoto;
window.copyCelebrationPhoto = copyCelebrationPhoto;
window.getCelebrationPhoto = getCelebrationPhoto;
window.getPhotoFromSessionStorage = getPhotoFromSessionStorage;
window.checkAndRenameCelebrationPhoto = checkAndRenameCelebrationPhoto;
window.updatePhotoInSessionStorage = updatePhotoInSessionStorage;
window.checkPhotoChanged = checkPhotoChanged;
window.SESSION_STORAGE_KEY = SESSION_STORAGE_KEY;
window.DEFAULT_PHOTO_PATH = DEFAULT_PHOTO_PATH;
window.ETAG_STORAGE_KEY = ETAG_STORAGE_KEY;
window.SIZE_STORAGE_KEY = SIZE_STORAGE_KEY;

/*
FILE: js/celebration-photo.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - REMOVED: PHOTO_CHECK_HOLES constant (no longer needed)
   - REMOVED: isPhotoCheckHole() function (no longer needed)
   - CHANGED: checkAndRenameCelebrationPhoto() now checks at EVERY hole
   - REMOVED: Designated hole check logic
   - REASON: ETag check makes photo check cheap and fast at every hole
   - REASON: No need to limit to specific holes anymore
   - PRESERVED: ALL other functionality from v1.04 unchanged
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/