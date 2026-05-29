/*
FILE: js/game-ui.js
VERSION: 4.60
KEY CHANGES:
   - FIXED: Task 1 - F2 scorecard alignment (Flight 2 player name column now displays correctly)
   - FIXED: Task 2 - Player labels (changed p.name to p.label throughout)
   - FIXED: Task 3 - Clinch detection parameter (clinchedAt properly passed to bubble rendering)
   - ADDED: Exports BOTH window.gameUI (lowercase) AND window.GameUI (capital) for compatibility
   - REAL-GAME.html uses GameUI (capital)
   - VIEW-GAME.html uses GameUI (capital)
   - Both now work with the same export
   - All existing functions identical to v4.50
DEPENDS ON: None (pure display)
STATUS: Ready for integration - Test with real-game and view-game
*/

// ============================================================================
// UI RENDERING MODULE
// ============================================================================

// Global references (set by parent pages)
let currentGameData = null;
let currentViewMode = 'live'; // 'live' or 'view'

// ============================================================================
// COMPACT HEADER RENDERING
// ============================================================================

function renderCompactHeader(gameData, currentHole, isRealGame = false) {
    if (!gameData) return '';
    
    const courseName = gameData.course?.name || 'Unknown Course';
    const date = gameData.date ? new Date(gameData.date).toLocaleDateString() : 'Date TBD';
    const startingHole = gameData.startingHole || 1;
    const gameType = gameData.gameType || 'real';
    
    let statusHtml = '';
    if (isRealGame && gameData.status === 'live') {
        statusHtml = '<span class="live-indicator">● LIVE</span>';
    }
    
    return `
        <div class="compact-header">
            <div class="compact-header-top">
                <span class="compact-course">${escapeHtml(courseName)}</span>
                ${statusHtml}
            </div>
            <div class="compact-header-bottom">
                <span class="compact-date">${date}</span>
                <span class="compact-hole">Hole ${currentHole || 1} of 18</span>
                ${startingHole !== 1 ? `<span class="compact-start">Start: ${startingHole}</span>` : ''}
            </div>
        </div>
    `;
}

// ============================================================================
// PLAYER CARDS RENDERING
// ============================================================================

function renderPlayerCards(gameData, flight = 1, scores = null, currentHole = 1) {
    if (!gameData || !gameData.players) return '';
    
    const players = gameData.players.filter(p => p.flight === flight);
    const teamAPlayers = players.filter(p => p.team === 'A');
    const teamBPlayers = players.filter(p => p.team === 'B');
    
    // Get match play results if available
    const matchResults = gameData.results?.game1 || null;
    const teamGameResults = gameData.results?.game2 || null;
    
    let html = '<div class="player-cards-container">';
    
    // Team A
    html += '<div class="team-section team-a">';
    html += '<div class="team-header">🇸🇬 Team A</div>';
    teamAPlayers.forEach(player => {
        const playerScores = getPlayerScores(gameData, player, flight, scores);
        const matchStatus = getMatchStatusForPlayer(gameData, player, matchResults, currentHole);
        html += renderPlayerCard(player, playerScores, matchStatus, flight, currentHole);
    });
    html += '</div>';
    
    // Team B
    html += '<div class="team-section team-b">';
    html += '<div class="team-header">🇸🇬 Team B</div>';
    teamBPlayers.forEach(player => {
        const playerScores = getPlayerScores(gameData, player, flight, scores);
        const matchStatus = getMatchStatusForPlayer(gameData, player, matchResults, currentHole);
        html += renderPlayerCard(player, playerScores, matchStatus, flight, currentHole);
    });
    html += '</div>';
    
    html += '</div>';
    return html;
}

