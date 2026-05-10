/*
FILE: js/sign-card.js
VERSION: 1.03
KEY CHANGES:
   - Fixed celebration image: always uses celebration.jpg
   - Button changed to "🏌️ Handicap Adjustment"
   - Button calls HandicapAdjustment.init() when clicked
   - Removed random image selection logic
   - 8 confetti bursts, 2 seconds apart
   - Match Complete as main heading
DEPENDS ON: Firebase Firestore, js/hcp-adjust.js (to be created)
STATUS: Ready for integration
*/

var SignCard = (function() {
    
    // ============================================================
    // Fixed celebration image - always uses celebration.jpg
    // ============================================================
    
    function getCelebrationImage() {
        return "/images/celebration/celebration.jpg";
    }
    
    // Wait for other flight to sign
    function showWaitingScreen(flightNumber, onComplete) {
        var modalHtml = `
            <div class="modal-overlay" id="waitingModal">
                <div class="waiting-modal">
                    <div class="waiting-title">✓ CARD SIGNED</div>
                    <div class="waiting-animation">⏳ 🏌️‍♂️ ⏳</div>
                    <div class="waiting-message">Waiting for Flight ${flightNumber === 1 ? 2 : 1}...</div>
                    <div class="waiting-submessage">The match will complete when both cards are signed.</div>
                    <div class="waiting-spinner"></div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        window._waitingCallback = onComplete;
        return document.getElementById('waitingModal');
    }
    
    function hideWaitingScreen() {
        var modal = document.getElementById('waitingModal');
        if (modal) modal.remove();
    }
    
    function launchConfetti() {
        var repeatCount = 0;
        var maxRepeats = 8;
        
        function burst() {
            for (var i = 0; i < 150; i++) {
                var confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.animationDelay = Math.random() * 3 + 's';
                confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
                confetti.style.backgroundColor = ['#4caf50', '#ffaa44', '#4caf50', '#ffffff'][Math.floor(Math.random() * 4)];
                document.body.appendChild(confetti);
                setTimeout(function(c) { if (c && c.remove) c.remove(); }, 4000);
            }
            
            repeatCount++;
            if (repeatCount < maxRepeats) {
                setTimeout(burst, 2000);
            }
        }
        
        burst();
    }
    
    function showCelebrationScreen(winner, teamAScore, teamBScore, winningPlayers, gameId, onClose) {
        var winnerText = "";
        var winnerClass = "";
        
        if (winner === "A") {
            winnerText = "TEAM A WINS!";
            winnerClass = "winner-a";
        } else if (winner === "B") {
            winnerText = "TEAM B WINS!";
            winnerClass = "winner-b";
        } else {
            winnerText = "TIE GAME!";
            winnerClass = "winner-tie";
        }
        
        var winningTeamPlayers = (winner === "A") ? winningPlayers.teamA : (winner === "B") ? winningPlayers.teamB : [];
        var playersHtml = "";
        for (var i = 0; i < winningTeamPlayers.length; i++) {
            playersHtml += '<span class="winning-player">' + escapeHtml(winningTeamPlayers[i].name) + '</span>';
        }
        
        var teamADisplay = teamAScore % 1 === 0 ? teamAScore : teamAScore.toFixed(1);
        var teamBDisplay = teamBScore % 1 === 0 ? teamBScore : teamBScore.toFixed(1);
        
        var celebrationImage = getCelebrationImage();
        var imageHtml = `
            <div class="celebration-image-container">
                <img src="${celebrationImage}" class="celebration-image" alt="Celebration" onerror="this.style.display='none'">
            </div>
        `;
        
        var modalHtml = `
            <div class="modal-overlay celebration-overlay" id="celebrationModal">
                <div class="celebration-modal">
                    ${imageHtml}
                    <div class="celebration-title">🎉 MATCH COMPLETE! 🎉</div>
                    <div class="celebration-beer">🍺 BEER TIME! 🍺</div>
                    <div class="celebration-winner ${winnerClass}">
                        ${winnerText}
                    </div>
                    <div class="celebration-score">
                        Team A ${teamADisplay} - ${teamBDisplay} Team B
                    </div>
                    <div class="celebration-players">
                        <div class="celebration-players-title">🏅 ${winner === 'A' ? 'TEAM A' : (winner === 'B' ? 'TEAM B' : 'BOTH TEAMS')} 🏅</div>
                        <div class="celebration-players-list">
                            ${playersHtml || (winner === 'Tie' ? '<span class="winning-player">Great Match!</span>' : '')}
                        </div>
                    </div>
                    <button class="celebration-btn" id="handicapAdjustBtn">🏌️ Handicap Adjustment</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Style the Handicap Adjustment button
        var hcpBtn = document.getElementById('handicapAdjustBtn');
        if (hcpBtn) {
            hcpBtn.style.fontSize = '1.2rem';
            hcpBtn.style.padding = '16px 28px';
            hcpBtn.style.background = '#ffaa44';
            hcpBtn.style.color = '#1a3a1a';
            hcpBtn.style.border = 'none';
            hcpBtn.style.fontWeight = '800';
            hcpBtn.style.letterSpacing = '1px';
            hcpBtn.style.cursor = 'pointer';
        }
        
        addCelebrationStyles();
        launchConfetti();
        
        document.getElementById("handicapAdjustBtn").addEventListener("click", function() {
            document.getElementById("celebrationModal").remove();
            // Call HandicapAdjustment module if available
            if (typeof HandicapAdjustment !== 'undefined' && HandicapAdjustment.init) {
                HandicapAdjustment.init(gameId, winningPlayers);
            } else {
                console.log("HandicapAdjustment module not loaded yet");
                if (onClose) onClose();
            }
        });
    }
    
    function addCelebrationStyles() {
        if (document.getElementById('sign-card-styles')) return;
        
        var styles = `
            <style id="sign-card-styles">
                .modal-overlay {
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
                .waiting-modal {
                    background: #1a1a1a;
                    border-radius: 32px;
                    padding: 40px;
                    max-width: 380px;
                    width: 90%;
                    text-align: center;
                    border: 2px solid #4caf50;
                    box-shadow: 0 0 30px rgba(76,175,80,0.3);
                }
                .waiting-title {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #4caf50;
                    margin-bottom: 24px;
                }
                .waiting-animation {
                    font-size: 3rem;
                    margin: 20px 0;
                    animation: pulse 1.5s infinite;
                }
                .waiting-message {
                    font-size: 1.2rem;
                    color: #ffaa44;
                    margin-bottom: 12px;
                }
                .waiting-submessage {
                    font-size: 0.8rem;
                    color: #888;
                }
                .waiting-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid #333;
                    border-top-color: #4caf50;
                    border-radius: 50%;
                    margin: 20px auto 0;
                    animation: spin 1s linear infinite;
                }
                .celebration-modal {
                    background: linear-gradient(145deg, #1a3a1a 0%, #0a1a0a 100%);
                    border-radius: 48px;
                    padding: 32px;
                    max-width: 500px;
                    width: 90%;
                    text-align: center;
                    border: 3px solid #ffaa44;
                    box-shadow: 0 0 50px rgba(255,170,68,0.4);
                    animation: bounceIn 0.6s ease-out;
                }
                .celebration-image-container {
                    margin-bottom: 16px;
                }
                .celebration-image {
                    max-width: 100%;
                    max-height: 200px;
                    border-radius: 24px;
                    object-fit: cover;
                }
                .celebration-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #ffaa44;
                    margin-bottom: 16px;
                }
                .celebration-beer {
                    font-size: 2rem;
                    font-weight: 800;
                    color: #4caf50;
                    margin-bottom: 20px;
                    letter-spacing: 2px;
                    animation: bounce 0.5s ease 2;
                }
                .celebration-winner {
                    font-size: 1.5rem;
                    font-weight: 800;
                    margin-bottom: 16px;
                    padding: 12px;
                    border-radius: 60px;
                }
                .winner-a { background: rgba(76,175,80,0.2); color: #4caf50; }
                .winner-b { background: rgba(76,175,80,0.2); color: #4caf50; }
                .winner-tie { background: rgba(255,170,68,0.2); color: #ffaa44; }
                .celebration-score {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #fff;
                    margin-bottom: 24px;
                }
                .celebration-players {
                    background: rgba(0,0,0,0.5);
                    border-radius: 24px;
                    padding: 16px;
                    margin-bottom: 24px;
                }
                .celebration-players-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #ffaa44;
                    margin-bottom: 12px;
                }
                .celebration-players-list {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 8px;
                }
                .winning-player {
                    background: #1a3a1a;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #4caf50;
                }
                .confetti {
                    position: fixed;
                    width: 10px;
                    height: 10px;
                    top: -10px;
                    border-radius: 2px;
                    animation: fall linear forwards;
                    z-index: 3001;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes bounceIn {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); }
                    70% { transform: scale(0.95); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes fall {
                    to { transform: translateY(100vh) rotate(360deg); opacity: 0; }
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
    
    async function submitSignature(gameId, flight, captainName, collection) {
        var updatePayload = {};
        updatePayload[`signatures.f${flight}.signed`] = true;
        updatePayload[`signatures.f${flight}.signedAt`] = firebase.firestore.FieldValue.serverTimestamp();
        if (captainName) {
            updatePayload[`signatures.f${flight}.captainName`] = captainName;
        }
        updatePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        try {
            await firebase.firestore().collection(collection).doc(gameId).update(updatePayload);
            console.log(`Flight ${flight} signature submitted`);
            return true;
        } catch (error) {
            console.error("Signature error:", error);
            return false;
        }
    }
    
    function isGameCompleted(signatures) {
        if (!signatures) return false;
        return signatures.f1?.signed === true && signatures.f2?.signed === true;
    }
    
    function getWinner(trTeamA, trTeamB) {
        if (trTeamA > trTeamB) return "A";
        if (trTeamB > trTeamA) return "B";
        return "Tie";
    }
    
    return {
        showWaitingScreen: showWaitingScreen,
        hideWaitingScreen: hideWaitingScreen,
        showCelebrationScreen: showCelebrationScreen,
        submitSignature: submitSignature,
        isGameCompleted: isGameCompleted,
        getWinner: getWinner,
        launchConfetti: launchConfetti
    };
})();

/*
FILE: js/sign-card.js
VERSION: 1.03
KEY CHANGES:
   - Fixed celebration image: always uses celebration.jpg
   - Button changed to "🏌️ Handicap Adjustment"
   - Button calls HandicapAdjustment.init() when clicked
   - Removed random image selection logic
   - 8 confetti bursts, 2 seconds apart
   - Match Complete as main heading
DEPENDS ON: Firebase Firestore, js/hcp-adjust.js (to be created)
STATUS: Ready for integration
*/