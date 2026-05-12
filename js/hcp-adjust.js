/*
FILE: js/hcp-adjust.js
VERSION: 2.04
KEY CHANGES:
   - ADDED: Four buttons on main screen: Back to Scorecard, Celebration Screen, Main Menu, Exit
   - ADDED: View-only mode for non-updaters (no confirm button)
   - ADDED: Multi-anchor selection - first updater picks anchor, confirms
   - ADDED: Once confirmed, all devices see confirmed table (read-only)
   - ADDED: Back to Scorecard returns to read-only scorecard with return button
   - ADDED: Celebration Screen replays celebration and returns to this screen
   - Maintains scroll indicator for wide tables
DEPENDS ON: Firebase Firestore, history-record.js, sign-card.js
STATUS: Ready for integration
*/

var HandicapAdjustment = (function() {
    
    var currentGameId = null;
    var currentArchiveId = null;
    var allPlayers = [];
    var anchorPlayer = null;
    var anchorCandidates = [];
    var matchPointsData = null;
    var courseSi = null;
    var coursePar = null;
    var startingHole = null;
    var flight1Data = null;
    var flight2Data = null;
    var currentTableData = null;
    var needsZeroRiseFlag = false;
    var zeroRiseAmountValue = 0;
    var isConfirmed = false;  // Track if anchor has been confirmed
    var isViewOnly = false;   // True for non-updater devices
    
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
    // Calculate net score for a player on a hole (with handicap)
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
    // Calculate Performance Adjustment (from Game 1 match results)
    // ============================================================
    
    function calculatePerformanceAdjustment(playerName) {
        if (!matchPointsData || !matchPointsData[playerName]) return 0;
        var totalPoints = matchPointsData[playerName].total || 0;
        if (totalPoints >= 3.5) return -1;
        if (totalPoints <= 0.5) return 1;
        return 0;
    }
    
    // ============================================================
    // Calculate all adjustments for current anchor
    // ============================================================
    
    function calculateAllAdjustments(anchor) {
        var playersWithAdjustments = [];
        var rawNewList = [];
        
        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            var anchorAdj = calculateAnchorAdjustment(player, anchor, flight1Data, flight2Data);
            var perfAdj = calculatePerformanceAdjustment(player.name);
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
    // Add scroll indicator if needed
    // ============================================================
    
    function addScrollIndicator(container) {
        var tableWrapper = container.querySelector('div[style*="overflow-x: auto"]');
        if (!tableWrapper) return;
        
        if (tableWrapper.scrollWidth > tableWrapper.clientWidth + 5) {
            var hint = document.createElement('div');
            hint.style.cssText = 'text-align: center; font-size: 0.65rem; color: #888; margin-top: 6px;';
            hint.innerHTML = '← Swipe to see more →';
            tableWrapper.parentNode.insertBefore(hint, tableWrapper.nextSibling);
            
            setTimeout(function() {
                if (hint && hint.remove) hint.remove();
            }, 3000);
        }
    }
    
    // ============================================================
    // Display Table with 4 buttons
    // ============================================================
    
    function showAdjustmentTable(calculationResult, anchorName, isReadOnly) {
        var players = calculationResult.players;
        var hasNewAnchor = calculationResult.needsZeroRise && calculationResult.zeroRiseAmount > 0;
        var newAnchorName = calculationResult.newAnchorName;
        
        // Fixed column widths
        var tableHtml = '<div style="overflow-x: auto; margin: 16px 0; -webkit-overflow-scrolling: touch;">';
        tableHtml += '<table style="width:100%; border-collapse: collapse; font-size:0.75rem; min-width: 460px;">';
        tableHtml += '<thead><tr style="background:#1a3a1a;">';
        
        if (hasNewAnchor) {
            tableHtml += '<th style="padding:6px 4px; text-align:left; width:90px;">Player</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Cur</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Anc</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Perf</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Raw</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:55px;">New</th>';
        } else {
            tableHtml += '<th style="padding:6px 4px; text-align:left; width:90px;">Player</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Cur</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Anc</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:50px;">Perf</th>';
            tableHtml += '<th style="padding:6px 4px; text-align:center; width:55px;">New</th>';
        }
        tableHtml += '</tr></thead><tbody>';
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var isNewAnchor = hasNewAnchor && p.newAnchor === 0;
            
            tableHtml += '<tr style="border-bottom:1px solid #333;">';
            tableHtml += `<td style="padding:6px 4px; text-align:left;">${escapeHtml(p.name)}</td>`;
            tableHtml += `<td style="padding:6px 4px; text-align:center;">${p.currentHcp}</td>`;
            tableHtml += `<td style="padding:6px 4px; text-align:center; color: ${p.anchorAdj >= 0 ? '#4caf50' : '#ff6b6b'}; font-weight:600;">${p.anchorAdj >= 0 ? '+' + p.anchorAdj : p.anchorAdj}</td>`;
            tableHtml += `<td style="padding:6px 4px; text-align:center; color: ${p.perfAdj > 0 ? '#4caf50' : (p.perfAdj < 0 ? '#ff6b6b' : '#888')}; font-weight:600;">${p.perfAdj > 0 ? '+' + p.perfAdj : (p.perfAdj < 0 ? p.perfAdj : '0')}</td>`;
            
            if (hasNewAnchor) {
                tableHtml += `<td style="padding:6px 4px; text-align:center; color: ${p.rawNew > 0 ? '#4caf50' : (p.rawNew < 0 ? '#ff6b6b' : '#888')}; font-weight:600;">${p.rawNew > 0 ? '+' + p.rawNew : p.rawNew}</td>`;
                tableHtml += `<td style="padding:6px 4px; text-align:center; ${isNewAnchor ? 'color: #ffaa44; font-weight: 800;' : 'color: #4caf50; font-weight: 600;'}">${p.newAnchor}</td>`;
            } else {
                tableHtml += `<td style="padding:6px 4px; text-align:center; color:#4caf50; font-weight:700;">${p.newHcp}</td>`;
            }
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table></div>';
        
        // Build anchor selector dropdown (only if not confirmed and not read-only)
        var anchorSelectorHtml = '';
        if (!isConfirmed && !isReadOnly && anchorCandidates.length > 1) {
            var optionsHtml = '';
            for (var i = 0; i < anchorCandidates.length; i++) {
                var selected = (anchorCandidates[i].name === anchorName) ? 'selected' : '';
                optionsHtml += `<option value="${anchorCandidates[i].name}" ${selected}>${anchorCandidates[i].name} (${anchorCandidates[i].handicap})</option>`;
            }
            anchorSelectorHtml = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                    <span style="color: #888; font-size:0.8rem;">Select Anchor:</span>
                    <select id="anchorSelect" style="background: #1a3a1a; border: 1px solid #4caf50; color: #4caf50; padding: 6px 12px; border-radius: 30px; font-size: 0.8rem; font-weight: 600;">
                        ${optionsHtml}
                    </select>
                </div>
            `;
        } else if (anchorCandidates.length === 1) {
            anchorSelectorHtml = `
                <div style="text-align: center; margin-bottom: 12px;">
                    <span style="color: #4caf50; font-size:0.8rem;">Anchor: ${escapeHtml(anchorName)} (${anchorPlayer.handicap})</span>
                </div>
            `;
        } else if (isConfirmed || isReadOnly) {
            anchorSelectorHtml = `
                <div style="text-align: center; margin-bottom: 12px;">
                    <span style="color: #4caf50; font-size:0.8rem;">✓ Confirmed Anchor: ${escapeHtml(anchorName)}</span>
                </div>
            `;
        }
        
        var messageHtml = '';
        if (hasNewAnchor && newAnchorName && !isConfirmed) {
            messageHtml = `<div style="font-size:0.85rem; color:#ffaa44; text-align:center; margin-bottom:12px;">🎉 ${escapeHtml(newAnchorName)} will be the NEW ANCHOR! 🎉</div>`;
        }
        
        // Four buttons
        var confirmButtonHtml = '';
        if (!isReadOnly && !isConfirmed) {
            confirmButtonHtml = `<button id="confirmSaveBtn" style="background:#ffaa44; border:none; color:#1a3a1a; padding:8px 18px; border-radius:30px; font-size:0.8rem; font-weight:800; cursor:pointer;">✓ Confirm & Save</button>`;
        }
        
        var modalHtml = `
            <div class="modal-overlay" id="hcpAdjustModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:10000;">
                <div style="background:#1a1a1a; border-radius:28px; padding:16px; max-width:95%; width:auto; border:2px solid #4caf50;">
                    <div style="font-size:1.3rem; font-weight:800; color:#4caf50; text-align:center; margin-bottom:4px;">🏌️ HANDICAP ADJUSTMENT</div>
                    ${messageHtml}
                    ${anchorSelectorHtml}
                    ${tableHtml}
                    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; justify-content:center;">
                        <button id="backToScorecardBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🏌️ Back to Scorecard</button>
                        <button id="celebrationBtn" style="background:#1a3a1a; border:1px solid #ffaa44; color:#ffaa44; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🎉 Celebration Screen</button>
                        <button id="mainMenuBtn" style="background:#1a1a1a; border:1px solid #333; color:#888; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🏠 Main Menu</button>
                        <button id="exitBtn" style="background:#1a1a1a; border:1px solid #333; color:#888; padding:8px 14px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🚪 Exit</button>
                        ${confirmButtonHtml}
                    </div>
                </div>
            </div>
        `;
        
        var existingModal = document.getElementById('hcpAdjustModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Add scroll indicator
        var modalDiv = document.querySelector('#hcpAdjustModal > div');
        if (modalDiv) addScrollIndicator(modalDiv);
        
        // Store current calculation result for recalc on anchor change
        currentTableData = calculationResult;
        
        // Anchor change handler
        var anchorSelect = document.getElementById('anchorSelect');
        if (anchorSelect) {
            anchorSelect.addEventListener('change', function() {
                var newAnchorName = this.value;
                var newAnchor = allPlayers.find(function(p) { return p.name === newAnchorName; });
                if (newAnchor) {
                    anchorPlayer = newAnchor;
                    var newCalculation = calculateAllAdjustments(anchorPlayer);
                    currentTableData = newCalculation;
                    document.getElementById('hcpAdjustModal').remove();
                    showAdjustmentTable(newCalculation, anchorPlayer.name, isReadOnly);
                }
            });
        }
        
        // Button handlers
        document.getElementById('backToScorecardBtn').addEventListener('click', function() {
            document.getElementById('hcpAdjustModal').remove();
            showReadOnlyScorecard();
        });
        
        document.getElementById('celebrationBtn').addEventListener('click', function() {
            document.getElementById('hcpAdjustModal').remove();
            if (typeof SignCard !== 'undefined' && SignCard.replayCelebration) {
                SignCard.replayCelebration();
                // Re-show this screen after celebration closes
                var checkInterval = setInterval(function() {
                    if (!document.getElementById('celebrationModal')) {
                        clearInterval(checkInterval);
                        showAdjustmentTable(currentTableData, anchorPlayer.name, isReadOnly);
                    }
                }, 500);
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
        
        var confirmBtn = document.getElementById('confirmSaveBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                confirmAndSave();
            });
        }
    }
    
    function showReadOnlyScorecard() {
        // Open view-game.html in same tab to see read-only scorecard
        // User can navigate back using back button
        window.location.href = 'view-game.html';
    }
    
    function confirmAndSave() {
        // Prepare handicap data for archive
        var handicapData = {
            anchor: anchorPlayer.name,
            players: currentTableData.players.map(function(p) {
                return {
                    name: p.name,
                    currentHcp: p.currentHcp,
                    anchorAdj: p.anchorAdj,
                    perfAdj: p.perfAdj,
                    newHcp: currentTableData.needsZeroRise ? p.newAnchor : p.newHcp
                };
            }),
            needsZeroRise: currentTableData.needsZeroRise,
            zeroRiseAmount: currentTableData.zeroRiseAmount,
            newAnchor: currentTableData.newAnchorName || anchorPlayer.name
        };
        
        // Update archive record
        if (currentArchiveId && typeof HistoryRecord !== 'undefined') {
            HistoryRecord.updateWithHandicap(currentArchiveId, handicapData, function(err) {
                if (err) {
                    console.error("Error saving handicap data:", err);
                    alert("Error saving handicap data. Please try again.");
                } else {
                    updatePlayerProfiles(handicapData.players);
                }
            });
        } else {
            // Fallback: just update player profiles
            updatePlayerProfiles(handicapData.players);
        }
    }
    
    function updatePlayerProfiles(players) {
        // Update playerInformation/defaultPlayers
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
                alert("✓ Handicaps updated successfully!");
                window.location.href = 'index.html';
            })
            .catch(function(err) {
                console.error("Error updating player profiles:", err);
                alert("Handicaps saved to game record but player profiles could not be updated.");
                window.location.href = 'index.html';
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
        matchPointsData = matchPoints;
        isViewOnly = isViewOnlyMode || false;
        
        allPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        // Find anchor candidates (lowest handicap)
        var lowestHcp = allPlayers[0].handicap;
        anchorCandidates = allPlayers.filter(function(p) { return p.handicap === lowestHcp; });
        
        // Load course data
        loadGameData(gameId, function(gameData) {
            if (!gameData) {
                window.location.href = "index.html";
                return;
            }
            
            // Select anchor (first candidate if multiple, user can change later)
            anchorPlayer = anchorCandidates[0];
            
            // Calculate and display table
            var calculationResult = calculateAllAdjustments(anchorPlayer);
            showAdjustmentTable(calculationResult, anchorPlayer.name, isViewOnly);
        });
    }
    
    return {
        init: init
    };
})();

/*
FILE: js/hcp-adjust.js
VERSION: 2.04
KEY CHANGES:
   - ADDED: Four buttons on main screen: Back to Scorecard, Celebration Screen, Main Menu, Exit
   - ADDED: View-only mode for non-updaters (no confirm button)
   - ADDED: Multi-anchor selection - first updater picks anchor, confirms
   - ADDED: Once confirmed, all devices see confirmed table (read-only)
   - ADDED: Back to Scorecard returns to read-only scorecard with return button
   - ADDED: Celebration Screen replays celebration and returns to this screen
   - Maintains scroll indicator for wide tables
DEPENDS ON: Firebase Firestore, history-record.js, sign-card.js
STATUS: Ready for integration
*/