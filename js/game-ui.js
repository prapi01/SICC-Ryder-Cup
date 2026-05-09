/*
FILE: js/game-ui.js
VERSION: 1.00
PURPOSE: Shared UI rendering module for all game modes (REAL, PREVIEW, VIEW)
          - Scorecard rendering
          - Player cards with bubbles
          - TR display
          - Hole header
          - Flight tab
          - No Firebase, no data fetching, only rendering
STATUS: Ready for testing
*/

var GameUI = (function() {
    
    // ============================================================
    // Scorecard Rendering
    // ============================================================
    // Parameters:
    //   containerId: HTML element id to render into
    //   holes: array of hole numbers in display order (e.g., [10,11,12,...] or [1,2,3,...])
    //   players: array of player objects with properties: label, flight, team, handicap
    //   getStoredScore: function(player, hole) returns score for that player on that hole
    //   isHoleSaved: function(flight, hole) returns true if hole is saved for that flight
    //   t1Row: array of 18 values ("A"/"B"/"0"/"_") for T-1 row
    //   t2Row: array of 18 values for T-2 row
    //   strkRow: array of 18 values for Strk row
    //   coursePar: array of 18 par values
    //   courseSi: array of 18 stroke index values
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
        
        // Green line after Flight 1
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-1 row
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var val = t1Row[i] || '_';
            var displayVal = (val === '_' || val === '') ? '' : val;
            var cellClass = (val && val !== '_') ? 'score-green' : 'score-invisible';
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        // Green line after T-1
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
        
        // T-2 row
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var val = t2Row[i] || '_';
            var displayVal = (val === '_' || val === '') ? '' : val;
            var cellClass = (val && val !== '_') ? 'score-green' : 'score-invisible';
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        // Green line after T-2
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Strk row
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var val = strkRow[i] || '_';
            var displayVal = (val === '_' || val === '') ? '' : val;
            var cellClass = (val && val !== '_') ? 'score-green' : 'score-invisible';
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // Player Cards with Bubbles
    // ============================================================
    // Parameters:
    //   containerId: HTML element id to render into
    //   players: array of players for the current flight
    //   opponents: function(player) returns array of opponents for that player
    //   getBubbleClass: function(player, opponent) returns CSS class for bubble
    //   getBubbleValue: function(player, opponent) returns text for bubble
    //   getCurrentScore: function(player) returns current score for this player
    //   canEdit: boolean - whether score buttons should be enabled
    //   onScoreChange: function(playerName, flight, playerIdx, delta) - callback when + or - clicked
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
                <div class="player-card" data-player-idx="${i}" data-player-flight="${player.flight}" data-player-name="${escapeHtml(player.name)}">
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
                var playerIdx = parseInt(card.getAttribute('data-player-idx'));
                
                var decBtn = card.querySelector('.dec-btn');
                var incBtn = card.querySelector('.inc-btn');
                
                if (decBtn) {
                    decBtn.addEventListener('click', (function(pName, pFlight, pIdx) {
                        return function() {
                            onScoreChange(pName, pFlight, pIdx, -1);
                        };
                    })(playerName, playerFlight, playerIdx));
                }
                
                if (incBtn) {
                    incBtn.addEventListener('click', (function(pName, pFlight, pIdx) {
                        return function() {
                            onScoreChange(pName, pFlight, pIdx, 1);
                        };
                    })(playerName, playerFlight, playerIdx));
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
        var teamAColorClass = teamAGreen ? 'team-score-green' : 'team-score-red';
        var teamBColorClass = teamBGreen ? 'team-score-green' : 'team-score-red';
        
        var html = '<span class="' + teamAColorClass + '">Team A ' + teamADisplay + '</span> - <span class="' + teamBColorClass + '">' + teamBDisplay + ' Team B</span>';
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
        renderScorecard: renderScorecard,
        renderPlayerCards: renderPlayerCards,
        updateTR: updateTR,
        updateHoleHeader: updateHoleHeader,
        updateFlightTab: updateFlightTab
    };
    
})();

/*
FILE: js/game-ui.js
VERSION: 1.00
PURPOSE: Shared UI rendering module for all game modes (REAL, PREVIEW, VIEW)
          - Scorecard rendering
          - Player cards with bubbles
          - TR display
          - Hole header
          - Flight tab
          - No Firebase, no data fetching, only rendering
STATUS: Ready for testing
*/