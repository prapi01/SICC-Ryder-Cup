/*
FILE: js/real-game-utils.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Extracted utility functions from real-game.html
   - Contains: getPlayOrder(), getHolePosition(), getHoleAtPosition()
   - Contains: getRemainingHolesFromPlayOrder(), getLastHole()
   - Contains: getHighestBothSaved(), updateGameOrder()
   - Contains: initializeEmptyResults(), calculatePlayerTotals()
   - All functions are pure delegates to GameOrder where possible
DEPENDS ON: js/game-order.js, js/game-data.js, GameLoader (for cache)
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_UTILS_VERSION = "1.00";

var RealGameUtils = (function() {
    
    console.log("[REAL-GAME-UTILS] Initializing v1.00");
    
    // ============================================================
    // GameOrder Delegates
    // ============================================================
    
    function getPlayOrder() {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayOrder) {
            return GameOrder.getPlayOrder();
        }
        // Fallback (should never be needed if GameOrder is loaded)
        var startingHole = getStartingHoleFromCache();
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    function getHolePosition(holeNumber) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayPosition) {
            return GameOrder.getPlayPosition(holeNumber);
        }
        // Fallback
        var playOrder = getPlayOrder();
        var pos = playOrder.indexOf(holeNumber);
        return pos !== -1 ? pos : holeNumber - 1;
    }
    
    function getHoleAtPosition(position) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getNaturalHole) {
            return GameOrder.getNaturalHole(position);
        }
        // Fallback
        var playOrder = getPlayOrder();
        return playOrder[position] || 0;
    }
    
    function getRemainingHolesFromPlayOrder(currentHoleNumber) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayPosition) {
            var playPos = GameOrder.getPlayPosition(currentHoleNumber);
            return GameOrder.getRemainingHoles(playPos);
        }
        // Fallback
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(currentHoleNumber);
        if (currentIndex === -1) return 18 - currentHoleNumber;
        return 18 - (currentIndex + 1);
    }
    
    function getLastHole() {
        if (typeof GameOrder !== 'undefined' && GameOrder.getLastHole) {
            return GameOrder.getLastHole();
        }
        var startingHole = getStartingHoleFromCache();
        return (startingHole === 1) ? 18 : startingHole - 1;
    }
    
    // ============================================================
    // Cache Helpers
    // ============================================================
    
    function getStartingHoleFromCache() {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (cache && cache.startingHole) {
            return cache.startingHole;
        }
        // Check window variable set by real-game.html
        if (typeof window._startingHole !== 'undefined') {
            return window._startingHole;
        }
        return 1;
    }
    
    function getHighestBothSaved(cache) {
        var holes1 = cache.savedHoles ? cache.savedHoles[1] || [] : [];
        var holes2 = cache.savedHoles ? cache.savedHoles[2] || [] : [];
        var max = 0;
        for (var h = 18; h >= 1; h--) {
            if (holes1.indexOf(h) !== -1 && holes2.indexOf(h) !== -1) {
                max = h;
                break;
            }
        }
        return max;
    }
    
    // ============================================================
    // GameOrder Initialization
    // ============================================================
    
    function updateGameOrder(startingHole) {
        if (typeof GameOrder !== 'undefined' && GameOrder.setStartingHole) {
            GameOrder.setStartingHole(startingHole);
        }
        // Store in window for fallback
        window._startingHole = startingHole;
    }
    
    // ============================================================
    // Initialize Empty Results Structure
    // ============================================================
    
    function initializeEmptyResults() {
        return {
            version: 1,
            matchResults: new Array(18),
            f1IntraMatches: new Array(18),
            f2IntraMatches: new Array(18),
            game1: { matches: {}, pointsA: new Array(18).fill(8), pointsB: new Array(18).fill(8) },
            game2: {
                flight1: { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null },
                flight2: { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null },
                pointsA: new Array(18).fill(1),
                pointsB: new Array(18).fill(1),
                displayT1: new Array(18).fill("AS"),
                displayT2: new Array(18).fill("AS")
            },
            game3: { 
                leader: new Array(18).fill("AS"), 
                nettA: new Array(18).fill(0), 
                nettB: new Array(18).fill(0), 
                pointsA: new Array(18).fill(0.5), 
                pointsB: new Array(18).fill(0.5),
                displayStrk: new Array(18).fill("AS") 
            },
            tr: { 
                teamA: new Array(18).fill(null), 
                teamB: new Array(18).fill(null), 
                teamAGreen: new Array(18).fill(false), 
                teamBGreen: new Array(18).fill(false) 
            },
            lastComputedAt: null,
            clinchedAt: {},
            playerTotals: {}
        };
    }
    
    // ============================================================
    // Calculate Player Totals
    // ============================================================
    
    function calculatePlayerTotals(allPlayers, coursePar, upToHole) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) {
            console.warn("[REAL-GAME-UTILS] No cache available for player totals");
            return {};
        }
        
        var playerTotals = {};
        
        for (var p = 0; p < allPlayers.length; p++) {
            var player = allPlayers[p];
            var flightDataStr = player.flight === 1 ? cache.f1DataString : cache.f2DataString;
            var totalGross = 0;
            var totalPar = 0;
            
            for (var h = 1; h <= upToHole; h++) {
                var par = coursePar[h - 1];
                totalPar += par;
                
                var holeData = typeof GameData !== 'undefined' ? GameData.parseHoleData(flightDataStr, h) : null;
                if (holeData && holeData.saved) {
                    var score = 0;
                    var flightPlayers = allPlayers.filter(function(p) { return p.flight === player.flight; });
                    var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
                    var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
                    
                    if (player.team === 'A') {
                        if (teamA[0] && teamA[0].name === player.name) score = holeData.scores.a1;
                        else if (teamA[1] && teamA[1].name === player.name) score = holeData.scores.a2;
                    } else {
                        if (teamB[0] && teamB[0].name === player.name) score = holeData.scores.b1;
                        else if (teamB[1] && teamB[1].name === player.name) score = holeData.scores.b2;
                    }
                    totalGross += score;
                } else {
                    totalGross += par;
                }
            }
            
            playerTotals[player.name] = {
                name: player.name,
                label: player.label,
                totalGross: totalGross,
                totalPar: totalPar,
                holesPlayed: upToHole,
                relativeToPar: totalGross - totalPar
            };
        }
        
        return playerTotals;
    }
    
    // ============================================================
    // Ensure Results Structure is Complete
    // ============================================================
    
    function ensureResultsStructure(cache) {
        if (!cache.results) {
            cache.results = initializeEmptyResults();
            console.log("[REAL-GAME-UTILS] cache.results was null - initialized empty results");
        }
        
        // Ensure game1
        if (!cache.results.game1) {
            cache.results.game1 = { matches: {}, pointsA: new Array(18).fill(8), pointsB: new Array(18).fill(8) };
        }
        if (!cache.results.game1.pointsA) {
            cache.results.game1.pointsA = new Array(18).fill(8);
        }
        if (!cache.results.game1.pointsB) {
            cache.results.game1.pointsB = new Array(18).fill(8);
        }
        
        // Ensure game2
        if (!cache.results.game2) {
            cache.results.game2 = { 
                flight1: { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null },
                flight2: { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null },
                pointsA: new Array(18).fill(1),
                pointsB: new Array(18).fill(1),
                displayT1: new Array(18).fill("AS"),
                displayT2: new Array(18).fill("AS")
            };
        }
        if (!cache.results.game2.flight1) {
            cache.results.game2.flight1 = { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null };
        }
        if (!cache.results.game2.flight1.leader) {
            cache.results.game2.flight1.leader = new Array(18).fill("AS");
        }
        if (!cache.results.game2.flight1.cumulativePoints) {
            cache.results.game2.flight1.cumulativePoints = new Array(18).fill(0);
        }
        if (!cache.results.game2.flight2) {
            cache.results.game2.flight2 = { leader: new Array(18).fill("AS"), cumulativePoints: new Array(18).fill(0), clinchedHole: null };
        }
        if (!cache.results.game2.flight2.leader) {
            cache.results.game2.flight2.leader = new Array(18).fill("AS");
        }
        if (!cache.results.game2.flight2.cumulativePoints) {
            cache.results.game2.flight2.cumulativePoints = new Array(18).fill(0);
        }
        if (!cache.results.game2.pointsA) {
            cache.results.game2.pointsA = new Array(18).fill(1);
        }
        if (!cache.results.game2.pointsB) {
            cache.results.game2.pointsB = new Array(18).fill(1);
        }
        if (!cache.results.game2.displayT1) {
            cache.results.game2.displayT1 = new Array(18).fill("AS");
        }
        if (!cache.results.game2.displayT2) {
            cache.results.game2.displayT2 = new Array(18).fill("AS");
        }
        
        // Ensure game3
        if (!cache.results.game3) {
            cache.results.game3 = { 
                leader: new Array(18).fill("AS"), 
                nettA: new Array(18).fill(0), 
                nettB: new Array(18).fill(0), 
                pointsA: new Array(18).fill(0.5), 
                pointsB: new Array(18).fill(0.5),
                displayStrk: new Array(18).fill("AS")
            };
        }
        if (!cache.results.game3.leader) {
            cache.results.game3.leader = new Array(18).fill("AS");
        }
        if (!cache.results.game3.nettA) {
            cache.results.game3.nettA = new Array(18).fill(0);
        }
        if (!cache.results.game3.nettB) {
            cache.results.game3.nettB = new Array(18).fill(0);
        }
        if (!cache.results.game3.pointsA) {
            cache.results.game3.pointsA = new Array(18).fill(0.5);
        }
        if (!cache.results.game3.pointsB) {
            cache.results.game3.pointsB = new Array(18).fill(0.5);
        }
        if (!cache.results.game3.displayStrk) {
            cache.results.game3.displayStrk = new Array(18).fill("AS");
        }
        
        // Ensure tr
        if (!cache.results.tr) {
            cache.results.tr = { 
                teamA: new Array(18).fill(null), 
                teamB: new Array(18).fill(null), 
                teamAGreen: new Array(18).fill(false), 
                teamBGreen: new Array(18).fill(false) 
            };
        }
        if (!cache.results.tr.teamA) {
            cache.results.tr.teamA = new Array(18).fill(null);
        }
        if (!cache.results.tr.teamB) {
            cache.results.tr.teamB = new Array(18).fill(null);
        }
        if (!cache.results.tr.teamAGreen) {
            cache.results.tr.teamAGreen = new Array(18).fill(false);
        }
        if (!cache.results.tr.teamBGreen) {
            cache.results.tr.teamBGreen = new Array(18).fill(false);
        }
        
        // Ensure clinchedAt
        if (!cache.results.clinchedAt) {
            cache.results.clinchedAt = {};
        }
        
        // Ensure arrays
        if (!cache.results.f1IntraMatches) {
            cache.results.f1IntraMatches = new Array(18);
        }
        if (!cache.results.f2IntraMatches) {
            cache.results.f2IntraMatches = new Array(18);
        }
        if (!cache.results.matchResults) {
            cache.results.matchResults = new Array(18);
        }
        if (!cache.results.playerTotals) {
            cache.results.playerTotals = {};
        }
        
        return cache.results;
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        getPlayOrder: getPlayOrder,
        getHolePosition: getHolePosition,
        getHoleAtPosition: getHoleAtPosition,
        getRemainingHolesFromPlayOrder: getRemainingHolesFromPlayOrder,
        getLastHole: getLastHole,
        getHighestBothSaved: getHighestBothSaved,
        updateGameOrder: updateGameOrder,
        initializeEmptyResults: initializeEmptyResults,
        calculatePlayerTotals: calculatePlayerTotals,
        ensureResultsStructure: ensureResultsStructure,
        getStartingHoleFromCache: getStartingHoleFromCache
    };
    
})();

// Make available globally
window.RealGameUtils = RealGameUtils;

// Also expose individual functions for backward compatibility
window.getPlayOrder = RealGameUtils.getPlayOrder;
window.getHolePosition = RealGameUtils.getHolePosition;
window.getHoleAtPosition = RealGameUtils.getHoleAtPosition;
window.getRemainingHolesFromPlayOrder = RealGameUtils.getRemainingHolesFromPlayOrder;
window.getLastHole = RealGameUtils.getLastHole;
window.getHighestBothSaved = RealGameUtils.getHighestBothSaved;
window.updateGameOrder = RealGameUtils.updateGameOrder;
window.initializeEmptyResults = RealGameUtils.initializeEmptyResults;
window.calculatePlayerTotals = RealGameUtils.calculatePlayerTotals;
window.ensureResultsStructure = RealGameUtils.ensureResultsStructure;

/*
FILE: js/real-game-utils.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Extracted utility functions from real-game.html
   - Contains: getPlayOrder(), getHolePosition(), getHoleAtPosition()
   - Contains: getRemainingHolesFromPlayOrder(), getLastHole()
   - Contains: getHighestBothSaved(), updateGameOrder()
   - Contains: initializeEmptyResults(), calculatePlayerTotals()
   - All functions are pure delegates to GameOrder where possible
DEPENDS ON: js/game-order.js, js/game-data.js, GameLoader (for cache)
STATUS: Ready for integration
*/