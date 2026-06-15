/*
FILE: js/game-scorecard.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - REFACTORED: Removed holes array parameter - now builds display mapping internally
   - New signature: renderScorecard(containerId, displayMode, startingHole, players, ...)
   - No longer relies on external holes array - uses GameOrder to determine display order
   - Strk row gold logic now uses play position comparison (last hole is always position 17)
   - This eliminates the concept of "natural vs play mode" at the data level
   - All games are treated the same internally; display preference is purely visual
   - All existing functionality preserved
DEPENDS ON: GameOrder
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.GAME_SCORECARD_VERSION = "1.13";

var GameScorecard = (function() {
    
    // ============================================================
    // Helper: Create green square HTML for AS
    // ============================================================
    function getAsSquareHtml() {
        return '<span class="as-square"></span>';
    }
    
    // ============================================================
    // v1.13: Build display columns based on displayMode
    // Returns array of objects: { naturalHole: number, playPosition: number }
    // ============================================================
    function buildDisplayColumns(displayMode, startingHole) {
        var columns = [];
        
        if (displayMode === "natural") {
            // Natural order: columns 1-18, each maps to play position
            for (var naturalHole = 1; naturalHole <= 18; naturalHole++) {
                var playPosition = GameOrder.getPlayPosition(naturalHole);
                columns.push({
                    naturalHole: naturalHole,
                    playPosition: playPosition,
                    isLastHole: (naturalHole === GameOrder.getLastHole())
                });
            }
        } else {
            // Play order: columns in play sequence, each maps to its play position
            var playOrder = GameOrder.getPlayOrder();
            for (var pos = 0; pos < playOrder.length; pos++) {
                var naturalHole = playOrder[pos];
                columns.push({
                    naturalHole: naturalHole,
                    playPosition: pos,
                    isLastHole: (pos === 17)  // Last play position is always 17
                });
            }
        }
        
        return columns;
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
    // Scorecard Rendering - v1.13: Builds display mapping internally
    // ============================================================
    
    function renderScorecard(containerId, displayMode, startingHole, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1ClinchedHole, t2ClinchedHole, t1Display, t2Display, strkDisplay) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        // Backward compatibility for old calls (if holes array passed as second param)
        if (typeof displayMode !== 'string' || (displayMode !== "natural" && displayMode !== "play")) {
            // Old calling convention: holes array was passed as second param
            // Try to detect and convert
            if (Array.isArray(displayMode)) {
                console.warn("[GameScorecard] Using deprecated calling convention. Please pass displayMode and startingHole.");
                // Extract startingHole from the holes array
                var holesArray = displayMode;
                startingHole = holesArray[0] || 1;
                if (startingHole > 1) {
                    var isPlayOrder = (holesArray[1] === startingHole + 1);
                    if (!isPlayOrder && holesArray[1] === 1) {
                        startingHole = 1;
                    }
                } else {
                    startingHole = 1;
                }
                displayMode = "play";  // Assume play mode for backward compatibility
            }
        }
        
        // Ensure GameOrder has correct starting hole
        if (typeof GameOrder !== 'undefined' && GameOrder.setStartingHole) {
            GameOrder.setStartingHole(startingHole);
        }
        
        // Build display columns
        var columns = buildDisplayColumns(displayMode, startingHole);
        
        // Get clinch play positions (t1ClinchedHole and t2ClinchedHole are play order sequences 1-18)
        var t1ClinchPlayPosition = (t1ClinchedHole !== null && t1ClinchedHole >= 1 && t1ClinchedHole <= 18) ? t1ClinchedHole - 1 : null;
        var t2ClinchPlayPosition = (t2ClinchedHole !== null && t2ClinchedHole >= 1 && t2ClinchedHole <= 18) ? t2ClinchedHole - 1 : null;
        
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
        for (var i = 0; i < columns.length; i++) {
            html += '<th>' + columns[i].naturalHole + '</th>';
        }
        html += '<th>Tot</th> </thead><tbody>';
        
        // Par row
        html += '<tr><td style="font-weight:700;">Par<\/td>';
        var totalPar = 0;
        for (var i = 0; i < columns.length; i++) {
            var par = coursePar[columns[i].naturalHole - 1];
            totalPar += par;
            html += '<td>' + par + '<\/td>';
        }
        html += '<td style="color:#4caf50;">-<\/td><\/tr>';
        
        // SI row
        html += '<tr><td style="font-weight:700;">SI<\/td>';
        for (var i = 0; i < columns.length; i++) {
            var si = courseSi[columns[i].naturalHole - 1];
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
            for (var i = 0; i < columns.length; i++) {
                var naturalHole = columns[i].naturalHole;
                var score = getStoredScore(player, naturalHole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, naturalHole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '<\/td>';
            }
            html += '<td class="score-green">' + playerTotal + '<\/td><\/tr>';
        }
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-1 row - v1.13: Uses play positions for color decision
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1<\/td>';
        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            var playPos = col.playPosition;
            var naturalHole = col.naturalHole;
            var val = t1Row[playPos] || '_';
            var isSynced = (savedHoles[1].indexOf(naturalHole) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // Determine color using PLAY POSITIONS
            var colorClass = 'score-green';
            if (t1ClinchPlayPosition !== null) {
                if (playPos < t1ClinchPlayPosition) {
                    colorClass = 'score-green';
                } else if (playPos === t1ClinchPlayPosition) {
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
                    if (t1Display && t1Display[playPos]) {
                        displayVal = t1Display[playPos];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    if (t1Display && t1Display[playPos] && t1Display[playPos] !== 'AS') {
                        displayVal = t1Display[playPos];
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
            for (var i = 0; i < columns.length; i++) {
                var naturalHole = columns[i].naturalHole;
                var score = getStoredScore(player, naturalHole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, naturalHole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '<\/td>';
            }
            html += '<td class="score-green">' + playerTotal + '<\/td><\/tr>';
        }
        
        // Green line row
        html += '<tr class="green-line"><td colspan="20"><\/tr>';
        
        // T-2 row - v1.13: Uses play positions for color decision
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2<\/td>';
        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            var playPos = col.playPosition;
            var naturalHole = col.naturalHole;
            var val = t2Row[playPos] || '_';
            var isSynced = (savedHoles[2].indexOf(naturalHole) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            // Determine color using PLAY POSITIONS
            var colorClass = 'score-green';
            if (t2ClinchPlayPosition !== null) {
                if (playPos < t2ClinchPlayPosition) {
                    colorClass = 'score-green';
                } else if (playPos === t2ClinchPlayPosition) {
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
                    if (t2Display && t2Display[playPos]) {
                        displayVal = t2Display[playPos];
                    } else {
                        displayVal = val;
                    }
                    cellClass = colorClass;
                }
            } else if (val && val !== '_') {
                if (isSynced) {
                    if (t2Display && t2Display[playPos] && t2Display[playPos] !== 'AS') {
                        displayVal = t2Display[playPos];
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
        
        // Strk row - v1.13: Uses play position for last hole detection
        html += '<table><td style="color:#4caf50; font-weight:600;">Strk<\/td>';
        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            var playPos = col.playPosition;
            var naturalHole = col.naturalHole;
            var val = strkRow[playPos] || '_';
            var isSynced = (savedHoles[1].indexOf(naturalHole) !== -1 && savedHoles[2].indexOf(naturalHole) !== -1);
            
            var displayVal = '';
            var cellClass = 'score-invisible';
            
            if (isSynced) {
                // v1.13: Determine color using PLAY POSITION - last hole is always playPos === 17
                var isLastHole = (playPos === 17);
                
                if (isLastHole) {
                    cellClass = 'score-gold';
                } else {
                    cellClass = 'score-green';
                }
                
                if (val === 'AS' || val === 0 || val === '0') {
                    displayVal = getAsSquareHtml();
                } else if (typeof val === 'string' && (val === 'A' || val === 'B')) {
                    if (strkDisplay && strkDisplay[playPos]) {
                        displayVal = strkDisplay[playPos];
                    } else {
                        displayVal = val;
                    }
                } else if (val && val !== '_') {
                    if (strkDisplay && strkDisplay[playPos]) {
                        displayVal = strkDisplay[playPos];
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
        getVersion: function() { return "1.13"; }
    };
    
})();

// ============================================================
// EXPORT - for compatibility with all game files
// ============================================================
window.GameScorecard = GameScorecard;

/*
FILE: js/game-scorecard.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - REFACTORED: Removed holes array parameter - now builds display mapping internally
   - New signature: renderScorecard(containerId, displayMode, startingHole, players, ...)
   - No longer relies on external holes array - uses GameOrder to determine display order
   - Strk row gold logic now uses play position comparison (last hole is always position 17)
   - This eliminates the concept of "natural vs play mode" at the data level
   - All games are treated the same internally; display preference is purely visual
   - All existing functionality preserved
DEPENDS ON: GameOrder
STATUS: Ready for integration
*/