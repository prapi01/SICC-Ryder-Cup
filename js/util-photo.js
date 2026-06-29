/*
FILE: js/util-photo.js
VERSION: 1.00
KEY CHANGES from initial:
   - ADDED: Photo utility functions for loading from GitHub and uploading to Firebase Storage
   - ADDED: Environment selector (PROD/DEV) for Firebase Storage
   - ADDED: Image viewer with zoom/pan capabilities
   - ADDED: Upload to Firebase Storage with progress
   - ADDED: showPhotoInfoGuide() function - full-page information overlay
   - PRESERVED: All existing functionality from base structure
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, logStep, escapeHtml, prodDb, devDb, firebase
STATUS: Ready for integration
*/

/*
============================================================
SHARED STATE (defined in main HTML)
============================================================
- prodDb: PROD Firestore instance
- devDb: DEV Firestore instance
- photoStorage: Firebase Storage instance for the selected environment
- photoStorageEnv: 'PROD' or 'DEV' for Storage
- currentPhotoData: The loaded image data
- currentPhotoUrl: The GitHub raw URL of the loaded image
============================================================
*/

// Photo-specific environment variables
var photoStorage = null;
var photoStorageEnv = null;
var currentPhotoData = null;
var currentPhotoUrl = null;
var currentDownloadUrl = null;

// GitHub URL for C.jpg (update this to the correct URL)
var GITHUB_IMAGE_URL = 'https://raw.githubusercontent.com/your-repo/path/to/C.jpg';

// ============================================================
// PHOTO TAB: ENVIRONMENT FUNCTIONS
// ============================================================

function setPhotoEnvironment(env) {
    if (env === 'PROD') {
        if (!prodDb) {
            initFirebase();
            if (!prodDb) {
                log("Cannot connect to PRODUCTION", "error");
                return;
            }
        }
        // Get storage for PROD
        var prodApp = firebase.apps.find(function(app) { return app.name === "prod"; });
        if (prodApp) {
            photoStorage = firebase.storage(prodApp);
        } else {
            // Fallback: try to get default storage
            try {
                photoStorage = firebase.storage();
            } catch(e) {
                log("Cannot initialize PRODUCTION storage", "error");
                return;
            }
        }
        photoStorageEnv = 'PROD';
        updatePhotoUI('PROD');
        log('Photo environment set to: PRODUCTION', 'info');
    } else if (env === 'DEV') {
        if (!devDb) {
            initFirebase();
            if (!devDb) {
                log("Cannot connect to DEVELOPMENT", "error");
                return;
            }
        }
        var devApp = firebase.apps.find(function(app) { return app.name === "dev"; });
        if (devApp) {
            photoStorage = firebase.storage(devApp);
        } else {
            // Fallback: try to get default storage
            try {
                photoStorage = firebase.storage();
            } catch(e) {
                log("Cannot initialize DEVELOPMENT storage", "error");
                return;
            }
        }
        photoStorageEnv = 'DEV';
        updatePhotoUI('DEV');
        log('Photo environment set to: DEVELOPMENT', 'info');
    } else {
        photoStorage = null;
        photoStorageEnv = null;
        updatePhotoUI(null);
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
// PHOTO TAB: LOAD FROM GITHUB
// ============================================================

function loadPhotoFromGitHub() {
    var urlInput = document.getElementById('photoUrlInput');
    var url = urlInput ? urlInput.value.trim() : GITHUB_IMAGE_URL;
    
    if (!url) {
        log("Please enter a GitHub raw URL", "error");
        return;
    }
    
    var viewer = document.getElementById('photoViewer');
    var statusDiv = document.getElementById('photoStatus');
    
    // Show loading
    if (viewer) {
        viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:1rem;">⏳ Loading image...</div>';
    }
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="log-info">⏳ Loading from GitHub...</span>';
    }
    
    log('Loading image from: ' + url, 'info');
    
    // Create a new image to test loading
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        currentPhotoData = img;
        currentPhotoUrl = url;
        displayPhotoInViewer(img);
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="log-success">✅ Loaded from GitHub: ' + url + '</span>';
        }
        log('Image loaded successfully from GitHub', 'success');
        log('  Dimensions: ' + img.width + 'x' + img.height, 'info');
        
        // Set default filename
        var filenameInput = document.getElementById('photoFilename');
        if (filenameInput && !filenameInput.value) {
            var env = photoStorageEnv || 'PROD';
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            filenameInput.value = env + '_C_' + timestamp + '.jpg';
        }
    };
    img.onerror = function() {
        if (viewer) {
            viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff6b6b;font-size:1rem;">❌ Failed to load image<br><span style="font-size:0.7rem;color:#888;">Check URL and CORS settings</span></div>';
        }
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="log-error">❌ Failed to load image from: ' + url + '</span>';
        }
        log('Failed to load image from GitHub', 'error');
        log('  URL: ' + url, 'error');
        currentPhotoData = null;
        currentPhotoUrl = null;
    };
    img.src = url;
}

