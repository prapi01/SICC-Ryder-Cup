/*
FILE: js/util-validate-app.js
VERSION: 1.00
KEY CHANGES from v1.00:
   - NEW: Created as orchestration layer for VALIDATE tab
   - ADDED: loadValidateRecords() - Load records from Firestore into dropdown
   - ADDED: loadAndValidate() - Load and validate a selected record
   - ADDED: clearValidateResults() - Clear all validation display containers
   - ADDED: validateBackupOnly() - Create a backup copy of a record
   - ADDED: validateFixRecord() - Build fix preview and initiate fix process
   - ADDED: applyFixToRecord() - Apply fix payload to Firestore
   - ADDED: Event binding setup for VALIDATE tab
DEPENDS ON: util-core.js, util-validate-record.js, util-validate-ui.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_VALIDATE_APP_VERSION = "1.00";
console.log("[UTIL-VALIDATE-APP] Initializing v1.00");

// ============================================================
// STATE VARIABLES
// ============================================================

var validateRecords = [];
var validateCurrentIndex = -1;
var validateGameData = null;
var validateCurrentValidation = null;

// ============================================================
// LOGGING (with fallback)
// ============================================================

function appLog(message, type) {
    if (typeof window.log === 'function') {
        window.log(message, type);
    } else {
        console.log('[VALIDATE-APP] ' + message);
    }
}

// ============================================================
// VALIDATE TAB: LOAD RECORDS
// ============================================================

function loadValidateRecords() {
    var collection = document.getElementById('validateCollection').value;
    var indicator = document.getElementById('validateIndicator');
    var envText = indicator ? indicator.textContent : 'PROD';
    var db = envText === 'PROD' ? window.prodDb : window.devDb;
    
    if (!db) {
        appLog('Select an environment first (PROD/DEV)', 'error');
        return;
    }
    
    var select = document.getElementById('validateRecordSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    appLog('Loading records from: ' + collection + ' (' + envText + ')', 'info');
    
    db.collection(collection).orderBy('date', 'desc').limit(100).get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select a record --</option>';
            select.disabled = false;
            validateRecords = [];
            
            if (snapshot.empty) {
                select.innerHTML = '<option value="">-- No records found --</option>';
                appLog('No records found in ' + collection, 'info');
                return;
            }
            
            snapshot.forEach(function(doc) {
                var data = doc.data();
                var displayDate = data.date || 'No date';
                var courseName = data.course ? data.course.name : (data.gameInfo?.course?.name || 'Unknown');
                var status = data.status || 'unknown';
                var label = doc.id + ' | ' + displayDate + ' | ' + courseName + ' (' + status + ')';
                
                var option = document.createElement('option');
                option.value = validateRecords.length;
                option.textContent = label;
                option.dataset.id = doc.id;
                option.dataset.rawData = JSON.stringify(data);
                select.appendChild(option);
                
                validateRecords.push({
                    id: doc.id,
                    date: displayDate,
                    course: courseName,
                    status: status,
                    rawData: data
                });
            });
            
            appLog('Loaded ' + snapshot.size + ' records from ' + collection, 'success');
        })
        .catch(function(err) {
            appLog('Error loading records: ' + err.message, 'error');
            select.innerHTML = '<option value="">-- Error loading records --</option>';
            select.disabled = false;
        });
}

// ============================================================
// VALIDATE TAB: LOAD AND VALIDATE
// ============================================================

function loadAndValidate() {
    var select = document.getElementById('validateRecordSelect');
    if (!select) return;
    
    var index = parseInt(select.value);
    
    if (isNaN(index) || index < 0 || index >= validateRecords.length) {
        appLog('Select a record first', 'error');
        return;
    }
    
    var record = validateRecords[index];
    var data = record.rawData;
    data.id = record.id;
    
    validateGameData = data;
    validateCurrentIndex = index;
    
    appLog('Validating: ' + record.id, 'info');
    
    if (typeof UtilValidate === 'undefined') {
        appLog('UtilValidate not available', 'error');
        return;
    }
    
    var f1DataString = data.f1?.d || data.f1DataString || '';
    var f2DataString = data.f2?.d || data.f2DataString || '';
    
    var cleanRecord = {
        id: record.id,
        f1DataString: f1DataString,
        f2DataString: f2DataString,
        players: data.players || [],
        course: data.course || data.gameInfo?.course || {},
        gameInfo: data.gameInfo || data,
        results: data.results || {},
        status: data.status || 'unknown',
        signatures: data.signatures || { f1: { signed: false }, f2: { signed: false } },
        celebration: data.celebration || {},
        finalResults: data.finalResults || {},
        gameId: data.gameId || record.id,
        date: data.date || 'Unknown',
        createdAt: data.createdAt || null
    };
    
    var validation = UtilValidate.validateRecord(cleanRecord);
    validateCurrentValidation = validation;
    
    // Use the UI renderer
    if (typeof UtilValidateUI !== 'undefined' && typeof UtilValidateUI.renderValidateResults === 'function') {
        UtilValidateUI.renderValidateResults(cleanRecord, validation, validateGameData, validateCurrentValidation);
    } else {
        appLog('UtilValidateUI.renderValidateResults not available', 'error');
    }
    
    if (validation.valid) {
        appLog('✅ Record is valid!', 'success');
    } else {
        appLog('❌ Record needs fix: ' + validation.summary.mismatched + ' mismatches found', 'error');
    }
}

// ============================================================
// VALIDATE TAB: CLEAR RESULTS
// ============================================================

function clearValidateResults() {
    var containers = [
        'validateGameInfo',
        'validatePhotoStatus',
        'validateFlight1',
        'validateFlight2',
        'validateT1',
        'validateT2',
        'validateStrk',
        'validateMatch',
        'validateTR',
        'validateSummary',
        'validateDetails'
    ];
    
    containers.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    
    var detailsCard = document.getElementById('validateDetailsCard');
    if (detailsCard) detailsCard.style.display = 'none';
    
    var fixCard = document.getElementById('validateFixCard');
    if (fixCard) fixCard.style.display = 'none';
    
    var statusDiv = document.getElementById('validateStatus');
    if (statusDiv) statusDiv.style.display = 'none';
    
    var progressDiv = document.getElementById('validateProgress');
    if (progressDiv) {
        progressDiv.className = 'validate-progress';
        progressDiv.innerHTML = '';
    }
    
    var backupBtn = document.getElementById('validateBackupBtn');
    var fixBtn = document.getElementById('validateFixBtn');
    if (backupBtn) backupBtn.disabled = false;
    if (fixBtn) fixBtn.disabled = false;
    
    window._validatePhotoStatus = null;
    window._validateRecordId = null;
    window._validateCollection = null;
}

// ============================================================
// VALIDATE TAB: BACKUP ONLY
// ============================================================

function validateBackupOnly() {
    if (!validateGameData || !validateGameData.id) {
        appLog('Load a record first', 'error');
        return;
    }
    
    var collection = document.getElementById('validateCollection').value;
    var indicator = document.getElementById('validateIndicator');
    var envText = indicator ? indicator.textContent : 'PROD';
    var db = envText === 'PROD' ? window.prodDb : window.devDb;
    
    if (!db) {
        appLog('Database not available', 'error');
        return;
    }
    
    var recordId = validateGameData.id;
    var backupId = recordId + '_backup_' + new Date().toISOString().replace(/[:.]/g, '-');
    
    appLog('💾 Creating backup: ' + backupId, 'info');
    
    db.collection(collection).doc(recordId).get()
        .then(function(doc) {
            if (!doc.exists) {
                throw new Error('Record not found');
            }
            return db.collection('backupFolder').doc(backupId).set(doc.data());
        })
        .then(function() {
            appLog('✅ Backup created: ' + backupId, 'success');
            var statusDiv = document.getElementById('validateStatus');
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.className = 'validate-status success';
                statusDiv.innerHTML = '✅ Backup created successfully: ' + backupId;
            }
        })
        .catch(function(err) {
            appLog('❌ Backup failed: ' + err.message, 'error');
            var statusDiv = document.getElementById('validateStatus');
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.className = 'validate-status error';
                statusDiv.innerHTML = '❌ Backup failed: ' + err.message;
            }
        });
}

// ============================================================
// VALIDATE TAB: FIX RECORD
// ============================================================

function validateFixRecord() {
    if (!validateGameData || !validateGameData.id) {
        appLog('Load a record first', 'error');
        return;
    }
    
    if (!validateCurrentValidation) {
        appLog('Validate the record first', 'error');
        return;
    }
    
    if (validateCurrentValidation.valid) {
        appLog('Record is already valid. No fix needed.', 'info');
        return;
    }
    
    var recordId = validateGameData.id;
    var collection = document.getElementById('validateCollection').value;
    var indicator = document.getElementById('validateIndicator');
    var envText = indicator ? indicator.textContent : 'PROD';
    var db = envText === 'PROD' ? window.prodDb : window.devDb;
    
    if (!db) {
        appLog('Database not available', 'error');
        return;
    }
    
    if (typeof UtilValidate === 'undefined') {
        appLog('UtilValidate not available', 'error');
        return;
    }
    
    var recalculated = validateCurrentValidation.recalculated;
    var previewData = UtilValidate.buildFixPreview(validateGameData, recalculated);
    
    if (!previewData.hasChanges) {
        appLog('No changes needed', 'info');
        return;
    }
    
    if (typeof UtilValidateUI !== 'undefined' && typeof UtilValidateUI.showFixPreview === 'function') {
        UtilValidateUI.showFixPreview(
            validateGameData,
            recalculated,
            previewData,
            null,
            function() {
                applyFixToRecord(recordId, collection, db, recalculated);
            }
        );
    } else {
        appLog('UtilValidateUI.showFixPreview not available', 'error');
    }
}

// ============================================================
// VALIDATE TAB: APPLY FIX TO RECORD
// ============================================================

function applyFixToRecord(recordId, collection, db, recalculated) {
    var progressDiv = document.getElementById('validateProgress');
    if (progressDiv) {
        progressDiv.className = 'validate-progress active';
        progressDiv.innerHTML = '<div class="step info">🔄 Creating backup...</div>';
    }
    
    var backupId = recordId + '_backup_' + new Date().toISOString().replace(/[:.]/g, '-');
    
    db.collection(collection).doc(recordId).get()
        .then(function(doc) {
            if (!doc.exists) {
                throw new Error('Record not found');
            }
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step done">✅ Backup created</div>';
            }
            return db.collection('backupFolder').doc(backupId).set(doc.data());
        })
        .then(function() {
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step done">✅ Backup saved to backupFolder/' + backupId + '</div>';
                progressDiv.innerHTML += '<div class="step info">📝 Building fix payload...</div>';
            }
            
            if (typeof UtilValidate === 'undefined') {
                throw new Error('UtilValidate not available');
            }
            
            var fixResult = UtilValidate.buildFixPayload(validateGameData, recalculated);
            
            if (!fixResult.hasChanges) {
                if (progressDiv) {
                    progressDiv.innerHTML += '<div class="step warning">⚠️ No changes to apply</div>';
                }
                throw new Error('No changes to apply');
            }
            
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step info">✍️ Applying ' + fixResult.fieldsUpdated.length + ' updates...</div>';
                progressDiv.innerHTML += '<div class="step info">Fields: ' + fixResult.fieldsUpdated.join(', ') + '</div>';
            }
            
            return db.collection(collection).doc(recordId).update(fixResult.updatePayload);
        })
        .then(function() {
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step done">✅ Fix applied successfully!</div>';
            }
            appLog('✅ Record fixed: ' + recordId, 'success');
            
            setTimeout(function() {
                loadAndValidate();
            }, 1000);
        })
        .catch(function(err) {
            if (progressDiv) {
                progressDiv.innerHTML += '<div class="step error">❌ Error: ' + err.message + '</div>';
            }
            appLog('❌ Fix failed: ' + err.message, 'error');
        });
}

// ============================================================
// VALIDATE TAB: EVENT BINDINGS
// ============================================================

function initValidateTabEvents() {
    // Environment buttons
    var prodBtn = document.getElementById('validateProdBtn');
    var devBtn = document.getElementById('validateDevBtn');
    
    if (prodBtn) {
        prodBtn.onclick = function() {
            var indicator = document.getElementById('validateIndicator');
            if (indicator) {
                indicator.textContent = 'PROD';
                indicator.className = 'env-indicator-small prod';
            }
            appLog('Validate environment set to: PROD', 'success');
            loadValidateRecords();
        };
    }
    
    if (devBtn) {
        devBtn.onclick = function() {
            var indicator = document.getElementById('validateIndicator');
            if (indicator) {
                indicator.textContent = 'DEV';
                indicator.className = 'env-indicator-small dev';
            }
            appLog('Validate environment set to: DEV', 'success');
            loadValidateRecords();
        };
    }
    
    // Load and Validate button
    var loadBtn = document.getElementById('validateLoadBtn');
    if (loadBtn) {
        loadBtn.onclick = function() {
            loadAndValidate();
        };
    }
    
    // Refresh button
    var refreshBtn = document.getElementById('validateRefreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            loadValidateRecords();
        };
    }
    
    // Backup button
    var backupBtn = document.getElementById('validateBackupBtn');
    if (backupBtn) {
        backupBtn.onclick = function() {
            validateBackupOnly();
        };
    }
    
    // Fix button
    var fixBtn = document.getElementById('validateFixBtn');
    if (fixBtn) {
        fixBtn.onclick = function() {
            validateFixRecord();
        };
    }
    
    // Collection dropdown change
    var collectionSelect = document.getElementById('validateCollection');
    if (collectionSelect) {
        collectionSelect.onchange = function() {
            loadValidateRecords();
        };
    }
    
    // Record select change
    var recordSelect = document.getElementById('validateRecordSelect');
    if (recordSelect) {
        recordSelect.onchange = function() {
            var index = parseInt(this.value);
            if (!isNaN(index) && index >= 0 && index < validateRecords.length) {
                validateCurrentIndex = index;
                validateGameData = validateRecords[index].rawData;
                validateGameData.id = validateRecords[index].id;
                clearValidateResults();
                loadAndValidate();
            } else {
                validateCurrentIndex = -1;
                validateGameData = null;
                clearValidateResults();
            }
        };
    }
    
    appLog('Validate tab event bindings initialized', 'info');
}

// ============================================================
// AUTO-INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Set default environment indicator
    var indicator = document.getElementById('validateIndicator');
    if (indicator) {
        indicator.textContent = 'PROD';
        indicator.className = 'env-indicator-small prod';
    }
    
    // Initialize event bindings
    initValidateTabEvents();
    
    // Load records after a short delay
    setTimeout(function() {
        loadValidateRecords();
    }, 300);
    
    console.log('[UTIL-VALIDATE-APP] Auto-init complete');
});

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.loadValidateRecords = loadValidateRecords;
window.loadAndValidate = loadAndValidate;
window.clearValidateResults = clearValidateResults;
window.validateBackupOnly = validateBackupOnly;
window.validateFixRecord = validateFixRecord;
window.applyFixToRecord = applyFixToRecord;
window.initValidateTabEvents = initValidateTabEvents;

console.log('[UTIL-VALIDATE-APP] v1.00 loaded');

/*
FILE: js/util-validate-app.js
VERSION: 1.00
KEY CHANGES from v1.00:
   - NEW: Created as orchestration layer for VALIDATE tab
   - ADDED: loadValidateRecords() - Load records from Firestore into dropdown
   - ADDED: loadAndValidate() - Load and validate a selected record
   - ADDED: clearValidateResults() - Clear all validation display containers
   - ADDED: validateBackupOnly() - Create a backup copy of a record
   - ADDED: validateFixRecord() - Build fix preview and initiate fix process
   - ADDED: applyFixToRecord() - Apply fix payload to Firestore
   - ADDED: Event binding setup for VALIDATE tab
DEPENDS ON: util-core.js, util-validate-record.js, util-validate-ui.js
STATUS: Ready for integration
*/