/*
FILE: js/ticker.js
VERSION: 1.03
KEY CHANGES:
   - FIXED: Removed "Loading scores..." text during initial page load
   - Empty state now returns '&nbsp;' (invisible placeholder)
   - Prevents jarring flash of text before player data loads
   - Affects real-game.html and view-game.html (preview-game.html is deprecated)
   - All other functionality identical to v1.02
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/

var Ticker = (function() {
    
    // Private variables
    var tickerContainer = null;
    var tickerContent = null;
    var isInitialized = false;
    var currentPlayers = [];
    var getPlayerScoreCallback = null;
    
    // ============================================================
    // Format a single player's score for display
    // ============================================================
    
    function formatScore(score) {
        if (score > 0) return '+' + score;
        if (score < 0) return score.toString();
        return 'E';
    }
    
    // ============================================================
    // Build the ticker HTML from player data
    // Uses 3 sets for seamless looping on all screen sizes
    // Separator (•) appears between players AND between sets
    // ============================================================
    
    function buildTickerHTML() {
        // Empty state - invisible placeholder (no text flash)
        if (!currentPlayers.length) return '&nbsp;';
        
        var parts = [];
        for (var i = 0; i < currentPlayers.length; i++) {
            var player = currentPlayers[i];
            var score = 0;
            
            // Get score from callback if provided
            if (getPlayerScoreCallback) {
                score = getPlayerScoreCallback(player);
            }
            
            var scoreDisplay = formatScore(score);
            parts.push('<span style="color:#ffffff; font-weight:500;">' + player.label + '</span> <span style="color:#4caf50;">' + scoreDisplay + '</span>');
        }
        
        var separator = '   <span style="color:#555555;">•</span>   ';
        var singleSet = parts.join(separator);
        
        // Three sets with separators between them for seamless looping
        return singleSet + separator + singleSet + separator + singleSet;
    }
    
    // ============================================================
    // Update the ticker display
    // ============================================================
    
    function update() {
        if (!tickerContent || !isInitialized) return;
        tickerContent.innerHTML = buildTickerHTML();
    }
    
    // ============================================================
    // Initialize the ticker
    // ============================================================
    
    function init(containerId, contentId, playerScoreCallback) {
        tickerContainer = document.getElementById(containerId);
        tickerContent = document.getElementById(contentId);
        getPlayerScoreCallback = playerScoreCallback || null;
        
        if (!tickerContainer || !tickerContent) {
            console.warn('Ticker: Container or content element not found');
            return false;
        }
        
        isInitialized = true;
        
        // Ensure the parent container has the correct CSS for scrolling
        if (tickerContainer) {
            tickerContainer.style.cssText = `
                width: 100%;
                overflow: hidden;
                background: #111111;
                border-radius: 0;
                margin-bottom: 12px;
                white-space: nowrap;
                border-top: 1px solid #2a2a2a;
                border-bottom: 1px solid #2a2a2a;
                padding: 8px 0;
            `;
        }
        
        if (tickerContent) {
            tickerContent.style.cssText = `
                display: inline-block;
                white-space: nowrap;
                font-family: system-ui, -apple-system, 'Helvetica Neue', sans-serif;
                font-size: 0.8rem;
                letter-spacing: 0.3px;
                font-weight: 400;
                animation: tickerScroll 60s linear infinite;
                padding-right: 100%;
            `;
        }
        
        // Add animation styles if not already present
        if (!document.getElementById('ticker-styles')) {
            var style = document.createElement('style');
            style.id = 'ticker-styles';
            style.textContent = `
                @keyframes tickerScroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-66.66%); }
                }
                .ticker-container:hover .ticker-content {
                    animation-play-state: paused;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Initialize with invisible placeholder (no "Loading scores..." flash)
        update();
        
        return true;
    }
    
    // ============================================================
    // Set players data
    // ============================================================
    
    function setPlayers(players) {
        currentPlayers = players;
        update();
    }
    
    // ============================================================
    // Update a single player's score and refresh display
    // ============================================================
    
    function updatePlayerScore(playerLabel, newScore) {
        if (!currentPlayers.length) return false;
        
        for (var i = 0; i < currentPlayers.length; i++) {
            if (currentPlayers[i].label === playerLabel || currentPlayers[i].name === playerLabel) {
                // Score will be retrieved via callback on next update
                update();
                return true;
            }
        }
        return false;
    }
    
    // ============================================================
    // Force refresh (call after scores change)
    // ============================================================
    
    function refresh() {
        update();
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        init: init,
        setPlayers: setPlayers,
        updatePlayerScore: updatePlayerScore,
        refresh: refresh,
        update: update
    };
    
})();

/*
FILE: js/ticker.js
VERSION: 1.03
KEY CHANGES:
   - FIXED: Removed "Loading scores..." text during initial page load
   - Empty state now returns '&nbsp;' (invisible placeholder)
   - Prevents jarring flash of text before player data loads
   - Affects real-game.html and view-game.html (preview-game.html is deprecated)
   - All other functionality identical to v1.02
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/