/*
FILE: js/game-team.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: Players are now sorted by NET SCORE for each hole, not by handicap
   - Best vs Best: lowest net score in Team A vs lowest net score in Team B
   - Second vs Second: second lowest net score in Team A vs second lowest net score in Team B
   - This matches real-world match play where players are ordered by performance on each hole
   - All existing functionality preserved (cumulative, leaders, points, display strings)
DEPENDS ON: GameData, courseSi, startingHole, teamGameFormat
STATUS: Ready for integration
*/

var GameTeam = (function() {
    function getNetScore(gross, handicap, si, courseSi) {
        var strokes = 0;
        if (handicap > 0) {
            for (var i = 0; i < courseSi.length; i++) {
                if (courseSi[i] <= handicap && i + 1 === si) {
                    strokes++;
                }
            }
        }
        return gross - strokes;
    }

    // Helper: Get net score for a player on a specific hole
    function getPlayerNetScore(player, grossScore, holeSi, courseSi) {
        return getNetScore(grossScore, player.handicap, holeSi, courseSi);
    }

    // Helper: Sort players by net score (lowest = best)
    function sortPlayersByNetScore(players, scores, holeSi, courseSi) {
        var playersWithNet = [];
        for (var i = 0; i < players.length; i++) {
            var netScore = getPlayerNetScore(players[i], scores[i], holeSi, courseSi);
            playersWithNet.push({
                player: players[i],
                netScore: netScore,
                grossScore: scores[i]
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

    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat) {
        var cumulativeFlight1 = new Array(18).fill(0);
        var cumulativeFlight2 = new Array(18).fill(0);
        var flight1Leaders = new Array(18).fill("AS");
        var flight2Leaders = new Array(18).fill("AS");
        var pointsAArray = new Array(18).fill(0);
        var pointsBArray = new Array(18).fill(0);
        
        var displayT1 = new Array(18).fill("AS");
        var displayT2 = new Array(18).fill("AS");
        var teamGameTR = new Array(18).fill({ A: 0.5, B: 0.5 });

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
                
                // Sort Team A players by net score (lowest = best)
                var sortedTeamA1 = sortPlayersByNetScore(flight1A, teamAGross1, si, courseSi);
                // Sort Team B players by net score (lowest = best)
                var sortedTeamB1 = sortPlayersByNetScore(flight1B, teamBGross1, si, courseSi);
                
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
                
                // Sort Team A players by net score (lowest = best)
                var sortedTeamA2 = sortPlayersByNetScore(flight2A, teamAGross2, si, courseSi);
                // Sort Team B players by net score (lowest = best)
                var sortedTeamB2 = sortPlayersByNetScore(flight2B, teamBGross2, si, courseSi);
                
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
            teamGameTR: teamGameTR
        };
    }

    return { calculate: calculate };
})();

window.GameTeam = GameTeam;

/*
FILE: js/game-team.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: Players are now sorted by NET SCORE for each hole, not by handicap
   - Best vs Best: lowest net score in Team A vs lowest net score in Team B
   - Second vs Second: second lowest net score in Team A vs second lowest net score in Team B
   - This matches real-world match play where players are ordered by performance on each hole
   - All existing functionality preserved (cumulative, leaders, points, display strings)
DEPENDS ON: GameData, courseSi, startingHole, teamGameFormat
STATUS: Ready for integration
*/