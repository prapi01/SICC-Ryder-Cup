/*
FILE: js/real-game-cascade.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: Clinch hole assignment to cache in calculateHoleResultsWithCumulative()
   - REASON: flight1ClinchedHole and flight2ClinchedHole were calculated but never stored in cascade path
   - REASON: game-scorecard.js reads cache.results.game2.flight1/2.clinchedHole for GOLD display
   - REASON: Without this, T-x rows never show GOLD even when clinched during cascade recalculation
   - PRESERVED: ALL other functionality from v1.01 unchanged
DEPENDS ON: RealGameState, RealGameUtils, GameMatch, GameTeam, GameStroke, GameLoader
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_CASCADE_VERSION = "1.02";

var RealGameCascade = (function() {
    
    console.log("[REAL-GAME-CASCADE] Initializing v1.02 - Clinch hole assignment to cache");
    
    // ============================================================
    // Private Helpers
    // ============================================================
    
    function getAllPlayers() {
        return RealGameState.getAllPlayers();
    }
    
    function getCourseSi() {
        return RealGameState.getCourseSi();
    }
    
    function getStartingHole() {
        return RealGameState.getStartingHole();
    }
    
    function getTeamGameFormat() {
        return RealGameState.getTeamGameFormat();
    }
    
    function getCoursePar() {
        return RealGameState.getCoursePar();
    }
    
    function getDebugTargetHole() {
        return RealGameState.getDebugTargetHole();
    }
    
    function incrementDebugCounter(counterName) {
        RealGameState.incrementDebugCounter(counterName);
    }
    
    function getDebugCallCounters() {
        return RealGameState.getDebugCallCounters();
    }
    
    // ============================================================
    // calculateHoleResultsWithCumulative - MAIN CASCADE FUNCTION
    // ============================================================
    
    function calculateHoleResultsWithCumulative(holeNumber, cumulativeClinched, cumulativeFlight1ClinchedHole, cumulativeFlight2ClinchedHole, cascadeStartHole) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) {
            console.warn("[CASCADE] No cache available");
            return null;
        }
        
        var allPlayers = getAllPlayers();
        var courseSi = getCourseSi();
        var startingHole = getStartingHole();
        var teamGameFormat = getTeamGameFormat();
        var coursePar = getCoursePar();
        
        var isTarget = (holeNumber === getDebugTargetHole());
        
        if(isTarget) {
            incrementDebugCounter('calc');
            console.log(`[DEBUG-CALC] === CALC #${getDebugCallCounters().calc} for HOLE ${holeNumber} (TARGET) ===`);
            console.log(`[DEBUG-CALC] cascadeStartHole=${cascadeStartHole}`);
        }
        
        var position = RealGameUtils.getHolePosition(holeNumber);
        var f1Hole = cache.flight1Data ? cache.flight1Data[holeNumber] : null;
        var f2Hole = cache.flight2Data ? cache.flight2Data[holeNumber] : null;
        
        var f1Available = (f1Hole && f1Hole.saved);
        var f2Available = (f2Hole && f2Hole.saved);
        var crossAvailable = f1Available && f2Available;
        
        if(isTarget) {
            console.log(`[DEBUG-CALC] f1Available=${f1Available}, f2Available=${f2Available}, crossAvailable=${crossAvailable}`);
            console.log(`[DEBUG-CALC] f1Hole.saved=${f1Hole?.saved}, f2Hole.saved=${f2Hole?.saved}`);
        }
        
        // Build remainingHolesByPosition array
        var remainingHolesByPosition = new Array(18);
        for (var pos = 0; pos < 18; pos++) {
            var holeForPos = RealGameUtils.getHoleAtPosition(pos);
            remainingHolesByPosition[pos] = RealGameUtils.getRemainingHolesFromPlayOrder(holeForPos);
        }
        
        // Calculate team game results (T-1, T-2) for all positions
        var teamGameResults = null;
        if (typeof GameTeam !== 'undefined') {
            teamGameResults = GameTeam.calculateWithClinched(
                allPlayers, cache.f1DataString, cache.f2DataString, 
                courseSi, startingHole, teamGameFormat, remainingHolesByPosition
            );
        }
        
        // v1.02: Store clinch holes in cache for UI display (GOLD)
        if (teamGameResults) {
            if (teamGameResults.flight1ClinchedHole !== null && teamGameResults.flight1ClinchedHole !== undefined) {
                cache.results.game2.flight1.clinchedHole = teamGameResults.flight1ClinchedHole;
            }
            if (teamGameResults.flight2ClinchedHole !== null && teamGameResults.flight2ClinchedHole !== undefined) {
                cache.results.game2.flight2.clinchedHole = teamGameResults.flight2ClinchedHole;
            }
        }
        
        var flight1ClinchedHoleResult = teamGameResults ? teamGameResults.flight1ClinchedHole : null;
        var flight2ClinchedHoleResult = teamGameResults ? teamGameResults.flight2ClinchedHole : null;
        
        var f1IntraMatchesForHole = null;
        var clinchedAtUpdates = {};
        var remainingHoles = RealGameUtils.getRemainingHolesFromPlayOrder(holeNumber);
        var deviceId = typeof SessionManager !== 'undefined' ? SessionManager.getDeviceIdDisplay() : "unknown";
        var cascadeVersion = window.REAL_GAME_VERSION || "6.10";
        
        var holesPlayed = position + 1;
        
        if (f1Available && typeof GameMatch !== 'undefined') {
            var flight1Players = allPlayers.filter(function(p) { return p.flight === 1; });
            if(isTarget) console.log(`[DEBUG-CALC] Calling Flight 1 intra-flight for hole ${holeNumber}, holesPlayed=${holesPlayed}`);
            var intra1Result = GameMatch.calculateIntraFlightWithClinch(
                1, flight1Players, cache.f1DataString, courseSi, startingHole, holesPlayed, coursePar,
                remainingHoles, holeNumber, deviceId, cascadeVersion, cumulativeClinched
            );
            f1IntraMatchesForHole = intra1Result.intraMatches;
            for (var matchKey in intra1Result.clinchedAtUpdates) {
                clinchedAtUpdates[matchKey] = intra1Result.clinchedAtUpdates[matchKey];
            }
            if(isTarget) console.log(`[DEBUG-CALC] Flight 1 intra: ${Object.keys(intra1Result.intraMatches || {}).length} matches, ${Object.keys(intra1Result.clinchedAtUpdates).length} clinch updates`);
        }
        
        var f2IntraMatchesForHole = null;
        
        if (f2Available && typeof GameMatch !== 'undefined') {
            var flight2Players = allPlayers.filter(function(p) { return p.flight === 2; });
            if(isTarget) console.log(`[DEBUG-CALC] Calling Flight 2 intra-flight for hole ${holeNumber}, holesPlayed=${holesPlayed}`);
            var intra2Result = GameMatch.calculateIntraFlightWithClinch(
                2, flight2Players, cache.f2DataString, courseSi, startingHole, holesPlayed, coursePar,
                remainingHoles, holeNumber, deviceId, cascadeVersion, cumulativeClinched
            );
            f2IntraMatchesForHole = intra2Result.intraMatches;
            for (var matchKey in intra2Result.clinchedAtUpdates) {
                clinchedAtUpdates[matchKey] = intra2Result.clinchedAtUpdates[matchKey];
            }
            if(isTarget) {
                console.log(`[DEBUG-CALC] Flight 2 intra: ${Object.keys(intra2Result.intraMatches || {}).length} matches, ${Object.keys(intra2Result.clinchedAtUpdates).length} clinch updates`);
                if(f2IntraMatchesForHole) {
                    console.log(`[DEBUG-CALC] f2IntraMatchesForHole content:`, f2IntraMatchesForHole);
                } else {
                    console.warn(`[DEBUG-CALC] f2IntraMatchesForHole is NULL!`);
                }
            }
        }
        
        var matchResultsArray = null;
        var game1PointsA = 0, game1PointsB = 0;
        
        if (crossAvailable && typeof GameMatch !== 'undefined') {
            if(isTarget) console.log(`[DEBUG-CALC] Calling cross-flight matches for hole ${holeNumber}`);
            
            var holesToAccumulate = position + 1;
            
            if(isTarget) {
                console.log(`[DEBUG-CALC] v5.93: Using holesToAccumulate = ${holesToAccumulate} (position=${position})`);
            }
            
            var crossResult = GameMatch.calculateCrossFlightWithClinch(
                cache.f1DataString, cache.f2DataString, allPlayers, courseSi, startingHole, 
                holesToAccumulate, coursePar,
                remainingHoles, holeNumber, deviceId, cascadeVersion, cumulativeClinched
            );
            matchResultsArray = crossResult.matchResultsArray;
            
            for (var matchKey in crossResult.clinchedAtUpdates) {
                clinchedAtUpdates[matchKey] = crossResult.clinchedAtUpdates[matchKey];
            }
            
            var matchResultsObj = crossResult.matchResultsObj;
            var matchCount = 0;
            for (var key in matchResultsObj) {
                if (key.indexOf("_vs_") !== -1 && matchCount < 16) {
                    var firstPlayerName = key.split("_vs_")[0];
                    var firstPlayer = allPlayers.find(function(p) { return p.name === firstPlayerName; });
                    if (firstPlayer && firstPlayer.team === "A") {
                        var value = matchResultsObj[key];
                        if (value > 0) game1PointsA += 1;
                        else if (value < 0) game1PointsB += 1;
                        else { game1PointsA += 0.5; game1PointsB += 0.5; }
                        matchCount++;
                    }
                }
            }
            if(isTarget) console.log(`[DEBUG-CALC] Cross: ${Object.keys(crossResult.clinchedAtUpdates).length} clinch updates, game1Points=${game1PointsA}-${game1PointsB}`);
        }
        
        var strkLeader = "AS";
        var strkDisplay = "AS";
        
        if (crossAvailable && typeof GameStroke !== 'undefined') {
            var strokeResults = GameStroke.calculate(allPlayers, cache.f1DataString, cache.f2DataString, courseSi, startingHole, coursePar);
            strkLeader = strokeResults.leader[position] === "A" ? "A" : strokeResults.leader[position] === "B" ? "B" : "AS";
            strkDisplay = strokeResults.displayStrk?.[position] || "AS";
        }
        
        var cumulativeF1 = teamGameResults ? teamGameResults.flight1Cumulative[position] : 0;
        var cumulativeF2 = teamGameResults ? teamGameResults.flight2Cumulative[position] : 0;
        var t1Leader = teamGameResults ? teamGameResults.flight1Leaders[position] : "AS";
        var t2Leader = teamGameResults ? teamGameResults.flight2Leaders[position] : "AS";
        var t1Display = teamGameResults ? teamGameResults.displayT1[position] : "AS";
        var t2Display = teamGameResults ? teamGameResults.displayT2[position] : "AS";
        
        var flight1PointsA = (cumulativeF1 > 0) ? 1 : (cumulativeF1 < 0) ? 0 : 0.5;
        var flight1PointsB = (cumulativeF1 > 0) ? 0 : (cumulativeF1 < 0) ? 1 : 0.5;
        var flight2PointsA = (cumulativeF2 > 0) ? 1 : (cumulativeF2 < 0) ? 0 : 0.5;
        var flight2PointsB = (cumulativeF2 > 0) ? 0 : (cumulativeF2 < 0) ? 1 : 0.5;
        var game2PointsA = flight1PointsA + flight2PointsA;
        var game2PointsB = flight1PointsB + flight2PointsB;
        
        var game3PointsA = (strkLeader === "A") ? 1 : (strkLeader === "B") ? 0 : 0.5;
        var game3PointsB = (strkLeader === "A") ? 0 : (strkLeader === "B") ? 1 : 0.5;
        
        var trA, trB, trAGreen, trBGreen;
        
        if (crossAvailable) {
            trA = game1PointsA + game2PointsA + game3PointsA;
            trB = game1PointsB + game2PointsB + game3PointsB;
            trAGreen = (trA > trB);
            trBGreen = (trB > trA);
            if(isTarget) console.log(`[DEBUG-CALC] TR = ${trA} - ${trB}`);
        } else {
            trA = null;
            trB = null;
            trAGreen = false;
            trBGreen = false;
            if(isTarget) console.log(`[DEBUG-CALC] TR set to null (incomplete data)`);
        }
        
        var isCascadeStartHole = (holeNumber < cascadeStartHole);
        var updatedClinched = typeof GameMatch !== 'undefined' ? GameMatch.updateClinchedAt(cumulativeClinched, clinchedAtUpdates, cascadeStartHole, isCascadeStartHole) : cumulativeClinched;
        
        var result = {
            position: position,
            matchResults: matchResultsArray,
            f1IntraMatches: f1IntraMatchesForHole,
            f2IntraMatches: f2IntraMatchesForHole,
            t1Leader: t1Leader,
            t2Leader: t2Leader,
            strkLeader: strkLeader,
            game1PointsA: game1PointsA,
            game1PointsB: game1PointsB,
            game2PointsA: game2PointsA,
            game2PointsB: game2PointsB,
            game3PointsA: game3PointsA,
            game3PointsB: game3PointsB,
            trA: trA,
            trB: trB,
            trAGreen: trAGreen,
            trBGreen: trBGreen,
            flight1Total: cumulativeF1,
            flight2Total: cumulativeF2,
            flight1ClinchedHole: flight1ClinchedHoleResult,
            flight2ClinchedHole: flight2ClinchedHoleResult,
            clinchedAtUpdates: clinchedAtUpdates,
            updatedClinched: updatedClinched,
            updatedFlight1ClinchedHole: flight1ClinchedHoleResult,
            updatedFlight2ClinchedHole: flight2ClinchedHoleResult,
            t1Display: t1Display,
            t2Display: t2Display,
            strkDisplay: strkDisplay,
            netThisHoleF1: 0,
            netThisHoleF2: 0,
            cumulativeF1: cumulativeF1,
            cumulativeF2: cumulativeF2
        };
        
        if(isTarget) {
            console.log(`[DEBUG-CALC] FINAL RESULT for hole ${holeNumber}:`);
            console.log(`  - f1IntraMatches: ${result.f1IntraMatches ? Object.keys(result.f1IntraMatches).length + ' entries' : 'null'}`);
            console.log(`  - f2IntraMatches: ${result.f2IntraMatches ? Object.keys(result.f2IntraMatches).length + ' entries' : 'null'}`);
            console.log(`  - matchResults: ${result.matchResults ? result.matchResults.length + ' values' : 'null'}`);
            console.log(`  - clinchedAtUpdates: ${Object.keys(result.clinchedAtUpdates).length}`);
        }
        
        console.log(`[CASCADE-DEBUG] Hole ${holeNumber}: T-1=${t1Display}, T-2=${t2Display}, TR=${trA === null ? '-' : trA + '-' + trB}`);
        
        return result;
    }
    
    // ============================================================
    // calculateCascadeForHole - Single hole recalculation wrapper
    // ============================================================
    
    function calculateCascadeForHole(holeNumber) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) {
            console.warn("[CASCADE] No cache available");
            return null;
        }
        
        var existingClinched = cache.results?.clinchedAt || {};
        var flight1Clinched = cache.results?.game2?.flight1?.clinchedHole || null;
        var flight2Clinched = cache.results?.game2?.flight2?.clinchedHole || null;
        
        return calculateHoleResultsWithCumulative(holeNumber, existingClinched, flight1Clinched, flight2Clinched, holeNumber);
    }
    
    // ============================================================
    // getCumulativeClinched - Helper to get cumulative clinched data
    // ============================================================
    
    function getCumulativeClinched(cache) {
        if (!cache || !cache.results) {
            return {};
        }
        return cache.results.clinchedAt || {};
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        calculateHoleResultsWithCumulative: calculateHoleResultsWithCumulative,
        calculateCascadeForHole: calculateCascadeForHole,
        getCumulativeClinched: getCumulativeClinched
    };
    
})();

// Make available globally
window.RealGameCascade = RealGameCascade;

/*
FILE: js/real-game-cascade.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: Clinch hole assignment to cache in calculateHoleResultsWithCumulative()
   - REASON: flight1ClinchedHole and flight2ClinchedHole were calculated but never stored in cascade path
   - REASON: game-scorecard.js reads cache.results.game2.flight1/2.clinchedHole for GOLD display
   - REASON: Without this, T-x rows never show GOLD even when clinched during cascade recalculation
   - PRESERVED: ALL other functionality from v1.01 unchanged
DEPENDS ON: RealGameState, RealGameUtils, GameMatch, GameTeam, GameStroke, GameLoader
STATUS: Ready for integration
*/