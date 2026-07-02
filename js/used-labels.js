/*
FILE: js/used-labels.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - CHANGED: usedLabels now stored INSIDE playerInformation document (not separate collection)
   - CHANGED: loadUsedLabels() now reads from playerInformation/players.usedLabels
   - CHANGED: addLabelsToUsed() now merges usedLabels into playerInformation document
   - CHANGED: refreshUsedLabels() now reloads from playerInformation
   - PRESERVED: All existing API functions and signatures unchanged
   - PRESERVED: Singleton pattern with cached data for performance
   - PRESERVED: WRV integration for reliable Firestore writes
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/

var UsedLabels = (function() {
    
    // ============================================================
    // Private state
    // ============================================================
    var VERSION = "1.01";
    var usedLabelsCache = null;
    var isLoading = false;
    var loadPromise = null;
    var lastLoadedAt = null;
    
    // ============================================================
    // Helper: Get Firestore instance
    // ============================================================
    function getDb() {
        return firebase.firestore();
    }
    
    // ============================================================
    // Helper: WRV write with Promise wrapper
    // ============================================================
    function wrw(collection, docId, data, merge) {
        return new Promise(function(resolve, reject) {
            if (typeof WRV !== 'undefined' && WRV.write) {
                WRV.write(collection, docId, data, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            } else {
                // Fallback: direct write
                console.warn('[USED-LABELS] WRV not available, using direct write');
                var db = getDb();
                var ref = db.collection(collection).doc(docId);
                var promise = merge ? ref.set(data, { merge: true }) : ref.set(data);
                promise.then(resolve).catch(reject);
            }
        });
    }
    
    // ============================================================
    // Helper: WRV update with Promise wrapper
    // ============================================================
    function wru(collection, docId, data) {
        return new Promise(function(resolve, reject) {
            if (typeof WRV !== 'undefined' && WRV.update) {
                WRV.update(collection, docId, data, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            } else {
                // Fallback: direct update
                console.warn('[USED-LABELS] WRV not available, using direct update');
                var db = getDb();
                db.collection(collection).doc(docId).update(data)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
    
    // ============================================================
    // v1.01: PUBLIC: loadUsedLabels - Loads usedLabels from playerInformation
    // Returns a Promise that resolves with the usedLabels object
    // ============================================================
    function loadUsedLabels() {
        // If already loaded, return cached data
        if (usedLabelsCache !== null) {
            return Promise.resolve(usedLabelsCache);
        }
        
        // If currently loading, return the existing promise
        if (loadPromise !== null) {
            return loadPromise;
        }
        
        isLoading = true;
        loadPromise = new Promise(function(resolve, reject) {
            var db = getDb();
            // v1.01: Read from playerInformation/players.usedLabels
            db.collection('playerInformation').doc('defaultPlayers').get()
                .then(function(doc) {
                    if (doc.exists) {
                        var data = doc.data();
                        usedLabelsCache = data.usedLabels || {};
                        lastLoadedAt = new Date();
                        console.log('[USED-LABELS] Loaded', Object.keys(usedLabelsCache).length, 'labels from playerInformation');
                        resolve(usedLabelsCache);
                    } else {
                        // Document doesn't exist - initialize empty
                        usedLabelsCache = {};
                        lastLoadedAt = new Date();
                        console.log('[USED-LABELS] No playerInformation document found, initialized empty');
                        resolve(usedLabelsCache);
                    }
                    isLoading = false;
                    loadPromise = null;
                })
                .catch(function(err) {
                    console.error('[USED-LABELS] Error loading usedLabels:', err);
                    isLoading = false;
                    loadPromise = null;
                    reject(err);
                });
        });
        
        return loadPromise;
    }
    
    // ============================================================
    // PUBLIC: isLabelUsed - Checks if a label is in usedLabels
    // ============================================================
    function isLabelUsed(label) {
        if (!label || label === '') {
            return false;
        }
        
        // If cache is loaded, check it
        if (usedLabelsCache !== null) {
            return usedLabelsCache[label] === true;
        }
        
        // Cache not loaded - return false and log warning
        console.warn('[USED-LABELS] isLabelUsed called before loadUsedLabels, returning false');
        return false;
    }
    
    // ============================================================
    // v1.01: PUBLIC: addLabelsToUsed - Adds labels to usedLabels
    // Now merges into playerInformation document
    // Returns a Promise
    // ============================================================
    function addLabelsToUsed(labels) {
        if (!labels || labels.length === 0) {
            console.log('[USED-LABELS] No labels to add');
            return Promise.resolve();
        }
        
        // Filter out empty labels
        var validLabels = labels.filter(function(label) {
            return label && label !== '';
        });
        
        if (validLabels.length === 0) {
            console.log('[USED-LABELS] No valid labels to add');
            return Promise.resolve();
        }
        
        console.log('[USED-LABELS] Adding', validLabels.length, 'labels to usedLabels');
        
        // Build the update object for usedLabels
        var usedLabelsData = {};
        for (var i = 0; i < validLabels.length; i++) {
            usedLabelsData[validLabels[i]] = true;
        }
        
        // Update the cache immediately (optimistic)
        if (usedLabelsCache !== null) {
            for (var i = 0; i < validLabels.length; i++) {
                usedLabelsCache[validLabels[i]] = true;
            }
        }
        
        // v1.01: Read current document, merge usedLabels, write back
        var db = getDb();
        return db.collection('playerInformation').doc('defaultPlayers').get()
            .then(function(doc) {
                var existingUsedLabels = {};
                if (doc.exists && doc.data().usedLabels) {
                    existingUsedLabels = doc.data().usedLabels;
                }
                
                // Merge new labels with existing
                var mergedLabels = {};
                for (var key in existingUsedLabels) {
                    mergedLabels[key] = existingUsedLabels[key];
                }
                for (var key in usedLabelsData) {
                    mergedLabels[key] = usedLabelsData[key];
                }
                
                // Write back using WRV
                var payload = {
                    usedLabels: mergedLabels,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                return wrw('playerInformation', 'defaultPlayers', payload, true);
            })
            .then(function() {
                console.log('[USED-LABELS] Successfully added labels:', validLabels.join(', '));
                return usedLabelsCache;
            })
            .catch(function(err) {
                console.error('[USED-LABELS] Error adding labels to usedLabels:', err);
                throw err;
            });
    }
    
    // ============================================================
    // PUBLIC: getUsedLabels - Returns the cached usedLabels object
    // ============================================================
    function getUsedLabels() {
        return usedLabelsCache;
    }
    
    // ============================================================
    // v1.01: PUBLIC: refreshUsedLabels - Forces reload from Firestore
    // ============================================================
    function refreshUsedLabels() {
        usedLabelsCache = null;
        loadPromise = null;
        isLoading = false;
        return loadUsedLabels();
    }
    
    // ============================================================
    // PUBLIC: getLabelCount - Returns number of used labels
    // ============================================================
    function getLabelCount() {
        if (usedLabelsCache === null) {
            return 0;
        }
        return Object.keys(usedLabelsCache).length;
    }
    
    // ============================================================
    // PUBLIC: getAllLabelsArray - Returns array of all used labels
    // ============================================================
    function getAllLabelsArray() {
        if (usedLabelsCache === null) {
            return [];
        }
        return Object.keys(usedLabelsCache);
    }
    
    // ============================================================
    // PUBLIC: ensureInitialized - Ensures usedLabels is loaded
    // ============================================================
    function ensureInitialized() {
        if (usedLabelsCache !== null) {
            return Promise.resolve(usedLabelsCache);
        }
        return loadUsedLabels();
    }
    
    // ============================================================
    // Auto-initialize on load
    // ============================================================
    // Load usedLabels in the background when this file loads
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        // Delay loading slightly to not block UI
        setTimeout(function() {
            loadUsedLabels().catch(function(err) {
                console.warn('[USED-LABELS] Auto-load failed:', err);
            });
        }, 100);
    }
    
    // ============================================================
    // Public API
    // ============================================================
    return {
        VERSION: VERSION,
        loadUsedLabels: loadUsedLabels,
        isLabelUsed: isLabelUsed,
        addLabelsToUsed: addLabelsToUsed,
        getUsedLabels: getUsedLabels,
        refreshUsedLabels: refreshUsedLabels,
        getLabelCount: getLabelCount,
        getAllLabelsArray: getAllLabelsArray,
        ensureInitialized: ensureInitialized
    };
    
})();

// Make available globally
window.UsedLabels = UsedLabels;

/*
FILE: js/used-labels.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - CHANGED: usedLabels now stored INSIDE playerInformation document (not separate collection)
   - CHANGED: loadUsedLabels() now reads from playerInformation/players.usedLabels
   - CHANGED: addLabelsToUsed() now merges usedLabels into playerInformation document
   - CHANGED: refreshUsedLabels() now reloads from playerInformation
   - PRESERVED: All existing API functions and signatures unchanged
   - PRESERVED: Singleton pattern with cached data for performance
   - PRESERVED: WRV integration for reliable Firestore writes
DEPENDS ON: Firebase Firestore, WRV.js
STATUS: Ready for integration
*/