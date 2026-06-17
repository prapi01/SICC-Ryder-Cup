/*
FILE: js/game-stroke.js
VERSION: 1.09
KEY CHANGES from v1.08:
   - FIXED: getPlayerGrossForHole() now uses RealGameState.getAllPlayers() as fallback
   - Prevents "window.allPlayers is undefined" error in modular architecture
   - All existing functionality preserved from v1.08
DEPENDS ON: GameOrder (optional, with fallback), RealGameState (optional, for fallback)
STATUS: Ready for integration
*/

var GameStroke = (function() {
    
    console.log("[GAME-STROKE] Initializing v1.09 - fixed window.allPlayers fallback");
    
    // ============================================================
    // Helper: Get all players from cache or state
    // ============================================================
    function getAllPlayers() {
        // Try window.allPlayers first (for backward compatibility)
        if (typeof window !== 'undefined' && window.allPlayers && window.allPlayers.length > 0) {
            return window.allPlayers;
        }
        // Try RealGameState
        if (typeof RealGameState !== 'undefined' && RealGameState.getAllPlayers) {
            var statePlayers = RealGameState.getAllPlayers();
            if (statePlayers && statePlayers.length > 0) {
                return statePlayers;
            }
        }
        // Try GameLoader cache
        if (typeof GameLoader !== 'undefined') {
            var cache = GameLoader.getLocalCache();
            if (cache && cache.players && cache.players.length > 0) {
                return cache.players;
            }
        }
        return [];
    }
    
    // Calculate total team handicap (raw handicaps - stroke game always uses raw)
    function getTotalTeamHandicap(players, team) {
        var teamPlayers = players.filter(function(p) { return p.team === team; });
        var total = 0;
        for (var i = 0; i < teamPlayers.length; i++) {
            total += teamPlayers[i].handicap;
        }
        return total;
    }
    
    // Get a player's gross score for a specific hole (returns null if not saved)
    function getPlayerGrossForHole(player, holeNumber, f1DataString, f2DataString, coursePar) {
        var flightDataStr = player.flight === 1 ? f1DataString : f2DataString;
        var holeData = GameData.parseHoleData(flightDataStr, holeNumber);
        if (!holeData || !holeData.saved) return null;
        
        // v1.09: Use getAllPlayers() helper with fallback chain
        var allPlayers = getAllPlayers();
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
    
    // Get cumulative gross for a team up to a specific hole
    function getCumulativeGrossForTeam(players, team, upToHole, f1DataString, f2DataString, coursePar) {
        var teamPlayers = players.filter(function(p) { return p.team === team; });
        var totalGross = 0;
        
        for (var h = 1; h <= upToHole; h++) {
            for (var i = 0; i < teamPlayers.length; i++) {
                var player = teamPlayers[i];
                var score = getPlayerGrossForHole(player, h, f1DataString, f2DataString, coursePar);
                if (score !== null) {
                    totalGross += score;
                } else {
                    totalGross += coursePar[h - 1] || 4;
                }
            }
        }
        return totalGross;
    }
    
    // v1.07: Get play order using GameOrder with fallback
    function getPlayOrder(startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayOrder) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getPlayOrder();
        }
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    // ============================================================
    // v1.09: Main calculate function with debug logging
    // ============================================================
    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, coursePar) {
        console.log(`[DEBUG-STROKE] =========================================`);
        console.log(`[DEBUG-STROKE] STROKE GAME CALCULATION START`);
        console.log(`[DEBUG-STROKE] startingHole=${startingHole}`);
        console.log(`[DEBUG-STROKE] allPlayers count: ${allPlayers.length}`);
        console.log(`[DEBUG-STROKE] =========================================`);
        
        // v1.09: Use allPlayers passed in, but also ensure window.allPlayers is set for legacy code
        if (typeof window !== 'undefined' && allPlayers && allPlayers.length > 0) {
            window.allPlayers = allPlayers;
        }
        
        var totalHcpA = getTotalTeamHandicap(allPlayers, "A");
        var totalHcpB = getTotalTeamHandicap(allPlayers, "B");
        console.log(`[DEBUG-STROKE] totalHcpA=${totalHcpA}, totalHcpB=${totalHcpB}`);
        
        var nettA = new Array(18).fill(0);
        var nettB = new Array(18).fill(0);
        var leader = new Array(18).fill("AS");
        var pointsA = new Array(18).fill(0);
        var pointsB = new Array(18).fill(0);
        var displayStrk = new Array(18).fill("AS");
        var strokeTR = new Array(18).fill(null);
        
        var playOrder = getPlayOrder(startingHole);
        console.log(`[DEBUG-STROKE] Play order (first 5): ${playOrder.slice(0, 5).join(', ')}...`);
        
        var cumulativeGrossA = 0;
        var cumulativeGrossB = 0;
        var cumulativePar = 0;
        
        for (var pos = 0; pos < 18; pos++) {
            var holeNum = playOrder[pos];
            var par = coursePar[holeNum - 1] || 4;
            cumulativePar += par;
            
            console.log(`[DEBUG-STROKE] --- Position ${pos}: Hole ${holeNum}, Par=${par} ---`);
            
            // Get gross scores for this hole for both teams
            var holeGrossA = 0;
            var holeGrossB = 0;
            
            for (var i = 0; i < allPlayers.length; i++) {
                var player = allPlayers[i];
                var score = getPlayerGrossForHole(player, holeNum, f1DataString, f2DataString, coursePar);
                var isSaved = (score !== null);
                if (!isSaved) {
                    score = coursePar[holeNum - 1] || 4;
                }
                if (player.team === 'A') {
                    holeGrossA += score;
                    if (!isSaved) {
                        console.log(`[DEBUG-STROKE]   ${player.label} (Team A): score=PAR (${score}) - hole not saved`);
                    } else {
                        console.log(`[DEBUG-STROKE]   ${player.label} (Team A): score=${score}`);
                    }
                } else {
                    holeGrossB += score;
                    if (!isSaved) {
                        console.log(`[DEBUG-STROKE]   ${player.label} (Team B): score=PAR (${score}) - hole not saved`);
                    } else {
                        console.log(`[DEBUG-STROKE]   ${player.label} (Team B): score=${score}`);
                    }
                }
            }
            
            console.log(`[DEBUG-STROKE] Hole gross: Team A=${holeGrossA}, Team B=${holeGrossB}`);
            
            // Update cumulative gross
            cumulativeGrossA += holeGrossA;
            cumulativeGrossB += holeGrossB;
            console.log(`[DEBUG-STROKE] Cumulative gross: Team A=${cumulativeGrossA}, Team B=${cumulativeGrossB}`);
            
            // Calculate net scores
            var netA = cumulativeGrossA - totalHcpA;
            var netB = cumulativeGrossB - totalHcpB;
            nettA[pos] = netA;
            nettB[pos] = netB;
            console.log(`[DEBUG-STROKE] Net scores: Team A=${netA}, Team B=${netB}`);
            
            // Calculate difference (A - B)
            var diff = netB - netA;
            console.log(`[DEBUG-STROKE] Diff (B - A): ${diff}`);
            
            if (Math.abs(diff) < 0.01) {
                leader[pos] = "AS";
                displayStrk[pos] = "AS";
                pointsA[pos] = 0.5;
                pointsB[pos] = 0.5;
                strokeTR[pos] = { pointsA: 0.5, pointsB: 0.5 };
                console.log(`[DEBUG-STROKE] Result: TIE (AS)`);
            } else if (diff > 0) {
                var margin = Math.abs(diff);
                leader[pos] = "A";
                var displayMargin = Math.round(margin);
                displayStrk[pos] = "A" + displayMargin;
                pointsA[pos] = 1;
                pointsB[pos] = 0;
                strokeTR[pos] = { pointsA: 1, pointsB: 0 };
                console.log(`[DEBUG-STROKE] Result: Team A wins by ${displayMargin} (A${displayMargin})`);
            } else {
                var marginB = Math.abs(diff);
                leader[pos] = "B";
                var displayMarginB = Math.round(marginB);
                displayStrk[pos] = "B" + displayMarginB;
                pointsA[pos] = 0;
                pointsB[pos] = 1;
                strokeTR[pos] = { pointsA: 0, pointsB: 1 };
                console.log(`[DEBUG-STROKE] Result: Team B wins by ${displayMarginB} (B${displayMarginB})`);
            }
            console.log(`[DEBUG-STROKE] Points: A=${pointsA[pos]}, B=${pointsB[pos]}`);
        }
        
        console.log(`[DEBUG-STROKE] =========================================`);
        console.log(`[DEBUG-STROKE] STROKE GAME CALCULATION COMPLETE`);
        console.log(`[DEBUG-STROKE] Final net: A=${nettA[17]}, B=${nettB[17]}`);
        console.log(`[DEBUG-STROKE] Final diff: ${nettB[17] - nettA[17]}`);
        console.log(`[DEBUG-STROKE] Final displayStrk: ${displayStrk[17]}`);
        console.log(`[DEBUG-STROKE] =========================================`);
        
        return {
            nettA: nettA,
            nettB: nettB,
            leader: leader,
            pointsA: pointsA,
            pointsB: pointsB,
            displayStrk: displayStrk,
            strokeTR: strokeTR
        };
    }
    
    return {
        calculate: calculate
    };
})();

// Export for browser
window.GameStroke = GameStroke;

// Re-expose version for console debugging
window.GAME_STROKE_VERSION = "1.09";

/*
FILE: js/game-stroke.js
VERSION: 1.09
KEY CHANGES from v1.08:
   - FIXED: getPlayerGrossForHole() now uses RealGameState.getAllPlayers() as fallback
   - Prevents "window.allPlayers is undefined" error in modular architecture
   - All existing functionality preserved from v1.08
DEPENDS ON: GameOrder (optional, with fallback), RealGameState (optional, for fallback)
STATUS: Ready for integration
*/