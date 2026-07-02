/*
FILE: js/util-validate-app.js
VERSION: 1.22
KEY CHANGES from v1.21:
   - FIXED: loadAndValidate() now re-fetches record from Firestore after fix
   - Previously it used stale cached rawData, showing incorrect mismatches
   - Now after fix, it reads fresh data from Firestore before validation
   - This ensures validation shows the correct state after fix
   - PRESERVED: All existing functionality from v1.21
DEPENDS ON: util-core.js, util-validate-record.js, util-validate-ui.js, wrv.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_VALIDATE_APP_VERSION = "1.22";
console.log("[UTIL-VALIDATE-APP] Initializing v1.22 - Fixed post-fix validation refresh");

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
// v1.21: HELPER - Generate backup document name
// Format: BK-YYMMDD-HHMM_originalRecordId
// ============================================================

function generateBackupId(originalRecordId) {
    var now = new Date();
    var y = String(now.getFullYear()).slice(-2);
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var h = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var timestamp = y + m + d + '-' + h + min;
    return 'BK-' + timestamp + '_' + originalRecordId;
}

// ============================================================
// v1.22: HELPER - Fetch fresh record from Firestore
// ============================================================

function fetchFreshRecord(recordId, collection, envText) {
    return new Promise(function(resolve, reject) {
        var db = envText === 'PROD' ? window.prodDb : window.devDb;
        if (!db) {
            reject(new Error('Database not available'));
            return;
        }
        
        db.collection(collection).doc(recordId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    reject(new Error('Record not found: ' + recordId));
                    return;
                }
                var data = doc.data();
                data.id = doc.id;
                resolve(data);
            })
            .catch(function(err) {
                reject(err);
            });
    });
}

// ============================================================
// VALIDATE TAB: LOAD RECORDS (FIXED - loads ALL records)
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
    
    // FIXED: Remove orderBy('date') - it was excluding records with undefined date
    db.collection(collection).get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select a record --</option>';
            select.disabled = false;
            validateRecords = [];
            
            if (snapshot.empty) {
                select.innerHTML = '<option value="">-- No records found --</option>';
                appLog('No records found in ' + collection, 'info');
                return;
            }
            
            // Collect all records
            var docs = [];
            snapshot.forEach(function(doc) {
                docs.push(doc);
            });
            
            // Sort manually by date (with fallback for undefined)
            docs.sort(function(a, b) {
                var dateA = a.data().date || '1970-01-01';
                var dateB = b.data().date || '1970-01-01';
                return dateB.localeCompare(dateA);
            });
            
            docs.forEach(function(doc) {
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
            
            appLog('Loaded ' + docs.length + ' records from ' + collection, 'success');
        })
        .catch(function(err) {
            appLog('Error loading records: ' + err.message, 'error');
            select.innerHTML = '<option value="">-- Error loading records --</option>';
            select.disabled = false;
        });
}

// ============================================================
// v1.22: VALIDATE TAB: LOAD AND VALIDATE (with fresh data option)
// ============================================================

function loadAndValidate(useFreshData) {
    var select = document.getElementById('validateRecordSelect');
    if (!select) return;
    
    var index = parseInt(select.value);
    
    if (isNaN(index) || index < 0 || index >= validateRecords.length) {
        appLog('Select a record first', 'error');
        return;
    }
    
    var record = validateRecords[index];
    var collection = document.getElementById('validateCollection').value;
    var indicator = document.getElementById('validateIndicator');
    var envText = indicator ? indicator.textContent : 'PROD';
    
    // v1.22: If useFreshData is true, fetch from Firestore
    if (useFreshData) {
        appLog('🔄 Fetching fresh record data from Firestore...', 'info');
        fetchFreshRecord(record.id, collection, envText)
            .then(function(freshData) {
                appLog('✅ Fresh data loaded from Firestore', 'success');
                // Update the cached rawData
                record.rawData = freshData;
                performValidation(record, freshData);
            })
            .catch(function(err) {
                appLog('❌ Failed to fetch fresh data: ' + err.message, 'error');
                // Fallback to cached data
                appLog('⚠️ Using cached data as fallback', 'warning');
                performValidation(record, record.rawData);
            });
    } else {
        // Normal flow - use cached data
        performValidation(record, record.rawData);
    }
}

// ============================================================
// v1.22: PERFORM VALIDATION (extracted from loadAndValidate)
// ============================================================

function performValidation(record, data) {
    // Ensure data has the record ID
    data.id = record.id;
    
    validateGameData = data;
    validateCurrentIndex = record.id;
    
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
        createdAt: data.createdAt || null,
        adjustedHandicaps: data.adjustedHandicaps || null,
        anchor: data.anchor || null
    };
    
    var validation = UtilValidate.validateRecord(cleanRecord);
    validateCurrentValidation = validation;
    
    if (validation.handicapValid !== undefined) {
        if (validation.handicapValid) {
            appLog('✅ Handicap data is valid', 'success');
        } else {
            var hcpMismatchCount = validation.handicapMismatches ? validation.handicapMismatches.length : 0;
            appLog('❌ Handicap data needs fix: ' + hcpMismatchCount + ' mismatches', 'error');
        }
    }
    
    // v1.08: FIXED - Use window.renderValidateResults directly
    if (typeof window.renderValidateResults === 'function') {
        window.renderValidateResults(cleanRecord, validation);
    } else {
        appLog('renderValidateResults not available', 'error');
    }
    
    if (validation.valid) {
        appLog('✅ Record is valid!', 'success');
    } else {
        var totalMismatches = validation.summary ? validation.summary.mismatched : 0;
        var hcpMismatches = validation.handicapMismatches ? validation.handicapMismatches.length : 0;
        appLog('❌ Record needs fix: ' + totalMismatches + ' field mismatches, ' + hcpMismatches + ' handicap mismatches', 'error');
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
    
    var backupBtn = document.getElementById('validateBackupBtn');
    var fixBtn = document.getElementById('validateFixBtn');
    var applyPhotoBtn = document.getElementById('validateApplyPhotoBtn');
    
    if (backupBtn) backupBtn.disabled = false;
    if (fixBtn) fixBtn.disabled = false;
    if (applyPhotoBtn) applyPhotoBtn.disabled = false;
    
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
    var backupId = generateBackupId(recordId);
    
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
    var fullValidation = validateCurrentValidation;
    
    var previewData = UtilValidate.buildFixPreview(validateGameData, recalculated);
    
    if (fullValidation.handicapMismatches && fullValidation.handicapMismatches.length > 0) {
        for (var i = 0; i < fullValidation.handicapMismatches.length; i++) {
            var hcpMismatch = fullValidation.handicapMismatches[i];
            previewData.changes.push({
                field: 'HCP: ' + hcpMismatch.field,
                current: hcpMismatch.current,
                new: hcpMismatch.expected,
                type: 'HCP'
            });
        }
        previewData.hasChanges = true;
        previewData.changeCount = previewData.changes.length;
    }
    
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
// v1.21: VALIDATE TAB: APPLY STAGED PHOTO TO RECORD (with WRV)
// ============================================================

function applyStagedPhotoToRecord(recordId, collection, db) {
    if (!window._stagedPhoto || !window._stagedPhoto.fullPath || !window._stagedPhoto.downloadUrl) {
        appLog('No staged photo to apply', 'info');
        return Promise.resolve();
    }
    
    if (window._stagedPhoto.recordId && window._stagedPhoto.recordId !== recordId) {
        appLog('⚠️ Staged photo was selected for a different record: ' + window._stagedPhoto.recordId + ' (current: ' + recordId + ')', 'warning');
        appLog('⚠️ Applying photo anyway (user selected it intentionally)', 'warning');
    }
    
    if (window._stagedPhoto.collection && window._stagedPhoto.collection !== collection) {
        appLog('⚠️ Staged photo was selected from a different collection: ' + window._stagedPhoto.collection + ' (current: ' + collection + ')', 'warning');
        appLog('⚠️ Applying photo anyway (user selected it intentionally)', 'warning');
    }
    
    appLog('📸 Applying staged photo to record: ' + recordId, 'info');
    appLog('📸 Photo: ' + window._stagedPhoto.fullPath, 'info');
    
    var photoUpdate = {
        'celebration.imageRef': window._stagedPhoto.fullPath,
        'celebration.imageUrl': window._stagedPhoto.downloadUrl,
        'celebration.copiedAt': firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // v1.21: Use WRV if available for verified write
    return new Promise(function(resolve, reject) {
        if (isWrvAvailable()) {
            appLog('📝 Using WRV for photo write (verified)', 'info');
            // v1.10: WRV now skips timestamp fields automatically
            WRV.update(collection, recordId, photoUpdate, function(err, writtenData) {
                if (err) {
                    appLog('❌ WRV photo write failed: ' + err.message, 'error');
                    reject(err);
                } else {
                    appLog('✅ WRV photo write verified', 'success');
                    resolve(writtenData);
                }
            });
        } else {
            appLog('📝 Using blind write for photo (WRV unavailable)', 'warning');
            db.collection(collection).doc(recordId).update(photoUpdate)
                .then(function() {
                    appLog('✅ Photo applied to record: ' + recordId, 'success');
                    resolve();
                })
                .catch(function(err) {
                    appLog('❌ Failed to apply photo: ' + err.message, 'error');
                    reject(err);
                });
        }
    })
    .then(function() {
        if (typeof UtilValidateUI !== 'undefined' && typeof UtilValidateUI.clearStagedPhoto === 'function') {
            UtilValidateUI.clearStagedPhoto();
        }
        window._stagedPhoto = {
            fullPath: null,
            downloadUrl: null,
            recordId: null,
            collection: null
        };
        return Promise.resolve();
    })
    .catch(function(err) {
        throw err;
    });
}

// ============================================================
// v1.22: VALIDATE TAB: APPLY FIX TO RECORD (with fresh data reload)
// ============================================================

function applyFixToRecord(recordId, collection, db, recalculated) {
    appLog('🔄 Starting fix for record: ' + recordId, 'info');
    
    // Check WRV availability
    var useWrv = isWrvAvailable();
    if (useWrv) {
        appLog('✅ WRV available - writes will be verified and retried', 'success');
    } else {
        appLog('⚠️ WRV not available - falling back to blind writes', 'warning');
    }
    
    // v1.21: Generate backup ID using new format: BK-YYMMDD-HHMM_originalRecordId
    var backupId = generateBackupId(recordId);
    
    db.collection(collection).doc(recordId).get()
        .then(function(doc) {
            if (!doc.exists) {
                throw new Error('Record not found');
            }
            appLog('✅ Backup created: ' + backupId, 'success');
            return db.collection('backupFolder').doc(backupId).set(doc.data());
        })
        .then(function() {
            appLog('📝 Building fix payload...', 'info');
            
            if (typeof UtilValidate === 'undefined') {
                throw new Error('UtilValidate not available');
            }
            
            var fixResult = UtilValidate.buildFixPayload(validateGameData, recalculated);
            
            if (!fixResult.hasChanges) {
                appLog('⚠️ No changes to apply', 'warning');
                throw new Error('No changes to apply');
            }
            
            appLog('✍️ Applying ' + fixResult.fieldsUpdated.length + ' updates...', 'info');
            appLog('Fields: ' + fixResult.fieldsUpdated.join(', '), 'info');
            
            // v1.21: Use WRV.write() with skipVerify option
            // WRV v1.10 will skip timestamp fields automatically
            return new Promise(function(resolve, reject) {
                if (useWrv) {
                    appLog('📝 Using WRV.write() for fix (verified with retry)', 'info');
                    WRV.write(collection, recordId, fixResult.updatePayload, function(err, writtenData) {
                        if (err) {
                            appLog('❌ WRV fix write failed after ' + WRV.MAX_RETRIES + ' retries: ' + err.message, 'error');
                            reject(err);
                        } else {
                            appLog('✅ WRV fix write verified successfully', 'success');
                            appLog('📋 WRV verified fields: ' + Object.keys(fixResult.updatePayload).join(', '), 'info');
                            resolve(writtenData);
                        }
                    });
                } else {
                    appLog('📝 Using blind update for fix (WRV unavailable)', 'warning');
                    db.collection(collection).doc(recordId).update(fixResult.updatePayload)
                        .then(function() {
                            appLog('✅ Fix applied successfully (blind write)', 'success');
                            resolve();
                        })
                        .catch(function(err) {
                            appLog('❌ Fix failed: ' + err.message, 'error');
                            reject(err);
                        });
                }
            });
        })
        .then(function() {
            appLog('✅ Fix applied successfully!', 'success');
            return applyStagedPhotoToRecord(recordId, collection, db);
        })
        .then(function() {
            appLog('✅ Photo applied successfully!', 'success');
            appLog('🔄 Reloading validation with fresh data from Firestore...', 'info');
            
            // v1.22: Use loadAndValidate with useFreshData = true
            // This will fetch the record from Firestore and re-validate
            setTimeout(function() {
                loadAndValidate(true);
                appLog('✅ Validation reload complete with fresh data', 'success');
            }, 1000);
        })
        .catch(function(err) {
            appLog('❌ Fix failed: ' + err.message, 'error');
            if (err.message && err.message.indexOf('WRV') !== -1) {
                appLog('💡 WRV error - check Firestore permissions and network', 'info');
            }
        });
}

// ============================================================
// v1.05: VALIDATE TAB: APPLY PHOTO ONLY (no data fix)
// ============================================================

function validateApplyPhotoOnly() {
    if (!validateGameData || !validateGameData.id) {
        appLog('Load a record first', 'error');
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
    
    if (!window._stagedPhoto || !window._stagedPhoto.fullPath || !window._stagedPhoto.downloadUrl) {
        appLog('No staged photo to apply. Select a photo first using "Change Photo" or "Select Photo".', 'error');
        return;
    }
    
    appLog('📸 Applying staged photo to record: ' + recordId + ' (photo only, no data fix)', 'info');
    appLog('📸 Photo: ' + window._stagedPhoto.fullPath, 'info');
    
    var applyPhotoBtn = document.getElementById('validateApplyPhotoBtn');
    if (applyPhotoBtn) {
        applyPhotoBtn.disabled = true;
        applyPhotoBtn.textContent = '⏳ Applying...';
    }
    
    applyStagedPhotoToRecord(recordId, collection, db)
        .then(function() {
            appLog('✅ Photo applied successfully!', 'success');
            
            if (applyPhotoBtn) {
                applyPhotoBtn.disabled = false;
                applyPhotoBtn.textContent = '📸 APPLY STAGED PHOTO';
            }
            
            // v1.22: Use loadAndValidate with useFreshData = true
            if (typeof loadAndValidate === 'function') {
                setTimeout(function() {
                    loadAndValidate(true);
                }, 500);
            }
            
            var statusDiv = document.getElementById('validateStatus');
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.className = 'validate-status success';
                statusDiv.innerHTML = '✅ Photo applied successfully to record: ' + recordId;
            }
        })
        .catch(function(err) {
            appLog('❌ Failed to apply photo: ' + err.message, 'error');
            
            if (applyPhotoBtn) {
                applyPhotoBtn.disabled = false;
                applyPhotoBtn.textContent = '📸 APPLY STAGED PHOTO';
            }
            
            var statusDiv = document.getElementById('validateStatus');
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.className = 'validate-status error';
                statusDiv.innerHTML = '❌ Failed to apply photo: ' + err.message;
            }
        });
}

// ============================================================
// WRV AVAILABILITY CHECK
// ============================================================

function isWrvAvailable() {
    return typeof WRV !== 'undefined' && typeof WRV.write === 'function';
}

function logWrvStatus() {
    if (isWrvAvailable()) {
        appLog('✅ WRV available - writes will be verified', 'success');
        return true;
    } else {
        appLog('⚠️ WRV not available - falling back to blind writes', 'warning');
        return false;
    }
}

// ============================================================
// VALIDATE TAB: EVENT BINDINGS
// ============================================================

function initValidateTabEvents() {
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
    
    var loadBtn = document.getElementById('validateLoadBtn');
    if (loadBtn) {
        loadBtn.onclick = function() {
            loadAndValidate(false);
        };
    }
    
    var refreshBtn = document.getElementById('validateRefreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            loadValidateRecords();
        };
    }
    
    var backupBtn = document.getElementById('validateBackupBtn');
    if (backupBtn) {
        backupBtn.onclick = function() {
            validateBackupOnly();
        };
    }
    
    var fixBtn = document.getElementById('validateFixBtn');
    if (fixBtn) {
        fixBtn.onclick = function() {
            validateFixRecord();
        };
    }
    
    var applyPhotoBtn = document.getElementById('validateApplyPhotoBtn');
    if (applyPhotoBtn) {
        applyPhotoBtn.onclick = function() {
            validateApplyPhotoOnly();
        };
    }
    
    var collectionSelect = document.getElementById('validateCollection');
    if (collectionSelect) {
        collectionSelect.onchange = function() {
            loadValidateRecords();
        };
    }
    
    var recordSelect = document.getElementById('validateRecordSelect');
    if (recordSelect) {
        recordSelect.onchange = function() {
            var index = parseInt(this.value);
            if (!isNaN(index) && index >= 0 && index < validateRecords.length) {
                validateCurrentIndex = index;
                validateGameData = validateRecords[index].rawData;
                validateGameData.id = validateRecords[index].id;
                clearValidateResults();
                loadAndValidate(false);
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
// VALIDATE TAB: INFORMATION GUIDE
// ============================================================

function showValidateInfoGuide() {
    var existing = document.querySelector('.info-overlay');
    if (existing) existing.remove();
    
    var overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <div class="info-title">🔬 VALIDATE TAB - Information & Guide</div>
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✕ CLOSE</button>
            </div>
            
            <div class="info-section">
                <div class="info-section-title">🎯 What This Tab Does</div>
                <div class="info-text">
                    The <strong>VALIDATE</strong> tab checks the integrity of game records by:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>🔬 Recalculating all derived data from raw scores</li>
                        <li>📊 Comparing recalculated values against stored values</li>
                        <li>✅ Identifying mismatches that need fixing</li>
                        <li>🏌️ Validating handicap adjustment data</li>
                        <li>🔧 Fixing corrupted records with one click</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📖 How To Use</div>
                <ol class="info-steps">
                    <li><strong>Step 1 - Environment:</strong> Select PROD or DEV</li>
                    <li><strong>Step 2 - Collection:</strong> Choose <code>scheduledGames</code>, <code>historyGames</code>, or <code>backupFolder</code></li>
                    <li><strong>Step 3 - Select Record:</strong> Choose a record from the dropdown</li>
                    <li><strong>Step 4 - Load & Validate:</strong> Click <span class="highlight">"Load & Validate"</span></li>
                    <li><strong>Step 5 - Review:</strong> Check the validation summary and mismatches</li>
                    <li><strong>Step 6 - Fix:</strong> If needed, click <span class="highlight">"Fix Record"</span> to repair</li>
                    <li><strong>Step 7 - Photo:</strong> To update a photo, click <span class="highlight">"Change Photo"</span>, select a photo, then click <span class="highlight">"APPLY STAGED PHOTO"</span></li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📸 Photo Update</div>
                <div class="info-text">
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>🔄 Click <strong>"Change Photo"</strong> to select a photo from Firebase Storage</li>
                        <li>📎 The photo is <strong>staged</strong> (not written to Firestore yet)</li>
                        <li>💾 Click <strong>"APPLY STAGED PHOTO"</strong> to write the photo to the record</li>
                        <li>✅ This works even when the record is already valid</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📊 What Gets Validated</div>
                <div class="info-text">
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>🏆 <strong>TR Values:</strong> Team A and Team B totals per hole</li>
                        <li>🏅 <strong>Match Play:</strong> 16 individual match results</li>
                        <li>📊 <strong>Team Game:</strong> T-1 and T-2 flight results</li>
                        <li>⛳ <strong>Stroke Game:</strong> Cumulative nett scores</li>
                        <li>📋 <strong>Player Totals:</strong> Gross scores and relative to par</li>
                        <li>🏆 <strong>Clinched At:</strong> Match clinch detection</li>
                        <li>🏌️ <strong>Handicap Adjustment:</strong> Starting Hcp, Anchor Adj, Perf Adj, Final Hcp, Anchor Raw, Perf Raw</li>
                        <li>📎 <strong>Celebration Photo:</strong> Presence and pointer validation</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">🏌️ Handicap Adjustment Validation</div>
                <div class="info-text">
                    The VALIDATE tab checks the following handicap fields:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li><strong>Exists:</strong> The <code>adjustedHandicaps</code> field must exist in completed games</li>
                        <li><strong>Complete:</strong> All players must have handicap adjustment data</li>
                        <li><strong>Correct:</strong> Each player's <code>startingHcp</code>, <code>anchorAdj</code>, <code>perfAdj</code>, <code>finalHcp</code>, <code>anchorRaw</code>, and <code>perfRaw</code> must match recalculated values</li>
                        <li><strong>Anchor:</strong> The <code>anchor</code> and <code>newAnchor</code> fields must be correct</li>
                        <li><strong>Zero Rise:</strong> <code>needsZeroRise</code> and <code>zeroRiseAmount</code> must match recalculated values</li>
                    </ul>
                    <div style="margin-top:8px; font-size:0.75rem; color:#888;">
                        <strong>Note:</strong> Handicap recalculation uses the same <code>hcp-adjust.js</code> engine that runs at the end of each game.
                    </div>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>Read-only:</strong> Validation does not modify data unless you click "Fix Record"</li>
                    <li><strong>Backup:</strong> A backup is created in <code>backupFolder</code> before fixing</li>
                    <li><strong>Backup Naming:</strong> Format: <code>BK-YYMMDD-HHMM_originalRecordId</code> for easy identification</li>
                    <li><strong>Fresh Data:</strong> After fix, validation reloads fresh data from Firestore</li>
                    <li><strong>Preserved:</strong> Raw scores, players, and course data are never modified</li>
                    <li><strong>AS = 0.5:</strong> All "All Square" results correctly give 0.5 TR points each</li>
                    <li><strong>Field Names:</strong> Uses documented schema (game1, game2, game3) with fallbacks</li>
                    <li><strong>Handicaps:</strong> Recalculated using hcp-adjust.js engine - no duplicate logic</li>
                    <li><strong>18 Holes Required:</strong> Handicap adjustment requires all 18 holes to be complete</li>
                    <li><strong>Fix Progress:</strong> All progress messages are logged to the persistent LOG card</li>
                    <li><strong>WRV Protection:</strong> All writes are verified and retried for data integrity</li>
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
// AUTO-INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    var indicator = document.getElementById('validateIndicator');
    if (indicator) {
        indicator.textContent = 'PROD';
        indicator.className = 'env-indicator-small prod';
    }
    
    initValidateTabEvents();
    
    setTimeout(function() {
        loadValidateRecords();
        // v1.21: Check WRV availability on load
        logWrvStatus();
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
window.applyStagedPhotoToRecord = applyStagedPhotoToRecord;
window.validateApplyPhotoOnly = validateApplyPhotoOnly;
window.initValidateTabEvents = initValidateTabEvents;
window.showValidateInfoGuide = showValidateInfoGuide;
window.isWrvAvailable = isWrvAvailable;
window.logWrvStatus = logWrvStatus;
window.generateBackupId = generateBackupId;
window.fetchFreshRecord = fetchFreshRecord;
window.performValidation = performValidation;

console.log('[UTIL-VALIDATE-APP] v1.22 loaded - Post-fix validation now uses fresh Firestore data');

/*
FILE: js/util-validate-app.js
VERSION: 1.22
KEY CHANGES from v1.21:
   - FIXED: loadAndValidate() now re-fetches record from Firestore after fix
   - Previously it used stale cached rawData, showing incorrect mismatches
   - Now after fix, it reads fresh data from Firestore before validation
   - This ensures validation shows the correct state after fix
   - PRESERVED: All existing functionality from v1.21
DEPENDS ON: util-core.js, util-validate-record.js, util-validate-ui.js, wrv.js
STATUS: Ready for integration
*/