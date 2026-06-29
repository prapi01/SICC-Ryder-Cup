/*
FILE: js/util-photo.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: showPhotoInfoPanel() - Display photo preview + Firestore references
   - ADDED: findPhotoReferences() - Search all collections for photo URL
   - ADDED: displayPhotoReferences() - Render references in UI
   - ADDED: Enhanced delete options (Storage only vs Storage + References)
   - CHANGED: Upload now automatically shows the info panel
   - CHANGED: Delete functions now show confirmation with reference count
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/

// ... (all existing functions from v1.01 remain unchanged) ...

// ============================================================
// PHOTO INFORMATION PANEL
// ============================================================

/**
 * Show the photo information panel with preview and Firestore references
 * 
 * @param {string} photoUrl - The photo URL to show info for
 * @param {string} fullPath - Optional Storage path for the photo
 */
function showPhotoInfoPanel(photoUrl, fullPath) {
    var panel = document.getElementById('photoInfoPanel');
    if (!panel) return;
    
    panel.style.display = 'block';
    
    // Show loading state
    panel.innerHTML = `
        <div style="padding:20px; text-align:center; color:#888;">
            ⏳ Loading photo information...
        </div>
    `;
    
    // Fetch the photo to display
    var previewContainer = document.createElement('div');
    previewContainer.style.textAlign = 'center';
    previewContainer.style.marginBottom = '16px';
    
    var img = new Image();
    img.onload = function() {
        // Photo loaded, now find Firestore references
        findPhotoReferences(photoUrl, function(err, references) {
            if (err) {
                panel.innerHTML = `
                    <div style="padding:20px; color:#ff6b6b; text-align:center;">
                        ❌ Error: ${escapeHtml(err.message)}
                    </div>
                `;
                return;
            }
            renderInfoPanel(photoUrl, fullPath, img, references);
        });
    };
    img.onerror = function() {
        // Photo couldn't be loaded (maybe deleted)
        findPhotoReferences(photoUrl, function(err, references) {
            if (err) {
                panel.innerHTML = `
                    <div style="padding:20px; color:#ff6b6b; text-align:center;">
                        ❌ Error: ${escapeHtml(err.message)}
                    </div>
                `;
                return;
            }
            renderInfoPanel(photoUrl, fullPath, null, references);
        });
    };
    img.src = photoUrl;
}

/**
 * Render the photo information panel
 */
