/*
FILE: js/session.js
VERSION: 1.01
KEY CHANGES:
   - Added Firestore-based short device names (DEV-01, DEV-02, etc.)
   - New function getShortDeviceName() for async short name retrieval
   - New function getShortNameOnly() for sync short name
   - Updated getDeviceIdDisplay() to show short name
   - Stores mapping in deviceMapping collection
   - Caches short name in localStorage
STATUS: Ready for integration
*/

// js/session.js
// Device Session Manager v1.01
// ADDED: Firestore-based short device names (DEV-01, DEV-02, etc.)

var SessionManager = (function() {
    
    var SESSION_COLLECTION = "deviceSessions";
    var DEVICE_MAPPING_COLLECTION = "deviceMapping";
    var SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
    
    var db = null;
    var currentSession = null;
    var deviceId = null;
    var shortDeviceName = null;
    
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
        if (db) return db;
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            db = firebase.firestore();
            return db;
        }
        console.warn("Firebase not initialized. Session manager requires Firebase.");
        return null;
    }
    
    // Get or create short device name (DEV-01, DEV-02, etc.)
    async function getShortDeviceName() {
        // Check localStorage cache first
        var cached = localStorage.getItem("shortDeviceName");
        if (cached) {
            shortDeviceName = cached;
            return cached;
        }
        
        var firestore = getFirestore();
        if (!firestore) {
            // Fallback: use last 6 chars of device ID
            var fallback = getDeviceId().slice(-6);
            shortDeviceName = fallback;
            return fallback;
        }
        
        var deviceIdFull = getDeviceId();
        
        try {
            // Check if this device already has a mapping
            var mappingDoc = await firestore.collection(DEVICE_MAPPING_COLLECTION).doc(deviceIdFull).get();
            
            if (mappingDoc.exists) {
                var existingShortName = mappingDoc.data().shortName;
                // Update lastSeen
                await firestore.collection(DEVICE_MAPPING_COLLECTION).doc(deviceIdFull).update({
                    lastSeen: Date.now()
                });
                shortDeviceName = existingShortName;
                localStorage.setItem("shortDeviceName", existingShortName);
                console.log("Short device name (existing):", existingShortName);
                return existingShortName;
            }
            
            // Get counter document
            var counterRef = firestore.collection(DEVICE_MAPPING_COLLECTION).doc("counter");
            var counterDoc = await counterRef.get();
            
            var nextNumber = 1;
            if (counterDoc.exists) {
                nextNumber = (counterDoc.data().lastNumber % 99) + 1;
            }
            
            // Check if this number is already in use (by another active device)
            var existingWithNumber = await firestore.collection(DEVICE_MAPPING_COLLECTION)
                .where("shortName", "==", "DEV-" + nextNumber.toString().padStart(2, '0'))
                .get();
            
            // If taken, find next available number (simple linear search, max 99)
            while (!existingWithNumber.empty) {
                nextNumber = (nextNumber % 99) + 1;
                existingWithNumber = await firestore.collection(DEVICE_MAPPING_COLLECTION)
                    .where("shortName", "==", "DEV-" + nextNumber.toString().padStart(2, '0'))
                    .get();
            }
            
            var newShortName = "DEV-" + nextNumber.toString().padStart(2, '0');
            
            // Save mapping
            await firestore.collection(DEVICE_MAPPING_COLLECTION).doc(deviceIdFull).set({
                shortName: newShortName,
                deviceId: deviceIdFull,
                createdAt: Date.now(),
                lastSeen: Date.now()
            });
            
            // Update counter
            await counterRef.set({
                lastNumber: nextNumber
            });
            
            shortDeviceName = newShortName;
            localStorage.setItem("shortDeviceName", newShortName);
            console.log("Short device name (new):", newShortName);
            return newShortName;
            
        } catch (error) {
            console.error("Error getting short device name:", error);
            // Fallback
            var fallbackId = getDeviceId().slice(-6);
            shortDeviceName = fallbackId;
            return fallbackId;
        }
    }
    
    function getShortDeviceNameSync() {
        return shortDeviceName || localStorage.getItem("shortDeviceName") || getDeviceId().slice(-6);
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
        
        getSessionAsync(async function(session) {
            if (session) {
                updateSession({
                    lastActive: Date.now(),
                    currentPath: currentPage
                });
                addNavigationHistory(currentPage, "page_load");
                
                // Get short device name asynchronously
                if (callback) {
                    var shortName = await getShortDeviceName();
                    session.shortDeviceName = shortName;
                    callback(session);
                }
            } else {
                var newSession = createSession(deviceId, currentPage, returnDestination);
                var shortName = await getShortDeviceName();
                newSession.shortDeviceName = shortName;
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
        var short = getShortDeviceNameSync();
        return "🖥️ " + short;
    }
    
    function getShortNameOnly() {
        return getShortDeviceNameSync();
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
        getShortNameOnly: getShortNameOnly,
        SESSION_TIMEOUT_MS: SESSION_TIMEOUT_MS
    };
})();

/*
FILE: js/session.js
VERSION: 1.01
KEY CHANGES:
   - Added Firestore-based short device names (DEV-01, DEV-02, etc.)
   - New function getShortDeviceName() for async short name retrieval
   - New function getShortNameOnly() for sync short name
   - Updated getDeviceIdDisplay() to show short name
   - Stores mapping in deviceMapping collection
   - Caches short name in localStorage
STATUS: Ready for integration
*/