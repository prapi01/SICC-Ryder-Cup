/*
FILE: js/scorecard-viewer.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared component for hole-by-hole viewing (LIVE and HISTORY)
   - Provides EXACT same UI as real-game.html (except SAVE button replaced by FLIGHT toggle)
   - Supports ticker for both live (real-time) and history (final scores)
   - Uses GameUI and GameScorecard for all rendering
   - No Firebase dependencies - pure UI component
   - Configurable via init() with callbacks for data access
DEPENDS ON: js/game-ui.js, js/game-scorecard.js, js/ticker.js
STATUS: Ready for integration
*/

var ScorecardViewer = (function() {
    
    // ============================================================
    // Private State
    // ============================================================
    
    var _config = null;
    var _currentFlight = 1;
    var _currentHole = 1;
    var _displayMode = "play";  // "play" or "natural"
    var _isInitialized = false;
    var _containerElement = null;
    var _tickerInitialized = false;
    
    // Track if we're in history mode (static data, no updates)
    var _isHistoryMode = false;
    
    // ============================================================
    // Helper Functions (internal)
    // ============================================================
    
    function getPlayOrder() {
        var startingHole = _config.startingHole || 1;
        var order = [];
        for (var i = startingHole; i <= 18; i++) order.push(i);
        for (var i = 1; i < startingHole; i++) order.push(i);
        return order;
    }
    
    function getHolePosition(holeNumber) {
        var playOrder = getPlayOrder();
        for (var i = 0; i < playOrder.length; i++) {
            if (playOrder[i] === holeNumber) return i;
        }
        return holeNumber - 1;
    }
    
    function getDisplayHoles() {
        if (_displayMode === "natural") {
            var natural = [];
            for (var i = 1; i <= 18; i++) natural.push(i);
            return natural;
        } else {
            return getPlayOrder();
        }
    }
    
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
        return _config.coursePar[_currentHole - 1] || 4;
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
    
    function getBubbleClass(player, opponent) {
        var matchValue = getMatchValue(player, opponent, _currentHole);
        var results = _config.results;
        var clinchedAt = results ? (results.clinchedAt || {}) : {};
        var lastSyncedHole = _config.lastSyncedHole || 18;
        
        var matchKey1 = player.name + "_vs_" + opponent.name;
        var matchKey2 = opponent.name + "_vs_" + player.name;
        var clinchHole = clinchedAt[matchKey1] || clinchedAt[matchKey2];
        
        // Check if this flight has saved this hole
        var isHoleSavedForFlight = isHoleSaved(player.flight, _currentHole);
        
        if (player.flight === opponent.flight) {
            // Intra-flight: only need this flight's save status
            if (!isHoleSavedForFlight) return 'bubble-grey';
        } else {
            // Cross-flight: need both flights saved (synced)
            var isSynced = (lastSyncedHole >= _currentHole);
            if (!isSynced) return 'bubble-grey';
        }
        
        if (clinchHole && _currentHole > clinchHole) return 'bubble-grey';
        if (clinchHole && _currentHole === clinchHole) {
            if (matchValue > 0) return 'bubble-gold';
            if (matchValue < 0) return 'bubble-loss-clinch';
            return 'bubble-green';
        }
        
        if (matchValue > 0) return 'bubble-green';
        if (matchValue < 0) return 'bubble-red';
        return 'bubble-green';
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
    // Navigation Functions
    // ============================================================
    
    function goToPrevHole() {
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        if (currentIndex > 0) {
            _currentHole = playOrder[currentIndex - 1];
            updateHoleDisplay();
            renderAll();
        }
    }
    
    function goToNextHole() {
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        if (currentIndex < 17) {
            _currentHole = playOrder[currentIndex + 1];
            updateHoleDisplay();
            renderAll();
        }
    }
    
    function toggleFlight() {
        _currentFlight = _currentFlight === 1 ? 2 : 1;
        updateFlightButton();
        renderAll();
    }
    
    function toggleDisplayMode() {
        _displayMode = _displayMode === "play" ? "natural" : "play";
        updatePnButton();
        renderAll();
    }
    
    function updateHoleDisplay() {
        var holeDisplay = document.getElementById('viewer-compactHoleDisplay');
        if (holeDisplay) {
            holeDisplay.innerText = _currentHole;
        }
        if (typeof GameUI !== 'undefined' && GameUI.updateHoleHeaderNumber) {
            GameUI.updateHoleHeaderNumber(_currentHole);
        }
    }
    
    function updateFlightButton() {
        var flightBtn = document.getElementById('viewer-compactFlightBtn');
        if (flightBtn) {
            flightBtn.innerText = _currentFlight === 1 ? 'FLIGHT 1' : 'FLIGHT 2';
            if (_currentFlight === 1) {
                flightBtn.classList.add('active');
            } else {
                flightBtn.classList.remove('active');
            }
        }
        if (typeof GameUI !== 'undefined' && GameUI.updateFlightBadge) {
            GameUI.updateFlightBadge(_currentFlight);
        }
    }
    
    function updatePnButton() {
        var pnBtn = document.getElementById('viewer-compactPnBtn');
        if (pnBtn) {
            pnBtn.innerText = _displayMode === 'play' ? 'P' : 'N';
        }
    }
    
    // ============================================================
    // Render Functions
    // ============================================================
    
    function renderControlBar() {
        var container = document.getElementById('viewer-compactHeaderContainer');
        if (!container) return;
        
        var pnText = _displayMode === 'play' ? 'P' : 'N';
        var flightText = _currentFlight === 1 ? 'FLIGHT 1' : 'FLIGHT 2';
        var flightActiveClass = _currentFlight === 1 ? 'active' : '';
        
        var html = `
            <div class="compact-header">
                <button class="compact-pn-btn" id="viewer-compactPnBtn">${pnText}</button>
                <button class="compact-flight-btn ${flightActiveClass}" id="viewer-compactFlightBtn">${flightText}</button>
                <div class="compact-nav-group">
                    <button class="compact-prev-btn" id="viewer-compactPrevBtn">◀</button>
                    <span class="compact-hole-display" id="viewer-compactHoleDisplay">${_currentHole}</span>
                    <button class="compact-next-btn" id="viewer-compactNextBtn">▶</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        document.getElementById('viewer-compactPnBtn').onclick = toggleDisplayMode;
        document.getElementById('viewer-compactFlightBtn').onclick = toggleFlight;
        document.getElementById('viewer-compactPrevBtn').onclick = goToPrevHole;
        document.getElementById('viewer-compactNextBtn').onclick = goToNextHole;
    }
    
    function renderHeader() {
        var currentPar = _config.coursePar[_currentHole - 1] || 4;
        var currentSi = _config.courseSi[_currentHole - 1] || 1;
        
        if (typeof GameUI !== 'undefined' && GameUI.renderHoleHeader) {
            GameUI.renderHoleHeader("viewer-holeHeader", _currentHole, currentPar, currentSi);
        } else {
            var headerContainer = document.getElementById("viewer-holeHeader");
            if (headerContainer) {
                headerContainer.innerHTML = '<div style="display:inline-block; background:#111; padding:4px 20px; border-radius:40px; font-size:1.5rem; font-weight:800;">HOLE ' + _currentHole + '</div>';
            }
        }
    }
    
    function renderTR() {
        var tr = getTRForHole(_currentHole);
        if (typeof GameUI !== 'undefined' && GameUI.updateTR) {
            GameUI.updateTR("viewer-trDisplay", tr.teamA, tr.teamB, tr.teamAGreen, tr.teamBGreen);
        }
    }
    
    function renderPlayerCards() {
        var currentPlayers = getFlightOrderedPlayers();
        var canEdit = false;  // Viewer never has edit capability
        
        if (typeof GameUI !== 'undefined' && GameUI.renderPlayerCards) {
            GameUI.renderPlayerCards(
                "viewer-playerCards", 
                currentPlayers, 
                getAllOpponents, 
                getBubbleClass, 
                getBubbleValue, 
                getCurrentScore, 
                canEdit, 
                null  // No onScoreChange callback
            );
        }
        
        // Add flight badge
        setTimeout(function() {
            if (typeof GameUI !== 'undefined' && GameUI.updateFlightBadge) {
                GameUI.updateFlightBadge(_currentFlight);
            }
        }, 50);
    }
    
    function renderScorecard() {
        var holes = getDisplayHoles();
        var results = _config.results || {};
        
        var t1Row = results.game2?.flight1?.leader || new Array(18).fill('_');
        var t2Row = results.game2?.flight2?.leader || new Array(18).fill('_');
        var strkRow = results.game3?.leader || new Array(18).fill('_');
        
        var t1ClinchedHole = results.game2?.flight1?.clinchedHole || null;
        var t2ClinchedHole = results.game2?.flight2?.clinchedHole || null;
        var t1Display = results.game2?.displayT1 || null;
        var t2Display = results.game2?.displayT2 || null;
        var strkDisplay = results.game3?.displayStrk || null;
        
        if (typeof GameScorecard !== 'undefined' && GameScorecard.renderScorecard) {
            GameScorecard.renderScorecard(
                "viewer-scorecardWrapper", 
                holes, 
                _config.players, 
                _config.getStoredScore || function(p, h) { return _config.coursePar[h-1] || 4; },
                isHoleSaved,
                t1Row, t2Row, strkRow,
                _config.coursePar, _config.courseSi,
                t1ClinchedHole, t2ClinchedHole,
                t1Display, t2Display, strkDisplay
            );
        } else if (typeof GameUI !== 'undefined' && GameUI.renderScorecard) {
            GameUI.renderScorecard(
                "viewer-scorecardWrapper", 
                holes, 
                _config.players, 
                _config.getStoredScore || function(p, h) { return _config.coursePar[h-1] || 4; },
                isHoleSaved,
                t1Row, t2Row, strkRow,
                _config.coursePar, _config.courseSi,
                t1ClinchedHole, t2ClinchedHole,
                t1Display, t2Display, strkDisplay
            );
        }
    }
    
    function renderStatusBubble() {
        var bubble = document.getElementById('viewer-statusBubble');
        if (!bubble) return;
        
        var statusText = _config.statusText || (_isHistoryMode ? "HISTORY" : "LIVE");
        var statusColor = _config.statusColor || "#4caf50";
        
        bubble.innerText = statusText;
        bubble.style.color = statusColor;
        bubble.style.borderColor = statusColor;
        bubble.style.backgroundColor = "rgba(76,175,80,0.3)";
        
        bubble.onclick = function() {
            location.reload();
        };
    }
    
    function renderCourseName() {
        var courseNameEl = document.getElementById('viewer-courseName');
        if (courseNameEl && _config.courseName) {
            courseNameEl.innerHTML = _config.courseName;
        }
    }
    
    function renderBottomMenu() {
        if (typeof GameUI !== 'undefined' && GameUI.renderBottomMenu) {
            GameUI.renderBottomMenu("viewer-bottomMenuContainer", function() {
                if (_config.onExit) {
                    _config.onExit();
                }
            });
        } else {
            var container = document.getElementById('viewer-bottomMenuContainer');
            if (container && _config.onExit) {
                container.innerHTML = '';
                var btn = document.createElement('button');
                btn.textContent = '← Back to Main Menu';
                btn.style.cssText = 'width:100%; padding:14px; border-radius:40px; font-weight:600; cursor:pointer; background:#1a1a1a; color:#ccc; border:1px solid #333; margin-top:20px;';
                btn.onclick = _config.onExit;
                container.appendChild(btn);
            }
        }
    }
    
    function renderAll() {
        if (!_config) return;
        
        renderCourseName();
        renderStatusBubble();
        renderHeader();
        renderTR();
        renderPlayerCards();
        renderControlBar();
        renderScorecard();
        renderBottomMenu();
        
        // Update navigation buttons (simplified - no save/sign logic)
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        var prevBtn = document.getElementById('viewer-compactPrevBtn');
        var nextBtn = document.getElementById('viewer-compactNextBtn');
        
        if (prevBtn) {
            prevBtn.disabled = (currentIndex === 0);
        }
        if (nextBtn) {
            nextBtn.disabled = (currentIndex === 17);
            // Next button is always normal arrow (no sign/trophy in viewer)
            nextBtn.innerHTML = '▶';
            nextBtn.style.background = '#1a3a1a';
            nextBtn.style.color = '#4caf50';
            nextBtn.style.border = '1px solid #4caf50';
        }
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
        _isHistoryMode = config.isHistoryMode || false;
        _currentFlight = config.defaultFlight || 1;
        _displayMode = config.defaultDisplayMode || "play";
        
        // Determine starting hole
        if (config.defaultHole) {
            _currentHole = config.defaultHole;
        } else {
            // Auto-detect first unsaved hole for the default flight, or start at hole 1
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
        }
        
        // Build the HTML structure
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
            <div class="status-bubble" id="viewer-statusBubble">${config.statusText || (config.isHistoryMode ? "HISTORY" : "LIVE")}</div>
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
        
        // Apply tight layout if GameUI available
        if (typeof GameUI !== 'undefined' && GameUI.applyTightLayout) {
            GameUI.applyTightLayout();
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
            updateHoleDisplay();
            renderAll();
        }
    }
    
    function setFlight(flight) {
        if (flight === 1 || flight === 2) {
            _currentFlight = flight;
            updateFlightButton();
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
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared component for hole-by-hole viewing (LIVE and HISTORY)
   - Provides EXACT same UI as real-game.html (except SAVE button replaced by FLIGHT toggle)
   - Supports ticker for both live (real-time) and history (final scores)
   - Uses GameUI and GameScorecard for all rendering
   - No Firebase dependencies - pure UI component
   - Configurable via init() with callbacks for data access
DEPENDS ON: js/game-ui.js, js/game-scorecard.js, js/ticker.js
STATUS: Ready for integration
*/