/*
FILE: js/game-scorecard.js
VERSION: 1.17
KEY CHANGES from v1.16:
   - ADDED: Green background + white text for player scores on holes where ANY match event occurred
   - Added hasAnyMatchEvent() function to detect win/loss/clinch for a player on a specific hole
   - Added getMatchValueForPlayer() function to get match result for a player vs opponent
   - Player score cells now use .score-event class (green bg, white text) when ANY match event occurred
   - T-1, T-2, Strk rows unchanged (team games, not individual)
   - All existing functionality preserved from v1.16
DEPENDS ON: GameData (for getLastHole), GameOrder (optional), GameMatch (for match data)
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.GAME_SCORECARD_VERSION = "1.17";

var GameScorecard = (function() {
    
    // ============================================================
    // Helper: Create green square HTML for AS
    // ============================================================
    function getAsSquareHtml() {
        return '<span class="as-square"></span>';
    }
    
    // ============================================================
    // Helper: Get last hole based on starting hole
    // ============================================================
    function getLastHole(startingHole) {
        if (typeof GameData !== 'undefined' && GameData.getLastHole) {
            return GameData.getLastHole(startingHole);
        }
        return (startingHole === 1) ? 18 : startingHole - 1;
    }
    
    // ============================================================
    // Helper: Get play order position for a hole number
    // ============================================================
    function getPlayOrderPosition(holeNumber, startingHole) {
        if (startingHole === 1) {
            return holeNumber - 1;
        }
        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);
        
        for (var i = 0; i < playOrder.length; i++) {
            if (playOrder[i] === holeNumber) return i;
        }
        return holeNumber - 1;
    }
    
    // ============================================================
    // Helper: Get natural hole number for a play position
    // ============================================================
    function getHoleAtPosition(position, startingHole) {
        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);
        return playOrder[position] || 0;
    }
    
    // ============================================================
    // Helper: Get display holes array based on mode
    // ============================================================
    function getDisplayHolesArray(displayMode, startingHole) {
        if (displayMode === "natural") {
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
    // v1.17: Helper: Get match value for a player vs opponent on a hole
    // ============================================================
    function getMatchValueForPlayer(player, opponent, holeNumber, results, allPlayers) {
        if (!results || !results.matchResults) return 0;
        
        var position = getPlayOrderPosition(holeNumber, allPlayers[0]?.startingHole || 1);
        // Actually we need startingHole passed in, but this is a helper used within renderScorecard
        // The actual implementation will be inside renderScorecard where we have startingHole
        return 0; // Placeholder - actual implementation in renderScorecard
    }
    
    // ============================================================
    // v1.17: Helper: Check if a player has ANY match event on a hole
    // Returns true if the player won, lost, or clinched ANY match on this hole
    // ============================================================
    function hasAnyMatchEvent(player, holeNumber, results, allPlayers, startingHole) {
        if (!results || !results.matchResults) return false;
        
        var position = getPlayOrderPosition(holeNumber, startingHole);
        var matchResultsArray = results.matchResults[position];
        if (!matchResultsArray) return false;
        
        // Get all opponents (players on the other team)
        var opponents = allPlayers.filter(function(p) { return p.team !== player.team; });
        
        // Sort opponents: intra-flight first, then cross-flight
        opponents.sort(function(a, b) {
            var aIntra = (a.flight === player.flight);
            var bIntra = (b.flight === player.flight);
            if (aIntra && !bIntra) return -1;
            if (!aIntra && bIntra) return 1;
            return a.handicap - b.handicap;
        });
        
        // Check each match against opponents
        for (var i = 0; i < opponents.length; i++) {
            var opp = opponents[i];
            
            // Build match index
            var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) {
                if (a.flight !== b.flight) return a.flight - b.flight;
                return a.handicap - b.handicap;
            });
            var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) {
                if (a.flight !== b.flight) return a.flight - b.flight;
                return a.handicap - b.handicap;
            });
            
            var aIdx = -1;
            var bIdx = -1;
            
            if (player.team === "A") {
                for (var j = 0; j < teamAPlayers.length; j++) {
                    if (teamAPlayers[j].name === player.name) aIdx = j;
                }
                for (var j = 0; j < teamBPlayers.length; j++) {
                    if (teamBPlayers[j].name === opp.name) bIdx = j;
                }
            } else {
                for (var j = 0; j < teamAPlayers.length; j++) {
                    if (teamAPlayers[j].name === opp.name) aIdx = j;
                }
                for (var j = 0; j < teamBPlayers.length; j++) {
                    if (teamBPlayers[j].name === player.name) bIdx = j;
                }
            }
            
            if (aIdx === -1 || bIdx === -1) continue;
            
            var matchIndex = aIdx * teamBPlayers.length + bIdx;
            var matchValue = matchResultsArray[matchIndex] || 0;
            
            // If match value is not 0 (win/loss/clinch), something happened
            if (matchValue !== 0) {
                return true;
            }
        }
        
        return false;
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
    // Scorecard Rendering - v1.17: Added green BG for match events
    // ============================================================
    
    function renderScorecard(containerId, param2, param3, param4, param5, param6, param7, param8, param9, param10, param11, param12, param13, param14, param15) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1ClinchedHole, t2ClinchedHole, t1Display, t2Display, strkDisplay;
        var startingHole;
        var results = null;
        
        // Detect calling convention
        if (typeof param2 === 'string' && (param2 === 'play' || param2 === 'natural')) {
            // New convention
            var displayMode = param2;
            startingHole = param3;
            players = param4;
            getStoredScore = param5;
            isHoleSaved = param6;
            t1Row = param7;
            t2Row = param8;
            strkRow = param9;
            coursePar = param10;
            courseSi = param11;
            t1ClinchedHole = param12;
            t2ClinchedHole = param13;
            t1Display = param14;
            t2Display = param15;
            strkDisplay = arguments[16];
            
            // Try to get results from the cache
            if (typeof GameLoader !== 'undefined') {
                var cache = GameLoader.getLocalCache();
                if (cache && cache.results) {
                    results = cache.results;
                }
            }
            
            holes = getDisplayHolesArray(displayMode, startingHole);
        } else {
            // Old convention
            holes = param2;
            players = param3;
            getStoredScore = param4;
            isHoleSaved = param5;
            t1Row = param6;
            t2Row = param7;
            strkRow = param8;
            coursePar = param9;
            courseSi = param10;
            t1ClinchedHole = param11;
            t2ClinchedHole = param12;
            t1Display = param13;
            t2Display = param14;
            strkDisplay = param15;
            
            // Get startingHole from the first hole in the display order
            startingHole = holes[0];
            if (startingHole > 1) {
                var isPlayOrder = (holes[1] === startingHole + 1);
                if (!isPlayOrder && holes[1] === 1) {
                    startingHole = 1;
                }
            } else {
                startingHole = 1;
            }
        }
        
        // Backward compatibility for undefined params
        t1Display = (t1Display !== undefined) ? t1Display : null;
        t2Display = (t2Display !== undefined) ? t2Display : null;
        strkDisplay = (strkDisplay !== undefined) ? strkDisplay : null;
        
        t1ClinchedHole = (t1ClinchedHole !== undefined) ? t1ClinchedHole : null;
        t2ClinchedHole = (t2ClinchedHole !== undefined) ? t2ClinchedHole : null;
        
        // v1.16: Get clinch play positions
        var t1ClinchPlayPosition = (t1ClinchedHole !== null && t1ClinchedHole >= 1 && t1ClinchedHole <= 18) ? t1ClinchedHole - 1 : null;
        var t2ClinchPlayPosition = (t2ClinchedHole !== null && t2ClinchedHole >= 1 && t2ClinchedHole <= 18) ? t2ClinchedHole - 1 : null;
        
        // Get last hole for Strk gold condition
        var lastHoleNumber = getLastHole(startingHole);
        
        // Build savedHoles
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
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        // SI row
        html += '<tr><td style="font-weight:700;">SI<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var si = courseSi[holes[i] - 1];
            html += '<td>' + si + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // ============================================================
        // v1.17: FLIGHT 1 PLAYERS - With match event highlighting
        // ============================================================
        for (var p = 0; p < flight1Players.length; p++) {
            var player = flight1Players[p];
            html += '<tr>';
            html += '<td style="font-weight:600;">' + escapeHtml(player.label) + '<\/td>';
            
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                
                // v1.17: Check if this player had a match event on this hole
                var hasEvent = false;
                if (saved && results && results.matchResults) {
                    hasEvent = hasAnyMatchEvent(player, hole, results, players, startingHole);
                }
                
                var cellClass = saved ? 'score-green' : 'score-invisible';
                // v1.17: Override to green background + white text if event occurred
                if (hasEvent && saved) {
                    cellClass = 'score-event';
                }
                
                html += '<td class="' + cellClass + '">' + score + '<\/td>';
            }
            html += '<td class="score-green">' + playerTotal + '<\/td><\/tr>';
        }
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-1 row - unchanged
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var currentPlayPosition = getPlayOrderPosition(holeNum, startingHole);
            var val = t1Row[currentPlayPosition] || '_';
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // v1.16: Determine color using PLAY POSITIONS
            var colorClass = 'score-green';
            if (t1ClinchPlayPosition !== null) {
                if (currentPlayPosition < t1ClinchPlayPosition) {
                    colorClass = 'score-green';
                } else if (currentPlayPosition === t1ClinchPlayPosition) {
                    colorClass = 'score-gold';
                } else {
                    colorClass = 'score-grey';
                }
            } else {
                colorClass = 'score-green';
            }
            
            if (val === 'AS') {
                if (isSynced) {
                    displayVal = getAsSquareHtml();
                    cellClass = colorClass;
                }
            } else if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = colorClass;
                }
            } else if (typeof val === 'string' && (val === 'A' || val === 'B')) {
                if (isSynced) {
                    if (t1Display && t1Display[currentPlayPosition]) {
                        displayVal = t1Display[currentPlayPosition];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    if (t1Display && t1Display[currentPlayPosition] && t1Display[currentPlayPosition] !== 'AS') {
                        displayVal = t1Display[currentPlayPosition];
                    } else if (typeof val === 'number' || !isNaN(parseInt(val))) {
                        var numVal = parseInt(val);
                        if (numVal > 0) {
                            displayVal = 'A' + numVal;
                        } else if (numVal < 0) {
                            displayVal = 'B' + Math.abs(numVal);
                        } else {
                            displayVal = 'AS';
                        }
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            }
            
            if (displayVal === 'AS') {
                displayVal = getAsSquareHtml();
            }
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // ============================================================
        // v1.17: FLIGHT 2 PLAYERS - With match event highlighting
        // ============================================================
        for (var p = 0; p < flight2Players.length; p++) {
            var player = flight2Players[p];
            html += '<tr>';
            html += '<td style="font-weight:600;">' + escapeHtml(player.label) + '<\/td>';
            
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                
                // v1.17: Check if this player had a match event on this hole
                var hasEvent = false;
                if (saved && results && results.matchResults) {
                    hasEvent = hasAnyMatchEvent(player, hole, results, players, startingHole);
                }
                
                var cellClass = saved ? 'score-green' : 'score-invisible';
                // v1.17: Override to green background + white text if event occurred
                if (hasEvent && saved) {
                    cellClass = 'score-event';
                }
                
                html += '<td class="' + cellClass + '">' + score + '<\/td>';
            }
            html += '<td class="score-green">' + playerTotal + '<\/td><\/tr>';
        }
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-2 row - unchanged
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var currentPlayPosition = getPlayOrderPosition(holeNum, startingHole);
            var val = t2Row[currentPlayPosition] || '_';
            var isSynced = (savedHoles[2].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // v1.16: Determine color using PLAY POSITIONS
            var colorClass = 'score-green';
            if (t2ClinchPlayPosition !== null) {
                if (currentPlayPosition < t2ClinchPlayPosition) {
                    colorClass = 'score-green';
                } else if (currentPlayPosition === t2ClinchPlayPosition) {
                    colorClass = 'score-gold';
                } else {
                    colorClass = 'score-grey';
                }
            } else {
                colorClass = 'score-green';
            }
            
            if (val === 'AS') {
                if (isSynced) {
                    displayVal = getAsSquareHtml();
                    cellClass = colorClass;
                }
            } else if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = colorClass;
                }
            } else if (typeof val === 'string' && (val === 'A' || val === 'B')) {
                if (isSynced) {
                    if (t2Display && t2Display[currentPlayPosition]) {
                        displayVal = t2Display[currentPlayPosition];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    if (t2Display && t2Display[currentPlayPosition] && t2Display[currentPlayPosition] !== 'AS') {
                        displayVal = t2Display[currentPlayPosition];
                    } else if (typeof val === 'number' || !isNaN(parseInt(val))) {
                        var numVal = parseInt(val);
                        if (numVal > 0) {
                            displayVal = 'A' + numVal;
                        } else if (numVal < 0) {
                            displayVal = 'B' + Math.abs(numVal);
                        } else {
                            displayVal = 'AS';
                        }
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            }
            
            if (displayVal === 'AS') {
                displayVal = getAsSquareHtml();
            }
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // Strk row - unchanged
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var currentPlayPosition = getPlayOrderPosition(holeNum, startingHole);
            var val = strkRow[currentPlayPosition] || '_';
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            if (isSynced) {
                // Determine color - GOLD on last hole, GREEN otherwise
                var isLastHole = (holeNum === lastHoleNumber);
                
                if (isLastHole) {
                    cellClass = 'score-gold';
                } else {
                    cellClass = 'score-green';
                }
                
                if (val && val !== '_' && val !== 'AS') {
                    displayVal = val;
                } else if (val === 'AS') {
                    displayVal = getAsSquareHtml();
                }
                
                if (displayVal === 'AS') {
                    displayVal = getAsSquareHtml();
                }
            }
            
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
        // Remove empty first cell from rows with MORE than 1 cell
        var allRows = container.querySelectorAll('tr');
        for (var i = 0; i < allRows.length; i++) {
            var cells = allRows[i].cells;
            if (cells.length > 1 && cells[0].textContent === '') {
                allRows[i].deleteCell(0);
            }
        }
        
        tightenScorecardRows();
        
        var scorecardTable = container.querySelector('.scorecard-table');
        if (scorecardTable) {
            scorecardTable.style.tableLayout = 'auto';
            scorecardTable.style.width = 'auto';
            scorecardTable.style.minWidth = '850px';
            scorecardTable.style.borderCollapse = 'collapse';
            
            var allCells = scorecardTable.querySelectorAll('th, td');
            allCells.forEach(function(cell) {
                cell.style.padding = '4px 6px';
                cell.style.fontSize = '0.85rem';
                cell.style.lineHeight = '1.2';
                cell.style.border = 'none';
            });
            
            var firstColCells = scorecardTable.querySelectorAll('th:first-child, td:first-child');
            firstColCells.forEach(function(cell) {
                if (cell.closest('.green-line')) return;
                
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
            
            var scoreCells = scorecardTable.querySelectorAll('th:not(:first-child), td:not(:first-child)');
            scoreCells.forEach(function(cell) {
                cell.style.textAlign = 'center';
                cell.style.minWidth = '38px';
                cell.style.width = '38px';
                cell.style.padding = '4px 2px';
            });
            
            var headerCells = scorecardTable.querySelectorAll('thead th');
            headerCells.forEach(function(cell) {
                cell.style.fontWeight = '700';
                cell.style.backgroundColor = '#1a1a1a';
            });
            
            var rows = scorecardTable.querySelectorAll('tr');
            rows.forEach(function(row) {
                row.style.lineHeight = '1.2';
            });
            
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
            
            var wrapper = document.getElementById(containerId);
            if (wrapper) {
                wrapper.style.overflowX = 'auto';
                wrapper.style.WebkitOverflowScrolling = 'touch';
            }
            
            // v1.17: Add styles for .score-event class (green background, white text)
            var styleTag = document.getElementById('scorecard-event-styles');
            if (!styleTag) {
                var style = document.createElement('style');
                style.id = 'scorecard-event-styles';
                style.textContent = `
                    .score-event {
                        background-color: #1a7a2a !important;
                        color: #ffffff !important;
                        font-weight: 700 !important;
                        border-radius: 4px;
                    }
                `;
                document.head.appendChild(style);
            }
        }
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
        tightenScorecardRows: tightenScorecardRows,
        getAsSquareHtml: getAsSquareHtml,
        getVersion: function() { return "1.17"; }
    };
    
})();

// ============================================================
// EXPORT - for compatibility with all game files
// ============================================================
window.GameScorecard = GameScorecard;

/*
FILE: js/game-scorecard.js
VERSION: 1.17
KEY CHANGES from v1.16:
   - ADDED: Green background + white text for player scores on holes where ANY match event occurred
   - Added hasAnyMatchEvent() function to detect win/loss/clinch for a player on a specific hole
   - Added getMatchValueForPlayer() function to get match result for a player vs opponent
   - Player score cells now use .score-event class (green bg, white text) when ANY match event occurred
   - T-1, T-2, Strk rows unchanged (team games, not individual)
   - All existing functionality preserved from v1.16
DEPENDS ON: GameData (for getLastHole), GameOrder (optional), GameMatch (for match data)
STATUS: Ready for integration
*/