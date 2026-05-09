/*
FILE: js/game-match.js
VERSION: 1.09
KEY CHANGES:
   - Added calculateIntraFlight() for intra-flight matches (A vs B within same flight)
   - Added calculateAllMatches() that returns both cross and intra results
   - Preserved existing calculate() function for backward compatibility
   - Intra-flight matches: 4 per flight (2 Team A × 2 Team B) = 8 total intra matches
   - Cross-flight matches: 16 matches (4 Team A × 4 Team B across flights)
   - Full handicap difference method for all matches
STATUS: Ready for integration
*/

// FILE: js/game-match.js - VERSION 1.09
// Game 1: Match Play (16 points)
// Full handicap difference method
// NOW INCLUDES intra-flight calculations

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
    function getPlayerScore(player, flightData, actualHole, flightPlayers) {
        var holeData = GameData.parseHoleData(flightData, actualHole);
        if (!holeData || !holeData.saved) return null;
        
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
    
    // Get match result array for a SINGLE pair across holes 1-18 (cross-flight)
    function getMatchResultArray(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, startingHole) {
        var resultArray = new Array(18).fill("0");
        
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        // Process holes in play order (storage positions 0-17)
        for (var pos = 0; pos < 18; pos++) {
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
                playerAScore = getPlayerScore(playerA, flight1Data, actualHole, flight1Players);
            } else {
                playerAScore = getPlayerScore(playerA, flight2Data, actualHole, flight2Players);
            }
            
            if (playerB.flight === 1) {
                playerBScore = getPlayerScore(playerB, flight1Data, actualHole, flight1Players);
            } else {
                playerBScore = getPlayerScore(playerB, flight2Data, actualHole, flight2Players);
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
                resultValue = diff.toString();
            } else if (diff < 0) {
                resultValue = Math.abs(diff).toString();
            } else {
                resultValue = "AS";
            }
            
            resultArray[pos] = resultValue;
        }
        
        return resultArray;
    }
    
    // Get intra-flight match result array for players in the SAME flight
    function getIntraMatchResultArray(playerA, playerB, flightData, flightPlayers, courseSi, startingHole) {
        var resultArray = new Array(18).fill("0");
        
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        // Get ordered team players for this flight
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        // Process holes in play order (storage positions 0-17)
        for (var pos = 0; pos < 18; pos++) {
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
            
            // Calculate running result
            var diff = playerAWon - playerBWon;
            var resultValue;
            if (diff > 0) {
                resultValue = diff.toString();
            } else if (diff < 0) {
                resultValue = Math.abs(diff).toString();
            } else {
                resultValue = "AS";
            }
            
            resultArray[pos] = resultValue;
        }
        
        return resultArray;
    }
    
    // Calculate cross-flight matches (Team A vs Team B across both flights)
    function calculate(allPlayers, flight1Data, flight2Data, courseSi, startingHole) {
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
        
        var matchResults = [];
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var resultArray = getMatchResultArray(
                    teamAPlayers[a], teamBPlayers[b],
                    flight1Data, flight2Data,
                    allPlayers, courseSi, startingHole
                );
                matchResults.push(resultArray);
            }
        }
        
        return matchResults;
    }
    
    // Calculate intra-flight matches for a specific flight
    function calculateIntraFlight(flight, flightPlayers, flightData, courseSi, startingHole) {
        // Split into Team A and Team B
        var teamA = flightPlayers.filter(function(p) { return p.team === "A"; });
        var teamB = flightPlayers.filter(function(p) { return p.team === "B"; });
        
        // Sort by handicap (lowest first)
        teamA.sort(function(a, b) { return a.handicap - b.handicap; });
        teamB.sort(function(a, b) { return a.handicap - b.handicap; });
        
        var matchResults = [];
        
        for (var a = 0; a < teamA.length; a++) {
            for (var b = 0; b < teamB.length; b++) {
                var resultArray = getIntraMatchResultArray(
                    teamA[a], teamB[b],
                    flightData, flightPlayers,
                    courseSi, startingHole
                );
                matchResults.push(resultArray);
            }
        }
        
        return matchResults;
    }
    
    // Calculate ALL matches (cross + intra for both flights)
    function calculateAllMatches(allPlayers, flight1Data, flight2Data, courseSi, startingHole) {
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        return {
            crossFlight: calculate(allPlayers, flight1Data, flight2Data, courseSi, startingHole),
            intraFlight1: calculateIntraFlight(1, flight1Players, flight1Data, courseSi, startingHole),
            intraFlight2: calculateIntraFlight(2, flight2Players, flight2Data, courseSi, startingHole)
        };
    }
    
    // Calculate total points for Game 1 based on synced holes
    function calculatePoints(matchResults, maxSyncedHole) {
        if (maxSyncedHole === 0) {
            return { teamAPoints: 8, teamBPoints: 8 };
        }
        
        var teamAPoints = 0;
        var teamBPoints = 0;
        
        for (var m = 0; m < matchResults.length; m++) {
            var matchResultArray = matchResults[m];
            var resultAtHole = matchResultArray[maxSyncedHole - 1];
            
            if (resultAtHole === "AS") {
                teamAPoints += 0.5;
                teamBPoints += 0.5;
            } else {
                var numValue = parseInt(resultAtHole, 10);
                if (!isNaN(numValue)) {
                    if (numValue > 0) {
                        teamAPoints += 1;
                    } else {
                        teamBPoints += 1;
                    }
                } else {
                    teamAPoints += 0.5;
                    teamBPoints += 0.5;
                }
            }
        }
        
        return { teamAPoints: teamAPoints, teamBPoints: teamBPoints };
    }
    
    // Format match bubbles for UI string (Cxx format)
    function formatBubbleString(matchResults, maxSyncedHole, flightPerspective) {
        var result = "";
        
        for (var m = 0; m < matchResults.length; m++) {
            var matchArray = matchResults[m];
            
            if (maxSyncedHole === 0) {
                result += "BAS";
                continue;
            }
            
            var value = matchArray[maxSyncedHole - 1];
            
            if (value === "AS") {
                result += "GAS";
            } else {
                var numVal = parseInt(value, 10);
                if (!isNaN(numVal)) {
                    if (flightPerspective === "f1") {
                        if (numVal > 0) {
                            var padded = numVal.toString().padStart(2, ' ');
                            result += "G" + padded;
                        } else {
                            var absVal = Math.abs(numVal);
                            var padded2 = absVal.toString().padStart(2, ' ');
                            result += "R" + padded2;
                        }
                    } else {
                        // F2 perspective: inverted
                        if (numVal < 0) {
                            var padded = Math.abs(numVal).toString().padStart(2, ' ');
                            result += "G" + padded;
                        } else if (numVal > 0) {
                            var padded2 = numVal.toString().padStart(2, ' ');
                            result += "R" + padded2;
                        } else {
                            result += "G0";
                        }
                    }
                } else {
                    result += "BAS";
                }
            }
        }
        
        return result;
    }
    
    return {
        // Existing functions (backward compatible)
        calculate: calculate,
        calculatePoints: calculatePoints,
        formatBubbleString: formatBubbleString,
        getMatchResultArray: getMatchResultArray,
        
        // New functions
        calculateIntraFlight: calculateIntraFlight,
        calculateAllMatches: calculateAllMatches
    };
})();

/*
FILE: js/game-match.js
VERSION: 1.09
KEY CHANGES:
   - Added calculateIntraFlight() for intra-flight matches (A vs B within same flight)
   - Added calculateAllMatches() that returns both cross and intra results
   - Preserved existing calculate() function for backward compatibility
   - Intra-flight matches: 4 per flight (2 Team A × 2 Team B) = 8 total intra matches
   - Cross-flight matches: 16 matches (4 Team A × 4 Team B across flights)
   - Full handicap difference method for all matches
STATUS: Ready for integration
*/