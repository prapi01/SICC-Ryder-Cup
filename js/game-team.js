/*
FILE: js/game-team.js
VERSION: 1.07
KEY CHANGES from v1.06:
   - ADDED: flight1IntraMatches array - stores per-hole intra-flight match results for Flight 1
   - ADDED: flight2IntraMatches array - stores per-hole intra-flight match results for Flight 2
   - These arrays are used by cascade and bubble display to show correct match results
   - Format: { "PlayerA_vs_PlayerB": result, "PlayerB_vs_PlayerA": -result } for each hole
   - All existing functionality preserved (cumulative, leaders, points, display strings)
DEPENDS ON: GameData, courseSi, startingHole, teamGameFormat
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.GAME_TEAM_VERSION = "1.07";

var GameTeam = (function() {
    
    // Calculate minimum handicap across all players (for Relative format)
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
    function getNetScoreWithFormat(gross, playerHandicap, si, teamGameFormat, minHandicap) {
        var effectiveHandicap;
        
        if (teamGameFormat === "tournament") {
            // Tournament: use player's own handicap
            effectiveHandicap = playerHandicap;
        } else {
            // Relative: zero-rise - subtract lowest handicap
            effectiveHandicap = playerHandicap - minHandicap;
        }
        
        var strokes = 0;
        if (effectiveHandicap > 0 && si <= effectiveHandicap) {
            strokes = 1;
        }
        return gross - strokes;
    }

    // Helper: Sort players by net score (lowest = best)
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

    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat) {
        // Calculate minimum handicap across all players for Relative format
        var minHandicap = calculateMinHandicap(allPlayers);
        
        var cumulativeFlight1 = new Array(18).fill(0);
        var cumulativeFlight2 = new Array(18).fill(0);
        var flight1Leaders = new Array(18).fill("AS");
        var flight2Leaders = new Array(18).fill("AS");
        var pointsAArray = new Array(18).fill(0);
        var pointsBArray = new Array(18).fill(0);
        
        var displayT1 = new Array(18).fill("AS");
        var displayT2 = new Array(18).fill("AS");
        var teamGameTR = new Array(18).fill({ A: 0.5, B: 0.5 });
        
        // NEW v1.07: Arrays to store intra-flight match results per hole
        var flight1IntraMatches = new Array(18);
        var flight2IntraMatches = new Array(18);

        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
        // Get players by team (still needed for base data)
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

            // ============================================================
            // FLIGHT 1 - Sort by net score for this hole
            // ============================================================
            var flight1Match1 = 0, flight1Match2 = 0;
            
            if (f1Hole && f1Hole.saved && flight1A.length >= 2 && flight1B.length >= 2) {
                // Get gross scores for Team A
                var teamAGross1 = [f1Hole.scores.a1, f1Hole.scores.a2];
                // Get gross scores for Team B
                var teamBGross1 = [f1Hole.scores.b1, f1Hole.scores.b2];
                
                // Store intra-flight match results for bubble display
                flight1IntraMatches[idx] = buildIntraMatchResults(flight1A, flight1B, teamAGross1, teamBGross1, si, teamGameFormat, minHandicap, courseSi);
                
                // Sort Team A players by net score (lowest = best)
                var sortedTeamA1 = sortPlayersByNetScore(flight1A, teamAGross1, si, teamGameFormat, minHandicap, courseSi);
                // Sort Team B players by net score (lowest = best)
                var sortedTeamB1 = sortPlayersByNetScore(flight1B, teamBGross1, si, teamGameFormat, minHandicap, courseSi);
                
                // Best vs Best (index 0)
                var bestANet = sortedTeamA1[0].netScore;
                var bestBNet = sortedTeamB1[0].netScore;
                if (bestANet < bestBNet) {
                    flight1Match1 = 1;  // Team A wins best match
                } else if (bestANet > bestBNet) {
                    flight1Match1 = -1; // Team B wins best match
                } else {
                    flight1Match1 = 0;  // Tie
                }
                
                // Second vs Second (index 1)
                var secondANet = sortedTeamA1[1].netScore;
                var secondBNet = sortedTeamB1[1].netScore;
                if (secondANet < secondBNet) {
                    flight1Match2 = 1;  // Team A wins second match
                } else if (secondANet > secondBNet) {
                    flight1Match2 = -1; // Team B wins second match
                } else {
                    flight1Match2 = 0;  // Tie
                }
            }

            // ============================================================
            // FLIGHT 2 - Sort by net score for this hole
            // ============================================================
            var flight2Match1 = 0, flight2Match2 = 0;
            
            if (f2Hole && f2Hole.saved && flight2A.length >= 2 && flight2B.length >= 2) {
                // Get gross scores for Team A
                var teamAGross2 = [f2Hole.scores.a1, f2Hole.scores.a2];
                // Get gross scores for Team B
                var teamBGross2 = [f2Hole.scores.b1, f2Hole.scores.b2];
                
                // Store intra-flight match results for bubble display
                flight2IntraMatches[idx] = buildIntraMatchResults(flight2A, flight2B, teamAGross2, teamBGross2, si, teamGameFormat, minHandicap, courseSi);
                
                // Sort Team A players by net score (lowest = best)
                var sortedTeamA2 = sortPlayersByNetScore(flight2A, teamAGross2, si, teamGameFormat, minHandicap, courseSi);
                // Sort Team B players by net score (lowest = best)
                var sortedTeamB2 = sortPlayersByNetScore(flight2B, teamBGross2, si, teamGameFormat, minHandicap, courseSi);
                
                // Best vs Best (index 0)
                var bestANet2 = sortedTeamA2[0].netScore;
                var bestBNet2 = sortedTeamB2[0].netScore;
                if (bestANet2 < bestBNet2) {
                    flight2Match1 = 1;  // Team A wins best match
                } else if (bestANet2 > bestBNet2) {
                    flight2Match1 = -1; // Team B wins best match
                } else {
                    flight2Match1 = 0;  // Tie
                }
                
                // Second vs Second (index 1)
                var secondANet2 = sortedTeamA2[1].netScore;
                var secondBNet2 = sortedTeamB2[1].netScore;
                if (secondANet2 < secondBNet2) {
                    flight2Match2 = 1;  // Team A wins second match
                } else if (secondANet2 > secondBNet2) {
                    flight2Match2 = -1; // Team B wins second match
                } else {
                    flight2Match2 = 0;  // Tie
                }
            }

            var flight1Total = flight1Match1 + flight1Match2;
            var flight2Total = flight2Match1 + flight2Match2;

            runningFlight1 += flight1Total;
            runningFlight2 += flight2Total;

            cumulativeFlight1[idx] = runningFlight1;
            cumulativeFlight2[idx] = runningFlight2;

            flight1Leaders[idx] = runningFlight1 > 0 ? "A" : (runningFlight1 < 0 ? "B" : "AS");
            flight2Leaders[idx] = runningFlight2 > 0 ? "A" : (runningFlight2 < 0 ? "B" : "AS");

            // Display strings
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

            if (runningFlight2 > 0) {
                displayT2[idx] = "A" + runningFlight2;
            } else if (runningFlight2 < 0) {
                displayT2[idx] = "B" + Math.abs(runningFlight2);
            } else {
                displayT2[idx] = "AS";
            }

            var flight1PointsA = 0, flight1PointsB = 0;
            if (flight1Total > 0) { flight1PointsA = 1; flight1PointsB = 0; }
            else if (flight1Total < 0) { flight1PointsA = 0; flight1PointsB = 1; }
            else { flight1PointsA = 0.5; flight1PointsB = 0.5; }

            var flight2PointsA = 0, flight2PointsB = 0;
            if (flight2Total > 0) { flight2PointsA = 1; flight2PointsB = 0; }
            else if (flight2Total < 0) { flight2PointsA = 0; flight2PointsB = 1; }
            else { flight2PointsA = 0.5; flight2PointsB = 0.5; }

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
            // NEW v1.07: Intra-flight match results for bubble display
            flight1IntraMatches: flight1IntraMatches,
            flight2IntraMatches: flight2IntraMatches
        };
    }

    return { calculate: calculate };
})();

// Make available globally
window.GameTeam = GameTeam;

// Re-expose version for console debugging
window.GAME_TEAM_VERSION = "1.07";

/*
FILE: js/game-team.js
VERSION: 1.07
KEY CHANGES from v1.06:
   - ADDED: flight1IntraMatches array - stores per-hole intra-flight match results for Flight 1
   - ADDED: flight2IntraMatches array - stores per-hole intra-flight match results for Flight 2
   - ADDED: buildIntraMatchResults() helper function
   - These arrays are used by cascade and bubble display to show correct match results
   - Format: { "PlayerA_vs_PlayerB": result, "PlayerB_vs_PlayerA": -result } for each hole
   - All existing functionality preserved (cumulative, leaders, points, display strings)
DEPENDS ON: GameData, courseSi, startingHole, teamGameFormat
STATUS: Ready for integration
*/