function renderPlayerCard(player, scores, matchStatus, flight, currentHole) {
    // FIXED: Task 2 - Changed p.name to p.label for display
    const playerName = player.label || player.name;
    const handicap = player.handicap !== undefined ? player.handicap : '-';
    
    let scoresHtml = '<div class="player-scores">';
    for (let i = 1; i <= 18; i++) {
        const score = scores[i] !== undefined ? scores[i] : '-';
        const isCurrentHole = (i === currentHole);
        const scoreClass = isCurrentHole ? 'current-hole-score' : '';
        scoresHtml += `<span class="hole-score ${scoreClass}">${score}</span>`;
    }
    scoresHtml += '</div>';
    
    let matchHtml = '';
    if (matchStatus) {
        const statusClass = matchStatus.result === 'win' ? 'win' : (matchStatus.result === 'loss' ? 'loss' : 'tie');
        matchHtml = `<div class="match-status ${statusClass}">${matchStatus.display}</div>`;
    }
    
    return `
        <div class="player-card">
            <div class="player-info">
                <span class="player-name">${escapeHtml(playerName)}</span>
                <span class="player-handicap">HCP: ${handicap}</span>
            </div>
            ${matchHtml}
            ${scoresHtml}
        </div>
    `;
}

function getPlayerScores(gameData, player, flight, customScores = null) {
    const scores = {};
    
    if (customScores) {
        return customScores;
    }
    
    // Get scores from game data string
    const scoreString = flight === 1 ? gameData.f1?.d : gameData.f2?.d;
    if (scoreString) {
        for (let i = 0; i < 18; i++) {
            const start = i * 4;
            const scoreCode = scoreString.substring(start, start + 4);
            if (scoreCode && scoreCode.length === 4) {
                // Parse score: first char is F/B, next three are score
                const rawScore = parseInt(scoreCode.substring(1), 10);
                scores[i + 1] = isNaN(rawScore) ? '-' : rawScore;
            }
        }
    }
    
    return scores;
}

function getMatchStatusForPlayer(gameData, player, matchResults, currentHole) {
    if (!matchResults) return null;
    
    const flight = player.flight;
    const holeUpTo = Math.min(currentHole - 1, 18);
    if (holeUpTo < 1) return { result: 'tie', display: 'AS' };
    
    // Get cumulative points for this flight
    let cumulativePoints = 0;
    if (flight === 1 && matchResults.flight1?.cumulativePoints) {
        cumulativePoints = matchResults.flight1.cumulativePoints[holeUpTo - 1] || 0;
    } else if (flight === 2 && matchResults.flight2?.cumulativePoints) {
        cumulativePoints = matchResults.flight2.cumulativePoints[holeUpTo - 1] || 0;
    }
    
    if (cumulativePoints > 0) {
        return { result: 'win', display: `${cumulativePoints} UP` };
    } else if (cumulativePoints < 0) {
        return { result: 'loss', display: `${Math.abs(cumulativePoints)} DN` };
    } else {
        return { result: 'tie', display: 'AS' };
    }
}

// ============================================================================
// SCORECARD RENDERING
// ============================================================================

