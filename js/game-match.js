// js/game-match.js
// Game 1: Match Play (16 points)
// Version 1.04 - Safety checks and console logging

var GameMatch = (function() {
    
    function getPlayerIndex(players, playerName) {
        if (!players || !playerName) return -1;
        for (var i = 0; i < players.length; i++) {
            if (players[i].name === playerName) return i;
        }
        return -1;
    }
    
    function isHoleSaved(savedHoles, flight, hole) {
        if (!savedHoles) return false;
        if (!savedHoles[flight]) return false;
        return savedHoles[flight].indexOf(hole) !== -1;
    }
    
    function getMatchResult(playerA, playerB, scores, savedHoles, players, upToHole) {
        if (!playerA || !playerB || !scores || !savedHoles || !players) {
            console.warn("getMatchResult: Missing data");
            return "⏳";
        }
        
        var aWins = 0, bWins = 0;
        var aIdx = getPlayerIndex(players, playerA.name);
        var bIdx = getPlayerIndex(players, playerB.name);
        
        if (aIdx === -1 || bIdx === -1) {
            console.warn("getMatchResult: Player not found", playerA.name, playerB.name);
            return "⏳";
        }
        
        console.log("=== getMatchResult ===");
        console.log("Player A:", playerA.name, "Flight:", playerA.flight);
        console.log("Player B:", playerB.name, "Flight:", playerB.flight);
        console.log("Up to hole:", upToHole);
        
        for (var hole = 1; hole <= upToHole; hole++) {
            if (isHoleSaved(savedHoles, playerA.flight, hole) && isHoleSaved(savedHoles, playerB.flight, hole)) {
                var aScore = scores[playerA.flight + "_" + hole + "_" + aIdx];
                var bScore = scores[playerB.flight + "_" + hole + "_" + bIdx];
                
                console.log("Hole " + hole + ": A=" + aScore + ", B=" + bScore);
                
                if (aScore !== undefined && bScore !== undefined) {
                    if (aScore < bScore) {
                        aWins++;
                        console.log("  -> A wins hole " + hole);
                    } else if (bScore < aScore) {
                        bWins++;
                        console.log("  -> B wins hole " + hole);
                    } else {
                        console.log("  -> Tie hole " + hole);
                    }
                }
            } else {
                console.log("Hole " + hole + ": Not saved yet");
            }
        }
        
        var diff = aWins - bWins;
        console.log("Final: A wins=" + aWins + ", B wins=" + bWins + ", Diff=" + diff);
        
        if (diff > 0) return "+" + diff;
        if (diff < 0) return "" + diff;
        if (aWins === 0 && bWins === 0) return "⏳";
        return "AS";
    }
    
    function getPoints(players, scores, savedHoles, upToHole) {
        if (!players || !scores || !savedHoles) {
            console.error("getPoints: Missing required data");
            return { teamAPoints: 8, teamBPoints: 8 };
        }
        
        console.log("========================================");
        console.log("=== GameMatch.getPoints() CALLED ===");
        console.log("Up to hole:", upToHole);
        console.log("Saved Holes Flight 1:", savedHoles[1] ? JSON.stringify(savedHoles[1]) : "none");
        console.log("Saved Holes Flight 2:", savedHoles[2] ? JSON.stringify(savedHoles[2]) : "none");
        console.log("========================================");
        
        var teamA = players.filter(function(p) { return p.team === "A"; });
        var teamB = players.filter(function(p) { return p.team === "B"; });
        var teamAPoints = 0;
        var teamBPoints = 0;
        var totalCompletedMatches = 0;
        
        console.log("Team A players:", teamA.map(function(p) { return p.name; }));
        console.log("Team B players:", teamB.map(function(p) { return p.name; }));
        
        for (var a = 0; a < teamA.length; a++) {
            for (var b = 0; b < teamB.length; b++) {
                var aWins = 0, bWins = 0;
                var aIdx = getPlayerIndex(players, teamA[a].name);
                var bIdx = getPlayerIndex(players, teamB[b].name);
                var matchesCompleted = false;
                
                if (aIdx === -1 || bIdx === -1) {
                    console.warn("Skipping match - player not found:", teamA[a].name, teamB[b].name);
                    continue;
                }
                
                console.log("--- Match: " + teamA[a].name + " (F" + teamA[a].flight + ") vs " + teamB[b].name + " (F" + teamB[b].flight + ") ---");
                
                for (var hole = 1; hole <= upToHole; hole++) {
                    if (isHoleSaved(savedHoles, teamA[a].flight, hole) && isHoleSaved(savedHoles, teamB[b].flight, hole)) {
                        matchesCompleted = true;
                        var aScore = scores[teamA[a].flight + "_" + hole + "_" + aIdx];
                        var bScore = scores[teamB[b].flight + "_" + hole + "_" + bIdx];
                        
                        console.log("  Hole " + hole + ": " + teamA[a].name + "=" + aScore + ", " + teamB[b].name + "=" + bScore);
                        
                        if (aScore !== undefined && bScore !== undefined) {
                            if (aScore < bScore) {
                                aWins++;
                                console.log("    -> " + teamA[a].name + " wins this hole");
                            } else if (bScore < aScore) {
                                bWins++;
                                console.log("    -> " + teamB[b].name + " wins this hole");
                            } else {
                                console.log("    -> Tie on this hole");
                            }
                        }
                    }
                }
                
                if (matchesCompleted) {
                    totalCompletedMatches++;
                    console.log("  Match COMPLETED. Final: " + teamA[a].name + " " + aWins + " - " + bWins + " " + teamB[b].name);
                    if (aWins > bWins) {
                        teamAPoints += 1;
                        console.log("  RESULT: +1 point for Team A");
                    } else if (bWins > aWins) {
                        teamBPoints += 1;
                        console.log("  RESULT: +1 point for Team B");
                    } else {
                        teamAPoints += 0.5;
                        teamBPoints += 0.5;
                        console.log("  RESULT: +0.5 point for each team");
                    }
                } else {
                    console.log("  Match NOT completed yet");
                }
            }
        }
        
        console.log("--- SUMMARY ---");
        console.log("Total completed matches:", totalCompletedMatches, "out of 16");
        console.log("Points from completed matches - Team A:", teamAPoints, "Team B:", teamBPoints);
        
        if (totalCompletedMatches === 0) {
            console.log("No matches completed - returning 8-8");
            console.log("========================================");
            return { teamAPoints: 8, teamBPoints: 8 };
        }
        
        var incompleteMatches = 16 - totalCompletedMatches;
        teamAPoints += incompleteMatches * 0.5;
        teamBPoints += incompleteMatches * 0.5;
        
        console.log("Add 0.5 for each incomplete match (" + incompleteMatches + " matches)");
        console.log("FINAL RESULT - Team A:", teamAPoints, "Team B:", teamBPoints);
        console.log("========================================");
        
        return { teamAPoints: teamAPoints, teamBPoints: teamBPoints };
    }
    
    return {
        getMatchResult: getMatchResult,
        getPoints: getPoints
    };
})();