/*
FILE: js/game-stroke.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - FIXED: Stroke game now correctly calculates net scores and stores them in nettA/nettB arrays
   - FIXED: Now uses raw handicaps (always, regardless of teamGameFormat) - stroke game is independent
   - FIXED: Properly handles play order for display
   - FIXED: Populates displayStrk with correct margin values
   - FIXED: Now stores pointsA/pointsB correctly based on winner
   - All other functionality preserved
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/

var GameStroke = (function() {
    
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
        
        var flightPlayers = player.flight === 1 ? 
            window.allPlayers.filter(function(p) { return p.flight === 1; }) : 
            window.allPlayers.filter(function(p) { return p.flight === 2; });
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
                    // If hole not saved, use par
                    totalGross += coursePar[h - 1] || 4;
                }
            }
        }
        return totalGross;
    }
    
    // Main calculate function - v1.06: Fixed net score calculation and storage
    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, coursePar) {
        // Stroke game ALWAYS uses raw handicaps (independent of teamGameFormat)
        var totalHcpA = getTotalTeamHandicap(allPlayers, "A");
        var totalHcpB = getTotalTeamHandicap(allPlayers, "B");
        
        var nettA = new Array(18).fill(0);
        var nettB = new Array(18).fill(0);
        var leader = new Array(18).fill("AS");
        var pointsA = new Array(18).fill(0);
        var pointsB = new Array(18).fill(0);
        var displayStrk = new Array(18).fill("AS");
        var strokeTR = new Array(18).fill(null);
        
        // Get play order
        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);
        
        // Calculate cumulative gross for each position in play order
        var cumulativeGrossA = 0;
        var cumulativeGrossB = 0;
        
        for (var pos = 0; pos < 18; pos++) {
            var holeNum = playOrder[pos];
            
            // Get gross scores for this hole for both teams
            var holeGrossA = 0;
            var holeGrossB = 0;
            
            for (var i = 0; i < allPlayers.length; i++) {
                var player = allPlayers[i];
                var score = getPlayerGrossForHole(player, holeNum, f1DataString, f2DataString, coursePar);
                if (score === null) {
                    // Use par if hole not saved by this player's flight
                    score = coursePar[holeNum - 1] || 4;
                }
                if (player.team === 'A') {
                    holeGrossA += score;
                } else {
                    holeGrossB += score;
                }
            }
            
            // Update cumulative gross
            cumulativeGrossA += holeGrossA;
            cumulativeGrossB += holeGrossB;
            
            // Calculate net scores
            var netA = cumulativeGrossA - totalHcpA;
            var netB = cumulativeGrossB - totalHcpB;
            nettA[pos] = netA;
            nettB[pos] = netB;
            
            // Calculate difference (A - B)
            // Lower net score wins, so if netA < netB, Team A is winning
            var diff = netB - netA;  // Positive = Team A winning, Negative = Team B winning
            
            if (Math.abs(diff) < 0.01) {
                // Tie
                leader[pos] = "AS";
                displayStrk[pos] = "AS";
                pointsA[pos] = 0.5;
                pointsB[pos] = 0.5;
                strokeTR[pos] = { pointsA: 0.5, pointsB: 0.5 };
            } else if (diff > 0) {
                // Team A is winning (lower net score)
                var margin = Math.abs(diff);
                leader[pos] = "A";
                // Round margin to nearest integer for display
                var displayMargin = Math.round(margin);
                displayStrk[pos] = "A" + displayMargin;
                pointsA[pos] = 1;
                pointsB[pos] = 0;
                strokeTR[pos] = { pointsA: 1, pointsB: 0 };
            } else {
                // Team B is winning (lower net score)
                var marginB = Math.abs(diff);
                leader[pos] = "B";
                var displayMarginB = Math.round(marginB);
                displayStrk[pos] = "B" + displayMarginB;
                pointsA[pos] = 0;
                pointsB[pos] = 1;
                strokeTR[pos] = { pointsA: 0, pointsB: 1 };
            }
        }
        
        console.log('[STROKE] Calculation complete:');
        console.log('  totalHcpA:', totalHcpA, 'totalHcpB:', totalHcpB);
        console.log('  displayStrk (first 5):', displayStrk.slice(0, 5));
        console.log('  nettA (first 5):', nettA.slice(0, 5));
        console.log('  nettB (first 5):', nettB.slice(0, 5));
        
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

/*
FILE: js/game-stroke.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - FIXED: Stroke game now correctly calculates net scores and stores them in nettA/nettB arrays
   - FIXED: Now uses raw handicaps (always, regardless of teamGameFormat) - stroke game is independent
   - FIXED: Properly handles play order for display
   - FIXED: Populates displayStrk with correct margin values
   - FIXED: Now stores pointsA/pointsB correctly based on winner
   - All other functionality preserved
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/