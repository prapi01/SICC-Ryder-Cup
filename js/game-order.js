/*
FILE: js/game-order.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Centralized module for managing play order and display order
   - Provides single source of truth for ALL hole order conversions
   - All other files will use this module instead of re-implementing logic
   - Supports any starting hole (1-18) for shotgun starts
   - Exposes: setStartingHole(), getPlayOrder(), getPlayPosition(), getNaturalHole(), getFirstHole(), getLastHole(), getRemainingHoles()
DEPENDS ON: None (pure functions, uses cache from GameLoader if available)
STATUS: Ready for integration
*/

var GameOrder = (function() {
    
    // Private variables
    var _startingHole = 1;
    var _playOrder = null;
    
    // ============================================================
    // Build play order array based on starting hole
    // Example: startingHole=10 → [10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]
    // ============================================================
    function buildPlayOrder(startingHole) {
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    // ============================================================
    // Update starting hole and rebuild play order
    // Should be called when game loads or starting hole changes
    // ============================================================
    function setStartingHole(hole) {
        if (hole === _startingHole && _playOrder !== null) return;
        _startingHole = hole;
        _playOrder = buildPlayOrder(hole);
        console.log("[GAME-ORDER] startingHole set to:", hole, "playOrder:", _playOrder);
    }
    
    // ============================================================
    // Get starting hole
    // ============================================================
    function getStartingHole() {
        return _startingHole;
    }
    
    // ============================================================
    // Get the play order array (0-17 → natural hole numbers)
    // ============================================================
    function getPlayOrder() {
        if (_playOrder === null) {
            // Try to get startingHole from GameLoader cache
            if (typeof GameLoader !== 'undefined' && GameLoader.getLocalCache) {
                var cache = GameLoader.getLocalCache();
                if (cache && cache.startingHole) {
                    setStartingHole(cache.startingHole);
                }
            }
        }
        return _playOrder || buildPlayOrder(1);
    }
    
    // ============================================================
    // Convert natural hole number (1-18) to play position (0-17)
    // ============================================================
    function getPlayPosition(naturalHole) {
        var playOrder = getPlayOrder();
        var pos = playOrder.indexOf(naturalHole);
        return pos !== -1 ? pos : naturalHole - 1;
    }
    
    // ============================================================
    // Convert play position (0-17) to natural hole number (1-18)
    // ============================================================
    function getNaturalHole(playPosition) {
        var playOrder = getPlayOrder();
        return playOrder[playPosition] || 0;
    }
    
    // ============================================================
    // Get the first hole played (natural hole number)
    // ============================================================
    function getFirstHole() {
        return getNaturalHole(0);
    }
    
    // ============================================================
    // Get the last hole played (natural hole number)
    // ============================================================
    function getLastHole() {
        return getNaturalHole(17);
    }
    
    // ============================================================
    // Get remaining holes count after a given play position
    // ============================================================
    function getRemainingHoles(playPosition) {
        return 17 - playPosition;
    }
    
    // ============================================================
    // Get display holes array for scorecard (natural order or play order)
    // ============================================================
    function getDisplayHoles(displayMode) {
        if (displayMode === "natural") {
            var natural = [];
            for (var i = 1; i <= 18; i++) natural.push(i);
            return natural;
        } else {
            return getPlayOrder();
        }
    }
    
    // ============================================================
    // Initialize from GameLoader cache if available
    // ============================================================
    function initFromCache() {
        if (typeof GameLoader !== 'undefined' && GameLoader.getLocalCache) {
            var cache = GameLoader.getLocalCache();
            if (cache && cache.startingHole) {
                setStartingHole(cache.startingHole);
                return true;
            }
        }
        return false;
    }
    
    // ============================================================
    // Public API
    // ============================================================
    return {
        setStartingHole: setStartingHole,
        getStartingHole: getStartingHole,
        getPlayOrder: getPlayOrder,
        getPlayPosition: getPlayPosition,
        getNaturalHole: getNaturalHole,
        getFirstHole: getFirstHole,
        getLastHole: getLastHole,
        getRemainingHoles: getRemainingHoles,
        getDisplayHoles: getDisplayHoles,
        initFromCache: initFromCache
    };
    
})();

// Make available globally
window.GameOrder = GameOrder;

/*
FILE: js/game-order.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Centralized module for managing play order and display order
   - Provides single source of truth for ALL hole order conversions
   - All other files will use this module instead of re-implementing logic
   - Supports any starting hole (1-18) for shotgun starts
   - Exposes: setStartingHole(), getPlayOrder(), getPlayPosition(), getNaturalHole(), getFirstHole(), getLastHole(), getRemainingHoles()
DEPENDS ON: None (pure functions, uses cache from GameLoader if available)
STATUS: Ready for integration
*/