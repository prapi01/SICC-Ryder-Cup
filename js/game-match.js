/*
FILE: js/game-match.js
VERSION: 2.25
KEY CHANGES from v2.24:
   - ADDED: Detailed debug logging for intra-flight calculation flow
   - Logs: calculateIntraFlightWithClinch() entry with flight, hole, holesPlayed, remainingHoles
   - Logs: Each match result with player names, net scores, match result
   - Logs: Cumulative lead calculation before and after each hole
   - Logs: Clinch detection with lead vs remaining holes comparison
   - Logs: calculateCrossFlightWithClinch() entry with hole, holesPlayed
   - Logs: Each cross-flight match result
   - Logs: getMatchBubbleClass() with matchValue, clinchHole, currentPlayPosition
   - All existing functionality preserved from v2.24
DEPENDS ON: GameData, GameOrder
STATUS: Debug version - ready for testing
*/

// Version exposure for console debugging
window.GAME_MATCH_VERSION = "2.25";

var GameMatch = (function() {
    
    console.log("[GAME-MATCH] Initializing v2.25 - DETAILED DEBUG LOGGING ENABLED");
    console.log("[GAME-MATCH] ===================================================");
    console.log("[GAME-MATCH] Debug logs will trace intra-flight and cross-flight calculations");
    console.log("[GAME-MATCH] Including: player scores, net scores, match results, clinch detection");
    console.log("[GAME-MATCH] ===================================================");
    
    // ============================================================
    // Helper: Get last hole based on starting hole
    // v2.24: Delegates to GameOrder
    // ============================================================
    function getLastHole(startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getLastHole) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getLastHole();
        }
        if (typeof GameData !== 'undefined' && GameData.getLastHole) {
            return GameData.getLastHole(startingHole);
        }
        return (startingHole === 1) ? 18 : startingHole - 1;
    }
    
    // ============================================================
    // v2.24: Delegate to GameOrder for play order conversions
    // ============================================================
    
    function getPlayOrder(startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayOrder) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getPlayOrder();
        }
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    function getPlayPosition(holeNumber, startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayPosition) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getPlayPosition(holeNumber);
        }
        var playOrder = getPlayOrder(startingHole);
        var pos = playOrder.indexOf(holeNumber);
        return pos !== -1 ? pos : holeNumber - 1;
    }
    
    function getNaturalHole(playPosition, startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getNaturalHole) {
            if (GameOrder.getStartingHole && GameOrder.getStartingHole() !== startingHole) {
                GameOrder.setStartingHole(startingHole);
            }
            return GameOrder.getNaturalHole(playPosition);
        }
        var playOrder = getPlayOrder(startingHole);
        return playOrder[playPosition] || 0;
    }
    
    // ============================================================
    // Stroke calculation helpers
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
    // Core match result calculations with DEBUG LOGGING
    // ============================================================
    
    function getIntraMatchResult(playerA, playerB, flightData, flightPlayers, courseSi, startingHole, upToHole, coursePar) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceivingStrokes = (playerA.handicap > playerB.handicap);
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var playerAWon = 0;
        var playerBWon = 0;
        
        console.log(`[DEBUG-INTRA-CORE] Match: ${playerA.name} vs ${playerB.name}, upToHole=${upToHole}`);
        
        for (var pos = 0; pos < upToHole; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            var holeData = GameData.parseHoleData(flightData, actualHole);
            
            if (!holeData || !holeData.saved) {
                console.log(`[DEBUG-INTRA-CORE]   Hole ${actualHole}: NOT SAVED - stopping`);
                break;
            }
            
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
            
            if (playerAScore === null || playerBScore === null) {
                console.log(`[DEBUG-INTRA-CORE]   Hole ${actualHole}: Missing score - skipping`);
                continue;
            }
            
            var netA = playerAScore;
            var netB = playerBScore;
            
            if (isPlayerAReceivingStrokes) {
                netA = getNetScore(playerAScore, handicapDiff, actualHole, courseSi, strokeHoles);
            } else {
                netB = getNetScore(playerBScore, handicapDiff, actualHole, courseSi, strokeHoles);
            }
            
            var holeResult = 0;
            if (netA < netB) {
                playerAWon++;
                holeResult = 1;
            } else if (netB < netA) {
                playerBWon++;
                holeResult = -1;
            }
            
            console.log(`[DEBUG-INTRA-CORE]   Hole ${actualHole}: ${playerA.name} ${netA} vs ${playerB.name} ${netB} -> ${holeResult > 0 ? playerA.name : holeResult < 0 ? playerB.name : 'TIE'} wins hole`);
        }
        
        var result = playerAWon - playerBWon;
        console.log(`[DEBUG-INTRA-CORE]   RESULT: ${playerA.name} ${result > 0 ? 'WINS' : result < 0 ? 'LOSS' : 'TIE'} by ${Math.abs(result)} holes`);
        return result;
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
    // v2.25: calculateIntraFlightWithClinch with DEBUG LOGGING
    // ============================================================
    
    function calculateIntraFlightWithClinch(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar, remainingHoles, currentHole, deviceId, cascadeVersion, existingClinched) {
        console.log(`[DEBUG-INTRA] =========================================`);
        console.log(`[DEBUG-INTRA] Flight ${flight} INTRA-FLIGHT CALCULATION`);
        console.log(`[DEBUG-INTRA] currentHole=${currentHole}, upToHole=${upToHole}, remainingHoles=${remainingHoles}`);
        console.log(`[DEBUG-INTRA] existingClinched count: ${Object.keys(existingClinched || {}).length}`);
        console.log(`[DEBUG-INTRA] =========================================`);
        
        var intraMatches = calculateIntraFlight(flight, flightPlayers, flightData, courseSi, startingHole, upToHole, coursePar);
        
        console.log(`[DEBUG-INTRA] Intra matches calculated: ${Object.keys(intraMatches).length} entries`);
        
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
                
                var lead = Math.abs(matchValue);
                var condition = (lead > remainingHoles && matchValue !== 0);
                
                console.log(`[DEBUG-INTRA] Match ${matchKey1}: lead=${lead}, remaining=${remainingHoles}, condition=${condition}`);
                
                var existingClinch = null;
                if (existingClinched) {
                    existingClinch = existingClinched[matchKey1] || existingClinched[matchKey2];
                }
                
                if (existingClinch) {
                    var existingHole = existingClinch.clinchedAtHole || existingClinch;
                    console.log(`[DEBUG-INTRA]   SKIPPED - already clinched at hole ${existingHole}`);
                    continue;
                }
                
                if (condition) {
                    console.log(`[DEBUG-INTRA]   *** CLINCH DETECTED! ***`);
                    var clinchResult = calculateClinch(
                        matchValue, remainingHoles, playerA.name, playerB.name,
                        currentHole, deviceId, cascadeVersion
                    );
                    
                    if (clinchResult) {
                        console.log(`[DEBUG-INTRA]   Clinch data: ${clinchResult.matchKey} at hole ${currentHole}`);
                        clinchedAtUpdates[clinchResult.matchKey] = clinchResult.clinchData;
                    }
                }
            }
        }
        
        console.log(`[DEBUG-INTRA] Clinch updates: ${Object.keys(clinchedAtUpdates).length}`);
        console.log(`[DEBUG-INTRA] =========================================`);
        
        return {
            intraMatches: intraMatches,
            clinchedAtUpdates: clinchedAtUpdates
        };
    }
    
    // ============================================================
    // v2.25: calculateCrossFlightWithClinch with DEBUG LOGGING
    // ============================================================
    
    function calculateCrossFlightWithClinch(flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar, remainingHoles, currentHole, deviceId, cascadeVersion, existingClinched) {
        console.log(`[DEBUG-CROSS] =========================================`);
        console.log(`[DEBUG-CROSS] CROSS-FLIGHT CALCULATION`);
        console.log(`[DEBUG-CROSS] currentHole=${currentHole}, upToHole=${upToHole}, remainingHoles=${remainingHoles}`);
        console.log(`[DEBUG-CROSS] existingClinched count: ${Object.keys(existingClinched || {}).length}`);
        console.log(`[DEBUG-CROSS] =========================================`);
        
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
        var matchCount = 0;
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var playerA = teamAPlayers[a];
                var playerB = teamBPlayers[b];
                var key = playerA.name + "_vs_" + playerB.name;
                
                console.log(`[DEBUG-CROSS] Match ${matchCount+1}: ${key}`);
                
                var matchValue = getCrossMatchResult(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar);
                
                matchResultsObj[key] = matchValue;
                matchResultsObj[playerB.name + "_vs_" + playerA.name] = -matchValue;
                matchResultsArray.push(matchValue);
                
                console.log(`[DEBUG-CROSS]   Result: ${matchValue}`);
                
                var matchKey1 = playerA.name + "_vs_" + playerB.name;
                var matchKey2 = playerB.name + "_vs_" + playerA.name;
                
                var lead = Math.abs(matchValue);
                var condition = (lead > remainingHoles && matchValue !== 0);
                console.log(`[DEBUG-CROSS]   lead=${lead}, remaining=${remainingHoles}, condition=${condition}`);
                
                var existingClinch = null;
                if (existingClinched) {
                    existingClinch = existingClinched[matchKey1] || existingClinched[matchKey2];
                }
                
                if (existingClinch) {
                    var existingHole = existingClinch.clinchedAtHole || existingClinch;
                    console.log(`[DEBUG-CROSS]   SKIPPED - already clinched at hole ${existingHole}`);
                    matchCount++;
                    continue;
                }
                
                if (condition) {
                    console.log(`[DEBUG-CROSS]   *** CLINCH DETECTED! ***`);
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
                        cascadeVersion: cascadeVersion || "2.25"
                    };
                    clinchedAtUpdates[actualWinner + "_vs_" + actualLoser] = clinchData;
                    console.log(`[DEBUG-CROSS]   Clinch data: ${actualWinner}_vs_${actualLoser} at hole ${currentHole}`);
                }
                matchCount++;
            }
        }
        
        console.log(`[DEBUG-CROSS] Cross matches: ${matchResultsArray.length} values`);
        console.log(`[DEBUG-CROSS] Clinch updates: ${Object.keys(clinchedAtUpdates).length}`);
        console.log(`[DEBUG-CROSS] =========================================`);
        
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
                    cascadeVersion: cascadeVersion || "2.25"
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
        console.log(`[DEBUG-MATCH] updateClinchedAt: existing=${Object.keys(existingClinched || {}).length}, new=${Object.keys(newClinchData || {}).length}`);
        
        var updated;
        
        if (isCascadeStartHole) {
            updated = filterClinchedByHole(existingClinched, cascadeStartHole);
        } else {
            updated = {};
            for (var key in existingClinched) {
                updated[key] = existingClinched[key];
            }
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
    // v2.25: getMatchBubbleClass with DEBUG LOGGING
    // ============================================================
    
    function getMatchBubbleClass(matchValue, clinchedAt, player, opponent, currentHole, isHoleSavedForFlight, lastSyncedValue, getClinchHoleFunc, startingHole) {
        var clinchHole = getClinchHoleFunc(clinchedAt, player.name, opponent.name);
        
        var currentPlayPosition = getPlayPosition(currentHole, startingHole);
        var clinchPlayPosition = (clinchHole !== null) ? getPlayPosition(clinchHole, startingHole) : null;
        
        var isCrossFlight = (player.flight !== opponent.flight);
        var logPrefix = isCrossFlight ? '[DEBUG-BUBBLE-CROSS]' : '[DEBUG-BUBBLE-INTRA]';
        
        // Only log if matchValue is non-zero or we're at a clinch hole
        if (Math.abs(matchValue) > 0 || clinchPlayPosition !== null) {
            console.log(`${logPrefix} ${player.label} vs ${opponent.label}: matchValue=${matchValue}, currentPos=${currentPlayPosition}, clinchPos=${clinchPlayPosition}, lastSynced=${lastSyncedValue}`);
        }
        
        if (clinchPlayPosition !== null && currentPlayPosition > clinchPlayPosition) {
            console.log(`${logPrefix}   -> GREY (match already clinched)`);
            return 'bubble-grey';
        }
        
        if (clinchPlayPosition !== null && currentPlayPosition === clinchPlayPosition) {
            if (matchValue > 0) {
                console.log(`${logPrefix}   -> GOLD (WIN clinched)`);
                return 'bubble-gold';
            }
            if (matchValue < 0) {
                console.log(`${logPrefix}   -> LOSS-CLINCH (LOSS clinched)`);
                return 'bubble-loss-clinch';
            }
            console.log(`${logPrefix}   -> GREEN (tie at clinch)`);
            return 'bubble-green';
        }
        
        var lastHole = getLastHole(startingHole);
        var lastHolePlayPosition = getPlayPosition(lastHole, startingHole);
        if (currentPlayPosition === lastHolePlayPosition && isHoleSavedForFlight && matchValue === 0) {
            console.log(`${logPrefix}   -> GOLD (last hole tie)`);
            return 'bubble-gold';
        }
        
        if (player.flight === opponent.flight) {
            if (!isHoleSavedForFlight) {
                console.log(`${logPrefix}   -> GREY (hole not saved for flight)`);
                return 'bubble-grey';
            }
        } else {
            var isSynced = (lastSyncedValue >= currentPlayPosition);
            if (!isSynced) {
                console.log(`${logPrefix}   -> GREY (not synced: ${lastSyncedValue} < ${currentPlayPosition})`);
                return 'bubble-grey';
            }
        }
        
        if (matchValue > 0) {
            console.log(`${logPrefix}   -> GREEN (winning)`);
            return 'bubble-green';
        }
        if (matchValue < 0) {
            console.log(`${logPrefix}   -> RED (losing)`);
            return 'bubble-red';
        }
        console.log(`${logPrefix}   -> GREEN (tie)`);
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
        getLastHole: getLastHole,
        getPlayPosition: getPlayPosition,
        getNaturalHole: getNaturalHole,
        getPlayOrder: getPlayOrder
    };
})();

// Re-expose version for console debugging
window.GAME_MATCH_VERSION = "2.25";

/*
FILE: js/game-match.js
VERSION: 2.25
KEY CHANGES from v2.24:
   - ADDED: Detailed debug logging for intra-flight calculation flow
   - Logs: calculateIntraFlightWithClinch() entry with flight, hole, holesPlayed, remainingHoles
   - Logs: Each match result with player names, net scores, match result
   - Logs: Cumulative lead calculation before and after each hole
   - Logs: Clinch detection with lead vs remaining holes comparison
   - Logs: calculateCrossFlightWithClinch() entry with hole, holesPlayed
   - Logs: Each cross-flight match result
   - Logs: getMatchBubbleClass() with matchValue, clinchHole, currentPlayPosition
   - All existing functionality preserved from v2.24
DEPENDS ON: GameData, GameOrder
STATUS: Debug version - ready for testing
*/