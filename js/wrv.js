/*
FILE: js/wrv.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - ADDED: WRV.recover() - Background recovery system for Firestore data consistency
   - ADDED: Comprehensive debug logging for all WRV operations
   - ADDED: Unlimited retry with fixed 10-second delay (as per handover doc)
   - ADDED: Read → Compare → Write → Verify flow
   - ADDED: Fire-and-forget operation (no user callback)
   - ADDED: In-memory data as source of truth
   - PRESERVED: WRV.write() and WRV.update() from v1.02 (unchanged)
DEPENDS ON: Firebase Firestore only
STATUS: Ready for integration
*/

window.WRV_VERSION = "1.03";

var WRV = (function() {
    
    // ============================================================
    // v1.02: Original WRV.write() with verification (UNCHANGED)
    // ============================================================
    
    // Configuration for write()
    var MAX_RETRIES = 10;
    var BASE_DELAY = 1000; // 1 second
    var MAX_DELAY = 30000; // 30 seconds
    
    /**
     * Write data to Firestore with verification
     * (UNCHANGED from v1.02)
     */
    function writeWithWRV(collection, docId, data, callback) {
        var attempt = 0;
        var db = firebase.firestore();
        var docRef = db.collection(collection).doc(docId);
        
        function doWrite() {
            attempt++;
            console.log('[WRV] Attempt', attempt, 'for', collection + '/' + docId);
            
            docRef.set(data, { merge: true })
                .then(function() {
                    return docRef.get();
                })
                .then(function(doc) {
                    if (!doc.exists) {
                        throw new Error('Document not found after write');
                    }
                    
                    var writtenData = doc.data();
                    var verified = verifyData(data, writtenData);
                    
                    if (verified) {
                        console.log('[WRV] ✅ Verified on attempt', attempt);
                        if (callback) callback(null, writtenData);
                    } else {
                        throw new Error('Verification failed');
                    }
                })
                .catch(function(err) {
                    console.warn('[WRV] ⚠️ Attempt', attempt, 'failed:', err.message);
                    
                    if (attempt < MAX_RETRIES) {
                        var delay = Math.min(BASE_DELAY * Math.pow(1.5, attempt - 1), MAX_DELAY);
                        console.log('[WRV] Retrying in', delay, 'ms...');
                        setTimeout(doWrite, delay);
                    } else {
                        console.error('[WRV] ❌ All retries exhausted');
                        if (callback) callback(err);
                    }
                });
        }
        
        doWrite();
    }
    
    /**
     * Verify that critical fields match between original and written data
     * (UNCHANGED from v1.02)
     */
    function verifyData(original, written) {
        var keyFields = ['status', 'currentHoleF1', 'currentHoleF2', 'lastSyncedPosition'];
        
        for (var i = 0; i < keyFields.length; i++) {
            var field = keyFields[i];
            if (original[field] !== undefined && original[field] !== written[field]) {
                console.warn('[WRV] Field mismatch:', field, 'expected:', original[field], 'got:', written[field]);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Update a document with WRV (alias for writeWithWRV)
     * (UNCHANGED from v1.02)
     */
    function updateWithWRV(collection, docId, data, callback) {
        writeWithWRV(collection, docId, data, callback);
    }
    
    // ============================================================
    // v1.03: NEW - WRV.recover() Background Recovery System
    // ============================================================
    
    // Configuration for recover()
    var RECOVER_RETRY_DELAY = 10000; // 10 seconds fixed delay
    var RECOVER_MAX_ATTEMPTS = 99999; // Effectively unlimited (10-15 minutes between holes)
    
    // Track active recoveries to prevent duplicate runs
    var activeRecoveries = {};
    
    /**
     * WRV.recover() - Background recovery system
     * 
     * Runs in the background when Firestore write fails.
     * Reads Firestore data, compares with in-memory data (source of truth),
     * writes if out of sync, verifies by reading back.
     * 
     * @param {object} options - Recovery options
     * @param {string} options.gameId - The game ID (e.g., "GM_260625_1819_97")
     * @param {string} options.collection - Firestore collection name (e.g., "scheduledGames")
     * @param {object} options.updatePayload - The data that was attempted to be written
     * @param {number} options.flight - 1 or 2
     * @param {number} options.holeNumber - The hole number being recovered
     * @param {string} options.newData - The new data string that was written
     * @param {string} options.flight1Data - Current flight1 data string
     * @param {string} options.flight2Data - Current flight2 data string
     * @param {function} options.getLocalData - Callback to get current in-memory data
     */
    function recover(options) {
        // --- VALIDATE INPUTS ---
        if (!options) {
            console.error('[WRV] ❌ recover() called with no options');
            return;
        }
        
        if (!options.gameId) {
            console.error('[WRV] ❌ recover() missing gameId');
            return;
        }
        
        if (!options.collection) {
            console.error('[WRV] ❌ recover() missing collection');
            return;
        }
        
        if (typeof options.getLocalData !== 'function') {
            console.error('[WRV] ❌ recover() missing getLocalData function');
            return;
        }
        
        // --- PREVENT DUPLICATE RECOVERIES ---
        var recoveryKey = options.gameId + '_' + options.flight + '_' + options.holeNumber;
        
        if (activeRecoveries[recoveryKey]) {
            console.log('[WRV] ⏭️ Recovery already in progress for key:', recoveryKey);
            return;
        }
        
        activeRecoveries[recoveryKey] = true;
        console.log('[WRV] 🔄 Started background recovery for key:', recoveryKey);
        console.log('[WRV] 📋 Recovery options:', {
            gameId: options.gameId,
            collection: options.collection,
            flight: options.flight,
            holeNumber: options.holeNumber,
            newData: options.newData ? options.newData.substring(0, 30) + '...' : 'undefined'
        });
        
        // --- RECOVERY ALGORITHM ---
        var attemptCount = 0;
        var isComplete = false;
        var db = firebase.firestore();
        var docRef = db.collection(options.collection).doc(options.gameId);
        var flightField = (options.flight === 1) ? 'f1' : 'f2';
        var otherFlightField = (options.flight === 1) ? 'f2' : 'f1';
        
        function doRecover() {
            attemptCount++;
            console.log('[WRV] 🔄 Recovery attempt #' + attemptCount + ' for key:', recoveryKey);
            
            // --- STEP 1: READ FROM FIRESTORE ---
            console.log('[WRV] 📖 Reading from Firestore... (attempt #' + attemptCount + ')');
            
            docRef.get()
                .then(function(doc) {
                    if (!doc.exists) {
                        console.warn('[WRV] ⚠️ Document does not exist in Firestore');
                        throw new Error('Document does not exist');
                    }
                    
                    console.log('[WRV] ✅ Read SUCCEEDED (attempt #' + attemptCount + ')');
                    var fsData = doc.data();
                    console.log('[WRV] 📄 FS data received. Fields:', Object.keys(fsData).join(', '));
                    
                    // Log the current FS flight data for debugging
                    if (fsData[flightField]) {
                        var fsFlightData = fsData[flightField].d || 'undefined';
                        console.log('[WRV] 📄 FS ' + flightField + '.d (first 30 chars):', 
                            fsFlightData.substring ? fsFlightData.substring(0, 30) + '...' : fsFlightData);
                    } else {
                        console.log('[WRV] 📄 FS ' + flightField + ' field does not exist');
                    }
                    
                    // --- STEP 2: GET LOCAL DATA (SOURCE OF TRUTH) ---
                    console.log('[WRV] 🔍 Getting in-memory data (source of truth)...');
                    var localData = options.getLocalData();
                    console.log('[WRV] 📄 Local data received. Fields:', Object.keys(localData).join(', '));
                    
                    // Log the current local flight data for debugging
                    var localFlightData = (options.flight === 1) ? localData.flight1Data : localData.flight2Data;
                    console.log('[WRV] 📄 Local flight data (first 30 chars):', 
                        localFlightData ? localFlightData.substring(0, 30) + '...' : 'undefined');
                    
                    // --- STEP 3: COMPARE FS DATA WITH LOCAL DATA ---
                    console.log('[WRV] 🔍 Comparing FS data with in-memory truth...');
                    
                    var fsFlightData = fsData[flightField] ? fsData[flightField].d : null;
                    var fsSaveEvent = fsData[flightField] ? fsData[flightField].se : false;
                    var fsCrossEvent = fsData[flightField] ? fsData[flightField].x : false;
                    
                    var localFlightData = (options.flight === 1) ? localData.flight1Data : localData.flight2Data;
                    var localSaveEvent = (options.flight === 1) ? localData.flight1SaveEvent : localData.flight2SaveEvent;
                    var localCrossEvent = (options.flight === 1) ? localData.flight1CrossEvent : localData.flight2CrossEvent;
                    
                    // Compare flight data strings
                    var dataMatches = (fsFlightData === localFlightData);
                    var saveEventMatches = (fsSaveEvent === localSaveEvent);
                    var crossEventMatches = (fsCrossEvent === localCrossEvent);
                    
                    console.log('[WRV] 🔍 Comparison results:');
                    console.log('[WRV]   - Data match:', dataMatches, '(FS:', fsFlightData ? fsFlightData.substring(0, 20) + '...' : 'null', '| Local:', localFlightData ? localFlightData.substring(0, 20) + '...' : 'null', ')');
                    console.log('[WRV]   - SaveEvent match:', saveEventMatches, '(FS:', fsSaveEvent, '| Local:', localSaveEvent, ')');
                    console.log('[WRV]   - CrossEvent match:', crossEventMatches, '(FS:', fsCrossEvent, '| Local:', localCrossEvent, ')');
                    
                    if (dataMatches && saveEventMatches && crossEventMatches) {
                        console.log('[WRV] ✅ FS already in sync - stopping recovery');
                        isComplete = true;
                        delete activeRecoveries[recoveryKey];
                        console.log('[WRV] 🛑 Stopped - FS in sync (key:', recoveryKey, ')');
                        return;
                    }
                    
                    // --- STEP 4: FS IS OUT OF SYNC - WRITE IN-MEMORY TRUTH ---
                    console.log('[WRV] ⚠️ FS out of sync - writing in-memory truth to Firestore');
                    
                    // Build the update payload from local data
                    var writePayload = {};
                    writePayload[flightField + '.d'] = localFlightData;
                    writePayload[flightField + '.se'] = localSaveEvent;
                    writePayload[otherFlightField + '.x'] = true;
                    writePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    
                    console.log('[WRV] ✍️ Writing to Firestore... (attempt #' + attemptCount + ')');
                    console.log('[WRV] 📄 Write payload:', {
                        flightField: flightField,
                        dataLength: localFlightData ? localFlightData.length : 0,
                        saveEvent: localSaveEvent,
                        crossEventForOther: true
                    });
                    
                    return docRef.update(writePayload);
                })
                .then(function() {
                    // --- STEP 5: WRITE SUCCEEDED - NOW VERIFY ---
                    console.log('[WRV] ✅ Write SUCCEEDED (attempt #' + attemptCount + ')');
                    console.log('[WRV] 📖 Re-reading FS to verify...');
                    
                    return docRef.get();
                })
                .then(function(doc) {
                    if (!doc.exists) {
                        console.warn('[WRV] ⚠️ Document not found during verify read');
                        throw new Error('Document not found during verify');
                    }
                    
                    console.log('[WRV] ✅ Verify read SUCCEEDED (attempt #' + attemptCount + ')');
                    var fsData = doc.data();
                    
                    // Get local data again for verification
                    console.log('[WRV] 🔍 Getting in-memory data for verification...');
                    var localData = options.getLocalData();
                    var localFlightData = (options.flight === 1) ? localData.flight1Data : localData.flight2Data;
                    var localSaveEvent = (options.flight === 1) ? localData.flight1SaveEvent : localData.flight2SaveEvent;
                    var localCrossEvent = (options.flight === 1) ? localData.flight1CrossEvent : localData.flight2CrossEvent;
                    
                    var fsFlightData = fsData[flightField] ? fsData[flightField].d : null;
                    var fsSaveEvent = fsData[flightField] ? fsData[flightField].se : false;
                    var fsCrossEvent = fsData[flightField] ? fsData[flightField].x : false;
                    
                    var dataMatches = (fsFlightData === localFlightData);
                    var saveEventMatches = (fsSaveEvent === localSaveEvent);
                    var crossEventMatches = (fsCrossEvent === localCrossEvent);
                    
                    console.log('[WRV] 🔍 Verification comparison results:');
                    console.log('[WRV]   - Data match:', dataMatches);
                    console.log('[WRV]   - SaveEvent match:', saveEventMatches);
                    console.log('[WRV]   - CrossEvent match:', crossEventMatches);
                    
                    if (dataMatches && saveEventMatches && crossEventMatches) {
                        console.log('[WRV] ✅ Verification SUCCESS - FS sync\'d');
                        isComplete = true;
                        delete activeRecoveries[recoveryKey];
                        console.log('[WRV] 🛑 Stopped - FS in sync (key:', recoveryKey, ')');
                        return;
                    } else {
                        console.warn('[WRV] ⚠️ Verification FAILED - FS still out of sync');
                        console.warn('[WRV] ⚠️ This is unexpected - will retry write');
                        throw new Error('Verification failed - data mismatch');
                    }
                })
                .catch(function(err) {
                    console.warn('[WRV] ⚠️ Attempt #' + attemptCount + ' failed:', err.message);
                    console.warn('[WRV] ⚠️ Error details:', err);
                    
                    // Check if we should continue
                    if (isComplete) {
                        return;
                    }
                    
                    // Check if we've exceeded max attempts (effectively unlimited, but log at intervals)
                    if (attemptCount > 100 && attemptCount % 10 === 0) {
                        console.log('[WRV] 📊 Still retrying... attempt #' + attemptCount + ' (key:', recoveryKey, ')');
                    }
                    
                    // Retry with fixed 10-second delay
                    console.log('[WRV] ⏳ Waiting ' + RECOVER_RETRY_DELAY + 'ms before retry (attempt #' + attemptCount + ')');
                    setTimeout(doRecover, RECOVER_RETRY_DELAY);
                });
        }
        
        // Start the recovery process
        setTimeout(doRecover, 1000); // Small initial delay to ensure UI updates first
    }
    
    /**
     * Check if a recovery is active for a given key
     */
    function isRecovering(key) {
        return !!activeRecoveries[key];
    }
    
    /**
     * Get all active recovery keys
     */
    function getActiveRecoveries() {
        return Object.keys(activeRecoveries);
    }
    
    /**
     * Cancel a specific recovery
     */
    function cancelRecovery(key) {
        if (activeRecoveries[key]) {
            delete activeRecoveries[key];
            console.log('[WRV] 🛑 Cancelled recovery for key:', key);
            return true;
        }
        return false;
    }
    
    /**
     * Cancel all active recoveries
     */
    function cancelAllRecoveries() {
        var keys = Object.keys(activeRecoveries);
        for (var i = 0; i < keys.length; i++) {
            delete activeRecoveries[keys[i]];
        }
        console.log('[WRV] 🛑 Cancelled all active recoveries (count:', keys.length, ')');
        return keys.length;
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        // v1.02: Original write functions (unchanged)
        write: writeWithWRV,
        update: updateWithWRV,
        MAX_RETRIES: MAX_RETRIES,
        BASE_DELAY: BASE_DELAY,
        MAX_DELAY: MAX_DELAY,
        
        // v1.03: New recover function
        recover: recover,
        isRecovering: isRecovering,
        getActiveRecoveries: getActiveRecoveries,
        cancelRecovery: cancelRecovery,
        cancelAllRecoveries: cancelAllRecoveries,
        
        // v1.03: Expose config for debugging
        RECOVER_RETRY_DELAY: RECOVER_RETRY_DELAY
    };
    
})();

// Make available globally
window.WRV = WRV;

/*
FILE: js/wrv.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - ADDED: WRV.recover() - Background recovery system for Firestore data consistency
   - ADDED: Comprehensive debug logging for all WRV operations
   - ADDED: Unlimited retry with fixed 10-second delay (as per handover doc)
   - ADDED: Read → Compare → Write → Verify flow
   - ADDED: Fire-and-forget operation (no user callback)
   - ADDED: In-memory data as source of truth
   - PRESERVED: WRV.write() and WRV.update() from v1.02 (unchanged)
DEPENDS ON: Firebase Firestore only
STATUS: Ready for integration
*/