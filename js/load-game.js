/*
FILE: js/load-game.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: versions.json now loaded with fetch() instead of <script> tag
   - REASON: JSON files cannot be loaded with <script> tags (MIME type mismatch)
   - CHANGED: Uses fetch() for versions.json loading
   - PRESERVED: All loading logic unchanged
DEPENDS ON: js/versions.json
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.LOAD_GAME_VERSION = "1.01";

console.log("[LOAD-GAME] Initializing v1.01");

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
// Main: Load all game scripts
// ============================================================
function loadAllGameScripts(callback) {
    console.log('[LOAD-GAME] Loading all game scripts...');
    
    // v1.01: Use fetch() to load versions.json (JSON cannot be loaded with <script>)
    fetch('js/versions.json')
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(versions) {
            window.VERSIONS = versions;
            console.log('[LOAD-GAME] versions.json loaded');
            
            var scriptList = [];
            
            // Define the list of scripts to load (in dependency order)
            var scriptNames = [
                // Core (no dependencies)
                'firebase-config.js',
                'settings.js',
                'modal.js',
                'waiting-screen.js',
                'session.js',
                
                // Game engine
                'game-order.js',
                'game-data.js',
                'game-match.js',
                'game-team.js',
                'game-stroke.js',
                'game-scorecard.js',
                'game-ui.js',
                'game-loader.js',
                
                // Core game modules
                'history-record.js',
                'sign-card.js',
                'hcp-adjust.js',
                'celebration-photo.js',
                'ticker.js',
                'wrv.js',
                
                // Real game modules
                'real-game-state.js',
                'real-game-utils.js',
                'real-game-cascade.js',
                'real-game-save.js',
                'real-game-ui.js',
                'real-game-nav.js',
                'real-game-init.js',
                'real-game-main.js'
            ];
            
            // Build script list with versions
            for (var i = 0; i < scriptNames.length; i++) {
                var name = scriptNames[i];
                var version = versions[name] || '1.00';
                scriptList.push({
                    name: name,
                    src: 'js/' + name + '?v=' + version
                });
            }
            
            console.log('[LOAD-GAME] Loading', scriptList.length, 'scripts');
            
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

/*
FILE: js/load-game.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: versions.json now loaded with fetch() instead of <script> tag
   - REASON: JSON files cannot be loaded with <script> tags (MIME type mismatch)
   - CHANGED: Uses fetch() for versions.json loading
   - PRESERVED: All loading logic unchanged
DEPENDS ON: js/versions.json
STATUS: Ready for integration
*/