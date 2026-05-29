/*
FILE: js/game-loader.js
VERSION: 1.05
KEY CHANGES:
   - FIXED: getGameIdFromSession() now reads from 'currentGameId' (not 'cachedGameId')
   - FIXED: getGameDataFromSession() now reads from 'preloadedRawGameData.rawData' (not 'gameData')
   - ADDED: Proper parsing of preloadedRawGameData structure
   - ADDED: Fallback to Firestore if session data is invalid
   - ADDED: Console logging for debugging session loading
   - All other functions unchanged from v1.04
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

// Global loader state
let activeGameData = null;
let activeGameId = null;
let activeListenerUnsubscribe = null;

/**
 * Get game ID from session storage
 * Reads from the actual key used by index.html: 'currentGameId'
 * @returns {string|null} Game ID or null if not found
 */
function getGameIdFromSession() {
    try {
        const gameId = sessionStorage.getItem('currentGameId');
        if (gameId) {
            console.log('[game-loader] getGameIdFromSession: found', gameId);
            return gameId;
        }
        console.log('[game-loader] getGameIdFromSession: no gameId found');
        return null;
    } catch (e) {
        console.error('[game-loader] Error reading gameId from session:', e);
        return null;
    }
}

/**
 * Get full game data from session storage
 * Reads from the actual structure used by index.html: preloadedRawGameData.rawData
 * @returns {Object|null} Game data object or null if not found/invalid
 */
function getGameDataFromSession() {
    try {
        const preloadedRaw = sessionStorage.getItem('preloadedRawGameData');
        if (!preloadedRaw) {
            console.log('[game-loader] getGameDataFromSession: no preloadedRawGameData found');
            return null;
        }
        
        const parsed = JSON.parse(preloadedRaw);
        if (!parsed.rawData) {
            console.log('[game-loader] getGameDataFromSession: rawData field missing');
            return null;
        }
        
        const gameData = JSON.parse(parsed.rawData);
        if (gameData && gameData.id) {
            console.log('[game-loader] getGameDataFromSession: found game', gameData.id);
            return gameData;
        }
        
        console.log('[game-loader] getGameDataFromSession: invalid game data');
        return null;
    } catch (e) {
        console.error('[game-loader] Error reading gameData from session:', e);
        return null;
    }
}

/**
 * Load game data from session or Firestore
 * @param {string} gameId - Game ID to load (optional, will try session if not provided)
 * @param {string} mode - 'view' or 'score' mode
 * @returns {Promise<Object|null>} Game data object or null if failed
 */
async function loadGameData(gameId = null, mode = 'view') {
    console.log('[game-loader] loadGameData called with gameId:', gameId, 'mode:', mode);
    
    // If no gameId provided, try to get from session
    if (!gameId) {
        gameId = getGameIdFromSession();
        if (!gameId) {
            console.error('[game-loader] No gameId provided and none in session');
            return null;
        }
    }
    
    activeGameId = gameId;
    
    // Try to get from session first
    let gameData = getGameDataFromSession();
    
    // If session has data and IDs match, use it
    if (gameData && gameData.id === gameId) {
        console.log('[game-loader] Using game data from session');
        activeGameData = gameData;
        return gameData;
    }
    
    // Otherwise load from Firestore
    console.log('[game-loader] Loading game data from Firestore');
    
    try {
        const db = firebase.firestore();
        const doc = await db.collection('games').doc(gameId).get();
        
        if (!doc.exists) {
            console.error('[game-loader] Game not found in Firestore:', gameId);
            return null;
        }
        
        gameData = doc.data();
        gameData.id = doc.id;
        
        // Load scores subcollection
        const scoresSnapshot = await db.collection('games').doc(gameId).collection('scores').get();
        const scores = {};
        scoresSnapshot.forEach(doc => {
            scores[doc.id] = doc.data();
        });
        gameData.scores = scores;
        
        // Load players
        if (gameData.players && Array.isArray(gameData.players)) {
            // Players already in game data
            console.log('[game-loader] Players loaded from game data:', gameData.players.length);
        }
        
        activeGameData = gameData;
        console.log('[game-loader] Successfully loaded from Firestore');
        return gameData;
        
    } catch (error) {
        console.error('[game-loader] Error loading from Firestore:', error);
        return null;
    }
}

/**
 * Set up real-time listener for game data updates
 * @param {string} gameId - Game ID to listen to
 * @param {Function} callback - Callback function called on each update
 * @returns {Function} Unsubscribe function
 */
function setupGameDataListener(gameId, callback) {
    if (!gameId) {
        console.error('[game-loader] No gameId provided for listener');
        return null;
    }
    
    // Clean up existing listener
    if (activeListenerUnsubscribe) {
        activeListenerUnsubscribe();
        activeListenerUnsubscribe = null;
    }
    
    try {
        const db = firebase.firestore();
        
        // Listen to main game document
        const unsubscribe = db.collection('games').doc(gameId)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const gameData = doc.data();
                    gameData.id = doc.id;
                    
                    // Get latest scores
                    const scoresSnapshot = await db.collection('games').doc(gameId).collection('scores').get();
                    const scores = {};
                    scoresSnapshot.forEach(doc => {
                        scores[doc.id] = doc.data();
                    });
                    gameData.scores = scores;
                    
                    activeGameData = gameData;
                    
                    if (callback) {
                        callback(gameData);
                    }
                }
            }, (error) => {
                console.error('[game-loader] Firestore listener error:', error);
            });
        
        activeListenerUnsubscribe = unsubscribe;
        console.log('[game-loader] Listener set up for game:', gameId);
        return unsubscribe;
        
    } catch (error) {
        console.error('[game-loader] Error setting up listener:', error);
        return null;
    }
}

/**
 * Get the currently loaded game data
 * @returns {Object|null} Current game data
 */
function getCurrentGameData() {
    return activeGameData;
}

/**
 * Get the currently loaded game ID
 * @returns {string|null} Current game ID
 */
function getCurrentGameId() {
    return activeGameId;
}

/**
 * Clear session storage game data
 */
function clearSessionGameData() {
    try {
        sessionStorage.removeItem('currentGameId');
        sessionStorage.removeItem('preloadedRawGameData');
        sessionStorage.removeItem('gameDataPreloaded');
        console.log('[game-loader] Session game data cleared');
    } catch (e) {
        console.error('[game-loader] Error clearing session data:', e);
    }
}

/**
 * Validate that session data is current and valid
 * @returns {boolean} True if valid session data exists
 */
function isSessionDataValid() {
    const gameId = getGameIdFromSession();
    const gameData = getGameDataFromSession();
    
    if (!gameId || !gameData) {
        return false;
    }
    
    if (gameData.id !== gameId) {
        console.warn('[game-loader] Session data mismatch: id=', gameData.id, 'gameId=', gameId);
        return false;
    }
    
    return true;
}

// Export functions for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getGameIdFromSession,
        getGameDataFromSession,
        loadGameData,
        setupGameDataListener,
        getCurrentGameData,
        getCurrentGameId,
        clearSessionGameData,
        isSessionDataValid
    };
}

/*
FOOTER: js/game-loader.js
VERSION: 1.05
LAST UPDATED: 2026-05-29
COMPATIBLE WITH: index.html v3.18+, pre-game.html v3.12+, real-game.html v4.07+, view-game.html v4.13+
NEXT STEPS: 
   - Test session loading from index.html
   - Verify pre-game.html reads correctly
   - Verify view-game.html loads without URL params
   - Test real-time updates via Firestore listener
*/