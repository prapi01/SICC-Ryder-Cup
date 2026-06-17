/*
FILE: js/real-game-init.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Extracted initialization and lifecycle logic from real-game.html
   - Contains: init(), onCacheUpdate(), initializeGameData()
   - Contains: exitToMainMenu(), checkLockOwnership(), showTakeoverNotificationModal()
   - Contains: updateGameMetadata(), getPreloadedRawGameData(), applyPreloadedData()
   - Contains: initTicker(), setupRealtimeListener()
   - All functions use RealGameState, RealGameUtils, RealGameUI, RealGameSave, RealGameNav
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, RealGameNav, GameLoader, GameData, SessionManager, Firebase
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_INIT_VERSION = "1.00";

var RealGameInit = (function() {
    
    console.log("[REAL-GAME-INIT] Initializing v1.00");
    
    // ============================================================
    // Private Helpers
    // ============================================================
    
    function getGameId() {
        return RealGameState.getGameId();
    }
    
    function setGameId(value) {
        RealGameState.setGameId(value);
    }
    
    function getEditableFlight() {
        return RealGameState.getEditableFlight();
    }
    
    function setEditableFlight(value) {
        RealGameState.setEditableFlight(value);
    }
    
    function setCanEdit(value) {
        RealGameState.setCanEdit(value);
    }
    
    function setCurrentHole(value) {
        RealGameState.setCurrentHole(value);
    }
    
    function setStartingHole(value) {
        RealGameState.setStartingHole(value);
    }
    
    function setTeamGameFormat(value) {
        RealGameState.setTeamGameFormat(value);
    }
    
    function setCourseName(value) {
        RealGameState.setCourseName(value);
    }
    
    function setCoursePar(value) {
        RealGameState.setCoursePar(value);
    }
    
    function setCourseSi(value) {
        RealGameState.setCourseSi(value);
    }
    
    function setAllPlayers(value) {
        RealGameState.setAllPlayers(value);
    }
    
    function setUsedPreloadedData(value) {
        RealGameState.setUsedPreloadedData(value);
    }
    
    function setTakeoverDetected(value) {
        RealGameState.setTakeoverDetected(value);
    }
    
    function setFirestoreUnsubscribe(value) {
        RealGameState.setFirestoreUnsubscribe(value);
    }
    
    function isTakeoverDetected() {
        return RealGameState.isTakeoverDetected();
    }
    
    function isGameComplete() {
        return RealGameState.isGameComplete();
    }
    
    function getCanEdit() {
        return RealGameState.getCanEdit();
    }
    
    function getStartingHole() {
        return RealGameState.getStartingHole();
    }
    
    function getAllPlayers() {
        return RealGameState.getAllPlayers();
    }
    
    function getCourseName() {
        return RealGameState.getCourseName();
    }
    
    function getCoursePar() {
        return RealGameState.getCoursePar();
    }
    
    function getCourseSi() {
        return RealGameState.getCourseSi();
    }
    
    function getTeamGameFormat() {
        return RealGameState.getTeamGameFormat();
    }
    
    function getCurrentHole() {
        return RealGameState.getCurrentHole();
    }
    
    function getFirestoreUnsubscribe() {
        return RealGameState.getFirestoreUnsubscribe();
    }
    
    function isViewOtherFlight() {
        return RealGameState.isViewOtherFlight();
    }
    
    function setViewOtherFlight(value) {
        RealGameState.setViewOtherFlight(value);
    }
    
    function isSaveInProgress() {
        return RealGameState.isSaveInProgress();
    }
    
    function setSaveInProgress(value) {
        RealGameState.setSaveInProgress(value);
    }
    
    function isCelebrationTriggered() {
        return RealGameState.isCelebrationTriggered();
    }
    
    function setCelebrationTriggered(value) {
        RealGameState.setCelebrationTriggered(value);
    }
    
    function getLocalChanges() {
        return RealGameState.getLocalChanges();
    }
    
    function clearLocalChanges() {
        RealGameState.clearLocalChanges();
    }
    
    function setGameComplete(value) {
        RealGameState.setGameComplete(value);
    }
    
    function setActiveWaitModal(value) {
        RealGameState.setActiveWaitModal(value);
    }
    
    function setActiveCompleteModal(value) {
        RealGameState.setActiveCompleteModal(value);
    }
    
    // ============================================================
    // updateGameMetadata
    // ============================================================
    
    function updateGameMetadata(flight, holeNumber) {
        var gameId = getGameId();
        console.log(`[METADATA] Updating metadata for flight ${flight}, hole ${holeNumber}`);
        
        return new Promise(function(resolve) {
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    var playOrder = RealGameUtils.getPlayOrder();
                    var currentPlayPosition = playOrder.indexOf(holeNumber);
                    if (currentPlayPosition === -1) {
                        currentPlayPosition = holeNumber - 1;
                    }
                    
                    var metaPayload = {
                        gameStarted: true,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (flight === 1) {
                        metaPayload.currentHoleF1 = holeNumber;
                    } else if (flight === 2) {
                        metaPayload.currentHoleF2 = holeNumber;
                    } else {
                        metaPayload.currentHoleF1 = holeNumber;
                        metaPayload.currentHoleF2 = holeNumber;
                    }
                    
                    console.log(`[METADATA] Writing to Firestore:`, metaPayload);
                    
                    var db = firebase.firestore();
                    db.collection("scheduledGames").doc(gameId).update(metaPayload)
                        .then(function() {
                            console.log(`[METADATA] Successfully updated metadata for flight ${flight}`);
                            resolve(true);
                        })
                        .catch(function(e) {
                            console.warn(`[METADATA] Failed to update metadata:`, e);
                            resolve(false);
                        });
                });
            });
        });
    }
    
    // ============================================================
    // checkLockOwnership
    // ============================================================
    
    function checkLockOwnership() {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache || !cache.locks) return true;
        
        var editableFlight = getEditableFlight();
        var now = Date.now();
        var myDeviceIdFull = typeof SessionManager !== 'undefined' ? SessionManager.getDeviceIdDisplay() : "unknown";
        var currentLock = (editableFlight === 1) ? cache.locks.f1 : cache.locks.f2;
        
        var stillOwnsLock = currentLock && currentLock.did === myDeviceIdFull && currentLock.ex > now;
        
        if (!stillOwnsLock && getCanEdit() && !isTakeoverDetected() && !isGameComplete()) {
            setTakeoverDetected(true);
            setCanEdit(false);
            
            var saveBtn = document.getElementById('compactSaveBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
            }
            
            showTakeoverNotificationModal();
        }
        
        return stillOwnsLock;
    }
    
    // ============================================================
    // showTakeoverNotificationModal
    // ============================================================
    
    function showTakeoverNotificationModal() {
        var editableFlight = getEditableFlight();
        var flightText = editableFlight === 1 ? "Flight 1" : "Flight 2";
        
        var modalHtml = `
            <div class="modal-overlay" id="takeoverNotificationModal">
                <div class="takeover-modal-container">
                    <div class="takeover-modal-title">⚠️ ROLE TAKEN OVER</div>
                    <div class="takeover-modal-message">Your role (${flightText}) has been taken over by another device.</div>
                    <div class="takeover-modal-device">You can no longer edit scores.</div>
                    <div class="takeover-modal-buttons">
                        <button class="takeover-btn-viewer" id="takeoverViewerBtn">👁️ VIEWER</button>
                        <button class="takeover-btn-exit" id="takeoverExitBtn">🚪 EXIT</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById("takeoverViewerBtn").addEventListener("click", function() {
            document.getElementById("takeoverNotificationModal").remove();
            window.location.href = "view-game.html";
        });
        
        document.getElementById("takeoverExitBtn").addEventListener("click", function() {
            document.getElementById("takeoverNotificationModal").remove();
            window.location.href = "index.html";
        });
    }
    
    // ============================================================
    // getPreloadedRawGameData
    // ============================================================
    
    function getPreloadedRawGameData() {
        var stored = sessionStorage.getItem("preloadedRawGameData");
        if (stored) {
            try {
                var data = JSON.parse(stored);
                if (data.preloadTimestamp && (Date.now() - data.preloadTimestamp) < 300000) {
                    return data;
                } else {
                    sessionStorage.removeItem("preloadedRawGameData");
                }
            } catch(e) {
                console.warn("Failed to parse preloaded raw data:", e);
            }
        }
        return null;
    }
    
    // ============================================================
    // applyPreloadedData
    // ============================================================
    
    function applyPreloadedData(preloadData) {
        console.log("Applying preloaded data for instant render");
        
        var courseName = preloadData.course?.name || "Unknown Course";
        var coursePar = preloadData.course?.par || [];
        var courseSi = preloadData.course?.si || [];
        var allPlayers = preloadData.players || [];
        var startingHole = preloadData.startingHole || 1;
        var teamGameFormat = preloadData.teamGameFormat || "tournament";
        
        setCourseName(courseName);
        setCoursePar(coursePar);
        setCourseSi(courseSi);
        setAllPlayers(allPlayers);
        setStartingHole(startingHole);
        setTeamGameFormat(teamGameFormat);
        
        // Update GameOrder with starting hole
        RealGameUtils.updateGameOrder(startingHole);
        
        var mockCache = {
            course: preloadData.course,
            players: preloadData.players,
            startingHole: preloadData.startingHole,
            teamGameFormat: preloadData.teamGameFormat,
            f1DataString: preloadData.f1DataString || "",
            f2DataString: preloadData.f2DataString || "",
            results: preloadData.results || null,
            savedHoles: preloadData.savedHoles || { 1: [], 2: [] },
            t1Row: preloadData.t1Row || new Array(18).fill('_'),
            t2Row: preloadData.t2Row || new Array(18).fill('_'),
            strkRow: preloadData.strkRow || new Array(18).fill('0'),
            lastSyncedPosition: preloadData.lastSyncedPosition || -1,
            clinchedAt: preloadData.clinchedAt || {},
            signatures: { f1: false, f2: false },
            submitted: { f1: false, f2: false },
            locks: preloadData.locks || { f1: null, f2: null },
            gameStarted: true
        };
        
        if (typeof GameLoader !== 'undefined' && GameLoader.setLocalCache) {
            GameLoader.setLocalCache(mockCache);
        } else {
            window._preloadedGameCache = mockCache;
        }
        
        document.getElementById("courseName").innerHTML = courseName;
        document.getElementById("mainContainer").classList.add("data-ready");
        
        setUsedPreloadedData(true);
        return true;
    }
    
    // ============================================================
    // initTicker
    // ============================================================
    
    function getPlayerScoreForTicker(player) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (cache && cache.results && cache.results.playerTotals) {
            var playerTotal = cache.results.playerTotals[player.name];
            if (playerTotal && typeof playerTotal.relativeToPar === 'number') {
                return playerTotal.relativeToPar;
            }
        }
        return 0;
    }
    
    function initTicker() {
        var allPlayers = getAllPlayers();
        if (typeof Ticker !== 'undefined') {
            Ticker.init('tickerContainer', 'tickerContent', getPlayerScoreForTicker);
            if (allPlayers && allPlayers.length) {
                Ticker.setPlayers(allPlayers);
            }
        }
    }
    
    // ============================================================
    // setupRealtimeListener
    // ============================================================
    
    function setupRealtimeListener(renderAllCallback) {
        var gameId = getGameId();
        var db = firebase.firestore();
        
        if (!db || !gameId) {
            console.warn("Cannot setup realtime listener - db or gameId missing");
            return;
        }
        
        var existingUnsubscribe = getFirestoreUnsubscribe();
        if (existingUnsubscribe) {
            existingUnsubscribe();
            setFirestoreUnsubscribe(null);
        }
        
        console.log("Setting up realtime Firestore listener for game:", gameId);
        
        var unsubscribe = db.collection("scheduledGames").doc(gameId)
            .onSnapshot(function(doc) {
                if (!doc.exists) return;
                
                var data = doc.data();
                var currentCache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
                if (!currentCache) return;
                
                var f1Changed = (currentCache.f1DataString !== data.f1?.d);
                var f2Changed = (currentCache.f2DataString !== data.f2?.d);
                var locksChanged = (JSON.stringify(currentCache.locks) !== JSON.stringify(data.locks));
                var resultsChanged = (JSON.stringify(currentCache.results) !== JSON.stringify(data.results));
                
                if (f1Changed || f2Changed || locksChanged || resultsChanged) {
                    console.log("Realtime update detected");
                    
                    if (typeof GameLoader !== 'undefined') {
                        GameLoader.loadGame(gameId, "scheduledGames", function(result) {
                            if (result.success) {
                                console.log("Cache refreshed from realtime update");
                                
                                var cache = result.cache;
                                if (cache.course) {
                                    setCourseName(cache.course.name);
                                    setCoursePar(cache.course.par);
                                    setCourseSi(cache.course.si);
                                }
                                setAllPlayers(cache.players || []);
                                setStartingHole(cache.startingHole || 1);
                                RealGameUtils.updateGameOrder(getStartingHole());
                                
                                var clinchedAtFromFS = cache.results?.clinchedAt || {};
                                console.log(`[CASCADE-DEBUG] Firestore cache refresh: clinchedAt count = ${Object.keys(clinchedAtFromFS).length}`);
                                
                                if (typeof Ticker !== 'undefined' && getAllPlayers().length) {
                                    Ticker.setPlayers(getAllPlayers());
                                }
                                
                                checkLockOwnership();
                                if (renderAllCallback) renderAllCallback();
                            } else {
                                console.warn("Failed to refresh cache from realtime update:", result.error);
                            }
                        });
                    }
                }
            }, function(error) {
                console.warn("Firestore realtime listener error:", error);
            });
        
        setFirestoreUnsubscribe(unsubscribe);
        return unsubscribe;
    }
    
    // ============================================================
    // initializeGameData
    // ============================================================
    
    function initializeGameData(collection, cache, callback) {
        var gameId = getGameId();
        var editableFlight = getEditableFlight();
        
        return new Promise(function(resolve) {
            var mockSession = {
                activeGame: {
                    gameId: gameId,
                    gameType: "real",
                    gameMode: "real",
                    collection: collection,
                    role: editableFlight === 1 ? "update1" : "update2"
                }
            };
            
            if (typeof GameData !== 'undefined' && GameData.loadGameFromSession) {
                GameData.loadGameFromSession(mockSession, function(success) {
                    if (success) {
                        if (typeof GameData.setCourse === 'function') {
                            GameData.setCourse({ par: cache.course?.par || [] });
                        }
                        if (typeof GameData.setPlayers === 'function') {
                            GameData.setPlayers(cache.players || []);
                        }
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            } else {
                resolve(false);
            }
        });
    }
    
    // ============================================================
    // onCacheUpdate
    // ============================================================
    
    function onCacheUpdate(cache, renderAllCallback) {
        if (cache.course) {
            setCourseName(cache.course.name);
            setCoursePar(cache.course.par);
            setCourseSi(cache.course.si);
            document.getElementById("courseName").innerHTML = setCourseName;
        }
        setAllPlayers(cache.players || []);
        setStartingHole(cache.startingHole || 1);
        RealGameUtils.updateGameOrder(getStartingHole());
        
        if (typeof Ticker !== 'undefined' && getAllPlayers().length) {
            Ticker.setPlayers(getAllPlayers());
        }
        
        // Check if game is complete
        if (cache.signatures && cache.signatures.f1 && cache.signatures.f2 && 
            !isGameComplete() && !isCelebrationTriggered()) {
            
            if (typeof RealGameNav !== 'undefined' && RealGameNav.createHistoryRecord) {
                RealGameNav.createHistoryRecord().then(function() {
                    setGameComplete(true);
                    if (typeof RealGameNav !== 'undefined' && RealGameNav.showGameCompleteScreen) {
                        RealGameNav.showGameCompleteScreen();
                    }
                    if (renderAllCallback) renderAllCallback();
                }).catch(console.error);
            }
        }
        
        if (renderAllCallback) renderAllCallback();
    }
    
    // ============================================================
    // exitToMainMenu
    // ============================================================
    
    function exitToMainMenu() {
        var firestoreUnsubscribe = getFirestoreUnsubscribe();
        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            setFirestoreUnsubscribe(null);
            console.log("[EXIT] Firestore listener unsubscribed");
        }
        
        var canEdit = getCanEdit();
        var takeoverDetected = isTakeoverDetected();
        var viewOtherFlight = isViewOtherFlight();
        var gameId = getGameId();
        var editableFlight = getEditableFlight();
        
        if (canEdit && !takeoverDetected && !viewOtherFlight) {
            var releasePayload = {
                ["locks.f" + editableFlight]: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            var db = firebase.firestore();
            db.collection("scheduledGames").doc(gameId).update(releasePayload)
                .then(function() {
                    console.log("[EXIT] Lock released for flight", editableFlight);
                })
                .catch(function(e) {
                    console.warn("[EXIT] Failed to release lock:", e);
                });
        }
        
        if (typeof Modal !== 'undefined') {
            Modal.confirm(
                "Leave the game? Unsaved changes will be lost.",
                function() {
                    console.log("[EXIT] User confirmed exit");
                    if (typeof GameLoader !== 'undefined') {
                        GameLoader.unload();
                    }
                    sessionStorage.removeItem("currentGame");
                    localStorage.removeItem("userRole");
                    window.location.href = "index.html";
                },
                function() {
                    console.log("[EXIT] User cancelled exit - staying in game");
                    setupRealtimeListener();
                }
            );
        } else {
            // Fallback if Modal not available
            if (confirm("Leave the game? Unsaved changes will be lost.")) {
                if (typeof GameLoader !== 'undefined') {
                    GameLoader.unload();
                }
                sessionStorage.removeItem("currentGame");
                localStorage.removeItem("userRole");
                window.location.href = "index.html";
            }
        }
    }
    
    // ============================================================
    // init - Main Initialization Function
    // ============================================================
    
    async function init(renderAllCallback) {
        console.log("[DEBUG-INIT] Starting initialization");
        
        var myDeviceShortName = typeof SessionManager !== 'undefined' ? await SessionManager.getShortNameOnly() : "DEV-??";
        document.getElementById("deviceTag").innerHTML = "🖥️ " + myDeviceShortName;
        
        var session = await new Promise(function(resolve) {
            if (typeof SessionManager !== 'undefined') {
                SessionManager.initSession("real-game.html", "index.html", resolve);
            } else {
                resolve(null);
            }
        });
        
        var sessionRole = session && session.activeGame ? session.activeGame.role : null;
        var editableFlight = (sessionRole === "update1") ? 1 : (sessionRole === "update2") ? 2 : 1;
        setEditableFlight(editableFlight);
        setCanEdit(editableFlight === 1 || editableFlight === 2);
        
        var gameId = session && session.activeGame ? session.activeGame.gameId : sessionStorage.getItem('currentGameId');
        if (!gameId) {
            document.getElementById("debug").innerHTML = "Error: No game ID";
            return;
        }
        setGameId(gameId);
        
        console.log(`[DEBUG-INIT] gameId=${gameId}, editableFlight=${editableFlight}`);
        console.log(`[DEBUG-INIT] Monitoring target hole: ${RealGameState.getDebugTargetHole()}`);
        
        var collection = "scheduledGames";
        if (typeof GameLoader !== 'undefined') {
            GameLoader.addDataCallback(function(cache) {
                onCacheUpdate(cache, renderAllCallback);
            });
        }
        
        // Check for pending writes
        if (typeof RealGameSave !== 'undefined' && RealGameSave.loadPendingWrites) {
            var pendingWrites = RealGameSave.loadPendingWrites();
            if (pendingWrites) {
                console.log(`[CASCADE-DEBUG] Found pending writes from previous session, resuming...`);
                await new Promise(function(resolveLoad) {
                    if (typeof GameLoader !== 'undefined') {
                        GameLoader.loadGame(gameId, collection, function(result) {
                            if (result.success) {
                                var cache = result.cache;
                                if (cache.course) {
                                    setCourseName(cache.course.name);
                                    setCoursePar(cache.course.par);
                                    setCourseSi(cache.course.si);
                                }
                                setAllPlayers(cache.players || []);
                                setStartingHole(cache.startingHole || 1);
                                RealGameUtils.updateGameOrder(getStartingHole());
                            }
                            resolveLoad();
                        });
                    } else {
                        resolveLoad();
                    }
                });
                
                if (typeof RealGameSave !== 'undefined' && RealGameSave.processPendingWrites) {
                    await RealGameSave.processPendingWrites(renderAllCallback);
                }
            }
        }
        
        var preloadData = getPreloadedRawGameData();
        var gameDataPreloaded = sessionStorage.getItem("gameDataPreloaded") === "true";
        
        if (preloadData && gameDataPreloaded) {
            applyPreloadedData(preloadData);
            sessionStorage.removeItem("gameDataPreloaded");
            
            if (typeof GameUI !== 'undefined') {
                GameUI.applyTightLayout();
            }
            
            if (typeof RealGameUI !== 'undefined') {
                RealGameUI.renderCompactHeaderWithFlightToggle();
            }
            
            if (typeof GameUI !== 'undefined') {
                GameUI.setDisplayMode(GameUI.getDisplayMode(), null);
                setTimeout(function() {
                    GameUI.addFlightBadge(editableFlight);
                }, 100);
                GameUI.renderBottomMenu("bottomMenuContainer", exitToMainMenu);
            }
            
            var playOrder = RealGameUtils.getPlayOrder();
            var initialHole = playOrder[0];
            for (var i = 0; i < playOrder.length; i++) {
                if (!RealGameUI.isHoleSaved ? false : !RealGameUI.isHoleSaved(editableFlight, playOrder[i])) {
                    initialHole = playOrder[i];
                    break;
                }
            }
            setCurrentHole(initialHole);
            
            if (typeof RealGameNav !== 'undefined') {
                RealGameNav.updateHoleNumberDisplay();
            }
            
            initTicker();
            if (getAllPlayers().length) {
                Ticker.setPlayers(getAllPlayers());
            }
            
            if (renderAllCallback) renderAllCallback();
            
            if (typeof RealGameSave !== 'undefined' && RealGameSave.setSaveButtonIdle) {
                RealGameSave.setSaveButtonIdle();
            }
            
            if (typeof GameLoader !== 'undefined') {
                GameLoader.loadGame(gameId, collection, function(result) {
                    if (result.success) {
                        var cache = result.cache;
                        if (cache.course) {
                            setCourseName(cache.course.name);
                            setCoursePar(cache.course.par);
                            setCourseSi(cache.course.si);
                        }
                        setAllPlayers(cache.players || []);
                        setStartingHole(cache.startingHole || 1);
                        RealGameUtils.updateGameOrder(getStartingHole());
                        if (renderAllCallback) renderAllCallback();
                    }
                });
            }
            
            setupRealtimeListener(renderAllCallback);
            
        } else {
            if (typeof GameLoader !== 'undefined') {
                GameLoader.loadGame(gameId, collection, function(result) {
                    if (!result.success) {
                        document.getElementById("debug").innerHTML = "Error: " + result.error;
                        return;
                    }
                    
                    var cache = result.cache;
                    setCourseName(cache.course?.name || "Unknown Course");
                    setCoursePar(cache.course?.par || []);
                    setCourseSi(cache.course?.si || []);
                    setAllPlayers(cache.players || []);
                    setStartingHole(cache.startingHole || 1);
                    setTeamGameFormat(cache.teamGameFormat || "tournament");
                    document.getElementById("courseName").innerHTML = getCourseName();
                    RealGameUtils.updateGameOrder(getStartingHole());
                    
                    initializeGameData(collection, cache).then(function(initSuccess) {
                        if (!initSuccess) {
                            document.getElementById("debug").innerHTML = "Error: Failed to initialize";
                            return;
                        }
                        
                        if (typeof GameUI !== 'undefined') {
                            GameUI.applyTightLayout();
                        }
                        
                        if (typeof RealGameUI !== 'undefined') {
                            RealGameUI.renderCompactHeaderWithFlightToggle();
                        }
                        
                        if (typeof GameUI !== 'undefined') {
                            GameUI.setDisplayMode(GameUI.getDisplayMode(), null);
                            setTimeout(function() {
                                GameUI.addFlightBadge(editableFlight);
                            }, 100);
                            GameUI.renderBottomMenu("bottomMenuContainer", exitToMainMenu);
                        }
                        
                        var playOrder = RealGameUtils.getPlayOrder();
                        var initialHole = playOrder[0];
                        for (var i = 0; i < playOrder.length; i++) {
                            var isSaved = RealGameUI.isHoleSaved ? RealGameUI.isHoleSaved(editableFlight, playOrder[i]) : false;
                            if (!isSaved) {
                                initialHole = playOrder[i];
                                break;
                            }
                        }
                        setCurrentHole(initialHole);
                        
                        if (typeof RealGameNav !== 'undefined') {
                            RealGameNav.updateHoleNumberDisplay();
                        }
                        
                        initTicker();
                        if (getAllPlayers().length) {
                            Ticker.setPlayers(getAllPlayers());
                        }
                        
                        if (renderAllCallback) renderAllCallback();
                        
                        if (typeof RealGameSave !== 'undefined' && RealGameSave.setSaveButtonIdle) {
                            RealGameSave.setSaveButtonIdle();
                        }
                        
                        document.getElementById("mainContainer").classList.add("data-ready");
                        setupRealtimeListener(renderAllCallback);
                    });
                });
            }
        }
        
        if (typeof GameUI !== 'undefined') {
            GameUI.updateToggleButtons(GameUI.getDisplayMode());
        }
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        init: init,
        onCacheUpdate: onCacheUpdate,
        initializeGameData: initializeGameData,
        exitToMainMenu: exitToMainMenu,
        checkLockOwnership: checkLockOwnership,
        showTakeoverNotificationModal: showTakeoverNotificationModal,
        updateGameMetadata: updateGameMetadata,
        getPreloadedRawGameData: getPreloadedRawGameData,
        applyPreloadedData: applyPreloadedData,
        initTicker: initTicker,
        setupRealtimeListener: setupRealtimeListener,
        getPlayerScoreForTicker: getPlayerScoreForTicker
    };
    
})();

// Make available globally
window.RealGameInit = RealGameInit;

// Expose exitToMainMenu for bottom menu
window.exitToMainMenu = function() {
    if (typeof RealGameInit !== 'undefined') {
        RealGameInit.exitToMainMenu();
    }
};

// Expose onCacheUpdate for GameLoader
window.onCacheUpdate = function(cache) {
    if (typeof RealGameInit !== 'undefined') {
        RealGameInit.onCacheUpdate(cache, function() {
            if (typeof RealGameUI !== 'undefined') {
                RealGameUI.renderAll();
            }
        });
    }
};

/*
FILE: js/real-game-init.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Extracted initialization and lifecycle logic from real-game.html
   - Contains: init(), onCacheUpdate(), initializeGameData()
   - Contains: exitToMainMenu(), checkLockOwnership(), showTakeoverNotificationModal()
   - Contains: updateGameMetadata(), getPreloadedRawGameData(), applyPreloadedData()
   - Contains: initTicker(), setupRealtimeListener()
   - All functions use RealGameState, RealGameUtils, RealGameUI, RealGameSave, RealGameNav
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, RealGameNav, GameLoader, GameData, SessionManager, Firebase
STATUS: Ready for integration
*/