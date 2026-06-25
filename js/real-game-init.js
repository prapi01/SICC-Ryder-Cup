/*
FILE: js/real-game-init.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - FIXED: Added RealGameState.setGameId(gameId) to store game ID in state
   - FIXED: Added RealGameState.setAllPlayers(data.players) to store players in state
   - FIXED: Added data-ready class to container to make UI visible
   - FIXED: Removed celebration photo check at game start (H1) - moved to save points
   - All other functionality preserved from v1.02
DEPENDS ON: GameData, GameUI, real-game-state, Firebase Firestore, js/celebration-photo.js
STATUS: Ready for integration
*/

// FILE: js/real-game-init.js - VERSION 1.03

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
            
            // --- STORE GAME ID AND PLAYERS IN STATE ---
            if (typeof RealGameState !== 'undefined') {
                RealGameState.setGameId(gameId);
                if (data.players) {
                    RealGameState.setAllPlayers(data.players);
                }
                if (data.course) {
                    if (data.course.name) RealGameState.setCourseName(data.course.name);
                    if (data.course.par) RealGameState.setCoursePar(data.course.par);
                    if (data.course.si) RealGameState.setCourseSi(data.course.si);
                }
                if (data.startingHole) RealGameState.setStartingHole(data.startingHole);
                if (data.teamGameFormat) RealGameState.setTeamGameFormat(data.teamGameFormat);
                console.log('[RealGameInit] State updated with gameId:', gameId, 'players:', data.players?.length);
            } else {
                console.warn('[RealGameInit] RealGameState not available');
            }
            
            // --- REMOVED: Celebration photo check at game start (H1)
            // Now handled in real-game-save.js at H1, H4, H9, H14, H17 saves
            
            // Initialize UI
            if (typeof RealGameUI !== 'undefined' && RealGameUI.init) {
                RealGameUI.init(gameData);
            }
            
            // Initialize game state
            if (typeof RealGameState !== 'undefined' && RealGameState.init) {
                RealGameState.init(gameData);
            }
            
            initialized = true;
            
            // --- ADD DATA-READY CLASS TO MAKE UI VISIBLE ---
            var container = document.getElementById('mainContainer');
            if (container) {
                container.classList.add('data-ready');
                console.log('[RealGameInit] data-ready class added to container');
            } else {
                console.warn('[RealGameInit] mainContainer not found');
            }
            
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
                    // Update GameData with loaded data
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
VERSION: 1.03
KEY CHANGES from v1.02:
   - FIXED: Added RealGameState.setGameId(gameId) to store game ID in state
   - FIXED: Added RealGameState.setAllPlayers(data.players) to store players in state
   - FIXED: Added RealGameState.setCourseName/Par/Si/StartingHole/TeamGameFormat
   - FIXED: Added data-ready class to container to make UI visible
   - REMOVED: Celebration photo check at game start (H1) - moved to save points
   - All other functionality preserved from v1.02
DEPENDS ON: GameData, GameUI, real-game-state, Firebase Firestore, js/celebration-photo.js
STATUS: Ready for integration
*/