/*
FILE: js/util-core.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: localStorage log backup (persists across page refreshes)
   - ADDED: copyLogToClipboard() - copies 100 latest messages to clipboard
   - ADDED: downloadLogFile() - downloads ALL log messages to SRC-YYMMDD-HHMM.log
   - ADDED: getLogEntries() - returns array of log entries
   - ADDED: getLogCount() - returns number of log entries
   - ADDED: clearLogs() - clears all logs from memory and localStorage
   - CHANGED: log() function now also saves to localStorage
   - CHANGED: log() function now stores full timestamp for accurate logs
   - PRESERVED: All existing functionality from v1.01
DEPENDS ON: Firebase (firebase-app-compat, firebase-firestore-compat, firebase-storage-compat)
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_CORE_VERSION = "1.02";
console.log("[UTIL-CORE] Initializing v1.02");

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
// LOG STORAGE
// ============================================================

var LOG_STORAGE_KEY = 'appLogs';
var MAX_STORED_LOGS = 2000;

/**
 * Get all log entries from localStorage
 * @returns {Array} Array of log entry objects
 */
function getStoredLogs() {
    try {
        var data = localStorage.getItem(LOG_STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch(e) {
        console.warn('[UTIL-CORE] Failed to read logs from localStorage:', e);
    }
    return [];
}

/**
 * Save log entries to localStorage
 * @param {Array} logs - Array of log entry objects
 */
function saveStoredLogs(logs) {
    try {
        // Keep only the most recent entries
        if (logs.length > MAX_STORED_LOGS) {
            logs = logs.slice(-MAX_STORED_LOGS);
        }
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch(e) {
        console.warn('[UTIL-CORE] Failed to save logs to localStorage:', e);
    }
}

/**
 * Add a log entry to localStorage
 * @param {string} message - The log message
 * @param {string} type - Log type (error, success, warning, info, diff, match)
 * @param {string} timestamp - ISO timestamp
 */
function addStoredLog(message, type, timestamp) {
    var logs = getStoredLogs();
    logs.push({
        message: message,
        type: type || 'info',
        timestamp: timestamp || new Date().toISOString()
    });
    saveStoredLogs(logs);
}

// ============================================================
// LOGGING FUNCTIONS
// ============================================================

/**
 * Log a message to console and the UI log container
 * Also saves to localStorage for persistence
 * @param {string} message - The message to log
 * @param {string} type - 'error', 'success', 'warning', 'info', 'diff', 'match'
 */
function log(message, type) {
    var now = new Date();
    var timeStr = now.toLocaleTimeString();
    var isoStr = now.toISOString();
    
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
        entry.innerHTML = '<span style="color:' + color + ';">[' + timeStr + '] ' + message + '</span>';
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }
    
    // Save to localStorage for persistence
    addStoredLog(message, type, isoStr);
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
// LOG MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Get all log entries (from localStorage)
 * @returns {Array} Array of log entry objects with message, type, timestamp
 */
function getLogEntries() {
    return getStoredLogs();
}

/**
 * Get the number of stored log entries
 * @returns {number} Count of log entries
 */
function getLogCount() {
    return getStoredLogs().length;
}

/**
 * Get the latest N log entries
 * @param {number} count - Number of entries to return (default: 100)
 * @returns {Array} Array of log entry objects
 */
function getLatestLogs(count) {
    var logs = getStoredLogs();
    count = count || 100;
    return logs.slice(-count);
}

/**
 * Copy the latest 100 log messages to clipboard
 * @returns {boolean} True if successful
 */
function copyLogToClipboard() {
    var logs = getLatestLogs(100);
    if (logs.length === 0) {
        log('No logs to copy', 'warning');
        return false;
    }
    
    var text = '=== SICC Ryder Cup Logs (' + logs.length + ' entries) ===\n';
    text += '=== Generated: ' + new Date().toISOString() + ' ===\n\n';
    
    logs.forEach(function(entry) {
        var time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Unknown';
        var typeLabel = entry.type ? entry.type.toUpperCase() : 'INFO';
        text += '[' + time + '] [' + typeLabel + '] ' + entry.message + '\n';
    });
    
    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            log('✅ ' + logs.length + ' log entries copied to clipboard', 'success');
            return true;
        }).catch(function(err) {
            log('❌ Failed to copy logs: ' + err.message, 'error');
            return false;
        });
    } else {
        // Fallback for older browsers
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            log('✅ ' + logs.length + ' log entries copied to clipboard (fallback)', 'success');
            document.body.removeChild(textarea);
            return true;
        } catch(e) {
            log('❌ Failed to copy logs: ' + e.message, 'error');
            document.body.removeChild(textarea);
            return false;
        }
    }
}

