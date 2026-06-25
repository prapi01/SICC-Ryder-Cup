/*
FILE: js/util-delete-record.js
VERSION: 1.00
KEY CHANGES:
   - NEW: DELETE tab functionality for Record Management
   - Supports PROD/DEV environment selection
   - Supports multiple collections (scheduledGames, historyGames, backupFolder)
   - Loads and displays documents with Course name, Date, Status, ID
   - Allows multiple selection via checkboxes
   - Select All / Deselect All functionality
   - Delete with confirmation dialog
   - Batch delete with progress feedback
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, escapeHtml, formatDate, prodDb, devDb, getDbForEnv
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_DELETE_VERSION = "1.00";
console.log("[UTIL-DELETE] v1.00 loaded");

// ============================================================
// DELETE TAB: STATE VARIABLES
// ============================================================

var deleteDb = null;
var deleteEnv = null;
var deleteRecords = [];

// ============================================================
// DELETE TAB: ENVIRONMENT FUNCTIONS
// ============================================================

function setDeleteEnvironment(env) {
    if (env === 'PROD') {
        if (!prodDb) {
            initFirebase();
            if (!prodDb) {
                log("Cannot connect to PRODUCTION for Delete", "error");
                return;
            }
        }
        deleteDb = prodDb;
        deleteEnv = 'PROD';
        updateDeleteUI('PROD');
        log('Delete environment set to: PRODUCTION', 'info');
    } else if (env === 'DEV') {
        if (!devDb) {
            initFirebase();
            if (!devDb) {
                log("Cannot connect to DEVELOPMENT for Delete", "error");
                return;
            }
        }
        deleteDb = devDb;
        deleteEnv = 'DEV';
        updateDeleteUI('DEV');
        log('Delete environment set to: DEVELOPMENT', 'info');
    } else {
        deleteDb = null;
        deleteEnv = null;
        updateDeleteUI(null);
    }
    
    if (deleteDb) {
        loadDeleteRecords();
    }
}

function updateDeleteUI(env) {
    var prodBtn = document.getElementById('deleteProdBtn');
    var devBtn = document.getElementById('deleteDevBtn');
    var indicator = document.getElementById('deleteIndicator');
    
    if (prodBtn) prodBtn.classList.remove('active-prod');
    if (devBtn) devBtn.classList.remove('active-dev');
    
    if (env === 'PROD') {
        if (prodBtn) prodBtn.classList.add('active-prod');
        if (indicator) {
            indicator.className = 'env-indicator-small prod';
            indicator.textContent = 'PROD';
        }
    } else if (env === 'DEV') {
        if (devBtn) devBtn.classList.add('active-dev');
        if (indicator) {
            indicator.className = 'env-indicator-small dev';
            indicator.textContent = 'DEV';
        }
    } else {
        if (indicator) {
            indicator.className = 'env-indicator-small none';
            indicator.textContent = 'Not connected';
        }
    }
}

// ============================================================
// DELETE TAB: LOAD RECORDS
// ============================================================

function loadDeleteRecords() {
    if (!deleteDb) {
        log("Select Delete environment first", "error");
        return;
    }
    
    var collection = document.getElementById('deleteCollection').value;
    var container = document.getElementById('deleteRecordsContainer');
    var countEl = document.getElementById('deleteCount');
    
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Loading records...</div>';
    if (countEl) countEl.textContent = 'Loading...';
    
    var envLabel = deleteEnv || 'Unknown';
    log('Loading records from: ' + collection + ' (' + envLabel + ')', 'info');
    
    deleteDb.collection(collection)
        .orderBy('date', 'desc')
        .limit(200)
        .get()
        .then(function(snapshot) {
            deleteRecords = [];
            
            if (snapshot.empty) {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">No records found in ' + collection + '</div>';
                if (countEl) countEl.textContent = '0 found';
                log('No records found in ' + collection, 'info');
                return;
            }
            
            snapshot.forEach(function(doc) {
                var data = doc.data();
                var record = {
                    id: doc.id,
                    originalGameId: data.originalGameId || doc.id,
                    date: data.gameInfo?.date || data.date || 'Unknown',
                    courseName: data.gameInfo?.course?.name || data.course?.name || 'Unknown Course',
                    status: data.status || 'unknown',
                    rawData: data
                };
                deleteRecords.push(record);
            });
            
            renderDeleteRecords(deleteRecords);
            
            if (countEl) countEl.textContent = deleteRecords.length + ' found';
            updateDeleteSelectedCount();
            updateDeleteButtonState();
            updateSelectAllState();
            
            log('Loaded ' + deleteRecords.length + ' records from ' + collection + ' (' + envLabel + ')', 'success');
        })
        .catch(function(err) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#ff6b6b;">Error loading records: ' + escapeHtml(err.message) + '</div>';
            if (countEl) countEl.textContent = 'Error';
            log('Error loading delete records: ' + err.message, 'error');
            console.error(err);
        });
}

// ============================================================
// DELETE TAB: RENDER RECORDS
// ============================================================

function renderDeleteRecords(records) {
    var container = document.getElementById('deleteRecordsContainer');
    if (!container) return;
    
    if (!records || records.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">No records to display</div>';
        return;
    }
    
    var html = '<table>';
    html += '<thead><tr>';
    html += '<th style="width:32px; text-align:center;"><input type="checkbox" id="deleteSelectAll" onchange="toggleAllDeleteCheckboxes()" style="width:16px;height:16px;accent-color:#4caf50;cursor:pointer;"></th>';
    html += '<th style="text-align:left;">Course</th>';
    html += '<th style="text-align:left;">Date</th>';
    html += '<th style="text-align:left;">Status</th>';
    html += '<th style="text-align:left; word-break:break-all;">ID</th>';
    html += '</tr></thead><tbody>';
    
    for (var i = 0; i < records.length; i++) {
        var r = records[i];
        var statusClass = r.status === 'completed' ? 'completed' : (r.status === 'pending' ? 'pending' : 'unknown');
        html += '<tr onclick="toggleDeleteCheckbox(\'' + escapeHtml(r.id) + '\')">';
        html += '<td style="text-align:center; vertical-align:middle;">';
        html += '<input type="checkbox" class="delete-checkbox" data-id="' + escapeHtml(r.id) + '" onchange="onDeleteCheckboxChange()" style="width:16px;height:16px;accent-color:#4caf50;cursor:pointer;">';
        html += '</td>';
        html += '<td style="color:#e0e0e0;">' + escapeHtml(r.courseName) + '</td>';
        html += '<td style="color:#ccc;">' + escapeHtml(formatDate(r.date)) + '</td>';
        html += '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(r.status) + '</span></td>';
        html += '<td style="color:#4a8af4; font-family:monospace; font-size:0.65rem; word-break:break-all;">' + escapeHtml(r.id) + '</td>';
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    // Re-bind Select All after render
    var selectAll = document.getElementById('deleteSelectAll');
    if (selectAll) {
        selectAll.onchange = function() {
            toggleAllDeleteCheckboxes();
        };
    }
}

// ============================================================
// DELETE TAB: CHECKBOX HELPERS
// ============================================================

function toggleAllDeleteCheckboxes() {
    var selectAll = document.getElementById('deleteSelectAll');
    if (!selectAll) return;
    
    var checkboxes = document.querySelectorAll('.delete-checkbox');
    var isChecked = selectAll.checked;
    
    for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = isChecked;
    }
    
    updateDeleteSelectedCount();
    updateDeleteButtonState();
    updateSelectAllState();
}

function toggleDeleteCheckbox(id) {
    var checkbox = document.querySelector('.delete-checkbox[data-id="' + id + '"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        onDeleteCheckboxChange();
    }
}

function onDeleteCheckboxChange() {
    updateDeleteSelectedCount();
    updateDeleteButtonState();
    updateSelectAllState();
}

function updateDeleteSelectedCount() {
    var checkboxes = document.querySelectorAll('.delete-checkbox:checked');
    var countEl = document.getElementById('deleteSelectedCount');
    if (countEl) {
        countEl.textContent = checkboxes.length + ' selected';
    }
}

function updateDeleteButtonState() {
    var checkboxes = document.querySelectorAll('.delete-checkbox:checked');
    var deleteBtn = document.getElementById('deleteExecuteBtn');
    var count = checkboxes.length;
    
    if (!deleteBtn) return;
    
    if (count > 0) {
        deleteBtn.disabled = false;
        deleteBtn.style.opacity = '1';
        deleteBtn.textContent = '🗑️ DELETE SELECTED (' + count + ' record' + (count > 1 ? 's' : '') + ')';
    } else {
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = '0.5';
        deleteBtn.textContent = '🗑️ DELETE SELECTED (0 records)';
    }
}

function updateSelectAllState() {
    var selectAll = document.getElementById('deleteSelectAll');
    if (!selectAll) return;
    
    var checkboxes = document.querySelectorAll('.delete-checkbox');
    var checkedCount = document.querySelectorAll('.delete-checkbox:checked').length;
    
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

// ============================================================
// DELETE TAB: SELECT ALL / DESELECT ALL BUTTONS
// ============================================================

function selectAllDeleteRecords() {
    var selectAll = document.getElementById('deleteSelectAll');
    if (selectAll) {
        selectAll.checked = true;
        toggleAllDeleteCheckboxes();
    } else {
        // Fallback: manually check all
        var checkboxes = document.querySelectorAll('.delete-checkbox');
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = true;
        }
        updateDeleteSelectedCount();
        updateDeleteButtonState();
        updateSelectAllState();
    }
}

function deselectAllDeleteRecords() {
    var selectAll = document.getElementById('deleteSelectAll');
    if (selectAll) {
        selectAll.checked = false;
        toggleAllDeleteCheckboxes();
    } else {
        var checkboxes = document.querySelectorAll('.delete-checkbox');
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = false;
        }
        updateDeleteSelectedCount();
        updateDeleteButtonState();
        updateSelectAllState();
    }
}

// ============================================================
// DELETE TAB: DELETE SELECTED RECORDS
// ============================================================

function deleteSelectedRecords() {
    if (!deleteDb) {
        log("Select Delete environment first", "error");
        return;
    }
    
    var checkboxes = document.querySelectorAll('.delete-checkbox:checked');
    if (checkboxes.length === 0) {
        log("No records selected for deletion", "error");
        return;
    }
    
    var collection = document.getElementById('deleteCollection').value;
    var envLabel = deleteEnv || 'Unknown';
    
    var selectedIds = [];
    for (var i = 0; i < checkboxes.length; i++) {
        selectedIds.push(checkboxes[i].getAttribute('data-id'));
    }
    
    var confirmMsg = '🗑️ DELETE ' + selectedIds.length + ' record(s) from ' + collection + ' (' + envLabel + ')?\n\n';
    confirmMsg += 'This action CANNOT be undone.\n\n';
    confirmMsg += 'Selected IDs:\n' + selectedIds.join('\n');
    
    if (!confirm(confirmMsg)) {
        log('Delete cancelled by user', 'info');
        return;
    }
    
    var progressEl = document.getElementById('deleteProgress');
    var deleteBtn = document.getElementById('deleteExecuteBtn');
    
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '⏳ Deleting...';
    }
    if (progressEl) {
        progressEl.className = 'delete-progress active';
        progressEl.innerHTML = '';
    }
    
    var total = selectedIds.length;
    var completed = 0;
    var errors = [];
    
    log('🗑️ Deleting ' + total + ' records from ' + collection + ' (' + envLabel + ')', 'info');
    
    function deleteNext(index) {
        if (index >= selectedIds.length) {
            // All done
            var msg = '✅ Deleted ' + completed + ' record(s)';
            if (errors.length > 0) {
                msg += ', ' + errors.length + ' error(s)';
                if (progressEl) {
                    progressEl.innerHTML += '<div class="step error">⚠️ ' + errors.length + ' record(s) failed to delete</div>';
                    for (var e = 0; e < errors.length; e++) {
                        progressEl.innerHTML += '<div class="step error">  - ' + escapeHtml(errors[e]) + '</div>';
                    }
                }
            } else {
                if (progressEl) {
                    progressEl.innerHTML += '<div class="step done">✅ All ' + completed + ' records deleted successfully</div>';
                }
            }
            log(msg, errors.length > 0 ? 'warning' : 'success');
            
            if (deleteBtn) {
                deleteBtn.textContent = '✅ Done';
                deleteBtn.disabled = false;
            }
            
            // Refresh the list
            loadDeleteRecords();
            return;
        }
        
        var id = selectedIds[index];
        var logMsg = 'Deleting: ' + id + ' (' + (index + 1) + '/' + total + ')';
        if (progressEl) {
            progressEl.innerHTML += '<div class="step info">' + logMsg + '...</div>';
        }
        
        deleteDb.collection(collection).doc(id).delete()
            .then(function() {
                completed++;
                if (progressEl) {
                    progressEl.innerHTML += '<div class="step done">✅ Deleted: ' + id + '</div>';
                }
                log('Deleted: ' + id, 'success');
                deleteNext(index + 1);
            })
            .catch(function(err) {
                errors.push(id + ': ' + err.message);
                if (progressEl) {
                    progressEl.innerHTML += '<div class="step error">❌ Failed: ' + id + ' - ' + err.message + '</div>';
                }
                log('Failed to delete: ' + id + ' - ' + err.message, 'error');
                deleteNext(index + 1);
            });
    }
    
    deleteNext(0);
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.setDeleteEnvironment = setDeleteEnvironment;
window.loadDeleteRecords = loadDeleteRecords;
window.renderDeleteRecords = renderDeleteRecords;
window.toggleAllDeleteCheckboxes = toggleAllDeleteCheckboxes;
window.toggleDeleteCheckbox = toggleDeleteCheckbox;
window.onDeleteCheckboxChange = onDeleteCheckboxChange;
window.updateDeleteSelectedCount = updateDeleteSelectedCount;
window.updateDeleteButtonState = updateDeleteButtonState;
window.updateSelectAllState = updateSelectAllState;
window.selectAllDeleteRecords = selectAllDeleteRecords;
window.deselectAllDeleteRecords = deselectAllDeleteRecords;
window.deleteSelectedRecords = deleteSelectedRecords;

/*
FILE: js/util-delete-record.js
VERSION: 1.00
KEY CHANGES:
   - NEW: DELETE tab functionality for Record Management
   - Supports PROD/DEV environment selection
   - Supports multiple collections (scheduledGames, historyGames, backupFolder)
   - Loads and displays documents with Course name, Date, Status, ID
   - Allows multiple selection via checkboxes
   - Select All / Deselect All functionality
   - Delete with confirmation dialog
   - Batch delete with progress feedback
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, escapeHtml, formatDate, prodDb, devDb, getDbForEnv
STATUS: Ready for integration
*/