// FILE: js/game2-stroke.js - VERSION 1.00
// Game 3: Net Stroke (1 point)
//
// Description:
// Team aggregate game. All 8 players contribute to their team's total.
// NETT = Total Gross Scores - Total Handicaps
// Lower NETT wins the point (0.5 each if tie)
// Strk row shows which team is leading after each hole (A, B, or AS)

var Game2Stroke = (function() {
    
    // Calculate team NETT strokes for a given hole progress
    function calculateTeamNett(players, flight1Data, flight2Data, course, upToHole) {
        var teamAPlayers = players.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = players.filter(function(p) { return p.team === "B"; });
        
        var teamAGross = 0;
        var teamBGross = 0;
        var teamAHandicap = 0;
        var teamBHandicap = 0;
        
        // Calculate total handicaps
        for (var i = 0; i < teamAPlayers.length; i++) {
            teamAHandicap += teamAPlayers[i].handicap;
        }
        for (var i = 0; i < teamBPlayers.length; i++) {
            teamBHandicap += teamBPlayers[i].handicap;
        }
        
        // Calculate gross scores for completed holes
        for (var hole = 1; hole <= upToHole; hole++) {
            var flight1HoleData = Game2Data.parseHoleData(flight1Data, hole);
            var flight2HoleData = Game2Data.parseHoleData(flight2Data, hole);
            
            // Both flights must have saved the hole for it to count
            if (flight1HoleData && flight1HoleData.saved && flight2HoleData && flight2HoleData.saved) {
                // Flight 1 players (2 A, 2 B)
                var f1A1 = flight1HoleData.scores.a1;
                var f1A2 = flight1HoleData.scores.a2;
                var f1B1 = flight1HoleData.scores.b1;
                var f1B2 = flight1HoleData.scores.b2;
                
                // Flight 2 players (2 A, 2 B)
                var f2A1 = flight2HoleData.scores.a1;
                var f2A2 = flight2HoleData.scores.a2;
                var f2B1 = flight2HoleData.scores.b1;
                var f2B2 = flight2HoleData.scores.b2;
                
                // Team A gross = all A players from both flights
                teamAGross += f1A1 + f1A2 + f2A1 + f2A2;
                
                // Team B gross = all B players from both flights
                teamBGross += f1B1 + f1B2 + f2B1 + f2B2;
            }
        }
        
        var teamANett = teamAGross - teamAHandicap;
        var teamBNett = teamBGross - teamBHandicap;
        
        return {
            teamANett: teamANett,
            teamBNett: teamBNett,
            teamAGross: teamAGross,
            teamBGross: teamBGross,
            teamAHandicap: teamAHandicap,
            teamBHandicap: teamBHandicap
        };
    }
    
    // Get running stroke result after each hole (Strk row)
    function getStrokeRow(players, flight1Data, flight2Data, course, upToHole) {
        var strkRow = new Array(18).fill("-");
        var strkTotal = "-";
        var lastLeader = null;
        
        for (var hole = 1; hole <= upToHole; hole++) {
            var flight1HoleData = Game2Data.parseHoleData(flight1Data, hole);
            var flight2HoleData = Game2Data.parseHoleData(flight2Data, hole);
            
            // Both flights must have saved the hole for it to count
            if (flight1HoleData && flight1HoleData.saved && flight2HoleData && flight2HoleData.saved) {
                // Calculate NETT up to this hole
                var result = calculateTeamNett(players, flight1Data, flight2Data, course, hole);
                
                if (result.teamANett < result.teamBNett) {
                    strkRow[hole - 1] = "A";
                    lastLeader = "A";
                } else if (result.teamBNett < result.teamANett) {
                    strkRow[hole - 1] = "B";
                    lastLeader = "B";
                } else {
                    strkRow[hole - 1] = "AS";
                    lastLeader = "AS";
                }
            } else if (lastLeader !== null) {
                // Carry forward last known result
                strkRow[hole - 1] = lastLeader;
            }
        }
        
        // Determine total (last non-empty value)
        for (var h = upToHole - 1; h >= 0; h--) {
            if (strkRow[h] !== "-") {
                strkTotal = strkRow[h];
                break;
            }
        }
        
        return {
            strkRow: strkRow,
            strkTotal: strkTotal
        };
    }
    
    // Get final stroke result after all holes
    function getFinalResult(players, flight1Data, flight2Data, course, upToHole) {
        var result = calculateTeamNett(players, flight1Data, flight2Data, course, upToHole);
        
        var winner = null;
        var points = 0;
        
        if (result.teamANett < result.teamBNett) {
            winner = "A";
            points = 1;
        } else if (result.teamBNett < result.teamANett) {
            winner = "B";
            points = 1;
        } else {
            winner = "TIE";
            points = 0.5;
        }
        
        return {
            winner: winner,
            points: points,
            teamANett: result.teamANett,
            teamBNett: result.teamBNett
        };
    }
    
    // Get total points for Game 3
    function getTotalPoints(players, flight1Data, flight2Data, course, upToHole) {
        var result = getFinalResult(players, flight1Data, flight2Data, course, upToHole);
        
        if (result.winner === "A") {
            return { teamAPoints: 1, teamBPoints: 0 };
        } else if (result.winner === "B") {
            return { teamAPoints: 0, teamBPoints: 1 };
        } else {
            return { teamAPoints: 0.5, teamBPoints: 0.5 };
        }
    }
    
    // Public API
    return {
        calculateTeamNett: calculateTeamNett,
        getStrokeRow: getStrokeRow,
        getFinalResult: getFinalResult,
        getTotalPoints: getTotalPoints
    };
})();