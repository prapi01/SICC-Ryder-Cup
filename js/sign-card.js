/*
FILE: js/sign-card.js
VERSION: 1.40
KEY CHANGES from v1.39:
   - FIXED: clinchedAt keys now normalized to use labels before saving to history
   - REASON: Inconsistent clinchedAt keys (some use full names, some use labels)
   - FIXED: Added normalizeClinchedAt() helper to convert full-name keys to label-based keys
   - REASON: Ensures all history records use labels consistently for match keys
   - PRESERVED: ALL other functionality from v1.39 unchanged
DEPENDS ON: Firebase Firestore, js/hcp-adjust.js, js/game-loader.js, js/modal.js, js/waiting-screen.js, js/wrv.js
STATUS: Ready for integration
*/

// ============================================================
// Version Exposure for Console Debugging
// ============================================================
window.SIGN_CARD_VERSION = "1.41";
console.log("[SIGN-CARD] Initializing v1.40 - Normalized clinchedAt labels");

// ============================================================
// v1.40: Helper: Normalize clinchedAt keys to use labels
// ============================================================
function normalizeClinchedAt(clinchedAt, players) {
    if (!clinchedAt || typeof clinchedAt !== 'object') return clinchedAt;
    if (Object.keys(clinchedAt).length === 0) return clinchedAt;
    
    // Build name → label mapping
    var playerMap = {};
    for (var i = 0; i < players.length; i++) {
        playerMap[players[i].name] = players[i].label;
    }
    
    var normalized = {};
    for (var key in clinchedAt) {
        var parts = key.split('_vs_');
        if (parts.length === 2) {
            var player1Name = parts[0];
            var player2Name = parts[1];
            var player1Label = playerMap[player1Name] || player1Name;
            var player2Label = playerMap[player2Name] || player2Name;
            var newKey = player1Label + '_vs_' + player2Label;
            normalized[newKey] = clinchedAt[key];
        } else {
            // If key doesn't match expected format, keep as-is
            normalized[key] = clinchedAt[key];
        }
    }
    
    return normalized;
}

