/*
FILE: js/game-team.js
VERSION: 1.02
KEY CHANGES:
   - Accepts teamGameFormat parameter ("tournament" or "relative")
   - Tournament method: uses raw handicaps directly
   - Relative method: zero-rise (subtract lowest handicap in flight)
   - Returns t1Row[18] and t2Row[18] as arrays of "A"/"B"/"0"
   - Process ALL 18 holes, stops at first 'F' in flight data
STATUS: Complete. Ready for integration.
*/

// FILE: js/game-team.js - VERSION 1.02
// Game 2: Team Game (2 points)
// Supports both Tournament Handicap and Relative Handicap (zero-rise)
// PROCESSES ALL 18 HOLES - stops at first 'F' in either flight

var GameTeam = (function() {
    
    // Get strokes for a player on a specific hole based on effective handicap
    function getStrokesForHole(effectiveHcp, holeNumber, courseSi) {
        if (effectiveHcp <= 0) return 0;
        var holeSi = courseSi[holeNumber - 1];
        return (holeSi <= effectiveHcp) ? 1 : 0;
    }
    
    // Calculate net score for a player
    function getNetScore(grossScore, effectiveHcp, holeNumber, courseSi) {
        var strokes = getStrokesForHole(effectiveHcp, holeNumber, courseSi);
        return grossScore - strokes;
    }
    
    // Calculate effective handicaps based on format
    function getEffectiveHandicaps(players, teamGameFormat) {
        if (teamGameFormat === "tournament") {
            // Tournament Handicap: use raw handicaps directly
            return players.map(function(p) { return p.handicap; });
        } else {
            // Relative Handicap (Zero-rise)
            var rawHcps = players.map(function(p) { return p.handicap; });
            var lowest = Math.min.apply(null, rawHcps);
            return players.map(function(p) { return p.handicap - lowest; });
        }
    }
    
    // Process a single flight across ALL 18 holes
    // Returns: { cumulativeDisplay: array of 18 values ("A"/"B"/"0"), cumulativePoints: array of numbers }
    function processFlight(flightPlayers, flightData, courseSi, startingHole, teamGameFormat) {
        // Separate by team
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; });
        
        // Sort by handicap (lowest to highest) - this determines who is A1/A2, B1/B2
        teamAPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        teamBPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        // Get effective handicaps for all players in this flight
        var allFlightPlayers = teamAPlayers.concat(teamBPlayers);
        var effectiveHcps = getEffectiveHandicaps(allFlightPlayers, teamGameFormat);
        
        // Map back to players
        for (var i = 0; i < allFlightPlayers.length; i++) {
            allFlightPlayers[i].effectiveHcp = effectiveHcps[i];
        }
        
        // Re-split with effective handicaps
        var teamAEff = teamAPlayers.map(function(p) { return p.effectiveHcp; });
        var teamBEff = teamBPlayers.map(function(p) { return p.effectiveHcp; });
        
        // Arrays for results
        var cumulativeDisplay = new Array(18).fill("0");
        var cumulativePoints = new Array(18).fill(0);
        var runningTotal = 0;
        
        // Process holes in play order
        for (var pos = 0; pos < 18; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            var holeData = GameData.parseHoleData(flightData, actualHole);
            
            // STOP if this hole is not saved
            if (!holeData || !holeData.saved) {
                break;
            }
            
            // Get gross scores for each player
            var grossA = [holeData.scores.a1, holeData.scores.a2];
            var grossB = [holeData.scores.b1, holeData.scores.b2];
            
            // Calculate net scores
            var netA = [];
            var netB = [];
            
            for (var i = 0; i < 2; i++) {
                netA.push(getNetScore(grossA[i], teamAEff[i], actualHole, courseSi));
                netB.push(getNetScore(grossB[i], teamBEff[i], actualHole, courseSi));
            }
            
            // Sort net scores (lowest to highest)
            netA.sort(function(a, b) { return a - b; });
            netB.sort(function(a, b) { return a - b; });
            
            // Match 1: Best A vs Best B
            var result1 = 0;
            if (netA[0] < netB[0]) result1 = 1;
            else if (netB[0] < netA[0]) result1 = -1;
            
            // Match 2: Second A vs Second B
            var result2 = 0;
            if (netA[1] < netB[1]) result2 = 1;
            else if (netB[1] < netA[1]) result2 = -1;
            
            // Hole total from Team A perspective
            var holeTotal = result1 + result2;
            runningTotal += holeTotal;
            cumulativePoints[pos] = runningTotal;
            
            // Determine display value
            if (runningTotal > 0) {
                cumulativeDisplay[pos] = "A";
            } else if (runningTotal < 0) {
                cumulativeDisplay[pos] = "B";
            } else {
                cumulativeDisplay[pos] = "0";
            }
        }
        
        return {
            cumulativeDisplay: cumulativeDisplay,
            cumulativePoints: cumulativePoints,
            finalTotal: runningTotal
        };
    }
    
    // Main calculate function - returns t1Row[18] and t2Row[18]
    function calculate(allPlayers, flight1Data, flight2Data, courseSi, startingHole, teamGameFormat) {
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        var flight1Result = processFlight(flight1Players, flight1Data, courseSi, startingHole, teamGameFormat);
        var flight2Result = processFlight(flight2Players, flight2Data, courseSi, startingHole, teamGameFormat);
        
        // T-1 row: format for UI string - "A"/"B"/"0"
        var t1Row = flight1Result.cumulativeDisplay;
        var t2Row = flight2Result.cumulativeDisplay;
        
        return {
            t1Row: t1Row,
            t2Row: t2Row,
            flight1Cumulative: flight1Result.cumulativePoints,
            flight2Cumulative: flight2Result.cumulativePoints
        };
    }
    
    // Calculate points for Game 2 based on final cumulative totals
    function calculatePoints(flight1Cumulative, flight2Cumulative, maxSyncedHole) {
        if (maxSyncedHole === 0) {
            return { teamAPoints: 1, teamBPoints: 1 };
        }
        
        if (maxSyncedHole < 18) {
            // Not complete - Game 2 points only awarded after 18 holes
            return { teamAPoints: 0, teamBPoints: 0 };
        }
        
        var flight1Total = flight1Cumulative[17] || 0;
        var flight2Total = flight2Cumulative[17] || 0;
        
        var flight1PointsA = 0, flight1PointsB = 0;
        var flight2PointsA = 0, flight2PointsB = 0;
        
        if (flight1Total > 0) { flight1PointsA = 1; flight1PointsB = 0; }
        else if (flight1Total < 0) { flight1PointsA = 0; flight1PointsB = 1; }
        else { flight1PointsA = 0.5; flight1PointsB = 0.5; }
        
        if (flight2Total > 0) { flight2PointsA = 1; flight2PointsB = 0; }
        else if (flight2Total < 0) { flight2PointsA = 0; flight2PointsB = 1; }
        else { flight2PointsA = 0.5; flight2PointsB = 0.5; }
        
        return {
            teamAPoints: flight1PointsA + flight2PointsA,
            teamBPoints: flight1PointsB + flight2PointsB
        };
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
        processFlight: processFlight
    };
})();

/*
FILE: js/game-team.js
VERSION: 1.02
KEY CHANGES:
   - Accepts teamGameFormat parameter ("tournament" or "relative")
   - Tournament method: uses raw handicaps directly
   - Relative method: zero-rise (subtract lowest handicap in flight)
   - Returns t1Row[18] and t2Row[18] as arrays of "A"/"B"/"0"
   - Process ALL 18 holes, stops at first 'F' in flight data
STATUS: Complete. Ready for integration.
*/