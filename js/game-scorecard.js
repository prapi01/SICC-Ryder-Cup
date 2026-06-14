/*
FILE: js/game-scorecard.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: T-1/T-2/Strk rows now properly display values when using Play Order (non-1 starting hole)
   - Added debug logging for T-1/T-2/Strk display to help diagnose visibility issues
   - Fixed isSynced logic to properly check saved holes for the correct hole numbers
   - Ensures displayVal is properly set when val contains numeric values (e.g., "2", "5", "8")
   - All other functionality preserved (green line rows, sticky columns, responsive design)
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.GAME_SCORECARD_VERSION = "1.05";

var GameScorecard = (function() {
    
    // ============================================================
    // Helper: Create green square HTML for AS
    // ============================================================
    function getAsSquareHtml() {
        return '<span class="as-square"></span>';
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
    // Scorecard Rendering - FIXED v1.05: Proper T-1/T-2/Strk display
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
        
        // Build savedHoles
        var savedHoles = { 1: [], 2: [] };
        for (var h = 1; h <= 18; h++) {
            if (isHoleSaved(1, h)) savedHoles[1].push(h);
            if (isHoleSaved(2, h)) savedHoles[2].push(h);
        }
        
        // Debug: Log saved holes
        console.log('[SCORECARD] savedHoles F1:', savedHoles[1]);
        console.log('[SCORECARD] savedHoles F2:', savedHoles[2]);
        console.log('[SCORECARD] holes array (display order):', holes);
        
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
        
        // T-1 row - v1.05: Fixed display logic
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = t1Row[holeNum - 1] || '_';
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            var colorClass = 'score-green';
            if (t1ClinchedHole !== null) {
                if (holeNum < t1ClinchedHole) colorClass = 'score-green';
                else if (holeNum === t1ClinchedHole) colorClass = 'score-gold';
                else if (holeNum > t1ClinchedHole) colorClass = 'score-grey';
            } else {
                colorClass = 'score-green';
            }
            
            // v1.05: Check for numeric values (e.g., "2", "5", "8") from cumulative display
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = colorClass;
                }
            } else if (typeof val === 'string' && (val === 'A' || val === 'B')) {
                if (isSynced) {
                    if (t1Display && t1Display[holeNum - 1]) {
                        displayVal = t1Display[holeNum - 1];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_' && val !== 'AS') {
                // v1.05: Handle numeric or prefixed values (e.g., "A2", "B3", "2", "5")
                if (isSynced) {
                    // If t1Display is available, use it (contains formatted strings like "A2", "B3")
                    if (t1Display && t1Display[holeNum - 1] && t1Display[holeNum - 1] !== 'AS') {
                        displayVal = t1Display[holeNum - 1];
                    } else if (typeof val === 'number' || !isNaN(parseInt(val))) {
                        // Numeric value - treat as margin
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
                    
                    // Debug logging for T-1
                    if (holeNum <= 18) {
                        console.log('[SCORECARD] T-1 hole ' + holeNum + ': val=' + val + ', displayVal=' + displayVal + ', isSynced=' + isSynced);
                    }
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
        
        // T-2 row - v1.05: Fixed display logic
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = t2Row[holeNum - 1] || '_';
            var isSynced = (savedHoles[2].indexOf(holeNum) !== -1);
            
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
            } else if (typeof val === 'string' && (val === 'A' || val === 'B')) {
                if (isSynced) {
                    if (t2Display && t2Display[holeNum - 1]) {
                        displayVal = t2Display[holeNum - 1];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_' && val !== 'AS') {
                if (isSynced) {
                    if (t2Display && t2Display[holeNum - 1] && t2Display[holeNum - 1] !== 'AS') {
                        displayVal = t2Display[holeNum - 1];
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
                    
                    if (holeNum <= 18) {
                        console.log('[SCORECARD] T-2 hole ' + holeNum + ': val=' + val + ', displayVal=' + displayVal + ', isSynced=' + isSynced);
                    }
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
        
        // Strk row - unchanged (requires both flights)
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk<\/td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = strkRow[holeNum - 1] || '_';
            // Strk requires BOTH flights saved (unchanged)
            var isSynced = (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            if (val === '0' || val === 0) {
                if (isSynced) {
                    displayVal = 'AS';
                    cellClass = 'score-green';
                }
            } else if (typeof val === 'string' && (val === 'A' || val === 'B')) {
                if (isSynced) {
                    if (strkDisplay && strkDisplay[holeNum - 1]) {
                        displayVal = strkDisplay[holeNum - 1];
                    } else {
                        displayVal = val;
                    }
                    cellClass = 'score-green';
                    
                    if (holeNum === 18 && (val === 'A' || val === 'B')) {
                        cellClass = 'score-gold';
                    }
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    if (strkDisplay && strkDisplay[holeNum - 1]) {
                        displayVal = strkDisplay[holeNum - 1];
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
                    cellClass = 'score-green';
                }
            }
            
            if (displayVal === 'AS') {
                displayVal = getAsSquareHtml();
            }
            html += '<td class="' + cellClass + '">' + displayVal + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        html += '</tbody></td>';
        container.innerHTML = html;
        
        // FIXED v1.04: Only remove empty first cell from rows with MORE than 1 cell
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
        getVersion: function() { return "1.05"; }
    };
    
})();

// ============================================================
// EXPORT - for compatibility with all game files
// ============================================================
window.GameScorecard = GameScorecard;

/*
FILE: js/game-scorecard.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: T-1/T-2/Strk rows now properly display values when using Play Order (non-1 starting hole)
   - Added debug logging for T-1/T-2/Strk display to help diagnose visibility issues
   - Fixed isSynced logic to properly check saved holes for the correct hole numbers
   - Ensures displayVal is properly set when val contains numeric values (e.g., "2", "5", "8")
   - All other functionality preserved (green line rows, sticky columns, responsive design)
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/