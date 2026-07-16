/*
FILE: js/load-game.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - REMOVED: "load everything" fallback for unknown pages
   - ADDED: Error logging when page is not recognized
   - CHANGED: Unknown pages now load CORE SCRIPTS ONLY (no game modules)
   - FIXED: Page detection now handles paths without .html extension
   - REASON: Fallback was causing VIEW to load real-game-init.js
   - REASON: Fallback masked the root cause (path detection mismatch)
DEPENDS ON: js/versions.json
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.LOAD_GAME_VERSION = "1.03";

// ============================================================
// Version of versions.json - bump this when versions.json changes
// ============================================================
var VERSIONS_JSON_VERSION = "1.00";

console.log("[LOAD-GAME] Initializing v1.03");

// ============================================================
// Helper: Load script with cache-busting
// ============================================================
function loadScript(src, callback) {
    var script = document.createElement('script');
    script.src = src;
    script.onload = function() {
        if (callback) callback(null);
    };
    script.onerror = function() {
        if (callback) callback(new Error('Failed to load: ' + src));
    };
    document.head.appendChild(script);
}

// ============================================================
// Helper: Load scripts sequentially
// ============================================================
function loadScriptsSequentially(scripts, index, callback) {
    if (index >= scripts.length) {
        if (callback) callback(null);
        return;
    }
    
    var entry = scripts[index];
    var src = entry.src;
    
    console.log('[LOAD-GAME] Loading:', src);
    
    loadScript(src, function(err) {
        if (err) {
            console.warn('[LOAD-GAME] Failed to load:', src, err.message);
            // Continue anyway - don't block
        }
        loadScriptsSequentially(scripts, index + 1, callback);
    });
}

// ============================================================
// Helper: Show error message on page
// ============================================================
function showLoadError(message) {
    var debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML = '❌ ' + message;
        debugDiv.style.color = '#ff6b6b';
        debugDiv.style.padding = '20px';
        debugDiv.style.textAlign = 'center';
    }
}

// ============================================================
// v1.03: Page-specific script lists - NO FALLBACK
// ============================================================

function getPageScripts() {
    var pathname = window.location.pathname;
    var page = pathname.split('/').pop() || '';
    
    // Remove .html extension if present
    var pageName = page.replace(/\.html$/, '');
    
    console.log('[LOAD-GAME] Detected page:', pageName, '(full path:', pathname + ')');
    
    // ============================================================
    // Core scripts (loaded on ALL pages)
    // ============================================================
    var coreScripts = [
        'firebase-config.js',
        'settings.js',
        'modal.js',
        'waiting-screen.js',
        'session.js'
    ];
    
    // ============================================================
    // Game engine scripts (loaded on game pages)
    // ============================================================
    var gameEngineScripts = [
        'game-order.js',
        'game-data.js',
        'game-match.js',
        'game-team.js',
        'game-stroke.js',
        'game-scorecard.js',
        'game-ui.js',
        'game-loader.js'
    ];
    
    // ============================================================
    // Core game modules (loaded on game pages)
    // ============================================================
    var coreGameScripts = [
        'history-record.js',
        'sign-card.js',
        'hcp-adjust.js',
        'celebration-photo.js',
        'ticker.js',
        'wrv.js'
    ];
    
    // ============================================================
    // REAL-GAME only scripts
    // ============================================================
    var realGameScripts = [
        'real-game-state.js',
        'real-game-utils.js',
        'real-game-cascade.js',
        'real-game-save.js',
        'real-game-ui.js',
        'real-game-nav.js',
        'real-game-init.js',
        'real-game-main.js'
    ];
    
    // ============================================================
    // VIEW-HISTORY only scripts
    // ============================================================
    var viewHistoryScripts = [
        'firebase-retry.js'
    ];
    
    // ============================================================
    // Determine which scripts to load based on page
    // ============================================================
    var scripts = [];
    
    // Always load core
    scripts = scripts.concat(coreScripts);
    
    // ============================================================
    // v1.03: NO FALLBACK - Unknown pages load CORE ONLY
    // ============================================================
    if (pageName === 'real-game' || pageName === 'real-game') {
        console.log('[LOAD-GAME] ✅ REAL-GAME page detected');
        scripts = scripts.concat(gameEngineScripts);
        scripts = scripts.concat(coreGameScripts);
        scripts = scripts.concat(realGameScripts);
    } else if (pageName === 'view-game' || pageName === 'view-game') {
        console.log('[LOAD-GAME] ✅ VIEW-GAME page detected');
        scripts = scripts.concat(gameEngineScripts);
        scripts = scripts.concat(coreGameScripts);
        // NO real-game-*.js - VIEW only needs display modules
    } else if (pageName === 'view-history' || pageName === 'view-history') {
        console.log('[LOAD-GAME] ✅ VIEW-HISTORY page detected');
        scripts = scripts.concat(gameEngineScripts);
        scripts = scripts.concat(coreGameScripts);
        scripts = scripts.concat(viewHistoryScripts);
    } else if (pageName === 'post-game' || pageName === 'post-game') {
        console.log('[LOAD-GAME] ✅ POST-GAME page detected');
        scripts = scripts.concat(coreGameScripts);
        // Post-game only needs core + sign-card
    } else {
        // v1.03: NO FALLBACK - Log error and load CORE ONLY
        console.error('[LOAD-GAME] ❌ UNKNOWN PAGE DETECTED:', pageName);
        console.error('[LOAD-GAME] ⚠️ Full pathname:', pathname);
        console.error('[LOAD-GAME] ⚠️ Loading CORE SCRIPTS ONLY (no game modules)');
        console.error('[LOAD-GAME] ⚠️ This may cause the page to not function correctly');
        // Load ONLY core scripts - no game modules
    }
    
    return scripts;
}

// ============================================================
// Main: Load all game scripts
// ============================================================
function loadAllGameScripts(callback) {
    console.log('[LOAD-GAME] Loading all game scripts...');
    console.log('[LOAD-GAME] versions.json version:', VERSIONS_JSON_VERSION);
    
    // v1.01: Use fetch() with cache-busting
    fetch('js/versions.json?v=' + VERSIONS_JSON_VERSION)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(versions) {
            window.VERSIONS = versions;
            console.log('[LOAD-GAME] versions.json loaded (v' + VERSIONS_JSON_VERSION + ')');
            
            // v1.03: Get page-specific script names (NO FALLBACK)
            var scriptNames = getPageScripts();
            
            var scriptList = [];
            
            // Build script list with versions
            for (var i = 0; i < scriptNames.length; i++) {
                var name = scriptNames[i];
                var version = versions[name] || '1.00';
                scriptList.push({
                    name: name,
                    src: 'js/' + name + '?v=' + version
                });
            }
            
            console.log('[LOAD-GAME] Loading', scriptList.length, 'scripts for page:', window.location.pathname.split('/').pop());
            
            // Load scripts sequentially
            loadScriptsSequentially(scriptList, 0, function(err) {
                if (err) {
                    console.warn('[LOAD-GAME] Some scripts failed to load:', err.message);
                }
                console.log('[LOAD-GAME] All scripts loaded');
                if (callback) callback(null);
            });
        })
        .catch(function(err) {
            console.error('[LOAD-GAME] Failed to load versions.json:', err.message);
            showLoadError('Failed to load versions.json. Please refresh.');
            if (callback) callback(err);
        });
}

// ============================================================
// Auto-start if DOM is ready
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof window._LOAD_GAME_AUTO === 'undefined' || window._LOAD_GAME_AUTO === true) {
            loadAllGameScripts();
        }
    });
} else {
    if (typeof window._LOAD_GAME_AUTO === 'undefined' || window._LOAD_GAME_AUTO === true) {
        loadAllGameScripts();
    }
}

window.loadAllGameScripts = loadAllGameScripts;
window.loadScript = loadScript;
window.loadScriptsSequentially = loadScriptsSequentially;
window.VERSIONS_JSON_VERSION = VERSIONS_JSON_VERSION;

/*
FILE: js/load-game.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - REMOVED: "load everything" fallback for unknown pages
   - ADDED: Error logging when page is not recognized
   - CHANGED: Unknown pages now load CORE SCRIPTS ONLY (no game modules)
   - FIXED: Page detection now handles paths without .html extension
   - REASON: Fallback was causing VIEW to load real-game-init.js
   - REASON: Fallback masked the root cause (path detection mismatch)
DEPENDS ON: js/versions.json
STATUS: Ready for integration
*/