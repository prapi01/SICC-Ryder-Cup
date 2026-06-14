/*
FILE: js/tutorial-scoring.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Isolated Step 2, 3, 4 for scoring tutorial
   - Step 3: Updated control bar with flight toggle button [P] [F2] [SAVE H7] [◀] [7] [▶]
   - Step 4: Updated control bar with gold previous button [P] [F2] [SAVE H3] [◀] [3] [▶]
   - Step 4: Added F1-F2 toggle message to existing instruction text
   - All existing functionality preserved
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/

// ============================================================
// Step 2: Role Selection
// ============================================================

function renderStep2(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction) {
    var html = `
        <div class="demo-header"></div>
        <div style="padding: 16px;">
            <div style="background:#111; border-radius:20px; padding:16px; margin-bottom:16px; text-align:center;">
                <div style="font-size:1rem; font-weight:700; color:#4caf50;">⛳ SICC Bukit Course</div>
                <div style="font-size:0.65rem; color:#888;">Starting Hole: 1 | Tournament Format</div>
            </div>
            
            <div class="flight-box-demo">
                <div class="flight-header-demo">
                    <h3>FLIGHT 1</h3>
                    <div class="flight-lock-info">🔓 Available</div>
                </div>
                <div class="teams-grid-demo">
                    <div class="team-demo">
                        <div class="team-title-demo">TEAM A</div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">Ang C H</span>
                            <span class="player-hcp-demo">2</span>
                        </div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">Chenh Hoe</span>
                            <span class="player-hcp-demo">10</span>
                        </div>
                    </div>
                    <div class="team-demo">
                        <div class="team-title-demo">TEAM B</div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">Jeff Goh</span>
                            <span class="player-hcp-demo">0</span>
                        </div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">Ong C B</span>
                            <span class="player-hcp-demo">1</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flight-box-demo">
                <div class="flight-header-demo">
                    <h3>FLIGHT 2</h3>
                    <div class="flight-lock-info">🔓 Available</div>
                </div>
                <div class="teams-grid-demo">
                    <div class="team-demo">
                        <div class="team-title-demo">TEAM A</div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">C K</span>
                            <span class="player-hcp-demo">8</span>
                        </div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">Yip H M</span>
                            <span class="player-hcp-demo">12</span>
                        </div>
                    </div>
                    <div class="team-demo">
                        <div class="team-title-demo">TEAM B</div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">Piti</span>
                            <span class="player-hcp-demo">8</span>
                        </div>
                        <div class="player-row-demo">
                            <span class="player-name-demo">James Ong</span>
                            <span class="player-hcp-demo">10</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="role-section-demo">
                <div style="text-align:center; color:#ffaa44; font-size:0.85rem; margin-bottom:8px;">🎮 SELECT YOUR ROLE</div>
                <div class="role-buttons-demo">
                    <div class="role-btn-demo" id="role1Btn">SCORE F1</div>
                    <div class="role-btn-demo" id="role2Btn">SCORE F2</div>
                    <div class="role-btn-demo" id="viewBtn" style="border-color:#ffaa44; color:#ffaa44;">VIEW ONLY</div>
                </div>
                <div class="role-status-demo">⚠️ Select a role above, then click TEE OFF</div>
            </div>
            
            <div class="action-buttons-demo">
                <div class="btn-back-demo">← BACK</div>
                <div class="btn-teeoff-demo" id="teeOffBtn">⛳ TEE OFF →</div>
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    var role1Btn = document.getElementById('role1Btn');
    var role2Btn = document.getElementById('role2Btn');
    var viewBtn = document.getElementById('viewBtn');
    var teeOffBtn = document.getElementById('teeOffBtn');
    
    if (role1Btn) {
        role1Btn.addEventListener('click', function() {
            alert("Demo: SCORER FLIGHT 1 selected\n\nIn the real app, this locks your role and you enter the game.");
        });
    }
    if (role2Btn) {
        role2Btn.addEventListener('click', function() {
            alert("Demo: SCORER FLIGHT 2 selected\n\nIn the real app, this locks your role and you enter the game.");
        });
    }
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            alert("Demo: VIEW ONLY selected\n\nYou can watch the game without scoring.");
        });
    }
    if (teeOffBtn) {
        teeOffBtn.addEventListener('click', function() {
            alert("Demo: TEE OFF\n\nAfter selecting a role, this button starts the game.");
        });
    }
    
    if (addHighlightFunction) {
        addHighlightFunction('role1Btn');
        addHighlightFunction('teeOffBtn');
    }
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 2: Select Your Role';
    if (instructionTextElement) {
        instructionTextElement.innerHTML = 'Before entering a game, select your role:<br><br>' +
            '• <strong>SCORER FLIGHT 1</strong> - Enter scores for Flight 1 players<br>' +
            '• <strong>SCORER FLIGHT 2</strong> - Enter scores for Flight 2 players<br>' +
            '• <strong>VIEW ONLY</strong> - Watch live without scoring<br><br>' +
            'Then tap <strong>TEE OFF</strong> to enter the game.';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '💡 Tip: Only one device per flight can score. Another device can take over by tapping the grey Role button. The current owner will be notified.<br><br>' +
            '📌 Games can start on Hole 1, Hole 10, or Shotgun. Use P/N button to toggle Natural vs Play order.<br><br>' +
            '📌 Two formats (set in GAME SETTINGS): Tournament (own handicap) or Relative (zerorise).';
    }
}

// ============================================================
// Step 3: Enter Scores - Updated control bar with flight toggle
// ============================================================

function renderStep3(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction) {
    var html = `
        <div class="demo-header">
            <div style="margin-top:8px;"><span style="background:#111; padding:4px 20px; border-radius:40px; font-size:1.1rem; font-weight:800;">HOLE 7</span></div>
        </div>
        <div class="team-score-card">
            <div style="display:flex; justify-content:center; gap:16px;">
                <div><div style="font-size:0.85rem; font-weight:600; color:#4caf50;">TEAM A</div><div style="font-size:1.8rem; font-weight:800; color:#4caf50;">11</div></div>
                <div style="font-size:1.5rem; color:#888;">│</div>
                <div><div style="font-size:0.85rem; font-weight:600; color:#ff6b6b;">TEAM B</div><div style="font-size:1.8rem; font-weight:800; color:#ff6b6b;">7</div></div>
            </div>
            <div style="font-size:0.65rem; color:#888; margin-top:8px;">Total of 19 points</div>
        </div>
        <div class="player-card">
            <div class="player-header">
                <div><span class="player-name">Ang C H</span><span class="player-handicap">ACH 2</span></div>
                <div class="score-control">
                    <button class="score-btn demo-dec" data-player="a1">-</button>
                    <span class="score-value" id="score_a1">5</span>
                    <button class="score-btn demo-inc" data-player="a1">+</button>
                </div>
            </div>
            <div class="bubbles">
                <div class="bubble bubble-green">vs OCB 1</div>
                <div class="bubble bubble-green">vs JO 1</div>
                <div class="bubble bubble-green">vs JG 1</div>
                <div class="bubble bubble-green">vs P 1</div>
            </div>
        </div>
        <div class="player-card">
            <div class="player-header">
                <div><span class="player-name">Chenh Hoe</span><span class="player-handicap">CK 10</span></div>
                <div class="score-control">
                    <button class="score-btn demo-dec" data-player="a2">-</button>
                    <span class="score-value" id="score_a2">6</span>
                    <button class="score-btn demo-inc" data-player="a2">+</button>
                </div>
            </div>
            <div class="bubbles">
                <div class="bubble bubble-green">vs OCB 1</div>
                <div class="bubble bubble-green">vs JO 1</div>
                <div class="bubble bubble-green">vs JG 1</div>
                <div class="bubble bubble-green">vs P 1</div>
            </div>
        </div>
        <!-- NEW CONTROL BAR - v1.00 with flight toggle -->
        <div class="compact-header" style="display: flex; align-items: center; gap: 6px; margin: 16px;">
            <button class="compact-btn" id="demoPnBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer;">P</button>
            <button class="compact-btn" id="demoFlightToggleBtn" style="background: #1a3a1a; border: 1px solid #ffaa44; color: #ffaa44; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer;">F2</button>
            <button class="compact-btn compact-save-btn" id="saveDemoBtn" style="flex: 1; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; height: 44px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">SAVE H7</button>
            <div class="compact-nav-group" style="display: flex; align-items: center; gap: 6px;">
                <button class="compact-nav-btn" id="demoPrevBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer;">◀</button>
                <span class="compact-hole-display" style="font-size: 1rem; font-weight: 700; color: #4caf50; min-width: 36px; text-align: center;">7</span>
                <button class="compact-nav-btn" id="nextHoleDemoBtn" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer;">▶</button>
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    // Score adjustment buttons
    var decButtons = demoScreenElement.querySelectorAll('.demo-dec');
    var incButtons = demoScreenElement.querySelectorAll('.demo-inc');
    
    decButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var player = this.dataset.player;
            var span = document.getElementById('score_' + player);
            var val = parseInt(span.innerText);
            if (val > 1) span.innerText = val - 1;
        });
    });
    
    incButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var player = this.dataset.player;
            var span = document.getElementById('score_' + player);
            var val = parseInt(span.innerText);
            if (val < 12) span.innerText = val + 1;
        });
    });
    
    // Save button demo
    var saveBtn = document.getElementById('saveDemoBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            var originalText = this.innerText;
            this.classList.add('btn-save-flash');
            this.innerText = '✓ SAVED';
            setTimeout(function() {
                saveBtn.classList.remove('btn-save-flash');
                saveBtn.innerText = originalText;
            }, 1000);
            alert("Demo: Score saved!\n\nIn the real app, you must save before moving to next hole.");
        });
    }
    
    // Next hole button demo
    var nextBtn = document.getElementById('nextHoleDemoBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            alert("Demo: Next hole\n\nIn the real app, this button is disabled until current hole is saved.");
        });
    }
    
    // Flight toggle button demo
    var flightToggleBtn = document.getElementById('demoFlightToggleBtn');
    if (flightToggleBtn) {
        flightToggleBtn.addEventListener('click', function() {
            var currentText = this.innerText;
            if (currentText === 'F2') {
                this.innerText = 'F1';
                this.style.borderColor = '#4caf50';
                this.style.color = '#4caf50';
                alert("Demo: Toggled to Flight 1 (view only)\n\nIn the real app, you can view the other flight's scores while keeping your current hole.");
            } else {
                this.innerText = 'F2';
                this.style.borderColor = '#ffaa44';
                this.style.color = '#ffaa44';
                alert("Demo: Toggled to Flight 2 (scoring mode)\n\nTap again to return to scoring your flight.");
            }
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
        addHighlightFunction('saveDemoBtn');
    }
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 3: Enter Scores';
    if (instructionTextElement) {
        // EXISTING MESSAGE UNCHANGED
        instructionTextElement.innerHTML = 'Scoring screen for the scorer.<br><br>Scores default to par. Adjust up or down based on actual strokes. <strong>SAVE</strong> to record.<br><br>' +
            '1. Use <strong>+</strong> and <strong>-</strong> to adjust gross score<br>' +
            '2. Tap <strong>SAVE</strong> - button flashes red<br>' +
            '3. Tap <strong>▶</strong> to move to next hole<br><br>' +
            'You cannot advance until current hole is saved.';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '💡 Tip: The top display shows overall team score (total of 19 points). Team with more points wins.<br><br>' +
            '📌 Bubble colors show match results (explained in Step 5).';
    }
}

// ============================================================
// Step 4: Correcting Previous Holes - Updated control bar with gold previous button
// ============================================================

function renderStep4(demoScreenElement, instructionTitleElement, instructionTextElement, instructionTipElement, addHighlightFunction) {
    var html = `
        <div class="demo-header">
            <div style="margin-top:8px;"><span style="background:#111; padding:4px 20px; border-radius:40px; font-size:1.1rem; font-weight:800;">HOLE 3</span></div>
        </div>
        <div class="team-score-card">
            <div style="display:flex; justify-content:center; gap:16px;">
                <div><div style="font-size:0.85rem; font-weight:600; color:#4caf50;">TEAM A</div><div style="font-size:1.8rem; font-weight:800; color:#4caf50;">8</div></div>
                <div style="font-size:1.5rem; color:#888;">│</div>
                <div><div style="font-size:0.85rem; font-weight:600; color:#ff6b6b;">TEAM B</div><div style="font-size:1.8rem; font-weight:800; color:#ff6b6b;">5</div></div>
            </div>
            <div style="font-size:0.65rem; color:#888; margin-top:8px;">Total of 19 points</div>
        </div>
        <div class="player-card">
            <div class="player-header">
                <div><span class="player-name">Jeff Goh</span><span class="player-handicap">JG 0</span></div>
                <div class="score-value" style="background:#1a3a1a;">4</div>
            </div>
            <div class="bubbles">
                <div class="bubble bubble-green">vs ACH 2</div>
                <div class="bubble bubble-green">vs CK 2</div>
                <div class="bubble bubble-green">vs KF 2</div>
                <div class="bubble bubble-green">vs YHM 2</div>
            </div>
        </div>
        <div style="margin: 12px 16px; padding: 12px; background:#1a3a1a; border-radius:12px; text-align:center;">
            <span style="color:#ffaa44;">✓ You can tap ◀ to go back to previous holes and correct scores</span>
        </div>
        <!-- NEW CONTROL BAR - v1.00 with gold previous button and flight toggle -->
        <div class="compact-header" style="display: flex; align-items: center; gap: 6px; margin: 16px;">
            <button class="compact-btn" id="demoPnBtn2" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer;">P</button>
            <button class="compact-btn" id="demoFlightToggleBtn2" style="background: #1a3a1a; border: 1px solid #ffaa44; color: #ffaa44; border-radius: 30px; min-width: 44px; height: 44px; padding: 0 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer;">F2</button>
            <button class="compact-btn compact-save-btn" id="saveDemoBtn2" style="flex: 1; background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; border-radius: 30px; height: 44px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">SAVE H3</button>
            <div class="compact-nav-group" style="display: flex; align-items: center; gap: 6px;">
                <button class="compact-nav-btn" id="prevHoleDemoBtn" style="background: #ffaa44; border: 1px solid #ffaa44; color: #1a3a1a; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer;">◀</button>
                <span class="compact-hole-display" style="font-size: 1rem; font-weight: 700; color: #4caf50; min-width: 36px; text-align: center;">3</span>
                <button class="compact-nav-btn" id="nextHoleDemoBtn2" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; width: 44px; height: 44px; border-radius: 30px; font-size: 1.1rem; cursor: pointer;">▶</button>
            </div>
        </div>
    `;
    
    demoScreenElement.innerHTML = html;
    
    // Previous button demo (gold)
    var prevBtn = document.getElementById('prevHoleDemoBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            alert("Demo: Going back to previous hole\n\nIn the real app, you can edit any previous hole and re-save.");
        });
    }
    
    // Flight toggle button demo
    var flightToggleBtn = document.getElementById('demoFlightToggleBtn2');
    if (flightToggleBtn) {
        flightToggleBtn.addEventListener('click', function() {
            var currentText = this.innerText;
            if (currentText === 'F2') {
                this.innerText = 'F1';
                this.style.borderColor = '#4caf50';
                this.style.color = '#4caf50';
                alert("Demo: Toggled to Flight 1 (view only)\n\nYou can check the other flight's scores while keeping your place.");
            } else {
                this.innerText = 'F2';
                this.style.borderColor = '#ffaa44';
                this.style.color = '#ffaa44';
                alert("Demo: Toggled to Flight 2 (scoring mode)\n\nTap again to return to scoring your flight.");
            }
        });
    }
    
    // P/N button demo
    var pnBtn = document.getElementById('demoPnBtn2');
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
    
    // Save button demo
    var saveBtn = document.getElementById('saveDemoBtn2');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            var originalText = this.innerText;
            this.classList.add('btn-save-flash');
            this.innerText = '✓ SAVED';
            setTimeout(function() {
                saveBtn.classList.remove('btn-save-flash');
                saveBtn.innerText = originalText;
            }, 1000);
            alert("Demo: Score saved!\n\nIn the real app, you can edit previous holes and re-save.");
        });
    }
    
    if (addHighlightFunction) {
        addHighlightFunction('prevHoleDemoBtn');
    }
    
    if (instructionTitleElement) instructionTitleElement.innerHTML = 'Step 4: Correct a Previous Hole';
    if (instructionTextElement) {
        // EXISTING MESSAGE + ADDED F1-F2 TOGGLE MESSAGE
        instructionTextElement.innerHTML = 'Made a mistake? No problem.<br><br>' +
            '1. Tap <strong>◀</strong> to go back to any previous hole<br>' +
            '2. Adjust scores using <strong>+</strong> and <strong>-</strong><br>' +
            '3. Tap <strong>SAVE</strong> to overwrite<br>' +
            '4. Tap <strong>▶</strong> to return to current hole<br><br>' +
            'You can edit ANY hole that hasn\'t been signed yet.<br><br>' +
            '📌 The <strong>[F2]</strong> button lets you check the other flight\'s scores while keeping your place.';
    }
    if (instructionTipElement) {
        instructionTipElement.innerHTML = '💡 Tip: The system automatically recalculates all match results and team scores when you save a corrected hole.<br><br>' +
            '📌 If you close the app, your saved data is preserved. Unsaved changes will be lost.';
    }
}

// ============================================================
// Export functions for global access
// ============================================================

window.TutorialScoring = {
    renderStep2: renderStep2,
    renderStep3: renderStep3,
    renderStep4: renderStep4
};

/*
FILE: js/tutorial-scoring.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Isolated Step 2, 3, 4 for scoring tutorial
   - Step 3: Updated control bar with flight toggle button [P] [F2] [SAVE H7] [◀] [7] [▶]
   - Step 4: Updated control bar with gold previous button [P] [F2] [SAVE H3] [◀] [3] [▶]
   - Step 4: Added F1-F2 toggle message to existing instruction text
   - All existing functionality preserved
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/