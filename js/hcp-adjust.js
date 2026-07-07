/*
FILE: js/hcp-adjust.js
VERSION: 2.60
KEY CHANGES from v2.59:
   - CHANGED: COMPLETE SIMPLIFICATION - hcp-adjust is now PURE DISPLAY ONLY
   - REMOVED: saveAdjustmentToFirestore() - no longer needed
   - REMOVED: updatePlayerRecordsInBackground() - no longer needed
   - REMOVED: showAnchorSelectionModal() - no longer needed
   - REMOVED: updateAnchorAndRecalculate() - no longer needed
   - CHANGED: loadGameData() now reads from historyGames (not scheduledGames)
   - CHANGED: init() now reads from history record
   - CHANGED: initForViewer() simplified
   - ADDED: displayStoredAdjustment() - primary display function
   - REASON: Handicaps are calculated at history record write time (v3.10)
   - REASON: hcp-adjust only needs to DISPLAY the already-calculated data
   - REASON: No user input, no approvals needed - just viewing
   - PRESERVED: renderTableToContainer() and table rendering logic
   - PRESERVED: ALL UI styling and display functionality
DEPENDS ON: Firebase Firestore, js/history-record.js
STATUS: Ready for integration
*/

var HandicapAdjustment = (function() {
    
    // ============================================================
    // CONSTANT for multiple new anchor scenario
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
    var isReadOnlyMode = false;
    var returnDestination = null;
    var returnToPreviousPage = false;
    var hasMultipleZeroHandicap = false;
    
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
    // v2.60: Load game data from historyGames (not scheduledGames)
    // ============================================================
    
    function loadGameDataFromHistory(gameId, callback) {
        var archiveId = gameId + '_H';
        var db = getDb();
        
        db.collection('historyGames').doc(archiveId).get()
            .then(function(doc) {
                if (!doc.exists) {
                    console.warn('[HCP-ADJUST] No history record found for:', gameId);
                    callback(null);
                    return;
                }
                
                var data = doc.data();
                courseSi = data.gameInfo?.course?.si || [];
                coursePar = data.gameInfo?.course?.par || [];
                startingHole = data.gameInfo?.startingHole || 1;
                flight1Data = data.f1DataString || "";
                flight2Data = data.f2DataString || "";
                allPlayers = data.players || [];
                
                // The adjustedHandicaps are already calculated and stored
                var adjustedHandicaps = data.adjustedHandicaps || null;
                
                callback({
                    historyData: data,
                    adjustedHandicaps: adjustedHandicaps,
                    players: allPlayers,
                    course: data.gameInfo?.course || {},
                    startingHole: startingHole
                });
            })
            .catch(function(err) {
                console.error('[HCP-ADJUST] Error loading history data:', err);
                callback(null);
            });
    }
    
    // ============================================================
    // v2.60: Display stored adjustment from history record
    // ============================================================
    
    function displayStoredAdjustment(adjustedHandicaps, anchorName, playersList, isStandalone) {
        if (!adjustedHandicaps || !adjustedHandicaps.players) {
            console.warn('[HCP-ADJUST] No stored adjustment data available');
            return false;
        }
        
        var playerMap = {};
        if (playersList) {
            for (var i = 0; i < playersList.length; i++) {
                playerMap[playersList[i].name] = {
                    team: playersList[i].team,
                    startingHcp: playersList[i].handicap
                };
            }
        }
        
        var players = adjustedHandicaps.players.map(function(p) {
            var teamInfo = playerMap[p.name] || { team: 'B', startingHcp: p.startingHcp };
            return {
                name: p.name,
                label: p.label || p.name.substring(0, 3).toUpperCase(),
                currentHcp: p.startingHcp || p.currentHcp || 0,
                startingHcp: p.startingHcp || p.currentHcp || 0,
                anchorAdj: p.anchorAdj || 0,
                perfAdj: p.perfAdj || 0,
                finalHcp: p.finalHcp || p.newHcp || p.startingHcp || 0,
                team: teamInfo.team,
                anchorRaw: p.anchorRaw !== undefined ? p.anchorRaw : 0,
                perfRaw: p.perfRaw !== undefined ? p.perfRaw : 0
            };
        });
        
        var newAnchorValue = adjustedHandicaps.newAnchor || anchorName || null;
        
        var calculationResult = {
            players: players,
            needsZeroRise: adjustedHandicaps.needsZeroRise || false,
            zeroRiseAmount: adjustedHandicaps.zeroRiseAmount || 0,
            newAnchorName: newAnchorValue
        };
        
        currentTableData = calculationResult;
        anchorPlayer = anchorName || players[0]?.name || 'Anchor';
        
        if (isStandalone && standaloneContainerId) {
            renderTableToContainer(calculationResult, anchorName, standaloneContainerId);
            return true;
        }
        
        showAdjustmentTable(calculationResult, anchorName || players[0]?.name || 'Anchor', true);
        return true;
    }
    
    // ============================================================
    // v2.60: renderTableToContainer - displays the table
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
        // TABLE: Zero-rise needed → 6 columns (Label, Old, Anc, Perf, Raw, New)
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
        // TABLE: No zero-rise → 5 columns (Label, Old, Anc, Perf, New)
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
    }
    
    // ============================================================
    // v2.60: showAdjustmentTable - modal mode (backward compatible)
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
        if (returnToPreviousPage || isReadOnly) {
            buttonsHtml = '<div style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; justify-content:center;"><button id="hcpBackBtn" style="background:#1a1a1a; border:1px solid #333; color:#ccc; padding:8px 16px; border-radius:30px; font-size:0.7rem; font-weight:600; cursor:pointer;">← Close</button></div>';
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
    
    // ============================================================
    // v2.60: init - Main entry point for hcp-adjust.html
    // ============================================================
    
    function init(gameId) {
        console.log('[HCP-ADJUST] init called for gameId:', gameId);
        currentGameId = gameId;
        isStandaloneMode = true;
        standaloneContainerId = 'hcpTableContainer';
        isReadOnlyMode = true;
        
        if (!gameId) {
            console.error('[HCP-ADJUST] No gameId provided');
            return;
        }
        
        // Load from historyGames
        loadGameDataFromHistory(gameId, function(result) {
            if (!result || !result.historyData) {
                console.error('[HCP-ADJUST] No history data found for:', gameId);
                var container = document.getElementById('hcpTableContainer');
                if (container) {
                    container.innerHTML = '<div style="text-align:center; color:#888; padding:40px 20px;">No handicap data found for this game.</div>';
                }
                return;
            }
            
            var adjustedHandicaps = result.adjustedHandicaps;
            var players = result.players || [];
            var anchorName = adjustedHandicaps?.anchor || players[0]?.name || 'Anchor';
            
            if (adjustedHandicaps && adjustedHandicaps.players) {
                displayStoredAdjustment(adjustedHandicaps, anchorName, players, true);
            } else {
                console.warn('[HCP-ADJUST] No adjusted handicaps in history record');
                var container = document.getElementById('hcpTableContainer');
                if (container) {
                    container.innerHTML = '<div style="text-align:center; color:#888; padding:40px 20px;">No handicap adjustment data available.</div>';
                }
            }
        });
    }
    
    // ============================================================
    // v2.60: initForViewer - for viewing from history or scorecard
    // ============================================================
    
    function initForViewer(gameId, returnUrl) {
        console.log('[HCP-ADJUST] initForViewer called for gameId:', gameId);
        currentGameId = gameId;
        isReadOnlyMode = true;
        returnDestination = returnUrl || 'view-game.html?gameId=' + gameId;
        returnToPreviousPage = false;
        isStandaloneMode = false;
        standaloneContainerId = null;
        
        if (!gameId) {
            console.error('[HCP-ADJUST] No gameId provided');
            return;
        }
        
        loadGameDataFromHistory(gameId, function(result) {
            if (!result || !result.historyData) {
                console.error('[HCP-ADJUST] No history data found for:', gameId);
                alert('Unable to load handicap data for this game.');
                if (returnUrl) {
                    window.location.href = returnUrl;
                }
                return;
            }
            
            var adjustedHandicaps = result.adjustedHandicaps;
            var players = result.players || [];
            var anchorName = adjustedHandicaps?.anchor || players[0]?.name || 'Anchor';
            
            if (adjustedHandicaps && adjustedHandicaps.players) {
                displayStoredAdjustment(adjustedHandicaps, anchorName, players, false);
            } else {
                console.warn('[HCP-ADJUST] No adjusted handicaps in history record');
                alert('No handicap adjustment data available for this game.');
                if (returnUrl) {
                    window.location.href = returnUrl;
                }
            }
        });
    }
    
    // ============================================================
    // v2.60: initForHistory - legacy compatibility
    // ============================================================
    
    function initForHistory(gameId, archiveId, returnUrl) {
        initForViewer(gameId, returnUrl);
    }
    
    // ============================================================
    // v2.60: initReadOnly - legacy compatibility
    // ============================================================
    
    function initReadOnly(gameId, returnUrl) {
        initForViewer(gameId, returnUrl);
    }
    
    // ============================================================
    // v2.60: checkUrlAndInit - URL parameter detection
    // ============================================================
    
    function checkUrlAndInit() {
        var urlParams = new URLSearchParams(window.location.search);
        var gameId = urlParams.get('gameId');
        var mode = urlParams.get('mode');
        var returnTo = urlParams.get('returnTo');
        
        if (gameId) {
            if (mode === 'readonly' || mode === 'display') {
                var returnUrl = returnTo === 'history' ? 'view-history.html?gameId=' + gameId : null;
                initForViewer(gameId, returnUrl);
                return true;
            } else {
                // Default: display mode
                init(gameId);
                return true;
            }
        }
        return false;
    }
    
    // ============================================================
    // Helper: escapeHtml
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
    // Expose version and constants
    // ============================================================
    
    window.HANDICAP_ADJUST_VERSION = "2.60";
    
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
        MULTIPLE_NEW_ANCHOR: MULTIPLE_NEW_ANCHOR
    };
    
})();

// Make available globally
window.HandicapAdjustment = HandicapAdjustment;

/*
FILE: js/hcp-adjust.js
VERSION: 2.60
KEY CHANGES from v2.59:
   - CHANGED: COMPLETE SIMPLIFICATION - hcp-adjust is now PURE DISPLAY ONLY
   - REMOVED: saveAdjustmentToFirestore() - no longer needed
   - REMOVED: updatePlayerRecordsInBackground() - no longer needed
   - REMOVED: showAnchorSelectionModal() - no longer needed
   - REMOVED: updateAnchorAndRecalculate() - no longer needed
   - CHANGED: loadGameData() now reads from historyGames (not scheduledGames)
   - CHANGED: init() now reads from history record
   - CHANGED: initForViewer() simplified
   - ADDED: displayStoredAdjustment() - primary display function
   - REASON: Handicaps are calculated at history record write time (v3.10)
   - REASON: hcp-adjust only needs to DISPLAY the already-calculated data
   - REASON: No user input, no approvals needed - just viewing
   - PRESERVED: renderTableToContainer() and table rendering logic
   - PRESERVED: ALL UI styling and display functionality
DEPENDS ON: Firebase Firestore, js/history-record.js
STATUS: Ready for integration
*/