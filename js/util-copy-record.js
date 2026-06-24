/*
FILE: js/util-copy-record.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: Now uses initFirebase, log, logStep, escapeHtml from main HTML
   - FIXED: Removed duplicate function definitions that conflicted with main HTML
   - FIXED: Environment functions now properly reference prodDb and devDb
   - PRESERVED: All COPY tab functionality
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, logStep, escapeHtml
STATUS: Ready for integration
*/

/*
============================================================
SHARED STATE (defined in main HTML)
============================================================
- currentDb: Firestore instance
- currentEnv: 'PROD' or 'DEV'
- currentGameData: Source record data
- currentGameId: Source record ID
- currentSourceCollection: Source collection name
- currentDestCollection: Destination collection name
- destRecords: Array of destination records
- prodDb: PROD Firestore instance
- devDb: DEV Firestore instance
============================================================
*/

// ============================================================
// ENVIRONMENT FUNCTIONS
// ============================================================

function updateEnvironmentUI(env) {
    var prodBtn = document.getElementById('envProdBtn');
    var devBtn = document.getElementById('envDevBtn');
    var envIndicator = document.getElementById('envIndicator');
    var warningDiv = document.getElementById('envWarning');
    
    prodBtn.classList.remove('env-active');
    devBtn.classList.remove('env-active');
    
    if (env === 'PROD') {
        prodBtn.classList.add('env-active');
        envIndicator.className = 'env-indicator env-indicator-prod';
        envIndicator.innerHTML = '🔴 ACTIVE: PRODUCTION';
        warningDiv.style.display = 'block';
        logStep(1, 'Connected to PRODUCTION', 'info');
    } else if (env === 'DEV') {
        devBtn.classList.add('env-active');
        envIndicator.className = 'env-indicator env-indicator-dev';
        envIndicator.innerHTML = '🟡 ACTIVE: DEVELOPMENT';
        warningDiv.style.display = 'none';
        logStep(1, 'Connected to DEVELOPMENT', 'info');
    } else {
        envIndicator.className = 'env-indicator env-indicator-none';
        envIndicator.innerHTML = '⚠️ No environment selected';
        warningDiv.style.display = 'none';
    }
}

function setEnvironment(env) {
    if (env === 'PROD') {
        if (!prodDb) {
            initFirebase();
            if (!prodDb) {
                log("Cannot connect to PRODUCTION", "error");
                return;
            }
        }
        currentDb = prodDb;
        currentEnv = 'PROD';
        updateEnvironmentUI('PROD');
    } else if (env === 'DEV') {
        if (!devDb) {
            initFirebase();
            if (!devDb) {
                log("Cannot connect to DEVELOPMENT", "error");
                return;
            }
        }
        currentDb = devDb;
        currentEnv = 'DEV';
        updateEnvironmentUI('DEV');
    } else {
        currentDb = null;
        currentEnv = null;
        updateEnvironmentUI(null);
        return;
    }
    
    // Clear previous selections
    document.getElementById('gameSelect').innerHTML = '<option value="">-- Select a record --</option>';
    document.getElementById('gameInfo').style.display = 'none';
    document.getElementById('destExistingSelect').innerHTML = '<option value="">-- Select existing to REPLACE --</option>';
    document.getElementById('destRecordsList').innerHTML = '';
    destRecords = [];
    currentGameData = null;
    currentGameId = null;
    
    // Auto-load records
    loadSourceRecords();
    loadDestinationRecords();
    
    // Also load compare records if compare tab exists
    if (typeof loadCompareRecords === 'function') {
        loadCompareRecords();
    }
}

// ============================================================
// COPY TAB: LOAD SOURCE RECORDS
// ============================================================

