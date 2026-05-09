/*
FILE: js/game-stroke.js
VERSION: 1.03
KEY CHANGES:
   - Added getStrokeLeader() to determine who is leading after N holes
   - Added calculateCumulativePoints() for real-time point tracking
   - Added formatLeaderDisplay() for UI-ready formatting
   - Preserved existing calculate() function for backward compatibility
   - Team aggregate NETT = Total Gross - Total Handicap (raw handicaps sum)
STATUS: Ready for integration
*/

// FILE: js/game-stroke.js - VERSION 1.03
// Game 3: Net Stroke (1 point)
// Team aggregate NETT = Total Gross - Total Handicap
// PROCESSES ALL 18 HOLES - stops at first 'F' in either flight

var GameStroke = (function() {
    
    // Helper to get a player's score for a specific hole from flight data
    function getPlayerScore(player, flightData, actualHole, flightPlayers) {
        var holeData = GameData.parseHoleData(flightData, actualHole);
        if (!holeData || !holeData.saved) return null;
        
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        if (player.team === "A") {
            if (teamAPlayers[0] && teamAPlayers[0].name === player.name) return holeData.scores.a1;
            if (teamAPlayers[1] && teamAPlayers[1].name === player.name) return holeData.scores.a2;
        } else {
            if (teamBPlayers[0] && teamBPlayers[0].name === player.name) return holeData.scores.b1;
            if (teamBPlayers[1] && teamBPlayers[1].name === player.name) return holeData.scores.b2;
        }
        return null;
    }
    
    // Main calculate function - returns strkRow[18]
    function calculate(allPlayers, flight1Data, flight2Data, courseSi, startingHole) {
        var strkRow = new Array(18).fill("0");  // "A", "B", or "0"
        
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; });
        
        // Calculate total team handicaps (sum of raw handicaps)
        var teamAHandicapTotal = 0;
        for (var i = 0; i < teamAPlayers.length; i++) {
            teamAHandicapTotal += teamAPlayers[i].handicap;
        }
        
        var teamBHandicapTotal = 0;
        for (var i = 0; i < teamBPlayers.length; i++) {
            teamBHandicapTotal += teamBPlayers[i].handicap;
        }
        
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        var teamAGrossRunning = 0;
        var teamBGrossRunning = 0;
        
        // Process holes in play order
        for (var pos = 0; pos < 18; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            
            // Parse hole data from both flights
            var f1HoleData = GameData.parseHoleData(flight1Data, actualHole);
            var f2HoleData = GameData.parseHoleData(flight2Data, actualHole);
            
            // STOP if either flight hasn't saved this hole
            if (!f1HoleData || !f1HoleData.saved || !f2HoleData || !f2HoleData.saved) {
                break;
            }
            
            // Calculate gross total for this hole for both teams
            var holeGrossA = 0;
            var holeGrossB = 0;
            
            // Team A players
            for (var i = 0; i < teamAPlayers.length; i++) {
                var p = teamAPlayers[i];
                var flightData = (p.flight === 1) ? flight1Data : flight2Data;
                var flightPlayers = (p.flight === 1) ? flight1Players : flight2Players;
                var score = getPlayerScore(p, flightData, actualHole, flightPlayers);
                if (score !== null && !isNaN(score)) {
                    holeGrossA += score;
                }
            }
            
            // Team B players
            for (var i = 0; i < teamBPlayers.length; i++) {
                var p = teamBPlayers[i];
                var flightData = (p.flight === 1) ? flight1Data : flight2Data;
                var flightPlayers = (p.flight === 1) ? flight1Players : flight2Players;
                var score = getPlayerScore(p, flightData, actualHole, flightPlayers);
                if (score !== null && !isNaN(score)) {
                    holeGrossB += score;
                }
            }
            
            // Update running gross totals
            teamAGrossRunning += holeGrossA;
            teamBGrossRunning += holeGrossB;
            
            // Calculate NETT = Gross - Total Handicap
            var teamANett = teamAGrossRunning - teamAHandicapTotal;
            var teamBNett = teamBGrossRunning - teamBHandicapTotal;
            
            // Determine leader
            if (teamANett < teamBNett) {
                strkRow[pos] = "A";
            } else if (teamBNett < teamANett) {
                strkRow[pos] = "B";
            } else {
                strkRow[pos] = "0";
            }
        }
        
        return strkRow;
    }
    
    // Get the current stroke leader after a specific number of holes
    function getStrokeLeader(strkRow, upToHole) {
        if (upToHole === 0 || upToHole > 18) {
            return { leader: "0", pointsA: 0.5, pointsB: 0.5 };
        }
        
        var leader = strkRow[upToHole - 1] || "0";
        
        if (leader === "A") {
            return { leader: "A", pointsA: 1, pointsB: 0 };
        } else if (leader === "B") {
            return { leader: "B", pointsA: 0, pointsB: 1 };
        } else {
            return { leader: "0", pointsA: 0.5, pointsB: 0.5 };
        }
    }
    
    // Calculate cumulative points based on current leader
    function calculateCumulativePoints(strkRow, upToHole) {
        if (upToHole === 0) {
            return { teamAPoints: 0.5, teamBPoints: 0.5 };
        }
        
        if (upToHole < 18) {
            // Game 3 points only awarded after 18 holes
            return { teamAPoints: 0, teamBPoints: 0 };
        }
        
        var finalLeader = strkRow[17] || "0";
        
        if (finalLeader === "A") {
            return { teamAPoints: 1, teamBPoints: 0 };
        } else if (finalLeader === "B") {
            return { teamAPoints: 0, teamBPoints: 1 };
        } else {
            return { teamAPoints: 0.5, teamBPoints: 0.5 };
        }
    }
    
    // Format leader for UI display
    function formatLeaderDisplay(leader) {
        if (leader === "A") return "A";
        if (leader === "B") return "B";
        return "AS";
    }
    
    // Calculate final Game 3 points (legacy, use calculateCumulativePoints instead)
    function calculatePoints(strkRow, maxSyncedHole) {
        if (maxSyncedHole === 0) {
            return { teamAPoints: 0.5, teamBPoints: 0.5 };
        }
        
        if (maxSyncedHole < 18) {
            // Not complete - no points awarded yet
            return { teamAPoints: 0, teamBPoints: 0 };
        }
        
        var finalLeader = strkRow[17];
        if (finalLeader === "A") {
            return { teamAPoints: 1, teamBPoints: 0 };
        } else if (finalLeader === "B") {
            return { teamAPoints: 0, teamBPoints: 1 };
        } else {
            return { teamAPoints: 0.5, teamBPoints: 0.5 };
        }
    }
    
    // Format row for UI string (Cx format)
    function formatRowString(rowArray) {
        var result = "";
        for (var i = 0; i < rowArray.length; i++) {
            result += "G" + rowArray[i];
        }
        return result;
    }
    
    return {
        calculate: calculate,
        calculatePoints: calculatePoints,
        formatRowString: formatRowString,
        getStrokeLeader: getStrokeLeader,
        calculateCumulativePoints: calculateCumulativePoints,
        formatLeaderDisplay: formatLeaderDisplay
    };
})();

/*
FILE: js/game-stroke.js
VERSION: 1.03
KEY CHANGES:
   - Added getStrokeLeader() to determine who is leading after N holes
   - Added calculateCumulativePoints() for real-time point tracking
   - Added formatLeaderDisplay() for UI-ready formatting
   - Preserved existing calculate() function for backward compatibility
   - Team aggregate NETT = Total Gross - Total Handicap (raw handicaps sum)
STATUS: Ready for integration
*/