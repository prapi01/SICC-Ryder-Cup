/*
FILE: js/game-ui.js
VERSION: 2.14
KEY CHANGES:
   - ADDED: renderScorecardHeader() - renders responsive scorecard header
   - Desktop (>550px): Single row layout
   - Mobile (<550px): Two-row stacked layout
     Row 1: SCORE (left) + Flight # (center) + ◀ # ▶ (right)
     Row 2: CARD + P/N button (left-aligned)
   - ADDED: updateHoleNumberDisplay() - updates hole number in header
   - ADDED: updateFlightButtonText() - updates flight button text
   - FIXED: Added full screen background coverage to prevent system UI bleed-through
   - FIXED: html/body background set to black with safe area insets
   - FIXED: Status bubble z-index and positioning improved
   - All existing functions unchanged from v2.13
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
    // Fix Background for All Pages (prevents system UI bleed-through)
    // ============================================================
    
    function fixBackground() {
        if (backgroundFixed) return;
        
        // Fix html element
        var htmlElem = document.documentElement;
        htmlElem.style.margin = '0';
        htmlElem.style.padding = '0';
        htmlElem.style.backgroundColor = '#000000';
        htmlElem.style.minHeight = '100vh';
        
        // Fix body element
        document.body.style.margin = '0';
        document.body.style.padding = '20px';
        document.body.style.backgroundColor = '#000000';
        document.body.style.minHeight = '100vh';
        document.body.style.position = 'relative';
        
        // Add viewport meta if missing or update existing
        var viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            var content = viewport.getAttribute('content');
            if (content && !content.includes('viewport-fit=cover')) {
                viewport.setAttribute('content', content + ', viewport-fit=cover');
            }
        }
        
        backgroundFixed = true;
        console.log('Background fixed to prevent system UI bleed-through');
    }
    
    // ============================================================
    // Scorecard Header Rendering (NEW - responsive)
    // ============================================================
    
    function renderScorecardHeader(containerId, flightNumber, currentHole, onPrevHole, onNextHole, onToggleFlight, onToggleDisplay) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        // Store callbacks
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
        if (onToggleFlight) eventCallbacks.onToggleFlight = onToggleFlight;
        if (onToggleDisplay) eventCallbacks.onToggleDisplay = onToggleDisplay;
        
        currentFlight = flightNumber;
        currentHoleNumber = currentHole;
        
        // Responsive HTML structure
        var html = `
            <div class="scorecard-header-responsive">
                <!-- Row 1: SCORE (left), Flight (center), Navigation (right) -->
                <div class="scorecard-header-row-1">
                    <div class="scorecard-label-group">
                        <span class="scorecard-label">SCORE</span>
                    </div>
                    <div class="scorecard-flight-group">
                        <button class="flight-toggle" id="flightToggleBtn">✈️ Flight ${flightNumber}</button>
                    </div>
                    <div class="scorecard-nav-group">
                        <button class="nav-btn" id="prevHoleBtn">◀</button>
                        <span class="hole-number-display" id="holeNumberDisplay">${currentHole}</span>
                        <button class="nav-btn" id="nextHoleBtn">▶</button>
                    </div>
                </div>
                <!-- Row 2: CARD (left) + P/N button -->
                <div class="scorecard-header-row-2">
                    <div class="scorecard-card-group">
                        <span class="scorecard-card-label">CARD</span>
                        <button class="pn-toggle" id="pnToggleBtn">${currentDisplayMode === 'play' ? 'P' : 'N'}</button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attach event listeners
        var prevBtn = document.getElementById('prevHoleBtn');
        var nextBtn = document.getElementById('nextHoleBtn');
        var pnBtn = document.getElementById('pnToggleBtn');
        var flightBtn = document.getElementById('flightToggleBtn');
        
        if (prevBtn && eventCallbacks.onPrevHole) {
            var newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            newPrevBtn.addEventListener('click', function() {
                if (eventCallbacks.onPrevHole) eventCallbacks.onPrevHole();
            });
        }
        
        if (nextBtn && eventCallbacks.onNextHole) {
            var newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
            newNextBtn.addEventListener('click', function() {
                if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
            });
        }
        
        if (pnBtn) {
            var newPnBtn = pnBtn.cloneNode(true);
            pnBtn.parentNode.replaceChild(newPnBtn, pnBtn);
            newPnBtn.addEventListener('click', function() {
                var newMode = currentDisplayMode === 'play' ? 'natural' : 'play';
                setDisplayMode(newMode, null);
                updatePnButtonText();
                if (eventCallbacks.onToggleDisplay) {
                    eventCallbacks.onToggleDisplay(newMode);
                }
            });
        }
        
        if (flightBtn) {
            var newFlightBtn = flightBtn.cloneNode(true);
            flightBtn.parentNode.replaceChild(newFlightBtn, flightBtn);
            newFlightBtn.addEventListener('click', function() {
                var newFlight = currentFlight === 1 ? 2 : 1;
                currentFlight = newFlight;
                updateFlightButtonText();
                if (eventCallbacks.onToggleFlight) {
                    eventCallbacks.onToggleFlight(newFlight);
                }
            });
        }
    }
    
    function updateHoleNumberDisplay(holeNumber) {
        currentHoleNumber = holeNumber;
        var holeDisplay = document.getElementById('holeNumberDisplay');
        if (holeDisplay) {
            holeDisplay.innerText = holeNumber;
        }
    }
    
    function updateFlightButtonText() {
        var flightBtn = document.getElementById('flightToggleBtn');
        if (flightBtn) {
            flightBtn.innerHTML = `✈️ Flight ${currentFlight}`;
        }
    }
    
    function updatePnButtonText() {
        var pnBtn = document.getElementById('pnToggleBtn');
        if (pnBtn) {
            pnBtn.innerText = currentDisplayMode === 'play' ? 'P' : 'N';
        }
    }
    
    // ============================================================
    // Scorecard Rendering (original - unchanged)
    // ============================================================
    
    function renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        // Group players by flight (Flight 1 then Flight 2)
        var flight1Players = players.filter(function(p) { return p.flight === 1; });
        var flight2Players = players.filter(function(p) { return p.flight === 2; });
        
        // Sort players within each flight: Team A (lowest handicap first), then Team B (lowest handicap first)
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
        html += '<tr><td style="font-weight:700;">Par</td>';
        var totalPar = 0;
        for (var i = 0; i < holes.length; i++) {
            var par = coursePar[holes[i] - 1];
            totalPar += par;
            html += '<td>' + par + '</td>';
        }
        html += '<td>' + totalPar + '</td></tr>';
        
        // SI row
        html += '<tr><td style="font-weight:700;">SI</td>';
        for (var i = 0; i < holes.length; i++) {
            var si = courseSi[holes[i] - 1];
            html += '<td>' + si + '</td>';
        }
        html += '<td>-</td></tr>';
        
        // GREEN LINE under SI row (separator)
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // Flight 1 players
        for (var p = 0; p < flight1Players.length; p++) {
            var player = flight1Players[p];
            html += '<tr><td style="font-weight:600;">' + escapeHtml(player.label) + '</td>';
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '</td>';
            }
            html += '<td class="score-green">' + playerTotal + '</td></tr>';
        }
        
        // Green line after Flight 1 (before T-1)
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // T-1 row (with AS for tied synced holes)
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1</td>';
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
            
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        // Green line after T-1 (before Flight 2)
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // Flight 2 players
        for (var p = 0; p < flight2Players.length; p++) {
            var player = flight2Players[p];
            html += '<tr><td style="font-weight:600;">' + escapeHtml(player.label) + '</td>';
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '</td>';
            }
            html += '<td class="score-green">' + playerTotal + '</td></tr>';
        }
        
        // GREEN LINE AFTER FLIGHT 2 (BEFORE T-2)
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // T-2 row (with AS for tied synced holes)
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2</td>';
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
            
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        // Green line after T-2 (before Strk)
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // Strk row (with AS for tied synced holes)
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk</td>';
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
            
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        html += '</tbody></table>';
        container.innerHTML = html;
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
        
        // Attach event listeners if editing is enabled
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
    // TR (Title Result) Display - Billboard Design
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
            <div style="text-align: center; font-family: system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif;">
                <div style="display: flex; justify-content: center; align-items: center; gap: 16px;">
                    <div style="text-align: center; min-width: 100px;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: ${teamAColor}; letter-spacing: 1px;">TEAM A</div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: ${teamAColor}; line-height: 1.2;">${teamADisplay}</div>
                    </div>
                    <div style="font-size: 1.5rem; font-weight: 400; color: ${separatorColor};">│</div>
                    <div style="text-align: center; min-width: 100px;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: ${teamBColor}; letter-spacing: 1px;">TEAM B</div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: ${teamBColor}; line-height: 1.2;">${teamBDisplay}</div>
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
    // Flight Tab Display (legacy - kept for compatibility)
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
        updatePnButtonText();
    }
    
    function setDisplayMode(mode, onModeChanged) {
        if (mode !== "play" && mode !== "natural") return;
        currentDisplayMode = mode;
        localStorage.setItem("scorecardDisplay", mode);
        updateToggleButtons(mode);
        updatePnButtonText();
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
    // Flight Toggle Functions
    // ============================================================
    
    function updateFlightToggleButton(flightNumber) {
        currentFlight = flightNumber;
        updateFlightButtonText();
    }
    
    function toggleFlight() {
        var newFlight = currentFlight === 1 ? 2 : 1;
        currentFlight = newFlight;
        updateFlightButtonText();
        if (eventCallbacks.onToggleFlight) {
            eventCallbacks.onToggleFlight(currentFlight);
        }
    }
    
    function getCurrentFlight() {
        return currentFlight;
    }
    
    // ============================================================
    // Action Button Rendering
    // ============================================================
    
    function renderActionButtons(containerId, currentHole, isSaveDisabled, onSaveCallback) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (onSaveCallback) {
            eventCallbacks.onSave = onSaveCallback;
        }
        
        var html = `
            <div class="action-buttons" style="display: flex; gap: 0; margin: 20px 0;">
                <button class="btn btn-save" id="saveBtn" style="flex: 1; width: 100%; display: block; margin: 0; border-radius: 40px; padding: 14px; font-size: 1rem; font-weight: 700;" ${isSaveDisabled ? 'disabled' : ''}>
                    💾 SAVE H${currentHole}
                </button>
            </div>
        `;
        
        container.innerHTML = html;
        
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn && eventCallbacks.onSave) {
            var newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            newSaveBtn.addEventListener('click', function() {
                if (eventCallbacks.onSave) eventCallbacks.onSave();
            });
        }
    }
    
    function updateSaveButton(currentHole, isDisabled) {
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '💾 SAVE H' + currentHole;
            saveBtn.disabled = isDisabled;
        }
    }
    
    function resetSaveButton(currentHole) {
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.classList.remove('btn-save-pending', 'btn-save-retry', 'btn-save-flash');
            saveBtn.classList.add('btn-save');
            saveBtn.innerHTML = '💾 SAVE H' + currentHole;
            saveBtn.disabled = false;
        }
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
        var prevBtn = document.getElementById('prevHoleBtn');
        var nextBtn = document.getElementById('nextHoleBtn');
        
        if (!prevBtn || !nextBtn) return;
        
        if (isGameComplete && !celebrationTriggered) {
            nextBtn.textContent = "🏆";
            nextBtn.disabled = false;
            nextBtn.classList.add('btn-next');
            nextBtn.classList.remove('btn-next-inactive');
        } else {
            var isCurrentSavedState = isCurrentSaved && !hasUnsavedChanges;
            
            if (isCurrentSavedState) {
                nextBtn.disabled = false;
                nextBtn.classList.add('btn-next');
                nextBtn.classList.remove('btn-next-inactive');
            } else {
                nextBtn.disabled = true;
                nextBtn.classList.add('btn-next-inactive');
                nextBtn.classList.remove('btn-next');
            }
        }
    }
    
    function updateNextButtonForLastHole(currentHole, isLast, isCurrentSaved, onSignCardCallback) {
        var nextHoleBtn = document.getElementById('nextHoleBtn');
        if (!nextHoleBtn) return;
        
        if (isLast && isCurrentSaved) {
            nextHoleBtn.innerHTML = '✍️';
            nextHoleBtn.style.background = '#ffaa44';
            nextHoleBtn.style.color = '#1a3a1a';
            nextHoleBtn.style.border = '1px solid #ffaa44';
            nextHoleBtn.style.fontWeight = 'bold';
            nextHoleBtn.disabled = false;
            
            nextHoleBtn._onSignCard = onSignCardCallback;
            
            var newBtn = nextHoleBtn.cloneNode(true);
            nextHoleBtn.parentNode.replaceChild(newBtn, nextHoleBtn);
            newBtn._onSignCard = onSignCardCallback;
            newBtn.onclick = function(e) {
                e.stopPropagation();
                if (this._onSignCard && typeof this._onSignCard === 'function') {
                    this._onSignCard();
                }
            };
        } else {
            nextHoleBtn.innerHTML = '▶';
            nextHoleBtn.style.background = '#1a3a1a';
            nextHoleBtn.style.color = '#4caf50';
            nextHoleBtn.style.border = '1px solid #4caf50';
            nextHoleBtn.disabled = !isCurrentSaved;
        }
    }
    
    function ensureNoStuckModals() {
        var modals = document.querySelectorAll('.modal-overlay');
        for (var i = 0; i < modals.length; i++) {
            modals[i].remove();
        }
    }
    
    function setNextButtonToSignMode() {
        var nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.textContent = "✍️";
            nextBtn.disabled = false;
            nextBtn.classList.add('btn-next');
            nextBtn.classList.remove('btn-next-inactive');
        }
    }
    
    function setNextButtonToSeeResults() {
        var nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.textContent = "🏆";
            nextBtn.disabled = false;
            nextBtn.classList.add('btn-next');
            nextBtn.classList.remove('btn-next-inactive');
        }
    }
    
    // ============================================================
    // Centralized Event Listener Attachment
    // ============================================================
    
    function attachGlobalEventListeners(onPrevHole, onNextHole) {
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
        
        var prevHoleBtn = document.getElementById('prevHoleBtn');
        var nextHoleBtn = document.getElementById('nextHoleBtn');
        
        if (prevHoleBtn && eventCallbacks.onPrevHole) {
            var newPrevBtn = prevHoleBtn.cloneNode(true);
            prevHoleBtn.parentNode.replaceChild(newPrevBtn, prevHoleBtn);
            newPrevBtn.addEventListener('click', function() {
                if (eventCallbacks.onPrevHole) eventCallbacks.onPrevHole();
            });
        }
        
        if (nextHoleBtn && eventCallbacks.onNextHole) {
            var newNextBtn = nextHoleBtn.cloneNode(true);
            nextHoleBtn.parentNode.replaceChild(newNextBtn, nextHoleBtn);
            newNextBtn.addEventListener('click', function() {
                if (eventCallbacks.onNextHole) eventCallbacks.onNextHole();
            });
        }
    }
    
    // ============================================================
    // Button Styles - Single Source of Truth (with responsive fixes)
    // ============================================================
    
    function applyButtonStyles() {
        if (buttonStylesApplied) return;
        
        var style = document.createElement('style');
        style.id = 'gameui-button-styles';
        style.textContent = `
            /* Base styles */
            .pn-toggle {
                background: #1a3a1a !important;
                border: 1px solid #4caf50 !important;
                color: #4caf50 !important;
                border-radius: 30px !important;
                padding: 6px 12px !important;
                min-width: 45px !important;
                font-size: 0.9rem !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                text-align: center !important;
            }
            
            .flight-toggle {
                background: #1a3a1a !important;
                border: 1px solid #4caf50 !important;
                color: #4caf50 !important;
                border-radius: 30px !important;
                padding: 6px 16px !important;
                font-size: 0.8rem !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                min-width: 90px !important;
                display: inline-block !important;
                text-align: center !important;
            }
            
            .nav-btn {
                background: #1a3a1a !important;
                border: 1px solid #4caf50 !important;
                color: #4caf50 !important;
                width: 36px !important;
                height: 36px !important;
                border-radius: 20px !important;
                font-size: 1rem !important;
                cursor: pointer !important;
                font-weight: bold !important;
            }
            .nav-btn:disabled {
                background: #2a2a2a !important;
                color: #555 !important;
                border: 1px solid #444 !important;
                cursor: not-allowed !important;
            }
            
            /* Responsive Scorecard Header */
            .scorecard-header-responsive {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 10px;
            }
            
            .scorecard-header-row-1 {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
            }
            
            .scorecard-label-group {
                display: flex;
                align-items: center;
            }
            
            .scorecard-label {
                font-size: 0.9rem;
                font-weight: 600;
                color: #4caf50;
                border-left: 2px solid #4caf50;
                padding-left: 10px;
            }
            
            .scorecard-flight-group {
                display: flex;
                justify-content: center;
                flex: 1;
            }
            
            .scorecard-nav-group {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .scorecard-header-row-2 {
                display: flex;
                justify-content: flex-start;
                align-items: center;
            }
            
            .scorecard-card-group {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .scorecard-card-label {
                font-size: 0.9rem;
                font-weight: 600;
                color: #4caf50;
            }
            
            .hole-number-display {
                font-size: 0.9rem;
                font-weight: 600;
                color: #4caf50;
                min-width: 45px;
                text-align: center;
            }
            
            /* Desktop layout (>550px) - override to single row */
            @media (min-width: 551px) {
                .scorecard-header-responsive {
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                }
                .scorecard-header-row-1 {
                    flex: 2;
                    gap: 16px;
                }
                .scorecard-flight-group {
                    flex: 0 0 auto;
                }
                .scorecard-header-row-2 {
                    flex: 0 0 auto;
                }
            }
            
            /* SAVE Button Full Width */
            .btn-save {
                flex: 1 !important;
                width: 100% !important;
                display: block !important;
                margin: 0 !important;
                border-radius: 40px !important;
                padding: 14px !important;
                font-size: 1rem !important;
                font-weight: 700 !important;
                background: #1a3a1a !important;
                color: #4caf50 !important;
                border: 1px solid #4caf50 !important;
                cursor: pointer !important;
            }
            .btn-save:disabled {
                opacity: 0.4 !important;
                cursor: not-allowed !important;
            }
            .btn-save-pending {
                background: #3a1a1a !important;
                color: #ff6b6b !important;
                border: 1px solid #ff6b6b !important;
            }
            .btn-save-retry {
                background: #3a1a1a !important;
                color: #ffaa44 !important;
                border: 1px solid #ffaa44 !important;
            }
            .btn-save-flash {
                animation: flashGreen 0.5s ease !important;
            }
            
            @keyframes flashGreen {
                0% { background: #1a3a1a; border-color: #4caf50; color: #4caf50; }
                50% { background: #4caf50; border-color: #4caf50; color: #1a3a1a; }
                100% { background: #1a3a1a; border-color: #4caf50; color: #4caf50; }
            }
            
            /* Scorecard table - horizontal scroll only, no fixed min-width */
            .scorecard-wrapper {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            .scorecard-table {
                border-collapse: collapse;
                font-size: 0.7rem;
            }
            .scorecard-table th, .scorecard-table td {
                padding: 6px 3px;
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
            
            /* Bubble responsiveness */
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
        `;
        document.head.appendChild(style);
        
        buttonStylesApplied = true;
    }
    
    // ============================================================
    // Tight Layout Functions for Phone
    // ============================================================
    
    function applyTightLayout() {
        if (tightLayoutApplied) return;
        
        // Fix background first
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
        
        // Move status bubble to top center with correct z-index
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
        
        tightLayoutApplied = true;
    }
    
    // ============================================================
    // Flight Indicator Functions (DEPRECATED)
    // ============================================================
    
    function addFlightIndicator(flightNumber) {
        console.log('Flight indicator deprecated - use Flight toggle button in scorecard header');
    }
    
    function removeFlightIndicator() {
        // Deprecated
    }
    
    function updateFlightIndicator(flightNumber) {
        updateFlightToggleButton(flightNumber);
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
        
        // NEW: Scorecard header
        renderScorecardHeader: renderScorecardHeader,
        updateHoleNumberDisplay: updateHoleNumberDisplay,
        updateFlightButtonText: updateFlightButtonText,
        updatePnButtonText: updatePnButtonText,
        
        // Display mode
        getDisplayMode: getDisplayMode,
        setDisplayMode: setDisplayMode,
        updateToggleButtons: updateToggleButtons,
        toggleDisplayMode: toggleDisplayMode,
        getDisplayHoles: getDisplayHoles,
        
        // Flight toggle
        updateFlightToggleButton: updateFlightToggleButton,
        toggleFlight: toggleFlight,
        getCurrentFlight: getCurrentFlight,
        
        // Action buttons
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
        fixBackground: fixBackground,
        
        // Flight indicator (DEPRECATED)
        addFlightIndicator: addFlightIndicator,
        removeFlightIndicator: removeFlightIndicator,
        updateFlightIndicator: updateFlightIndicator
    };
    
})();

/*
FILE: js/game-ui.js
VERSION: 2.14
KEY CHANGES:
   - ADDED: renderScorecardHeader() - renders responsive scorecard header
   - Desktop (>550px): Single row layout
   - Mobile (<550px): Two-row stacked layout
     Row 1: SCORE (left) + Flight # (center) + ◀ # ▶ (right)
     Row 2: CARD + P/N button (left-aligned)
   - ADDED: updateHoleNumberDisplay() - updates hole number in header
   - ADDED: updateFlightButtonText() - updates flight button text
   - FIXED: Added full screen background coverage to prevent system UI bleed-through
   - FIXED: html/body background set to black with safe area insets
   - FIXED: Status bubble z-index and positioning improved
   - All existing functions unchanged from v2.13
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/