function loadSourceRecords() {
    if (!currentDb) {
        log("Select an environment first", "error");
        return;
    }
    
    var sourceCollection = document.getElementById('sourceCollection').value;
    currentSourceCollection = sourceCollection;
    
    var select = document.getElementById('gameSelect');
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    logStep(2, 'Loading from: ' + sourceCollection, 'info');
    
    currentDb.collection(sourceCollection)
        .orderBy('date', 'desc')
        .limit(100)
        .get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select a record --</option>';
            select.disabled = false;
            
            if (snapshot.empty) {
                select.innerHTML = '<option value="">-- No records found in ' + sourceCollection + ' --</option>';
                logStep(2, 'No records found in ' + sourceCollection, 'info');
                return;
            }
            
            snapshot.forEach(function(doc) {
                var data = doc.data();
                var option = document.createElement('option');
                option.value = doc.id;
                var displayDate = data.date || 'No date';
                var courseName = data.course ? data.course.name : 'Unknown';
                option.textContent = doc.id + ' | ' + displayDate + ' | ' + courseName;
                option.dataset.date = displayDate;
                option.dataset.course = courseName;
                select.appendChild(option);
            });
            
            logStep(2, 'Loaded ' + snapshot.size + ' records from ' + sourceCollection, 'success');
        })
        .catch(function(err) {
            logStep(2, 'Error loading records: ' + err.message, 'error');
            console.error(err);
            select.innerHTML = '<option value="">-- Error loading records --</option>';
            select.disabled = false;
        });
}

// ============================================================
// COPY TAB: LOAD DESTINATION RECORDS
// ============================================================

function loadDestinationRecords() {
    if (!currentDb) {
        log("Select an environment first", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    currentDestCollection = destCollection;
    
    var select = document.getElementById('destExistingSelect');
    var datalist = document.getElementById('destRecordsList');
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    datalist.innerHTML = '';
    
    logStep(2, 'Loading destination records from: ' + destCollection, 'info');
    
    currentDb.collection(destCollection)
        .orderBy('date', 'desc')
        .limit(100)
        .get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select existing to REPLACE --</option>';
            select.disabled = false;
            destRecords = [];
            
            if (snapshot.empty) {
                select.innerHTML = '<option value="">-- No records found in ' + destCollection + ' --</option>';
                logStep(2, 'No records found in ' + destCollection, 'info');
                return;
            }
            
            snapshot.forEach(function(doc) {
                var data = doc.data();
                var displayDate = data.date || 'No date';
                var courseName = data.course ? data.course.name : 'Unknown';
                var label = doc.id + ' | ' + displayDate + ' | ' + courseName;
                
                // Add to dropdown
                var option = document.createElement('option');
                option.value = doc.id;
                option.textContent = label;
                select.appendChild(option);
                
                // Add to datalist
                var dOption = document.createElement('option');
                dOption.value = doc.id;
                datalist.appendChild(dOption);
                
                destRecords.push({ id: doc.id, date: displayDate, course: courseName });
            });
            
            logStep(2, 'Loaded ' + snapshot.size + ' destination records from ' + destCollection, 'success');
        })
        .catch(function(err) {
            logStep(2, 'Error loading destination records: ' + err.message, 'error');
            console.error(err);
            select.innerHTML = '<option value="">-- Error loading records --</option>';
            select.disabled = false;
        });
}

// ============================================================
// COPY TAB: LOAD GAME DATA
// ============================================================

function loadGameData(gameId) {
    if (!currentDb || !gameId) {
        log("Select a record first", "error");
        return;
    }
    
    var sourceCollection = document.getElementById('sourceCollection').value;
    currentSourceCollection = sourceCollection;
    
    logStep(4, 'Loading record: ' + gameId + ' from ' + sourceCollection, 'info');
    
    currentDb.collection(sourceCollection).doc(gameId).get()
        .then(function(doc) {
            if (doc.exists) {
                currentGameData = doc.data();
                currentGameId = gameId;
                displayGameInfo(currentGameData);
                logStep(4, 'Record loaded: ' + gameId, 'success');
                
                var destInput = document.getElementById('destDocId');
                if (!destInput.value || destInput.value === '') {
                    destInput.value = gameId + '_COPY';
                }
            } else {
                logStep(4, 'Record not found: ' + gameId, 'error');
            }
        })
        .catch(function(err) {
            logStep(4, 'Error loading record: ' + err.message, 'error');
        });
}

// ============================================================
// COPY TAB: DISPLAY GAME INFO
// ============================================================

