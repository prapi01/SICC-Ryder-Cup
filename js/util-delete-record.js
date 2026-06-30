/*
FILE: js/util-delete-record.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - FIXED: "too much recursion" error in delete tab rendering
   - FIXED: toggleDeleteCheckbox was causing infinite loop when clicking row
   - CHANGED: Row click now uses event.stopPropagation() to prevent checkbox event from triggering row click again
   - CHANGED: toggleDeleteCheckbox now directly manipulates checkbox without re-triggering events
   - PRESERVED: All existing functionality from v1.05 (Load ALL records, Select All, Bulk Delete)
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_DELETE_VERSION = "1.06";
console.log("[UTIL-DELETE] Initializing v1.06 - Fixed recursion error");

// ============================================================
// STATE VARIABLES
// ============================================================

var deleteRecords = [];
var deleteSelectedIds = {};
var deleteEnv = 'PROD';
var deleteCurrentCollection = 'scheduledGames';

// ============================================================
// LOGGING (with fallback)
// ============================================================

function deleteLog(message, type) {
    if (typeof window.log === 'function') {
        window.log(message, type);
    } else {
        console.log('[DELETE] ' + message);
    }
}

// ============================================================
// LOAD DELETE RECORDS - Loads ALL records
// ============================================================

function loadDeleteRecords() {
    var collection = document.getElementById('deleteCollection');
    var indicator = document.getElementById('deleteIndicator');
    
    if (!collection || !indicator) return;
    
    var collectionName = collection.value;
    var envText = indicator.textContent || 'PROD';
    var db = envText === 'PROD' ? window.prodDb : window.devDb;
    
    deleteCurrentCollection = collectionName;
    
    if (!db) {
        deleteLog('Select an environment first (PROD/DEV)', 'error');
        return;
    }
    
    var container = document.getElementById('deleteRecordsContainer');
    var countSpan = document.getElementById('deleteCount');
    var executeBtn = document.getElementById('deleteExecuteBtn');
    
    if (container) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">⏳ Loading records...</div>';
    }
    if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = '🗑️ DELETE SELECTED (0 records)';
    }
    
    deleteLog('Loading records from: ' + collectionName + ' (' + envText + ')', 'info');
    
    // Load ALL records (no orderBy filter)
    db.collection(collectionName).get()
        .then(function(snapshot) {
            deleteRecords = [];
            deleteSelectedIds = {};
            
            if (snapshot.empty) {
                if (container) {
                    container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">📭 No records found in ' + collectionName + '</div>';
                }
                if (countSpan) {
                    countSpan.textContent = '0 found';
                }
                if (executeBtn) {
                    executeBtn.disabled = true;
                    executeBtn.textContent = '🗑️ DELETE SELECTED (0 records)';
                }
                deleteLog('No records found in ' + collectionName, 'info');
                updateDeleteSelectedCount();
                return;
            }
            
            // Collect all records
            var docs = [];
            snapshot.forEach(function(doc) {
                docs.push(doc);
            });
            
            // Sort manually by date (with fallback for missing dates)
            docs.sort(function(a, b) {
                var dataA = a.data();
                var dataB = b.data();
                var dateA = dataA.date || dataA.gameInfo?.date || '1970-01-01';
                var dateB = dataB.date || dataB.gameInfo?.date || '1970-01-01';
                return dateB.localeCompare(dateA);
            });
            
            deleteRecords = docs;
            
            // Render the table
            renderDeleteTable(docs);
            
            if (countSpan) {
                countSpan.textContent = docs.length + ' found';
            }
            
            deleteLog('Loaded ' + docs.length + ' records from ' + collectionName, 'success');
            updateDeleteSelectedCount();
        })
        .catch(function(err) {
            deleteLog('Error loading records: ' + err.message, 'error');
            if (container) {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:#ff6b6b;">❌ Error loading records: ' + err.message + '</div>';
            }
            if (countSpan) {
                countSpan.textContent = 'Error';
            }
        });
}

// ============================================================
// RENDER DELETE TABLE
// ============================================================

function renderDeleteTable(docs) {
    var container = document.getElementById('deleteRecordsContainer');
    if (!container) return;
    
    if (!docs || docs.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">📭 No records found</div>';
        return;
    }
    
    var html = '<table><thead><tr>';
    html += '<th style="width:32px; text-align:center;">';
    html += '<input type="checkbox" id="deleteSelectAll" onchange="toggleAllDeleteCheckboxes()" style="width:16px;height:16px;accent-color:#4caf50;cursor:pointer;">';
    html += '</th>';
    html += '<th style="text-align:left;">Course</th>';
    html += '<th style="text-align:left;">Date</th>';
    html += '<th style="text-align:left;">Status</th>';
    html += '<th style="text-align:left; word-break:break-all;">ID</th>';
    html += '</tr></thead><tbody>';
    
    for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var data = doc.data();
        var id = doc.id;
        
        var courseName = data.gameInfo?.course?.name || data.course?.name || 'Unknown';
        var date = data.date || data.gameInfo?.date || 'No date';
        var status = data.status || 'unknown';
        
        var statusClass = status === 'completed' ? 'completed' : 
                         status === 'in_progress' ? 'in-progress' : 
                         status === 'scheduled' ? 'scheduled' : 'unknown';
        
        // Format date for display
        var displayDate = date;
        if (date !== 'No date' && date !== 'MISSING') {
            var parts = date.split('-');
            if (parts.length === 3) {
                var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                displayDate = parts[2] + ' ' + months[parseInt(parts[1]) - 1] + ' ' + parts[0];
            }
        }
        
        var isChecked = deleteSelectedIds[id] || false;
        
        // FIXED: Use a data attribute and a separate click handler instead of inline onclick
        html += '<tr data-id="' + id + '" class="delete-row" style="cursor:pointer;">';
        html += '<td style="text-align:center; vertical-align:middle;">';
        html += '<input type="checkbox" class="delete-checkbox" data-id="' + id + '" ' + (isChecked ? 'checked' : '') + ' onchange="onDeleteCheckboxChange()" style="width:16px;height:16px;accent-color:#4caf50;cursor:pointer;">';
        html += '</td>';
        html += '<td style="color:#e0e0e0;">' + escapeHtml(courseName) + '</td>';
        html += '<td style="color:#ccc;">' + escapeHtml(displayDate) + '</td>';
        html += '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(status) + '</span></td>';
        html += '<td style="color:#4a8af4; font-family:monospace; font-size:0.65rem; word-break:break-all;">' + escapeHtml(id) + '</td>';
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    // FIXED: Attach row click event listeners after rendering (prevents recursion)
    var rows = container.querySelectorAll('.delete-row');
    rows.forEach(function(row) {
        row.addEventListener('click', function(e) {
            // Ignore clicks on the checkbox itself (handled by onchange)
            if (e.target.type === 'checkbox') {
                return;
            }
            var id = this.getAttribute('data-id');
            toggleDeleteCheckbox(id);
        });
    });
}

// ============================================================
// TOGGLE FUNCTIONS
// ============================================================

function toggleDeleteCheckbox(id) {
    var checkbox = document.querySelector('.delete-checkbox[data-id="' + id + '"]');
    if (checkbox) {
        // Toggle without triggering additional events
        checkbox.checked = !checkbox.checked;
        // Manually trigger the change handler
        onDeleteCheckboxChange();
    }
}

function onDeleteCheckboxChange() {
    var checkboxes = document.querySelectorAll('.delete-checkbox');
    var anyChecked = false;
    
    checkboxes.forEach(function(cb) {
        var id = cb.getAttribute('data-id');
        if (cb.checked) {
            deleteSelectedIds[id] = true;
            anyChecked = true;
        } else {
            deleteSelectedIds[id] = false;
        }
    });
    
    // Update the select all checkbox
    var selectAll = document.getElementById('deleteSelectAll');
    if (selectAll) {
        var allChecked = checkboxes.length > 0 && 
                        Array.from(checkboxes).every(function(cb) { return cb.checked; });
        selectAll.checked = allChecked;
    }
    
    updateDeleteSelectedCount();
}

function toggleAllDeleteCheckboxes() {
    var selectAll = document.getElementById('deleteSelectAll');
    if (!selectAll) return;
    
    var checked = selectAll.checked;
    var checkboxes = document.querySelectorAll('.delete-checkbox');
    
    checkboxes.forEach(function(cb) {
        cb.checked = checked;
        var id = cb.getAttribute('data-id');
        deleteSelectedIds[id] = checked;
    });
    
    updateDeleteSelectedCount();
}

function selectAllDeleteRecords() {
    var selectAll = document.getElementById('deleteSelectAll');
    if (selectAll) {
        selectAll.checked = true;
        toggleAllDeleteCheckboxes();
    }
}

function deselectAllDeleteRecords() {
    var selectAll = document.getElementById('deleteSelectAll');
    if (selectAll) {
        selectAll.checked = false;
        toggleAllDeleteCheckboxes();
    }
}

function updateDeleteSelectedCount() {
    var count = 0;
    var checkboxes = document.querySelectorAll('.delete-checkbox');
    checkboxes.forEach(function(cb) {
        if (cb.checked) count++;
    });
    
    var countSpan = document.getElementById('deleteSelectedCount');
    if (countSpan) {
        countSpan.textContent = count + ' selected';
    }
    
    var executeBtn = document.getElementById('deleteExecuteBtn');
    if (executeBtn) {
        if (count > 0) {
            executeBtn.disabled = false;
            executeBtn.style.opacity = '1';
            executeBtn.textContent = '🗑️ DELETE SELECTED (' + count + ' records)';
        } else {
            executeBtn.disabled = true;
            executeBtn.style.opacity = '0.5';
            executeBtn.textContent = '🗑️ DELETE SELECTED (0 records)';
        }
    }
}

// ============================================================
// EXECUTE DELETE
// ============================================================

function executeDeleteRecords() {
    var checkboxes = document.querySelectorAll('.delete-checkbox:checked');
    if (checkboxes.length === 0) {
        deleteLog('No records selected for deletion', 'error');
        return;
    }
    
    var ids = [];
    checkboxes.forEach(function(cb) {
        ids.push(cb.getAttribute('data-id'));
    });
    
    var collection = document.getElementById('deleteCollection');
    var indicator = document.getElementById('deleteIndicator');
    var collectionName = collection ? collection.value : 'scheduledGames';
    var envText = indicator ? indicator.textContent : 'PROD';
    var db = envText === 'PROD' ? window.prodDb : window.devDb;
    
    if (!db) {
        deleteLog('Database not available', 'error');
        return;
    }
    
    var progressDiv = document.getElementById('deleteProgress');
    if (progressDiv) {
        progressDiv.className = 'delete-progress active';
        progressDiv.innerHTML = '<div class="step info">⏳ Preparing to delete ' + ids.length + ' records from ' + collectionName + ' (' + envText + ')...</div>';
    }
    
    deleteLog('🗑️ Deleting ' + ids.length + ' records from ' + collectionName + ' (' + envText + ')', 'warning');
    
    var deleted = 0;
    var failed = 0;
    var errors = [];
    
    function deleteNext(index) {
        if (index >= ids.length) {
            var msg = '✅ Deleted ' + deleted + ' records' + (failed > 0 ? ', ' + failed + ' failed' : '');
            deleteLog(msg, failed > 0 ? 'warning' : 'success');
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step ' + (failed > 0 ? 'warning' : 'done') + '">' + msg + '</div>';
                if (failed > 0) {
                    progressDiv.innerHTML += '<div class="step error">Errors: ' + errors.join('; ') + '</div>';
                }
            }
            loadDeleteRecords();
            return;
        }
        
        var id = ids[index];
        db.collection(collectionName).doc(id).delete()
            .then(function() {
                deleted++;
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step done">✅ Deleted: ' + id + '</div>';
                }
                deleteNext(index + 1);
            })
            .catch(function(err) {
                failed++;
                errors.push(id + ': ' + err.message);
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step error">❌ Failed: ' + id + ' - ' + err.message + '</div>';
                }
                deleteNext(index + 1);
            });
    }
    
    // Confirm before deleting
    if (typeof Modal !== 'undefined' && Modal.confirm) {
        Modal.confirm(
            '🗑️ Confirm Delete',
            'Are you sure you want to delete <strong>' + ids.length + '</strong> records from <strong>' + collectionName + '</strong> (' + envText + ')?<br><br>This action is <strong>PERMANENT</strong> and cannot be undone.',
            function() {
                deleteNext(0);
            },
            'Delete',
            'danger'
        );
    } else {
        if (confirm('Delete ' + ids.length + ' records from ' + collectionName + ' (' + envText + ')? This cannot be undone!')) {
            deleteNext(0);
        } else {
            if (progressDiv) {
                progressDiv.innerHTML = '<div class="step info">❌ Cancelled by user</div>';
            }
        }
    }
}

// ============================================================
// ENVIRONMENT SWITCHING
// ============================================================

function setDeleteEnvironment(env) {
    var prodBtn = document.getElementById('deleteProdBtn');
    var devBtn = document.getElementById('deleteDevBtn');
    var indicator = document.getElementById('deleteIndicator');
    
    if (!prodBtn || !devBtn || !indicator) return;
    
    if (env === 'PROD') {
        prodBtn.className = 'env-btn-small active-prod';
        devBtn.className = 'env-btn-small';
        indicator.textContent = 'PROD';
        indicator.className = 'env-indicator-small prod';
        deleteEnv = 'PROD';
    } else {
        prodBtn.className = 'env-btn-small';
        devBtn.className = 'env-btn-small active-dev';
        indicator.textContent = 'DEV';
        indicator.className = 'env-indicator-small dev';
        deleteEnv = 'DEV';
    }
    
    deleteLog('Delete environment set to: ' + env, 'success');
    loadDeleteRecords();
}

// ============================================================
// DELETE TAB: INFORMATION GUIDE
// ============================================================

function showDeleteInfoGuide() {
    var existing = document.querySelector('.info-overlay');
    if (existing) existing.remove();
    
    var overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <div class="info-title">🗑️ DELETE TAB - Information & Guide</div>
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✕ CLOSE</button>
            </div>
            
            <div class="info-section">
                <div class="info-section-title">🎯 What This Tab Does</div>
                <div class="info-text">
                    The <strong>DELETE</strong> tab allows you to permanently remove records from Firestore.
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>🗑️ Delete individual records by checking the checkbox</li>
                        <li>☑️ Select All / Deselect All for bulk operations</li>
                        <li>🔄 Switch between PROD and DEV environments</li>
                        <li>📂 Select collection: scheduledGames, historyGames, or backupFolder</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📖 How To Use</div>
                <ol class="info-steps">
                    <li><strong>Step 1 - Environment:</strong> Select PROD or DEV</li>
                    <li><strong>Step 2 - Collection:</strong> Choose a collection</li>
                    <li><strong>Step 3 - Select:</strong> Check individual records or click "Select All"</li>
                    <li><strong>Step 4 - Delete:</strong> Click "DELETE SELECTED" to confirm deletion</li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>PERMANENT:</strong> Deleted records cannot be recovered</li>
                    <li><strong>Backup:</strong> Consider backing up before deleting</li>
                    <li><strong>Photos:</strong> Deleting a record does NOT delete its photo from Storage</li>
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
// EVENT BINDINGS
// ============================================================

function initDeleteTabEvents() {
    var prodBtn = document.getElementById('deleteProdBtn');
    var devBtn = document.getElementById('deleteDevBtn');
    
    if (prodBtn) {
        prodBtn.onclick = function() {
            setDeleteEnvironment('PROD');
        };
    }
    
    if (devBtn) {
        devBtn.onclick = function() {
            setDeleteEnvironment('DEV');
        };
    }
    
    var refreshBtn = document.getElementById('deleteRefreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            loadDeleteRecords();
        };
    }
    
    var selectAllBtn = document.getElementById('deleteSelectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.onclick = function() {
            selectAllDeleteRecords();
        };
    }
    
    var deselectAllBtn = document.getElementById('deleteDeselectAllBtn');
    if (deselectAllBtn) {
        deselectAllBtn.onclick = function() {
            deselectAllDeleteRecords();
        };
    }
    
    var executeBtn = document.getElementById('deleteExecuteBtn');
    if (executeBtn) {
        executeBtn.onclick = function() {
            executeDeleteRecords();
        };
    }
    
    var collectionSelect = document.getElementById('deleteCollection');
    if (collectionSelect) {
        collectionSelect.onchange = function() {
            loadDeleteRecords();
        };
    }
    
    deleteLog('Delete tab event bindings initialized', 'info');
}

// ============================================================
// ESCAPE HTML HELPER
// ============================================================

function escapeHtml(str) {
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
// AUTO-INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    var indicator = document.getElementById('deleteIndicator');
    if (indicator) {
        indicator.textContent = 'PROD';
        indicator.className = 'env-indicator-small prod';
    }
    
    initDeleteTabEvents();
    
    setTimeout(function() {
        loadDeleteRecords();
    }, 300);
    
    console.log('[UTIL-DELETE] Auto-init complete');
});

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.loadDeleteRecords = loadDeleteRecords;
window.toggleDeleteCheckbox = toggleDeleteCheckbox;
window.onDeleteCheckboxChange = onDeleteCheckboxChange;
window.toggleAllDeleteCheckboxes = toggleAllDeleteCheckboxes;
window.selectAllDeleteRecords = selectAllDeleteRecords;
window.deselectAllDeleteRecords = deselectAllDeleteRecords;
window.executeDeleteRecords = executeDeleteRecords;
window.setDeleteEnvironment = setDeleteEnvironment;
window.showDeleteInfoGuide = showDeleteInfoGuide;
window.initDeleteTabEvents = initDeleteTabEvents;

console.log('[UTIL-DELETE] v1.06 loaded - Fixed recursion error');

/*
FILE: js/util-delete-record.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - FIXED: "too much recursion" error in delete tab rendering
   - FIXED: toggleDeleteCheckbox was causing infinite loop when clicking row
   - CHANGED: Row click now uses event listeners attached after rendering
   - CHANGED: toggleDeleteCheckbox now directly manipulates checkbox without re-triggering events
   - PRESERVED: All existing functionality from v1.05 (Load ALL records, Select All, Bulk Delete)
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/