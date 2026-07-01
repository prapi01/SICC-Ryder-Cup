/*
FILE: js/util-photo.js
VERSION: 1.15
KEY CHANGES from v1.14:
   - ADDED: Automatic cache-busting to image URLs
   - CHANGED: loadPhotoFromUrl() now appends timestamp to URL to bypass browser cache
   - This ensures the latest image is loaded from GitHub/Cloudflare Pages
   - PRESERVED: All existing functionality from v1.14
DEPENDS ON: Firebase Storage, Firestore, util-core.js
STATUS: Ready for integration
*/

// Version exposure
window.PHOTO_UTIL_VERSION = "1.15";

console.log('[PHOTO] Loading util-photo.js v1.15 - Cache busting added');

// ============================================================
// FALLBACK HELPERS (if util-core.js not loaded)
// ============================================================

function photoEscapeHtml(str) {
    if (typeof window.escapeHtml === 'function') {
        return window.escapeHtml(str);
    }
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================================
// STATE
// ============================================================

var photoStorage = null;
var photoStorageEnv = null;
var currentPhotoData = null;
var currentPhotoUrl = null;
var currentDownloadUrl = null;
var currentFullPath = null;
var photoListItems = [];

// Default image URL (Cloudflare)
var DEFAULT_IMAGE_URL = 'https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg';

// ============================================================
// LOGGING
// ============================================================

function photoLog(message, type) {
    console.log('[PHOTO]', message);
    if (typeof window.log === 'function') {
        try { window.log(message, type); } catch(e) { /* ignore */ }
    }
}

// ============================================================
// v1.15: CACHE-BUSTING HELPER
// ============================================================

function addCacheBuster(url) {
    if (!url) return url;
    // If URL already has a query parameter, append &t=timestamp
    // Otherwise, append ?t=timestamp
    var separator = url.indexOf('?') !== -1 ? '&' : '?';
    return url + separator + 't=' + Date.now();
}

// ============================================================
// ENVIRONMENT FUNCTIONS
// ============================================================

function setPhotoEnvironment(env) {
    console.log('[PHOTO] 🔧 setPhotoEnvironment called with:', env);
    photoLog('Setting environment to: ' + env, 'info');
    
    try {
        if (typeof firebase === 'undefined') {
            console.error('[PHOTO] ❌ Firebase not available');
            photoLog('❌ Firebase not available', 'error');
            return false;
        }
        
        var apps = firebase.apps || [];
        console.log('[PHOTO] Available Firebase apps:', apps.map(function(app) { return app.name; }));
        
        if (env === 'PROD') {
            var prodApp = apps.find(function(app) { return app.name === "prod"; });
            if (prodApp) {
                photoStorage = firebase.storage(prodApp);
                photoStorageEnv = 'PROD';
                updatePhotoUI('PROD');
                photoLog('✅ PRODUCTION storage initialized', 'success');
                console.log('[PHOTO] ✅ PROD storage ready');
                return true;
            } else {
                photoStorage = firebase.storage();
                photoStorageEnv = 'PROD';
                updatePhotoUI('PROD');
                photoLog('✅ PRODUCTION storage initialized (default app)', 'success');
                console.log('[PHOTO] ✅ PROD storage ready (default)');
                return true;
            }
        } else if (env === 'DEV') {
            var devApp = apps.find(function(app) { return app.name === "dev"; });
            if (devApp) {
                photoStorage = firebase.storage(devApp);
                photoStorageEnv = 'DEV';
                updatePhotoUI('DEV');
                photoLog('✅ DEVELOPMENT storage initialized', 'success');
                console.log('[PHOTO] ✅ DEV storage ready');
                return true;
            } else {
                photoStorage = firebase.storage();
                photoStorageEnv = 'DEV';
                updatePhotoUI('DEV');
                photoLog('✅ DEVELOPMENT storage initialized (default app)', 'success');
                console.log('[PHOTO] ✅ DEV storage ready (default)');
                return true;
            }
        } else {
            photoLog('❌ Unknown environment: ' + env, 'error');
            return false;
        }
    } catch (e) {
        console.error('[PHOTO] ❌ Error initializing storage:', e);
        photoLog('❌ Failed to initialize storage: ' + e.message, 'error');
        return false;
    }
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
        console.log('[PHOTO] ✅ UI updated: PROD');
    } else if (env === 'DEV') {
        if (devBtn) devBtn.classList.add('active-dev');
        if (indicator) {
            indicator.className = 'env-indicator-small dev';
            indicator.textContent = '🟡 DEVELOPMENT';
        }
        console.log('[PHOTO] ✅ UI updated: DEV');
    } else {
        if (indicator) {
            indicator.className = 'env-indicator-small none';
            indicator.textContent = 'Not connected';
        }
        console.log('[PHOTO] UI updated: none');
    }
}

