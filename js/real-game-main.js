/*
FILE: js/real-game-main.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - FIXED: startGame() now parses gameId from URL and passes it to initGame()
   - FIXED: Added null check for gameId before calling initGame()
   - FIXED: Better error handling when gameId is missing
   - All other functionality preserved from v1.01
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, RealGameNav, RealGameInit, RealGameCascade
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_MAIN_VERSION = "1.02";

console.log("[REAL-GAME-MAIN] Initializing v1.02 - Fixed gameId passing to initGame");

// ============================================================
// Main render wrapper
// ============================================================

function renderAll() {
    if (typeof RealGameUI !== 'undefined' && RealGameUI.renderAll) {
        RealGameUI.renderAll();
    } else {
        console.warn("[REAL-GAME-MAIN] RealGameUI.renderAll not available");
    }
}

// ============================================================
// Main save wrapper
// ============================================================

function saveHole() {
    if (typeof RealGameSave !== 'undefined' && RealGameSave.saveHole) {
        // Get scores from the current UI state
        var editableFlight = RealGameState.getEditableFlight();
        var currentHole = RealGameState.getCurrentHole();
        var allPlayers = RealGameState.getAllPlayers();
        
        // Build scores object for save callback
        function getScoresForSave(flight, hole) {
            var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
            var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            
            var a1Score = RealGameUI.getStoredScore ? RealGameUI.getStoredScore(teamA[0], hole) : 4;
            var a2Score = RealGameUI.getStoredScore ? RealGameUI.getStoredScore(teamA[1], hole) : 4;
            var b1Score = RealGameUI.getStoredScore ? RealGameUI.getStoredScore(teamB[0], hole) : 4;
            var b2Score = RealGameUI.getStoredScore ? RealGameUI.getStoredScore(teamB[1], hole) : 4;
            
            var localChanges = RealGameState.getLocalChanges();
            for (var key in localChanges) {
                if (key.startsWith(flight + "_" + hole + "_")) {
                    var playerName = key.split('_')[2];
                    if (teamA[0] && teamA[0].name === playerName) a1Score = localChanges[key];
                    if (teamA[1] && teamA[1].name === playerName) a2Score = localChanges[key];
                    if (teamB[0] && teamB[0].name === playerName) b1Score = localChanges[key];
                    if (teamB[1] && teamB[1].name === playerName) b2Score = localChanges[key];
                }
            }
            
            return { a1: a1Score, a2: a2Score, b1: b1Score, b2: b2Score };
        }
        
        RealGameSave.saveHole(getScoresForSave, renderAll);
    } else {
        console.warn("[REAL-GAME-MAIN] RealGameSave.saveHole not available");
    }
}

// ============================================================
// Navigation wrappers
// ============================================================

function nextHole() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.nextHole) {
        RealGameNav.nextHole();
    } else {
        console.warn("[REAL-GAME-MAIN] RealGameNav.nextHole not available");
    }
}

function prevHole() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.prevHole) {
        RealGameNav.prevHole();
    } else {
        console.warn("[REAL-GAME-MAIN] RealGameNav.prevHole not available");
    }
}

function showSignCardModal() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.showSignCardModal) {
        RealGameNav.showSignCardModal();
    } else {
        console.warn("[REAL-GAME-MAIN] RealGameNav.showSignCardModal not available");
    }
}

function showCelebrationAndHandicap() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.showCelebrationAndHandicap) {
        RealGameNav.showCelebrationAndHandicap();
    } else {
        console.warn("[REAL-GAME-MAIN] RealGameNav.showCelebrationAndHandicap not available");
    }
}

function exitToMainMenu() {
    if (typeof RealGameInit !== 'undefined' && RealGameInit.exitToMainMenu) {
        RealGameInit.exitToMainMenu();
    } else {
        console.warn("[REAL-GAME-MAIN] RealGameInit.exitToMainMenu not available");
        window.location.href = "index.html";
    }
}

// ============================================================
// Set up global callbacks for the UI
// ============================================================

// These are used by RealGameUI.renderCompactHeaderWithFlightToggle()
window._saveHoleCallback = saveHole;
window._prevHoleCallback = prevHole;
window._nextHoleCallback = nextHole;
window._showCelebrationCallback = showCelebrationAndHandicap;
window._showSignCardCallback = showSignCardModal;

// ============================================================
// Set up RealGameSave callbacks
// ============================================================

// The save module needs these callbacks
if (typeof RealGameSave !== 'undefined') {
    // Ensure the save module can access the render function
    RealGameSave._renderCallback = renderAll;
}

// ============================================================
// Set up RealGameInit callbacks
// ============================================================

// The init module needs these callbacks
if (typeof RealGameInit !== 'undefined') {
    RealGameInit._renderCallback = renderAll;
}

// ============================================================
// Set up RealGameUI callbacks
// ============================================================

if (typeof RealGameUI !== 'undefined') {
    RealGameUI._exitCallback = exitToMainMenu;
}

// ============================================================
// Main application entry point
// ============================================================

function startGame() {
    console.log("[REAL-GAME-MAIN] Starting game...");
    
    // Get gameId from URL query parameter
    var urlParams = new URLSearchParams(window.location.search);
    var gameId = urlParams.get('gameId');
    
    if (!gameId) {
        console.error("[REAL-GAME-MAIN] No gameId found in URL");
        document.getElementById("debug").innerHTML = "Error: No game ID found. Please return to the main menu.";
        return;
    }
    
    console.log("[REAL-GAME-MAIN] Game ID from URL:", gameId);
    
    // Initialize the game with the gameId
    if (typeof RealGameInit !== 'undefined' && typeof RealGameInit.initGame === 'function') {
        RealGameInit.initGame(gameId, renderAll);
    } else {
        console.error("[REAL-GAME-MAIN] RealGameInit.initGame not available");
        document.getElementById("debug").innerHTML = "Error: Initialization failed. Please refresh.";
    }
}

// ============================================================
// Expose functions globally
// ============================================================

window.renderAll = renderAll;
window.saveHole = saveHole;
window.nextHole = nextHole;
window.prevHole = prevHole;
window.showSignCardModal = showSignCardModal;
window.showCelebrationAndHandicap = showCelebrationAndHandicap;
window.exitToMainMenu = exitToMainMenu;
window.startGame = startGame;

// ============================================================
// Auto-start when DOM is ready
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    // DOM already loaded, start immediately
    startGame();
}

// ============================================================
// Handle page unload - cleanup
// ============================================================

window.addEventListener('beforeunload', function() {
    var firestoreUnsubscribe = RealGameState.getFirestoreUnsubscribe();
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        RealGameState.setFirestoreUnsubscribe(null);
    }
});

/*
FILE: js/real-game-main.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - FIXED: startGame() now parses gameId from URL and passes it to initGame()
   - FIXED: Added null check for gameId before calling initGame()
   - FIXED: Better error handling when gameId is missing
   - All other functionality preserved from v1.01
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, RealGameNav, RealGameInit, RealGameCascade
STATUS: Ready for integration
*/