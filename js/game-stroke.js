/*
FILE: js/game-stroke.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - ADDED: displayStrk array (formatted strings like "A15", "B12", "AS")
   - ADDED: strokeTR array (TR contributions per hole: { A: number, B: number })
   - Format: margin = |nettA - nettB|, leader = "A" if nettA < nettB, "B" if nettB < nettA, else "AS"
   - TR: same as pointsA/pointsB but as object format { A: value, B: value }
   - ALL existing functionality preserved (nettA, nettB, leader, pointsA, pointsB)
DEPENDS ON: GameData, courseSi, startingHole
STATUS: Ready for integration
*/

var GameStroke = (function() {
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

    function calculate(allPlayers, f1DataString, f2DataString, courseSi, startingHole) {
        var nettA = new Array(18).fill(0);
        var nettB = new Array(18).fill(0);
        var leaders = new Array(18).fill("AS");
        var pointsAArray = new Array(18).fill(0);
        var pointsBArray = new Array(18).fill(0);
        
        // NEW v1.04: Display strings and TR contributions
        var displayStrk = new Array(18).fill("AS");
        var strokeTR = new Array(18).fill(null);

        var teamAPlayers = allPlayers.filter(function(p) { return p.team === 'A'; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === 'B'; });

        var playOrder = [];
        for (var i = startingHole; i <= 18; i++) playOrder.push(i);
        for (var i = 1; i < startingHole; i++) playOrder.push(i);

        var totalNetA = 0;
        var totalNetB = 0;

        for (var idx = 0; idx < 18; idx++) {
            var holeNum = playOrder[idx];
            var si = courseSi[holeNum - 1];

            var f1Hole = GameData.parseHoleData(f1DataString, holeNum);
            var f2Hole = GameData.parseHoleData(f2DataString, holeNum);

            var netAThisHole = 0;
            var netBThisHole = 0;

            // Calculate Team A net for this hole
            for (var a = 0; a < teamAPlayers.length; a++) {
                var player = teamAPlayers[a];
                var gross = 0;
                if (player.flight === 1 && f1Hole && f1Hole.saved) {
                    if (player.team === 'A') {
                        var flight1A = teamAPlayers.filter(function(p) { return p.flight === 1; }).sort(function(a, b) { return a.handicap - b.handicap; });
                        if (flight1A[0] && flight1A[0].name === player.name) gross = f1Hole.scores.a1;
                        else if (flight1A[1] && flight1A[1].name === player.name) gross = f1Hole.scores.a2;
                    }
                } else if (player.flight === 2 && f2Hole && f2Hole.saved) {
                    if (player.team === 'A') {
                        var flight2A = teamAPlayers.filter(function(p) { return p.flight === 2; }).sort(function(a, b) { return a.handicap - b.handicap; });
                        if (flight2A[0] && flight2A[0].name === player.name) gross = f2Hole.scores.a1;
                        else if (flight2A[1] && flight2A[1].name === player.name) gross = f2Hole.scores.a2;
                    }
                } else {
                    // Use par if hole not saved (coursePar needed, default to 4)
                    gross = 4;
                }
                var net = getNetScore(gross, player.handicap, si, courseSi);
                netAThisHole += net;
            }

            // Calculate Team B net for this hole
            for (var b = 0; b < teamBPlayers.length; b++) {
                var player = teamBPlayers[b];
                var gross = 0;
                if (player.flight === 1 && f1Hole && f1Hole.saved) {
                    if (player.team === 'B') {
                        var flight1B = teamBPlayers.filter(function(p) { return p.flight === 1; }).sort(function(a, b) { return a.handicap - b.handicap; });
                        if (flight1B[0] && flight1B[0].name === player.name) gross = f1Hole.scores.b1;
                        else if (flight1B[1] && flight1B[1].name === player.name) gross = f1Hole.scores.b2;
                    }
                } else if (player.flight === 2 && f2Hole && f2Hole.saved) {
                    if (player.team === 'B') {
                        var flight2B = teamBPlayers.filter(function(p) { return p.flight === 2; }).sort(function(a, b) { return a.handicap - b.handicap; });
                        if (flight2B[0] && flight2B[0].name === player.name) gross = f2Hole.scores.b1;
                        else if (flight2B[1] && flight2B[1].name === player.name) gross = f2Hole.scores.b2;
                    }
                } else {
                    gross = 4;
                }
                var net = getNetScore(gross, player.handicap, si, courseSi);
                netBThisHole += net;
            }

            totalNetA += netAThisHole;
            totalNetB += netBThisHole;

            nettA[idx] = totalNetA;
            nettB[idx] = totalNetB;

            // Determine leader and points
            if (totalNetA < totalNetB) {
                leaders[idx] = "A";
                pointsAArray[idx] = 1;
                pointsBArray[idx] = 0;
                // NEW v1.04: display and TR
                displayStrk[idx] = "A" + (totalNetB - totalNetA);
                strokeTR[idx] = { A: 1, B: 0 };
            } else if (totalNetB < totalNetA) {
                leaders[idx] = "B";
                pointsAArray[idx] = 0;
                pointsBArray[idx] = 1;
                // NEW v1.04: display and TR
                displayStrk[idx] = "B" + (totalNetA - totalNetB);
                strokeTR[idx] = { A: 0, B: 1 };
            } else {
                leaders[idx] = "AS";
                pointsAArray[idx] = 0.5;
                pointsBArray[idx] = 0.5;
                // NEW v1.04: display and TR
                displayStrk[idx] = "AS";
                strokeTR[idx] = { A: 0.5, B: 0.5 };
            }
        }

        return {
            nettA: nettA,
            nettB: nettB,
            leader: leaders,
            pointsA: pointsAArray,
            pointsB: pointsBArray,
            // NEW v1.04
            displayStrk: displayStrk,
            strokeTR: strokeTR
        };
    }

    return { calculate: calculate };
})();

window.GameStroke = GameStroke;

/*
FILE: js/game-stroke.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - ADDED: displayStrk array (formatted strings like "A15", "B12", "AS")
   - ADDED: strokeTR array (TR contributions per hole: { A: number, B: number })
   - Format: margin = |nettA - nettB|, leader = "A" if nettA < nettB, "B" if nettB < nettA, else "AS"
   - TR: same as pointsA/pointsB but as object format { A: value, B: value }
   - ALL existing functionality preserved (nettA, nettB, leader, pointsA, pointsB)
DEPENDS ON: GameData, courseSi, startingHole
STATUS: Ready for integration
*/