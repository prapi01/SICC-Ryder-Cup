/*
FILE: js/game-ui.js
VERSION: 5.05
KEY CHANGES from v5.04:
   - ADDED: Debug logging in updateTR() for value formatting
   - ADDED: Debug logging in renderPlayerCards() for bubble class
   - ADDED: Version exposure for console debugging
   - All existing functionality unchanged
DEPENDS ON: None (pure style injection and DOM manipulation)
STATUS: Ready for integration
*/

var GameUI = (function() {
    
    console.log("[GAME-UI] Initializing v5.05 with debug logging");
    
    // ============================================================
    // Constants
    // ============================================================
    
    var Z_INDEX = {
        STATUS_BUBBLE: 999,
        MODAL_OVERLAY: 10001,
        MODAL_CONTENT: 10002
    };
    
    // Track if styles have been applied
    var tightLayoutApplied = false;
    var buttonStylesApplied = false;
    var backgroundFixed = false;
    var holeHeaderRendered = false;
    var globalStylesApplied = false;
    
    // Track current state for UI updates
    var currentFlight = 1;
    var currentDisplayMode = "play";
    var currentHoleNumber = 1;
    
    // Store references to control bar elements for direct updates
    var controlBarElements = {
        pnBtn: null,
        flightBtn: null,
        saveBtn: null,
        prevBtn: null,
        nextBtn: null,
        holeDisplay: null,
        containerId: null
    };
    
    // Callback registry for shared UI events
    var eventCallbacks = {
        onSave: null,
        onMenu: null,
        onPrevHole: null,
        onNextHole: null,
        onToggleFlight: null,
        onToggleDisplay: null,
        onSignCard: null
    };
    
    // ============================================================
    // Helper: Create green square HTML for AS (delegates to GameScorecard)
    // ============================================================
    function getAsSquareHtml() {
        if (typeof GameScorecard !== 'undefined' && GameScorecard.getAsSquareHtml) {
            return GameScorecard.getAsSquareHtml();
        }
        return '<span class="as-square"></span>';
    }
    
    // ============================================================
    // Fix Background for All Pages
    // ============================================================
    
    function fixBackground() {
        if (backgroundFixed) return;
        
        var htmlElem = document.documentElement;
        htmlElem.style.margin = '0';
        htmlElem.style.padding = '0';
        htmlElem.style.backgroundColor = '#000000';
        htmlElem.style.minHeight = '100vh';
        
        document.body.style.margin = '0';
        document.body.style.padding = '20px';
        document.body.style.backgroundColor = '#000000';
        document.body.style.minHeight = '100vh';
        document.body.style.position = 'relative';
        
        var viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            var content = viewport.getAttribute('content');
            if (content && !content.includes('viewport-fit=cover')) {
                viewport.setAttribute('content', content + ', viewport-fit=cover');
            }
        }
        
        backgroundFixed = true;
    }
    
    // ============================================================
    // Apply Global UI Styles - SINGLE SOURCE OF TRUTH
    // ============================================================
    
    function applyGlobalStyles() {
        if (globalStylesApplied) return;
        if (document.getElementById('gameui-global-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'gameui-global-styles';
        style.textContent = `
            /* ============================================================
               PLAYER CARD STYLES
            ============================================================ */
            .player-card {
                background: #111111;
                border: 1px solid #333333;
                border-radius: 16px;
                padding: 14px;
                margin-bottom: 12px;
                position: relative;
            }
            
            .player-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            
            .player-name {
                font-size: 1rem;
                font-weight: 600;
            }
            
            .player-handicap {
                background: #1a3a1a;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                margin-left: 8px;
            }
            
            .score-control {
                display: flex;
                gap: 12px;
                align-items: center;
            }
            
            .score-btn {
                background: #1a3a1a;
                border: none;
                width: 38px;
                height: 38px;
                border-radius: 30px;
                font-size: 1.1rem;
                color: #fff;
                cursor: pointer;
            }
            
            .score-btn:active {
                transform: scale(0.95);
            }
            
            .score-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .score-value {
                font-size: 1.1rem;
                font-weight: 700;
                min-width: 38px;
                text-align: center;
                background: #1a1a1a;
                padding: 5px 0;
                border-radius: 30px;
            }
            
            /* ============================================================
               BUBBLE STYLES
            ============================================================ */
            .bubbles {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: clamp(4px, 1.5vw, 10px);
                margin-top: 10px;
            }
            
            .bubble {
                white-space: nowrap;
                text-align: center;
                padding: clamp(3px, 1.2vh, 8px) clamp(2px, 1vw, 6px);
                border-radius: clamp(12px, 3vw, 24px);
                font-size: clamp(0.7rem, 3.8vw, 0.9rem);
                font-weight: 600;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .bubble-green {
                background: #1a3a1a;
                color: #4caf50;
                border: 1px solid #4caf50;
            }
            .bubble-red {
                background: #3a1a1a;
                color: #ff6b6b;
                border: 1px solid #ff6b6b;
            }
            .bubble-grey {
                background: #2a2a2a;
                color: #888;
                border: 1px solid #444;
            }
            .bubble-gold {
                background: #1a3a1a;
                color: #ffaa44;
                border: 2px solid #ffaa44;
                font-weight: 600;
            }
            .bubble-loss-clinch {
                background: #3a1a1a;
                color: #ffffff;
                border: 2px solid #ffffff;
                font-weight: 600;
            }
            
            .as-square {
                display: inline-block;
                width: 16px;
                height: 16px;
                background-color: #4caf50;
                border-radius: 3px;
                vertical-align: middle;
                margin-left: 4px;
                margin-top: -2px;
            }
            
            @media (max-width: 380px) {
                .bubble { font-size: 0.7rem; padding: 4px 2px; }
                .bubbles { gap: 4px; }
                .as-square { width: 14px; height: 14px; }
            }
            
            @media (min-width: 500px) {
                .bubbles { gap: 12px; }
                .bubble { font-size: 0.9rem; padding: 8px 8px; border-radius: 28px; }
                .as-square { width: 18px; height: 18px; }
            }
            
            /* ============================================================
               COMPACT HEADER BUTTONS
            ============================================================ */
            .compact-header {
                display: grid;
                grid-template-columns: auto 1fr auto;
                align-items: center;
                gap: clamp(6px, 2vw, 12px);
                margin-bottom: 15px;
                width: 100%;
            }
            
            .compact-pn-btn, .compact-prev-btn, .compact-next-btn {
                border-radius: 30px !important;
                background: #1a3a1a !important;
                border: 1px solid #4caf50 !important;
                color: #4caf50 !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            
            .compact-flight-btn, .compact-save-btn {
                border-radius: 30px !important;
                background: #1a3a1a !important;
                border: 1px solid #4caf50 !important;
                color: #4caf50 !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                text-align: center !important;
                white-space: nowrap !important;
            }
            
            .compact-nav-group {
                display: flex;
                align-items: center;
                gap: clamp(4px, 1.5vw, 8px);
                flex-shrink: 0;
            }
            
            .compact-hole-display {
                font-size: clamp(1rem, 4vw, 1.2rem);
                font-weight: 700;
                color: #4caf50;
                min-width: clamp(32px, 8vw, 44px);
                text-align: center;
            }
            
            .compact-prev-btn:disabled, .compact-next-btn:disabled {
                background: #2a2a2a !important;
                color: #666666 !important;
                border-color: #444444 !important;
                opacity: 0.6 !important;
                cursor: not-allowed !important;
            }
            
            .compact-save-btn:disabled {
                background: #2a2a2a !important;
                color: #666666 !important;
                border-color: #444444 !important;
                opacity: 0.6 !important;
                cursor: not-allowed !important;
            }
            
            .compact-result-btn {
                background: #1a3a1a !important;
                border: 2px solid #ffaa44 !important;
                color: #ffaa44 !important;
                border-radius: 30px !important;
                font-size: 1rem !important;
                font-weight: 800 !important;
                cursor: pointer !important;
            }
            
            /* ============================================================
               SCORECARD TABLE STYLES
            ============================================================ */
            .scorecard-section {
                margin: 20px 0;
            }
            
            .scorecard-wrapper {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .scorecard-table {
                table-layout: fixed;
                width: 100%;
                border-collapse: collapse;
                font-size: 0.7rem;
                min-width: 600px;
            }
            
            .scorecard-table th,
            .scorecard-table td {
                min-width: 40px;
                max-width: 60px;
                text-align: center;
                padding: 6px 3px;
                border: 1px solid #222;
                white-space: nowrap;
            }
            
            .scorecard-table th:first-child,
            .scorecard-table td:first-child {
                width: 50px;
                position: sticky;
                left: 0;
                background: #111;
                z-index: 1;
            }
            
            .scorecard-table th {
                color: #4caf50;
                background: #111;
            }
            
            .score-green { color: #4caf50; font-weight: 600; }
            .score-gold { color: #ffaa44; font-weight: 800; }
            .score-grey { color: #888; font-weight: 600; }
            .score-invisible { color: #000; }
            .green-line td { border-bottom: 2px solid #4caf50; padding: 0; height: 2px; }
            
            /* ============================================================
               TEAM SCORE CARD
            ============================================================ */
            .team-score-card {
                background: #111;
                border-radius: 16px;
                text-align: center;
                margin-top: 0;
                margin-bottom: 8px;
                padding: 8px;
            }
            
            /* ============================================================
               FLIGHT BADGE
            ============================================================ */
            .flight-badge {
                position: absolute;
                top: -18px;
                left: 50%;
                transform: translateX(-50%);
                background: #1a3a1a;
                border: 2px solid #4caf50;
                color: #4caf50;
                font-size: 0.8rem;
                font-weight: 700;
                padding: 4px 16px;
                border-radius: 30px;
                z-index: 100;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
            
            /* ============================================================
               HOLE HEADER
            ============================================================ */
            .hole-header-grid {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                margin-bottom: -2px;
                width: 100%;
            }
            
            .hole-number-display {
                font-size: 1.5rem;
                font-weight: 800;
                background: #111;
                display: inline-block;
                padding: 4px 20px;
                border-radius: 40px;
                margin: 0;
                justify-self: center;
            }
            
            /* ============================================================
               STATUS BUBBLE
            ============================================================ */
            .status-bubble {
                background: rgba(76,175,80,0.3);
                border: 1px solid #4caf50;
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.7rem;
                color: #4caf50;
                margin-bottom: 12px;
                cursor: pointer;
            }
            
            /* ============================================================
               TICKER
            ============================================================ */
            .ticker-container {
                width: 100%;
                overflow: hidden;
                background: #111111;
                border-radius: 0;
                margin-bottom: 12px;
                white-space: nowrap;
                border-top: 1px solid #2a2a2a;
                border-bottom: 1px solid #2a2a2a;
                padding: 8px 0;
            }
            
            .ticker-content {
                display: inline-block;
                white-space: nowrap;
                font-family: system-ui, -apple-system, 'Helvetica Neue', sans-serif;
                font-size: 0.8rem;
                letter-spacing: 0.3px;
                font-weight: 400;
                animation: tickerScroll 60s linear infinite;
                padding-right: 100%;
            }
            
            @keyframes tickerScroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-66.66%); }
            }
            
            .ticker-container:hover .ticker-content {
                animation-play-state: paused;
            }
        `;
        document.head.appendChild(style);
        globalStylesApplied = true;
        console.log('[GameUI] Global styles injected');
    }
    
    // ============================================================
    // Ensure styles are applied (defensive)
    // ============================================================
    
    function ensureStylesApplied() {
        if (!globalStylesApplied) {
            applyGlobalStyles();
        }
        if (!document.getElementById('gameui-global-styles')) {
            applyGlobalStyles();
        }
    }
    
    // ============================================================
    // Make Status Bubble Clickable (Refresh)
    // ============================================================
    
    function makeStatusBubbleClickable() {
        var statusBubble = document.getElementById('statusBubble');
        if (!statusBubble) return;
        
        statusBubble.style.cursor = 'pointer';
        statusBubble.title = 'Click to refresh page';
        statusBubble.style.transition = 'opacity 0.2s, transform 0.2s';
        
        statusBubble.onmouseenter = function() {
            this.style.opacity = '0.8';
        };
        statusBubble.onmouseleave = function() {
            this.style.opacity = '1';
        };
        statusBubble.onclick = function() {
            location.reload();
        };
    }
    
    // ============================================================
    // Render Hole Header
    // ============================================================
    
    function renderHoleHeader(containerId, currentHole, currentPar, currentSi) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var holeText = 'HOLE ' + currentHole;
        var statusBubble = document.getElementById('statusBubble');
        
        var statusText = 'LIVE';
        var statusColor = '#4caf50';
        var statusBg = 'rgba(76,175,80,0.3)';
        var statusBorder = '1px solid #4caf50';
        
        if (statusBubble) {
            statusText = statusBubble.innerText;
            var computedStyle = window.getComputedStyle(statusBubble);
            statusColor = computedStyle.color;
            statusBg = computedStyle.backgroundColor;
            statusBorder = computedStyle.border;
        }
        
        var html = `
            <div class="hole-header-grid">
                <div class="hole-header-left" style="justify-self: start;">
                    <span class="status-bubble-new" style="display: inline-block; background: ${statusBg}; border: ${statusBorder}; color: ${statusColor}; border-radius: 20px; padding: 4px 12px; font-size: 0.7rem; cursor: pointer;">
                        ${statusText}
                    </span>
                </div>
                <div class="hole-number-display">
                    ${holeText}
                </div>
                <div class="hole-header-right" style="justify-self: end;"></div>
            </div>
        `;
        
        container.innerHTML = html;
        
        if (statusBubble) {
            statusBubble.style.display = 'none';
        }
        
        var newStatusBubble = container.querySelector('.status-bubble-new');
        if (newStatusBubble) {
            newStatusBubble.onclick = function() {
                location.reload();
            };
        }
        
        holeHeaderRendered = true;
        currentHoleNumber = currentHole;
    }
    
    function updateHoleHeaderNumber(holeNumber) {
        currentHoleNumber = holeNumber;
        var holeDisplay = document.querySelector('.hole-header-grid .hole-number-display');
        if (holeDisplay) {
            holeDisplay.innerText = 'HOLE ' + holeNumber;
        }
    }
    
    function updateHoleHeader(containerId, currentHole, currentPar, currentSi) {
        renderHoleHeader(containerId, currentHole, currentPar, currentSi);
    }
    
    // ============================================================
    // Navigation Buttons
    // ============================================================
    
    function updateNavigationButtons(currentHole, playOrder, isCurrentSaved, isGameComplete, celebrationTriggered, onSignCardCallback) {
        var prevBtn = document.getElementById('compactPrevBtn');
        var nextBtn = document.getElementById('compactNextBtn');
        
        if (!prevBtn || !nextBtn) return;
        
        if (!prevBtn._originalOnClick && eventCallbacks.onPrevHole) {
            prevBtn._originalOnClick = function() {
                if (eventCallbacks.onPrevHole) eventCallbacks.onPrevHole();
            };
        }
        if (!nextBtn._originalOnClick && eventCallbacks.onNextHole) {
            nextBtn._originalOnClick = function() {
                if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
            };
        }
        
        var currentIndex = playOrder.indexOf(currentHole);
        var isFirstHole = (currentIndex === 0);
        var isLastHole = (currentIndex === 17);
        
        prevBtn.disabled = isFirstHole;
        if (prevBtn._originalOnClick) {
            prevBtn.onclick = prevBtn._originalOnClick;
        }
        
        if (isGameComplete && !celebrationTriggered) {
            nextBtn.innerHTML = '🏆';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.style.border = '1px solid #ffaa44';
            nextBtn.disabled = false;
            nextBtn.onclick = function() {
                if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
            };
        } else if (isLastHole && isCurrentSaved) {
            nextBtn.innerHTML = '✍️';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.style.border = '1px solid #ffaa44';
            nextBtn.disabled = false;
            nextBtn.onclick = function() {
                if (onSignCardCallback) onSignCardCallback();
            };
        } else {
            nextBtn.innerHTML = '▶';
            nextBtn.style.background = '#1a3a1a';
            nextBtn.style.color = '#4caf50';
            nextBtn.style.border = '1px solid #4caf50';
            nextBtn.disabled = !isCurrentSaved;
            if (nextBtn._originalOnClick) {
                nextBtn.onclick = nextBtn._originalOnClick;
            }
        }
    }
    
    // ============================================================
    // Add Flight Badge
    // ============================================================
    
    function addFlightBadge(flightNumber) {
        var existingBadge = document.querySelector('.flight-badge');
        if (existingBadge) existingBadge.remove();
        
        var playerCards = document.getElementById('playerCards');
        if (!playerCards || playerCards.children.length === 0) return;
        
        var firstCard = playerCards.children[0];
        
        var badge = document.createElement('div');
        badge.className = 'flight-badge';
        badge.innerText = 'FLIGHT ' + flightNumber;
        
        firstCard.style.position = 'relative';
        firstCard.appendChild(badge);
        
        currentFlight = flightNumber;
    }
    
    function updateFlightBadge(flightNumber) {
        var badge = document.querySelector('.flight-badge');
        if (badge) {
            badge.innerText = 'FLIGHT ' + flightNumber;
        } else {
            addFlightBadge(flightNumber);
        }
        currentFlight = flightNumber;
    }
    
    function removeFlightBadge() {
        var badge = document.querySelector('.flight-badge');
        if (badge) badge.remove();
    }
    
    // ============================================================
    // Update flight button text (for control bar)
    // ============================================================
    
    function updateFlightButtonText(flightNumber) {
        if (controlBarElements.flightBtn) {
            var oppositeFlight = flightNumber === 1 ? 2 : 1;
            controlBarElements.flightBtn.innerText = 'FLIGHT ' + oppositeFlight;
        }
        currentFlight = flightNumber;
    }
    
    // ============================================================
    // Render Compact Header - Conditional button rendering
    // ============================================================
    
    function renderCompactHeader(containerId, flightNumber, currentHole, onSave, onPrevHole, onNextHole, onToggleFlight, onToggleDisplay) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        ensureStylesApplied();
        
        controlBarElements.containerId = containerId;
        
        if (onSave) eventCallbacks.onSave = onSave;
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
        if (onToggleFlight) eventCallbacks.onToggleFlight = onToggleFlight;
        if (onToggleDisplay) eventCallbacks.onToggleDisplay = onToggleDisplay;
        
        currentFlight = flightNumber;
        currentHoleNumber = currentHole;
        
        var pnText = currentDisplayMode === 'play' ? 'P' : 'N';
        var oppositeFlight = flightNumber === 1 ? 2 : 1;
        
        var hasSave = (onSave !== null);
        var hasFlightToggle = (onToggleFlight !== null);
        
        var buttonBaseStyle = 'background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; cursor: pointer;';
        var pnBtnStyle = buttonBaseStyle + ' border-radius: 30px; min-width: 44px; height: clamp(44px, 8vh, 52px); padding: 0 clamp(12px, 3vw, 20px); font-size: clamp(0.8rem, 3vw, 1rem); font-weight: 700; flex-shrink: 0;';
        var navBtnStyle = buttonBaseStyle + ' width: clamp(44px, 8vw, 52px); height: clamp(44px, 8vh, 52px); border-radius: 30px; font-size: clamp(1rem, 4vw, 1.3rem); display: flex; align-items: center; justify-content: center;';
        var holeDisplayStyle = 'font-size: clamp(1rem, 4vw, 1.2rem); font-weight: 700; color: #4caf50; min-width: clamp(32px, 8vw, 44px); text-align: center;';
        
        var middleButtonHtml = '';
        if (hasSave && hasFlightToggle) {
            middleButtonHtml = `
                <div style="display: flex; gap: 8px; width: 100%;">
                    <button class="compact-save-btn" id="compactSaveBtn" style="flex: 1; height: clamp(44px, 8vh, 52px); border-radius: 30px; font-size: clamp(0.8rem, 3vw, 1rem); font-weight: 800; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50;">SAVE H${currentHole}</button>
                    <button class="compact-flight-btn" id="compactFlightBtn" style="flex: 1; height: clamp(44px, 8vh, 52px); border-radius: 30px; font-size: clamp(0.8rem, 3vw, 1rem); font-weight: 800; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50;">FLIGHT ${oppositeFlight}</button>
                </div>
            `;
        } else if (hasSave) {
            middleButtonHtml = `
                <button class="compact-save-btn" id="compactSaveBtn" style="width: 100%; height: clamp(44px, 8vh, 52px); border-radius: 30px; font-size: clamp(0.8rem, 3vw, 1rem); font-weight: 800; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50;">SAVE H${currentHole}</button>
            `;
        } else if (hasFlightToggle) {
            middleButtonHtml = `
                <button class="compact-flight-btn" id="compactFlightBtn" style="width: 100%; height: clamp(44px, 8vh, 52px); border-radius: 30px; font-size: clamp(0.8rem, 3vw, 1rem); font-weight: 800; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50;">FLIGHT ${oppositeFlight}</button>
            `;
        } else {
            middleButtonHtml = `<div style="width: 100%;"></div>`;
        }
        
        var html = `
            <div class="compact-header" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: clamp(6px, 2vw, 12px); margin-bottom: 15px; width: 100%;">
                <button class="compact-pn-btn" id="compactPnBtn" style="${pnBtnStyle}">
                    ${pnText}
                </button>
                ${middleButtonHtml}
                <div class="compact-nav-group" style="display: flex; align-items: center; gap: clamp(4px, 1.5vw, 8px); flex-shrink: 0;">
                    <button class="compact-prev-btn" id="compactPrevBtn" style="${navBtnStyle}">
                        ◀
                    </button>
                    <span class="compact-hole-display" style="${holeDisplayStyle}">${currentHole}</span>
                    <button class="compact-next-btn" id="compactNextBtn" style="${navBtnStyle}">
                        ▶
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        controlBarElements.pnBtn = document.getElementById('compactPnBtn');
        controlBarElements.flightBtn = document.getElementById('compactFlightBtn');
        controlBarElements.saveBtn = document.getElementById('compactSaveBtn');
        controlBarElements.prevBtn = document.getElementById('compactPrevBtn');
        controlBarElements.nextBtn = document.getElementById('compactNextBtn');
        controlBarElements.holeDisplay = document.querySelector('.compact-hole-display');
        
        if (controlBarElements.pnBtn && eventCallbacks.onToggleDisplay) {
            controlBarElements.pnBtn.onclick = function() {
                var newMode = currentDisplayMode === 'play' ? 'natural' : 'play';
                setDisplayMode(newMode, null);
                updateCompactPnButton();
                if (eventCallbacks.onToggleDisplay) eventCallbacks.onToggleDisplay(newMode);
            };
        }
        
        if (controlBarElements.saveBtn && eventCallbacks.onSave) {
            controlBarElements.saveBtn.onclick = function() {
                if (eventCallbacks.onSave) eventCallbacks.onSave();
            };
        }
        
        if (controlBarElements.flightBtn && eventCallbacks.onToggleFlight) {
            controlBarElements.flightBtn.onclick = function() {
                var newFlight = currentFlight === 1 ? 2 : 1;
                controlBarElements.flightBtn.innerText = 'FLIGHT ' + (newFlight === 1 ? 2 : 1);
                if (eventCallbacks.onToggleFlight) eventCallbacks.onToggleFlight(newFlight);
            };
        }
        
        if (controlBarElements.prevBtn && eventCallbacks.onPrevHole) {
            controlBarElements.prevBtn.onclick = function() {
                if (eventCallbacks.onPrevHole) eventCallbacks.onPrevHole();
            };
        }
        
        if (controlBarElements.nextBtn && eventCallbacks.onNextHole) {
            controlBarElements.nextBtn._originalOnClick = function() {
                if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
            };
            controlBarElements.nextBtn.onclick = controlBarElements.nextBtn._originalOnClick;
        }
    }
    
    function updateCompactSaveButton(currentHole, isDisabled) {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (saveBtn) {
            saveBtn.innerText = 'SAVE H' + currentHole;
            saveBtn.disabled = isDisabled;
            if (isDisabled) {
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
            } else {
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            }
        }
    }
    
    function updateCompactPnButton() {
        if (controlBarElements.pnBtn) {
            controlBarElements.pnBtn.innerText = currentDisplayMode === 'play' ? 'P' : 'N';
        }
    }
    
    function updateCompactHoleDisplay(holeNumber) {
        currentHoleNumber = holeNumber;
        if (controlBarElements.holeDisplay) {
            controlBarElements.holeDisplay.innerText = holeNumber;
        }
        updateCompactSaveButton(holeNumber, false);
    }
    
    function updateFlightToggleButton(flightNumber) {
        updateFlightBadge(flightNumber);
        updateFlightButtonText(flightNumber);
    }
    
    function toggleFlight() {
        var newFlight = currentFlight === 1 ? 2 : 1;
        currentFlight = newFlight;
        updateFlightBadge(currentFlight);
        updateFlightButtonText(currentFlight);
        if (eventCallbacks.onToggleFlight) {
            eventCallbacks.onToggleFlight(currentFlight);
        }
    }
    
    function getCurrentFlight() {
        return currentFlight;
    }
    
    // ============================================================
    // Scorecard Rendering - DELEGATED to GameScorecard
    // ============================================================
    
    function renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1ClinchedHole, t2ClinchedHole, t1Display, t2Display, strkDisplay) {
        if (typeof GameScorecard !== 'undefined' && GameScorecard.renderScorecard) {
            GameScorecard.renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1ClinchedHole, t2ClinchedHole, t1Display, t2Display, strkDisplay);
        } else {
            console.error("GameScorecard module not loaded");
        }
    }
    
    // ============================================================
    // Player Cards with Bubbles - WITH DEBUG LOGGING
    // ============================================================
    
    function renderPlayerCards(containerId, players, getOpponents, getBubbleClass, getBubbleValue, getCurrentScore, canEdit, onScoreChange) {
        console.log(`[DEBUG-UI] renderPlayerCards called with ${players.length} players, canEdit=${canEdit}`);
        
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var html = '';
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var currentScore = getCurrentScore(player);
            var btnDisabled = !canEdit ? 'disabled' : '';
            
            var opponents = getOpponents(player);
            var bubblesHtml = '<div class="bubbles">';
            for (var j = 0; j < opponents.length; j++) {
                var opp = opponents[j];
                var bubbleClass = getBubbleClass(player, opp);
                var bubbleValue = getBubbleValue(player, opp);
                
                if (bubbleClass !== 'bubble-green' && bubbleClass !== 'bubble-red') {
                    console.log(`[DEBUG-UI] ${player.label} vs ${opp.label}: class=${bubbleClass}, value=${bubbleValue}`);
                }
                
                var displayValue = bubbleValue;
                if (displayValue === 'AS') {
                    displayValue = getAsSquareHtml();
                }
                
                bubblesHtml += '<div class="bubble ' + bubbleClass + '">' + escapeHtml(opp.label) + ' ' + displayValue + '</div>';
            }
            bubblesHtml += '</div>';
            
            html += `
                <div class="player-card" data-player-name="${escapeHtml(player.name)}" data-player-flight="${player.flight}">
                    <div class="player-header">
                        <div>
                            <span class="player-name">${escapeHtml(player.label || player.name)}</span>
                            <span class="player-handicap">${player.handicap}</span>
                        </div>
                        <div class="score-control">
                            <button class="score-btn dec-btn" ${btnDisabled} data-delta="-1">-</button>
                            <span class="score-value">${currentScore}</span>
                            <button class="score-btn inc-btn" ${btnDisabled} data-delta="1">+</button>
                        </div>
                    </div>
                    ${bubblesHtml}
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        if (canEdit && onScoreChange) {
            var playerCards = container.querySelectorAll('.player-card');
            for (var i = 0; i < playerCards.length; i++) {
                var card = playerCards[i];
                var playerName = card.getAttribute('data-player-name');
                var playerFlight = parseInt(card.getAttribute('data-player-flight'));
                
                var decBtn = card.querySelector('.dec-btn');
                var incBtn = card.querySelector('.inc-btn');
                
                if (decBtn) {
                    decBtn.addEventListener('click', (function(pName, pFlight) {
                        return function() {
                            onScoreChange(pName, pFlight, -1);
                        };
                    })(playerName, playerFlight));
                }
                
                if (incBtn) {
                    incBtn.addEventListener('click', (function(pName, pFlight) {
                        return function() {
                            onScoreChange(pName, pFlight, 1);
                        };
                    })(playerName, playerFlight));
                }
            }
        }
    }
    
    // ============================================================
    // TR (Title Result) Display - WITH DEBUG LOGGING
    // ============================================================
    
    function updateTR(containerId, teamAPoints, teamBPoints, teamAGreen, teamBGreen) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        function formatDisplayValue(value) {
            if (value === null || value === undefined || value === "-") {
                return "-";
            }
            if (typeof value === 'number') {
                return value % 1 === 0 ? value.toString() : value.toFixed(1);
            }
            return value.toString();
        }
        
        var teamADisplay = formatDisplayValue(teamAPoints);
        var teamBDisplay = formatDisplayValue(teamBPoints);
        
        if (teamADisplay !== "-" || teamBDisplay !== "-") {
            console.log(`[DEBUG-UI] updateTR: ${teamADisplay} - ${teamBDisplay}`);
        }
        
        var isTie = (teamAPoints === teamBPoints) || (teamADisplay === "-" && teamBDisplay === "-");
        var teamAColor = (isTie || teamAGreen) ? '#4caf50' : '#ff6b6b';
        var teamBColor = (isTie || teamBGreen) ? '#4caf50' : '#ff6b6b';
        var separatorColor = '#888';
        
        var html = `
            <div style="text-align: center;">
                <div style="display: flex; justify-content: center; align-items: center; gap: 16px;">
                    <div style="text-align: center; min-width: 100px;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: ${teamAColor};">TEAM A</div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: ${teamAColor};">${teamADisplay}</div>
                    </div>
                    <div style="font-size: 1.5rem; color: ${separatorColor};">│</div>
                    <div style="text-align: center; min-width: 100px;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: ${teamBColor};">TEAM B</div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: ${teamBColor};">${teamBDisplay}</div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    function updateFlightTab(containerId, flightNumber, canEdit) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var pencilIcon = canEdit ? ' ✏️' : '';
        container.innerHTML = 'Flight ' + flightNumber + pencilIcon;
    }
    
    // ============================================================
    // Display Mode Management
    // ============================================================
    
    function getDisplayMode() {
        var saved = localStorage.getItem("scorecardDisplay");
        if (saved === "natural" || saved === "play") {
            currentDisplayMode = saved;
        } else {
            currentDisplayMode = "play";
        }
        return currentDisplayMode;
    }
    
    function updateToggleButtons(mode) {
        var playBtn = document.getElementById('playOrderBtn');
        var naturalBtn = document.getElementById('naturalOrderBtn');
        if (playBtn && naturalBtn) {
            if (mode === 'play') {
                playBtn.classList.add('active');
                naturalBtn.classList.remove('active');
            } else {
                playBtn.classList.remove('active');
                naturalBtn.classList.add('active');
            }
        }
        updateCompactPnButton();
    }
    
    function setDisplayMode(mode, onModeChanged) {
        if (mode !== "play" && mode !== "natural") return;
        currentDisplayMode = mode;
        localStorage.setItem("scorecardDisplay", mode);
        updateToggleButtons(mode);
        updateCompactPnButton();
        if (onModeChanged && typeof onModeChanged === 'function') {
            onModeChanged(mode);
        }
        if (eventCallbacks.onToggleDisplay) {
            eventCallbacks.onToggleDisplay(mode);
        }
    }
    
    function toggleDisplayMode() {
        var newMode = currentDisplayMode === "play" ? "natural" : "play";
        setDisplayMode(newMode, null);
    }
    
    function getDisplayHoles(startingHole, preference) {
        var useNatural = (preference === "natural");
        if (useNatural) {
            var natural = [];
            for (var i = 1; i <= 18; i++) natural.push(i);
            return natural;
        } else {
            var playOrder = [];
            for (var i = startingHole; i <= 18; i++) playOrder.push(i);
            for (var i = 1; i < startingHole; i++) playOrder.push(i);
            return playOrder;
        }
    }
    
    function renderActionButtons(containerId, currentHole, isSaveDisabled, onSaveCallback) {
        if (onSaveCallback) {
            eventCallbacks.onSave = onSaveCallback;
        }
        var container = document.getElementById(containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    function updateSaveButton(currentHole, isDisabled) {
        updateCompactSaveButton(currentHole, isDisabled);
    }
    
    function resetSaveButton(currentHole) {
        updateCompactSaveButton(currentHole, false);
    }
    
    // ============================================================
    // Bottom Menu Button Rendering
    // ============================================================
    
    function renderBottomMenu(containerId, onMenuCallback) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (onMenuCallback) {
            eventCallbacks.onMenu = onMenuCallback;
        }
        
        container.innerHTML = '';
        
        var btn = document.createElement('button');
        btn.id = 'menuBtn';
        btn.textContent = '← Back to Main Menu';
        btn.style.cssText = 'width:100%; padding:14px; border-radius:40px; font-weight:600; cursor:pointer; background:#1a1a1a; color:#ccc; border:1px solid #333; margin-top:20px;';
        
        btn.onclick = function() {
            if (eventCallbacks.onMenu && typeof eventCallbacks.onMenu === 'function') {
                eventCallbacks.onMenu();
            } else if (onMenuCallback && typeof onMenuCallback === 'function') {
                onMenuCallback();
            }
        };
        
        container.appendChild(btn);
    }
    
    // ============================================================
    // SHARED DISPLAY FUNCTIONS
    // ============================================================
    
    function getFlightOrderedPlayersShared(flight, allPlayers) {
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        return teamA.concat(teamB);
    }
    
    function getAllOpponentsShared(player, allPlayers) {
        var opponents = allPlayers.filter(function(op) { return op.team !== player.team; });
        opponents.sort(function(a, b) {
            var aIntra = (a.flight === player.flight);
            var bIntra = (b.flight === player.flight);
            if (aIntra && !bIntra) return -1;
            if (!aIntra && bIntra) return 1;
            if (aIntra && bIntra) return a.handicap - b.handicap;
            return a.flight - b.flight;
        });
        return opponents;
    }
    
    function getMatchValueShared(player, opponent, holeNumber, resultsCache, allPlayers, getHolePositionFn) {
        if (!resultsCache || !resultsCache.matchResults) return 0;
        var position = getHolePositionFn(holeNumber);
        var matchArray = resultsCache.matchResults[position];
        if (!matchArray) return 0;
        
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var aIdx = -1, bIdx = -1;
        if (player.team === 'A') {
            for (var i = 0; i < teamAPlayers.length; i++) {
                if (teamAPlayers[i].name === player.name) aIdx = i;
            }
            for (var i = 0; i < teamBPlayers.length; i++) {
                if (teamBPlayers[i].name === opponent.name) bIdx = i;
            }
        } else {
            for (var i = 0; i < teamAPlayers.length; i++) {
                if (teamAPlayers[i].name === opponent.name) aIdx = i;
            }
            for (var i = 0; i < teamBPlayers.length; i++) {
                if (teamBPlayers[i].name === player.name) bIdx = i;
            }
        }
        if (aIdx === -1 || bIdx === -1) return 0;
        var matchIndex = aIdx * teamBPlayers.length + bIdx;
        var value = matchArray[matchIndex] || 0;
        return (player.team === 'B') ? -value : value;
    }
    
    function getBubbleClassShared(player, opponent, currentHole, resultsCache, allPlayers, isHoleSavedFn, getHolePositionFn, clinchedAtMap) {
        var matchValue = getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn);
        var isHoleSavedForFlight = isHoleSavedFn(player.flight, currentHole);
        
        if (!isHoleSavedForFlight) return 'bubble-grey';
        
        var clinchHole = null;
        if (clinchedAtMap) {
            var matchKey1 = player.name + "_vs_" + opponent.name;
            var matchKey2 = opponent.name + "_vs_" + player.name;
            clinchHole = clinchedAtMap[matchKey1] || clinchedAtMap[matchKey2];
        }
        
        if (clinchHole && currentHole > clinchHole) return 'bubble-grey';
        if (clinchHole && currentHole === clinchHole) {
            if (matchValue > 0) return 'bubble-gold';
            if (matchValue < 0) return 'bubble-loss-clinch';
            return 'bubble-green';
        }
        
        if (matchValue > 0) return 'bubble-green';
        if (matchValue < 0) return 'bubble-red';
        return 'bubble-green';
    }
    
    function getBubbleValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn) {
        var matchValue = getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn);
        var absValue = Math.abs(matchValue);
        if (absValue === 0) return 'AS';
        return absValue.toString();
    }
    
    function updateNavButtonsWithDisableLogic(isCurrentSaved, hasUnsavedChanges, isGameComplete, celebrationTriggered) {
        // Deprecated
    }
    
    function updateNextButtonForLastHole(currentHole, isLast, isCurrentSaved, onSignCardCallback) {
        // Deprecated
    }
    
    function setNextButtonToSignMode() {
        var nextBtn = document.getElementById('compactNextBtn');
        if (nextBtn) {
            nextBtn.innerHTML = '✍️';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.disabled = false;
        }
    }
    
    function setNextButtonToSeeResults() {
        var nextBtn = document.getElementById('compactNextBtn');
        if (nextBtn) {
            nextBtn.innerHTML = '🏆';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.disabled = false;
        }
    }
    
    function ensureNoStuckModals() {
        var modals = document.querySelectorAll('.modal-overlay');
        for (var i = 0; i < modals.length; i++) {
            modals[i].remove();
        }
    }
    
    function attachGlobalEventListeners(onPrevHole, onNextHole) {
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
    }
    
    function applyTightLayout() {
        if (tightLayoutApplied) return;
        
        fixBackground();
        ensureStylesApplied();
        
        var style = document.createElement('style');
        style.id = 'gameui-tight-layout';
        style.textContent = `
            #courseName { display: none !important; }
            .hole-par { display: none !important; }
            #flightTab { display: none !important; }
            .container { padding-top: 30px !important; }
        `;
        document.head.appendChild(style);
        
        tightLayoutApplied = true;
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        renderScorecard: renderScorecard,
        renderPlayerCards: renderPlayerCards,
        updateTR: updateTR,
        updateHoleHeader: updateHoleHeader,
        renderHoleHeader: renderHoleHeader,
        updateHoleHeaderNumber: updateHoleHeaderNumber,
        updateFlightTab: updateFlightTab,
        renderCompactHeader: renderCompactHeader,
        updateCompactSaveButton: updateCompactSaveButton,
        updateCompactPnButton: updateCompactPnButton,
        updateCompactHoleDisplay: updateCompactHoleDisplay,
        addFlightBadge: addFlightBadge,
        updateFlightBadge: updateFlightBadge,
        removeFlightBadge: removeFlightBadge,
        updateFlightButtonText: updateFlightButtonText,
        updateNavigationButtons: updateNavigationButtons,
        updateFlightToggleButton: updateFlightToggleButton,
        updateFlightButtonText: updateFlightButtonText,
        updatePnButtonText: updateCompactPnButton,
        getDisplayMode: getDisplayMode,
        setDisplayMode: setDisplayMode,
        updateToggleButtons: updateToggleButtons,
        toggleDisplayMode: toggleDisplayMode,
        getDisplayHoles: getDisplayHoles,
        toggleFlight: toggleFlight,
        getCurrentFlight: getCurrentFlight,
        renderActionButtons: renderActionButtons,
        updateSaveButton: updateSaveButton,
        resetSaveButton: resetSaveButton,
        renderBottomMenu: renderBottomMenu,
        getFlightOrderedPlayersShared: getFlightOrderedPlayersShared,
        getAllOpponentsShared: getAllOpponentsShared,
        getMatchValueShared: getMatchValueShared,
        getBubbleClassShared: getBubbleClassShared,
        getBubbleValueShared: getBubbleValueShared,
        updateNavButtonsWithDisableLogic: updateNavButtonsWithDisableLogic,
        updateNextButtonForLastHole: updateNextButtonForLastHole,
        setNextButtonToSignMode: setNextButtonToSignMode,
        setNextButtonToSeeResults: setNextButtonToSeeResults,
        ensureNoStuckModals: ensureNoStuckModals,
        attachGlobalEventListeners: attachGlobalEventListeners,
        applyTightLayout: applyTightLayout,
        makeStatusBubbleClickable: makeStatusBubbleClickable,
        fixBackground: fixBackground,
        ensureStylesApplied: ensureStylesApplied,
        addFlightIndicator: function() {},
        removeFlightIndicator: function() {},
        updateFlightIndicator: updateFlightBadge,
        applyGlobalStyles: ensureStylesApplied
    };
    
})();

window.gameUI = GameUI;
window.GameUI = GameUI;

/*
FILE: js/game-ui.js
VERSION: 5.05
KEY CHANGES from v5.04:
   - ADDED: Debug logging in updateTR() for value formatting
   - ADDED: Debug logging in renderPlayerCards() for bubble class
   - ADDED: Version exposure for console debugging
   - All existing functionality unchanged
DEPENDS ON: None (pure style injection and DOM manipulation)
STATUS: Ready for integration
*/