// ============================================================
// PHOTO TAB: DISPLAY PHOTO IN VIEWER
// ============================================================

function displayPhotoInViewer(img) {
    var viewer = document.getElementById('photoViewer');
    if (!viewer) return;
    
    // Create a container with zoom/pan support
    viewer.innerHTML = '';
    viewer.style.overflow = 'hidden';
    viewer.style.position = 'relative';
    viewer.style.cursor = 'grab';
    
    var container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    
    var imgElement = document.createElement('img');
    imgElement.src = img.src;
    imgElement.style.maxWidth = '100%';
    imgElement.style.maxHeight = '100%';
    imgElement.style.objectFit = 'contain';
    imgElement.style.transition = 'transform 0.1s ease';
    imgElement.style.transform = 'scale(1)';
    imgElement.style.transformOrigin = 'center center';
    imgElement.draggable = false;
    
    container.appendChild(imgElement);
    viewer.appendChild(container);
    
    // Zoom controls
    var zoomControls = document.createElement('div');
    zoomControls.style.position = 'absolute';
    zoomControls.style.bottom = '12px';
    zoomControls.style.right = '12px';
    zoomControls.style.display = 'flex';
    zoomControls.style.gap = '8px';
    zoomControls.style.zIndex = '10';
    
    var zoomIn = document.createElement('button');
    zoomIn.textContent = '+';
    zoomIn.style.width = '36px';
    zoomIn.style.height = '36px';
    zoomIn.style.borderRadius = '50%';
    zoomIn.style.border = '1px solid #4caf50';
    zoomIn.style.background = 'rgba(0,0,0,0.7)';
    zoomIn.style.color = '#4caf50';
    zoomIn.style.fontSize = '1.2rem';
    zoomIn.style.fontWeight = '700';
    zoomIn.style.cursor = 'pointer';
    zoomIn.style.backdropFilter = 'blur(4px)';
    
    var zoomOut = document.createElement('button');
    zoomOut.textContent = '−';
    zoomOut.style.width = '36px';
    zoomOut.style.height = '36px';
    zoomOut.style.borderRadius = '50%';
    zoomOut.style.border = '1px solid #4caf50';
    zoomOut.style.background = 'rgba(0,0,0,0.7)';
    zoomOut.style.color = '#4caf50';
    zoomOut.style.fontSize = '1.2rem';
    zoomOut.style.fontWeight = '700';
    zoomOut.style.cursor = 'pointer';
    zoomOut.style.backdropFilter = 'blur(4px)';
    
    var resetZoom = document.createElement('button');
    resetZoom.textContent = '⟲';
    resetZoom.style.width = '36px';
    resetZoom.style.height = '36px';
    resetZoom.style.borderRadius = '50%';
    resetZoom.style.border = '1px solid #ffaa44';
    resetZoom.style.background = 'rgba(0,0,0,0.7)';
    resetZoom.style.color = '#ffaa44';
    resetZoom.style.fontSize = '1.2rem';
    resetZoom.style.fontWeight = '700';
    resetZoom.style.cursor = 'pointer';
    resetZoom.style.backdropFilter = 'blur(4px)';
    
    zoomControls.appendChild(zoomOut);
    zoomControls.appendChild(resetZoom);
    zoomControls.appendChild(zoomIn);
    viewer.appendChild(zoomControls);
    
    // Zoom state
    var currentScale = 1;
    var minScale = 0.5;
    var maxScale = 3;
    
    function updateZoom(scale) {
        currentScale = Math.max(minScale, Math.min(maxScale, scale));
        imgElement.style.transform = 'scale(' + currentScale + ')';
    }
    
    zoomIn.onclick = function(e) {
        e.stopPropagation();
        updateZoom(currentScale + 0.25);
    };
    
    zoomOut.onclick = function(e) {
        e.stopPropagation();
        updateZoom(currentScale - 0.25);
    };
    
    resetZoom.onclick = function(e) {
        e.stopPropagation();
        updateZoom(1);
    };
    
    // Mouse wheel zoom
    viewer.onwheel = function(e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? -0.1 : 0.1;
        updateZoom(currentScale + delta);
    };
    
    // Drag to pan
    var isDragging = false;
    var startX, startY, startTranslateX = 0, startTranslateY = 0;
    var translateX = 0, translateY = 0;
    
    viewer.onmousedown = function(e) {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
        viewer.style.cursor = 'grabbing';
        e.preventDefault();
    };
    
    document.onmousemove = function(e) {
        if (!isDragging) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        translateX = startTranslateX + dx;
        translateY = startTranslateY + dy;
        imgElement.style.transform = 'scale(' + currentScale + ') translate(' + (translateX / currentScale) + 'px, ' + (translateY / currentScale) + 'px)';
    };
    
    document.onmouseup = function() {
        if (isDragging) {
            isDragging = false;
            viewer.style.cursor = 'grab';
        }
    };
    
    // Touch support
    var lastTouchDist = 0;
    var touchStartX = 0, touchStartY = 0;
    var touchStartTranslateX = 0, touchStartTranslateY = 0;
    var touchStartScale = 1;
    
    viewer.ontouchstart = function(e) {
        if (e.target.closest('button')) return;
        var touches = e.touches;
        if (touches.length === 1) {
            touchStartX = touches[0].clientX;
            touchStartY = touches[0].clientY;
            touchStartTranslateX = translateX;
            touchStartTranslateY = translateY;
        } else if (touches.length === 2) {
            lastTouchDist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            touchStartScale = currentScale;
        }
    };
    
    viewer.ontouchmove = function(e) {
        e.preventDefault();
        var touches = e.touches;
        if (touches.length === 1) {
            var dx = touches[0].clientX - touchStartX;
            var dy = touches[0].clientY - touchStartY;
            translateX = touchStartTranslateX + dx;
            translateY = touchStartTranslateY + dy;
            imgElement.style.transform = 'scale(' + currentScale + ') translate(' + (translateX / currentScale) + 'px, ' + (translateY / currentScale) + 'px)';
        } else if (touches.length === 2) {
            var dist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            var scaleDelta = dist / lastTouchDist;
            updateZoom(touchStartScale * scaleDelta);
            lastTouchDist = dist;
        }
    };
    
    log('Photo viewer ready with zoom/pan controls', 'success');
}

