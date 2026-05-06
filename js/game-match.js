// FILE: js/game-match.js - VERSION 1.05
// Game 1: Match Play (16 points)
// Updated: Uses net scores (gross - strokes received based on SI)

var GameMatch = (function() {
    
    // Calculate strokes a player receives on a specific hole
    // Player gets 1 stroke on holes where SI <= player.handicap
    function getStrokesForHole(holeNumber, playerHandicap, courseSi) {
        if (!courseSi || playerHandicap <= 0) return 0;
        var holeSi = courseSi[holeNumber - 1];
        return (holeSi <= playerHandicap) ? 1 : 0;
    }
    
    // Calculate net score for a player on a specific hole
    function getNetScore(player, grossScore, holeNumber, courseSi) {
        var strokes = getStrokesForHole(holeNumber, player.handicap, courseSi);
        return grossScore - strokes;
    }
    
    // Get match result between two players up to a certain hole
    // Returns: "+X" (winning by X holes), "-X" (losing by X holes), "AS" (tie), "⏳" (not started)
    function getMatchResult(playerA, playerB, scores, savedHoles, allPlayers, upToHole, courseSi) {
        var holesCompleted = 0;
        var playerAWon = 0;
        var playerBWon = 0;
        
        // Determine which holes are completed for both players
        for (var hole = 1; hole <= upToHole; hole++) {
            // Check if both players have saved scores for this hole
            var playerAHasScore = false;
            var playerBHasScore = false;
            
            for (var flight = 1; flight <= 2; flight++) {
                var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
                
                for (var i = 0; i < flightPlayers.length; i++) {
                    var p = flightPlayers[i];
                    if (p.name === playerA.name) {
                        var key = flight + "_" + hole + "_" + i;
                        if (scores[key] !== undefined && scores[key] !== null) {
                            playerAHasScore = true;
                        }
                    }
                    if (p.name === playerB.name) {
                        var key2 = flight + "_" + hole + "_" + i;
                        if (scores[key2] !== undefined && scores[key2] !== null) {
                            playerBHasScore = true;
                        }
                    }
                }
            }
            
            if (!playerAHasScore || !playerBHasScore) continue;
            
            holesCompleted++;
            
            // Get gross scores
            var scoreA = null;
            var scoreB = null;
            
            for (var flight = 1; flight <= 2; flight++) {
                var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
                
                for (var i = 0; i < flightPlayers.length; i++) {
                    var p = flightPlayers[i];
                    if (p.name === playerA.name) {
                        var key = flight + "_" + hole + "_" + i;
                        scoreA = scores[key];
                    }
                    if (p.name === playerB.name) {
                        var key2 = flight + "_" + hole + "_" + i;
                        scoreB = scores[key2];
                    }
                }
            }
            
            if (scoreA === null || scoreB === null) continue;
            
            // Calculate net scores with handicaps
            var netA = getNetScore(playerA, scoreA, hole, courseSi);
            var netB = getNetScore(playerB, scoreB, hole, courseSi);
            
            if (netA < netB) {
                playerAWon++;
            } else if (netB < netA) {
                playerBWon++;
            }
            // Tie: no change
        }
        
        if (holesCompleted === 0) {
            return "⏳";
        }
        
        var diff = playerAWon - playerBWon;
        if (diff > 0) {
            return "+" + diff;
        } else if (diff < 0) {
            return "" + diff;
        } else {
            return "AS";
        }
    }
    
    // Calculate total points for all matches
    function getPoints(allPlayers, allScores, savedHolesPerFlight, upToHole, courseSi) {
        var teamAPoints = 0;
        var teamBPoints = 0;
        var totalMatches = 0;
        
        // Get all Team A players and Team B players
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; });
        
        // For each Team A vs Team B match
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                totalMatches++;
                var playerA = teamAPlayers[a];
                var playerB = teamBPlayers[b];
                
                var result = getMatchResult(playerA, playerB, allScores, savedHolesPerFlight, allPlayers, upToHole, courseSi);
                
                // Points based on match result
                if (result === "⏳") {
                    // Not started yet - 0.5 points each
                    teamAPoints += 0.5;
                    teamBPoints += 0.5;
                } else if (result.indexOf("+") === 0) {
                    // Player A is winning (or won) - 1 point to Team A
                    teamAPoints += 1;
                } else if (result.indexOf("-") === 0) {
                    // Player B is winning (or won) - 1 point to Team B
                    teamBPoints += 1;
                } else if (result === "AS") {
                    // All square - 0.5 points each
                    teamAPoints += 0.5;
                    teamBPoints += 0.5;
                }
            }
        }
        
        console.log("Match Play Results - Team A:", teamAPoints, "Team B:", teamBPoints);
        
        return {
            teamAPoints: teamAPoints,
            teamBPoints: teamBPoints
        };
    }
    
    return {
        getPoints: getPoints,
        getMatchResult: getMatchResult,
        getNetScore: getNetScore,
        getStrokesForHole: getStrokesForHole
    };
})();