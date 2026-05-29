/*
FILE: js/game-ui.js
VERSION: 4.05
KEY CHANGES:
   - FIXED: F2 scorecard right-shift bug - player names now display in column 0
   - FIXED: Loop structure for F2 rows now uses holeIndex starting at 0 for name column
   - FIXED: Scores now correctly align from column 1 onward (Hole 1)
   - ADDED: hideButtons parameter to renderPlayerCards() and renderSinglePlayerCard()
   - ADDED: Conditional button rendering - +/- buttons only when hideButtons === false
   - UPDATED: updateAllUI() and refreshUI() with hideButtons parameter
DEPENDS ON: None (pure display)
STATUS: Ready for integration
*/

// Global state
let currentGameData = null;
let currentScores = null;
let currentPlayers = null;
let currentTeamNames = { teamA: 'Team A', teamB: 'Team B' };
let currentDisplayMode = 'player'; // 'player', 'team', 'stroke'
let currentTR = { teamA: 0, teamB: 0 };
let clinchedData = null; // Store clinch information

/**
 * Set the clinch data for display
 * @param {Object} clinched - Clinch status object
 */
function setClinchedData(clinched) {
    clinchedData = clinched;
}

/**
 * Render the scorecard for the current game
 */
function renderScorecard() {
    if (!currentGameData || !currentScores || !currentPlayers) {
        console.warn('Missing data for scorecard rendering');
        return;
    }
    
    const container = document.getElementById('scorecard-container');
    if (!container) return;
    
    // Sort players by flight then name/label
    const flight1Players = currentPlayers.filter(p => p.flight === 'F1').sort((a, b) => a.name.localeCompare(b.name));
    const flight2Players = currentPlayers.filter(p => p.flight === 'F2').sort((a, b) => a.name.localeCompare(b.name));
    
    // Build scorecard HTML
    let html = '<div class="scorecard-wrapper"><table class="scorecard">';
    
    // Header row: Hole numbers and Par/SI
    html += '<thead><tr>';
    html += '<th class="player-name-col">Player</th>';
    for (let i = 1; i <= 18; i++) {
        html += `<th class="hole-col">${i}</th>`;
    }
    html += '</tr>';
    
    // Par row
    html += '<tr class="par-row">';
    html += '<td class="player-name-col">Par</td>';
    for (let i = 1; i <= 18; i++) {
        const par = currentGameData.course.holes[i-1].par;
        html += `<td class="hole-col">${par}</td>`;
    }
    html += '</tr>';
    
    // SI row
    html += '<tr class="si-row">';
    html += '<td class="player-name-col">SI</td>';
    for (let i = 1; i <= 18; i++) {
        const si = currentGameData.course.holes[i-1].si;
        html += `<td class="hole-col">${si}</td>`;
    }
    html += '</tr>';
    html += '</thead><tbody>';
    
    // Flight 1 players (4 rows)
    flight1Players.forEach(player => {
        html += '<tr class="flight1-row">';
        html += `<td class="player-name-col">${player.label || player.name}</td>`;
        for (let i = 1; i <= 18; i++) {
            const score = currentScores[player.id] && currentScores[player.id][i] ? currentScores[player.id][i] : '-';
            html += `<td class="hole-col">${score}</td>`;
        }
        html += '</tr>';
    });
    
    // Flight 2 players (4 rows) - FIXED: proper alignment starting with name column at index 0
    flight2Players.forEach(player => {
        html += '<tr class="flight2-row">';
        // Column 0: Player name
        html += `<td class="player-name-col">${player.label || player.name}</td>`;
        // Columns 1-18: Hole scores
        for (let i = 1; i <= 18; i++) {
            const score = currentScores[player.id] && currentScores[player.id][i] ? currentScores[player.id][i] : '-';
            html += `<td class="hole-col">${score}</td>`;
        }
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * Render player cards for the current game
 * @param {boolean} hideButtons - If true, hides +/- scoring buttons (for view mode)
 */
function renderPlayerCards(hideButtons = false) {
    if (!currentGameData || !currentPlayers) {
        console.warn('Missing data for player cards rendering');
        return;
    }
    
    const container = document.getElementById('player-cards-container');
    if (!container) return;
    
    // Sort players by flight then name/label
    const flight1Players = currentPlayers.filter(p => p.flight === 'F1').sort((a, b) => a.name.localeCompare(b.name));
    const flight2Players = currentPlayers.filter(p => p.flight === 'F2').sort((a, b) => a.name.localeCompare(b.name));
    
    let html = '<div class="player-cards-grid">';
    
    // Flight 1
    html += '<div class="flight-section"><h3>Flight 1</h3><div class="cards-container">';
    flight1Players.forEach(player => {
        html += renderSinglePlayerCard(player, hideButtons);
    });
    html += '</div></div>';
    
    // Flight 2
    html += '<div class="flight-section"><h3>Flight 2</h3><div class="cards-container">';
    flight2Players.forEach(player => {
        html += renderSinglePlayerCard(player, hideButtons);
    });
    html += '</div></div>';
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * Render a single player card
 * @param {Object} player - Player object
 * @param {boolean} hideButtons - If true, hides +/- scoring buttons
 */
function renderSinglePlayerCard(player, hideButtons = false) {
    const totalScore = calculateTotalScore(player.id);
    const isClinched = clinchedData && clinchedData[player.id];
    const clinchClass = isClinched ? 'clinched' : '';
    
    let html = `<div class="player-card ${clinchClass}" data-player-id="${player.id}">`;
    html += `<div class="player-info">`;
    html += `<div class="player-name">${player.label || player.name}</div>`;
    html += `<div class="player-flight">${player.flight}</div>`;
    html += `</div>`;
    html += `<div class="player-score">`;
    html += `<span class="total-label">Total</span>`;
    html += `<span class="total-value">${totalScore}</span>`;
    html += `</div>`;
    
    // Only show +/- buttons if hideButtons is false (scoring mode)
    if (!hideButtons) {
        html += `<div class="score-buttons">`;
        html += `<button class="score-btn minus" data-player="${player.id}" data-hole="current">-</button>`;
        html += `<button class="score-btn plus" data-player="${player.id}" data-hole="current">+</button>`;
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}

/**
 * Calculate total score for a player
 * @param {string} playerId - Player ID
 * @returns {number} Total score
 */
function calculateTotalScore(playerId) {
    if (!currentScores || !currentScores[playerId]) return 0;
    
    let total = 0;
    for (let i = 1; i <= 18; i++) {
        const score = currentScores[playerId][i];
        if (score && !isNaN(score)) {
            total += parseInt(score);
        }
    }
    return total;
}

/**
 * Update the TR (Team Result) display
 * @param {Object} tr - Team results {teamA, teamB}
 */
function updateTR(tr) {
    currentTR = tr;
    const container = document.getElementById('tr-display');
    if (!container) return;
    
    const teamAName = currentTeamNames.teamA || 'Team A';
    const teamBName = currentTeamNames.teamB || 'Team B';
    
    let html = '<div class="tr-container">';
    html += '<div class="tr-header">TEAM RESULT</div>';
    html += '<div class="tr-row">';
    html += `<div class="tr-team ${tr.teamA > tr.teamB ? 'winning' : (tr.teamA < tr.teamB ? 'losing' : 'tie')}">`;
    html += `<span class="team-name">${teamAName}</span>`;
    html += `<span class="team-score">${tr.teamA}</span>`;
    html += `</div>`;
    html += '<div class="tr-vs">VS</div>';
    html += `<div class="tr-team ${tr.teamB > tr.teamA ? 'winning' : (tr.teamB < tr.teamA ? 'losing' : 'tie')}">`;
    html += `<span class="team-name">${teamBName}</span>`;
    html += `<span class="team-score">${tr.teamB}</span>`;
    html += `</div>`;
    html += '</div>';
    html += '</div>';
    
    container.innerHTML = html;
}

/**
 * Update the hole header display
 * @param {number} currentHole - Current hole number (1-18)
 */
function updateHoleHeader(currentHole) {
    const container = document.getElementById('hole-header');
    if (!container || !currentGameData) return;
    
    const hole = currentGameData.course.holes[currentHole - 1];
    let html = '<div class="hole-header-container">';
    html += `<div class="hole-number">Hole ${currentHole}</div>`;
    html += `<div class="hole-details">Par ${hole.par} | SI ${hole.si}</div>`;
    html += '</div>';
    
    container.innerHTML = html;
}

/**
 * Render flight toggle buttons
 * @param {string} activeFlight - Currently active flight ('F1', 'F2', or 'all')
 */
function renderFlightToggles(activeFlight = 'all') {
    const container = document.getElementById('flight-toggles');
    if (!container) return;
    
    let html = '<div class="flight-toggle-container">';
    html += `<button class="flight-btn ${activeFlight === 'all' ? 'active' : ''}" data-flight="all">All Flights</button>`;
    html += `<button class="flight-btn ${activeFlight === 'F1' ? 'active' : ''}" data-flight="F1">Flight 1</button>`;
    html += `<button class="flight-btn ${activeFlight === 'F2' ? 'active' : ''}" data-flight="F2">Flight 2</button>`;
    html += '</div>';
    
    container.innerHTML = html;
}

/**
 * Render display mode buttons
 * @param {string} activeMode - Currently active mode ('player', 'team', 'stroke')
 */
function renderDisplayModes(activeMode = 'player') {
    const container = document.getElementById('display-mode-buttons');
    if (!container) return;
    
    let html = '<div class="display-mode-container">';
    html += `<button class="mode-btn ${activeMode === 'player' ? 'active' : ''}" data-mode="player">Player</button>`;
    html += `<button class="mode-btn ${activeMode === 'team' ? 'active' : ''}" data-mode="team">Team</button>`;
    html += `<button class="mode-btn ${activeMode === 'stroke' ? 'active' : ''}" data-mode="stroke">Stroke</button>`;
    html += '</div>';
    
    container.innerHTML = html;
}

/**
 * Update all UI components
 * @param {Object} gameData - Game data object
 * @param {Object} scores - Scores object
 * @param {Array} players - Players array
 * @param {Object} tr - Team results
 * @param {number} currentHole - Current hole number
 * @param {string} activeFlight - Active flight filter
 * @param {string} activeMode - Active display mode
 * @param {boolean} hideButtons - If true, hides +/- buttons (for view mode)
 */
function updateAllUI(gameData, scores, players, tr, currentHole, activeFlight = 'all', activeMode = 'player', hideButtons = false) {
    currentGameData = gameData;
    currentScores = scores;
    currentPlayers = players;
    currentTeamNames = {
        teamA: gameData.teamAName || 'Team A',
        teamB: gameData.teamBName || 'Team B'
    };
    currentDisplayMode = activeMode;
    
    updateTR(tr);
    updateHoleHeader(currentHole);
    renderFlightToggles(activeFlight);
    renderDisplayModes(activeMode);
    renderPlayerCards(hideButtons);
    renderScorecard();
}

/**
 * Set game data from external source
 * @param {Object} gameData - Game data object
 */
function setGameData(gameData) {
    currentGameData = gameData;
}

/**
 * Set scores data from external source
 * @param {Object} scores - Scores object
 */
function setScores(scores) {
    currentScores = scores;
}

/**
 * Set players data from external source
 * @param {Array} players - Players array
 */
function setPlayers(players) {
    currentPlayers = players;
}

/**
 * Set team names from external source
 * @param {string} teamAName - Team A name
 * @param {string} teamBName - Team B name
 */
function setTeamNames(teamAName, teamBName) {
    currentTeamNames = { teamA: teamAName, teamB: teamBName };
}

/**
 * Refresh all UI components with current data
 * @param {boolean} hideButtons - If true, hides +/- buttons
 */
function refreshUI(hideButtons = false) {
    if (!currentGameData || !currentScores || !currentPlayers) {
        console.warn('Missing data for UI refresh');
        return;
    }
    
    // Recalculate TR if needed (should be provided externally)
    renderPlayerCards(hideButtons);
    renderScorecard();
}

// Export functions for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setClinchedData,
        renderScorecard,
        renderPlayerCards,
        updateTR,
        updateHoleHeader,
        renderFlightToggles,
        renderDisplayModes,
        updateAllUI,
        setGameData,
        setScores,
        setPlayers,
        setTeamNames,
        refreshUI
    };
}

/*
FOOTER: js/game-ui.js
VERSION: 4.05
LAST UPDATED: 2026-05-29
COMPATIBLE WITH: real-game.html v4.07+, view-game.html v4.12+
NEXT STEPS: Update view-game.html to call updateAllUI() with hideButtons=true
*/