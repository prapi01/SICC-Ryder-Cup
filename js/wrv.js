/*
FILE: js/wrv.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - CHANGED: docRef.set(data, { merge: true }) → docRef.set(data) - OVERWRITE, no merge
   - ADDED: Hardcoded timestamp skip in deepEqualWithSkip() - ignores ALL timestamps
   - REMOVED: timestamp comparison logic for Firestore Timestamp objects
   - REASON: F2 data is the single source of truth - OVERWRITE always
   - REASON: Timestamps are never used and should never cause verification failure
   - PRESERVED: Infinite retries with exponential backoff
   - PRESERVED: skipVerify functionality (backward compatible but no longer needed)
   - PRESERVED: recover() functionality
DEPENDS ON: Firebase Firestore only
STATUS: Ready for integration
*/

window.WRV_VERSION = "1.13";

var WRV = (function() {
    
    // ============================================================
    // Configuration
    // ============================================================
    
    // v1.11: No MAX_RETRIES - retry indefinitely until success
    var BASE_DELAY = 1000;
    var MAX_DELAY = 60000;  // 60 seconds max between retries
    
    // ============================================================
    // v1.10: Fields to skip during verification
    // These are server-timestamp fields that will never match
    // NOTE: v1.13 - Hardcoded timestamp skip makes this redundant
    // Kept for backward compatibility only
    // ============================================================
    
    var DEFAULT_SKIP_VERIFY = [
        'updatedAt',
        'createdAt',
        'completedAt',
        'lastComputedAt',
        'results.lastComputedAt',
        'celebration.copiedAt'
    ];
    
    // ============================================================
    // Check if a value is a Firestore server timestamp sentinel
    // ============================================================
    
    function isServerTimestamp(value) {
        // Firestore FieldValue sentinel objects have specific properties
        if (value && typeof value === 'object') {
            // Check for Firestore's internal sentinel marker
            if (value._methodName === 'serverTimestamp' || 
                value.constructor && value.constructor.name === 'FieldValue') {
                return true;
            }
            // Check for the sentinel flag used in some versions
            if (value.isEqual && typeof value.isEqual === 'function') {
                // This is a best-effort check for sentinel objects
                try {
                    var json = JSON.stringify(value);
                    if (json === '{"_methodName":"serverTimestamp"}') {
                        return true;
                    }
                } catch(e) {}
            }
        }
        return false;
    }
    
    // ============================================================
    // Deep comparison of two objects with skip fields
    // Keys are SORTED before comparison (Firestore doesn't preserve order)
    // v1.13: HARDCODED timestamp skip - ALWAYS ignore ALL timestamps
    // ============================================================
    
    function deepEqualWithSkip(a, b, skipKeys) {
        // Handle primitive equality
        if (a === b) return true;
        if (a === null || b === null) return a === b;
        if (typeof a === 'undefined' || typeof b === 'undefined') return a === b;
        
        // ============================================================
        // v1.13: HARDCODED TIMESTAMP SKIP
        // ALWAYS ignore ANY timestamp-related values during verification
        // Server timestamp sentinels AND Firestore Timestamp objects
        // ============================================================
        
        // If either value is a server timestamp sentinel, skip comparison entirely
        if (isServerTimestamp(a) || isServerTimestamp(b)) {
            return true;
        }
        
        // If either value is a Firestore Timestamp object (has toDate method), skip comparison entirely
        if (a && typeof a.toDate === 'function') {
            return true;
        }
        if (b && typeof b.toDate === 'function') {
            return true;
        }
        
        // Handle Date objects (keep for completeness, but rarely used)
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }
        if (a instanceof Date) return false;
        if (b instanceof Date) return false;
        
        if (typeof a !== 'object' || typeof b !== 'object') return a === b;
        
        // Handle arrays
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (var i = 0; i < a.length; i++) {
                if (!deepEqualWithSkip(a[i], b[i], skipKeys)) return false;
            }
            return true;
        }
        
        // Sort keys before comparing (Firestore doesn't preserve order)
        var keysA = Object.keys(a).sort();
        var keysB = Object.keys(b).sort();
        
        // v1.10: Filter out skipped keys from both sets
        if (skipKeys && skipKeys.length > 0) {
            var skipSet = {};
            for (var s = 0; s < skipKeys.length; s++) {
                skipSet[skipKeys[s]] = true;
            }
            
            keysA = keysA.filter(function(k) { return !skipSet[k]; });
            keysB = keysB.filter(function(k) { return !skipSet[k]; });
        }
        
        if (keysA.length !== keysB.length) return false;
        
        for (var k = 0; k < keysA.length; k++) {
            var key = keysA[k];
            if (!deepEqualWithSkip(a[key], b[key], skipKeys)) return false;
        }
        return true;
    }
    
    // ============================================================
    // Original deepEqual (preserved for backward compatibility)
    // ============================================================
    
    function deepEqual(a, b) {
        return deepEqualWithSkip(a, b, []);
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
    // Verify payload fields with skip list
    // v1.10: Skips timestamp fields during comparison
    // v1.13: Hardcoded timestamp skip in deepEqualWithSkip() makes skipKeys optional
    // ============================================================
    
    function verifyData(original, written, skipVerify) {
        // Build skip list: default + custom
        var skipKeys = [];
        if (DEFAULT_SKIP_VERIFY) {
            skipKeys = skipKeys.concat(DEFAULT_SKIP_VERIFY);
        }
        if (skipVerify && skipVerify.length > 0) {
            skipKeys = skipKeys.concat(skipVerify);
        }
        
        // Extract ONLY the fields from the payload
        var writtenSubset = getWrittenSubset(original, written);
        
        // Use deepEqualWithSkip for comparison
        var match = deepEqualWithSkip(original, writtenSubset, skipKeys);
        
        if (!match) {
            console.warn('[WRV] ❌ Verification FAILED - payload mismatch');
            // Log which fields were skipped for debugging
            if (skipKeys.length > 0) {
                console.log('[WRV] Skipped fields during verification:', skipKeys);
            }
        } else {
            console.log('[WRV] ✅ Verification PASSED - payload matches');
        }
        
        return match;
    }
    
    // ============================================================
    // WRV.write() - Write payload, verify payload fields only
    // v1.11: INFINITE RETRIES - never gives up
    // v1.13: OVERWRITE - no merge (F2 data is the single source of truth)
    // ============================================================
    
    function writeWithWRV(collection, docId, data, callback, options) {
        var attempt = 0;
        var db = firebase.firestore();
        var docRef = db.collection(collection).doc(docId);
        var skipVerify = (options && options.skipVerify) || [];
        
        function doWrite() {
            attempt++;
            console.log('[WRV] Attempt', attempt, 'for', collection + '/' + docId);
            
            // v1.13: OVERWRITE - no merge
            // F2 data is the single source of truth - always overwrite
            docRef.set(data)
                .then(function() {
                    return docRef.get();
                })
                .then(function(doc) {
                    if (!doc.exists) {
                        throw new Error('Document not found after write');
                    }
                    
                    var writtenData = doc.data();
                    var verified = verifyData(data, writtenData, skipVerify);
                    
                    if (verified) {
                        console.log('[WRV] ✅ Verified on attempt', attempt);
                        if (callback) callback(null, writtenData);
                    } else {
                        throw new Error('Verification failed - data mismatch');
                    }
                })
                .catch(function(err) {
                    // v1.11: Log warning but NEVER give up
                    console.warn('[WRV] ⚠️ Attempt', attempt, 'failed:', err.message);
                    
                    // v1.11: Unlimited retries - calculate delay with exponential backoff
                    var delay = Math.min(BASE_DELAY * Math.pow(1.5, attempt - 1), MAX_DELAY);
                    
                    // v1.11: Log every 100 attempts to avoid console spam
                    if (attempt % 100 === 0) {
                        console.log('[WRV] 📊 Still retrying... attempt #' + attempt + ' for', collection + '/' + docId);
                    }
                    
                    console.log('[WRV] 🔄 Retrying in', delay, 'ms... (attempt', attempt + 1, ')');
                    setTimeout(doWrite, delay);
                });
        }
        
        doWrite();
    }
    
    function updateWithWRV(collection, docId, data, callback, options) {
        writeWithWRV(collection, docId, data, callback, options);
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
    // Public API - v1.11: Infinite retries
    // ============================================================
    
    return {
        write: writeWithWRV,
        update: updateWithWRV,
        BASE_DELAY: BASE_DELAY,
        MAX_DELAY: MAX_DELAY,
        recover: recover,
        isRecovering: isRecovering,
        getActiveRecoveries: getActiveRecoveries,
        cancelRecovery: cancelRecovery,
        cancelAllRecoveries: cancelAllRecoveries,
        RECOVER_RETRY_DELAY: RECOVER_RETRY_DELAY,
        // v1.09: Expose for debugging
        deepEqual: deepEqual,
        getWrittenSubset: getWrittenSubset,
        // v1.10: Expose skip verify constants
        DEFAULT_SKIP_VERIFY: DEFAULT_SKIP_VERIFY,
        deepEqualWithSkip: deepEqualWithSkip
    };
    
})();

window.WRV = WRV;

/*
FILE: js/wrv.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - CHANGED: docRef.set(data, { merge: true }) → docRef.set(data) - OVERWRITE, no merge
   - ADDED: Hardcoded timestamp skip in deepEqualWithSkip() - ignores ALL timestamps
   - REMOVED: timestamp comparison logic for Firestore Timestamp objects
   - REASON: F2 data is the single source of truth - OVERWRITE always
   - REASON: Timestamps are never used and should never cause verification failure
   - PRESERVED: Infinite retries with exponential backoff
   - PRESERVED: skipVerify functionality (backward compatible but no longer needed)
   - PRESERVED: recover() functionality
DEPENDS ON: Firebase Firestore only
STATUS: Ready for integration
*/