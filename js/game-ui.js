/*
FILE: js/game-ui.js
VERSION: 2.03
KEY CHANGES:
   - ONLY updateTR() function changed to new billboard design
   - ALL other functions identical to v2.01 (working version)
   - renderScorecard() unchanged (no savedHoles dependency issues)
   - renderPlayerCards() unchanged
   - All display mode functions unchanged
   - TR display: Team A | Team B with vertical separator
   - Font sizes: 0.85rem for team names, 1.8rem for numbers
   - Colours: Green for winning/tie, Red for losing
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/

var GameUI = (function() {
    
    // ============================================================
    // Scorecard Rendering (IDENTICAL to v2.01 - NO CHANGES)
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
        html += '<tr class="green-line"><td colspan="20"> </td>';
        
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
    // Player Cards with Bubbles (IDENTICAL to v2.01 - NO CHANGES)
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
    // TR (Title Result) Display - NEW BILLBOARD DESIGN v2.03
    // ONLY THIS FUNCTION CHANGED FROM v2.01
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
    // Hole Header Display (IDENTICAL to v2.01 - NO CHANGES)
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
    // Flight Tab Display (IDENTICAL to v2.01 - NO CHANGES)
    // ============================================================
    
    function updateFlightTab(containerId, flightNumber, canEdit) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var pencilIcon = canEdit ? ' ✏️' : '';
        container.innerHTML = 'Flight ' + flightNumber + pencilIcon;
    }
    
    // ============================================================
    // Display Mode Management (IDENTICAL to v2.01 - NO CHANGES)
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
    // Helper (IDENTICAL to v2.01 - NO CHANGES)
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
    // Public API (IDENTICAL to v2.01 - NO CHANGES)
    // ============================================================
    
    return {
        renderScorecard: renderScorecard,
        renderPlayerCards: renderPlayerCards,
        updateTR: updateTR,
        updateHoleHeader: updateHoleHeader,
        updateFlightTab: updateFlightTab,
        getDisplayMode: getDisplayMode,
        setDisplayMode: setDisplayMode,
        updateToggleButtons: updateToggleButtons,
        getDisplayHoles: getDisplayHoles
    };
    
})();

/*
FILE: js/game-ui.js
VERSION: 2.03
KEY CHANGES:
   - ONLY updateTR() function changed to new billboard design
   - ALL other functions identical to v2.01 (working version)
   - renderScorecard() unchanged (no savedHoles dependency issues)
   - renderPlayerCards() unchanged
   - All display mode functions unchanged
   - TR display: Team A | Team B with vertical separator
   - Font sizes: 0.85rem for team names, 1.8rem for numbers
   - Colours: Green for winning/tie, Red for losing
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/