// ============================================================
// PHOTO TAB: UPLOAD TO FIREBASE STORAGE
// ============================================================

function uploadPhotoToStorage() {
    if (!photoStorage) {
        log("Select an environment first (PROD/DEV)", "error");
        return;
    }
    
    if (!currentPhotoData) {
        log("Load an image from GitHub first", "error");
        return;
    }
    
    var filenameInput = document.getElementById('photoFilename');
    var filename = filenameInput ? filenameInput.value.trim() : '';
    
    if (!filename) {
        log("Enter a filename for the uploaded image", "error");
        return;
    }
    
    // Ensure .jpg extension if not present
    if (!filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg') && 
        !filename.toLowerCase().endsWith('.png') && !filename.toLowerCase().endsWith('.gif')) {
        filename = filename + '.jpg';
        if (filenameInput) filenameInput.value = filename;
    }
    
    var env = photoStorageEnv || 'PROD';
    var folder = document.getElementById('photoStorageFolder');
    var storagePath = folder ? folder.value.trim() : 'celebrations/';
    if (storagePath && !storagePath.endsWith('/')) {
        storagePath = storagePath + '/';
    }
    var fullPath = storagePath + env + '_' + filename;
    
    var statusDiv = document.getElementById('photoUploadStatus');
    var progressDiv = document.getElementById('photoProgress');
    
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="log-info">⏳ Uploading to Firebase Storage...</span>';
    }
    if (progressDiv) {
        progressDiv.style.display = 'block';
        progressDiv.innerHTML = '<div class="progress-bar" style="width:0%;height:4px;background:#2a5a2a;border-radius:2px;transition:width 0.3s;"></div>';
        progressDiv.querySelector('.progress-bar').style.width = '0%';
    }
    
    log('Uploading to: ' + fullPath + ' (' + env + ')', 'info');
    
    // Convert image to blob
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    
    // Max dimensions to avoid huge files
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
    
    // Get blob as JPEG with 85% quality
    canvas.toBlob(function(blob) {
        if (!blob) {
            log('Failed to convert image to blob', 'error');
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
                log('Upload progress: ' + Math.round(progress) + '%', 'info');
            },
            function(error) {
                log('Upload failed: ' + error.message, 'error');
                if (statusDiv) {
                    statusDiv.innerHTML = '<span class="log-error">❌ Upload failed: ' + error.message + '</span>';
                }
                if (progressDiv) {
                    progressDiv.style.display = 'none';
                }
                console.error('Upload error:', error);
            },
            function() {
                uploadTask.snapshot.ref.getDownloadURL().then(function(downloadURL) {
                    currentDownloadUrl = downloadURL;
                    log('✅ Upload successful!', 'success');
                    log('  File: ' + fullPath, 'success');
                    log('  URL: ' + downloadURL, 'success');
                    
                    if (statusDiv) {
                        statusDiv.innerHTML = '<span class="log-success">✅ Upload successful!</span>';
                    }
                    if (progressDiv) {
                        progressDiv.style.display = 'none';
                    }
                    
                    // Display the uploaded image
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
                    
                    // Show the URL
                    var urlDisplay = document.getElementById('uploadedUrl');
                    if (urlDisplay) {
                        urlDisplay.innerHTML = '<span class="game-info-label">Download URL:</span><span class="game-info-value gold" style="word-break:break-all;font-size:0.7rem;">' + escapeHtml(downloadURL) + '</span>';
                        urlDisplay.style.display = 'block';
                    }
                    
                    // Show copy button
                    var copyBtn = document.getElementById('copyUrlBtn');
                    if (copyBtn) copyBtn.style.display = 'inline-block';
                    
                    // Show Firestore reference option
                    var firestoreRefDiv = document.getElementById('firestoreRefSection');
                    if (firestoreRefDiv) firestoreRefDiv.style.display = 'block';
                    
                    // Show the photo in viewer
                    var viewBtn = document.getElementById('viewUploadedBtn');
                    if (viewBtn) viewBtn.style.display = 'inline-block';
                });
            }
        );
    }, 'image/jpeg', 0.85);
}

