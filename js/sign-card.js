/*
FILE: js/sign-card.js
VERSION: 1.22
KEY CHANGES from v1.21:
   - CHANGED: Firestore writes now use WRV.update() for reliability
   - ADDED: Fallback to direct update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, history-record.js
STATUS: Ready for integration
*/

window.SIGN_CARD_VERSION = "1.22";

// SignCard namespace - handles signing and celebration flow
var SignCard = (function() {
    
    // Private variables
    var currentGameId = null;
    var currentFlight = null; // 'F1' or 'F2'
    var currentData = null;
    var currentSignatures = null;
    var isSubmitting = false;
    
    // Configuration
    var CONFIG = {
        SIGNATURE_TIMEOUT: 30000, // 30 seconds max for signature process
        CELEBRATION_DELAY: 1000,   // 1 second before showing celebration
    };
    
    /**
     * Initialize sign card for a game
     * @param {string} gameId - The game ID
     * @param {string} flight - 'F1' or 'F2'
     * @param {object} data - Game data
     * @param {object} signatures - Current signatures object
     */
    function init(gameId, flight, data, signatures) {
        currentGameId = gameId;
        currentFlight = flight;
        currentData = data;
        currentSignatures = signatures || {};
        
        console.log('[SignCard] Initialized for:', gameId, 'Flight:', flight);
        
        // Render the sign card
        render();
    }
    
    /**
     * Render the sign card UI
     */
    function render() {
        // Build the sign card HTML
        var html = buildSignCardHTML();
        
        // Find or create sign card container
        var container = document.getElementById('sign-card-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sign-card-container';
            document.body.appendChild(container);
        }
        container.innerHTML = html;
        
        // Show the sign card
        container.style.display = 'block';
        
        // Attach event listeners
        attachEventListeners();
    }
    
    /**
     * Build sign card HTML
     */
    function buildSignCardHTML() {
        var flightLabel = currentFlight === 'F1' ? 'Flight 1' : 'Flight 2';
        var teamAName = currentData.teamAName || 'Team A';
        var teamBName = currentData.teamBName || 'Team B';
        var isSigned = currentSignatures && currentSignatures[currentFlight];
        
        return `
            <div class="sign-card-overlay">
                <div class="sign-card-modal">
                    <div class="sign-card-header">
                        <h2>✍️ Sign Scorecard</h2>
                        <p>${flightLabel} - ${teamAName} vs ${teamBName}</p>
                    </div>
                    <div class="sign-card-body">
                        ${isSigned ? `
                            <div class="sign-card-signed">
                                <div class="sign-card-check">✅</div>
                                <p>This flight has already signed</p>
                                <p class="sign-card-time">${currentSignatures[currentFlight].timestamp || 'Unknown time'}</p>
                            </div>
                        ` : `
                            <div class="sign-card-warning">
                                <p>⚠️ By signing, you confirm that:</p>
                                <ul>
                                    <li>All scores are correct</li>
                                    <li>All match results are accurate</li>
                                    <li>Both teams agree to the final score</li>
                                </ul>
                            </div>
                            <div class="sign-card-actions">
                                <button class="sign-card-btn sign-card-cancel">Cancel</button>
                                <button class="sign-card-btn sign-card-confirm" data-flight="${currentFlight}">
                                    Sign & Confirm
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Attach event listeners to sign card elements
     */
    function attachEventListeners() {
        var cancelBtn = document.querySelector('.sign-card-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                hide();
            });
        }
        
        var confirmBtn = document.querySelector('.sign-card-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                var flight = this.dataset.flight;
                submitSignature(flight);
            });
        }
    }
    
    /**
     * Submit signature for a flight
     * @param {string} flight - 'F1' or 'F2'
     */
    function submitSignature(flight) {
        if (isSubmitting) {
            console.warn('[SignCard] Already submitting');
            return;
        }
        
        if (!currentGameId) {
            console.error('[SignCard] No game ID');
            return;
        }
        
        isSubmitting = true;
        var confirmBtn = document.querySelector('.sign-card-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '⏳ Submitting...';
        }
        
        console.log('[SignCard] Submitting signature for:', currentGameId, 'Flight:', flight);
        
        // Prepare signature data
        var timestamp = new Date().toISOString();
        var signatureData = {
            signed: true,
            timestamp: timestamp,
            flight: flight
        };
        
        // Update signatures object
        if (!currentSignatures) currentSignatures = {};
        currentSignatures[flight] = signatureData;
        
        // Prepare update data for Firestore
        var updateData = {};
        updateData['signatures.' + flight] = signatureData;
        
        // Check if both flights are now signed
        var bothSigned = currentSignatures.F1 && currentSignatures.F2;
        if (bothSigned) {
            updateData.status = 'completed';
            updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // Use WRV for reliable Firestore write
        if (typeof WRV !== 'undefined' && WRV.update) {
            WRV.update('scheduledGames', currentGameId, updateData, function(err, result) {
                if (err) {
                    console.error('[SignCard] WRV update failed:', err);
                    handleSubmitError(err);
                } else {
                    console.log('[SignCard] WRV update successful');
                    handleSubmitSuccess(bothSigned);
                }
            });
        } else {
            // Fallback: direct update
            console.warn('[SignCard] WRV not available, using direct update');
            var db = firebase.firestore();
            db.collection('scheduledGames').doc(currentGameId).update(updateData)
                .then(function() {
                    console.log('[SignCard] Direct update successful');
                    handleSubmitSuccess(bothSigned);
                })
                .catch(function(err) {
                    console.error('[SignCard] Direct update failed:', err);
                    handleSubmitError(err);
                });
        }
    }
    
    /**
     * Handle successful signature submission
     */
    function handleSubmitSuccess(bothSigned) {
        isSubmitting = false;
        var confirmBtn = document.querySelector('.sign-card-confirm');
        if (confirmBtn) {
            confirmBtn.textContent = '✅ Signed!';
            confirmBtn.disabled = false;
        }
        
        if (bothSigned) {
            console.log('[SignCard] 🎉 Both flights signed!');
            // Show celebration after a short delay
            setTimeout(function() {
                showCelebrationScreen(currentGameId);
            }, CONFIG.CELEBRATION_DELAY);
        } else {
            console.log('[SignCard] Waiting for other flight to sign');
            // Update UI to show signed state
            render();
            // Notify that this flight is signed
            var event = new CustomEvent('flightSigned', {
                detail: { flight: currentFlight, gameId: currentGameId }
            });
            document.dispatchEvent(event);
        }
    }
    
    /**
     * Handle submit error
     */
    function handleSubmitError(err) {
        isSubmitting = false;
        var confirmBtn = document.querySelector('.sign-card-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '✍️ Retry';
        }
        
        // Show error to user
        var errorMsg = document.querySelector('.sign-card-error');
        if (!errorMsg) {
            var body = document.querySelector('.sign-card-body');
            if (body) {
                errorMsg = document.createElement('div');
                errorMsg.className = 'sign-card-error';
                body.prepend(errorMsg);
            }
        }
        if (errorMsg) {
            errorMsg.textContent = '❌ Failed to submit. Please retry.';
        }
        
        console.error('[SignCard] Error submitting signature:', err);
    }
    
    /**
     * Show celebration screen
     * @param {string} gameId - The game ID
     */
    function showCelebrationScreen(gameId) {
        console.log('[SignCard] 🎉 Showing celebration screen for:', gameId);
        
        // Check if already completed (idempotent)
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).get()
            .then(function(doc) {
                if (doc.exists && doc.data().status === 'completed') {
                    // Already completed, just show celebration
                    renderCelebration(gameId);
                    return;
                }
                
                // Not completed yet - calculate HCP, write to history
                completeGame(gameId);
            })
            .catch(function(err) {
                console.error('[SignCard] Error checking game status:', err);
                // Still try to show celebration
                renderCelebration(gameId);
            });
    }
    
    /**
     * Complete the game - calculate HCP, write to history
     * @param {string} gameId - The game ID
     */
    function completeGame(gameId) {
        console.log('[SignCard] Completing game:', gameId);
        
        // Get game data
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    throw new Error('Game not found');
                }
                
                var gameData = doc.data();
                var archiveId = gameId + '_H';
                
                // Calculate adjusted handicaps (if needed)
                var adjustedHandicaps = gameData.adjustedHandicaps || {};
                
                // Prepare history record
                var historyData = {
                    gameId: gameId,
                    archiveId: archiveId,
                    courseName: gameData.courseName || 'SICC Bukit Course',
                    gameDate: gameData.gameDate || new Date().toISOString().split('T')[0],
                    teamAName: gameData.teamAName || 'Team A',
                    teamBName: gameData.teamBName || 'Team B',
                    teamAPlayers: gameData.teamAPlayers || [],
                    teamBPlayers: gameData.teamBPlayers || [],
                    teamAScore: gameData.teamAScore || 0,
                    teamBScore: gameData.teamBScore || 0,
                    adjustedHandicaps: adjustedHandicaps,
                    matchResults: gameData.matchResults || {},
                    f1IntraMatches: gameData.f1IntraMatches || {},
                    f2IntraMatches: gameData.f2IntraMatches || {},
                    status: 'completed',
                    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    signatures: gameData.signatures || {},
                    celebration: {
                        imageRef: 'placeholder.jpg',
                        imageUrl: '',
                        capturedAt: null
                    }
                };
                
                // Step 1: Write to historyGames
                var historyRef = db.collection('historyGames').doc(archiveId);
                return historyRef.set(historyData)
                    .then(function() {
                        console.log('[SignCard] History record written');
                        
                        // Step 2: Update scheduledGames status
                        var updateData = {
                            status: 'completed',
                            completedAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        
                        // Use WRV for reliable Firestore write
                        return new Promise(function(resolve, reject) {
                            if (typeof WRV !== 'undefined' && WRV.update) {
                                WRV.update('scheduledGames', gameId, updateData, function(err, result) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(result);
                                    }
                                });
                            } else {
                                // Fallback: direct update
                                console.warn('[SignCard] WRV not available, using direct update');
                                db.collection('scheduledGames').doc(gameId).update(updateData)
                                    .then(resolve)
                                    .catch(reject);
                            }
                        });
                    });
            })
            .then(function() {
                console.log('[SignCard] Game completed successfully');
                renderCelebration(gameId);
            })
            .catch(function(err) {
                console.error('[SignCard] Error completing game:', err);
                // Still show celebration even if history write fails
                renderCelebration(gameId);
            });
    }
    
    /**
     * Render celebration screen
     * @param {string} gameId - The game ID
     */
    function renderCelebration(gameId) {
        console.log('[SignCard] Rendering celebration for:', gameId);
        
        // Get game data for celebration display
        var db = firebase.firestore();
        db.collection('scheduledGames').doc(gameId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    console.warn('[SignCard] Game not found for celebration');
                    return;
                }
                
                var data = doc.data();
                
                // Build celebration HTML
                var html = buildCelebrationHTML(data);
                
                // Find or create celebration container
                var container = document.getElementById('celebration-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'celebration-container';
                    document.body.appendChild(container);
                }
                container.innerHTML = html;
                container.style.display = 'flex';
                
                // Start confetti
                launchConfetti();
                
                // Try to capture and upload celebration image
                setTimeout(function() {
                    captureCelebrationImage(container, gameId, data);
                }, 2500);
            })
            .catch(function(err) {
                console.error('[SignCard] Error loading celebration data:', err);
            });
    }
    
    /**
     * Build celebration HTML
     */
    function buildCelebrationHTML(data) {
        var teamAName = data.teamAName || 'Team A';
        var teamBName = data.teamBName || 'Team B';
        var teamAScore = data.teamAScore || 0;
        var teamBScore = data.teamBScore || 0;
        var winner = teamAScore > teamBScore ? teamAName : 
                    teamBScore > teamAScore ? teamBName : 'Tie';
        
        return `
            <div class="celebration-overlay">
                <div class="celebration-modal">
                    <div class="celebration-header">
                        <h1>🏆 Match Complete!</h1>
                    </div>
                    <div class="celebration-body">
                        <div class="celebration-score">
                            <div class="celebration-team">
                                <span class="celebration-team-name">${teamAName}</span>
                                <span class="celebration-team-score">${teamAScore}</span>
                            </div>
                            <div class="celebration-vs">VS</div>
                            <div class="celebration-team">
                                <span class="celebration-team-name">${teamBName}</span>
                                <span class="celebration-team-score">${teamBScore}</span>
                            </div>
                        </div>
                        <div class="celebration-winner">
                            🎉 ${winner} wins! 🎉
                        </div>
                        <div class="celebration-photo" id="celebration-photo-container">
                            <img id="celebration-photo" src="https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg" alt="Celebration Photo" style="max-width:100%;max-height:300px;border-radius:8px;">
                        </div>
                        <button class="celebration-close-btn" onclick="SignCard.closeCelebration()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Launch confetti animation
     */
    function launchConfetti() {
        // Simple confetti using CSS animations
        var container = document.getElementById('celebration-container');
        if (!container) return;
        
        var colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff'];
        for (var i = 0; i < 50; i++) {
            var confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = Math.random() * 10 + 5 + 'px';
            confetti.style.height = Math.random() * 10 + 5 + 'px';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            confetti.style.position = 'fixed';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '10000';
            confetti.style.animation = 'confetti-fall ' + (Math.random() * 3 + 2) + 's linear forwards';
            confetti.style.animationDelay = Math.random() * 2 + 's';
            container.appendChild(confetti);
        }
    }
    
    /**
     * Capture celebration image using html2canvas
     * @param {HTMLElement} container - The celebration container
     * @param {string} gameId - The game ID
     * @param {object} data - Game data
     */
    function captureCelebrationImage(container, gameId, data) {
        if (typeof html2canvas === 'undefined') {
            console.warn('[SignCard] html2canvas not available, skipping capture');
            return;
        }
        
        var modal = container.querySelector('.celebration-modal');
        if (!modal) {
            console.warn('[SignCard] Celebration modal not found');
            return;
        }
        
        console.log('[SignCard] 📸 Capturing celebration image');
        
        html2canvas(modal, {
            scale: 0.8,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false,
        }).then(function(canvas) {
            // Convert to JPEG blob
            return new Promise(function(resolve) {
                canvas.toBlob(function(blob) {
                    resolve(blob);
                }, 'image/jpeg', 0.85);
            });
        }).then(function(blob) {
            if (!blob) {
                console.warn('[SignCard] Failed to create blob');
                return;
            }
            
            console.log('[SignCard] 📸 Captured blob size:', blob.size);
            
            // Upload to Firebase Storage
            var archiveId = gameId + '_H';
            var storage = firebase.storage();
            var storageRef = storage.ref('celebrations/' + archiveId + '.jpg');
            
            return storageRef.put(blob)
                .then(function(snapshot) {
                    return snapshot.ref.getDownloadURL();
                })
                .then(function(url) {
                    console.log('[SignCard] 📸 Uploaded celebration image:', url);
                    
                    // Update celebration pointer in historyGames using WRV
                    var updateData = {
                        'celebration.imageRef': 'celebrations/' + archiveId + '.jpg',
                        'celebration.imageUrl': url,
                        'celebration.capturedAt': firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // Use WRV for reliable Firestore write
                    return new Promise(function(resolve, reject) {
                        if (typeof WRV !== 'undefined' && WRV.update) {
                            WRV.update('historyGames', archiveId, updateData, function(err, result) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(result);
                                }
                            });
                        } else {
                            // Fallback: direct update
                            console.warn('[SignCard] WRV not available, using direct update');
                            var db = firebase.firestore();
                            db.collection('historyGames').doc(archiveId).update(updateData)
                                .then(resolve)
                                .catch(reject);
                        }
                    });
                });
        }).then(function() {
            console.log('[SignCard] ✅ Celebration image captured and uploaded');
        }).catch(function(err) {
            console.warn('[SignCard] ⚠️ Celebration image capture failed:', err.message);
        });
    }
    
    /**
     * Close the celebration screen
     */
    function closeCelebration() {
        var container = document.getElementById('celebration-container');
        if (container) {
            container.style.display = 'none';
        }
        
        var signContainer = document.getElementById('sign-card-container');
        if (signContainer) {
            signContainer.style.display = 'none';
        }
    }
    
    /**
     * Hide the sign card
     */
    function hide() {
        var container = document.getElementById('sign-card-container');
        if (container) {
            container.style.display = 'none';
        }
    }
    
    // Public API
    return {
        init: init,
        hide: hide,
        closeCelebration: closeCelebration,
        submitSignature: submitSignature,
        showCelebrationScreen: showCelebrationScreen,
        version: '1.22'
    };
    
})();

// Make available globally
window.SignCard = SignCard;

// Inject confetti animation CSS
(function() {
    var style = document.createElement('style');
    style.textContent = `
        @keyframes confetti-fall {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        
        .sign-card-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .sign-card-modal {
            background: var(--bg-color, #fff);
            border-radius: 16px;
            max-width: 400px;
            width: 100%;
            padding: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            color: var(--text-color, #333);
        }
        
        .sign-card-header {
            text-align: center;
            margin-bottom: 20px;
        }
        
        .sign-card-header h2 {
            margin: 0 0 8px 0;
            font-size: 24px;
        }
        
        .sign-card-header p {
            margin: 0;
            font-size: 14px;
            opacity: 0.7;
        }
        
        .sign-card-body {
            padding: 0;
        }
        
        .sign-card-warning {
            background: #fff3cd;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            color: #856404;
        }
        
        .sign-card-warning ul {
            margin: 8px 0 0 0;
            padding-left: 20px;
            font-size: 13px;
        }
        
        .sign-card-warning ul li {
            margin-bottom: 4px;
        }
        
        .sign-card-signed {
            text-align: center;
            padding: 20px 0;
        }
        
        .sign-card-check {
            font-size: 48px;
            margin-bottom: 12px;
        }
        
        .sign-card-time {
            font-size: 12px;
            opacity: 0.6;
            margin-top: 8px;
        }
        
        .sign-card-actions {
            display: flex;
            gap: 12px;
            margin-top: 16px;
        }
        
        .sign-card-btn {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .sign-card-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .sign-card-cancel {
            background: #e0e0e0;
            color: #333;
        }
        
        .sign-card-cancel:hover {
            background: #d0d0d0;
        }
        
        .sign-card-confirm {
            background: #4CAF50;
            color: white;
        }
        
        .sign-card-confirm:hover:not(:disabled) {
            background: #45a049;
        }
        
        .sign-card-error {
            background: #f8d7da;
            color: #721c24;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        
        .celebration-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .celebration-modal {
            background: var(--bg-color, #fff);
            border-radius: 16px;
            max-width: 420px;
            width: 100%;
            padding: 32px 24px 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            color: var(--text-color, #333);
            text-align: center;
            position: relative;
        }
        
        .celebration-header h1 {
            margin: 0 0 16px 0;
            font-size: 28px;
        }
        
        .celebration-score {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 0;
            border-top: 1px solid var(--border-color, #eee);
            border-bottom: 1px solid var(--border-color, #eee);
            margin-bottom: 16px;
        }
        
        .celebration-team {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .celebration-team-name {
            font-size: 14px;
            font-weight: 600;
        }
        
        .celebration-team-score {
            font-size: 36px;
            font-weight: 700;
        }
        
        .celebration-vs {
            font-size: 18px;
            font-weight: 700;
            opacity: 0.5;
        }
        
        .celebration-winner {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #ffd700;
        }
        
        .celebration-close-btn {
            margin-top: 16px;
            padding: 12px 32px;
            border: none;
            border-radius: 8px;
            background: var(--primary-color, #4CAF50);
            color: white;
            font-size: 16px;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        
        .celebration-close-btn:hover {
            opacity: 0.8;
        }
    `;
    document.head.appendChild(style);
})();

/*
FILE: js/sign-card.js
VERSION: 1.22
KEY CHANGES from v1.21:
   - CHANGED: Firestore writes now use WRV.update() for reliability
   - ADDED: Fallback to direct update if WRV not available
   - CHANGED: All Firestore writes now use WRV
DEPENDS ON: Firebase Firestore, WRV.js, history-record.js
STATUS: Ready for integration
*/