/*
FILE: js/wrv.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - EXPOSED: MAX_RETRIES, BASE_DELAY, MAX_DELAY for test validation
   - All existing functionality preserved from v1.00
DEPENDS ON: Firebase Firestore, celebration-photo.js
STATUS: Ready for integration
*/

window.WRV_VERSION = "1.01";

var WRV = (function() {
    
    // Configuration
    var MAX_RETRIES = 10;
    var BASE_DELAY = 1000; // 1 second
    var MAX_DELAY = 30000; // 30 seconds
    
    /**
     * Write data to Firestore with verification
     * 
     * @param {string} collection - Collection name (e.g., 'scheduledGames')
     * @param {string} docId - Document ID
     * @param {object} data - Data to write
     * @param {function} callback - Callback (err, result)
     */
    function writeWithWRV(collection, docId, data, callback) {
        var attempt = 0;
        var db = firebase.firestore();
        var docRef = db.collection(collection).doc(docId);
        
        function doWrite() {
            attempt++;
            console.log('[WRV] Attempt', attempt, 'for', collection + '/' + docId);
            
            // --- Step 1: Check for celebration photo ---
            // This runs on EVERY write, catches uploads anytime
            if (data.gameId && typeof checkAndRenameCelebrationPhoto === 'function') {
                checkAndRenameCelebrationPhoto(data.gameId);
            }
            
            // --- Step 2: Write to Firestore ---
            docRef.set(data, { merge: true })
                .then(function() {
                    // --- Step 3: Read back to verify ---
                    return docRef.get();
                })
                .then(function(doc) {
                    if (!doc.exists) {
                        throw new Error('Document not found after write');
                    }
                    
                    var writtenData = doc.data();
                    
                    // --- Step 4: Verify critical fields ---
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
                        // Calculate delay with exponential backoff
                        var delay = Math.min(BASE_DELAY * Math.pow(1.5, attempt - 1), MAX_DELAY);
                        console.log('[WRV] Retrying in', delay, 'ms...');
                        setTimeout(doWrite, delay);
                    } else {
                        console.error('[WRV] ❌ All retries exhausted');
                        if (callback) callback(err);
                    }
                });
        }
        
        // Start the write process
        doWrite();
    }
    
    /**
     * Verify that critical fields match between original and written data
     */
    function verifyData(original, written) {
        // Check key fields that must match
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
     */
    function updateWithWRV(collection, docId, data, callback) {
        writeWithWRV(collection, docId, data, callback);
    }
    
    // Public API
    return {
        write: writeWithWRV,
        update: updateWithWRV,
        // Expose configuration for testing
        MAX_RETRIES: MAX_RETRIES,
        BASE_DELAY: BASE_DELAY,
        MAX_DELAY: MAX_DELAY
    };
    
})();

// Make available globally
window.WRV = WRV;

/*
FILE: js/wrv.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - EXPOSED: MAX_RETRIES, BASE_DELAY, MAX_DELAY for test validation
   - All existing functionality preserved from v1.00
DEPENDS ON: Firebase Firestore, celebration-photo.js
STATUS: Ready for integration
*/