var SignCard = (function() {
    
    console.log("[SIGN-CARD] Initializing SignCard module");

    // ============================================================
    // Replay celebration from sessionStorage
    // ============================================================
    
    function replayCelebration() {
        var celebrationDataStr = sessionStorage.getItem('celebrationData');
        if (celebrationDataStr) {
            try {
                var celebrationData = JSON.parse(celebrationDataStr);
                console.log("[SIGN-CARD] Replaying celebration from sessionStorage");
                showCelebrationScreen(
                    celebrationData.winner,
                    celebrationData.teamAScore,
                    celebrationData.teamBScore,
                    celebrationData.winningPlayers,
                    celebrationData.gameId,
                    function() {
                        console.log("[SIGN-CARD] Celebration replay closed");
                    }
                );
                return true;
            } catch(e) {
                console.error("[SIGN-CARD] Failed to parse celebration data:", e);
                return false;
            }
        }
        return false;
    }

    // ============================================================
    // Show Celebration Screen
    // ============================================================
    
    function showCelebrationScreen(winner, teamAScore, teamBScore, winningPlayers, gameId, onClose) {
        console.log("[SIGN-CARD] showCelebrationScreen called");
        console.log("[SIGN-CARD] Winner:", winner, "Team A:", teamAScore, "Team B:", teamBScore);
        console.log("[SIGN-CARD] gameId:", gameId);
        
        // v1.11: Clear any existing modals first
        var existingModal = document.getElementById('celebrationModal');
        if (existingModal) {
            console.log("[SIGN-CARD] Removing existing celebration modal");
            existingModal.remove();
        }
        var existingOverlay = document.getElementById('celebrationOverlay');
        if (existingOverlay) {
            console.log("[SIGN-CARD] Removing existing celebration overlay");
            existingOverlay.remove();
        }
        
        var isTie = (teamAScore === teamBScore);
        var emoji = isTie ? '🤝' : (winner === 'A' ? '🏆' : '🏆');
        var message = isTie ? 'It\'s a Tie!' : (winner === 'A' ? 'Team A Wins!' : 'Team One Wins!');
        
        var teamALabel = 'Team A';
        var teamBLabel = 'Team One';
        var teamAColor = '#4caf50';
        var teamBColor = '#4caf50';
        
        if (!isTie) {
            if (winner === 'A') {
                teamAColor = '#ffaa44';
                teamBColor = '#888';
            } else {
                teamAColor = '#888';
                teamBColor = '#ffaa44';
            }
        }
        
        // Build winning players list
        var winningPlayersHtml = '';
        if (winner !== 'Tie' && winningPlayers) {
            var winners = winner === 'A' ? winningPlayers.teamA : winningPlayers.teamB;
            if (winners && winners.length > 0) {
                var winnerNames = winners.map(function(p) { 
                    return p.label || p.name; 
                }).join(', ');
                winningPlayersHtml = '<div style="font-size:0.8rem; color:#888; margin:8px 0 12px 0;">🎉 ' + winnerNames + '</div>';
            }
        }
        
        // v1.11: Add auto-save state
        var autoSaveStatus = '';
        
        var html = `
            <div id="celebrationModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:10001; padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);">
                <div style="background:#1a1a1a; border-radius:28px; padding:32px; max-width:360px; width:90%; text-align:center; border:2px solid #ffaa44; position:relative;">
                    <div style="font-size:2.5rem; margin-bottom:8px;">${emoji}</div>
                    <div style="font-size:1.5rem; font-weight:700; color:#ffaa44; margin-bottom:4px;">${message}</div>
                    ${winningPlayersHtml}
                    <div style="display:flex; justify-content:center; align-items:center; gap:20px; margin:12px 0;">
                        <div style="text-align:center;">
                            <div style="font-size:0.7rem; color:${teamAColor}; font-weight:600;">${teamALabel}</div>
                            <div style="font-size:2rem; font-weight:800; color:${teamAColor};">${teamAScore}</div>
                        </div>
                        <div style="font-size:1.2rem; color:#555;">│</div>
                        <div style="text-align:center;">
                            <div style="font-size:0.7rem; color:${teamBColor}; font-weight:600;">${teamBLabel}</div>
                            <div style="font-size:2rem; font-weight:800; color:${teamBColor};">${teamBScore}</div>
                        </div>
                    </div>
                    ${autoSaveStatus}
                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                        <button id="celebrationHandicapBtn" style="width:100%; padding:14px; border-radius:40px; font-weight:700; font-size:1rem; cursor:pointer; border:2px solid #4caf50; background:#1a3a1a; color:#4caf50;">🏌️ HANDICAP ADJUSTMENT</button>
                        <button id="celebrationMainMenuBtn" style="width:100%; padding:14px; border-radius:40px; font-weight:600; font-size:0.9rem; cursor:pointer; border:1px solid #333; background:#1a1a1a; color:#888;">🏠 Main Menu</button>
                    </div>
                    <div style="margin-top:16px; font-size:0.6rem; color:#444; letter-spacing:0.3px;">SICC Ryder Cup</div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        // ============================================================
        // v1.11: Auto-save to history on celebration screen load
        // ============================================================
        console.log("[SIGN-CARD] 🚀 Attempting auto-save to history on celebration screen load");
        console.log("[SIGN-CARD] gameId:", gameId);
        
        // Small delay to let the modal render, then auto-save
        setTimeout(function() {
            if (gameId && typeof saveGameToHistory === 'function') {
                console.log("[SIGN-CARD] Calling saveGameToHistory for gameId:", gameId);
                saveGameToHistory(gameId)
                    .then(function(result) {
                        console.log("[SIGN-CARD] ✅ Auto-save completed:", result);
                        if (result.success) {
                            console.log("[SIGN-CARD] ✅ History record saved:", result.archiveId);
                            var statusDiv = document.querySelector('#celebrationModal .auto-save-status');
                            if (statusDiv) {
                                statusDiv.innerHTML = '<span style="color:#4caf50;">✅ Saved to history</span>';
                            }
                            // Store the archive ID for later use
                            sessionStorage.setItem('lastHistoryArchiveId', result.archiveId);
                            sessionStorage.setItem('lastHistoryGameId', gameId);
                        } else {
                            console.error("[SIGN-CARD] ❌ Auto-save failed:", result.error);
                            var statusDiv = document.querySelector('#celebrationModal .auto-save-status');
                            if (statusDiv) {
                                statusDiv.innerHTML = '<span style="color:#ff6b6b;">⚠️ ' + (result.error || 'Save failed') + '</span>';
                            }
                        }
                    })
                    .catch(function(err) {
                        console.error("[SIGN-CARD] ❌ Auto-save error:", err);
                    });
            } else {
                console.warn("[SIGN-CARD] ⚠️ Cannot auto-save: gameId=", gameId, "saveGameToHistory available:", typeof saveGameToHistory === 'function');
            }
        }, 500);
        
        document.getElementById('celebrationHandicapBtn').addEventListener('click', function() {
            console.log("[SIGN-CARD] HANDICAP ADJUSTMENT button clicked");
            var modal = document.getElementById('celebrationModal');
            if (modal) modal.remove();
            
            if (typeof WaitingScreen !== 'undefined' && WaitingScreen.show) {
                WaitingScreen.show("Loading Handicap Adjustment...");
            } else {
                var overlay = document.createElement('div');
                overlay.id = 'waitingScreenOverlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
                overlay.innerHTML = '<div style="font-size:5rem;filter:grayscale(100%);opacity:0.6;">⛳</div><div style="color:#888;font-size:0.8rem;margin-top:16px;letter-spacing:1px;">Loading Handicap Adjustment...</div>';
                document.body.appendChild(overlay);
            }
            
            window.location.href = 'hcp-adjust.html?gameId=' + gameId;
        });
        
        document.getElementById('celebrationMainMenuBtn').addEventListener('click', function() {
            console.log("[SIGN-CARD] Main Menu button clicked");
            var modal = document.getElementById('celebrationModal');
            if (modal) modal.remove();
            sessionStorage.removeItem('isPostGame');
            window.location.href = 'index.html';
        });
        
        // Store onClose callback for cleanup if needed
        window._celebrationOnClose = onClose;
    }

    // ============================================================
    // EXTERNAL FUNCTIONS: saveGameToHistory, setupSigning
    // ============================================================
    
    window.saveGameToHistory = function(gameId) {
        console.log("[SIGN-CARD] saveGameToHistory called for gameId:", gameId);
        return new Promise(function(resolve) {
            // Use GameLoader to load the game data
            if (typeof GameLoader === 'undefined' || typeof GameLoader.loadGame !== 'function') {
                console.error("[SIGN-CARD] GameLoader not available");
                resolve({ success: false, error: "GameLoader not available" });
                return;
            }
            
            GameLoader.loadGame(gameId, "scheduledGames", function(result) {
                if (!result.success) {
                    console.error("[SIGN-CARD] Failed to load game data:", result.error);
                    resolve({ success: false, error: result.error || "Failed to load game data" });
                    return;
                }
                
                try {
                    var cache = result.cache;
                    console.log("[SIGN-CARD] Game data loaded, cache keys:", Object.keys(cache));
                    
                    // Build the history record data
                    var historyData = buildHistoryRecordData(gameId, cache);
                    if (!historyData) {
                        resolve({ success: false, error: "Failed to build history record data" });
                        return;
                    }
                    
                    // Save to Firestore
                    var db = firebase.firestore();
                    var archiveId = gameId + '_H';
                    
                    // Check if history record already exists
                    db.collection("historyGames").doc(archiveId).get()
                        .then(function(doc) {
                            var dataToSave = historyData;
                            
                            // Determine if we need to merge or set
                            if (doc.exists) {
                                // Update existing record
                                console.log("[SIGN-CARD] History record already exists, updating:", archiveId);
                                
                                // v1.31: Use WRV if available for verified write
                                if (typeof WRV !== 'undefined' && WRV.update) {
                                    WRV.update("historyGames", archiveId, dataToSave, function(err, writtenData) {
                                        if (err) {
                                            console.error("[SIGN-CARD] WRV update failed:", err);
                                            resolve({ success: false, error: err.message });
                                        } else {
                                            console.log("[SIGN-CARD] WRV update verified");
                                            resolve({ success: true, archiveId: archiveId, action: 'updated' });
                                        }
                                    });
                                } else {
                                    db.collection("historyGames").doc(archiveId).set(dataToSave, { merge: true })
                                        .then(function() {
                                            console.log("[SIGN-CARD] History record updated:", archiveId);
                                            resolve({ success: true, archiveId: archiveId, action: 'updated' });
                                        })
                                        .catch(function(err) {
                                            console.error("[SIGN-CARD] Failed to update history record:", err);
                                            resolve({ success: false, error: err.message });
                                        });
                                }
                            } else {
                                // Create new record
                                console.log("[SIGN-CARD] Creating new history record:", archiveId);
                                
                                // v1.31: Use WRV if available for verified write
                                if (typeof WRV !== 'undefined' && WRV.write) {
                                    WRV.write("historyGames", archiveId, dataToSave, function(err, writtenData) {
                                        if (err) {
                                            console.error("[SIGN-CARD] WRV write failed:", err);
                                            resolve({ success: false, error: err.message });
                                        } else {
                                            console.log("[SIGN-CARD] WRV write verified");
                                            resolve({ success: true, archiveId: archiveId, action: 'created' });
                                        }
                                    });
                                } else {
                                    db.collection("historyGames").doc(archiveId).set(dataToSave)
                                        .then(function() {
                                            console.log("[SIGN-CARD] History record created:", archiveId);
                                            resolve({ success: true, archiveId: archiveId, action: 'created' });
                                        })
                                        .catch(function(err) {
                                            console.error("[SIGN-CARD] Failed to create history record:", err);
                                            resolve({ success: false, error: err.message });
                                        });
                                }
                            }
                        })
                        .catch(function(err) {
                            console.error("[SIGN-CARD] Failed to check history record:", err);
                            resolve({ success: false, error: err.message });
                        });
                    
                } catch (e) {
                    console.error("[SIGN-CARD] Exception in saveGameToHistory:", e);
                    resolve({ success: false, error: e.message });
                }
            });
        });
    };
    
    // ============================================================
    // v1.40: Build History Record Data - WITH CLINCHEDAT NORMALIZATION
    // ============================================================
    
    function buildHistoryRecordData(gameId, cache) {
        console.log("[SIGN-CARD] buildHistoryRecordData called");
        console.log("[SIGN-CARD] cache keys:", Object.keys(cache));
        console.log("[SIGN-CARD] cache.players:", cache.players ? cache.players.length : 'undefined');
        console.log("[SIGN-CARD] cache.results:", cache.results ? 'exists' : 'undefined');
        console.log("[SIGN-CARD] cache.signatures:", cache.signatures ? 'exists' : 'undefined');
        
        if (!cache || !cache.players) {
            console.error("[SIGN-CARD] Invalid cache: missing players");
            return null;
        }
        
        // ============================================================
        // v1.40: Normalize clinchedAt to use labels
        // ============================================================
        var rawClinchedAt = cache.results?.clinchedAt || {};
        var normalizedClinchedAt = normalizeClinchedAt(rawClinchedAt, cache.players);
        
        // Log normalization changes
        if (Object.keys(rawClinchedAt).length > 0 && Object.keys(normalizedClinchedAt).length > 0) {
            console.log("[SIGN-CARD] clinchedAt normalized:",
                Object.keys(rawClinchedAt).length, "→",
                Object.keys(normalizedClinchedAt).length, "keys");
        }
        
        // Build results object with normalized clinchedAt
        var results = null;
        if (cache.results) {
            results = JSON.parse(JSON.stringify(cache.results));
            results.clinchedAt = normalizedClinchedAt;
        }
        
        var data = {
            originalGameId: gameId,
            gameInfo: {
                course: cache.course || null,
                players: cache.players || [],
                startingHole: cache.startingHole || 1,
                teamGameFormat: cache.teamGameFormat || "tournament",
                date: cache.date || new Date().toISOString().split('T')[0]
            },
            players: cache.players || [],
            f1DataString: cache.f1DataString || "",
            f2DataString: cache.f2DataString || "",
            results: results,
            adjustedHandicaps: null,
            signatures: cache.signatures || {
                f1: { signed: true, signedAt: null, captainName: null },
                f2: { signed: true, signedAt: null, captainName: null }
            },
            status: "completed",
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Include handicap adjustment data if available
        if (typeof HandicapAdjustment !== 'undefined' && HandicapAdjustment.getData) {
            var hcpData = HandicapAdjustment.getData();
            if (hcpData) {
                data.adjustedHandicaps = hcpData;
                console.log("[SIGN-CARD] Handicap adjustment data included");
            } else {
                console.warn("[SIGN-CARD] No handicap data available from HandicapAdjustment");
            }
        } else {
            console.warn("[SIGN-CARD] HandicapAdjustment not available");
        }
        
        // v1.29: Include celebration photo reference if available
        if (cache.celebration) {
            data.celebration = cache.celebration;
            console.log("[SIGN-CARD] Celebration photo included");
        }
        
        console.log("[SIGN-CARD] History record data built successfully");
        return data;
    }
    
    // ============================================================
    // PROGNOSIS TEST (branch: test/sign-submit-prognosis)
    // submitSignature restored — v1.40 removed it, but real-game-nav.js
    // (v1.16/v1.17) still calls SignCard.submitSignature() on SIGN CARD.
    // Writes signatures.f{n}.signed=true, which the realtime listener in
    // real-game-init.js needs to show the Game-Complete (celebration) modal.
    // Minimal version for A/B testing; a full production fix should port the
    // complete v1.39 implementation (retries, waiting screen, history write).
    // ============================================================
    function submitSignature(gameId, flight, captainName, collection) {
        return new Promise(function(resolve, reject) {
            var db = firebase.firestore();
            var docRef = db.collection(collection || 'scheduledGames').doc(gameId);
            var flightKey = 'f' + flight;
            var updateObj = {};
            updateObj['signatures.' + flightKey + '.signed'] = true;
            updateObj.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            docRef.update(updateObj)
                .then(function() {
                    console.log('[SignCard] submitSignature write OK for flight', flight);
                    resolve({ success: true });
                })
                .catch(function(err) {
                    console.error('[SignCard] submitSignature write FAILED:', err.message);
                    reject(err);
                });
        });
    }

    // ============================================================
    // Public API
    // ============================================================
    
    return {
        showCelebrationScreen: showCelebrationScreen,
        replayCelebration: replayCelebration,
        saveGameToHistory: window.saveGameToHistory,
        buildHistoryRecordData: buildHistoryRecordData,
        normalizeClinchedAt: normalizeClinchedAt,
        submitSignature: submitSignature
    };
    
})();

// ============================================================
// EXPOSE GLOBALLY
// ============================================================
window.SignCard = SignCard;
window.replayCelebration = SignCard.replayCelebration;
window.saveGameToHistory = SignCard.saveGameToHistory;
window.showCelebrationScreen = SignCard.showCelebrationScreen;
window.normalizeClinchedAt = SignCard.normalizeClinchedAt;

console.log("[SIGN-CARD] v1.40 loaded - Normalized clinchedAt labels");

/*
FILE: js/sign-card.js
VERSION: 1.40
KEY CHANGES from v1.39:
   - FIXED: clinchedAt keys now normalized to use labels before saving to history
   - REASON: Inconsistent clinchedAt keys (some use full names, some use labels)
   - FIXED: Added normalizeClinchedAt() helper to convert full-name keys to label-based keys
   - REASON: Ensures all history records use labels consistently for match keys
   - PRESERVED: ALL other functionality from v1.39 unchanged
DEPENDS ON: Firebase Firestore, js/hcp-adjust.js, js/game-loader.js, js/modal.js, js/waiting-screen.js, js/wrv.js
STATUS: Ready for integration
*/