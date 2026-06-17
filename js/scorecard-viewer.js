/*
FILE: js/scorecard-viewer.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - REFACTORED: Now uses GameOrder as the single source of truth for all order operations
   - REMOVED: Local getPlayOrder(), getPlayPositionForHole(), getHolePosition(), getDisplayHoles()
   - SIMPLIFIED: getSyncValueForBubble() now uses _config.lastSyncedPosition directly
   - SIMPLIFIED: getBubbleClass() now delegates to GameMatch.getMatchBubbleClass
   - UPDATED: renderScorecard() now uses GameScorecard.renderScorecard with new signature (displayMode, startingHole)
   - All existing functionality preserved
DEPENDS ON: js/game-order.js, js/game-match.js, js/game-ui.js, js/game-scorecard.js, js/ticker.js
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.SCORECARD_VIEWER_VERSION = "1.04";

var ScorecardViewer = (function() {
    
    // ============================================================
    // Private State
    // ============================================================
    
    var _config = null;
    var _currentFlight = 1;
    var _currentHole = 1;
    var _displayMode = "play";
    var _isInitialized = false;
    var _containerElement = null;
    var _tickerInitialized = false;
    
    // Store references to DOM elements created by GameUI
    var _elements = {
        statusBubble: null,
        courseName: null,
        holeHeader: null,
        trDisplay: null,
        playerCards: null,
        compactHeader: null,
        scorecardWrapper: null,
        bottomMenu: null
    };
    
    // ============================================================
    // v1.04: Pure delegates to GameOrder (no local implementations)
    // ============================================================
    
    function getPlayOrder() {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayOrder) {
            return GameOrder.getPlayOrder();
        }
        // Fallback (should never be needed if GameOrder is loaded)
        var startingHole = _config.startingHole || 1;
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    function getPlayPositionForHole(holeNumber) {
        if (typeof GameOrder !== 'undefined' && GameOrder.getPlayPosition) {
            return GameOrder.getPlayPosition(holeNumber);
        }
        // Fallback
        var playOrder = getPlayOrder();
        for (var i = 0; i < playOrder.length; i++) {
            if (playOrder[i] === holeNumber) return i;
        }
        return holeNumber - 1;
    }
    
    function getHolePosition(holeNumber) {
        return getPlayPositionForHole(holeNumber);
    }
    
    function getDisplayHoles() {
        if (typeof GameOrder !== 'undefined' && GameOrder.getDisplayHoles) {
            var mode = _displayMode || "play";
            return GameOrder.getDisplayHoles(mode);
        }
        // Fallback
        if (_displayMode === "natural") {
            var natural = [];
            for (var i = 1; i <= 18; i++) natural.push(i);
            return natural;
        }
        return getPlayOrder();
    }
    
    // ============================================================
    // v1.04: Simplified sync value - uses config directly
    // ============================================================
    
    function getSyncValueForBubble() {
        // Priority 1: Use lastSyncedPosition (play position) if available
        if (_config.lastSyncedPosition !== undefined && _config.lastSyncedPosition >= 0) {
            return _config.lastSyncedPosition;
        }
        
        // Priority 2: Fallback to lastSyncedHole (natural hole) converted to play position
        if (_config.lastSyncedHole !== undefined && _config.lastSyncedHole > 0) {
            var playPos = getPlayPositionForHole(_config.lastSyncedHole);
            return playPos;
        }
        
        // Priority 3: Default to -1 (no holes synced)
        return -1;
    }
    
    // ============================================================
    // v1.04: Delegates to GameMatch for bubble class
    // ============================================================
    
    function getBubbleClass(player, opponent) {
        var matchValue = getMatchValue(player, opponent, _currentHole);
        var results = _config.results;
        var clinchedAt = results ? (results.clinchedAt || {}) : {};
        
        // v1.04: Get sync value as play position (0-17)
        var lastSyncedValue = getSyncValueForBubble();
        var isHoleSavedForFlight = isHoleSaved(player.flight, _currentHole);
        var startingHole = _config.startingHole || 1;
        
        // Use GameMatch.getMatchBubbleClass if available (preferred)
        if (typeof GameMatch !== 'undefined' && GameMatch.getMatchBubbleClass) {
            return GameMatch.getMatchBubbleClass(
                matchValue, clinchedAt, player, opponent, _currentHole,
                isHoleSavedForFlight, lastSyncedValue, GameMatch.getClinchHole,
                startingHole
            );
        }
        
        // Fallback (simplified - should never be reached if GameMatch is loaded)
        if (matchValue > 0) return 'bubble-green';
        if (matchValue < 0) return 'bubble-red';
        return 'bubble-green';
    }
    
    // ============================================================
    // Helper Functions (data retrieval, no UI)
    // ============================================================
    
    function getFlightOrderedPlayers() {
        var flightPlayers = _config.players.filter(function(p) { return p.flight === _currentFlight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        return teamA.concat(teamB);
    }
    
    function getCurrentScore(player) {
        if (_config.getStoredScore) {
            return _config.getStoredScore(player, _currentHole);
        }
        return (_config.coursePar[_currentHole - 1] || 4);
    }
    
    function getAllOpponents(player) {
        var opponents = _config.players.filter(function(op) { return op.team !== player.team; });
        opponents.sort(function(a, b) {
            var aIsIntra = (a.flight === player.flight);
            var bIsIntra = (b.flight === player.flight);
            if (aIsIntra && !bIsIntra) return -1;
            if (!aIsIntra && bIsIntra) return 1;
            if (aIsIntra && bIsIntra) return a.handicap - b.handicap;
            return a.flight - b.flight;
        });
        return opponents;
    }
    
    function isHoleSaved(flight, hole) {
        if (_config.isHoleSaved) {
            return _config.isHoleSaved(flight, hole);
        }
        return false;
    }
    
    function getMatchValue(player, opponent, holeNumber) {
        var results = _config.results;
        if (!results || !results.matchResults) return 0;
        
        var position = getHolePosition(holeNumber);
        var matchResultsArray = results.matchResults[position];
        if (!matchResultsArray) return 0;
        
        var teamAPlayers = _config.players.filter(function(p) { return p.team === "A"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = _config.players.filter(function(p) { return p.team === "B"; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var aIdx = -1, bIdx = -1;
        if (player.team === "A") {
            for (var i = 0; i < teamAPlayers.length; i++) {
                if (teamAPlayers[i].name === player.name) aIdx = i;
            }
            for (var i = 0; i < teamBPlayers.length; i++) {
                if (teamBPlayers[i].name === opponent.name) bIdx = i;
            }
        } else {
            for (var i = 0; i < teamAPlayers.length; i++) {
                if (teamAPlayers[i].name === opponent.name) aIdx = i;
            }
            for (var i = 0; i < teamBPlayers.length; i++) {
                if (teamBPlayers[i].name === player.name) bIdx = i;
            }
        }
        
        if (aIdx === -1 || bIdx === -1) return 0;
        var storedValue = matchResultsArray[aIdx * teamBPlayers.length + bIdx] || 0;
        return (player.team === "B") ? -storedValue : storedValue;
    }
    
    function getBubbleValue(player, opponent) {
        var matchValue = getMatchValue(player, opponent, _currentHole);
        var absValue = Math.abs(matchValue);
        if (absValue === 0) return 'AS';
        return absValue.toString();
    }
    
    function getTRForHole(holeNumber) {
        var results = _config.results;
        if (!results || !results.tr) {
            return { teamA: 9.5, teamB: 9.5, teamAGreen: true, teamBGreen: true };
        }
        var position = getHolePosition(holeNumber);
        return {
            teamA: results.tr.teamA[position] !== undefined ? results.tr.teamA[position] : 9.5,
            teamB: results.tr.teamB[position] !== undefined ? results.tr.teamB[position] : 9.5,
            teamAGreen: results.tr.teamAGreen[position] !== undefined ? results.tr.teamAGreen[position] : true,
            teamBGreen: results.tr.teamBGreen[position] !== undefined ? results.tr.teamBGreen[position] : true
        };
    }
    
    // ============================================================
    // Navigation Functions (calls GameUI for updates)
    // ============================================================
    
    function goToPrevHole() {
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        if (currentIndex > 0) {
            _currentHole = playOrder[currentIndex - 1];
            renderAll();
        }
    }
    
    function goToNextHole() {
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        if (currentIndex < 17) {
            _currentHole = playOrder[currentIndex + 1];
            renderAll();
        }
    }
    
    function toggleFlight() {
        _currentFlight = _currentFlight === 1 ? 2 : 1;
        renderAll();
    }
    
    function toggleDisplayMode() {
        _displayMode = _displayMode === "play" ? "natural" : "play";
        renderAll();
    }
    
    // ============================================================
    // Render Functions (ALL use GameUI)
    // ============================================================
    
    function renderStatusBubble() {
        var bubble = document.getElementById('viewer-statusBubble');
        if (bubble) {
            bubble.innerText = "VIEWER";
            bubble.style.display = "inline-block";
            
            bubble.onclick = function() {
                location.reload();
            };
        }
    }
    
    function renderCourseName() {
        var courseNameEl = document.getElementById('viewer-courseName');
        if (courseNameEl && _config.courseName) {
            courseNameEl.innerHTML = _config.courseName;
        }
    }
    
    function renderHoleHeader() {
        var currentPar = (_config.coursePar[_currentHole - 1] || 4);
        var currentSi = (_config.courseSi[_currentHole - 1] || 1);
        
        if (typeof GameUI !== 'undefined' && GameUI.renderHoleHeader) {
            GameUI.renderHoleHeader("viewer-holeHeader", _currentHole, currentPar, currentSi);
        }
    }
    
    function renderTR() {
        var tr = getTRForHole(_currentHole);
        if (typeof GameUI !== 'undefined' && GameUI.updateTR) {
            GameUI.updateTR("viewer-trDisplay", tr.teamA, tr.teamB, tr.teamAGreen, tr.teamBGreen);
        }
    }
    
    function renderPlayerCards() {
        var players = getFlightOrderedPlayers();
        
        if (typeof GameUI !== 'undefined' && GameUI.renderPlayerCards) {
            GameUI.renderPlayerCards(
                "viewer-playerCards",
                players,
                getAllOpponents,
                getBubbleClass,
                getBubbleValue,
                getCurrentScore,
                false,  // canEdit = false - no score buttons
                null    // onScoreChange = null
            );
        }
        
        setTimeout(function() {
            if (typeof GameUI !== 'undefined' && GameUI.updateFlightBadge) {
                GameUI.updateFlightBadge(_currentFlight);
            }
        }, 50);
    }
    
    function renderControlBar() {
        if (typeof GameUI !== 'undefined' && GameUI.renderCompactHeader) {
            GameUI.renderCompactHeader(
                "viewer-compactHeaderContainer",
                _currentFlight,
                _currentHole,
                null,           // onSave = null (no save button)
                goToPrevHole,
                goToNextHole,
                toggleFlight,
                toggleDisplayMode
            );
        }
        
        setTimeout(function() {
            var saveBtn = document.getElementById('compactSaveBtn');
            if (saveBtn && saveBtn.parentNode) {
                var flightBtn = document.createElement('button');
                flightBtn.id = 'compactFlightBtn';
                flightBtn.className = 'compact-btn compact-flight-btn';
                flightBtn.innerText = _currentFlight === 1 ? 'FLIGHT 1' : 'FLIGHT 2';
                flightBtn.onclick = toggleFlight;
                flightBtn.style.cssText = saveBtn.style.cssText;
                flightBtn.style.flex = '1';
                flightBtn.style.width = '100%';
                saveBtn.parentNode.replaceChild(flightBtn, saveBtn);
            }
        }, 10);
    }
    
    function renderScorecard() {
        var results = _config.results || {};
        var startingHole = _config.startingHole || 1;
        
        var t1Row = results.game2?.flight1?.leader || new Array(18).fill('_');
        var t2Row = results.game2?.flight2?.leader || new Array(18).fill('_');
        var strkRow = results.game3?.leader || new Array(18).fill('_');
        
        var t1ClinchedHole = results.game2?.flight1?.clinchedHole || null;
        var t2ClinchedHole = results.game2?.flight2?.clinchedHole || null;
        var t1Display = results.game2?.displayT1 || null;
        var t2Display = results.game2?.displayT2 || null;
        var strkDisplay = results.game3?.displayStrk || null;
        
        // v1.04: Use new GameScorecard signature (displayMode, startingHole)
        if (typeof GameScorecard !== 'undefined' && GameScorecard.renderScorecard) {
            GameScorecard.renderScorecard(
                "viewer-scorecardWrapper",
                _displayMode,
                startingHole,
                _config.players,
                _config.getStoredScore || function(p, h) { return _config.coursePar[h-1] || 4; },
                isHoleSaved,
                t1Row, t2Row, strkRow,
                _config.coursePar, _config.courseSi,
                t1ClinchedHole, t2ClinchedHole,
                t1Display, t2Display, strkDisplay
            );
        } else {
            // Fallback to old signature if needed
            var holes = getDisplayHoles();
            if (typeof GameScorecard !== 'undefined' && GameScorecard.renderScorecard) {
                GameScorecard.renderScorecard(
                    "viewer-scorecardWrapper", holes, _config.players,
                    _config.getStoredScore || function(p, h) { return _config.coursePar[h-1] || 4; },
                    isHoleSaved,
                    t1Row, t2Row, strkRow,
                    _config.coursePar, _config.courseSi,
                    t1ClinchedHole, t2ClinchedHole,
                    t1Display, t2Display, strkDisplay
                );
            }
        }
    }
    
    function renderBottomMenu() {
        if (typeof GameUI !== 'undefined' && GameUI.renderBottomMenu) {
            GameUI.renderBottomMenu("viewer-bottomMenuContainer", function() {
                if (_config.onExit) _config.onExit();
            });
        }
    }
    
    function updateNavigationButtons() {
        var playOrder = getPlayOrder();
        var isCurrentSaved = isHoleSaved(_currentFlight, _currentHole);
        var isGameComplete = false;
        var celebrationTriggered = false;
        
        if (typeof GameUI !== 'undefined' && GameUI.updateNavigationButtons) {
            GameUI.updateNavigationButtons(
                _currentHole,
                playOrder,
                isCurrentSaved,
                isGameComplete,
                celebrationTriggered,
                null
            );
        }
    }
    
    function renderAll() {
        if (!_config) return;
        
        renderCourseName();
        renderStatusBubble();
        renderHoleHeader();
        renderTR();
        renderPlayerCards();
        renderControlBar();
        renderScorecard();
        renderBottomMenu();
        updateNavigationButtons();
    }
    
    // ============================================================
    // Ticker Initialization
    // ============================================================
    
    function initTicker() {
        if (!_config.enableTicker) return;
        if (!_config.getPlayerTotalScore) return;
        if (_tickerInitialized) return;
        
        if (typeof Ticker !== 'undefined') {
            Ticker.init('viewer-tickerContainer', 'viewer-tickerContent', _config.getPlayerTotalScore);
            Ticker.setPlayers(_config.players);
            _tickerInitialized = true;
        }
    }
    
    function refreshTicker() {
        if (_tickerInitialized && typeof Ticker !== 'undefined') {
            Ticker.refresh();
        }
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    function init(config) {
        if (!config) {
            console.error("ScorecardViewer: No configuration provided");
            return false;
        }
        
        if (!config.containerId) {
            console.error("ScorecardViewer: containerId is required");
            return false;
        }
        
        _containerElement = document.getElementById(config.containerId);
        if (!_containerElement) {
            console.error("ScorecardViewer: Container element not found:", config.containerId);
            return false;
        }
        
        // Validate required config
        if (!config.players || !config.players.length) {
            console.error("ScorecardViewer: players array is required");
            return false;
        }
        
        if (!config.coursePar || !config.coursePar.length) {
            console.error("ScorecardViewer: coursePar array is required");
            return false;
        }
        
        if (!config.courseSi || !config.courseSi.length) {
            console.error("ScorecardViewer: courseSi array is required");
            return false;
        }
        
        if (!config.getStoredScore) {
            console.error("ScorecardViewer: getStoredScore callback is required");
            return false;
        }
        
        if (!config.isHoleSaved) {
            console.error("ScorecardViewer: isHoleSaved callback is required");
            return false;
        }
        
        _config = config;
        _currentFlight = config.defaultFlight || 1;
        _displayMode = config.defaultDisplayMode || "play";
        _displayMode = GameUI.getDisplayMode ? GameUI.getDisplayMode() : _displayMode;
        
        // v1.04: Ensure GameOrder is initialized with starting hole
        if (typeof GameOrder !== 'undefined' && GameOrder.setStartingHole) {
            GameOrder.setStartingHole(_config.startingHole || 1);
        }
        
        // Determine starting hole (first unsaved hole for the default flight)
        var playOrder = getPlayOrder();
        _currentHole = playOrder[0];
        if (config.isHoleSaved) {
            for (var i = 0; i < playOrder.length; i++) {
                if (!config.isHoleSaved(_currentFlight, playOrder[i])) {
                    _currentHole = playOrder[i];
                    break;
                }
            }
        }
        
        // Build the HTML structure (minimal - GameUI will populate)
        var tickerHtml = '';
        if (config.enableTicker) {
            tickerHtml = `
                <div class="ticker-container" id="viewer-tickerContainer">
                    <div class="ticker-content" id="viewer-tickerContent">&nbsp;</div>
                </div>
            `;
        }
        
        var containerHtml = `
            ${tickerHtml}
            <div class="status-bubble" id="viewer-statusBubble">VIEWER</div>
            <div style="text-align:center; margin-bottom:8px;" id="viewer-courseName"></div>
            <div id="viewer-holeHeader"></div>
            <div id="viewer-trDisplay" class="team-score-card"></div>
            <div id="viewer-playerCards" class="player-cards"></div>
            <div class="scorecard-section">
                <div id="viewer-compactHeaderContainer"></div>
                <div class="scorecard-wrapper" id="viewer-scorecardWrapper"></div>
            </div>
            <div id="viewer-bottomMenuContainer"></div>
        `;
        
        _containerElement.innerHTML = containerHtml;
        
        // Apply GameUI layout functions
        if (typeof GameUI !== 'undefined') {
            if (GameUI.applyTightLayout) GameUI.applyTightLayout();
            if (GameUI.makeStatusBubbleClickable) GameUI.makeStatusBubbleClickable();
            if (GameUI.fixBackground) GameUI.fixBackground();
        }
        
        // Initialize ticker
        if (config.enableTicker && config.getPlayerTotalScore) {
            initTicker();
        }
        
        // Initial render
        renderAll();
        
        _isInitialized = true;
        return true;
    }
    
    function refresh() {
        if (!_isInitialized) return;
        renderAll();
        refreshTicker();
    }
    
    function setHole(holeNumber) {
        if (holeNumber >= 1 && holeNumber <= 18) {
            _currentHole = holeNumber;
            renderAll();
        }
    }
    
    function setFlight(flight) {
        if (flight === 1 || flight === 2) {
            _currentFlight = flight;
            renderAll();
        }
    }
    
    function getCurrentHole() {
        return _currentHole;
    }
    
    function getCurrentFlight() {
        return _currentFlight;
    }
    
    function destroy() {
        if (_containerElement) {
            _containerElement.innerHTML = '';
        }
        _config = null;
        _isInitialized = false;
        _tickerInitialized = false;
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        init: init,
        refresh: refresh,
        setHole: setHole,
        setFlight: setFlight,
        getCurrentHole: getCurrentHole,
        getCurrentFlight: getCurrentFlight,
        destroy: destroy
    };
    
})();

// Make available globally
window.ScorecardViewer = ScorecardViewer;

/*
FILE: js/scorecard-viewer.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - REFACTORED: Now uses GameOrder as the single source of truth for all order operations
   - REMOVED: Local getPlayOrder(), getPlayPositionForHole(), getHolePosition(), getDisplayHoles()
   - SIMPLIFIED: getSyncValueForBubble() now uses _config.lastSyncedPosition directly
   - SIMPLIFIED: getBubbleClass() now delegates to GameMatch.getMatchBubbleClass
   - UPDATED: renderScorecard() now uses GameScorecard.renderScorecard with new signature (displayMode, startingHole)
   - All existing functionality preserved
DEPENDS ON: js/game-order.js, js/game-match.js, js/game-ui.js, js/game-scorecard.js, js/ticker.js
STATUS: Ready for integration
*/