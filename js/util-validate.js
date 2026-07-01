/*
FILE: js/util-validate.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Created wrapper for game engine functions
   - ADDED: calculateTeamGame() - wraps GameTeam.calculate()
   - ADDED: calculateStrokeGame() - wraps GameStroke.calculate()
   - ADDED: calculateMatchGamePerHole() - wraps GameMatch functions
   - ADDED: validateRecord() - validates a game record
   - ADDED: buildFixPreview() - builds fix preview data
   - ADDED: buildFixPayload() - builds fix payload for Firestore
   - ADDED: getAllPlayers() - helper to get players from record
DEPENDS ON: game-team.js, game-stroke.js, game-match.js, game-loader.js, game-data.js, util-core.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_VALIDATE_VERSION = "1.00";
console.log("[UTIL-VALIDATE] Initializing v1.00 - Wrapper for game engines");

// ============================================================
// UtilValidate - Wrapper for game engine functions
// ============================================================

var UtilValidate = (function() {
    
    console.log("[UTIL-VALIDATE] Creating UtilValidate wrapper");

    // ============================================================
    // Helper: Get players from record
    // ============================================================
    
    function getAllPlayers(record) {
        if (!record) return [];
        if (record.players) return record.players;
        if (record.gameInfo && record.gameInfo.players) return record.gameInfo.players;
        return [];
    }

    // ============================================================
    // Helper: Get course SI and Par from record
    // ============================================================
    
    function getCourseData(record) {
        var course = record.course || record.gameInfo?.course || {};
        return {
            si: course.si || [],
            par: course.par || [],
            name: course.name || 'Unknown'
        };
    }

    // ============================================================
    // calculateTeamGame()
    // Wraps GameTeam.calculate()
    // ============================================================
    
    function calculateTeamGame(f1Scores, players, flight, courseSi) {
        console.log('[UTIL-VALIDATE] calculateTeamGame called - flight:', flight);
        
        if (typeof GameTeam === 'undefined' || typeof GameTeam.calculate !== 'function') {
            console.error('[UTIL-VALIDATE] GameTeam.calculate not available');
            return [];
        }
        
        try {
            // GameTeam.calculate expects: allPlayers, f1DataString, f2DataString, courseSi, startingHole, teamGameFormat
            // We need to build the data strings from f1Scores
            var f1DataString = buildDataStringFromScores(f1Scores);
            var f2DataString = ''; // Flight 2 not needed for flight 1 calculation
            
            var result = GameTeam.calculate(
                players,
                f1DataString,
                f2DataString,
                courseSi || [],
                1, // startingHole
                'tournament' // teamGameFormat
            );
            
            // Return the appropriate flight results
            if (flight === 1) {
                return result.flight1Cumulative || [];
            } else {
                return result.flight2Cumulative || [];
            }
        } catch (e) {
            console.error('[UTIL-VALIDATE] calculateTeamGame error:', e);
            return [];
        }
    }

    // ============================================================
    // calculateStrokeGame()
    // Wraps GameStroke.calculate()
    // ============================================================
    
    function calculateStrokeGame(f1Scores, f2Scores, players) {
        console.log('[UTIL-VALIDATE] calculateStrokeGame called');
        
        if (typeof GameStroke === 'undefined' || typeof GameStroke.calculate !== 'function') {
            console.error('[UTIL-VALIDATE] GameStroke.calculate not available');
            return null;
        }
        
        try {
            var f1DataString = buildDataStringFromScores(f1Scores);
            var f2DataString = buildDataStringFromScores(f2Scores);
            
            var courseSi = [];
            var coursePar = [];
            
            if (players && players.length > 0) {
                // Try to get course data from players
                var samplePlayer = players[0];
                if (samplePlayer.courseSi) courseSi = samplePlayer.courseSi;
                if (samplePlayer.coursePar) coursePar = samplePlayer.coursePar;
            }
            
            var result = GameStroke.calculate(
                players,
                f1DataString,
                f2DataString,
                courseSi || [],
                1, // startingHole
                coursePar || []
            );
            
            return result;
        } catch (e) {
            console.error('[UTIL-VALIDATE] calculateStrokeGame error:', e);
            return null;
        }
    }

    // ============================================================
    // calculateMatchGamePerHole()
    // Wraps GameMatch functions
    // ============================================================
    
    function calculateMatchGamePerHole(f1Scores, f2Scores, players, courseSi, coursePar) {
        console.log('[UTIL-VALIDATE] calculateMatchGamePerHole called');
        
        if (typeof GameMatch === 'undefined') {
            console.error('[UTIL-VALIDATE] GameMatch not available');
            return { orderedPlayers: [], results: [], matchPointsPerHole: [] };
        }
        
        try {
            var f1DataString = buildDataStringFromScores(f1Scores);
            var f2DataString = buildDataStringFromScores(f2Scores);
            
            // Use GameMatch.calculateCrossFlightWithClinch for cross-flight matches
            var result = GameMatch.calculateCrossFlightWithClinch(
                f1DataString,
                f2DataString,
                players || [],
                courseSi || [],
                1, // startingHole
                18, // coursePar length
                0, // remainingHoles (will be calculated)
                null, // currentHole
                null, // deviceId
                null, // cascadeVersion
                {} // existingClinched
            );
            
            // Build match points per hole
            var matchPointsPerHole = [];
            if (result.matchResultsArray) {
                for (var i = 0; i < 18; i++) {
                    var holePoints = {};
                    // Simplified - return the match results for each hole
                    if (result.matchResultsArray[i]) {
                        // Format for UI
                        matchPointsPerHole.push({
                            points: result.matchResultsArray[i] || {},
                            clinchInfo: {}
                        });
                    } else {
                        matchPointsPerHole.push({
                            points: {},
                            clinchInfo: {}
                        });
                    }
                }
            }
            
            return {
                orderedPlayers: players || [],
                results: result.matchResultsArray || [],
                matchPointsPerHole: matchPointsPerHole
            };
        } catch (e) {
            console.error('[UTIL-VALIDATE] calculateMatchGamePerHole error:', e);
            return { orderedPlayers: [], results: [], matchPointsPerHole: [] };
        }
    }

    // ============================================================
    // Helper: Build data string from scores array
    // ============================================================
    
    function buildDataStringFromScores(scores) {
        if (!scores || scores.length === 0) {
            // Return default empty data string (all F, all scores = 0)
            var empty = '';
            for (var i = 0; i < 18; i++) {
                empty += 'F00000000';
            }
            return empty;
        }
        
        var dataString = '';
        for (var h = 0; h < 18; h++) {
            var hole = scores[h] || {};
            var saved = hole.saved ? 'T' : 'F';
            var a1 = String(hole.a1 || 0).padStart(2, '0');
            var a2 = String(hole.a2 || 0).padStart(2, '0');
            var b1 = String(hole.b1 || 0).padStart(2, '0');
            var b2 = String(hole.b2 || 0).padStart(2, '0');
            dataString += saved + a1 + a2 + b1 + b2;
        }
        return dataString;
    }

    // ============================================================
    // validateRecord()
    // Main validation function
    // ============================================================
    
    function validateRecord(record) {
        console.log('[UTIL-VALIDATE] validateRecord called');
        
        if (!record) {
            console.error('[UTIL-VALIDATE] No record provided');
            return {
                valid: false,
                needsFix: false,
                mismatches: [],
                matches: [],
                summary: { totalFields: 0, matched: 0, mismatched: 0 }
            };
        }
        
        // Get data from record
        var players = record.players || [];
        var f1DataString = record.f1DataString || record.f1?.d || '';
        var f2DataString = record.f2DataString || record.f2?.d || '';
        var courseData = getCourseData(record);
        var courseSi = courseData.si || [];
        var coursePar = courseData.par || [];
        var startingHole = record.startingHole || 1;
        var teamGameFormat = record.teamGameFormat || 'tournament';
        var status = record.status || 'unknown';
        var signatures = record.signatures || { f1: { signed: false }, f2: { signed: false } };
        var celebration = record.celebration || {};
        var finalResults = record.finalResults || {};
        var results = record.results || {};
        var adjustedHandicaps = record.adjustedHandicaps || null;
        
        // Parse scores from data strings
        var f1Scores = parseScoresFromDataString(f1DataString);
        var f2Scores = parseScoresFromDataString(f2DataString);
        
        // Calculate team game results using GameTeam
        var teamGameResults = null;
        if (typeof GameTeam !== 'undefined' && typeof GameTeam.calculate === 'function') {
            try {
                teamGameResults = GameTeam.calculate(
                    players,
                    f1DataString,
                    f2DataString,
                    courseSi,
                    startingHole,
                    teamGameFormat
                );
            } catch (e) {
                console.error('[UTIL-VALIDATE] GameTeam.calculate error:', e);
            }
        }
        
        // Calculate stroke game results using GameStroke
        var strokeResults = null;
        if (typeof GameStroke !== 'undefined' && typeof GameStroke.calculate === 'function') {
            try {
                strokeResults = GameStroke.calculate(
                    players,
                    f1DataString,
                    f2DataString,
                    courseSi,
                    startingHole,
                    coursePar
                );
            } catch (e) {
                console.error('[UTIL-VALIDATE] GameStroke.calculate error:', e);
            }
        }
        
        // Build validation result
        var mismatches = [];
        var matches = [];
        var summary = { totalFields: 0, matched: 0, mismatched: 0 };
        
        // Validate handicap adjustment data
        var handicapValidation = null;
        if (typeof window.validateHandicapAdjustment === 'function') {
            try {
                handicapValidation = window.validateHandicapAdjustment(record);
            } catch (e) {
                console.error('[UTIL-VALIDATE] validateHandicapAdjustment error:', e);
            }
        }
        
        // Combine results
        var valid = true;
        var needsFix = false;
        var allMismatches = [];
        var allMatches = [];
        var totalMatched = 0;
        var totalMismatched = 0;
        
        // Add handicap validation results
        if (handicapValidation) {
            if (handicapValidation.mismatches) {
                allMismatches = allMismatches.concat(handicapValidation.mismatches);
            }
            if (handicapValidation.matches) {
                allMatches = allMatches.concat(handicapValidation.matches);
            }
            if (handicapValidation.summary) {
                totalMatched += handicapValidation.summary.matched || 0;
                totalMismatched += handicapValidation.summary.mismatched || 0;
            }
            if (!handicapValidation.valid) {
                valid = false;
                needsFix = true;
            }
        }
        
        // Check if record is completed
        var isCompletedGame = (status === 'completed' || (signatures.f1 && signatures.f1.signed && signatures.f2 && signatures.f2.signed));
        var bothSigned = (signatures.f1 && signatures.f1.signed && signatures.f2 && signatures.f2.signed);
        var expectedStatus = isCompletedGame ? 'completed' : status;
        
        // Photo status
        var photoStatus = {
            hasPhoto: !!(celebration.imageUrl || celebration.url || celebration.imageRef),
            url: celebration.imageUrl || celebration.url || null,
            path: celebration.imageRef || null,
            expectedPath: celebration.expectedPath || null
        };
        
        var finalSummary = {
            totalFields: totalMatched + totalMismatched,
            matched: totalMatched,
            mismatched: totalMismatched
        };
        
        return {
            valid: valid,
            needsFix: needsFix,
            mismatches: allMismatches,
            matches: allMatches,
            summary: finalSummary,
            recalculated: {
                teamGame: teamGameResults,
                stroke: strokeResults
            },
            f1Scores: f1Scores,
            f2Scores: f2Scores,
            players: players,
            courseSi: courseSi,
            coursePar: coursePar,
            status: status,
            expectedStatus: expectedStatus,
            isCompletedGame: isCompletedGame,
            bothSigned: bothSigned,
            photoStatus: photoStatus,
            handicapValid: handicapValidation ? handicapValidation.valid : true,
            handicapMismatches: handicapValidation ? handicapValidation.mismatches : [],
            handicapMatches: handicapValidation ? handicapValidation.matches : [],
            handicapSummary: handicapValidation ? handicapValidation.summary : { totalFields: 0, matched: 0, mismatched: 0 },
            handicapStored: handicapValidation ? handicapValidation.handicapStored : null,
            handicapRecalculated: handicapValidation ? handicapValidation.handicapRecalculated : null,
            // Keep these for backward compatibility
            validation: handicapValidation
        };
    }

    // ============================================================
    // Helper: Parse scores from data string
    // ============================================================
    
    function parseScoresFromDataString(dataString) {
        var scores = [];
        if (!dataString || dataString.length < 162) {
            for (var i = 0; i < 18; i++) {
                scores.push({ saved: false, a1: null, a2: null, b1: null, b2: null });
            }
            return scores;
        }
        
        for (var i = 0; i < 18; i++) {
            var start = i * 9;
            var segment = dataString.substring(start, start + 9);
            if (segment.length === 9) {
                scores.push({
                    saved: segment.charAt(0) === 'T',
                    a1: parseInt(segment.substring(1, 3), 10) || 0,
                    a2: parseInt(segment.substring(3, 5), 10) || 0,
                    b1: parseInt(segment.substring(5, 7), 10) || 0,
                    b2: parseInt(segment.substring(7, 9), 10) || 0
                });
            } else {
                scores.push({ saved: false, a1: null, a2: null, b1: null, b2: null });
            }
        }
        return scores;
    }

    // ============================================================
    // buildFixPreview()
    // Builds fix preview data
    // ============================================================
    
    function buildFixPreview(record, recalculated) {
        console.log('[UTIL-VALIDATE] buildFixPreview called');
        
        var changes = [];
        var unchanged = [];
        var notTouched = [];
        var mismatchedHoles = [];
        var hasChanges = false;
        
        // Get stored and recalculated data
        var storedResults = record.results || {};
        var recalcData = recalculated || {};
        
        // Check for changes in TR values
        if (storedResults.tr && recalcData.teamGame) {
            var storedTeamA = storedResults.tr.teamA || [];
            var storedTeamB = storedResults.tr.teamB || [];
            var recalcTeamA = recalcData.teamGame?.flight1Cumulative || [];
            var recalcTeamB = recalcData.teamGame?.flight2Cumulative || [];
            
            for (var i = 0; i < 18; i++) {
                var storedA = storedTeamA[i] !== undefined ? storedTeamA[i] : null;
                var storedB = storedTeamB[i] !== undefined ? storedTeamB[i] : null;
                var recalcA = recalcTeamA[i] !== undefined ? recalcTeamA[i] : null;
                var recalcB = recalcTeamB[i] !== undefined ? recalcTeamB[i] : null;
                
                if (storedA !== recalcA || storedB !== recalcB) {
                    var change = {
                        field: 'TR H' + (i + 1),
                        current: storedA + ' - ' + storedB,
                        new: recalcA + ' - ' + recalcB,
                        type: 'TR'
                    };
                    changes.push(change);
                    mismatchedHoles.push(i + 1);
                    hasChanges = true;
                } else {
                    unchanged.push('TR H' + (i + 1));
                }
            }
        }
        
        // Add handicap changes
        if (record.adjustedHandicaps) {
            notTouched.push('adjustedHandicaps');
        }
        
        // Not touched fields
        notTouched.push('f1IntraMatches', 'f2IntraMatches', 'matchResults');
        
        return {
            hasChanges: hasChanges,
            changes: changes,
            unchanged: unchanged,
            notTouched: notTouched,
            notTouchedCount: notTouched.length,
            changeCount: changes.length,
            unchangedCount: unchanged.length,
            mismatchedHoles: mismatchedHoles,
            photoStatus: {
                hasPhoto: !!(record.celebration && (record.celebration.imageUrl || record.celebration.url))
            }
        };
    }

    // ============================================================
    // buildFixPayload()
    // Builds fix payload for Firestore
    // ============================================================
    
    function buildFixPayload(record, recalculated) {
        console.log('[UTIL-VALIDATE] buildFixPayload called');
        
        if (!record || !recalculated) {
            console.error('[UTIL-VALIDATE] Missing record or recalculated data');
            return { hasChanges: false, updatePayload: {}, fieldsUpdated: [] };
        }
        
        var updatePayload = {};
        var fieldsUpdated = [];
        var hasChanges = false;
        
        // Build TR update
        var trUpdate = {};
        if (recalculated.teamGame) {
            var teamGame = recalculated.teamGame;
            if (teamGame.displayT1) {
                trUpdate.teamA = teamGame.displayT1;
                fieldsUpdated.push('tr.teamA');
                hasChanges = true;
            }
            if (teamGame.displayT2) {
                trUpdate.teamB = teamGame.displayT2;
                fieldsUpdated.push('tr.teamB');
                hasChanges = true;
            }
            if (teamGame.flight1Cumulative) {
                trUpdate.flight1Cumulative = teamGame.flight1Cumulative;
                fieldsUpdated.push('tr.flight1Cumulative');
            }
            if (teamGame.flight2Cumulative) {
                trUpdate.flight2Cumulative = teamGame.flight2Cumulative;
                fieldsUpdated.push('tr.flight2Cumulative');
            }
        }
        
        // Add stroke game update
        if (recalculated.stroke) {
            var stroke = recalculated.stroke;
            if (stroke.displayStrk) {
                if (!updatePayload.results) updatePayload.results = {};
                if (!updatePayload.results.game3) updatePayload.results.game3 = {};
                updatePayload.results.game3.displayStrk = stroke.displayStrk;
                fieldsUpdated.push('results.game3.displayStrk');
                hasChanges = true;
            }
        }
        
        // Add handicap update
        if (record.adjustedHandicaps) {
            // Handicap fix is handled separately in util-validate-record.js
            // Don't overwrite here
        }
        
        // Build final payload
        if (Object.keys(trUpdate).length > 0) {
            if (!updatePayload.results) updatePayload.results = {};
            if (!updatePayload.results.tr) updatePayload.results.tr = {};
            for (var key in trUpdate) {
                updatePayload.results.tr[key] = trUpdate[key];
            }
        }
        
        return {
            hasChanges: hasChanges,
            updatePayload: updatePayload,
            fieldsUpdated: fieldsUpdated
        };
    }

    // ============================================================
    // EXPOSE FUNCTIONS GLOBALLY
    // ============================================================
    
    return {
        calculateTeamGame: calculateTeamGame,
        calculateStrokeGame: calculateStrokeGame,
        calculateMatchGamePerHole: calculateMatchGamePerHole,
        validateRecord: validateRecord,
        buildFixPreview: buildFixPreview,
        buildFixPayload: buildFixPayload,
        buildDataStringFromScores: buildDataStringFromScores,
        parseScoresFromDataString: parseScoresFromDataString
    };
    
})();

// Make available globally
window.UtilValidate = UtilValidate;

console.log('[UTIL-VALIDATE] v1.00 loaded');
console.log('[UTIL-VALIDATE] Functions exposed:', Object.keys(UtilValidate).join(', '));

/*
FILE: js/util-validate.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Created wrapper for game engine functions
   - ADDED: calculateTeamGame() - wraps GameTeam.calculate()
   - ADDED: calculateStrokeGame() - wraps GameStroke.calculate()
   - ADDED: calculateMatchGamePerHole() - wraps GameMatch functions
   - ADDED: validateRecord() - validates a game record
   - ADDED: buildFixPreview() - builds fix preview data
   - ADDED: buildFixPayload() - builds fix payload for Firestore
   - ADDED: getAllPlayers() - helper to get players from record
DEPENDS ON: game-team.js, game-stroke.js, game-match.js, game-loader.js, game-data.js, util-core.js
STATUS: Ready for integration
*/