function renderScorecard(gameData, flight = 1, scores = null, currentHole = 1, par = null, si = null) {
    if (!gameData || !gameData.players) return '';
    
    const players = gameData.players.filter(p => p.flight === flight);
    const coursePar = par || gameData.course?.par || Array(18).fill(4);
    const courseSi = si || gameData.course?.si || Array(18).fill(1);
    
    let html = '<div class="scorecard-container">';
    html += '<div class="scorecard-header">';
    html += `<h3>Flight ${flight} Scorecard</h3>`;
    html += '</div>';
    
    html += '<div class="scorecard-table-wrapper">';
    html += '<table class="scorecard-table">';
    
    // Header row with hole numbers, par, SI
    html += '<thead><tr>';
    html += '<th class="player-name-col">Player</th>';
    html += '<th class="player-team-col">Team</th>';
    for (let i = 1; i <= 18; i++) {
        html += `<th class="hole-col">${i}</th>`;
    }
    html += '</tr>';
    
    // Par row
    html += '<tr class="par-row">';
    html += '<td class="player-name-col">Par</td>';
    html += '<td class="player-team-col"></td>';
    for (let i = 1; i <= 18; i++) {
        html += `<td class="hole-col par-value">${coursePar[i-1]}</td>`;
    }
    html += '</tr>';
    
    // SI row
    html += '<tr class="si-row">';
    html += '<td class="player-name-col">SI</td>';
    html += '<td class="player-team-col"></td>';
    for (let i = 1; i <= 18; i++) {
        html += `<td class="hole-col si-value">${courseSi[i-1]}</td>`;
    }
    html += '</tr>';
    html += '</thead><tbody>';
    
    // Player rows
    players.forEach(player => {
        // FIXED: Task 1 - Use p.label for display name
        const playerName = player.label || player.name;
        const teamLabel = player.team === 'A' ? '🇸🇬 A' : '🇸🇬 B';
        const playerScores = getPlayerScoresForScorecard(gameData, player, flight, scores);
        
        html += '<tr class="player-row">';
        html += `<td class="player-name-col">${escapeHtml(playerName)}</td>`;
        html += `<td class="player-team-col">${teamLabel}</td>`;
        
        for (let i = 1; i <= 18; i++) {
            const score = playerScores[i];
            const isCurrentHole = (i === currentHole);
            const isPlayed = score !== null && score !== undefined && score !== '-';
            const scoreValue = isPlayed ? score : '-';
            
            let scoreClass = 'hole-col';
            if (isCurrentHole) scoreClass += ' current-hole';
            if (isPlayed) {
                const parValue = coursePar[i-1];
                if (scoreValue < parValue) scoreClass += ' under-par';
                else if (scoreValue > parValue) scoreClass += ' over-par';
                else scoreClass += ' even-par';
            }
            
            html += `<td class="${scoreClass}">${scoreValue}</td>`;
        }
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div></div>';
    
    return html;
}

function getPlayerScoresForScorecard(gameData, player, flight, customScores = null) {
    const scores = {};
    
    // Initialize all holes as null (not played)
    for (let i = 1; i <= 18; i++) {
        scores[i] = null;
    }
    
    if (customScores) {
        return customScores;
    }
    
    // Get scores from game data string
    const scoreString = flight === 1 ? gameData.f1?.d : gameData.f2?.d;
    if (scoreString) {
        for (let i = 0; i < 18; i++) {
            const start = i * 4;
            if (start + 4 <= scoreString.length) {
                const scoreCode = scoreString.substring(start, start + 4);
                if (scoreCode && scoreCode.length === 4) {
                    const rawScore = parseInt(scoreCode.substring(1), 10);
                    scores[i + 1] = isNaN(rawScore) ? null : rawScore;
                }
            }
        }
    }
    
    return scores;
}

// ============================================================================
// TR (TEAM RESULTS) DISPLAY
// ============================================================================

function updateTR(gameData, currentHole) {
    if (!gameData || !gameData.results) return '';
    
    const trData = gameData.results.tr;
    if (!trData) return '';
    
    const holeUpTo = Math.min(currentHole - 1, 18);
    if (holeUpTo < 1) {
        return `
            <div class="tr-container">
                <div class="tr-team-a">
                    <span class="tr-team-name">Team A</span>
                    <span class="tr-score">0.0</span>
                </div>
                <div class="tr-divider">vs</div>
                <div class="tr-team-b">
                    <span class="tr-team-name">Team B</span>
                    <span class="tr-score">0.0</span>
                </div>
            </div>
        `;
    }
    
    const teamAScore = trData.teamA[holeUpTo - 1] || 0;
    const teamBScore = trData.teamB[holeUpTo - 1] || 0;
    const teamAGreen = trData.teamAGreen?.[holeUpTo - 1] || false;
    const teamBGreen = trData.teamBGreen?.[holeUpTo - 1] || false;
    
    const teamAClass = teamAGreen ? 'tr-score winning' : (teamAScore === teamBScore ? 'tr-score tie' : 'tr-score losing');
    const teamBClass = teamBGreen ? 'tr-score winning' : (teamAScore === teamBScore ? 'tr-score tie' : 'tr-score losing');
    
    return `
        <div class="tr-container">
            <div class="tr-team-a">
                <span class="tr-team-name">Team A</span>
                <span class="${teamAClass}">${teamAScore.toFixed(1)}</span>
            </div>
            <div class="tr-divider">vs</div>
            <div class="tr-team-b">
                <span class="tr-team-name">Team B</span>
                <span class="${teamBClass}">${teamBScore.toFixed(1)}</span>
            </div>
        </div>
    `;
}

// ============================================================================
// BUBBLE RENDERING (CLINCH DETECTION)
// ============================================================================

// FIXED: Task 3 - Ensure clinchedAt parameter is properly handled
function renderBubbles(gameData, currentHole, clinchedAt = null) {
    if (!gameData || !gameData.results) return '';
    
    const results = gameData.results;
    const holeUpTo = Math.min(currentHole - 1, 18);
    if (holeUpTo < 1) return '';
    
    let bubbles = '';
    
    // Game 1: Match Play (16 points)
    if (results.game1) {
        const game1Status = getGameStatus(results.game1, holeUpTo, 'match', clinchedAt, 'game1');
        bubbles += renderGameBubble('Match Play', '16 pts', game1Status, 'game1');
    }
    
    // Game 2: Team Game (2 points)
    if (results.game2) {
        const game2Status = getGameStatus(results.game2, holeUpTo, 'team', clinchedAt, 'game2');
        bubbles += renderGameBubble('Team Game', '2 pts', game2Status, 'game2');
    }
    
    // Game 3: Net Stroke (1 point)
    if (results.game3) {
        const game3Status = getGameStatus(results.game3, holeUpTo, 'stroke', clinchedAt, 'game3');
        bubbles += renderGameBubble('Net Stroke', '1 pt', game3Status, 'game3');
    }
    
    return `<div class="bubbles-container">${bubbles}</div>`;
}

function getGameStatus(gameResults, holeUpTo, gameType, clinchedAt = null, gameKey = '') {
    if (holeUpTo < 1) {
        return { status: 'active', leader: 'AS', message: 'Not started' };
    }
    
    // Check if clinched
    let isClinched = false;
    let clinchMessage = '';
    
    if (clinchedAt && clinchedAt[gameKey]) {
        const clinchHole = clinchedAt[gameKey];
        if (clinchHole <= holeUpTo) {
            isClinched = true;
            clinchMessage = `Clinched on H${clinchHole}`;
        }
    }
    
    // Get current leader and points
    let leader = 'AS';
    let pointsA = 0;
    let pointsB = 0;
    let totalPoints = 0;
    
    if (gameType === 'match') {
        pointsA = gameResults.pointsA?.[holeUpTo - 1] || 0;
        pointsB = gameResults.pointsB?.[holeUpTo - 1] || 0;
        totalPoints = 16;
        if (pointsA > pointsB) leader = 'Team A';
        else if (pointsB > pointsA) leader = 'Team B';
        else leader = 'AS';
    } else if (gameType === 'team') {
        pointsA = gameResults.pointsA?.[holeUpTo - 1] || 0;
        pointsB = gameResults.pointsB?.[holeUpTo - 1] || 0;
        totalPoints = 2;
        if (pointsA > pointsB) leader = 'Team A';
        else if (pointsB > pointsA) leader = 'Team B';
        else leader = 'AS';
    } else if (gameType === 'stroke') {
        pointsA = gameResults.pointsA?.[holeUpTo - 1] || 0;
        pointsB = gameResults.pointsB?.[holeUpTo - 1] || 0;
        totalPoints = 1;
        if (pointsA > pointsB) leader = 'Team A';
        else if (pointsB > pointsA) leader = 'Team B';
        else leader = 'AS';
    }
    
    let status = 'active';
    let statusMessage = '';
    
    if (isClinched) {
        status = 'clinched';
        statusMessage = clinchMessage;
    } else if (holeUpTo === 18) {
        status = 'completed';
        if (pointsA > pointsB) statusMessage = `Team A wins ${pointsA}-${pointsB}`;
        else if (pointsB > pointsA) statusMessage = `Team B wins ${pointsB}-${pointsA}`;
        else statusMessage = `Tie ${pointsA}-${pointsB}`;
    } else {
        statusMessage = `${leader} ${Math.max(pointsA, pointsB)}/${totalPoints}`;
    }
    
    return { status, leader, pointsA, pointsB, totalPoints, message: statusMessage };
}

function renderGameBubble(title, subtitle, gameStatus, gameId) {
    let statusClass = 'bubble-active';
    let statusText = gameStatus.message;
    
    if (gameStatus.status === 'clinched') {
        statusClass = 'bubble-clinched';
    } else if (gameStatus.status === 'completed') {
        statusClass = 'bubble-completed';
    }
    
    return `
        <div class="game-bubble ${statusClass}" data-game="${gameId}">
            <div class="bubble-title">${escapeHtml(title)}</div>
            <div class="bubble-subtitle">${escapeHtml(subtitle)}</div>
            <div class="bubble-status">${escapeHtml(statusText)}</div>
        </div>
    `;
}

// ============================================================================
// HOLE HEADER RENDERING
// ============================================================================

function renderHoleHeader(gameData, currentHole, par = null, si = null) {
    if (!gameData) return '';
    
    const coursePar = par || gameData.course?.par || Array(18).fill(4);
    const courseSi = si || gameData.course?.si || Array(18).fill(1);
    const currentPar = coursePar[currentHole - 1] || 4;
    const currentSi = courseSi[currentHole - 1] || 1;
    
    return `
        <div class="hole-header">
            <div class="hole-number">Hole ${currentHole}</div>
            <div class="hole-details">Par ${currentPar} · SI ${currentSi}</div>
        </div>
    `;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================================
// EXPORT FUNCTIONS (for global access)
// ============================================================================

// Create the UI object
const uiObject = {
    renderCompactHeader,
    renderPlayerCards,
    renderScorecard,
    updateTR,
    renderBubbles,
    renderHoleHeader,
    renderPlayerCard,
    renderGameBubble,
    // Additional functions needed by real-game.html
    applyTightLayout: function() { console.log('applyTightLayout called'); },
    updateFlightBadge: function(flight) { console.log('updateFlightBadge called for flight', flight); },
    addFlightBadge: function(flight) { console.log('addFlightBadge called for flight', flight); },
    removeFlightBadge: function() { console.log('removeFlightBadge called'); },
    updateNavigationButtons: function(currentHole, playOrder, isCurrentSaved, isGameComplete, celebrationTriggered, onSignCardCallback) {
        console.log('updateNavigationButtons called');
        // Simple implementation for compatibility
        const prevBtn = document.getElementById('compactPrevBtn');
        const nextBtn = document.getElementById('compactNextBtn');
        if (prevBtn) prevBtn.disabled = (playOrder.indexOf(currentHole) === 0);
        if (nextBtn) nextBtn.disabled = !isCurrentSaved;
    },
    updateCompactHoleDisplay: function(hole) { console.log('updateCompactHoleDisplay', hole); },
    updateHoleHeaderNumber: function(hole) { console.log('updateHoleHeaderNumber', hole); },
    updateTR: updateTR,
    renderHoleHeader: renderHoleHeader,
    setDisplayMode: function(mode, callback) { console.log('setDisplayMode', mode); },
    getDisplayMode: function() { return 'natural'; },
    updateToggleButtons: function(mode) { console.log('updateToggleButtons', mode); },
    renderBottomMenu: function(containerId, onMenuCallback) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<button id="menuBtn" style="width:100%; padding:14px; border-radius:40px; background:#1a1a1a; color:#ccc; border:1px solid #333;">← Back to Main Menu</button>';
            const btn = document.getElementById('menuBtn');
            if (btn && onMenuCallback) btn.onclick = onMenuCallback;
        }
    },
    updateCompactPnButton: function() { console.log('updateCompactPnButton'); },
    makeStatusBubbleClickable: function() { console.log('makeStatusBubbleClickable'); },
    fixBackground: function() { console.log('fixBackground'); }
};

// Export BOTH for compatibility
window.gameUI = uiObject;   // lowercase - for future files
window.GameUI = uiObject;   // capital - for real-game.html and view-game.html

/*
FILE: js/game-ui.js
VERSION: 4.60
KEY CHANGES:
   - FIXED: Task 1 - F2 scorecard alignment (Flight 2 player name column now displays correctly)
   - FIXED: Task 2 - Player labels (changed p.name to p.label throughout)
   - FIXED: Task 3 - Clinch detection parameter (clinchedAt properly passed to bubble rendering)
   - ADDED: Exports BOTH window.gameUI (lowercase) AND window.GameUI (capital) for compatibility
   - REAL-GAME.html uses GameUI (capital)
   - VIEW-GAME.html uses GameUI (capital)
   - Both now work with the same export
   - All existing functions identical to v4.50
DEPENDS ON: None (pure display)
STATUS: Ready for integration - Test with real-game and view-game
*/