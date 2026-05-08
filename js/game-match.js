// FILE: js/game-match.js - VERSION 1.08
// Game 1: Match Play (16 points)
// Full handicap difference method
// PROCESSES ALL 18 HOLES - stops at first 'F' in either flight

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
    
    // Get match result for a SINGLE pair across holes 1-18
    // Returns array of 18 values: "X" (1-18) or "AS" for each hole position
    function getMatchResultArray(playerA, playerB, flight1Data, flight2Data, players, courseSi, startingHole) {
        var resultArray = new Array(18).fill("0"); // "0" = not yet played / default
        
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        // Process holes in play order (storage positions 0-17)
        for (var pos = 0; pos < 18; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            
            // Parse hole data from both flights
            var f1HoleData = GameData.parseHoleData(flight1Data, actualHole);
            var f2HoleData = GameData.parseHoleData(flight2Data, actualHole);
            
            // STOP if either flight hasn't saved this hole
            if (!f1HoleData || !f1HoleData.saved || !f2HoleData || !f2HoleData.saved) {
                // For remaining holes, leave as "0" (not played)
                // For the current hole, if one flight saved but other didn't, still "0"
                break;
            }
            
            // Get scores for both players
            var playerAScore = null;
            var playerBScore = null;
            
            // Helper to get score based on player's flight and position
            function getPlayerScore(player, holeData, flightPlayers) {
                var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; });
                var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; });
                teamAPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
                teamBPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
                
                if (player.team === "A") {
                    if (teamAPlayers[0] && teamAPlayers[0].name === player.name) return holeData.scores.a1;
                    if (teamAPlayers[1] && teamAPlayers[1].name === player.name) return holeData.scores.a2;
                } else {
                    if (teamBPlayers[0] && teamBPlayers[0].name === player.name) return holeData.scores.b1;
                    if (teamBPlayers[1] && teamBPlayers[1].name === player.name) return holeData.scores.b2;
                }
                return null;
            }
            
            var flight1Players = players.filter(function(p) { return p.flight === 1; });
            var flight2Players = players.filter(function(p) { return p.flight === 2; });
            
            if (playerA.flight === 1) {
                playerAScore = getPlayerScore(playerA, f1HoleData, flight1Players);
            } else {
                playerAScore = getPlayerScore(playerA, f2HoleData, flight2Players);
            }
            
            if (playerB.flight === 1) {
                playerBScore = getPlayerScore(playerB, f1HoleData, flight1Players);
            } else {
                playerBScore = getPlayerScore(playerB, f2HoleData, flight2Players);
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
            // Tie: no change
            
            // Calculate running result: diff = playerAWon - playerBWon
            var diff = playerAWon - playerBWon;
            var resultValue;
            if (diff > 0) {
                resultValue = diff.toString();  // "1", "2", "3", etc.
            } else if (diff < 0) {
                resultValue = Math.abs(diff).toString();  // "1", "2", etc.
            } else {
                resultValue = "AS";
            }
            
            resultArray[pos] = resultValue;
        }
        
        return resultArray;
    }
    
    // Main function: returns matchResults[16][18]
    // Each cell: "X" (1-18) or "AS"
    function calculate(allPlayers, flight1Data, flight2Data, courseSi, startingHole) {
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; });
        
        var matchResults = [];
        var matchIndex = 0;
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var resultArray = getMatchResultArray(
                    teamAPlayers[a], teamBPlayers[b],
                    flight1Data, flight2Data,
                    allPlayers, courseSi, startingHole
                );
                matchResults[matchIndex] = resultArray;
                matchIndex++;
            }
        }
        
        return matchResults;  // [16][18]
    }
    
    // Calculate total points (used in controller for TR)
    function calculatePoints(matchResults, upToHole) {
        var teamAPoints = 0;
        var teamBPoints = 0;
        
        // upToHole is the number of SYNCED holes (both flights saved)
        // If upToHole = 0, return 8-8
        if (upToHole === 0) {
            return { teamAPoints: 8, teamBPoints: 8 };
        }
        
        for (var m = 0; m < matchResults.length; m++) {
            var matchResultArray = matchResults[m];
            var resultAtHole = matchResultArray[upToHole - 1];
            
            if (resultAtHole === "AS") {
                teamAPoints += 0.5;
                teamBPoints += 0.5;
            } else {
                var numValue = parseInt(resultAtHole, 10);
                if (!isNaN(numValue)) {
                    if (numValue > 0) {
                        teamAPoints += 1;  // Positive number means Team A winning
                    } else {
                        teamBPoints += 1;  // Negative would be shown as positive number with color
                    }
                } else {
                    // Fallback
                    teamAPoints += 0.5;
                    teamBPoints += 0.5;
                }
            }
        }
        
        return { teamAPoints: teamAPoints, teamBPoints: teamBPoints };
    }
    
    // Format match bubble string for UI string (Cxx format)
    function formatBubbleString(matchResults, syncedHoleCount) {
        var result = "";
        
        for (var m = 0; m < matchResults.length; m++) {
            var matchResultArray = matchResults[m];
            
            if (syncedHoleCount === 0) {
                // No holes synced - all grey AS
                result += "BAS";
                continue;
            }
            
            var resultValue = matchResultArray[syncedHoleCount - 1];
            
            if (resultValue === "AS") {
                result += "GAS";  // Green AS (tie)
            } else {
                var numVal = parseInt(resultValue, 10);
                if (!isNaN(numVal) && numVal > 0) {
                    // Team A winning
                    var padded = numVal.toString().padStart(2, ' ');
                    result += "G" + padded;
                } else {
                    // Team B winning (value is positive number but color indicates loser)
                    var absVal = parseInt(resultValue, 10);
                    var padded2 = absVal.toString().padStart(2, ' ');
                    result += "R" + padded2;
                }
            }
        }
        
        return result;
    }
    
    return {
        calculate: calculate,
        calculatePoints: calculatePoints,
        formatBubbleString: formatBubbleString,
        getMatchResultArray: getMatchResultArray
    };
})();