function displayGameInfo(data) {
    var infoDiv = document.getElementById('gameInfo');
    var courseName = data.course ? data.course.name : 'Unknown';
    var playerCount = data.players ? data.players.length : 0;
    var startingHole = data.startingHole || 1;
    var teamGameFormat = data.teamGameFormat || 'tournament';
    var status = data.status || 'unknown';
    var gameStarted = data.gameStarted ? '✅ Yes' : '❌ No';
    
    var sourceCollection = document.getElementById('sourceCollection').value;
    var badgeClass = sourceCollection === 'scheduledGames' ? 'badge-sched' : 
                     sourceCollection === 'historyGames' ? 'badge-history' : 'badge-backup';
    
    infoDiv.innerHTML = `
        <div class="game-info">
            <div class="game-info-row">
                <span class="game-info-label">Source:</span>
                <span class="game-info-value"><span class="badge ${badgeClass}">${sourceCollection}</span></span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">ID:</span>
                <span class="game-info-value gold">${escapeHtml(currentGameId)}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Date:</span>
                <span class="game-info-value">${escapeHtml(data.date || 'Unknown')}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Course:</span>
                <span class="game-info-value">${escapeHtml(courseName)}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Players:</span>
                <span class="game-info-value">${playerCount}</span>
            </div>
            <div class="game-info-row">
                <span class="game-info-label">Status:</span>
                <span class="game-info-value">${escapeHtml(status)}</span>
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
                <span class="game-info-value">${escapeHtml(teamGameFormat)}</span>
            </div>
        </div>
    `;
    infoDiv.style.display = 'block';
}

// ============================================================
// COPY TAB: GET DATE OVERRIDE
// ============================================================

