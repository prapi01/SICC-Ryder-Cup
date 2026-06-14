/*
FILE: js/tutorial-postgame.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Isolated Step 7, 8, 9 for post-game tutorial
   - Step 7: Sign card modal with gold sign button
   - Step 8: Waiting screen with spinner
   - Step 9: Handicap adjustment table (static, no calculation)
   - All existing functionality preserved from v1.22
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
// Step 7: Sign Card
// ============================================================

function renderStep7(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction, onSignComplete) {
    var html = `
        <div class="demo-header">
            <div style="margin-top:8px;"><span style="background:#111; padding:4px 20px; border-radius:40px; font-size:1.1rem; font-weight:800;">HOLE 18</span></div>
        </div>
        <div class="team-score-card">
            <div style="display:flex; justify-content:center; gap:16px;">
                <div><div style="font-size:0.85rem; font-weight:600; color:#4caf50;">TEAM A</div><div style="font-size:1.8rem; font-weight:800; color:#4caf50;">11</div></div>
                <div style="font-size:1.5rem; color:#888;">│</div>
                <div><div style="font-size:0.85rem; font-weight:600; color:#ff6b6b;">TEAM B</div><div style="font-size:1.8rem; font-weight:800; color:#ff6b6b;">7</div></div>
            </div>
            <div style="font-size:0.65rem; color:#888; margin-top:8px;">Total of 19 points</div>
        </div>
        <!-- Control bar with gold sign button -->
        <div class="compact-header" style="display: flex; align-items: center; gap: 6px; margin: 16px;">
            <button class="compact-btn" id="demoPnBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer;">P</button>
            <button class="compact-btn" id="demoFlightBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer;">F2</button>
            <button class="compact-btn compact-save-btn" id="saveDemoBtn" style="flex: 1; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; height: 44px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">SAVE H18</button>
            <div class="compact-nav-group" style="display: flex; align-items: center; gap: 6px;">
                <button class="compact-nav-btn" id="prevHoleDemoBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer;">◀</button>
                <span class="compact-hole-display" style="font-size: 1rem; font-weight: 700; color: #4caf50; min-width: 36px; text-align: center;">18</span>
                <button class="compact-nav-btn compact-sign-btn" id="signDemoBtn" style="background: #ffaa44; border: 1px solid #ffaa44; color: #1a3a1a; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer;">✍️</button>
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    var signBtn = document.getElementById('signDemoBtn');
    if (signBtn) {
        signBtn.addEventListener('click', function() {
            showSignModal(onSignComplete);
        });
    }
    
    // Flight toggle button demo
    var flightBtn = document.getElementById('demoFlightBtn');
    if (flightBtn) {
        flightBtn.addEventListener('click', function() {
            alert("Demo: Flight toggle\n\nIn the real app, you can view the other flight's scores while keeping your place.");
        });
    }
    
    // P/N button demo
    var pnBtn = document.getElementById('demoPnBtn');
    if (pnBtn) {
        pnBtn.addEventListener('click', function() {
            if (this.innerText === 'P') {
                this.innerText = 'N';
                alert("Demo: Natural order (1-18)\n\nHoles shown in natural order.");
            } else {
                this.innerText = 'P';
                alert("Demo: Play order\n\nHoles shown in playing order based on starting hole.");
            }
        });
    }
    
    if (addHighlightFunction) {
        addHighlightFunction('signDemoBtn');
    }
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 7: Sign Your Scorecard';
    if (instructionTextElement) {
        instructionTextElement.innerHTML = 'After saving hole 18, the <strong>▶</strong> button turns into a gold <strong>✍️</strong> button.<br><br>' +
            'Tap it to open the signature modal and confirm that all scores are correct.<br><br>' +
            'Once you sign, your card is locked. You cannot make further changes.';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '💡 Tip: Both Flight 1 and Flight 2 must sign their cards to complete the match.<br><br>' +
            '📌 After signing, you cannot edit scores anymore. Double-check before signing!';
    }
}

function showSignModal(onComplete) {
    var modalHtml = `
        <div class="modal-overlay" id="signModal">
            <div class="modal-content">
                <div class="modal-title">✍️ SIGN SCORECARD</div>
                <div class="modal-message">Confirm that all scores are correct before signing.</div>
                <button class="modal-btn" id="signConfirmBtn">✓ SIGN CARD</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('signConfirmBtn').addEventListener('click', function() {
        document.getElementById('signModal').remove();
        if (onComplete) onComplete();
    });
}

// ============================================================
// Step 8: Waiting for Other Flight
// ============================================================

function renderStep8(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction) {
    var html = `
        <div class="demo-header"></div>
        <div style="text-align:center; padding:40px 20px;">
            <div class="waiting-modal-demo">
                <div class="waiting-title-demo">⌛ CARD SIGNED</div>
                <div class="waiting-message-demo">Waiting for Flight 2...</div>
                <div class="waiting-submessage-demo">The match will complete when both cards are signed.</div>
                <div class="waiting-spinner-demo"></div>
            </div>
            <div class="celebration-preview" style="margin-top:20px;">
                <div class="beer">🍺 🏆 🍺</div>
                <div style="font-size:0.75rem; color:#4caf50;">When both flights sign → Final results confirmed!</div>
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 8: Waiting for Other Flight';
    if (instructionTextElement) {
        instructionTextElement.innerHTML = 'After you sign, you\'ll see a waiting screen.<br><br>' +
            'The match will complete automatically when the other flight signs their card.<br><br>' +
            'When both cards are signed, final results are confirmed and handicap adjustment is calculated.';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '💡 Tip: Use another device in VIEW ONLY mode to watch the waiting flight complete their round.';
    }
}

// ============================================================
// Step 9: Handicap Adjustment - Static table (no calculation)
// ============================================================

function renderStep9(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction) {
    var html = `
        <div class="demo-header"></div>
        <div style="background:#1a1a1a; border-radius:28px; padding:20px; margin:16px; border:2px solid #4caf50;">
            <div style="font-size:1.2rem; font-weight:800; color:#4caf50; text-align:center; margin-bottom:16px;">🏌️ HANDICAP ADJUSTMENT</div>
            
            <div class="handicap-table-wrapper">
                <table class="handicap-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Old</th>
                            <th>Anc</th>
                            <th>Perf</th>
                            <th>New</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="team-separator"><td colspan="5">🏆 TEAM A</td></tr>
                        <tr>
                            <td>ACH</td>
                            <td class="gold-zero">0</td>
                            <td><span class="adj-grey">0</span><span class="raw-grey"> [0]</span></td>
                            <td><span class="adj-grey">0</span><span class="raw-green"> [3]</span></td>
                            <td class="gold-zero">0</td>
                        </tr>
                        <tr>
                            <td>KF</td>
                            <td class="normal-white">2</td>
                            <td><span class="adj-green">3</span><span class="raw-red"> [6]</span></td>
                            <td><span class="adj-grey">0</span><span class="raw-green"> [2]</span></td>
                            <td class="new-green">5</td>
                        </tr>
                        <tr>
                            <td>CK</td>
                            <td class="normal-white">10</td>
                            <td><span class="adj-grey">0</span><span class="raw-red"> [1]</span></td>
                            <td><span class="adj-grey">0</span><span class="raw-green"> [1.5]</span></td>
                            <td class="new-green">10</td>
                        </tr>
                        <tr>
                            <td>YHM</td>
                            <td class="normal-white">14</td>
                            <td><span class="adj-grey">0</span><span class="raw-red"> [1]</span></td>
                            <td><span class="adj-grey">0</span><span class="raw-green"> [2.5]</span></td>
                            <td class="new-green">14</td>
                        </tr>
                        <tr class="team-separator"><td colspan="5">⚡ TEAM B</td></tr>
                        <tr>
                            <td>OCB</td>
                            <td class="normal-white">0</td>
                            <td><span class="adj-green">3</span><span class="raw-red"> [6]</span></td>
                            <td><span class="adj-green">1</span><span class="raw-green"> [0]</span></td>
                            <td class="new-green">4</td>
                        </tr>
                        <tr>
                            <td>JG</td>
                            <td class="normal-white">0</td>
                            <td><span class="adj-green">1</span><span class="raw-red"> [3]</span></td>
                            <td><span class="adj-grey">0</span><span class="raw-green"> [2.5]</span></td>
                            <td class="new-green">1</td>
                        </tr>
                        <tr>
                            <td>JO</td>
                            <td class="normal-white">10</td>
                            <td><span class="adj-green">1</span><span class="raw-red"> [3]</span></td>
                            <td><span class="adj-green">1</span><span class="raw-green"> [0.5]</span></td>
                            <td class="new-green">12</td>
                        </tr>
                        <tr>
                            <td>P</td>
                            <td class="normal-white">10</td>
                            <td><span class="adj-red">2</span><span class="raw-green"> [4]</span></td>
                            <td><span class="adj-red">1</span><span class="raw-green"> [4]</span></td>
                            <td class="new-green">7</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="handicap-buttons">
                <button class="handicap-btn handicap-btn-primary" id="scorecardDemoBtn" style="background:#1a3a1a; border-color:#4caf50; color:#4caf50;">📋 Scorecard</button>
                <button class="handicap-btn" id="changeAnchorDemoBtn" style="background:#1a1a1a; border-color:#ffaa44; color:#ffaa44;">🔄 Change Anchor</button>
                <button class="handicap-btn" id="menuDemoBtn" style="background:#1a1a1a; border-color:#333; color:#888;">🏠 Menu</button>
                <button class="handicap-btn" id="exitDemoBtn" style="background:#1a1a1a; border-color:#333; color:#888;">🚪 Exit</button>
            </div>
            
            <div style="margin-top:12px; font-size:0.65rem; color:#aaa; text-align:center;">
                <span style="color:#ff6b6b;">Red = CUT stroke</span>&nbsp;&nbsp;|&nbsp;&nbsp;
                <span style="color:#4caf50;">Green = ADD stroke</span>&nbsp;&nbsp;|&nbsp;&nbsp;
                <span style="color:#ffaa44;">Gold = Anchor</span>
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    // Demo button handlers
    var scorecardBtn = document.getElementById('scorecardDemoBtn');
    if (scorecardBtn) {
        scorecardBtn.addEventListener('click', function() {
            alert("Demo: Scorecard\n\nIn the real app, this returns you to the scorecard view.");
        });
    }
    
    var changeAnchorBtn = document.getElementById('changeAnchorDemoBtn');
    if (changeAnchorBtn) {
        changeAnchorBtn.addEventListener('click', function() {
            alert("Demo: Change Anchor\n\nIn the real app, this allows you to select a different Anchor (lowest handicap player) and recalculate all adjustments.");
        });
    }
    
    var menuBtn = document.getElementById('menuDemoBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            alert("Demo: Main Menu\n\nIn the real app, this returns to the main menu.");
        });
    }
    
    var exitBtn = document.getElementById('exitDemoBtn');
    if (exitBtn) {
        exitBtn.addEventListener('click', function() {
            alert("Demo: Exit\n\nIn the real app, this exits the handicap adjustment screen.");
        });
    }
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 9: Handicap Adjustment';
    if (instructionTextElement) {
        instructionTextElement.innerHTML = '<strong>🏌️ HANDICAP ADJUSTMENT TABLE</strong><br><br>' +
            '• <strong>Old</strong> - Starting handicap before this match.<br>' +
            '• <strong>Anc</strong> - Anchor adjustment: 1 stroke per 2 holes won/lost against anchor. <span style="color:#4caf50;">Green</span> = ADD (loss vs anchor), <span style="color:#ff6b6b;">Red</span> = CUT (won vs anchor). Raw result in brackets: <span class="raw-green">[green]</span> = won, <span class="raw-red">[red]</span> = lost.<br>' +
            '• <strong>Perf</strong> - Performance adjustment based on 4 matches (max 4 points). Points ≥ 3.5 → <span style="color:#ff6b6b;">CUT 1</span>, Points ≤ 0.5 → <span style="color:#4caf50;">ADD 1</span>. Raw points in brackets always <span class="raw-green">green</span>.<br>' +
            '• <strong>New</strong> = Old + Anc + Perf (with zero-rise applied).<br><br>' +
            'The Anchor is the player with the lowest starting handicap. All other players\' adjustments are calculated relative to the Anchor.';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '💡 Tip: After handicap adjustment, new handicaps are automatically saved to player profiles. View results anytime in VIEW PREVIOUS GAMES.<br><br>' +
            '📌 The Anchor may change if the lowest handicap player changes after adjustments. Use "Change Anchor" button if multiple players have handicap 0.';
    }
}

// ============================================================
// Export functions for global access
// ============================================================

window.TutorialPostGame = {
    renderStep7: renderStep7,
    renderStep8: renderStep8,
    renderStep9: renderStep9,
    getAsSquareHtml: getAsSquareHtml
};

/*
FILE: js/tutorial-postgame.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Isolated Step 7, 8, 9 for post-game tutorial
   - Step 7: Sign card modal with gold sign button
   - Step 8: Waiting screen with spinner
   - Step 9: Handicap adjustment table (static, no calculation)
   - All existing functionality preserved from v1.22
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/