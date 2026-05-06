// js/session.js
// Device Session Manager v1.0
// Tracks device identity and navigation path across the app

var SessionManager = (function() {
    
    var SESSION_COLLECTION = "deviceSessions";
    var SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
    
    var db = null;
    var currentSession = null;
    var deviceId = null;
    
    function getDeviceId() {
        var storedId = localStorage.getItem("deviceId");
        if (storedId) {
            return storedId;
        }
        var newId = "dev_" + Date.now() + "_" + Math.random().toString(36).substr(2, 8);
        localStorage.setItem("deviceId", newId);
        return newId;
    }
    
    function getFirestore() {
        // Return existing db if already initialized
        if (db) return db;
        
        // Check if Firebase is already initialized
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            db = firebase.firestore();
            return db;
        }
        
        // Firebase not initialized yet - this should not happen if pages include Firebase first
        console.warn("Firebase not initialized. Session manager requires Firebase.");
        return null;
    }
    
    function generateSessionId() {
        return "sess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 12);
    }
    
    function createSession(deviceId, currentPage, returnDestination) {
        var sessionId = generateSessionId();
        var sessionData = {
            sessionId: sessionId,
            deviceId: deviceId,
            createdAt: Date.now(),
            lastActive: Date.now(),
            currentPath: currentPage,
            returnDestination: returnDestination || "index.html",
            navigationHistory: [
                { page: currentPage, timestamp: Date.now(), action: "session_created" }
            ],
            activeGame: {
                gameId: null,
                gameType: null,
                gameMode: null,
                role: null,
                collection: null
            }
        };
        
        var firestore = getFirestore();
        if (firestore) {
            firestore.collection(SESSION_COLLECTION).doc(sessionId).set(sessionData).catch(function(e) {
                console.warn("Failed to create session:", e);
            });
        }
        
        localStorage.setItem("sessionId", sessionId);
        currentSession = sessionData;
        return sessionData;
    }
    
    function updateSession(updates) {
        var sessionId = localStorage.getItem("sessionId");
        if (!sessionId) {
            console.warn("No sessionId found");
            return null;
        }
        
        updates.lastActive = Date.now();
        
        var firestore = getFirestore();
        if (firestore) {
            firestore.collection(SESSION_COLLECTION).doc(sessionId).update(updates).catch(function(e) {
                console.warn("Failed to update session:", e);
            });
        }
        
        if (currentSession) {
            for (var key in updates) {
                if (updates.hasOwnProperty(key)) {
                    currentSession[key] = updates[key];
                }
            }
        }
        
        return currentSession;
    }
    
    function addNavigationHistory(page, action, extraData) {
        var historyEntry = {
            page: page,
            timestamp: Date.now(),
            action: action
        };
        if (extraData) {
            for (var key in extraData) {
                historyEntry[key] = extraData[key];
            }
        }
        
        var sessionId = localStorage.getItem("sessionId");
        if (!sessionId) return;
        
        var firestore = getFirestore();
        if (firestore) {
            firestore.collection(SESSION_COLLECTION).doc(sessionId).update({
                navigationHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry),
                lastActive: Date.now()
            }).catch(function(e) {
                console.warn("Failed to update history:", e);
            });
        }
        
        if (currentSession) {
            if (!currentSession.navigationHistory) currentSession.navigationHistory = [];
            currentSession.navigationHistory.push(historyEntry);
            currentSession.lastActive = Date.now();
        }
    }
    
    function getSession() {
        var sessionId = localStorage.getItem("sessionId");
        if (!sessionId) {
            return null;
        }
        
        if (currentSession) {
            var now = Date.now();
            if (now - currentSession.lastActive > SESSION_TIMEOUT_MS) {
                localStorage.removeItem("sessionId");
                return null;
            }
            return currentSession;
        }
        
        return null;
    }
    
    function getSessionAsync(callback) {
        var sessionId = localStorage.getItem("sessionId");
        if (!sessionId) {
            callback(null);
            return;
        }
        
        var firestore = getFirestore();
        if (!firestore) {
            callback(null);
            return;
        }
        
        firestore.collection(SESSION_COLLECTION).doc(sessionId).get().then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                var now = Date.now();
                if (now - data.lastActive > SESSION_TIMEOUT_MS) {
                    localStorage.removeItem("sessionId");
                    callback(null);
                } else {
                    currentSession = data;
                    callback(data);
                }
            } else {
                localStorage.removeItem("sessionId");
                callback(null);
            }
        }).catch(function(e) {
            console.warn("Failed to get session:", e);
            callback(null);
        });
    }
    
    function initSession(currentPage, returnDestination, callback) {
        deviceId = getDeviceId();
        
        getSessionAsync(function(session) {
            if (session) {
                updateSession({
                    lastActive: Date.now(),
                    currentPath: currentPage
                });
                addNavigationHistory(currentPage, "page_load");
                if (callback) callback(session);
            } else {
                var newSession = createSession(deviceId, currentPage, returnDestination);
                if (callback) callback(newSession);
            }
        });
    }
    
    function setActiveGame(gameId, gameType, gameMode, collection, role) {
        return updateSession({
            activeGame: {
                gameId: gameId,
                gameType: gameType,
                gameMode: gameMode,
                role: role,
                collection: collection
            }
        });
    }
    
    function getReturnDestination() {
        if (currentSession && currentSession.returnDestination) {
            return currentSession.returnDestination;
        }
        return "index.html";
    }
    
    function getActiveGame() {
        if (currentSession && currentSession.activeGame) {
            return currentSession.activeGame;
        }
        return null;
    }
    
    function getDeviceIdDisplay() {
        var id = getDeviceId();
        if (id.length > 12) {
            return "🖥️ " + id.substring(id.length - 10);
        }
        return "🖥️ " + id;
    }
    
    return {
        initSession: initSession,
        getSession: getSession,
        getSessionAsync: getSessionAsync,
        updateSession: updateSession,
        addNavigationHistory: addNavigationHistory,
        setActiveGame: setActiveGame,
        getReturnDestination: getReturnDestination,
        getActiveGame: getActiveGame,
        getDeviceId: getDeviceId,
        getDeviceIdDisplay: getDeviceIdDisplay,
        SESSION_TIMEOUT_MS: SESSION_TIMEOUT_MS
    };
})();