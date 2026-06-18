/*
FILE: js/real-game-nav.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: WaitingScreen calls for smooth transitions
   - showGameCompleteScreen() now shows waiting screen before celebration
   - showCelebrationAndHandicap() now hides waiting screen after celebration loads
   - Prevents real-game screen flash during transitions
   - All existing functionality preserved from v1.01
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, GameUI, SignCard, HistoryRecord, HandicapAdjustment, WaitingScreen
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_NAV_VERSION = "1.02";

var RealGameNav = (function() {
    
    console.log("[REAL-GAME-NAV] Initializing v1.02 - Added WaitingScreen for transitions");
    
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
        
        console.log(`[DEBUG-NAV] nextHole called, currentHole=${currentHole}`);
        
        if (isGameComplete() && !isCelebrationTriggered()) {
            showCelebrationAndHandicap();
            return;
        }
        
        if (isTakeoverDetected()) {
            return;
        }
        
        if (isViewOtherFlight()) {
            console.log(`[DEBUG-NAV] Cannot advance hole while viewing other flight`);
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
            console.log(`[DEBUG-NAV] Cannot advance - hole ${currentHole} not saved`);
            return;
        }
        
        var playOrder = RealGameUtils.getPlayOrder();
        var currentIndex = playOrder.indexOf(currentHole);
        var nextIndex = (currentIndex + 1) % 18;
        setCurrentHole(playOrder[nextIndex]);
        
        console.log(`[DEBUG-NAV] Moved to hole ${getCurrentHole()}`);
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
            console.log(`[DEBUG-NAV] Cannot navigate holes while viewing other flight`);
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
        console.log(`[REAL-GAME] Toggle flight view: viewOtherFlight = ${isViewOtherFlight()}`);
        if (typeof RealGameUI !== 'undefined') {
            RealGameUI.renderAll();
        }
    }
    
    // ============================================================
    // showSignCardModal
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
        
        document.getElementById('signConfirmBtnNew').onclick = async function() {
            document.getElementById('signModalNew').remove();
            
            if (typeof SignCard !== 'undefined' && SignCard.submitSignature) {
                var success = await SignCard.submitSignature(gameId, editableFlight, null, "scheduledGames");
                if (success) {
                    var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
                    if (cache) {
                        if (editableFlight === 1) cache.signatures.f1 = true;
                        else cache.signatures.f2 = true;
                        if (cache.signatures.f1 && cache.signatures.f2) {
                            await createHistoryRecord();
                            setGameComplete(true);
                            setCelebrationTriggered(false);
                            showGameCompleteScreen();
                            if (typeof RealGameUI !== 'undefined') {
                                RealGameUI.renderAll();
                            }
                        } else {
                            showWaitingScreen();
                        }
                    }
                } else {
                    if (typeof Modal !== 'undefined') {
                        Modal.alert("Error signing card.");
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
    // showGameCompleteScreen - v1.02: Added WaitingScreen
    // ============================================================
    
    function showGameCompleteScreen() {
        hideWaitingScreen();
        
        var existingModal = getActiveCompleteModal();
        if (existingModal) {
            existingModal.remove();
        }
        
        var modalHtml = `
            <div class="modal-overlay" id="completeModalNew">
                <div class="complete-modal-container">
                    <div class="complete-title">🏆 GAME COMPLETE</div>
                    <div class="complete-emojis">🍺 🏆 🍺</div>
                    <div class="complete-message">Both cards have been signed!</div>
                    <button id="seeResultsBtnNew" class="complete-btn">🏆 SEE RESULTS</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setActiveCompleteModal(document.getElementById("completeModalNew"));
        
        // v1.02: Show waiting screen when "See Results" is clicked
        document.getElementById("seeResultsBtnNew").onclick = function() {
            // Show waiting screen immediately
            if (typeof WaitingScreen !== 'undefined' && WaitingScreen.show) {
                WaitingScreen.show("Loading Celebration...");
                console.log("[NAV] Waiting screen shown");
            } else {
                // Fallback
                var overlay = document.createElement('div');
                overlay.id = 'waitingScreenOverlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
                overlay.innerHTML = '<div style="font-size:5rem;filter:grayscale(100%);opacity:0.6;">⛳</div><div style="color:#888;font-size:0.8rem;margin-top:16px;letter-spacing:1px;">Loading Celebration...</div>';
                document.body.appendChild(overlay);
                console.log("[NAV] Fallback waiting screen shown");
            }
            
            var modal = getActiveCompleteModal();
            if (modal) {
                modal.remove();
                setActiveCompleteModal(null);
            }
            
            // Small delay to let waiting screen render
            setTimeout(function() {
                showCelebrationAndHandicap();
            }, 300);
        };
    }
    
    // ============================================================
    // createHistoryRecord
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
                        if (err) reject(err);
                        else resolve(recordId);
                    }
                );
            } else {
                reject(new Error("HistoryRecord not available"));
            }
        });
    }
    
    // ============================================================
    // showCelebrationAndHandicap - v1.02: Added WaitingScreen hide
    // ============================================================
    
    function showCelebrationAndHandicap() {
        if (isCelebrationTriggered()) return;
        setCelebrationTriggered(true);
        
        // v1.02: Ensure waiting screen is hidden when celebration loads
        if (typeof WaitingScreen !== 'undefined' && WaitingScreen.hide) {
            WaitingScreen.hide();
        } else {
            var fallback = document.getElementById('waitingScreenOverlay');
            if (fallback) fallback.remove();
        }
        console.log("[NAV] Waiting screen hidden");
        
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
        
        var historyRecordId = gameId + "_history";
        
        if (typeof SignCard !== 'undefined' && SignCard.showCelebrationScreen) {
            SignCard.showCelebrationScreen(
                winner,
                tr.teamA,
                tr.teamB,
                winningPlayers,
                gameId,
                function() {
                    if (typeof HandicapAdjustment !== 'undefined' && HandicapAdjustment.init) {
                        HandicapAdjustment.init(gameId, historyRecordId, winningPlayers, {}, {}, false);
                    }
                }
            );
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
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: WaitingScreen calls for smooth transitions
   - showGameCompleteScreen() now shows waiting screen before celebration
   - showCelebrationAndHandicap() now hides waiting screen after celebration loads
   - Prevents real-game screen flash during transitions
   - All existing functionality preserved from v1.01
DEPENDS ON: RealGameState, RealGameUtils, RealGameUI, RealGameSave, GameUI, SignCard, HistoryRecord, HandicapAdjustment, WaitingScreen
STATUS: Ready for integration
*/