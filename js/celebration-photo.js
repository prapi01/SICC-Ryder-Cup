/*
FILE: js/celebration-photo.js
VERSION: 1.12
KEY CHANGES from v1.11:
   - CHANGED: loadDefaultCelebrationPhoto() now uses getDownloadURL() + storeImageInSessionStorage()
   - REMOVED: getBlob() approach (not available in Firebase Storage compat SDK)
   - REASON: CORS is now configured on Firebase Storage bucket
   - REASON: getDownloadURL() + Image with crossOrigin now works
   - PRESERVED: ALL other functionality from v1.11 unchanged
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/

window.CELEBRATION_PHOTO_VERSION = "1.12";

// ============================================================
// CONSTANTS
// ============================================================

var DEFAULT_PHOTO_PATH = 'celebration/SRC_Default_Photo.jpg';
var SESSION_STORAGE_KEY = 'celebrationPhoto';

// v1.04: ETag storage keys (preserved)
var ETAG_STORAGE_KEY = 'celebration_photo_etag';
var SIZE_STORAGE_KEY = 'celebration_photo_size';

// v1.06: GitHub C.jpg URL
var GITHUB_PHOTO_URL = 'https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg';

// v1.07: localStorage prefix for photo URL
var PHOTO_URL_PREFIX = 'celebration_photo_url_';

// v1.09: Retry configuration
var MAX_UPLOAD_RETRIES = 3;
var RETRY_BASE_DELAY_MS = 2000; // 2 seconds

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
// v1.10: Store blob directly in sessionStorage (NO NETWORK)
// Converts blob to base64 using FileReader
// ============================================================
function storeBlobInSessionStorage(blob, callback) {
    if (!blob) {
        if (callback) callback(new Error('No blob provided'));
        return;
    }
    
    console.log('[CelebrationPhoto] Storing blob directly in sessionStorage (NO NETWORK)...');
    
    var reader = new FileReader();
    reader.onload = function(event) {
        try {
            var base64 = event.target.result;
            sessionStorage.setItem(SESSION_STORAGE_KEY, base64);
            console.log('[CelebrationPhoto] ✅ Stored blob in sessionStorage, size:', (base64.length / 1024).toFixed(1), 'KB');
            if (callback) callback(null, base64);
        } catch(e) {
            console.warn('[CelebrationPhoto] ❌ Failed to store blob in sessionStorage:', e.message);
            if (callback) callback(e);
        }
    };
    reader.onerror = function() {
        console.warn('[CelebrationPhoto] ❌ Failed to read blob');
        if (callback) callback(new Error('Failed to read blob'));
    };
    reader.readAsDataURL(blob);
}

// ============================================================
// v1.10: Download photo from URL and store in sessionStorage
// For VIEW devices to download from Firebase Storage
// ============================================================
function downloadPhotoToSessionStorage(url, callback) {
    if (!url) {
        if (callback) callback(new Error('No URL provided'));
        return;
    }
    
    console.log('[CelebrationPhoto] Downloading photo from URL to sessionStorage...');
    
    // Use fetch to get the image as blob
    fetch(url + '?t=' + Date.now())
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Failed to fetch: ' + response.status);
            }
            return response.blob();
        })
        .then(function(blob) {
            console.log('[CelebrationPhoto] Downloaded blob, size:', (blob.size / 1024).toFixed(1), 'KB');
            // Store the blob directly in sessionStorage
            storeBlobInSessionStorage(blob, callback);
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] ❌ Failed to download photo:', err.message);
            if (callback) callback(err);
        });
}

// ============================================================
// v1.06: Check if C.jpg has changed using GitHub ETag/Last-Modified
// Uses fetch HEAD request (fast, no download)
// ============================================================
function checkPhotoChanged(callback) {
    // v1.06: Use fetch HEAD to check GitHub C.jpg metadata
    fetch(GITHUB_PHOTO_URL, { method: 'HEAD' })
        .then(function(response) {
            if (!response.ok) {
                console.warn('[CelebrationPhoto] GitHub HEAD request failed:', response.status);
                callback(true);
                return;
            }
            
            var currentETag = response.headers.get('etag') || response.headers.get('last-modified');
            var currentSize = response.headers.get('content-length');
            
            if (!currentETag) {
                console.warn('[CelebrationPhoto] No ETag available, forcing download');
                callback(true);
                return;
            }
            
            var cachedETag = localStorage.getItem(ETAG_STORAGE_KEY);
            var cachedSize = localStorage.getItem(SIZE_STORAGE_KEY);
            
            var changed = (currentETag !== cachedETag) || 
                          (currentSize !== cachedSize);
            
            if (changed) {
                localStorage.setItem(ETAG_STORAGE_KEY, currentETag);
                localStorage.setItem(SIZE_STORAGE_KEY, currentSize || '');
                console.log('[CelebrationPhoto] Photo changed! ETag:', currentETag);
                callback(true);
            } else {
                console.log('[CelebrationPhoto] Photo unchanged, ETag:', currentETag);
                callback(false);
            }
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] Failed to check photo metadata:', err.message);
            // On error, assume changed to be safe
            callback(true);
        });
}

// ============================================================
// v1.12: Load default celebration photo from Firebase Storage
// Uses getDownloadURL() + storeImageInSessionStorage() (CORS now configured)
// Called at game start via real-game-init.js
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
            // v1.12: Use storeImageInSessionStorage (Image with crossOrigin)
            // CORS is now configured on the Firebase Storage bucket
            return storeImageInSessionStorage(url + '?t=' + Date.now(), callback);
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
// v1.09: Verify photo exists in Firebase Storage
// Returns { exists: boolean, url: string, metadata: object }
// ============================================================
function verifyPhotoUpload(archiveId, callback) {
    if (!archiveId) {
        if (callback) callback(new Error('No archiveId provided'), null);
        return;
    }
    
    var storage = firebase.storage();
    var destRef = storage.ref('celebration/' + archiveId + '.jpg');
    
    console.log('[CelebrationPhoto] 🔍 Verifying upload for:', archiveId + '.jpg');
    
    destRef.getMetadata()
        .then(function(metadata) {
            console.log('[CelebrationPhoto] ✅ Verification PASSED - file exists, size:', (metadata.size / 1024).toFixed(1), 'KB');
            // Get download URL
            return destRef.getDownloadURL()
                .then(function(url) {
                    if (callback) callback(null, { exists: true, url: url, metadata: metadata });
                })
                .catch(function(err) {
                    // Should not happen if metadata succeeded, but handle anyway
                    console.warn('[CelebrationPhoto] ⚠️ Metadata OK but download URL failed:', err.message);
                    if (callback) callback(err, null);
                });
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] ❌ Verification FAILED:', err.message);
            if (callback) callback(null, { exists: false, url: null, metadata: null });
        });
}

// ============================================================
// v1.09: Upload with verification and retry
// ============================================================
function uploadAndVerifyPhoto(archiveId, blob, retryCount, callback) {
    if (retryCount === undefined) {
        retryCount = 0;
    }
    
    var storage = firebase.storage();
    var destRef = storage.ref('celebration/' + archiveId + '.jpg');
    
    console.log('[CelebrationPhoto] 📤 Upload attempt', retryCount + 1, 'of', MAX_UPLOAD_RETRIES, 'for:', archiveId + '.jpg');
    
    // Step 1: Upload the file
    destRef.put(blob)
        .then(function(snapshot) {
            console.log('[CelebrationPhoto] Upload successful, now verifying...');
            
            // Step 2: Verify the upload
            verifyPhotoUpload(archiveId, function(err, result) {
                if (err) {
                    console.warn('[CelebrationPhoto] ⚠️ Verification error:', err.message);
                    // Treat as verification failure
                    handleVerificationFailure(archiveId, blob, retryCount, callback);
                    return;
                }
                
                if (result && result.exists) {
                    // ✅ VERIFICATION PASSED
                    console.log('[CelebrationPhoto] ✅ Upload VERIFIED for:', archiveId + '.jpg');
                    if (callback) callback(null, result.url);
                } else {
                    // ❌ Verification failed - file not found
                    console.warn('[CelebrationPhoto] ❌ Upload verification failed - file not found in Storage');
                    handleVerificationFailure(archiveId, blob, retryCount, callback);
                }
            });
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] ⚠️ Upload error:', err.message);
            handleVerificationFailure(archiveId, blob, retryCount, callback);
        });
}

function handleVerificationFailure(archiveId, blob, retryCount, callback) {
    var nextRetry = retryCount + 1;
    
    if (nextRetry < MAX_UPLOAD_RETRIES) {
        var delay = RETRY_BASE_DELAY_MS * Math.pow(1.5, retryCount);
        console.log('[CelebrationPhoto] 🔄 Retry', nextRetry + 1, 'of', MAX_UPLOAD_RETRIES, 'in', delay, 'ms...');
        
        setTimeout(function() {
            uploadAndVerifyPhoto(archiveId, blob, nextRetry, callback);
        }, delay);
    } else {
        console.error('[CelebrationPhoto] ❌ All', MAX_UPLOAD_RETRIES, 'upload attempts FAILED for:', archiveId + '.jpg');
        if (callback) callback(new Error('Upload failed after ' + MAX_UPLOAD_RETRIES + ' attempts'), null);
    }
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
    var sourceUrl = addCacheBuster(GITHUB_PHOTO_URL);
    
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
                
                uploadAndVerifyPhoto(archiveId, blob, 0, function(err, url) {
                    if (err) {
                        console.warn('[CelebrationPhoto] ⚠️ Copy failed after retries:', err.message);
                        if (callback) callback(err);
                        return;
                    }
                    
                    // Update Firestore with the verified URL
                    var updateData = {
                        'celebration.imageRef': 'celebration/' + archiveId + '.jpg',
                        'celebration.imageUrl': url,
                        'celebration.copiedAt': firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (typeof WRV !== 'undefined' && WRV.update) {
                        WRV.update('historyGames', archiveId, updateData, function(err2) {
                            if (err2) {
                                console.warn('[CelebrationPhoto] ⚠️ Firestore update failed:', err2.message);
                                // Don't fail the whole operation - photo is uploaded, Firestore update can be retried later
                                if (callback) callback(null);
                            } else {
                                console.log('[CelebrationPhoto] ✅ Firestore updated for:', archiveId + '.jpg');
                                if (callback) callback(null);
                            }
                        });
                    } else {
                        console.warn('[CelebrationPhoto] WRV not available, skipping Firestore update');
                        if (callback) callback(null);
                    }
                });
            });
        });
}

// ============================================================
// Update sessionStorage with new photo
// DEPRECATED: Use storeBlobInSessionStorage() instead (NO NETWORK)
// Kept for backward compatibility
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
// v1.07: Store photo URL in localStorage for history record creation
// ============================================================
function storePhotoUrlForHistory(gameId, imageUrl) {
    if (!gameId || !imageUrl) {
        console.warn('[CelebrationPhoto] Cannot store photo URL - missing gameId or imageUrl');
        return;
    }
    
    try {
        var key = PHOTO_URL_PREFIX + gameId;
        localStorage.setItem(key, imageUrl);
        console.log('[CelebrationPhoto] 📌 Stored photo URL in localStorage for game:', gameId);
    } catch(e) {
        console.warn('[CelebrationPhoto] Failed to store photo URL in localStorage:', e.message);
    }
}

// ============================================================
// v1.07: Get stored photo URL from localStorage
// ============================================================
function getStoredPhotoUrlForHistory(gameId) {
    if (!gameId) return null;
    
    try {
        var key = PHOTO_URL_PREFIX + gameId;
        var url = localStorage.getItem(key);
        if (url) {
            console.log('[CelebrationPhoto] Retrieved photo URL from localStorage for game:', gameId);
        }
        return url;
    } catch(e) {
        console.warn('[CelebrationPhoto] Failed to retrieve photo URL from localStorage:', e.message);
        return null;
    }
}

// ============================================================
// v1.07: Clear stored photo URL from localStorage
// ============================================================
function clearStoredPhotoUrlForHistory(gameId) {
    if (!gameId) return;
    
    try {
        var key = PHOTO_URL_PREFIX + gameId;
        localStorage.removeItem(key);
        console.log('[CelebrationPhoto] Cleared photo URL from localStorage for game:', gameId);
    } catch(e) {
        console.warn('[CelebrationPhoto] Failed to clear photo URL from localStorage:', e.message);
    }
}

// ============================================================
// v1.10: Check if C.jpg exists and rename it to game ID
// Called at EVERY hole save (ETag check makes it cheap)
// v1.10: Uses storeBlobInSessionStorage() (NO NETWORK)
// ============================================================
function checkAndRenameCelebrationPhoto(gameId, holeNumber, callback) {
    // Handle optional parameters
    if (typeof holeNumber === 'function') {
        callback = holeNumber;
        holeNumber = undefined;
    }
    
    if (!gameId) {
        if (callback) callback(null);
        return;
    }
    
    console.log('[CelebrationPhoto] 📸 Checking photo for game:', gameId, 'at hole:', holeNumber || 'unknown');
    
    // v1.06: First check if photo has changed using GitHub ETag
    checkPhotoChanged(function(changed) {
        if (!changed) {
            console.log('[CelebrationPhoto] Photo unchanged - skipping download');
            if (callback) callback(null);
            return;
        }
        
        console.log('[CelebrationPhoto] Photo changed - downloading and uploading...');
        
        var storage = firebase.storage();
        var archiveId = gameId + '_H';
        var sourceUrl = addCacheBuster(GITHUB_PHOTO_URL);
        
        // v1.08: ALWAYS upload when ETag changed - overwrite existing file
        console.log('[CelebrationPhoto] 📸 Downloading from GitHub:', sourceUrl);
        loadAndCompressImage(sourceUrl, function(err, blob) {
            if (err) {
                console.warn('[CelebrationPhoto] ⚠️ Failed to load/compress from GitHub:', err.message);
                if (callback) callback(err);
                return;
            }
            
            console.log('[CelebrationPhoto] Compressed size:', (blob.size / 1024).toFixed(1), 'KB');
            
            // v1.09: Upload with verification and retry
            uploadAndVerifyPhoto(archiveId, blob, 0, function(uploadErr, verifiedUrl) {
                if (uploadErr) {
                    console.warn('[CelebrationPhoto] ⚠️ Upload failed after retries:', uploadErr.message);
                    if (callback) callback(uploadErr);
                    return;
                }
                
                // ✅ VERIFIED - upload succeeded
                console.log('[CelebrationPhoto] ✅ Uploaded and VERIFIED to:', archiveId + '.jpg');
                
                // Update Firestore with the verified URL
                var updateData = {
                    'celebration.imageRef': 'celebration/' + archiveId + '.jpg',
                    'celebration.imageUrl': verifiedUrl,
                    'celebration.copiedAt': firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Use a promise to handle Firestore update (don't block callback)
                var firestorePromise = new Promise(function(resolve) {
                    if (typeof WRV !== 'undefined' && WRV.update) {
                        WRV.update('historyGames', archiveId, updateData, function(wrvErr) {
                            if (wrvErr) {
                                console.warn('[CelebrationPhoto] ⚠️ Firestore update failed:', wrvErr.message);
                                // Don't fail - photo is already uploaded and verified
                                resolve();
                            } else {
                                console.log('[CelebrationPhoto] ✅ Firestore updated for:', archiveId + '.jpg');
                                resolve();
                            }
                        });
                    } else {
                        var db = firebase.firestore();
                        db.collection('historyGames').doc(archiveId).update(updateData)
                            .then(function() {
                                console.log('[CelebrationPhoto] ✅ Firestore updated (direct) for:', archiveId + '.jpg');
                                resolve();
                            })
                            .catch(function(dbErr) {
                                console.warn('[CelebrationPhoto] ⚠️ Firestore direct update failed:', dbErr.message);
                                resolve();
                            });
                    }
                });
                
                // After Firestore update attempt, update sessionStorage using the blob directly (NO NETWORK)
                firestorePromise.then(function() {
                    // v1.10: Store blob directly in sessionStorage (NO NETWORK)
                    storeBlobInSessionStorage(blob, function(sessionErr) {
                        if (sessionErr) {
                            console.warn('[CelebrationPhoto] ⚠️ sessionStorage update failed:', sessionErr.message);
                            // Don't fail the whole operation - photo is already uploaded
                        } else {
                            console.log('[CelebrationPhoto] ✅ sessionStorage updated with new photo (blob direct)');
                            // Store URL in localStorage for history record
                            storePhotoUrlForHistory(gameId, verifiedUrl);
                        }
                    });
                    
                    if (callback) callback(null);
                });
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
                    // v1.07: Check localStorage as fallback
                    var storedUrl = getStoredPhotoUrlForHistory(gameId);
                    if (storedUrl) {
                        if (callback) callback(null, storedUrl);
                    } else {
                        if (callback) callback(null, GITHUB_PHOTO_URL);
                    }
                }
            } else {
                // v1.07: Check localStorage as fallback
                var storedUrl = getStoredPhotoUrlForHistory(gameId);
                if (storedUrl) {
                    if (callback) callback(null, storedUrl);
                } else {
                    if (callback) callback(null, GITHUB_PHOTO_URL);
                }
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
// v1.12: Expose functions
// ============================================================
window.loadDefaultCelebrationPhoto = loadDefaultCelebrationPhoto;
window.copyCelebrationPhoto = copyCelebrationPhoto;
window.getCelebrationPhoto = getCelebrationPhoto;
window.getPhotoFromSessionStorage = getPhotoFromSessionStorage;
window.checkAndRenameCelebrationPhoto = checkAndRenameCelebrationPhoto;
window.updatePhotoInSessionStorage = updatePhotoInSessionStorage;
window.checkPhotoChanged = checkPhotoChanged;
window.storePhotoUrlForHistory = storePhotoUrlForHistory;
window.getStoredPhotoUrlForHistory = getStoredPhotoUrlForHistory;
window.clearStoredPhotoUrlForHistory = clearStoredPhotoUrlForHistory;
window.verifyPhotoUpload = verifyPhotoUpload; // v1.09: Exposed for debugging
window.storeBlobInSessionStorage = storeBlobInSessionStorage; // v1.10: Exposed
window.downloadPhotoToSessionStorage = downloadPhotoToSessionStorage; // v1.10: Exposed
window.SESSION_STORAGE_KEY = SESSION_STORAGE_KEY;
window.DEFAULT_PHOTO_PATH = DEFAULT_PHOTO_PATH;
window.ETAG_STORAGE_KEY = ETAG_STORAGE_KEY;
window.SIZE_STORAGE_KEY = SIZE_STORAGE_KEY;
window.GITHUB_PHOTO_URL = GITHUB_PHOTO_URL;
window.PHOTO_URL_PREFIX = PHOTO_URL_PREFIX;

/*
FILE: js/celebration-photo.js
VERSION: 1.12
KEY CHANGES from v1.11:
   - CHANGED: loadDefaultCelebrationPhoto() now uses getDownloadURL() + storeImageInSessionStorage()
   - REMOVED: getBlob() approach (not available in Firebase Storage compat SDK)
   - REASON: CORS is now configured on Firebase Storage bucket
   - REASON: getDownloadURL() + Image with crossOrigin now works
   - PRESERVED: ALL other functionality from v1.11 unchanged
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/