// FILE: js/game-match.js - VERSION 1.07
// Game 1: Match Play (16 points)
// Full handicap difference method
// ADDED: Detailed match result logging for debugging

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
    
    function getMatchResult(playerA, playerB, scores, savedHoles, allPlayers, upToHole, courseSi) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var higherHandicapPlayer = (playerA.handicap > playerB.handicap) ? playerA : playerB;
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var holesCompleted = 0;
        var playerAWon = 0;
        var playerBWon = 0;
        
        var holeResults = [];
        
        for (var hole = 1; hole <= upToHole; hole++) {
            var playerAScore = null;
            var playerBScore = null;
            
            for (var flight = 1; flight <= 2; flight++) {
                var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
                
                for (var i = 0; i < flightPlayers.length; i++) {
                    var p = flightPlayers[i];
                    if (p.name === playerA.name) {
                        var key = flight + "_" + hole + "_" + i;
                        if (scores[key] !== undefined && scores[key] !== null) {
                            playerAScore = scores[key];
                        }
                    }
                    if (p.name === playerB.name) {
                        var key2 = flight + "_" + hole + "_" + i;
                        if (scores[key2] !== undefined && scores[key2] !== null) {
                            playerBScore = scores[key2];
                        }
                    }
                }
            }
            
            if (playerAScore === null || playerBScore === null) continue;
            
            holesCompleted++;
            
            var netA = playerAScore;
            var netB = playerBScore;
            
            if (isPlayerAReceivingStrokes) {
                netA = getNetScore(playerAScore, handicapDiff, hole, courseSi, strokeHoles);
            } else {
                netB = getNetScore(playerBScore, handicapDiff, hole, courseSi, strokeHoles);
            }
            
            var holeWinner = "";
            if (netA < netB) {
                playerAWon++;
                holeWinner = "A";
            } else if (netB < netA) {
                playerBWon++;
                holeWinner = "B";
            } else {
                holeWinner = "AS";
            }
            
            holeResults.push({ hole: hole, netA: netA, netB: netB, grossA: playerAScore, grossB: playerBScore, strokes: handicapDiff, winner: holeWinner });
        }
        
        if (holesCompleted === 0) {
            return "⏳";
        }
        
        var diff = playerAWon - playerBWon;
        var result;
        if (diff > 0) {
            result = "+" + diff;
        } else if (diff < 0) {
            result = "" + diff;
        } else {
            result = "AS";
        }
        
        // Detailed logging for debugging
        console.log("=== MATCH RESULT ===");
        console.log(playerA.name, "(HCP", playerA.handicap, ") vs", playerB.name, "(HCP", playerB.handicap, ")");
        console.log("Handicap difference:", handicapDiff, "-", higherHandicapPlayer.name, "receives strokes");
        console.log("Stroke holes:", strokeHoles);
        console.log("Hole results:", holeResults);
        console.log("Final result:", result, "(A won:", playerAWon, "B won:", playerBWon, "holes:", holesCompleted, ")");
        console.log("==================");
        
        return result;
    }
    
    function getPoints(allPlayers, allScores, savedHolesPerFlight, upToHole, courseSi) {
        var teamAPoints = 0;
        var teamBPoints = 0;
        var totalMatches = 0;
        
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; });
        
        console.log("=== GAME 1 POINTS CALCULATION ===");
        console.log("upToHole:", upToHole);
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                totalMatches++;
                var playerA = teamAPlayers[a];
                var playerB = teamBPlayers[b];
                
                var result = getMatchResult(playerA, playerB, allScores, savedHolesPerFlight, allPlayers, upToHole, courseSi);
                
                if (result === "⏳") {
                    teamAPoints += 0.5;
                    teamBPoints += 0.5;
                    console.log(playerA.name, "vs", playerB.name, "→", result, "(0.5 each)");
                } else if (result.indexOf("+") === 0) {
                    teamAPoints += 1;
                    console.log(playerA.name, "vs", playerB.name, "→", result, "(1 point to Team A)");
                } else if (result.indexOf("-") === 0) {
                    teamBPoints += 1;
                    console.log(playerA.name, "vs", playerB.name, "→", result, "(1 point to Team B)");
                } else if (result === "AS") {
                    teamAPoints += 0.5;
                    teamBPoints += 0.5;
                    console.log(playerA.name, "vs", playerB.name, "→ AS (0.5 each)");
                }
            }
        }
        
        console.log("TOTAL - Team A:", teamAPoints, "Team B:", teamBPoints);
        console.log("================================");
        
        return {
            teamAPoints: teamAPoints,
            teamBPoints: teamBPoints
        };
    }
    
    return {
        getPoints: getPoints,
        getMatchResult: getMatchResult,
        getNetScore: getNetScore,
        getStrokesForHole: getStrokesForHole,
        getStrokeHoles: getStrokeHoles
    };
})();