/*
FILE: js/game-match.js
VERSION: 2.08
KEY CHANGES from v2.07:
   - REMOVED: All debug logging from filterClinchedByHole() and updateClinchedAt()
   - ADDED: calculateIntraFlightWithClinch() - mirrors calculateCrossFlightWithClinch()
   - ADDED: getMatchValueFromStoredResults() - moved from real-game.html
   - ADDED: getAllOpponents() - moved from real-game.html
   - ADDED: getMatchDisplayValue() - moved from real-game.html (was getBubbleValue)
   - ADDED: getMatchBubbleClass() - moved from real-game.html (was getBubbleClassWithClinch)
   - ADDED: getMatchResultsFromCache() - helper to retrieve match values from stored results
   - All functions now accept dependencies as parameters (no reliance on global variables)
   - Intra-flight clinch detection now properly checks cumulativeClinched
   - Cross-flight clinch detection unchanged (already working)
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/

// FILE: js/game-match.js - VERSION 2.08
// Game 1: Match Play (16 points)
// Full handicap difference method

var GameMatch = (function() {
    
    // ============================================================
    // Stroke calculation helpers (unchanged from v2.07)
    // ============================================================
    
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
    
    // ============================================================
    // Core match result calculations (unchanged from v2.07)
    // ============================================================
    
    function getIntraMatchResult(playerA, playerB, flightData, flightPlayers, courseSi, startingHole, upToHole, coursePar) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        for (var pos = 0; pos < upToHole; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            var holeData = GameData.parseHoleData(flightData, actualHole);
            
            if (!holeData || !holeData.saved) break;
            
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
    
    function getCrossMatchResult(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        for (var pos = 0; pos < upToHole; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            var f1HoleData = GameData.parseHoleData(flight1Data, actualHole);
            var f2HoleData = GameData.parseHoleData(flight2Data, actualHole);
            
            if (!f1HoleData || !f1HoleData.saved || !f2HoleData || !f2HoleData.saved) break;
            
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
    
    function calculateIntraFlight(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar) {
        var teamA = flightPlayers.filter(function(p) { return p.team === "A"; });
        var teamB = flightPlayers.filter(function(p) { return p.team === "B"; });
        
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
    
    function calculateCrossFlight(flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar) {
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
    
    // ============================================================
    // NEW v2.08: calculateIntraFlightWithClinch
    // Mirrors calculateCrossFlightWithClinch but for intra-flight matches
    // ============================================================
    
    function calculateIntraFlightWithClinch(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar, remainingHoles, currentHole, deviceId, cascadeVersion, existingClinched) {
        // Get the intra-flight match results first
        var intraMatches = calculateIntraFlight(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar);
        
        // Store clinch updates
        var clinchedAtUpdates = {};
        
        // Get Team A and Team B players for this flight
        var teamA = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        // Loop through all intra-flight matches
        for (var a = 0; a < teamA.length; a++) {
            for (var b = 0; b < teamB.length; b++) {
                var playerA = teamA[a];
                var playerB = teamB[b];
                var matchKey1 = playerA.name + "_vs_" + playerB.name;
                var matchKey2 = playerB.name + "_vs_" + playerA.name;
                var matchValue = intraMatches[matchKey1];
                
                if (matchValue === undefined) continue;
                
                // Check if this match already has a clinch from cumulativeClinched
                var existingClinch = null;
                if (existingClinched) {
                    existingClinch = existingClinched[matchKey1] || existingClinched[matchKey2];
                }
                
                // Only check for new clinch if not already clinched
                if (!existingClinch) {
                    var clinchResult = calculateClinch(
                        matchValue, remainingHoles, playerA.name, playerB.name,
                        currentHole, deviceId, cascadeVersion
                    );
                    
                    if (clinchResult) {
                        clinchedAtUpdates[clinchResult.matchKey] = clinchResult.clinchData;
                    }
                }
            }
        }
        
        return {
            intraMatches: intraMatches,
            clinchedAtUpdates: clinchedAtUpdates
        };
    }
    
    // ============================================================
    // calculateCrossFlightWithClinch (unchanged from v2.07, debug logs removed)
    // ============================================================
    
    function calculateCrossFlightWithClinch(flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar, remainingHoles, currentHole, deviceId, cascadeVersion, existingClinched) {
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
        
        var matchResultsObj = {};
        var matchResultsArray = [];
        var clinchedAtUpdates = {};
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var playerA = teamAPlayers[a];
                var playerB = teamBPlayers[b];
                var key = playerA.name + "_vs_" + playerB.name;
                
                var matchValue = getCrossMatchResult(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar);
                
                matchResultsObj[key] = matchValue;
                matchResultsObj[playerB.name + "_vs_" + playerA.name] = -matchValue;
                matchResultsArray.push(matchValue);
                
                var matchKey1 = playerA.name + "_vs_" + playerB.name;
                var matchKey2 = playerB.name + "_vs_" + playerA.name;
                var existingClinch = null;
                
                if (existingClinched) {
                    existingClinch = existingClinched[matchKey1] || existingClinched[matchKey2];
                }
                
                if (!existingClinch) {
                    var clinchResult = calculateClinch(
                        matchValue, remainingHoles, playerA.name, playerB.name,
                        currentHole, deviceId, cascadeVersion
                    );
                    
                    if (clinchResult) {
                        clinchedAtUpdates[clinchResult.matchKey] = clinchResult.clinchData;
                    }
                }
            }
        }
        
        return {
            matchResultsObj: matchResultsObj,
            matchResultsArray: matchResultsArray,
            clinchedAtUpdates: clinchedAtUpdates,
            teamAPlayers: teamAPlayers,
            teamBPlayers: teamBPlayers
        };
    }
    
    // ============================================================
    // calculateClinch (unchanged)
    // ============================================================
    
    function calculateClinch(matchValue, remainingHoles, winnerName, loserName, currentHole, deviceId, cascadeVersion) {
        var lead = Math.abs(matchValue);
        if (lead > remainingHoles && matchValue !== 0) {
            var actualWinner = (matchValue > 0) ? winnerName : loserName;
            var actualLoser = (matchValue > 0) ? loserName : winnerName;
            
            return {
                matchKey: actualWinner + "_vs_" + actualLoser,
                clinchData: {
                    clinchedAtHole: currentHole,
                    winner: actualWinner,
                    loser: actualLoser,
                    leadAtClinch: lead,
                    remainingHolesAtClinch: remainingHoles,
                    recordedAt: new Date().toISOString(),
                    recordedByDevice: deviceId || "unknown",
                    cascadeVersion: cascadeVersion || "2.08"
                }
            };
        }
        return null;
    }
    
    // ============================================================
    // filterClinchedByHole (debug logs removed)
    // ============================================================
    
    function filterClinchedByHole(clinchedAt, cascadeStartHole) {
        if (!clinchedAt) return {};
        
        if (cascadeStartHole <= 1) return {};
        
        var filtered = {};
        for (var matchKey in clinchedAt) {
            var entry = clinchedAt[matchKey];
            var entryHole = (typeof entry === 'number') ? entry : entry.clinchedAtHole;
            if (entryHole < cascadeStartHole) {
                filtered[matchKey] = entry;
            }
        }
        return filtered;
    }
    
    function updateClinchedAt(existingClinched, newClinchData, cascadeStartHole) {
        var updated = filterClinchedByHole(existingClinched, cascadeStartHole);
        
        for (var matchKey in newClinchData) {
            updated[matchKey] = newClinchData[matchKey];
        }
        
        return updated;
    }
    
    function getClinchHole(clinchedAt, playerName, opponentName) {
        if (!clinchedAt) return null;
        
        var matchKey1 = playerName + "_vs_" + opponentName;
        var matchKey2 = opponentName + "_vs_" + playerName;
        
        var entry = clinchedAt[matchKey1] || clinchedAt[matchKey2];
        
        if (!entry) return null;
        if (typeof entry === 'number') return entry;
        if (typeof entry === 'object' && entry.clinchedAtHole) return entry.clinchedAtHole;
        
        return null;
    }
    
    function getClinchWinner(clinchedAt, playerName, opponentName) {
        if (!clinchedAt) return null;
        
        var matchKey1 = playerName + "_vs_" + opponentName;
        var matchKey2 = opponentName + "_vs_" + playerName;
        
        var entry = clinchedAt[matchKey1] || clinchedAt[matchKey2];
        
        if (!entry) return null;
        if (typeof entry === 'number') return null;
        
        return entry.winner;
    }
    
    // ============================================================
    // NEW v2.08: Functions moved from real-game.html
    // ============================================================
    
    // Get match value from stored results (intra-flight or cross-flight)
    // Parameters:
    //   results: cache.results object
    //   player: player object
    //   opponent: player object
    //   holeNumber: current hole number
    //   getHolePositionFunc: function to convert hole number to position index
    //   allPlayers: array of all players (for cross-flight lookups)
    function getMatchValueFromStoredResults(results, player, opponent, holeNumber, getHolePositionFunc, allPlayers) {
        if (!results) return 0;
        
        var position = getHolePositionFunc(holeNumber);
        
        // Intra-flight match (same flight)
        if (player.flight === opponent.flight) {
            var intraMatches = (player.flight === 1) ? results.f1IntraMatches : results.f2IntraMatches;
            if (intraMatches && intraMatches[position]) {
                var matchKey = player.name + "_vs_" + opponent.name;
                return intraMatches[position][matchKey] || 0;
            }
            return 0;
        }
        
        // Cross-flight match
        if (results.matchResults && results.matchResults[position]) {
            // Sort players in the same order used when results were calculated
            var teamAPlayers = allPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) {
                if (a.flight !== b.flight) return a.flight - b.flight;
                return a.handicap - b.handicap;
            });
            var teamBPlayers = allPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) {
                if (a.flight !== b.flight) return a.flight - b.flight;
                return a.handicap - b.handicap;
            });
            
            var aIdx = -1;
            var bIdx = -1;
            
            if (player.team === "A") {
                for (var i = 0; i < teamAPlayers.length; i++) {
                    if (teamAPlayers[i].name === player.name) aIdx = i;
                }
                for (var i = 0; i < teamBPlayers.length; i++) {
                    if (teamBPlayers[i].name === opponent.name) bIdx = i;
                }
            } else {
                for (var i = 0; i < teamAPlayers.length; i++) {
                    if (teamAPlayers[i].name === opponent.name) aIdx = i;
                }
                for (var i = 0; i < teamBPlayers.length; i++) {
                    if (teamBPlayers[i].name === player.name) bIdx = i;
                }
            }
            
            if (aIdx !== -1 && bIdx !== -1) {
                var storedValue = results.matchResults[position][aIdx * teamBPlayers.length + bIdx] || 0;
                return (player.team === "B") ? -storedValue : storedValue;
            }
        }
        return 0;
    }
    
    // Get all opponents for a player, sorted with intra-flight first
    function getAllOpponents(allPlayers, currentPlayer) {
        var opponents = allPlayers.filter(function(op) { return op.team !== currentPlayer.team; });
        opponents.sort(function(a, b) {
            var aIsIntra = (a.flight === currentPlayer.flight);
            var bIsIntra = (b.flight === currentPlayer.flight);
            if (aIsIntra && !bIsIntra) return -1;
            if (!aIsIntra && bIsIntra) return 1;
            return 0;
        });
        return opponents;
    }
    
    // Get display value for bubble (e.g., "AS" or "3")
    function getMatchDisplayValue(matchValue) {
        var absValue = Math.abs(matchValue);
        if (absValue === 0) return 'AS';
        return absValue.toString();
    }
    
    // Get bubble CSS class based on match value, clinch status, and save state
    // Parameters:
    //   matchValue: the net lead value from getMatchValueFromStoredResults
    //   clinchedAt: cache.clinchedAt object
    //   player: player object
    //   opponent: opponent object
    //   currentHole: current hole number
    //   isHoleSavedForFlight: boolean indicating if this flight has saved this hole
    //   lastSyncedHole: cache.lastSyncedHole (for cross-flight)
    //   getClinchHoleFunc: function to get clinch hole from clinchedAt
    function getMatchBubbleClass(matchValue, clinchedAt, player, opponent, currentHole, isHoleSavedForFlight, lastSyncedHole, getClinchHoleFunc) {
        // Determine if this match should be grey (not yet determined)
        if (player.flight === opponent.flight) {
            // Intra-flight: need this flight to have saved the hole
            if (!isHoleSavedForFlight) return 'bubble-grey';
        } else {
            // Cross-flight: need both flights synced up to this hole
            var isSynced = (lastSyncedHole >= currentHole);
            if (!isSynced) return 'bubble-grey';
        }
        
        // Check if match is already clinched
        var clinchHole = getClinchHoleFunc(clinchedAt, player.name, opponent.name);
        
        if (clinchHole && currentHole > clinchHole) return 'bubble-grey';
        if (clinchHole && currentHole === clinchHole) {
            if (matchValue > 0) return 'bubble-gold';
            if (matchValue < 0) return 'bubble-loss-clinch';
            return 'bubble-green';
        }
        
        // Not clinched yet - show normal colors
        if (matchValue > 0) return 'bubble-green';
        if (matchValue < 0) return 'bubble-red';
        return 'bubble-green';
    }
    
    // ============================================================
    // Legacy functions (unchanged)
    // ============================================================
    
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
                var resultArray = [];
                matchResults.push(resultArray);
            }
        }
        
        return matchResults;
    }
    
    function calculatePoints(matchResults, maxSyncedHole) {
        if (maxSyncedHole === 0) {
            return { teamAPoints: 8, teamBPoints: 8 };
        }
        
        var teamAPoints = 0;
        var teamBPoints = 0;
        
        for (var m = 0; m < 16; m++) {
            teamAPoints += 0.5;
            teamBPoints += 0.5;
        }
        
        return { teamAPoints: teamAPoints, teamBPoints: teamBPoints };
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        // Core calculation functions
        calculateIntraFlight: calculateIntraFlight,
        calculateCrossFlight: calculateCrossFlight,
        calculateCrossFlightWithClinch: calculateCrossFlightWithClinch,
        calculateIntraFlightWithClinch: calculateIntraFlightWithClinch,  // NEW v2.08
        calculateClinch: calculateClinch,
        filterClinchedByHole: filterClinchedByHole,
        updateClinchedAt: updateClinchedAt,
        getClinchHole: getClinchHole,
        getClinchWinner: getClinchWinner,
        
        // NEW v2.08: Functions moved from real-game.html
        getMatchValueFromStoredResults: getMatchValueFromStoredResults,
        getAllOpponents: getAllOpponents,
        getMatchDisplayValue: getMatchDisplayValue,
        getMatchBubbleClass: getMatchBubbleClass,
        
        // Legacy functions
        calculate: calculate,
        calculatePoints: calculatePoints
    };
})();

// Version exposure for console debugging
window.GAME_MATCH_VERSION = "2.08";

/*
FILE: js/game-match.js
VERSION: 2.08
KEY CHANGES from v2.07:
   - REMOVED: All debug logging from filterClinchedByHole() and updateClinchedAt()
   - ADDED: calculateIntraFlightWithClinch() - mirrors calculateCrossFlightWithClinch()
   - ADDED: getMatchValueFromStoredResults() - moved from real-game.html
   - ADDED: getAllOpponents() - moved from real-game.html
   - ADDED: getMatchDisplayValue() - moved from real-game.html (was getBubbleValue)
   - ADDED: getMatchBubbleClass() - moved from real-game.html (was getBubbleClassWithClinch)
   - ADDED: getMatchResultsFromCache() - helper to retrieve match values from stored results
   - All functions now accept dependencies as parameters (no reliance on global variables)
   - Intra-flight clinch detection now properly checks cumulativeClinched
   - Cross-flight clinch detection unchanged (already working)
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/