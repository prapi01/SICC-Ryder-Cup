/*
FILE: js/waiting-screen.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared grey icon waiting screen module
   - Provides showWaitingScreen() and hideWaitingScreen()
   - Used during Firestore write operations (DELETE, UPDATE, CREATE)
   - Consistent grey icon style across all pages
   - Optional custom message parameter
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/

var WaitingScreen = (function() {
    
    // ============================================================
    // Show grey icon overlay
    // ============================================================
    
    function show(message) {
        // Remove any existing overlay
        hide();
        
        var overlay = document.createElement('div');
        overlay.id = 'waitingScreenOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #000000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        `;
        overlay.innerHTML = `
            <div style="font-size:5rem; filter:grayscale(100%); opacity:0.6;">⛳</div>
            ${message ? '<div style="color:#888; font-size:0.8rem; margin-top:16px; letter-spacing:1px;">' + message + '</div>' : ''}
        `;
        document.body.appendChild(overlay);
        return overlay;
    }
    
    // ============================================================
    // Hide grey icon overlay
    // ============================================================
    
    function hide() {
        var existing = document.getElementById('waitingScreenOverlay');
        if (existing) {
            existing.remove();
        }
    }
    
    // ============================================================
    // Check if overlay is visible
    // ============================================================
    
    function isVisible() {
        return document.getElementById('waitingScreenOverlay') !== null;
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        show: show,
        hide: hide,
        isVisible: isVisible
    };
    
})();

// Make available globally
window.WaitingScreen = WaitingScreen;

/*
FILE: js/waiting-screen.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared grey icon waiting screen module
   - Provides showWaitingScreen() and hideWaitingScreen()
   - Used during Firestore write operations (DELETE, UPDATE, CREATE)
   - Consistent grey icon style across all pages
   - Optional custom message parameter
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/