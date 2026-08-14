/*
FILE: js/card-submit.js
VERSION: 1.02
KEY CHANGES from v1.00:
   - FIXED: Removed dependency on global 'db' variable
   - Replaced all 'db' references with 'firebase.firestore()' calls
   - This makes the module self-contained and works in modular architecture
   - All existing functionality preserved from v1.00
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/

var CardSubmit = (function() {
    
    // ============================================================
    // Helper: Get Firestore instance
    // ============================================================
    function getDb() {
        return firebase.firestore();
    }
    
    // ============================================================
    // Check if current hole is the last hole in play order
    // ============================================================
    
    function isLastHole(currentHole, startingHole) {
        var lastHole;
        if (startingHole === 1) {
            lastHole = 18;
        } else {
            lastHole = startingHole - 1;
        }
        return currentHole === lastHole;
    }
    
    // ============================================================
    // Check if current hole is saved and ready for submission
    // ============================================================
    
    function isReadyForSubmission(currentHole, startingHole, isCurrentHoleSaved, isGameComplete) {
        if (isGameComplete) return false;
        var isLast = isLastHole(currentHole, startingHole);
        return isLast && isCurrentHoleSaved;
    }
    
    // ============================================================
    // Show submission modal
    // ============================================================
    
    function showSubmitModal(callback) {
        var modalHtml = `
            <div class="modal-overlay" id="submitModal">
                <div class="modal">
                    <div class="modal-title">📋 SUBMIT SCORECARD</div>
                    <div class="modal-message">Confirm that all scores are correct before submitting.</div>
                    <div class="modal-message" style="font-size:0.7rem; color:#ffaa44; margin-top:8px;">This action cannot be undone.</div>
                    <div class="modal-buttons" style="margin-top:20px;">
                        <button class="modal-btn modal-btn-cancel" id="submitCancelBtn">Not Yet</button>
                        <button class="modal-btn modal-btn-confirm" id="submitConfirmBtn">✓ Submit Card</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById("submitCancelBtn").addEventListener("click", function() {
            document.getElementById("submitModal").remove();
            if (callback) callback(false);
        });
        
        document.getElementById("submitConfirmBtn").addEventListener("click", function() {
            document.getElementById("submitModal").remove();
            if (callback) callback(true);
        });
    }
    
    // ============================================================
    // Submit card for a flight
    // v1.01: Uses firebase.firestore() instead of global db
    // ============================================================
    
    async function submitCard(gameId, flight, collection) {
        if (!gameId) return false;
        
        var db = getDb();
        var updatePayload = {};
        updatePayload[`submitted.f${flight}`] = true;
        updatePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        try {
            await db.collection(collection).doc(gameId).update(updatePayload);
            console.log(`Flight ${flight} card submitted`);
            return true;
        } catch (error) {
            console.error("Submit error:", error);
            return false;
        }
    }
    
    // ============================================================
    // Check if both flights have submitted
    // ============================================================
    
    function isGameComplete(submitted) {
        if (!submitted) return false;
        return submitted.f1 === true && submitted.f2 === true;
    }
    
    // ============================================================
    // Get submission status text for button
    // ============================================================
    
    function getSubmitButtonText(editableFlight, submitted, currentHole, startingHole, isCurrentHoleSaved) {
        var isGameDone = isGameComplete(submitted);
        var isLast = isLastHole(currentHole, startingHole);
        
        if (isGameDone) {
            return { text: "✅ COMPLETE", disabled: true };
        }
        
        if (submitted && submitted[`f${editableFlight}`] === true) {
            return { text: "✓ SUBMITTED", disabled: true };
        }
        
        if (isLast && isCurrentHoleSaved) {
            return { text: "📋 SUBMIT CARD", disabled: false };
        }
        
        if (isLast && !isCurrentHoleSaved) {
            return { text: "📋 SUBMIT CARD", disabled: true };
        }
        
        return { text: "Next →", disabled: false };
    }
    
    // ============================================================
    // Get waiting status text (when one flight submitted, other hasn't)
    // ============================================================
    
    function getWaitingStatus(submitted) {
        if (submitted && submitted.f1 === true && submitted.f2 !== true) {
            return "⏳ Waiting for Flight 2 to submit...";
        }
        if (submitted && submitted.f2 === true && submitted.f1 !== true) {
            return "⏳ Waiting for Flight 1 to submit...";
        }
        return "";
    }
    
    // ============================================================
    // Show final results screen
    // ============================================================
    
    function showFinalResults(trTeamA, trTeamB, teamAGreen, teamBGreen, courseName, players, onClose) {
        var teamADisplay = trTeamA % 1 === 0 ? trTeamA : trTeamA.toFixed(1);
        var teamBDisplay = trTeamB % 1 === 0 ? trTeamB : trTeamB.toFixed(1);
        
        var winnerText = "";
        var winnerClass = "";
        if (trTeamA > trTeamB) {
            winnerText = "🏆 TEAM A WINS! 🏆";
            winnerClass = "winner-a";
        } else if (trTeamB > trTeamA) {
            winnerText = "🏆 TEAM ONE WINS! 🏆";
            winnerClass = "winner-b";
        } else {
            winnerText = "🤝 TIE GAME 🤝";
            winnerClass = "winner-tie";
        }
        
        var teamAPlayers = players.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = players.filter(function(p) { return p.team === "B"; });
        
        var modalHtml = `
            <div class="modal-overlay final-results-overlay" id="finalResultsModal">
                <div class="final-results-modal">
                    <div class="final-title">🏌️ MATCH COMPLETE 🏌️</div>
                    <div class="final-course">${escapeHtml(courseName)}</div>
                    <div class="final-score ${winnerClass}">
                        <span class="team-a">Team A ${teamADisplay}</span>
                        <span class="vs">vs</span>
                        <span class="team-b">${teamBDisplay} Team One</span>
                    </div>
                    <div class="final-winner ${winnerClass}">${winnerText}</div>
                    
                    <div class="final-players">
                        <div class="final-team">
                            <div class="final-team-title">🏅 TEAM A</div>
                            ${renderPlayerList(teamAPlayers)}
                        </div>
                        <div class="final-team">
                            <div class="final-team-title">🏅 TEAM ONE</div>
                            ${renderPlayerList(teamBPlayers)}
                        </div>
                    </div>
                    
                    <button class="final-btn" id="finalCloseBtn">🏠 Return to Main Menu</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        addFinalResultsStyles();
        
        document.getElementById("finalCloseBtn").addEventListener("click", function() {
            document.getElementById("finalResultsModal").remove();
            if (onClose) onClose();
        });
    }
    
    function renderPlayerList(teamPlayers) {
        var html = "";
        for (var i = 0; i < teamPlayers.length; i++) {
            var p = teamPlayers[i];
            html += `<div class="final-player">${escapeHtml(p.name)} (${p.label}) - HCP ${p.handicap}</div>`;
        }
        return html;
    }
    
    function addFinalResultsStyles() {
        if (document.getElementById("final-results-styles")) return;
        
        var styles = `
            <style id="final-results-styles">
                .final-results-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.95);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 3000;
                }
                .final-results-modal {
                    background: linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%);
                    border-radius: 32px;
                    padding: 32px;
                    max-width: 500px;
                    width: 90%;
                    text-align: center;
                    border: 2px solid #4caf50;
                    box-shadow: 0 0 30px rgba(76,175,80,0.3);
                }
                .final-title {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #4caf50;
                    margin-bottom: 8px;
                }
                .final-course {
                    font-size: 0.9rem;
                    color: #888;
                    margin-bottom: 24px;
                }
                .final-score {
                    font-size: 1.8rem;
                    font-weight: 800;
                    margin-bottom: 16px;
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    row-gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                .final-score .vs {
                    font-size: 1rem;
                    color: #888;
                }
                .final-score .team-a, .final-score .team-b {
                    white-space: nowrap;
                }
                .winner-a .team-a { color: #4caf50; }
                .winner-a .team-b { color: #ff6b6b; }
                .winner-b .team-a { color: #ff6b6b; }
                .winner-b .team-b { color: #4caf50; }
                .winner-tie .team-a, .winner-tie .team-b { color: #4caf50; }
                .final-winner {
                    font-size: 1.3rem;
                    font-weight: 700;
                    margin-bottom: 24px;
                    padding: 12px;
                    border-radius: 40px;
                }
                .winner-a .final-winner { background: rgba(76,175,80,0.2); color: #4caf50; }
                .winner-b .final-winner { background: rgba(76,175,80,0.2); color: #4caf50; }
                .winner-tie .final-winner { background: rgba(255,170,68,0.2); color: #ffaa44; }
                .final-players {
                    display: flex;
                    gap: 20px;
                    margin: 24px 0;
                    text-align: left;
                }
                .final-team {
                    flex: 1;
                    background: #111;
                    border-radius: 20px;
                    padding: 16px;
                }
                .final-team-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #4caf50;
                    text-align: center;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #333;
                }
                .final-player {
                    font-size: 0.75rem;
                    color: #ccc;
                    padding: 4px 0;
                }
                .final-btn {
                    background: #1a3a1a;
                    border: 1px solid #4caf50;
                    color: #4caf50;
                    padding: 12px 24px;
                    border-radius: 40px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    margin-top: 16px;
                    width: 100%;
                }
                .final-btn:hover {
                    background: #2a4a2a;
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
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
        isLastHole: isLastHole,
        isReadyForSubmission: isReadyForSubmission,
        showSubmitModal: showSubmitModal,
        submitCard: submitCard,
        isGameComplete: isGameComplete,
        getSubmitButtonText: getSubmitButtonText,
        getWaitingStatus: getWaitingStatus,
        showFinalResults: showFinalResults
    };
    
})();

// Make available globally
window.CardSubmit = CardSubmit;

/*
FILE: js/card-submit.js
VERSION: 1.02
KEY CHANGES from v1.00:
   - FIXED: Removed dependency on global 'db' variable
   - Replaced all 'db' references with 'firebase.firestore()' calls
   - This makes the module self-contained and works in modular architecture
   - All existing functionality preserved from v1.00
DEPENDS ON: Firebase Firestore
STATUS: Ready for integration
*/