// ============================================================
// DISPLAY PHOTO IN VIEWER
// ============================================================

function displayPhotoInViewer(img) {
    var viewer = document.getElementById('photoViewer');
    if (!viewer) {
        console.error('[PHOTO] ❌ Viewer element not found');
        return;
    }
    
    console.log('[PHOTO] Displaying image in viewer');
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
    console.log('[PHOTO] ✅ Image displayed');
}

// ============================================================
// v1.15: LOAD PHOTO FROM URL - with cache busting
// ============================================================

function loadPhotoFromUrl() {
    console.log('[PHOTO] 📥 loadPhotoFromUrl called');
    
    var urlInput = document.getElementById('photoUrlInput');
    var url = urlInput ? urlInput.value.trim() : DEFAULT_IMAGE_URL;
    
    if (!url) {
        photoLog('Please enter a URL', 'error');
        return;
    }
    
    // v1.15: Add cache-busting timestamp to force fresh load
    var cacheBustedUrl = addCacheBuster(url);
    console.log('[PHOTO] Original URL:', url);
    console.log('[PHOTO] Cache-busted URL:', cacheBustedUrl);
    
    photoLog('Loading image from: ' + cacheBustedUrl, 'info');
    
    var viewer = document.getElementById('photoViewer');
    if (viewer) {
        viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:1rem;">⏳ Loading...</div>';
    }
    
    var statusDiv = document.getElementById('photoStatus');
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="log-info">⏳ Loading from: ' + cacheBustedUrl + '</span>';
    }
    
    var img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        console.log('[PHOTO] ✅ Image loaded:', img.width, 'x', img.height);
        currentPhotoData = img;
        currentPhotoUrl = cacheBustedUrl;
        displayPhotoInViewer(img);
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="log-success">✅ Loaded: ' + cacheBustedUrl + ' (' + img.width + 'x' + img.height + ')</span>';
        }
        photoLog('✅ Image loaded: ' + img.width + 'x' + img.height, 'success');
        
        var filenameInput = document.getElementById('photoFilename');
        if (filenameInput && !filenameInput.value) {
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            filenameInput.value = 'GM_photo_' + timestamp + '.jpg';
        }
        
        var uploadBtn = document.getElementById('photoUploadBtn');
        if (uploadBtn) uploadBtn.style.display = 'block';
    };
    
    img.onerror = function() {
        console.error('[PHOTO] ❌ Failed to load image from:', cacheBustedUrl);
        if (viewer) {
            viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff6b6b;font-size:1rem;">❌ Failed to load image<br><span style="font-size:0.7rem;color:#888;">Check URL and CORS settings</span></div>';
        }
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="log-error">❌ Failed to load: ' + cacheBustedUrl + '</span>';
        }
        photoLog('❌ Failed to load image: ' + cacheBustedUrl, 'error');
        currentPhotoData = null;
        currentPhotoUrl = null;
    };
    
    img.src = cacheBustedUrl;
}

// ============================================================
// v1.14: UPLOAD TO STORAGE - NO RESIZING, FULL QUALITY
// ============================================================

function uploadPhotoToStorage() {
    console.log('[PHOTO] 📤 uploadPhotoToStorage called');
    
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
    
    // Use the folder as-is, default to 'celebration/'
    var folderInput = document.getElementById('photoStorageFolder');
    var folder = folderInput ? folderInput.value.trim() : 'celebration/';
    if (folder && !folder.endsWith('/')) {
        folder = folder + '/';
    }
    
    // Use filename as-is, no prefix added
    var fullPath = folder + filename;
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
    console.log('[PHOTO] Uploading to:', fullPath);
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    
    // Use the original image dimensions - NO RESIZING
    var width = currentPhotoData.width;
    var height = currentPhotoData.height;
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(currentPhotoData, 0, 0, width, height);
    
    // v1.14: Use FULL quality (1.0) - NO COMPRESSION
    canvas.toBlob(function(blob) {
        if (!blob) {
            photoLog('❌ Failed to convert image', 'error');
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="log-error">❌ Failed to convert image</span>';
            }
            return;
        }
        
        console.log('[PHOTO] Image blob size:', (blob.size / 1024).toFixed(1), 'KB');
        photoLog('Image size: ' + (blob.size / 1024).toFixed(1) + ' KB', 'info');
        
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
                    console.log('[PHOTO] ✅ Upload successful, URL:', downloadURL);
                    
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
    }, 'image/jpeg', 1.0);  // v1.14: FULL QUALITY (no compression)
}

