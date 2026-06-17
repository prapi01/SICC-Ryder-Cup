/*
FILE: js/game-team.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - ADDED: Detailed debug logging for team game calculation flow
   - Logs: calculate() entry with startingHole, teamGameFormat, player count
   - Logs: Each hole position with hole number, f1Available, f2Available
   - Logs: Flight 1 match results: best vs best, second vs second with net scores
   - Logs: Flight 2 match results: best vs best, second vs second with net scores
   - Logs: Cumulative running totals after each hole (runningFlight1, runningFlight2)
   - Logs: Display values (t1Display, t2Display) and points awarded
   - Logs: calculateWithClinched() clinch detection for each position
   - All existing functionality preserved from v1.12
DEPENDS ON: GameData, GameOrder, courseSi, teamGameFormat
STATUS: Debug version - ready for testing
*/

// Version exposure for console debugging
window.GAME_TEAM_VERSION = "1.13";

var GameTeam = (function() {
    
    console.log("[GAME-TEAM] Initializing v1.13 - DETAILED DEBUG LOGGING ENABLED");
    console.log("[GAME-TEAM] ===================================================");
    console.log("[GAME-TEAM] Debug logs will trace team game (T-1, T-2) calculations");
    console.log("[GAME-TEAM] Including: per-flight zero-rise, match results, cumulative totals");
    console.log("[GAME-TEAM] ===================================================");
    
    // ============================================================
    // v1.12: Delegate to GameOrder for play order
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
    
    // ============================================================
    // v1.11: Calculate minimum handicap for a specific flight
    // ============================================================
    function calculateMinHandicapForFlight(players, flight) {
        var flightPlayers = players.filter(function(p) { return p.flight === flight; });
        if (!flightPlayers || flightPlayers.length === 0) return 0;
        var min = flightPlayers[0].handicap;
        for (var i = 1; i < flightPlayers.length; i++) {
            if (flightPlayers[i].handicap < min) {
                min = flightPlayers[i].handicap;
            }
        }
        return min;
    }
    
    // ============================================================
    // Legacy: Calculate minimum handicap across all players
    // ============================================================
    function calculateMinHandicap(players) {
        if (!players || players.length === 0) return 0;
        var min = players[0].handicap;
        for (var i = 1; i < players.length; i++) {
            if (players[i].handicap < min) {
                min = players[i].handicap;
            }
        }
        return min;
    }
    
    // ============================================================
    // Get net score based on team game format
    // v1.11: minHandicap now passed as flight-specific value for relative mode
    // ============================================================
    function getNetScoreWithFormat(gross, playerHandicap, si, teamGameFormat, minHandicap) {
        var effectiveHandicap;
        
        if (teamGameFormat === "tournament") {
            effectiveHandicap = playerHandicap;
        } else {
            effectiveHandicap = playerHandicap - minHandicap;
        }
        
        var strokes = 0;
        if (effectiveHandicap > 0 && si <= effectiveHandicap) {
            strokes = 1;
        }
        return gross - strokes;
    }

    // ============================================================
    // Helper: Sort players by net score (lowest = best)
    // v1.11: minHandicap passed as flight-specific value
    // ============================================================
    function sortPlayersByNetScore(players, grossScores, si, teamGameFormat, minHandicap, courseSi) {
        var playersWithNet = [];
        for (var i = 0; i < players.length; i++) {
            var netScore = getNetScoreWithFormat(grossScores[i], players[i].handicap, si, teamGameFormat, minHandicap);
            playersWithNet.push({
                player: players[i],
                netScore: netScore,
                grossScore: grossScores[i]
            });
        }
        playersWithNet.sort(function(a, b) {
            if (a.netScore < b.netScore) return -1;
            if (a.netScore > b.netScore) return 1;
            return 0;
        });
        return playersWithNet;
    }
    
    // ============================================================
    // Helper: Build intra-flight match results object for a flight on a specific hole
    // v1.11: minHandicap passed as flight-specific value
    // ============================================================
    function buildIntraMatchResults(teamAPlayers, teamBPlayers, teamAGross, teamBGross, si, teamGameFormat, minHandicap, courseSi) {
        var results = {};
        
        var teamANets = [];
        var teamBNets = [];
        
        for (var i = 0; i < teamAPlayers.length; i++) {
            var netA = getNetScoreWithFormat(teamAGross[i], teamAPlayers[i].handicap, si, teamGameFormat, minHandicap);
            teamANets.push({ player: teamAPlayers[i], net: netA, gross: teamAGross[i] });
        }
        for (var i = 0; i < teamBPlayers.length; i++) {
            var netB = getNetScoreWithFormat(teamBGross[i], teamBPlayers[i].handicap, si, teamGameFormat, minHandicap);
            teamBNets.push({ player: teamBPlayers[i], net: netB, gross: teamBGross[i] });
        }
        
        teamANets.sort(function(a, b) { return a.net - b.net; });
        teamBNets.sort(function(a, b) { return a.net - b.net; });
        
        for (var i = 0; i < teamANets.length && i < teamBNets.length; i++) {
            var playerA = teamANets[i].player;
            var playerB = teamBNets[i].player;
            var netA = teamANets[i].net;
            var netB = teamBNets[i].net;
            
            var matchResult = 0;
            if (netA < netB) {
                matchResult = 1;
            } else if (netA > netB) {
                matchResult = -1;
            }
            
            var keyA = playerA.name + "_vs_" + playerB.name;
            var keyB = playerB.name + "_vs_" + playerA.name;
            results[keyA] = matchResult;
            results[keyB] = -matchResult;
        }
        
        return results;
    }

    // ============================================================
    // v1.13: Main calculate function with DEBUG LOGGING
    // ============================================================
    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat) {
        console.log(`[DEBUG-TEAM] =========================================`);
        console.log(`[DEBUG-TEAM] TEAM GAME CALCULATION START`);
        console.log(`[DEBUG-TEAM] startingHole=${startingHole}, teamGameFormat=${teamGameFormat}`);
        console.log(`[DEBUG-TEAM] allPlayers count: ${allPlayers.length}`);
        console.log(`[DEBUG-TEAM] =========================================`);
        
        var minHandicapFlight1 = calculateMinHandicapForFlight(allPlayers, 1);
        var minHandicapFlight2 = calculateMinHandicapForFlight(allPlayers, 2);
        console.log(`[DEBUG-TEAM] minHandicapFlight1=${minHandicapFlight1}, minHandicapFlight2=${minHandicapFlight2}`);
        
        var cumulativeFlight1 = new Array(18).fill(0);
        var cumulativeFlight2 = new Array(18).fill(0);
        var flight1Leaders = new Array(18).fill("AS");
        var flight2Leaders = new Array(18).fill("AS");
        var pointsAArray = new Array(18).fill(0);
        var pointsBArray = new Array(18).fill(0);
        
        var displayT1 = new Array(18).fill("AS");
        var displayT2 = new Array(18).fill("AS");
        var teamGameTR = new Array(18).fill({ A: 0.5, B: 0.5 });
        
        var flight1IntraMatches = new Array(18);
        var flight2IntraMatches = new Array(18);

        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        var flight1A = flight1Players.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var flight1B = flight1Players.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var flight2A = flight2Players.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var flight2B = flight2Players.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });

        var playOrder = getPlayOrder(startingHole);
        console.log(`[DEBUG-TEAM] Play order (first 5): ${playOrder.slice(0, 5).join(', ')}...`);

        var runningFlight1 = 0;
        var runningFlight2 = 0;

        for (var idx = 0; idx < 18; idx++) {
            var holeNum = playOrder[idx];
            var si = courseSi[holeNum - 1];

            console.log(`[DEBUG-TEAM] --- Position ${idx}: Hole ${holeNum}, SI=${si} ---`);

            var f1Hole = GameData.parseHoleData(f1DataString, holeNum);
            var f2Hole = GameData.parseHoleData(f2DataString, holeNum);
            
            var f1Available = (f1Hole && f1Hole.saved);
            var f2Available = (f2Hole && f2Hole.saved);
            
            console.log(`[DEBUG-TEAM] f1Available=${f1Available}, f2Available=${f2Available}`);
            
            if (f1Available && f1Hole) {
                console.log(`[DEBUG-TEAM] F1 scores: a1=${f1Hole.scores.a1}, a2=${f1Hole.scores.a2}, b1=${f1Hole.scores.b1}, b2=${f1Hole.scores.b2}`);
            }
            if (f2Available && f2Hole) {
                console.log(`[DEBUG-TEAM] F2 scores: a1=${f2Hole.scores.a1}, a2=${f2Hole.scores.a2}, b1=${f2Hole.scores.b1}, b2=${f2Hole.scores.b2}`);
            }

            // ============================================================
            // FLIGHT 1 (T-1)
            // ============================================================
            var flight1Match1 = 0, flight1Match2 = 0;
            var flight1Total = 0;
            
            if (f1Available && flight1A.length >= 2 && flight1B.length >= 2) {
                var teamAGross1 = [f1Hole.scores.a1, f1Hole.scores.a2];
                var teamBGross1 = [f1Hole.scores.b1, f1Hole.scores.b2];
                
                console.log(`[DEBUG-TEAM] F1: Team A gross ${teamAGross1.join(',')}, Team B gross ${teamBGross1.join(',')}`);
                
                flight1IntraMatches[idx] = buildIntraMatchResults(flight1A, flight1B, teamAGross1, teamBGross1, si, teamGameFormat, minHandicapFlight1, courseSi);
                
                var sortedTeamA1 = sortPlayersByNetScore(flight1A, teamAGross1, si, teamGameFormat, minHandicapFlight1, courseSi);
                var sortedTeamB1 = sortPlayersByNetScore(flight1B, teamBGross1, si, teamGameFormat, minHandicapFlight1, courseSi);
                
                console.log(`[DEBUG-TEAM] F1 sorted A: ${sortedTeamA1[0].player.name} (${sortedTeamA1[0].netScore}), ${sortedTeamA1[1].player.name} (${sortedTeamA1[1].netScore})`);
                console.log(`[DEBUG-TEAM] F1 sorted B: ${sortedTeamB1[0].player.name} (${sortedTeamB1[0].netScore}), ${sortedTeamB1[1].player.name} (${sortedTeamB1[1].netScore})`);
                
                var bestANet = sortedTeamA1[0].netScore;
                var bestBNet = sortedTeamB1[0].netScore;
                if (bestANet < bestBNet) {
                    flight1Match1 = 1;
                    console.log(`[DEBUG-TEAM] F1 Match 1: ${sortedTeamA1[0].player.name} beats ${sortedTeamB1[0].player.name} (${bestANet} < ${bestBNet})`);
                } else if (bestANet > bestBNet) {
                    flight1Match1 = -1;
                    console.log(`[DEBUG-TEAM] F1 Match 1: ${sortedTeamB1[0].player.name} beats ${sortedTeamA1[0].player.name} (${bestBNet} < ${bestANet})`);
                } else {
                    console.log(`[DEBUG-TEAM] F1 Match 1: TIE (${bestANet} = ${bestBNet})`);
                }
                
                var secondANet = sortedTeamA1[1].netScore;
                var secondBNet = sortedTeamB1[1].netScore;
                if (secondANet < secondBNet) {
                    flight1Match2 = 1;
                    console.log(`[DEBUG-TEAM] F1 Match 2: ${sortedTeamA1[1].player.name} beats ${sortedTeamB1[1].player.name} (${secondANet} < ${secondBNet})`);
                } else if (secondANet > secondBNet) {
                    flight1Match2 = -1;
                    console.log(`[DEBUG-TEAM] F1 Match 2: ${sortedTeamB1[1].player.name} beats ${sortedTeamA1[1].player.name} (${secondBNet} < ${secondANet})`);
                } else {
                    console.log(`[DEBUG-TEAM] F1 Match 2: TIE (${secondANet} = ${secondBNet})`);
                }
                
                flight1Total = flight1Match1 + flight1Match2;
                runningFlight1 += flight1Total;
                console.log(`[DEBUG-TEAM] F1 Total this hole: ${flight1Total}, runningFlight1 now: ${runningFlight1}`);
            } else {
                console.log(`[DEBUG-TEAM] F1: SKIPPED (f1Available=${f1Available})`);
            }
            
            cumulativeFlight1[idx] = f1Available ? runningFlight1 : 0;

            // ============================================================
            // FLIGHT 2 (T-2)
            // ============================================================
            var flight2Match1 = 0, flight2Match2 = 0;
            var flight2Total = 0;
            
            if (f2Available && flight2A.length >= 2 && flight2B.length >= 2) {
                var teamAGross2 = [f2Hole.scores.a1, f2Hole.scores.a2];
                var teamBGross2 = [f2Hole.scores.b1, f2Hole.scores.b2];
                
                console.log(`[DEBUG-TEAM] F2: Team A gross ${teamAGross2.join(',')}, Team B gross ${teamBGross2.join(',')}`);
                
                flight2IntraMatches[idx] = buildIntraMatchResults(flight2A, flight2B, teamAGross2, teamBGross2, si, teamGameFormat, minHandicapFlight2, courseSi);
                
                var sortedTeamA2 = sortPlayersByNetScore(flight2A, teamAGross2, si, teamGameFormat, minHandicapFlight2, courseSi);
                var sortedTeamB2 = sortPlayersByNetScore(flight2B, teamBGross2, si, teamGameFormat, minHandicapFlight2, courseSi);
                
                console.log(`[DEBUG-TEAM] F2 sorted A: ${sortedTeamA2[0].player.name} (${sortedTeamA2[0].netScore}), ${sortedTeamA2[1].player.name} (${sortedTeamA2[1].netScore})`);
                console.log(`[DEBUG-TEAM] F2 sorted B: ${sortedTeamB2[0].player.name} (${sortedTeamB2[0].netScore}), ${sortedTeamB2[1].player.name} (${sortedTeamB2[1].netScore})`);
                
                var bestANet2 = sortedTeamA2[0].netScore;
                var bestBNet2 = sortedTeamB2[0].netScore;
                if (bestANet2 < bestBNet2) {
                    flight2Match1 = 1;
                    console.log(`[DEBUG-TEAM] F2 Match 1: ${sortedTeamA2[0].player.name} beats ${sortedTeamB2[0].player.name} (${bestANet2} < ${bestBNet2})`);
                } else if (bestANet2 > bestBNet2) {
                    flight2Match1 = -1;
                    console.log(`[DEBUG-TEAM] F2 Match 1: ${sortedTeamB2[0].player.name} beats ${sortedTeamA2[0].player.name} (${bestBNet2} < ${bestANet2})`);
                } else {
                    console.log(`[DEBUG-TEAM] F2 Match 1: TIE (${bestANet2} = ${bestBNet2})`);
                }
                
                var secondANet2 = sortedTeamA2[1].netScore;
                var secondBNet2 = sortedTeamB2[1].netScore;
                if (secondANet2 < secondBNet2) {
                    flight2Match2 = 1;
                    console.log(`[DEBUG-TEAM] F2 Match 2: ${sortedTeamA2[1].player.name} beats ${sortedTeamB2[1].player.name} (${secondANet2} < ${secondBNet2})`);
                } else if (secondANet2 > secondBNet2) {
                    flight2Match2 = -1;
                    console.log(`[DEBUG-TEAM] F2 Match 2: ${sortedTeamB2[1].player.name} beats ${sortedTeamA2[1].player.name} (${secondBNet2} < ${secondANet2})`);
                } else {
                    console.log(`[DEBUG-TEAM] F2 Match 2: TIE (${secondANet2} = ${secondBNet2})`);
                }
                
                flight2Total = flight2Match1 + flight2Match2;
                runningFlight2 += flight2Total;
                console.log(`[DEBUG-TEAM] F2 Total this hole: ${flight2Total}, runningFlight2 now: ${runningFlight2}`);
            } else {
                console.log(`[DEBUG-TEAM] F2: SKIPPED (f2Available=${f2Available})`);
            }
            
            cumulativeFlight2[idx] = f2Available ? runningFlight2 : 0;

            // ============================================================
            // DISPLAY FOR T-1 AND T-2
            // ============================================================
            
            if (f1Available) {
                flight1Leaders[idx] = runningFlight1 > 0 ? "A" : (runningFlight1 < 0 ? "B" : "AS");
                
                if (runningFlight1 > 0) {
                    displayT1[idx] = "A" + runningFlight1;
                    teamGameTR[idx] = { A: 1, B: 0 };
                } else if (runningFlight1 < 0) {
                    displayT1[idx] = "B" + Math.abs(runningFlight1);
                    teamGameTR[idx] = { A: 0, B: 1 };
                } else {
                    displayT1[idx] = "AS";
                    teamGameTR[idx] = { A: 0.5, B: 0.5 };
                }
                console.log(`[DEBUG-TEAM] T-1 display: ${displayT1[idx]}`);
            } else {
                flight1Leaders[idx] = "AS";
                displayT1[idx] = "AS";
                teamGameTR[idx] = { A: 0.5, B: 0.5 };
                console.log(`[DEBUG-TEAM] T-1 display: AS (not available)`);
            }
            
            if (f2Available) {
                flight2Leaders[idx] = runningFlight2 > 0 ? "A" : (runningFlight2 < 0 ? "B" : "AS");
                
                if (runningFlight2 > 0) {
                    displayT2[idx] = "A" + runningFlight2;
                } else if (runningFlight2 < 0) {
                    displayT2[idx] = "B" + Math.abs(runningFlight2);
                } else {
                    displayT2[idx] = "AS";
                }
                console.log(`[DEBUG-TEAM] T-2 display: ${displayT2[idx]}`);
            } else {
                flight2Leaders[idx] = "AS";
                displayT2[idx] = "AS";
                console.log(`[DEBUG-TEAM] T-2 display: AS (not available)`);
            }

            var flight1PointsA = 0, flight1PointsB = 0;
            if (f1Available) {
                if (flight1Total > 0) { flight1PointsA = 1; flight1PointsB = 0; }
                else if (flight1Total < 0) { flight1PointsA = 0; flight1PointsB = 1; }
                else { flight1PointsA = 0.5; flight1PointsB = 0.5; }
            } else {
                flight1PointsA = 0; flight1PointsB = 0;
            }

            var flight2PointsA = 0, flight2PointsB = 0;
            if (f2Available) {
                if (flight2Total > 0) { flight2PointsA = 1; flight2PointsB = 0; }
                else if (flight2Total < 0) { flight2PointsA = 0; flight2PointsB = 1; }
                else { flight2PointsA = 0.5; flight2PointsB = 0.5; }
            } else {
                flight2PointsA = 0; flight2PointsB = 0;
            }

            pointsAArray[idx] = flight1PointsA + flight2PointsA;
            pointsBArray[idx] = flight1PointsB + flight2PointsB;
            
            console.log(`[DEBUG-TEAM] Points this hole: A=${pointsAArray[idx]}, B=${pointsBArray[idx]}`);
            console.log(`[DEBUG-TEAM] Running totals: F1=${runningFlight1}, F2=${runningFlight2}`);
        }

        console.log(`[DEBUG-TEAM] =========================================`);
        console.log(`[DEBUG-TEAM] TEAM GAME CALCULATION COMPLETE`);
        console.log(`[DEBUG-TEAM] Final F1: ${cumulativeFlight1[17]}, Final F2: ${cumulativeFlight2[17]}`);
        console.log(`[DEBUG-TEAM] =========================================`);

        return {
            flight1Cumulative: cumulativeFlight1,
            flight2Cumulative: cumulativeFlight2,
            flight1Leaders: flight1Leaders,
            flight2Leaders: flight2Leaders,
            pointsA: pointsAArray,
            pointsB: pointsBArray,
            displayT1: displayT1,
            displayT2: displayT2,
            teamGameTR: teamGameTR,
            flight1IntraMatches: flight1IntraMatches,
            flight2IntraMatches: flight2IntraMatches
        };
    }

    // ============================================================
    // calculateWithClinched - with DEBUG LOGGING
    // ============================================================
    
    function calculateWithClinched(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat, remainingHolesByHole, computedUpToHole) {
        console.log(`[DEBUG-TEAM-CLINCH] =========================================`);
        console.log(`[DEBUG-TEAM-CLINCH] CLINCH DETECTION START`);
        console.log(`[DEBUG-TEAM-CLINCH] startingHole=${startingHole}, teamGameFormat=${teamGameFormat}`);
        console.log(`[DEBUG-TEAM-CLINCH] =========================================`);
        
        var baseResults = calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat);
        
        var flight1ClinchedHole = null;
        var flight2ClinchedHole = null;
        
        for (var position = 0; position < 18; position++) {
            var cumulative1 = Math.abs(baseResults.flight1Cumulative[position]);
            var cumulative2 = Math.abs(baseResults.flight2Cumulative[position]);
            var remainingHoles = remainingHolesByHole[position];
            
            console.log(`[DEBUG-TEAM-CLINCH] Position ${position}: F1 lead=${cumulative1}, F2 lead=${cumulative2}, remaining=${remainingHoles}`);
            
            if (flight1ClinchedHole === null && cumulative1 > 0) {
                var maxOpponentPoints1 = remainingHoles * 2;
                var condition1 = cumulative1 > maxOpponentPoints1;
                console.log(`[DEBUG-TEAM-CLINCH]   F1: ${cumulative1} > ${maxOpponentPoints1}? ${condition1}`);
                if (condition1) {
                    flight1ClinchedHole = position + 1;
                    console.log(`[DEBUG-TEAM-CLINCH]   *** F1 CLINCHED at position ${position} (hole ${getHoleAtPosition(position)}) ***`);
                }
            }
            
            if (flight2ClinchedHole === null && cumulative2 > 0) {
                var maxOpponentPoints2 = remainingHoles * 2;
                var condition2 = cumulative2 > maxOpponentPoints2;
                console.log(`[DEBUG-TEAM-CLINCH]   F2: ${cumulative2} > ${maxOpponentPoints2}? ${condition2}`);
                if (condition2) {
                    flight2ClinchedHole = position + 1;
                    console.log(`[DEBUG-TEAM-CLINCH]   *** F2 CLINCHED at position ${position} (hole ${getHoleAtPosition(position)}) ***`);
                }
            }
        }
        
        console.log(`[DEBUG-TEAM-CLINCH] Result: F1 clinched at ${flight1ClinchedHole}, F2 clinched at ${flight2ClinchedHole}`);
        console.log(`[DEBUG-TEAM-CLINCH] =========================================`);
        
        return {
            flight1Cumulative: baseResults.flight1Cumulative,
            flight2Cumulative: baseResults.flight2Cumulative,
            flight1Leaders: baseResults.flight1Leaders,
            flight2Leaders: baseResults.flight2Leaders,
            pointsA: baseResults.pointsA,
            pointsB: baseResults.pointsB,
            displayT1: baseResults.displayT1,
            displayT2: baseResults.displayT2,
            teamGameTR: baseResults.teamGameTR,
            flight1IntraMatches: baseResults.flight1IntraMatches,
            flight2IntraMatches: baseResults.flight2IntraMatches,
            flight1ClinchedHole: flight1ClinchedHole,
            flight2ClinchedHole: flight2ClinchedHole
        };
    }
    
    // ============================================================
    // Helper to get hole at position (for debug output)
    // ============================================================
    function getHoleAtPosition(position) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getNaturalHole) {
            return GameOrder.getNaturalHole(position);
        }
        return position + 1;
    }
    
    return {
        calculate: calculate,
        calculateWithClinched: calculateWithClinched,
        calculateMinHandicapForFlight: calculateMinHandicapForFlight
    };
})();

// Make available globally
window.GameTeam = GameTeam;

// Re-expose version for console debugging
window.GAME_TEAM_VERSION = "1.13";

/*
FILE: js/game-team.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - ADDED: Detailed debug logging for team game calculation flow
   - Logs: calculate() entry with startingHole, teamGameFormat, player count
   - Logs: Each hole position with hole number, f1Available, f2Available
   - Logs: Flight 1 match results: best vs best, second vs second with net scores
   - Logs: Flight 2 match results: best vs best, second vs second with net scores
   - Logs: Cumulative running totals after each hole (runningFlight1, runningFlight2)
   - Logs: Display values (t1Display, t2Display) and points awarded
   - Logs: calculateWithClinched() clinch detection for each position
   - All existing functionality preserved from v1.12
DEPENDS ON: GameData, GameOrder, courseSi, teamGameFormat
STATUS: Debug version - ready for testing
*/