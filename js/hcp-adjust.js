/*
FILE: js/hcp-adjust.js
VERSION: 2.59
KEY CHANGES from v2.58:
   - FIXED: Zero-rise logic in calculateAllAdjustments()
   - CHANGED: needsZeroRise = (lowestRaw !== 0) instead of (lowestRaw < 0)
   - CHANGED: zeroRiseAmount = -lowestRaw (always, not conditional)
   - REASON: Zero-rise should happen when lowest is NOT zero (including positive values)
   - REASON: When lowest = 1, subtract 1 from all handicaps to make lowest = 0
   - REASON: When lowest = -2, add 2 to all handicaps to make lowest = 0
   - PRESERVED: ALL other functionality from v2.58 unchanged
   - PRESERVED: Raw column UI for when zero-rise is applied
DEPENDS ON: Firebase Firestore, js/history-record.js, js/game-match.js, js/waiting-screen.js, WRV.js
STATUS: Ready for integration
*/

var HandicapAdjustment = (function() {
    
    // ============================================================
    // v2.54: CONSTANT for multiple new anchor scenario
    // ============================================================
    var MULTIPLE_NEW_ANCHOR = "*multiple*";
    
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
    var isReadOnlyMode = false;
    var returnDestination = null;
    var returnToPreviousPage = false;
    var hasMultipleZeroHandicap = false;
    
    var anchorRawResults = {};
    var perfRawPoints = {};
    
    var isStandaloneMode = false;
    var standaloneContainerId = null;
    
    // ============================================================
    // Helper: Get Firestore instance
    // ============================================================
    function getDb() {
        return firebase.firestore();
    }
    
    // ============================================================
    // Helper: WRV write with Promise wrapper (callback compatible)
    // ============================================================
    function wrw(collection, docId, data, merge) {
        return new Promise(function(resolve, reject) {
            if (typeof WRV !== 'undefined' && WRV.write) {
                WRV.write(collection, docId, data, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            } else {
                // Fallback: direct write
                console.warn('[HCP-ADJUST] WRV not available, using direct write');
                var db = getDb();
                var ref = db.collection(collection).doc(docId);
                var promise = merge ? ref.set(data, { merge: true }) : ref.set(data);
                promise.then(resolve).catch(reject);
            }
        });
    }
    
    // ============================================================
    // Helper: WRV update with Promise wrapper (callback compatible)
    // ============================================================
    function wru(collection, docId, data) {
        return new Promise(function(resolve, reject) {
            if (typeof WRV !== 'undefined' && WRV.update) {
                WRV.update(collection, docId, data, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            } else {
                // Fallback: direct update
                console.warn('[HCP-ADJUST] WRV not available, using direct update');
                var db = getDb();
                db.collection(collection).doc(docId).update(data)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
    
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
        if (player.name === anchor.name) {
            anchorRawResults[player.name] = 0;
            return 0;
        }
        
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
        anchorRawResults[player.name] = netWon;
        
        var adjustment = Math.floor(Math.abs(netWon) / 2);
        return netWon >= 0 ? -adjustment : adjustment;
    }
    
    // ============================================================
    // Calculate Performance Adjustment
    // ============================================================
    
    function calculatePerformanceAdjustmentFromCache(cache, allPlayersList) {
        var matchPoints = {};
        for (var i = 0; i < allPlayersList.length; i++) {
            matchPoints[allPlayersList[i].name] = 0;
        }
        
        var results = cache.results;
        if (!results || !results.matchResults || !results.matchResults[17]) {
            console.warn("No matchResults data found at hole 18 in cache");
            return {};
        }
        
        var finalMatchResults = results.matchResults[17];
        var teamAPlayers = allPlayersList.filter(function(p) { return p.team === "A"; }).sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        var teamBPlayers = allPlayersList.filter(function(p) { return p.team === "B"; }).sort(function(a, b) {
            if (a.flight !== b.flight) return a.flight - b.flight;
            return a.handicap - b.handicap;
        });
        
        for (var a = 0; a < teamAPlayers.length; a++) {
            for (var b = 0; b < teamBPlayers.length; b++) {
                var playerA = teamAPlayers[a];
                var playerB = teamBPlayers[b];
                var matchIndex = a * teamBPlayers.length + b;
                var matchValue = finalMatchResults[matchIndex] || 0;
                
                if (matchValue > 0) {
                    matchPoints[playerA.name] += 1;
                } else if (matchValue < 0) {
                    matchPoints[playerB.name] += 1;
                } else {
                    matchPoints[playerA.name] += 0.5;
                    matchPoints[playerB.name] += 0.5;
                }
            }
        }
        
        for (var playerName in matchPoints) {
            perfRawPoints[playerName] = matchPoints[playerName];
        }
        
        var perfAdjustments = {};
        for (var playerName in matchPoints) {
            var points = matchPoints[playerName];
            
            if (points >= 3.5) {
                perfAdjustments[playerName] = -1;
            } else if (points <= 0.5) {
                perfAdjustments[playerName] = 1;
            } else {
                perfAdjustments[playerName] = 0;
            }
        }
        
        return perfAdjustments;
    }
    
    // ============================================================
    // Calculate all adjustments
    // v2.59: FIXED zero-rise logic - triggers when lowest !== 0
    // ============================================================
    
    function calculateAllAdjustments(anchor) {
        var cache = null;
        if (typeof GameLoader !== 'undefined') {
            cache = GameLoader.getLocalCache();
        }
        
        anchorRawResults = {};
        perfRawPoints = {};
        
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
                rawNew: rawNew,
                team: player.team,
                startingHcp: player.handicap,
                anchorRaw: anchorRawResults[player.name] || 0,
                perfRaw: perfRawPoints[player.name] || 0
            });
            rawNewList.push(rawNew);
        }
        
        // v2.59: FIXED - Zero-rise when lowest is NOT zero (including positive values)
        var lowestRaw = Math.min.apply(null, rawNewList);
        var needsZeroRise = (lowestRaw !== 0);
        var zeroRiseAmount = -lowestRaw;
        var newAnchorName = null;
        
        if (needsZeroRise) {
            for (var i = 0; i < playersWithAdjustments.length; i++) {
                playersWithAdjustments[i].newAnchor = playersWithAdjustments[i].rawNew + zeroRiseAmount;
            }
            playersWithAdjustments.sort(function(a, b) { return a.newAnchor - b.newAnchor; });
            
            // v2.54: Check for multiple players with 0
            var zeroPlayers = playersWithAdjustments.filter(function(p) { return p.newAnchor === 0; });
            if (zeroPlayers.length > 1) {
                // Multiple players have 0 - set to "*multiple*"
                newAnchorName = MULTIPLE_NEW_ANCHOR;
                console.log('[HCP-ADJUST] Multiple players with 0 newAnchor, setting newAnchorName to:', MULTIPLE_NEW_ANCHOR);
                console.log('[HCP-ADJUST] Zero players:', zeroPlayers.map(function(p) { return p.name; }).join(', '));
            } else if (zeroPlayers.length === 1) {
                newAnchorName = zeroPlayers[0].name;
            } else {
                newAnchorName = null;
            }
        } else {
            for (var i = 0; i < playersWithAdjustments.length; i++) {
                playersWithAdjustments[i].newHcp = playersWithAdjustments[i].rawNew;
            }
            playersWithAdjustments.sort(function(a, b) { return a.newHcp - b.newHcp; });
            
            // v2.54: Check for multiple players with 0 when no zero-rise needed
            var zeroPlayers = playersWithAdjustments.filter(function(p) { return p.newHcp === 0; });
            if (zeroPlayers.length > 1) {
                newAnchorName = MULTIPLE_NEW_ANCHOR;
                console.log('[HCP-ADJUST] Multiple players with 0 newHcp, setting newAnchorName to:', MULTIPLE_NEW_ANCHOR);
                console.log('[HCP-ADJUST] Zero players:', zeroPlayers.map(function(p) { return p.name; }).join(', '));
            } else if (zeroPlayers.length === 1) {
                newAnchorName = zeroPlayers[0].name;
            } else {
                newAnchorName = null;
            }
        }
        
        return {
            players: playersWithAdjustments,
            needsZeroRise: needsZeroRise,
            zeroRiseAmount: zeroRiseAmount,
            newAnchorName: newAnchorName
        };
    }
    
    // ============================================================
    // v2.53: calculateAllAdjustmentsFromRaw - For VALIDATE tab
    // Sets internal state from parameters, then calls calculateAllAdjustments
    // ============================================================
    
    function calculateAllAdjustmentsFromRaw(anchor, players, flight1DataStr, flight2DataStr, courseSiParam, courseParParam) {
        console.log('[HCP-ADJUST] calculateAllAdjustmentsFromRaw called');
        console.log('[HCP-ADJUST]   anchor:', anchor ? anchor.name : 'null');
        console.log('[HCP-ADJUST]   players:', players ? players.length : 0);
        console.log('[HCP-ADJUST]   flight1DataStr length:', flight1DataStr ? flight1DataStr.length : 0);
        console.log('[HCP-ADJUST]   flight2DataStr length:', flight2DataStr ? flight2DataStr.length : 0);
        
        // Set internal state
        allPlayers = players || [];
        flight1Data = flight1DataStr || "";
        flight2Data = flight2DataStr || "";
        courseSi = courseSiParam || [];
        coursePar = courseParParam || [];
        
        // Call existing calculation
        var result = calculateAllAdjustments(anchor);
        
        console.log('[HCP-ADJUST] calculateAllAdjustmentsFromRaw complete, players:', result.players ? result.players.length : 0);
        return result;
    }
    
    // ============================================================
    // v2.58: renderTableToContainer - NEW TABLE with Raw column when zero-rise needed
    // ============================================================
    
    function renderTableToContainer(calculationResult, anchorName, containerId) {
        var container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            var buttonsContainer = document.getElementById('hcpButtons');
            var mainContainer = document.getElementById('mainContainer');
            if (buttonsContainer) {
                mainContainer.insertBefore(container, buttonsContainer);
            } else {
                mainContainer.appendChild(container);
            }
            console.log('[HCP-ADJUST] Container created:', containerId);
        }
        
        var players = calculationResult.players;
        var hasNewAnchor = calculationResult.needsZeroRise && calculationResult.zeroRiseAmount > 0;
        var needsZeroRise = calculationResult.needsZeroRise && calculationResult.zeroRiseAmount !== 0;
        
        players.sort(function(a, b) {
            var teamA = a.team || 'B';
            var teamB = b.team || 'B';
            if (teamA !== teamB) {
                return teamA === 'A' ? -1 : 1;
            }
            var hcpA = a.startingHcp !== undefined ? a.startingHcp : a.currentHcp;
            var hcpB = b.startingHcp !== undefined ? b.startingHcp : b.currentHcp;
            return hcpA - hcpB;
        });
        
        var html = '';
        
        // ============================================================
        // NEW TABLE: Zero-rise needed → 6 columns (Label, Old, Anc, Perf, Raw, New)
        // ============================================================
        if (needsZeroRise) {
            html += '<div style="overflow-x: auto; margin: 12px 0; -webkit-overflow-scrolling: touch;">';
            html += '<table style="width:100%; border-collapse: collapse; font-size:0.8rem; min-width: 400px;">';
            
            html += '<thead><tr style="background:#1a3a1a;">';
            html += '<th style="padding:8px 4px; text-align:left; width:45px; font-size:0.75rem;"></th>';
            html += '<th style="padding:8px 4px; text-align:center; width:38px; font-size:0.75rem;">Old</th>';
            html += '<th style="padding:8px 4px; text-align:center; width:55px; font-size:0.75rem;">Anc</th>';
            html += '<th style="padding:8px 4px; text-align:center; width:55px; font-size:0.75rem;">Perf</th>';
            html += '<th style="padding:8px 4px; text-align:center; width:38px; font-size:0.75rem; background:#2a2a2a; color:#ffaa44;">Raw</th>';
            html += '<th style="padding:8px 4px; text-align:center; width:38px; font-size:0.75rem;">New</th>';
            html += '<tr></thead><tbody>';
            
            var currentTeam = null;
            
            for (var i = 0; i < players.length; i++) {
                var p = players[i];
                
                var displayHcp = null;
                if (p.finalHcp !== undefined && p.finalHcp !== null) {
                    displayHcp = p.finalHcp;
                } else if (p.newHcp !== undefined && p.newHcp !== null) {
                    displayHcp = p.newHcp;
                } else if (p.newAnchor !== undefined && p.newAnchor !== null) {
                    displayHcp = p.newAnchor;
                } else if (p.rawNew !== undefined && p.rawNew !== null) {
                    if (hasNewAnchor && calculationResult.zeroRiseAmount) {
                        displayHcp = p.rawNew + calculationResult.zeroRiseAmount;
                    } else {
                        displayHcp = p.rawNew;
                    }
                }
                
                if (displayHcp === null || displayHcp === undefined) {
                    displayHcp = p.currentHcp;
                }
                
                var startingHcp = p.currentHcp;
                if (startingHcp === undefined || startingHcp === null) {
                    startingHcp = p.startingHcp;
                }
                var stDisplayValue = (startingHcp !== undefined && startingHcp !== null) ? startingHcp : "?";
                
                var playerTeam = p.team || 'B';
                var isAnchor = (p.name === anchorName);
                var isFinalZero = (displayHcp === 0);
                
                if (playerTeam !== currentTeam) {
                    currentTeam = playerTeam;
                    var teamLabel = currentTeam === 'A' ? 'TEAM A' : 'TEAM B';
                    html += '<tr style="background:#1a3a1a; border-top: 2px solid #000;">';
                    html += '<td colspan="6" style="padding:6px 4px; text-align:center; color:#4caf50; font-weight:700; font-size:0.75rem;">' + teamLabel + '</td>';
                    html += '<tr>';
                }
                
                var ancAdj = p.anchorAdj;
                var ancRaw = p.anchorRaw;
                var ancRawAbs = Math.abs(ancRaw);
                var ancRawDisplay = ancRawAbs;
                
                var ancRawColor = '#888';
                if (ancRaw > 0) {
                    ancRawColor = '#4caf50';
                } else if (ancRaw < 0) {
                    ancRawColor = '#ff6b6b';
                }
                
                var ancDisplayValue = '';
                var ancAdjColor = '#888';
                if (ancAdj < 0) {
                    ancDisplayValue = Math.abs(ancAdj).toString();
                    ancAdjColor = '#ff6b6b';
                } else if (ancAdj > 0) {
                    ancDisplayValue = ancAdj.toString();
                    ancAdjColor = '#4caf50';
                } else {
                    ancDisplayValue = '0';
                    ancAdjColor = '#888';
                }
                
                var ancDisplay = ancDisplayValue + '<span style="font-size:0.6rem; color:' + ancRawColor + ';"> [' + ancRawDisplay + ']</span>';
                
                var perfAdj = p.perfAdj;
                var perfRaw = p.perfRaw;
                var perfRawDisplay = perfRaw % 1 === 0 ? perfRaw.toString() : perfRaw.toFixed(1);
                
                var perfDisplayValue = '';
                var perfAdjColor = '#888';
                if (perfAdj < 0) {
                    perfDisplayValue = Math.abs(perfAdj).toString();
                    perfAdjColor = '#ff6b6b';
                } else if (perfAdj > 0) {
                    perfDisplayValue = perfAdj.toString();
                    perfAdjColor = '#4caf50';
                } else {
                    perfDisplayValue = '0';
                    perfAdjColor = '#888';
                }
                
                var perfDisplay = perfDisplayValue + '<span style="font-size:0.6rem; color:#4caf50;"> [' + perfRawDisplay + ']</span>';
                
                var rawValue = p.rawNew !== undefined && p.rawNew !== null ? p.rawNew : '?';
                
                var finalColor = isFinalZero ? '#ffaa44' : '#4caf50';
                var stColor = isAnchor ? '#ffaa44' : '#ffffff';
                
                html += '<tr style="border-bottom:1px solid #333;">';
                html += '<td style="padding:6px 4px; text-align:left;">' + escapeHtml(p.label || p.name.substring(0, 3).toUpperCase()) + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + stColor + '; font-weight:600;">' + stDisplayValue + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + ancAdjColor + '; font-weight:600;">' + ancDisplay + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + perfAdjColor + '; font-weight:600;">' + perfDisplay + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: #ffaa44; font-weight:600;">' + rawValue + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + finalColor + '; font-weight:700;">' + displayHcp + '</td>';
                html += '</tr>';
            }
            
            html += '</tbody></table></div>';
            
        // ============================================================
        // OLD TABLE: No zero-rise → 5 columns (Label, Old, Anc, Perf, New)
        // ============================================================
        } else {
            html += '<div style="overflow-x: auto; margin: 12px 0; -webkit-overflow-scrolling: touch;">';
            html += '<table style="width:100%; border-collapse: collapse; font-size:0.8rem; min-width: 340px;">';
            
            html += '<thead><tr style="background:#1a3a1a;">';
            html += '<th style="padding:8px 4px; text-align:left; width:45px; font-size:0.75rem;"></th>';
            html += '<th style="padding:8px 4px; text-align:center; width:38px; font-size:0.75rem;">Old</th>';
            html += '<th style="padding:8px 4px; text-align:center; width:55px; font-size:0.75rem;">Anc</th>';
            html += '<th style="padding:8px 4px; text-align:center; width:55px; font-size:0.75rem;">Perf</th>';
            html += '<th style="padding:8px 4px; text-align:center; width:38px; font-size:0.75rem;">New</th>';
            html += '<tr></thead><tbody>';
            
            var currentTeam = null;
            
            for (var i = 0; i < players.length; i++) {
                var p = players[i];
                
                var displayHcp = null;
                if (p.finalHcp !== undefined && p.finalHcp !== null) {
                    displayHcp = p.finalHcp;
                } else if (p.newHcp !== undefined && p.newHcp !== null) {
                    displayHcp = p.newHcp;
                } else if (p.newAnchor !== undefined && p.newAnchor !== null) {
                    displayHcp = p.newAnchor;
                } else if (p.rawNew !== undefined && p.rawNew !== null) {
                    if (hasNewAnchor && calculationResult.zeroRiseAmount) {
                        displayHcp = p.rawNew + calculationResult.zeroRiseAmount;
                    } else {
                        displayHcp = p.rawNew;
                    }
                }
                
                if (displayHcp === null || displayHcp === undefined) {
                    displayHcp = p.currentHcp;
                }
                
                var startingHcp = p.currentHcp;
                if (startingHcp === undefined || startingHcp === null) {
                    startingHcp = p.startingHcp;
                }
                var stDisplayValue = (startingHcp !== undefined && startingHcp !== null) ? startingHcp : "?";
                
                var playerTeam = p.team || 'B';
                var isAnchor = (p.name === anchorName);
                var isFinalZero = (displayHcp === 0);
                
                if (playerTeam !== currentTeam) {
                    currentTeam = playerTeam;
                    var teamLabel = currentTeam === 'A' ? 'TEAM A' : 'TEAM B';
                    html += '<tr style="background:#1a3a1a; border-top: 2px solid #000;">';
                    html += '<td colspan="5" style="padding:6px 4px; text-align:center; color:#4caf50; font-weight:700; font-size:0.75rem;">' + teamLabel + '</td>';
                    html += '<tr>';
                }
                
                var ancAdj = p.anchorAdj;
                var ancRaw = p.anchorRaw;
                var ancRawAbs = Math.abs(ancRaw);
                var ancRawDisplay = ancRawAbs;
                
                var ancRawColor = '#888';
                if (ancRaw > 0) {
                    ancRawColor = '#4caf50';
                } else if (ancRaw < 0) {
                    ancRawColor = '#ff6b6b';
                }
                
                var ancDisplayValue = '';
                var ancAdjColor = '#888';
                if (ancAdj < 0) {
                    ancDisplayValue = Math.abs(ancAdj).toString();
                    ancAdjColor = '#ff6b6b';
                } else if (ancAdj > 0) {
                    ancDisplayValue = ancAdj.toString();
                    ancAdjColor = '#4caf50';
                } else {
                    ancDisplayValue = '0';
                    ancAdjColor = '#888';
                }
                
                var ancDisplay = ancDisplayValue + '<span style="font-size:0.6rem; color:' + ancRawColor + ';"> [' + ancRawDisplay + ']</span>';
                
                var perfAdj = p.perfAdj;
                var perfRaw = p.perfRaw;
                var perfRawDisplay = perfRaw % 1 === 0 ? perfRaw.toString() : perfRaw.toFixed(1);
                
                var perfDisplayValue = '';
                var perfAdjColor = '#888';
                if (perfAdj < 0) {
                    perfDisplayValue = Math.abs(perfAdj).toString();
                    perfAdjColor = '#ff6b6b';
                } else if (perfAdj > 0) {
                    perfDisplayValue = perfAdj.toString();
                    perfAdjColor = '#4caf50';
                } else {
                    perfDisplayValue = '0';
                    perfAdjColor = '#888';
                }
                
                var perfDisplay = perfDisplayValue + '<span style="font-size:0.6rem; color:#4caf50;"> [' + perfRawDisplay + ']</span>';
                
                var finalColor = isFinalZero ? '#ffaa44' : '#4caf50';
                var stColor = isAnchor ? '#ffaa44' : '#ffffff';
                
                html += '<tr style="border-bottom:1px solid #333;">';
                html += '<td style="padding:6px 4px; text-align:left;">' + escapeHtml(p.label || p.name.substring(0, 3).toUpperCase()) + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + stColor + '; font-weight:600;">' + stDisplayValue + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + ancAdjColor + '; font-weight:600;">' + ancDisplay + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + perfAdjColor + '; font-weight:600;">' + perfDisplay + '</td>';
                html += '<td style="padding:6px 4px; text-align:center; color: ' + finalColor + '; font-weight:700;">' + displayHcp + '</td>';
                html += '</tr>';
            }
            
            html += '</tbody></table></div>';
        }
        
        container.innerHTML = html;
        container.style.display = 'block';
        container.style.opacity = '1';
        
        console.log('[HCP-ADJUST] Table rendered to container:', containerId);
        if (needsZeroRise) {
            console.log('[HCP-ADJUST] Zero-rise applied - Raw column shown');
        } else {
            console.log('[HCP-ADJUST] No zero-rise - standard 5-column table');
        }
    }
    
    // ============================================================
    // showAdjustmentTable - modal mode (backward compatible)
    // ============================================================
    
    function showAdjustmentTable(calculationResult, anchorName, isReadOnly) {
        if (isStandaloneMode && standaloneContainerId) {
            renderTableToContainer(calculationResult, anchorName, standaloneContainerId);
            return;
        }
        
        var players = calculationResult.players;
        var hasNewAnchor = calculationResult.needsZeroRise && calculationResult.zeroRiseAmount > 0;
        var needsZeroRise = calculationResult.needsZeroRise && calculationResult.zeroRiseAmount !== 0;
        
        players.sort(function(a, b) {
            var teamA = a.team || 'B';
            var teamB = b.team || 'B';
            if (teamA !== teamB) {
                return teamA === 'A' ? -1 : 1;
            }
            var hcpA = a.startingHcp !== undefined ? a.startingHcp : a.currentHcp;
            var hcpB = b.startingHcp !== undefined ? b.startingHcp : b.currentHcp;
            return hcpA - hcpB;
        });
        
        var tableHtml = '<div style="overflow-x: auto; margin: 12px 0; -webkit-overflow-scrolling: touch;">';
        tableHtml += '<table style="width:100%; border-collapse: collapse; font-size:0.8rem; min-width: 340px;">';
        
        tableHtml += '<thead><tr style="background:#1a3a1a;">';
        tableHtml += '<th style="padding:8px 4px; text-align:left; width:45px; font-size:0.75rem;"></th>';
        tableHtml += '<th style="padding:8px 4px; text-align:center; width:38px; font-size:0.75rem;">Old</th>';
        tableHtml += '<th style="padding:8px 4px; text-align:center; width:55px; font-size:0.75rem;">Anc</th>';
        tableHtml += '<th style="padding:8px 4px; text-align:center; width:55px; font-size:0.75rem;">Perf</th>';
        tableHtml += '<th style="padding:8px 4px; text-align:center; width:38px; font-size:0.75rem;">New</th>';
        tableHtml += '<tr></thead><tbody>';
        
        var currentTeam = null;
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            
            var displayHcp = null;
            if (p.finalHcp !== undefined && p.finalHcp !== null) {
                displayHcp = p.finalHcp;
            } else if (p.newHcp !== undefined && p.newHcp !== null) {
                displayHcp = p.newHcp;
            } else if (p.newAnchor !== undefined && p.newAnchor !== null) {
                displayHcp = p.newAnchor;
            } else if (p.rawNew !== undefined && p.rawNew !== null) {
                if (hasNewAnchor && calculationResult.zeroRiseAmount) {
                    displayHcp = p.rawNew + calculationResult.zeroRiseAmount;
                } else {
                    displayHcp = p.rawNew;
                }
            }
            
            if (displayHcp === null || displayHcp === undefined) {
                displayHcp = p.currentHcp;
            }
            
            var startingHcp = p.currentHcp;
            if (startingHcp === undefined || startingHcp === null) {
                startingHcp = p.startingHcp;
            }
            var stDisplayValue = (startingHcp !== undefined && startingHcp !== null) ? startingHcp : "?";
            
            var playerTeam = p.team || 'B';
            var isAnchor = (p.name === anchorName);
            var isFinalZero = (displayHcp === 0);
            
            if (playerTeam !== currentTeam) {
                currentTeam = playerTeam;
                var teamLabel = currentTeam === 'A' ? 'TEAM A' : 'TEAM B';
                tableHtml += '<tr style="background:#1a3a1a; border-top: 2px solid #000;">';
                tableHtml += '<td colspan="5" style="padding:6px 4px; text-align:center; color:#4caf50; font-weight:700; font-size:0.75rem;">' + teamLabel + '</td>';
                tableHtml += '<tr>';
            }
            
            var ancAdj = p.anchorAdj;
            var ancRaw = p.anchorRaw;
            var ancRawAbs = Math.abs(ancRaw);
            
            var ancRawDisplay = ancRawAbs;
            
            var ancRawColor = '#888';
            if (ancRaw > 0) {
                ancRawColor = '#4caf50';
            } else if (ancRaw < 0) {
                ancRawColor = '#ff6b6b';
            }
            
            var ancDisplayValue = '';
            var ancAdjColor = '#888';
            if (ancAdj < 0) {
                ancDisplayValue = Math.abs(ancAdj).toString();
                ancAdjColor = '#ff6b6b';
            } else if (ancAdj > 0) {
                ancDisplayValue = ancAdj.toString();
                ancAdjColor = '#4caf50';
            } else {
                ancDisplayValue = '0';
                ancAdjColor = '#888';
            }
            
            var ancDisplay = ancDisplayValue + '<span style="font-size:0.6rem; color:' + ancRawColor + ';"> [' + ancRawDisplay + ']</span>';
            
            var perfAdj = p.perfAdj;
            var perfRaw = p.perfRaw;
            
            var perfRawDisplay = perfRaw % 1 === 0 ? perfRaw.toString() : perfRaw.toFixed(1);
            
            var perfDisplayValue = '';
            var perfAdjColor = '#888';
            if (perfAdj < 0) {
                perfDisplayValue = Math.abs(perfAdj).toString();
                perfAdjColor = '#ff6b6b';
            } else if (perfAdj > 0) {
                perfDisplayValue = perfAdj.toString();
                perfAdjColor = '#4caf50';
            } else {
                perfDisplayValue = '0';
                perfAdjColor = '#888';
            }
            
            var perfDisplay = perfDisplayValue + '<span style="font-size:0.6rem; color:#4caf50;"> [' + perfRawDisplay + ']</span>';
            
            var finalColor = isFinalZero ? '#ffaa44' : '#4caf50';
            var stColor = isAnchor ? '#ffaa44' : '#ffffff';
            
            tableHtml += '<tr style="border-bottom:1px solid #333;">';
            tableHtml += '<td style="padding:6px 4px; text-align:left;">' + escapeHtml(p.label || p.name.substring(0, 3).toUpperCase()) + '</td>';
            tableHtml += '<td style="padding:6px 4px; text-align:center; color: ' + stColor + '; font-weight:600;">' + stDisplayValue + '</td>';
            tableHtml += '<td style="padding:6px 4px; text-align:center; color: ' + ancAdjColor + '; font-weight:600;">' + ancDisplay + '</td>';
            tableHtml += '<td style="padding:6px 4px; text-align:center; color: ' + perfAdjColor + '; font-weight:600;">' + perfDisplay + '</td>';
            tableHtml += '<td style="padding:6px 4px; text-align:center; color: ' + finalColor + '; font-weight:700;">' + displayHcp + '</td>';
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table></div>';
        
        var buttonsHtml = '';
        if (isReadOnly) {
            if (returnToPreviousPage) {
                buttonsHtml = '<div style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; justify-content:center;"><button id="hcpBackBtn" style="background:#1a1a1a; border:1px solid #333; color:#ccc; padding:8px 16px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">← Close</button></div>';
            } else {
                buttonsHtml = '<div style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; justify-content:center;"><button id="hcpBackBtn" style="background:#1a1a1a; border:1px solid #333; color:#ccc; padding:8px 16px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">← Back</button></div>';
            }
        } else {
            buttonsHtml = '<div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; justify-content:center;">' +
                '<button id="backToScorecardBtn" style="flex:1; min-width:80px; background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:8px 10px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">📋 Scorecard</button>' +
                '<button id="celebrationBtn" style="flex:0 0 auto; padding:8px 20px; background:#1a3a1a; border:1px solid #ffaa44; color:#ffaa44; border-radius:30px; font-size:1.2rem; font-weight:600; cursor:pointer;">🎉</button>' +
                '<button id="mainMenuBtn" style="flex:1; min-width:80px; background:#1a1a1a; border:1px solid #333; color:#888; padding:8px 10px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">🏠 Main Menu</button>' +
                '</div>';
        }
        
        var modalHtml = '<div class="modal-overlay" id="hcpAdjustModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:10000;">' +
            '<div style="background:#1a1a1a; border-radius:24px; padding:12px; max-width:95%; width:auto; border:2px solid #4caf50;">' +
            '<div style="font-size:1.2rem; font-weight:800; color:#4caf50; text-align:center; margin-bottom:12px;">🏌️ HANDICAP ADJUSTMENT</div>' +
            tableHtml +
            buttonsHtml +
            '</div></div>';
        
        var existingModal = document.getElementById('hcpAdjustModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        if (isReadOnly) {
            var backBtn = document.getElementById('hcpBackBtn');
            if (backBtn) {
                backBtn.addEventListener('click', function() {
                    document.getElementById('hcpAdjustModal').remove();
                    if (returnToPreviousPage) {
                        console.log('[HandicapAdjustment] Closing modal, staying on current page');
                    } else if (returnDestination) {
                        window.location.href = returnDestination;
                    } else {
                        window.history.back();
                    }
                });
            }
        } else {
            var backToScorecardBtn = document.getElementById('backToScorecardBtn');
            if (backToScorecardBtn) {
                backToScorecardBtn.addEventListener('click', function() {
                    if (typeof WaitingScreen !== 'undefined' && WaitingScreen.show) {
                        WaitingScreen.show("Loading Scorecard...");
                    } else {
                        var overlay = document.createElement('div');
                        overlay.id = 'waitingScreenOverlay';
                        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
                        overlay.innerHTML = '<div style="font-size:5rem;filter:grayscale(100%);opacity:0.6;">⛳</div><div style="color:#888;font-size:0.8rem;margin-top:16px;letter-spacing:1px;">Loading Scorecard...</div>';
                        document.body.appendChild(overlay);
                    }
                    
                    document.getElementById('hcpAdjustModal').remove();
                    window.location.href = 'view-game.html?gameId=' + currentGameId;
                });
            }
            
            var celebrationBtn = document.getElementById('celebrationBtn');
            if (celebrationBtn) {
                celebrationBtn.addEventListener('click', function() {
                    if (typeof WaitingScreen !== 'undefined' && WaitingScreen.show) {
                        WaitingScreen.show("Loading Celebration...");
                    } else {
                        var overlay = document.createElement('div');
                        overlay.id = 'waitingScreenOverlay';
                        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
                        overlay.innerHTML = '<div style="font-size:5rem;filter:grayscale(100%);opacity:0.6;">⛳</div><div style="color:#888;font-size:0.8rem;margin-top:16px;letter-spacing:1px;">Loading Celebration...</div>';
                        document.body.appendChild(overlay);
                    }
                    
                    document.getElementById('hcpAdjustModal').remove();
                    if (typeof SignCard !== 'undefined' && SignCard.replayCelebration) {
                        SignCard.replayCelebration();
                    } else {
                        alert('Celebration screen not available');
                        if (typeof WaitingScreen !== 'undefined' && WaitingScreen.hide) {
                            WaitingScreen.hide();
                        } else {
                            var el = document.getElementById('waitingScreenOverlay');
                            if (el) el.remove();
                        }
                    }
                });
            }
            
            var mainMenuBtn = document.getElementById('mainMenuBtn');
            if (mainMenuBtn) {
                mainMenuBtn.addEventListener('click', function() {
                    window.location.href = 'index.html';
                });
            }
        }
    }
    
    // ============================================================
    // Show Change Anchor Modal
    // ============================================================
    
    function showChangeAnchorModal() {
        var zeroHcpPlayers = allPlayers.filter(function(p) { return p.handicap === 0; });
        if (zeroHcpPlayers.length <= 1) return;
        
        var optionsHtml = '';
        for (var i = 0; i < zeroHcpPlayers.length; i++) {
            var selected = (anchorPlayer && anchorPlayer.name === zeroHcpPlayers[i].name) ? 'selected' : '';
            optionsHtml += '<option value="' + zeroHcpPlayers[i].name + '" ' + selected + '>' + zeroHcpPlayers[i].name + ' (HCP ' + zeroHcpPlayers[i].handicap + ')</option>';
        }
        
        var modalHtml = '<div class="modal-overlay" id="changeAnchorModal" style="z-index: 10001;">' +
            '<div style="background:#1a1a1a; border-radius:28px; padding:28px; max-width:360px; width:90%; text-align:center; border:2px solid #ffaa44;">' +
            '<div style="font-size:1.3rem; font-weight:800; color:#ffaa44; margin-bottom:16px;">🔄 CHANGE ANCHOR</div>' +
            '<div style="font-size:0.9rem; color:#ccc; margin-bottom:20px;">Select a new anchor for today\'s game.</div>' +
            '<select id="changeAnchorSelect" style="width:100%; background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:12px; border-radius:30px; font-size:1rem; margin-bottom:20px;">' +
            optionsHtml +
            '</select>' +
            '<div style="display:flex; gap:12px;">' +
            '<button id="changeAnchorCancelBtn" style="flex:1; background:#1a1a1a; border:1px solid #333; color:#ccc; padding:12px; border-radius:40px; font-weight:600; cursor:pointer;">Cancel</button>' +
            '<button id="changeAnchorConfirmBtn" style="flex:1; background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:12px; border-radius:40px; font-weight:700; cursor:pointer;">✓ Confirm</button>' +
            '</div></div></div>';
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById('changeAnchorCancelBtn').addEventListener('click', function() {
            document.getElementById('changeAnchorModal').remove();
            if (currentTableData) {
                showAdjustmentTable(currentTableData, anchorPlayer.name, false);
            }
        });
        
        document.getElementById('changeAnchorConfirmBtn').addEventListener('click', function() {
            var selectedName = document.getElementById('changeAnchorSelect').value;
            var selectedAnchor = allPlayers.find(function(p) { return p.name === selectedName; });
            document.getElementById('changeAnchorModal').remove();
            
            if (selectedAnchor && selectedAnchor.name !== anchorPlayer.name) {
                updateAnchorAndRecalculate(selectedAnchor);
            } else if (currentTableData) {
                showAdjustmentTable(currentTableData, anchorPlayer.name, false);
            }
        });
    }
    
    // ============================================================
    // v2.57: BACKGROUND UPDATE - playerInformation + usedLabels (CORRECTED)
    // ============================================================
    function updatePlayerRecordsInBackground(adjustedPlayersData, allGamePlayers) {
        console.log('[HCP-ADJUST] Background update starting...');
        
        var db = getDb();
        
        db.collection('playerInformation').doc('defaultPlayers').get()
            .then(function(doc) {
                var currentPlayers = [];
                var existingUsedLabels = {};
                
                if (doc.exists && doc.data().players) {
                    currentPlayers = doc.data().players;
                    existingUsedLabels = doc.data().usedLabels || {};
                }
                
                console.log('[HCP-ADJUST] Background: Current usedLabels has', Object.keys(existingUsedLabels).length, 'labels');
                
                var updatedCount = 0;
                for (var i = 0; i < currentPlayers.length; i++) {
                    for (var j = 0; j < adjustedPlayersData.length; j++) {
                        if (currentPlayers[i].name === adjustedPlayersData[j].name) {
                            var newHcp = adjustedPlayersData[j].newHcp;
                            if (newHcp !== undefined && newHcp !== null) {
                                currentPlayers[i].handicap = newHcp;
                                updatedCount++;
                                console.log('[HCP-ADJUST] Background: Updated ' + adjustedPlayersData[j].name + ' → ' + newHcp);
                            }
                            break;
                        }
                    }
                }
                
                for (var j = 0; j < adjustedPlayersData.length; j++) {
                    var found = false;
                    for (var i = 0; i < currentPlayers.length; i++) {
                        if (currentPlayers[i].name === adjustedPlayersData[j].name) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        var newHcp = adjustedPlayersData[j].newHcp;
                        if (newHcp === undefined || newHcp === null) {
                            newHcp = adjustedPlayersData[j].currentHcp || 0;
                        }
                        currentPlayers.push({
                            name: adjustedPlayersData[j].name,
                            label: adjustedPlayersData[j].label || adjustedPlayersData[j].name.substring(0, 3).toUpperCase(),
                            handicap: newHcp,
                            isDefault: false
                        });
                        console.log('[HCP-ADJUST] Background: Added new player ' + adjustedPlayersData[j].name + ' → ' + newHcp);
                    }
                }
                
                var mergedUsedLabels = {};
                
                for (var key in existingUsedLabels) {
                    mergedUsedLabels[key] = existingUsedLabels[key];
                }
                
                var newLabelCount = 0;
                if (allGamePlayers && allGamePlayers.length > 0) {
                    for (var i = 0; i < allGamePlayers.length; i++) {
                        var label = allGamePlayers[i].label;
                        if (label && label !== '') {
                            if (!mergedUsedLabels[label]) {
                                mergedUsedLabels[label] = true;
                                newLabelCount++;
                                console.log('[HCP-ADJUST] Background: Adding new label to usedLabels:', label);
                            }
                        }
                    }
                }
                
                console.log('[HCP-ADJUST] Background: usedLabels merged - added', newLabelCount, 'new labels, total:', Object.keys(mergedUsedLabels).length);
                
                var payload = {
                    players: currentPlayers,
                    usedLabels: mergedUsedLabels,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                console.log('[HCP-ADJUST] Background: Writing playerInformation with updated handicaps and merged usedLabels');
                
                return wrw('playerInformation', 'defaultPlayers', payload, true);
            })
            .then(function() {
                console.log('[HCP-ADJUST] Background: playerInformation updated successfully (players + merged usedLabels)');
            })
            .catch(function(err) {
                console.error('[HCP-ADJUST] Background: Error updating player records:', err);
            });
    }
    
    // ============================================================
    // Update anchor and recalculate - v2.55: DISPLAY FIRST, background update
    // ============================================================
    
    function updateAnchorAndRecalculate(newAnchor) {
        if (typeof WaitingScreen !== 'undefined' && WaitingScreen.show) {
            WaitingScreen.show("Recalculating handicaps...");
        } else {
            var loadingModal = document.createElement('div');
            loadingModal.className = 'modal-overlay';
            loadingModal.id = 'loadingModal';
            loadingModal.innerHTML = '<div style="background:#1a1a1a; border-radius:24px; padding:28px; text-align:center;"><div class="spin"></div><div style="margin-top:16px; color:#4caf50;">Recalculating handicaps...</div></div>';
            document.body.appendChild(loadingModal);
        }
        
        var updatePromise = wru('scheduledGames', currentGameId, {
            anchor: newAnchor.name,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        updatePromise.then(function() {
            console.log('Anchor updated in scheduledGames:', newAnchor.name);
            anchorPlayer = newAnchor;
            
            var calculationResult = calculateAllAdjustments(newAnchor);
            currentTableData = calculationResult;
            
            return new Promise(function(resolve, reject) {
                saveAdjustmentToFirestore(newAnchor, calculationResult, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(calculationResult);
                    }
                });
            });
        })
        .then(function(calculationResult) {
            if (typeof WaitingScreen !== 'undefined' && WaitingScreen.hide) {
                WaitingScreen.hide();
            } else {
                var el = document.getElementById('waitingScreenOverlay');
                if (el) el.remove();
                var loadingModal = document.getElementById('loadingModal');
                if (loadingModal) loadingModal.remove();
            }
            
            showAdjustmentTable(calculationResult, newAnchor.name, false);
            
            updatePlayerRecordsInBackground(calculationResult.players, allPlayers);
        })
        .catch(function(err) {
            if (typeof WaitingScreen !== 'undefined' && WaitingScreen.hide) {
                WaitingScreen.hide();
            } else {
                var el = document.getElementById('waitingScreenOverlay');
                if (el) el.remove();
                var loadingModal = document.getElementById('loadingModal');
                if (loadingModal) loadingModal.remove();
            }
            
            console.error('Error updating anchor:', err);
            alert('Failed to update anchor. Please try again.');
            if (currentTableData) {
                showAdjustmentTable(currentTableData, anchorPlayer.name, false);
            }
        });
    }
    
    // ============================================================
    // v2.54: Display stored adjustment from history record
    // ============================================================
    
    function displayStoredAdjustment(adjustedHandicaps, anchorName, allPlayersList, returnToPrevious) {
        if (!adjustedHandicaps || !adjustedHandicaps.players) {
            console.error("No stored adjustment data available");
            return false;
        }
        
        returnToPreviousPage = (returnToPrevious === true);
        
        var playerMap = {};
        if (allPlayersList) {
            for (var i = 0; i < allPlayersList.length; i++) {
                playerMap[allPlayersList[i].name] = {
                    team: allPlayersList[i].team,
                    startingHcp: allPlayersList[i].handicap
                };
            }
        }
        
        var players = adjustedHandicaps.players.map(function(p) {
            var teamInfo = playerMap[p.name] || { team: 'B', startingHcp: p.startingHcp };
            return {
                name: p.name,
                label: p.label || p.name.substring(0, 3).toUpperCase(),
                currentHcp: p.startingHcp,
                startingHcp: p.startingHcp,
                anchorAdj: p.anchorAdj || 0,
                perfAdj: p.perfAdj || 0,
                finalHcp: p.finalHcp,
                team: teamInfo.team,
                rawNew: null,
                newHcp: null,
                newAnchor: null,
                anchorRaw: p.anchorRaw !== undefined ? p.anchorRaw : 0,
                perfRaw: p.perfRaw !== undefined ? p.perfRaw : 0
            };
        });
        
        var newAnchorValue = adjustedHandicaps.newAnchor || null;
        
        var calculationResult = {
            players: players,
            needsZeroRise: adjustedHandicaps.needsZeroRise || false,
            zeroRiseAmount: adjustedHandicaps.zeroRiseAmount || 0,
            newAnchorName: newAnchorValue
        };
        
        showAdjustmentTable(calculationResult, anchorName, true);
        return true;
    }
    
    // ============================================================
    // initForHistory
    // ============================================================
    
    function initForHistory(gameId, archiveId, returnUrl) {
        currentGameId = gameId;
        currentArchiveId = archiveId;
        isReadOnlyMode = true;
        returnDestination = returnUrl || "view-history.html?gameId=" + gameId;
        returnToPreviousPage = false;
        hasMultipleZeroHandicap = false;
        
        if (archiveId && typeof HistoryRecord !== 'undefined') {
            HistoryRecord.getArchivedGame(archiveId, function(err, archiveData) {
                if (err || !archiveData) {
                    console.error("Failed to load archive data:", err);
                    alert("Unable to load handicap data for this completed game.");
                    window.location.href = returnDestination;
                    return;
                }
                
                var adjustedHandicaps = archiveData.adjustedHandicaps;
                var anchorName = adjustedHandicaps ? adjustedHandicaps.anchor : "Anchor";
                var allPlayersList = archiveData.players || [];
                
                if (adjustedHandicaps && adjustedHandicaps.players) {
                    displayStoredAdjustment(adjustedHandicaps, anchorName, allPlayersList, false);
                } else {
                    console.log("No stored adjustment data, attempting legacy load");
                    loadFromHistoryLegacy(gameId, returnDestination);
                }
            });
        } else {
            loadFromHistoryLegacy(gameId, returnDestination);
        }
    }
    
    // ============================================================
    // LEGACY: Load from historyGames and recalculate
    // ============================================================
    
    function loadFromHistoryLegacy(gameId, returnUrl) {
        var db = getDb();
        db.collection("historyGames").where("originalGameId", "==", gameId).limit(1).get()
            .then(function(snapshot) {
                if (snapshot.empty) {
                    console.error("No history record found for game:", gameId);
                    alert("Unable to load handicap data for this completed game.");
                    window.location.href = returnUrl;
                    return;
                }
                var doc = snapshot.docs[0];
                var historyData = doc.data();
                
                courseSi = historyData.gameInfo?.course?.si || [];
                coursePar = historyData.gameInfo?.course?.par || [];
                startingHole = historyData.gameInfo?.startingHole || 1;
                allPlayers = historyData.players || [];
                
                flight1Data = "";
                flight2Data = "";
                
                var hcpData = historyData.handicapAdjustment;
                if (hcpData && hcpData.players) {
                    var playersWithTeam = hcpData.players.map(function(p) {
                        var playerInfo = allPlayers.find(function(ap) { return ap.name === p.name; });
                        return {
                            name: p.name,
                            label: p.name.substring(0, 3).toUpperCase(),
                            currentHcp: p.currentHcp,
                            anchorAdj: p.anchorAdj || 0,
                            perfAdj: p.perfAdj || 0,
                            finalHcp: p.newHcp,
                            newHcp: null,
                            newAnchor: null,
                            team: playerInfo ? playerInfo.team : 'B',
                            startingHcp: p.currentHcp,
                            anchorRaw: p.anchorRaw || 0,
                            perfRaw: p.perfRaw || 0
                        };
                    });
                    var calculationResult = {
                        players: playersWithTeam,
                        needsZeroRise: hcpData.needsZeroRise || false,
                        zeroRiseAmount: hcpData.zeroRiseAmount || 0,
                        newAnchorName: hcpData.newAnchor
                    };
                    showAdjustmentTable(calculationResult, hcpData.anchor || "Anchor", true);
                } else {
                    var emptyPlayers = allPlayers.map(function(p) {
                        return {
                            name: p.name,
                            label: p.label,
                            currentHcp: p.handicap,
                            anchorAdj: 0,
                            perfAdj: 0,
                            finalHcp: p.handicap,
                            newHcp: null,
                            newAnchor: null,
                            team: p.team,
                            startingHcp: p.handicap,
                            anchorRaw: 0,
                            perfRaw: 0
                        };
                    });
                    var emptyResult = {
                        players: emptyPlayers,
                        needsZeroRise: false,
                        zeroRiseAmount: 0,
                        newAnchorName: null
                    };
                    showAdjustmentTable(emptyResult, "Not calculated", true);
                }
            })
            .catch(function(err) {
                console.error("Error loading history data:", err);
                alert("Unable to load handicap data for this completed game.");
                window.location.href = returnUrl;
            });
    }
    
    // ============================================================
    // v2.50: initForViewer - standalone detection fixed
    // ============================================================
    
    function initForViewer(gameIdParam, players, flight1DataStr, flight2DataStr, courseSiParam, courseParParam, startingHoleParam, resultsCacheParam) {
        console.log('[HCP-ADJUST] initForViewer - viewer mode');
        
        var isStandalone = window.location.pathname.indexOf('/hcp-adjust') !== -1;
        console.log('[HCP-ADJUST] isStandalone:', isStandalone, 'pathname:', window.location.pathname);
        
        if (isStandalone) {
            isStandaloneMode = true;
            standaloneContainerId = 'hcpTableContainer';
            console.log('[HCP-ADJUST] Running in standalone mode, container:', standaloneContainerId);
        } else {
            isStandaloneMode = false;
            standaloneContainerId = null;
        }
        
        currentGameId = gameIdParam;
        allPlayers = players || [];
        flight1Data = flight1DataStr || "";
        flight2Data = flight2DataStr || "";
        courseSi = courseSiParam || [];
        coursePar = courseParParam || [];
        startingHole = startingHoleParam || 1;
        isReadOnlyMode = true;
        returnToPreviousPage = false;
        hasMultipleZeroHandicap = false;
        
        if (!allPlayers.length) {
            console.error('No players provided for handicap adjustment');
            return;
        }
        
        allPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        var anchor = allPlayers[0];
        var calculationResult = calculateAllAdjustments(anchor);
        currentTableData = calculationResult;
        
        if (isStandaloneMode && standaloneContainerId) {
            renderTableToContainer(calculationResult, anchor.name, standaloneContainerId);
            if (typeof WaitingScreen !== 'undefined' && WaitingScreen.hide) {
                WaitingScreen.hide();
            }
            return;
        }
        
        showAdjustmentTable(calculationResult, anchor.name, true);
    }
    
    // ============================================================
    // saveAdjustmentToFirestore - v2.55
    // ============================================================
    
    function saveAdjustmentToFirestore(anchor, calculationResult, callback) {
        var handicapData = {
            anchor: anchor.name,
            players: calculationResult.players.map(function(p) {
                return {
                    name: p.name,
                    label: p.label,
                    currentHcp: p.currentHcp,
                    startingHcp: p.startingHcp || p.currentHcp,
                    anchorAdj: p.anchorAdj,
                    perfAdj: p.perfAdj,
                    finalHcp: calculationResult.needsZeroRise ? p.newAnchor : p.newHcp,
                    anchorRaw: p.anchorRaw || 0,
                    perfRaw: p.perfRaw || 0
                };
            }),
            needsZeroRise: calculationResult.needsZeroRise,
            zeroRiseAmount: calculationResult.zeroRiseAmount,
            newAnchor: calculationResult.newAnchorName || anchor.name
        };
        
        console.log("[HCP-ADJUST] saveAdjustmentToFirestore called");
        console.log("  archiveId:", currentArchiveId);
        console.log("  gameId:", currentGameId);
        console.log("  players:", allPlayers ? allPlayers.length : 0);
        
        if (!currentArchiveId && currentGameId) {
            currentArchiveId = currentGameId + "_H";
            console.log("  Created archiveId:", currentArchiveId);
        }
        
        if (currentArchiveId && typeof HistoryRecord !== 'undefined' && HistoryRecord.updateWithHandicap) {
            console.log("  Calling HistoryRecord.updateWithHandicap for:", currentArchiveId);
            HistoryRecord.updateWithHandicap(currentArchiveId, handicapData, allPlayers, function(err) {
                if (err) {
                    console.error("Error saving handicap data:", err);
                    if (callback) callback(err);
                } else {
                    console.log("  ✅ Handicap data saved successfully");
                    if (callback) callback(null);
                }
            });
        } else {
            console.warn("HistoryRecord.updateWithHandicap not available, skipping status update");
            console.warn("  currentArchiveId:", currentArchiveId);
            console.warn("  HistoryRecord:", typeof HistoryRecord);
            if (callback) callback(null);
        }
    }
    
    // ============================================================
    // Legacy init function - v2.55
    // ============================================================
    
    function init(gameId, archiveId, winningPlayers, matchPoints, holeResults, isViewOnlyMode) {
        console.log("[HCP-ADJUST] init called with gameId:", gameId, "archiveId:", archiveId);
        currentGameId = gameId;
        currentArchiveId = archiveId;
        allPlayers = winningPlayers.teamA.concat(winningPlayers.teamB);
        isViewOnly = isViewOnlyMode || false;
        isReadOnlyMode = false;
        returnToPreviousPage = false;
        
        allPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        var zeroHcpPlayers = allPlayers.filter(function(p) { return p.handicap === 0; });
        hasMultipleZeroHandicap = (zeroHcpPlayers.length > 1);
        
        loadGameData(gameId, function(gameData) {
            if (!gameData) {
                window.location.href = "index.html";
                return;
            }
            
            var storedAnchor = gameData.anchor;
            var anchorFound = null;
            
            if (storedAnchor) {
                anchorFound = allPlayers.find(function(p) { return p.name === storedAnchor; });
            }
            
            var proceedWithAnchor = function(anchor) {
                anchorPlayer = anchor;
                var calculationResult = calculateAllAdjustments(anchorPlayer);
                currentTableData = calculationResult;
                
                saveAdjustmentToFirestore(anchorPlayer, calculationResult, function(err) {
                    if (err) {
                        console.error("Error saving handicap data:", err);
                        alert("Error saving handicap data. Please try again.");
                        showAdjustmentTable(calculationResult, anchorPlayer.name, false);
                    } else {
                        showAdjustmentTable(calculationResult, anchorPlayer.name, false);
                        updatePlayerRecordsInBackground(calculationResult.players, allPlayers);
                    }
                });
            };
            
            if (anchorFound) {
                proceedWithAnchor(anchorFound);
            } else if (zeroHcpPlayers.length === 1) {
                proceedWithAnchor(zeroHcpPlayers[0]);
            } else if (zeroHcpPlayers.length > 1) {
                showAnchorSelectionModal(zeroHcpPlayers);
            } else {
                var lowestHcpPlayer = allPlayers[0];
                proceedWithAnchor(lowestHcpPlayer);
            }
        });
    }
    
    // ============================================================
    // Load game data from Firestore
    // ============================================================
    
    function loadGameData(gameId, callback) {
        var db = getDb();
        db.collection("scheduledGames").doc(gameId).get()
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
    
    // ============================================================
    // LEGACY: updatePlayerProfiles
    // ============================================================
    
    function updatePlayerProfiles(players, callback) {
        var db = getDb();
        db.collection('playerInformation').doc('defaultPlayers').get()
            .then(function(doc) {
                if (doc.exists && doc.data().players) {
                    var currentPlayers = doc.data().players;
                    for (var i = 0; i < currentPlayers.length; i++) {
                        for (var j = 0; j < players.length; j++) {
                            if (currentPlayers[i].name === players[j].name) {
                                currentPlayers[i].handicap = players[j].newHcp;
                                console.log('Updated ' + players[j].name + ': ' + players[j].currentHcp + ' → ' + players[j].newHcp);
                            }
                        }
                    }
                    return wrw('playerInformation', 'defaultPlayers', {
                        players: currentPlayers,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, true);
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
    
    function showAnchorSelectionModal(zeroHcpPlayers) {
        var optionsHtml = '';
        for (var i = 0; i < zeroHcpPlayers.length; i++) {
            optionsHtml += '<option value="' + zeroHcpPlayers[i].name + '">' + zeroHcpPlayers[i].name + ' (HCP ' + zeroHcpPlayers[i].handicap + ')</option>';
        }
        
        var modalHtml = '<div class="modal-overlay" id="anchorSelectModal" style="z-index: 10001;">' +
            '<div style="background:#1a1a1a; border-radius:28px; padding:28px; max-width:360px; width:90%; text-align:center; border:2px solid #4caf50;">' +
            '<div style="font-size:1.3rem; font-weight:800; color:#4caf50; margin-bottom:16px;">🏌️ SELECT ANCHOR</div>' +
            '<div style="font-size:0.9rem; color:#ccc; margin-bottom:20px;">Who is today\'s Anchor? (Lowest handicap player)</div>' +
            '<select id="anchorSelect" style="width:100%; background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:12px; border-radius:30px; font-size:1rem; margin-bottom:20px;">' +
            optionsHtml +
            '</select>' +
            '<button id="anchorConfirmBtn" style="background:#1a3a1a; border:1px solid #4caf50; color:#4caf50; padding:12px 24px; border-radius:40px; font-size:1rem; font-weight:700; cursor:pointer; width:100%;">✓ Confirm Anchor</button>' +
            '</div></div>';
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById('anchorConfirmBtn').addEventListener('click', function() {
            var selectedName = document.getElementById('anchorSelect').value;
            var selectedAnchor = allPlayers.find(function(p) { return p.name === selectedName; });
            document.getElementById('anchorSelectModal').remove();
            
            anchorPlayer = selectedAnchor;
            var calculationResult = calculateAllAdjustments(anchorPlayer);
            currentTableData = calculationResult;
            
            saveAdjustmentToFirestore(anchorPlayer, calculationResult, function(err) {
                if (err) {
                    alert("Error saving handicap data. Please try again.");
                    showAdjustmentTable(calculationResult, anchorPlayer.name, false);
                } else {
                    showAdjustmentTable(calculationResult, anchorPlayer.name, false);
                    updatePlayerRecordsInBackground(calculationResult.players, allPlayers);
                }
            });
        });
    }
    
    function initReadOnly(gameId, returnUrl) {
        initForHistory(gameId, null, returnUrl);
    }
    
    function checkUrlAndInit() {
        var urlParams = new URLSearchParams(window.location.search);
        var gameId = urlParams.get('gameId');
        var mode = urlParams.get('mode');
        var returnTo = urlParams.get('returnTo');
        
        if (gameId && mode === 'readonly') {
            var returnUrl = returnTo === 'history' ? 'view-history.html?gameId=' + gameId : null;
            initReadOnly(gameId, returnUrl);
            return true;
        }
        return false;
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
    
    window.HANDICAP_ADJUST_VERSION = "2.59";
    
    if (typeof window !== 'undefined') {
        checkUrlAndInit();
    }
    
    return {
        init: init,
        initForViewer: initForViewer,
        initForHistory: initForHistory,
        initReadOnly: initReadOnly,
        checkUrlAndInit: checkUrlAndInit,
        displayStoredAdjustment: displayStoredAdjustment,
        calculateAllAdjustments: calculateAllAdjustments,
        calculateAllAdjustmentsFromRaw: calculateAllAdjustmentsFromRaw,
        updatePlayerRecordsInBackground: updatePlayerRecordsInBackground,
        MULTIPLE_NEW_ANCHOR: MULTIPLE_NEW_ANCHOR
    };
    
})();

// Make available globally
window.HandicapAdjustment = HandicapAdjustment;

/*
FILE: js/hcp-adjust.js
VERSION: 2.59
KEY CHANGES from v2.58:
   - FIXED: Zero-rise logic in calculateAllAdjustments()
   - CHANGED: needsZeroRise = (lowestRaw !== 0) instead of (lowestRaw < 0)
   - CHANGED: zeroRiseAmount = -lowestRaw (always, not conditional)
   - REASON: Zero-rise should happen when lowest is NOT zero (including positive values)
   - REASON: When lowest = 1, subtract 1 from all handicaps to make lowest = 0
   - REASON: When lowest = -2, add 2 to all handicaps to make lowest = 0
   - PRESERVED: ALL other functionality from v2.58 unchanged
   - PRESERVED: Raw column UI for when zero-rise is applied
DEPENDS ON: Firebase Firestore, js/history-record.js, js/game-match.js, js/waiting-screen.js, WRV.js
STATUS: Ready for integration
*/