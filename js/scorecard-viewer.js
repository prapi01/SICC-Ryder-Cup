/*
FILE: js/scorecard-viewer.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - COMPLETE UI REWRITE: Matches real-game.html EXACT layout
   - Status bubble shows "VIEWER" (not LIVE)
   - NO score control buttons (+/-) - display only
   - Control bar: [P] button | [FLIGHT 1/2 toggle] | [◀] [Hole#] [▶]
   - Control bar positioned BELOW player cards, ABOVE scorecard
   - Flight badge on first player card
   - Version exposed via window.SCORECARD_VIEWER_VERSION for console debugging
DEPENDS ON: js/game-ui.js, js/game-scorecard.js, js/ticker.js
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.SCORECARD_VIEWER_VERSION = "1.01";

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
    
    function getBubbleClass(player, opponent) {
        var matchValue = getMatchValue(player, opponent, _currentHole);
        var results = _config.results;
        var clinchedAt = results ? (results.clinchedAt || {}) : {};
        var lastSyncedHole = _config.lastSyncedHole || 18;
        
        var matchKey1 = player.name + "_vs_" + opponent.name;
        var matchKey2 = opponent.name + "_vs_" + player.name;
        var clinchHole = clinchedAt[matchKey1] || clinchedAt[matchKey2];
        
        var isHoleSavedForFlight = isHoleSaved(player.flight, _currentHole);
        
        if (player.flight === opponent.flight) {
            if (!isHoleSavedForFlight) return 'bubble-grey';
        } else {
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
    // Green Square for AS
    // ============================================================
    
    function getAsSquareHtml() {
        if (typeof GameScorecard !== 'undefined' && GameScorecard.getAsSquareHtml) {
            return GameScorecard.getAsSquareHtml();
        }
        return '<span class="as-square"></span>';
    }
    
    // ============================================================
    // Player Card Rendering (NO +/- buttons - display only)
    // ============================================================
    
    function renderPlayerCards() {
        var container = document.getElementById('viewer-playerCards');
        if (!container) return;
        
        var players = getFlightOrderedPlayers();
        var html = '';
        
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var currentScore = getCurrentScore(player);
            var opponents = getAllOpponents(player);
            
            // Build bubbles HTML
            var bubblesHtml = '<div class="bubbles">';
            for (var j = 0; j < opponents.length; j++) {
                var opp = opponents[j];
                var bubbleClass = getBubbleClass(player, opp);
                var bubbleValue = getBubbleValue(player, opp);
                
                var displayValue = bubbleValue;
                if (displayValue === 'AS') {
                    displayValue = getAsSquareHtml();
                }
                
                bubblesHtml += '<div class="bubble ' + bubbleClass + '">' + escapeHtml(opp.label) + ' ' + displayValue + '</div>';
            }
            bubblesHtml += '</div>';
            
            // Player card - NO +/- buttons, just display score
            html += `
                <div class="player-card" data-player-name="${escapeHtml(player.name)}" data-player-flight="${player.flight}">
                    <div class="player-header">
                        <div>
                            <span class="player-name">${escapeHtml(player.label || player.name)}</span>
                            <span class="player-handicap">${player.handicap}</span>
                        </div>
                        <div class="score-value">${currentScore}</div>
                    </div>
                    ${bubblesHtml}
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Add flight badge to first card
        setTimeout(function() {
            var firstCard = document.querySelector('#viewer-playerCards .player-card');
            if (firstCard && !document.querySelector('.flight-badge')) {
                var badge = document.createElement('div');
                badge.className = 'flight-badge';
                badge.innerText = 'FLIGHT ' + _currentFlight;
                badge.style.cssText = 'position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:#1a3a1a; border:2px solid #4caf50; color:#4caf50; font-size:0.8rem; font-weight:700; padding:4px 16px; border-radius:30px; z-index:100; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.3);';
                firstCard.style.position = 'relative';
                firstCard.appendChild(badge);
            }
        }, 50);
    }
    
    // ============================================================
    // Render Functions
    // ============================================================
    
    function renderStatusBubble() {
        var bubble = document.getElementById('viewer-statusBubble');
        if (!bubble) return;
        
        // Always "VIEWER" for both live and history
        bubble.innerText = "VIEWER";
        bubble.style.color = "#4caf50";
        bubble.style.borderColor = "#4caf50";
        bubble.style.backgroundColor = "rgba(76,175,80,0.3)";
        bubble.style.cursor = "pointer";
        
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
    
    function renderHoleHeader() {
        var container = document.getElementById('viewer-holeHeader');
        if (!container) return;
        
        var currentPar = (_config.coursePar[_currentHole - 1] || 4);
        var currentSi = (_config.courseSi[_currentHole - 1] || 1);
        
        container.innerHTML = '<div style="display:inline-block; background:#111; padding:4px 20px; border-radius:40px; font-size:1.5rem; font-weight:800;">HOLE ' + _currentHole + '</div>';
    }
    
    function renderTR() {
        var container = document.getElementById('viewer-trDisplay');
        if (!container) return;
        
        var tr = getTRForHole(_currentHole);
        var teamADisplay = tr.teamA % 1 === 0 ? tr.teamA : tr.teamA.toFixed(1);
        var teamBDisplay = tr.teamB % 1 === 0 ? tr.teamB : tr.teamB.toFixed(1);
        var teamAColor = tr.teamA > tr.teamB ? '#4caf50' : (tr.teamA < tr.teamB ? '#ff6b6b' : '#4caf50');
        var teamBColor = tr.teamB > tr.teamA ? '#4caf50' : (tr.teamB < tr.teamA ? '#ff6b6b' : '#4caf50');
        
        container.innerHTML = '<div style="text-align:center;"><div style="display:flex; justify-content:center; align-items:center; gap:16px;">' +
            '<div><div style="font-size:0.85rem; font-weight:600; color:' + teamAColor + ';">TEAM A</div><div style="font-size:1.8rem; font-weight:800; color:' + teamAColor + ';">' + teamADisplay + '</div></div>' +
            '<div style="font-size:1.5rem; color:#888;">│</div>' +
            '<div><div style="font-size:0.85rem; font-weight:600; color:' + teamBColor + ';">TEAM B</div><div style="font-size:1.8rem; font-weight:800; color:' + teamBColor + ';">' + teamBDisplay + '</div></div>' +
        '</div></div>';
    }
    
    function renderControlBar() {
        var container = document.getElementById('viewer-compactHeaderContainer');
        if (!container) return;
        
        var pnText = _displayMode === 'play' ? 'P' : 'N';
        var flightText = _currentFlight === 1 ? 'FLIGHT 1' : 'FLIGHT 2';
        
        var html = `
            <div class="compact-header">
                <button class="compact-pn-btn" id="viewer-compactPnBtn">${pnText}</button>
                <button class="compact-flight-btn" id="viewer-compactFlightBtn">${flightText}</button>
                <div class="compact-nav-group">
                    <button class="compact-prev-btn" id="viewer-compactPrevBtn">◀</button>
                    <span class="compact-hole-display" id="viewer-compactHoleDisplay">${_currentHole}</span>
                    <button class="compact-next-btn" id="viewer-compactNextBtn">▶</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        document.getElementById('viewer-compactPnBtn').onclick = function() { toggleDisplayMode(); };
        document.getElementById('viewer-compactFlightBtn').onclick = function() { toggleFlight(); };
        document.getElementById('viewer-compactPrevBtn').onclick = function() { goToPrevHole(); };
        document.getElementById('viewer-compactNextBtn').onclick = function() { goToNextHole(); };
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
        }
    }
    
    function renderBottomMenu() {
        var container = document.getElementById('viewer-bottomMenuContainer');
        if (!container) return;
        
        container.innerHTML = '';
        var btn = document.createElement('button');
        btn.textContent = '← Back to Main Menu';
        btn.style.cssText = 'width:100%; padding:14px; border-radius:40px; font-weight:600; cursor:pointer; background:#1a1a1a; color:#ccc; border:1px solid #333; margin-top:20px;';
        btn.onclick = function() {
            if (_config.onExit) _config.onExit();
        };
        container.appendChild(btn);
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
        
        // Update navigation button states
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        var prevBtn = document.getElementById('viewer-compactPrevBtn');
        var nextBtn = document.getElementById('viewer-compactNextBtn');
        
        if (prevBtn) {
            prevBtn.disabled = (currentIndex === 0);
        }
        if (nextBtn) {
            nextBtn.disabled = (currentIndex === 17);
            nextBtn.innerHTML = '▶';
            nextBtn.style.background = '#1a3a1a';
            nextBtn.style.color = '#4caf50';
            nextBtn.style.border = '1px solid #4caf50';
        }
    }
    
    // ============================================================
    // Navigation Functions
    // ============================================================
    
    function goToPrevHole() {
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        if (currentIndex > 0) {
            _currentHole = playOrder[currentIndex - 1];
            var holeDisplay = document.getElementById('viewer-compactHoleDisplay');
            if (holeDisplay) holeDisplay.innerText = _currentHole;
            renderAll();
        }
    }
    
    function goToNextHole() {
        var playOrder = getPlayOrder();
        var currentIndex = playOrder.indexOf(_currentHole);
        if (currentIndex < 17) {
            _currentHole = playOrder[currentIndex + 1];
            var holeDisplay = document.getElementById('viewer-compactHoleDisplay');
            if (holeDisplay) holeDisplay.innerText = _currentHole;
            renderAll();
        }
    }
    
    function toggleFlight() {
        _currentFlight = _currentFlight === 1 ? 2 : 1;
        var flightBtn = document.getElementById('viewer-compactFlightBtn');
        if (flightBtn) {
            flightBtn.innerText = _currentFlight === 1 ? 'FLIGHT 1' : 'FLIGHT 2';
        }
        renderAll();
    }
    
    function toggleDisplayMode() {
        _displayMode = _displayMode === "play" ? "natural" : "play";
        var pnBtn = document.getElementById('viewer-compactPnBtn');
        if (pnBtn) {
            pnBtn.innerText = _displayMode === 'play' ? 'P' : 'N';
        }
        renderAll();
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
        
        // Determine starting hole
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
        
        // Build the HTML structure (matches real-game.html layout)
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
            <div id="viewer-holeHeader" style="text-align:center; margin-bottom:10px;"></div>
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
        
        // Apply bubble styles
        if (typeof GameUI !== 'undefined' && GameUI.applyGlobalBubbleStyles) {
            GameUI.applyGlobalBubbleStyles();
        } else {
            // Fallback: add bubble styles
            if (!document.getElementById('scorecard-viewer-bubble-styles')) {
                var style = document.createElement('style');
                style.id = 'scorecard-viewer-bubble-styles';
                style.textContent = `
                    .bubbles { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(4px, 1.5vw, 10px); margin-top: 10px; }
                    .bubble { white-space: nowrap; text-align: center; padding: clamp(3px, 1.2vh, 8px) clamp(2px, 1vw, 6px); border-radius: clamp(12px, 3vw, 24px); font-size: clamp(0.7rem, 3.8vw, 0.9rem); font-weight: 600; }
                    .bubble-green { background: #1a3a1a; color: #4caf50; border: 1px solid #4caf50; }
                    .bubble-red { background: #3a1a1a; color: #ff6b6b; border: 1px solid #ff6b6b; }
                    .bubble-grey { background: #2a2a2a; color: #888; border: 1px solid #444; }
                    .bubble-gold { background: #1a3a1a; color: #ffaa44; border: 2px solid #ffaa44; font-weight: 600; }
                    .bubble-loss-clinch { background: #3a1a1a; color: #ffffff; border: 2px solid #ffffff; font-weight: 600; }
                    .as-square { display: inline-block; width: 16px; height: 16px; background-color: #4caf50; border-radius: 3px; vertical-align: middle; margin-left: 4px; }
                `;
                document.head.appendChild(style);
            }
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
            var holeDisplay = document.getElementById('viewer-compactHoleDisplay');
            if (holeDisplay) holeDisplay.innerText = _currentHole;
            renderAll();
        }
    }
    
    function setFlight(flight) {
        if (flight === 1 || flight === 2) {
            _currentFlight = flight;
            var flightBtn = document.getElementById('viewer-compactFlightBtn');
            if (flightBtn) {
                flightBtn.innerText = _currentFlight === 1 ? 'FLIGHT 1' : 'FLIGHT 2';
            }
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
    // Helper
    // ============================================================
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
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
VERSION: 1.01
KEY CHANGES from v1.00:
   - COMPLETE UI REWRITE: Matches real-game.html EXACT layout
   - Status bubble shows "VIEWER" (not LIVE)
   - NO score control buttons (+/-) - display only
   - Control bar: [P] button | [FLIGHT 1/2 toggle] | [◀] [Hole#] [▶]
   - Control bar positioned BELOW player cards, ABOVE scorecard
   - Flight badge on first player card
   - Version exposed via window.SCORECARD_VIEWER_VERSION for console debugging
DEPENDS ON: js/game-ui.js, js/game-scorecard.js, js/ticker.js
STATUS: Ready for integration
*/