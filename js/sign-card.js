/*
FILE: js/sign-card.js
VERSION: 1.09
KEY CHANGES:
   - FIXED: ensureArchiveRecord() now passes all required parameters to createPendingRecord()
   - Added extraction of flight1DataString, flight2DataString, and matchResults from gameData
   - Now passes 8 parameters (gameId, gameData, results, finalScores, signatures, f1DataStr, f2DataStr, matchResults)
   - This ensures archive records store both holeData and raw data strings for history viewer
   - All other functionality unchanged from v1.08
DEPENDS ON: Firebase Firestore, js/history-record.js, js/hcp-adjust.js
STATUS: Ready for integration
*/

var SignCard = (function() {
    
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
    
    // ============================================================
    // Helper: Get or create archive record for handicap adjustment
    // FIXED in v1.09: Pass all required parameters to createPendingRecord
    // ============================================================
    
    function ensureArchiveRecord(gameId, callback) {
        if (typeof HistoryRecord !== 'undefined' && HistoryRecord.getArchivedGameByOriginalId) {
            HistoryRecord.getArchivedGameByOriginalId(gameId, function(err, result) {
                if (!err && result && result.id) {
                    callback(null, result.id);
                } else {
                    if (typeof HistoryRecord !== 'undefined' && HistoryRecord.createPendingRecord) {
                        firebase.firestore().collection('scheduledGames').doc(gameId).get()
                            .then(function(doc) {
                                if (doc.exists) {
                                    var gameData = doc.data();
                                    var results = gameData.results || {};
                                    var finalScores = {
                                        teamA: results.tr?.teamA?.[17] || 9.5,
                                        teamB: results.tr?.teamB?.[17] || 9.5
                                    };
                                    var signatures = gameData.signatures || {};
                                    
                                    // NEW IN v1.09: Extract the missing parameters
                                    var flight1DataString = gameData.f1?.d || "";
                                    var flight2DataString = gameData.f2?.d || "";
                                    
                                    // Build matchResults object from results.game1.matches
                                    var matchResults = {};
                                    if (results.game1 && results.game1.matches) {
                                        matchResults = results.game1.matches;
                                    }
                                    
                                    // Now pass all 8 parameters as expected by createPendingRecord
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
    // Celebration Screen - FULLY RESPONSIVE with 2-column grid
    // ============================================================
    
    function showCelebrationScreen(winner, teamAScore, teamBScore, winningPlayers, gameId, onClose) {
        var existingModal = document.getElementById('celebrationModal');
        if (existingModal) existingModal.remove();
        
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
        
        // Build player list as 2-column grid
        var playersHtml = '';
        for (var i = 0; i < winningTeamPlayers.length; i++) {
            playersHtml += '<span class="winning-player">' + escapeHtml(winningTeamPlayers[i].name) + '</span>';
        }
        
        var teamADisplay = teamAScore % 1 === 0 ? teamAScore : teamAScore.toFixed(1);
        var teamBDisplay = teamBScore % 1 === 0 ? teamBScore : teamBScore.toFixed(1);
        
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
                        <img src="${imageSrc}" class="celebration-image" alt="Celebration">
                    </div>
                `;
            } else {
                imageHtml = '<div class="celebration-image-container" style="font-size:3rem;">🏆</div>';
            }
            
            var modalHtml = `
                <div class="modal-overlay celebration-overlay" id="celebrationModal" style="z-index: 3000;">
                    <div class="celebration-modal">
                        ${imageHtml}
                        <div class="celebration-title">MATCH COMPLETE!</div>
                        <div class="celebration-beer">🍺 BEER TIME! 🍺</div>
                        <div class="celebration-winner ${winnerClass}">
                            ${winnerText}
                        </div>
                        <div class="celebration-score">
                            <span>Team A ${teamADisplay}</span>
                            <span>-</span>
                            <span>${teamBDisplay} Team B</span>
                        </div>
                        <div class="celebration-players">
                            <div class="celebration-players-title">🏅 ${winner === 'A' ? 'TEAM A' : (winner === 'B' ? 'TEAM B' : 'BOTH TEAMS')} 🏅</div>
                            <div class="celebration-players-list">
                                ${playersHtml || (winner === 'Tie' ? '<span class="winning-player">Great Match!</span>' : '')}
                            </div>
                        </div>
                        <button class="celebration-btn" id="handicapAdjustBtn">🏌️ HANDICAP ADJUSTMENT</button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            addCelebrationStyles();
            launchConfetti();
            
            document.getElementById("handicapAdjustBtn").addEventListener("click", function() {
                document.getElementById("celebrationModal").remove();
                
                ensureArchiveRecord(gameId, function(err, archiveId) {
                    if (err) {
                        console.error("Failed to get archive record:", err);
                        if (typeof HandicapAdjustment !== 'undefined' && HandicapAdjustment.init) {
                            HandicapAdjustment.init(gameId, null, celebrationData.winningPlayers, {}, {}, true);
                        }
                    } else {
                        var matchPoints = {};
                        if (typeof window !== 'undefined' && window.GameLoader) {
                            var cache = window.GameLoader.getLocalCache();
                            if (cache && cache.matchResults && cache.matchResults.cross) {
                                for (var key in cache.matchResults.cross) {
                                    if (key.indexOf('_vs_') !== -1) {
                                        var parts = key.split('_vs_');
                                        var playerA = parts[0];
                                        var playerB = parts[1];
                                        var value = cache.matchResults.cross[key];
                                        if (!matchPoints[playerA]) matchPoints[playerA] = { total: 0 };
                                        if (value > 0) matchPoints[playerA].total += 1;
                                        else if (value === 0) matchPoints[playerA].total += 0.5;
                                        if (!matchPoints[playerB]) matchPoints[playerB] = { total: 0 };
                                        if (value < 0) matchPoints[playerB].total += 1;
                                        else if (value === 0) matchPoints[playerB].total += 0.5;
                                    }
                                }
                            }
                        }
                        
                        if (typeof HandicapAdjustment !== 'undefined' && HandicapAdjustment.init) {
                            HandicapAdjustment.init(gameId, archiveId, celebrationData.winningPlayers, matchPoints, {}, false);
                        } else {
                            console.log("HandicapAdjustment module not loaded yet");
                            if (celebrationData.onClose) celebrationData.onClose();
                        }
                    }
                });
            });
            
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
    // Celebration Styles - RESPONSIVE with viewport units
    // ============================================================
    
    function addCelebrationStyles() {
        if (document.getElementById('sign-card-styles')) return;
        
        var styles = `
            <style id="sign-card-styles">
                /* Modal Overlay */
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
                
                /* Waiting Modal */
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
                
                /* Celebration Modal - RESPONSIVE */
                .celebration-modal {
                    background: linear-gradient(145deg, #1a3a1a 0%, #0a1a0a 100%);
                    border-radius: 24px;
                    padding: 5vh 5vw;
                    max-width: 90vw;
                    width: auto;
                    text-align: center;
                    border: 2px solid #ffaa44;
                    box-shadow: 0 0 30px rgba(255,170,68,0.3);
                    animation: bounceIn 0.6s ease-out;
                    max-height: 85vh;
                    overflow-y: auto;
                }
                .celebration-image-container {
                    margin-bottom: 8px;
                }
                .celebration-image {
                    max-width: 80%;
                    max-height: 25vh;
                    border-radius: 16px;
                    object-fit: cover;
                }
                .celebration-title {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #ffaa44;
                    margin-bottom: 4px;
                }
                .celebration-beer {
                    font-size: 1.4rem;
                    font-weight: 800;
                    color: #4caf50;
                    margin-bottom: 8px;
                    letter-spacing: 1px;
                    animation: bounce 0.5s ease 2;
                }
                .celebration-winner {
                    font-size: 1rem;
                    font-weight: 800;
                    margin-bottom: 8px;
                    padding: 6px;
                    border-radius: 40px;
                }
                .winner-a { background: rgba(76,175,80,0.2); color: #4caf50; }
                .winner-b { background: rgba(76,175,80,0.2); color: #4caf50; }
                .winner-tie { background: rgba(255,170,68,0.2); color: #ffaa44; }
                .celebration-score {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #fff;
                    margin-bottom: 12px;
                    display: flex;
                    justify-content: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .celebration-players {
                    background: rgba(0,0,0,0.5);
                    border-radius: 16px;
                    padding: 10px;
                    margin-bottom: 16px;
                }
                .celebration-players-title {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #ffaa44;
                    margin-bottom: 8px;
                }
                /* 2-COLUMN GRID FOR PLAYERS - prevents overflow */
                .celebration-players-list {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    justify-items: center;
                    align-items: center;
                }
                .winning-player {
                    background: #1a3a1a;
                    padding: 4px 8px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: #4caf50;
                    text-align: center;
                    width: 100%;
                    white-space: nowrap;
                    overflow-x: auto;
                    max-width: 100%;
                }
                .celebration-btn {
                    background: #1a3a1a;
                    border: 1px solid #4caf50;
                    color: #4caf50;
                    padding: 10px 20px;
                    border-radius: 40px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s;
                }
                .celebration-btn:hover {
                    background: #2a4a2a;
                    transform: scale(1.02);
                }
                
                /* Responsive breakpoint for very small screens */
                @media (max-width: 380px) {
                    .celebration-modal {
                        padding: 3vh 4vw;
                    }
                    .celebration-title {
                        font-size: 1rem;
                    }
                    .celebration-beer {
                        font-size: 1.2rem;
                    }
                    .celebration-winner {
                        font-size: 0.85rem;
                    }
                    .celebration-score {
                        font-size: 0.75rem;
                    }
                    .winning-player {
                        font-size: 0.6rem;
                        padding: 3px 6px;
                    }
                    .celebration-btn {
                        font-size: 0.75rem;
                        padding: 8px 16px;
                    }
                }
                
                /* Confetti */
                .confetti {
                    position: fixed;
                    width: 10px;
                    height: 10px;
                    top: -10px;
                    border-radius: 2px;
                    animation: fall linear forwards;
                    z-index: 3001;
                }
                
                /* Animations */
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
        ensureArchiveRecord: ensureArchiveRecord
    };
})();

/*
FILE: js/sign-card.js
VERSION: 1.09
KEY CHANGES:
   - FIXED: ensureArchiveRecord() now passes all required parameters to createPendingRecord()
   - Added extraction of flight1DataString, flight2DataString, and matchResults from gameData
   - Now passes 8 parameters (gameId, gameData, results, finalScores, signatures, f1DataStr, f2DataStr, matchResults)
   - This ensures archive records store both holeData and raw data strings for history viewer
   - All other functionality unchanged from v1.08
DEPENDS ON: Firebase Firestore, js/history-record.js, js/hcp-adjust.js
STATUS: Ready for integration
*/