// ============================================================
// PHOTO TAB: SAVE TO FIRESTORE REFERENCE
// ============================================================

function savePhotoToFirestore() {
    if (!currentDownloadUrl) {
        log("Upload a photo to Firebase Storage first", "error");
        return;
    }
    
    var collection = document.getElementById('photoFirestoreCollection');
    var docId = document.getElementById('photoFirestoreDocId');
    var fieldName = document.getElementById('photoFirestoreField');
    
    if (!collection || !docId || !fieldName) {
        log("Missing Firestore reference fields", "error");
        return;
    }
    
    var collectionName = collection.value.trim();
    var documentId = docId.value.trim();
    var field = fieldName.value.trim();
    
    if (!collectionName || !documentId || !field) {
        log("Fill in all Firestore reference fields", "error");
        return;
    }
    
    var db = photoStorageEnv === 'PROD' ? prodDb : devDb;
    if (!db) {
        log("Database not available for " + photoStorageEnv, "error");
        return;
    }
    
    log('Saving photo reference to: ' + collectionName + '/' + documentId + ' -> ' + field, 'info');
    
    var updateData = {};
    updateData[field] = currentDownloadUrl;
    
    db.collection(collectionName).doc(documentId).update(updateData)
        .then(function() {
            log('✅ Photo reference saved to Firestore', 'success');
            log('  Collection: ' + collectionName, 'success');
            log('  Document: ' + documentId, 'success');
            log('  Field: ' + field, 'success');
            log('  URL: ' + currentDownloadUrl, 'success');
            
            var statusDiv = document.getElementById('firestoreStatus');
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="log-success">✅ Saved to Firestore: ' + collectionName + '/' + documentId + ' -> ' + field + '</span>';
            }
        })
        .catch(function(err) {
            log('❌ Failed to save photo reference: ' + err.message, 'error');
            var statusDiv = document.getElementById('firestoreStatus');
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="log-error">❌ Failed: ' + err.message + '</span>';
            }
        });
}

// ============================================================
// PHOTO TAB: COPY URL TO CLIPBOARD
// ============================================================

function copyPhotoUrl() {
    if (!currentDownloadUrl) {
        log("Upload a photo first", "error");
        return;
    }
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentDownloadUrl)
            .then(function() {
                log('✅ URL copied to clipboard', 'success');
            })
            .catch(function() {
                // Fallback
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
        log('✅ URL copied to clipboard (fallback)', 'success');
    } catch(e) {
        log('❌ Failed to copy URL', 'error');
    }
    document.body.removeChild(textarea);
}

