/*
FILE: js/game-ui.js
VERSION: 2.10
KEY CHANGES:
   - ADDED: resetSaveButton() - properly resets save button to normal green state
   - Removes btn-save-pending, btn-save-retry, btn-save-flash classes
   - Restores normal btn-save styling and text
   - All existing functions unchanged from v2.09
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/

var GameUI = (function() {
    
    // ============================================================
    // Existing Functions (unchanged from v2.09)
    // ============================================================
    
    // Track if styles have been applied
    var tightLayoutApplied = false;
    var buttonStylesApplied = false;
    
    // Track current state for UI updates
    var currentFlight = 1;
    var currentDisplayMode = "play";
    
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
    // Scorecard Rendering
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
        
        // GREEN LINE under SI row (separator)
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
        
        // Green line after Flight 1 (before T-1)
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-1 row (with AS for tied synced holes)
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
        
        // Green line after T-1 (before Flight 2)
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
        
        // GREEN LINE AFTER FLIGHT 2 (BEFORE T-2)
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-2 row (with AS for tied synced holes)
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
        
        // Green line after T-2 (before Strk)
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Strk row (with AS for tied synced holes)
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
        // Also update P/N toggle button if it exists
        var pnToggle = document.getElementById('pnToggleBtn');
        if (pnToggle) {
            pnToggle.innerText = mode === 'play' ? 'P' : 'N';
        }
    }
    
    function setDisplayMode(mode, onModeChanged) {
        if (mode !== "play" && mode !== "natural") return;
        currentDisplayMode = mode;
        localStorage.setItem("scorecardDisplay", mode);
        updateToggleButtons(mode);
        if (onModeChanged && typeof onModeChanged === 'function') {
            onModeChanged(mode);
        }
        // Also trigger callback if registered
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
        var flightToggle = document.getElementById('flightToggleBtn');
        if (flightToggle) {
            flightToggle.innerHTML = '✈️ Flight ' + flightNumber;
        }
        currentFlight = flightNumber;
    }
    
    function toggleFlight() {
        var newFlight = currentFlight === 1 ? 2 : 1;
        currentFlight = newFlight;
        updateFlightToggleButton(currentFlight);
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
        
        // Store save callback for later use
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
        
        // Attach event listener
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn && eventCallbacks.onSave) {
            // Remove any existing listeners to avoid duplicates
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
            if (isDisabled) {
                saveBtn.disabled = true;
            } else {
                saveBtn.disabled = false;
            }
        }
    }
    
    // NEW: Reset save button to normal green state (removes pending/retry classes)
    function resetSaveButton(currentHole) {
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            // Remove all state classes
            saveBtn.classList.remove('btn-save-pending', 'btn-save-retry', 'btn-save-flash');
            // Add the normal save class
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
        
        // Store menu callback
        if (onMenuCallback) {
            eventCallbacks.onMenu = onMenuCallback;
        }
        
        var html = `
            <button class="btn btn-menu" id="menuBtn" style="width: 100%; padding: 14px; border-radius: 40px; font-weight: 600; text-align: center; cursor: pointer; background: #1a1a1a; color: #ccc; border: 1px solid #333; margin-top: 20px;">
                ← Back to Main Menu
            </button>
        `;
        
        container.innerHTML = html;
        
        // Attach event listener
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
    // Navigation Button Disable Logic (centralized)
    // ============================================================
    
    function updateNavButtonsWithDisableLogic(isCurrentSaved, hasUnsavedChanges, isGameComplete, celebrationTriggered) {
        var prevBtn = document.getElementById('prevHoleBtn');
        var nextBtn = document.getElementById('nextHoleBtn');
        
        if (!prevBtn || !nextBtn) return;
        
        // For prev button - always enabled unless at first hole (handled by caller)
        // We don't disable prev based on save state, only based on position
        
        // For next button - disable logic
        if (isGameComplete && !celebrationTriggered) {
            // Game complete - next button becomes "SEE RESULTS"
            nextBtn.textContent = "🏆";
            nextBtn.disabled = false;
            nextBtn.classList.add('btn-next');
            nextBtn.classList.remove('btn-next-inactive');
        } else {
            // Normal game mode
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
        // Store callbacks
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
        
        // Attach to scorecard header navigation buttons
        var prevHoleBtn = document.getElementById('prevHoleBtn');
        var nextHoleBtn = document.getElementById('nextHoleBtn');
        var pnToggleBtn = document.getElementById('pnToggleBtn');
        var flightToggleBtn = document.getElementById('flightToggleBtn');
        
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
        
        if (pnToggleBtn) {
            var newPnBtn = pnToggleBtn.cloneNode(true);
            pnToggleBtn.parentNode.replaceChild(newPnBtn, pnToggleBtn);
            newPnBtn.addEventListener('click', function() {
                toggleDisplayMode();
            });
        }
        
        if (flightToggleBtn) {
            var newFlightBtn = flightToggleBtn.cloneNode(true);
            flightToggleBtn.parentNode.replaceChild(newFlightBtn, flightToggleBtn);
            newFlightBtn.addEventListener('click', function() {
                toggleFlight();
            });
        }
    }
    
    // ============================================================
    // Button Styles - Single Source of Truth
    // ============================================================
    
    function applyButtonStyles() {
        if (buttonStylesApplied) return;
        
        var style = document.createElement('style');
        style.id = 'gameui-button-styles';
        style.textContent = `
            /* P/N Toggle Button */
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
            
            /* Flight Toggle Button */
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
            
            /* Play Order / Natural Order Toggle Buttons */
            .toggle-btn {
                background: #1a1a1a !important;
                border: 1px solid #333 !important;
                color: #888 !important;
                border-radius: 30px !important;
                padding: 4px 12px !important;
                font-size: 0.65rem !important;
                cursor: pointer !important;
            }
            .toggle-btn.active {
                background: #1a3a1a !important;
                border-color: #4caf50 !important;
                color: #4caf50 !important;
            }
            
            /* Navigation Buttons */
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
            
            /* Scorecard Header Layout */
            .scorecard-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 10px !important;
                gap: 8px !important;
                flex-wrap: wrap !important;
            }
            .scorecard-left-group {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
            }
            .scorecard-title {
                font-size: 0.9rem !important;
                font-weight: 600 !important;
                color: #4caf50 !important;
                border-left: 2px solid #4caf50 !important;
                padding-left: 10px !important;
            }
            .nav-group {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }
            .hole-number-display {
                font-size: 0.9rem !important;
                font-weight: 600 !important;
                color: #4caf50 !important;
                min-width: 45px !important;
                text-align: center !important;
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
        `;
        document.head.appendChild(style);
        
        buttonStylesApplied = true;
    }
    
    // ============================================================
    // Tight Layout Functions for Phone
    // ============================================================
    
    function applyTightLayout() {
        if (tightLayoutApplied) return;
        
        // First ensure button styles are applied
        applyButtonStyles();
        
        var style = document.createElement('style');
        style.id = 'gameui-tight-layout';
        style.textContent = `
            /* Hide course name (redundant) */
            #courseName {
                display: none !important;
            }
            
            /* Hide PAR/SI line in hole header */
            .hole-par {
                display: none !important;
            }
            
            /* Hide separate flight tab - now on player card */
            #flightTab {
                display: none !important;
            }
            
            /* Reduce space between HOLE X and TR */
            .hole-header {
                margin-bottom: 4px !important;
                margin-top: 4px !important;
            }
            
            .team-score-card {
                margin-top: 0 !important;
                margin-bottom: 8px !important;
                padding: 8px !important;
            }
            
            /* Tighter container padding */
            .container {
                padding-top: 30px !important;
            }
            
            /* Player card needs relative position for absolute flight indicator (deprecated but kept) */
            .player-card {
                position: relative;
            }
        `;
        document.head.appendChild(style);
        
        // Move LIVE/VIEWER/PREVIEW bubble to top center
        var statusBubble = document.getElementById('statusBubble');
        if (statusBubble) {
            statusBubble.style.position = 'fixed';
            statusBubble.style.top = '8px';
            statusBubble.style.left = '50%';
            statusBubble.style.transform = 'translateX(-50%)';
            statusBubble.style.zIndex = '1001';
            statusBubble.style.margin = '0';
            statusBubble.style.fontSize = '0.65rem';
            statusBubble.style.padding = '2px 10px';
        }
        
        tightLayoutApplied = true;
    }
    
    // ============================================================
    // Flight Indicator Functions (DEPRECATED - kept for compatibility)
    // ============================================================
    
    function addFlightIndicator(flightNumber) {
        // Deprecated - do nothing
        console.log('Flight indicator deprecated - use Flight toggle button in scorecard header');
    }
    
    function removeFlightIndicator() {
        // Deprecated - do nothing
    }
    
    function updateFlightIndicator(flightNumber) {
        // Deprecated - use updateFlightToggleButton instead
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
        resetSaveButton: resetSaveButton,  // NEW: Reset save button to green state
        
        // Bottom menu
        renderBottomMenu: renderBottomMenu,
        
        // Navigation logic
        updateNavButtonsWithDisableLogic: updateNavButtonsWithDisableLogic,
        setNextButtonToSignMode: setNextButtonToSignMode,
        setNextButtonToSeeResults: setNextButtonToSeeResults,
        
        // Event listeners
        attachGlobalEventListeners: attachGlobalEventListeners,
        
        // Layout and styles
        applyButtonStyles: applyButtonStyles,
        applyTightLayout: applyTightLayout,
        
        // Flight indicator (DEPRECATED)
        addFlightIndicator: addFlightIndicator,
        removeFlightIndicator: removeFlightIndicator,
        updateFlightIndicator: updateFlightIndicator
    };
    
})();

/*
FILE: js/game-ui.js
VERSION: 2.10
KEY CHANGES:
   - ADDED: resetSaveButton() - properly resets save button to normal green state
   - Removes btn-save-pending, btn-save-retry, btn-save-flash classes
   - Restores normal btn-save styling and text
   - All existing functions unchanged from v2.09
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/