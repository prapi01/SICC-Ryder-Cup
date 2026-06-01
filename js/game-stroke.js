/*
FILE: js/game-stroke.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - COMPLETE REWRITE: Stroke game now uses simple cumulative gross minus total team handicap
   - Removed SI-based per-hole stroke allocation (too complex, produced unexpected results)
   - New method: Team Net = (Cumulative Gross) - (Total Team Handicap)
   - Difference = Team A Net - Team B Net
   - Display: A{abs(diff)} if diff > 0, B{abs(diff)} if diff < 0, AS if diff = 0
   - Much simpler, more predictable, matches user expectations
   - All other functions unchanged
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/

var GameStroke = (function() {
    
    // Calculate total team handicap
    function getTotalTeamHandicap(players, team) {
        var teamPlayers = players.filter(function(p) { return p.team === team; });
        var total = 0;
        for (var i = 0; i < teamPlayers.length; i++) {
            total += teamPlayers[i].handicap;
        }
        return total;
    }
    
    // Calculate cumulative gross for a team up to a specific hole
    function getCumulativeGross(players, flight1DataString, flight2DataString, upToHole) {
        var totalGross = 0;
        
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var flightDataStr = (player.flight === 1) ? flight1DataString : flight2DataString;
            
            for (var h = 1; h <= upToHole; h++) {
                var holeData = GameData.parseHoleData(flightDataStr, h);
                if (holeData && holeData.saved) {
                    var score = 0;
                    var flightPlayers = players.filter(function(p) { return p.flight === player.flight; });
                    var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
                    var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
                    
                    if (player.team === 'A') {
                        if (teamA[0] && teamA[0].name === player.name) score = holeData.scores.a1;
                        else if (teamA[1] && teamA[1].name === player.name) score = holeData.scores.a2;
                    } else {
                        if (teamB[0] && teamB[0].name === player.name) score = holeData.scores.b1;
                        else if (teamB[1] && teamB[1].name === player.name) score = holeData.scores.b2;
                    }
                    totalGross += score;
                } else {
                    // If hole not saved, use par (default)
                    // This requires coursePar to be passed in - will be handled in calculate()
                    totalGross += 0; // Placeholder - actual par will be added in calculate()
                }
            }
        }
        return totalGross;
    }
    
    // Main calculate function
    // allPlayers: array of player objects
    // f1DataString: Flight 1 data string
    // f2DataString: Flight 2 data string
    // courseSi: not used in v1.05 (kept for compatibility)
    // startingHole: not used in v1.05 (kept for compatibility)
    // coursePar: array of par values for each hole
    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, coursePar) {
        var nettA = new Array(18).fill(0);
        var nettB = new Array(18).fill(0);
        var leader = new Array(18).fill("AS");
        var pointsA = new Array(18).fill(0);
        var pointsB = new Array(18).fill(0);
        var displayStrk = new Array(18).fill("AS");
        var strokeTR = new Array(18).fill(null);
        
        // Get total team handicaps
        var totalHcpA = getTotalTeamHandicap(allPlayers, "A");
        var totalHcpB = getTotalTeamHandicap(allPlayers, "B");
        
        // Calculate cumulative gross for each hole
        var cumulativeGrossA = 0;
        var cumulativeGrossB = 0;
        
        // Get course par array (needed for unsaved holes)
        var parArray = coursePar || [];
        
        for (var hole = 1; hole <= 18; hole++) {
            // Get gross scores for this hole for both teams
            var holeGrossA = 0;
            var holeGrossB = 0;
            
            // Process all players for this hole
            for (var i = 0; i < allPlayers.length; i++) {
                var player = allPlayers[i];
                var flightDataStr = (player.flight === 1) ? f1DataString : f2DataString;
                var holeData = GameData.parseHoleData(flightDataStr, hole);
                
                var score;
                if (holeData && holeData.saved) {
                    // Get the player's score
                    var flightPlayers = allPlayers.filter(function(p) { return p.flight === player.flight; });
                    var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
                    var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
                    
                    if (player.team === 'A') {
                        if (teamA[0] && teamA[0].name === player.name) score = holeData.scores.a1;
                        else if (teamA[1] && teamA[1].name === player.name) score = holeData.scores.a2;
                        else score = parArray[hole - 1] || 4;
                    } else {
                        if (teamB[0] && teamB[0].name === player.name) score = holeData.scores.b1;
                        else if (teamB[1] && teamB[1].name === player.name) score = holeData.scores.b2;
                        else score = parArray[hole - 1] || 4;
                    }
                } else {
                    // Use par if hole not saved
                    score = parArray[hole - 1] || 4;
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
            nettA[hole - 1] = netA;
            nettB[hole - 1] = netB;
            
            // Calculate difference (A - B)
            var diff = netA - netB;
            
            // Determine leader and display string
            if (diff === 0) {
                leader[hole - 1] = "AS";
                displayStrk[hole - 1] = "AS";
                pointsA[hole - 1] = 0.5;
                pointsB[hole - 1] = 0.5;
                strokeTR[hole - 1] = { pointsA: 0.5, pointsB: 0.5 };
            } else if (diff < 0) {
                // Team A is better (lower net)
                var margin = Math.abs(diff);
                leader[hole - 1] = "A";
                displayStrk[hole - 1] = "A" + margin;
                pointsA[hole - 1] = 1;
                pointsB[hole - 1] = 0;
                strokeTR[hole - 1] = { pointsA: 1, pointsB: 0 };
            } else {
                // Team B is better (lower net)
                var marginB = Math.abs(diff);
                leader[hole - 1] = "B";
                displayStrk[hole - 1] = "B" + marginB;
                pointsA[hole - 1] = 0;
                pointsB[hole - 1] = 1;
                strokeTR[hole - 1] = { pointsA: 0, pointsB: 1 };
            }
        }
        
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
VERSION: 1.05
KEY CHANGES from v1.04:
   - COMPLETE REWRITE: Stroke game now uses simple cumulative gross minus total team handicap
   - Removed SI-based per-hole stroke allocation (too complex, produced unexpected results)
   - New method: Team Net = (Cumulative Gross) - (Total Team Handicap)
   - Difference = Team A Net - Team B Net
   - Display: A{abs(diff)} if diff > 0, B{abs(diff)} if diff < 0, AS if diff = 0
   - Much simpler, more predictable, matches user expectations
   - All other functions unchanged
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/