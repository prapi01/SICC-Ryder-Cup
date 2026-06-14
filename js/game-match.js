/*
FILE: js/game-match.js
VERSION: 2.17
KEY CHANGES from v2.16:
   - FIXED: Hole 18 special case now uses dynamic LAST HOLE based on starting hole
   - Gold bubbles now only appear on the actual last hole of the game (not hardcoded to 18)
   - For starting hole = 10, last hole = 9
   - For starting hole = 5, last hole = 4
   - For starting hole = 1, last hole = 18
   - All existing functionality preserved
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.GAME_MATCH_VERSION = "2.17";

var GameMatch = (function() {
    
    console.log("[GAME-MATCH] Initializing v2.17 with dynamic last hole for gold bubbles");
    
    // ============================================================
    // Stroke calculation helpers (unchanged)
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
    // Core match result calculations
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
    // calculateIntraFlightWithClinch
    // ============================================================
    
    function calculateIntraFlightWithClinch(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar, remainingHoles, currentHole, deviceId, cascadeVersion, existingClinched) {
        console.log(`[DEBUG-MATCH] calculateIntraFlightWithClinch: flight=${flight}, currentHole=${currentHole}, remainingHoles=${remainingHoles}, existingClinched count=${Object.keys(existingClinched || {}).length}`);
        
        var intraMatches = calculateIntraFlight(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar);
        
        var clinchedAtUpdates = {};
        
        var teamA = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        for (var a = 0; a < teamA.length; a++) {
            for (var b = 0; b < teamB.length; b++) {
                var playerA = teamA[a];
                var playerB = teamB[b];
                var matchKey1 = playerA.name + "_vs_" + playerB.name;
                var matchKey2 = playerB.name + "_vs_" + playerA.name;
                var matchValue = intraMatches[matchKey1];
                
                if (matchValue === undefined) continue;
                
                var existingClinch = null;
                if (existingClinched) {
                    existingClinch = existingClinched[matchKey1] || existingClinched[matchKey2];
                }
                
                if (existingClinch) {
                    var existingHole = existingClinch.clinchedAtHole || existingClinch;
                    console.log(`[DEBUG-MATCH] INTRA ${flight} | ${matchKey1} | lead=${Math.abs(matchValue)} | SKIPPED - already clinched at hole ${existingHole}`);
                    continue;
                }
                
                var clinchResult = calculateClinch(
                    matchValue, remainingHoles, playerA.name, playerB.name,
                    currentHole, deviceId, cascadeVersion
                );
                
                if (clinchResult) {
                    console.log(`[DEBUG-MATCH] INTRA ${flight} | ${matchKey1} | lead=${Math.abs(matchValue)} | remaining=${remainingHoles} | CLINCHED at hole ${currentHole}`);
                    clinchedAtUpdates[clinchResult.matchKey] = clinchResult.clinchData;
                }
            }
        }
        
        console.log(`[DEBUG-MATCH] calculateIntraFlightWithClinch returning ${Object.keys(clinchedAtUpdates).length} clinch updates`);
        
        return {
            intraMatches: intraMatches,
            clinchedAtUpdates: clinchedAtUpdates
        };
    }
    
    // ============================================================
    // calculateCrossFlightWithClinch
    // ============================================================
    
    function calculateCrossFlightWithClinch(flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar, remainingHoles, currentHole, deviceId, cascadeVersion, existingClinched) {
        console.log(`[DEBUG-MATCH] calculateCrossFlightWithClinch: currentHole=${currentHole}, remainingHoles=${remainingHoles}, existingClinched count=${Object.keys(existingClinched || {}).length}`);
        
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
                
                var lead = Math.abs(matchValue);
                var condition = (lead > remainingHoles && matchValue !== 0);
                console.log(`[DEBUG-MATCH] Match ${matchKey1}: value=${matchValue}, lead=${lead}, remaining=${remainingHoles}, condition=${condition}`);
                
                var existingClinch = null;
                if (existingClinched) {
                    existingClinch = existingClinched[matchKey1] || existingClinched[matchKey2];
                }
                
                if (existingClinch) {
                    var existingHole = existingClinch.clinchedAtHole || existingClinch;
                    console.log(`[DEBUG-MATCH] Match ${matchKey1} SKIPPED - already clinched at hole ${existingHole}`);
                    continue;
                }
                
                if (condition) {
                    var actualWinner = (matchValue > 0) ? playerA.name : playerB.name;
                    var actualLoser = (matchValue > 0) ? playerB.name : playerA.name;
                    var clinchData = {
                        clinchedAtHole: currentHole,
                        winner: actualWinner,
                        loser: actualLoser,
                        leadAtClinch: lead,
                        remainingHolesAtClinch: remainingHoles,
                        recordedAt: new Date().toISOString(),
                        recordedByDevice: deviceId || "unknown",
                        cascadeVersion: cascadeVersion || "2.17"
                    };
                    clinchedAtUpdates[actualWinner + "_vs_" + actualLoser] = clinchData;
                    console.log(`[DEBUG-MATCH] CLINCH CREATED: ${actualWinner}_vs_${actualLoser} at hole ${currentHole}`);
                }
            }
        }
        
        console.log(`[DEBUG-MATCH] calculateCrossFlightWithClinch returning ${Object.keys(clinchedAtUpdates).length} clinch updates`);
        
        return {
            matchResultsObj: matchResultsObj,
            matchResultsArray: matchResultsArray,
            clinchedAtUpdates: clinchedAtUpdates,
            teamAPlayers: teamAPlayers,
            teamBPlayers: teamBPlayers
        };
    }
    
    // ============================================================
    // calculateClinch
    // ============================================================
    
    function calculateClinch(matchValue, remainingHoles, winnerName, loserName, currentHole, deviceId, cascadeVersion) {
        var lead = Math.abs(matchValue);
        var condition = (lead > remainingHoles && matchValue !== 0);
        
        if (condition) {
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
                    cascadeVersion: cascadeVersion || "2.17"
                }
            };
        }
        return null;
    }
    
    // ============================================================
    // filterClinchedByHole
    // ============================================================
    
    function filterClinchedByHole(clinchedAt, cascadeStartHole) {
        console.log(`[DEBUG-MATCH] filterClinchedByHole: cascadeStartHole=${cascadeStartHole}, input count=${Object.keys(clinchedAt || {}).length}`);
        
        if (!clinchedAt) return {};
        
        var filtered = {};
        var keptCount = 0;
        var discardedCount = 0;
        
        for (var matchKey in clinchedAt) {
            var entry = clinchedAt[matchKey];
            var entryHole = (typeof entry === 'number') ? entry : entry.clinchedAtHole;
            if (entryHole < cascadeStartHole) {
                filtered[matchKey] = entry;
                keptCount++;
            } else {
                discardedCount++;
                console.log(`[DEBUG-MATCH] DISCARDED clinch ${matchKey} at hole ${entryHole} (>= ${cascadeStartHole})`);
            }
        }
        
        console.log(`[DEBUG-MATCH] filterClinchedByHole result: kept=${keptCount}, discarded=${discardedCount}`);
        
        return filtered;
    }
    
    // ============================================================
    // updateClinchedAt
    // ============================================================
    
    function updateClinchedAt(existingClinched, newClinchData, cascadeStartHole, isCascadeStartHole) {
        console.log(`[DEBUG-MATCH] updateClinchedAt: existing=${Object.keys(existingClinched || {}).length}, new=${Object.keys(newClinchData || {}).length}, cascadeStartHole=${cascadeStartHole}, isCascadeStartHole=${isCascadeStartHole}`);
        
        if (Object.keys(newClinchData || {}).length > 0) {
            console.log(`[DEBUG-MATCH] newClinchData keys:`, Object.keys(newClinchData));
        }
        
        var updated;
        
        if (isCascadeStartHole) {
            updated = filterClinchedByHole(existingClinched, cascadeStartHole);
            console.log(`[DEBUG-MATCH] Filter applied - updated count=${Object.keys(updated).length}`);
        } else {
            updated = {};
            for (var key in existingClinched) {
                updated[key] = existingClinched[key];
            }
            console.log(`[DEBUG-MATCH] No filtering - preserving ${Object.keys(updated).length} existing clinches`);
        }
        
        var newCount = 0;
        for (var matchKey in newClinchData) {
            if (!updated[matchKey]) {
                updated[matchKey] = newClinchData[matchKey];
                newCount++;
                console.log(`[DEBUG-MATCH] ADDED clinch: ${matchKey} at hole ${newClinchData[matchKey].clinchedAtHole}`);
            } else {
                console.log(`[DEBUG-MATCH] SKIPPED duplicate: ${matchKey}`);
            }
        }
        
        console.log(`[DEBUG-MATCH] updateClinchedAt result: added=${newCount}, total=${Object.keys(updated).length}`);
        
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
    // Helper: Calculate last hole based on starting hole
    // ============================================================
    function getLastHole(startingHole) {
        // If starting hole is 1, last hole is 18
        // If starting hole is 10, last hole is 9
        // If starting hole is 5, last hole is 4
        return (startingHole === 1) ? 18 : startingHole - 1;
    }
    
    // ============================================================
    // Functions moved from real-game.html
    // ============================================================
    
    function getMatchValueFromStoredResults(results, player, opponent, holeNumber, getHolePositionFunc, allPlayers) {
        if (!results) return 0;
        
        var position = getHolePositionFunc(holeNumber);
        
        if (player.flight === opponent.flight) {
            var intraMatches = (player.flight === 1) ? results.f1IntraMatches : results.f2IntraMatches;
            if (intraMatches && intraMatches[position]) {
                var matchKey = player.name + "_vs_" + opponent.name;
                var value = intraMatches[position][matchKey] || 0;
                if (Math.abs(value) > 0) {
                    console.log(`[DEBUG-MATCH] getMatchValue intra: ${player.name} vs ${opponent.name} at hole ${holeNumber} = ${value}`);
                }
                return value;
            }
            return 0;
        }
        
        if (results.matchResults && results.matchResults[position]) {
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
                var value = (player.team === "B") ? -storedValue : storedValue;
                if (Math.abs(value) > 0) {
                    console.log(`[DEBUG-MATCH] getMatchValue cross: ${player.name} vs ${opponent.name} at hole ${holeNumber} = ${value}`);
                }
                return value;
            }
        }
        return 0;
    }
    
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
    
    function getMatchDisplayValue(matchValue) {
        var absValue = Math.abs(matchValue);
        if (absValue === 0) return 'AS';
        return absValue.toString();
    }
    
    // ============================================================
    // getMatchBubbleClass - v2.17: Dynamic last hole for gold bubbles
    // ============================================================
    
    function getMatchBubbleClass(matchValue, clinchedAt, player, opponent, currentHole, isHoleSavedForFlight, lastSyncedHole, getClinchHoleFunc, startingHole) {
        var clinchHole = getClinchHoleFunc(clinchedAt, player.name, opponent.name);
        
        // First, check if match was already clinched (should be grey)
        if (clinchHole && currentHole > clinchHole) {
            return 'bubble-grey';
        }
        
        // Check for clinch on current hole
        if (clinchHole && currentHole === clinchHole) {
            if (matchValue > 0) return 'bubble-gold';
            if (matchValue < 0) return 'bubble-loss-clinch';
            return 'bubble-green';
        }
        
        // v2.17: SPECIAL CASE - Last hole of the game (based on starting hole)
        // Calculate the actual last hole dynamically
        var lastHole = getLastHole(startingHole);
        if (currentHole === lastHole && isHoleSavedForFlight && matchValue === 0) {
            console.log(`[DEBUG-MATCH] LAST HOLE ${lastHole} SAVED TIED MATCH: ${player.name} vs ${opponent.name} -> bubble-gold`);
            return 'bubble-gold';
        }
        
        // Debug logging for non-zero matches
        if (Math.abs(matchValue) > 0) {
            console.log(`[DEBUG-MATCH] getMatchBubbleClass: ${player.name} vs ${opponent.name} hole=${currentHole}, matchValue=${matchValue}, clinchHole=${clinchHole}`);
        }
        
        // Cross-flight sync check
        if (player.flight === opponent.flight) {
            if (!isHoleSavedForFlight) return 'bubble-grey';
        } else {
            var isSynced = (lastSyncedHole >= currentHole);
            if (!isSynced) return 'bubble-grey';
        }
        
        // Regular win/loss/tie logic
        if (matchValue > 0) return 'bubble-green';
        if (matchValue < 0) return 'bubble-red';
        return 'bubble-green';
    }
    
    // ============================================================
    // Legacy functions
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
        calculateIntraFlight: calculateIntraFlight,
        calculateCrossFlight: calculateCrossFlight,
        calculateCrossFlightWithClinch: calculateCrossFlightWithClinch,
        calculateIntraFlightWithClinch: calculateIntraFlightWithClinch,
        calculateClinch: calculateClinch,
        filterClinchedByHole: filterClinchedByHole,
        updateClinchedAt: updateClinchedAt,
        getClinchHole: getClinchHole,
        getClinchWinner: getClinchWinner,
        getMatchValueFromStoredResults: getMatchValueFromStoredResults,
        getAllOpponents: getAllOpponents,
        getMatchDisplayValue: getMatchDisplayValue,
        getMatchBubbleClass: getMatchBubbleClass,
        calculate: calculate,
        calculatePoints: calculatePoints,
        // v2.17: Expose getLastHole for debugging
        getLastHole: getLastHole
    };
})();

// Re-expose version for console debugging
window.GAME_MATCH_VERSION = "2.17";

/*
FILE: js/game-match.js
VERSION: 2.17
KEY CHANGES from v2.16:
   - FIXED: Hole 18 special case now uses dynamic LAST HOLE based on starting hole
   - Gold bubbles now only appear on the actual last hole of the game (not hardcoded to 18)
   - For starting hole = 10, last hole = 9
   - For starting hole = 5, last hole = 4
   - For starting hole = 1, last hole = 18
   - All existing functionality preserved
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/