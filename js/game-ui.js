/*
FILE: js/game-ui.js
VERSION: 2.05
KEY CHANGES:
   - ADDED: applyTightLayout() - injects CSS for tighter phone layout
   - ADDED: addFlightIndicator(flightNumber) - adds small flight bubble to first player card
   - ADDED: removeFlightIndicator() - removes flight bubble when flight changes
   - ADDED: updateLIVEBubblePosition() - centers LIVE bubble at top of screen
   - All existing UI functions unchanged (renderScorecard, renderPlayerCards, updateTR, etc.)
   - Single source of truth for all UI layout
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/

var GameUI = (function() {
    
    // ============================================================
    // Existing Functions (unchanged from v2.04)
    // ============================================================
    
    // Track if tight layout has been applied
    var tightLayoutApplied = false;
    var currentFlightIndicator = null;
    
    // ============================================================
    // Scorecard Rendering (IDENTICAL to v2.04)
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
    // Player Cards with Bubbles (IDENTICAL to v2.04)
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
        var teamAColor = teamAGreen ? '#4caf50' : '#ff6b6b';
        var teamBColor = teamBGreen ? '#4caf50' : '#ff6b6b';
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
    // Flight Tab Display
    // ============================================================
    
    function updateFlightTab(containerId, flightNumber, canEdit) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var pencilIcon = canEdit ? ' ✏️' : '';
        container.innerHTML = 'Flight ' + flightNumber + pencilIcon;
    }
    
    // ============================================================
    // Display Mode Management (IDENTICAL to v2.04)
    // ============================================================
    
    var currentDisplayMode = "play";
    
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
    }
    
    function setDisplayMode(mode, onModeChanged) {
        if (mode !== "play" && mode !== "natural") return;
        currentDisplayMode = mode;
        localStorage.setItem("scorecardDisplay", mode);
        updateToggleButtons(mode);
        if (onModeChanged && typeof onModeChanged === 'function') {
            onModeChanged(mode);
        }
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
    // NEW: Tight Layout Functions for Phone
    // ============================================================
    
    function applyTightLayout() {
        if (tightLayoutApplied) return;
        
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
            
            /* Player card needs relative position for absolute flight indicator */
            .player-card {
                position: relative;
            }
        `;
        document.head.appendChild(style);
        
        // Move LIVE bubble to top center
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
    
    function addFlightIndicator(flightNumber) {
        // Remove existing indicator first
        removeFlightIndicator();
        
        var playerCards = document.getElementById('playerCards');
        if (!playerCards || playerCards.children.length === 0) return;
        
        var firstCard = playerCards.children[0];
        var flightIndicator = document.createElement('div');
        flightIndicator.className = 'flight-indicator';
        flightIndicator.id = 'flightIndicator';
        flightIndicator.innerHTML = 'Flight ' + flightNumber;
        flightIndicator.style.cssText = `
            position: absolute;
            top: -16px;
            left: 10px;
            background: #1a3a1a;
            border: 1px solid #4caf50;
            color: #4caf50;
            font-size: 0.6rem;
            font-weight: 600;
            padding: 2px 10px;
            border-radius: 20px;
            z-index: 10;
        `;
        firstCard.style.position = 'relative';
        firstCard.appendChild(flightIndicator);
        currentFlightIndicator = flightIndicator;
    }
    
    function removeFlightIndicator() {
        if (currentFlightIndicator) {
            currentFlightIndicator.remove();
            currentFlightIndicator = null;
        }
        // Also remove any other flight indicators that might exist
        var existing = document.querySelectorAll('.flight-indicator');
        for (var i = 0; i < existing.length; i++) {
            existing[i].remove();
        }
    }
    
    function updateFlightIndicator(flightNumber) {
        addFlightIndicator(flightNumber);
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
        // Existing
        renderScorecard: renderScorecard,
        renderPlayerCards: renderPlayerCards,
        updateTR: updateTR,
        updateHoleHeader: updateHoleHeader,
        updateFlightTab: updateFlightTab,
        getDisplayMode: getDisplayMode,
        setDisplayMode: setDisplayMode,
        updateToggleButtons: updateToggleButtons,
        getDisplayHoles: getDisplayHoles,
        
        // NEW: Tight layout functions
        applyTightLayout: applyTightLayout,
        addFlightIndicator: addFlightIndicator,
        removeFlightIndicator: removeFlightIndicator,
        updateFlightIndicator: updateFlightIndicator
    };
    
})();

/*
FILE: js/game-ui.js
VERSION: 2.05
KEY CHANGES:
   - ADDED: applyTightLayout() - injects CSS for tighter phone layout
   - ADDED: addFlightIndicator(flightNumber) - adds small flight bubble to first player card
   - ADDED: removeFlightIndicator() - removes flight bubble when flight changes
   - ADDED: updateFlightIndicator() - updates flight number on indicator
   - All existing UI functions unchanged (renderScorecard, renderPlayerCards, updateTR, etc.)
   - Single source of truth for all UI layout
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/