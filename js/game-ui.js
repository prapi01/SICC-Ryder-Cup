/*
FILE: js/game-ui.js
VERSION: 2.16
KEY CHANGES:
   - ADDED: addFlightBadge() - adds FLIGHT # badge centered on first player card
   - CHANGED: renderCompactHeader() - new layout: [P/N] [SAVE H#] [◀ # ▶] with centered SAVE
   - CHANGED: All buttons now 52px height for easier tapping on mobile
   - REMOVED: Flight button from header (now a badge on player card)
   - REMOVED: Save icon (text only)
   - All existing functions unchanged from v2.15
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
        onToggleDisplay: null
    };
    
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
            this.style.transform = 'translateX(-50%) scale(1.02)';
        };
        statusBubble.onmouseleave = function() {
            this.style.opacity = '1';
            this.style.transform = 'translateX(-50%)';
        };
        statusBubble.onclick = function() {
            location.reload();
        };
    }
    
    // ============================================================
    // Add Flight Badge to First Player Card
    // ============================================================
    
    function addFlightBadge(flightNumber) {
        // Remove any existing badge
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
    // Render Compact Header (Single Line with Centered SAVE)
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
        
        // Add flight badge to first player card
        setTimeout(function() {
            addFlightBadge(flightNumber);
        }, 50);
        
        // Build header HTML
        var html = `
            <div class="compact-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px;">
                <button class="compact-pn-btn" id="compactPnBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; padding: 0 16px; min-width: 60px; height: 52px; font-size: 1rem; font-weight: 700; cursor: pointer; flex-shrink: 0;">
                    ${pnText}
                </button>
                <button class="compact-save-btn" id="compactSaveBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; padding: 0 20px; height: 52px; font-size: 1rem; font-weight: 700; cursor: pointer; flex: 1; text-align: center; white-space: nowrap;">
                    SAVE H${currentHole}
                </button>
                <div class="compact-nav-group" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <button class="compact-prev-btn" id="compactPrevBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 52px; height: 52px; border-radius: 30px; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ◀
                    </button>
                    <span class="compact-hole-display" style="font-size: 1.2rem; font-weight: 700; color: #4caf50; min-width: 44px; text-align: center;">${currentHole}</span>
                    <button class="compact-next-btn" id="compactNextBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 52px; height: 52px; border-radius: 30px; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ▶
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attach event listeners
        var pnBtn = document.getElementById('compactPnBtn');
        var saveBtn = document.getElementById('compactSaveBtn');
        var prevBtn = document.getElementById('compactPrevBtn');
        var nextBtn = document.getElementById('compactNextBtn');
        
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
        
        if (prevBtn && eventCallbacks.onPrevHole) {
            prevBtn.addEventListener('click', function() {
                if (eventCallbacks.onPrevHole) eventCallbacks.onPrevHole();
            });
        }
        
        if (nextBtn && eventCallbacks.onNextHole) {
            nextBtn.addEventListener('click', function() {
                if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
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
    // Legacy Functions (kept for compatibility)
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
    // Scorecard Rendering
    // ============================================================
    
    function renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
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
            html += '<tr><td style="font-weight:600;">' + escapeHtml(player.label) + '<\/td>';
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
        
        // T-1 row
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var val = t1Row[i] || '_';
            var holeNum = holes[i];
            var isSynced = (savedHoles && savedHoles[1] && savedHoles[2]) ? 
                (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1) : false;
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = 'score-green';
                } else {
                    displayVal = '';
                    cellClass = 'score-invisible';
                }
            } else if (val === 'A' || val === 'B') {
                displayVal = val;
                cellClass = 'score-green';
            } else if (val && val !== '_') {
                displayVal = val;
                cellClass = 'score-green';
            }
            
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Flight 2 players
        for (var p = 0; p < flight2Players.length; p++) {
            var player = flight2Players[p];
            html += '<tr><td style="font-weight:600;">' + escapeHtml(player.label) + '<\/td>';
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
        
        // T-2 row
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var val = t2Row[i] || '_';
            var holeNum = holes[i];
            var isSynced = (savedHoles && savedHoles[1] && savedHoles[2]) ? 
                (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1) : false;
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = 'score-green';
                } else {
                    displayVal = '';
                    cellClass = 'score-invisible';
                }
            } else if (val === 'A' || val === 'B') {
                displayVal = val;
                cellClass = 'score-green';
            } else if (val && val !== '_') {
                displayVal = val;
                cellClass = 'score-green';
            }
            
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Strk row
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var val = strkRow[i] || '_';
            var holeNum = holes[i];
            var isSynced = (savedHoles && savedHoles[1] && savedHoles[2]) ? 
                (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1) : false;
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = 'score-green';
                } else {
                    displayVal = '';
                    cellClass = 'score-invisible';
                }
            } else if (val === 'A' || val === 'B') {
                displayVal = val;
                cellClass = 'score-green';
            } else if (val && val !== '_') {
                displayVal = val;
                cellClass = 'score-green';
            }
            
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
        tightenScorecardRows();
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
                bubblesHtml += '<div class="bubble ' + bubbleClass + '">vs ' + escapeHtml(opp.label) + ' ' + bubbleValue + '</div>';
            }
            bubblesHtml += '</div>';
            
            html += `
                <div class="player-card" data-player-name="${escapeHtml(player.name)}" data-player-flight="${player.flight}">
                    <div class="player-header">
                        <div>
                            <span class="player-name">${escapeHtml(player.name)}</span>
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
    // Hole Header Display
    // ============================================================
    
    function updateHoleHeader(containerId, currentHole, currentPar, currentSi) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var html = `
            <div class="hole-number">HOLE ${currentHole}</div>
            <div class="hole-par">PAR ${currentPar}  SI ${currentSi}</div>
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
        
        var html = `
            <button class="btn btn-menu" id="menuBtn" style="width: 100%; padding: 14px; border-radius: 40px; font-weight: 600; text-align: center; cursor: pointer; background: #1a1a1a; color: #ccc; border: 1px solid #333; margin-top: 20px;">
                ← Back to Main Menu
            </button>
        `;
        
        container.innerHTML = html;
        
        var menuBtn = document.getElementById('menuBtn');
        if (menuBtn && eventCallbacks.onMenu) {
            var newMenuBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
            newMenuBtn.addEventListener('click', function() {
                if (eventCallbacks.onMenu) eventCallbacks.onMenu();
            });
        }
    }
    
    // ============================================================
    // Navigation Button Logic
    // ============================================================
    
    function updateNavButtonsWithDisableLogic(isCurrentSaved, hasUnsavedChanges, isGameComplete, celebrationTriggered) {
        var nextBtn = document.getElementById('compactNextBtn');
        if (!nextBtn) return;
        
        if (isGameComplete && !celebrationTriggered) {
            nextBtn.innerHTML = '🏆';
            nextBtn.disabled = false;
        } else {
            var isCurrentSavedState = isCurrentSaved && !hasUnsavedChanges;
            nextBtn.disabled = !isCurrentSavedState;
        }
    }
    
    function updateNextButtonForLastHole(currentHole, isLast, isCurrentSaved, onSignCardCallback) {
        var nextBtn = document.getElementById('compactNextBtn');
        if (!nextBtn) return;
        
        if (isLast && isCurrentSaved) {
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
            if (eventCallbacks.onNextHole) {
                nextBtn.onclick = function() {
                    if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
                };
            }
        }
    }
    
    function ensureNoStuckModals() {
        var modals = document.querySelectorAll('.modal-overlay');
        for (var i = 0; i < modals.length; i++) {
            modals[i].remove();
        }
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
    
    // ============================================================
    // Centralized Event Listener Attachment
    // ============================================================
    
    function attachGlobalEventListeners(onPrevHole, onNextHole) {
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
    }
    
    // ============================================================
    // Button Styles
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
            .score-invisible { color: #000; }
            .green-line td { border-bottom: 2px solid #4caf50; padding: 0; height: 2px; }
            
            .bubbles {
                display: flex;
                gap: 6px;
                margin-top: 12px;
                flex-wrap: wrap;
            }
            .bubble {
                flex: 1;
                min-width: 70px;
                text-align: center;
                padding: 6px;
                border-radius: 20px;
                font-size: 0.65rem;
                font-weight: 600;
            }
            .bubble-green { background: #1a3a1a; color: #4caf50; border: 1px solid #4caf50; }
            .bubble-red { background: #3a1a1a; color: #ff6b6b; border: 1px solid #ff6b6b; }
            .bubble-grey { background: #2a2a2a; color: #888; border: 1px solid #444; }
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
        
        var style = document.createElement('style');
        style.id = 'gameui-tight-layout';
        style.textContent = `
            #courseName { display: none !important; }
            .hole-par { display: none !important; }
            #flightTab { display: none !important; }
            .hole-header { margin-bottom: 4px !important; margin-top: 4px !important; }
            .team-score-card { margin-top: 0 !important; margin-bottom: 8px !important; padding: 8px !important; }
            .container { padding-top: 30px !important; }
            .player-card { position: relative; }
        `;
        document.head.appendChild(style);
        
        var statusBubble = document.getElementById('statusBubble');
        if (statusBubble) {
            statusBubble.style.position = 'fixed';
            statusBubble.style.top = '8px';
            statusBubble.style.left = '50%';
            statusBubble.style.transform = 'translateX(-50%)';
            statusBubble.style.zIndex = Z_INDEX.STATUS_BUBBLE;
            statusBubble.style.margin = '0';
            statusBubble.style.fontSize = '0.65rem';
            statusBubble.style.padding = '2px 10px';
            statusBubble.style.backgroundColor = 'rgba(0,0,0,0.7)';
            statusBubble.style.borderRadius = '20px';
        }
        
        makeStatusBubbleClickable();
        
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
        
        // Legacy compatibility
        renderScorecardHeader: renderCompactHeader,
        updateHoleNumberDisplay: updateCompactHoleDisplay,
        updateFlightButtonText: updateFlightBadge,
        updatePnButtonText: updateCompactPnButton,
        
        // Display mode
        getDisplayMode: getDisplayMode,
        setDisplayMode: setDisplayMode,
        updateToggleButtons: updateToggleButtons,
        toggleDisplayMode: toggleDisplayMode,
        getDisplayHoles: getDisplayHoles,
        
        // Flight toggle
        updateFlightToggleButton: updateFlightBadge,
        toggleFlight: toggleFlight,
        getCurrentFlight: getCurrentFlight,
        
        // Action buttons (legacy)
        renderActionButtons: renderActionButtons,
        updateSaveButton: updateSaveButton,
        resetSaveButton: resetSaveButton,
        
        // Bottom menu
        renderBottomMenu: renderBottomMenu,
        
        // Navigation logic
        updateNavButtonsWithDisableLogic: updateNavButtonsWithDisableLogic,
        updateNextButtonForLastHole: updateNextButtonForLastHole,
        ensureNoStuckModals: ensureNoStuckModals,
        setNextButtonToSignMode: setNextButtonToSignMode,
        setNextButtonToSeeResults: setNextButtonToSeeResults,
        
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

/*
FILE: js/game-ui.js
VERSION: 2.16
KEY CHANGES:
   - ADDED: addFlightBadge() - adds FLIGHT # badge centered on first player card
   - CHANGED: renderCompactHeader() - new layout: [P/N] [SAVE H#] [◀ # ▶] with centered SAVE
   - CHANGED: All buttons now 52px height for easier tapping on mobile
   - REMOVED: Flight button from header (now a badge on player card)
   - REMOVED: Save icon (text only)
   - All existing functions unchanged from v2.15
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/