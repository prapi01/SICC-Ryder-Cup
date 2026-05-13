/*
FILE: js/hcp-adjust.js
VERSION: 2.07
KEY CHANGES:
   - NEW: Anchor selection flow at Handicap Adjustment screen
   - If only one player with 0 handicap → auto-select, calculate, save, show read-only table
   - If multiple players with 0 handicap → show dropdown, user selects anchor, then calculate/save
   - No "Confirm & Save" button after selection - table is read-only
   - Performance adjustment: Win = +1, Loss = -1, Tie = +0.5
   - Match de-duplication (each match counted once)
   - Contribution thresholds: >= 3.5 → -1, <= -3.5 → +1, else 0
   - Four buttons: Back to Scorecard, Celebration Screen, Main Menu, Exit
DEPENDS ON: Firebase Firestore, history-record.js, sign-card.js, game-match.js
STATUS: Ready for integration
*/

var HandicapAdjustment = (function() {
    
    var currentGameId = null;
    var currentArchiveId = null;
    var allPlayers = [];
    var anchorPlayer = null;
    var courseSi = null;
    var coursePar = null;
    var startingHole = null;
    var flight1Data = null;
    var flight2Data = null;
    var currentTableData = null;
    var isViewOnly = false;
    
    // ============================================================
    // Helper: Get player's score for a specific hole
    // ============================================================
    
    function getPlayerScore(player, holeNumber, flight1DataStr, flight2DataStr) {
        var flightDataStr = player.flight === 1 ? flight1DataStr : flight2DataStr;
        var holeData = GameData.parseHoleData(flightDataStr, holeNumber);
        if (!holeData || !holeData.saved) return null;
        
        var flightPlayers = allPlayers.filter(function(p) { return p.flight === player.flight; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        if (player.team === 'A') {
            if (teamA[0] && teamA[0].name === player.name) return holeData.scores.a1;
            if (teamA[1] && teamA[1].name === player.name) return holeData.scores.a2;
        } else {
            if (teamB[0] && teamB[0].name === player.name) return holeData.scores.b1;
            if (teamB[1] && teamB[1].name === player.name) return holeData.scores.b2;
        }
        return null;
    }
    
    // ============================================================
    // Get stroke holes for handicap difference
    // ============================================================
    
    function getStrokeHoles(handicapDiff) {
        if (handicapDiff <= 0) return [];
        var holesWithSi = [];
        for (var i = 0; i < 18; i++) {
            holesWithSi.push({ hole: i + 1, si: courseSi[i] });
        }
        holesWithSi.sort(function(a, b) { return a.si - b.si; });
        var strokeHoles = [];
        for (var i = 0; i < handicapDiff && i < 18; i++) {
            strokeHoles.push(holesWithSi[i].hole);
        }
        return strokeHoles;
    }
    
    function getStrokesForHole(holeNumber, handicapDiff) {
        if (handicapDiff <= 0) return 0;
        var strokeHoles = getStrokeHoles(handicapDiff);
        for (var i = 0; i < strokeHoles.length; i++) {
            if (strokeHoles[i] === holeNumber) return 1;
        }
        return 0;
    }
    
    // ============================================================
    // Calculate net score for a player on a hole
    // ============================================================
    
    function getNetScore(player, grossScore, holeNumber, opponentHandicap) {
        var handicapDiff = Math.abs(player.handicap - opponentHandicap);
        var isPlayerReceiving = (player.handicap > opponentHandicap);
        var strokes = isPlayerReceiving ? getStrokesForHole(holeNumber, handicapDiff) : 0;
        return grossScore - strokes;
    }
    
    // ============================================================
    // Calculate Anchor Adjustment (18-hole match vs anchor)
    // ============================================================
    
    function calculateAnchorAdjustment(player, anchor, flight1DataStr, flight2DataStr) {
        if (player.name === anchor.name) return 0;
        
        var playerWon = 0;
        var anchorWon = 0;
        
        for (var hole = 1; hole <= 18; hole++) {
            var playerGross = getPlayerScore(player, hole, flight1DataStr, flight2DataStr);
            var anchorGross = getPlayerScore(anchor, hole, flight1DataStr, flight2DataStr);
            
            if (playerGross === null || anchorGross === null) continue;
            
            var playerNet = getNetScore(player, playerGross, hole, anchor.handicap);
            var anchorNet = getNetScore(anchor, anchorGross, hole, player.handicap);
            
            if (playerNet < anchorNet) {
                playerWon++;
            } else if (anchorNet < playerNet) {
                anchorWon++;
            }
        }
        
        var netWon = playerWon - anchorWon;
        var adjustment = Math.floor(Math.abs(netWon) / 2);
        return netWon >= 0 ? -adjustment : adjustment;
    }
    
    // ============================================================
    // Calculate Performance Adjustment from match results
    // Win = +1, Loss = -1, Tie = +0.5, each match counted once
    // ============================================================
    
    function calculatePerformanceAdjustmentFromCache(cache, allPlayersList) {
        var crossResults = cache.matchResults.cross;
        var contributions = {};
        
        for (var i = 0; i < allPlayersList.length; i++) {
            contributions[allPlayersList[i].name] = 0;
        }
        
        var processedMatches = new Set();
        
        for (var key in crossResults) {
            if (key.indexOf('_vs_') !== -1) {
                var parts = key.split('_vs_');
                var playerA = parts[0];
                var playerB = parts[1];
                
                var pairId = [playerA, playerB].sort().join('|');
                if (processedMatches.has(pairId)) continue;
                processedMatches.add(pairId);
                
                var value = crossResults[key];
                
                if (value > 0) {
                    contributions[playerA] += 1;
                    contributions[playerB] += -1;
                } else if (value < 0) {
                    contributions[playerA] += -1;
                    contributions[playerB] += 1;
                } else {
                    contributions[playerA] += 0.5;
                    contributions[playerB] += 0.5;
                }
            }
        }
        
        var perfAdjustments = {};
        for (var playerName in contributions) {
            var contribution = contributions[playerName];
            if (contribution >= 3.5) {
                perfAdjustments[playerName] = -1;
            } else if (contribution <= -3.5) {
                perfAdjustments[playerName] = 1;
            } else {
                perfAdjustments[playerName] = 0;
            }
        }
        
        return perfAdjustments;
    }
    
    // ============================================================
    // Calculate all adjustments for anchor
    // ============================================================
    
    function calculateAllAdjustments(anchor) {
        var cache = null;
        if (typeof GameLoader !== 'undefined') {
            cache = GameLoader.getLocalCache();
        }
        
        var perfAdjustments = calculatePerformanceAdjustmentFromCache(cache, allPlayers);
        
        var playersWithAdjustments = [];
        var rawNewList = [];
        
        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            var anchorAdj = calculateAnchorAdjustment(player, anchor, flight1Data, flight2Data);
            var perfAdj = perfAdjustments[player.name] || 0;
            var rawNew = player.handicap + perfAdj + anchorAdj;
            
            playersWithAdjustments.push({
                name: player.name,
                label: player.label,
                currentHcp: player.handicap,
                anchorAdj: anchorAdj,
                perfAdj: perfAdj,
                rawNew: rawNew
            });
            rawNewList.push(rawNew);
        }
        
        var lowestRaw = Math.min.apply(null, rawNewList);
        var needsZeroRise = (lowestRaw < 0);
        var zeroRiseAmount = needsZeroRise ? -lowestRaw : 0;
        var newAnchorName = null;
        
        if (needsZeroRise) {
            for (var i = 0; i < playersWithAdjustments.length; i++) {
                playersWithAdjustments[i].newAnchor = playersWithAdjustments[i].rawNew + zeroRiseAmount;
            }
            playersWithAdjustments.sort(function(a, b) { return a.newAnchor - b.newAnchor; });
            var newAnchorPlayer = playersWithAdjustments.find(function(p) { return p.newAnchor === 0; });
            newAnchorName = newAnchorPlayer ? newAnchorPlayer.name : null;
        } else {
            for (var i = 0; i < playersWithAdjustments.length; i++) {
                playersWithAdjustments[i].newHcp = playersWithAdjustments[i].rawNew;
            }
            playersWithAdjustments.sort(function(a, b) { return a.newHcp - b.newHcp; });
        }
        
        return {
            players: playersWithAdjustments,
            needsZeroRise: needsZeroRise,
            zeroRiseAmount: zeroRiseAmount,
            newAnchorName: newAnchorName
        };
    }
    
    // ============================================================
    // Save to Firestore and update player profiles
    // ============================================================
    
    function saveAdjustmentToFirestore(anchor, calculationResult, callback) {
        var handicapData = {
            anchor: anchor.name,
            players: calculationResult.players.map(function(p) {
                return {
                    name: p.name,
                    currentHcp: p.currentHcp,
                    anchorAdj: p.anchorAdj,
                    perfAdj: p.perfAdj,
                    newHcp: calculationResult.needsZeroRise ? p.newAnchor : p.newHcp
                };
            }),
            needsZeroRise: calculationResult.needsZeroRise,
            zeroRiseAmount: calculationResult.zeroRiseAmount,
            newAnchor: calculationResult.newAnchorName || anchor.name
        };
        
        if (currentArchiveId && typeof HistoryRecord !== 'undefined') {
            HistoryRecord.updateWithHandicap(currentArchiveId, handicapData, function(err) {
                if (err) {
                    console.error("Error saving handicap data:", err);
                    if (callback) callback(err);
                } else {
                    updatePlayerProfiles(handicapData.players, callback);
                }
            });
        } else {
            updatePlayerProfiles(handicapData.players, callback);
        }
    }
    
    function updatePlayerProfiles(players, callback) {
        firebase.firestore().collection('playerInformation').doc('defaultPlayers').get()
            .then(function(doc) {
                if (doc.exists && doc.data().players) {
                    var currentPlayers = doc.data().players;
                    for (var i = 0; i < currentPlayers.length; i++) {
                        for (var j = 0; j < players.length; j++) {
                            if (currentPlayers[i].name === players[j].name) {
                                currentPlayers[i].handicap = players[j].newHcp;
                                console.log(`Updated ${players[j].name}: ${players[j].currentHcp} → ${players[j].newHcp}`);
                            }
                        }
                    }
                    return firebase.firestore().collection('playerInformation').doc('defaultPlayers').set({
                        players: currentPlayers,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                return Promise.resolve();
            })
            .then(function() {
                if (callback) callback(null);
            })
            .catch(function(err) {
                console.error("Error updating player profiles:", err);
                if (callback) callback(err);
            });
    }
    
    // ============================================================
    // Display Table (Read-only after anchor selected)
    // ============================================================
    
    function showAdjustmentTable(calculationResult, anchorName, isReadOnly) {
        var players = calculationResult.players;
        var hasNewAnchor = calculationResult.needsZeroRise && calculationResult.zeroRiseAmount > 0;
        var newAnchorName = calculationResult.newAnchorName;
        
        var tableHtml = '<div style="overflow-x: auto; margin: 16px 0; -webkit-overflow-scrolling: touch;">';
        tableHtml += '<table style="width:100%; border-collapse: collapse; font-size:0.75rem; min-width: 460px;">';
        tableHtml += '<thead><tr style="background:#1a3a1a;">';
        tableHtml += '<th style="padding:6px 4px; text-align:left; width:90px;">Player</th>';
        tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Cur</th>';
        tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Anc</th>';
        tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Perf</th>';
        tableHtml += '<th style="padding:6px 4px; text-align:center; width:55px;">New</th>';
        tableHtml += '</tr></thead><tbody>';
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var displayHcp = hasNewAnchor ? p.newAnchor : p.newHcp;
            
            tableHtml += '<tr style="border-bottom:1px solid #333;">';
            tableHtml += `<td style="padding:6px 4px; text-align:left;">${escapeHtml(p.name)}</td>`;
            tableHtml += `<td style="padding:6px 4px; text-align:center;">${p.currentHcp}</td>`;
            tableHtml += `<td style="padding:6px 4px; text-align:center; color: ${p.anchorAdj >= 0 ? '#4caf50' : '#ff6b6b'}; font-weight:600;">${p.anchorAdj >= 0 ? '+' + p.anchorAdj : p.anchorAdj}</td>`;
            tableHtml += `<td style="padding:6px 4px; text-align:center; color: ${p.perfAdj > 0 ? '#4caf50' : (p.perfAdj < 0 ? '#ff6b6b' : '#888')}; font-weight:600;">${p.perfAdj > 0 ? '+' + p.perfAdj : (p.perfAdj < 0 ? p.perfAdj : '0')}</td>`;
            tableHtml += `<td style="padding:6px 4px; text-align:center; color:#4caf50; font-weight:700;">${displayHcp}</td>`;
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table></div>';
        
        var anchorInfoHtml = `<div style="text-align: center; margin-bottom: 12px;"><span style="color: #4caf50; font-size:0.8rem;">✓ Anchor: ${escapeHtml(anchorName)}</span></div>`;
        
        var messageHtml = '';
        if (hasNewAnchor && newAnchorName) {
            messageHtml = `<div style="font-size:0.85rem; color:#ffaa44; text-align:center; margin-bottom:12px;">🎉 ${escapeHtml(newAnchorName)} will be the NEW ANCHOR! 🎉</div>`;
        }
        
        var modalHtml = `
            <div class="modal-overlay" id="hcpAdjustModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:10000;">
                <div style="background:#1a1a1a; border-radius:28px; padding:16px; max-width:95%; width:auto; border:2px solid #4caf50;">
                    <div style="font-size:1.3rem; font-weight:800; color:#4caf50; text-align:center; margin-bottom:4px;">🏌️ HANDICAP ADJUSTMENT</div>
                    ${messageHtml}
                    ${anchorInfoHtml}
                    ${tableHtml}
                    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; justify-content:center;">
                        <button id="backToScorecardBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🏌️ Back to Scorecard</button>
                        <button id="celebrationBtn" style="background:#1a3a1a; border:1px solid #ffaa44; color:#ffaa44; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🎉 Celebration Screen</button>
                        <button id="mainMenuBtn" style="background:#1a1a1a; border:1px solid #333; color:#888; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🏠 Main Menu</button>
                        <button id="exitBtn" style="background:#1a1a1a; border:1px solid #333; color:#888; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🚪 Exit</button>
                    </div>
                </div>
            </div>
        `;
        
        var existingModal = document.getElementById('hcpAdjustModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Button handlers
        document.getElementById('backToScorecardBtn').addEventListener('click', function() {
            document.getElementById('hcpAdjustModal').remove();
            window.location.href = 'view-game.html';
        });
        
        document.getElementById('celebrationBtn').addEventListener('click', function() {
            document.getElementById('hcpAdjustModal').remove();
            if (typeof SignCard !== 'undefined' && SignCard.replayCelebration) {
                SignCard.replayCelebration();
            } else {
                alert('Celebration screen not available');
            }
        });
        
        document.getElementById('mainMenuBtn').addEventListener('click', function() {
            window.location.href = 'index.html';
        });
        
        document.getElementById('exitBtn').addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }
    
    // ============================================================
    // Anchor Selection Modal
    // ============================================================
    
    function showAnchorSelectionModal(zeroHcpPlayers) {
        var optionsHtml = '';
        for (var i = 0; i < zeroHcpPlayers.length; i++) {
            optionsHtml += `<option value="${zeroHcpPlayers[i].name}">${zeroHcpPlayers[i].name} (HCP ${zeroHcpPlayers[i].handicap})</option>`;
        }
        
        var modalHtml = `
            <div class="modal-overlay" id="anchorSelectModal" style="z-index: 10001;">
                <div style="background:#1a1a1a; border-radius:28px; padding:28px; max-width:360px; width:90%; text-align:center; border:2px solid #4caf50;">
                    <div style="font-size:1.3rem; font-weight:800; color:#4caf50; margin-bottom:16px;">🏌️ SELECT ANCHOR</div>
                    <div style="font-size:0.9rem; color:#ccc; margin-bottom:20px;">Who is today's Anchor? (Lowest handicap player)</div>
                    <select id="anchorSelect" style="width:100%; background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:12px; border-radius:30px; font-size:1rem; margin-bottom:20px;">
                        ${optionsHtml}
                    </select>
                    <button id="anchorConfirmBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:12px 24px; border-radius:40px; font-size:1rem; font-weight:700; cursor:pointer; width:100%;">✓ Confirm Anchor</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById('anchorConfirmBtn').addEventListener('click', function() {
            var selectedName = document.getElementById('anchorSelect').value;
            var selectedAnchor = allPlayers.find(p => p.name === selectedName);
            document.getElementById('anchorSelectModal').remove();
            
            // Calculate and save with selected anchor
            anchorPlayer = selectedAnchor;
            var calculationResult = calculateAllAdjustments(anchorPlayer);
            currentTableData = calculationResult;
            
            // Save to Firestore
            saveAdjustmentToFirestore(anchorPlayer, calculationResult, function(err) {
                if (err) {
                    alert("Error saving handicap data. Please try again.");
                } else {
                    // Show read-only table
                    showAdjustmentTable(calculationResult, anchorPlayer.name, true);
                }
            });
        });
    }
    
    // ============================================================
    // Load game data from Firestore
    // ============================================================
    
    function loadGameData(gameId, callback) {
        firebase.firestore().collection("scheduledGames").doc(gameId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    callback(null);
                    return;
                }
                var data = doc.data();
                courseSi = data.course ? data.course.si : [];
                coursePar = data.course ? data.course.par : [];
                startingHole = data.startingHole || 1;
                flight1Data = data.f1 && data.f1.d ? data.f1.d : "";
                flight2Data = data.f2 && data.f2.d ? data.f2.d : "";
                callback(data);
            })
            .catch(function(err) {
                console.error("Error loading game data:", err);
                callback(null);
            });
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
    // Main Entry Point
    // ============================================================
    
    function init(gameId, archiveId, winningPlayers, matchPoints, holeResults, isViewOnlyMode) {
        currentGameId = gameId;
        currentArchiveId = archiveId;
        allPlayers = winningPlayers.teamA.concat(winningPlayers.teamB);
        isViewOnly = isViewOnlyMode || false;
        
        allPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        // Find players with handicap 0
        var zeroHcpPlayers = allPlayers.filter(function(p) { return p.handicap === 0; });
        
        loadGameData(gameId, function(gameData) {
            if (!gameData) {
                window.location.href = "index.html";
                return;
            }
            
            if (zeroHcpPlayers.length === 1) {
                // Single anchor - auto-select
                anchorPlayer = zeroHcpPlayers[0];
                var calculationResult = calculateAllAdjustments(anchorPlayer);
                currentTableData = calculationResult;
                
                // Auto-save to Firestore
                saveAdjustmentToFirestore(anchorPlayer, calculationResult, function(err) {
                    if (err) {
                        console.error("Error saving handicap data:", err);
                        alert("Error saving handicap data. Please try again.");
                    } else {
                        showAdjustmentTable(calculationResult, anchorPlayer.name, true);
                    }
                });
            } else if (zeroHcpPlayers.length > 1) {
                // Multiple anchors - show selection modal
                showAnchorSelectionModal(zeroHcpPlayers);
            } else {
                // No zero handicap players - use lowest handicap as anchor
                var lowestHcpPlayer = allPlayers[0];
                anchorPlayer = lowestHcpPlayer;
                var calculationResult = calculateAllAdjustments(anchorPlayer);
                currentTableData = calculationResult;
                
                saveAdjustmentToFirestore(anchorPlayer, calculationResult, function(err) {
                    if (err) {
                        console.error("Error saving handicap data:", err);
                        alert("Error saving handicap data. Please try again.");
                    } else {
                        showAdjustmentTable(calculationResult, anchorPlayer.name, true);
                    }
                });
            }
        });
    }
    
    return {
        init: init
    };
})();

/*
FILE: js/hcp-adjust.js
VERSION: 2.07
KEY CHANGES:
   - NEW: Anchor selection flow at Handicap Adjustment screen
   - If only one player with 0 handicap → auto-select, calculate, save, show read-only table
   - If multiple players with 0 handicap → show dropdown, user selects anchor, then calculate/save
   - No "Confirm & Save" button after selection - table is read-only
   - Performance adjustment: Win = +1, Loss = -1, Tie = +0.5
   - Match de-duplication (each match counted once)
   - Contribution thresholds: >= 3.5 → -1, <= -3.5 → +1, else 0
   - Four buttons: Back to Scorecard, Celebration Screen, Main Menu, Exit
DEPENDS ON: Firebase Firestore, history-record.js, sign-card.js, game-match.js
STATUS: Ready for integration
*/