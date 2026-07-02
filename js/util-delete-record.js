/*
FILE: js/util-delete-record.js
VERSION: 1.10
KEY CHANGES from v1.09:
   - ADDED: deviceMapping to default collections list
   - ADDED: deviceSessions to default collections list
   - ADDED: Custom collection entry option (restored from v1.08)
   - ADDED: localStorage persistence for custom collections
   - CHANGED: Fallback to known collections when REST API fails
   - PRESERVED: All existing delete functionality from v1.09
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_DELETE_VERSION = "1.10";
console.log("[UTIL-DELETE] Initializing v1.10 - Added device collections and custom entry");

// ============================================================
// STATE VARIABLES
// ============================================================

var deleteRecords = [];
var deleteSelectedIds = {};
var deleteEnv = 'PROD';
var deleteCurrentCollection = 'scheduledGames';
var deleteCollectionCache = null; // Cache for collection lists

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
// ESCAPE HTML - No recursion
// ============================================================

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================================
// v1.10: GET ALL COLLECTIONS (with fallback)
// ============================================================

function getAllCollections(projectId, apiKey) {
    return new Promise(function(resolve) {
        // v1.10: Always include these core collections
        var coreCollections = ['scheduledGames', 'historyGames', 'backupFolder', 'deviceMapping', 'deviceSessions'];
        
        // Try REST API first (but it may fail due to CORS)
        var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
        if (apiKey) {
            url += '?key=' + apiKey;
        }
        
        fetch(url)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                if (!data.documents) {
                    // No documents found - return core collections
                    resolve(coreCollections);
                    return;
                }
                
                var collections = {};
                data.documents.forEach(function(doc) {
                    var parts = doc.name.split('/documents/');
                    if (parts.length === 2) {
                        var path = parts[1];
                        var segments = path.split('/');
                        if (segments.length > 0) {
                            var collectionId = segments[0];
                            if (collectionId && !collectionId.startsWith('_') && collectionId !== '') {
                                collections[collectionId] = true;
                            }
                        }
                    }
                });
                
                // Ensure core collections are included even if empty
                coreCollections.forEach(function(c) {
                    collections[c] = true;
                });
                
                var collectionNames = Object.keys(collections).sort();
                resolve(collectionNames);
            })
            .catch(function(err) {
                // REST API failed (CORS or other) - return core collections
                deleteLog('REST API unavailable, using core collections', 'warning');
                resolve(coreCollections);
            });
    });
}

// ============================================================
// v1.10: LOAD AVAILABLE COLLECTIONS
// ============================================================

function loadAvailableCollections() {
    var indicator = document.getElementById('deleteIndicator');
    var envText = indicator ? indicator.textContent : 'PROD';
    var db = envText === 'PROD' ? window.prodDb : window.devDb;
    
    if (!db) {
        deleteLog('Select an environment first (PROD/DEV)', 'error');
        return;
    }
    
    var select = document.getElementById('deleteCollection');
    if (!select) return;
    
    // Get project ID from Firebase config
    var projectId = envText === 'PROD' ? 'sicc-ryder-cup' : 'sicc-ryder-cup-dev';
    var apiKey = envText === 'PROD' ? 'AIzaSyB-9hqHpG_Op_kxp9sj8pLs1LS261o2oc' : 'AIzaSyAw3UVNMET59rjgHNQvu_3qXUQ4RileQeQ';
    
    // Check cache first (per environment)
    if (deleteCollectionCache && deleteCollectionCache[envText]) {
        var cached = deleteCollectionCache[envText];
        if (cached.length > 0) {
            deleteLog('Using cached collections for ' + envText + ': ' + cached.length + ' found', 'info');
            populateCollectionDropdown(cached);
            return;
        }
    }
    
    deleteLog('Fetching collections from ' + envText + '...', 'info');
    
    // Store current selection to restore it
    var currentValue = select.value || 'scheduledGames';
    
    // Show loading state
    select.innerHTML = '<option value="">⏳ Loading collections...</option>';
    select.disabled = true;
    
    getAllCollections(projectId, apiKey)
        .then(function(collections) {
            // Filter out system collections
            var filtered = collections.filter(function(c) {
                if (c.startsWith('_')) return false;
                if (c === '') return false;
                return true;
            });
            
            // Ensure core collections are always present
            var coreCollections = ['scheduledGames', 'historyGames', 'backupFolder', 'deviceMapping', 'deviceSessions'];
            coreCollections.forEach(function(mc) {
                if (filtered.indexOf(mc) === -1) {
                    filtered.push(mc);
                }
            });
            
            // v1.10: Add custom collections from localStorage
            var stored = localStorage.getItem('delete_custom_collections');
            if (stored) {
                try {
                    var custom = JSON.parse(stored);
                    custom.forEach(function(c) {
                        if (filtered.indexOf(c) === -1) {
                            filtered.push(c);
                        }
                    });
                } catch(e) {}
            }
            
            // Sort: core collections first, then alphabetically
            var sorted = [];
            coreCollections.forEach(function(c) {
                if (filtered.indexOf(c) !== -1) {
                    sorted.push(c);
                }
            });
            var rest = filtered.filter(function(c) {
                return coreCollections.indexOf(c) === -1;
            }).sort();
            filtered = sorted.concat(rest);
            
            // Cache the results
            if (!deleteCollectionCache) {
                deleteCollectionCache = {};
            }
            deleteCollectionCache[envText] = filtered;
            
            populateCollectionDropdown(filtered);
        })
        .catch(function(err) {
            deleteLog('Error loading collections: ' + err.message, 'error');
            // Fallback to core collections
            var defaultCollections = ['scheduledGames', 'historyGames', 'backupFolder', 'deviceMapping', 'deviceSessions'];
            populateCollectionDropdown(defaultCollections);
        });
}

// ============================================================
// v1.10: POPULATE COLLECTION DROPDOWN (with custom entry)
// ============================================================

function populateCollectionDropdown(collections) {
    var select = document.getElementById('deleteCollection');
    if (!select) return;
    
    var currentValue = select.value || 'scheduledGames';
    
    // Build options
    var html = '';
    var hasValue = false;
    
    // v1.10: Core collections (always shown first)
    var coreCollections = ['scheduledGames', 'historyGames', 'backupFolder', 'deviceMapping', 'deviceSessions'];
    
    // Add core collections
    coreCollections.forEach(function(c) {
        if (collections.indexOf(c) !== -1) {
            var selected = (currentValue === c) ? 'selected' : '';
            if (currentValue === c) hasValue = true;
            html += '<option value="' + c + '" ' + selected + '>' + c + '</option>';
        }
    });
    
    // Add other collections (excluding core ones)
    var others = collections.filter(function(c) {
        return coreCollections.indexOf(c) === -1;
    });
    
    if (others.length > 0) {
        html += '<option disabled>──────────</option>';
        others.forEach(function(c) {
            var selected = (currentValue === c) ? 'selected' : '';
            if (currentValue === c) hasValue = true;
            html += '<option value="' + c + '" ' + selected + '>' + c + '</option>';
        });
    }
    
    // v1.10: Add custom collection option
    html += '<option disabled>──────────</option>';
    html += '<option value="__custom__" ' + (currentValue === '__custom__' ? 'selected' : '') + '>✏️ Custom Collection...</option>';
    
    select.innerHTML = html;
    select.disabled = false;
    
    // Handle custom collection selection
    select.onchange = function() {
        if (this.value === '__custom__') {
            var customName = prompt('Enter collection name:');
            if (customName && customName.trim() !== '') {
                var name = customName.trim();
                // Add to the list
                if (!deleteCollectionCache) {
                    deleteCollectionCache = {};
                }
                var envText = document.getElementById('deleteIndicator') ? document.getElementById('deleteIndicator').textContent : 'PROD';
                if (!deleteCollectionCache[envText]) {
                    deleteCollectionCache[envText] = [];
                }
                if (deleteCollectionCache[envText].indexOf(name) === -1) {
                    deleteCollectionCache[envText].push(name);
                }
                // Save to localStorage
                var stored = localStorage.getItem('delete_custom_collections');
                var customCollections = [];
                if (stored) {
                    try {
                        customCollections = JSON.parse(stored);
                    } catch(e) {}
                }
                if (customCollections.indexOf(name) === -1) {
                    customCollections.push(name);
                    localStorage.setItem('delete_custom_collections', JSON.stringify(customCollections));
                }
                // Repopulate and select
                populateCollectionDropdown(deleteCollectionCache[envText]);
                // Try to select the new collection
                var options = select.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i].value === name) {
                        select.value = name;
                        break;
                    }
                }
                // Trigger load
                loadDeleteRecords();
            } else {
                // Reset to previous selection
                var prevValue = localStorage.getItem('delete_last_collection') || 'scheduledGames';
                if (select.querySelector('option[value="' + prevValue + '"]')) {
                    select.value = prevValue;
                } else {
                    select.value = 'scheduledGames';
                }
            }
        } else {
            // Save selection
            localStorage.setItem('delete_last_collection', this.value);
            loadDeleteRecords();
        }
    };
    
    // Restore selection if possible
    if (hasValue && currentValue !== '__custom__') {
        select.value = currentValue;
    } else if (currentValue === '__custom__') {
        // Keep as is
    } else {
        // Select the first available option
        var firstOption = select.querySelector('option:not([disabled])');
        if (firstOption) {
            select.value = firstOption.value;
        }
    }
    
    // Load records for the selected collection
    var selectedValue = select.value;
    if (selectedValue && selectedValue !== '__custom__') {
        localStorage.setItem('delete_last_collection', selectedValue);
        setTimeout(function() {
            loadDeleteRecords();
        }, 100);
    }
}

// ============================================================
// LOAD DELETE RECORDS - Loads ALL records from current collection
// ============================================================

function loadDeleteRecords() {
    var select = document.getElementById('deleteCollection');
    var indicator = document.getElementById('deleteIndicator');
    
    if (!select || !indicator) return;
    
    var collectionName = select.value;
    var envText = indicator.textContent || 'PROD';
    var db = envText === 'PROD' ? window.prodDb : window.devDb;
    
    if (!collectionName || collectionName === '__custom__') {
        return;
    }
    
    deleteCurrentCollection = collectionName;
    
    if (!db) {
        deleteLog('Select an environment first (PROD/DEV)', 'error');
        return;
    }
    
    var container = document.getElementById('deleteRecordsContainer');
    var countSpan = document.getElementById('deleteCount');
    var executeBtn = document.getElementById('deleteExecuteBtn');
    
    if (container) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">⏳ Loading records from ' + collectionName + '...</div>';
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
    
    // Attach row click event listeners after rendering
    var rows = container.querySelectorAll('.delete-row');
    rows.forEach(function(row) {
        row.addEventListener('click', function(e) {
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
        checkbox.checked = !checkbox.checked;
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
    
    // Clear cache for this environment
    if (deleteCollectionCache) {
        deleteCollectionCache = {};
    }
    
    // Load collections for the new environment
    loadAvailableCollections();
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
                        <li>📂 Collections include: scheduledGames, historyGames, backupFolder, deviceMapping, deviceSessions</li>
                        <li>✏️ Add custom collections via "Custom Collection..." option</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📖 How To Use</div>
                <ol class="info-steps">
                    <li><strong>Step 1 - Environment:</strong> Select PROD or DEV</li>
                    <li><strong>Step 2 - Collection:</strong> Choose a collection from the dropdown or enter a custom one</li>
                    <li><strong>Step 3 - Select:</strong> Check individual records or click "Select All"</li>
                    <li><strong>Step 4 - Delete:</strong> Click "DELETE SELECTED" to confirm deletion</li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📂 Collections</div>
                <div class="info-text">
                    The dropdown includes:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li><strong>scheduledGames:</strong> Active/live games</li>
                        <li><strong>historyGames:</strong> Completed and archived games</li>
                        <li><strong>backupFolder:</strong> Backups created by the app</li>
                        <li><strong>deviceMapping:</strong> Device mapping records</li>
                        <li><strong>deviceSessions:</strong> Device session records</li>
                        <li><strong>Custom collections:</strong> Any collection you've added manually</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>PERMANENT:</strong> Deleted records cannot be recovered</li>
                    <li><strong>Backup:</strong> Consider backing up before deleting</li>
                    <li><strong>Photos:</strong> Deleting a record does NOT delete its photo from Storage</li>
                    <li><strong>Custom Collections:</strong> Only use if you know what you're doing</li>
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
    
    deleteLog('Delete tab event bindings initialized', 'info');
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
        // Load available collections first, which will then load records
        loadAvailableCollections();
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
window.loadAvailableCollections = loadAvailableCollections;
window.populateCollectionDropdown = populateCollectionDropdown;
window.getAllCollections = getAllCollections;

console.log('[UTIL-DELETE] v1.10 loaded - Added device collections and custom entry');

/*
FILE: js/util-delete-record.js
VERSION: 1.10
KEY CHANGES from v1.09:
   - ADDED: deviceMapping to default collections list
   - ADDED: deviceSessions to default collections list
   - ADDED: Custom collection entry option (restored from v1.08)
   - ADDED: localStorage persistence for custom collections
   - CHANGED: Fallback to known collections when REST API fails
   - PRESERVED: All existing delete functionality from v1.09
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/