/*
FILE: js/game-match.js
VERSION: 2.02
KEY CHANGES from v2.01:
   - ADDED: calculateCrossFlightWithClinch() - NEW function that returns both match results AND clinch data
   - This eliminates duplicate sorting between game-match.js and real-game.html
   - Uses the SAME sorted player arrays for both match calculation AND clinch detection
   - Prevents index mismatch bugs that occurred when arrays were sorted differently in different places
   - Original calculateCrossFlight() preserved for backward compatibility
   - All other functions unchanged
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/

// FILE: js/game-match.js - VERSION 2.02
// Game 1: Match Play (16 points)
// Full handicap difference method
// NOW WITH integrated clinch detection in cross-flight calculation

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
    
    // Calculate ALL cross-flight matches (legacy - returns only match results)
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
    
    // ============================================================
    // NEW v2.02: calculateCrossFlightWithClinch - returns BOTH match results AND clinch data
    // This eliminates the need for duplicate sorting in real-game.html
    // ============================================================
    
    function calculateCrossFlightWithClinch(flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar, remainingHoles, currentHole, deviceId, cascadeVersion) {
        // Sort players by flight then handicap for consistent ordering
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
        
        // Store match results as an object (key: playerA_vs_playerB, value: net lead)
        var matchResultsObj = {};
        // Store match results as an array (16 values in consistent order)
        var matchResultsArray = [];
        // Store clinch updates
        var clinchedAtUpdates = {};
        
        // Loop through all cross-flight matches
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var playerA = teamAPlayers[a];
                var playerB = teamBPlayers[b];
                var key = playerA.name + "_vs_" + playerB.name;
                
                // Calculate match result
                var matchValue = getCrossMatchResult(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, startingHole, upToHole, coursePar);
                
                // Store in object
                matchResultsObj[key] = matchValue;
                matchResultsObj[playerB.name + "_vs_" + playerA.name] = -matchValue;
                
                // Store in array (consistent order for Firestore)
                matchResultsArray.push(matchValue);
                
                // Check for clinch using the SAME matchValue and SAME sorted arrays
                var clinchResult = calculateClinch(
                    matchValue, remainingHoles, playerA.name, playerB.name,
                    currentHole, deviceId, cascadeVersion
                );
                
                if (clinchResult) {
                    clinchedAtUpdates[clinchResult.matchKey] = clinchResult.clinchData;
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
    // v2.01: Smart Clinch List Functions
    // ============================================================
    
    // Calculate if a match clinches at the current hole
    // Returns: { matchKey, clinchData } or null if not clinched
    function calculateClinch(matchValue, remainingHoles, winnerName, loserName, currentHole, deviceId, cascadeVersion) {
        var lead = Math.abs(matchValue);
        if (lead > remainingHoles && matchValue !== 0) {
            // Determine winner based on matchValue sign
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
                    cascadeVersion: cascadeVersion || "2.02"
                }
            };
        }
        return null;
    }
    
    // Filter clinchedAt to keep only entries from holes BEFORE cascadeStartHole
    // This is used when cascade starts at a hole > 1
    function filterClinchedByHole(clinchedAt, cascadeStartHole) {
        if (!clinchedAt) return {};
        if (cascadeStartHole <= 1) return clinchedAt;
        
        var filtered = {};
        for (var matchKey in clinchedAt) {
            var entry = clinchedAt[matchKey];
            // Handle both old format (number) and new format (object)
            var entryHole = (typeof entry === 'number') ? entry : entry.clinchedAtHole;
            if (entryHole < cascadeStartHole) {
                filtered[matchKey] = entry;
            }
        }
        return filtered;
    }
    
    // Update clinchedAt with new clinch data (smart merge)
    // Preserves entries from holes < cascadeStartHole
    // Overwrites/adds new clinch data
    function updateClinchedAt(existingClinched, newClinchData, cascadeStartHole) {
        // Start with filtered existing (keep only entries from holes < cascadeStartHole)
        var updated = filterClinchedByHole(existingClinched, cascadeStartHole);
        
        // Add/overwrite with new clinch data
        for (var matchKey in newClinchData) {
            updated[matchKey] = newClinchData[matchKey];
        }
        
        return updated;
    }
    
    // Get clinch hole for bubble display (handles both old format and new smart format)
    function getClinchHole(clinchedAt, playerName, opponentName) {
        if (!clinchedAt) return null;
        
        var matchKey1 = playerName + "_vs_" + opponentName;
        var matchKey2 = opponentName + "_vs_" + playerName;
        
        var entry = clinchedAt[matchKey1] || clinchedAt[matchKey2];
        
        if (!entry) return null;
        
        // Old format: direct number
        if (typeof entry === 'number') return entry;
        
        // New smart format: object with clinchedAtHole property
        if (typeof entry === 'object' && entry.clinchedAtHole) return entry.clinchedAtHole;
        
        return null;
    }
    
    // Get the winner name from clinch entry (for debugging/audit)
    function getClinchWinner(clinchedAt, playerName, opponentName) {
        if (!clinchedAt) return null;
        
        var matchKey1 = playerName + "_vs_" + opponentName;
        var matchKey2 = opponentName + "_vs_" + playerName;
        
        var entry = clinchedAt[matchKey1] || clinchedAt[matchKey2];
        
        if (!entry) return null;
        if (typeof entry === 'number') return null; // Old format has no winner info
        
        return entry.winner;
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
        
        // NEW v2.02: Integrated clinch detection
        calculateCrossFlightWithClinch: calculateCrossFlightWithClinch,
        
        // v2.01: Smart Clinch List API
        calculateClinch: calculateClinch,
        filterClinchedByHole: filterClinchedByHole,
        updateClinchedAt: updateClinchedAt,
        getClinchHole: getClinchHole,
        getClinchWinner: getClinchWinner,
        
        // Legacy (backward compatible)
        calculate: calculate,
        calculatePoints: calculatePoints
    };
})();

/*
FILE: js/game-match.js
VERSION: 2.02
KEY CHANGES from v2.01:
   - ADDED: calculateCrossFlightWithClinch() - NEW function that returns both match results AND clinch data
   - This eliminates duplicate sorting between game-match.js and real-game.html
   - Uses the SAME sorted player arrays for both match calculation AND clinch detection
   - Prevents index mismatch bugs that occurred when arrays were sorted differently in different places
   - Original calculateCrossFlight() preserved for backward compatibility
   - All other functions unchanged
DEPENDS ON: None (pure calculation)
STATUS: Ready for integration
*/