// ============================================================
// PHOTO TAB: VIEW UPLOADED PHOTO
// ============================================================

function viewUploadedPhoto() {
    if (!currentDownloadUrl) {
        log("Upload a photo first", "error");
        return;
    }
    
    window.open(currentDownloadUrl, '_blank');
}

// ============================================================
// PHOTO TAB: RESET
// ============================================================

function resetPhotoTool() {
    currentPhotoData = null;
    currentPhotoUrl = null;
    currentDownloadUrl = null;
    
    var viewer = document.getElementById('photoViewer');
    if (viewer) {
        viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:1rem;">🖼️ Load an image to preview</div>';
    }
    
    var uploadedViewer = document.getElementById('uploadedPhotoViewer');
    if (uploadedViewer) {
        uploadedViewer.innerHTML = '';
    }
    
    var statusDiv = document.getElementById('photoStatus');
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="log-info">Ready. Load an image from GitHub.</span>';
    }
    
    var uploadStatusDiv = document.getElementById('photoUploadStatus');
    if (uploadStatusDiv) {
        uploadStatusDiv.innerHTML = '';
    }
    
    var urlDisplay = document.getElementById('uploadedUrl');
    if (urlDisplay) {
        urlDisplay.style.display = 'none';
    }
    
    var copyBtn = document.getElementById('copyUrlBtn');
    if (copyBtn) copyBtn.style.display = 'none';
    
    var viewBtn = document.getElementById('viewUploadedBtn');
    if (viewBtn) viewBtn.style.display = 'none';
    
    var firestoreRefDiv = document.getElementById('firestoreRefSection');
    if (firestoreRefDiv) firestoreRefDiv.style.display = 'none';
    
    var firestoreStatus = document.getElementById('firestoreStatus');
    if (firestoreStatus) firestoreStatus.innerHTML = '';
    
    var progressDiv = document.getElementById('photoProgress');
    if (progressDiv) progressDiv.style.display = 'none';
    
    log('Photo tool reset', 'info');
}

// ============================================================
// PHOTO TAB: INFORMATION GUIDE
// ============================================================

