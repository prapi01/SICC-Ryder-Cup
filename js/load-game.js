/*
FILE: js/load-game.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: Page-specific script lists (real-game, view-game, view-history, post-game)
   - REASON: VIEW was loading real-game-*.js scripts (real-game-init.js) causing editableFlight=1
   - REASON: Proper fix - each page loads ONLY the scripts it needs
   - CHANGED: loadAllGameScripts() now detects page and loads appropriate script list
   - PRESERVED: All loading logic from v1.01 unchanged
   - PRESERVED: fetch() for versions.json, cache-busting, error handling
DEPENDS ON: js/versions.json
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.LOAD_GAME_VERSION = "1.02";

// ============================================================
// Version of versions.json - bump this when versions.json changes
// ============================================================
var VERSIONS_JSON_VERSION = "1.00";

console.log("[LOAD-GAME] Initializing v1.02");

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
// v1.02: Page-specific script lists
// ============================================================

function getPageScripts() {
    var page = window.location.pathname.split('/').pop() || '';
    
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
    // Game engine scripts (loaded on ALL game pages)
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
    // Core game modules (loaded on ALL game pages)
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
    
    // Base: core + game engine + core game modules
    scripts = scripts.concat(coreScripts);
    scripts = scripts.concat(gameEngineScripts);
    scripts = scripts.concat(coreGameScripts);
    
    if (page === 'real-game.html') {
        console.log('[LOAD-GAME] Detected REAL-GAME page');
        scripts = scripts.concat(realGameScripts);
    } else if (page === 'view-game.html') {
        console.log('[LOAD-GAME] Detected VIEW-GAME page');
        // No real-game-*.js scripts - VIEW only needs display modules
    } else if (page === 'view-history.html') {
        console.log('[LOAD-GAME] Detected VIEW-HISTORY page');
        scripts = scripts.concat(viewHistoryScripts);
    } else if (page === 'post-game.html') {
        console.log('[LOAD-GAME] Detected POST-GAME page');
        // Post-game only needs core + sign-card
    } else {
        console.log('[LOAD-GAME] Detected UNKNOWN page:', page, '- loading all scripts');
        scripts = scripts.concat(realGameScripts);
        scripts = scripts.concat(viewHistoryScripts);
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
            
            // v1.02: Get page-specific script names
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
            
            console.log('[LOAD-GAME] Loading', scriptList.length, 'scripts for', window.location.pathname.split('/').pop());
            
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
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: Page-specific script lists (real-game, view-game, view-history, post-game)
   - REASON: VIEW was loading real-game-*.js scripts (real-game-init.js) causing editableFlight=1
   - REASON: Proper fix - each page loads ONLY the scripts it needs
   - CHANGED: loadAllGameScripts() now detects page and loads appropriate script list
   - PRESERVED: All loading logic from v1.01 unchanged
   - PRESERVED: fetch() for versions.json, cache-busting, error handling
DEPENDS ON: js/versions.json
STATUS: Ready for integration
*/