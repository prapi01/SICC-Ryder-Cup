/*
FILE: js/sign-card.js
VERSION: 1.16
KEY CHANGES from v1.15:
   - FIXED: gameId now properly captured in setTimeout closure
   - Added fallback to get gameId from celebrationData if undefined
   - Added debug logging for gameId before navigation
   - All existing functionality preserved from v1.15
DEPENDS ON: Firebase Firestore, js/history-record.js, js/hcp-adjust.js, js/waiting-screen.js
STATUS: Ready for integration
*/

var SignCard = (function() {
    
    // ============================================================
    // Helper: Get Firestore instance
    // ============================================================
    function getDb() {
        return firebase.firestore();
    }
    
    // ============================================================
    // Celebration image - detects C.jpg or C.jpeg (bypass cache)
    // ============================================================
    
    var cachedImagePath = null;
    var imageCheckPromise = null;
    
    function getCelebrationImage(callback) {
        if (cachedImagePath !== null) {
            if (callback) callback(cachedImagePath);
            return;
        }
        
        if (imageCheckPromise) {
            imageCheckPromise.then(function(path) {
                if (callback) callback(path);
            });
            return;
        }
        
        var cacheBuster = '?t=' + Date.now();
        var formats = ['/images/celebration/C.jpg', '/images/celebration/C.jpeg'];
        var currentIndex = 0;
        
        imageCheckPromise = new Promise(function(resolve) {
            function tryNext() {
                if (currentIndex >= formats.length) {
                    cachedImagePath = null;
                    resolve(null);
                    if (callback) callback(null);
                    return;
                }
                var url = formats[currentIndex] + cacheBuster;
                var img = new Image();
                img.onload = function() {
                    cachedImagePath = formats[currentIndex];
                    resolve(formats[currentIndex]);
                    if (callback) callback(formats[currentIndex]);
                };
                img.onerror = function() {
                    currentIndex++;
                    tryNext();
                };
                img.src = url;
            }
            tryNext();
        });
        
        return imageCheckPromise;
    }
    
    // ============================================================
    // Waiting Screen (legacy - kept for compatibility)
    // ============================================================
    
    function showWaitingScreen(flightNumber, onComplete) {
        var existingModal = document.getElementById('waitingModal');
        if (existingModal) existingModal.remove();
        
        var modalHtml = `
            <div class="modal-overlay" id="waitingModal" style="z-index: 3000;">
                <div class="waiting-modal-container">
                    <div class="waiting-title">⌛ CARD SIGNED</div>
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
    
    // ============================================================
    // Confetti - 8 bursts, 2 seconds apart
    // ============================================================
    
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
    
    function clearConfetti() {
        var confetti = document.querySelectorAll('.confetti');
        confetti.forEach(function(el) { el.remove(); });
    }
    
    // ============================================================
    // Helper: Get or create archive record for handicap adjustment
    // ============================================================
    
    function ensureArchiveRecord(gameId, callback) {
        if (typeof HistoryRecord !== 'undefined' && HistoryRecord.getArchivedGameByOriginalId) {
            HistoryRecord.getArchivedGameByOriginalId(gameId, function(err, result) {
                if (!err && result && result.id) {
                    callback(null, result.id);
                } else {
                    if (typeof HistoryRecord !== 'undefined' && HistoryRecord.createPendingRecord) {
                        var db = getDb();
                        db.collection('scheduledGames').doc(gameId).get()
                            .then(function(doc) {
                                if (doc.exists) {
                                    var gameData = doc.data();
                                    var results = gameData.results || {};
                                    var finalScores = {
                                        teamA: results.tr?.teamA?.[17] || 9.5,
                                        teamB: results.tr?.teamB?.[17] || 9.5
                                    };
                                    var signatures = gameData.signatures || {};
                                    
                                    var flight1DataString = gameData.f1?.d || "";
                                    var flight2DataString = gameData.f2?.d || "";
                                    
                                    var matchResults = {};
                                    if (results.game1 && results.game1.matches) {
                                        matchResults = results.game1.matches;
                                    }
                                    
                                    HistoryRecord.createPendingRecord(
                                        gameId, 
                                        gameData, 
                                        results, 
                                        finalScores, 
                                        signatures,
                                        flight1DataString,
                                        flight2DataString,
                                        matchResults,
                                        function(err, archiveId) {
                                            if (err) callback(err, null);
                                            else callback(null, archiveId);
                                        }
                                    );
                                } else {
                                    callback(new Error("Game not found"), null);
                                }
                            })
                            .catch(function(err) {
                                callback(err, null);
                            });
                    } else {
                        callback(new Error("HistoryRecord not available"), null);
                    }
                }
            });
        } else {
            callback(new Error("HistoryRecord not available"), null);
        }
    }
    
    // ============================================================
    // Celebration Screen - v1.16: FIXED gameId closure
    // ============================================================
    
    function showCelebrationScreen(winner, teamAScore, teamBScore, winningPlayers, gameId, onClose) {
        var existingModal = document.getElementById('celebrationModal');
        if (existingModal) existingModal.remove();
        
        clearConfetti();
        
        var winnerText = "";
        var winnerClass = "";
        
        if (winner === "A") {
            winnerText = "🏆 TEAM A WINS! 🏆";
            winnerClass = "winner-a";
        } else if (winner === "B") {
            winnerText = "🏆 TEAM B WINS! 🏆";
            winnerClass = "winner-b";
        } else {
            winnerText = "🤝 TIE GAME! 🤝";
            winnerClass = "winner-tie";
        }
        
        var teamADisplay = teamAScore % 1 === 0 ? teamAScore : teamAScore.toFixed(1);
        var teamBDisplay = teamBScore % 1 === 0 ? teamBScore : teamBScore.toFixed(1);
        
        // v1.16: Store data in a closure variable that will be accessible in setTimeout
        var celebrationData = {
            winner: winner,
            teamAScore: teamAScore,
            teamBScore: teamBScore,
            winningPlayers: winningPlayers,
            gameId: gameId,
            onClose: onClose
        };
        
        getCelebrationImage(function(imageSrc) {
            var imageHtml = '';
            if (imageSrc) {
                imageHtml = `
                    <div class="celebration-image-container">
                        <img src="${imageSrc}" class="celebration-image" alt="Celebration" crossorigin="anonymous">
                    </div>
                `;
            } else {
                imageHtml = '<div class="celebration-image-container" style="font-size:4rem;">🏆</div>';
            }
            
            var modalHtml = `
                <div class="modal-overlay celebration-overlay" id="celebrationModal" style="z-index: 3000;">
                    <div class="celebration-modal">
                        ${imageHtml}
                        <div class="celebration-title">🏌️ MATCH COMPLETE!</div>
                        <div class="celebration-beer">🍺 BEER TIME! 🍺</div>
                        <div class="celebration-winner ${winnerClass}">
                            ${winnerText}
                        </div>
                        <div class="celebration-score">
                            <span class="score-team-a">Team A ${teamADisplay}</span>
                            <span class="score-vs">│</span>
                            <span class="score-team-b">${teamBDisplay} Team B</span>
                        </div>
                        <button class="celebration-btn" id="handicapAdjustBtn">🏌️ HANDICAP ADJUSTMENT</button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            addCelebrationStyles();
            launchConfetti();
            
            // Call onClose callback after modal is rendered
            setTimeout(function() {
                console.log("[SignCard] Celebration modal fully rendered - calling onClose callback");
                if (typeof onClose === 'function') {
                    onClose();
                }
            }, 500);
            
            // v1.16: Button handler with proper gameId closure
            var btn = document.getElementById("handicapAdjustBtn");
            if (btn) {
                var newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                // v1.16: Capture gameId in closure for the click handler
                var capturedGameId = gameId;
                
                newBtn.addEventListener("click", function() {
                    console.log("[SignCard] HANDICAP ADJUSTMENT button clicked");
                    
                    // v1.16: Use capturedGameId, fallback to celebrationData.gameId
                    var targetGameId = capturedGameId || celebrationData.gameId;
                    console.log("[SignCard] targetGameId:", targetGameId);
                    
                    if (!targetGameId) {
                        console.error("[SignCard] No gameId available for navigation");
                        if (typeof Modal !== 'undefined') {
                            Modal.alert("Unable to load handicap adjustment. Please try again.");
                        }
                        return;
                    }
                    
                    // Show waiting screen
                    if (typeof WaitingScreen !== 'undefined' && WaitingScreen.show) {
                        WaitingScreen.show("Loading Handicap Adjustment...");
                        console.log("[SignCard] Waiting screen shown");
                    } else {
                        var overlay = document.createElement('div');
                        overlay.id = 'waitingScreenOverlay';
                        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
                        overlay.innerHTML = '<div style="font-size:5rem;filter:grayscale(100%);opacity:0.6;">⛳</div><div style="color:#888;font-size:0.8rem;margin-top:16px;letter-spacing:1px;">Loading Handicap Adjustment...</div>';
                        document.body.appendChild(overlay);
                        console.log("[SignCard] Fallback waiting screen shown");
                    }
                    
                    // Remove celebration modal
                    var modal = document.getElementById('celebrationModal');
                    if (modal) {
                        modal.remove();
                        console.log("[SignCard] Celebration modal removed");
                    }
                    
                    clearConfetti();
                    console.log("[SignCard] Confetti cleared");
                    
                    // v1.16: Navigate to standalone hcp-adjust page with captured gameId
                    setTimeout(function() {
                        var navigateUrl = 'hcp-adjust.html?gameId=' + targetGameId;
                        console.log("[SignCard] Navigating to:", navigateUrl);
                        window.location.href = navigateUrl;
                    }, 300);
                });
            }
            
            window._currentCelebrationData = celebrationData;
        });
    }
    
    function replayCelebration() {
        var existingModal = document.getElementById('celebrationModal');
        if (existingModal) existingModal.remove();
        
        if (window._currentCelebrationData) {
            var data = window._currentCelebrationData;
            showCelebrationScreen(data.winner, data.teamAScore, data.teamBScore, data.winningPlayers, data.gameId, data.onClose);
        }
    }
    
    // ============================================================
    // Celebration Styles
    // ============================================================
    
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
                    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                }
                
                .celebration-overlay {
                    border-radius: 0 !important;
                    overflow: visible !important;
                }
                
                .waiting-modal-container {
                    background: #1a1a1a;
                    border-radius: 28px;
                    padding: 32px;
                    max-width: 360px;
                    width: 90%;
                    text-align: center;
                    border: 2px solid #4caf50;
                }
                .waiting-title {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: #4caf50;
                    margin-bottom: 20px;
                }
                .waiting-message {
                    font-size: 0.95rem;
                    color: #ffaa44;
                    margin-bottom: 8px;
                }
                .waiting-submessage {
                    font-size: 0.75rem;
                    color: #888;
                }
                .waiting-spinner {
                    width: 32px;
                    height: 32px;
                    border: 2px solid #333;
                    border-top-color: #4caf50;
                    border-radius: 50%;
                    margin: 24px auto 0;
                    animation: spin 1s linear infinite;
                }
                
                .celebration-modal {
                    background: #1a1a1a;
                    border-radius: 24px !important;
                    border-top-left-radius: 24px !important;
                    border-top-right-radius: 24px !important;
                    border-bottom-left-radius: 24px !important;
                    border-bottom-right-radius: 24px !important;
                    overflow: hidden !important;
                    padding: 24px 28px 20px 28px;
                    max-width: 95%;
                    width: auto;
                    min-width: 320px;
                    max-width: 500px;
                    text-align: center;
                    border: 2px solid #ffaa44;
                    box-shadow: 0 0 40px rgba(255,170,68,0.15);
                    animation: bounceIn 0.6s ease-out;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .celebration-modal > * {
                    border-radius: inherit !important;
                }
                
                .celebration-image-container {
                    margin-bottom: 12px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 16px !important;
                    overflow: hidden !important;
                }
                .celebration-image {
                    max-width: 100%;
                    max-height: 40vh;
                    min-height: 120px;
                    border-radius: 16px !important;
                    object-fit: cover;
                    border: 1px solid #2a2a2a;
                }
                
                .celebration-title {
                    font-size: 28px;
                    font-weight: 800;
                    color: #ffaa44;
                    margin-bottom: 8px;
                    letter-spacing: 0.5px;
                }
                
                .celebration-beer {
                    font-size: 36px;
                    font-weight: 800;
                    color: #4caf50;
                    margin-bottom: 8px;
                    letter-spacing: 1px;
                    animation: bounce 0.5s ease 2;
                }
                
                .celebration-winner {
                    font-size: 24px;
                    font-weight: 800;
                    margin-bottom: 12px;
                    padding: 12px 24px;
                    border-radius: 40px;
                    display: inline-block;
                }
                .winner-a { 
                    background: rgba(76,175,80,0.2); 
                    color: #4caf50;
                    border: 1px solid #4caf50;
                }
                .winner-b { 
                    background: rgba(76,175,80,0.2); 
                    color: #4caf50;
                    border: 1px solid #4caf50;
                }
                .winner-tie { 
                    background: rgba(255,170,68,0.2); 
                    color: #ffaa44;
                    border: 1px solid #ffaa44;
                }
                
                .celebration-score {
                    font-size: 28px;
                    font-weight: 700;
                    color: #ffffff;
                    margin-bottom: 16px;
                    padding: 12px 0;
                    border-top: 1px solid #2a2a2a;
                    border-bottom: 1px solid #2a2a2a;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 20px;
                }
                .score-team-a { color: #4caf50; }
                .score-team-b { color: #4caf50; }
                .score-vs { color: #555555; font-weight: 300; }
                
                .celebration-btn {
                    background: #1a3a1a;
                    border: 1px solid #4caf50;
                    color: #4caf50;
                    padding: 16px 24px;
                    border-radius: 40px;
                    font-size: 20px;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s;
                    letter-spacing: 0.5px;
                    margin-top: 4px;
                }
                .celebration-btn:hover {
                    background: #2a4a2a;
                    transform: scale(1.01);
                }
                .celebration-btn:active {
                    transform: scale(0.98);
                }
                
                @media (max-width: 380px) {
                    .celebration-modal {
                        padding: 16px 16px 16px 16px;
                        min-width: auto;
                        width: 94%;
                    }
                    .celebration-title { font-size: 22px; }
                    .celebration-beer { font-size: 28px; }
                    .celebration-winner { font-size: 18px; padding: 8px 16px; }
                    .celebration-score { font-size: 20px; gap: 12px; padding: 10px 0; }
                    .celebration-btn { font-size: 16px; padding: 14px 16px; }
                    .celebration-image { max-height: 30vh; min-height: 80px; }
                }
                
                @media (min-width: 401px) and (max-width: 500px) {
                    .celebration-modal { padding: 24px 28px 20px 28px; }
                    .celebration-title { font-size: 28px; }
                    .celebration-beer { font-size: 36px; }
                    .celebration-winner { font-size: 24px; }
                    .celebration-score { font-size: 28px; }
                    .celebration-image { max-height: 35vh; }
                }
                
                @media (min-width: 501px) {
                    .celebration-modal { padding: 32px 36px 24px 36px; max-width: 480px; }
                    .celebration-title { font-size: 32px; }
                    .celebration-beer { font-size: 40px; }
                    .celebration-winner { font-size: 28px; padding: 14px 28px; }
                    .celebration-score { font-size: 32px; gap: 28px; }
                    .celebration-btn { font-size: 22px; padding: 18px 28px; }
                    .celebration-image { max-height: 45vh; }
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
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes bounceIn {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.03); }
                    70% { transform: scale(0.97); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes fall {
                    to { transform: translateY(100vh) rotate(360deg); opacity: 0; }
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    // ============================================================
    // Helpers
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
    // Signature Submission
    // ============================================================
    
    async function submitSignature(gameId, flight, captainName, collection) {
        var db = getDb();
        var updatePayload = {};
        updatePayload['signatures.f' + flight + '.signed'] = true;
        updatePayload['signatures.f' + flight + '.signedAt'] = firebase.firestore.FieldValue.serverTimestamp();
        if (captainName) {
            updatePayload['signatures.f' + flight + '.captainName'] = captainName;
        }
        updatePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        try {
            await db.collection(collection).doc(gameId).update(updatePayload);
            console.log('Flight ' + flight + ' signature submitted');
            return true;
        } catch (error) {
            console.error('Signature error:', error);
            return false;
        }
    }
    
    function isGameCompleted(signatures) {
        if (!signatures) return false;
        return signatures.f1?.signed === true && signatures.f2?.signed === true;
    }
    
    function getWinner(trTeamA, trTeamB) {
        if (trTeamA > trTeamB) return 'A';
        if (trTeamB > trTeamA) return 'B';
        return 'Tie';
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        showWaitingScreen: showWaitingScreen,
        hideWaitingScreen: hideWaitingScreen,
        showCelebrationScreen: showCelebrationScreen,
        replayCelebration: replayCelebration,
        submitSignature: submitSignature,
        isGameCompleted: isGameCompleted,
        getWinner: getWinner,
        launchConfetti: launchConfetti,
        clearConfetti: clearConfetti,
        ensureArchiveRecord: ensureArchiveRecord
    };
    
})();

// Make available globally
window.SignCard = SignCard;

/*
FILE: js/sign-card.js
VERSION: 1.16
KEY CHANGES from v1.15:
   - FIXED: gameId now properly captured in setTimeout closure
   - Added fallback to get gameId from celebrationData if undefined
   - Added debug logging for gameId before navigation
   - All existing functionality preserved from v1.15
DEPENDS ON: Firebase Firestore, js/history-record.js, js/hcp-adjust.js, js/waiting-screen.js
STATUS: Ready for integration
*/