/*
FILE: js/game-team.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - ADDED: displayT1 and displayT2 arrays (formatted strings like "A10", "B8", "AS")
   - ADDED: teamGameTR array (TR contributions per hole: { A: number, B: number })
   - Format: cumulative > 0 → "A" + cumulative, < 0 → "B" + |cumulative|, =0 → "AS"
   - TR: cumulative > 0 → { A:1, B:0 }, < 0 → { A:0, B:1 }, =0 → { A:0.5, B:0.5 }
   - ALL existing functionality preserved (cumulative, leaders, pointsA/B)
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

    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat) {
        var cumulativeFlight1 = new Array(18).fill(0);
        var cumulativeFlight2 = new Array(18).fill(0);
        var flight1Leaders = new Array(18).fill("AS");
        var flight2Leaders = new Array(18).fill("AS");
        var pointsAArray = new Array(18).fill(0);
        var pointsBArray = new Array(18).fill(0);
        
        // NEW v1.04: Display strings and TR contributions
        var displayT1 = new Array(18).fill("AS");
        var displayT2 = new Array(18).fill("AS");
        var teamGameTR = new Array(18).fill({ A: 0.5, B: 0.5 });

        var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
        var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
        
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

            var f1Match1 = 0, f1Match2 = 0;
            var f2Match1 = 0, f2Match2 = 0;

            if (f1Hole && f1Hole.saved && flight1A[0] && flight1B[0]) {
                var a1Net = getNetScore(f1Hole.scores.a1, flight1A[0].handicap, si, courseSi);
                var b1Net = getNetScore(f1Hole.scores.b1, flight1B[0].handicap, si, courseSi);
                if (a1Net < b1Net) f1Match1 = 1;
                else if (a1Net > b1Net) f1Match1 = -1;
            }
            if (f1Hole && f1Hole.saved && flight1A[1] && flight1B[1]) {
                var a2Net = getNetScore(f1Hole.scores.a2, flight1A[1].handicap, si, courseSi);
                var b2Net = getNetScore(f1Hole.scores.b2, flight1B[1].handicap, si, courseSi);
                if (a2Net < b2Net) f1Match2 = 1;
                else if (a2Net > b2Net) f1Match2 = -1;
            }
            if (f2Hole && f2Hole.saved && flight2A[0] && flight2B[0]) {
                var a3Net = getNetScore(f2Hole.scores.a1, flight2A[0].handicap, si, courseSi);
                var b3Net = getNetScore(f2Hole.scores.b1, flight2B[0].handicap, si, courseSi);
                if (a3Net < b3Net) f2Match1 = 1;
                else if (a3Net > b3Net) f2Match1 = -1;
            }
            if (f2Hole && f2Hole.saved && flight2A[1] && flight2B[1]) {
                var a4Net = getNetScore(f2Hole.scores.a2, flight2A[1].handicap, si, courseSi);
                var b4Net = getNetScore(f2Hole.scores.b2, flight2B[1].handicap, si, courseSi);
                if (a4Net < b4Net) f2Match2 = 1;
                else if (a4Net > b4Net) f2Match2 = -1;
            }

            var flight1Total = f1Match1 + f1Match2;
            var flight2Total = f2Match1 + f2Match2;

            runningFlight1 += flight1Total;
            runningFlight2 += flight2Total;

            cumulativeFlight1[idx] = runningFlight1;
            cumulativeFlight2[idx] = runningFlight2;

            flight1Leaders[idx] = runningFlight1 > 0 ? "A" : (runningFlight1 < 0 ? "B" : "AS");
            flight2Leaders[idx] = runningFlight2 > 0 ? "A" : (runningFlight2 < 0 ? "B" : "AS");

            // NEW v1.04: Calculate display strings and TR contributions
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
            // NEW v1.04: Display strings and TR contributions
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
VERSION: 1.04
KEY CHANGES from v1.03:
   - ADDED: displayT1 and displayT2 arrays (formatted strings like "A10", "B8", "AS")
   - ADDED: teamGameTR array (TR contributions per hole: { A: number, B: number })
   - Format: cumulative > 0 → "A" + cumulative, < 0 → "B" + |cumulative|, =0 → "AS"
   - TR: cumulative > 0 → { A:1, B:0 }, < 0 → { A:0, B:1 }, =0 → { A:0.5, B:0.5 }
   - ALL existing functionality preserved (cumulative, leaders, pointsA/B)
DEPENDS ON: GameData, courseSi, startingHole, teamGameFormat
STATUS: Ready for integration
*/