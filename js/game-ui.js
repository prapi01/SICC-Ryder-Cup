/*
FILE: js/game-ui.js
VERSION: 6.00
KEY CHANGES:
   - Gold text support for clinched T-1/T-2 rows
   - Complete fluid bubble CSS with all screen sizes
   - Scorecard green lines between sections
   - Tight, modern layout with proper spacing
   - All existing functions preserved
DEPENDS ON: None (pure display)
STATUS: Production Ready
*/

var GameUI = (function() {
    
    var tightLayoutApplied = false;
    var buttonStylesApplied = false;
    var backgroundFixed = false;
    var currentFlight = 1;
    var currentDisplayMode = "play";
    var currentHoleNumber = 1;
    
    var eventCallbacks = {
        onSave: null,
        onMenu: null,
        onPrevHole: null,
        onNextHole: null,
        onToggleFlight: null,
        onToggleDisplay: null,
        onSignCard: null
    };
    
    function fixBackground() {
        if (backgroundFixed) return;
        var htmlElem = document.documentElement;
        htmlElem.style.margin = '0';
        htmlElem.style.padding = '0';
        htmlElem.style.backgroundColor = '#000000';
        htmlElem.style.minHeight = '100vh';
        document.body.style.margin = '0';
        document.body.style.padding = '20px';
        document.body.style.backgroundColor = '#000000';
        document.body.style.minHeight = '100vh';
        var viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            var content = viewport.getAttribute('content');
            if (content && !content.includes('viewport-fit=cover')) {
                viewport.setAttribute('content', content + ', viewport-fit=cover');
            }
        }
        backgroundFixed = true;
    }
    
    function applyGlobalBubbleStyles() {
        if (document.getElementById('gameui-bubble-styles')) return;
        var style = document.createElement('style');
        style.id = 'gameui-bubble-styles';
        style.textContent = `
            .bubbles { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
            .bubble { flex: 1; text-align: center; padding: 6px 4px; border-radius: 24px; font-size: 0.7rem; font-weight: 600; }
            .bubble-green { background: #1a3a1a; color: #4caf50; border: 1px solid #4caf50; }
            .bubble-red { background: #3a1a1a; color: #ff6b6b; border: 1px solid #ff6b6b; }
            .bubble-grey { background: #2a2a2a; color: #888; border: 1px solid #444; }
            .bubble-gold { background: #1a3a1a; color: #ffaa44; border: 3px solid #ffaa44; font-weight: 800; }
            .bubble-loss-clinch { background: #3a1a1a; color: #ffffff; border: 3px solid #ffffff; font-weight: 800; }
            .score-gold { color: #ffaa44 !important; font-weight: 800 !important; }
            @media (min-width: 500px) { .bubble { font-size: 0.8rem; padding: 8px 6px; } .bubbles { gap: 10px; } }
        `;
        document.head.appendChild(style);
    }
    
    function makeStatusBubbleClickable() {
        var statusBubble = document.getElementById('statusBubble');
        if (!statusBubble) return;
        statusBubble.style.cursor = 'pointer';
        statusBubble.onclick = function() { location.reload(); };
    }
    
    function renderHoleHeader(containerId, currentHole, currentPar, currentSi) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `<div style="display:inline-block; background:#111; padding:6px 24px; border-radius:40px; font-size:1.4rem; font-weight:800;">HOLE ${currentHole}</div>`;
    }
    
    function updateHoleHeaderNumber(holeNumber) {
        currentHoleNumber = holeNumber;
        var header = document.getElementById('holeHeader');
        if (header) header.innerHTML = `<div style="display:inline-block; background:#111; padding:6px 24px; border-radius:40px; font-size:1.4rem; font-weight:800;">HOLE ${holeNumber}</div>`;
    }
    
    function updateHoleHeader(containerId, currentHole, currentPar, currentSi) {
        renderHoleHeader(containerId, currentHole, currentPar, currentSi);
    }
    
    function updateNavigationButtons(currentHole, playOrder, isCurrentSaved, isGameComplete, celebrationTriggered, onSignCardCallback) {
        var prevBtn = document.getElementById('compactPrevBtn');
        var nextBtn = document.getElementById('compactNextBtn');
        if (!prevBtn || !nextBtn) return;
        
        var currentIndex = playOrder.indexOf(currentHole);
        var isFirstHole = (currentIndex === 0);
        var isLastHole = (currentIndex === 17);
        
        prevBtn.disabled = isFirstHole;
        
        if (isGameComplete && !celebrationTriggered) {
            nextBtn.innerHTML = '🏆';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.style.border = '1px solid #ffaa44';
            nextBtn.disabled = false;
        } else if (isLastHole && isCurrentSaved) {
            nextBtn.innerHTML = '✍️';
            nextBtn.style.background = '#ffaa44';
            nextBtn.style.color = '#1a3a1a';
            nextBtn.style.border = '1px solid #ffaa44';
            nextBtn.disabled = false;
            if (onSignCardCallback) nextBtn.onclick = onSignCardCallback;
        } else {
            nextBtn.innerHTML = '▶';
            nextBtn.style.background = '#1a3a1a';
            nextBtn.style.color = '#4caf50';
            nextBtn.style.border = '1px solid #4caf50';
            nextBtn.disabled = !isCurrentSaved;
        }
    }
    
    function addFlightBadge(flightNumber) {
        var existingBadge = document.querySelector('.flight-badge');
        if (existingBadge) existingBadge.remove();
        var playerCards = document.getElementById('playerCards');
        if (!playerCards || playerCards.children.length === 0) return;
        var firstCard = playerCards.children[0];
        var badge = document.createElement('div');
        badge.className = 'flight-badge';
        badge.innerText = 'FLIGHT ' + flightNumber;
        badge.style.cssText = 'position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:#1a3a1a; border:2px solid #4caf50; color:#4caf50; font-size:0.8rem; font-weight:700; padding:4px 16px; border-radius:30px; z-index:100; white-space:nowrap;';
        firstCard.style.position = 'relative';
        firstCard.appendChild(badge);
        currentFlight = flightNumber;
    }
    
    function updateFlightBadge(flightNumber) {
        var badge = document.querySelector('.flight-badge');
        if (badge) badge.innerText = 'FLIGHT ' + flightNumber;
        else addFlightBadge(flightNumber);
        currentFlight = flightNumber;
    }
    
    function removeFlightBadge() { var badge = document.querySelector('.flight-badge'); if (badge) badge.remove(); }
    
    function tightenScorecardRows() {
        var table = document.querySelector('.scorecard-table');
        if (!table) return;
        table.querySelectorAll('tr').forEach(function(row) { row.style.lineHeight = '1.3'; });
        table.querySelectorAll('th, td').forEach(function(cell) { cell.style.padding = '8px 3px'; });
    }
    
    function renderCompactHeader(containerId, flightNumber, currentHole, onSave, onPrevHole, onNextHole, onToggleFlight, onToggleDisplay) {
        var container = document.getElementById(containerId);
        if (!container) return;
        if (onSave) eventCallbacks.onSave = onSave;
        if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole;
        if (onNextHole) eventCallbacks.onNextHole = onNextHole;
        if (onToggleFlight) eventCallbacks.onToggleFlight = onToggleFlight;
        
        currentFlight = flightNumber;
        currentHoleNumber = currentHole;
        var pnText = currentDisplayMode === 'play' ? 'P' : 'N';
        
        setTimeout(function() { addFlightBadge(flightNumber); }, 50);
        
        var html = `
            <div class="compact-header" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; margin-bottom: 16px;">
                <button class="compact-pn-btn" id="compactPnBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; border-radius:40px; min-width:52px; height:52px; padding:0 16px; font-size:1rem; font-weight:700; cursor:pointer;">
                    ${pnText}
                </button>
                <button class="compact-save-btn" id="compactSaveBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; border-radius:40px; height:52px; width:100%; font-size:1rem; font-weight:800; cursor:pointer;">
                    SAVE H${currentHole}
                </button>
                <div class="compact-nav-group" style="display: flex; gap: 8px;">
                    <button class="compact-prev-btn" id="compactPrevBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; width:52px; height:52px; border-radius:40px; font-size:1.3rem; cursor:pointer;">◀</button>
                    <span class="compact-hole-display" style="font-size:1.2rem; font-weight:700; color:#4caf50; min-width:44px; text-align:center;">${currentHole}</span>
                    <button class="compact-next-btn" id="compactNextBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; width:52px; height:52px; border-radius:40px; font-size:1.3rem; cursor:pointer;">▶</button>
                </div>
            </div>
        `;
        container.innerHTML = html;
        
        var pnBtn = document.getElementById('compactPnBtn');
        var saveBtn = document.getElementById('compactSaveBtn');
        if (pnBtn && onToggleDisplay) pnBtn.onclick = function() { var newMode = currentDisplayMode === 'play' ? 'natural' : 'play'; setDisplayMode(newMode, null); updateCompactPnButton(); if (onToggleDisplay) onToggleDisplay(newMode); };
        if (saveBtn && onSave) saveBtn.onclick = function() { if (eventCallbacks.onSave) eventCallbacks.onSave(); };
    }
    
    function updateCompactSaveButton(currentHole, isDisabled) {
        var saveBtn = document.getElementById('compactSaveBtn');
        if (saveBtn) { saveBtn.innerText = 'SAVE H' + currentHole; saveBtn.disabled = isDisabled; }
    }
    
    function updateCompactPnButton() {
        var pnBtn = document.getElementById('compactPnBtn');
        if (pnBtn) pnBtn.innerText = currentDisplayMode === 'play' ? 'P' : 'N';
    }
    
    function updateCompactHoleDisplay(holeNumber) {
        currentHoleNumber = holeNumber;
        var holeDisplay = document.querySelector('.compact-hole-display');
        if (holeDisplay) holeDisplay.innerText = holeNumber;
        updateCompactSaveButton(holeNumber, false);
    }
    
    function updateFlightToggleButton(flightNumber) { updateFlightBadge(flightNumber); }
    function toggleFlight() { var newFlight = currentFlight === 1 ? 2 : 1; currentFlight = newFlight; updateFlightBadge(currentFlight); if (eventCallbacks.onToggleFlight) eventCallbacks.onToggleFlight(currentFlight); }
    function getCurrentFlight() { return currentFlight; }
    
    function renderScorecard(containerId, holes, players, getStoredScore, isHoleSaved, t1Row, t2Row, strkRow, coursePar, courseSi, t1Clinched, t2Clinched) {
        var container = document.getElementById(containerId);
        if (!container) return;
        t1Clinched = t1Clinched || {};
        t2Clinched = t2Clinched || {};
        
        var flight1Players = players.filter(function(p) { return p.flight === 1; });
        var flight2Players = players.filter(function(p) { return p.flight === 2; });
        
        function sortFlightPlayers(flightPlayers) {
            var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
            return teamA.concat(teamB);
        }
        
        flight1Players = sortFlightPlayers(flight1Players);
        flight2Players = sortFlightPlayers(flight2Players);
        
        var html = '<table class="scorecard-table"><thead><tr><th>Hole</th>';
        for (var i = 0; i < holes.length; i++) html += '<th>' + holes[i] + '</th>';
        html += '<th>Tot</th></tr></thead><tbody>';
        
        html += '<tr class="par-row"><td style="font-weight:700;">Par</td>';
        var totalPar = 0;
        for (var i = 0; i < holes.length; i++) { var par = coursePar[holes[i] - 1]; totalPar += par; html += '<td>' + par + '</td>'; }
        html += '<td>' + totalPar + '</td></tr>';
        
        html += '<tr class="si-row"><td style="font-weight:700;">SI</td>';
        for (var i = 0; i < holes.length; i++) { var si = courseSi[holes[i] - 1]; html += '<td>' + si + '</td>'; }
        html += '<td>-</td></tr>';
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        for (var p = 0; p < flight1Players.length; p++) {
            var player = flight1Players[p];
            html += '<tr><td style="font-weight:600;">' + escapeHtml(player.label) + '</td>';
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '</td>';
            }
            html += '<td class="score-green">' + playerTotal + '</td></tr>';
        }
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-1</td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var position = holeNum - 1;
            var val = t1Row[position] || '_';
            var isSynced = (savedHoles && savedHoles[1] && savedHoles[2]) ? (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1) : false;
            var isClinched = t1Clinched[position] === true;
            var displayVal = '', cellClass = 'score-invisible';
            if (val === '0' || val === 0) { if (isSynced) { displayVal = 'AS'; cellClass = isClinched ? 'score-gold' : 'score-green'; } }
            else if (val === 'A' || val === 'B') { if (isSynced) { displayVal = val; cellClass = isClinched ? 'score-gold' : 'score-green'; } }
            else if (val && val !== '_') { if (isSynced) { displayVal = val; cellClass = isClinched ? 'score-gold' : 'score-green'; } }
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        for (var p = 0; p < flight2Players.length; p++) {
            var player = flight2Players[p];
            html += '<tr><td style="font-weight:600;">' + escapeHtml(player.label) + '</td>';
            var playerTotal = 0;
            for (var i = 0; i < holes.length; i++) {
                var hole = holes[i];
                var score = getStoredScore(player, hole);
                playerTotal += score;
                var saved = isHoleSaved(player.flight, hole);
                var cellClass = saved ? 'score-green' : 'score-invisible';
                html += '<td class="' + cellClass + '">' + score + '</td>';
            }
            html += '<td class="score-green">' + playerTotal + '</td></tr>';
        }
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        html += '<tr><td style="color:#4caf50; font-weight:600;">T-2</td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var position = holeNum - 1;
            var val = t2Row[position] || '_';
            var isSynced = (savedHoles && savedHoles[1] && savedHoles[2]) ? (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1) : false;
            var isClinched = t2Clinched[position] === true;
            var displayVal = '', cellClass = 'score-invisible';
            if (val === '0' || val === 0) { if (isSynced) { displayVal = 'AS'; cellClass = isClinched ? 'score-gold' : 'score-green'; } }
            else if (val === 'A' || val === 'B') { if (isSynced) { displayVal = val; cellClass = isClinched ? 'score-gold' : 'score-green'; } }
            else if (val && val !== '_') { if (isSynced) { displayVal = val; cellClass = isClinched ? 'score-gold' : 'score-green'; } }
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        html += '<tr class="green-line"><td colspan="20"></tr>';
        
        html += '<tr><td style="color:#4caf50; font-weight:600;">Strk</td>';
        for (var i = 0; i < holes.length; i++) {
            var holeNum = holes[i];
            var val = strkRow[holeNum - 1] || '_';
            var isSynced = (savedHoles && savedHoles[1] && savedHoles[2]) ? (savedHoles[1].indexOf(holeNum) !== -1 && savedHoles[2].indexOf(holeNum) !== -1) : false;
            var displayVal = '', cellClass = 'score-invisible';
            if (val === '0' || val === 0) { if (isSynced) { displayVal = 'AS'; cellClass = 'score-green'; } }
            else if (val === 'A' || val === 'B') { if (isSynced) { displayVal = val; cellClass = 'score-green'; } }
            else if (val && val !== '_') { if (isSynced) { displayVal = val; cellClass = 'score-green'; } }
            html += '<td class="' + cellClass + '">' + displayVal + '</td>';
        }
        html += '<td style="color:#4caf50;">-</td></tr>';
        
        html += '</tbody></table>';
        container.innerHTML = html;
        tightenScorecardRows();
    }
    
    function renderPlayerCards(containerId, players, getOpponents, getBubbleClass, getBubbleValue, getCurrentScore, canEdit, onScoreChange) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var html = '';
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var currentScore = getCurrentScore(player);
            var btnDisabled = !canEdit ? 'disabled' : '';
            var opponents = getOpponents(player);
            var bubblesHtml = '<div class="bubbles">';
            for (var j = 0; j < opponents.length; j++) {
                var opp = opponents[j];
                var bubbleClass = getBubbleClass(player, opp);
                var bubbleValue = getBubbleValue(player, opp);
                bubblesHtml += '<div class="bubble ' + bubbleClass + '">' + escapeHtml(opp.label) + ' ' + bubbleValue + '</div>';
            }
            bubblesHtml += '</div>';
            html += '<div class="player-card"><div class="player-header"><div><span class="player-name">' + escapeHtml(player.name) + '</span><span class="player-handicap">' + player.label + ' ' + player.handicap + '</span></div><div class="score-control">' +
                '<button class="score-btn dec-btn" ' + btnDisabled + ' data-delta="-1">-</button><span class="score-value">' + currentScore + '</span><button class="score-btn inc-btn" ' + btnDisabled + ' data-delta="1">+</button></div></div>' + bubblesHtml + '</div>';
        }
        container.innerHTML = html;
        if (canEdit && onScoreChange) {
            var playerCards = container.querySelectorAll('.player-card');
            for (var i = 0; i < playerCards.length; i++) {
                var card = playerCards[i];
                var playerName = card.getAttribute('data-player-name');
                var playerFlight = parseInt(card.getAttribute('data-player-flight'));
                var decBtn = card.querySelector('.dec-btn');
                var incBtn = card.querySelector('.inc-btn');
                if (decBtn) decBtn.onclick = (function(pName, pFlight) { return function() { onScoreChange(pName, pFlight, -1); }; })(playerName, playerFlight);
                if (incBtn) incBtn.onclick = (function(pName, pFlight) { return function() { onScoreChange(pName, pFlight, 1); }; })(playerName, playerFlight);
            }
        }
    }
    
    function updateTR(containerId, teamAPoints, teamBPoints, teamAGreen, teamBGreen) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var teamADisplay = teamAPoints % 1 === 0 ? teamAPoints : teamAPoints.toFixed(1);
        var teamBDisplay = teamBPoints % 1 === 0 ? teamBPoints : teamBPoints.toFixed(1);
        var isTie = (teamAPoints === teamBPoints);
        var teamAColor = (isTie || teamAGreen) ? '#4caf50' : '#ff6b6b';
        var teamBColor = (isTie || teamBGreen) ? '#4caf50' : '#ff6b6b';
        container.innerHTML = '<div style="text-align:center;"><div style="display:flex; justify-content:center; align-items:center; gap:16px;"><div style="text-align:center; min-width:100px;"><div style="font-size:0.85rem; font-weight:600; color:' + teamAColor + ';">TEAM A</div><div style="font-size:1.8rem; font-weight:800; color:' + teamAColor + ';">' + teamADisplay + '</div></div><div style="font-size:1.5rem; color:#888;">│</div><div style="text-align:center; min-width:100px;"><div style="font-size:0.85rem; font-weight:600; color:' + teamBColor + ';">TEAM B</div><div style="font-size:1.8rem; font-weight:800; color:' + teamBColor + ';">' + teamBDisplay + '</div></div></div></div>';
    }
    
    function updateFlightTab(containerId, flightNumber, canEdit) {
        var container = document.getElementById(containerId);
        if (container) container.innerHTML = 'Flight ' + flightNumber + (canEdit ? ' ✏️' : '');
    }
    
    function getDisplayMode() { var saved = localStorage.getItem("scorecardDisplay"); currentDisplayMode = (saved === "natural" || saved === "play") ? saved : "play"; return currentDisplayMode; }
    function updateToggleButtons(mode) { var playBtn = document.getElementById('playOrderBtn'); var naturalBtn = document.getElementById('naturalOrderBtn'); if (playBtn && naturalBtn) { if (mode === 'play') { playBtn.classList.add('active'); naturalBtn.classList.remove('active'); } else { playBtn.classList.remove('active'); naturalBtn.classList.add('active'); } } updateCompactPnButton(); }
    function setDisplayMode(mode, onModeChanged) { if (mode !== "play" && mode !== "natural") return; currentDisplayMode = mode; localStorage.setItem("scorecardDisplay", mode); updateToggleButtons(mode); updateCompactPnButton(); if (onModeChanged) onModeChanged(mode); if (eventCallbacks.onToggleDisplay) eventCallbacks.onToggleDisplay(mode); }
    function toggleDisplayMode() { setDisplayMode(currentDisplayMode === "play" ? "natural" : "play", null); }
    function getDisplayHoles(startingHole, preference) { if (preference === "natural") { var natural = []; for (var i = 1; i <= 18; i++) natural.push(i); return natural; } else { var playOrder = []; for (var i = startingHole; i <= 18; i++) playOrder.push(i); for (var i = 1; i < startingHole; i++) playOrder.push(i); return playOrder; } }
    
    function renderActionButtons(containerId, currentHole, isSaveDisabled, onSaveCallback) { if (onSaveCallback) eventCallbacks.onSave = onSaveCallback; var container = document.getElementById(containerId); if (container) container.style.display = 'none'; }
    function updateSaveButton(currentHole, isDisabled) { updateCompactSaveButton(currentHole, isDisabled); }
    function resetSaveButton(currentHole) { updateCompactSaveButton(currentHole, false); }
    
    function renderBottomMenu(containerId, onMenuCallback) {
        var container = document.getElementById(containerId);
        if (!container) return;
        if (onMenuCallback) eventCallbacks.onMenu = onMenuCallback;
        container.innerHTML = '<button id="menuBtn" style="width:100%; padding:14px; border-radius:40px; font-weight:600; cursor:pointer; background:#1a1a1a; color:#ccc; border:1px solid #333; margin-top:20px;">← Back to Main Menu</button>';
        document.getElementById('menuBtn').onclick = function() { if (eventCallbacks.onMenu) eventCallbacks.onMenu(); else if (onMenuCallback) onMenuCallback(); };
    }
    
    function getFlightOrderedPlayersShared(flight, allPlayers) { var flightPlayers = allPlayers.filter(function(p) { return p.flight === flight; }); var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; }); var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; }); return teamA.concat(teamB); }
    function getAllOpponentsShared(player, allPlayers) { return allPlayers.filter(function(op) { return op.team !== player.team; }).sort(function(a, b) { var aIntra = (a.flight === player.flight); var bIntra = (b.flight === player.flight); if (aIntra && !bIntra) return -1; if (!aIntra && bIntra) return 1; if (aIntra && bIntra) return a.handicap - b.handicap; return a.flight - b.flight; }); }
    
    function getMatchValueShared(player, opponent, holeNumber, resultsCache, allPlayers, getHolePositionFn) {
        if (!resultsCache || !resultsCache.matchResults) return 0;
        var position = getHolePositionFn(holeNumber);
        var matchArray = resultsCache.matchResults[position];
        if (!matchArray) return 0;
        var teamAPlayers = allPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamBPlayers = allPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var aIdx = -1, bIdx = -1;
        if (player.team === 'A') {
            for (var i = 0; i < teamAPlayers.length; i++) { if (teamAPlayers[i].name === player.name) aIdx = i; }
            for (var i = 0; i < teamBPlayers.length; i++) { if (teamBPlayers[i].name === opponent.name) bIdx = i; }
        } else {
            for (var i = 0; i < teamAPlayers.length; i++) { if (teamAPlayers[i].name === opponent.name) aIdx = i; }
            for (var i = 0; i < teamBPlayers.length; i++) { if (teamBPlayers[i].name === player.name) bIdx = i; }
        }
        if (aIdx === -1 || bIdx === -1) return 0;
        var matchIndex = aIdx * teamBPlayers.length + bIdx;
        var value = matchArray[matchIndex] || 0;
        return (player.team === 'B') ? -value : value;
    }
    
    function getBubbleClassShared(player, opponent, currentHole, resultsCache, allPlayers, isHoleSavedFn, getHolePositionFn, clinchedAtMap) {
        var matchValue = getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn);
        var isHoleSavedForFlight = isHoleSavedFn(player.flight, currentHole);
        if (!isHoleSavedForFlight) return 'bubble-grey';
        var clinchHole = null;
        if (clinchedAtMap) { var matchKey = player.name + "_vs_" + opponent.name; clinchHole = clinchedAtMap[matchKey]; }
        if (clinchHole && currentHole > clinchHole) return 'bubble-grey';
        if (clinchHole && currentHole === clinchHole) {
            if (matchValue > 0) return 'bubble-gold';
            if (matchValue < 0) return 'bubble-loss-clinch';
            return 'bubble-green';
        }
        if (matchValue > 0) return 'bubble-green';
        if (matchValue < 0) return 'bubble-red';
        return 'bubble-green';
    }
    
    function getBubbleValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn) {
        var matchValue = getMatchValueShared(player, opponent, currentHole, resultsCache, allPlayers, getHolePositionFn);
        var absValue = Math.abs(matchValue);
        if (absValue === 0) return 'AS';
        return absValue.toString();
    }
    
    function updateNavButtonsWithDisableLogic(isCurrentSaved, hasUnsavedChanges, isGameComplete, celebrationTriggered) {}
    function updateNextButtonForLastHole(currentHole, isLast, isCurrentSaved, onSignCardCallback) {}
    function setNextButtonToSignMode() { var nextBtn = document.getElementById('compactNextBtn'); if (nextBtn) { nextBtn.innerHTML = '✍️'; nextBtn.style.background = '#ffaa44'; nextBtn.style.color = '#1a3a1a'; nextBtn.disabled = false; } }
    function setNextButtonToSeeResults() { var nextBtn = document.getElementById('compactNextBtn'); if (nextBtn) { nextBtn.innerHTML = '🏆'; nextBtn.style.background = '#ffaa44'; nextBtn.style.color = '#1a3a1a'; nextBtn.disabled = false; } }
    function ensureNoStuckModals() { document.querySelectorAll('.modal-overlay').forEach(function(m) { m.remove(); }); }
    function attachGlobalEventListeners(onPrevHole, onNextHole) { if (onPrevHole) eventCallbacks.onPrevHole = onPrevHole; if (onNextHole) eventCallbacks.onNextHole = onNextHole; }
    
    function applyButtonStyles() {
        if (buttonStylesApplied) return;
        var style = document.createElement('style');
        style.id = 'gameui-button-styles';
        style.textContent = '.scorecard-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; } .scorecard-table { border-collapse: collapse; font-size: 0.7rem; min-width: 700px; } .scorecard-table th, .scorecard-table td { border: 1px solid #222; white-space: nowrap; } .scorecard-table th { color: #4caf50; background: #111; } .compact-prev-btn:disabled, .compact-next-btn:disabled { background: #2a2a2a !important; color: #666 !important; border-color: #444 !important; opacity: 0.6; cursor: not-allowed; } .compact-save-btn:disabled { background: #2a2a2a !important; color: #666 !important; border-color: #444 !important; opacity: 0.6; cursor: not-allowed; }';
        document.head.appendChild(style);
        buttonStylesApplied = true;
    }
    
    function applyTightLayout() {
        if (tightLayoutApplied) return;
        fixBackground();
        applyButtonStyles();
        applyGlobalBubbleStyles();
        var style = document.createElement('style');
        style.id = 'gameui-tight-layout';
        style.textContent = '#courseName { display: none !important; } .hole-par { display: none !important; } #flightTab { display: none !important; } .team-score-card { margin-top: 0 !important; margin-bottom: 8px !important; padding: 8px !important; } .container { padding-top: 30px !important; } .player-card { position: relative; }';
        document.head.appendChild(style);
        tightLayoutApplied = true;
    }
    
    function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); }
    
    return {
        renderScorecard: renderScorecard,
        renderPlayerCards: renderPlayerCards,
        updateTR: updateTR,
        updateHoleHeader: updateHoleHeader,
        renderHoleHeader: renderHoleHeader,
        updateHoleHeaderNumber: updateHoleHeaderNumber,
        updateFlightTab: updateFlightTab,
        renderCompactHeader: renderCompactHeader,
        updateCompactSaveButton: updateCompactSaveButton,
        updateCompactPnButton: updateCompactPnButton,
        updateCompactHoleDisplay: updateCompactHoleDisplay,
        addFlightBadge: addFlightBadge,
        updateFlightBadge: updateFlightBadge,
        removeFlightBadge: removeFlightBadge,
        updateNavigationButtons: updateNavigationButtons,
        updateFlightToggleButton: updateFlightBadge,
        updateFlightButtonText: updateFlightBadge,
        updatePnButtonText: updateCompactPnButton,
        getDisplayMode: getDisplayMode,
        setDisplayMode: setDisplayMode,
        updateToggleButtons: updateToggleButtons,
        toggleDisplayMode: toggleDisplayMode,
        getDisplayHoles: getDisplayHoles,
        toggleFlight: toggleFlight,
        getCurrentFlight: getCurrentFlight,
        renderActionButtons: renderActionButtons,
        updateSaveButton: updateSaveButton,
        resetSaveButton: resetSaveButton,
        renderBottomMenu: renderBottomMenu,
        getFlightOrderedPlayersShared: getFlightOrderedPlayersShared,
        getAllOpponentsShared: getAllOpponentsShared,
        getMatchValueShared: getMatchValueShared,
        getBubbleClassShared: getBubbleClassShared,
        getBubbleValueShared: getBubbleValueShared,
        updateNavButtonsWithDisableLogic: updateNavButtonsWithDisableLogic,
        updateNextButtonForLastHole: updateNextButtonForLastHole,
        setNextButtonToSignMode: setNextButtonToSignMode,
        setNextButtonToSeeResults: setNextButtonToSeeResults,
        ensureNoStuckModals: ensureNoStuckModals,
        attachGlobalEventListeners: attachGlobalEventListeners,
        applyButtonStyles: applyButtonStyles,
        applyTightLayout: applyTightLayout,
        tightenScorecardRows: tightenScorecardRows,
        makeStatusBubbleClickable: makeStatusBubbleClickable,
        fixBackground: fixBackground,
        addFlightIndicator: function() {},
        removeFlightIndicator: function() {},
        updateFlightIndicator: updateFlightBadge
    };
})();

window.GameUI = GameUI;
window.gameUI = GameUI;

/*
FILE: js/game-ui.js
VERSION: 6.00
STATUS: Production Ready
*/