/*
FILE: js/util-core.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: Correct storageBucket for PROD: sicc-ryder-cup.firebasestorage.app
   - FIXED: Correct storageBucket for DEV: sicc-ryder-cup-dev.firebasestorage.app
   - PRESERVED: All existing functionality from v1.00
DEPENDS ON: Firebase (firebase-app-compat, firebase-firestore-compat, firebase-storage-compat)
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_CORE_VERSION = "1.01";
console.log("[UTIL-CORE] Initializing v1.01");

// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

(function initFirebase() {
    try {
        var PROD_CONFIG = {
            apiKey: "AIzaSyB-9hqHpG_Op_kxp9sj8pLs1LS261o2oc",
            authDomain: "sicc-ryder-cup.firebaseapp.com",
            projectId: "sicc-ryder-cup",
            storageBucket: "sicc-ryder-cup.firebasestorage.app"
        };
        var DEV_CONFIG = {
            apiKey: "AIzaSyAw3UVNMET59rjgHNQvu_3qXUQ4RileQeQ",
            authDomain: "sicc-ryder-cup-dev.firebaseapp.com",
            projectId: "sicc-ryder-cup-dev",
            storageBucket: "sicc-ryder-cup-dev.firebasestorage.app"
        };
        
        // Initialize only if not already initialized
        var existingProd = firebase.apps.find(function(app) { return app.name === "prod"; });
        var existingDev = firebase.apps.find(function(app) { return app.name === "dev"; });
        
        if (!existingProd) { 
            firebase.initializeApp(PROD_CONFIG, "prod"); 
            console.log('[UTIL-CORE] PROD Firebase initialized');
        }
        if (!existingDev) { 
            firebase.initializeApp(DEV_CONFIG, "dev"); 
            console.log('[UTIL-CORE] DEV Firebase initialized');
        }
        
        window.prodDb = firebase.firestore(firebase.apps.find(function(app) { return app.name === "prod"; }));
        window.devDb = firebase.firestore(firebase.apps.find(function(app) { return app.name === "dev"; }));
        
        console.log('[UTIL-CORE] Firebase Firestore instances ready');
    } catch(e) {
        console.error('[UTIL-CORE] Firebase init error:', e);
    }
})();

// ============================================================
// LOGGING FUNCTIONS
// ============================================================

/**
 * Log a message to console and the UI log container
 * @param {string} message - The message to log
 * @param {string} type - 'error', 'success', 'warning', 'info', 'diff', 'match'
 */
function log(message, type) {
    var timestamp = new Date().toLocaleTimeString();
    
    // Console logging
    if (type === 'error') {
        console.error('[REC-MGMT] ❌', message);
    } else if (type === 'success') {
        console.log('[REC-MGMT] ✅', message);
    } else if (type === 'warning') {
        console.warn('[REC-MGMT] ⚠️', message);
    } else if (type === 'diff') {
        console.log('[REC-MGMT] 🔴', message);
    } else if (type === 'match') {
        console.log('[REC-MGMT] 🟢', message);
    } else {
        console.log('[REC-MGMT] ℹ️', message);
    }
    
    // UI logging
    var logDiv = document.getElementById('log');
    if (logDiv) {
        var entry = document.createElement('div');
        entry.className = 'log-entry';
        var color = 
            type === 'error' ? '#ff6b6b' : 
            type === 'success' ? '#4caf50' : 
            type === 'warning' ? '#ffaa44' : 
            type === 'diff' ? '#ff6b6b' : 
            type === 'match' ? '#4caf50' : 
            '#ffaa44';
        entry.innerHTML = '<span style="color:' + color + ';">[' + timestamp + '] ' + message + '</span>';
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }
}

/**
 * Step-based logging wrapper
 * @param {number} step - Step number
 * @param {string} message - The message to log
 * @param {string} type - 'error', 'success', 'warning', 'info'
 */
function logStep(step, message, type) {
    log('[Step ' + step + '] ' + message, type);
}

// ============================================================
// HTML ESCAPING
// ============================================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================================
// DATE FORMATTING
// ============================================================

/**
 * Format a date string for display
 * @param {string} dateStr - Date string (YYYY-MM-DD or ISO)
 * @returns {string} Formatted date (DD MMM YYYY)
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    var parts = dateStr.split('-');
    if (parts.length === 3) {
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return parts[2] + ' ' + months[parseInt(parts[1])-1] + ' ' + parts[0];
    }
    return dateStr;
}

// ============================================================
// DATE TOGGLE INITIALIZATION
// ============================================================

/**
 * Initialize the date radio button toggle functionality
 * Shows/hides the custom date input based on selection
 */
function initDateToggle() {
    var radios = document.querySelectorAll('input[name="dateOption"]');
    var customDateInput = document.getElementById('customDate');
    
    if (!radios.length || !customDateInput) return;
    
    radios.forEach(function(radio) {
        radio.addEventListener('change', function() {
            var labels = document.querySelectorAll('.radio-group label');
            labels.forEach(function(l) { l.classList.remove('active'); });
            this.closest('label').classList.add('active');
            
            if (this.value === 'custom') {
                customDateInput.style.display = 'block';
                if (!customDateInput.value) {
                    var today = new Date().toISOString().split('T')[0];
                    customDateInput.value = today;
                }
            } else {
                customDateInput.style.display = 'none';
            }
        });
    });
}

// ============================================================
// TAB SWITCHING
// ============================================================

/**
 * Initialize tab switching functionality
 * Tabs are defined in the HTML with data-tab attributes
 */
function initTabSwitching() {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tabId = this.dataset.tab;
            
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(function(el) {
                el.classList.remove('active');
            });
            
            // Remove active classes from all tab buttons
            document.querySelectorAll('.tab-btn').forEach(function(el) {
                el.classList.remove('active');
                el.classList.remove('danger-active');
                el.classList.remove('photo-active');
            });
            
            // Show selected tab content
            document.getElementById(tabId).classList.add('active');
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Special styling for specific tabs
            if (tabId === 'tabDelete') {
                this.classList.add('danger-active');
            }
            if (tabId === 'tabPhoto') {
                this.classList.add('photo-active');
            }
        });
    });
}

// ============================================================
// GET DATABASE FOR ENVIRONMENT
// ============================================================

/**
 * Get Firestore instance for a given environment
 * @param {string} env - 'PROD' or 'DEV'
 * @returns {object} Firestore instance or null if not available
 */
function getDbForEnv(env) {
    if (env === 'PROD') {
        return window.prodDb || null;
    } else if (env === 'DEV') {
        return window.devDb || null;
    }
    return null;
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.log = log;
window.logStep = logStep;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.initDateToggle = initDateToggle;
window.initTabSwitching = initTabSwitching;
window.getDbForEnv = getDbForEnv;

// ============================================================
// AUTO-INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    initDateToggle();
    initTabSwitching();
    console.log('[UTIL-CORE] Auto-init complete');
});

console.log('[UTIL-CORE] v1.01 loaded');

/*
FILE: js/util-core.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: Correct storageBucket for PROD: sicc-ryder-cup.firebasestorage.app
   - FIXED: Correct storageBucket for DEV: sicc-ryder-cup-dev.firebasestorage.app
   - PRESERVED: All existing functionality from v1.00
DEPENDS ON: Firebase (firebase-app-compat, firebase-firestore-compat, firebase-storage-compat)
STATUS: Ready for integration
*/