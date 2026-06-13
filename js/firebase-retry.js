/*
FILE: js/firebase-retry.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Universal retry wrapper for Firestore operations
   - Implements exponential backoff (1s, 2s, 4s, 8s)
   - Shows connection modal only after all retries fail
   - Modal has Retry button to manually retry
   - Modal has Exit button to go back
   - Silent retries (no user interruption until final failure)
   - All existing functionality unchanged when network is working
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

var FirebaseRetry = (function() {
    
    // Configuration
    var DEFAULT_MAX_RETRIES = 4;
    var BASE_DELAY_MS = 1000;
    var activeModal = null;
    
    // ============================================================
    // Show connection error modal
    // ============================================================
    
    function showConnectionModal(onRetry, onExit) {
        // Remove any existing modal
        if (activeModal) {
            activeModal.remove();
            activeModal = null;
        }
        
        var modalHtml = `
            <div class="firebase-retry-modal-overlay" id="firebaseRetryModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:20000; padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);">
                <div style="background:#1a1a1a; border-radius:28px; padding:28px; max-width:340px; width:90%; text-align:center; border:2px solid #ffaa44;">
                    <div style="font-size:2rem; margin-bottom:12px;">📡</div>
                    <div style="font-size:1.3rem; font-weight:800; color:#ffaa44; margin-bottom:12px;">NO INTERNET CONNECTION</div>
                    <div style="font-size:0.85rem; color:#ccc; margin-bottom:20px; line-height:1.4;">
                        Please check your connection and tap Retry to continue.
                    </div>
                    <div style="display:flex; gap:12px; margin-top:8px;">
                        <button id="firebaseRetryExitBtn" style="flex:1; background:#1a1a1a; border:1px solid #333; color:#888; padding:12px; border-radius:40px; font-weight:600; font-size:0.9rem; cursor:pointer;">EXIT</button>
                        <button id="firebaseRetryBtn" style="flex:1; background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:12px; border-radius:40px; font-weight:700; font-size:0.9rem; cursor:pointer;">RETRY</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        activeModal = document.getElementById('firebaseRetryModal');
        
        document.getElementById('firebaseRetryBtn').addEventListener('click', function() {
            activeModal.remove();
            activeModal = null;
            if (onRetry) onRetry();
        });
        
        document.getElementById('firebaseRetryExitBtn').addEventListener('click', function() {
            activeModal.remove();
            activeModal = null;
            if (onExit) onExit();
        });
    }
    
    // ============================================================
    // Hide modal if visible
    // ============================================================
    
    function hideModal() {
        if (activeModal) {
            activeModal.remove();
            activeModal = null;
        }
    }
    
    // ============================================================
    // Retry wrapper with exponential backoff
    // ============================================================
    
    function retryOperation(operation, options) {
        var maxRetries = (options && options.maxRetries) || DEFAULT_MAX_RETRIES;
        var onExit = (options && options.onExit) || function() {
            window.history.back();
        };
        var onSuccess = (options && options.onSuccess) || null;
        
        var attempt = 0;
        
        return new Promise(function(resolve, reject) {
            function tryOperation() {
                attempt++;
                console.log("[FirebaseRetry] Attempt", attempt, "of", maxRetries);
                
                operation().then(function(result) {
                    // Success - hide any modal and resolve
                    hideModal();
                    console.log("[FirebaseRetry] Success on attempt", attempt);
                    if (onSuccess) onSuccess(result);
                    resolve(result);
                }).catch(function(error) {
                    console.warn("[FirebaseRetry] Attempt", attempt, "failed:", error.message);
                    
                    if (attempt < maxRetries) {
                        // Calculate delay with exponential backoff
                        var delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                        console.log("[FirebaseRetry] Retrying in", delay, "ms");
                        setTimeout(tryOperation, delay);
                    } else {
                        // All retries failed - show modal
                        console.error("[FirebaseRetry] All", maxRetries, "attempts failed");
                        showConnectionModal(tryOperation, onExit);
                        reject(error);
                    }
                });
            }
            
            tryOperation();
        });
    }
    
    // ============================================================
    // Wrapper for Firestore collection queries
    // ============================================================
    
    function getCollection(collectionName, options) {
        return retryOperation(function() {
            return firebase.firestore().collection(collectionName).get();
        }, options);
    }
    
    function getDocument(collectionName, docId, options) {
        return retryOperation(function() {
            return firebase.firestore().collection(collectionName).doc(docId).get();
        }, options);
    }
    
    function queryWhere(collectionName, field, operator, value, options) {
        return retryOperation(function() {
            return firebase.firestore().collection(collectionName).where(field, operator, value).get();
        }, options);
    }
    
    function queryWhereLimit(collectionName, field, operator, value, limit, options) {
        return retryOperation(function() {
            return firebase.firestore().collection(collectionName).where(field, operator, value).limit(limit).get();
        }, options);
    }
    
    // ============================================================
    // Generic retry for any Firestore operation
    // ============================================================
    
    function execute(operation, options) {
        return retryOperation(operation, options);
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        getCollection: getCollection,
        getDocument: getDocument,
        queryWhere: queryWhere,
        queryWhereLimit: queryWhereLimit,
        execute: execute,
        hideModal: hideModal,
        // Export version
        VERSION: "1.00"
    };
    
})();

// Make available globally
window.FirebaseRetry = FirebaseRetry;
window.FIREBASE_RETRY_VERSION = "1.00";

/*
FILE: js/firebase-retry.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Universal retry wrapper for Firestore operations
   - Implements exponential backoff (1s, 2s, 4s, 8s)
   - Shows connection modal only after all retries fail
   - Modal has Retry button to manually retry
   - Modal has Exit button to go back
   - Silent retries (no user interruption until final failure)
   - All existing functionality unchanged when network is working
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/