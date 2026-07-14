/*
FILE: js/util-validate-record.js
VERSION: 1.28
KEY CHANGES from v1.27:
   - ADDED: Debug logging for Match Game calculation at H10
   - REASON: Need to see the actual match data being calculated for validation
   - Logs each match at H10 with pointsA and pointsB
   - Logs total Match Game points at H10
   - PRESERVED: ALL other functionality from v1.27 unchanged
DEPENDS ON: Firebase Firestore, js/game-loader.js, js/hcp-adjust.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_VALIDATE_VERSION = "1.28";

var UtilValidate = (function() {
    
    console.log("[UTIL-VALIDATE] Initializing v1.28 - Added Match Game debug logging");

    // ============================================================
    // PARSING FUNCTIONS - Handles partial data
    // ============================================================
    
    function parseDataString(dataStr) {
        if (!dataStr || dataStr.length === 0) return null;
        
        var charsPerHole = 9;
        var totalHoles = 18;
        var expectedLength = totalHoles * charsPerHole; // 162
        
        if (dataStr.length < charsPerHole) return null;
        
        var scores = [];
        var holesToParse = Math.floor(dataStr.length / charsPerHole);
        if (holesToParse > totalHoles) holesToParse = totalHoles;
        
        for (var i = 0; i < totalHoles; i++) {
            if (i < holesToParse) {
                var startIndex = i * charsPerHole;
                var block = dataStr.substr(startIndex, charsPerHole);
                
                if (block.length === charsPerHole) {
                    var saved = block[0] === 'T';
                    var a1 = parseInt(block.substr(1, 2), 10);
                    var a2 = parseInt(block.substr(3, 2), 10);
                    var b1 = parseInt(block.substr(5, 2), 10);
                    var b2 = parseInt(block.substr(7, 2), 10);
                    
                    if (!isNaN(a1) && !isNaN(a2) && !isNaN(b1) && !isNaN(b2) &&
                        a1 >= 0 && a2 >= 0 && b1 >= 0 && b2 >= 0) {
                        scores.push({
                            saved: saved,
                            a1: a1,
                            a2: a2,
                            b1: b1,
                            b2: b2
                        });
                    } else {
                        scores.push({
                            saved: false,
                            a1: 0,
                            a2: 0,
                            b1: 0,
                            b2: 0
                        });
                    }
                } else {
                    scores.push({
                        saved: false,
                        a1: 0,
                        a2: 0,
                        b1: 0,
                        b2: 0
                    });
                }
            } else {
                scores.push({
                    saved: false,
                    a1: 0,
                    a2: 0,
                    b1: 0,
                    b2: 0
                });
            }
        }
        
        var anySaved = false;
        for (var i = 0; i < scores.length; i++) {
            if (scores[i].saved) { anySaved = true; break; }
        }
        if (!anySaved) return null;
        
        return scores;
    }
    
    function parseHoleData(dataStr, holeNumber) {
        if (!dataStr || dataStr.length === 0) return null;
        if (holeNumber < 1 || holeNumber > 18) return null;
        
        var charsPerHole = 9;
        var startIndex = (holeNumber - 1) * charsPerHole;
        
        if (startIndex + charsPerHole > dataStr.length) {
            return { saved: false, scores: { a1: 0, a2: 0, b1: 0, b2: 0 } };
        }
        
        var segment = dataStr.substr(startIndex, charsPerHole);
        if (segment.length !== charsPerHole) {
            return { saved: false, scores: { a1: 0, a2: 0, b1: 0, b2: 0 } };
        }
        
        var saved = segment[0] === 'T';
        var a1 = parseInt(segment.substr(1, 2), 10);
        var a2 = parseInt(segment.substr(3, 2), 10);
        var b1 = parseInt(segment.substr(5, 2), 10);
        var b2 = parseInt(segment.substr(7, 2), 10);
        
        if (isNaN(a1) || isNaN(a2) || isNaN(b1) || isNaN(b2) ||
            a1 < 0 || a2 < 0 || b1 < 0 || b2 < 0) {
            return { saved: false, scores: { a1: 0, a2: 0, b1: 0, b2: 0 } };
        }
        
        return {
            saved: saved,
            scores: { a1: a1, a2: a2, b1: b1, b2: b2 }
        };
    }
    
    // ============================================================
    // STROKE HELPERS
    // ============================================================
    
    function getStrokeHoles(handicapDiff, courseSi) {
        if (handicapDiff <= 0) return [];
        if (!courseSi || courseSi.length === 0) {
            courseSi = [];
            for (var i = 0; i < 18; i++) courseSi[i] = i + 1;
        }
        var holesWithSi = [];
        for (var i = 0; i < 18; i++) { holesWithSi.push({ hole: i+1, si: courseSi[i] || 1 }); }
        holesWithSi.sort(function(a, b) { return a.si - b.si; });
        var strokeHoles = [];
        for (var i = 0; i < handicapDiff && i < 18; i++) { strokeHoles.push(holesWithSi[i].hole); }
        return strokeHoles;
    }
    
    function getStrokesForHole(holeNumber, handicapDiff, courseSi) {
        if (handicapDiff <= 0) return 0;
        var strokeHoles = getStrokeHoles(handicapDiff, courseSi);
        for (var i = 0; i < strokeHoles.length; i++) { if (strokeHoles[i] === holeNumber) return 1; }
        return 0;
    }
    
    function getNetScoreMatchGame(gross, handicapDiff, holeNumber, courseSi, isReceiving) {
        if (!isReceiving) return gross;
        var strokes = getStrokesForHole(holeNumber, handicapDiff, courseSi);
        return gross - strokes;
    }
    
    // ============================================================
    // PLAYER SCORE HELPERS
    // ============================================================
    
    function getPlayerScore(player, flightData, holeNumber, allPlayers, coursePar) {
        var holeData = parseHoleData(flightData, holeNumber);
        if (!holeData || !holeData.saved) return null;
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === player.flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        if (player.team === 'A') {
            if (teamA[0] && teamA[0].name === player.name) return holeData.scores.a1;
            if (teamA[1] && teamA[1].name === player.name) return holeData.scores.a2;
        } else {
            if (teamB[0] && teamB[0].name === player.name) return holeData.scores.b1;
            if (teamB[1] && teamB[1].name === player.name) return holeData.scores.b2;
        }
        return null;
    }
    
    function getPlayerGrossFromScores(player, holeNumber, f1Scores, f2Scores) {
        var holeData = player.flight === 1 ? f1Scores[holeNumber - 1] : f2Scores[holeNumber - 1];
        if (!holeData || !holeData.saved) return null;
        
        if (player.team === 'A') {
            var allPlayers = window._validatePlayers || [];
            var flightTeamPlayers = allPlayers.filter(function(p) {
                return p.flight === player.flight && p.team === 'A';
            }).sort(function(a, b) { return a.handicap - b.handicap; });
            
            if (flightTeamPlayers.length === 0) {
                if (holeData.a1 !== undefined) return holeData.a1;
            }
            
            if (flightTeamPlayers[0] && flightTeamPlayers[0].name === player.name) {
                return holeData.a1;
            } else if (flightTeamPlayers[1] && flightTeamPlayers[1].name === player.name) {
                return holeData.a2;
            }
            
            if (holeData.a1 !== undefined) return holeData.a1;
        } else {
            var allPlayers = window._validatePlayers || [];
            var flightTeamPlayers = allPlayers.filter(function(p) {
                return p.flight === player.flight && p.team === 'B';
            }).sort(function(a, b) { return a.handicap - b.handicap; });
            
            if (flightTeamPlayers.length === 0) {
                if (holeData.b1 !== undefined) return holeData.b1;
            }
            
            if (flightTeamPlayers[0] && flightTeamPlayers[0].name === player.name) {
                return holeData.b1;
            } else if (flightTeamPlayers[1] && flightTeamPlayers[1].name === player.name) {
                return holeData.b2;
            }
            
            if (holeData.b1 !== undefined) return holeData.b1;
        }
        return null;
    }
    
    // ============================================================
    // MATCH RESULT HELPERS
    // ============================================================
    
    function getIntraMatchResultForHole(playerA, playerB, flightData, allPlayers, courseSi, holeNumber, coursePar) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceiving = (playerA.handicap > playerB.handicap);
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === playerA.flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var holeData = parseHoleData(flightData, holeNumber);
        if (!holeData || !holeData.saved) return 0;
        
        var playerAScore = null, playerBScore = null;
        if (playerA.team === 'A') {
            if (teamA[0] && teamA[0].name === playerA.name) playerAScore = holeData.scores.a1;
            else if (teamA[1] && teamA[1].name === playerA.name) playerAScore = holeData.scores.a2;
        } else {
            if (teamB[0] && teamB[0].name === playerA.name) playerAScore = holeData.scores.b1;
            else if (teamB[1] && teamB[1].name === playerA.name) playerAScore = holeData.scores.b2;
        }
        if (playerB.team === 'A') {
            if (teamA[0] && teamA[0].name === playerB.name) playerBScore = holeData.scores.a1;
            else if (teamA[1] && teamA[1].name === playerB.name) playerBScore = holeData.scores.a2;
        } else {
            if (teamB[0] && teamB[0].name === playerB.name) playerBScore = holeData.scores.b1;
            else if (teamB[1] && teamB[1].name === playerB.name) playerBScore = holeData.scores.b2;
        }
        if (playerAScore === null || playerBScore === null) return 0;
        
        var netA = playerAScore, netB = playerBScore;
        if (isPlayerAReceiving) netA = getNetScoreMatchGame(playerAScore, handicapDiff, holeNumber, courseSi, true);
        else netB = getNetScoreMatchGame(playerBScore, handicapDiff, holeNumber, courseSi, true);
        
        if (netA < netB) return 1;
        if (netB < netA) return -1;
        return 0;
    }
    
    function getCrossMatchResultForHole(playerA, playerB, flight1Data, flight2Data, allPlayers, courseSi, holeNumber, coursePar) {
        var handicapDiff = Math.abs(playerA.handicap - playerB.handicap);
        var isPlayerAReceiving = (playerA.handicap > playerB.handicap);
        
        var f1HoleData = parseHoleData(flight1Data, holeNumber);
        var f2HoleData = parseHoleData(flight2Data, holeNumber);
        if (!f1HoleData || !f1HoleData.saved || !f2HoleData || !f2HoleData.saved) return 0;
        
        var playerAScore = null, playerBScore = null;
        if (playerA.flight === 1) { playerAScore = getPlayerScore(playerA, flight1Data, holeNumber, allPlayers, coursePar); }
        else { playerAScore = getPlayerScore(playerA, flight2Data, holeNumber, allPlayers, coursePar); }
        if (playerB.flight === 1) { playerBScore = getPlayerScore(playerB, flight1Data, holeNumber, allPlayers, coursePar); }
        else { playerBScore = getPlayerScore(playerB, flight2Data, holeNumber, allPlayers, coursePar); }
        if (playerAScore === null || playerBScore === null) return 0;
        
        var netA = playerAScore, netB = playerBScore;
        if (isPlayerAReceiving) netA = getNetScoreMatchGame(playerAScore, handicapDiff, holeNumber, courseSi, true);
        else netB = getNetScoreMatchGame(playerBScore, handicapDiff, holeNumber, courseSi, true);
        
        if (netA < netB) return 1;
        if (netB < netA) return -1;
        return 0;
    }
    
    // ============================================================
    // TEAM GAME CALCULATION
    // ============================================================
    
    function getNetScoreTeamGame(gross, handicap, si) {
        var strokes = 0;
        if (handicap > 0 && si <= handicap) strokes = 1;
        return gross - strokes;
    }
    
    function calculateTeamGame(flightScores, players, flightNum, courseSi) {
        var flightPlayers = players.filter(function(p) { return p.flight === flightNum; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var results = [], running = 0;
        for (var idx = 0; idx < 18; idx++) {
            var hole = flightScores[idx];
            if (!hole || !hole.saved) {
                results.push({ hole: idx+1, match1: null, match2: null, holeResult: null, running: null, display: '-', trPointsA: 0, trPointsB: 0, teamGameTR: { A: 0, B: 0 } });
                continue;
            }
            var si = courseSi && courseSi[idx] ? courseSi[idx] : 1;
            var teamAGross = [hole.a1, hole.a2];
            var teamBGross = [hole.b1, hole.b2];
            var teamANets = [], teamBNets = [];
            for (var i = 0; i < teamA.length; i++) { teamANets.push({ player: teamA[i], net: getNetScoreTeamGame(teamAGross[i], teamA[i].handicap, si) }); }
            for (var i = 0; i < teamB.length; i++) { teamBNets.push({ player: teamB[i], net: getNetScoreTeamGame(teamBGross[i], teamB[i].handicap, si) }); }
            teamANets.sort(function(a,b) { return a.net - b.net; });
            teamBNets.sort(function(a,b) { return a.net - b.net; });
            var match1 = 0, match2 = 0;
            if (teamANets[0].net < teamBNets[0].net) match1 = 1;
            else if (teamANets[0].net > teamBNets[0].net) match1 = -1;
            if (teamANets[1].net < teamBNets[1].net) match2 = 1;
            else if (teamANets[1].net > teamBNets[1].net) match2 = -1;
            var holeResult = match1 + match2;
            running += holeResult;
            var display = 'AS';
            if (running > 0) display = 'A' + running;
            else if (running < 0) display = 'B' + Math.abs(running);
            var trPointsA, trPointsB;
            if (running > 0) { trPointsA = 1; trPointsB = 0; }
            else if (running < 0) { trPointsA = 0; trPointsB = 1; }
            else { trPointsA = 0.5; trPointsB = 0.5; }
            results.push({
                hole: idx+1,
                match1: match1,
                match2: match2,
                holeResult: holeResult,
                running: running,
                display: display,
                trPointsA: trPointsA,
                trPointsB: trPointsB,
                teamGameTR: { A: trPointsA, B: trPointsB }
            });
        }
        return results;
    }
    
    // ============================================================
    // STROKE GAME CALCULATION
    // ============================================================
    
    function calculateStrokeGame(f1Scores, f2Scores, players) {
        var teamA = players.filter(function(p) { return p.team === 'A'; });
        var teamB = players.filter(function(p) { return p.team === 'B'; });
        var totalHcpA = teamA.reduce(function(sum, p) { return sum + p.handicap; }, 0);
        var totalHcpB = teamB.reduce(function(sum, p) { return sum + p.handicap; }, 0);
        var results = [], cumA = 0, cumB = 0;
        for (var pos = 0; pos < 18; pos++) {
            var f1 = f1Scores[pos], f2 = f2Scores[pos];
            if (!f1 || !f1.saved || !f2 || !f2.saved) {
                results.push({ hole: pos+1, display: '-', grossA: null, grossB: null, netA: null, netB: null, diff: null, trPointsA: 0, trPointsB: 0, strokeTR: { A: 0, B: 0 } });
                continue;
            }
            var grossA = f1.a1 + f1.a2 + f2.a1 + f2.a2;
            var grossB = f1.b1 + f1.b2 + f2.b1 + f2.b2;
            cumA += grossA; cumB += grossB;
            var netA = cumA - totalHcpA;
            var netB = cumB - totalHcpB;
            var diff = netB - netA;
            var display = 'AS';
            if (Math.abs(diff) < 0.01) display = 'AS';
            else if (diff > 0) display = 'A' + Math.round(diff);
            else display = 'B' + Math.round(Math.abs(diff));
            var trPointsA, trPointsB;
            if (Math.abs(diff) < 0.01) { trPointsA = 0.5; trPointsB = 0.5; }
            else if (diff > 0) { trPointsA = 1; trPointsB = 0; }
            else { trPointsA = 0; trPointsB = 1; }
            results.push({
                hole: pos+1,
                grossA: grossA,
                grossB: grossB,
                netA: netA,
                netB: netB,
                diff: diff,
                display: display,
                trPointsA: trPointsA,
                trPointsB: trPointsB,
                strokeTR: { A: trPointsA, B: trPointsB }
            });
        }
        return results;
    }
    
    // ============================================================
    // MATCH GAME CALCULATION (with clinch detection)
    // ============================================================
    
    function calculateMatchGamePerHole(f1Scores, f2Scores, allPlayers, courseSi, coursePar) {
        var flight1Data = f1Scores.map(function(h) { if (!h) return ''; return 'T' + String(h.a1).padStart(2,'0') + String(h.a2).padStart(2,'0') + String(h.b1).padStart(2,'0') + String(h.b2).padStart(2,'0'); }).join('');
        var flight2Data = f2Scores.map(function(h) { if (!h) return ''; return 'T' + String(h.a1).padStart(2,'0') + String(h.a2).padStart(2,'0') + String(h.b1).padStart(2,'0') + String(h.b2).padStart(2,'0'); }).join('');
        
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === 'A'; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === 'B'; });
        teamAPlayers.sort(function(a, b) { if (a.flight !== b.flight) return a.flight - b.flight; return a.handicap - b.handicap; });
        teamBPlayers.sort(function(a, b) { if (a.flight !== b.flight) return a.flight - b.flight; return a.handicap - b.handicap; });
        
        var orderedPlayers = [];
        for (var i = 0; i < teamAPlayers.length; i++) orderedPlayers.push(teamAPlayers[i]);
        for (var i = 0; i < teamBPlayers.length; i++) orderedPlayers.push(teamBPlayers[i]);
        
        var allMatches = [];
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                allMatches.push({ playerA: teamAPlayers[a], playerB: teamBPlayers[b] });
            }
        }
        
        var results = [];
        var matchPointsPerHole = [];
        var cumulativeLeads = {};
        var matchClinched = {};
        var playerClinchHole = {};
        for (var p = 0; p < orderedPlayers.length; p++) {
            playerClinchHole[orderedPlayers[p].name] = null;
        }
        for (var m = 0; m < allMatches.length; m++) {
            var match = allMatches[m];
            var keyA = match.playerA.name + "_vs_" + match.playerB.name;
            var keyB = match.playerB.name + "_vs_" + match.playerA.name;
            cumulativeLeads[keyA] = 0;
            cumulativeLeads[keyB] = 0;
            matchClinched[keyA] = false;
            matchClinched[keyB] = false;
        }
        
        for (var hole = 1; hole <= 18; hole++) {
            var holePoints = {};
            var holeClinchInfo = {};
            var holeMatchPoints = {};
            for (var p = 0; p < orderedPlayers.length; p++) {
                holePoints[orderedPlayers[p].name] = 0;
                holeClinchInfo[orderedPlayers[p].name] = { clinched: false, asAtH18: false };
            }
            var remainingHoles = 18 - hole;
            
            for (var m = 0; m < allMatches.length; m++) {
                var match = allMatches[m];
                var margin;
                if (match.playerA.flight === match.playerB.flight) {
                    var flightData = match.playerA.flight === 1 ? flight1Data : flight2Data;
                    margin = getIntraMatchResultForHole(match.playerA, match.playerB, flightData, allPlayers, courseSi, hole, coursePar);
                } else {
                    margin = getCrossMatchResultForHole(match.playerA, match.playerB, flight1Data, flight2Data, allPlayers, courseSi, hole, coursePar);
                }
                
                var keyA = match.playerA.name + "_vs_" + match.playerB.name;
                var keyB = match.playerB.name + "_vs_" + match.playerA.name;
                
                if (margin > 0) {
                    cumulativeLeads[keyA] += 1;
                    cumulativeLeads[keyB] -= 1;
                } else if (margin < 0) {
                    cumulativeLeads[keyA] -= 1;
                    cumulativeLeads[keyB] += 1;
                }
                
                var leadA = cumulativeLeads[keyA];
                var leadB = cumulativeLeads[keyB];
                
                var pointsA, pointsB;
                if (leadA > 0) { pointsA = 1; }
                else if (leadA < 0) { pointsA = 0; }
                else { pointsA = 0.5; }
                if (leadB > 0) { pointsB = 1; }
                else if (leadB < 0) { pointsB = 0; }
                else { pointsB = 0.5; }
                
                var matchKey = match.playerA.name + "_vs_" + match.playerB.name;
                holeMatchPoints[matchKey] = { pointsA: pointsA, pointsB: pointsB };
                
                var isClinchHole = false;
                var clinchWinner = null;
                var clinchLoser = null;
                var alreadyClinched = matchClinched[keyA] || matchClinched[keyB];
                
                if (!alreadyClinched) {
                    if (leadA > remainingHoles && leadA !== 0) {
                        isClinchHole = true;
                        clinchWinner = match.playerA.name;
                        clinchLoser = match.playerB.name;
                        matchClinched[keyA] = true;
                        matchClinched[keyB] = true;
                        if (!playerClinchHole[clinchWinner]) {
                            playerClinchHole[clinchWinner] = hole;
                        }
                    } else if (leadB > remainingHoles && leadB !== 0) {
                        isClinchHole = true;
                        clinchWinner = match.playerB.name;
                        clinchLoser = match.playerA.name;
                        matchClinched[keyA] = true;
                        matchClinched[keyB] = true;
                        if (!playerClinchHole[clinchWinner]) {
                            playerClinchHole[clinchWinner] = hole;
                        }
                    }
                }
                
                var isASAtH18 = (hole === 18 && leadA === 0 && leadB === 0);
                
                if (isClinchHole) {
                    holePoints[match.playerA.name] += pointsA;
                    if (clinchWinner === match.playerA.name) {
                        holeClinchInfo[match.playerA.name].clinched = true;
                        holeClinchInfo[match.playerA.name].clinchOpponent = match.playerB.name;
                        holeClinchInfo[match.playerA.name].clinchHole = hole;
                    }
                    if (clinchWinner === match.playerB.name) {
                        holeClinchInfo[match.playerB.name].clinched = true;
                        holeClinchInfo[match.playerB.name].clinchOpponent = match.playerA.name;
                        holeClinchInfo[match.playerB.name].clinchHole = hole;
                    }
                    holePoints[match.playerB.name] += pointsB;
                } else if (isASAtH18) {
                    holePoints[match.playerA.name] += pointsA;
                    holePoints[match.playerB.name] += pointsB;
                    holeClinchInfo[match.playerA.name].asAtH18 = true;
                    holeClinchInfo[match.playerB.name].asAtH18 = true;
                } else {
                    holePoints[match.playerA.name] += pointsA;
                    holePoints[match.playerB.name] += pointsB;
                }
            }
            
            results.push({
                hole: hole,
                points: holePoints,
                clinchInfo: holeClinchInfo,
                playerClinchHole: playerClinchHole
            });
            matchPointsPerHole.push(holeMatchPoints);
        }
        
        // ============================================================
        // v1.28: DEBUG - Log H10 Match Game calculation
        // ============================================================
        if (matchPointsPerHole && matchPointsPerHole.length > 9) {
            var h10Data = matchPointsPerHole[9] || {};
            console.log('=== MATCH GAME DEBUG H10 ===');
            var debugA = 0, debugB = 0;
            for (var key in h10Data) {
                var match = h10Data[key];
                debugA += match.pointsA || 0;
                debugB += match.pointsB || 0;
                console.log('  ' + key + ' → ' + match.pointsA + '-' + match.pointsB);
            }
            console.log('  TOTAL: ' + debugA + '-' + debugB);
            console.log('  Expected: 8.0-8.0');
        }
        
        return {
            orderedPlayers: orderedPlayers,
            results: results,
            matchPointsPerHole: matchPointsPerHole,
            playerClinchHole: playerClinchHole
        };
    }
    
    // ============================================================
    // BUILD COMPLETE RESULTS FROM RAW DATA
    // ============================================================
    
    function buildCompleteResultsFromRawData(f1Scores, f2Scores, players, courseSi, coursePar) {
        var t1Results = calculateTeamGame(f1Scores, players, 1, courseSi);
        var t2Results = calculateTeamGame(f2Scores, players, 2, courseSi);
        var strkResults = calculateStrokeGame(f1Scores, f2Scores, players);
        var matchData = calculateMatchGamePerHole(f1Scores, f2Scores, players, courseSi, coursePar);
        var orderedPlayers = matchData.orderedPlayers;
        var matchResults = matchData.results;
        var matchPointsPerHole = matchData.matchPointsPerHole;
        var playerClinchHole = matchData.playerClinchHole;
        
        var trTeamA = [];
        var trTeamB = [];
        var trTeamAGreen = [];
        var trTeamBGreen = [];
        
        for (var i = 0; i < 18; i++) {
            var t1 = t1Results[i] || {};
            var t2 = t2Results[i] || {};
            var strk = strkResults[i] || {};
            var holeMatchData = matchPointsPerHole[i] || {};
            
            var mA = 0, mB = 0;
            for (var matchKey in holeMatchData) {
                var match = holeMatchData[matchKey];
                mA += match.pointsA || 0;
                mB += match.pointsB || 0;
            }
            
            var t1A = t1.teamGameTR ? t1.teamGameTR.A : 0.5;
            var t1B = t1.teamGameTR ? t1.teamGameTR.B : 0.5;
            var t2A = t2.teamGameTR ? t2.teamGameTR.A : 0.5;
            var t2B = t2.teamGameTR ? t2.teamGameTR.B : 0.5;
            var sA = strk.strokeTR ? strk.strokeTR.A : 0.5;
            var sB = strk.strokeTR ? strk.strokeTR.B : 0.5;
            
            var trA = mA + t1A + t2A + sA;
            var trB = mB + t1B + t2B + sB;
            
            trTeamA.push(trA);
            trTeamB.push(trB);
            trTeamAGreen.push(trA > trB);
            trTeamBGreen.push(trB > trA);
        }
        
        window._validatePlayers = players;
        
        var playerTotals = {};
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            var totalGross = 0;
            var holesPlayed = 0;
            var totalPar = 0;
            for (var h = 0; h < 18; h++) {
                totalPar += coursePar[h] || 4;
                var score = getPlayerGrossFromScores(player, h + 1, f1Scores, f2Scores);
                if (score !== null) {
                    totalGross += score;
                    holesPlayed++;
                }
            }
            if (holesPlayed > 0) {
                playerTotals[player.name] = {
                    name: player.name,
                    label: player.label,
                    team: player.team,
                    flight: player.flight,
                    totalGross: totalGross,
                    holesPlayed: holesPlayed,
                    totalPar: totalPar,
                    relativeToPar: totalGross - totalPar
                };
            }
        }
        
        var clinchedAt = {};
        for (var h = 0; h < matchResults.length; h++) {
            var holeData = matchResults[h];
            var clinchInfo = holeData.clinchInfo;
            for (var playerName in clinchInfo) {
                if (clinchInfo[playerName] && clinchInfo[playerName].clinched) {
                    var opponent = clinchInfo[playerName].clinchOpponent;
                    var clinchHole = clinchInfo[playerName].clinchHole;
                    clinchedAt[playerName + "_vs_" + opponent] = {
                        clinchedAtHole: clinchHole,
                        winner: playerName,
                        loser: opponent,
                        leadAtClinch: null,
                        remainingHolesAtClinch: 18 - clinchHole
                    };
                }
            }
        }
        
        var displayT1 = t1Results.map(function(r) { return r.display || 'AS'; });
        var displayT2 = t2Results.map(function(r) { return r.display || 'AS'; });
        var displayStrk = strkResults.map(function(r) { return r.display || 'AS'; });
        
        var teamAPlayers = players.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        var teamBPlayers = players.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        
        var flight1Data = f1Scores.map(function(h) { if (!h) return ''; return 'T' + String(h.a1).padStart(2,'0') + String(h.a2).padStart(2,'0') + String(h.b1).padStart(2,'0') + String(h.b2).padStart(2,'0'); }).join('');
        var flight2Data = f2Scores.map(function(h) { if (!h) return ''; return 'T' + String(h.a1).padStart(2,'0') + String(h.a2).padStart(2,'0') + String(h.b1).padStart(2,'0') + String(h.b2).padStart(2,'0'); }).join('');
        
        var matchResultsArray = [];
        for (var pos = 0; pos < 18; pos++) {
            var row = [];
            for (var a = 0; a < teamAPlayers.length; a++) {
                for (var b = 0; b < teamBPlayers.length; b++) {
                    var margin = getCrossMatchResultForHole(teamAPlayers[a], teamBPlayers[b], flight1Data, flight2Data, players, courseSi, pos + 1, coursePar);
                    row.push(margin);
                }
            }
            matchResultsArray.push(row);
        }
        
        var f1IntraMatches = [];
        var f2IntraMatches = [];
        for (var pos = 0; pos < 18; pos++) {
            var f1HoleData = parseHoleData(flight1Data, pos + 1);
            var f2HoleData = parseHoleData(flight2Data, pos + 1);
            var f1MatchResults = {};
            var f2MatchResults = {};
            var f1Players = players.filter(function(p) { return p.flight === 1; });
            var f1TeamA = f1Players.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var f1TeamB = f1Players.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            for (var a = 0; a < f1TeamA.length; a++) {
                for (var b = 0; b < f1TeamB.length; b++) {
                    var margin = getIntraMatchResultForHole(f1TeamA[a], f1TeamB[b], flight1Data, players, courseSi, pos + 1, coursePar);
                    f1MatchResults[f1TeamA[a].name + "_vs_" + f1TeamB[b].name] = margin;
                    f1MatchResults[f1TeamB[b].name + "_vs_" + f1TeamA[a].name] = -margin;
                }
            }
            var f2Players = players.filter(function(p) { return p.flight === 2; });
            var f2TeamA = f2Players.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var f2TeamB = f2Players.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            for (var a = 0; a < f2TeamA.length; a++) {
                for (var b = 0; b < f2TeamB.length; b++) {
                    var margin = getIntraMatchResultForHole(f2TeamA[a], f2TeamB[b], flight2Data, players, courseSi, pos + 1, coursePar);
                    f2MatchResults[f2TeamA[a].name + "_vs_" + f2TeamB[b].name] = margin;
                    f2MatchResults[f2TeamB[b].name + "_vs_" + f2TeamA[a].name] = -margin;
                }
            }
            f1IntraMatches.push(f1MatchResults);
            f2IntraMatches.push(f2MatchResults);
        }
        
        var matchPlayPointsA = [];
        var matchPlayPointsB = [];
        for (var pos = 0; pos < 18; pos++) {
            var holeMatchData = matchPointsPerHole[pos] || {};
            var mA = 0, mB = 0;
            for (var matchKey in holeMatchData) {
                mA += holeMatchData[matchKey].pointsA || 0;
                mB += holeMatchData[matchKey].pointsB || 0;
            }
            matchPlayPointsA.push(mA);
            matchPlayPointsB.push(mB);
        }
        
        var teamGame = {
            flight1: {
                leader: t1Results.map(function(r) { return r.display || 'AS'; }),
                cumulativePoints: t1Results.map(function(r) { return r.running || 0; }),
                clinchedHole: null
            },
            flight2: {
                leader: t2Results.map(function(r) { return r.display || 'AS'; }),
                cumulativePoints: t2Results.map(function(r) { return r.running || 0; }),
                clinchedHole: null
            },
            pointsA: t1Results.map(function(r, i) { return (t1Results[i].trPointsA || 0) + (t2Results[i].trPointsA || 0); }),
            pointsB: t1Results.map(function(r, i) { return (t1Results[i].trPointsB || 0) + (t2Results[i].trPointsB || 0); }),
            displayT1: displayT1,
            displayT2: displayT2
        };
        
        var strokeGame = {
            leader: strkResults.map(function(r) { return r.display || 'AS'; }),
            displayStrk: displayStrk,
            pointsA: strkResults.map(function(r) { return r.trPointsA || 0; }),
            pointsB: strkResults.map(function(r) { return r.trPointsB || 0; }),
            nettA: strkResults.map(function(r) { return r.netA || 0; }),
            nettB: strkResults.map(function(r) { return r.netB || 0; })
        };
        
        var finalResults = {
            version: 1,
            matchPlay: {
                pointsA: matchPlayPointsA,
                pointsB: matchPlayPointsB
            },
            teamGame: teamGame,
            strokeGame: strokeGame,
            matchResults: matchResultsArray,
            f1IntraMatches: f1IntraMatches,
            f2IntraMatches: f2IntraMatches,
            tr: {
                teamA: trTeamA,
                teamB: trTeamB,
                teamAGreen: trTeamAGreen,
                teamBGreen: trTeamBGreen
            },
            clinchedAt: clinchedAt,
            playerTotals: playerTotals,
            playerClinchHole: playerClinchHole,
            computedUpToHole: 18,
            lastComputedAt: new Date().toISOString()
        };
        
        return finalResults;
    }
    
    // ============================================================
    // DEEP EQUAL HELPER
    // ============================================================
    
    function deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return a === b;
        if (typeof a === 'undefined' || typeof b === 'undefined') return a === b;
        
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }
        if (a instanceof Date) return false;
        if (b instanceof Date) return false;
        
        if (a && typeof a.toDate === 'function') {
            if (b && typeof b.toDate === 'function') {
                return a.toDate().getTime() === b.toDate().getTime();
            }
            return false;
        }
        if (b && typeof b.toDate === 'function') {
            return false;
        }
        
        if (typeof a !== 'object' || typeof b !== 'object') return a === b;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (var i = 0; i < a.length; i++) {
                if (!deepEqual(a[i], b[i])) return false;
            }
            return true;
        }
        var keysA = Object.keys(a);
        var keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (var k = 0; k < keysA.length; k++) {
            var key = keysA[k];
            if (!deepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    
    // ============================================================
    // PHOTO POINTER VALIDATION
    // ============================================================
    
    function validatePhotoPointer(recordData) {
        if (!recordData) {
            return { hasPhoto: false, path: null, url: null, expectedPath: null };
        }
        
        var celebration = recordData.celebration || {};
        var hasPhoto = !!(celebration.imageUrl && celebration.imageRef);
        
        var expectedPath = null;
        if (recordData.id) {
            expectedPath = 'celebration/' + recordData.id + '.jpg';
        }
        
        return {
            hasPhoto: hasPhoto,
            path: celebration.imageRef || null,
            url: celebration.imageUrl || null,
            expectedPath: expectedPath
        };
    }
    
    // ============================================================
    // v1.27: HANDICAP ADJUSTMENT VALIDATION - Use correct recalculated data
    // ============================================================
    
    /**
     * Recalculate handicaps from record data using hcp-adjust.js
     *
     * @param {Object} recordData - The record data object
     * @returns {Object} - { success: boolean, result: calculationResult, error: string }
     */
    function recalculateHandicapsFromRecord(recordData) {
        if (!recordData) {
            return { success: false, error: 'No record data provided' };
        }
        
        // Check if GameLoader is available
        if (typeof GameLoader === 'undefined') {
            console.error('[UTIL-VALIDATE] GameLoader not available');
            return { success: false, error: 'GameLoader not available' };
        }
        
        // Check if HandicapAdjustment is available
        if (typeof HandicapAdjustment === 'undefined') {
            console.error('[UTIL-VALIDATE] HandicapAdjustment not available');
            return { success: false, error: 'HandicapAdjustment not available' };
        }
        
        // Check if buildCacheFromDoc is available
        if (typeof GameLoader.buildCacheFromDoc !== 'function') {
            console.error('[UTIL-VALIDATE] GameLoader.buildCacheFromDoc not available');
            return { success: false, error: 'GameLoader.buildCacheFromDoc not available' };
        }
        
        try {
            // Build cache from record data
            var cache = GameLoader.buildCacheFromDoc(recordData);
            
            // Set the cache in GameLoader
            GameLoader.setLocalCache(cache);
            
            // Get players from record
            var players = recordData.players || [];
            if (players.length === 0) {
                return { success: false, error: 'No players found in record' };
            }
            
            // Sort players by handicap to find anchor
            var sortedPlayers = players.slice().sort(function(a, b) { return a.handicap - b.handicap; });
            
            // Determine anchor: use stored anchor or lowest handicap
            var anchorName = recordData.anchor || sortedPlayers[0].name;
            var anchor = players.find(function(p) { return p.name === anchorName; });
            if (!anchor) {
                anchor = sortedPlayers[0];
                anchorName = anchor.name;
            }
            
            // Get flight data strings
            var f1DataString = recordData.f1DataString || '';
            var f2DataString = recordData.f2DataString || '';
            var courseSi = recordData.course?.si || [];
            var coursePar = recordData.course?.par || [];
            
            console.log('[UTIL-VALIDATE] Recalculating handicaps...');
            console.log('[UTIL-VALIDATE]   anchor:', anchorName);
            console.log('[UTIL-VALIDATE]   players:', players.length);
            console.log('[UTIL-VALIDATE]   f1DataString length:', f1DataString.length);
            console.log('[UTIL-VALIDATE]   f2DataString length:', f2DataString.length);
            
            // Use calculateAllAdjustmentsFromRaw (v2.53+)
            var calculationResult;
            if (typeof HandicapAdjustment.calculateAllAdjustmentsFromRaw === 'function') {
                calculationResult = HandicapAdjustment.calculateAllAdjustmentsFromRaw(
                    anchor,
                    players,
                    f1DataString,
                    f2DataString,
                    courseSi,
                    coursePar
                );
            } else {
                console.warn('[UTIL-VALIDATE] calculateAllAdjustmentsFromRaw not available, trying calculateAllAdjustments');
                calculationResult = HandicapAdjustment.calculateAllAdjustments(anchor);
            }
            
            if (!calculationResult || !calculationResult.players) {
                console.error('[UTIL-VALIDATE] Calculation result invalid:', calculationResult);
                return { success: false, error: 'Calculation returned invalid result' };
            }
            
            console.log('[UTIL-VALIDATE] Calculation successful, players:', calculationResult.players.length);
            
            return {
                success: true,
                result: calculationResult,
                anchor: anchor,
                anchorName: anchor.name
            };
            
        } catch (err) {
            console.error('[UTIL-VALIDATE] Error recalculating handicaps:', err);
            return { success: false, error: err.message || 'Unknown error' };
        }
    }
    
    // ============================================================
    // v1.27: COMPARE HANDICAP FIELDS - with newAnchor fallback
    // ============================================================
    
    /**
     * Compare stored handicap fields with recalculated values
     *
     * @param {Object} storedHandicaps - The adjustedHandicaps object from record
     * @param {Object} recalculated - The recalculated result from hcp-adjust.js
     * @param {Array} players - The players array from record
     * @param {boolean} forceFix - If true, force fix even if comparison says valid
     * @returns {Object} - { valid: boolean, mismatches: [], matches: [], summary: {} }
     */
    function compareHandicapFields(storedHandicaps, recalculated, players, forceFix) {
        var mismatches = [];
        var matches = [];
        var summary = {
            totalFields: 0,
            mismatched: 0,
            matched: 0
        };
        
        // If forceFix is true, force a fix by reporting mismatches
        if (forceFix) {
            console.log('[UTIL-VALIDATE] ⚠️ Force fix mode enabled - will fix handicaps regardless');
            return {
                valid: false,
                mismatches: [{ field: 'FORCE_FIX', current: 'stale', expected: 'recalculated' }],
                matches: [],
                summary: { totalFields: 1, mismatched: 1, matched: 0 }
            };
        }
        
        if (!storedHandicaps) {
            return {
                valid: false,
                mismatches: [{ field: 'adjustedHandicaps', current: 'MISSING', expected: 'Present' }],
                matches: [],
                summary: { totalFields: 1, mismatched: 1, matched: 0 }
            };
        }
        
        if (!storedHandicaps.players || storedHandicaps.players.length === 0) {
            return {
                valid: false,
                mismatches: [{ field: 'adjustedHandicaps.players', current: 'EMPTY', expected: players.length + ' players' }],
                matches: [],
                summary: { totalFields: 1, mismatched: 1, matched: 0 }
            };
        }
        
        // Get recalculated players data
        var recalcPlayers = recalculated.players || [];
        if (recalcPlayers.length === 0) {
            return {
                valid: false,
                mismatches: [{ field: 'recalculated.players', current: 'EMPTY', expected: players.length + ' players' }],
                matches: [],
                summary: { totalFields: 1, mismatched: 1, matched: 0 }
            };
        }
        
        // Build map of recalculated data by player name
        var recalcMap = {};
        for (var i = 0; i < recalcPlayers.length; i++) {
            recalcMap[recalcPlayers[i].name] = recalcPlayers[i];
        }
        
        // Check each player in the stored data
        for (var i = 0; i < storedHandicaps.players.length; i++) {
            var stored = storedHandicaps.players[i];
            var recalc = recalcMap[stored.name];
            
            if (!recalc) {
                mismatches.push({
                    field: 'Player: ' + stored.name,
                    current: 'Not found in recalculated data',
                    expected: 'Present'
                });
                summary.mismatched++;
                continue;
            }
            
            var fieldsToCompare = [
                { key: 'startingHcp', label: 'Starting Hcp', recalcKey: 'startingHcp' },
                { key: 'anchorAdj', label: 'Anchor Adj', recalcKey: 'anchorAdj' },
                { key: 'perfAdj', label: 'Perf Adj', recalcKey: 'perfAdj' },
                { key: 'finalHcp', label: 'Final Hcp', recalcKey: 'newHcp', fallbackKeys: ['newAnchor', 'rawNew', 'currentHcp'] },
                { key: 'anchorRaw', label: 'Anchor Raw', recalcKey: 'anchorRaw' },
                { key: 'perfRaw', label: 'Perf Raw', recalcKey: 'perfRaw' }
            ];
            
            for (var f = 0; f < fieldsToCompare.length; f++) {
                var field = fieldsToCompare[f];
                var storedVal = stored[field.key];
                
                // Get recalculated value with fallbacks
                var recalcVal = recalc[field.recalcKey];
                if (recalcVal === undefined && field.fallbackKeys) {
                    for (var fb = 0; fb < field.fallbackKeys.length; fb++) {
                        recalcVal = recalc[field.fallbackKeys[fb]];
                        if (recalcVal !== undefined) break;
                    }
                }
                
                var storedDisplay = storedVal !== undefined ? storedVal : 'undefined';
                var recalcDisplay = recalcVal !== undefined ? recalcVal : 'undefined';
                
                var isEqual;
                if (typeof storedVal === 'number' && typeof recalcVal === 'number') {
                    isEqual = Math.abs(storedVal - recalcVal) < 0.01;
                } else {
                    isEqual = storedVal === recalcVal;
                }
                
                if (!isEqual) {
                    mismatches.push({
                        field: stored.name + ' - ' + field.label,
                        current: storedDisplay,
                        expected: recalcDisplay
                    });
                    summary.mismatched++;
                } else {
                    matches.push({
                        field: stored.name + ' - ' + field.label,
                        current: storedVal,
                        expected: recalcVal
                    });
                    summary.matched++;
                }
                summary.totalFields++;
            }
        }
        
        var topFields = [
            { key: 'anchor', label: 'Anchor', recalcKey: 'anchor', skipIfUndefined: true },
            { key: 'newAnchor', label: 'New Anchor', recalcKey: 'newAnchorName' },
            { key: 'needsZeroRise', label: 'Needs Zero Rise', recalcKey: 'needsZeroRise' },
            { key: 'zeroRiseAmount', label: 'Zero Rise Amount', recalcKey: 'zeroRiseAmount' }
        ];
        
        for (var t = 0; t < topFields.length; t++) {
            var top = topFields[t];
            var storedVal = storedHandicaps[top.key];
            var recalcVal = recalculated[top.recalcKey];
            
            if (top.skipIfUndefined && recalcVal === undefined) {
                matches.push({
                    field: top.label + ' (preserved)',
                    current: storedVal !== undefined ? storedVal : 'not set',
                    expected: storedVal !== undefined ? storedVal + ' (kept)' : 'not set'
                });
                summary.matched++;
                summary.totalFields++;
                continue;
            }
            
            var storedDisplay = storedVal !== undefined ? storedVal : 'undefined';
            var recalcDisplay = recalcVal !== undefined ? recalcVal : 'undefined';
            
            var isEqual;
            if (typeof storedVal === 'number' && typeof recalcVal === 'number') {
                isEqual = Math.abs(storedVal - recalcVal) < 0.01;
            } else {
                isEqual = storedVal === recalcVal;
            }
            
            if (!isEqual) {
                mismatches.push({
                    field: top.label,
                    current: storedDisplay,
                    expected: recalcDisplay
                });
                summary.mismatched++;
            } else {
                matches.push({
                    field: top.label,
                    current: storedVal,
                    expected: recalcVal
                });
                summary.matched++;
            }
            summary.totalFields++;
        }
        
        var calcAt = storedHandicaps.calculatedAt;
        if (calcAt) {
            matches.push({
                field: 'calculatedAt',
                current: calcAt,
                expected: 'Present'
            });
            summary.matched++;
        } else {
            matches.push({
                field: 'calculatedAt',
                current: 'MISSING',
                expected: 'Timestamp'
            });
            summary.matched++;
        }
        summary.totalFields++;
        
        return {
            valid: summary.mismatched === 0,
            mismatches: mismatches,
            matches: matches,
            summary: summary
        };
    }
    
    /**
     * Validate handicap adjustment in a record
     *
     * @param {Object} recordData - The record data object
     * @param {boolean} forceFix - If true, force fix even if data appears valid
     * @returns {Object} - { valid: boolean, needsFix: boolean, mismatches: [], matches: [],
     *                       summary: {}, recalculated: {}, storedHandicaps: {}, handicapValid: boolean }
     */
    function validateHandicapAdjustment(recordData, forceFix) {
        if (!recordData) {
            return { valid: false, error: 'No record data provided' };
        }
        
        var storedHandicaps = recordData.adjustedHandicaps ? JSON.parse(JSON.stringify(recordData.adjustedHandicaps)) : null;
        var players = recordData.players || [];
        
        if (!storedHandicaps) {
            return {
                valid: false,
                needsFix: true,
                handicapValid: false,
                storedHandicaps: null,
                recalculated: null,
                mismatches: [{ field: 'adjustedHandicaps', current: 'MISSING', expected: 'Present' }],
                matches: [],
                summary: { totalFields: 1, mismatched: 1, matched: 0 },
                error: 'Handicap data MISSING'
            };
        }
        
        var recalcResult = recalculateHandicapsFromRecord(recordData);
        if (!recalcResult.success) {
            return {
                valid: false,
                needsFix: true,
                handicapValid: false,
                storedHandicaps: storedHandicaps,
                recalculated: null,
                mismatches: [{ field: 'recalculation', current: 'ERROR: ' + (recalcResult.error || 'Unknown'), expected: 'Success' }],
                matches: [],
                summary: { totalFields: 1, mismatched: 1, matched: 0 },
                error: recalcResult.error
            };
        }
        
        var recalculated = recalcResult.result;
        var comparison = compareHandicapFields(storedHandicaps, recalculated, players, forceFix);
        
        return {
            valid: comparison.valid,
            needsFix: !comparison.valid,
            handicapValid: comparison.valid,
            storedHandicaps: storedHandicaps,
            recalculated: recalculated,
            mismatches: comparison.mismatches,
            matches: comparison.matches,
            summary: comparison.summary,
            anchor: recalcResult.anchor,
            anchorName: recalcResult.anchorName
        };
    }
    
    /**
     * v1.27: Build fix payload for handicaps - ALL fields from recalculated
     */
    function buildHandicapFixPayload(recordData, recalculated) {
        if (!recordData || !recalculated) {
            return { hasChanges: false, updatePayload: {}, fieldsUpdated: [] };
        }
        
        console.log('[UTIL-VALIDATE] === buildHandicapFixPayload ===');
        
        var updatePayload = {};
        var fieldsUpdated = [];
        
        var recalcPlayers = recalculated.players || [];
        var stored = recordData.adjustedHandicaps || {};
        var storedMap = {};
        if (stored.players) {
            stored.players.forEach(function(p) {
                storedMap[p.name] = p;
            });
        }
        
        console.log('[UTIL-VALIDATE] Recalculated players:');
        recalcPlayers.forEach(function(p, idx) {
            console.log('[UTIL-VALIDATE]   [' + idx + '] ' + p.name + ': anchorAdj=' + p.anchorAdj + ', anchorRaw=' + p.anchorRaw + ', rawNew=' + p.rawNew + ', newAnchor=' + p.newAnchor);
        });
        
        var handicapPlayers = recalcPlayers.map(function(p) {
            var finalHcp;
            if (p.newHcp !== undefined) {
                finalHcp = p.newHcp;
            } else if (p.newAnchor !== undefined) {
                finalHcp = p.newAnchor;
            } else if (p.rawNew !== undefined) {
                finalHcp = p.rawNew;
            } else if (p.currentHcp !== undefined) {
                finalHcp = p.currentHcp;
            } else {
                finalHcp = p.startingHcp || 0;
            }
            
            return {
                name: p.name,
                label: p.label || p.name.substring(0, 3).toUpperCase(),
                startingHcp: p.startingHcp !== undefined ? p.startingHcp : (p.currentHcp || 0),
                anchorAdj: p.anchorAdj !== undefined ? p.anchorAdj : 0,
                perfAdj: p.perfAdj !== undefined ? p.perfAdj : 0,
                finalHcp: finalHcp,
                anchorRaw: p.anchorRaw !== undefined ? p.anchorRaw : 0,
                perfRaw: p.perfRaw !== undefined ? p.perfRaw : 0
            };
        });
        
        console.log('[UTIL-VALIDATE] Generated payload:');
        handicapPlayers.forEach(function(p, idx) {
            console.log('[UTIL-VALIDATE]   [' + idx + '] ' + p.name + ': anchorAdj=' + p.anchorAdj + ', anchorRaw=' + p.anchorRaw + ', finalHcp=' + p.finalHcp);
        });
        
        var anchorValue = stored.anchor;
        if (!anchorValue) {
            anchorValue = recalculated.anchor || recordData.anchor;
        }
        if (!anchorValue && recordData.players) {
            var sorted = recordData.players.slice().sort(function(a, b) { return a.handicap - b.handicap; });
            anchorValue = sorted[0] ? sorted[0].name : null;
        }
        
        var newAnchorValue = recalculated.newAnchorName || null;
        
        var newHandicapData = {
            calculatedAt: new Date().toISOString(),
            anchor: anchorValue,
            newAnchor: newAnchorValue,
            needsZeroRise: recalculated.needsZeroRise || false,
            zeroRiseAmount: recalculated.zeroRiseAmount || 0,
            players: handicapPlayers
        };
        
        var storedStr = JSON.stringify(stored);
        var newStr = JSON.stringify(newHandicapData);
        
        console.log('[UTIL-VALIDATE] storedStr === newStr:', storedStr === newStr);
        
        if (storedStr !== newStr) {
            console.log('[UTIL-VALIDATE] ✅ Differences detected - writing handicap payload');
            updatePayload['adjustedHandicaps'] = newHandicapData;
            fieldsUpdated.push('adjustedHandicaps');
        } else {
            console.log('[UTIL-VALIDATE] ⚠️ No differences detected - skipping handicap write');
        }
        
        console.log('[UTIL-VALIDATE] === END buildHandicapFixPayload ===');
        
        return {
            hasChanges: Object.keys(updatePayload).length > 0,
            updatePayload: updatePayload,
            fieldsUpdated: fieldsUpdated,
            newHandicapData: newHandicapData
        };
    }
    
    // ============================================================
    // COMPREHENSIVE FIELD VALIDATION (v4.0 Schema)
    // ============================================================
    
    function validateAllFields(recordData, recalculated) {
        if (!recordData || !recalculated) {
            return { valid: true, mismatches: [], matches: [], summary: {} };
        }
        
        var mismatches = [];
        var matches = [];
        var summary = {
            totalFields: 0,
            mismatched: 0,
            matched: 0
        };
        
        // 1. TR Values
        var curTrA = (recordData.results?.tr?.teamA) || [];
        var curTrB = (recordData.results?.tr?.teamB) || [];
        var newTrA = recalculated.tr.teamA || [];
        var newTrB = recalculated.tr.teamB || [];
        
        for (var i = 0; i < 18; i++) {
            var curA = curTrA[i];
            var curB = curTrB[i];
            var newA = newTrA[i];
            var newB = newTrB[i];
            var match = (curA === newA && curB === newB);
            summary.totalFields++;
            if (match) {
                matches.push({ field: 'TR H' + (i+1), current: curA + '-' + curB, expected: newA + '-' + newB });
            } else {
                mismatches.push({ field: 'TR H' + (i+1), current: curA + '-' + curB, expected: newA + '-' + newB });
                summary.mismatched++;
            }
        }
        summary.matched = summary.totalFields - summary.mismatched;
        
        // 2. TR Green Flags
        var curGreenA = (recordData.results?.tr?.teamAGreen) || [];
        var curGreenB = (recordData.results?.tr?.teamBGreen) || [];
        var newGreenA = recalculated.tr.teamAGreen || [];
        var newGreenB = recalculated.tr.teamBGreen || [];
        for (var i = 0; i < 18; i++) {
            if (curGreenA[i] !== newGreenA[i] || curGreenB[i] !== newGreenB[i]) {
                mismatches.push({ field: 'TR Green H' + (i+1), current: curGreenA[i] + '-' + curGreenB[i], expected: newGreenA[i] + '-' + newGreenB[i] });
                summary.mismatched++;
            } else {
                matches.push({ field: 'TR Green H' + (i+1), current: curGreenA[i] + '-' + curGreenB[i], expected: newGreenA[i] + '-' + newGreenB[i] });
                summary.matched++;
            }
            summary.totalFields++;
        }
        
        // 3. T-1 Display
        var curT1 = (recordData.results?.game2?.displayT1) || [];
        var newT1 = recalculated.teamGame.displayT1 || [];
        for (var i = 0; i < 18; i++) {
            if (curT1[i] !== newT1[i]) {
                mismatches.push({ field: 'T-1 H' + (i+1), current: curT1[i] || '?', expected: newT1[i] || '?' });
                summary.mismatched++;
            } else {
                matches.push({ field: 'T-1 H' + (i+1), current: curT1[i] || '?', expected: newT1[i] || '?' });
                summary.matched++;
            }
            summary.totalFields++;
        }
        
        // 4. T-2 Display
        var curT2 = (recordData.results?.game2?.displayT2) || [];
        var newT2 = recalculated.teamGame.displayT2 || [];
        for (var i = 0; i < 18; i++) {
            if (curT2[i] !== newT2[i]) {
                mismatches.push({ field: 'T-2 H' + (i+1), current: curT2[i] || '?', expected: newT2[i] || '?' });
                summary.mismatched++;
            } else {
                matches.push({ field: 'T-2 H' + (i+1), current: curT2[i] || '?', expected: newT2[i] || '?' });
                summary.matched++;
            }
            summary.totalFields++;
        }
        
        // 5. Stroke Display
        var curStrk = (recordData.results?.game3?.displayStrk) || [];
        var newStrk = recalculated.strokeGame.displayStrk || [];
        for (var i = 0; i < 18; i++) {
            if (curStrk[i] !== newStrk[i]) {
                mismatches.push({ field: 'Strk H' + (i+1), current: curStrk[i] || '?', expected: newStrk[i] || '?' });
                summary.mismatched++;
            } else {
                matches.push({ field: 'Strk H' + (i+1), current: curStrk[i] || '?', expected: newStrk[i] || '?' });
                summary.matched++;
            }
            summary.totalFields++;
        }
        
        // 6-8. Removed in v4.0
        
        // 9. Player Totals
        var curTotals = recordData.results?.playerTotals || {};
        var newTotals = recalculated.playerTotals || {};
        if (!deepEqual(curTotals, newTotals)) {
            mismatches.push({ field: 'Player Totals', current: 'stale', expected: 'recalculated' });
            summary.mismatched++;
        } else {
            matches.push({ field: 'Player Totals', current: 'correct', expected: 'correct' });
            summary.matched++;
        }
        summary.totalFields++;
        
        // 10. ClinchedAt
        var curClinched = recordData.results?.clinchedAt || {};
        var newClinched = recalculated.clinchedAt || {};
        if (!deepEqual(curClinched, newClinched)) {
            mismatches.push({ field: 'ClinchedAt', current: Object.keys(curClinched).length + ' entries', expected: Object.keys(newClinched).length + ' entries' });
            summary.mismatched++;
        } else {
            matches.push({ field: 'ClinchedAt', current: Object.keys(curClinched).length + ' entries', expected: Object.keys(newClinched).length + ' entries' });
            summary.matched++;
        }
        summary.totalFields++;
        
        // 11. computedUpToHole
        var curComputed = recordData.results?.computedUpToHole;
        var newComputed = recalculated.computedUpToHole || 18;
        if (curComputed !== newComputed) {
            mismatches.push({ field: 'computedUpToHole', current: curComputed || '?', expected: newComputed });
            summary.mismatched++;
        } else {
            matches.push({ field: 'computedUpToHole', current: curComputed, expected: newComputed });
            summary.matched++;
        }
        summary.totalFields++;
        
        // 12. finalResults
        var curFinal = recordData.finalResults || {};
        var newFinal = {
            teamAScore: newTrA[17] || 9.5,
            teamBScore: newTrB[17] || 9.5,
            winner: newTrA[17] > newTrB[17] ? 'A' : (newTrB[17] > newTrA[17] ? 'B' : 'Tie'),
            winnerText: newTrA[17] > newTrB[17] ? 'Team A Wins!' : (newTrB[17] > newTrA[17] ? 'Team B Wins!' : 'Match Tied!')
        };
        if (!deepEqual(curFinal, newFinal)) {
            mismatches.push({ field: 'finalResults', current: 'stale', expected: 'recalculated' });
            summary.mismatched++;
        } else {
            matches.push({ field: 'finalResults', current: 'correct', expected: 'correct' });
            summary.matched++;
        }
        summary.totalFields++;
        
        // 13. Status
        var signatures = recordData.signatures || {};
        var bothSigned = signatures.f1?.signed === true && signatures.f2?.signed === true;
        var status = recordData.status || 'unknown';
        var expectedStatus = (bothSigned || status === 'completed' || status === 'pending_handicap') ? 'completed' : status;
        if (status !== expectedStatus && (status === 'scheduled' || status === 'in_progress') && bothSigned) {
            mismatches.push({ field: 'Status', current: status, expected: expectedStatus + ' (both signatures true)' });
            summary.mismatched++;
        } else if (status !== expectedStatus && expectedStatus !== status) {
            mismatches.push({ field: 'Status', current: status, expected: expectedStatus });
            summary.mismatched++;
        } else {
            matches.push({ field: 'Status', current: status, expected: expectedStatus });
            summary.matched++;
        }
        summary.totalFields++;
        
        // 14. Celebration Photo
        var photoStatus = validatePhotoPointer(recordData);
        var isCompletedGame = (status === 'completed' || status === 'pending_handicap' || bothSigned);
        if (isCompletedGame && !photoStatus.hasPhoto) {
            mismatches.push({ field: 'Celebration Photo', current: 'MISSING', expected: photoStatus.expectedPath || 'celebration/{gameId}.jpg' });
            summary.mismatched++;
        } else if (isCompletedGame && photoStatus.hasPhoto) {
            matches.push({ field: 'Celebration Photo', current: 'present', expected: 'present' });
            summary.matched++;
        } else {
            matches.push({ field: 'Celebration Photo', current: photoStatus.hasPhoto ? 'present' : 'not required', expected: 'not required (game not completed)' });
            summary.matched++;
        }
        summary.totalFields++;
        
        return {
            valid: summary.mismatched === 0,
            mismatches: mismatches,
            matches: matches,
            summary: summary,
            photoStatus: photoStatus,
            status: status,
            bothSigned: bothSigned,
            isCompletedGame: isCompletedGame,
            expectedStatus: expectedStatus
        };
    }
    
    // ============================================================
    // VALIDATE RECORD
    // ============================================================
    
    function validateRecord(recordData) {
        if (!recordData) {
            return { valid: false, error: 'No record data provided' };
        }
        
        var f1DataString = recordData.f1DataString || '';
        var f2DataString = recordData.f2DataString || '';
        var f1Scores = parseDataString(f1DataString);
        var f2Scores = parseDataString(f2DataString);
        var players = recordData.players || [];
        var courseSi = (recordData.gameInfo?.course?.si) || (recordData.course?.si) || [];
        var coursePar = (recordData.gameInfo?.course?.par) || (recordData.course?.par) || [];
        
        if (!f1Scores && !f2Scores) {
            return { valid: false, error: 'No valid flight data found' };
        }
        if (players.length === 0) {
            return { valid: false, error: 'No players found' };
        }
        
        if (!f1Scores) {
            f1Scores = [];
            for (var i = 0; i < 18; i++) {
                f1Scores.push({ saved: false, a1: 0, a2: 0, b1: 0, b2: 0 });
            }
        }
        if (!f2Scores) {
            f2Scores = [];
            for (var i = 0; i < 18; i++) {
                f2Scores.push({ saved: false, a1: 0, a2: 0, b1: 0, b2: 0 });
            }
        }
        
        if (courseSi.length === 0) {
            for (var i = 0; i < 18; i++) courseSi[i] = i + 1;
        }
        if (coursePar.length === 0) {
            for (var i = 0; i < 18; i++) coursePar[i] = 4;
        }
        
        var recalculated = buildCompleteResultsFromRawData(f1Scores, f2Scores, players, courseSi, coursePar);
        
        var fieldValidation = validateAllFields(recordData, recalculated);
        
        var forceFix = fieldValidation.summary.mismatched > 0;
        if (forceFix) {
            console.log('[UTIL-VALIDATE] ⚠️ Field mismatches detected - forcing handicap fix');
        }
        var handicapValidation = validateHandicapAdjustment(recordData, forceFix);
        
        var needsFix = fieldValidation.summary.mismatched > 0 || handicapValidation.needsFix;
        var isValid = fieldValidation.valid && handicapValidation.valid;
        
        return {
            valid: isValid,
            needsFix: needsFix,
            mismatches: fieldValidation.mismatches,
            matches: fieldValidation.matches,
            summary: fieldValidation.summary,
            photoStatus: fieldValidation.photoStatus,
            status: fieldValidation.status,
            bothSigned: fieldValidation.bothSigned,
            isCompletedGame: fieldValidation.isCompletedGame,
            expectedStatus: fieldValidation.expectedStatus,
            recalculated: recalculated,
            f1Scores: f1Scores,
            f2Scores: f2Scores,
            courseSi: courseSi,
            coursePar: coursePar,
            players: players,
            handicapValid: handicapValidation.valid,
            handicapNeedsFix: handicapValidation.needsFix,
            handicapMismatches: handicapValidation.mismatches || [],
            handicapMatches: handicapValidation.matches || [],
            handicapSummary: handicapValidation.summary || { totalFields: 0, mismatched: 0, matched: 0 },
            handicapRecalculated: handicapValidation.recalculated,
            handicapStored: handicapValidation.storedHandicaps,
            handicapAnchor: handicapValidation.anchor,
            handicapAnchorName: handicapValidation.anchorName
        };
    }
    
    // ============================================================
    // BUILD FIELD DIFF
    // ============================================================
    
    function buildFieldDiff(recordData, recalculated) {
        if (!recordData || !recalculated) {
            return { changes: [], unchanged: [], notTouched: [], hasChanges: false };
        }
        
        var validation = validateAllFields(recordData, recalculated);
        var changes = [];
        var unchanged = [];
        var notTouched = [];
        
        for (var i = 0; i < validation.mismatches.length; i++) {
            var m = validation.mismatches[i];
            var changeIcon = '';
            if (m.field.indexOf('TR') !== -1) changeIcon = 'TR';
            else if (m.field.indexOf('T-1') !== -1 || m.field.indexOf('T-2') !== -1) changeIcon = 'T';
            else if (m.field.indexOf('Strk') !== -1) changeIcon = 'S';
            else if (m.field.indexOf('Match Play') !== -1) changeIcon = 'MP';
            else if (m.field.indexOf('Team Game') !== -1) changeIcon = 'TG';
            else if (m.field.indexOf('Stroke Game') !== -1) changeIcon = 'SG';
            else if (m.field.indexOf('Photo') !== -1) changeIcon = 'PH';
            else changeIcon = '•';
            
            changes.push({
                field: m.field,
                current: m.current,
                new: m.expected,
                type: changeIcon
            });
        }
        
        for (var i = 0; i < validation.matches.length; i++) {
            var m = validation.matches[i];
            unchanged.push(m.field);
        }
        
        notTouched.push('f1DataString (raw scores)');
        notTouched.push('f2DataString (raw scores)');
        notTouched.push('players');
        notTouched.push('course');
        notTouched.push('gameId');
        notTouched.push('date');
        notTouched.push('createdAt');
        notTouched.push('locks');
        notTouched.push('signatures (preserved)');
        
        return {
            changes: changes,
            unchanged: unchanged,
            notTouched: notTouched,
            hasChanges: changes.length > 0,
            changeCount: changes.length,
            unchangedCount: unchanged.length,
            notTouchedCount: notTouched.length,
            mismatches: validation.mismatches,
            matches: validation.matches,
            summary: validation.summary,
            photoStatus: validation.photoStatus
        };
    }
    
    // ============================================================
    // BUILD FIX PREVIEW
    // ============================================================
    
    function buildFixPreview(recordData, recalculated) {
        if (!recordData || !recalculated) {
            return {
                changes: [],
                unchanged: [],
                notTouched: [],
                hasChanges: false,
                mismatchedHoles: [],
                matchingHoles: []
            };
        }
        
        var diff = buildFieldDiff(recordData, recalculated);
        
        var mismatchedHoles = [];
        var matchingHoles = [];
        for (var i = 0; i < diff.mismatches.length; i++) {
            var m = diff.mismatches[i];
            if (m.field.indexOf('TR H') !== -1) {
                var holeNum = parseInt(m.field.replace('TR H', ''));
                if (!isNaN(holeNum)) {
                    mismatchedHoles.push(holeNum);
                }
            }
        }
        mismatchedHoles.sort(function(a, b) { return a - b; });
        for (var h = 1; h <= 18; h++) {
            if (mismatchedHoles.indexOf(h) === -1) {
                matchingHoles.push(h);
            }
        }
        
        return {
            changes: diff.changes,
            unchanged: diff.unchanged,
            notTouched: diff.notTouched,
            hasChanges: diff.hasChanges,
            changeCount: diff.changeCount,
            unchangedCount: diff.unchangedCount,
            notTouchedCount: diff.notTouchedCount,
            mismatchedHoles: mismatchedHoles,
            matchingHoles: matchingHoles,
            summary: diff.summary,
            photoStatus: diff.photoStatus
        };
    }
    
    // ============================================================
    // v1.27: BUILD FIX PAYLOAD - Use validateCurrentValidation.handicapRecalculated
    // ============================================================
    
    function buildFixPayload(recordData, recalculated) {
        var updatePayload = {};
        var holesToFix = [];
        var curTrA = (recordData.results?.tr?.teamA) || [];
        var curTrB = (recordData.results?.tr?.teamB) || [];
        var newTrA = recalculated.tr.teamA || [];
        var newTrB = recalculated.tr.teamB || [];
        
        // 1. TR values
        for (var i = 0; i < 18; i++) {
            if (curTrA[i] !== newTrA[i] || curTrB[i] !== newTrB[i]) {
                holesToFix.push(i);
            }
        }
        
        if (holesToFix.length > 0) {
            var updatedTrA = curTrA.slice();
            var updatedTrB = curTrB.slice();
            var updatedGreenA = (recordData.results?.tr?.teamAGreen) || [];
            var updatedGreenB = (recordData.results?.tr?.teamBGreen) || [];
            
            for (var idx = 0; idx < holesToFix.length; idx++) {
                var holeIdx = holesToFix[idx];
                updatedTrA[holeIdx] = newTrA[holeIdx];
                updatedTrB[holeIdx] = newTrB[holeIdx];
                updatedGreenA[holeIdx] = newTrA[holeIdx] > newTrB[holeIdx];
                updatedGreenB[holeIdx] = newTrB[holeIdx] > newTrA[holeIdx];
            }
            updatePayload['results.tr.teamA'] = updatedTrA;
            updatePayload['results.tr.teamB'] = updatedTrB;
            updatePayload['results.tr.teamAGreen'] = updatedGreenA;
            updatePayload['results.tr.teamBGreen'] = updatedGreenB;
        }
        
        // 2. T-1 Display
        var curT1 = (recordData.results?.game2?.displayT1) || [];
        var newT1 = recalculated.teamGame.displayT1 || [];
        var t1Mismatches = [];
        for (var i = 0; i < 18; i++) {
            if (curT1[i] !== newT1[i]) t1Mismatches.push(i);
        }
        if (t1Mismatches.length > 0) {
            var updatedT1 = curT1.slice();
            for (var idx = 0; idx < t1Mismatches.length; idx++) {
                updatedT1[t1Mismatches[idx]] = newT1[t1Mismatches[idx]];
            }
            updatePayload['results.game2.displayT1'] = updatedT1;
        }
        
        // 3. T-2 Display
        var curT2 = (recordData.results?.game2?.displayT2) || [];
        var newT2 = recalculated.teamGame.displayT2 || [];
        var t2Mismatches = [];
        for (var i = 0; i < 18; i++) {
            if (curT2[i] !== newT2[i]) t2Mismatches.push(i);
        }
        if (t2Mismatches.length > 0) {
            var updatedT2 = curT2.slice();
            for (var idx = 0; idx < t2Mismatches.length; idx++) {
                updatedT2[t2Mismatches[idx]] = newT2[t2Mismatches[idx]];
            }
            updatePayload['results.game2.displayT2'] = updatedT2;
        }
        
        // 4. Stroke Display
        var curStrk = (recordData.results?.game3?.displayStrk) || [];
        var newStrk = recalculated.strokeGame.displayStrk || [];
        var strkMismatches = [];
        for (var i = 0; i < 18; i++) {
            if (curStrk[i] !== newStrk[i]) strkMismatches.push(i);
        }
        if (strkMismatches.length > 0) {
            var updatedStrk = curStrk.slice();
            for (var idx = 0; idx < strkMismatches.length; idx++) {
                updatedStrk[strkMismatches[idx]] = newStrk[strkMismatches[idx]];
            }
            updatePayload['results.game3.displayStrk'] = updatedStrk;
        }
        
        // 5-7. Removed in v4.0
        
        // 8. Player Totals
        if (!deepEqual(recordData.results?.playerTotals || {}, recalculated.playerTotals || {})) {
            updatePayload['results.playerTotals'] = recalculated.playerTotals;
        }
        
        // 9. ClinchedAt
        if (!deepEqual(recordData.results?.clinchedAt || {}, recalculated.clinchedAt || {})) {
            updatePayload['results.clinchedAt'] = recalculated.clinchedAt;
        }
        
        // 10. computedUpToHole
        var curComputed = recordData.results?.computedUpToHole;
        var newComputed = recalculated.computedUpToHole || 18;
        if (curComputed !== newComputed) {
            updatePayload['results.computedUpToHole'] = newComputed;
        }
        
        // 11. Status
        var signatures = recordData.signatures || {};
        var bothSigned = signatures.f1?.signed === true && signatures.f2?.signed === true;
        var status = recordData.status || 'unknown';
        if (bothSigned && (status === 'scheduled' || status === 'in_progress')) {
            updatePayload['status'] = 'completed';
        } else if (status !== 'completed' && status !== 'pending_handicap' && bothSigned) {
            updatePayload['status'] = 'completed';
        }
        
        // 12. finalResults
        var finalTrA = recalculated.tr.teamA[17] || 9.5;
        var finalTrB = recalculated.tr.teamB[17] || 9.5;
        var winner = finalTrA > finalTrB ? 'A' : (finalTrB > finalTrA ? 'B' : 'Tie');
        var newFinal = {
            teamAScore: finalTrA,
            teamBScore: finalTrB,
            winner: winner,
            winnerText: winner === 'A' ? 'Team A Wins!' : winner === 'B' ? 'Team B Wins!' : 'Match Tied!'
        };
        if (!deepEqual(recordData.finalResults || {}, newFinal)) {
            updatePayload['finalResults'] = newFinal;
        }
        
        // 13. lastComputedAt
        updatePayload['results.lastComputedAt'] = new Date().toISOString();
        
        // 14. updatedAt
        if (Object.keys(updatePayload).length > 0) {
            updatePayload['updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // ============================================================
        // v1.27: HANDICAP FIX - Use validateCurrentValidation.handicapRecalculated
        // ============================================================
        
        console.log('[UTIL-VALIDATE] === buildFixPayload handicap section (v1.27) ===');
        
        // v1.27: Get the correct recalculated data from validateCurrentValidation
        // This data was already computed correctly during validation.
        // DO NOT recalculate again - that produces wrong values from stale data.
        var correctRecalculated = null;
        if (typeof validateCurrentValidation !== 'undefined' && 
            validateCurrentValidation && 
            validateCurrentValidation.handicapRecalculated) {
            correctRecalculated = validateCurrentValidation.handicapRecalculated;
            console.log('[UTIL-VALIDATE] ✅ Using correctRecalculated from validateCurrentValidation');
            console.log('[UTIL-VALIDATE] correctRecalculated.newAnchorName:', correctRecalculated.newAnchorName);
            console.log('[UTIL-VALIDATE] correctRecalculated.needsZeroRise:', correctRecalculated.needsZeroRise);
            console.log('[UTIL-VALIDATE] correctRecalculated.zeroRiseAmount:', correctRecalculated.zeroRiseAmount);
            
            // Log the correct values for key players
            if (correctRecalculated.players) {
                correctRecalculated.players.forEach(function(p) {
                    if (p.name === 'Ang C H' || p.name === 'James Ong' || p.name === 'Piti') {
                        console.log('[UTIL-VALIDATE] ✅ Correct recalc ' + p.name + ': anchorAdj=' + p.anchorAdj + ', anchorRaw=' + p.anchorRaw + ', rawNew=' + p.rawNew + ', newAnchor=' + p.newAnchor);
                    }
                });
            }
        } else {
            console.log('[UTIL-VALIDATE] ⚠️ validateCurrentValidation.handicapRecalculated NOT available');
            console.log('[UTIL-VALIDATE] ⚠️ Falling back to fresh recalculation (may be wrong)');
            
            // Only fallback if absolutely necessary
            var recalcResult = recalculateHandicapsFromRecord(recordData);
            if (recalcResult.success) {
                correctRecalculated = recalcResult.result;
                console.log('[UTIL-VALIDATE] Fallback recalculation completed');
            }
        }
        
        if (correctRecalculated && correctRecalculated.players) {
            console.log('[UTIL-VALIDATE] Building handicap fix payload with correct recalculated data...');
            var handicapFix = buildHandicapFixPayload(recordData, correctRecalculated);
            console.log('[UTIL-VALIDATE] handicapFix.hasChanges:', handicapFix.hasChanges);
            console.log('[UTIL-VALIDATE] handicapFix.fieldsUpdated:', handicapFix.fieldsUpdated);
            
            if (handicapFix.hasChanges) {
                for (var key in handicapFix.updatePayload) {
                    updatePayload[key] = handicapFix.updatePayload[key];
                    console.log('[UTIL-VALIDATE] Adding to payload: ' + key);
                }
            } else {
                console.log('[UTIL-VALIDATE] ⚠️ handicapFix.hasChanges is FALSE - forcing write anyway');
                var forcedPayload = handicapFix.updatePayload;
                if (forcedPayload && Object.keys(forcedPayload).length > 0) {
                    for (var key in forcedPayload) {
                        updatePayload[key] = forcedPayload[key];
                        console.log('[UTIL-VALIDATE] FORCE adding to payload: ' + key);
                    }
                }
            }
        } else {
            console.log('[UTIL-VALIDATE] ❌ No correct recalculated data available - skipping handicap fix');
        }
        
        // ============================================================
        // FULL PAYLOAD DEBUG LOG - RIGHT BEFORE WRV
        // ============================================================
        
        console.log('[UTIL-VALIDATE] === FULL UPDATE PAYLOAD (BEFORE WRV) ===');
        console.log('[UTIL-VALIDATE] Payload keys:', Object.keys(updatePayload));
        if (updatePayload.adjustedHandicaps) {
            var payload = updatePayload.adjustedHandicaps;
            console.log('[UTIL-VALIDATE] adjustedHandicaps payload:');
            console.log('[UTIL-VALIDATE]   anchor:', payload.anchor);
            console.log('[UTIL-VALIDATE]   newAnchor:', payload.newAnchor);
            console.log('[UTIL-VALIDATE]   needsZeroRise:', payload.needsZeroRise);
            console.log('[UTIL-VALIDATE]   zeroRiseAmount:', payload.zeroRiseAmount);
            console.log('[UTIL-VALIDATE]   calculatedAt:', payload.calculatedAt);
            console.log('[UTIL-VALIDATE]   players:');
            if (payload.players) {
                payload.players.forEach(function(p, idx) {
                    console.log('[UTIL-VALIDATE]     [' + idx + '] ' + p.name + ':');
                    console.log('[UTIL-VALIDATE]       startingHcp:', p.startingHcp);
                    console.log('[UTIL-VALIDATE]       anchorAdj:', p.anchorAdj);
                    console.log('[UTIL-VALIDATE]       perfAdj:', p.perfAdj);
                    console.log('[UTIL-VALIDATE]       finalHcp:', p.finalHcp);
                    console.log('[UTIL-VALIDATE]       anchorRaw:', p.anchorRaw);
                    console.log('[UTIL-VALIDATE]       perfRaw:', p.perfRaw);
                });
            }
        } else {
            console.log('[UTIL-VALIDATE] ⚠️ No adjustedHandicaps in payload');
        }
        console.log('[UTIL-VALIDATE] === END PAYLOAD ===');
        
        window._lastFixPayload = {
            updatePayload: updatePayload,
            hasChanges: Object.keys(updatePayload).length > 0,
            timestamp: new Date().toISOString()
        };
        
        console.log('[UTIL-VALIDATE] Final updatePayload keys:', Object.keys(updatePayload));
        console.log('[UTIL-VALIDATE] hasChanges:', Object.keys(updatePayload).length > 0);
        console.log('[UTIL-VALIDATE] === END buildFixPayload ===');
        
        return {
            updatePayload: updatePayload,
            hasChanges: Object.keys(updatePayload).length > 0,
            holesToFix: holesToFix,
            fieldsUpdated: Object.keys(updatePayload)
        };
    }
    
    // ============================================================
    // PUBLIC API
    // ============================================================
    
    return {
        parseDataString: parseDataString,
        parseHoleData: parseHoleData,
        getStrokeHoles: getStrokeHoles,
        getNetScoreMatchGame: getNetScoreMatchGame,
        getPlayerScore: getPlayerScore,
        getPlayerGrossFromScores: getPlayerGrossFromScores,
        getIntraMatchResultForHole: getIntraMatchResultForHole,
        getCrossMatchResultForHole: getCrossMatchResultForHole,
        calculateTeamGame: calculateTeamGame,
        calculateStrokeGame: calculateStrokeGame,
        calculateMatchGamePerHole: calculateMatchGamePerHole,
        buildCompleteResultsFromRawData: buildCompleteResultsFromRawData,
        deepEqual: deepEqual,
        validatePhotoPointer: validatePhotoPointer,
        validateAllFields: validateAllFields,
        buildFieldDiff: buildFieldDiff,
        validateRecord: validateRecord,
        buildFixPreview: buildFixPreview,
        buildFixPayload: buildFixPayload,
        validateHandicapAdjustment: validateHandicapAdjustment,
        recalculateHandicapsFromRecord: recalculateHandicapsFromRecord,
        compareHandicapFields: compareHandicapFields,
        buildHandicapFixPayload: buildHandicapFixPayload
    };
    
})();

window.UtilValidate = UtilValidate;

/*
FILE: js/util-validate-record.js
VERSION: 1.28
KEY CHANGES from v1.27:
   - ADDED: Debug logging for Match Game calculation at H10
   - REASON: Need to see the actual match data being calculated for validation
   - Logs each match at H10 with pointsA and pointsB
   - Logs total Match Game points at H10
   - PRESERVED: ALL other functionality from v1.27 unchanged
DEPENDS ON: Firebase Firestore, js/game-loader.js, js/hcp-adjust.js
STATUS: Ready for integration
*/