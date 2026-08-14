/*
FILE: js/tutorial-results.js
VERSION: 1.01
KEY CHANGES:
   - NEW: Isolated Step 5, 6 for results tutorial
   - Step 5: Match game with colored bubbles (unchanged from v1.22)
   - Step 6: Team game + stroke game with STABLE table structure (isolated, no editing issues)
   - Table now uses static HTML with proper cell classes (no complex editing)
   - Green separator lines preserved
   - All existing functionality preserved
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/

// ============================================================
// Helper: Create green square HTML for AS
// ============================================================

function getAsSquareHtml() {
    return '<span class="as-square"></span>';
}

// ============================================================
// Step 5: MATCH GAME - Player cards with bubbles
// ============================================================

function renderStep5(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction) {
    var html = `
        <div class="demo-header">
            <div style="margin-top:8px;"><span style="background:#111; padding:4px 20px; border-radius:40px; font-size:1rem; font-weight:800;">MATCH GAME - 16 points</span></div>
        </div>
        <div class="team-score-card">
            <div style="display:flex; justify-content:center; gap:16px;">
                <div><div style="font-size:0.85rem; font-weight:600; color:#4caf50;">TEAM A</div><div style="font-size:1.8rem; font-weight:800; color:#4caf50;">11.5</div></div>
                <div style="font-size:1.5rem; color:#888;">│</div>
                <div><div style="font-size:0.85rem; font-weight:600; color:#ff6b6b;">TEAM ONE</div><div style="font-size:1.8rem; font-weight:800; color:#ff6b6b;">7.5</div></div>
            </div>
            <div style="font-size:0.65rem; color:#888; margin-top:8px;">Total of 19 points</div>
        </div>
        
        <div class="player-card">
            <div class="player-header">
                <div><span class="player-name">Ang C H</span><span class="player-handicap">ACH 2</span></div>
                <div class="score-value">5</div>
            </div>
            <div class="bubbles">
                <div class="bubble bubble-green">vs OCB 1</div>
                <div class="bubble bubble-green">vs JO 2</div>
                <div class="bubble bubble-gold">vs JG 3</div>
                <div class="bubble bubble-white">vs P 2</div>
            </div>
        </div>
        
        <div class="player-card">
            <div class="player-header">
                <div><span class="player-name">Ong C B</span><span class="player-handicap">OCB 1</span></div>
                <div class="score-value">4</div>
            </div>
            <div class="bubbles">
                <div class="bubble bubble-red">vs ACH 1</div>
                <div class="bubble bubble-red">vs CK 2</div>
                <div class="bubble bubble-green">vs KF 1</div>
                <div class="bubble bubble-green">vs YHM 1</div>
            </div>
        </div>
        
        <div style="margin: 12px 16px; padding: 12px; background:#111; border-radius:12px;">
            <div style="font-size:0.8rem; color:#ffaa44; margin-bottom:8px;">🏆 MATCH GAME (16 points)</div>
            <div style="font-size:0.7rem; color:#ccc; line-height:1.5;">
                Each player plays 4 matches against the 4 opponents on the other team.<br>
                Each match worth 1 point → total 16 points.<br>
                The number shows how many holes the player is winning/losing by.<br>
                <strong><span class="as-square"></span></strong> = All Square (tied match).
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 5: Match Game (Bubbles)';
    if (instructionTextElement) {
        instructionTextElement.innerHTML = '<strong>MATCH GAME - Colored Bubbles (16 points)</strong><br><br>' +
            'Each player has 4 bubbles showing their match results against the 4 opponents:<br><br>' +
            '<span class="color-demo" style="background:#1a3a1a; color:#4caf50; border:1px solid #4caf50;">GREEN</span> Winning match (ahead)<br>' +
            '<span class="color-demo" style="background:#3a1a1a; color:#ff6b6b; border:1px solid #ff6b6b;">RED</span> Losing match (behind)<br>' +
            '<span class="color-demo" style="background:#1a3a1a; color:#ffaa44; border:2px solid #ffaa44;">GOLD</span> Won match on this hole<br>' +
            '<span class="color-demo" style="background:#3a1a1a; color:#ffffff; border:2px solid #ffffff;">WHITE</span> Lost match on this hole<br>' +
            '<span class="color-demo" style="background:#2a2a2a; color:#888; border:1px solid #444;">GREY</span> Match already won/lost<br><br>' +
            'The number shows how many holes the player is winning/losing by.<br>' +
            '<strong><span class="as-square"></span></strong> = All Square (tied match)';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '📌 GOLD/WHITE bubbles only appear on the hole where a match is mathematically won/lost. After that, the bubble turns GREY.';
    }
}

// ============================================================
// Step 6: TEAM GAME + STROKE GAME - FIXED TABLE (no editing issues)
// ============================================================

function renderStep6(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction) {
    // STABLE HTML TABLE - no complex editing, fully static and reliable
    var html = `
        <div class="demo-header">
            <div style="margin-top:8px;"><span style="background:#111; padding:4px 20px; border-radius:40px; font-size:1rem; font-weight:800;">TEAM & STROKE GAME - Hole 12</span></div>
        </div>
        <div class="team-score-card">
            <div style="display:flex; justify-content:center; gap:16px;">
                <div><div style="font-size:0.85rem; font-weight:600; color:#4caf50;">TEAM A</div><div style="font-size:1.8rem; font-weight:800; color:#4caf50;">11.5</div></div>
                <div style="font-size:1.5rem; color:#888;">│</div>
                <div><div style="font-size:0.85rem; font-weight:600; color:#ff6b6b;">TEAM ONE</div><div style="font-size:1.8rem; font-weight:800; color:#ff6b6b;">7.5</div></div>
            </div>
            <div style="font-size:0.65rem; color:#888; margin-top:8px;">Total of 19 points</div>
        </div>
        <div class="scorecard-section">
            <div class="scorecard-wrapper">
                <table class="scorecard-table">
                    <thead>
                        <tr><th>Hole</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>14</th><th>15</th><th>16</th><th>17</th><th>18</th><th>Tot</th></tr>
                    </thead>
                    <tbody>
                        <!-- Par Row -->
                        <tr style="background:#111;">
                            <td style="font-weight:700;">Par</td>
                            <td>4</td><td>3</td><td>4</td><td>5</td><td>3</td><td>4</td><td>4</td><td>4</td><td>3</td>
                            <td>4</td><td>5</td><td>4</td><td>3</td><td>4</td><td>4</td><td>5</td><td>3</td><td>5</td>
                            <td>-</td>
                        </tr>
                        <!-- SI Row -->
                        <tr style="background:#111;">
                            <td style="font-weight:700;">SI</td>
                            <td>13</td><td>15</td><td>7</td><td>3</td><td>17</td><td>1</td><td>5</td><td>11</td><td>9</td>
                            <td>14</td><td>2</td><td>8</td><td>6</td><td>16</td><td>10</td><td>4</td><td>18</td><td>12</td>
                            <td>-</td>
                        </tr>
                        <!-- Green Separator -->
                        <tr class="green-line"><td colspan="20"></tr>
                        <!-- ACH (Flight 1 Team A) -->
                        <tr><td style="font-weight:600;">ACH</td>
                            <td>4</td><td>3</td><td>5</td><td>6</td><td>3</td><td>5</td><td>4</td><td>5</td><td>4</td>
                            <td>4</td><td>5</td><td>4</td><td>3</td><td>4</td><td>5</td><td>6</td><td>3</td><td>5</td>
                            <td>77</td>
                        </tr>
                        <!-- CK (Flight 1 Team B) -->
                        <tr><td style="font-weight:600;">CK</td>
                            <td>5</td><td>4</td><td>4</td><td>6</td><td>4</td><td>5</td><td>5</td><td>4</td><td>4</td>
                            <td>4</td><td>5</td><td>5</td><td>4</td><td>5</td><td>5</td><td>6</td><td>4</td><td>6</td>
                            <td>85</td>
                        </tr>
                        <!-- Green Separator -->
                        <tr class="green-line"><td colspan="20"></tr>
                        <!-- T-1 Row (Flight 1 Team Game) -->
                        <tr style="background:rgba(76,175,80,0.15);">
                            <td style="color:#4caf50; font-weight:600;">T-1</td>
                            <td class="score-green">${getAsSquareHtml()}</td>
                            <td class="score-green">A1</td>
                            <td class="score-green">${getAsSquareHtml()}</td>
                            <td class="score-green">A1</td>
                            <td class="score-green">A2</td>
                            <td class="score-green">A3</td>
                            <td class="score-green">A4</td>
                            <td class="score-green">A5</td>
                            <td class="score-green">A6</td>
                            <td class="score-green">A6</td>
                            <td class="score-green">A7</td>
                            <td class="score-gold">A8</td>
                            <td class="score-grey">A8</td>
                            <td class="score-grey">A8</td>
                            <td class="score-grey">A8</td>
                            <td class="score-grey">A8</td>
                            <td class="score-grey">A8</td>
                            <td class="score-grey">A8</td>
                            <td>-</td>
                        </tr>
                        <!-- Green Separator -->
                        <tr class="green-line"><td colspan="20"></tr>
                        <!-- JG (Flight 2 Team A) -->
                        <tr><td style="font-weight:600;">JG</td>
                            <td>4</td><td>3</td><td>4</td><td>5</td><td>3</td><td>4</td><td>4</td><td>4</td><td>3</td>
                            <td>4</td><td>5</td><td>4</td><td>3</td><td>4</td><td>4</td><td>5</td><td>3</td><td>5</td>
                            <td>71</td>
                        </tr>
                        <!-- OCB (Flight 2 Team B) -->
                        <tr><td style="font-weight:600;">OCB</td>
                            <td>4</td><td>3</td><td>5</td><td>6</td><td>3</td><td>5</td><td>5</td><td>5</td><td>3</td>
                            <td>4</td><td>5</td><td>5</td><td>3</td><td>4</td><td>5</td><td>5</td><td>4</td><td>5</td>
                            <td>79</td>
                        </tr>
                        <!-- Green Separator -->
                        <tr class="green-line"><td colspan="20"></tr>
                        <!-- T-2 Row (Flight 2 Team Game) -->
                        <tr style="background:rgba(76,175,80,0.15);">
                            <td style="color:#4caf50; font-weight:600;">T-2</td>
                            <td class="score-green">O1</td>
                            <td class="score-green">O1</td>
                            <td class="score-green">${getAsSquareHtml()}</td>
                            <td class="score-green">A1</td>
                            <td class="score-green">A1</td>
                            <td class="score-green">A2</td>
                            <td class="score-green">A3</td>
                            <td class="score-green">A4</td>
                            <td class="score-green">A4</td>
                            <td class="score-green">A5</td>
                            <td class="score-green">A6</td>
                            <td class="score-gold">A7</td>
                            <td class="score-grey">A7</td>
                            <td class="score-grey">A7</td>
                            <td class="score-grey">A7</td>
                            <td class="score-grey">A7</td>
                            <td class="score-grey">A7</td>
                            <td class="score-grey">A7</td>
                            <td>-</td>
                        </tr>
                        <!-- Green Separator -->
                        <tr class="green-line"><td colspan="20"></tr>
                        <!-- Strk Row (Stroke Game) -->
                        <tr style="background:rgba(76,175,80,0.15);">
                            <td style="color:#4caf50; font-weight:600;">Strk</td>
                            <td class="score-green">A5</td>
                            <td class="score-green">A6</td>
                            <td class="score-green">A6</td>
                            <td class="score-green">A6</td>
                            <td class="score-green">A7</td>
                            <td class="score-green">A11</td>
                            <td class="score-green">A12</td>
                            <td class="score-green">A13</td>
                            <td class="score-green">A14</td>
                            <td class="score-green">A15</td>
                            <td class="score-green">A17</td>
                            <td class="score-gold">A18</td>
                            <td class="score-grey">A18</td>
                            <td class="score-grey">A18</td>
                            <td class="score-grey">A18</td>
                            <td class="score-grey">A18</td>
                            <td class="score-grey">A18</td>
                            <td class="score-grey">A18</td>
                            <td>-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div style="margin: 12px 16px; padding: 12px; background:#111; border-radius:12px;">
            <div style="font-size:0.8rem; color:#ffaa44; margin-bottom:8px;">📊 TEAM GAME + STROKE GAME (3 points)</div>
            <div style="font-size:0.7rem; color:#ccc; line-height:1.5;">
                <strong>Team Game (T-1, T-2 rows)</strong> - 2 points<br>
                • T-1 row - Flight 1: Best 2 players from Team A vs Best 2 from Team One<br>
                • T-2 row - Flight 2: Best 2 players from Team A vs Best 2 from Team One<br>
                • Each flight worth 1 point → 2 points<br><br>
                <strong>Stroke Game (Strk row)</strong> - 1 point<br>
                • Cumulative net score of all 8 players<br>
                • Lower cumulative net wins → 1 point
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 6: Team Game + Stroke Game';
    if (instructionTextElement) {
        instructionTextElement.innerHTML = '<strong>TEAM GAME + STROKE GAME (3 points)</strong><br><br>' +
            '<strong>TEAM GAME (2 points)</strong><br>' +
            '• <strong>T-1 row</strong> - Flight 1: Best 2 players from Team A vs Best 2 from Team One<br>' +
            '• <strong>T-2 row</strong> - Flight 2: Best 2 players from Team A vs Best 2 from Team One<br>' +
            '• Each flight worth 1 point → 2 points<br><br>' +
            '<strong>STROKE GAME (1 point)</strong><br>' +
            '• <strong>Strk row</strong> - Cumulative net score of all 8 players<br>' +
            '• Lower cumulative net wins → 1 point<br><br>' +
            '<strong>TOTAL = Match Game (16) + Team Game (2) + Stroke Game (1) = 19 points</strong>';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '📌 Scorecard row colors:<br>' +
            '  <span class="color-demo" style="color:#4caf50; font-weight:600;">A6</span> GREEN - Winning or tied (match still alive)<br>' +
            '  <span class="color-demo" style="color:#ffaa44; font-weight:800;">A6</span> GOLD - Game WON on this hole<br>' +
            '  <span class="color-demo" style="color:#888; font-weight:600;">A6</span> GREY - Match already over<br><br>' +
            '💡 Tip: The P/N button toggles between Natural hole order (1-18) and Play order (starting hole not Hole 1, e.g. start at Hole 10).';
    }
}

// ============================================================
// Export functions for global access
// ============================================================

window.TutorialResults = {
    renderStep5: renderStep5,
    renderStep6: renderStep6,
    getAsSquareHtml: getAsSquareHtml
};

/*
FILE: js/tutorial-results.js
VERSION: 1.01
KEY CHANGES:
   - NEW: Isolated Step 5, 6 for results tutorial
   - Step 5: Match game with colored bubbles (unchanged from v1.22)
   - Step 6: Team game + stroke game with STABLE table structure (isolated, no editing issues)
   - Table now uses static HTML with proper cell classes (no complex editing)
   - Green separator lines preserved
   - All existing functionality preserved
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/