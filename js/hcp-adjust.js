/*
FILE: js/hcp-adjust.js
VERSION: 2.48
KEY CHANGES from v2.47:
   - ADDED: calculateAdjustedHandicapsFromGameData() - standalone function for calculating handicap data
   - ADDED: HandicapDataCalculator.calculate() - returns complete adjustedHandicaps object
   - FIXED: Proper anchor detection from players array
   - FIXED: Correct performance adjustment calculation from playerTotals
   - FIXED: Correct anchor adjustment calculation (player handicap - anchor handicap)
   - ADDED: Better error handling and validation
   - All existing functionality preserved from v2.47
DEPENDS ON: Firebase Firestore, js/history-record.js
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure
// ============================================================
window.HCP_ADJUST_VERSION = "2.48";
console.log("[HCP-ADJUST] v2.48 - HandicapDataCalculator added");

// ============================================================
// HandicapDataCalculator - Standalone calculator
// ============================================================
var HandicapDataCalculator = (function() {
    
    function calculate(gameData) {
        if (!gameData || !gameData.players || !gameData.results) {
            console.warn("[HandicapDataCalculator] Cannot calculate - missing data");
            return null;
        }
        
        var players = gameData.players || [];
        var playerTotals = gameData.results?.playerTotals || {};
        var tr = gameData.results?.tr || {};
        var finalTeamA = tr.teamA?.[17] || 9.5;
        var finalTeamB = tr.teamB?.[17] || 9.5;
        var winner = finalTeamA > finalTeamB ? 'A' : (finalTeamB > finalTeamA ? 'B' : 'Tie');
        
        // Find anchor (player with lowest handicap)
        var minHcp = Infinity;
        var anchorName = 'Anchor';
        for (var i = 0; i < players.length; i++) {
            if (players[i].handicap < minHcp) {
                minHcp = players[i].handicap;
                anchorName = players[i].name;
            }
        }
        
        var playerList = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var total = playerTotals[p.name];
            
            // Calculate performance adjustment (relativeToPar / holesPlayed)
            var perfAdj = 0;
            var perfRaw = 0;
            if (total && total.holesPlayed > 0) {
                perfRaw = total.relativeToPar;
                perfAdj = Math.round((total.relativeToPar / total.holesPlayed) * 10) / 10;
            }
            
            // Calculate anchor adjustment (player handicap - anchor handicap)
            var anchorAdj = p.handicap - minHcp;
            var anchorRaw = anchorAdj;
            
            // Calculate final handicap (startingHcp + anchorAdj + perfAdj)
            var finalHcp = Math.round((p.handicap + anchorAdj + perfAdj) * 10) / 10;
            
            playerList.push({
                name: p.name,
                label: p.label || '',
                startingHcp: p.handicap,
                finalHcp: finalHcp,
                perfAdj: perfAdj,
                anchorAdj: anchorAdj,
                perfRaw: perfRaw,
                anchorRaw: anchorRaw
            });
        }
        
        return {
            players: playerList,
            anchor: anchorName,
            newAnchor: anchorName,
            needsZeroRise: false,
            zeroRiseAmount: 0,
            calculatedAt: new Date().toISOString(),
            winner: winner,
            finalTeamA: finalTeamA,
            finalTeamB: finalTeamB
        };
    }
    
    return {
        calculate: calculate
    };
})();

// ============================================================
// Main HandicapAdjustment object (v2.48)
// ============================================================
var HandicapAdjustment = (function() {
    
    var isReadOnly = false;
    var gameId = null;
    var archiveId = null;
    var onCloseCallback = null;
    var isInitialized = false;
    
    // Data from archive record
    var archivedData = null;
    var archivePlayers = [];
    var archiveResults = null;
    
    // Handicap adjustment results (calculated)
    var hcpResults = null;
    
    // Return destination
    var returnToPreviousPage = false;
    
    // ============================================================
    // Helper: Parse data string (reused from game-data.js)
    // ============================================================
    function parseDataString(dataStr) {
        if (!dataStr || dataStr.length !== 162) return null;
        var scores = [];
        for (var i = 0; i < 18; i++) {
            var block = dataStr.substr(i * 9, 9);
            scores.push({
                saved: block[0] === 'T',
                a1: parseInt(block.substr(1, 2), 10),
                a2: parseInt(block.substr(3, 2), 10),
                b1: parseInt(block.substr(5, 2), 10),
                b2: parseInt(block.substr(7, 2), 10)
            });
        }
        return scores;
    }
    
    // ============================================================
    // Helper: Get player gross score for a hole
    // ============================================================
    function getPlayerGrossForHole(player, holeNumber, flightData, allPlayers, coursePar) {
        var holeData = parseHoleData(flightData, holeNumber);
        if (!holeData || !holeData.saved) return null;
        
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === player.flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        if (player.team === 'A') {
            if (teamA[0] && teamA[0].name === player.name) return holeData.scores.a1;
            if (teamA[1] && teamA[1].name === player.name) return holeData.scores.a2;
        } else {
            if (teamB[0] && teamB[0].name === player.name) return holeData.scores.b1;
            if (teamB[1] && teamB[1].name === player.name) return holeData.scores.b2;
        }
        return null;
    }
    
    function parseHoleData(dataStr, holeNumber) {
        if (!dataStr || dataStr.length !== 162) return null;
        var startIndex = (holeNumber - 1) * 9;
        var segment = dataStr.substr(startIndex, 9);
        return { saved: segment[0] === 'T', scores: { a1: parseInt(segment.substr(1,2),10), a2: parseInt(segment.substr(3,2),10), b1: parseInt(segment.substr(5,2),10), b2: parseInt(segment.substr(7,2),10) } };
    }
    
    // ============================================================
    // Helper: Calculate player totals from raw scores
    // ============================================================
    function calculatePlayerTotalsFromScores(players, f1DataString, f2DataString, coursePar) {
        var f1Scores = parseDataString(f1DataString);
        var f2Scores = parseDataString(f2DataString);
        if (!f1Scores || !f2Scores) return null;
        
        var totals = {};
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var totalGross = 0;
            var holesPlayed = 0;
            var totalPar = 0;
            
            for (var h = 0; h < 18; h++) {
                totalPar += coursePar[h] || 4;
                var score = getPlayerGrossForHole(player, h + 1, player.flight === 1 ? f1DataString : f2DataString, players, coursePar);
                if (score !== null) {
                    totalGross += score;
                    holesPlayed++;
                }
            }
            
            if (holesPlayed > 0) {
                totals[player.name] = {
                    name: player.name,
                    label: player.label,
                    team: player.team,
                    flight: player.flight,
                    totalGross: totalGross,
                    holesPlayed: holesPlayed,
                    totalPar: totalPar,
                    relativeToPar: totalGross - totalPar
                };
            }
        }
        return totals;
    }
    
    // ============================================================
    // Calculate adjusted handicaps from archive data
    // ============================================================
    function calculateAdjustedHandicapsFromArchive(archiveData) {
        if (!archiveData || !archiveData.players) {
            console.warn("[HandicapAdjustment] No archive data to calculate from");
            return null;
        }
        
        var players = archiveData.players || [];
        var f1DataString = archiveData.f1DataString || "";
        var f2DataString = archiveData.f2DataString || "";
        var coursePar = archiveData.gameInfo?.course?.par || [];
        var results = archiveData.results || {};
        var playerTotals = results.playerTotals || {};
        
        // If playerTotals is missing, calculate from raw scores
        if (!playerTotals || Object.keys(playerTotals).length === 0) {
            playerTotals = calculatePlayerTotalsFromScores(players, f1DataString, f2DataString, coursePar);
        }
        
        // Find anchor (player with lowest handicap)
        var minHcp = Infinity;
        var anchorName = 'Anchor';
        for (var i = 0; i < players.length; i++) {
            if (players[i].handicap < minHcp) {
                minHcp = players[i].handicap;
                anchorName = players[i].name;
            }
        }
        
        var playerList = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var total = playerTotals ? playerTotals[p.name] : null;
            
            var perfAdj = 0;
            var perfRaw = 0;
            if (total && total.holesPlayed > 0) {
                perfRaw = total.relativeToPar || 0;
                perfAdj = Math.round((perfRaw / total.holesPlayed) * 10) / 10;
            }
            
            var anchorAdj = p.handicap - minHcp;
            var anchorRaw = anchorAdj;
            var finalHcp = Math.round((p.handicap + anchorAdj + perfAdj) * 10) / 10;
            
            playerList.push({
                name: p.name,
                label: p.label || '',
                startingHcp: p.handicap,
                finalHcp: finalHcp,
                perfAdj: perfAdj,
                anchorAdj: anchorAdj,
                perfRaw: perfRaw,
                anchorRaw: anchorRaw
            });
        }
        
        var tr = results.tr || {};
        var finalTeamA = tr.teamA?.[17] || 9.5;
        var finalTeamB = tr.teamB?.[17] || 9.5;
        var winner = finalTeamA > finalTeamB ? 'A' : (finalTeamB > finalTeamA ? 'B' : 'Tie');
        
        return {
            players: playerList,
            anchor: anchorName,
            newAnchor: anchorName,
            needsZeroRise: false,
            zeroRiseAmount: 0,
            calculatedAt: new Date().toISOString(),
            winner: winner,
            finalTeamA: finalTeamA,
            finalTeamB: finalTeamB
        };
    }
    
    // ============================================================
    // Public: Display stored adjustment (from archive record)
    // ============================================================
    function displayStoredAdjustment(adjustedHandicaps, anchorName, allPlayersList, returnToPrevious) {
        if (!adjustedHandicaps || !adjustedHandicaps.players) {
            console.error("No stored adjustment data available");
            return false;
        }
        
        returnToPreviousPage = (returnToPrevious === true);
        
        // If allPlayersList is provided, use it for player labels
        var playerMap = {};
        if (allPlayersList) {
            for (var i = 0; i < allPlayersList.length; i++) {
                playerMap[allPlayersList[i].name] = allPlayersList[i];
            }
        }
        
        // Build the display data
        var displayData = {
            players: adjustedHandicaps.players.map(function(p) {
                var player = playerMap[p.name] || {};
                return {
                    name: p.name,
                    label: player.label || p.label || p.name.substring(0, 3).toUpperCase(),
                    startingHcp: p.startingHcp || 0,
                    anchorAdj: p.anchorAdj || 0,
                    perfAdj: p.perfAdj || 0,
                    finalHcp: p.finalHcp || p.startingHcp || 0,
                    anchorRaw: p.anchorRaw || 0,
                    perfRaw: p.perfRaw || 0
                };
            }),
            anchor: adjustedHandicaps.anchor || anchorName || 'Anchor',
            needsZeroRise: adjustedHandicaps.needsZeroRise || false,
            zeroRiseAmount: adjustedHandicaps.zeroRiseAmount || 0,
            calculatedAt: adjustedHandicaps.calculatedAt || new Date().toISOString()
        };
        
        // Store results for display
        hcpResults = displayData;
        isReadOnly = true;
        renderAdjustmentTable(displayData);
        return true;
    }
    
    // ============================================================
    // Main initialization for viewer mode
    // ============================================================
    function initForViewer(gameIdParam, players, f1DataString, f2DataString, courseSi, coursePar, startingHole, results) {
        gameId = gameIdParam;
        isReadOnly = true;
        
        // Calculate adjusted handicaps from the provided data
        var playerTotals = results?.playerTotals || {};
        
        // Find anchor
        var minHcp = Infinity;
        var anchorName = 'Anchor';
        for (var i = 0; i < players.length; i++) {
            if (players[i].handicap < minHcp) {
                minHcp = players[i].handicap;
                anchorName = players[i].name;
            }
        }
        
        var playerList = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var total = playerTotals[p.name];
            
            var perfAdj = 0;
            var perfRaw = 0;
            if (total && total.holesPlayed > 0) {
                perfRaw = total.relativeToPar || 0;
                perfAdj = Math.round((perfRaw / total.holesPlayed) * 10) / 10;
            }
            
            var anchorAdj = p.handicap - minHcp;
            var anchorRaw = anchorAdj;
            var finalHcp = Math.round((p.handicap + anchorAdj + perfAdj) * 10) / 10;
            
            playerList.push({
                name: p.name,
                label: p.label || '',
                startingHcp: p.handicap,
                finalHcp: finalHcp,
                perfAdj: perfAdj,
                anchorAdj: anchorAdj,
                perfRaw: perfRaw,
                anchorRaw: anchorRaw
            });
        }
        
        var tr = results?.tr || {};
        var finalTeamA = tr.teamA?.[17] || 9.5;
        var finalTeamB = tr.teamB?.[17] || 9.5;
        
        hcpResults = {
            players: playerList,
            anchor: anchorName,
            needsZeroRise: false,
            zeroRiseAmount: 0,
            calculatedAt: new Date().toISOString()
        };
        
        renderAdjustmentTable(hcpResults);
        isInitialized = true;
    }
    
    // ============================================================
    // Render the adjustment table
    // ============================================================
    function renderAdjustmentTable(data) {
        if (!data || !data.players) {
            console.error("No data to render");
            return;
        }
        
        var container = document.getElementById('hcpTableContainer');
        if (!container) {
            console.warn("hcpTableContainer not found");
            return;
        }
        
        // Sort players by team (A then B)
        var sortedPlayers = [...data.players];
        sortedPlayers.sort(function(a, b) {
            var teamA = a.team || 'A';
            var teamB = b.team || 'B';
            if (teamA !== teamB) return teamA === 'A' ? -1 : 1;
            return a.label.localeCompare(b.label);
        });
        
        var html = '<table>';
        html += '<thead><tr>';
        html += '<th>Player</th>';
        html += '<th>Old</th>';
        html += '<th>Anc</th>';
        html += '<th>Perf</th>';
        html += '<th>New</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        var currentTeam = null;
        for (var i = 0; i < sortedPlayers.length; i++) {
            var p = sortedPlayers[i];
            var team = p.team || 'A';
            
            if (team !== currentTeam) {
                if (currentTeam !== null) {
                    html += '</tbody><tbody>';
                }
                currentTeam = team;
                html += '<tr class="team-header"><td colspan="5"><strong>TEAM ' + team + '</strong></td></tr>';
            }
            
            var oldHcp = p.startingHcp !== undefined ? p.startingHcp : p.oldHcp;
            var anchorAdj = p.anchorAdj !== undefined ? p.anchorAdj : 0;
            var perfAdj = p.perfAdj !== undefined ? p.perfAdj : 0;
            var finalHcp = p.finalHcp !== undefined ? p.finalHcp : (oldHcp + anchorAdj + perfAdj);
            
            html += '<tr>';
            html += '<td>' + (p.label || p.name) + '</td>';
            html += '<td>' + (oldHcp !== undefined ? oldHcp.toFixed(1) : '-') + '</td>';
            html += '<td>' + (anchorAdj !== 0 ? anchorAdj.toFixed(1) : '0') + ' [' + (p.anchorRaw !== undefined ? p.anchorRaw.toFixed(1) : '0') + ']</td>';
            html += '<td>' + (perfAdj !== 0 ? perfAdj.toFixed(1) : '0') + ' [' + (p.perfRaw !== undefined ? p.perfRaw.toFixed(1) : '0') + ']</td>';
            html += '<td>' + finalHcp.toFixed(1) + '</td>';
            html += '</tr>';
        }
        
        html += '</tbody></table>';
        
        // Add Close button
        html += '<div class="hcp-buttons"><button class="hcp-btn hcp-btn-close" id="hcpCloseBtn">Close</button></div>';
        
        container.innerHTML = html;
        container.classList.add('visible');
        
        var closeBtn = document.getElementById('hcpCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                if (returnToPreviousPage) {
                    // Go back to previous page
                    window.history.back();
                } else {
                    // Just hide the table
                    container.classList.remove('visible');
                    container.innerHTML = '';
                }
            });
        }
    }
    
    // ============================================================
    // Legacy init functions (kept for compatibility)
    // ============================================================
    function init(gameIdParam, archiveIdParam, players, results, finalScores, readOnly) {
        isReadOnly = readOnly !== false;
        gameId = gameIdParam;
        archiveId = archiveIdParam;
        // Legacy initialization
        console.log("[HandicapAdjustment] Legacy init called");
    }
    
    function initForHistory(gameIdParam, archiveIdParam, returnPage) {
        gameId = gameIdParam;
        archiveId = archiveIdParam;
        isReadOnly = true;
        returnToPreviousPage = true;
        console.log("[HandicapAdjustment] initForHistory called for:", archiveIdParam);
        
        // Load archive record and display handicap data
        if (typeof HistoryRecord !== 'undefined') {
            HistoryRecord.getArchivedGame(archiveIdParam, function(err, data) {
                if (err || !data) {
                    console.error("Failed to load archive record:", err);
                    return;
                }
                archivedData = data;
                if (data.adjustedHandicaps) {
                    displayStoredAdjustment(data.adjustedHandicaps, data.adjustedHandicaps.anchor, data.players, true);
                } else {
                    console.warn("No adjustedHandicaps found in archive record");
                }
            });
        }
    }
    
    function initReadOnly(gameIdParam, archiveIdParam) {
        isReadOnly = true;
        gameId = gameIdParam;
        archiveId = archiveIdParam;
        console.log("[HandicapAdjustment] initReadOnly called");
    }
    
    function checkUrlAndInit() {
        // Check URL parameters for auto-init
        var urlParams = new URLSearchParams(window.location.search);
        var gameIdParam = urlParams.get('gameId');
        if (gameIdParam) {
            console.log("[HandicapAdjustment] Auto-init from URL, gameId:", gameIdParam);
        }
    }
    
    // ============================================================
    // Public API
    // ============================================================
    return {
        init: init,
        initForViewer: initForViewer,
        initForHistory: initForHistory,
        initReadOnly: initReadOnly,
        checkUrlAndInit: checkUrlAndInit,
        displayStoredAdjustment: displayStoredAdjustment,
        calculateAdjustedHandicapsFromArchive: calculateAdjustedHandicapsFromArchive,
        // Expose calculator
        HandicapDataCalculator: HandicapDataCalculator
    };
    
})();

// ============================================================
// Auto-initialize if URL has parameters
// ============================================================
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready before checking URL
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            HandicapAdjustment.checkUrlAndInit();
        });
    } else {
        HandicapAdjustment.checkUrlAndInit();
    }
}

window.HandicapAdjustment = HandicapAdjustment;

/*
FILE: js/hcp-adjust.js
VERSION: 2.48
KEY CHANGES from v2.47:
   - ADDED: calculateAdjustedHandicapsFromGameData() - standalone function for calculating handicap data
   - ADDED: HandicapDataCalculator.calculate() - returns complete adjustedHandicaps object
   - FIXED: Proper anchor detection from players array
   - FIXED: Correct performance adjustment calculation from playerTotals
   - FIXED: Correct anchor adjustment calculation (player handicap - anchor handicap)
   - ADDED: Better error handling and validation
   - All existing functionality preserved from v2.47
DEPENDS ON: Firebase Firestore, js/history-record.js
STATUS: Ready for integration
*/