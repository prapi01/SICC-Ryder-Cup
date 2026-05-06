// FILE: js/game2-team.js - VERSION 1.00
// Game 2: Team Game (2 points)
// 
// Description:
// The 8 players are divided into two flights of 4 players each (2 Team A + 2 Team B per flight).
// Each flight competes separately for 1 point.
//
// Per hole calculation:
// 1. Calculate effective handicaps (zero-rising within the flight)
// 2. Calculate strokes received per hole based on SI
// 3. Calculate NETT scores (Gross - Strokes)
// 4. Match Best NETT of Team A vs Best NETT of Team B (1 point)
// 5. Match Second best NETT of Team A vs Second best NETT of Team B (1 point)
// 6. Total per hole = max 2 points
// 7. Cumulative points determine flight winner after 18 holes

var Game2Team = (function() {
    
    // Calculate strokes received for a hole based on effective handicap and SI
    function getStrokesForHole(effectiveHcp, si, holeNumber) {
        var holeSi = si[holeNumber - 1];
        var strokes = 0;
        
        // Each full handicap point gives a stroke on holes where SI <= handicap
        if (effectiveHcp >= holeSi) {
            strokes = 1;
        }
        // Additional strokes for handicaps > 18
        if (effectiveHcp > 18) {
            strokes += Math.floor((effectiveHcp - 18) / 18);
        }
        return strokes;
    }
    
    // Calculate NETT score
    function calculateNettScore(grossScore, strokesReceived) {
        return grossScore - strokesReceived;
    }
    
    // Calculate effective handicaps for a flight (zero-rising)
    function calculateEffectiveHandicaps(playersInFlight) {
        // Find lowest handicap in the flight
        var lowestHcp = 999;
        for (var i = 0; i < playersInFlight.length; i++) {
            if (playersInFlight[i].handicap < lowestHcp) {
                lowestHcp = playersInFlight[i].handicap;
            }
        }
        
        // Calculate effective handicaps
        var playersWithStrokes = [];
        for (var i = 0; i < playersInFlight.length; i++) {
            var player = playersInFlight[i];
            var effectiveHcp = player.handicap - lowestHcp;
            playersWithStrokes.push({
                name: player.name,
                team: player.team,
                handicap: player.handicap,
                effectiveHcp: effectiveHcp,
                scores: []
            });
        }
        return playersWithStrokes;
    }
    
    // Build scores for players from parsed data
    function buildPlayerScores(players, flightData, course) {
        var playerScores = [];
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var scores = [];
            var total = 0;
            
            for (var hole = 1; hole <= 18; hole++) {
                var holeData = Game2Data.parseHoleData(flightData, hole);
                if (!holeData || !holeData.saved) {
                    scores.push(null);
                } else {
                    var score = 0;
                    if (p.team === "A") {
                        // Determine which A player (first or second based on order)
                        var teamAPlayers = players.filter(function(pl) { return pl.flight === p.flight && pl.team === "A"; });
                        teamAPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
                        if (teamAPlayers[0] && teamAPlayers[0].name === p.name) {
                            score = holeData.scores.a1;
                        } else {
                            score = holeData.scores.a2;
                        }
                    } else {
                        // Team B
                        var teamBPlayers = players.filter(function(pl) { return pl.flight === p.flight && pl.team === "B"; });
                        teamBPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
                        if (teamBPlayers[0] && teamBPlayers[0].name === p.name) {
                            score = holeData.scores.b1;
                        } else {
                            score = holeData.scores.b2;
                        }
                    }
                    scores.push(score);
                    total += score;
                }
            }
            
            playerScores.push({
                name: p.name,
                team: p.team,
                flight: p.flight,
                handicap: p.handicap,
                holeScores: scores,
                total: total
            });
        }
        
        return playerScores;
    }
    
    // Calculate flight results for a specific flight
    function calculateFlightResults(flightNumber, players, flightData, course, upToHole) {
        // Get players in this flight
        var flightPlayers = players.filter(function(p) { return p.flight === flightNumber; });
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; });
        
        if (teamAPlayers.length !== 2 || teamBPlayers.length !== 2) {
            console.warn("Flight " + flightNumber + " does not have exactly 2 players per team");
            return {
                cumulativePoints: [],
                finalWinner: null,
                teamAPoints: 0,
                teamBPoints: 0
            };
        }
        
        // Sort by handicap (lowest first)
        teamAPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        teamBPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        // Calculate effective handicaps
        var allFlightPlayers = teamAPlayers.concat(teamBPlayers);
        var playersWithEffective = calculateEffectiveHandicaps(allFlightPlayers);
        
        // Create lookup for effective handicaps
        var effectiveHcpMap = {};
        for (var i = 0; i < playersWithEffective.length; i++) {
            effectiveHcpMap[playersWithEffective[i].name] = playersWithEffective[i].effectiveHcp;
        }
        
        var cumulativePoints = [];
        var teamACumulative = 0;
        var teamBCumulative = 0;
        
        // Process each hole up to upToHole
        for (var hole = 1; hole <= upToHole; hole++) {
            var holeData = Game2Data.parseHoleData(flightData, hole);
            
            // Check if hole is saved for this flight
            if (!holeData || !holeData.saved) {
                // Not saved yet - add same cumulative points as last hole
                cumulativePoints.push({
                    hole: hole,
                    teamAPoints: teamACumulative,
                    teamBPoints: teamBCumulative,
                    holePointsA: 0,
                    holePointsB: 0
                });
                continue;
            }
            
            // Get scores for this hole
            var a1Score = holeData.scores.a1;
            var a2Score = holeData.scores.a2;
            var b1Score = holeData.scores.b1;
            var b2Score = holeData.scores.b2;
            
            // Get effective handicaps
            var a1Hcp = effectiveHcpMap[teamAPlayers[0].name] || 0;
            var a2Hcp = effectiveHcpMap[teamAPlayers[1].name] || 0;
            var b1Hcp = effectiveHcpMap[teamBPlayers[0].name] || 0;
            var b2Hcp = effectiveHcpMap[teamBPlayers[1].name] || 0;
            
            // Calculate strokes received
            var a1Strokes = getStrokesForHole(a1Hcp, course.si, hole);
            var a2Strokes = getStrokesForHole(a2Hcp, course.si, hole);
            var b1Strokes = getStrokesForHole(b1Hcp, course.si, hole);
            var b2Strokes = getStrokesForHole(b2Hcp, course.si, hole);
            
            // Calculate NETT scores
            var a1Nett = calculateNettScore(a1Score, a1Strokes);
            var a2Nett = calculateNettScore(a2Score, a2Strokes);
            var b1Nett = calculateNettScore(b1Score, b1Strokes);
            var b2Nett = calculateNettScore(b2Score, b2Strokes);
            
            // Sort NETT scores (lower is better)
            var aNett = [a1Nett, a2Nett].sort(function(x, y) { return x - y; });
            var bNett = [b1Nett, b2Nett].sort(function(x, y) { return x - y; });
            
            // Match 1: Best vs Best
            var holePointsA = 0;
            var holePointsB = 0;
            
            if (aNett[0] < bNett[0]) {
                holePointsA += 1;
            } else if (bNett[0] < aNett[0]) {
                holePointsB += 1;
            } else {
                holePointsA += 0.5;
                holePointsB += 0.5;
            }
            
            // Match 2: Second vs Second
            if (aNett[1] < bNett[1]) {
                holePointsA += 1;
            } else if (bNett[1] < aNett[1]) {
                holePointsB += 1;
            } else {
                holePointsA += 0.5;
                holePointsB += 0.5;
            }
            
            teamACumulative += holePointsA;
            teamBCumulative += holePointsB;
            
            cumulativePoints.push({
                hole: hole,
                teamAPoints: teamACumulative,
                teamBPoints: teamBCumulative,
                holePointsA: holePointsA,
                holePointsB: holePointsB
            });
        }
        
        // Determine final winner
        var finalWinner = null;
        if (teamACumulative > teamBCumulative) {
            finalWinner = "A";
        } else if (teamBCumulative > teamACumulative) {
            finalWinner = "B";
        } else {
            finalWinner = "TIE";
        }
        
        return {
            cumulativePoints: cumulativePoints,
            finalWinner: finalWinner,
            teamAPoints: teamACumulative,
            teamBPoints: teamBCumulative
        };
    }
    
    // Get team rows for scorecard display (T-1 and T-2)
    function getTeamRows(players, flight1Data, flight2Data, course, upToHole) {
        var flight1Result = calculateFlightResults(1, players, flight1Data, course, upToHole);
        var flight2Result = calculateFlightResults(2, players, flight2Data, course, upToHole);
        
        // Build arrays for 18 holes
        var t1Row = new Array(18).fill(0);
        var t2Row = new Array(18).fill(0);
        
        for (var h = 1; h <= upToHole; h++) {
            if (flight1Result.cumulativePoints[h-1]) {
                t1Row[h-1] = flight1Result.cumulativePoints[h-1].teamAPoints;
            }
            if (flight2Result.cumulativePoints[h-1]) {
                t2Row[h-1] = flight2Result.cumulativePoints[h-1].teamAPoints;
            }
        }
        
        return {
            t1Row: t1Row,
            t2Row: t2Row,
            t1Total: flight1Result.teamAPoints,
            t2Total: flight2Result.teamAPoints,
            flight1Winner: flight1Result.finalWinner,
            flight2Winner: flight2Result.finalWinner
        };
    }
    
    // Get total points for Game 2 (sum of both flights)
    function getTotalPoints(players, flight1Data, flight2Data, course, upToHole) {
        var flight1Result = calculateFlightResults(1, players, flight1Data, course, upToHole);
        var flight2Result = calculateFlightResults(2, players, flight2Data, course, upToHole);
        
        // Each flight gives 1 point to the winner (0.5 each if tie)
        var flight1WinnerPoints = 0;
        var flight2WinnerPoints = 0;
        
        if (flight1Result.finalWinner === "A") {
            flight1WinnerPoints = 1;
        } else if (flight1Result.finalWinner === "B") {
            flight1WinnerPoints = 0;
        } else {
            flight1WinnerPoints = 0.5;
        }
        
        if (flight2Result.finalWinner === "A") {
            flight2WinnerPoints = 1;
        } else if (flight2Result.finalWinner === "B") {
            flight2WinnerPoints = 0;
        } else {
            flight2WinnerPoints = 0.5;
        }
        
        // Team A points = sum of flight winner points where Team A won
        // Team B points = 2 - Team A points (since each flight gives 1 point total)
        var teamAPoints = flight1WinnerPoints + flight2WinnerPoints;
        var teamBPoints = 2 - teamAPoints;
        
        return {
            teamAPoints: teamAPoints,
            teamBPoints: teamBPoints
        };
    }
    
    // Public API
    return {
        calculateFlightResults: calculateFlightResults,
        getTeamRows: getTeamRows,
        getTotalPoints: getTotalPoints,
        getStrokesForHole: getStrokesForHole,
        calculateNettScore: calculateNettScore,
        calculateEffectiveHandicaps: calculateEffectiveHandicaps
    };
})();