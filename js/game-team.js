// FILE: js/game-team.js - VERSION 1.01
// Game 2: Team Game (2 points)
// Zero-rise handicapping within each flight
// Per-hole matches: best A net vs best B net, second A net vs second B net

var GameTeam = (function() {
    
    // Get strokes for a player on a specific hole based on effective handicap
    // effectiveHcp: handicap after zero-rise (0-54)
    // holeNumber: 1-18
    // courseSi: array of 18 SI values
    function getStrokesForHole(effectiveHcp, holeNumber, courseSi) {
        if (effectiveHcp <= 0) return 0;
        var holeSi = courseSi[holeNumber - 1];
        return (holeSi <= effectiveHcp) ? 1 : 0;
    }
    
    // Calculate net score for a player on a specific hole
    function getNetScore(grossScore, effectiveHcp, holeNumber, courseSi) {
        var strokes = getStrokesForHole(effectiveHcp, holeNumber, courseSi);
        return grossScore - strokes;
    }
    
    // Process a single flight (4 players: 2 Team A, 2 Team B)
    // Returns: { holePoints: array of 18 hole totals (-2 to +2), cumulative: array of running totals }
    function processFlight(flightPlayers, flightScores, courseSi, maxCompletedHole) {
        // Separate by team
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; });
        
        // Get raw handicaps
        var rawHcpA = teamAPlayers.map(function(p) { return p.handicap; });
        var rawHcpB = teamBPlayers.map(function(p) { return p.handicap; });
        var allRawHcp = rawHcpA.concat(rawHcpB);
        
        // Find lowest handicap in the flight (zero-rise)
        var lowestHcp = Math.min.apply(null, allRawHcp);
        
        // Calculate effective handicaps
        var effectiveHcpA = teamAPlayers.map(function(p) { return p.handicap - lowestHcp; });
        var effectiveHcpB = teamBPlayers.map(function(p) { return p.handicap - lowestHcp; });
        
        // Store effective handicaps back to players for reference
        for (var i = 0; i < teamAPlayers.length; i++) {
            teamAPlayers[i].effectiveHcp = effectiveHcpA[i];
        }
        for (var i = 0; i < teamBPlayers.length; i++) {
            teamBPlayers[i].effectiveHcp = effectiveHcpB[i];
        }
        
        // Array to store hole results (-2, -1, 0, +1, +2 per hole)
        var holeTotals = new Array(18).fill(0);
        var cumulative = new Array(18).fill(0);
        var runningTotal = 0;
        
        // For each completed hole (up to maxCompletedHole)
        for (var pos = 0; pos < maxCompletedHole; pos++) {
            // Get actual hole number from storage position
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            
            // Get gross scores for each player on this hole
            var grossScoresA = [];
            var grossScoresB = [];
            
            for (var i = 0; i < teamAPlayers.length; i++) {
                var p = teamAPlayers[i];
                var scoreKey = "1_" + actualHole + "_" + findPlayerIndex(p.name, flightPlayers);
                var gross = (flightScores[scoreKey] !== undefined) ? flightScores[scoreKey] : null;
                grossScoresA.push({ player: p, gross: gross });
            }
            
            for (var i = 0; i < teamBPlayers.length; i++) {
                var p = teamBPlayers[i];
                var scoreKey = "1_" + actualHole + "_" + findPlayerIndex(p.name, flightPlayers);
                var gross = (flightScores[scoreKey] !== undefined) ? flightScores[scoreKey] : null;
                grossScoresB.push({ player: p, gross: gross });
            }
            
            // Check if all scores exist for this hole
            var allScoresExist = true;
            for (var i = 0; i < grossScoresA.length; i++) {
                if (grossScoresA[i].gross === null) allScoresExist = false;
            }
            for (var i = 0; i < grossScoresB.length; i++) {
                if (grossScoresB[i].gross === null) allScoresExist = false;
            }
            
            if (!allScoresExist) continue;
            
            // Calculate net scores
            var netScoresA = [];
            var netScoresB = [];
            
            for (var i = 0; i < grossScoresA.length; i++) {
                var item = grossScoresA[i];
                var net = getNetScore(item.gross, item.player.effectiveHcp, actualHole, courseSi);
                netScoresA.push({ player: item.player, net: net, gross: item.gross });
            }
            
            for (var i = 0; i < grossScoresB.length; i++) {
                var item = grossScoresB[i];
                var net = getNetScore(item.gross, item.player.effectiveHcp, actualHole, courseSi);
                netScoresB.push({ player: item.player, net: net, gross: item.gross });
            }
            
            // Sort by net score (lowest to highest)
            netScoresA.sort(function(a, b) { return a.net - b.net; });
            netScoresB.sort(function(a, b) { return a.net - b.net; });
            
            // Match 1: Best A vs Best B
            var result1 = 0; // 0 = tie, 1 = A wins, -1 = B wins
            if (netScoresA[0].net < netScoresB[0].net) {
                result1 = 1;
            } else if (netScoresB[0].net < netScoresA[0].net) {
                result1 = -1;
            }
            
            // Match 2: Second A vs Second B
            var result2 = 0;
            if (netScoresA[1].net < netScoresB[1].net) {
                result2 = 1;
            } else if (netScoresB[1].net < netScoresA[1].net) {
                result2 = -1;
            }
            
            // Hole total = result1 + result2 (range -2 to +2)
            var holeTotal = result1 + result2;
            holeTotals[actualHole - 1] = holeTotal;
            
            // Update cumulative running total
            runningTotal += holeTotal;
            cumulative[actualHole - 1] = runningTotal;
        }
        
        return {
            holeTotals: holeTotals,
            cumulative: cumulative,
            finalTotal: runningTotal
        };
    }
    
    // Helper to find player index (needed for score lookup)
    function findPlayerIndex(playerName, flightPlayers) {
        for (var i = 0; i < flightPlayers.length; i++) {
            if (flightPlayers[i].name === playerName) return i;
        }
        return -1;
    }
    
    // Main calculate function
    // Parameters:
    //   allPlayers: array of all 8 players with { name, team, flight, handicap }
    //   flight1Scores: object mapping "flight_hole_playerIdx" to gross score
    //   flight2Scores: same for flight 2
    //   maxCompletedHole: number of holes completed (0-18)
    //   courseSi: array of 18 SI values
    function calculate(allPlayers, flight1Scores, flight2Scores, maxCompletedHole, courseSi) {
        // Separate players by flight
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        // Process each flight
        var flight1Result = processFlight(flight1Players, flight1Scores, courseSi, maxCompletedHole);
        var flight2Result = processFlight(flight2Players, flight2Scores, courseSi, maxCompletedHole);
        
        // Determine flight winners (after 18 holes, final total determines points)
        var flight1PointsA = 0;
        var flight1PointsB = 0;
        var flight2PointsA = 0;
        var flight2PointsB = 0;
        
        if (maxCompletedHole === 18) {
            // Flight 1 winner
            if (flight1Result.finalTotal > 0) {
                flight1PointsA = 1;
                flight1PointsB = 0;
            } else if (flight1Result.finalTotal < 0) {
                flight1PointsA = 0;
                flight1PointsB = 1;
            } else {
                flight1PointsA = 0.5;
                flight1PointsB = 0.5;
            }
            
            // Flight 2 winner
            if (flight2Result.finalTotal > 0) {
                flight2PointsA = 1;
                flight2PointsB = 0;
            } else if (flight2Result.finalTotal < 0) {
                flight2PointsA = 0;
                flight2PointsB = 1;
            } else {
                flight2PointsA = 0.5;
                flight2PointsB = 0.5;
            }
        }
        
        // For display (T-1 and T-2 rows), we need per-hole leader
        // Convert cumulative totals to "A", "AS", "B"
        var t1Display = new Array(18).fill("-");
        var t2Display = new Array(18).fill("-");
        
        for (var h = 0; h < maxCompletedHole; h++) {
            // T-1 (Flight 1)
            if (flight1Result.cumulative[h] > 0) {
                t1Display[h] = "A";
            } else if (flight1Result.cumulative[h] < 0) {
                t1Display[h] = "B";
            } else {
                t1Display[h] = "AS";
            }
            
            // T-2 (Flight 2)
            if (flight2Result.cumulative[h] > 0) {
                t2Display[h] = "A";
            } else if (flight2Result.cumulative[h] < 0) {
                t2Display[h] = "B";
            } else {
                t2Display[h] = "AS";
            }
        }
        
        // Total points for Game 2
        var teamAPoints = flight1PointsA + flight2PointsA;
        var teamBPoints = flight1PointsB + flight2PointsB;
        
        console.log("Game 2 Results - Team A:", teamAPoints, "Team B:", teamBPoints);
        console.log("Flight 1 cumulative:", flight1Result.cumulative);
        console.log("Flight 2 cumulative:", flight2Result.cumulative);
        
        return {
            teamAPoints: teamAPoints,
            teamBPoints: teamBPoints,
            t1Row: t1Display,      // Array of "A"/"AS"/"B" per hole
            t2Row: t2Display,      // Array of "A"/"AS"/"B" per hole
            t1Cumulative: flight1Result.cumulative,
            t2Cumulative: flight2Result.cumulative
        };
    }
    
    return {
        calculate: calculate,
        getStrokesForHole: getStrokesForHole,
        getNetScore: getNetScore,
        processFlight: processFlight
    };
})();