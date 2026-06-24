/*
FILE: js/util-validate-record.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: getPlayerGrossFromScores() now correctly maps player scores
   - FIXED: validateRecord() handles missing gameInfo gracefully
   - FIXED: buildFixPreview() handles missing results object
   - FIXED: deepEqual() handles Date and Firestore Timestamp objects
   - FIXED: getStrokeHoles() handles undefined courseSi
   - ADDED: null/undefined checks throughout
   - All core functionality preserved from v1.00
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_VALIDATE_VERSION = "1.01";

var UtilValidate = (function() {
    
    console.log("[UTIL-VALIDATE] Initializing v1.01");
    
    // ============================================================
    // PARSING FUNCTIONS
    // ============================================================
    
    function parseDataString(dataStr) {
        if (!dataStr || dataStr.length !== 162) return null;
        var scores = [];
        for (var i = 0; i < 18; i++) {
            var block = dataStr.substr(i * 9, 9);
            scores.push({
                saved: block[0] === 'T',
                a1: parseInt(block.substr(1, 2), 10),
                a2: parseInt(block.substr(3, 2), 10),
                b1: parseInt(block.substr(5, 2), 10),
                b2: parseInt(block.substr(7, 2), 10)
            });
        }
        return scores;
    }
    
    function parseHoleData(dataStr, holeNumber) {
        if (!dataStr || dataStr.length !== 162) return null;
        var startIndex = (holeNumber - 1) * 9;
        var segment = dataStr.substr(startIndex, 9);
        return { saved: segment[0] === 'T', scores: { a1: parseInt(segment.substr(1,2),10), a2: parseInt(segment.substr(3,2),10), b1: parseInt(segment.substr(5,2),10), b2: parseInt(segment.substr(7,2),10) } };
    }
    
    // ============================================================
    // STROKE HELPERS
    // ============================================================
    
    function getStrokeHoles(handicapDiff, courseSi) {
        if (handicapDiff <= 0) return [];
        if (!courseSi || courseSi.length === 0) {
            // Default SI if not provided
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
        
        // Determine which slot this player occupies
        if (player.team === 'A') {
            // Check if this is the first A player based on handicap order
            var flightPlayers = player.flight === 1 ? 
                f1Scores[holeNumber - 1] : f2Scores[holeNumber - 1];
            // Use the scores directly - in the data string, a1 is always first A, a2 is second A
            // We need to determine by player's handicap rank within team
            var allPlayers = window._validatePlayers || [];
            var flightTeamPlayers = allPlayers.filter(function(p) { 
                return p.flight === player.flight && p.team === 'A'; 
            }).sort(function(a, b) { return a.handicap - b.handicap; });
            
            if (flightTeamPlayers.length === 0) {
                // Fallback: use a1
                if (holeData.a1 !== undefined) return holeData.a1;
            }
            
            if (flightTeamPlayers[0] && flightTeamPlayers[0].name === player.name) {
                return holeData.a1;
            } else if (flightTeamPlayers[1] && flightTeamPlayers[1].name === player.name) {
                return holeData.a2;
            }
            
            // Fallback if not found
            if (holeData.a1 !== undefined) return holeData.a1;
        } else {
            // Team B
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
                results.push({ hole: idx+1, match1: null, match2: null, holeResult: null, running: null, display: '-', trPointsA: 0.5, trPointsB: 0.5, teamGameTR: { A: 0.5, B: 0.5 } });
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
                results.push({ hole: pos+1, display: '-', grossA: null, grossB: null, netA: null, netB: null, diff: null, trPointsA: 0.5, trPointsB: 0.5, strokeTR: { A: 0.5, B: 0.5 } });
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
        
        // Player totals - store players for use in getPlayerGrossFromScores
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
        
        // ClinchedAt
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
                    var key = teamAPlayers[a].name + "_vs_" + teamBPlayers[b].name;
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
        
        var game1PointsA = [];
        var game1PointsB = [];
        for (var pos = 0; pos < 18; pos++) {
            var holeMatchData = matchPointsPerHole[pos] || {};
            var mA = 0, mB = 0;
            for (var matchKey in holeMatchData) {
                mA += holeMatchData[matchKey].pointsA || 0;
                mB += holeMatchData[matchKey].pointsB || 0;
            }
            game1PointsA.push(mA);
            game1PointsB.push(mB);
        }
        
        var game2 = {
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
            pointsA: t1Results.map(function(r, i) { return (t1Results[i].trPointsA || 0.5) + (t2Results[i].trPointsA || 0.5); }),
            pointsB: t1Results.map(function(r, i) { return (t1Results[i].trPointsB || 0.5) + (t2Results[i].trPointsB || 0.5); }),
            displayT1: displayT1,
            displayT2: displayT2
        };
        
        var game3 = {
            leader: strkResults.map(function(r) { return r.display || 'AS'; }),
            displayStrk: displayStrk,
            pointsA: strkResults.map(function(r) { return r.trPointsA || 0.5; }),
            pointsB: strkResults.map(function(r) { return r.trPointsB || 0.5; }),
            nettA: strkResults.map(function(r) { return r.netA || 0; }),
            nettB: strkResults.map(function(r) { return r.netB || 0; })
        };
        
        var finalResults = {
            version: 1,
            game1: {
                pointsA: game1PointsA,
                pointsB: game1PointsB
            },
            game2: game2,
            game3: game3,
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
    // DEEP EQUAL HELPER (v1.01: handles Date and Firestore Timestamp)
    // ============================================================
    
    function deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return a === b;
        if (typeof a === 'undefined' || typeof b === 'undefined') return a === b;
        
        // Handle Date objects
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }
        if (a instanceof Date) return false;
        if (b instanceof Date) return false;
        
        // Handle Firestore Timestamp (has toDate method)
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
    // VALIDATE RECORD - Check if record needs fixing
    // ============================================================
    
    function validateRecord(recordData) {
        // v1.01: Handle missing data gracefully
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
        
        if (!f1Scores || !f2Scores) {
            return { valid: false, error: 'Invalid data strings' };
        }
        if (players.length === 0) {
            return { valid: false, error: 'No players found' };
        }
        
        if (courseSi.length === 0) {
            for (var i = 0; i < 18; i++) courseSi[i] = i + 1;
        }
        if (coursePar.length === 0) {
            for (var i = 0; i < 18; i++) coursePar[i] = 4;
        }
        
        var recalculated = buildCompleteResultsFromRawData(f1Scores, f2Scores, players, courseSi, coursePar);
        var recTrA = recalculated.tr.teamA || [];
        var recTrB = recalculated.tr.teamB || [];
        var curTrA = (recordData.results?.tr?.teamA) || [];
        var curTrB = (recordData.results?.tr?.teamB) || [];
        
        var mismatches = [];
        for (var i = 0; i < 18; i++) {
            var curA = curTrA[i];
            var curB = curTrB[i];
            var newA = recTrA[i];
            var newB = recTrB[i];
            if (curA !== newA || curB !== newB) {
                mismatches.push(i + 1);
            }
        }
        
        var isPending = recordData.status === 'pending_handicap';
        var needsFix = isPending || mismatches.length > 0;
        
        return {
            valid: !needsFix,
            needsFix: needsFix,
            isPending: isPending,
            mismatches: mismatches,
            recalculated: recalculated,
            f1Scores: f1Scores,
            f2Scores: f2Scores,
            courseSi: courseSi,
            coursePar: coursePar,
            players: players
        };
    }
    
    // ============================================================
    // BUILD FIX PREVIEW - Compare current vs recalculated
    // ============================================================
    
    function buildFixPreview(recordData, recalculated) {
        // v1.01: Handle missing data gracefully
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
        
        var changes = [];
        var unchanged = [];
        var notTouched = [];
        var mismatchedHoles = [];
        var matchingHoles = [];
        
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
            if (match) {
                matchingHoles.push(i + 1);
            } else {
                mismatchedHoles.push(i + 1);
                changes.push({
                    field: 'H' + (i+1) + ' TR',
                    current: (curA !== undefined && curA !== null ? curA : 'null') + ' - ' + (curB !== undefined && curB !== null ? curB : 'null'),
                    new: (newA !== undefined && newA !== null ? newA : 'null') + ' - ' + (newB !== undefined && newB !== null ? newB : 'null'),
                    type: 'tr',
                    hole: i + 1
                });
            }
        }
        
        // T-1 Display
        var curT1 = (recordData.results?.game2?.displayT1) || [];
        var newT1 = recalculated.game2.displayT1 || [];
        for (var i = 0; i < 18; i++) {
            if (curT1[i] !== newT1[i]) {
                changes.push({
                    field: 'H' + (i+1) + ' T-1',
                    current: curT1[i] || '?',
                    new: newT1[i] || '?',
                    type: 'team',
                    hole: i + 1
                });
            }
        }
        
        // T-2 Display
        var curT2 = (recordData.results?.game2?.displayT2) || [];
        var newT2 = recalculated.game2.displayT2 || [];
        for (var i = 0; i < 18; i++) {
            if (curT2[i] !== newT2[i]) {
                changes.push({
                    field: 'H' + (i+1) + ' T-2',
                    current: curT2[i] || '?',
                    new: newT2[i] || '?',
                    type: 'team',
                    hole: i + 1
                });
            }
        }
        
        // Strk Display
        var curStrk = (recordData.results?.game3?.displayStrk) || [];
        var newStrk = recalculated.game3.displayStrk || [];
        for (var i = 0; i < 18; i++) {
            if (curStrk[i] !== newStrk[i]) {
                changes.push({
                    field: 'H' + (i+1) + ' Strk',
                    current: curStrk[i] || '?',
                    new: newStrk[i] || '?',
                    type: 'strk',
                    hole: i + 1
                });
            }
        }
        
        // Status
        if (recordData.status !== 'completed') {
            changes.push({
                field: 'Status',
                current: recordData.status || 'unknown',
                new: 'completed',
                type: 'status'
            });
        } else {
            unchanged.push('Status already completed');
        }
        
        // Player totals
        if (!deepEqual(recordData.results?.playerTotals || {}, recalculated.playerTotals || {})) {
            changes.push({
                field: 'Player Totals',
                current: 'requires update',
                new: 'recalculated',
                type: 'totals'
            });
        } else {
            unchanged.push('Player Totals match');
        }
        
        // Not touched fields
        notTouched.push('f1DataString (raw scores)');
        notTouched.push('f2DataString (raw scores)');
        notTouched.push('players');
        notTouched.push('gameInfo');
        notTouched.push('signatures');
        notTouched.push('completedAt');
        notTouched.push('createdAt');
        notTouched.push('f1IntraMatches (match bubbles)');
        notTouched.push('f2IntraMatches (match bubbles)');
        notTouched.push('matchResults (match bubbles)');
        notTouched.push('adjustedHandicaps (preserved)');
        
        return {
            changes: changes,
            unchanged: unchanged,
            notTouched: notTouched,
            hasChanges: changes.length > 0,
            mismatchedHoles: mismatchedHoles,
            matchingHoles: matchingHoles
        };
    }
    
    // ============================================================
    // BUILD FIX PAYLOAD
    // ============================================================
    
    function buildFixPayload(recordData, recalculated) {
        var updatePayload = {};
        var holesToFix = [];
        var curTrA = (recordData.results?.tr?.teamA) || [];
        var curTrB = (recordData.results?.tr?.teamB) || [];
        var newTrA = recalculated.tr.teamA || [];
        var newTrB = recalculated.tr.teamB || [];
        
        // TR values
        for (var i = 0; i < 18; i++) {
            if (curTrA[i] !== newTrA[i] || curTrB[i] !== newTrB[i]) {
                holesToFix.push(i);
            }
        }
        
        if (holesToFix.length > 0) {
            var updatedTrA = curTrA.slice();
            var updatedTrB = curTrB.slice();
            for (var idx = 0; idx < holesToFix.length; idx++) {
                var holeIdx = holesToFix[idx];
                updatedTrA[holeIdx] = newTrA[holeIdx];
                updatedTrB[holeIdx] = newTrB[holeIdx];
            }
            updatePayload['results.tr.teamA'] = updatedTrA;
            updatePayload['results.tr.teamB'] = updatedTrB;
            
            // Green flags
            var updatedGreenA = (recordData.results?.tr?.teamAGreen) || [];
            var updatedGreenB = (recordData.results?.tr?.teamBGreen) || [];
            for (var idx = 0; idx < holesToFix.length; idx++) {
                var holeIdx = holesToFix[idx];
                updatedGreenA[holeIdx] = newTrA[holeIdx] > newTrB[holeIdx];
                updatedGreenB[holeIdx] = newTrB[holeIdx] > newTrA[holeIdx];
            }
            updatePayload['results.tr.teamAGreen'] = updatedGreenA;
            updatePayload['results.tr.teamBGreen'] = updatedGreenB;
        }
        
        // T-2 Display
        var curT2 = (recordData.results?.game2?.displayT2) || [];
        var newT2 = recalculated.game2.displayT2 || [];
        var t2Mismatches = [];
        for (var i = 0; i < 18; i++) {
            if (curT2[i] !== newT2[i]) {
                t2Mismatches.push(i);
            }
        }
        if (t2Mismatches.length > 0) {
            var updatedT2 = curT2.slice();
            for (var idx = 0; idx < t2Mismatches.length; idx++) {
                updatedT2[t2Mismatches[idx]] = newT2[t2Mismatches[idx]];
            }
            updatePayload['results.game2.displayT2'] = updatedT2;
        }
        
        // Status
        if (recordData.status !== 'completed') {
            updatePayload['status'] = 'completed';
        }
        
        // Final results
        var finalTrA = recalculated.tr.teamA[17] || 9.5;
        var finalTrB = recalculated.tr.teamB[17] || 9.5;
        var winner = finalTrA > finalTrB ? 'A' : (finalTrB > finalTrA ? 'B' : 'Tie');
        updatePayload['finalResults'] = {
            teamAScore: finalTrA,
            teamBScore: finalTrB,
            winner: winner,
            winnerText: winner === 'A' ? 'Team A Wins!' : winner === 'B' ? 'Team B Wins!' : 'Match Tied!'
        };
        
        updatePayload['updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
        updatePayload['results.computedUpToHole'] = 18;
        updatePayload['results.lastComputedAt'] = new Date().toISOString();
        
        return {
            updatePayload: updatePayload,
            holesToFix: holesToFix,
            t2Mismatches: t2Mismatches
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
        validateRecord: validateRecord,
        buildFixPreview: buildFixPreview,
        buildFixPayload: buildFixPayload,
        deepEqual: deepEqual
    };
    
})();

// Make available globally
window.UtilValidate = UtilValidate;

/*
FILE: js/util-validate-record.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: getPlayerGrossFromScores() now correctly maps player scores
   - FIXED: validateRecord() handles missing gameInfo gracefully
   - FIXED: buildFixPreview() handles missing results object
   - FIXED: deepEqual() handles Date and Firestore Timestamp objects
   - FIXED: getStrokeHoles() handles undefined courseSi
   - ADDED: null/undefined checks throughout
   - All core functionality preserved from v1.00
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/