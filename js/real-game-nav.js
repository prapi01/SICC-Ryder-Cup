/*
FILE: js/real-game-nav.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - FIXED: WRV operations now NEVER block UI (User Never Waits for WRV)
   - REMOVED: `await` from SignCard.submitSignature() - UI updates immediately
   - REMOVED: `await` from createHistoryRecord() - history record writes in background
   - CHANGED: showSignCardModal() now shows waiting screen BEFORE WRV starts
   - CHANGED: Cache updates happen optimistically (immediately after sign)
   - CHANGED: Game completion triggered immediately (no waiting for WRV)
   - This ensures users never wait for WRV operations to complete
   - WRV runs in background with unlimited retries until success
   - PRESERVED: ALL other functionality from v1.12 unchanged
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, GameUI, SignCard, HistoryRecord, HandicapAdjustment, WaitingScreen, Modal
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_NAV_VERSION = "1.13";

var RealGameNav = (function() {
    
    console.log("[REAL-GAME-NAV] Initializing v1.13 - WRV never blocks UI");
    
    // ============================================================
    // Private Helpers
    // ============================================================
    
    function getCurrentHole() {
        return RealGameState.getCurrentHole();
    }
    
    function setCurrentHole(value) {
        RealGameState.setCurrentHole(value);
    }
    
    function getEditableFlight() {
        return RealGameState.getEditableFlight();
    }
    
    function getGameId() {
        return RealGameState.getGameId();
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
    
    function getStartingHole() {
        return RealGameState.getStartingHole();
    }
    
    function getTeamGameFormat() {
        return RealGameState.getTeamGameFormat();
    }
    
    function isGameComplete() {
        return RealGameState.isGameComplete();
    }
    
    function setGameComplete(value) {
        RealGameState.setGameComplete(value);
    }
    
    function isCelebrationTriggered() {
        return RealGameState.isCelebrationTriggered();
    }
    
    function setCelebrationTriggered(value) {
        RealGameState.setCelebrationTriggered(value);
    }
    
    function isTakeoverDetected() {
        return RealGameState.isTakeoverDetected();
    }
    
    function isViewOtherFlight() {
        return RealGameState.isViewOtherFlight();
    }
    
    function setViewOtherFlight(value) {
        RealGameState.setViewOtherFlight(value);
    }
    
    function getActiveWaitModal() {
        return RealGameState.getActiveWaitModal();
    }
    
    function setActiveWaitModal(value) {
        RealGameState.setActiveWaitModal(value);
    }
    
    function getActiveCompleteModal() {
        return RealGameState.getActiveCompleteModal();
    }
    
    function setActiveCompleteModal(value) {
        RealGameState.setActiveCompleteModal(value);
    }
    
    function getLocalChanges() {
        return RealGameState.getLocalChanges();
    }
    
    function clearLocalChanges() {
        RealGameState.clearLocalChanges();
    }
    
    function isHoleSaved(flight, hole) {
        if (typeof RealGameUI !== 'undefined' && RealGameUI.isHoleSaved) {
            return RealGameUI.isHoleSaved(flight, hole);
        }
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) return false;
        return cache.savedHoles && cache.savedHoles[flight] && cache.savedHoles[flight].indexOf(hole) !== -1;
    }
    
    function hasUnsavedChanges(flight, hole) {
        return RealGameState.hasUnsavedChanges(flight, hole);
    }
    
    // ============================================================
    // updateHoleNumberDisplay
    // ============================================================
    
    function updateHoleNumberDisplay() {
        var currentHole = getCurrentHole();
        if (typeof GameUI !== 'undefined') {
            GameUI.updateCompactHoleDisplay(currentHole);
            GameUI.updateHoleHeaderNumber(currentHole);
        }
    }
    
    // ============================================================
    // nextHole
    // ============================================================
    
    function nextHole() {
        var currentHole = getCurrentHole();
        var editableFlight = getEditableFlight();
        
        console.log("[DEBUG-NAV] nextHole called, currentHole=" + currentHole);
        
        if (isGameComplete() && !isCelebrationTriggered()) {
            showCelebrationAndHandicap();
            return;
        }
        
        if (isTakeoverDetected()) {
            return;
        }
        
        if (isViewOtherFlight()) {
            console.log("[DEBUG-NAV] Cannot advance hole while viewing other flight");
            return;
        }
        
        var lastHole = RealGameUtils.getLastHole();
        var isLast = (currentHole === lastHole);
        var isSaved = isHoleSaved(editableFlight, currentHole);
        var hasUnsaved = hasUnsavedChanges(editableFlight, currentHole);
        var isCurrentSaved = isSaved && !hasUnsaved;
        
        if (isLast && isCurrentSaved) {
            showSignCardModal();
            return;
        }
        
        if (!isCurrentSaved) {
            console.log("[DEBUG-NAV] Cannot advance - hole " + currentHole + " not saved");
            return;
        }
        
        var playOrder = RealGameUtils.getPlayOrder();
        var currentIndex = playOrder.indexOf(currentHole);
        var nextIndex = (currentIndex + 1) % 18;
        setCurrentHole(playOrder[nextIndex]);
        
        console.log("[DEBUG-NAV] Moved to hole " + getCurrentHole());
        updateHoleNumberDisplay();
        
        if (typeof RealGameSave !== 'undefined' && RealGameSave.setSaveButtonIdle) {
            RealGameSave.setSaveButtonIdle();
        }
        
        if (typeof RealGameUI !== 'undefined') {
            RealGameUI.renderAll();
        }
    }
    
    // ============================================================
    // prevHole
    // ============================================================
    
    function prevHole() {
        if (isViewOtherFlight()) {
            console.log("[DEBUG-NAV] Cannot navigate holes while viewing other flight");
            return;
        }
        
        var currentHole = getCurrentHole();
        var playOrder = RealGameUtils.getPlayOrder();
        var currentIndex = playOrder.indexOf(currentHole);
        
        if (currentIndex <= 0) return;
        
        var prevIndex = currentIndex - 1;
        setCurrentHole(playOrder[prevIndex]);
        
        updateHoleNumberDisplay();
        
        if (typeof RealGameSave !== 'undefined' && RealGameSave.setSaveButtonIdle) {
            RealGameSave.setSaveButtonIdle();
        }
        
        if (typeof RealGameUI !== 'undefined') {
            RealGameUI.renderAll();
        }
    }
    
    // ============================================================
    // onToggleFlightView
    // ============================================================
    
    function onToggleFlightView() {
        setViewOtherFlight(!isViewOtherFlight());
        console.log("[REAL-GAME] Toggle flight view: viewOtherFlight = " + isViewOtherFlight());
        if (typeof RealGameUI !== 'undefined') {
            RealGameUI.renderAll();
        }
    }
    
    // ============================================================
    // showSignCardModal - v1.13: WRV NEVER BLOCKS UI
    // ============================================================
    
    function showSignCardModal() {
        if (typeof GameUI !== 'undefined' && GameUI.ensureNoStuckModals) {
            GameUI.ensureNoStuckModals();
        }
        
        var gameId = getGameId();
        var editableFlight = getEditableFlight();
        
        var modalHtml = `
            <div class="modal-overlay" id="signModalNew">
                <div class="sign-modal-container">
                    <div class="sign-modal-title">✍️ SIGN SCORECARD</div>
                    <div class="sign-modal-message">Confirm that all scores are correct.</div>
                    <div class="sign-modal-buttons">
                        <button class="sign-btn-back" id="signBackBtnNew">← BACK</button>
                        <button class="sign-btn-confirm" id="signConfirmBtnNew">✓ SIGN CARD</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById('signBackBtnNew').onclick = function() {
            document.getElementById('signModalNew').remove();
        };
        
        // v1.13: NO async - UI updates immediately, WRV runs in background
        document.getElementById('signConfirmBtnNew').onclick = function() {
            document.getElementById('signModalNew').remove();
            
            // ✅ IMMEDIATELY show waiting screen (no await)
            showWaitingScreen();
            
            // ✅ Fire WRV in background (no await, no .then)
            if (typeof SignCard !== 'undefined' && SignCard.submitSignature) {
                SignCard.submitSignature(gameId, editableFlight, null, "scheduledGames");
            }
            
            // ✅ Update cache immediately (optimistic)
            var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
            if (cache) {
                // v1.12: Update nested signatures structure
                if (editableFlight === 1) {
                    cache.signatures.f1.signed = true;
                } else {
                    cache.signatures.f2.signed = true;
                }
                
                // ✅ Check if both flights are signed (using cache)
                if (cache.signatures.f1.signed && cache.signatures.f2.signed) {
                    // ✅ Fire history record in background (no await)
                    createHistoryRecord();
                    setGameComplete(true);
                    setCelebrationTriggered(false);
                    showGameCompleteScreen();
                    if (typeof RealGameUI !== 'undefined') {
                        RealGameUI.renderAll();
                    }
                }
            }
        };
    }
    
    // ============================================================
    // showWaitingScreen
    // ============================================================
    
    function showWaitingScreen() {
        var existingModal = getActiveWaitModal();
        if (existingModal) {
            existingModal.remove();
        }
        
        var editableFlight = getEditableFlight();
        var modalHtml = `
            <div class="modal-overlay" id="waitingModalNew">
                <div class="waiting-modal-container">
                    <div class="waiting-title">⌛ CARD SIGNED</div>
                    <div class="waiting-message">Waiting for ${editableFlight === 1 ? 'Flight 2' : 'Flight 1'}...</div>
                    <div class="waiting-submessage">The match will complete when both cards are signed.</div>
                    <div class="waiting-spinner"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setActiveWaitModal(document.getElementById("waitingModalNew"));
    }
    
    // ============================================================
    // hideWaitingScreen
    // ============================================================
    
    function hideWaitingScreen() {
        var modal = getActiveWaitModal();
        if (modal) {
            modal.remove();
            setActiveWaitModal(null);
        }
    }
    
    // ============================================================
    // showGameCompleteScreen - v1.13: UNCHANGED
    // ============================================================
    
    function showGameCompleteScreen() {
        hideWaitingScreen();
        
        var gameId = getGameId();
        console.log("[NAV] showGameCompleteScreen called, gameId:", gameId);
        
        // v1.10: Safety check for gameId before navigation
        if (!gameId) {
            console.error("[NAV] Cannot navigate to post-game - no gameId");
            if (typeof Modal !== 'undefined' && Modal.alert) {
                Modal.alert("Error: No game ID found. Please return to the main menu.");
            }
            return;
        }
        
        console.log("[NAV] Game completed - redirecting to post-game.html");
        
        // Store post-game context
        sessionStorage.setItem('isPostGame', 'true');
        sessionStorage.setItem('currentGameId', gameId);
        
        // Show waiting screen while redirecting
        if (typeof WaitingScreen !== 'undefined' && WaitingScreen.show) {
            WaitingScreen.show("Loading Post-Game...");
            console.log("[NAV] Waiting screen shown");
        } else {
            var overlay = document.createElement('div');
            overlay.id = 'waitingScreenOverlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
            overlay.innerHTML = '<div style="font-size:5rem;filter:grayscale(100%);opacity:0.6;">⛳</div><div style="color:#888;font-size:0.8rem;margin-top:16px;letter-spacing:1px;">Loading Post-Game...</div>';
            document.body.appendChild(overlay);
            console.log("[NAV] Fallback waiting screen shown");
        }
        
        setTimeout(function() {
            console.log("[NAV] Navigating to: post-game.html?gameId=" + gameId);
            window.location.href = 'post-game.html?gameId=' + gameId;
        }, 300);
    }
    
    // ============================================================
    // createHistoryRecord - v1.13: Still async but never awaited
    // ============================================================
    
    async function createHistoryRecord() {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) return;
        
        var gameId = getGameId();
        var currentHole = getCurrentHole();
        var allPlayers = getAllPlayers();
        var coursePar = getCoursePar();
        var courseSi = getCourseSi();
        var courseName = getCourseName();
        var startingHole = getStartingHole();
        var teamGameFormat = getTeamGameFormat();
        var tr = typeof GameLoader !== 'undefined' ? GameLoader.getTRForHole(currentHole) : { teamA: 9.5, teamB: 9.5 };
        var allMatchResults = {};
        
        if (typeof GameMatch !== 'undefined' && GameMatch.calculateCrossFlight) {
            for (var hole = 1; hole <= 18; hole++) {
                var matchResults = GameMatch.calculateCrossFlight(
                    cache.f1DataString, cache.f2DataString, allPlayers, courseSi, startingHole, hole, coursePar
                );
                for (var key in matchResults) {
                    allMatchResults[key] = matchResults[key];
                }
            }
        }
        
        var gameDataForHistory = {
            date: new Date().toISOString().split('T')[0],
            course: { name: courseName, id: cache.course?.id || "", par: coursePar, si: courseSi },
            players: allPlayers,
            startingHole: startingHole,
            teamGameFormat: teamGameFormat
        };
        
        return new Promise(function(resolve, reject) {
            if (typeof HistoryRecord !== 'undefined' && HistoryRecord.createPendingRecord) {
                HistoryRecord.createPendingRecord(
                    gameId,
                    gameDataForHistory,
                    cache.results,
                    { teamA: tr.teamA, teamB: tr.teamB },
                    cache.signatures || { f1: { signed: false }, f2: { signed: false } },
                    cache.f1DataString,
                    cache.f2DataString,
                    allMatchResults,
                    function(err, recordId) {
                        if (err) {
                            console.warn('[NAV] History record creation failed:', err);
                            reject(err);
                        } else {
                            console.log('[NAV] History record created:', recordId);
                            resolve(recordId);
                        }
                    }
                );
            } else {
                console.warn('[NAV] HistoryRecord not available');
                reject(new Error("HistoryRecord not available"));
            }
        });
    }
    
    // ============================================================
    // showCelebrationAndHandicap - v1.09: Fixed onClose callback
    // ============================================================
    
    function showCelebrationAndHandicap() {
        if (isCelebrationTriggered()) return;
        setCelebrationTriggered(true);
        
        console.log("[NAV] showCelebrationAndHandicap called");
        
        var currentHole = getCurrentHole();
        var gameId = getGameId();
        var allPlayers = getAllPlayers();
        var tr = typeof GameLoader !== 'undefined' ? GameLoader.getTRForHole(currentHole) : { teamA: 9.5, teamB: 9.5 };
        
        var winner = "Tie";
        if (typeof SignCard !== 'undefined' && SignCard.getWinner) {
            winner = SignCard.getWinner(tr.teamA, tr.teamB);
        } else if (tr.teamA > tr.teamB) {
            winner = "A";
        } else if (tr.teamB > tr.teamA) {
            winner = "B";
        }
        
        var winningPlayers = {
            teamA: allPlayers.filter(function(p) { return p.team === "A"; }),
            teamB: allPlayers.filter(function(p) { return p.team === "B"; })
        };
        
        var historyRecordId = gameId + "_H";
        console.log("[NAV] Using archive ID:", historyRecordId);
        
        window._celebrationDataForHandler = {
            gameId: gameId,
            historyRecordId: historyRecordId,
            winningPlayers: winningPlayers
        };
        
        if (typeof SignCard !== 'undefined' && SignCard.showCelebrationScreen) {
            // v1.09: onClose callback does NOT navigate - user must click "HANDICAP ADJUSTMENT"
            SignCard.showCelebrationScreen(
                winner,
                tr.teamA,
                tr.teamB,
                winningPlayers,
                gameId,
                function() {
                    // onClose callback - do NOT navigate automatically
                    console.log("[NAV] Celebration screen closed by user (onClose fired)");
                    
                    // Only hide waiting screen, no navigation
                    if (typeof WaitingScreen !== 'undefined' && WaitingScreen.hide) {
                        WaitingScreen.hide();
                    } else {
                        var el = document.getElementById('waitingScreenOverlay');
                        if (el) el.remove();
                    }
                    console.log("[NAV] Waiting screen hidden");
                    // User will click "HANDICAP ADJUSTMENT" button on celebration screen
                    // No auto-navigation here!
                }
            );
        } else {
            console.error("[NAV] SignCard.showCelebrationScreen not available");
            if (typeof WaitingScreen !== 'undefined' && WaitingScreen.hide) {
                WaitingScreen.hide();
            } else {
                var el = document.getElementById('waitingScreenOverlay');
                if (el) el.remove();
            }
        }
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        nextHole: nextHole,
        prevHole: prevHole,
        updateHoleNumberDisplay: updateHoleNumberDisplay,
        onToggleFlightView: onToggleFlightView,
        showSignCardModal: showSignCardModal,
        showWaitingScreen: showWaitingScreen,
        hideWaitingScreen: hideWaitingScreen,
        showGameCompleteScreen: showGameCompleteScreen,
        showCelebrationAndHandicap: showCelebrationAndHandicap,
        createHistoryRecord: createHistoryRecord
    };
    
})();

// Make available globally
window.RealGameNav = RealGameNav;

/*
FILE: js/real-game-nav.js
VERSION: 1.13
KEY CHANGES from v1.12:
   - FIXED: WRV operations now NEVER block UI (User Never Waits for WRV)
   - REMOVED: `await` from SignCard.submitSignature() - UI updates immediately
   - REMOVED: `await` from createHistoryRecord() - history record writes in background
   - CHANGED: showSignCardModal() now shows waiting screen BEFORE WRV starts
   - CHANGED: Cache updates happen optimistically (immediately after sign)
   - CHANGED: Game completion triggered immediately (no waiting for WRV)
   - This ensures users never wait for WRV operations to complete
   - WRV runs in background with unlimited retries until success
   - PRESERVED: ALL other functionality from v1.12 unchanged
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, GameUI, SignCard, HistoryRecord, HandicapAdjustment, WaitingScreen, Modal
STATUS: Ready for integration
*/