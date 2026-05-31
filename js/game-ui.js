/*
FILE: js/game-ui.js
VERSION: 4.04
KEY CHANGES:
   - MODIFIED: renderScorecard() now accepts t1Display, t2Display, strkDisplay arrays
   - Displays formatted margins (e.g., "A8" instead of "A")
   - Added Strk gold at hole 18 when winner is determined
   - Maintains backward compatibility (falls back to old display if new params missing)
   - ALL other functions identical to v4.03
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/

// ============================================================
// GameUI - Shared UI rendering functions
// ============================================================

var GameUI = (function() {
    
    // ============================================================
    // Helper: Escape HTML
    // ============================================================
    function escapeHtml(str) {
        if (!str) return "";
        return str.replace(/[&<>]/g, function(m) {
            if (m === "&") return "&amp;";
            if (m === "<") return "&lt;";
            if (m === ">") return "&gt;";
            return m;
        });
    }
    
    // ============================================================
    // Helper: Tighten scorecard rows (remove empty cells at end)
    // ============================================================
    function tightenScorecardRows() {
        var tables = document.querySelectorAll('.scorecard-table');
        tables.forEach(function(table) {
            var rows = table.querySelectorAll('tr');
            rows.forEach(function(row) {
                var cells = row.querySelectorAll('td');
                var lastNonEmpty = -1;
                for (var i = cells.length - 1; i >= 0; i--) {
                    var cell = cells[i];
                    var hasContent = cell.innerText.trim() !== '';
                    if (hasContent) {
                        lastNonEmpty = i;
                        break;
                    }
                }
                if (lastNonEmpty >= 0 && lastNonEmpty < cells.length - 1) {
                    for (var j = lastNonEmpty + 1; j < cells.length; j++) {
                        if (cells[j]) cells[j].style.display = 'none';
                    }
                }
            });
        });
    }
    
    // ============================================================
    // Render TR (Team Result) Billboard
    // ============================================================
    function updateTR(containerId, teamA, teamB, teamAGreen, teamBGreen) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var aClass = teamAGreen ? 'tr-green' : '';
        var bClass = teamBGreen ? 'tr-green' : '';
        
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                <div style="flex: 1; text-align: center; padding: 12px; background: ${teamAGreen ? '#1a3a1a' : '#2a2a2a'}; border-radius: 16px; border: 1px solid ${teamAGreen ? '#4caf50' : '#444'};">
                    <div style="font-size: 0.8rem; color: #aaa;">TEAM A</div>
                    <div style="font-size: 2rem; font-weight: 800; color: ${teamAGreen ? '#4caf50' : '#888'};">${teamA}</div>
                </div>
                <div style="flex: 1; text-align: center; padding: 12px; background: ${teamBGreen ? '#1a3a1a' : '#2a2a2a'}; border-radius: 16px; border: 1px solid ${teamBGreen ? '#4caf50' : '#444'};">
                    <div style="font-size: 0.8rem; color: #aaa;">TEAM B</div>
                    <div style="font-size: 2rem; font-weight: 800; color: ${teamBGreen ? '#4caf50' : '#888'};">${teamB}</div>
                </div>
            </div>
        `;
    }
    
    // ============================================================
    // Render Player Cards with match bubbles
    // ============================================================
    function renderPlayerCards(containerId, players, getAllOpponentsFn, getBubbleClassFn, getBubbleValueFn, getCurrentScoreFn, canEdit, onScoreChange) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!players || players.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px;">No players found</div>';
            return;
        }
        
        var html = '';
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var opponents = getAllOpponentsFn(player);
            var currentScore = getCurrentScoreFn ? getCurrentScoreFn(player) : '-';
            
            html += '<div class="player-card" data-player-name="' + escapeHtml(player.label) + '" data-player-flight="' + player.flight + '" style="position: relative;">';
            html += '<div class="player-header">';
            html += '<div><span class="player-name">' + escapeHtml(player.label) + '</span><span class="player-handicap">' + escapeHtml(player.handicap + '') + '</span></div>';
            
            if (canEdit && onScoreChange) {
                html += '<div class="score-control"><button class="score-btn dec-btn" data-delta="-1" data-player="' + escapeHtml(player.label) + '">-</button>';
                html += '<span class="score-value" id="score-' + escapeHtml(player.label) + '">' + currentScore + '</span>';
                html += '<button class="score-btn inc-btn" data-delta="+1" data-player="' + escapeHtml(player.label) + '">+</button></div>';
            } else {
                html += '<div class="score-value">' + currentScore + '</div>';
            }
            html += '</div>';
            
            html += '<div class="bubbles">';
            for (var j = 0; j < opponents.length; j++) {
                var opponent = opponents[j];
                var bubbleClass = getBubbleClassFn(player, opponent);
                var bubbleValue = getBubbleValueFn(player, opponent);
                var displayText = (bubbleValue !== undefined && bubbleValue !== null) ? bubbleValue : '';
                html += '<div class="' + bubbleClass + '">' + escapeHtml(opponent.label) + ' ' + displayText + '</div>';
            }
            html += '</div></div>';
        }
        
        container.innerHTML = html;
        
        if (canEdit && onScoreChange) {
            container.querySelectorAll('.score-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var delta = parseInt(btn.getAttribute('data-delta'));
                    var playerLabel = btn.getAttribute('data-player');
                    var player = players.find(function(p) { return p.label === playerLabel; });
                    if (player && onScoreChange) {
                        onScoreChange(player, delta);
                    }
                });
            });
        }
    }
    
    // ============================================================
    // Render Scorecard (UPDATED v4.04: supports margin display)
    // ============================================================
    function renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, 
                             t1Row, t2Row, strkRow, coursePar, courseSi, 
                             t1ClinchedHole, t2ClinchedHole, 
                             t1Display, t2Display, strkDisplay) {
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
        
        // Sort players by flight and team
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
        html += '<th>Tot</th> </tr></thead><tbody>';
        
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
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // T-1 row - Flight 1 cumulative (with margin display)
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1</td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = t1Row[holeNum - 1] || '_';
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1);
            
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
                    // NEW v4.04: Use formatted display if available
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
            
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
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
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // T-2 row - Flight 2 cumulative (with margin display)
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2</td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = t2Row[holeNum - 1] || '_';
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1);
            
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
                    // NEW v4.04: Use formatted display if available
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
            
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        // Strk row - Stroke game (with margin display and gold at hole 18)
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk</td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = strkRow[holeNum - 1] || '_';
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
                    // NEW v4.04: Use formatted display if available
                    if (strkDisplay && strkDisplay[holeNum - 1]) {
                        displayVal = strkDisplay[holeNum - 1];
                    } else {
                        displayVal = val;
                    }
                    cellClass = 'score-green';
                    
                    // NEW v4.04: Gold at hole 18 when winner is determined
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
            
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
        tightenScorecardRows();
    }
    
    // ============================================================
    // Shared bubble functions (used by both real-game and view-game)
    // ============================================================
    
    function getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn) {
        if (!resultsCache || !resultsCache.matchResults) return 0;
        var position = getHolePositionFn(currentHole);
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
    
    function getBubbleValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn) {
        var matchValue = getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn);
        if (matchValue === 0) return '';
        if (matchValue > 0) return '+' + matchValue;
        return '' + matchValue;
    }
    
    function getBubbleClassShared(player, opponent, currentHole, resultsCache, allPlayers, isHoleSavedFn, getHolePositionFn, clinchedAtMap) {
        var matchValue = getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn);
        var isHoleSavedForFlight = isHoleSavedFn(player.flight, currentHole);
        
        if (!isHoleSavedForFlight) return 'bubble-grey';
        
        var clinchHole = null;
        if (clinchedAtMap) {
            var matchKey = player.name + "_vs_" + opponent.name;
            clinchHole = clinchedAtMap[matchKey];
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
    
    // ============================================================
    // Public API
    // ============================================================
    return {
        updateTR: updateTR,
        renderPlayerCards: renderPlayerCards,
        renderScorecard: renderScorecard,
        getMatchValueShared: getMatchValueShared,
        getBubbleValueShared: getBubbleValueShared,
        getBubbleClassShared: getBubbleClassShared
    };
    
})();

// Make available globally
window.GameUI = GameUI;

/*
FILE: js/game-ui.js
VERSION: 4.04
KEY CHANGES:
   - MODIFIED: renderScorecard() now accepts t1Display, t2Display, strkDisplay arrays
   - Displays formatted margins (e.g., "A8" instead of "A")
   - Added Strk gold at hole 18 when winner is determined
   - Maintains backward compatibility (falls back to old display if new params missing)
   - ALL other functions identical to v4.03
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/