// ============================================================
// RESET
// ============================================================

function resetPhotoTool() {
    console.log('[PHOTO] 🔄 resetPhotoTool called');
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
    console.log('[PHOTO] 📋 copyPhotoUrl called');
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
// FIND PHOTO REFERENCES
// ============================================================

function findPhotoReferences(photoUrl, callback) {
    if (!photoUrl) {
        var err = new Error("Photo URL is required");
        if (callback) callback(err);
        return;
    }
    
    var db = photoStorageEnv === 'PROD' ? window.prodDb : window.devDb;
    if (!db) {
        var err = new Error("Database not available for " + photoStorageEnv);
        if (callback) callback(err);
        return;
    }
    
    photoLog('🔍 Searching for references to photo...', 'info');
    
    var results = [];
    var collections = ['scheduledGames', 'historyGames', 'backupFolder'];
    var promises = collections.map(function(collection) {
        return db.collection(collection)
            .where('celebration.imageUrl', '==', photoUrl)
            .get()
            .then(function(snapshot) {
                snapshot.forEach(function(doc) {
                    results.push({
                        collection: collection,
                        docId: doc.id,
                        fields: ['celebration.imageUrl']
                    });
                });
            })
            .catch(function(err) {
                console.warn('Error searching ' + collection + ':', err.message);
                return Promise.resolve();
            });
    });
    
    Promise.all(promises)
        .then(function() {
            photoLog('🔍 Found ' + results.length + ' references', 'info');
            if (callback) callback(null, results);
        })
        .catch(function(err) {
            if (callback) callback(err);
        });
}

// ============================================================
// SHOW INFO
// ============================================================

function showPhotoInfo() {
    console.log('[PHOTO] 📋 showPhotoInfo called');
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
            
            <div style="background:#0a0a0a; border-radius:8px; padding:12px; margin-bottom:12px; border:1px solid #2a2a2a;">
                <div style="display:grid; grid-template-columns:auto 1fr; gap:2px 16px; font-size:0.75rem;">
                    <span style="color:#888;">📍 Path:</span>
                    <span style="color:#e0e0e0; font-family:monospace; word-break:break-all;">${currentFullPath || 'Unknown'}</span>
                    <span style="color:#888;">🔗 URL:</span>
                    <span style="color:#ffaa44; font-family:monospace; font-size:0.65rem; word-break:break-all;">${currentDownloadUrl}</span>
                </div>
            </div>
            
            <div id="photoReferencesContainer" style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">
                <div style="font-size:0.75rem; font-weight:600; color:#4a8af4; margin-bottom:8px;">📚 FIRESTORE REFERENCES</div>
                <div id="photoReferencesList" style="text-align:center; color:#555; padding:8px;">
                    <span class="log-info">🔍 Searching for references...</span>
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
            
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid #2a2a2a; text-align:center;">
                <span style="font-size:0.65rem; color:#666;">
                    💡 To delete this photo, go to the <strong style="color:#ff6b6b;">DELETE</strong> tab
                </span>
            </div>
        </div>
    `;
    
    findPhotoReferences(currentDownloadUrl, function(err, references) {
        var container = document.getElementById('photoReferencesList');
        if (!container) return;
        
        if (err) {
            container.innerHTML = `<span class="log-error">❌ Error: ${err.message}</span>`;
            return;
        }
        
        if (!references || references.length === 0) {
            container.innerHTML = '<span style="color:#555;">📭 No Firestore references found</span>';
            return;
        }
        
        var html = '<div style="overflow-x:auto;">';
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
        html += '<thead><tr>';
        html += '<th style="text-align:left; color:#888; padding:4px 8px; border-bottom:1px solid #2a2a2a;">Collection</th>';
        html += '<th style="text-align:left; color:#888; padding:4px 8px; border-bottom:1px solid #2a2a2a;">Document ID</th>';
        html += '<th style="text-align:left; color:#888; padding:4px 8px; border-bottom:1px solid #2a2a2a;">Field</th>';
        html += '</tr></thead><tbody>';
        
        references.forEach(function(ref) {
            var badgeClass = ref.collection === 'historyGames' ? 'badge-history' :
                             ref.collection === 'scheduledGames' ? 'badge-sched' : 'badge-backup';
            var fieldNames = ref.fields ? ref.fields.join(', ') : 'celebration.imageUrl';
            html += '<tr>';
            html += `<td style="padding:4px 8px; border-bottom:1px solid #1a1a1a;"><span class="badge ${badgeClass}">${photoEscapeHtml(ref.collection)}</span></td>`;
            html += `<td style="padding:4px 8px; border-bottom:1px solid #1a1a1a; font-family:monospace; color:#e0e0e0;">${photoEscapeHtml(ref.docId)}</td>`;
            html += `<td style="padding:4px 8px; border-bottom:1px solid #1a1a1a; font-family:monospace; color:#ffaa44;">${photoEscapeHtml(fieldNames)}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        html += `<div style="margin-top:8px; font-size:0.65rem; color:#888;">📚 ${references.length} reference${references.length > 1 ? 's' : ''} found</div>`;
        container.innerHTML = html;
    });
}

