/*
FILE: js/util-delete-record.js
VERSION: 1.11
KEY CHANGES from v1.10:
   - ADDED: cleanupDeviceMapping() - Purges old device records while preserving counter
   - ADDED: cleanupDeviceSessions() - Purges old session records
   - ADDED: "Cleanup" button in DELETE tab interface (added via HTML)
   - ADDED: Confirmation dialog before cleanup
   - ADDED: Progress logging during cleanup
   - ADDED: getCurrentEnvironment() helper to get env safely
   - PRESERVED: All existing functionality from v1.10
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_DELETE_VERSION = "1.11";
console.log("[UTIL-DELETE] Initializing v1.11 - Device cleanup functions");

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
// v1.11: HELPERS
// ============================================================

function getCurrentEnvironment() {
    var indicator = document.getElementById('deleteIndicator');
    return indicator ? indicator.textContent : 'PROD';
}

function getCurrentDb() {
    var envText = getCurrentEnvironment();
    return envText === 'PROD' ? window.prodDb : window.devDb;
}

// ============================================================
// v1.11: CLEANUP DEVICE MAPPING
// ============================================================

function cleanupDeviceMapping(options) {
    var db = getCurrentDb();
    var envText = getCurrentEnvironment();
    
    if (!db) {
        deleteLog('Database not available for cleanup', 'error');
        return;
    }
    
    var days = (options && options.days) || 90;
    var dryRun = (options && options.dryRun) || false;
    var cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    deleteLog('🧹 Starting deviceMapping cleanup (dryRun: ' + dryRun + ', days: ' + days + ')', 'info');
    
    var progressDiv = document.getElementById('deleteProgress');
    if (progressDiv) {
        progressDiv.className = 'delete-progress active';
        progressDiv.innerHTML = '<div class="step info">🧹 Scanning deviceMapping for records older than ' + days + ' days...</div>';
    }
    
    var toDelete = [];
    var preserved = 0;
    var skipped = 0;
    
    db.collection('deviceMapping').get()
        .then(function(snapshot) {
            if (snapshot.empty) {
                deleteLog('No deviceMapping records found', 'info');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step info">No deviceMapping records found</div>';
                }
                return;
            }
            
            var records = [];
            snapshot.forEach(function(doc) {
                var data = doc.data();
                records.push({
                    id: doc.id,
                    data: data
                });
            });
            
            // Process each record
            records.forEach(function(record) {
                // NEVER delete the counter document
                if (record.id === 'counter') {
                    preserved++;
                    return;
                }
                
                // Check if this is a device record with lastSeen
                if (record.data.lastSeen !== undefined) {
                    var lastSeen = record.data.lastSeen;
                    var lastSeenDate = new Date(lastSeen);
                    var age = Date.now() - lastSeen;
                    var ageDays = Math.floor(age / (24 * 60 * 60 * 1000));
                    
                    if (age > cutoffTime) {
                        // This device is old - mark for deletion
                        toDelete.push({
                            id: record.id,
                            shortName: record.data.shortName || record.id,
                            lastSeen: record.data.lastSeen,
                            ageDays: ageDays
                        });
                    } else {
                        skipped++;
                    }
                } else {
                    // Record doesn't have lastSeen - skip it
                    skipped++;
                }
            });
            
            if (toDelete.length === 0) {
                deleteLog('No old device records to clean up', 'success');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step done">✅ No old device records to clean up</div>';
                }
                return;
            }
            
            deleteLog('Found ' + toDelete.length + ' device records older than ' + days + ' days', 'info');
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step info">📋 Found ' + toDelete.length + ' old device records</div>';
            }
            
            // Log the records to be deleted
            toDelete.forEach(function(record) {
                deleteLog('  - ' + record.id + ' (' + record.shortName + ', ' + record.ageDays + ' days old)', 'info');
            });
            
            if (dryRun) {
                deleteLog('🧹 DRY RUN: Would delete ' + toDelete.length + ' records (counter preserved, ' + skipped + ' kept)', 'success');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step done">🧹 DRY RUN: Would delete ' + toDelete.length + ' records</div>';
                }
                return;
            }
            
            // Confirm before deletion
            if (!confirm('Delete ' + toDelete.length + ' old device records?\n\nCounter will be preserved.\nRecords with lastSeen > ' + days + ' days will be kept.')) {
                deleteLog('Cleanup cancelled by user', 'info');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step info">❌ Cleanup cancelled</div>';
                }
                return;
            }
            
            // Delete the records
            var deleted = 0;
            var failed = 0;
            var errors = [];
            
            function deleteNext(index) {
                if (index >= toDelete.length) {
                    var msg = '🧹 Cleanup complete: ' + deleted + ' deleted, ' + failed + ' failed, ' + skipped + ' kept, ' + preserved + ' preserved (counter)';
                    deleteLog(msg, failed > 0 ? 'warning' : 'success');
                    if (progressDiv) {
                        progressDiv.innerHTML += '<div class="step ' + (failed > 0 ? 'warning' : 'done') + '">' + msg + '</div>';
                        if (failed > 0) {
                            progressDiv.innerHTML += '<div class="step error">Errors: ' + errors.join('; ') + '</div>';
                        }
                    }
                    return;
                }
                
                var record = toDelete[index];
                db.collection('deviceMapping').doc(record.id).delete()
                    .then(function() {
                        deleted++;
                        if (progressDiv) {
                            progressDiv.innerHTML += '<div class="step done">✅ Deleted: ' + record.id + ' (' + record.shortName + ')</div>';
                        }
                        deleteNext(index + 1);
                    })
                    .catch(function(err) {
                        failed++;
                        errors.push(record.id + ': ' + err.message);
                        if (progressDiv) {
                            progressDiv.innerHTML += '<div class="step error">❌ Failed: ' + record.id + ' - ' + err.message + '</div>';
                        }
                        deleteNext(index + 1);
                    });
            }
            
            deleteNext(0);
        })
        .catch(function(err) {
            deleteLog('Error during deviceMapping cleanup: ' + err.message, 'error');
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step error">❌ Error: ' + err.message + '</div>';
            }
        });
}

// ============================================================
// v1.11: CLEANUP DEVICE SESSIONS
// ============================================================

function cleanupDeviceSessions(options) {
    var db = getCurrentDb();
    var envText = getCurrentEnvironment();
    
    if (!db) {
        deleteLog('Database not available for cleanup', 'error');
        return;
    }
    
    var days = (options && options.days) || 30;
    var dryRun = (options && options.dryRun) || false;
    var cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    deleteLog('🧹 Starting deviceSessions cleanup (dryRun: ' + dryRun + ', days: ' + days + ')', 'info');
    
    var progressDiv = document.getElementById('deleteProgress');
    if (progressDiv) {
        progressDiv.className = 'delete-progress active';
        progressDiv.innerHTML = '<div class="step info">🧹 Scanning deviceSessions for records older than ' + days + ' days...</div>';
    }
    
    var toDelete = [];
    var skipped = 0;
    
    db.collection('deviceSessions').get()
        .then(function(snapshot) {
            if (snapshot.empty) {
                deleteLog('No deviceSessions records found', 'info');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step info">No deviceSessions records found</div>';
                }
                return;
            }
            
            var records = [];
            snapshot.forEach(function(doc) {
                var data = doc.data();
                records.push({
                    id: doc.id,
                    data: data
                });
            });
            
            // Process each record
            records.forEach(function(record) {
                // Check if this is a session record with an expiry or timestamp
                var timestamp = null;
                
                // Check for various timestamp fields
                if (record.data.createdAt !== undefined) {
                    timestamp = record.data.createdAt;
                } else if (record.data.updatedAt !== undefined) {
                    timestamp = record.data.updatedAt;
                } else if (record.data.lastActive !== undefined) {
                    timestamp = record.data.lastActive;
                } else if (record.data.expiresAt !== undefined) {
                    timestamp = record.data.expiresAt;
                }
                
                if (timestamp !== null) {
                    var age = Date.now() - timestamp;
                    var ageDays = Math.floor(age / (24 * 60 * 60 * 1000));
                    
                    if (age > cutoffTime) {
                        // This session is old - mark for deletion
                        toDelete.push({
                            id: record.id,
                            ageDays: ageDays,
                            data: record.data
                        });
                    } else {
                        skipped++;
                    }
                } else {
                    // No timestamp found - skip it
                    skipped++;
                }
            });
            
            if (toDelete.length === 0) {
                deleteLog('No old session records to clean up', 'success');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step done">✅ No old session records to clean up</div>';
                }
                return;
            }
            
            deleteLog('Found ' + toDelete.length + ' session records older than ' + days + ' days', 'info');
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step info">📋 Found ' + toDelete.length + ' old session records</div>';
            }
            
            // Log the records to be deleted (first 10 only)
            var logCount = Math.min(toDelete.length, 10);
            for (var i = 0; i < logCount; i++) {
                var record = toDelete[i];
                deleteLog('  - ' + record.id + ' (' + record.ageDays + ' days old)', 'info');
            }
            if (toDelete.length > 10) {
                deleteLog('  ... and ' + (toDelete.length - 10) + ' more', 'info');
            }
            
            if (dryRun) {
                deleteLog('🧹 DRY RUN: Would delete ' + toDelete.length + ' session records (' + skipped + ' kept)', 'success');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step done">🧹 DRY RUN: Would delete ' + toDelete.length + ' session records</div>';
                }
                return;
            }
            
            // Confirm before deletion
            if (!confirm('Delete ' + toDelete.length + ' old session records?\n\nRecords with activity in the last ' + days + ' days will be kept.')) {
                deleteLog('Cleanup cancelled by user', 'info');
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step info">❌ Cleanup cancelled</div>';
                }
                return;
            }
            
            // Delete the records
            var deleted = 0;
            var failed = 0;
            var errors = [];
            
            function deleteNext(index) {
                if (index >= toDelete.length) {
                    var msg = '🧹 Cleanup complete: ' + deleted + ' deleted, ' + failed + ' failed, ' + skipped + ' kept';
                    deleteLog(msg, failed > 0 ? 'warning' : 'success');
                    if (progressDiv) {
                        progressDiv.innerHTML += '<div class="step ' + (failed > 0 ? 'warning' : 'done') + '">' + msg + '</div>';
                        if (failed > 0) {
                            progressDiv.innerHTML += '<div class="step error">Errors: ' + errors.join('; ') + '</div>';
                        }
                    }
                    return;
                }
                
                var record = toDelete[index];
                db.collection('deviceSessions').doc(record.id).delete()
                    .then(function() {
                        deleted++;
                        if (progressDiv) {
                            progressDiv.innerHTML += '<div class="step done">✅ Deleted session: ' + record.id + '</div>';
                        }
                        deleteNext(index + 1);
                    })
                    .catch(function(err) {
                        failed++;
                        errors.push(record.id + ': ' + err.message);
                        if (progressDiv) {
                            progressDiv.innerHTML += '<div class="step error">❌ Failed: ' + record.id + ' - ' + err.message + '</div>';
                        }
                        deleteNext(index + 1);
                    });
            }
            
            deleteNext(0);
        })
        .catch(function(err) {
            deleteLog('Error during deviceSessions cleanup: ' + err.message, 'error');
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step error">❌ Error: ' + err.message + '</div>';
            }
        });
}

// ============================================================
// v1.11: RUN FULL CLEANUP (deviceMapping + deviceSessions)
// ============================================================

function runCleanup() {
    var days = 90;
    var sessionDays = 30;
    
    deleteLog('🧹 Starting full cleanup (deviceMapping: ' + days + ' days, deviceSessions: ' + sessionDays + ' days)', 'info');
    
    // Run deviceMapping cleanup first
    cleanupDeviceMapping({ days: days, dryRun: false });
    
    // Run deviceSessions cleanup after a delay
    setTimeout(function() {
        cleanupDeviceSessions({ days: sessionDays, dryRun: false });
    }, 1000);
}

// ============================================================
// v1.11: GET ALL COLLECTIONS (with fallback)
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
                        <li>🧹 Clean up old deviceMapping and deviceSessions records</li>
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
                    <li><strong>Step 5 - Cleanup:</strong> Click "🧹 Cleanup" to remove old device records</li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">🧹 Cleanup Function</div>
                <div class="info-text">
                    The cleanup function removes old records from:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li><strong>deviceMapping:</strong> Removes devices not seen in 90 days (preserves the counter document)</li>
                        <li><strong>deviceSessions:</strong> Removes sessions older than 30 days</li>
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
                    <li><strong>Cleanup:</strong> The counter document in deviceMapping is never deleted</li>
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
    
    // v1.11: Cleanup button
    var cleanupBtn = document.getElementById('deleteCleanupBtn');
    if (cleanupBtn) {
        cleanupBtn.onclick = function() {
            runCleanup();
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
window.cleanupDeviceMapping = cleanupDeviceMapping;
window.cleanupDeviceSessions = cleanupDeviceSessions;
window.runCleanup = runCleanup;
window.getCurrentEnvironment = getCurrentEnvironment;
window.getCurrentDb = getCurrentDb;

console.log('[UTIL-DELETE] v1.11 loaded - Added device cleanup functions');

/*
FILE: js/util-delete-record.js
VERSION: 1.11
KEY CHANGES from v1.10:
   - ADDED: cleanupDeviceMapping() - Purges old device records while preserving counter
   - ADDED: cleanupDeviceSessions() - Purges old session records
   - ADDED: "Cleanup" button in DELETE tab interface (added via HTML)
   - ADDED: Confirmation dialog before cleanup
   - ADDED: Progress logging during cleanup
   - ADDED: getCurrentEnvironment() helper to get env safely
   - PRESERVED: All existing functionality from v1.10
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/