/*
FILE: js/game-scorecard.js
VERSION: 1.15
KEY CHANGES from v1.14:
   - FIXED: T-1 and T-2 clinch detection now converts clinchedHole from play order sequence to natural hole number
   - Previously, clinchedHole=15 (15th hole played) was compared directly with natural hole numbers
   - This caused gold to appear at natural Hole 15 instead of natural Hole 6
   - Now correctly maps play order sequence to natural hole number using getHoleAtPosition()
   - All other functionality preserved from v1.14
DEPENDS ON: GameData (for getLastHole), GameOrder (optional)
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.GAME_SCORECARD_VERSION = "1.15";

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
    // Scorecard Rendering - v1.15: Fixed clinch detection for shotgun starts
    // ============================================================
    
    function renderScorecard(containerId, param2, param3, param4, param5, param6, param7, param8, param9, param10, param11, param12, param13, param14, param15) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1ClinchedHole, t2ClinchedHole, t1Display, t2Display, strkDisplay;
        var startingHole;
        
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
        
        // v1.15: Convert clinchedHole from play order sequence (1-18) to natural hole number
        var t1ClinchedNaturalHole = null;
        var t2ClinchedNaturalHole = null;
        
        if (t1ClinchedHole !== null && t1ClinchedHole >= 1 && t1ClinchedHole <= 18) {
            t1ClinchedNaturalHole = getHoleAtPosition(t1ClinchedHole - 1, startingHole);
        }
        if (t2ClinchedHole !== null && t2ClinchedHole >= 1 && t2ClinchedHole <= 18) {
            t2ClinchedNaturalHole = getHoleAtPosition(t2ClinchedHole - 1, startingHole);
        }
        
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
        
        // Flight 1 players
        for (var p = 0; p < flight1Players.length; p++) {
            var player = flight1Players[p];
            html += '</tr>';
            html += '<td style="font-weight:600;">' + escapeHtml(player.label) + '<\/td>';
            
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
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-1 row - v1.15: Use converted natural hole number for color decision
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var arrayIndex = getPlayOrderPosition(holeNum, startingHole);
            var val = t1Row[arrayIndex] || '_';
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // v1.15: Use converted natural hole number for color decision
            var colorClass = 'score-green';
            if (t1ClinchedNaturalHole !== null) {
                if (holeNum < t1ClinchedNaturalHole) colorClass = 'score-green';
                else if (holeNum === t1ClinchedNaturalHole) colorClass = 'score-gold';
                else if (holeNum > t1ClinchedNaturalHole) colorClass = 'score-grey';
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
                    if (t1Display && t1Display[arrayIndex]) {
                        displayVal = t1Display[arrayIndex];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    if (t1Display && t1Display[arrayIndex] && t1Display[arrayIndex] !== 'AS') {
                        displayVal = t1Display[arrayIndex];
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
        
        // Flight 2 players
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
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '<\/td>';
            }
            html += '<td class="score-green">' + playerTotal + '<\/td><\/tr>';
        }
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-2 row - v1.15: Use converted natural hole number for color decision
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var arrayIndex = getPlayOrderPosition(holeNum, startingHole);
            var val = t2Row[arrayIndex] || '_';
            var isSynced = (savedHoles[2].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // v1.15: Use converted natural hole number for color decision
            var colorClass = 'score-green';
            if (t2ClinchedNaturalHole !== null) {
                if (holeNum < t2ClinchedNaturalHole) colorClass = 'score-green';
                else if (holeNum === t2ClinchedNaturalHole) colorClass = 'score-gold';
                else if (holeNum > t2ClinchedNaturalHole) colorClass = 'score-grey';
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
                    if (t2Display && t2Display[arrayIndex]) {
                        displayVal = t2Display[arrayIndex];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    if (t2Display && t2Display[arrayIndex] && t2Display[arrayIndex] !== 'AS') {
                        displayVal = t2Display[arrayIndex];
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
        
        // Strk row - v1.15: Uses strkRow parameter directly
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var arrayIndex = getPlayOrderPosition(holeNum, startingHole);
            var val = strkRow[arrayIndex] || '_';
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
        getVersion: function() { return "1.15"; }
    };
    
})();

// ============================================================
// EXPORT - for compatibility with all game files
// ============================================================
window.GameScorecard = GameScorecard;

/*
FILE: js/game-scorecard.js
VERSION: 1.15
KEY CHANGES from v1.14:
   - FIXED: T-1 and T-2 clinch detection now converts clinchedHole from play order sequence to natural hole number
   - Previously, clinchedHole=15 (15th hole played) was compared directly with natural hole numbers
   - This caused gold to appear at natural Hole 15 instead of natural Hole 6
   - Now correctly maps play order sequence to natural hole number using getHoleAtPosition()
   - All other functionality preserved from v1.14
DEPENDS ON: GameData (for getLastHole), GameOrder (optional)
STATUS: Ready for integration
*/