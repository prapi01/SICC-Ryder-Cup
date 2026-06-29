/*
FILE: js/util-photo.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - REMOVED: All delete-related functions (moved to DELETE tab)
   - REMOVED: deletePhotoFromStorage, deletePhotosFromStorage, deletePhotoWithReferences
   - REMOVED: deletePhotoStorageOnly, deletePhotoComplete, findPhotoReferences
   - REMOVED: removeSingleReference, deleteCurrentPhoto
   - PRESERVED: Load, upload, view, copy, save to Firestore functions
   - PRESERVED: listPhotosInStorage (used by DELETE tab)
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/

// Version exposure
window.PHOTO_UTIL_VERSION = "1.06";

console.log('[PHOTO] Loading util-photo.js v1.06...');

// ============================================================
// STATE
// ============================================================

var photoStorage = null;
var photoStorageEnv = null;
var currentPhotoData = null;
var currentPhotoUrl = null;
var currentDownloadUrl = null;
var currentFullPath = null;

// Default image URL (Cloudflare)
var DEFAULT_IMAGE_URL = 'https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg';

// ============================================================
// LOGGING (fallback if main log not available)
// ============================================================

function photoLog(message, type) {
    console.log('[PHOTO]', message);
    if (typeof window.log === 'function') {
        window.log(message, type);
    }
}

// ============================================================
// ENVIRONMENT FUNCTIONS
// ============================================================

function setPhotoEnvironment(env) {
    console.log('[PHOTO] Setting environment to:', env);
    photoLog('Setting environment to: ' + env, 'info');
    
    try {
        if (env === 'PROD') {
            var prodApp = firebase.apps.find(function(app) { return app.name === "prod"; });
            if (prodApp) {
                photoStorage = firebase.storage(prodApp);
                photoStorageEnv = 'PROD';
                updatePhotoUI('PROD');
                photoLog('✅ PRODUCTION storage initialized', 'success');
                return true;
            } else {
                photoStorage = firebase.storage();
                photoStorageEnv = 'PROD';
                updatePhotoUI('PROD');
                photoLog('✅ PRODUCTION storage initialized (default)', 'success');
                return true;
            }
        } else if (env === 'DEV') {
            var devApp = firebase.apps.find(function(app) { return app.name === "dev"; });
            if (devApp) {
                photoStorage = firebase.storage(devApp);
                photoStorageEnv = 'DEV';
                updatePhotoUI('DEV');
                photoLog('✅ DEVELOPMENT storage initialized', 'success');
                return true;
            } else {
                photoStorage = firebase.storage();
                photoStorageEnv = 'DEV';
                updatePhotoUI('DEV');
                photoLog('✅ DEVELOPMENT storage initialized (default)', 'success');
                return true;
            }
        }
    } catch (e) {
        console.error('[PHOTO] Error initializing storage:', e);
        photoLog('❌ Failed to initialize storage: ' + e.message, 'error');
        return false;
    }
    
    photoLog('❌ Environment not recognized: ' + env, 'error');
    return false;
}

function updatePhotoUI(env) {
    var prodBtn = document.getElementById('photoProdBtn');
    var devBtn = document.getElementById('photoDevBtn');
    var indicator = document.getElementById('photoIndicator');
    
    if (prodBtn) prodBtn.classList.remove('active-prod');
    if (devBtn) devBtn.classList.remove('active-dev');
    
    if (env === 'PROD') {
        if (prodBtn) prodBtn.classList.add('active-prod');
        if (indicator) {
            indicator.className = 'env-indicator-small prod';
            indicator.textContent = '🔴 PRODUCTION';
        }
    } else if (env === 'DEV') {
        if (devBtn) devBtn.classList.add('active-dev');
        if (indicator) {
            indicator.className = 'env-indicator-small dev';
            indicator.textContent = '🟡 DEVELOPMENT';
        }
    } else {
        if (indicator) {
            indicator.className = 'env-indicator-small none';
            indicator.textContent = 'Not connected';
        }
    }
}

// ============================================================
// DISPLAY PHOTO IN VIEWER
// ============================================================

function displayPhotoInViewer(img) {
    var viewer = document.getElementById('photoViewer');
    if (!viewer) {
        console.error('[PHOTO] Viewer element not found');
        return;
    }
    
    viewer.innerHTML = '';
    viewer.style.display = 'flex';
    viewer.style.alignItems = 'center';
    viewer.style.justifyContent = 'center';
    viewer.style.background = '#0a0a0a';
    viewer.style.overflow = 'hidden';
    
    var imgElement = document.createElement('img');
    imgElement.src = img.src;
    imgElement.style.maxWidth = '100%';
    imgElement.style.maxHeight = '100%';
    imgElement.style.objectFit = 'contain';
    imgElement.style.borderRadius = '4px';
    
    viewer.appendChild(imgElement);
}

// ============================================================
// LOAD PHOTO FROM URL
// ============================================================

function loadPhotoFromUrl() {
    console.log('[PHOTO] loadPhotoFromUrl called');
    
    var urlInput = document.getElementById('photoUrlInput');
    var url = urlInput ? urlInput.value.trim() : DEFAULT_IMAGE_URL;
    
    if (!url) {
        photoLog('Please enter a URL', 'error');
        return;
    }
    
    photoLog('Loading image from: ' + url, 'info');
    
    var viewer = document.getElementById('photoViewer');
    if (viewer) {
        viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:1rem;">⏳ Loading...</div>';
    }
    
    var statusDiv = document.getElementById('photoStatus');
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="log-info">⏳ Loading from: ' + url + '</span>';
    }
    
    var img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        console.log('[PHOTO] Image loaded:', img.width, 'x', img.height);
        currentPhotoData = img;
        currentPhotoUrl = url;
        displayPhotoInViewer(img);
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="log-success">✅ Loaded: ' + url + ' (' + img.width + 'x' + img.height + ')</span>';
        }
        photoLog('✅ Image loaded: ' + img.width + 'x' + img.height, 'success');
        
        var filenameInput = document.getElementById('photoFilename');
        if (filenameInput && !filenameInput.value) {
            var env = photoStorageEnv || 'PROD';
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            filenameInput.value = env + '_C_' + timestamp + '.jpg';
        }
        
        var uploadBtn = document.getElementById('photoUploadBtn');
        if (uploadBtn) uploadBtn.style.display = 'block';
    };
    
    img.onerror = function() {
        console.error('[PHOTO] Failed to load image from:', url);
        if (viewer) {
            viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff6b6b;font-size:1rem;">❌ Failed to load image<br><span style="font-size:0.7rem;color:#888;">Check URL and CORS settings</span></div>';
        }
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="log-error">❌ Failed to load: ' + url + '</span>';
        }
        photoLog('❌ Failed to load image: ' + url, 'error');
        currentPhotoData = null;
        currentPhotoUrl = null;
    };
    
    img.src = url;
}

// ============================================================
// UPLOAD TO STORAGE
// ============================================================

function uploadPhotoToStorage() {
    console.log('[PHOTO] uploadPhotoToStorage called');
    
    if (!photoStorage) {
        photoLog('❌ Select an environment first (PROD/DEV)', 'error');
        return;
    }
    
    if (!currentPhotoData) {
        photoLog('❌ Load an image first', 'error');
        return;
    }
    
    var filenameInput = document.getElementById('photoFilename');
    var filename = filenameInput ? filenameInput.value.trim() : '';
    
    if (!filename) {
        photoLog('❌ Enter a filename', 'error');
        return;
    }
    
    var folderInput = document.getElementById('photoStorageFolder');
    var folder = folderInput ? folderInput.value.trim() : 'celebrations/';
    if (folder && !folder.endsWith('/')) {
        folder = folder + '/';
    }
    
    var env = photoStorageEnv || 'PROD';
    var fullPath = folder + env + '_' + filename;
    currentFullPath = fullPath;
    
    var statusDiv = document.getElementById('photoUploadStatus');
    var progressDiv = document.getElementById('photoProgress');
    
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="log-info">⏳ Uploading to: ' + fullPath + ' ...</span>';
    }
    if (progressDiv) {
        progressDiv.style.display = 'block';
        var bar = progressDiv.querySelector('.progress-bar');
        if (bar) bar.style.width = '0%';
    }
    
    photoLog('Uploading to: ' + fullPath, 'info');
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    
    var maxDim = 1200;
    var width = currentPhotoData.width;
    var height = currentPhotoData.height;
    
    if (width > maxDim || height > maxDim) {
        var ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(currentPhotoData, 0, 0, width, height);
    
    canvas.toBlob(function(blob) {
        if (!blob) {
            photoLog('❌ Failed to convert image', 'error');
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="log-error">❌ Failed to convert image</span>';
            }
            return;
        }
        
        var storageRef = photoStorage.ref(fullPath);
        var uploadTask = storageRef.put(blob);
        
        uploadTask.on('state_changed',
            function(snapshot) {
                var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (progressDiv) {
                    var bar = progressDiv.querySelector('.progress-bar');
                    if (bar) bar.style.width = progress + '%';
                }
            },
            function(error) {
                photoLog('❌ Upload failed: ' + error.message, 'error');
                if (statusDiv) {
                    statusDiv.innerHTML = '<span class="log-error">❌ Upload failed: ' + error.message + '</span>';
                }
                console.error('[PHOTO] Upload error:', error);
            },
            function() {
                uploadTask.snapshot.ref.getDownloadURL().then(function(downloadURL) {
                    currentDownloadUrl = downloadURL;
                    photoLog('✅ Upload successful!', 'success');
                    console.log('[PHOTO] Upload successful');
                    
                    if (statusDiv) {
                        statusDiv.innerHTML = '<span class="log-success">✅ Upload successful! Click "Show Info" to view details.</span>';
                    }
                    if (progressDiv) {
                        progressDiv.style.display = 'none';
                    }
                    
                    var uploadedViewer = document.getElementById('uploadedPhotoViewer');
                    if (uploadedViewer) {
                        uploadedViewer.innerHTML = '';
                        var img = document.createElement('img');
                        img.src = downloadURL;
                        img.style.maxWidth = '100%';
                        img.style.maxHeight = '200px';
                        img.style.objectFit = 'contain';
                        img.style.borderRadius = '8px';
                        img.style.border = '1px solid #4caf50';
                        uploadedViewer.appendChild(img);
                    }
                    
                    var card = document.getElementById('uploadedPhotoCard');
                    if (card) card.style.display = 'block';
                    
                    var infoBtn = document.getElementById('showPhotoInfoBtn');
                    if (infoBtn) infoBtn.style.display = 'inline-block';
                    
                    var copyBtn = document.getElementById('copyUrlBtn');
                    if (copyBtn) copyBtn.style.display = 'inline-block';
                });
            }
        );
    }, 'image/jpeg', 0.85);
}

// ============================================================
// RESET
// ============================================================

function resetPhotoTool() {
    console.log('[PHOTO] resetPhotoTool called');
    currentPhotoData = null;
    currentPhotoUrl = null;
    currentDownloadUrl = null;
    currentFullPath = null;
    
    var viewer = document.getElementById('photoViewer');
    if (viewer) {
        viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:1rem;">🖼️ Load an image to preview</div>';
    }
    
    var uploadedViewer = document.getElementById('uploadedPhotoViewer');
    if (uploadedViewer) uploadedViewer.innerHTML = '';
    
    var statusDiv = document.getElementById('photoStatus');
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="log-info">Ready. Load an image from the URL above.</span>';
    }
    
    var uploadStatusDiv = document.getElementById('photoUploadStatus');
    if (uploadStatusDiv) uploadStatusDiv.innerHTML = '';
    
    var card = document.getElementById('uploadedPhotoCard');
    if (card) card.style.display = 'none';
    
    var infoBtn = document.getElementById('showPhotoInfoBtn');
    if (infoBtn) infoBtn.style.display = 'none';
    
    var copyBtn = document.getElementById('copyUrlBtn');
    if (copyBtn) copyBtn.style.display = 'none';
    
    var uploadBtn = document.getElementById('photoUploadBtn');
    if (uploadBtn) uploadBtn.style.display = 'none';
    
    var progressDiv = document.getElementById('photoProgress');
    if (progressDiv) progressDiv.style.display = 'none';
    
    var panel = document.getElementById('photoInfoPanel');
    if (panel) {
        panel.style.display = 'none';
        panel.innerHTML = '';
    }
    
    photoLog('Reset complete', 'info');
}

// ============================================================
// COPY URL
// ============================================================

function copyPhotoUrl() {
    if (!currentDownloadUrl) {
        photoLog('❌ No photo URL to copy', 'error');
        return;
    }
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentDownloadUrl)
            .then(function() {
                photoLog('✅ URL copied to clipboard', 'success');
            })
            .catch(function() {
                copyUrlFallback();
            });
    } else {
        copyUrlFallback();
    }
}

function copyUrlFallback() {
    var textarea = document.createElement('textarea');
    textarea.value = currentDownloadUrl;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        photoLog('✅ URL copied to clipboard (fallback)', 'success');
    } catch(e) {
        photoLog('❌ Failed to copy URL', 'error');
    }
    document.body.removeChild(textarea);
}

// ============================================================
// SHOW INFO (SIMPLIFIED - NO DELETE BUTTONS)
// ============================================================

function showPhotoInfo() {
    if (!currentDownloadUrl) {
        photoLog('❌ No photo uploaded yet', 'error');
        return;
    }
    
    var panel = document.getElementById('photoInfoPanel');
    if (!panel) return;
    
    panel.style.display = 'block';
    panel.innerHTML = `
        <div style="background:#0a0a0a; border-radius:12px; padding:16px; border:1px solid #2a2a2a;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                <span style="font-size:0.9rem; font-weight:600; color:#ffaa44;">📸 PHOTO INFORMATION</span>
                <button onclick="closePhotoInfoPanel()" style="padding:4px 16px; border-radius:20px; border:1px solid #333; background:transparent; color:#888; cursor:pointer;">✕ Close</button>
            </div>
            
            <div style="background:#0a0a0a; border-radius:8px; padding:12px; text-align:center; margin-bottom:12px; border:1px solid #2a2a2a;">
                <img src="${currentDownloadUrl}" 
                     style="max-width:100%; max-height:250px; object-fit:contain; border-radius:4px;"
                     onerror="this.style.display='none';">
            </div>
            
            <div style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">
                <div style="display:grid; grid-template-columns:auto 1fr; gap:2px 16px; font-size:0.75rem;">
                    <span style="color:#888;">📍 Path:</span>
                    <span style="color:#e0e0e0; font-family:monospace; word-break:break-all;">${currentFullPath || 'Unknown'}</span>
                    <span style="color:#888;">🔗 URL:</span>
                    <span style="color:#ffaa44; font-family:monospace; font-size:0.65rem; word-break:break-all;">${currentDownloadUrl}</span>
                </div>
            </div>
            
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; padding-top:12px; border-top:1px solid #2a2a2a;">
                <button onclick="copyPhotoUrl()" 
                        class="btn btn-secondary" 
                        style="flex:1; min-width:100px; margin-top:0; padding:10px 16px; font-size:0.8rem;">
                    📋 Copy URL
                </button>
                <button onclick="resetPhotoTool()" 
                        class="btn btn-secondary" 
                        style="flex:1; min-width:100px; margin-top:0; padding:10px 16px; font-size:0.8rem;">
                    🔄 Reset
                </button>
            </div>
        </div>
    `;
}

function closePhotoInfoPanel() {
    var panel = document.getElementById('photoInfoPanel');
    if (panel) {
        panel.style.display = 'none';
        panel.innerHTML = '';
    }
}

// ============================================================
// SAVE TO FIRESTORE
// ============================================================

function savePhotoToFirestore() {
    if (!currentDownloadUrl) {
        photoLog('❌ Upload a photo first', 'error');
        return;
    }
    
    var collection = document.getElementById('photoFirestoreCollection');
    var docId = document.getElementById('photoFirestoreDocId');
    var field = document.getElementById('photoFirestoreField');
    
    if (!collection || !docId || !field) {
        photoLog('❌ Missing Firestore fields', 'error');
        return;
    }
    
    var collectionName = collection.value.trim();
    var documentId = docId.value.trim();
    var fieldName = field.value.trim();
    
    if (!collectionName || !documentId || !fieldName) {
        photoLog('❌ Fill in all Firestore fields', 'error');
        return;
    }
    
    var db = photoStorageEnv === 'PROD' ? prodDb : devDb;
    if (!db) {
        photoLog('❌ Database not available', 'error');
        return;
    }
    
    photoLog('Saving to: ' + collectionName + '/' + documentId + ' -> ' + fieldName, 'info');
    
    var updateData = {};
    updateData[fieldName] = currentDownloadUrl;
    
    db.collection(collectionName).doc(documentId).update(updateData)
        .then(function() {
            photoLog('✅ Saved to Firestore: ' + collectionName + '/' + documentId, 'success');
            var statusDiv = document.getElementById('firestoreStatus');
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="log-success">✅ Saved to: ' + collectionName + '/' + documentId + ' -> ' + fieldName + '</span>';
            }
        })
        .catch(function(err) {
            photoLog('❌ Failed to save: ' + err.message, 'error');
            var statusDiv = document.getElementById('firestoreStatus');
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="log-error">❌ Failed: ' + err.message + '</span>';
            }
        });
}

// ============================================================
// LIST PHOTOS (USED BY DELETE TAB)
// ============================================================

function listPhotosInStorage(folder, callback) {
    if (!photoStorage) {
        var err = new Error("Select an environment first (PROD/DEV)");
        if (callback) callback(err);
        return;
    }
    
    if (!folder) folder = 'celebrations/';
    if (!folder.endsWith('/')) folder = folder + '/';
    
    photoLog('📂 Listing photos in: ' + folder, 'info');
    
    var ref = photoStorage.ref(folder);
    var photos = [];
    
    ref.listAll()
        .then(function(result) {
            var promises = result.items.map(function(item) {
                return item.getMetadata().then(function(metadata) {
                    return {
                        name: item.name,
                        fullPath: item.fullPath,
                        size: metadata.size,
                        contentType: metadata.contentType,
                        updated: metadata.updated,
                        created: metadata.timeCreated
                    };
                });
            });
            return Promise.all(promises);
        })
        .then(function(photoList) {
            photoList.sort(function(a, b) {
                return new Date(b.updated) - new Date(a.updated);
            });
            photos = photoList;
            photoLog('📸 Found ' + photos.length + ' photos in ' + folder, 'success');
            if (callback) callback(null, photos);
        })
        .catch(function(err) {
            photoLog('❌ Failed to list photos: ' + err.message, 'error');
            if (callback) callback(err);
        });
}

// ============================================================
// DELETE PHOTOS (USED BY DELETE TAB)
// ============================================================

function deletePhotosFromStorage(paths, callback) {
    if (!photoStorage) {
        var err = new Error("Select an environment first (PROD/DEV)");
        if (callback) callback(err);
        return;
    }
    
    if (!paths || paths.length === 0) {
        var err = new Error("No paths specified");
        if (callback) callback(err);
        return;
    }
    
    photoLog('🗑️ Deleting ' + paths.length + ' photos from Storage', 'info');
    
    var results = {
        total: paths.length,
        deleted: 0,
        failed: 0,
        notFound: 0,
        details: []
    };
    
    var promises = paths.map(function(path) {
        return new Promise(function(resolve) {
            var ref = photoStorage.ref(path);
            ref.delete()
                .then(function() {
                    results.deleted++;
                    results.details.push({ path: path, status: 'deleted' });
                    resolve({ path: path, success: true });
                })
                .catch(function(err) {
                    if (err.code === 'storage/object-not-found') {
                        results.notFound++;
                        results.details.push({ path: path, status: 'notFound' });
                        resolve({ path: path, success: false, notFound: true });
                    } else {
                        results.failed++;
                        results.details.push({ path: path, status: 'failed', error: err.message });
                        resolve({ path: path, success: false, error: err.message });
                    }
                });
        });
    });
    
    Promise.all(promises)
        .then(function() {
            var msg = 'Deletion complete: ' + results.deleted + ' deleted';
            if (results.notFound > 0) msg += ', ' + results.notFound + ' not found';
            if (results.failed > 0) msg += ', ' + results.failed + ' failed';
            photoLog(msg, results.failed === 0 ? 'success' : 'warning');
            if (callback) callback(null, results);
        });
}

// ============================================================
// INITIALIZE PHOTO TAB
// ============================================================

function initPhotoTab() {
    console.log('[PHOTO] Initializing photo tab...');
    
    var urlInput = document.getElementById('photoUrlInput');
    if (urlInput && !urlInput.value) {
        urlInput.value = DEFAULT_IMAGE_URL;
    }
    
    var folderInput = document.getElementById('photoStorageFolder');
    if (folderInput && !folderInput.value) {
        folderInput.value = 'celebrations/';
    }
    
    var fieldInput = document.getElementById('photoFirestoreField');
    if (fieldInput && !fieldInput.value) {
        fieldInput.value = 'celebration';
    }
    
    var prodBtn = document.getElementById('photoProdBtn');
    var devBtn = document.getElementById('photoDevBtn');
    
    if (prodBtn) {
        prodBtn.onclick = function() { setPhotoEnvironment('PROD'); };
    }
    if (devBtn) {
        devBtn.onclick = function() { setPhotoEnvironment('DEV'); };
    }
    
    var loadBtn = document.getElementById('photoLoadBtn');
    if (loadBtn) {
        loadBtn.onclick = loadPhotoFromUrl;
    }
    
    var uploadBtn = document.getElementById('photoUploadBtn');
    if (uploadBtn) {
        uploadBtn.style.display = 'none';
        uploadBtn.onclick = uploadPhotoToStorage;
    }
    
    var resetBtn = document.getElementById('photoResetBtn');
    if (resetBtn) {
        resetBtn.onclick = resetPhotoTool;
    }
    
    var infoBtn = document.getElementById('showPhotoInfoBtn');
    if (infoBtn) {
        infoBtn.style.display = 'none';
        infoBtn.onclick = showPhotoInfo;
    }
    
    var copyBtn = document.getElementById('copyUrlBtn');
    if (copyBtn) {
        copyBtn.style.display = 'none';
        copyBtn.onclick = copyPhotoUrl;
    }
    
    var saveRefBtn = document.getElementById('saveFirestoreRefBtn');
    if (saveRefBtn) {
        saveRefBtn.onclick = savePhotoToFirestore;
    }
    
    if (urlInput) {
        urlInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                loadPhotoFromUrl();
            }
        };
    }
    
    console.log('[PHOTO] Photo tab initialized');
    photoLog('✅ Photo tab ready. Select PROD/DEV and load an image.', 'success');
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.setPhotoEnvironment = setPhotoEnvironment;
window.loadPhotoFromUrl = loadPhotoFromUrl;
window.uploadPhotoToStorage = uploadPhotoToStorage;
window.resetPhotoTool = resetPhotoTool;
window.copyPhotoUrl = copyPhotoUrl;
window.showPhotoInfo = showPhotoInfo;
window.closePhotoInfoPanel = closePhotoInfoPanel;
window.savePhotoToFirestore = savePhotoToFirestore;
window.initPhotoTab = initPhotoTab;
window.listPhotosInStorage = listPhotosInStorage;
window.deletePhotosFromStorage = deletePhotosFromStorage;

// ============================================================
// AUTO-INIT ON LOAD
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initPhotoTab, 500);
    });
} else {
    setTimeout(initPhotoTab, 500);
}

console.log('[PHOTO-UTIL] v1.06 loaded (no delete functions)');

/*
FILE: js/util-photo.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - REMOVED: All delete-related functions (moved to DELETE tab)
   - REMOVED: deletePhotoFromStorage, deletePhotosFromStorage, deletePhotoWithReferences
   - REMOVED: deletePhotoStorageOnly, deletePhotoComplete, findPhotoReferences
   - REMOVED: removeSingleReference, deleteCurrentPhoto
   - PRESERVED: Load, upload, view, copy, save to Firestore functions
   - PRESERVED: listPhotosInStorage (used by DELETE tab)
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/