function closePhotoInfoPanel() {
    console.log('[PHOTO] ✕ closePhotoInfoPanel called');
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
    console.log('[PHOTO] 💾 savePhotoToFirestore called');
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
    
    var db = photoStorageEnv === 'PROD' ? window.prodDb : window.devDb;
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
// GET PHOTO DOWNLOAD URL
// ============================================================

function getPhotoDownloadUrl(path, callback) {
    if (!photoStorage) {
        var err = new Error("Select an environment first (PROD/DEV)");
        if (callback) callback(err);
        return;
    }
    
    if (!path) {
        var err = new Error("Photo path is required");
        if (callback) callback(err);
        return;
    }
    
    photoLog('🔗 Getting download URL for: ' + path, 'info');
    
    photoStorage.ref(path).getDownloadURL()
        .then(function(url) {
            photoLog('✅ Download URL obtained', 'success');
            if (callback) callback(null, url);
        })
        .catch(function(err) {
            photoLog('❌ Failed to get download URL: ' + err.message, 'error');
            if (callback) callback(err);
        });
}

// ============================================================
// LIST PHOTOS (USED BY DELETE TAB)
// ============================================================

function listPhotosInStorage(folder, callback) {
    console.log('[PHOTO] 📂 listPhotosInStorage called');
    if (!photoStorage) {
        var err = new Error("Select an environment first (PROD/DEV)");
        if (callback) callback(err);
        return;
    }
    
    if (!folder) folder = 'celebration/';
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
// DELETE PHOTOS FROM STORAGE
// ============================================================

function deletePhotosFromStorage(paths, callback) {
    if (!photoStorage) {
        var err = new Error("Select an environment first (PROD/DEV)");
        if (callback) callback(err);
        return;
    }
    
    if (!paths || paths.length === 0) {
        var err = new Error("No photo paths provided");
        if (callback) callback(err);
        return;
    }
    
    photoLog('🗑️ Deleting ' + paths.length + ' photos from storage...', 'info');
    
    var results = {
        deleted: 0,
        notFound: 0,
        failed: 0,
        errors: []
    };
    
    var promises = paths.map(function(path) {
        return photoStorage.ref(path).delete()
            .then(function() {
                results.deleted++;
                photoLog('✅ Deleted: ' + path, 'success');
            })
            .catch(function(err) {
                if (err.code === 'storage/object-not-found') {
                    results.notFound++;
                    photoLog('⚠️ Not found: ' + path, 'warning');
                } else {
                    results.failed++;
                    results.errors.push({ path: path, error: err.message });
                    photoLog('❌ Failed to delete: ' + path + ' - ' + err.message, 'error');
                }
            });
    });
    
    Promise.all(promises)
        .then(function() {
            photoLog('Delete complete: ' + results.deleted + ' deleted, ' + results.notFound + ' not found, ' + results.failed + ' failed', results.failed === 0 ? 'success' : 'warning');
            if (callback) callback(null, results);
        })
        .catch(function(err) {
            photoLog('❌ Delete operation failed: ' + err.message, 'error');
            if (callback) callback(err);
        });
}

// ============================================================
// DELETE TAB: PHOTO LIST FUNCTIONS
// ============================================================

function refreshPhotoList() {
    console.log('[PHOTO] 🔄 refreshPhotoList called');
    
    var folderInput = document.getElementById('photoListFolder');
    var folder = folderInput ? folderInput.value.trim() : 'celebration/';
    var container = document.getElementById('photoListContainer');
    var countEl = document.getElementById('photoSelectedCount');
    
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Loading photos...</div>';
    if (countEl) countEl.textContent = '0 selected';
    
    photoLog('📂 Loading photo list from: ' + folder, 'info');
    
    listPhotosInStorage(folder, function(err, photos) {
        if (err) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#ff6b6b;">❌ Error: ' + err.message + '</div>';
            photoLog('❌ Failed to load photos: ' + err.message, 'error');
            return;
        }
        
        photoListItems = photos || [];
        renderPhotoList(photoListItems);
        updatePhotoDeleteButtonState();
        
        if (photoListItems.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">📭 No photos found in ' + folder + '</div>';
        }
        
        photoLog('📸 Loaded ' + photoListItems.length + ' photos', 'success');
    });
}

function renderPhotoList(photos) {
    var container = document.getElementById('photoListContainer');
    if (!container) return;
    
    if (!photos || photos.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">No photos to display</div>';
        return;
    }
    
    var html = '<table>';
    html += '<thead><tr>';
    html += '<th style="width:32px; text-align:center;"><input type="checkbox" id="photoSelectAll" onchange="toggleAllPhotoCheckboxes()" style="width:16px;height:16px;accent-color:#ffaa44;cursor:pointer;"></th>';
    html += '<th style="text-align:left;">Name</th>';
    html += '<th style="text-align:left;">Size</th>';
    html += '<th style="text-align:left;">Updated</th>';
    html += '</tr></thead><tbody>';
    
    for (var i = 0; i < photos.length; i++) {
        var p = photos[i];
        var size = p.size > 1024 * 1024 ? (p.size / (1024 * 1024)).toFixed(1) + ' MB' : 
                   p.size > 1024 ? (p.size / 1024).toFixed(0) + ' KB' : 
                   p.size + ' B';
        var date = p.updated ? new Date(p.updated).toLocaleDateString() : 'Unknown';
        
        html += '<tr onclick="togglePhotoCheckbox(\'' + photoEscapeHtml(p.fullPath) + '\')">';
        html += '<td style="text-align:center; vertical-align:middle;">';
        html += '<input type="checkbox" class="photo-checkbox" data-path="' + photoEscapeHtml(p.fullPath) + '" onchange="onPhotoCheckboxChange()" style="width:16px;height:16px;accent-color:#ffaa44;cursor:pointer;">';
        html += '</td>';
        html += '<td style="color:#e0e0e0; word-break:break-all;">' + photoEscapeHtml(p.name) + '</td>';
        html += '<td style="color:#ccc;">' + size + '</td>';
        html += '<td style="color:#888; font-size:0.7rem;">' + date + '</td>';
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    // Re-bind Select All after render
    var selectAll = document.getElementById('photoSelectAll');
    if (selectAll) {
        selectAll.onchange = function() {
            toggleAllPhotoCheckboxes();
        };
    }
    
    updatePhotoSelectedCount();
    updatePhotoDeleteButtonState();
}

// ============================================================
// DELETE TAB: PHOTO CHECKBOX HELPERS
// ============================================================

function toggleAllPhotoCheckboxes() {
    var selectAll = document.getElementById('photoSelectAll');
    if (!selectAll) return;
    
    var checkboxes = document.querySelectorAll('.photo-checkbox');
    var isChecked = selectAll.checked;
    
    for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = isChecked;
    }
    
    updatePhotoSelectedCount();
    updatePhotoDeleteButtonState();
}

function togglePhotoCheckbox(path) {
    var checkbox = document.querySelector('.photo-checkbox[data-path="' + path + '"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        onPhotoCheckboxChange();
    }
}

function onPhotoCheckboxChange() {
    updatePhotoSelectedCount();
    updatePhotoDeleteButtonState();
    updatePhotoSelectAllState();
}

function updatePhotoSelectedCount() {
    var checkboxes = document.querySelectorAll('.photo-checkbox:checked');
    var countEl = document.getElementById('photoSelectedCount');
    if (countEl) {
        countEl.textContent = checkboxes.length + ' selected';
    }
}

function updatePhotoDeleteButtonState() {
    var checkboxes = document.querySelectorAll('.photo-checkbox:checked');
    var deleteBtn = document.getElementById('photoDeleteSelectedBtn');
    var count = checkboxes.length;
    
    if (!deleteBtn) return;
    
    if (count > 0) {
        deleteBtn.disabled = false;
        deleteBtn.style.opacity = '1';
        deleteBtn.textContent = '🗑️ DELETE SELECTED PHOTOS (' + count + ')';
    } else {
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = '0.5';
        deleteBtn.textContent = '🗑️ DELETE SELECTED PHOTOS (0)';
    }
}

function updatePhotoSelectAllState() {
    var selectAll = document.getElementById('photoSelectAll');
    if (!selectAll) return;
    
    var checkboxes = document.querySelectorAll('.photo-checkbox');
    var checkedCount = document.querySelectorAll('.photo-checkbox:checked').length;
    
    if (checkboxes.length === 0) {
        selectAll.checked = false;
        selectAll.disabled = true;
        return;
    }
    
    selectAll.disabled = false;
    if (checkedCount === checkboxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else if (checkedCount === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

function deleteSelectedPhotos() {
    var checkboxes = document.querySelectorAll('.photo-checkbox:checked');
    if (checkboxes.length === 0) {
        photoLog("No photos selected for deletion", 'error');
        return;
    }
    
    var selectedPaths = [];
    for (var i = 0; i < checkboxes.length; i++) {
        selectedPaths.push(checkboxes[i].getAttribute('data-path'));
    }
    
    var confirmMsg = '🗑️ DELETE ' + selectedPaths.length + ' photo(s) from Storage?\n\n';
    confirmMsg += 'This action CANNOT be undone.\n\n';
    confirmMsg += 'Selected photos:\n' + selectedPaths.join('\n');
    
    if (!confirm(confirmMsg)) {
        photoLog('Delete cancelled by user', 'info');
        return;
    }
    
    var progressEl = document.getElementById('photoDeleteProgress');
    var deleteBtn = document.getElementById('photoDeleteSelectedBtn');
    
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '⏳ Deleting...';
    }
    if (progressEl) {
        progressEl.className = 'delete-progress active';
        progressEl.innerHTML = '';
    }
    
    deletePhotosFromStorage(selectedPaths, function(err, results) {
        if (err) {
            if (progressEl) {
                progressEl.innerHTML += '<div class="step error">❌ Error: ' + err.message + '</div>';
            }
            photoLog('❌ Delete failed: ' + err.message, 'error');
            if (deleteBtn) {
                deleteBtn.textContent = '❌ Failed';
                deleteBtn.disabled = false;
            }
            return;
        }
        
        if (progressEl) {
            progressEl.innerHTML += '<div class="step done">✅ Deleted: ' + results.deleted + ' photos</div>';
            if (results.notFound > 0) {
                progressEl.innerHTML += '<div class="step warning">⚠️ Not found: ' + results.notFound + ' photos</div>';
            }
            if (results.failed > 0) {
                progressEl.innerHTML += '<div class="step error">❌ Failed: ' + results.failed + ' photos</div>';
            }
        }
        
        photoLog('Delete complete: ' + results.deleted + ' deleted, ' + results.notFound + ' not found, ' + results.failed + ' failed', results.failed === 0 ? 'success' : 'warning');
        
        if (deleteBtn) {
            deleteBtn.textContent = '✅ Done';
            deleteBtn.disabled = false;
        }
        
        // Refresh the list
        refreshPhotoList();
    });
}

// ============================================================
// PHOTO TAB INFORMATION GUIDE
// ============================================================

function showPhotoInfoGuide() {
    console.log('[PHOTO] ℹ️ showPhotoInfoGuide called');
    
    var existing = document.querySelector('.info-overlay');
    if (existing) {
        existing.remove();
    }
    
    var overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <div class="info-title">🖼️ PHOTO TAB - Information & Guide</div>
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✕ CLOSE</button>
            </div>
            
            <div class="info-section">
                <div class="info-section-title">🎯 What This Tab Does</div>
                <div class="info-text">
                    The <strong>PHOTO</strong> tab allows you to load images and upload them to Firebase Storage.
                    This is useful for:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>📸 Uploading celebration photos to Firebase Storage</li>
                        <li>🔗 Getting a permanent download URL for use in Firestore</li>
                        <li>💾 Saving photo references to game records</li>
                        <li>🔄 Moving images between PROD and DEV environments</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📖 How To Use</div>
                <ol class="info-steps">
                    <li><strong>Step 1 - Environment:</strong> Select <span class="highlight">PROD</span> or <span class="highlight">DEV</span> for Firebase Storage</li>
                    <li><strong>Step 2 - Load Image:</strong> Enter a URL and click <span class="highlight">"Load Image"</span></li>
                    <li><strong>Step 3 - View:</strong> The image will appear in the viewer for preview</li>
                    <li><strong>Step 4 - Filename:</strong> Enter a custom filename (auto-generated with timestamp)</li>
                    <li><strong>Step 5 - Upload:</strong> Click <span class="highlight">"Upload to Firebase Storage"</span></li>
                    <li><strong>Step 6 - Copy URL:</strong> Use <span class="highlight">"Copy URL"</span> to copy the download URL</li>
                    <li><strong>Step 7 - Save Reference:</strong> Save the URL to a Firestore document field</li>
                    <li><strong>Step 8 - Show Info:</strong> View photo details and Firestore references</li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📊 Information Panel</div>
                <div class="info-text">
                    The <strong>"Show Info"</strong> button displays:
                    <ul style="padding-left:20px; margin:4px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>🖼️ <strong>Photo Preview</strong> - The uploaded image</li>
                        <li>📍 <strong>Storage Path</strong> - Where the file is stored</li>
                        <li>🔗 <strong>Download URL</strong> - The permanent URL</li>
                        <li>📚 <strong>Firestore References</strong> - Which game records reference this photo</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>CORS:</strong> The image URL must allow cross-origin access</li>
                    <li><strong>Original Quality:</strong> Images are uploaded at full quality, no resizing or compression</li>
                    <li><strong>File Format:</strong> Images are uploaded as JPEG</li>
                    <li><strong>Environment:</strong> PROD and DEV have separate Storage buckets</li>
                    <li><strong>Cache Busting:</strong> A timestamp is automatically added to URLs to bypass browser cache</li>
                </ul>
            </div>
            
            <div style="text-align:center; margin-top:20px;">
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✓ OK, I understand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ============================================================
// ATTACH PHOTO HANDLERS
// ============================================================

function attachPhotoHandlers() {
    console.log('[PHOTO] 🔗 Attaching photo handlers...');
    
    var loadBtn = document.getElementById('photoLoadBtn');
    var prodBtn = document.getElementById('photoProdBtn');
    var devBtn = document.getElementById('photoDevBtn');
    var uploadBtn = document.getElementById('photoUploadBtn');
    var resetBtn = document.getElementById('photoResetBtn');
    var infoBtn = document.getElementById('showPhotoInfoBtn');
    var copyBtn = document.getElementById('copyUrlBtn');
    var saveRefBtn = document.getElementById('saveFirestoreRefBtn');
    var urlInput = document.getElementById('photoUrlInput');
    var listRefreshBtn = document.getElementById('photoListRefreshBtn');
    var photoDeleteBtn = document.getElementById('photoDeleteSelectedBtn');
    
    if (loadBtn) {
        loadBtn.onclick = function() { loadPhotoFromUrl(); };
        console.log('[PHOTO] ✅ Load button attached');
    }
    
    if (prodBtn) {
        prodBtn.onclick = function() { setPhotoEnvironment('PROD'); };
        console.log('[PHOTO] ✅ PROD button attached');
    }
    
    if (devBtn) {
        devBtn.onclick = function() { setPhotoEnvironment('DEV'); };
        console.log('[PHOTO] ✅ DEV button attached');
    }
    
    if (uploadBtn) {
        uploadBtn.onclick = function() { uploadPhotoToStorage(); };
        console.log('[PHOTO] ✅ Upload button attached');
    }
    
    if (resetBtn) {
        resetBtn.onclick = function() { resetPhotoTool(); };
        console.log('[PHOTO] ✅ Reset button attached');
    }
    
    if (infoBtn) {
        infoBtn.onclick = function() { showPhotoInfo(); };
        console.log('[PHOTO] ✅ Show Info button attached');
    }
    
    if (copyBtn) {
        copyBtn.onclick = function() { copyPhotoUrl(); };
        console.log('[PHOTO] ✅ Copy URL button attached');
    }
    
    if (saveRefBtn) {
        saveRefBtn.onclick = function() { savePhotoToFirestore(); };
        console.log('[PHOTO] ✅ Save Reference button attached');
    }
    
    if (urlInput) {
        urlInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                loadPhotoFromUrl();
            }
        };
        console.log('[PHOTO] ✅ URL input keydown attached');
    }
    
    // DELETE tab photo list refresh button
    if (listRefreshBtn) {
        listRefreshBtn.onclick = function() {
            console.log('[PHOTO] 🔄 List Photos button clicked');
            refreshPhotoList();
        };
        console.log('[PHOTO] ✅ List Photos button attached');
    }
    
    // DELETE tab photo delete button
    if (photoDeleteBtn) {
        photoDeleteBtn.onclick = function() {
            console.log('[PHOTO] 🗑️ Delete Photos button clicked');
            deleteSelectedPhotos();
        };
        console.log('[PHOTO] ✅ Delete Photos button attached');
    }
    
    console.log('[PHOTO] ✅ All handlers attached');
}

// ============================================================
// INITIALIZE PHOTO TAB
// ============================================================

function initPhotoTab() {
    console.log('[PHOTO] 🚀 initPhotoTab called');
    
    var urlInput = document.getElementById('photoUrlInput');
    if (urlInput && !urlInput.value) {
        urlInput.value = DEFAULT_IMAGE_URL;
        console.log('[PHOTO] ✅ Default URL set');
    }
    
    // v1.13: Default folder is 'celebration/'
    var folderInput = document.getElementById('photoStorageFolder');
    if (folderInput && !folderInput.value) {
        folderInput.value = 'celebration/';
        console.log('[PHOTO] ✅ Default folder set to celebration/');
    }
    
    var fieldInput = document.getElementById('photoFirestoreField');
    if (fieldInput && !fieldInput.value) {
        fieldInput.value = 'celebration';
        console.log('[PHOTO] ✅ Default field set');
    }
    
    // v1.13: Photo list folder default is 'celebration/'
    var listFolderInput = document.getElementById('photoListFolder');
    if (listFolderInput && !listFolderInput.value) {
        listFolderInput.value = 'celebration/';
        console.log('[PHOTO] ✅ Default list folder set to celebration/');
    }
    
    attachPhotoHandlers();
    setPhotoEnvironment('PROD');
    
    console.log('[PHOTO] ✅ initPhotoTab complete');
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
window.attachPhotoHandlers = attachPhotoHandlers;
window.listPhotosInStorage = listPhotosInStorage;
window.deletePhotosFromStorage = deletePhotosFromStorage;
window.findPhotoReferences = findPhotoReferences;
window.showPhotoInfoGuide = showPhotoInfoGuide;
window.getPhotoDownloadUrl = getPhotoDownloadUrl;

// DELETE tab photo list functions
window.refreshPhotoList = refreshPhotoList;
window.renderPhotoList = renderPhotoList;
window.toggleAllPhotoCheckboxes = toggleAllPhotoCheckboxes;
window.togglePhotoCheckbox = togglePhotoCheckbox;
window.onPhotoCheckboxChange = onPhotoCheckboxChange;
window.updatePhotoSelectedCount = updatePhotoSelectedCount;
window.updatePhotoDeleteButtonState = updatePhotoDeleteButtonState;
window.updatePhotoSelectAllState = updatePhotoSelectAllState;
window.deleteSelectedPhotos = deleteSelectedPhotos;

console.log('[PHOTO] ✅ All functions exposed globally');

// ============================================================
// AUTO-INIT
// ============================================================

function autoInit() {
    console.log('[PHOTO] 🔄 autoInit checking...');
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log('[PHOTO] ✅ DOM ready, calling initPhotoTab...');
        initPhotoTab();
    } else {
        console.log('[PHOTO] ⏳ Waiting for DOM...');
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[PHOTO] ✅ DOMContentLoaded, calling initPhotoTab...');
            initPhotoTab();
        });
    }
}

autoInit();

console.log('[PHOTO-UTIL] v1.15 loaded (cache busting added)');

/*
FILE: js/util-photo.js
VERSION: 1.15
KEY CHANGES from v1.14:
   - ADDED: Automatic cache-busting to image URLs
   - CHANGED: loadPhotoFromUrl() now appends timestamp to URL to bypass browser cache
   - This ensures the latest image is loaded from GitHub/Cloudflare Pages
   - PRESERVED: All existing functionality from v1.14
DEPENDS ON: Firebase Storage, Firestore, util-core.js
STATUS: Ready for integration
*/