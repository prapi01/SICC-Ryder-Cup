/*
FILE: js/hcp-adjust.js
VERSION: 2.01
PURPOSE: Handicap Adjustment module for post-match handicap updates
          - Anchor Adjustment (18-hole match vs anchor player) - counts total holes won/lost
          - Performance Adjustment (based on Game 1 match play results - 4 matches per player)
          - Zero-rise adjustment if any Raw New handicap becomes negative
          - Displays table with horizontal scroll for mobile
          - Green/Red colors for positive/negative adjustments
          - Gold color for new anchor
DEPENDS ON: Firebase Firestore, game-match.js, game-stroke.js
STATUS: Ready for testing
*/

var HandicapAdjustment = (function() {
    
    var currentGameId = null;
    var allPlayers = [];
    var anchorPlayer = null;
    var matchPointsData = null;
    var holeNetResults = null;
    var courseSi = null;
    var coursePar = null;
    var startingHole = null;
    var flight1Data = null;
    var flight2Data = null;
    
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
        // Each 2 holes difference = 1 stroke adjustment
        var adjustment = Math.floor(Math.abs(netWon) / 2);
        return netWon >= 0 ? -adjustment : adjustment;
    }
    
    // ============================================================
    // Calculate Performance Adjustment (from Game 1 match results)
    // ============================================================
    
    function calculatePerformanceAdjustment(playerName) {
        if (!matchPointsData || !matchPointsData[playerName]) return 0;
        
        var totalPoints = matchPointsData[playerName].total || 0;
        
        if (totalPoints >= 3.5) return -1;  // Handicap DOWN (better performance)
        if (totalPoints <= 0.5) return 1;   // Handicap UP (worse performance)
        return 0;
    }
    
    // ============================================================
    // Get anchor player (lowest handicap, or user selected if tie)
    // ============================================================
    
    function determineAnchor(players, callback) {
        var lowestHcp = Math.min.apply(null, players.map(function(p) { return p.handicap; }));
        var candidates = players.filter(function(p) { return p.handicap === lowestHcp; });
        
        if (candidates.length === 1) {
            callback(candidates[0]);
        } else {
            showAnchorSelectionModal(candidates, callback);
        }
    }
    
    function showAnchorSelectionModal(candidates, callback) {
        var buttonsHtml = candidates.map(function(c) {
            return `<button class="anchor-select-btn" data-name="${c.name}">${c.name} (${c.label}) - Hcp ${c.handicap}</button>`;
        }).join('');
        
        var modalHtml = `
            <div class="modal-overlay" id="anchorSelectModal">
                <div class="anchor-select-modal">
                    <div class="anchor-select-title">🏌️ SELECT ANCHOR</div>
                    <div class="anchor-select-message">Multiple players have the lowest handicap.<br>Who is the anchor for today's match?</div>
                    <div class="anchor-select-buttons">
                        ${buttonsHtml}
                    </div>
                    <button class="anchor-select-cancel" id="anchorCancelBtn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        candidates.forEach(function(c) {
            var btn = document.querySelector(`.anchor-select-btn[data-name="${c.name}"]`);
            if (btn) {
                btn.addEventListener('click', function() {
                    document.getElementById('anchorSelectModal').remove();
                    callback(c);
                });
            }
        });
        
        document.getElementById('anchorCancelBtn').addEventListener('click', function() {
            document.getElementById('anchorSelectModal').remove();
            callback(null);
        });
        
        addAnchorSelectStyles();
    }
    
    function addAnchorSelectStyles() {
        if (document.getElementById('anchor-select-styles')) return;
        
        var styles = `
            <style id="anchor-select-styles">
                .anchor-select-modal {
                    background: #1a1a1a;
                    border-radius: 32px;
                    padding: 28px;
                    max-width: 350px;
                    width: 90%;
                    text-align: center;
                    border: 2px solid #4caf50;
                }
                .anchor-select-title {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #4caf50;
                    margin-bottom: 16px;
                }
                .anchor-select-message {
                    font-size: 0.9rem;
                    color: #ccc;
                    margin-bottom: 20px;
                }
                .anchor-select-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-bottom: 16px;
                }
                .anchor-select-btn {
                    background: #1a3a1a;
                    border: 1px solid #4caf50;
                    color: #4caf50;
                    padding: 12px;
                    border-radius: 40px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .anchor-select-cancel {
                    background: #1a1a1a;
                    border: 1px solid #333;
                    color: #888;
                    padding: 10px;
                    border-radius: 40px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    width: 100%;
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    // ============================================================
    // Table Display Functions
    // ============================================================
    
    function showAdjustmentTable(playersWithAdjustments, needsZeroRise, zeroRiseAmount, newAnchorName) {
        var hasNewAnchor = needsZeroRise && zeroRiseAmount > 0;
        
        var tableHtml = '<div style="overflow-x: auto; margin: 20px 0;">';
        tableHtml += '<table style="width:100%; border-collapse: collapse; font-size:0.9rem; min-width: 550px;">';
        tableHtml += '<thead><tr style="background:#1a3a1a;">';
        
        if (hasNewAnchor) {
            tableHtml += '<th style="padding:12px; text-align:left;">Player</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">Current<br>Hcp</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">Anchor<br>Adj</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">Perfm<br>Adj</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">Raw<br>New</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">New<br>Anchor</th>';
        } else {
            tableHtml += '<th style="padding:12px; text-align:left;">Player</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">Current<br>Hcp</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">Anchor<br>Adj</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">Perfm<br>Adj</th>';
            tableHtml += '<th style="padding:12px; text-align:center;">New<br>Hcp</th>';
        }
        tableHtml += '</tr></thead><tbody>';
        
        for (var i = 0; i < playersWithAdjustments.length; i++) {
            var p = playersWithAdjustments[i];
            var isNewAnchor = hasNewAnchor && p.newAnchor === 0;
            
            tableHtml += '<tr style="border-bottom:1px solid #333;">';
            tableHtml += `<td style="padding:10px; text-align:left;">${escapeHtml(p.name)}</td>`;
            tableHtml += `<td style="padding:10px; text-align:center;">${p.currentHcp}</td>`;
            tableHtml += `<td style="padding:10px; text-align:center; color: ${p.anchorAdj >= 0 ? '#4caf50' : '#ff6b6b'}; font-weight:600;">${p.anchorAdj >= 0 ? '+' + p.anchorAdj : p.anchorAdj}</td>`;
            tableHtml += `<td style="padding:10px; text-align:center; color: ${p.perfAdj > 0 ? '#4caf50' : (p.perfAdj < 0 ? '#ff6b6b' : '#888')}; font-weight:600;">${p.perfAdj > 0 ? '+' + p.perfAdj : (p.perfAdj < 0 ? p.perfAdj : '0')}</td>`;
            
            if (hasNewAnchor) {
                tableHtml += `<td style="padding:10px; text-align:center; color: ${p.rawNew > 0 ? '#4caf50' : (p.rawNew < 0 ? '#ff6b6b' : '#888')}; font-weight:600;">${p.rawNew > 0 ? '+' + p.rawNew : p.rawNew}</td>`;
                tableHtml += `<td style="padding:10px; text-align:center; ${isNewAnchor ? 'color: #ffaa44; font-weight: 800; font-size:1.1rem;' : 'color: #4caf50; font-weight: 600;'}">${p.newAnchor}</td>`;
            } else {
                tableHtml += `<td style="padding:10px; text-align:center; color:#4caf50; font-weight:700;">${p.newHcp}</td>`;
            }
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table></div>';
        
        var messageHtml = '';
        if (hasNewAnchor) {
            messageHtml = `<div style="font-size:1rem; color:#ffaa44; text-align:center; margin-bottom:20px;">🎉 Congratulations! ${escapeHtml(newAnchorName)} is the NEW ANCHOR! 🎉</div>`;
        } else {
            messageHtml = `<div style="font-size:0.8rem; color:#888; text-align:center; margin-bottom:20px;">&nbsp;</div>`;
        }
        
        var modalHtml = `
            <div class="modal-overlay" id="hcpAdjustModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:10000;">
                <div style="background:#1a1a1a; border-radius:32px; padding:28px; max-width:95%; width:auto; border:2px solid #4caf50;">
                    <div style="font-size:2rem; font-weight:800; color:#4caf50; text-align:center; margin-bottom:8px;">🏌️ HANDICAP ADJUSTMENT</div>
                    ${messageHtml}
                    ${tableHtml}
                    <div style="display:flex; gap:12px; margin-top:20px;">
                        <button id="hcpSaveBtn" style="flex:2; background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:14px; border-radius:40px; font-size:1rem; font-weight:700; cursor:pointer;">✓ Save Changes</button>
                        <button id="hcpSkipBtn" style="flex:1; background:#1a1a1a; border:1px solid #333; color:#888; padding:14px; border-radius:40px; font-size:1rem; font-weight:600; cursor:pointer;">Skip</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById("hcpSaveBtn").addEventListener("click", function() {
            saveHandicaps(playersWithAdjustments, hasNewAnchor);
        });
        
        document.getElementById("hcpSkipBtn").addEventListener("click", function() {
            document.getElementById("hcpAdjustModal").remove();
            window.location.href = "index.html";
        });
    }
    
    async function saveHandicaps(playersWithAdjustments, hasNewAnchor) {
        try {
            var doc = await firebase.firestore().collection('playerInformation').doc('defaultPlayers').get();
            var currentPlayers = [];
            
            if (doc.exists && doc.data().players) {
                currentPlayers = doc.data().players;
            } else {
                console.warn('No defaultPlayers found');
                closeModalAndExit();
                return;
            }
            
            for (var i = 0; i < currentPlayers.length; i++) {
                for (var j = 0; j < playersWithAdjustments.length; j++) {
                    if (currentPlayers[i].name === playersWithAdjustments[j].name) {
                        var newHcp = hasNewAnchor ? playersWithAdjustments[j].newAnchor : playersWithAdjustments[j].newHcp;
                        currentPlayers[i].handicap = newHcp;
                        console.log(`Updated ${playersWithAdjustments[j].name}: ${playersWithAdjustments[j].currentHcp} → ${newHcp}`);
                    }
                }
            }
            
            await firebase.firestore().collection('playerInformation').doc('defaultPlayers').set({
                players: currentPlayers,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('Handicaps saved successfully');
            showSuccessMessage();
            
            setTimeout(function() {
                closeModalAndExit();
            }, 1500);
            
        } catch (error) {
            console.error('Error saving handicaps:', error);
            showErrorMessage();
        }
    }
    
    function showSuccessMessage() {
        var successDiv = document.createElement('div');
        successDiv.className = 'hcp-success-message';
        successDiv.innerHTML = '✓ Handicaps updated successfully!';
        successDiv.style.cssText = 'margin-top:16px; padding:10px; background:#1a3a1a; color:#4caf50; border-radius:30px; font-weight:600; text-align:center;';
        var modal = document.querySelector('#hcpAdjustModal > div');
        if (modal) modal.appendChild(successDiv);
        setTimeout(function() { if (successDiv && successDiv.remove) successDiv.remove(); }, 2000);
    }
    
    function showErrorMessage() {
        var errorDiv = document.createElement('div');
        errorDiv.className = 'hcp-error-message';
        errorDiv.innerHTML = '⚠️ Error saving handicaps. Please try again.';
        errorDiv.style.cssText = 'margin-top:16px; padding:10px; background:#3a1a1a; color:#ff6b6b; border-radius:30px; font-weight:600; text-align:center;';
        var modal = document.querySelector('#hcpAdjustModal > div');
        if (modal) modal.appendChild(errorDiv);
        setTimeout(function() { if (errorDiv && errorDiv.remove) errorDiv.remove(); }, 3000);
    }
    
    function closeModalAndExit() {
        var modal = document.getElementById('hcpAdjustModal');
        if (modal) modal.remove();
        window.location.href = 'index.html';
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
    // Load game data from Firestore
    // ============================================================
    
    async function loadGameData(gameId, callback) {
        var doc = await firebase.firestore().collection("scheduledGames").doc(gameId).get();
        if (!doc.exists) {
            console.error("Game not found");
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
    }
    
    // ============================================================
    // Main Entry Point
    // ============================================================
    
    async function init(gameId, winningPlayers, matchPoints, holeResults) {
        currentGameId = gameId;
        allPlayers = winningPlayers.teamA.concat(winningPlayers.teamB);
        matchPointsData = matchPoints;
        
        // Sort by current handicap
        allPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        // Load course data from Firestore
        loadGameData(gameId, function(gameData) {
            if (!gameData) {
                window.location.href = "index.html";
                return;
            }
            
            // Determine anchor
            determineAnchor(allPlayers, function(anchor) {
                if (!anchor) {
                    window.location.href = "index.html";
                    return;
                }
                anchorPlayer = anchor;
                
                // Calculate adjustments for each player
                var playersWithAdjustments = [];
                var rawNewList = [];
                
                for (var i = 0; i < allPlayers.length; i++) {
                    var player = allPlayers[i];
                    
                    // Anchor Adjustment (vs anchor player)
                    var anchorAdj = 0;
                    if (player.name !== anchor.name) {
                        anchorAdj = calculateAnchorAdjustment(player, anchor, flight1Data, flight2Data);
                    }
                    
                    // Performance Adjustment (from Game 1)
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
                
                // Check if any raw new is negative
                var lowestRaw = Math.min.apply(null, rawNewList);
                var needsZeroRise = (lowestRaw < 0);
                var zeroRiseAmount = needsZeroRise ? -lowestRaw : 0;
                var newAnchorName = null;
                
                if (needsZeroRise) {
                    // Apply zero-rise
                    for (var i = 0; i < playersWithAdjustments.length; i++) {
                        playersWithAdjustments[i].newAnchor = playersWithAdjustments[i].rawNew + zeroRiseAmount;
                    }
                    // Sort by new anchor handicap
                    playersWithAdjustments.sort(function(a, b) { return a.newAnchor - b.newAnchor; });
                    var newAnchorPlayer = playersWithAdjustments.find(function(p) { return p.newAnchor === 0; });
                    newAnchorName = newAnchorPlayer ? newAnchorPlayer.name : null;
                } else {
                    // No zero-rise needed
                    for (var i = 0; i < playersWithAdjustments.length; i++) {
                        playersWithAdjustments[i].newHcp = playersWithAdjustments[i].rawNew;
                    }
                    playersWithAdjustments.sort(function(a, b) { return a.newHcp - b.newHcp; });
                }
                
                // Display the table
                showAdjustmentTable(playersWithAdjustments, needsZeroRise, zeroRiseAmount, newAnchorName);
            });
        });
    }
    
    return {
        init: init
    };
})();

/*
FILE: js/hcp-adjust.js
VERSION: 2.01
KEY CHANGES:
   - Complete rewrite with full handicap adjustment logic
   - Anchor Adjustment (18-hole match vs anchor) - counts total holes won/lost
   - Performance Adjustment (based on Game 1 results - 4 matches per player)
   - Zero-rise adjustment if needed
   - Horizontal scroll for mobile compatibility
   - Green/Red colors for adjustments
   - Gold color for new anchor
   - Loads course data from Firestore for handicap calculations
STATUS: Ready for testing
*/