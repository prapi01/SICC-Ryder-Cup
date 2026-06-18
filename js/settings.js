/*
FILE: js/settings.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared settings manager for user preferences
   - Manages zoom enable/disable setting
   - Saves to localStorage
   - Applies viewport meta tag dynamically
   - Immediate effect when toggled
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/

var AppSettings = (function() {
    
    var SETTINGS_KEY = 'app_settings';
    
    var defaults = {
        enableZoom: false
    };
    
    // ============================================================
    // Get settings from localStorage
    // ============================================================
    
    function getSettings() {
        var stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            try {
                var settings = JSON.parse(stored);
                // Merge with defaults for any missing keys
                for (var key in defaults) {
                    if (settings[key] === undefined) {
                        settings[key] = defaults[key];
                    }
                }
                return settings;
            } catch(e) {
                console.warn('[Settings] Failed to parse settings, using defaults');
                return JSON.parse(JSON.stringify(defaults));
            }
        }
        return JSON.parse(JSON.stringify(defaults));
    }
    
    // ============================================================
    // Save settings to localStorage
    // ============================================================
    
    function saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    
    // ============================================================
    // Get zoom enabled status
    // ============================================================
    
    function getZoomEnabled() {
        var settings = getSettings();
        return settings.enableZoom === true;
    }
    
    // ============================================================
    // Set zoom enabled status - IMMEDIATE EFFECT
    // ============================================================
    
    function setZoomEnabled(enabled) {
        var settings = getSettings();
        settings.enableZoom = enabled === true;
        saveSettings(settings);
        applyZoomSetting();
        console.log('[Settings] Zoom ' + (enabled ? 'ENABLED' : 'DISABLED'));
    }
    
    // ============================================================
    // Apply zoom setting to viewport meta tag - IMMEDIATE
    // ============================================================
    
    function applyZoomSetting() {
        var viewport = document.querySelector('meta[name=viewport]');
        if (!viewport) {
            console.warn('[Settings] No viewport meta tag found');
            return;
        }
        
        var zoomEnabled = getZoomEnabled();
        
        if (zoomEnabled) {
            // Allow zoom
            viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=yes';
            document.body.classList.remove('no-zoom');
        } else {
            // Disable zoom
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
            document.body.classList.add('no-zoom');
        }
        
        console.log('[Settings] Zoom applied:', zoomEnabled ? 'ENABLED' : 'DISABLED');
    }
    
    // ============================================================
    // Toggle zoom - convenience function
    // ============================================================
    
    function toggleZoom() {
        var current = getZoomEnabled();
        setZoomEnabled(!current);
        return !current;
    }
    
    // ============================================================
    // Initialize - apply settings on page load
    // ============================================================
    
    function init() {
        applyZoomSetting();
        console.log('[Settings] Initialized. Zoom:', getZoomEnabled() ? 'ENABLED' : 'DISABLED');
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        getSettings: getSettings,
        saveSettings: saveSettings,
        getZoomEnabled: getZoomEnabled,
        setZoomEnabled: setZoomEnabled,
        applyZoomSetting: applyZoomSetting,
        toggleZoom: toggleZoom,
        init: init
    };
    
})();

// Make available globally
window.AppSettings = AppSettings;

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        AppSettings.init();
    });
} else {
    AppSettings.init();
}

/*
FILE: js/settings.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared settings manager for user preferences
   - Manages zoom enable/disable setting
   - Saves to localStorage
   - Applies viewport meta tag dynamically
   - Immediate effect when toggled
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/