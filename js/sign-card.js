/*
FILE: js/sign-card.js
VERSION: 1.23
KEY CHANGES from v1.22:
   - ADDED: cropAndBrighten() - removes padding and brightens image
   - ADDED: storeCelebrationImageInFirestore() - stores Base64 directly
   - CHANGED: captureCelebrationImage() - now crops and brightens
   - CHANGED: Removed Firebase Storage dependency (no CORS issues)
   - CHANGED: Pure black background for capture
   - CHANGED: 20% brightness enhancement for vibrant images
   - FIXED: No more dim filter effect on captured images
   - FIXED: Removed empty padding from captured images
DEPENDS ON: Firebase Firestore, html2canvas
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
    // Calculate Adjusted Handicaps from game data
    // ============================================================
    
    function calculateAdjustedHandicapsFromGameData(gameData) {
        if (!gameData || !gameData.players || !gameData.results) {
            console.warn("[SignCard] Cannot calculate adjusted handicaps - missing data");
            return null;
        }
        
        var players = gameData.players || [];
        var playerTotals = gameData.results?.playerTotals || {};
        var tr = gameData.results?.tr || {};
        var finalTeamA = tr.teamA?.[17] || 9.5;
        var finalTeamB = tr.teamB?.[17] || 9.5;
        var winner = finalTeamA > finalTeamB ? 'A' : (finalTeamB > finalTeamA ? 'B' : 'Tie');
        
        // Find anchor (player with lowest handicap)
        var minHcp = Infinity;
        var anchorName = 'Anchor';
        for (var i = 0; i < players.length; i++) {
            if (players[i].handicap < minHcp) {
                minHcp = players[i].handicap;
                anchorName = players[i].name;
            }
        }
        
        var playerList = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var total = playerTotals[p.name];
            
            var perfAdj = 0;
            var perfRaw = 0;
            if (total && total.holesPlayed > 0) {
                perfRaw = total.relativeToPar;
                perfAdj = Math.round((total.relativeToPar / total.holesPlayed) * 10) / 10;
            }
            
            var anchorAdj = p.handicap - minHcp;
            var anchorRaw = anchorAdj;
            var finalHcp = Math.round((p.handicap + anchorAdj + perfAdj) * 10) / 10;
            
            playerList.push({
                name: p.name,
                label: p.label || '',
                startingHcp: p.handicap,
                finalHcp: finalHcp,
                perfAdj: perfAdj,
                anchorAdj: anchorAdj,
                perfRaw: perfRaw,
                anchorRaw: anchorRaw
            });
        }
        
        return {
            players: playerList,
            anchor: anchorName,
            newAnchor: anchorName,
            needsZeroRise: false,
            zeroRiseAmount: 0,
            calculatedAt: new Date().toISOString(),
            winner: winner,
            finalTeamA: finalTeamA,
            finalTeamB: finalTeamB
        };
    }
    
    // ============================================================
    // v1.20: UPDATE SCHEDULED GAME STATUS
    // ============================================================
    
    function updateScheduledGameStatus(gameId, callback) {
        var db = getDb();
        var updatePayload = {
            status: "completed",
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log("[SignCard] Updating scheduledGames status to 'completed' for:", gameId);
        
        db.collection('scheduledGames').doc(gameId).update(updatePayload)
            .then(function() {
                console.log("[SignCard] scheduledGames status updated to 'completed'");
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error("[SignCard] Failed to update scheduledGames status:", err);
                if (callback) callback(err);
            });
    }
    
    // ============================================================
    // v1.20: COMPLETE GAME IN BOTH COLLECTIONS
    // ============================================================
    
    function completeGameInBothCollections(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        console.log("[SignCard] Starting completeGameInBothCollections for:", gameId);
        
        ensureArchiveRecordComplete(
            gameId,
            gameData,
            results,
            finalScores,
            signatures,
            flight1DataString,
            flight2DataString,
            matchResults,
            function(err, archiveId) {
                if (err) {
                    console.error("[SignCard] Failed to complete historyGames record:", err);
                    if (callback) callback(err, null);
                    return;
                }
                
                console.log("[SignCard] historyGames record completed:", archiveId);
                
                updateScheduledGameStatus(gameId, function(err2) {
                    if (err2) {
                        console.error("[SignCard] Failed to update scheduledGames status:", err2);
                        if (callback) callback(err2, archiveId);
                        return;
                    }
                    
                    console.log("[SignCard] Both collections updated successfully");
                    if (callback) callback(null, archiveId);
                });
            }
        );
    }
    
    // ============================================================
    // Helper: Get or create archive record, then complete it
    // ============================================================
    
    function ensureArchiveRecordComplete(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, callback) {
        if (typeof HistoryRecord === 'undefined') {
            if (callback) callback(new Error("HistoryRecord not available"), null);
            return;
        }
        
        var docId = HistoryRecord.getHistoryDocId(gameId);
        var db = getDb();
        
        db.collection('historyGames').doc(docId).get()
            .then(function(doc) {
                var isUpdate = doc.exists;
                
                if (isUpdate) {
                    console.log("[SignCard] Record exists, updating with handicap:", docId);
                    
                    var handicapData = calculateAdjustedHandicapsFromGameData(gameData);
                    if (!handicapData) {
                        if (callback) callback(new Error("Failed to calculate handicap data"), null);
                        return;
                    }
                    
                    var startingPlayers = gameData.players.map(function(p) {
                        return {
                            name: p.name,
                            label: p.label || '',
                            handicap: p.handicap,
                            team: p.team,
                            flight: p.flight
                        };
                    });
                    
                    // Add dummy celebration pointer
                    handicapData.celebration = {
                        imageRef: "dummy_celebration_image.jpg",
                        capturedAt: new Date().toISOString()
                    };
                    
                    HistoryRecord.updateWithHandicap(docId, handicapData, startingPlayers, function(err) {
                        if (err) {
                            console.error("[SignCard] Failed to update with handicap:", err);
                            if (callback) callback(err, null);
                        } else {
                            console.log("[SignCard] Record completed with handicap data and dummy celebration pointer:", docId);
                            if (callback) callback(null, docId);
                        }
                    });
                    
                } else {
                    console.log("[SignCard] Record doesn't exist, creating and completing:", docId);
                    
                    HistoryRecord.upsertPendingRecord(gameId, gameData, results, finalScores, signatures, flight1DataString, flight2DataString, matchResults, function(err, newDocId) {
                        if (err) {
                            console.error("[SignCard] Failed to create pending record:", err);
                            if (callback) callback(err, null);
                            return;
                        }
                        
                        var handicapData = calculateAdjustedHandicapsFromGameData(gameData);
                        if (!handicapData) {
                            if (callback) callback(new Error("Failed to calculate handicap data"), null);
                            return;
                        }
                        
                        var startingPlayers = gameData.players.map(function(p) {
                            return {
                                name: p.name,
                                label: p.label || '',
                                handicap: p.handicap,
                                team: p.team,
                                flight: p.flight
                            };
                        });
                        
                        handicapData.celebration = {
                            imageRef: "dummy_celebration_image.jpg",
                            capturedAt: new Date().toISOString()
                        };
                        
                        HistoryRecord.updateWithHandicap(newDocId, handicapData, startingPlayers, function(err2) {
                            if (err2) {
                                console.error("[SignCard] Failed to update with handicap:", err2);
                                if (callback) callback(err2, null);
                            } else {
                                console.log("[SignCard] Record created and completed with handicap data and dummy celebration pointer:", newDocId);
                                if (callback) callback(null, newDocId);
                            }
                        });
                    });
                }
            })
            .catch(function(err) {
                console.error("[SignCard] Error in ensureArchiveRecordComplete:", err);
                if (callback) callback(err, null);
            });
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
    // v1.23: Crop and brighten the captured image
    // ============================================================
    
    function cropAndBrighten(canvas, brightnessFactor) {
        // brightnessFactor: 1.0 = original, 1.2 = 20% brighter
        brightnessFactor = brightnessFactor || 1.2;
        
        return new Promise(function(resolve) {
            // Crop: remove 5% padding from each side
            var cropX = Math.round(canvas.width * 0.05);
            var cropY = Math.round(canvas.height * 0.05);
            var cropW = Math.round(canvas.width * 0.90);
            var cropH = Math.round(canvas.height * 0.90);
            
            var croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = cropW;
            croppedCanvas.height = cropH;
            var ctx = croppedCanvas.getContext('2d');
            
            // Draw the cropped image
            ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            
            // --- BRIGHTEN THE IMAGE ---
            var imageData = ctx.getImageData(0, 0, cropW, cropH);
            var data = imageData.data;
            
            for (var i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] * brightnessFactor);     // Red
                data[i+1] = Math.min(255, data[i+1] * brightnessFactor); // Green
                data[i+2] = Math.min(255, data[i+2] * brightnessFactor); // Blue
                // Alpha (data[i+3]) stays the same
            }
            
            // Put the brightened data back
            ctx.putImageData(imageData, 0, 0);
            
            // Convert to blob
            croppedCanvas.toBlob(function(blob) {
                resolve(blob);
            }, 'image/jpeg', 0.95);
        });
    }
    
    // ============================================================
    // v1.23: Store celebration image as Base64 in Firestore
    // ============================================================
    
    function storeCelebrationImageInFirestore(gameId, blob) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() {
                var base64Data = reader.result;
                var archiveId = gameId + '_H';
                var db = getDb();
                
                console.log("[SignCard] Storing Base64 image in Firestore:", archiveId);
                console.log("[SignCard] Image size:", base64Data.length, "chars");
                
                db.collection('historyGames').doc(archiveId).update({
                    'celebration.imageData': base64Data,
                    'celebration.imageFormat': 'base64_jpeg',
                    'celebration.capturedAt': firebase.firestore.FieldValue.serverTimestamp(),
                    'celebration.quality': 'high',
                    'celebration.brightness': 'enhanced'
                }).then(function() {
                    resolve();
                }).catch(function(err) {
                    reject(err);
                });
            };
            reader.onerror = function(err) {
                reject(err);
            };
            reader.readAsDataURL(blob);
        });
    }
    
    // ============================================================
    // v1.23: Capture celebration image with brightness enhancement
    // ============================================================
    
    function captureCelebrationImage(modalElement, gameId, gameData) {
        if (typeof html2canvas === 'undefined') {
            console.warn("[SignCard] html2canvas not available - skipping capture");
            return;
        }
        
        var gameDate = gameData?.date || new Date().toISOString().split('T')[0];
        var fileName = gameDate + '_' + gameId + '_H.jpg';
        
        console.log("[SignCard] Capturing celebration image (brightness enhanced):", fileName);
        
        setTimeout(function() {
            var modalContent = modalElement.querySelector('.celebration-modal');
            if (!modalContent) {
                console.warn("[SignCard] Modal content not found");
                return;
            }
            
            var rect = modalContent.getBoundingClientRect();
            var scale = 2.0;
            
            html2canvas(modalContent, {
                scale: scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#000000', // Pure black for clean capture
                logging: false,
                width: rect.width * scale,
                height: rect.height * scale
            }).then(function(canvas) {
                console.log("[SignCard] Canvas captured, size:", canvas.width, "x", canvas.height);
                
                // Crop AND brighten the image (20% brighter)
                return cropAndBrighten(canvas, 1.2);
            }).then(function(blob) {
                console.log("[SignCard] Image blob created, size:", blob.size, "bytes");
                return storeCelebrationImageInFirestore(gameId, blob);
            }).then(function() {
                console.log("[SignCard] ✅ Celebration image saved to Firestore (brightness enhanced)");
            }).catch(function(err) {
                console.warn("[SignCard] Celebration image capture failed:", err.message);
            });
        }, 2500);
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
    // Helper: Get or create archive record (LEGACY)
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
    // v1.20: CELEBRATION SCREEN - Shows AFTER all writes complete
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
        
        var celebrationData = {
            winner: winner,
            teamAScore: teamAScore,
            teamBScore: teamBScore,
            winningPlayers: winningPlayers,
            gameId: gameId,
            onClose: onClose
        };
        
        var db = getDb();
        db.collection('scheduledGames').doc(gameId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    console.warn("[SignCard] Game data not found - cannot complete record");
                    renderCelebrationModal(winnerText, winnerClass, teamADisplay, teamBDisplay, gameId, celebrationData, onClose, null);
                    return;
                }
                
                var gameData = doc.data();
                var finalScores = {
                    teamA: teamAScore,
                    teamB: teamBScore
                };
                var signatures = gameData.signatures || {};
                var results = gameData.results || {};
                var flight1DataString = gameData.f1?.d || "";
                var flight2DataString = gameData.f2?.d || "";
                
                console.log("[SignCard] Completing game in both collections...");
                
                completeGameInBothCollections(
                    gameId,
                    gameData,
                    results,
                    finalScores,
                    signatures,
                    flight1DataString,
                    flight2DataString,
                    {},
                    function(err, archiveId) {
                        if (err) {
                            console.error("[SignCard] Failed to complete game in both collections:", err);
                            renderCelebrationModal(winnerText, winnerClass, teamADisplay, teamBDisplay, gameId, celebrationData, onClose, gameData);
                            return;
                        }
                        
                        console.log("[SignCard] ✅ Game successfully completed in BOTH collections. Archive ID:", archiveId);
                        renderCelebrationModal(winnerText, winnerClass, teamADisplay, teamBDisplay, gameId, celebrationData, onClose, gameData);
                    }
                );
            })
            .catch(function(err) {
                console.error("[SignCard] Error fetching game data:", err);
                renderCelebrationModal(winnerText, winnerClass, teamADisplay, teamBDisplay, gameId, celebrationData, onClose, null);
            });
    }
    
    // ============================================================
    // v1.23: RENDER CELEBRATION MODAL (with auto-capture)
    // ============================================================
    
    function renderCelebrationModal(winnerText, winnerClass, teamADisplay, teamBDisplay, gameId, celebrationData, onClose, gameData) {
        console.log("[SignCard] Rendering celebration modal (after writes complete)");
        
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
                        <div class="celebration-title">🏌️ GAME COMPLETED!</div>
                        <div class="celebration-beer">🍺 BEER TIME! 🍺</div>
                        <div class="celebration-winner ${winnerClass}">
                            ${winnerText}
                        </div>
                        <div class="celebration-score" style="display:flex; justify-content:center; align-items:center; gap:8px; flex-wrap:wrap; padding:12px 0; border-top:1px solid #2a2a2a; border-bottom:1px solid #2a2a2a;">
                            <span class="score-team-a" style="font-size:1.2rem; font-weight:600; color:#4caf50;">Team A</span>
                            <span class="score-number-a" style="font-size:2.4rem; font-weight:700; color:#4caf50; margin-left:8px;">${teamADisplay}</span>
                            <span class="score-vs" style="font-size:1.6rem; color:#555; margin:0 12px;">|</span>
                            <span class="score-number-b" style="font-size:2.4rem; font-weight:700; color:#4caf50; margin-right:8px;">${teamBDisplay}</span>
                            <span class="score-team-b" style="font-size:1.2rem; font-weight:600; color:#4caf50;">Team B</span>
                        </div>
                        <button class="celebration-btn" id="handicapAdjustBtn">🏌️ HANDICAP ADJUSTMENT</button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            addCelebrationStyles();
            launchConfetti();
            
            var modalElement = document.getElementById('celebrationModal');
            if (modalElement && gameId) {
                console.log("[SignCard] Scheduling celebration image capture in 2.5s...");
                captureCelebrationImage(modalElement, gameId, gameData);
            }
            
            setTimeout(function() {
                console.log("[SignCard] Celebration modal fully rendered - calling onClose callback");
                if (typeof onClose === 'function') {
                    onClose();
                }
            }, 500);
            
            var btn = document.getElementById("handicapAdjustBtn");
            if (btn) {
                var newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                var capturedGameId = gameId;
                
                newBtn.addEventListener("click", function() {
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
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    padding: 12px 0;
                    border-top: 1px solid #2a2a2a;
                    border-bottom: 1px solid #2a2a2a;
                }
                .celebration-score .score-team-a,
                .celebration-score .score-team-b {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #4caf50;
                }
                .celebration-score .score-number-a,
                .celebration-score .score-number-b {
                    font-size: 2.4rem;
                    font-weight: 700;
                    color: #4caf50;
                }
                .celebration-score .score-number-a {
                    margin-left: 8px;
                }
                .celebration-score .score-number-b {
                    margin-right: 8px;
                }
                .celebration-score .score-vs {
                    font-size: 1.6rem;
                    color: #555;
                    margin: 0 12px;
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
                    .celebration-score .score-team-a,
                    .celebration-score .score-team-b { font-size: 1rem; }
                    .celebration-score .score-number-a,
                    .celebration-score .score-number-b { font-size: 1.8rem; }
                    .celebration-score .score-vs { font-size: 1.2rem; margin: 0 8px; }
                    .celebration-btn { font-size: 16px; padding: 14px 16px; }
                    .celebration-image { max-height: 30vh; min-height: 80px; }
                }
                
                @media (min-width: 401px) and (max-width: 500px) {
                    .celebration-modal { padding: 24px 28px 20px 28px; }
                    .celebration-title { font-size: 28px; }
                    .celebration-beer { font-size: 36px; }
                    .celebration-winner { font-size: 24px; }
                    .celebration-score .score-number-a,
                    .celebration-score .score-number-b { font-size: 2.4rem; }
                    .celebration-image { max-height: 35vh; }
                }
                
                @media (min-width: 501px) {
                    .celebration-modal { padding: 32px 36px 24px 36px; max-width: 480px; }
                    .celebration-title { font-size: 32px; }
                    .celebration-beer { font-size: 40px; }
                    .celebration-winner { font-size: 28px; padding: 14px 28px; }
                    .celebration-score .score-number-a,
                    .celebration-score .score-number-b { font-size: 3rem; }
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
        ensureArchiveRecord: ensureArchiveRecord,
        ensureArchiveRecordComplete: ensureArchiveRecordComplete,
        calculateAdjustedHandicapsFromGameData: calculateAdjustedHandicapsFromGameData,
        completeGameInBothCollections: completeGameInBothCollections,
        updateScheduledGameStatus: updateScheduledGameStatus,
        captureCelebrationImage: captureCelebrationImage,
        cropAndBrighten: cropAndBrighten,
        storeCelebrationImageInFirestore: storeCelebrationImageInFirestore
    };
    
})();

// Make available globally
window.SignCard = SignCard;

/*
FILE: js/sign-card.js
VERSION: 1.23
KEY CHANGES from v1.22:
   - ADDED: cropAndBrighten() - removes padding and brightens image
   - ADDED: storeCelebrationImageInFirestore() - stores Base64 directly
   - CHANGED: captureCelebrationImage() - now crops and brightens
   - CHANGED: Removed Firebase Storage dependency (no CORS issues)
   - CHANGED: Pure black background for capture
   - CHANGED: 20% brightness enhancement for vibrant images
   - FIXED: No more dim filter effect on captured images
   - FIXED: Removed empty padding from captured images
DEPENDS ON: Firebase Firestore, html2canvas
STATUS: Ready for integration
*/