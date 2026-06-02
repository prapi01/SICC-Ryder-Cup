/*
FILE: js/game-ui.js
VERSION: 4.18
KEY CHANGES from v4.09:
   - FIXED: T-1 row now displays when ONLY Flight 1 has saved the hole (no longer requires Flight 2)
   - FIXED: T-2 row now displays when ONLY Flight 2 has saved the hole (no longer requires Flight 1)
   - Strk row unchanged - still requires BOTH flights to have saved
   - NO other changes from v4.09 (table alignment preserved, bubble styles unchanged)
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/

var GameUI = (function() {
    
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
    
    // Track current state for UI updates
    var currentFlight = 1;
    var currentDisplayMode = "play";
    var currentHoleNumber = 1;
    
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
    // Helper: Create green square HTML for AS
    // ============================================================
    function getAsSquareHtml() {
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
    // Apply Global Bubble Styles (SINGLE SOURCE OF TRUTH)
    // ============================================================
    
    function applyGlobalBubbleStyles() {
        if (document.getElementById('gameui-bubble-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'gameui-bubble-styles';
        style.textContent = `
            /* Bubbles - FULLY FLUID, self-adjusting across ALL screen sizes */
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
            
            /* Bubble color variants */
            .bubble-green { background: #1a3a1a; color: #4caf50; border: 1px solid #4caf50; }
            .bubble-red { background: #3a1a1a; color: #ff6b6b; border: 1px solid #ff6b6b; }
            .bubble-grey { background: #2a2a2a; color: #888; border: 1px solid #444; }
            .bubble-gold {
                background: #1a3a1a;
                color: #ffaa44;
                border: 3px solid #ffaa44;
                font-weight: 800;
            }
            .bubble-loss-clinch {
                background: #3a1a1a;
                color: #ffffff;
                border: 3px solid #ffffff;
                font-weight: 800;
            }
            
            /* Green square for AS */
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
            
            /* T-1/T-2 row colors */
            .score-green { color: #4caf50; font-weight: 600; }
            .score-gold { color: #ffaa44; font-weight: 800; }
            .score-grey { color: #888888; font-weight: 600; }
            .score-invisible { color: #000; }
            
            /* Very small screens (iPhone SE) */
            @media (max-width: 380px) {
                .bubble {
                    font-size: 0.7rem;
                    padding: 4px 2px;
                }
                .bubbles {
                    gap: 4px;
                }
                .as-square {
                    width: 14px;
                    height: 14px;
                }
            }
            
            /* Larger screens (iPad, Desktop) */
            @media (min-width: 500px) {
                .bubbles {
                    gap: 12px;
                }
                .bubble {
                    font-size: 0.9rem;
                    padding: 8px 8px;
                    border-radius: 28px;
                }
                .as-square {
                    width: 18px;
                    height: 18px;
                }
            }
        `;
        document.head.appendChild(style);
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
    // Render Hole Header (LIVE left, HOLE centered)
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
            <div class="hole-header-grid" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: -2px; width: 100%;">
                <div class="hole-header-left" style="justify-self: start;">
                    <span class="status-bubble-new" style="display: inline-block; background: ${statusBg}; border: ${statusBorder}; color: ${statusColor}; border-radius: 20px; padding: 4px 12px; font-size: 0.7rem; cursor: pointer;">
                        ${statusText}
                    </span>
                </div>
                <div class="hole-number-display" style="font-size: 1.5rem; font-weight: 800; background: #111; display: inline-block; padding: 4px 20px; border-radius: 40px; margin: 0; justify-self: center;">
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
    
    // ============================================================
    // Legacy updateHoleHeader
    // ============================================================
    
    function updateHoleHeader(containerId, currentHole, currentPar, currentSi) {
        renderHoleHeader(containerId, currentHole, currentPar, currentSi);
    }
    
    // ============================================================
    // SINGLE SOURCE OF TRUTH: Navigation Buttons
    // ============================================================
    
    function updateNavigationButtons(currentHole, playOrder, isCurrentSaved, isGameComplete, celebrationTriggered, onSignCardCallback) {
        var prevBtn = document.getElementById('compactPrevBtn');
        var nextBtn = document.getElementById('compactNextBtn');
        
        if (!prevBtn || !nextBtn) return;
        
        // Store original navigation handlers if not already stored
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
        
        // Prev button: disabled only at first hole
        prevBtn.disabled = isFirstHole;
        if (prevBtn._originalOnClick) {
            prevBtn.onclick = prevBtn._originalOnClick;
        }
        
        // Next button logic
        if (isGameComplete && !celebrationTriggered) {
            // Game complete - show trophy
            nextBtn.innerHTML = '🏆';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.style.border = '1px solid #ffaa44';
            nextBtn.disabled = false;
            nextBtn.onclick = function() {
                if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
            };
        } else if (isLastHole && isCurrentSaved) {
            // Last hole AND saved - show sign button (gold)
            nextBtn.innerHTML = '✍️';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.style.border = '1px solid #ffaa44';
            nextBtn.disabled = false;
            nextBtn.onclick = function() {
                if (onSignCardCallback) onSignCardCallback();
            };
        } else {
            // Normal mode - green arrow, disabled if not saved
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
    // Add Flight Badge to First Player Card
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
        badge.style.cssText = `
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
        `;
        
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
    // Tighten Scorecard Rows
    // ============================================================
    
    function tightenScorecardRows() {
        var table = document.querySelector('.scorecard-table');
        if (!table) return;
        
        var allRows = table.querySelectorAll('tr');
        for (var i = 0; i < allRows.length; i++) {
            allRows[i].style.lineHeight = '1.2';
        }
        
        var allCells = table.querySelectorAll('th, td');
        for (var i = 0; i < allCells.length; i++) {
            allCells[i].style.padding = '4px 2px';
            allCells[i].style.lineHeight = '1.2';
        }
        
        var headerRow = table.querySelector('thead tr');
        if (headerRow) {
            var headerCells = headerRow.querySelectorAll('th');
            for (var i = 0; i < headerCells.length; i++) {
                headerCells[i].style.padding = '6px 2px';
            }
        }
    }
    
    // ============================================================
    // Render Compact Header
    // ============================================================
    
    function renderCompactHeader(containerId, flightNumber, currentHole, onSave, onPrevHole, onNextHole, onToggleFlight, onToggleDisplay) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        // Store callbacks
        if (onSave) eventCallbacks.onSave = onSave;
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
        if (onToggleFlight) eventCallbacks.onToggleFlight = onToggleFlight;
        if (onToggleDisplay) eventCallbacks.onToggleDisplay = onToggleDisplay;
        
        currentFlight = flightNumber;
        currentHoleNumber = currentHole;
        
        var pnText = currentDisplayMode === 'play' ? 'P' : 'N';
        
        setTimeout(function() {
            addFlightBadge(flightNumber);
        }, 50);
        
        // RESPONSIVE: CSS Grid + clamp for all screen sizes
        var html = `
            <div class="compact-header" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: clamp(6px, 2vw, 12px); margin-bottom: 15px; width: 100%;">
                <button class="compact-pn-btn" id="compactPnBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; min-width: 44px; height: clamp(44px, 8vh, 52px); padding: 0 clamp(12px, 3vw, 20px); font-size: clamp(0.8rem, 3vw, 1rem); font-weight: 700; cursor: pointer; flex-shrink: 0;">
                    ${pnText}
                </button>
                <button class="compact-save-btn" id="compactSaveBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; height: clamp(44px, 8vh, 52px); width: 100%; font-size: clamp(0.8rem, 3vw, 1rem); font-weight: 700; cursor: pointer; text-align: center; white-space: nowrap;">
                    SAVE H${currentHole}
                </button>
                <div class="compact-nav-group" style="display: flex; align-items: center; gap: clamp(4px, 1.5vw, 8px); flex-shrink: 0;">
                    <button class="compact-prev-btn" id="compactPrevBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: clamp(44px, 8vw, 52px); height: clamp(44px, 8vh, 52px); border-radius: 30px; font-size: clamp(1rem, 4vw, 1.3rem); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ◀
                    </button>
                    <span class="compact-hole-display" style="font-size: clamp(1rem, 4vw, 1.2rem); font-weight: 700; color: #4caf50; min-width: clamp(32px, 8vw, 44px); text-align: center;">${currentHole}</span>
                    <button class="compact-next-btn" id="compactNextBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: clamp(44px, 8vw, 52px); height: clamp(44px, 8vh, 52px); border-radius: 30px; font-size: clamp(1rem, 4vw, 1.3rem); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ▶
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        var pnBtn = document.getElementById('compactPnBtn');
        var saveBtn = document.getElementById('compactSaveBtn');
        
        if (pnBtn && eventCallbacks.onToggleDisplay) {
            pnBtn.addEventListener('click', function() {
                var newMode = currentDisplayMode === 'play' ? 'natural' : 'play';
                setDisplayMode(newMode, null);
                updateCompactPnButton();
                if (eventCallbacks.onToggleDisplay) eventCallbacks.onToggleDisplay(newMode);
            });
        }
        
        if (saveBtn && eventCallbacks.onSave) {
            saveBtn.addEventListener('click', function() {
                if (eventCallbacks.onSave) eventCallbacks.onSave();
            });
        }
    }
    
    function updateCompactSaveButton(currentHole, isDisabled) {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (saveBtn) {
            saveBtn.innerText = 'SAVE H' + currentHole;
            saveBtn.disabled = isDisabled;
        }
    }
    
    function updateCompactPnButton() {
        var pnBtn = document.getElementById('compactPnBtn');
        if (pnBtn) {
            pnBtn.innerText = currentDisplayMode === 'play' ? 'P' : 'N';
        }
    }
    
    function updateCompactHoleDisplay(holeNumber) {
        currentHoleNumber = holeNumber;
        var holeDisplay = document.querySelector('.compact-hole-display');
        if (holeDisplay) {
            holeDisplay.innerText = holeNumber;
        }
        updateCompactSaveButton(holeNumber, false);
    }
    
    // ============================================================
    // Legacy Functions
    // ============================================================
    
    function updateFlightToggleButton(flightNumber) {
        updateFlightBadge(flightNumber);
    }
    
    function toggleFlight() {
        var newFlight = currentFlight === 1 ? 2 : 1;
        currentFlight = newFlight;
        updateFlightBadge(currentFlight);
        if (eventCallbacks.onToggleFlight) {
            eventCallbacks.onToggleFlight(currentFlight);
        }
    }
    
    function getCurrentFlight() {
        return currentFlight;
    }
    
    // ============================================================
    // Scorecard Rendering - FIXED v4.18: T-1/T-2 independent sync
    // ============================================================
    
    // t1ClinchedHole and t2ClinchedHole are numbers (the hole number where clinch occurred)
    // or null if not clinched yet
    // t1Display, t2Display, strkDisplay are arrays of formatted strings (e.g., "A8", "B15", "AS")
    function renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1ClinchedHole, t2ClinchedHole, t1Display, t2Display, strkDisplay) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        // Backward compatibility: if display arrays not provided, use null (fall back to old display)
        t1Display = (t1Display !== undefined) ? t1Display : null;
        t2Display = (t2Display !== undefined) ? t2Display : null;
        strkDisplay = (strkDisplay !== undefined) ? strkDisplay : null;
        
        // Default clinch values to null (not provided)
        t1ClinchedHole = (t1ClinchedHole !== undefined) ? t1ClinchedHole : null;
        t2ClinchedHole = (t2ClinchedHole !== undefined) ? t2ClinchedHole : null;
        
        // Build savedHoles object for sync checking
        var savedHoles = { 1: [], 2: [] };
        for (var h = 1; h <= 18; h++) {
            if (isHoleSaved(1, h)) savedHoles[1].push(h);
            if (isHoleSaved(2, h)) savedHoles[2].push(h);
        }
        
        var flight1Players = players.filter(function(p) { return p.flight === 1; });
        var flight2Players = players.filter(function(p) { return p.flight === 2; });
        
        function sortFlightPlayers(flightPlayers) {
            var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            return teamA.concat(teamB);
        }
        
        flight1Players = sortFlightPlayers(flight1Players);
        flight2Players = sortFlightPlayers(flight2Players);
        
        var html = '<table class="scorecard-table">';
        html += '<thead><tr><th>Hole</th>';
        for (var i = 0; i < holes.length; i++) {
            html += '<th>' + holes[i] + '</th>';
        }
        html += '<th>Tot</th> </thead><tbody>';
        
        // Par row
        html += '<tr><td style="font-weight:700;">Par<\/td>';
        var totalPar = 0;
        for (var i = 0; i < holes.length; i++) {
            var par = coursePar[holes[i] - 1];
            totalPar += par;
            html += '<td>' + par + '<\/td>';
        }
        html += '<td>' + totalPar + '<\/td><\/tr>';
        
        // SI row
        html += '<tr><td style="font-weight:700;">SI<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var si = courseSi[holes[i] - 1];
            html += '<td>' + si + '<\/td>';
        }
        html += '<td>-<\/td><\/tr>';
        
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Flight 1 players
        for (var p = 0; p < flight1Players.length; p++) {
            var player = flight1Players[p];
            html += '<td><td style="font-weight:600;">' + escapeHtml(player.label) + '<\/td>';
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '<\/td>';
            }
            html += '<td class="score-green">' + playerTotal + '<\/td><\/tr>';
        }
        
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-1 row - Flight 1 cumulative (with margin display support)
        // FIXED v4.18: T-1 only requires Flight 1 saved
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = t1Row[holeNum - 1] || '_';
            // FIXED v4.18: Only check Flight 1 saved for T-1
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // Determine color based on clinch hole
            var colorClass = 'score-green';
            if (t1ClinchedHole !== null) {
                if (holeNum < t1ClinchedHole) colorClass = 'score-green';
                else if (holeNum === t1ClinchedHole) colorClass = 'score-gold';
                else if (holeNum > t1ClinchedHole) colorClass = 'score-grey';
            } else {
                colorClass = 'score-green';
            }
            
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = colorClass;
                }
            } else if (val === 'A' || val === 'B') {
                if (isSynced) {
                    // Use formatted display if available
                    if (t1Display && t1Display[holeNum - 1]) {
                        displayVal = t1Display[holeNum - 1];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    displayVal = val;
                    cellClass = colorClass;
                }
            }
            
            // Replace "AS" with green square
            if (displayVal === 'AS') {
                displayVal = getAsSquareHtml();
            }
            
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Flight 2 players
        for (var p = 0; p < flight2Players.length; p++) {
            var player = flight2Players[p];
            html += '<td><td style="font-weight:600;">' + escapeHtml(player.label) + '<\/td>';
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '<\/td>';
            }
            html += '<td class="score-green">' + playerTotal + '<\/td><\/tr>';
        }
        
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-2 row - Flight 2 cumulative (with margin display support)
        // FIXED v4.18: T-2 only requires Flight 2 saved
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = t2Row[holeNum - 1] || '_';
            // FIXED v4.18: Only check Flight 2 saved for T-2
            var isSynced = (savedHoles[2].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            var colorClass = 'score-green';
            if (t2ClinchedHole !== null) {
                if (holeNum < t2ClinchedHole) colorClass = 'score-green';
                else if (holeNum === t2ClinchedHole) colorClass = 'score-gold';
                else if (holeNum > t2ClinchedHole) colorClass = 'score-grey';
            } else {
                colorClass = 'score-green';
            }
            
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = colorClass;
                }
            } else if (val === 'A' || val === 'B') {
                if (isSynced) {
                    // Use formatted display if available
                    if (t2Display && t2Display[holeNum - 1]) {
                        displayVal = t2Display[holeNum - 1];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    displayVal = val;
                    cellClass = colorClass;
                }
            }
            
            // Replace "AS" with green square
            if (displayVal === 'AS') {
                displayVal = getAsSquareHtml();
            }
            
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Strk row - Stroke game (requires both flights saved)
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = strkRow[holeNum - 1] || '_';
            // Strk requires BOTH flights saved (unchanged)
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = 'score-green';
                }
            } else if (val === 'A' || val === 'B') {
                if (isSynced) {
                    // Use formatted display if available
                    if (strkDisplay && strkDisplay[holeNum - 1]) {
                        displayVal = strkDisplay[holeNum - 1];
                    } else {
                        displayVal = val;
                    }
                    cellClass = 'score-green';
                    
                    // Gold at hole 18 when winner is determined
                    if (holeNum === 18 && (val === 'A' || val === 'B')) {
                        cellClass = 'score-gold';
                    }
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    displayVal = val;
                    cellClass = 'score-green';
                }
            }
            
            // Replace "AS" with green square
            if (displayVal === 'AS') {
                displayVal = getAsSquareHtml();
            }
            
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
        tightenScorecardRows();
        
        // Apply improved CSS styles to the scorecard table
        var scorecardTable = container.querySelector('.scorecard-table');
        if (scorecardTable) {
            // Remove fixed table layout, allow content to determine width
            scorecardTable.style.tableLayout = 'auto';
            scorecardTable.style.width = 'auto';
            scorecardTable.style.minWidth = '850px';
            scorecardTable.style.borderCollapse = 'collapse';
            
            // Style all cells
            var allCells = scorecardTable.querySelectorAll('th, td');
            allCells.forEach(function(cell) {
                cell.style.padding = '4px 6px';
                cell.style.fontSize = '0.85rem';
                cell.style.lineHeight = '1.2';
                cell.style.border = 'none';
            });
            
            // Make first column sticky and set width
            var firstColCells = scorecardTable.querySelectorAll('th:first-child, td:first-child');
            firstColCells.forEach(function(cell) {
                cell.style.position = 'sticky';
                cell.style.left = '0';
                cell.style.backgroundColor = '#111';
                cell.style.zIndex = '2';
                cell.style.fontWeight = '600';
                cell.style.textAlign = 'left';
                cell.style.minWidth = '55px';
                cell.style.width = '55px';
                cell.style.padding = '4px 4px';
            });
            
            // Center align score columns and set width
            var scoreCells = scorecardTable.querySelectorAll('th:not(:first-child), td:not(:first-child)');
            scoreCells.forEach(function(cell) {
                cell.style.textAlign = 'center';
                cell.style.minWidth = '38px';
                cell.style.width = '38px';
                cell.style.padding = '4px 2px';
            });
            
            // Style header row
            var headerCells = scorecardTable.querySelectorAll('thead th');
            headerCells.forEach(function(cell) {
                cell.style.fontWeight = '700';
                cell.style.backgroundColor = '#1a1a1a';
            });
            
            // Reduce row height
            var rows = scorecardTable.querySelectorAll('tr');
            rows.forEach(function(row) {
                row.style.lineHeight = '1.2';
            });
            
            // Ensure green separator lines are visible
            var greenLineRows = scorecardTable.querySelectorAll('.green-line');
            greenLineRows.forEach(function(row) {
                row.style.height = '2px';
                var cells = row.querySelectorAll('td');
                cells.forEach(function(cell) {
                    cell.style.borderBottom = '2px solid #4caf50';
                    cell.style.height = '2px';
                    cell.style.padding = '0';
                    cell.style.lineHeight = '0';
                    cell.style.fontSize = '0';
                });
            });
            
            // Ensure wrapper allows horizontal scroll
            var wrapper = document.getElementById(containerId);
            if (wrapper) {
                wrapper.style.overflowX = 'auto';
                wrapper.style.WebkitOverflowScrolling = 'touch';
            }
        }
    }
    
    // ============================================================
    // Player Cards with Bubbles
    // ============================================================
    
    function renderPlayerCards(containerId, players, getOpponents, getBubbleClass, getBubbleValue, getCurrentScore, canEdit, onScoreChange) {
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
                
                // Replace "AS" with green square in bubbles
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
                            <span class="player-handicap">${player.label} ${player.handicap}</span>
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
    // TR (Title Result) Display
    // ============================================================
    
    function updateTR(containerId, teamAPoints, teamBPoints, teamAGreen, teamBGreen) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var teamADisplay = teamAPoints % 1 === 0 ? teamAPoints : teamAPoints.toFixed(1);
        var teamBDisplay = teamBPoints % 1 === 0 ? teamBPoints : teamBPoints.toFixed(1);
        
        var isTie = (teamAPoints === teamBPoints);
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
    
    // ============================================================
    // Flight Tab Display (legacy)
    // ============================================================
    
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
    
    // ============================================================
    // Action Button Rendering (legacy)
    // ============================================================
    
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
    
    // Check both key orders for clinch lookup
    function getBubbleClassShared(player, opponent, currentHole, resultsCache, allPlayers, isHoleSavedFn, getHolePositionFn, clinchedAtMap) {
        var matchValue = getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn);
        var isHoleSavedForFlight = isHoleSavedFn(player.flight, currentHole);
        
        if (!isHoleSavedForFlight) return 'bubble-grey';
        
        var clinchHole = null;
        if (clinchedAtMap) {
            // Check both key orders
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
    
    // ============================================================
    // Navigation Logic (legacy wrappers)
    // ============================================================
    
    function updateNavButtonsWithDisableLogic(isCurrentSaved, hasUnsavedChanges, isGameComplete, celebrationTriggered) {
        // Deprecated - use updateNavigationButtons instead
    }
    
    function updateNextButtonForLastHole(currentHole, isLast, isCurrentSaved, onSignCardCallback) {
        // Deprecated - use updateNavigationButtons instead
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
    
    // ============================================================
    // Centralized Event Listener Attachment
    // ============================================================
    
    function attachGlobalEventListeners(onPrevHole, onNextHole) {
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
    }
    
    // ============================================================
    // Button Styles (with disabled states)
    // ============================================================
    
    function applyButtonStyles() {
        if (buttonStylesApplied) return;
        
        var style = document.createElement('style');
        style.id = 'gameui-button-styles';
        style.textContent = `
            .scorecard-wrapper {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            .scorecard-table {
                border-collapse: collapse;
                font-size: 0.7rem;
                min-width: 700px;
            }
            .scorecard-table th, .scorecard-table td {
                text-align: center;
                border: 1px solid #222;
                white-space: nowrap;
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
            
            /* Disabled button states - greyed out */
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
            .compact-pn-btn:disabled {
                background: #2a2a2a !important;
                color: #666666 !important;
                border-color: #444444 !important;
                opacity: 0.6 !important;
                cursor: not-allowed !important;
            }
        `;
        document.head.appendChild(style);
        
        buttonStylesApplied = true;
    }
    
    // ============================================================
    // Tight Layout Functions
    // ============================================================
    
    function applyTightLayout() {
        if (tightLayoutApplied) return;
        
        fixBackground();
        applyButtonStyles();
        applyGlobalBubbleStyles();
        
        var style = document.createElement('style');
        style.id = 'gameui-tight-layout';
        style.textContent = `
            #courseName { display: none !important; }
            .hole-par { display: none !important; }
            #flightTab { display: none !important; }
            .team-score-card { margin-top: 0 !important; margin-bottom: 8px !important; padding: 8px !important; }
            .container { padding-top: 30px !important; }
            .player-card { position: relative; }
        `;
        document.head.appendChild(style);
        
        tightLayoutApplied = true;
    }
    
    // ============================================================
    // Helper
    // ============================================================
    
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
        // Core rendering
        renderScorecard: renderScorecard,
        renderPlayerCards: renderPlayerCards,
        updateTR: updateTR,
        updateHoleHeader: updateHoleHeader,
        renderHoleHeader: renderHoleHeader,
        updateHoleHeaderNumber: updateHoleHeaderNumber,
        updateFlightTab: updateFlightTab,
        
        // Compact header
        renderCompactHeader: renderCompactHeader,
        updateCompactSaveButton: updateCompactSaveButton,
        updateCompactPnButton: updateCompactPnButton,
        updateCompactHoleDisplay: updateCompactHoleDisplay,
        
        // Flight badge
        addFlightBadge: addFlightBadge,
        updateFlightBadge: updateFlightBadge,
        removeFlightBadge: removeFlightBadge,
        
        // SINGLE SOURCE OF TRUTH - Navigation
        updateNavigationButtons: updateNavigationButtons,
        
        // Legacy compatibility
        updateFlightToggleButton: updateFlightBadge,
        updateFlightButtonText: updateFlightBadge,
        updatePnButtonText: updateCompactPnButton,
        
        // Display mode
        getDisplayMode: getDisplayMode,
        setDisplayMode: setDisplayMode,
        updateToggleButtons: updateToggleButtons,
        toggleDisplayMode: toggleDisplayMode,
        getDisplayHoles: getDisplayHoles,
        
        // Flight toggle
        toggleFlight: toggleFlight,
        getCurrentFlight: getCurrentFlight,
        
        // Action buttons (legacy)
        renderActionButtons: renderActionButtons,
        updateSaveButton: updateSaveButton,
        resetSaveButton: resetSaveButton,
        
        // Bottom menu
        renderBottomMenu: renderBottomMenu,
        
        // Shared display functions (with clinch support)
        getFlightOrderedPlayersShared: getFlightOrderedPlayersShared,
        getAllOpponentsShared: getAllOpponentsShared,
        getMatchValueShared: getMatchValueShared,
        getBubbleClassShared: getBubbleClassShared,
        getBubbleValueShared: getBubbleValueShared,
        
        // Navigation logic (deprecated legacy wrappers)
        updateNavButtonsWithDisableLogic: updateNavButtonsWithDisableLogic,
        updateNextButtonForLastHole: updateNextButtonForLastHole,
        setNextButtonToSignMode: setNextButtonToSignMode,
        setNextButtonToSeeResults: setNextButtonToSeeResults,
        ensureNoStuckModals: ensureNoStuckModals,
        
        // Event listeners
        attachGlobalEventListeners: attachGlobalEventListeners,
        
        // Layout and styles
        applyButtonStyles: applyButtonStyles,
        applyTightLayout: applyTightLayout,
        tightenScorecardRows: tightenScorecardRows,
        makeStatusBubbleClickable: makeStatusBubbleClickable,
        fixBackground: fixBackground,
        
        // Flight indicator (DEPRECATED)
        addFlightIndicator: function() {},
        removeFlightIndicator: function() {},
        updateFlightIndicator: updateFlightBadge
    };
    
})();

// ============================================================
// DUAL EXPORT - for compatibility with all game files
// ============================================================
window.gameUI = GameUI;
window.GameUI = GameUI;

/*
FILE: js/game-ui.js
VERSION: 4.18
KEY CHANGES from v4.09:
   - FIXED: T-1 row now displays when ONLY Flight 1 has saved the hole (no longer requires Flight 2)
   - FIXED: T-2 row now displays when ONLY Flight 2 has saved the hole (no longer requires Flight 1)
   - Strk row unchanged - still requires BOTH flights to have saved
   - NO other changes from v4.09 (table alignment preserved, bubble styles unchanged)
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/