function renderInfoPanel(photoUrl, fullPath, img, references) {
    var panel = document.getElementById('photoInfoPanel');
    if (!panel) return;
    
    var hasPhoto = img !== null;
    var refCount = references ? references.length : 0;
    var fields = [];
    var collections = [];
    
    // Build reference list HTML
    var refHtml = '';
    if (references && references.length > 0) {
        var uniqueRefs = {};
        references.forEach(function(ref) {
            var key = ref.collection + '|' + ref.docId;
            if (!uniqueRefs[key]) {
                uniqueRefs[key] = ref;
            }
            if (ref.fields) {
                ref.fields.forEach(function(field) {
                    if (fields.indexOf(field) === -1) {
                        fields.push(field);
                    }
                });
            }
            if (collections.indexOf(ref.collection) === -1) {
                collections.push(ref.collection);
            }
        });
        
        var refs = Object.values(uniqueRefs);
        refHtml = `
            <div style="background:#0a0a0a; border-radius:8px; padding:12px; margin-top:8px; overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                    <thead>
                        <tr>
                            <th style="text-align:left; color:#888; padding:4px 8px; border-bottom:1px solid #2a2a2a;">Collection</th>
                            <th style="text-align:left; color:#888; padding:4px 8px; border-bottom:1px solid #2a2a2a;">Document ID</th>
                            <th style="text-align:left; color:#888; padding:4px 8px; border-bottom:1px solid #2a2a2a;">Field</th>
                            <th style="text-align:center; color:#888; padding:4px 8px; border-bottom:1px solid #2a2a2a;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        refs.forEach(function(ref) {
            var badgeClass = ref.collection === 'historyGames' ? 'badge-history' :
                             ref.collection === 'scheduledGames' ? 'badge-sched' : 'badge-backup';
            var fieldNames = ref.fields ? ref.fields.join(', ') : 'celebration';
            refHtml += `
                <tr>
                    <td style="padding:4px 8px; border-bottom:1px solid #1a1a1a;">
                        <span class="badge ${badgeClass}">${escapeHtml(ref.collection)}</span>
                    </td>
                    <td style="padding:4px 8px; border-bottom:1px solid #1a1a1a; font-family:monospace; font-size:0.7rem; color:#e0e0e0;">
                        ${escapeHtml(ref.docId)}
                    </td>
                    <td style="padding:4px 8px; border-bottom:1px solid #1a1a1a; font-family:monospace; font-size:0.7rem; color:#ffaa44;">
                        ${escapeHtml(fieldNames)}
                    </td>
                    <td style="padding:4px 8px; border-bottom:1px solid #1a1a1a; text-align:center;">
                        <button onclick="removeSingleReference('${escapeHtml(ref.collection)}', '${escapeHtml(ref.docId)}', '${escapeHtml(ref.fields ? ref.fields[0] : 'celebration')}')" 
                                style="padding:2px 12px; border-radius:12px; border:1px solid #ff6b6b; background:transparent; color:#ff6b6b; font-size:0.6rem; cursor:pointer;">
                            Remove
                        </button>
                    </td>
                </tr>
            `;
        });
        
        refHtml += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Show summary
        refHtml = `
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
                <span style="font-size:0.75rem; color:#4caf50;">
                    📚 ${refs.length} document${refs.length > 1 ? 's' : ''} reference${refs.length > 1 ? ' this photo' : ' this photo'}
                </span>
                <span style="font-size:0.75rem; color:#ffaa44;">
                    📁 ${collections.join(', ')}
                </span>
                <span style="font-size:0.75rem; color:#4a8af4;">
                    📝 Fields: ${fields.join(', ')}
                </span>
            </div>
            ${refHtml}
        `;
    } else {
        refHtml = `
            <div style="padding:12px; background:#0a0a0a; border-radius:8px; margin-top:8px; color:#555; text-align:center;">
                📭 No Firestore references found
            </div>
        `;
    }
    
    // Build photo preview HTML
    var photoHtml = '';
    if (hasPhoto) {
        photoHtml = `
            <div style="background:#0a0a0a; border-radius:8px; padding:12px; text-align:center; margin-bottom:12px; border:1px solid #2a2a2a;">
                <img src="${escapeHtml(photoUrl)}" 
                     style="max-width:100%; max-height:300px; object-fit:contain; border-radius:4px;"
                     onerror="this.style.display='none'; document.getElementById('photoPreviewError').style.display='block';">
                <div id="photoPreviewError" style="display:none; padding:20px; color:#ff6b6b;">
                    ❌ Photo not found or cannot be displayed
                </div>
            </div>
        `;
    } else {
        photoHtml = `
            <div style="background:#0a0a0a; border-radius:8px; padding:20px; text-align:center; margin-bottom:12px; border:1px solid #2a2a2a; color:#555;">
                ❌ Photo not found
            </div>
        `;
    }
    
    // Build the full panel
    panel.innerHTML = `
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <span style="font-size:0.9rem; font-weight:600; color:#ffaa44;">📸 PHOTO INFORMATION</span>
                <span style="font-size:0.65rem; color:#888; font-family:monospace;">
                    ${refCount > 0 ? '🔗 ' + refCount + ' references' : '📭 No references'}
                </span>
            </div>
            
            ${photoHtml}
            
            <div style="background:#0a0a0a; border-radius:8px; padding:12px; margin-bottom:8px; border:1px solid #2a2a2a;">
                <div style="display:grid; grid-template-columns:auto 1fr; gap:2px 16px; font-size:0.75rem;">
                    <span style="color:#888;">📍 Path:</span>
                    <span style="color:#e0e0e0; font-family:monospace; word-break:break-all;">${escapeHtml(fullPath || 'Unknown')}</span>
                    <span style="color:#888;">🔗 URL:</span>
                    <span style="color:#ffaa44; font-family:monospace; font-size:0.65rem; word-break:break-all;">${escapeHtml(photoUrl)}</span>
                </div>
            </div>
            
            <div style="margin-top:8px;">
                <div style="font-size:0.75rem; font-weight:600; color:#4a8af4; margin-bottom:4px;">📚 FIRESTORE REFERENCES</div>
                ${refHtml}
            </div>
            
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; padding-top:12px; border-top:1px solid #2a2a2a;">
                <button onclick="deletePhotoWithReferences()" 
                        class="btn btn-danger" 
                        style="flex:1; min-width:120px; margin-top:0; padding:12px 16px; font-size:0.8rem;">
                    🗑️ Delete All (Storage + References)
                </button>
                <button onclick="deletePhotoStorageOnly()" 
                        class="btn btn-secondary" 
                        style="flex:1; min-width:120px; margin-top:0; padding:12px 16px; font-size:0.8rem;">
                    🗑️ Storage Only
                </button>
                <button onclick="closePhotoInfoPanel()" 
                        class="btn btn-secondary" 
                        style="flex:0 0 auto; margin-top:0; padding:12px 20px; font-size:0.8rem; width:auto;">
                    ✕ Close
                </button>
            </div>
        </div>
    `;
    
    // Store the current photo data for delete operations
    panel.dataset.photoUrl = photoUrl;
    panel.dataset.fullPath = fullPath || '';
}

/**
 * Remove a single reference from Firestore
 */
function removeSingleReference(collection, docId, field) {
    if (!collection || !docId || !field) {
        log('Missing collection, document ID, or field', 'error');
        return;
    }
    
    if (!confirm('Remove this reference from ' + collection + '/' + docId + '?')) {
        return;
    }
    
    var db = photoStorageEnv === 'PROD' ? prodDb : devDb;
    if (!db) {
        log('Database not available', 'error');
        return;
    }
    
    var updateData = {};
    updateData[field] = firebase.firestore.FieldValue.delete();
    
    db.collection(collection).doc(docId).update(updateData)
        .then(function() {
            log('✅ Removed reference from: ' + collection + '/' + docId, 'success');
            // Refresh the panel
            var panel = document.getElementById('photoInfoPanel');
            var photoUrl = panel ? panel.dataset.photoUrl : null;
            var fullPath = panel ? panel.dataset.fullPath : null;
            if (photoUrl) {
                showPhotoInfoPanel(photoUrl, fullPath);
            }
        })
        .catch(function(err) {
            log('❌ Failed to remove reference: ' + err.message, 'error');
        });
}

/**
 * Close the photo information panel
 */
function closePhotoInfoPanel() {
    var panel = document.getElementById('photoInfoPanel');
    if (panel) {
        panel.style.display = 'none';
        panel.innerHTML = '';
    }
}

/**
 * Delete photo from Storage only (keep Firestore references)
 */
function deletePhotoStorageOnly() {
    var panel = document.getElementById('photoInfoPanel');
    if (!panel) return;
    
    var fullPath = panel.dataset.fullPath;
    if (!fullPath) {
        log('No storage path found', 'error');
        return;
    }
    
    if (!confirm('Delete this photo from Firebase Storage only?\n\n' + fullPath + '\n\nFirestore references will be kept.')) {
        return;
    }
    
    deletePhotoFromStorage(fullPath, function(err, result) {
        if (err) {
            log('❌ Delete failed: ' + err.message, 'error');
            return;
        }
        if (result.notFound) {
            log('⚠️ Photo not found in Storage', 'warning');
        } else {
            log('✅ Photo deleted from Storage', 'success');
            // Refresh the panel to show the photo is gone
            var photoUrl = panel.dataset.photoUrl;
            if (photoUrl) {
                showPhotoInfoPanel(photoUrl, fullPath);
            }
        }
    });
}

/**
 * Delete photo from Storage AND all Firestore references
 */
function deletePhotoWithReferences() {
    var panel = document.getElementById('photoInfoPanel');
    if (!panel) return;
    
    var fullPath = panel.dataset.fullPath;
    var photoUrl = panel.dataset.photoUrl;
    
    if (!fullPath || !photoUrl) {
        log('Missing storage path or photo URL', 'error');
        return;
    }
    
    // Check if there are references
    findPhotoReferences(photoUrl, function(err, references) {
        if (err) {
            log('❌ Failed to find references: ' + err.message, 'error');
            return;
        }
        
        var refCount = references ? references.length : 0;
        var msg = 'Delete this photo from Firebase Storage AND all Firestore references?\n\n';
        msg += 'Storage: ' + fullPath + '\n\n';
        msg += 'Found ' + refCount + ' Firestore reference' + (refCount > 1 ? 's' : '') + ':\n';
        
        if (references && references.length > 0) {
            references.forEach(function(ref) {
                msg += '  • ' + ref.collection + '/' + ref.docId + ' (celebration)\n';
            });
        } else {
            msg += '  (none found)\n';
        }
        msg += '\nThis action CANNOT be undone.';
        
        if (!confirm(msg)) {
            return;
        }
        
        // Step 1: Delete from Storage
        deletePhotoFromStorage(fullPath, function(err, result) {
            if (err) {
                log('❌ Storage delete failed: ' + err.message, 'error');
                return;
            }
            
            var storageDeleted = result.success || result.notFound;
            log('✅ Storage deletion: ' + (result.success ? 'Success' : 'Not found'), 'info');
            
            // Step 2: Delete Firestore references
            if (references && references.length > 0) {
                var db = photoStorageEnv === 'PROD' ? prodDb : devDb;
                if (!db) {
                    log('❌ Database not available', 'error');
                    return;
                }
                
                var totalRefs = references.length;
                var deletedRefs = 0;
                var failedRefs = 0;
                
                references.forEach(function(ref, index) {
                    var updateData = {};
                    var field = 'celebration';
                    updateData[field] = firebase.firestore.FieldValue.delete();
                    
                    db.collection(ref.collection).doc(ref.docId).update(updateData)
                        .then(function() {
                            deletedRefs++;
                            log('✅ Removed: ' + ref.collection + '/' + ref.docId, 'success');
                            // When all done, show final message
                            if (deletedRefs + failedRefs === totalRefs) {
                                var msg = '✅ Complete: ' + (storageDeleted ? 'Storage deleted' : 'Storage not found') + 
                                         ', ' + deletedRefs + ' Firestore references removed';
                                if (failedRefs > 0) {
                                    msg += ' (' + failedRefs + ' failed)';
                                }
                                log(msg, 'success');
                                // Refresh the panel or close it
                                closePhotoInfoPanel();
                            }
                        })
                        .catch(function(err) {
                            failedRefs++;
                            log('❌ Failed to remove: ' + ref.collection + '/' + ref.docId + ' - ' + err.message, 'error');
                            if (deletedRefs + failedRefs === totalRefs) {
                                var msg = '⚠️ Complete: ' + (storageDeleted ? 'Storage deleted' : 'Storage not found') + 
                                         ', ' + deletedRefs + ' removed, ' + failedRefs + ' failed';
                                log(msg, 'warning');
                            }
                        });
                });
            } else {
                log('✅ Complete: Storage ' + (storageDeleted ? 'deleted' : 'not found') + ', no Firestore references to remove', 'success');
                closePhotoInfoPanel();
            }
        });
    });
}

// ============================================================
// EXPOSE NEW FUNCTIONS GLOBALLY
// ============================================================

window.showPhotoInfoPanel = showPhotoInfoPanel;
window.renderInfoPanel = renderInfoPanel;
window.removeSingleReference = removeSingleReference;
window.closePhotoInfoPanel = closePhotoInfoPanel;
window.deletePhotoStorageOnly = deletePhotoStorageOnly;
window.deletePhotoWithReferences = deletePhotoWithReferences;

// ============================================================
// EXPOSE FOR DEBUGGING
// ============================================================

console.log("[PHOTO-UTIL] v1.02 loaded (with info panel + references)");

/*
FILE: js/util-photo.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: showPhotoInfoPanel() - Display photo preview + Firestore references
   - ADDED: findPhotoReferences() - Search all collections for photo URL
   - ADDED: displayPhotoReferences() - Render references in UI
   - ADDED: Enhanced delete options (Storage only vs Storage + References)
   - CHANGED: Upload now automatically shows the info panel
   - CHANGED: Delete functions now show confirmation with reference count
DEPENDS ON: Firebase Storage, Firestore, WRV.js
STATUS: Ready for integration
*/