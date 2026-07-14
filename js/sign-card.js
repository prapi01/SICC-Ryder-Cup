/*
FILE: js/sign-card.js
VERSION: 1.34
KEY CHANGES from v1.33:
   - CHANGED: Celebration score layout to match view-history (single divider between columns)
   - REASON: "Team B" label was overflowing on 393px screens
   - CHANGED: Layout now uses ONE divider between Team A and Team B columns
   - CHANGED: Labels on top row, scores on bottom row (matching view-history style)
   - PRESERVED: ALL font sizes and colors unchanged from v1.33
   - PRESERVED: ALL other functionality from v1.33 unchanged
DEPENDS ON: Firebase Firestore, js/history-record.js, js/game-loader.js, WRV.js
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
    // v1.31: Refresh cache from Firestore before signing
    // ============================================================
    function refreshCacheBeforeSigning(gameId, callback) {
        console.log('[SignCard] Refreshing cache from Firestore before signing...');
        
        if (typeof GameLoader !== 'undefined' && GameLoader.refreshCacheFromFirestore) {
            GameLoader.refreshCacheFromFirestore(gameId, function(err, cache) {
                if (err) {
                    console.warn('[SignCard] Cache refresh failed, using existing:', err.message);
                    if (callback) callback(null, GameLoader.getLocalCache());
                } else {
                    console.log('[SignCard] Cache refreshed successfully');
                    if (callback) callback(null, cache);
                }
            });
        } else {
            console.warn('[SignCard] GameLoader.refreshCacheFromFirestore not available');
            if (callback) callback(null, null);
        }
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
    // v1.32: Celebration image - sessionStorage ONLY (no GitHub fallback)
    // ============================================================
    
    var cachedImagePath = null;
    var SESSION_STORAGE_KEY = 'celebrationPhoto';
    
    function getCelebrationImage(callback) {
        // Check sessionStorage (instant, no network)
        var photoDataUrl = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (photoDataUrl) {
            console.log('[SignCard] Photo found in sessionStorage - using directly');
            cachedImagePath = photoDataUrl;
            if (callback) callback(photoDataUrl);
            return;
        }
        
        // v1.32: No GitHub fallback - sessionStorage should ALWAYS have a photo
        // (default photo is loaded at game start for all devices)
        console.warn('[SignCard] No photo in sessionStorage - this should not happen');
        console.warn('[SignCard] Default photo should have been loaded at game start');
        if (callback) callback(null);
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
    // Celebration Screen - v1.34: Single divider between columns
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
        
        // v1.27: Losing team score RED, winning team GREEN
        var teamALost = (winner === 'B');
        var teamBLost = (winner === 'A');
        var teamAColor = teamALost ? '#ff4444' : '#4caf50';
        var teamBColor = teamBLost ? '#ff4444' : '#4caf50';
        
        var celebrationData = {
            winner: winner,
            teamAScore: teamAScore,
            teamBScore: teamBScore,
            winningPlayers: winningPlayers,
            gameId: gameId,
            onClose: onClose
        };
        
        // v1.32: Get photo from sessionStorage (no fallback)
        getCelebrationImage(function(imageSrc) {
            var imageHtml = '';
            if (imageSrc) {
                // Check if it's a data URL from sessionStorage or a path
                var src = imageSrc.startsWith('data:image') ? imageSrc : imageSrc;
                imageHtml = `
                    <div class="celebration-image-container">
                        <img src="${src}" class="celebration-image" alt="Celebration" crossorigin="anonymous">
                    </div>
                `;
            } else {
                // Fallback: show trophy icon if no photo (should never happen)
                console.warn('[SignCard] No photo available for celebration screen');
                imageHtml = '<div class="celebration-image-container" style="font-size:4rem;">🏆</div>';
            }
            
            // v1.34: Score layout with ONE divider between columns (matching view-history)
            var modalHtml = `
                <div class="modal-overlay celebration-overlay" id="celebrationModal" style="z-index: 3000;">
                    <div class="celebration-modal">
                        ${imageHtml}
                        <div class="celebration-title">🏌️ GAME COMPLETED!</div>
                        <div class="celebration-beer">🍺 BEER TIME! 🍺</div>
                        <div class="celebration-winner ${winnerClass}">
                            ${winnerText}
                        </div>
                        <div class="celebration-score" style="padding:12px 0; border-top:1px solid #2a2a2a; border-bottom:1px solid #2a2a2a;">
                            <div style="display:flex; justify-content:center; align-items:center; gap:20px;">
                                <div style="text-align:center; flex:1;">
                                    <div style="font-size:1.2rem; font-weight:600; color:#4caf50;">Team A</div>
                                    <div style="font-size:2.4rem; font-weight:700; color:${teamAColor};">${teamADisplay}</div>
                                </div>
                                <div style="font-size:1.6rem; color:#555555;">│</div>
                                <div style="text-align:center; flex:1;">
                                    <div style="font-size:1.2rem; font-weight:600; color:#4caf50;">Team B</div>
                                    <div style="font-size:2.4rem; font-weight:700; color:${teamBColor};">${teamBDisplay}</div>
                                </div>
                            </div>
                        </div>
                        <button class="celebration-btn" id="handicapAdjustBtn">🏌️ HANDICAP ADJUSTMENT</button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            addCelebrationStyles();
            launchConfetti();
            
            var capturedGameId = gameId;
            
            setTimeout(function() {
                console.log("[SignCard] Celebration modal fully rendered - calling onClose callback");
                if (typeof onClose === 'function') {
                    onClose();
                }
            }, 500);
            
            var btn = document.getElementById('handicapAdjustBtn');
            if (btn) {
                if (!btn._listenerAttached) {
                    btn.addEventListener('click', function(e) {
                        console.log("[SignCard] HANDICAP ADJUSTMENT button clicked");
                        
                        var targetGameId = capturedGameId || celebrationData.gameId;
                        console.log("[SignCard] targetGameId:", targetGameId);
                        
                        if (!targetGameId) {
                            console.error("[SignCard] No gameId available for navigation");
                            if (typeof Modal !== 'undefined') {
                                Modal.alert("Unable to load handicap adjustment. Please try again.");
                            }
                            return;
                        }
                        
                        try {
                            sessionStorage.setItem('celebrationData', JSON.stringify(celebrationData));
                            console.log("[SignCard] Celebration data saved to sessionStorage");
                        } catch(e) {
                            console.warn("[SignCard] Failed to save celebration data:", e.message);
                        }
                        
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
                        
                        var modal = document.getElementById('celebrationModal');
                        if (modal) {
                            modal.remove();
                            console.log("[SignCard] Celebration modal removed");
                        }
                        
                        clearConfetti();
                        console.log("[SignCard] Confetti cleared");
                        
                        setTimeout(function() {
                            var navigateUrl = 'hcp-adjust.html?gameId=' + targetGameId;
                            console.log("[SignCard] Navigating to:", navigateUrl);
                            window.location.href = navigateUrl;
                        }, 300);
                    });
                    btn._listenerAttached = true;
                }
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
    // Celebration Styles - v1.34: Updated to match new layout
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
                
                /* v1.34: Celebration score with single divider */
                .celebration-score {
                    padding: 12px 0;
                    border-top: 1px solid #2a2a2a;
                    border-bottom: 1px solid #2a2a2a;
                }
                .celebration-score .score-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 20px;
                }
                .celebration-score .score-col {
                    text-align: center;
                    flex: 1;
                }
                .celebration-score .score-label {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #4caf50;
                }
                .celebration-score .score-number {
                    font-size: 2.4rem;
                    font-weight: 700;
                }
                .celebration-score .score-divider {
                    font-size: 1.6rem;
                    color: #555555;
                }
                
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
                    .celebration-score .score-container { gap: 12px; }
                    .celebration-score .score-label { font-size: 1rem; }
                    .celebration-score .score-number { font-size: 1.8rem; }
                    .celebration-score .score-divider { font-size: 1.2rem; }
                    .celebration-btn { font-size: 16px; padding: 14px 16px; }
                    .celebration-image { max-height: 30vh; min-height: 80px; }
                }
                
                @media (min-width: 401px) and (max-width: 500px) {
                    .celebration-modal { padding: 24px 28px 20px 28px; }
                    .celebration-title { font-size: 28px; }
                    .celebration-beer { font-size: 36px; }
                    .celebration-winner { font-size: 24px; }
                    .celebration-score .score-number { font-size: 2.4rem; }
                    .celebration-image { max-height: 35vh; }
                }
                
                @media (min-width: 501px) {
                    .celebration-modal { padding: 32px 36px 24px 36px; max-width: 480px; }
                    .celebration-title { font-size: 32px; }
                    .celebration-beer { font-size: 40px; }
                    .celebration-winner { font-size: 28px; padding: 14px 28px; }
                    .celebration-score .score-number { font-size: 3rem; }
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
    // v1.31: Build complete history record payload
    // ============================================================
    function buildHistoryPayload(gameId, cache, gameData) {
        // Use the cache data (already refreshed from Firestore)
        var players = cache.players || [];
        var course = cache.course || {};
        var results = cache.results || {};
        var signatures = cache.signatures || {};
        var f1DataString = cache.f1DataString || "";
        var f2DataString = cache.f2DataString || "";
        var startingHole = cache.startingHole || 1;
        var teamGameFormat = cache.teamGameFormat || "tournament";
        
        // Final scores from TR
        var trTeamA = results.tr?.teamA?.[17] || 9.5;
        var trTeamB = results.tr?.teamB?.[17] || 9.5;
        var winner = trTeamA > trTeamB ? "A" : (trTeamB > trTeamA ? "B" : "Tie");
        var winnerText = winner === "A" ? "Team A Wins!" : (winner === "B" ? "Team B Wins!" : "Tie Game!");
        
        // Photo path (fixed convention)
        var photoPath = 'celebration/' + gameId + '_H.jpg';
        
        // Store starting handicaps for all players
        var playersWithStartingHcp = players.map(function(p) {
            return {
                name: p.name,
                label: p.label,
                handicap: p.handicap,
                team: p.team,
                flight: p.flight
            };
        });
        
        // Build signatures (only signed: true/false)
        var f1Signed = signatures.f1?.signed === true;
        var f2Signed = signatures.f2?.signed === true;
        var signatureData = {
            f1: { signed: f1Signed },
            f2: { signed: f2Signed }
        };
        
        // Celebration data
        var celebrationData = {
            imageRef: photoPath,
            imageUrl: null,  // Frontend will call getDownloadURL()
            status: 'pending',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        var archiveId = gameId + '_H';
        
        return {
            originalGameId: gameId,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "completed",
            version: 3,
            schema: "v3_strings",
            gameInfo: {
                date: gameData?.date || new Date().toISOString().split('T')[0],
                course: {
                    name: course.name || 'SICC Bukit Course',
                    id: course.id || '',
                    par: course.par || [],
                    si: course.si || []
                },
                startingHole: startingHole,
                teamGameFormat: teamGameFormat
            },
            players: playersWithStartingHcp,
            finalResults: {
                teamAScore: trTeamA,
                teamBScore: trTeamB,
                winner: winner,
                winnerText: winnerText
            },
            signatures: signatureData,
            f1DataString: f1DataString,
            f2DataString: f2DataString,
            results: results,
            adjustedHandicaps: null,  // Will be calculated and filled by hcp-adjust
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            archiveId: archiveId,
            celebration: celebrationData
        };
    }
    
    // ============================================================
    // v1.31: Trigger history record write in background (WRV)
    // User never waits - this runs async
    // ============================================================
    function triggerHistoryRecordWrite(gameId, cache, gameData) {
        console.log('[SignCard] 🔄 Triggering background history record write...');
        
        var archiveId = gameId + '_H';
        var payload = buildHistoryPayload(gameId, cache, gameData);
        
        // WRV write in background - user never waits
        if (typeof WRV !== 'undefined' && WRV.write) {
            WRV.write('historyGames', archiveId, payload, function(err, result) {
                if (err) {
                    console.warn('[SignCard] ⚠️ Background history record write failed:', err.message);
                    // WRV will retry automatically
                } else {
                    console.log('[SignCard] ✅ Background history record write completed');
                }
            });
        } else {
            console.warn('[SignCard] WRV not available, using direct write (background)');
            var db = getDb();
            db.collection('historyGames').doc(archiveId).set(payload)
                .then(function() {
                    console.log('[SignCard] ✅ History record written (direct)');
                })
                .catch(function(err) {
                    console.warn('[SignCard] ⚠️ History record write failed (direct):', err.message);
                });
        }
        
        // Immediately return - user doesn't wait
        console.log('[SignCard] Background write triggered, continuing...');
    }
    
    // ============================================================
    // v1.33: DOUBLE-LISTENER SYSTEM FOR SIGNATURE FLAGS - FIXED WRITE ORDER
    // - REFRESHES CACHE BEFORE SIGNING (ensures latest data)
    // - WAITS for Firestore write to complete before showing completion
    // - F2 writes history record (F1 never writes)
    // - WRV write is background (user never waits)
    // ============================================================
    
    function submitSignature(gameId, flight, captainName, collection) {
        return new Promise(function(resolve, reject) {
            var db = getDb();
            var docRef = db.collection(collection).doc(gameId);
            var flightKey = 'f' + flight;
            var otherFlightKey = flight === 1 ? 'f2' : 'f1';
            
            console.log('[SignCard] submitSignature called: flight', flight, 'gameId', gameId);
            
            // ============================================================
            // STEP 1: Refresh cache from Firestore BEFORE signing
            // This ensures we have the latest data from the other flight
            // ============================================================
            refreshCacheBeforeSigning(gameId, function(refreshErr, refreshedCache) {
                if (refreshErr) {
                    console.warn('[SignCard] Cache refresh had issues, continuing with existing:', refreshErr.message);
                }
                
                // Get the (now refreshed) cache
                var cache = typeof GameLoader !== 'undefined' ? GameLoader.getLocalCache() : null;
                var f1Signed = false;
                var f2Signed = false;
                
                if (cache) {
                    if (!cache.signatures) cache.signatures = {};
                    if (!cache.signatures.f1) cache.signatures.f1 = { signed: false };
                    if (!cache.signatures.f2) cache.signatures.f2 = { signed: false };
                    
                    // Update cache with our signature immediately
                    cache.signatures[flightKey] = {
                        signed: true
                    };
                    
                    f1Signed = cache.signatures.f1.signed === true;
                    f2Signed = cache.signatures.f2.signed === true;
                    
                    console.log('[SignCard] Cache updated IMMEDIATELY for flight', flight);
                    console.log('[SignCard] Cache now: f1.signed=' + f1Signed + ', f2.signed=' + f2Signed);
                } else {
                    console.warn('[SignCard] No cache available - UI may not update immediately');
                }
                
                var bothSigned = f1Signed && f2Signed;
                
                // ============================================================
                // STEP 2: Show waiting screen if not both signed
                // ============================================================
                if (!bothSigned) {
                    var waitingFor = flight === 1 ? 2 : 1;
                    console.log('[SignCard] Showing waiting screen for flight', waitingFor);
                    showWaitingScreen(waitingFor);
                }
                
                // ============================================================
                // STEP 3: Write signature to Firestore (both F1 and F2)
                // v1.33: This must COMPLETE before showing completion modal
                // ============================================================
                var maxRetries = 5;
                var attemptCount = 0;
                var confirmed = false;
                var writeTimeout = null;
                var listenerUnsubscribe = null;
                
                function performWrite(retryCount) {
                    attemptCount = retryCount + 1;
                    console.log('[SignCard] Write attempt', attemptCount, 'for flight', flight);
                    
                    docRef.get()
                        .then(function(doc) {
                            if (!doc.exists) {
                                throw new Error('Game document not found');
                            }
                            
                            var data = doc.data();
                            var signatures = data.signatures || {};
                            
                            if (!signatures.f1) {
                                signatures.f1 = { signed: false };
                            }
                            if (!signatures.f2) {
                                signatures.f2 = { signed: false };
                            }
                            
                            signatures[flightKey] = {
                                signed: true
                            };
                            
                            return docRef.update({
                                signatures: signatures,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        })
                        .then(function() {
                            console.log('[SignCard] Write attempt', attemptCount, 'successful for flight', flight);
                            
                            var confirmTimeout = 3000;
                            
                            if (listenerUnsubscribe) {
                                listenerUnsubscribe();
                            }
                            
                            listenerUnsubscribe = docRef.onSnapshot(function(snapshot) {
                                if (!snapshot.exists) return;
                                
                                var data = snapshot.data();
                                var signatures = data.signatures || {};
                                var f1SignedCheck = signatures.f1?.signed === true;
                                var f2SignedCheck = signatures.f2?.signed === true;
                                
                                var ourFlightSigned = flight === 1 ? f1SignedCheck : f2SignedCheck;
                                
                                if (ourFlightSigned) {
                                    if (!confirmed) {
                                        confirmed = true;
                                        console.log('[SignCard] ✅ CONFIRMED via listener: flight', flight, 'signed=true');
                                        
                                        if (listenerUnsubscribe) {
                                            listenerUnsubscribe();
                                            listenerUnsubscribe = null;
                                        }
                                        if (writeTimeout) {
                                            clearTimeout(writeTimeout);
                                            writeTimeout = null;
                                        }
                                        
                                        // v1.33: Now that write is confirmed, check both signed
                                        if (f1SignedCheck && f2SignedCheck) {
                                            console.log('[SignCard] Both signed (confirmed)!');
                                            
                                            // If this is F2, ensure history record is written
                                            if (flight === 2) {
                                                console.log('[SignCard] F2: History record write triggered from cache');
                                                // Trigger history record write (background)
                                                var gameData = cache ? cache._gameData : null;
                                                if (!gameData) {
                                                    docRef.get().then(function(doc) {
                                                        if (doc.exists) {
                                                            gameData = doc.data();
                                                        }
                                                        triggerHistoryRecordWrite(gameId, cache, gameData);
                                                    }).catch(function() {
                                                        triggerHistoryRecordWrite(gameId, cache, null);
                                                    });
                                                } else {
                                                    triggerHistoryRecordWrite(gameId, cache, gameData);
                                                }
                                            } else {
                                                console.log('[SignCard] F1 - not writing history record (F2 handles this)');
                                            }
                                            
                                            // v1.33: Now show completion modal (navigation happens here)
                                            if (typeof RealGameNav !== 'undefined' && RealGameNav.showGameCompleteModal) {
                                                RealGameNav.showGameCompleteModal(gameId);
                                            } else {
                                                showGameCompleteModalDirect(gameId);
                                            }
                                        }
                                        
                                        resolve(true);
                                    }
                                }
                            }, function(err) {
                                console.warn('[SignCard] Listener error:', err.message);
                            });
                            
                            writeTimeout = setTimeout(function() {
                                if (!confirmed) {
                                    console.warn('[SignCard] ⚠️ Confirmation timeout for flight', flight, '(attempt', attemptCount + ')');
                                    
                                    if (listenerUnsubscribe) {
                                        listenerUnsubscribe();
                                        listenerUnsubscribe = null;
                                    }
                                    
                                    if (attemptCount < maxRetries) {
                                        var delay = 1000 * Math.pow(1.5, attemptCount);
                                        console.log('[SignCard] Retrying in', delay, 'ms... (attempt', attemptCount + 1, 'of', maxRetries + ')');
                                        setTimeout(function() {
                                            performWrite(attemptCount);
                                        }, delay);
                                    } else {
                                        console.error('[SignCard] ❌ All', maxRetries, 'retries failed for flight', flight);
                                        reject(new Error('Failed to confirm signature after ' + maxRetries + ' retries'));
                                    }
                                }
                            }, confirmTimeout);
                        })
                        .catch(function(err) {
                            console.warn('[SignCard] Write attempt', attemptCount, 'failed:', err.message);
                            
                            if (attemptCount < maxRetries) {
                                var delay = 1000 * Math.pow(1.5, attemptCount);
                                console.log('[SignCard] Retrying in', delay, 'ms... (attempt', attemptCount + 1, 'of', maxRetries + ')');
                                setTimeout(function() {
                                    performWrite(attemptCount);
                                }, delay);
                            } else {
                                console.error('[SignCard] ❌ All', maxRetries, 'write attempts failed for flight', flight);
                                reject(err);
                            }
                        });
                }
                
                // v1.33: IMPORTANT - Wait for Firestore write to complete before showing completion
                performWrite(0);
                
                // v1.33: Removed the immediate showGameCompleteModal() call here
                // It is now called inside performWrite() after confirmation
            });
        });
    }
    
    function showGameCompleteModalDirect(gameId) {
        var existing = document.getElementById('gameCompleteModal');
        if (existing) return;
        
        console.log('[SignCard] Showing Game Complete modal directly (fallback)');
        
        var modalHtml = `
            <div class="modal-overlay" id="gameCompleteModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:10001; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);">
                <div style="background:#1a1a1a; border-radius:28px; padding:32px 28px; max-width:360px; width:90%; text-align:center; border:2px solid #4caf50;">
                    <div style="font-size:1.5rem; font-weight:700; color:#ffaa44; margin-bottom:12px;">🏆 GAME COMPLETED</div>
                    <div style="font-size:0.9rem; color:#ccc; margin-bottom:16px; line-height:1.4;">Both cards have been signed!</div>
                    <div style="font-size:1.5rem; margin-bottom:24px;">🍺 🏆 🍺</div>
                    <button id="seeResultsFromModalBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:14px; border-radius:40px; font-size:1rem; font-weight:700; cursor:pointer; width:100%; transition:all 0.2s;">🏆 SEE RESULTS</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        var btn = document.getElementById('seeResultsFromModalBtn');
        if (btn) {
            btn.addEventListener('click', function() {
                if (btn._clicked) return;
                btn._clicked = true;
                btn.disabled = true;
                btn.textContent = '⏳ Loading...';
                
                var modal = document.getElementById('gameCompleteModal');
                if (modal) modal.remove();
                
                window.location.href = 'post-game.html?gameId=' + gameId;
            });
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
        ensureArchiveRecord: ensureArchiveRecord,
        _cachedImagePath: cachedImagePath,
        refreshCacheBeforeSigning: refreshCacheBeforeSigning,
        triggerHistoryRecordWrite: triggerHistoryRecordWrite
    };
    
})();

// Make available globally
window.SignCard = SignCard;
window.SIGN_CARD_VERSION = "1.34";

/*
FILE: js/sign-card.js
VERSION: 1.34
KEY CHANGES from v1.33:
   - CHANGED: Celebration score layout to match view-history (single divider between columns)
   - REASON: "Team B" label was overflowing on 393px screens
   - CHANGED: Layout now uses ONE divider between Team A and Team B columns
   - CHANGED: Labels on top row, scores on bottom row (matching view-history style)
   - PRESERVED: ALL font sizes and colors unchanged from v1.33
   - PRESERVED: ALL other functionality from v1.33 unchanged
DEPENDS ON: Firebase Firestore, js/history-record.js, js/game-loader.js, WRV.js
STATUS: Ready for integration
*/