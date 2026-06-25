/*
FILE: js/real-game-init.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - REMOVED: Celebration photo check at game start (H1) - moved to save points
   - REMOVED: RealGameUI.init(gameData) call - function doesn't exist
   - REMOVED: RealGameState.init(gameData) call - function doesn't exist
   - ADDED: RealGameState.setGameId(gameId) to store game ID in state
   - ADDED: RealGameState.setAllPlayers(data.players) to store players in state
   - ADDED: RealGameState.setCourseName/Par/Si/StartingHole/TeamGameFormat
   - ADDED: data-ready class to container to make UI visible
   - All other functionality preserved from v1.02
DEPENDS ON: GameData, GameUI, real-game-state, Firebase Firestore
STATUS: Ready for integration
*/

// FILE: js/real-game-init.js - VERSION 1.04

var RealGameInit = (function() {
    
    var gameId = null;
    var gameData = null;
    var initialized = false;
    
    /**
     * Initialize the game with the given game ID
     * @param {string} id - The game ID
     * @param {function} callback - Callback when initialization is complete
     */
    function initGame(id, callback) {
        if (initialized) {
            console.warn('[RealGameInit] Already initialized');
            if (callback) callback(null);
            return;
        }
        
        gameId = id;
        
        console.log('[RealGameInit] Initializing game:', gameId);
        
        // Load game data
        loadGameData(function(err, data) {
            if (err) {
                console.error('[RealGameInit] Failed to load game data:', err);
                if (callback) callback(err);
                return;
            }
            
            gameData = data;
            
            // ============================================================
            // STORE DATA IN RealGameState
            // ============================================================
            if (typeof RealGameState !== 'undefined') {
                // Game ID
                RealGameState.setGameId(gameId);
                
                // Players
                if (data.players) {
                    RealGameState.setAllPlayers(data.players);
                }
                
                // Course data
                if (data.course) {
                    if (data.course.name) RealGameState.setCourseName(data.course.name);
                    if (data.course.par) RealGameState.setCoursePar(data.course.par);
                    if (data.course.si) RealGameState.setCourseSi(data.course.si);
                }
                
                // Starting hole
                if (data.startingHole) RealGameState.setStartingHole(data.startingHole);
                
                // Team game format
                if (data.teamGameFormat) RealGameState.setTeamGameFormat(data.teamGameFormat);
                
                console.log('[RealGameInit] State updated - gameId:', gameId, 'players:', data.players?.length || 0);
            } else {
                console.warn('[RealGameInit] RealGameState not available');
            }
            
            // ============================================================
            // MAKE UI VISIBLE
            // ============================================================
            var container = document.getElementById('mainContainer');
            if (container) {
                container.classList.add('data-ready');
                console.log('[RealGameInit] data-ready class added to container');
            } else {
                console.warn('[RealGameInit] mainContainer not found');
            }
            
            initialized = true;
            
            console.log('[RealGameInit] Game initialized successfully');
            if (callback) callback(null);
        });
    }
    
    /**
     * Load game data from Firestore
     */
    function loadGameData(callback) {
        if (!gameId) {
            if (callback) callback(new Error('No game ID provided'));
            return;
        }
        
        var db = firebase.firestore();
        
        db.collection('scheduledGames').doc(gameId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    throw new Error('Game document not found: ' + gameId);
                }
                
                var data = doc.data();
                console.log('[RealGameInit] Game data loaded');
                
                // Store in GameData if available
                if (typeof GameData !== 'undefined') {
                    if (data.f1) {
                        var f1Data = GameData.getFlightData(1);
                        f1Data.data = data.f1.d || f1Data.data;
                        f1Data.saveEvent = data.f1.se || false;
                        f1Data.crossEvent = data.f1.x || false;
                    }
                    if (data.f2) {
                        var f2Data = GameData.getFlightData(2);
                        f2Data.data = data.f2.d || f2Data.data;
                        f2Data.saveEvent = data.f2.se || false;
                        f2Data.crossEvent = data.f2.x || false;
                    }
                }
                
                if (callback) callback(null, data);
            })
            .catch(function(err) {
                console.error('[RealGameInit] Failed to load game data:', err);
                if (callback) callback(err);
            });
    }
    
    /**
     * Get the initialized game data
     */
    function getGameData() {
        return gameData;
    }
    
    /**
     * Get the game ID
     */
    function getGameId() {
        return gameId;
    }
    
    /**
     * Check if the game is initialized
     */
    function isInitialized() {
        return initialized;
    }
    
    // Public API
    return {
        initGame: initGame,
        getGameData: getGameData,
        getGameId: getGameId,
        isInitialized: isInitialized
    };
    
})();

// Make available globally
window.RealGameInit = RealGameInit;

/*
FILE: js/real-game-init.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - REMOVED: Celebration photo check at game start (H1) - moved to save points
   - REMOVED: RealGameUI.init(gameData) call - function doesn't exist
   - REMOVED: RealGameState.init(gameData) call - function doesn't exist
   - ADDED: RealGameState.setGameId(gameId) to store game ID in state
   - ADDED: RealGameState.setAllPlayers(data.players) to store players in state
   - ADDED: RealGameState.setCourseName/Par/Si/StartingHole/TeamGameFormat
   - ADDED: data-ready class to container to make UI visible
   - All other functionality preserved from v1.02
DEPENDS ON: GameData, GameUI, real-game-state, Firebase Firestore
STATUS: Ready for integration
*/