function getDateOverride() {
    var option = document.querySelector('input[name="dateOption"]:checked').value;
    
    if (option === 'today') {
        var today = new Date().toISOString().split('T')[0];
        return { type: 'custom', value: today };
    }
    if (option === 'custom') {
        var customDate = document.getElementById('customDate').value;
        if (!customDate) {
            log("Please select a custom date", "error");
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
    if (!currentDb) {
        log("Select an environment first", "error");
        return;
    }
    
    if (!currentGameData || !currentGameId) {
        log("Load a source record first", "error");
        return;
    }
    
    var destDocId = document.getElementById('destDocId').value.trim();
    if (!destDocId) {
        log("Enter or select a destination document name", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    currentDestCollection = destCollection;
    var sourceCollection = document.getElementById('sourceCollection').value;
    
    logStep(7, '=== START COPY ===', 'info');
    logStep(7, 'Source: ' + sourceCollection + '/' + currentGameId, 'info');
    logStep(7, 'Destination: ' + destCollection + '/' + destDocId, 'info');
    logStep(7, 'Environment: ' + currentEnv, 'info');
    
    // Check if destination document already exists
    currentDb.collection(destCollection).doc(destDocId).get()
        .then(function(doc) {
            if (doc.exists) {
                logStep(7, '⚠️ Document already exists in destination', 'info');
                
                // Show confirmation dialog
                return new Promise(function(resolve, reject) {
                    if (confirm('⚠️ Document "' + destDocId + '" already exists in ' + destCollection + '.\n\nREPLACE it with the source record?\n\nThis action CANNOT be undone.')) {
                        resolve();
                    } else {
                        reject(new Error('User cancelled replacement'));
                    }
                });
            }
            return Promise.resolve();
        })
        .then(function() {
            // Proceed with copy
            var copyData = JSON.parse(JSON.stringify(currentGameData));
            
            var dateOverride = getDateOverride();
            if (dateOverride === null) {
                logStep(7, 'Date override cancelled', 'error');
                return;
            }
            
            if (dateOverride.type === 'custom') {
                var newDate = dateOverride.value;
                copyData.date = newDate;
                logStep(7, 'Date changed to: ' + newDate, 'info');
            } else {
                logStep(7, 'Date kept: ' + copyData.date, 'info');
            }
            
            var playerCount = copyData.players ? copyData.players.length : 0;
            var courseName = copyData.course ? copyData.course.name : 'Unknown';
            logStep(7, 'Copying: ' + playerCount + ' players, Course: ' + courseName, 'info');
            logStep(7, 'gameStarted: ' + (copyData.gameStarted ? 'true' : 'false'), 'info');
            logStep(7, 'status: ' + copyData.status, 'info');
            logStep(7, 'All fields preserved exactly as-is (except date if changed)', 'info');
            
            logStep(7, 'Writing to ' + destCollection + '/' + destDocId + '...', 'info');
            
            return currentDb.collection(destCollection).doc(destDocId).set(copyData);
        })
        .then(function() {
            logStep(7, '✅ COPY SUCCESSFUL', 'success');
            logStep(7, 'Record copied to: ' + destCollection + '/' + destDocId, 'success');
            
            // Verify
            return currentDb.collection(destCollection).doc(destDocId).get();
        })
        .then(function(doc) {
            if (doc.exists) {
                var verifyData = doc.data();
                logStep(7, '✅ Verification: Document exists in destination', 'success');
                logStep(7, '   Date: ' + verifyData.date, 'info');
                logStep(7, '   gameStarted: ' + (verifyData.gameStarted ? 'true' : 'false'), 'info');
                logStep(7, '   Status: ' + verifyData.status, 'info');
            } else {
                logStep(7, '⚠️ Verification: Document not found after write', 'error');
            }
            logStep(7, '=== COPY COMPLETE ===', 'success');
            
            // Refresh destination records list
            loadDestinationRecords();
        })
        .catch(function(err) {
            if (err.message === 'User cancelled replacement') {
                logStep(7, 'Copy cancelled by user', 'info');
            } else {
                logStep(7, '❌ COPY FAILED: ' + err.message, 'error');
                console.error(err);
            }
        });
}

// ============================================================
// COPY TAB: CHECK DESTINATION
// ============================================================

function checkDestination() {
    if (!currentDb) {
        log("Select an environment first", "error");
        return;
    }
    
    var destDocId = document.getElementById('destDocId').value.trim();
    if (!destDocId) {
        log("Enter a destination document name", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    
    logStep(7, 'Checking: ' + destCollection + '/' + destDocId, 'info');
    
    currentDb.collection(destCollection).doc(destDocId).get()
        .then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                logStep(7, '✅ EXISTS in ' + destCollection, 'success');
                logStep(7, '   Date: ' + data.date, 'info');
                logStep(7, '   Course: ' + (data.course ? data.course.name : 'Unknown'), 'info');
                logStep(7, '   Status: ' + data.status, 'info');
                logStep(7, '   Players: ' + (data.players ? data.players.length : 0), 'info');
                logStep(7, '   gameStarted: ' + (data.gameStarted ? 'true' : 'false'), 'info');
            } else {
                logStep(7, '❌ NOT FOUND in ' + destCollection, 'error');
            }
        })
        .catch(function(err) {
            logStep(7, 'Error checking: ' + err.message, 'error');
        });
}

// ============================================================
// COPY TAB: DELETE DESTINATION
// ============================================================

function deleteDestination() {
    if (!currentDb) {
        log("Select an environment first", "error");
        return;
    }
    
    var destDocId = document.getElementById('destDocId').value.trim();
    if (!destDocId) {
        log("Enter a destination document name", "error");
        return;
    }
    
    var destCollection = document.getElementById('destCollection').value;
    
    if (!confirm('Delete ' + destCollection + '/' + destDocId + ' from ' + currentEnv + '?\n\nThis cannot be undone.')) {
        logStep(7, 'Delete cancelled', 'info');
        return;
    }
    
    logStep(7, 'Deleting: ' + destCollection + '/' + destDocId, 'info');
    
    currentDb.collection(destCollection).doc(destDocId).delete()
        .then(function() {
            logStep(7, '✅ DELETED: ' + destDocId, 'success');
            // Refresh destination records
            loadDestinationRecords();
        })
        .catch(function(err) {
            logStep(7, '❌ Delete failed: ' + err.message, 'error');
        });
}

// ============================================================
// COPY TAB: DESTINATION EXISTING SELECT HANDLER
// ============================================================

function onDestExistingSelect() {
    var selectedId = document.getElementById('destExistingSelect').value;
    if (selectedId) {
        document.getElementById('destDocId').value = selectedId;
        log('Selected existing destination: ' + selectedId, 'info');
    }
}

// ============================================================
// EXPOSE FOR DEBUGGING
// ============================================================

window.COPY_UTIL_VERSION = "1.01";
console.log("[COPY-UTIL] v1.01 loaded");

/*
FILE: js/util-copy-record.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: Now uses initFirebase, log, logStep, escapeHtml from main HTML
   - FIXED: Removed duplicate function definitions that conflicted with main HTML
   - FIXED: Environment functions now properly reference prodDb and devDb
   - PRESERVED: All COPY tab functionality
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, logStep, escapeHtml
STATUS: Ready for integration
*/