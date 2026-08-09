/*
FILE: js/session.js
VERSION: 1.02
KEY CHANGES:
   - FIXED (2026-08-09): deviceMapping DEV-## allocation hang. The old logic ran up to
     99 sequential Firestore "where shortName == DEV-XX" queries when names filled up
     (~2 min), hanging pre-game.html. Now: one bulk read of the small deviceMapping
     collection + in-memory free-name scan; stale mappings (lastSeen > 30 days) are
     pruned in the background and treated as free; when no name is free the
     least-recently-seen mapping is reaped (bounded, O(1) queries).
   - Added Firestore-based short device names (DEV-01, DEV-02, etc.)
   - New function getShortDeviceName() for async short name retrieval
   - New function getShortNameOnly() for sync short name
   - Updated getDeviceIdDisplay() to show short name
   - Stores mapping in deviceMapping collection
   - Caches short name in localStorage
STATUS: Ready for integration
*/

// js/session.js
// Device Session Manager v1.02
// FIXED: deviceMapping DEV-## allocation hang (see getShortDeviceName)

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
    // v1.02: allocation is O(1) network calls — one bulk read, in-memory scan,
    // stale-mapping pruning, and a bounded reap fallback (no more 99 sequential queries).
    var DEVICE_MAPPING_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    var MAX_DEVICE_NUM = 99;
    
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
                // Update lastSeen (fire-and-forget — never block name resolution on it)
                firestore.collection(DEVICE_MAPPING_COLLECTION).doc(deviceIdFull).update({
                    lastSeen: Date.now()
                }).catch(function() {});
                shortDeviceName = existingShortName;
                localStorage.setItem("shortDeviceName", existingShortName);
                console.log("Short device name (existing):", existingShortName);
                return existingShortName;
            }
            
            // Single bulk read of the deviceMapping collection (small metadata).
            // Replaces the old up-to-99-sequential-queries scan that hung pre-game.html
            // once all DEV-01..99 names were taken.
            var snapshot = await firestore.collection(DEVICE_MAPPING_COLLECTION).get();
            
            var usedNames = {};
            var staleDocs = [];
            var counterData = null;
            var now = Date.now();
            snapshot.forEach(function(doc) {
                if (doc.id === "counter") {
                    counterData = doc.data();
                    return;
                }
                var data = doc.data();
                if (!data.shortName) return;
                // Stale mappings free their names and are deleted in the background
                if (data.lastSeen && (now - data.lastSeen > DEVICE_MAPPING_STALE_MS)) {
                    staleDocs.push(doc);
                    return;
                }
                usedNames[data.shortName] = true;
            });
            
            // Prune stale mappings (fire-and-forget)
            if (staleDocs.length) {
                staleDocs.forEach(function(doc) {
                    firestore.collection(DEVICE_MAPPING_COLLECTION).doc(doc.id).delete().catch(function() {});
                });
            }
            
            // Start allocation after the last assigned number (counter doc)
            var nextNumber = 1;
            if (counterData && counterData.lastNumber) {
                nextNumber = (counterData.lastNumber % MAX_DEVICE_NUM) + 1;
            }
            
            // In-memory linear scan for the next free name (bounded, no network per candidate)
            var newShortName = null;
            for (var attempts = 0; attempts < MAX_DEVICE_NUM; attempts++) {
                var candidate = "DEV-" + nextNumber.toString().padStart(2, '0');
                if (!usedNames[candidate]) {
                    newShortName = candidate;
                    break;
                }
                nextNumber = (nextNumber % MAX_DEVICE_NUM) + 1;
            }
            
            // All names in use: reap the least-recently-seen active mapping
            // (in-memory from the snapshot; keeps allocation bounded)
            if (!newShortName) {
                var oldestDoc = null;
                var oldestLastSeen = Infinity;
                snapshot.forEach(function(doc) {
                    if (doc.id === "counter") return;
                    var data = doc.data();
                    if (!data.shortName) return;
                    var ls = data.lastSeen || 0;
                    if (ls < oldestLastSeen) {
                        oldestLastSeen = ls;
                        oldestDoc = doc;
                    }
                });
                if (oldestDoc) {
                    var reapedName = oldestDoc.data().shortName;
                    await firestore.collection(DEVICE_MAPPING_COLLECTION).doc(oldestDoc.id).delete();
                    newShortName = reapedName;
                }
            }
            
            // Final safety net: derive from device id (should never be reached)
            if (!newShortName) {
                newShortName = "DEV-" + getDeviceId().slice(-2).padStart(2, '0');
            }
            
            // Save mapping
            await firestore.collection(DEVICE_MAPPING_COLLECTION).doc(deviceIdFull).set({
                shortName: newShortName,
                deviceId: deviceIdFull,
                createdAt: Date.now(),
                lastSeen: Date.now()
            });
            
            // Update counter
            var usedNumber = parseInt(newShortName.replace("DEV-", ""), 10) || nextNumber;
            await firestore.collection(DEVICE_MAPPING_COLLECTION).doc("counter").set({
                lastNumber: usedNumber
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
VERSION: 1.02
KEY CHANGES:
   - FIXED (2026-08-09): deviceMapping DEV-## allocation hang — one bulk read +
     in-memory scan, stale-mapping pruning, bounded reap fallback (no more 99
     sequential queries).
   - Added Firestore-based short device names (DEV-01, DEV-02, etc.)
   - New function getShortDeviceName() for async short name retrieval
   - New function getShortNameOnly() for sync short name
   - Updated getDeviceIdDisplay() to show short name
   - Stores mapping in deviceMapping collection
   - Caches short name in localStorage
STATUS: Ready for integration
*/