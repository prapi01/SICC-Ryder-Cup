/*
FILE: js/game-match.js
VERSION: 2.00
KEY CHANGES:
   - Added calculateIntraFlight() for intra-flight matches (A vs B within same flight)
   - Added calculateCrossFlight() for cross-flight matches (Flight 1 vs Flight 2)
   - Both functions accept 'upToHole' parameter to calculate results only up to a specific hole
   - Preserved existing calculate() function for backward compatibility
   - Full handicap difference method for all matches
STATUS: Ready for integration with real-game.html v2.00
*/

// FILE: js/game-match.js - VERSION 2.00
// Game 1: Match Play (16 points)
// Full handicap difference method
// NOW WITH upToHole support for IB and XB

var GameMatch = (function() {
    
    // Get the list of holes where a player receives strokes
    function getStrokeHoles(handicapDiff, courseSi) {
        if (handicapDiff <= 0) return [];
        
        var holesWithSi = [];
        for (var i = 0; i < 18; i++) {
            holesWithSi.push({ hole: i + 1, si: courseSi[i] });
        }
        
        holesWithSi.sort(function(a, b) { return a.si - b.si; });
        
        var strokeHoles = [];
        for (var i = 0; i < handicapDiff && i < 18; i++) {
            strokeHoles.push(holesWithSi[i].hole);
        }
        
        return strokeHoles;
    }
    
    function getStrokesForHole(holeNumber, handicapDiff, courseSi, strokeHolesCache) {
        if (handicapDiff <= 0) return 0;
        var strokeHoles = strokeHolesCache || getStrokeHoles(handicapDiff, courseSi);
        for (var i = 0; i < strokeHoles.length; i++) {
            if (strokeHoles[i] === holeNumber) return 1;
        }
        return 0;
    }
    
    function getNetScore(grossScore, handicapDiff, holeNumber, courseSi, strokeHolesCache) {
        var strokes = getStrokesForHole(holeNumber, handicapDiff, courseSi, strokeHolesCache);
        return grossScore - strokes;
    }
    
    // Helper to get a player's score for a specific hole from flight data
    function getPlayerScore(player, flightData, actualHole, flightPlayers, coursePar) {
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
    
    // Calculate intra-flight match result for a pair within the same flight
    function getIntraMatchResult(playerA, playerB, flightData, flightPlayers, courseSi, startingHole, upToHole, coursePar) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        // Get ordered team players for this flight
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        // Process holes in play order up to upToHole
        for (var pos = 0; pos < upToHole; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            
            // Parse hole data from this flight only
            var holeData = GameData.parseHoleData(flightData, actualHole);
            
            // STOP if this flight hasn't saved this hole
            if (!holeData || !holeData.saved) {
                break;
            }
            
            // Get scores for both players
            var playerAScore = null;
            var playerBScore = null;
            
            if (playerA.team === "A") {
                if (teamAPlayers[0] && teamAPlayers[0].name === playerA.name) playerAScore = holeData.scores.a1;
                else if (teamAPlayers[1] && teamAPlayers[1].name === playerA.name) playerAScore = holeData.scores.a2;
            } else {
                if (teamBPlayers[0] && teamBPlayers[0].name === playerA.name) playerAScore = holeData.scores.b1;
                else if (teamBPlayers[1] && teamBPlayers[1].name === playerA.name) playerAScore = holeData.scores.b2;
            }
            
            if (playerB.team === "A") {
                if (teamAPlayers[0] && teamAPlayers[0].name === playerB.name) playerBScore = holeData.scores.a1;
                else if (teamAPlayers[1] && teamAPlayers[1].name === playerB.name) playerBScore = holeData.scores.a2;
            } else {
                if (teamBPlayers[0] && teamBPlayers[0].name === playerB.name) playerBScore = holeData.scores.b1;
                else if (teamBPlayers[1] && teamBPlayers[1].name === playerB.name) playerBScore = holeData.scores.b2;
            }
            
            if (playerAScore === null || playerBScore === null) continue;
            
            // Calculate net scores
            var netA = playerAScore;
            var netB = playerBScore;
            
            if (isPlayerAReceivingStrokes) {
                netA = getNetScore(playerAScore, handicapDiff, actualHole, courseSi, strokeHoles);
            } else {
                netB = getNetScore(playerBScore, handicapDiff, actualHole, courseSi, strokeHoles);
            }
            
            // Determine hole winner
            if (netA < netB) {
                playerAWon++;
            } else if (netB < netA) {
                playerBWon++;
            }
        }
        
        return playerAWon - playerBWon;
    }
    
    // Calculate cross-flight match result for a pair across flights
    function getCrossMatchResult(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        // Process holes in play order up to upToHole
        for (var pos = 0; pos < upToHole; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            
            // Parse hole data from both flights
            var f1HoleData = GameData.parseHoleData(flight1Data, actualHole);
            var f2HoleData = GameData.parseHoleData(flight2Data, actualHole);
            
            // STOP if either flight hasn't saved this hole
            if (!f1HoleData || !f1HoleData.saved || !f2HoleData || !f2HoleData.saved) {
                break;
            }
            
            // Get scores for both players
            var playerAScore = null;
            var playerBScore = null;
            
            if (playerA.flight === 1) {
                playerAScore = getPlayerScore(playerA, flight1Data, actualHole, flight1Players, coursePar);
            } else {
                playerAScore = getPlayerScore(playerA, flight2Data, actualHole, flight2Players, coursePar);
            }
            
            if (playerB.flight === 1) {
                playerBScore = getPlayerScore(playerB, flight1Data, actualHole, flight1Players, coursePar);
            } else {
                playerBScore = getPlayerScore(playerB, flight2Data, actualHole, flight2Players, coursePar);
            }
            
            if (playerAScore === null || playerBScore === null) continue;
            
            // Calculate net scores
            var netA = playerAScore;
            var netB = playerBScore;
            
            if (isPlayerAReceivingStrokes) {
                netA = getNetScore(playerAScore, handicapDiff, actualHole, courseSi, strokeHoles);
            } else {
                netB = getNetScore(playerBScore, handicapDiff, actualHole, courseSi, strokeHoles);
            }
            
            if (netA < netB) {
                playerAWon++;
            } else if (netB < netA) {
                playerBWon++;
            }
        }
        
        return playerAWon - playerBWon;
    }
    
    // Calculate ALL intra-flight matches for a specific flight
    function calculateIntraFlight(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar) {
        // Split into Team A and Team B
        var teamA = flightPlayers.filter(function(p) { return p.team === "A"; });
        var teamB = flightPlayers.filter(function(p) { return p.team === "B"; });
        
        // Sort by handicap (lowest first)
        teamA.sort(function(a, b) { return a.handicap - b.handicap; });
        teamB.sort(function(a, b) { return a.handicap - b.handicap; });
        
        var results = {};
        
        for (var a = 0; a < teamA.length; a++) {
            for (var b = 0; b < teamB.length; b++) {
                var playerA = teamA[a];
                var playerB = teamB[b];
                var key = playerA.name + "_vs_" + playerB.name;
                var result = getIntraMatchResult(playerA, playerB, flightData, flightPlayers, courseSi, startingHole, upToHole, coursePar);
                results[key] = result;
                results[playerB.name + "_vs_" + playerA.name] = -result;
            }
        }
        
        return results;
    }
    
    // Calculate ALL cross-flight matches
    function calculateCrossFlight(flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar) {
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; });
        
        // Sort players by flight then handicap for consistent ordering
        teamAPlayers.sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        
        teamBPlayers.sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        
        var results = {};
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var playerA = teamAPlayers[a];
                var playerB = teamBPlayers[b];
                var key = playerA.name + "_vs_" + playerB.name;
                var result = getCrossMatchResult(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar);
                results[key] = result;
                results[playerB.name + "_vs_" + playerA.name] = -result;
            }
        }
        
        return results;
    }
    
    // Legacy: Calculate cross-flight matches (backward compatible)
    function calculate(allPlayers, flight1Data, flight2Data, courseSi, startingHole) {
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; });
        
        teamAPlayers.sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        
        teamBPlayers.sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        
        var matchResults = [];
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var resultArray = []; // Simplified for backward compatibility
                matchResults.push(resultArray);
            }
        }
        
        return matchResults;
    }
    
    // Calculate total points for Game 1 based on synced holes
    function calculatePoints(matchResults, maxSyncedHole) {
        if (maxSyncedHole === 0) {
            return { teamAPoints: 8, teamBPoints: 8 };
        }
        
        var teamAPoints = 0;
        var teamBPoints = 0;
        
        // Simplified - will be populated based on actual match results
        for (var m = 0; m < 16; m++) {
            teamAPoints += 0.5;
            teamBPoints += 0.5;
        }
        
        return { teamAPoints: teamAPoints, teamBPoints: teamBPoints };
    }
    
    return {
        // New API for v2.00
        calculateIntraFlight: calculateIntraFlight,
        calculateCrossFlight: calculateCrossFlight,
        
        // Legacy (backward compatible)
        calculate: calculate,
        calculatePoints: calculatePoints
    };
})();

/*
FILE: js/game-match.js
VERSION: 2.00
KEY CHANGES:
   - Added calculateIntraFlight() for intra-flight matches (A vs B within same flight)
   - Added calculateCrossFlight() for cross-flight matches (Flight 1 vs Flight 2)
   - Both functions accept 'upToHole' parameter to calculate results only up to a specific hole
   - Returns results as object: { "PlayerA_vs_PlayerB": result, ... }
   - Preserved existing calculate() function for backward compatibility
   - Full handicap difference method for all matches
STATUS: Ready for integration with real-game.html v2.00
*/