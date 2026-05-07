// FILE: js/game-stroke.js - VERSION 1.01
// Game 3: Net Stroke (1 point)
// Team aggregate NETT = Total Gross - Total Handicap

var GameStroke = (function() {
    
    // Calculate team gross total for completed holes
    // Parameters:
    //   allPlayers: array of all 8 players with { name, team, handicap }
    //   flight1Scores: object mapping "flight_hole_playerIdx" to gross score
    //   flight2Scores: object mapping "flight_hole_playerIdx" to gross score
    //   maxCompletedHole: number of holes completed (0-18)
    function calculate(allPlayers, flight1Scores, flight2Scores, maxCompletedHole) {
        // Separate by team
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; });
        
        // Calculate total handicaps (sum of raw handicaps)
        var teamAHandicapTotal = 0;
        for (var i = 0; i < teamAPlayers.length; i++) {
            teamAHandicapTotal += teamAPlayers[i].handicap;
        }
        
        var teamBHandicapTotal = 0;
        for (var i = 0; i < teamBPlayers.length; i++) {
            teamBHandicapTotal += teamBPlayers[i].handicap;
        }
        
        // Arrays to store running NETT totals after each hole
        var teamANettAfterHole = new Array(18).fill(null);
        var teamBNettAfterHole = new Array(18).fill(null);
        var strkDisplay = new Array(18).fill("-");
        
        var teamAGrossRunning = 0;
        var teamBGrossRunning = 0;
        
        // For each completed hole (in play order)
        for (var pos = 0; pos < maxCompletedHole; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            
            // Calculate gross total for this hole for both teams
            var holeGrossA = 0;
            var holeGrossB = 0;
            
            // Team A players
            for (var i = 0; i < teamAPlayers.length; i++) {
                var p = teamAPlayers[i];
                var flight = p.flight;
                var playerIdx = findPlayerIndex(p.name, allPlayers);
                var scoreKey = flight + "_" + actualHole + "_" + playerIdx;
                
                var score = null;
                if (flight === 1) {
                    score = flight1Scores[scoreKey];
                } else {
                    score = flight2Scores[scoreKey];
                }
                
                if (score !== undefined && score !== null) {
                    holeGrossA += score;
                }
            }
            
            // Team B players
            for (var i = 0; i < teamBPlayers.length; i++) {
                var p = teamBPlayers[i];
                var flight = p.flight;
                var playerIdx = findPlayerIndex(p.name, allPlayers);
                var scoreKey = flight + "_" + actualHole + "_" + playerIdx;
                
                var score = null;
                if (flight === 1) {
                    score = flight1Scores[scoreKey];
                } else {
                    score = flight2Scores[scoreKey];
                }
                
                if (score !== undefined && score !== null) {
                    holeGrossB += score;
                }
            }
            
            // Update running gross totals
            teamAGrossRunning += holeGrossA;
            teamBGrossRunning += holeGrossB;
            
            // Calculate NETT = Gross - Total Handicap
            var teamANett = teamAGrossRunning - teamAHandicapTotal;
            var teamBNett = teamBGrossRunning - teamBHandicapTotal;
            
            teamANettAfterHole[actualHole - 1] = teamANett;
            teamBNettAfterHole[actualHole - 1] = teamBNett;
            
            // Determine leader for Strk row
            if (teamANett < teamBNett) {
                strkDisplay[actualHole - 1] = "A";
            } else if (teamBNett < teamANett) {
                strkDisplay[actualHole - 1] = "B";
            } else {
                strkDisplay[actualHole - 1] = "AS";
            }
        }
        
        // Determine final winner (after 18 holes)
        var teamAPoints = 0.5;
        var teamBPoints = 0.5;
        var finalNettA = null;
        var finalNettB = null;
        
        if (maxCompletedHole === 18) {
            finalNettA = teamANettAfterHole[17];
            finalNettB = teamBNettAfterHole[17];
            
            if (finalNettA < finalNettB) {
                teamAPoints = 1;
                teamBPoints = 0;
            } else if (finalNettB < finalNettA) {
                teamAPoints = 0;
                teamBPoints = 1;
            } else {
                teamAPoints = 0.5;
                teamBPoints = 0.5;
            }
        }
        
        var finalStrk = (maxCompletedHole > 0) ? strkDisplay[maxCompletedHole - 1] : "-";
        
        console.log("Game 3 Results - Team A NETT:", finalNettA, "Team B NETT:", finalNettB);
        console.log("Game 3 Points - Team A:", teamAPoints, "Team B:", teamBPoints);
        
        return {
            teamAPoints: teamAPoints,
            teamBPoints: teamBPoints,
            strkRow: strkDisplay,      // Array of "A"/"AS"/"B" per hole
            strkTotal: finalStrk,
            teamANett: teamANettAfterHole,
            teamBNett: teamBNettAfterHole
        };
    }
    
    // Helper to find player index in allPlayers array
    function findPlayerIndex(playerName, allPlayers) {
        for (var i = 0; i < allPlayers.length; i++) {
            if (allPlayers[i].name === playerName) return i;
        }
        return -1;
    }
    
    return {
        calculate: calculate
    };
})();