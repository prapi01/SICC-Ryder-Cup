/*
FILE: js/game-team.js
VERSION: 1.11
KEY CHANGES from v1.10:
   - FIXED: Relative mode (zero-rise) now applies PER FLIGHT, not overall
   - Added calculateMinHandicapPerFlight() to get min handicap for each flight separately
   - Modified calculate() to pass flight-specific min handicap to getNetScoreWithFormat()
   - Flight 1 players use Flight 1's minimum handicap for zero-rise
   - Flight 2 players use Flight 2's minimum handicap for zero-rise
   - All other functionality preserved (T-1/T-2 independent, clinch detection)
DEPENDS ON: GameData, courseSi, startingHole, teamGameFormat
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.GAME_TEAM_VERSION = "1.11";

var GameTeam = (function() {
    
    // v1.11: Calculate minimum handicap for a specific flight
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
    
    // Legacy: Calculate minimum handicap across all players (kept for compatibility but not used for per-flight)
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
    
    // Get net score based on team game format
    // v1.11: minHandicap now passed as flight-specific value for relative mode
    function getNetScoreWithFormat(gross, playerHandicap, si, teamGameFormat, minHandicap) {
        var effectiveHandicap;
        
        if (teamGameFormat === "tournament") {
            // Tournament: use player's own handicap
            effectiveHandicap = playerHandicap;
        } else {
            // Relative: zero-rise - subtract flight's lowest handicap
            effectiveHandicap = playerHandicap - minHandicap;
        }
        
        var strokes = 0;
        if (effectiveHandicap > 0 && si <= effectiveHandicap) {
            strokes = 1;
        }
        return gross - strokes;
    }

    // Helper: Sort players by net score (lowest = best)
    // v1.11: minHandicap passed as flight-specific value
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
        // Sort by net score ascending (lower is better)
        playersWithNet.sort(function(a, b) {
            if (a.netScore < b.netScore) return -1;
            if (a.netScore > b.netScore) return 1;
            return 0;
        });
        return playersWithNet;
    }
    
    // Helper: Build intra-flight match results object for a flight on a specific hole
    // v1.11: minHandicap passed as flight-specific value
    function buildIntraMatchResults(teamAPlayers, teamBPlayers, teamAGross, teamBGross, si, teamGameFormat, minHandicap, courseSi) {
        var results = {};
        
        // Calculate net scores for all players
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
        
        // Sort by net score (lowest = best) for matching best vs best, second vs second
        teamANets.sort(function(a, b) { return a.net - b.net; });
        teamBNets.sort(function(a, b) { return a.net - b.net; });
        
        // Match best vs best, second vs second (both flights have exactly 2 players each)
        for (var i = 0; i < teamANets.length && i < teamBNets.length; i++) {
            var playerA = teamANets[i].player;
            var playerB = teamBNets[i].player;
            var netA = teamANets[i].net;
            var netB = teamBNets[i].net;
            
            var matchResult = 0;
            if (netA < netB) {
                matchResult = 1;  // Team A wins this match
            } else if (netA > netB) {
                matchResult = -1; // Team B wins this match
            }
            
            var keyA = playerA.name + "_vs_" + playerB.name;
            var keyB = playerB.name + "_vs_" + playerA.name;
            results[keyA] = matchResult;
            results[keyB] = -matchResult;
        }
        
        return results;
    }

    // Main calculate function - v1.11: Per-flight zero-rise for Relative mode
    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat) {
        // v1.11: Calculate minimum handicap PER FLIGHT for Relative format
        var minHandicapFlight1 = calculateMinHandicapForFlight(allPlayers, 1);
        var minHandicapFlight2 = calculateMinHandicapForFlight(allPlayers, 2);
        
        var cumulativeFlight1 = new Array(18).fill(0);
        var cumulativeFlight2 = new Array(18).fill(0);
        var flight1Leaders = new Array(18).fill("AS");
        var flight2Leaders = new Array(18).fill("AS");
        var pointsAArray = new Array(18).fill(0);
        var pointsBArray = new Array(18).fill(0);
        
        var displayT1 = new Array(18).fill("AS");
        var displayT2 = new Array(18).fill("AS");
        var teamGameTR = new Array(18).fill({ A: 0.5, B: 0.5 });
        
        // Arrays to store intra-flight match results per hole
        var flight1IntraMatches = new Array(18);
        var flight2IntraMatches = new Array(18);

        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        // Get players by team
        var flight1A = flight1Players.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var flight1B = flight1Players.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var flight2A = flight2Players.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var flight2B = flight2Players.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });

        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);

        var runningFlight1 = 0;
        var runningFlight2 = 0;

        for (var idx = 0; idx < 18; idx++) {
            var holeNum = playOrder[idx];
            var si = courseSi[holeNum - 1];

            var f1Hole = GameData.parseHoleData(f1DataString, holeNum);
            var f2Hole = GameData.parseHoleData(f2DataString, holeNum);
            
            var f1Available = (f1Hole && f1Hole.saved);
            var f2Available = (f2Hole && f2Hole.saved);

            // ============================================================
            // FLIGHT 1 (T-1) - Independent of Flight 2
            // Uses minHandicapFlight1 for zero-rise in Relative mode
            // ============================================================
            var flight1Match1 = 0, flight1Match2 = 0;
            var flight1Total = 0;
            
            if (f1Available && flight1A.length >= 2 && flight1B.length >= 2) {
                var teamAGross1 = [f1Hole.scores.a1, f1Hole.scores.a2];
                var teamBGross1 = [f1Hole.scores.b1, f1Hole.scores.b2];
                
                // v1.11: Pass flight-specific min handicap for Flight 1
                flight1IntraMatches[idx] = buildIntraMatchResults(flight1A, flight1B, teamAGross1, teamBGross1, si, teamGameFormat, minHandicapFlight1, courseSi);
                
                // v1.11: Pass flight-specific min handicap for Flight 1
                var sortedTeamA1 = sortPlayersByNetScore(flight1A, teamAGross1, si, teamGameFormat, minHandicapFlight1, courseSi);
                var sortedTeamB1 = sortPlayersByNetScore(flight1B, teamBGross1, si, teamGameFormat, minHandicapFlight1, courseSi);
                
                var bestANet = sortedTeamA1[0].netScore;
                var bestBNet = sortedTeamB1[0].netScore;
                if (bestANet < bestBNet) {
                    flight1Match1 = 1;
                } else if (bestANet > bestBNet) {
                    flight1Match1 = -1;
                } else {
                    flight1Match1 = 0;
                }
                
                var secondANet = sortedTeamA1[1].netScore;
                var secondBNet = sortedTeamB1[1].netScore;
                if (secondANet < secondBNet) {
                    flight1Match2 = 1;
                } else if (secondANet > secondBNet) {
                    flight1Match2 = -1;
                } else {
                    flight1Match2 = 0;
                }
                
                flight1Total = flight1Match1 + flight1Match2;
                runningFlight1 += flight1Total;
            }
            
            cumulativeFlight1[idx] = f1Available ? runningFlight1 : 0;

            // ============================================================
            // FLIGHT 2 (T-2) - Independent of Flight 1
            // Uses minHandicapFlight2 for zero-rise in Relative mode
            // ============================================================
            var flight2Match1 = 0, flight2Match2 = 0;
            var flight2Total = 0;
            
            if (f2Available && flight2A.length >= 2 && flight2B.length >= 2) {
                var teamAGross2 = [f2Hole.scores.a1, f2Hole.scores.a2];
                var teamBGross2 = [f2Hole.scores.b1, f2Hole.scores.b2];
                
                // v1.11: Pass flight-specific min handicap for Flight 2
                flight2IntraMatches[idx] = buildIntraMatchResults(flight2A, flight2B, teamAGross2, teamBGross2, si, teamGameFormat, minHandicapFlight2, courseSi);
                
                // v1.11: Pass flight-specific min handicap for Flight 2
                var sortedTeamA2 = sortPlayersByNetScore(flight2A, teamAGross2, si, teamGameFormat, minHandicapFlight2, courseSi);
                var sortedTeamB2 = sortPlayersByNetScore(flight2B, teamBGross2, si, teamGameFormat, minHandicapFlight2, courseSi);
                
                var bestANet2 = sortedTeamA2[0].netScore;
                var bestBNet2 = sortedTeamB2[0].netScore;
                if (bestANet2 < bestBNet2) {
                    flight2Match1 = 1;
                } else if (bestANet2 > bestBNet2) {
                    flight2Match1 = -1;
                } else {
                    flight2Match1 = 0;
                }
                
                var secondANet2 = sortedTeamA2[1].netScore;
                var secondBNet2 = sortedTeamB2[1].netScore;
                if (secondANet2 < secondBNet2) {
                    flight2Match2 = 1;
                } else if (secondANet2 > secondBNet2) {
                    flight2Match2 = -1;
                } else {
                    flight2Match2 = 0;
                }
                
                flight2Total = flight2Match1 + flight2Match2;
                runningFlight2 += flight2Total;
            }
            
            cumulativeFlight2[idx] = f2Available ? runningFlight2 : 0;

            // ============================================================
            // DISPLAY FOR T-1 AND T-2 (Independent)
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
            } else {
                flight1Leaders[idx] = "AS";
                displayT1[idx] = "AS";
                teamGameTR[idx] = { A: 0.5, B: 0.5 };
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
            } else {
                flight2Leaders[idx] = "AS";
                displayT2[idx] = "AS";
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
        }

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
    // calculateWithClinched - returns team game results WITH clinch detection
    // ============================================================
    
    function calculateWithClinched(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat, remainingHolesByHole, computedUpToHole) {
        var baseResults = calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat);
        
        var flight1ClinchedHole = null;
        var flight2ClinchedHole = null;
        
        for (var position = 0; position < 18; position++) {
            var cumulative1 = Math.abs(baseResults.flight1Cumulative[position]);
            var cumulative2 = Math.abs(baseResults.flight2Cumulative[position]);
            var remainingHoles = remainingHolesByHole[position];
            
            if (flight1ClinchedHole === null && cumulative1 > 0) {
                var maxOpponentPoints1 = remainingHoles * 2;
                if (cumulative1 > maxOpponentPoints1) {
                    flight1ClinchedHole = position + 1;
                }
            }
            
            if (flight2ClinchedHole === null && cumulative2 > 0) {
                var maxOpponentPoints2 = remainingHoles * 2;
                if (cumulative2 > maxOpponentPoints2) {
                    flight2ClinchedHole = position + 1;
                }
            }
        }
        
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
    
    return {
        calculate: calculate,
        calculateWithClinched: calculateWithClinched,
        // v1.11: Expose per-flight min handicap calculator for debugging
        calculateMinHandicapForFlight: calculateMinHandicapForFlight
    };
})();

// Make available globally
window.GameTeam = GameTeam;

// Re-expose version for console debugging
window.GAME_TEAM_VERSION = "1.11";

/*
FILE: js/game-team.js
VERSION: 1.11
KEY CHANGES from v1.10:
   - FIXED: Relative mode (zero-rise) now applies PER FLIGHT, not overall
   - Added calculateMinHandicapForFlight() to get min handicap for each flight separately
   - Modified calculate() to pass flight-specific min handicap to getNetScoreWithFormat()
   - Flight 1 players use Flight 1's minimum handicap for zero-rise
   - Flight 2 players use Flight 2's minimum handicap for zero-rise
   - All other functionality preserved (T-1/T-2 independent, clinch detection)
DEPENDS ON: GameData, courseSi, startingHole, teamGameFormat
STATUS: Ready for integration
*/