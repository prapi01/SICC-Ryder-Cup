/*
FILE: js/util-copy-record.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - FIXED: loadSourceRecords() now fetches ALL records without orderBy('date')
   - FIXED: Records with missing top-level 'date' field are now included (checks gameInfo.date)
   - FIXED: Manual sorting by date with fallback for missing dates
   - FIXED: loadDestinationRecords() now fetches ALL records without orderBy('date')
   - FIXED: Destination records with missing date field are now included
   - PRESERVED: All existing functionality from v1.05
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_COPY_VERSION = "1.06";
console.log("[UTIL-COPY] Initializing v1.06");

// ============================================================
// FALLBACK HELPERS (if util-core.js not loaded)
// ============================================================

function copyLog(message, type) {
    if (typeof window.log === 'function') {
        window.log(message, type);
    } else {
        console.log('[COPY-UTIL] ' + message);
    }
}

function copyLogStep(step, message, type) {
    if (typeof window.logStep === 'function') {
        window.logStep(step, message, type);
    } else {
        console.log('[COPY-UTIL] [Step ' + step + '] ' + message);
    }
}

function copyEscapeHtml(str) {
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
// HELPERS: Get date from record (supports multiple locations)
// ============================================================

function getRecordDate(data) {
    // Check top-level date first
    if (data.date && data.date !== '') {
        return data.date;
    }
    // Check gameInfo.date
    if (data.gameInfo && data.gameInfo.date && data.gameInfo.date !== '') {
        return data.gameInfo.date;
    }
    // Check createdAt as last resort
    if (data.createdAt) {
        if (typeof data.createdAt === 'string') {
            return data.createdAt.split('T')[0];
        }
        if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
            return data.createdAt.toDate().toISOString().split('T')[0];
        }
        if (data.createdAt.seconds) {
            return new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
        }
    }
    return null;
}

// ============================================================
// SHARED STATE
// ============================================================
// prodDb, devDb are from util-core.js
// copySourceDb, copyDestDb, copySourceEnv, copyDestEnv: Copy-specific
// currentGameData, currentGameId: Source record data
// currentSourceCollection, currentDestCollection: Collection names
// destRecords: Array of destination records
// ============================================================

var copySourceDb = null;
var copyDestDb = null;
var copySourceEnv = null;
var copyDestEnv = null;
var currentGameData = null;
var currentGameId = null;
var currentSourceCollection = null;
var currentDestCollection = null;
var destRecords = [];

// ============================================================
// COPY TAB: ENVIRONMENT FUNCTIONS
// ============================================================

function setCopySourceEnvironment(env) {
    if (env === 'PROD') {
        if (!window.prodDb) {
            copyLog("Cannot connect to PRODUCTION for Source", "error");
            return;
        }
        copySourceDb = window.prodDb;
        copySourceEnv = 'PROD';
        updateCopySourceUI('PROD');
        copyLog('Source environment set to: PRODUCTION', 'info');
    } else if (env === 'DEV') {
        if (!window.devDb) {
            copyLog("Cannot connect to DEVELOPMENT for Source", "error");
            return;
        }
        copySourceDb = window.devDb;
        copySourceEnv = 'DEV';
        updateCopySourceUI('DEV');
        copyLog('Source environment set to: DEVELOPMENT', 'info');
    } else {
        copySourceDb = null;
        copySourceEnv = null;
        updateCopySourceUI(null);
    }
    
    // Load source records if source is set
    if (copySourceDb) {
        loadSourceRecords();
    }
}

function setCopyDestEnvironment(env) {
    if (env === 'PROD') {
        if (!window.prodDb) {
            copyLog("Cannot connect to PRODUCTION for Destination", "error");
            return;
        }
        copyDestDb = window.prodDb;
        copyDestEnv = 'PROD';
        updateCopyDestUI('PROD');
        copyLog('Destination environment set to: PRODUCTION', 'info');
    } else if (env === 'DEV') {
        if (!window.devDb) {
            copyLog("Cannot connect to DEVELOPMENT for Destination", "error");
            return;
        }
        copyDestDb = window.devDb;
        copyDestEnv = 'DEV';
        updateCopyDestUI('DEV');
        copyLog('Destination environment set to: DEVELOPMENT', 'info');
    } else {
        copyDestDb = null;
        copyDestEnv = null;
        updateCopyDestUI(null);
    }
    
    // Load destination records if destination is set
    if (copyDestDb) {
        loadDestinationRecords();
    }
}

function updateCopySourceUI(env) {
    var prodBtn = document.getElementById('copySourceProdBtn');
    var devBtn = document.getElementById('copySourceDevBtn');
    var indicator = document.getElementById('copySourceIndicator');
    
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

function updateCopyDestUI(env) {
    var prodBtn = document.getElementById('copyDestProdBtn');
    var devBtn = document.getElementById('copyDestDevBtn');
    var indicator = document.getElementById('copyDestIndicator');
    
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
// COPY TAB: LOAD SOURCE RECORDS (FIXED - v1.06)
// ============================================================

function loadSourceRecords() {
    if (!copySourceDb) {
        copyLog("Select Source environment first", "error");
        return;
    }
    
    var sourceCollection = document.getElementById('sourceCollection').value;
    currentSourceCollection = sourceCollection;
    
    var select = document.getElementById('gameSelect');
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    var envLabel = copySourceEnv || 'Unknown';
    copyLogStep(2, 'Loading from: ' + sourceCollection + ' (' + envLabel + ')', 'info');
    
    // v1.06: Remove orderBy('date') - fetch ALL records, sort manually
    copySourceDb.collection(sourceCollection)
        .get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select a record --</option>';
            select.disabled = false;
            
            if (snapshot.empty) {
                select.innerHTML = '<option value="">-- No records found in ' + sourceCollection + ' --</option>';
                copyLogStep(2, 'No records found in ' + sourceCollection, 'info');
                return;
            }
            
            // Collect all docs with their dates
            var docs = [];
            snapshot.forEach(function(doc) {
                var data = doc.data();
                var date = getRecordDate(data) || 'No date';
                docs.push({
                    id: doc.id,
                    data: data,
                    date: date,
                    courseName: data.course ? data.course.name : (data.gameInfo?.course?.name || 'Unknown')
                });
            });
            
            // Sort manually by date (most recent first)
            docs.sort(function(a, b) {
                if (a.date === 'No date' && b.date === 'No date') {
                    return a.id.localeCompare(b.id);
                }
                if (a.date === 'No date') return 1;
                if (b.date === 'No date') return -1;
                return b.date.localeCompare(a.date);
            });
            
            var loadedCount = 0;
            docs.forEach(function(doc) {
                var option = document.createElement('option');
                option.value = doc.id;
                var displayDate = doc.date;
                option.textContent = doc.id + ' | ' + displayDate + ' | ' + doc.courseName;
                option.dataset.date = displayDate;
                option.dataset.course = doc.courseName;
                select.appendChild(option);
                loadedCount++;
            });
            
            copyLogStep(2, 'Loaded ' + loadedCount + ' records from ' + sourceCollection + ' (' + envLabel + ')', 'success');
            
            // Log any records with missing dates
            var missingDate = docs.filter(function(d) { return d.date === 'No date'; });
            if (missingDate.length > 0) {
                copyLogStep(2, '⚠️ ' + missingDate.length + ' record(s) with missing date field found', 'warning');
                missingDate.forEach(function(d) {
                    copyLogStep(2, '  - ' + d.id, 'info');
                });
            }
        })
        .catch(function(err) {
            copyLogStep(2, 'Error loading records: ' + err.message, 'error');
            console.error(err);
            select.innerHTML = '<option value="">-- Error loading records --</option>';
            select.disabled = false;
        });
}

// ============================================================
// COPY TAB: LOAD DESTINATION RECORDS (FIXED - v1.06)
// ============================================================

function loadDestinationRecords() {
    if (!copyDestDb) {
        copyLog("Select Destination environment first", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    currentDestCollection = destCollection;
    
    var select = document.getElementById('destExistingSelect');
    var datalist = document.getElementById('destRecordsList');
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    datalist.innerHTML = '';
    
    var envLabel = copyDestEnv || 'Unknown';
    copyLogStep(2, 'Loading destination records from: ' + destCollection + ' (' + envLabel + ')', 'info');
    
    // v1.06: Remove orderBy('date') - fetch ALL records, sort manually
    copyDestDb.collection(destCollection)
        .get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select existing to REPLACE --</option>';
            select.disabled = false;
            destRecords = [];
            
            if (snapshot.empty) {
                select.innerHTML = '<option value="">-- No records found in ' + destCollection + ' --</option>';
                copyLogStep(2, 'No records found in ' + destCollection, 'info');
                return;
            }
            
            // Collect all docs with their dates
            var docs = [];
            snapshot.forEach(function(doc) {
                var data = doc.data();
                var date = getRecordDate(data) || 'No date';
                var courseName = data.course ? data.course.name : (data.gameInfo?.course?.name || 'Unknown');
                docs.push({
                    id: doc.id,
                    date: date,
                    courseName: courseName
                });
            });
            
            // Sort manually by date (most recent first)
            docs.sort(function(a, b) {
                if (a.date === 'No date' && b.date === 'No date') {
                    return a.id.localeCompare(b.id);
                }
                if (a.date === 'No date') return 1;
                if (b.date === 'No date') return -1;
                return b.date.localeCompare(a.date);
            });
            
            var loadedCount = 0;
            docs.forEach(function(doc) {
                var label = doc.id + ' | ' + doc.date + ' | ' + doc.courseName;
                
                var option = document.createElement('option');
                option.value = doc.id;
                option.textContent = label;
                select.appendChild(option);
                
                var dOption = document.createElement('option');
                dOption.value = doc.id;
                datalist.appendChild(dOption);
                
                destRecords.push({ id: doc.id, date: doc.date, course: doc.courseName });
                loadedCount++;
            });
            
            copyLogStep(2, 'Loaded ' + loadedCount + ' destination records from ' + destCollection + ' (' + envLabel + ')', 'success');
            
            // Log any records with missing dates
            var missingDate = docs.filter(function(d) { return d.date === 'No date'; });
            if (missingDate.length > 0) {
                copyLogStep(2, '⚠️ ' + missingDate.length + ' destination record(s) with missing date field found', 'warning');
            }
        })
        .catch(function(err) {
            copyLogStep(2, 'Error loading destination records: ' + err.message, 'error');
            console.error(err);
            select.innerHTML = '<option value="">-- Error loading records --</option>';
            select.disabled = false;
        });
}

// ============================================================
// COPY TAB: LOAD GAME DATA
// ============================================================

function loadGameData(gameId) {
    if (!copySourceDb || !gameId) {
        copyLog("Select a Source environment and record first", "error");
        return;
    }
    
    var sourceCollection = document.getElementById('sourceCollection').value;
    currentSourceCollection = sourceCollection;
    
    var envLabel = copySourceEnv || 'Unknown';
    copyLogStep(4, 'Loading record: ' + gameId + ' from ' + sourceCollection + ' (' + envLabel + ')', 'info');
    
    copySourceDb.collection(sourceCollection).doc(gameId).get()
        .then(function(doc) {
            if (doc.exists) {
                currentGameData = doc.data();
                currentGameId = gameId;
                displayGameInfo(currentGameData);
                copyLogStep(4, 'Record loaded: ' + gameId, 'success');
                
                var destInput = document.getElementById('destDocId');
                if (!destInput.value || destInput.value === '') {
                    destInput.value = gameId + '_COPY';
                }
            } else {
                copyLogStep(4, 'Record not found: ' + gameId, 'error');
            }
        })
        .catch(function(err) {
            copyLogStep(4, 'Error loading record: ' + err.message, 'error');
        });
}

// ============================================================
// COPY TAB: DISPLAY GAME INFO
// ============================================================

function displayGameInfo(data) {
    var infoDiv = document.getElementById('gameInfo');
    var courseName = data.course ? data.course.name : (data.gameInfo?.course?.name || 'Unknown');
    var playerCount = data.players ? data.players.length : 0;
    var startingHole = data.startingHole || 1;
    var teamGameFormat = data.teamGameFormat || 'tournament';
    var status = data.status || 'unknown';
    var gameStarted = data.gameStarted ? '✅ Yes' : '❌ No';
    
    // Get date from multiple locations
    var displayDate = getRecordDate(data) || 'Unknown';
    
    var sourceCollection = document.getElementById('sourceCollection').value;
    var badgeClass = sourceCollection === 'scheduledGames' ? 'badge-sched' : 
                     sourceCollection === 'historyGames' ? 'badge-history' : 'badge-backup';
    
    var envLabel = copySourceEnv || 'Unknown';
    var envIcon = copySourceEnv === 'PROD' ? '🔴' : (copySourceEnv === 'DEV' ? '🟡' : '⚪');
    
    infoDiv.innerHTML = `
        <div class="game-info">
            <div class="game-info-row">
                <span class="game-info-label">Source:</span>
                <span class="game-info-value"><span class="badge ${badgeClass}">${sourceCollection}</span> ${envIcon} ${envLabel}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">ID:</span>
                <span class="game-info-value gold">${copyEscapeHtml(currentGameId)}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Date:</span>
                <span class="game-info-value">${copyEscapeHtml(displayDate)}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Course:</span>
                <span class="game-info-value">${copyEscapeHtml(courseName)}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Players:</span>
                <span class="game-info-value">${playerCount}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Status:</span>
                <span class="game-info-value">${copyEscapeHtml(status)}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Game Started:</span>
                <span class="game-info-value">${gameStarted}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Starting Hole:</span>
                <span class="game-info-value">${startingHole}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Format:</span>
                <span class="game-info-value">${copyEscapeHtml(teamGameFormat)}</span>
            </div>
        </div>
    `;
    infoDiv.style.display = 'block';
}

// ============================================================
// COPY TAB: GET DATE OVERRIDE
// ============================================================

function getDateOverride() {
    var option = document.querySelector('input[name="dateOption"]:checked');
    if (!option) {
        copyLog("No date option selected", "error");
        return null;
    }
    
    var value = option.value;
    
    if (value === 'today') {
        var today = new Date().toISOString().split('T')[0];
        return { type: 'custom', value: today };
    }
    if (value === 'custom') {
        var customDate = document.getElementById('customDate').value;
        if (!customDate) {
            copyLog("Please select a custom date", "error");
            return null;
        }
        return { type: 'custom', value: customDate };
    }
    return { type: 'keep', value: null };
}

// ============================================================
// COPY TAB: COPY RECORD
// ============================================================

function copyRecord() {
    if (!copySourceDb) {
        copyLog("Select Source environment first", "error");
        return;
    }
    
    if (!copyDestDb) {
        copyLog("Select Destination environment first", "error");
        return;
    }
    
    if (!currentGameData || !currentGameId) {
        copyLog("Load a source record first", "error");
        return;
    }
    
    var destDocId = document.getElementById('destDocId').value.trim();
    if (!destDocId) {
        copyLog("Enter or select a destination document name", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    currentDestCollection = destCollection;
    var sourceCollection = document.getElementById('sourceCollection').value;
    
    var sourceEnv = copySourceEnv || 'Unknown';
    var destEnv = copyDestEnv || 'Unknown';
    
    copyLogStep(7, '=== START COPY ===', 'info');
    copyLogStep(7, 'Source: ' + sourceCollection + '/' + currentGameId + ' (' + sourceEnv + ')', 'info');
    copyLogStep(7, 'Destination: ' + destCollection + '/' + destDocId + ' (' + destEnv + ')', 'info');
    copyLogStep(7, 'Copying from ' + sourceEnv + ' to ' + destEnv, 'info');
    
    // Check if destination document already exists
    copyDestDb.collection(destCollection).doc(destDocId).get()
        .then(function(doc) {
            if (doc.exists) {
                copyLogStep(7, '⚠️ Document already exists in destination', 'info');
                
                return new Promise(function(resolve, reject) {
                    if (confirm('⚠️ Document "' + destDocId + '" already exists in ' + destCollection + ' (' + destEnv + ').\n\nREPLACE it with the source record?\n\nThis action CANNOT be undone.')) {
                        resolve();
                    } else {
                        reject(new Error('User cancelled replacement'));
                    }
                });
            }
            return Promise.resolve();
        })
        .then(function() {
            var copyData = JSON.parse(JSON.stringify(currentGameData));
            
            var dateOverride = getDateOverride();
            if (dateOverride === null) {
                copyLogStep(7, 'Date override cancelled', 'error');
                return;
            }
            
            if (dateOverride.type === 'custom') {
                var newDate = dateOverride.value;
                copyData.date = newDate;
                // Also update gameInfo.date if it exists
                if (copyData.gameInfo) {
                    copyData.gameInfo.date = newDate;
                }
                copyLogStep(7, 'Date changed to: ' + newDate, 'info');
            } else {
                // Keep original date - ensure it's set from gameInfo if top-level missing
                if (!copyData.date && copyData.gameInfo && copyData.gameInfo.date) {
                    copyData.date = copyData.gameInfo.date;
                    copyLogStep(7, 'Date copied from gameInfo.date: ' + copyData.date, 'info');
                } else {
                    copyLogStep(7, 'Date kept: ' + (copyData.date || 'Not set'), 'info');
                }
            }
            
            var playerCount = copyData.players ? copyData.players.length : 0;
            var courseName = copyData.course ? copyData.course.name : (copyData.gameInfo?.course?.name || 'Unknown');
            copyLogStep(7, 'Copying: ' + playerCount + ' players, Course: ' + courseName, 'info');
            copyLogStep(7, 'gameStarted: ' + (copyData.gameStarted ? 'true' : 'false'), 'info');
            copyLogStep(7, 'status: ' + copyData.status, 'info');
            copyLogStep(7, 'All fields preserved exactly as-is (except date if changed)', 'info');
            
            copyLogStep(7, 'Writing to ' + destCollection + '/' + destDocId + ' (' + destEnv + ')...', 'info');
            
            return copyDestDb.collection(destCollection).doc(destDocId).set(copyData);
        })
        .then(function() {
            copyLogStep(7, '✅ COPY SUCCESSFUL', 'success');
            copyLogStep(7, 'Record copied from ' + sourceEnv + ' to ' + destEnv + ': ' + destCollection + '/' + destDocId, 'success');
            
            return copyDestDb.collection(destCollection).doc(destDocId).get();
        })
        .then(function(doc) {
            if (doc.exists) {
                var verifyData = doc.data();
                var verifyDate = getRecordDate(verifyData) || 'Not set';
                copyLogStep(7, '✅ Verification: Document exists in destination (' + destEnv + ')', 'success');
                copyLogStep(7, '   Date: ' + verifyDate, 'info');
                copyLogStep(7, '   gameStarted: ' + (verifyData.gameStarted ? 'true' : 'false'), 'info');
                copyLogStep(7, '   Status: ' + verifyData.status, 'info');
            } else {
                copyLogStep(7, '⚠️ Verification: Document not found after write', 'error');
            }
            copyLogStep(7, '=== COPY COMPLETE ===', 'success');
            
            loadDestinationRecords();
        })
        .catch(function(err) {
            if (err.message === 'User cancelled replacement') {
                copyLogStep(7, 'Copy cancelled by user', 'info');
            } else {
                copyLogStep(7, '❌ COPY FAILED: ' + err.message, 'error');
                console.error(err);
            }
        });
}

// ============================================================
// COPY TAB: CHECK DESTINATION
// ============================================================

function checkDestination() {
    if (!copyDestDb) {
        copyLog("Select Destination environment first", "error");
        return;
    }
    
    var destDocId = document.getElementById('destDocId').value.trim();
    if (!destDocId) {
        copyLog("Enter a destination document name", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    var destEnv = copyDestEnv || 'Unknown';
    
    copyLogStep(7, 'Checking: ' + destCollection + '/' + destDocId + ' (' + destEnv + ')', 'info');
    
    copyDestDb.collection(destCollection).doc(destDocId).get()
        .then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                var date = getRecordDate(data) || 'Not set';
                copyLogStep(7, '✅ EXISTS in ' + destCollection + ' (' + destEnv + ')', 'success');
                copyLogStep(7, '   Date: ' + date, 'info');
                copyLogStep(7, '   Course: ' + (data.course ? data.course.name : (data.gameInfo?.course?.name || 'Unknown')), 'info');
                copyLogStep(7, '   Status: ' + data.status, 'info');
                copyLogStep(7, '   Players: ' + (data.players ? data.players.length : 0), 'info');
                copyLogStep(7, '   gameStarted: ' + (data.gameStarted ? 'true' : 'false'), 'info');
            } else {
                copyLogStep(7, '❌ NOT FOUND in ' + destCollection + ' (' + destEnv + ')', 'error');
            }
        })
        .catch(function(err) {
            copyLogStep(7, 'Error checking: ' + err.message, 'error');
        });
}

// ============================================================
// COPY TAB: DELETE DESTINATION
// ============================================================

function deleteDestination() {
    if (!copyDestDb) {
        copyLog("Select Destination environment first", "error");
        return;
    }
    
    var destDocId = document.getElementById('destDocId').value.trim();
    if (!destDocId) {
        copyLog("Enter a destination document name", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    var destEnv = copyDestEnv || 'Unknown';
    
    if (!confirm('Delete ' + destCollection + '/' + destDocId + ' from ' + destEnv + '?\n\nThis cannot be undone.')) {
        copyLogStep(7, 'Delete cancelled', 'info');
        return;
    }
    
    copyLogStep(7, 'Deleting: ' + destCollection + '/' + destDocId + ' (' + destEnv + ')', 'info');
    
    copyDestDb.collection(destCollection).doc(destDocId).delete()
        .then(function() {
            copyLogStep(7, '✅ DELETED: ' + destDocId + ' from ' + destEnv, 'success');
            loadDestinationRecords();
        })
        .catch(function(err) {
            copyLogStep(7, '❌ Delete failed: ' + err.message, 'error');
        });
}

// ============================================================
// COPY TAB: DESTINATION EXISTING SELECT HANDLER
// ============================================================

function onDestExistingSelect() {
    var selectedId = document.getElementById('destExistingSelect').value;
    if (selectedId) {
        document.getElementById('destDocId').value = selectedId;
        copyLog('Selected existing destination: ' + selectedId, 'info');
    }
}

// ============================================================
// COPY TAB: EVENT BINDINGS
// ============================================================

function initCopyTabEvents() {
    copyLog('Initializing COPY tab event bindings...', 'info');
    
    // Source environment buttons
    var sourceProdBtn = document.getElementById('copySourceProdBtn');
    var sourceDevBtn = document.getElementById('copySourceDevBtn');
    
    if (sourceProdBtn) {
        sourceProdBtn.addEventListener('click', function() {
            setCopySourceEnvironment('PROD');
        });
    }
    if (sourceDevBtn) {
        sourceDevBtn.addEventListener('click', function() {
            setCopySourceEnvironment('DEV');
        });
    }
    
    // Destination environment buttons
    var destProdBtn = document.getElementById('copyDestProdBtn');
    var destDevBtn = document.getElementById('copyDestDevBtn');
    
    if (destProdBtn) {
        destProdBtn.addEventListener('click', function() {
            setCopyDestEnvironment('PROD');
        });
    }
    if (destDevBtn) {
        destDevBtn.addEventListener('click', function() {
            setCopyDestEnvironment('DEV');
        });
    }
    
    // Load buttons
    var loadSourceBtn = document.getElementById('loadSourceBtn');
    var loadDestBtn = document.getElementById('loadDestBtn');
    
    if (loadSourceBtn) {
        loadSourceBtn.addEventListener('click', function() {
            loadSourceRecords();
        });
    }
    if (loadDestBtn) {
        loadDestBtn.addEventListener('click', function() {
            loadDestinationRecords();
        });
    }
    
    // Game select (source record dropdown)
    var gameSelect = document.getElementById('gameSelect');
    if (gameSelect) {
        gameSelect.addEventListener('change', function() {
            var gameId = this.value;
            if (gameId) {
                loadGameData(gameId);
            } else {
                currentGameData = null;
                currentGameId = null;
                var infoDiv = document.getElementById('gameInfo');
                if (infoDiv) infoDiv.style.display = 'none';
            }
        });
    }
    
    // Copy button
    var copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            copyRecord();
        });
    }
    
    // Check destination button
    var checkBtn = document.getElementById('checkBtn');
    if (checkBtn) {
        checkBtn.addEventListener('click', function() {
            checkDestination();
        });
    }
    
    // Delete destination button
    var deleteCopyDestBtn = document.getElementById('deleteCopyDestBtn');
    if (deleteCopyDestBtn) {
        deleteCopyDestBtn.addEventListener('click', function() {
            deleteDestination();
        });
    }
    
    // Date option radio buttons - show/hide custom date input
    var dateOptions = document.querySelectorAll('input[name="dateOption"]');
    var customDateInput = document.getElementById('customDate');
    
    dateOptions.forEach(function(radio) {
        radio.addEventListener('change', function() {
            if (customDateInput) {
                if (this.value === 'custom') {
                    customDateInput.style.display = 'block';
                } else {
                    customDateInput.style.display = 'none';
                }
            }
        });
    });
    
    // If custom date is initially hidden, ensure it's hidden
    if (customDateInput) {
        var checkedOption = document.querySelector('input[name="dateOption"]:checked');
        if (checkedOption && checkedOption.value !== 'custom') {
            customDateInput.style.display = 'none';
        }
    }
    
    // Destination existing select - populate destDocId
    var destExistingSelect = document.getElementById('destExistingSelect');
    if (destExistingSelect) {
        destExistingSelect.addEventListener('change', function() {
            onDestExistingSelect();
        });
    }
    
    copyLog('✅ COPY tab event bindings initialized', 'success');
}

// ============================================================
// COPY TAB: INFORMATION GUIDE
// ============================================================

function showCopyInfoGuide() {
    // Remove existing overlay if present
    var existing = document.querySelector('.info-overlay');
    if (existing) existing.remove();
    
    var overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <div class="info-title">📝 COPY TAB - Information & Guide</div>
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✕ CLOSE</button>
            </div>
            
            <div class="info-section">
                <div class="info-section-title">🎯 What This Tab Does</div>
                <div class="info-text">
                    The <strong>COPY</strong> tab allows you to copy complete game records between different 
                    collections and environments (PROD/DEV). This is useful for:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>📦 Creating backups of important records</li>
                        <li>🔄 Moving data between PROD and DEV environments</li>
                        <li>📋 Creating a copy of a record for testing or analysis</li>
                        <li>♻️ Restoring a record from backupFolder</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📖 How To Use</div>
                <ol class="info-steps">
                    <li><strong>Step 1 - Environments:</strong> Select <span class="highlight">SOURCE</span> environment (PROD/DEV) and <span class="highlight">DESTINATION</span> environment (PROD/DEV)</li>
                    <li><strong>Step 2 - Collections:</strong> Choose the source and destination collections (<code>scheduledGames</code>, <code>historyGames</code>, or <code>backupFolder</code>)</li>
                    <li><strong>Step 3 - Load Records:</strong> Click <span class="highlight">"Load Source Records"</span> to see available records in the source</li>
                    <li><strong>Step 4 - Select Record:</strong> Choose the record you want to copy from the dropdown</li>
                    <li><strong>Step 5 - Date Setting:</strong> Choose to keep the original date, set to today, or pick a custom date</li>
                    <li><strong>Step 6 - Destination ID:</strong> Enter a new document ID or select an existing one to <span class="danger-text">REPLACE</span></li>
                    <li><strong>Step 7 - Execute:</strong> Click <span class="highlight">"COPY RECORD"</span> to perform the copy</li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>REPLACEMENT WARNING:</strong> If the destination document already exists, you will be prompted to confirm REPLACEMENT. This action <strong>CANNOT</strong> be undone.</li>
                    <li><strong>Date Override:</strong> Only the date field is changed. All other fields are preserved exactly as-is.</li>
                    <li><strong>All Fields Preserved:</strong> Everything except the date is copied exactly: players, courses, results, scores, status, etc.</li>
                    <li><strong>No Original Modification:</strong> The source record is never modified. Only a copy is created.</li>
                    <li><strong>Backup Folder:</strong> Use <code>backupFolder</code> as a safe destination to preserve original data before making changes.</li>
                </ul>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📊 Collections Explained</div>
                <table class="info-table">
                    <tr><th>Collection</th><th>Description</th></tr>
                    <tr><td><span class="field-name">scheduledGames</span></td><td class="field-desc">Active/live games that are currently being played or scheduled</td></tr>
                    <tr><td><span class="field-name">historyGames</span></td><td class="field-desc">Completed games that have been finalized and archived</td></tr>
                    <tr><td><span class="field-name">backupFolder</span></td><td class="field-desc">Safe storage for backups and temporary copies (never modified by the app)</td></tr>
                </table>
            </div>
            
            <div style="text-align:center; margin-top:20px;">
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✓ OK, I understand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.setCopySourceEnvironment = setCopySourceEnvironment;
window.setCopyDestEnvironment = setCopyDestEnvironment;
window.loadSourceRecords = loadSourceRecords;
window.loadDestinationRecords = loadDestinationRecords;
window.loadGameData = loadGameData;
window.copyRecord = copyRecord;
window.checkDestination = checkDestination;
window.deleteDestination = deleteDestination;
window.onDestExistingSelect = onDestExistingSelect;
window.showCopyInfoGuide = showCopyInfoGuide;
window.initCopyTabEvents = initCopyTabEvents;

// ============================================================
// AUTO-INIT: Initialize COPY tab event bindings
// ============================================================

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            initCopyTabEvents();
        }, 100);
    });
} else {
    setTimeout(function() {
        initCopyTabEvents();
    }, 100);
}

// ============================================================
// EXPOSE FOR DEBUGGING
// ============================================================

window.COPY_UTIL_VERSION = "1.06";
console.log("[COPY-UTIL] v1.06 loaded - Fixed date handling, all records now load");

/*
FILE: js/util-copy-record.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - FIXED: loadSourceRecords() now fetches ALL records without orderBy('date')
   - FIXED: Records with missing top-level 'date' field are now included (checks gameInfo.date)
   - FIXED: Manual sorting by date with fallback for missing dates
   - FIXED: loadDestinationRecords() now fetches ALL records without orderBy('date')
   - FIXED: Destination records with missing date field are now included
   - PRESERVED: All existing functionality from v1.05
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/