/**
 * Download ALL log messages to a file
 * File name: SRC-YYMMDD-HHMM.log
 * @returns {boolean} True if successful
 */
function downloadLogFile() {
    var logs = getStoredLogs();
    if (logs.length === 0) {
        log('No logs to download', 'warning');
        return false;
    }
    
    // Build file content
    var text = '=== SICC Ryder Cup Log File ===\n';
    text += '=== Total Entries: ' + logs.length + ' ===\n';
    text += '=== Generated: ' + new Date().toISOString() + ' ===\n';
    text += '=== ' + '='.repeat(50) + ' ===\n\n';
    
    logs.forEach(function(entry) {
        var time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Unknown';
        var typeLabel = entry.type ? entry.type.toUpperCase() : 'INFO';
        text += '[' + time + '] [' + typeLabel + '] ' + entry.message + '\n';
    });
    
    // Generate filename: SRC-YYMMDD-HHMM.log
    var now = new Date();
    var y = String(now.getFullYear()).slice(-2);
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var h = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var filename = 'SRC-' + y + m + d + '-' + h + min + '.log';
    
    // Create download
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    log('✅ ' + logs.length + ' log entries downloaded to ' + filename, 'success');
    return true;
}

/**
 * Clear all logs (memory, UI, and localStorage)
 * @returns {boolean} True if successful
 */
function clearLogs() {
    // Clear UI
    var logDiv = document.getElementById('log');
    if (logDiv) {
        logDiv.innerHTML = 'Logs cleared.';
    }
    
    // Clear localStorage
    try {
        localStorage.removeItem(LOG_STORAGE_KEY);
    } catch(e) {
        console.warn('[UTIL-CORE] Failed to clear logs from localStorage:', e);
    }
    
    log('🧹 All logs cleared', 'info');
    return true;
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
window.getLogEntries = getLogEntries;
window.getLogCount = getLogCount;
window.getLatestLogs = getLatestLogs;
window.copyLogToClipboard = copyLogToClipboard;
window.downloadLogFile = downloadLogFile;
window.clearLogs = clearLogs;
window.LOG_STORAGE_KEY = LOG_STORAGE_KEY;

// ============================================================
// AUTO-INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    initDateToggle();
    initTabSwitching();
    
    // Restore logs from localStorage to UI
    var logs = getStoredLogs();
    if (logs.length > 0) {
        var logDiv = document.getElementById('log');
        if (logDiv) {
            // Clear initial "Ready" message
            logDiv.innerHTML = '';
            // Show last 50 logs in UI
            var recentLogs = logs.slice(-50);
            recentLogs.forEach(function(entry) {
                var time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Unknown';
                var color = 
                    entry.type === 'error' ? '#ff6b6b' : 
                    entry.type === 'success' ? '#4caf50' : 
                    entry.type === 'warning' ? '#ffaa44' : 
                    entry.type === 'diff' ? '#ff6b6b' : 
                    entry.type === 'match' ? '#4caf50' : 
                    '#ffaa44';
                var div = document.createElement('div');
                div.className = 'log-entry';
                div.innerHTML = '<span style="color:' + color + ';">[' + time + '] ' + entry.message + '</span>';
                logDiv.appendChild(div);
            });
            logDiv.scrollTop = logDiv.scrollHeight;
            console.log('[UTIL-CORE] Restored ' + recentLogs.length + ' logs from localStorage');
        }
    }
    
    console.log('[UTIL-CORE] Auto-init complete');
});

console.log('[UTIL-CORE] v1.02 loaded');

/*
FILE: js/util-core.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: localStorage log backup (persists across page refreshes)
   - ADDED: copyLogToClipboard() - copies 100 latest messages to clipboard
   - ADDED: downloadLogFile() - downloads ALL log messages to SRC-YYMMDD-HHMM.log
   - ADDED: getLogEntries() - returns array of log entries
   - ADDED: getLogCount() - returns number of log entries
   - ADDED: clearLogs() - clears all logs from memory and localStorage
   - CHANGED: log() function now also saves to localStorage
   - CHANGED: log() function now stores full timestamp for accurate logs
   - PRESERVED: All existing functionality from v1.01
DEPENDS ON: Firebase (firebase-app-compat, firebase-firestore-compat, firebase-storage-compat)
STATUS: Ready for integration
*/