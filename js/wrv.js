/*
FILE: js/wrv.js
VERSION: 1.07
KEY CHANGES from v1.06:
   - FIXED: verifyData() now compares ONLY the fields in the WRV payload
   - REMOVED: FULL IMR vs FULL FS Record comparison (was always failing)
   - ADDED: getWrittenSubset() function to extract only payload fields from Firestore
   - This ensures WRV verification passes for BOTH flight data and results writes
   - PRESERVED: WRV.recover() unchanged
DEPENDS ON: Firebase Firestore only
STATUS: Ready for integration
*/

window.WRV_VERSION = "1.07";

var WRV = (function() {
    
    // ============================================================
    // Configuration
    // ============================================================
    
    var MAX_RETRIES = 10;
    var BASE_DELAY = 1000;
    var MAX_DELAY = 30000;
    
    // ============================================================
    // Deep comparison of two objects
    // ============================================================
    
    function deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return a === b;
        if (typeof a === 'undefined' || typeof b === 'undefined') return a === b;
        
        // Handle Date objects
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }
        if (a instanceof Date) return false;
        if (b instanceof Date) return false;
        
        // Handle Firestore Timestamp (has toDate method)
        if (a && typeof a.toDate === 'function') {
            if (b && typeof b.toDate === 'function') {
                return a.toDate().getTime() === b.toDate().getTime();
            }
            return false;
        }
        if (b && typeof b.toDate === 'function') {
            return false;
        }
        
        if (typeof a !== 'object' || typeof b !== 'object') return a === b;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (var i = 0; i < a.length; i++) {
                if (!deepEqual(a[i], b[i])) return false;
            }
            return true;
        }
        
        var keysA = Object.keys(a);
        var keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        
        for (var k = 0; k < keysA.length; k++) {
            var key = keysA[k];
            if (!deepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    
    // ============================================================
    // Get written subset from Firestore document
    // Extracts ONLY the fields that were in the original payload
    // ============================================================
    
    function getWrittenSubset(original, written) {
        var subset = {};
        var keys = Object.keys(original);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (written[key] !== undefined) {
                subset[key] = written[key];
            }
        }
        return subset;
    }
    
    // ============================================================
    // Verify payload fields
    // Compares ONLY the fields that were in the WRV payload
    // ============================================================
    
    function verifyData(original, written) {
        // Extract ONLY the fields from the payload
        var writtenSubset = getWrittenSubset(original, written);
        var match = deepEqual(original, writtenSubset);
        
        if (!match) {
            console.warn('[WRV] ❌ Verification FAILED - payload mismatch');
        } else {
            console.log('[WRV] ✅ Verification PASSED - payload matches');
        }
        
        return match;
    }
    
    // ============================================================
    // WRV.write() - Write payload, verify payload fields only
    // ============================================================
    
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
                        throw new Error('Verification failed - data mismatch');
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
    
    function updateWithWRV(collection, docId, data, callback) {
        writeWithWRV(collection, docId, data, callback);
    }
    
    // ============================================================
    // WRV.recover() - v1.03 (UNCHANGED)
    // ============================================================
    
    var RECOVER_RETRY_DELAY = 10000;
    var activeRecoveries = {};
    
    function recover(options) {
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
        
        var recoveryKey = options.gameId + '_' + options.flight + '_' + options.holeNumber;
        if (activeRecoveries[recoveryKey]) {
            console.log('[WRV] ⏭️ Recovery already in progress for key:', recoveryKey);
            return;
        }
        
        activeRecoveries[recoveryKey] = true;
        console.log('[WRV] 🔄 Started background recovery for key:', recoveryKey);
        
        var attemptCount = 0;
        var isComplete = false;
        var db = firebase.firestore();
        var docRef = db.collection(options.collection).doc(options.gameId);
        var flightField = (options.flight === 1) ? 'f1' : 'f2';
        var otherFlightField = (options.flight === 1) ? 'f2' : 'f1';
        
        function doRecover() {
            attemptCount++;
            console.log('[WRV] 🔄 Recovery attempt #' + attemptCount + ' for key:', recoveryKey);
            
            docRef.get()
                .then(function(doc) {
                    if (!doc.exists) {
                        console.warn('[WRV] ⚠️ Document does not exist in Firestore');
                        throw new Error('Document does not exist');
                    }
                    
                    console.log('[WRV] ✅ Read SUCCEEDED (attempt #' + attemptCount + ')');
                    var fsData = doc.data();
                    console.log('[WRV] 📄 FS data received. Fields:', Object.keys(fsData).join(', '));
                    
                    console.log('[WRV] 🔍 Getting in-memory data (source of truth)...');
                    var localData = options.getLocalData();
                    console.log('[WRV] 📄 Local data received. Fields:', Object.keys(localData).join(', '));
                    
                    var fsFlightData = fsData[flightField] ? fsData[flightField].d : null;
                    var fsSaveEvent = fsData[flightField] ? fsData[flightField].se : false;
                    var fsCrossEvent = fsData[flightField] ? fsData[flightField].x : false;
                    
                    var localFlightData = (options.flight === 1) ? localData.flight1Data : localData.flight2Data;
                    var localSaveEvent = (options.flight === 1) ? localData.flight1SaveEvent : localData.flight2SaveEvent;
                    var localCrossEvent = (options.flight === 1) ? localData.flight1CrossEvent : localData.flight2CrossEvent;
                    
                    var dataMatches = (fsFlightData === localFlightData);
                    var saveEventMatches = (fsSaveEvent === localSaveEvent);
                    var crossEventMatches = (fsCrossEvent === localCrossEvent);
                    
                    console.log('[WRV] 🔍 Comparison results:');
                    console.log('[WRV]   - Data match:', dataMatches);
                    console.log('[WRV]   - SaveEvent match:', saveEventMatches);
                    console.log('[WRV]   - CrossEvent match:', crossEventMatches);
                    
                    if (dataMatches && saveEventMatches && crossEventMatches) {
                        console.log('[WRV] ✅ FS already in sync - stopping recovery');
                        isComplete = true;
                        delete activeRecoveries[recoveryKey];
                        console.log('[WRV] 🛑 Stopped - FS in sync (key:', recoveryKey, ')');
                        return;
                    }
                    
                    console.log('[WRV] ⚠️ FS out of sync - writing in-memory truth to Firestore');
                    
                    var writePayload = {};
                    writePayload[flightField + '.d'] = localFlightData;
                    writePayload[flightField + '.se'] = localSaveEvent;
                    writePayload[otherFlightField + '.x'] = true;
                    writePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    
                    console.log('[WRV] ✍️ Writing to Firestore... (attempt #' + attemptCount + ')');
                    return docRef.update(writePayload);
                })
                .then(function() {
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
                        throw new Error('Verification failed - data mismatch');
                    }
                })
                .catch(function(err) {
                    console.warn('[WRV] ⚠️ Attempt #' + attemptCount + ' failed:', err.message);
                    
                    if (isComplete) return;
                    
                    if (attemptCount > 100 && attemptCount % 10 === 0) {
                        console.log('[WRV] 📊 Still retrying... attempt #' + attemptCount + ' (key:', recoveryKey, ')');
                    }
                    
                    console.log('[WRV] ⏳ Waiting ' + RECOVER_RETRY_DELAY + 'ms before retry (attempt #' + attemptCount + ')');
                    setTimeout(doRecover, RECOVER_RETRY_DELAY);
                });
        }
        
        setTimeout(doRecover, 1000);
    }
    
    function isRecovering(key) {
        return !!activeRecoveries[key];
    }
    
    function getActiveRecoveries() {
        return Object.keys(activeRecoveries);
    }
    
    function cancelRecovery(key) {
        if (activeRecoveries[key]) {
            delete activeRecoveries[key];
            console.log('[WRV] 🛑 Cancelled recovery for key:', key);
            return true;
        }
        return false;
    }
    
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
        write: writeWithWRV,
        update: updateWithWRV,
        MAX_RETRIES: MAX_RETRIES,
        BASE_DELAY: BASE_DELAY,
        MAX_DELAY: MAX_DELAY,
        recover: recover,
        isRecovering: isRecovering,
        getActiveRecoveries: getActiveRecoveries,
        cancelRecovery: cancelRecovery,
        cancelAllRecoveries: cancelAllRecoveries,
        RECOVER_RETRY_DELAY: RECOVER_RETRY_DELAY
    };
    
})();

window.WRV = WRV;

/*
FILE: js/wrv.js
VERSION: 1.07
KEY CHANGES from v1.06:
   - FIXED: verifyData() now compares ONLY the fields in the WRV payload
   - REMOVED: FULL IMR vs FULL FS Record comparison (was always failing)
   - ADDED: getWrittenSubset() function to extract only payload fields from Firestore
   - This ensures WRV verification passes for BOTH flight data and results writes
   - PRESERVED: WRV.recover() unchanged
DEPENDS ON: Firebase Firestore only
STATUS: Ready for integration
*/