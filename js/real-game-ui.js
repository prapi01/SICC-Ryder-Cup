/*
FILE: js/real-game-ui.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: getBubbleClass() now calculates lastSyncedValue based on the flight being viewed
   - CHANGED: Flight 1 uses global lastSyncedPosition (preserves original behavior)
   - CHANGED: Flight 2 calculates lastSyncedValue from F2's saved holes
   - FIXED: F2 cross-flight bubbles no longer 1 hole off (uses F2's own sync position)
   - REMOVED: isOtherFlightHoleSaved parameter (not needed for this fix)
   - PRESERVED: All v1.04 functionality unchanged
   - PRESERVED: WRV button state management unchanged
   - PRESERVED: All render functions unchanged
DEPENDS ON: RealGameState, RealGameUtils, GameUI, GameScorecard, GameLoader, GameMatch
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_UI_VERSION = "1.05";

var RealGameUI = (function() {
    
    console.log("[REAL-GAME-UI] Initializing v1.05 - Flight-specific lastSyncedValue for F2");
    
    // ============================================================
    // Private Helpers
    // ============================================================
    
    function getAllPlayers() {
        return RealGameState.getAllPlayers();
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
    
    function getEditableFlight() {
        return RealGameState.getEditableFlight();
    }
    
    function getCurrentHole() {
        return RealGameState.getCurrentHole();
    }
    
    function isViewOtherFlight() {
        return RealGameState.isViewOtherFlight();
    }
    
    function isGameComplete() {
        return RealGameState.isGameComplete();
    }
    
    function isCelebrationTriggered() {
        return RealGameState.isCelebrationTriggered();
    }
    
    function isTakeoverDetected() {
        return RealGameState.isTakeoverDetected();
    }
    
    function getCanEdit() {
        return RealGameState.getCanEdit();
    }
    
    function getLocalChanges() {
        return RealGameState.getLocalChanges();
    }
    
    function getDebugTargetHole() {
        return RealGameState.getDebugTargetHole();
    }
    
    // ============================================================
    // v1.02: WRV Button State Management
    // ============================================================
    
    /**
     * Disable the save button during WRV operations
     * Shows status text to indicate saving in progress
     */
    function disableSaveButton(statusText) {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (!saveBtn) return;
        
        var canEdit = getCanEdit();
        var takeoverDetected = isTakeoverDetected();
        var viewOtherFlight = isViewOtherFlight();
        
        if (canEdit && !takeoverDetected && !viewOtherFlight) {
            saveBtn.disabled = true;
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.opacity = '0.6';
            
            if (statusText) {
                saveBtn.innerText = statusText;
            } else {
                saveBtn.innerText = '⏳ Saving...';
            }
            
            // Add visual feedback
            saveBtn.style.background = '#1a2a1a';
            saveBtn.style.borderColor = '#4caf50';
            saveBtn.style.color = '#4caf50';
        }
        
        RealGameState.setSaveInProgress(true);
    }
    
    /**
     * Enable the save button after WRV operations complete
     */
    function enableSaveButton() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (!saveBtn) return;
        
        var currentHole = getCurrentHole();
        var canEdit = getCanEdit();
        var takeoverDetected = isTakeoverDetected();
        var viewOtherFlight = isViewOtherFlight();
        
        if (canEdit && !takeoverDetected && !viewOtherFlight) {
            saveBtn.disabled = false;
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.opacity = '1';
            saveBtn.innerText = 'SAVE H' + currentHole;
            saveBtn.style.background = '#1a3a1a';
            saveBtn.style.borderColor = '#4caf50';
            saveBtn.style.color = '#4caf50';
        }
        
        RealGameState.setSaveInProgress(false);
        
        // Update save button state based on current conditions
        if (typeof RealGameSave !== 'undefined' && RealGameSave.updateSaveButtonState) {
            RealGameSave.updateSaveButtonState();
        }
    }
    
    /**
     * Set the save button to retry state after a failed WRV
     */
    function setSaveButtonRetry() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (!saveBtn) return;
        
        var canEdit = getCanEdit();
        var takeoverDetected = isTakeoverDetected();
        var viewOtherFlight = isViewOtherFlight();
        
        if (canEdit && !takeoverDetected && !viewOtherFlight) {
            saveBtn.disabled = false;
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.opacity = '1';
            saveBtn.innerText = 'RETRY';
            saveBtn.style.background = '#2a1a1a';
            saveBtn.style.borderColor = '#ff4444';
            saveBtn.style.color = '#ff4444';
        }
        
        RealGameState.setSaveInProgress(false);
    }
    
    /**
     * Flash the save button to indicate success
     */
    function flashSaveButtonSuccess() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (!saveBtn) return;
        
        var originalBg = saveBtn.style.background;
        var originalColor = saveBtn.style.color;
        
        saveBtn.style.background = '#1a3a1a';
        saveBtn.style.borderColor = '#4caf50';
        saveBtn.style.color = '#4caf50';
        saveBtn.innerText = '✅ Saved!';
        
        setTimeout(function() {
            if (saveBtn) {
                var currentHole = getCurrentHole();
                saveBtn.innerText = 'SAVE H' + currentHole;
                saveBtn.style.background = originalBg || '#1a3a1a';
                saveBtn.style.color = originalColor || '#4caf50';
                saveBtn.style.borderColor = '#4caf50';
            }
        }, 800);
    }
    
    /**
     * Get the current save button status
     */
    function getSaveButtonStatus() {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (!saveBtn) return 'idle';
        
        if (saveBtn.disabled) {
            if (saveBtn.innerText.includes('SAVING') || saveBtn.innerText.includes('⏳')) {
                return 'saving';
            }
            return 'disabled';
        }
        
        if (saveBtn.innerText === 'RETRY') {
            return 'retry';
        }
        
        if (saveBtn.innerText.includes('✅')) {
            return 'success';
        }
        
        return 'idle';
    }
    
    // ============================================================
    // Helper Functions
    // ============================================================
    
    function getFlightOrderedPlayers(flight) {
        var allPlayers = getAllPlayers();
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        return teamA.concat(teamB);
    }
    
    function getCurrentDisplayFlight() {
        var editableFlight = getEditableFlight();
        if (isViewOtherFlight()) {
            return editableFlight === 1 ? 2 : 1;
        }
        return editableFlight;
    }
    
    function isCurrentDisplayEditable() {
        return !isViewOtherFlight() && getCanEdit() && !isTakeoverDetected() && !isGameComplete();
    }
    
    // ============================================================
    // Player Score Functions (used by render)
    // ============================================================
    
    function getStoredScore(player, hole) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) return 4;
        var flightDataStr = player.flight === 1 ? cache.f1DataString : cache.f2DataString;
        var holeData = typeof GameData !== 'undefined' ? GameData.parseHoleData(flightDataStr, hole) : null;
        if (!holeData || !holeData.saved) {
            var coursePar = getCoursePar();
            return coursePar[hole - 1] || 4;
        }
        
        var allPlayers = getAllPlayers();
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === player.flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        if (player.team === 'A') {
            if (teamA[0] && teamA[0].name === player.name) return holeData.scores.a1;
            if (teamA[1] && teamA[1].name === player.name) return holeData.scores.a2;
        } else {
            if (teamB[0] && teamB[0].name === player.name) return holeData.scores.b1;
            if (teamB[1] && teamB[1].name === player.name) return holeData.scores.b2;
        }
        var coursePar = getCoursePar();
        return coursePar[hole - 1] || 4;
    }
    
    function isHoleSaved(flight, hole) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) return false;
        return cache.savedHoles && cache.savedHoles[flight] && cache.savedHoles[flight].indexOf(hole) !== -1;
    }
    
    function getCurrentScore(player) {
        var currentHole = getCurrentHole();
        var key = player.flight + "_" + currentHole + "_" + player.name;
        var localChanges = getLocalChanges();
        if (localChanges[key] !== undefined) return localChanges[key];
        return getStoredScore(player, currentHole);
    }
    
    function getOpponentsForPlayer(player) {
        var allPlayers = getAllPlayers();
        if (typeof GameMatch !== 'undefined' && GameMatch.getAllOpponents) {
            return GameMatch.getAllOpponents(allPlayers, player);
        }
        var opponents = allPlayers.filter(function(op) { return op.team !== player.team; });
        opponents.sort(function(a, b) {
            var aIsIntra = (a.flight === player.flight);
            var bIsIntra = (b.flight === player.flight);
            if (aIsIntra && !bIsIntra) return -1;
            if (!aIsIntra && bIsIntra) return 1;
            return 0;
        });
        return opponents;
    }
    
    function getMatchValueForPlayer(player, opponent) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache || !cache.results) return 0;
        var currentHole = getCurrentHole();
        var allPlayers = getAllPlayers();
        if (typeof GameMatch !== 'undefined' && GameMatch.getMatchValueFromStoredResults) {
            return GameMatch.getMatchValueFromStoredResults(
                cache.results, player, opponent, currentHole, 
                RealGameUtils.getHolePosition, allPlayers
            );
        }
        return 0;
    }
    
    function getBubbleDisplayValue(player, opponent) {
        var matchValue = getMatchValueForPlayer(player, opponent);
        if (typeof GameMatch !== 'undefined' && GameMatch.getMatchDisplayValue) {
            return GameMatch.getMatchDisplayValue(matchValue);
        }
        var absValue = Math.abs(matchValue);
        if (absValue === 0) return 'AS';
        return absValue.toString();
    }
    
    // ============================================================
    // v1.05: FIXED - getBubbleClass with flight-specific lastSyncedValue
    // ============================================================
    
    function getBubbleClass(player, opponent) {
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) return 'bubble-grey';
        
        var currentHole = getCurrentHole();
        var matchValue = getMatchValueForPlayer(player, opponent);
        var clinchedAt = cache.clinchedAt || {};
        var isHoleSavedForFlight = isHoleSaved(player.flight, currentHole);
        var startingHole = getStartingHole();
        
        // v1.05: Calculate lastSyncedValue based on the flight being viewed
        var lastSyncedValue;
        if (player.flight === 1) {
            // Flight 1: use global lastSyncedPosition (preserves original behavior)
            lastSyncedValue = (cache.lastSyncedPosition !== undefined && cache.lastSyncedPosition >= 0) 
                ? cache.lastSyncedPosition 
                : -1;
            console.log(`[DEBUG-UI] F1 lastSyncedValue=${lastSyncedValue}`);
        } else {
            // Flight 2: calculate based on F2 saved holes
            var f2SavedHoles = cache.savedHoles && cache.savedHoles[2] ? cache.savedHoles[2] : [];
            if (f2SavedHoles.length === 0) {
                lastSyncedValue = -1;
                console.log(`[DEBUG-UI] F2: no saved holes, lastSyncedValue=-1`);
            } else {
                // Find the highest play position that is saved for F2
                var maxPos = -1;
                var playOrder = RealGameUtils.getPlayOrder();
                for (var i = 0; i < f2SavedHoles.length; i++) {
                    var hole = f2SavedHoles[i];
                    var pos = playOrder.indexOf(hole);
                    if (pos > maxPos) maxPos = pos;
                }
                lastSyncedValue = maxPos;
                console.log(`[DEBUG-UI] F2: ${f2SavedHoles.length} saved holes, lastSyncedValue=${lastSyncedValue}`);
            }
        }
        
        // Debug logging for cross-flight
        if (player.flight !== opponent.flight) {
            console.log(`[DEBUG-UI] getBubbleClass CROSS: ${player.label} vs ${opponent.label}, lastSyncedValue=${lastSyncedValue}, currentHole=${currentHole}`);
        }
        
        if (typeof GameMatch !== 'undefined' && GameMatch.getMatchBubbleClass) {
            // Use the original 9-parameter signature (no isOtherFlightHoleSaved)
            return GameMatch.getMatchBubbleClass(
                matchValue, clinchedAt, player, opponent, currentHole,
                isHoleSavedForFlight, lastSyncedValue, GameMatch.getClinchHole,
                startingHole
            );
        }
        
        // Fallback
        if (matchValue > 0) return 'bubble-green';
        if (matchValue < 0) return 'bubble-red';
        return 'bubble-green';
    }
    
    // ============================================================
    // updatePlayerNamesToShortform
    // ============================================================
    
    function updatePlayerNamesToShortform() {
        var allPlayers = getAllPlayers();
        var playerCards = document.querySelectorAll('.player-card');
        for (var i = 0; i < playerCards.length; i++) {
            var nameSpan = playerCards[i].querySelector('.player-name');
            if (nameSpan) {
                var originalName = nameSpan.innerText;
                var player = allPlayers.find(function(p) { return p.name === originalName; });
                if (player && player.label) {
                    nameSpan.innerText = player.label;
                }
            }
        }
    }
    
    // ============================================================
    // renderCompactHeaderWithFlightToggle
    // ============================================================
    
    function renderCompactHeaderWithFlightToggle() {
        var container = document.getElementById('compactHeaderContainer');
        if (!container) return;
        
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) return;
        
        var displayMode = typeof GameUI !== 'undefined' ? GameUI.getDisplayMode() : 'play';
        var pnText = displayMode === 'play' ? 'N' : 'P';
        
        var editableFlight = getEditableFlight();
        var currentHole = getCurrentHole();
        var viewOtherFlight = isViewOtherFlight();
        var canEdit = getCanEdit();
        var takeoverDetected = isTakeoverDetected();
        var isGameCompleteFlag = isGameComplete();
        
        var toggleButtonText = viewOtherFlight ? (editableFlight === 1 ? 'F1' : 'F2') : (editableFlight === 1 ? 'F2' : 'F1');
        var toggleButtonColor = viewOtherFlight ? '#4caf50' : '#ffaa44';
        var toggleButtonBg = '#1a3a1a';
        
        var saveButtonDisabled = viewOtherFlight || !canEdit || takeoverDetected || isGameCompleteFlag;
        var saveButtonText = saveButtonDisabled ? 'SAVE H' + currentHole : 'SAVE H' + currentHole;
        
        var html = `
            <div class="compact-header" style="display: flex; align-items: center; gap: 6px; margin-bottom: 15px; width: 100%; flex-wrap: wrap;">
                <button class="compact-pn-btn" id="compactPnBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer; flex-shrink: 0;">
                    ${pnText}
                </button>
                <button class="compact-flight-toggle-btn" id="compactFlightToggleBtn" style="background: ${toggleButtonBg}; border: 1px solid ${toggleButtonColor}; color: ${toggleButtonColor}; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer; flex-shrink: 0;">
                    ${toggleButtonText}
                </button>
                <button class="compact-save-btn" id="compactSaveBtn" style="flex: 1; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; height: 44px; font-size: 0.85rem; font-weight: 700; cursor: ${saveButtonDisabled ? 'not-allowed' : 'pointer'}; opacity: ${saveButtonDisabled ? '0.5' : '1'};" ${saveButtonDisabled ? 'disabled' : ''}>
                    ${saveButtonText}
                </button>
                <div class="compact-nav-group" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <button class="compact-prev-btn" id="compactPrevBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ◀
                    </button>
                    <span class="compact-hole-display" style="font-size: 1rem; font-weight: 700; color: #4caf50; min-width: 36px; text-align: center;">${currentHole}</span>
                    <button class="compact-next-btn" id="compactNextBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ▶
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attach event listeners
        var pnBtn = document.getElementById('compactPnBtn');
        if (pnBtn) {
            pnBtn.onclick = function() {
                var newMode = GameUI.getDisplayMode() === 'play' ? 'natural' : 'play';
                GameUI.setDisplayMode(newMode, null);
                if (typeof RealGameUI !== 'undefined' && RealGameUI.renderAll) {
                    RealGameUI.renderAll();
                }
            };
        }
        
        var flightToggleBtn = document.getElementById('compactFlightToggleBtn');
        if (flightToggleBtn) {
            flightToggleBtn.onclick = function() {
                RealGameState.setViewOtherFlight(!RealGameState.isViewOtherFlight());
                console.log(`[REAL-GAME] Toggle flight view: viewOtherFlight = ${RealGameState.isViewOtherFlight()}`);
                if (typeof RealGameUI !== 'undefined' && RealGameUI.renderAll) {
                    RealGameUI.renderAll();
                }
            };
        }
        
        var saveBtn = document.getElementById('compactSaveBtn');
        if (saveBtn && !saveButtonDisabled) {
            saveBtn.onclick = function() {
                if (window._saveHoleCallback) {
                    window._saveHoleCallback();
                }
            };
        }
        
        var prevBtn = document.getElementById('compactPrevBtn');
        if (prevBtn) {
            prevBtn.onclick = function() {
                if (window._prevHoleCallback) {
                    window._prevHoleCallback();
                }
            };
        }
        
        var nextBtn = document.getElementById('compactNextBtn');
        if (nextBtn) {
            nextBtn.onclick = function() {
                if (isGameComplete() && !isCelebrationTriggered()) {
                    if (window._showCelebrationCallback) {
                        window._showCelebrationCallback();
                    }
                } else {
                    if (window._nextHoleCallback) {
                        window._nextHoleCallback();
                    }
                }
            };
        }
    }
    
    // ============================================================
    // renderAll - Main Render Function
    // ============================================================
    
    function renderAll() {
        var currentHole = getCurrentHole();
        var editableFlight = getEditableFlight();
        var viewOtherFlight = isViewOtherFlight();
        var coursePar = getCoursePar();
        var courseSi = getCourseSi();
        var allPlayers = getAllPlayers();
        var startingHole = getStartingHole();
        
        console.log(`[DEBUG-RENDER] renderAll called, currentHole=${currentHole}, editableFlight=${editableFlight}, viewOtherFlight=${viewOtherFlight}`);
        
        // Render control bar first
        renderCompactHeaderWithFlightToggle();
        
        var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
        if (!cache) return;
        
        var currentPar = coursePar[currentHole - 1];
        var currentSi = courseSi[currentHole - 1];
        var tr = typeof GameLoader !== 'undefined' ? GameLoader.getTRForHole(currentHole) : { teamA: 9.5, teamB: 9.5, teamAGreen: true, teamBGreen: true };
        
        if (typeof GameUI !== 'undefined') {
            GameUI.renderHoleHeader("holeHeader", currentHole, currentPar, currentSi);
            
            var displayTeamA = (tr.teamA !== null && tr.teamA !== undefined) ? tr.teamA : "-";
            var displayTeamB = (tr.teamB !== null && tr.teamB !== undefined) ? tr.teamB : "-";
            var displayTeamAGreen = (tr.teamA !== null && tr.teamA !== undefined) ? tr.teamAGreen : false;
            var displayTeamBGreen = (tr.teamB !== null && tr.teamB !== undefined) ? tr.teamBGreen : false;
            
            GameUI.updateTR("trDisplay", displayTeamA, displayTeamB, displayTeamAGreen, displayTeamBGreen);
        }
        
        var displayFlight = getCurrentDisplayFlight();
        var canEditLocal = isCurrentDisplayEditable();
        var currentPlayers = getFlightOrderedPlayers(displayFlight);
        
        // Check lock ownership if not viewing other flight
        var stillOwnsLock = true;
        if (!viewOtherFlight) {
            if (typeof RealGameInit !== 'undefined' && RealGameInit.checkLockOwnership) {
                stillOwnsLock = RealGameInit.checkLockOwnership();
                canEditLocal = canEditLocal && stillOwnsLock;
            }
        }
        
        // Render player cards with callbacks
        if (typeof GameUI !== 'undefined') {
            GameUI.renderPlayerCards(
                "playerCards", 
                currentPlayers, 
                getOpponentsForPlayer, 
                getBubbleClass, 
                getBubbleDisplayValue, 
                getCurrentScore, 
                canEditLocal,
                function(playerName, flight, delta) {
                    if (isGameComplete()) return;
                    if (isTakeoverDetected()) return;
                    if (!getCanEdit()) return;
                    if (isViewOtherFlight()) return;
                    
                    var allPlayers = getAllPlayers();
                    var player = allPlayers.find(function(p) { return p.name === playerName && p.flight === flight; });
                    if (!player) return;
                    var current = getCurrentScore(player);
                    var newScore = Math.max(1, Math.min(99, current + delta));
                    var key = flight + "_" + currentHole + "_" + player.name;
                    var localChanges = getLocalChanges();
                    localChanges[key] = newScore;
                    renderAll();
                }
            );
        }
        
        updatePlayerNamesToShortform();
        
        // Update flight badge
        if (typeof GameUI !== 'undefined') {
            if (viewOtherFlight) {
                GameUI.updateFlightBadge(displayFlight);
                var badge = document.querySelector('.flight-badge');
                if (badge) {
                    badge.style.borderColor = '#ffaa44';
                    badge.style.color = '#ffaa44';
                }
            } else {
                GameUI.updateFlightBadge(editableFlight);
                var badge = document.querySelector('.flight-badge');
                if (badge) {
                    badge.style.borderColor = '#4caf50';
                    badge.style.color = '#4caf50';
                }
            }
        }
        
        // Render scorecard
        var displayMode = typeof GameUI !== 'undefined' ? GameUI.getDisplayMode() : 'play';
        
        var t1ClinchedHole = cache.results?.game2?.flight1?.clinchedHole;
        var t2ClinchedHole = cache.results?.game2?.flight2?.clinchedHole;
        var t1Display = cache.results?.game2?.displayT1 || null;
        var t2Display = cache.results?.game2?.displayT2 || null;
        var strkDisplay = cache.results?.game3?.displayStrk || null;
        var displayT1Row = cache.results?.game2?.displayT1 || cache.t1Row;
        var displayT2Row = cache.results?.game2?.displayT2 || cache.t2Row;
        var displayStrkRow = cache.results?.game3?.displayStrk || cache.strkRow;
        
        if (typeof GameScorecard !== 'undefined' && GameScorecard.renderScorecard) {
            GameScorecard.renderScorecard(
                "scorecardWrapper",
                displayMode,
                startingHole,
                allPlayers,
                getStoredScore,
                isHoleSaved,
                displayT1Row,
                displayT2Row,
                displayStrkRow,
                coursePar,
                courseSi,
                t1ClinchedHole,
                t2ClinchedHole,
                t1Display,
                t2Display,
                strkDisplay
            );
        }
        
        // Update navigation buttons
        var playOrder = RealGameUtils.getPlayOrder();
        var isCurrentSaved = false;
        if (!viewOtherFlight) {
            isCurrentSaved = isHoleSaved(editableFlight, currentHole) && 
                Object.keys(getLocalChanges()).filter(function(key) { 
                    return key.startsWith(editableFlight + "_" + currentHole + "_"); 
                }).length === 0;
        } else {
            isCurrentSaved = isHoleSaved(displayFlight, currentHole);
        }
        
        if (typeof GameUI !== 'undefined') {
            GameUI.updateNavigationButtons(
                currentHole, 
                playOrder, 
                isCurrentSaved, 
                isGameComplete(), 
                isCelebrationTriggered(), 
                window._showSignCardCallback || null
            );
        }
        
        if (typeof Ticker !== 'undefined') {
            Ticker.refresh();
        }
        
        if (typeof RealGameSave !== 'undefined' && RealGameSave.updateSaveButtonState) {
            RealGameSave.updateSaveButtonState();
        }
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        renderAll: renderAll,
        renderCompactHeaderWithFlightToggle: renderCompactHeaderWithFlightToggle,
        updatePlayerNamesToShortform: updatePlayerNamesToShortform,
        getFlightOrderedPlayers: getFlightOrderedPlayers,
        getCurrentDisplayFlight: getCurrentDisplayFlight,
        isCurrentDisplayEditable: isCurrentDisplayEditable,
        getStoredScore: getStoredScore,
        isHoleSaved: isHoleSaved,
        getCurrentScore: getCurrentScore,
        getOpponentsForPlayer: getOpponentsForPlayer,
        getMatchValueForPlayer: getMatchValueForPlayer,
        getBubbleDisplayValue: getBubbleDisplayValue,
        getBubbleClass: getBubbleClass,
        // v1.02: WRV Button Functions
        disableSaveButton: disableSaveButton,
        enableSaveButton: enableSaveButton,
        setSaveButtonRetry: setSaveButtonRetry,
        flashSaveButtonSuccess: flashSaveButtonSuccess,
        getSaveButtonStatus: getSaveButtonStatus
    };
    
})();

// Make available globally
window.RealGameUI = RealGameUI;

// Setup callbacks for control bar
window._saveHoleCallback = function() {
    if (typeof RealGameSave !== 'undefined' && RealGameSave.saveHole) {
        // Disable button before save (WRV will handle the rest)
        if (typeof RealGameUI !== 'undefined' && RealGameUI.disableSaveButton) {
            RealGameUI.disableSaveButton('⏳ Saving...');
        }
        
        RealGameSave.saveHole(null, function() {
            if (typeof RealGameUI !== 'undefined' && RealGameUI.renderAll) {
                RealGameUI.renderAll();
                // Re-enable button after render
                if (typeof RealGameUI !== 'undefined' && RealGameUI.enableSaveButton) {
                    RealGameUI.enableSaveButton();
                }
            }
        });
    }
};

window._prevHoleCallback = function() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.prevHole) {
        RealGameNav.prevHole();
    }
};

window._nextHoleCallback = function() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.nextHole) {
        RealGameNav.nextHole();
    }
};

window._showCelebrationCallback = function() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.showCelebrationAndHandicap) {
        RealGameNav.showCelebrationAndHandicap();
    }
};

window._showSignCardCallback = function() {
    if (typeof RealGameNav !== 'undefined' && RealGameNav.showSignCardModal) {
        RealGameNav.showSignCardModal();
    }
};

/*
FILE: js/real-game-ui.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - FIXED: getBubbleClass() now calculates lastSyncedValue based on the flight being viewed
   - CHANGED: Flight 1 uses global lastSyncedPosition (preserves original behavior)
   - CHANGED: Flight 2 calculates lastSyncedValue from F2's saved holes
   - FIXED: F2 cross-flight bubbles no longer 1 hole off (uses F2's own sync position)
   - REMOVED: isOtherFlightHoleSaved parameter (not needed for this fix)
   - PRESERVED: All v1.04 functionality unchanged
   - PRESERVED: WRV button state management unchanged
   - PRESERVED: All render functions unchanged
DEPENDS ON: RealGameState, RealGameUtils, GameUI, GameScorecard, GameLoader, GameMatch
STATUS: Ready for integration
*/