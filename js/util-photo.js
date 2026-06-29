/*
FILE: js/util-photo.js
VERSION: 1.10
KEY CHANGES from v1.09:
   - FIXED: All functions now properly exposed to window object
   - FIXED: DEV button now properly works with fallback
   - FIXED: Load image button now properly works
   - ADDED: Debug logging for all button clicks
   - ADDED: Manual initialization fallback
   - REMOVED: Dependencies on main HTML log function (uses console fallback)
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/

// Version exposure
window.PHOTO_UTIL_VERSION = "1.10";

console.log('[PHOTO] Loading util-photo.js v1.10...');

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
// LOGGING
// ============================================================

function photoLog(message, type) {
    console.log('[PHOTO]', message);
    if (typeof window.log === 'function') {
        try { window.log(message, type); } catch(e) { /* ignore */ }
    }
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
// LOAD PHOTO FROM URL
// ============================================================

function loadPhotoFromUrl() {
    console.log('[PHOTO] 📥 loadPhotoFromUrl called');
    
    var urlInput = document.getElementById('photoUrlInput');
    var url = urlInput ? urlInput.value.trim() : DEFAULT_IMAGE_URL;
    
    if (!url) {
        photoLog('Please enter a URL', 'error');
        return;
    }
    
    console.log('[PHOTO] Loading from:', url);
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
        console.log('[PHOTO] ✅ Image loaded:', img.width, 'x', img.height);
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
        console.error('[PHOTO] ❌ Failed to load image from:', url);
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
    console.log('[PHOTO] Uploading to:', fullPath);
    
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
    }, 'image/jpeg', 0.85);
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
    
    var db = photoStorageEnv === 'PROD' ? prodDb : devDb;
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
            .where('celebration', '==', photoUrl)
            .get()
            .then(function(snapshot) {
                snapshot.forEach(function(doc) {
                    results.push({
                        collection: collection,
                        docId: doc.id,
                        fields: ['celebration']
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
            var fieldNames = ref.fields ? ref.fields.join(', ') : 'celebration';
            html += '<tr>';
            html += `<td style="padding:4px 8px; border-bottom:1px solid #1a1a1a;"><span class="badge ${badgeClass}">${escapeHtml(ref.collection)}</span></td>`;
            html += `<td style="padding:4px 8px; border-bottom:1px solid #1a1a1a; font-family:monospace; color:#e0e0e0;">${escapeHtml(ref.docId)}</td>`;
            html += `<td style="padding:4px 8px; border-bottom:1px solid #1a1a1a; font-family:monospace; color:#ffaa44;">${escapeHtml(fieldNames)}</td>`;
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
    console.log('[PHOTO] 📂 listPhotosInStorage called');
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
    console.log('[PHOTO] 🗑️ deletePhotosFromStorage called');
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
// PHOTO TAB INFORMATION GUIDE
// ============================================================

function showPhotoInfoGuide() {
    console.log('[PHOTO] ℹ️ showPhotoInfoGuide called');
    
    var existing = document.querySelector('.info-overlay');
    if (existing) {
        existing.remove();
    }
    
    if (!document.getElementById('photoInfoGuideStyles')) {
        var style = document.createElement('style');
        style.id = 'photoInfoGuideStyles';
        style.textContent = `
            .info-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 50000;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                animation: infoFadeIn 0.3s ease-out;
            }
            .info-card {
                background: #1a1a1a;
                border-radius: 28px;
                padding: 32px;
                max-width: 750px;
                width: 95%;
                max-height: 90vh;
                overflow-y: auto;
                border: 2px solid #ffaa44;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
                animation: infoSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .info-card::-webkit-scrollbar { width: 4px; }
            .info-card::-webkit-scrollbar-track { background: #0a0a0a; }
            .info-card::-webkit-scrollbar-thumb { background: #2a5a2a; border-radius: 4px; }
            .info-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                border-bottom: 1px solid #2a2a2a;
                padding-bottom: 12px;
            }
            .info-title { font-size: 1.2rem; font-weight: 700; color: #ffaa44; }
            .info-close-btn {
                padding: 8px 28px;
                border-radius: 30px;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid #ffaa44;
                background: rgba(255, 170, 68, 0.1);
                color: #ffaa44;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            .info-close-btn:hover { background: rgba(255, 170, 68, 0.2); }
            .info-section { margin-bottom: 16px; }
            .info-section-title {
                font-size: 0.85rem;
                font-weight: 700;
                color: #ffaa44;
                margin-bottom: 4px;
            }
            .info-text {
                font-size: 0.85rem;
                color: #ccc;
                line-height: 1.6;
            }
            .info-text strong { color: #ffaa44; }
            .info-text .highlight { color: #ffaa44; }
            .info-text .danger-text { color: #ff6b6b; }
            .info-steps {
                padding-left: 20px;
                margin: 4px 0 8px 0;
            }
            .info-steps li {
                font-size: 0.85rem;
                color: #ccc;
                line-height: 1.6;
                margin-bottom: 2px;
            }
            .info-steps li code {
                background: #0a0a0a;
                padding: 1px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                color: #ffaa44;
                font-family: monospace;
            }
            .info-warnings {
                padding-left: 20px;
                margin: 4px 0 8px 0;
            }
            .info-warnings li {
                font-size: 0.85rem;
                color: #ff6b6b;
                line-height: 1.6;
                margin-bottom: 2px;
            }
            .info-divider {
                border: none;
                border-top: 1px solid #2a2a2a;
                margin: 16px 0;
            }
            @keyframes infoFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes infoSlideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.97);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
        `;
        document.head.appendChild(style);
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
                    <li><strong>Step 2 - Load Image:</strong> Enter a URL (default is C.jpg from Cloudflare) and click <span class="highlight">"Load Image"</span></li>
                    <li><strong>Step 3 - View:</strong> The image will appear in the viewer for preview</li>
                    <li><strong>Step 4 - Filename:</strong> Enter a custom filename (auto-generated with timestamp)</li>
                    <li><strong>Step 5 - Upload:</strong> Click <span class="highlight">"Upload to Firebase Storage"</span> to upload the image</li>
                    <li><strong>Step 6 - Copy URL:</strong> Use <span class="highlight">"Copy URL"</span> to copy the download URL to your clipboard</li>
                    <li><strong>Step 7 - Save Reference:</strong> Optionally save the URL to a Firestore document field</li>
                    <li><strong>Step 8 - Show Info:</strong> Click <span class="highlight">"Show Info"</span> to view the photo details and see which Firestore documents reference it</li>
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
                    <li><strong>CORS:</strong> The image URL must allow cross-origin access. Cloudflare Pages URLs work by default.</li>
                    <li><strong>Image Size:</strong> Images are automatically resized to max 1200px to save storage space</li>
                    <li><strong>File Format:</strong> Images are uploaded as JPEG with 85% quality</li>
                    <li><strong>Storage Path:</strong> Default folder is <code>celebrations/</code> - can be changed</li>
                    <li><strong>Environment:</strong> PROD and DEV have separate Firebase Storage buckets</li>
                    <li><strong>Deleting Photos:</strong> To delete photos, go to the <strong style="color:#ff6b6b;">DELETE</strong> tab</li>
                </ul>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📂 Firestore Reference</div>
                <div class="info-text">
                    You can save the uploaded photo URL to any Firestore document field:
                    <ul style="padding-left:20px; margin:4px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li><strong>Collection:</strong> Select <code>scheduledGames</code>, <code>historyGames</code>, or <code>backupFolder</code></li>
                        <li><strong>Document ID:</strong> Enter the document ID (e.g., <code>GM_260624_0902_70_R</code>)</li>
                        <li><strong>Field:</strong> Enter the field name (default is <code>celebration</code>)</li>
                    </ul>
                </div>
            </div>
            
            <div style="text-align:center; margin-top:20px;">
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✓ OK, I understand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ============================================================
// ATTACH PHOTO HANDLERS (FIXED)
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
    
    if (loadBtn) {
        loadBtn.onclick = function() { 
            console.log('[PHOTO] 📥 Load button clicked');
            loadPhotoFromUrl();
        };
        console.log('[PHOTO] ✅ Load button attached');
    } else {
        console.log('[PHOTO] ❌ Load button not found');
    }
    
    if (prodBtn) {
        prodBtn.onclick = function() { 
            console.log('[PHOTO] 🔴 PROD button clicked');
            setPhotoEnvironment('PROD');
        };
        console.log('[PHOTO] ✅ PROD button attached');
    } else {
        console.log('[PHOTO] ❌ PROD button not found');
    }
    
    if (devBtn) {
        devBtn.onclick = function() { 
            console.log('[PHOTO] 🟡 DEV button clicked');
            setPhotoEnvironment('DEV');
        };
        console.log('[PHOTO] ✅ DEV button attached');
    } else {
        console.log('[PHOTO] ❌ DEV button not found');
    }
    
    if (uploadBtn) {
        uploadBtn.onclick = function() { 
            console.log('[PHOTO] 📤 Upload button clicked');
            uploadPhotoToStorage();
        };
        console.log('[PHOTO] ✅ Upload button attached');
    } else {
        console.log('[PHOTO] ❌ Upload button not found');
    }
    
    if (resetBtn) {
        resetBtn.onclick = function() { 
            console.log('[PHOTO] 🔄 Reset button clicked');
            resetPhotoTool();
        };
        console.log('[PHOTO] ✅ Reset button attached');
    } else {
        console.log('[PHOTO] ❌ Reset button not found');
    }
    
    if (infoBtn) {
        infoBtn.onclick = function() { 
            console.log('[PHOTO] 📋 Show Info button clicked');
            showPhotoInfo();
        };
        console.log('[PHOTO] ✅ Show Info button attached');
    } else {
        console.log('[PHOTO] ❌ Show Info button not found');
    }
    
    if (copyBtn) {
        copyBtn.onclick = function() { 
            console.log('[PHOTO] 📋 Copy URL button clicked');
            copyPhotoUrl();
        };
        console.log('[PHOTO] ✅ Copy URL button attached');
    } else {
        console.log('[PHOTO] ❌ Copy URL button not found');
    }
    
    if (saveRefBtn) {
        saveRefBtn.onclick = function() { 
            console.log('[PHOTO] 💾 Save Reference button clicked');
            savePhotoToFirestore();
        };
        console.log('[PHOTO] ✅ Save Reference button attached');
    } else {
        console.log('[PHOTO] ❌ Save Reference button not found');
    }
    
    if (urlInput) {
        urlInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                console.log('[PHOTO] ⌨️ Enter key on URL input');
                loadPhotoFromUrl();
            }
        };
        console.log('[PHOTO] ✅ URL input keydown attached');
    } else {
        console.log('[PHOTO] ❌ URL input not found');
    }
    
    console.log('[PHOTO] ✅ All handlers attached');
}

// ============================================================
// INITIALIZE PHOTO TAB (FIXED)
// ============================================================

function initPhotoTab() {
    console.log('[PHOTO] 🚀 initPhotoTab called');
    
    // Set default URL
    var urlInput = document.getElementById('photoUrlInput');
    if (urlInput && !urlInput.value) {
        urlInput.value = DEFAULT_IMAGE_URL;
        console.log('[PHOTO] ✅ Default URL set');
    }
    
    // Set default folder
    var folderInput = document.getElementById('photoStorageFolder');
    if (folderInput && !folderInput.value) {
        folderInput.value = 'celebrations/';
        console.log('[PHOTO] ✅ Default folder set');
    }
    
    // Set default field
    var fieldInput = document.getElementById('photoFirestoreField');
    if (fieldInput && !fieldInput.value) {
        fieldInput.value = 'celebration';
        console.log('[PHOTO] ✅ Default field set');
    }
    
    // Attach handlers
    attachPhotoHandlers();
    
    // Set default environment
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

console.log('[PHOTO] ✅ All functions exposed globally');

// ============================================================
// AUTO-INIT
// ============================================================

// Check if DOM is ready and initialize
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

// Call autoInit
autoInit();

console.log('[PHOTO-UTIL] v1.10 loaded (auto-init enabled)');

/*
FILE: js/util-photo.js
VERSION: 1.10
KEY CHANGES from v1.09:
   - FIXED: All functions now properly exposed to window object
   - FIXED: DEV button now properly works with fallback
   - FIXED: Load image button now properly works
   - ADDED: attachPhotoHandlers() function for manual handler attachment
   - ADDED: Debug logging for all button clicks
   - ADDED: Auto-init on DOM ready
   - REMOVED: Dependencies on main HTML log function (uses console fallback)
DEPENDS ON: Firebase Storage, Firestore
STATUS: Ready for integration
*/