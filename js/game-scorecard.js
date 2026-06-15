/*
FILE: js/game-scorecard.js
VERSION: 1.12
KEY CHANGES from v1.11:
   - REFACTORED: Now uses GameOrder as the single source of truth for play order conversions
   - FIXED: T-1 and T-2 color logic now uses PLAY POSITIONS for comparison, not natural hole numbers
   - Previously, holes played BEFORE clinch were incorrectly showing grey
   - Now correctly: currentPlayPosition < clinchPlayPosition → GREEN
   -            currentPlayPosition === clinchPlayPosition → GOLD
   -            currentPlayPosition > clinchPlayPosition → GREY
   - Removed local getPlayOrderPosition(), getHoleAtPosition(), getLastHole()
   - Now delegates to GameOrder for all order-related calculations
   - All existing functionality preserved
DEPENDS ON: GameOrder
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.GAME_SCORECARD_VERSION = "1.12";

var GameScorecard = (function() {
    
    // ============================================================
    // Helper: Create green square HTML for AS
    // ============================================================
    function getAsSquareHtml() {
        return '<span class="as-square"></span>';
    }
    
    // ============================================================
    // v1.12: Delegate to GameOrder for order conversions
    // ============================================================
    
    function getPlayOrderPosition(holeNumber, startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayPosition) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getPlayPosition(holeNumber);
        }
        // Fallback
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
    
    function getNaturalHoleAtPosition(position, startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getNaturalHole) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getNaturalHole(position);
        }
        // Fallback
        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);
        return playOrder[position] || 0;
    }
    
    function getLastHoleNumber(startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getLastHole) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getLastHole();
        }
        // Fallback
        return (startingHole === 1) ? 18 : startingHole - 1;
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
    // Scorecard Rendering - v1.12: Uses play positions for color logic
    // ============================================================
    
    function renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1ClinchedHole, t2ClinchedHole, t1Display, t2Display, strkDisplay) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        // Backward compatibility
        t1Display = (t1Display !== undefined) ? t1Display : null;
        t2Display = (t2Display !== undefined) ? t2Display : null;
        strkDisplay = (strkDisplay !== undefined) ? strkDisplay : null;
        
        t1ClinchedHole = (t1ClinchedHole !== undefined) ? t1ClinchedHole : null;
        t2ClinchedHole = (t2ClinchedHole !== undefined) ? t2ClinchedHole : null;
        
        // Get startingHole from the first hole in the display order
        var startingHole = holes[0];
        if (startingHole > 1) {
            var isPlayOrder = (holes[1] === startingHole + 1);
            if (!isPlayOrder && holes[1] === 1) {
                startingHole = 1;
            }
        } else {
            startingHole = 1;
        }
        
        // Update GameOrder with the correct starting hole
        if (typeof GameOrder !== 'undefined' && GameOrder.setStartingHole) {
            GameOrder.setStartingHole(startingHole);
        }
        
        // v1.12: Get clinch play positions (t1ClinchedHole and t2ClinchedHole are already play order sequences 1-18)
        // Convert to 0-based play position indices for comparison
        var t1ClinchPlayPosition = (t1ClinchedHole !== null && t1ClinchedHole >= 1 && t1ClinchedHole <= 18) ? t1ClinchedHole - 1 : null;
        var t2ClinchPlayPosition = (t2ClinchedHole !== null && t2ClinchedHole >= 1 && t2ClinchedHole <= 18) ? t2ClinchedHole - 1 : null;
        
        // Get last hole for Strk gold condition (as natural hole number)
        var lastHoleNumber = getLastHoleNumber(startingHole);
        
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
        
        // T-1 row - v1.12: Use PLAY POSITIONS for color decision
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var arrayIndex = getPlayOrderPosition(holeNum, startingHole);
            var val = t1Row[arrayIndex] || '_';
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // v1.12: Determine color using PLAY POSITIONS
            var colorClass = 'score-green';
            if (t1ClinchPlayPosition !== null) {
                if (arrayIndex < t1ClinchPlayPosition) {
                    colorClass = 'score-green';
                } else if (arrayIndex === t1ClinchPlayPosition) {
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
        
        // T-2 row - v1.12: Use PLAY POSITIONS for color decision
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var arrayIndex = getPlayOrderPosition(holeNum, startingHole);
            var val = t2Row[arrayIndex] || '_';
            var isSynced = (savedHoles[2].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // v1.12: Determine color using PLAY POSITIONS
            var colorClass = 'score-green';
            if (t2ClinchPlayPosition !== null) {
                if (arrayIndex < t2ClinchPlayPosition) {
                    colorClass = 'score-green';
                } else if (arrayIndex === t2ClinchPlayPosition) {
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
        
        // Strk row - v1.12: Uses natural hole comparison (last hole is display-based)
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
                
                if (val === 'AS' || val === 0 || val === '0') {
                    displayVal = getAsSquareHtml();
                } else if (typeof val === 'string' && (val === 'A' || val === 'B')) {
                    if (strkDisplay && strkDisplay[arrayIndex]) {
                        displayVal = strkDisplay[arrayIndex];
                    } else {
                        displayVal = val;
                    }
                } else if (val && val !== '_') {
                    if (strkDisplay && strkDisplay[arrayIndex]) {
                        displayVal = strkDisplay[arrayIndex];
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
        getVersion: function() { return "1.12"; }
    };
    
})();

// ============================================================
// EXPORT - for compatibility with all game files
// ============================================================
window.GameScorecard = GameScorecard;

/*
FILE: js/game-scorecard.js
VERSION: 1.12
KEY CHANGES from v1.11:
   - REFACTORED: Now uses GameOrder as the single source of truth for play order conversions
   - FIXED: T-1 and T-2 color logic now uses PLAY POSITIONS for comparison, not natural hole numbers
   - Previously, holes played BEFORE clinch were incorrectly showing grey
   - Now correctly: currentPlayPosition < clinchPlayPosition → GREEN
   -            currentPlayPosition === clinchPlayPosition → GOLD
   -            currentPlayPosition > clinchPlayPosition → GREY
   - Removed local getPlayOrderPosition(), getHoleAtPosition(), getLastHole()
   - Now delegates to GameOrder for all order-related calculations
   - All existing functionality preserved
DEPENDS ON: GameOrder
STATUS: Ready for integration
*/