function showPhotoInfoGuide() {
    // Remove existing overlay if present
    var existing = document.querySelector('.info-overlay');
    if (existing) existing.remove();
    
    var overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.innerHTML = `
        <div class="info-card" style="border-color:#ffaa44;">
            <div class="info-header">
                <div class="info-title" style="color:#ffaa44;">🖼️ PHOTO TAB - Information & Guide</div>
                <button class="info-close-btn" style="border-color:#ffaa44;color:#ffaa44;" onclick="this.closest('.info-overlay').remove()">✕ CLOSE</button>
            </div>
            
            <div class="info-section">
                <div class="info-section-title" style="color:#ffaa44;">🎯 What This Tab Does</div>
                <div class="info-text">
                    The <strong>PHOTO</strong> tab allows you to load images from GitHub and upload them to Firebase Storage.
                    This is useful for:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>📸 Uploading celebration photos to Firebase Storage</li>
                        <li>🔄 Moving images between PROD and DEV environments</li>
                        <li>📋 Creating a photo reference for a game record</li>
                        <li>🔗 Getting a direct download URL for use in Firestore</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title" style="color:#ffaa44;">📖 How To Use</div>
                <ol class="info-steps">
                    <li><strong>Step 1 - Environment:</strong> Select <span class="highlight">PROD</span> or <span class="highlight">DEV</span> for Firebase Storage</li>
                    <li><strong>Step 2 - Load Image:</strong> Enter a GitHub raw URL or use the default <code>C.jpg</code>, then click <span class="highlight">"Load from GitHub"</span></li>
                    <li><strong>Step 3 - View:</strong> Use zoom controls (+ / - / ⟲) and drag to pan around the image</li>
                    <li><strong>Step 4 - Filename:</strong> Enter a custom filename for the uploaded image (default: ENV_C_timestamp.jpg)</li>
                    <li><strong>Step 5 - Upload:</strong> Click <span class="highlight">"Upload to Firebase Storage"</span> to upload the image</li>
                    <li><strong>Step 6 - Copy URL:</strong> Copy the download URL to use in Firestore documents</li>
                    <li><strong>Step 7 - Save Reference:</strong> Optionally save the URL to a Firestore document field</li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title" style="color:#ffaa44;">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>GitHub CORS:</strong> The image must be served with proper CORS headers. Use the raw GitHub URL format: <code>https://raw.githubusercontent.com/...</code></li>
                    <li><strong>Image Size:</strong> Images are automatically resized to max 1200px to save storage space</li>
                    <li><strong>File Format:</strong> Images are uploaded as JPEG with 85% quality</li>
                    <li><strong>Storage Path:</strong> Default folder is <code>celebrations/</code> - can be changed</li>
                    <li><strong>Environment:</strong> PROD and DEV have separate Firebase Storage buckets</li>
                </ul>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title" style="color:#ffaa44;">📊 File Naming Convention</div>
                <div class="info-text">
                    The default filename is: <code>ENV_C_YYYY-MM-DDTHH-mm-ss.jpg</code>
                    <br>Example: <code>PROD_C_2026-06-29T14-30-00.jpg</code>
                    <br>You can customize this in the filename input field.
                </div>
            </div>
            
            <div style="text-align:center; margin-top:20px;">
                <button class="info-close-btn" style="border-color:#ffaa44;color:#ffaa44;" onclick="this.closest('.info-overlay').remove()">✓ OK, I understand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ============================================================
// PHOTO TAB: UI INITIALIZATION
// ============================================================

function initPhotoTab() {
    // Set up environment buttons
    var prodBtn = document.getElementById('photoProdBtn');
    var devBtn = document.getElementById('photoDevBtn');
    var loadBtn = document.getElementById('photoLoadBtn');
    var uploadBtn = document.getElementById('photoUploadBtn');
    var resetBtn = document.getElementById('photoResetBtn');
    var copyUrlBtn = document.getElementById('copyUrlBtn');
    var viewBtn = document.getElementById('viewUploadedBtn');
    var saveRefBtn = document.getElementById('saveFirestoreRefBtn');
    var urlInput = document.getElementById('photoUrlInput');
    
    if (prodBtn) prodBtn.onclick = function() { setPhotoEnvironment('PROD'); };
    if (devBtn) devBtn.onclick = function() { setPhotoEnvironment('DEV'); };
    if (loadBtn) loadBtn.onclick = loadPhotoFromGitHub;
    if (uploadBtn) uploadBtn.onclick = uploadPhotoToStorage;
    if (resetBtn) resetBtn.onclick = resetPhotoTool;
    if (copyUrlBtn) copyUrlBtn.onclick = copyPhotoUrl;
    if (viewBtn) viewBtn.onclick = viewUploadedPhoto;
    if (saveRefBtn) saveRefBtn.onclick = savePhotoToFirestore;
    
    // Enter key on URL input
    if (urlInput) {
        urlInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                loadPhotoFromGitHub();
            }
        };
    }
    
    // Set default URL
    if (urlInput && !urlInput.value) {
        urlInput.value = GITHUB_IMAGE_URL;
    }
    
    // Set default folder
    var folderInput = document.getElementById('photoStorageFolder');
    if (folderInput && !folderInput.value) {
        folderInput.value = 'celebrations/';
    }
    
    // Set default Firestore field
    var fieldInput = document.getElementById('photoFirestoreField');
    if (fieldInput && !fieldInput.value) {
        fieldInput.value = 'celebration';
    }
    
    log('Photo tab initialized', 'success');
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.setPhotoEnvironment = setPhotoEnvironment;
window.loadPhotoFromGitHub = loadPhotoFromGitHub;
window.uploadPhotoToStorage = uploadPhotoToStorage;
window.resetPhotoTool = resetPhotoTool;
window.copyPhotoUrl = copyPhotoUrl;
window.viewUploadedPhoto = viewUploadedPhoto;
window.savePhotoToFirestore = savePhotoToFirestore;
window.showPhotoInfoGuide = showPhotoInfoGuide;
window.initPhotoTab = initPhotoTab;

// ============================================================
// EXPOSE FOR DEBUGGING
// ============================================================

window.PHOTO_UTIL_VERSION = "1.00";
console.log("[PHOTO-UTIL] v1.00 loaded");

/*
FILE: js/util-photo.js
VERSION: 1.00
KEY CHANGES from initial:
   - ADDED: Photo utility functions for loading from GitHub and uploading to Firebase Storage
   - ADDED: Environment selector (PROD/DEV) for Firebase Storage
   - ADDED: Image viewer with zoom/pan capabilities
   - ADDED: Upload to Firebase Storage with progress
   - ADDED: showPhotoInfoGuide() function - full-page information overlay
   - PRESERVED: All existing functionality from base structure
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, logStep, escapeHtml, prodDb, devDb, firebase
STATUS: Ready for integration
*/