/*
FILE: js/util-players.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - FIXED: savePlayerEdit() now uses WRV.write() with merge instead of WRV.update()
   - FIXED: WRV verification now works correctly with nested path writes
   - CHANGED: Updated player object is written as a full object at the nested path
   - PRESERVED: All existing functionality from v1.01
DEPENDS ON: util-core.js, wrv.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_PLAYERS_VERSION = "1.02";
console.log("[UTIL-PLAYERS] Initializing v1.02");

// ============================================================
// STATE
// ============================================================

var playersDb = null;
var playersEnv = null;

// Staged data for confirmation
var stagedUsedLabels = null;
var stagedLabelHistory = null;

// Player Editor state
var editorCurrentPlayer = null;
var editorCurrentIndex = -1;
var editorOriginalData = null;

// ============================================================
// HELPERS
// ============================================================

function playersLog(message, type) {
    if (typeof log === 'function') {
        log('[PLAYERS] ' + message, type);
    } else {
        console.log('[PLAYERS] ' + message);
    }
}

function playersLogStep(step, message, type) {
    if (typeof logStep === 'function') {
        logStep(step, '[PLAYERS] ' + message, type);
    } else {
        console.log('[PLAYERS] [Step ' + step + '] ' + message);
    }
}

function getDbForEnv(env) {
    if (env === 'PROD') {
        return window.prodDb || null;
    } else if (env === 'DEV') {
        return window.devDb || null;
    }
    return null;
}

// ============================================================
// ENVIRONMENT
// ============================================================

function setPlayersEnvironment(env) {
    if (env === 'PROD') {
        if (!window.prodDb) {
            playersLog("Cannot connect to PRODUCTION", "error");
            return;
        }
        playersDb = window.prodDb;
        playersEnv = 'PROD';
        updatePlayersUI('PROD');
        playersLog('Environment set to: PRODUCTION', 'success');
    } else if (env === 'DEV') {
        if (!window.devDb) {
            playersLog("Cannot connect to DEVELOPMENT", "error");
            return;
        }
        playersDb = window.devDb;
        playersEnv = 'DEV';
        updatePlayersUI('DEV');
        playersLog('Environment set to: DEVELOPMENT', 'success');
    } else {
        playersDb = null;
        playersEnv = null;
        updatePlayersUI(null);
        playersLog('Environment disconnected', 'info');
    }
    
    // Load status when environment changes
    if (playersDb) {
        loadPlayersStatus();
        loadPlayerEditorDropdown();
    }
}

function updatePlayersUI(env) {
    var prodBtn = document.getElementById('playersProdBtn');
    var devBtn = document.getElementById('playersDevBtn');
    var indicator = document.getElementById('playersIndicator');
    
    if (prodBtn) prodBtn.classList.remove('active-prod');
    if (devBtn) devBtn.classList.remove('active-dev');
    
    if (env === 'PROD') {
        if (prodBtn) prodBtn.classList.add('active-prod');
        if (indicator) {
            indicator.className = 'env-indicator-small prod';
            indicator.textContent = '🔴 PRODUCTION';
        }
    } else if (env === 'DEV') {
        if (devBtn) devBtn.classList.add('active-dev');
        if (indicator) {
            indicator.className = 'env-indicator-small dev';
            indicator.textContent = '🟡 DEVELOPMENT';
        }
    } else {
        if (indicator) {
            indicator.className = 'env-indicator-small none';
            indicator.textContent = 'Not connected';
        }
    }
}

// ============================================================
// LOAD STATUS (existing functions)
// ============================================================

function loadPlayersStatus() {
    if (!playersDb) {
        playersLog("Select environment first", "error");
        return;
    }
    
    playersLog('Loading players status...', 'info');
    
    // Load usedLabels status
    loadUsedLabelsStatus();
    
    // Load labelHistory status
    loadLabelHistoryStatus();
}

function loadUsedLabelsStatus() {
    if (!playersDb) return;
    
    var badge = document.getElementById('usedLabelsStatusBadge');
    var info = document.getElementById('usedLabelsStatusInfo');
    var viewBtn = document.getElementById('usedLabelsViewBtn');
    
    if (badge) badge.textContent = '⏳ Loading...';
    if (info) info.textContent = 'Loading usedLabels from Firestore...';
    if (viewBtn) viewBtn.disabled = true;
    
    playersDb.collection('usedLabels').doc('all').get()
        .then(function(doc) {
            var exists = doc.exists;
            var labels = doc.exists ? doc.data().labels || {} : {};
            var count = Object.keys(labels).length;
            
            if (badge) {
                badge.textContent = exists ? '✅ Exists (' + count + ' labels)' : '❌ Does not exist';
                badge.className = 'status-badge-large ' + (exists ? 'exists' : 'missing');
            }
            
            if (info) {
                if (exists) {
                    info.innerHTML = '📋 <strong>' + count + '</strong> labels in usedLabels index.';
                } else {
                    info.innerHTML = '⚠️ usedLabels document does not exist. Click <strong>"Rebuild from History"</strong> to create it.';
                }
            }
            
            if (viewBtn) {
                viewBtn.disabled = !exists;
            }
            
            playersLog('usedLabels: ' + (exists ? count + ' labels found' : 'not found'), exists ? 'success' : 'warning');
        })
        .catch(function(err) {
            playersLog('Error loading usedLabels: ' + err.message, 'error');
            if (badge) {
                badge.textContent = '❌ Error';
                badge.className = 'status-badge-large missing';
            }
            if (info) info.textContent = 'Error: ' + err.message;
        });
}

function loadLabelHistoryStatus() {
    if (!playersDb) return;
    
    var badge = document.getElementById('labelHistoryStatusBadge');
    var info = document.getElementById('labelHistoryStatusInfo');
    var viewBtn = document.getElementById('labelHistoryViewBtn');
    var listDiv = document.getElementById('labelHistoryList');
    
    if (badge) badge.textContent = '⏳ Loading...';
    if (info) info.textContent = 'Loading labelHistory from playerInformation...';
    if (viewBtn) viewBtn.disabled = true;
    
    playersDb.collection('playerInformation').doc('players').get()
        .then(function(doc) {
            if (!doc.exists) {
                playersLog('playerInformation document not found', 'warning');
                if (badge) {
                    badge.textContent = '❌ No document';
                    badge.className = 'status-badge-large missing';
                }
                if (info) info.textContent = '⚠️ playerInformation document does not exist.';
                return;
            }
            
            var data = doc.data();
            var labelHistory = data.labelHistory || {};
            var count = Object.keys(labelHistory).length;
            var exists = count > 0;
            
            if (badge) {
                badge.textContent = exists ? '✅ Exists (' + count + ' mappings)' : '❌ Does not exist';
                badge.className = 'status-badge-large ' + (exists ? 'exists' : 'missing');
            }
            
            if (info) {
                if (exists) {
                    info.innerHTML = '📋 <strong>' + count + '</strong> label mappings in labelHistory.';
                } else {
                    info.innerHTML = '⚠️ labelHistory does not exist. Click <strong>"Sync from Players"</strong> to create it.';
                }
            }
            
            if (viewBtn) {
                viewBtn.disabled = !exists;
            }
            
            // Show mappings if they exist
            if (exists && listDiv) {
                var html = '';
                var entries = Object.entries(labelHistory);
                for (var i = 0; i < entries.length; i++) {
                    var oldLabel = entries[i][0];
                    var newLabel = entries[i][1];
                    if (oldLabel !== newLabel) {
                        html += '<div class="entry"><span class="old">' + escapeHtml(oldLabel) + '</span><span class="arrow">→</span><span class="new">' + escapeHtml(newLabel) + '</span></div>';
                    }
                }
                listDiv.innerHTML = html;
                document.getElementById('labelHistoryPreview').style.display = 'block';
            } else {
                document.getElementById('labelHistoryPreview').style.display = 'none';
            }
            
            playersLog('labelHistory: ' + (exists ? count + ' mappings found' : 'not found'), exists ? 'success' : 'warning');
        })
        .catch(function(err) {
            playersLog('Error loading labelHistory: ' + err.message, 'error');
            if (badge) {
                badge.textContent = '❌ Error';
                badge.className = 'status-badge-large missing';
            }
            if (info) info.textContent = 'Error: ' + err.message;
        });
}

// ============================================================
// VIEW FUNCTIONS (Modal) - existing
// ============================================================

function viewUsedLabels() {
    if (!playersDb) {
        playersLog("Select environment first", "error");
        return;
    }
    
    playersDb.collection('usedLabels').doc('all').get()
        .then(function(doc) {
            if (!doc.exists) {
                playersLog('usedLabels does not exist', 'warning');
                Modal.alert('usedLabels document does not exist.');
                return;
            }
            
            var labels = doc.data().labels || {};
            var labelArray = Object.keys(labels).sort();
            
            var html = '<div style="max-height:400px; overflow-y:auto; padding:8px;">';
            html += '<div style="font-size:0.8rem; color:#888; margin-bottom:12px;">Total: <strong>' + labelArray.length + '</strong> labels</div>';
            html += '<div style="display:flex; flex-wrap:wrap; gap:6px;">';
            for (var i = 0; i < labelArray.length; i++) {
                html += '<span style="background:#1a3a1a; color:#4caf50; padding:4px 12px; border-radius:12px; font-size:0.85rem; font-weight:600; border:1px solid #2a5a2a;">' + escapeHtml(labelArray[i]) + '</span>';
            }
            html += '</div></div>';
            
            Modal.showCustomModal('🏷️ usedLabels', html);
            playersLog('Viewed usedLabels: ' + labelArray.length + ' labels', 'info');
        })
        .catch(function(err) {
            playersLog('Error viewing usedLabels: ' + err.message, 'error');
            Modal.alert('Error: ' + err.message);
        });
}

function viewLabelHistory() {
    if (!playersDb) {
        playersLog("Select environment first", "error");
        return;
    }
    
    playersDb.collection('playerInformation').doc('players').get()
        .then(function(doc) {
            if (!doc.exists) {
                playersLog('playerInformation does not exist', 'warning');
                Modal.alert('playerInformation document does not exist.');
                return;
            }
            
            var data = doc.data();
            var labelHistory = data.labelHistory || {};
            var entries = Object.entries(labelHistory);
            var players = data.players || [];
            
            // Build player name lookup
            var playerMap = {};
            for (var i = 0; i < players.length; i++) {
                playerMap[players[i].label] = players[i].name;
                playerMap[players[i].name] = players[i].name;
            }
            
            var html = '<div style="max-height:400px; overflow-y:auto; padding:8px;">';
            html += '<div style="font-size:0.8rem; color:#888; margin-bottom:12px;">Total: <strong>' + entries.length + '</strong> mappings</div>';
            
            if (entries.length === 0) {
                html += '<div style="color:#888; text-align:center; padding:20px;">No label mappings found.</div>';
            } else {
                html += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">';
                html += '<tr style="border-bottom:1px solid #2a2a2a;">';
                html += '<th style="text-align:left; padding:6px; color:#888;">Old</th>';
                html += '<th style="text-align:center; padding:6px; color:#888;">→</th>';
                html += '<th style="text-align:left; padding:6px; color:#888;">New</th>';
                html += '<th style="text-align:left; padding:6px; color:#888;">Player</th>';
                html += '</tr>';
                
                for (var i = 0; i < entries.length; i++) {
                    var oldLabel = entries[i][0];
                    var newLabel = entries[i][1];
                    if (oldLabel === newLabel) continue;
                    
                    var playerName = playerMap[oldLabel] || playerMap[newLabel] || oldLabel;
                    
                    html += '<tr style="border-bottom:1px solid #1a1a1a;">';
                    html += '<td style="padding:6px; color:#888; font-family:monospace;">' + escapeHtml(oldLabel) + '</td>';
                    html += '<td style="padding:6px; text-align:center; color:#4caf50;">→</td>';
                    html += '<td style="padding:6px; color:#4caf50; font-family:monospace; font-weight:600;">' + escapeHtml(newLabel) + '</td>';
                    html += '<td style="padding:6px; color:#ffaa44;">' + escapeHtml(playerName) + '</td>';
                    html += '</tr>';
                }
                html += '</table>';
            }
            html += '</div>';
            
            Modal.showCustomModal('📜 labelHistory', html);
            playersLog('Viewed labelHistory: ' + entries.length + ' mappings', 'info');
        })
        .catch(function(err) {
            playersLog('Error viewing labelHistory: ' + err.message, 'error');
            Modal.alert('Error: ' + err.message);
        });
}

// ============================================================
// REBUILD usedLabels (existing)
// ============================================================

function rebuildUsedLabels() {
    if (!playersDb) {
        playersLog("Select environment first", "error");
        return;
    }
    
    playersLogStep(1, '=== REBUILD usedLabels START ===', 'info');
    playersLogStep(1, 'Environment: ' + playersEnv, 'info');
    
    var badge = document.getElementById('usedLabelsStatusBadge');
    var info = document.getElementById('usedLabelsStatusInfo');
    var rebuildBtn = document.getElementById('usedLabelsRebuildBtn');
    var viewBtn = document.getElementById('usedLabelsViewBtn');
    var confirmSection = document.getElementById('usedLabelsConfirmSection');
    var previewList = document.getElementById('usedLabelsList');
    
    if (badge) {
        badge.textContent = '⏳ Scanning...';
        badge.className = 'status-badge-large warning';
    }
    if (info) info.textContent = 'Scanning historyGames for labels...';
    if (rebuildBtn) rebuildBtn.disabled = true;
    if (viewBtn) viewBtn.disabled = true;
    if (confirmSection) confirmSection.style.display = 'none';
    
    playersLogStep(2, 'Scanning historyGames collection...', 'info');
    
    playersDb.collection('historyGames').get()
        .then(function(snapshot) {
            var labelSet = {};
            var gameCount = 0;
            var playerCount = 0;
            
            snapshot.forEach(function(doc) {
                var data = doc.data();
                gameCount++;
                
                if (data.players && Array.isArray(data.players)) {
                    for (var i = 0; i < data.players.length; i++) {
                        var label = data.players[i].label;
                        if (label && label !== '') {
                            labelSet[label] = true;
                            playerCount++;
                        }
                    }
                }
            });
            
            var labelArray = Object.keys(labelSet).sort();
            
            playersLogStep(2, 'Scanned ' + gameCount + ' games, ' + playerCount + ' players', 'info');
            playersLogStep(2, 'Found ' + labelArray.length + ' unique labels', 'info');
            
            if (labelArray.length === 0) {
                playersLogStep(2, 'No labels found in historyGames', 'warning');
                if (badge) {
                    badge.textContent = '⚠️ No labels found';
                    badge.className = 'status-badge-large warning';
                }
                if (info) info.textContent = 'No labels found in historyGames. Nothing to rebuild.';
                if (rebuildBtn) rebuildBtn.disabled = false;
                return;
            }
            
            var html = '';
            for (var i = 0; i < labelArray.length; i++) {
                html += '<div class="entry"><span class="old">' + escapeHtml(labelArray[i]) + '</span></div>';
            }
            if (previewList) previewList.innerHTML = html;
            document.getElementById('usedLabelsPreview').style.display = 'block';
            
            stagedUsedLabels = {
                labels: labelSet,
                labelArray: labelArray,
                count: labelArray.length
            };
            
            if (badge) {
                badge.textContent = '📋 ' + labelArray.length + ' labels to write';
                badge.className = 'status-badge-large warning';
            }
            if (info) {
                info.innerHTML = '📋 <strong>' + labelArray.length + '</strong> labels found. Review below and confirm to write.';
            }
            
            if (confirmSection) {
                confirmSection.style.display = 'block';
                var confirmBtn = document.getElementById('usedLabelsConfirmBtn');
                if (confirmBtn) {
                    confirmBtn.textContent = '✅ CONFIRM & UPDATE (' + labelArray.length + ' labels)';
                }
            }
            
            if (rebuildBtn) rebuildBtn.disabled = false;
            
            playersLogStep(2, 'Ready to write ' + labelArray.length + ' labels', 'success');
        })
        .catch(function(err) {
            playersLogStep(2, 'Error scanning historyGames: ' + err.message, 'error');
            if (badge) {
                badge.textContent = '❌ Error';
                badge.className = 'status-badge-large missing';
            }
            if (info) info.textContent = 'Error: ' + err.message;
            if (rebuildBtn) rebuildBtn.disabled = false;
        });
}

function executeRebuildUsedLabels() {
    if (!playersDb || !stagedUsedLabels) {
        playersLog("No staged data to write", "error");
        return;
    }
    
    var labelArray = stagedUsedLabels.labelArray || [];
    var labelSet = stagedUsedLabels.labels || {};
    var count = labelArray.length;
    
    if (count === 0) {
        playersLog("No labels to write", "warning");
        return;
    }
    
    playersLogStep(3, '=== EXECUTING REBUILD usedLabels ===', 'info');
    playersLogStep(3, 'Writing ' + count + ' labels to usedLabels/all', 'info');
    
    var badge = document.getElementById('usedLabelsStatusBadge');
    var info = document.getElementById('usedLabelsStatusInfo');
    var confirmSection = document.getElementById('usedLabelsConfirmSection');
    var confirmBtn = document.getElementById('usedLabelsConfirmBtn');
    var cancelBtn = document.getElementById('usedLabelsCancelBtn');
    var rebuildBtn = document.getElementById('usedLabelsRebuildBtn');
    
    if (badge) {
        badge.textContent = '⏳ Writing...';
        badge.className = 'status-badge-large warning';
    }
    if (info) info.textContent = 'Writing to Firestore...';
    if (confirmBtn) confirmBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (rebuildBtn) rebuildBtn.disabled = true;
    
    var data = {
        labels: labelSet,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (typeof WRV !== 'undefined' && WRV.write) {
        playersLogStep(3, 'Using WRV for write', 'info');
        WRV.write('usedLabels', 'all', data, function(err, result) {
            if (err) {
                playersLogStep(3, '❌ WRV write failed: ' + err.message, 'error');
                if (badge) {
                    badge.textContent = '❌ Write failed';
                    badge.className = 'status-badge-large missing';
                }
                if (info) info.textContent = 'Error: ' + err.message;
                if (confirmBtn) confirmBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
                if (rebuildBtn) rebuildBtn.disabled = false;
                if (confirmSection) confirmSection.style.display = 'none';
                return;
            }
            
            playersLogStep(3, '✅ usedLabels write successful', 'success');
            handleRebuildSuccess(count);
        });
    } else {
        playersLogStep(3, 'WRV not available, using direct write', 'warning');
        playersDb.collection('usedLabels').doc('all').set(data)
            .then(function() {
                playersLogStep(3, '✅ usedLabels write successful', 'success');
                handleRebuildSuccess(count);
            })
            .catch(function(err) {
                playersLogStep(3, '❌ Direct write failed: ' + err.message, 'error');
                if (badge) {
                    badge.textContent = '❌ Write failed';
                    badge.className = 'status-badge-large missing';
                }
                if (info) info.textContent = 'Error: ' + err.message;
                if (confirmBtn) confirmBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
                if (rebuildBtn) rebuildBtn.disabled = false;
                if (confirmSection) confirmSection.style.display = 'none';
            });
    }
}

function handleRebuildSuccess(count) {
    var badge = document.getElementById('usedLabelsStatusBadge');
    var info = document.getElementById('usedLabelsStatusInfo');
    var confirmSection = document.getElementById('usedLabelsConfirmSection');
    var viewBtn = document.getElementById('usedLabelsViewBtn');
    var rebuildBtn = document.getElementById('usedLabelsRebuildBtn');
    
    if (badge) {
        badge.textContent = '✅ Exists (' + count + ' labels)';
        badge.className = 'status-badge-large exists';
    }
    if (info) info.innerHTML = '📋 <strong>' + count + '</strong> labels written successfully.';
    if (viewBtn) viewBtn.disabled = false;
    if (rebuildBtn) rebuildBtn.disabled = false;
    if (confirmSection) confirmSection.style.display = 'none';
    
    document.getElementById('usedLabelsPreview').style.display = 'none';
    stagedUsedLabels = null;
    
    playersLogStep(3, '=== REBUILD usedLabels COMPLETE ===', 'success');
}

// ============================================================
// SYNC labelHistory (existing)
// ============================================================

function syncLabelHistory() {
    if (!playersDb) {
        playersLog("Select environment first", "error");
        return;
    }
    
    playersLogStep(1, '=== SYNC labelHistory START ===', 'info');
    playersLogStep(1, 'Environment: ' + playersEnv, 'info');
    
    var badge = document.getElementById('labelHistoryStatusBadge');
    var info = document.getElementById('labelHistoryStatusInfo');
    var syncBtn = document.getElementById('labelHistorySyncBtn');
    var viewBtn = document.getElementById('labelHistoryViewBtn');
    var confirmSection = document.getElementById('labelHistoryConfirmSection');
    var previewList = document.getElementById('labelHistoryList');
    
    if (badge) {
        badge.textContent = '⏳ Scanning...';
        badge.className = 'status-badge-large warning';
    }
    if (info) info.textContent = 'Scanning players and history...';
    if (syncBtn) syncBtn.disabled = true;
    if (viewBtn) viewBtn.disabled = true;
    if (confirmSection) confirmSection.style.display = 'none';
    
    playersLogStep(2, 'Loading current players...', 'info');
    
    var currentPlayers = {};
    var playerNames = {};
    
    playersDb.collection('playerInformation').doc('players').get()
        .then(function(doc) {
            if (!doc.exists) {
                playersLogStep(2, 'playerInformation not found', 'error');
                if (badge) {
                    badge.textContent = '❌ No document';
                    badge.className = 'status-badge-large missing';
                }
                if (info) info.textContent = 'playerInformation document does not exist.';
                if (syncBtn) syncBtn.disabled = false;
                return;
            }
            
            var data = doc.data();
            var players = data.players || [];
            
            for (var i = 0; i < players.length; i++) {
                var p = players[i];
                if (p.label) {
                    currentPlayers[p.label] = p.name;
                    playerNames[p.name] = p.label;
                }
            }
            
            playersLogStep(2, 'Loaded ' + Object.keys(currentPlayers).length + ' current players', 'info');
            
            playersLogStep(3, 'Scanning historyGames for label changes...', 'info');
            
            return playersDb.collection('historyGames').get();
        })
        .then(function(snapshot) {
            var labelHistory = {};
            var gameCount = 0;
            var playerLabelMap = {};
            
            snapshot.forEach(function(doc) {
                var data = doc.data();
                gameCount++;
                
                if (data.players && Array.isArray(data.players)) {
                    for (var i = 0; i < data.players.length; i++) {
                        var p = data.players[i];
                        var label = p.label;
                        var name = p.name;
                        
                        if (label && name) {
                            var key = name + '||' + label;
                            if (!playerLabelMap[name]) {
                                playerLabelMap[name] = {};
                            }
                            if (!playerLabelMap[name][label]) {
                                playerLabelMap[name][label] = 0;
                            }
                            playerLabelMap[name][label]++;
                        }
                    }
                }
            });
            
            for (var playerName in playerLabelMap) {
                var labels = Object.keys(playerLabelMap[playerName]);
                var sortedLabels = labels.sort(function(a, b) {
                    return playerLabelMap[playerName][b] - playerLabelMap[playerName][a];
                });
                
                var currentLabel = sortedLabels[0] || '';
                var firstLabel = sortedLabels[sortedLabels.length - 1] || '';
                
                if (firstLabel && currentLabel && firstLabel !== currentLabel) {
                    var currentPlayerLabel = playerNames[playerName] || currentLabel;
                    if (currentPlayerLabel === currentLabel) {
                        labelHistory[firstLabel] = currentLabel;
                    }
                }
            }
            
            var entryCount = Object.keys(labelHistory).length;
            
            playersLogStep(3, 'Scanned ' + gameCount + ' games', 'info');
            playersLogStep(3, 'Found ' + entryCount + ' label mappings', 'info');
            
            if (entryCount === 0) {
                playersLogStep(3, 'No label changes found', 'warning');
                if (badge) {
                    badge.textContent = '⚠️ No changes found';
                    badge.className = 'status-badge-large warning';
                }
                if (info) info.textContent = 'No label changes detected. Nothing to sync.';
                if (syncBtn) syncBtn.disabled = false;
                return;
            }
            
            var html = '';
            var entries = Object.entries(labelHistory);
            for (var i = 0; i < entries.length; i++) {
                var oldLabel = entries[i][0];
                var newLabel = entries[i][1];
                var playerName = currentPlayers[oldLabel] || currentPlayers[newLabel] || oldLabel;
                html += '<div class="entry"><span class="old">' + escapeHtml(oldLabel) + '</span><span class="arrow">→</span><span class="new">' + escapeHtml(newLabel) + '</span><span class="player">' + escapeHtml(playerName) + '</span></div>';
            }
            if (previewList) previewList.innerHTML = html;
            document.getElementById('labelHistoryPreview').style.display = 'block';
            
            stagedLabelHistory = {
                mappings: labelHistory,
                entryCount: entryCount
            };
            
            if (badge) {
                badge.textContent = '📋 ' + entryCount + ' mappings to write';
                badge.className = 'status-badge-large warning';
            }
            if (info) {
                info.innerHTML = '📋 <strong>' + entryCount + '</strong> mappings found. Review below and confirm to write.';
            }
            
            if (confirmSection) {
                confirmSection.style.display = 'block';
                var confirmBtn = document.getElementById('labelHistoryConfirmBtn');
                if (confirmBtn) {
                    confirmBtn.textContent = '✅ CONFIRM & UPDATE (' + entryCount + ' mappings)';
                }
            }
            
            if (syncBtn) syncBtn.disabled = false;
            
            playersLogStep(3, 'Ready to write ' + entryCount + ' mappings', 'success');
        })
        .catch(function(err) {
            playersLogStep(2, 'Error: ' + err.message, 'error');
            if (badge) {
                badge.textContent = '❌ Error';
                badge.className = 'status-badge-large missing';
            }
            if (info) info.textContent = 'Error: ' + err.message;
            if (syncBtn) syncBtn.disabled = false;
        });
}

function executeSyncLabelHistory() {
    if (!playersDb || !stagedLabelHistory) {
        playersLog("No staged data to write", "error");
        return;
    }
    
    var mappings = stagedLabelHistory.mappings || {};
    var count = stagedLabelHistory.entryCount || 0;
    
    if (count === 0) {
        playersLog("No mappings to write", "warning");
        return;
    }
    
    playersLogStep(3, '=== EXECUTING SYNC labelHistory ===', 'info');
    playersLogStep(3, 'Writing ' + count + ' mappings to playerInformation', 'info');
    
    var badge = document.getElementById('labelHistoryStatusBadge');
    var info = document.getElementById('labelHistoryStatusInfo');
    var confirmSection = document.getElementById('labelHistoryConfirmSection');
    var confirmBtn = document.getElementById('labelHistoryConfirmBtn');
    var cancelBtn = document.getElementById('labelHistoryCancelBtn');
    var syncBtn = document.getElementById('labelHistorySyncBtn');
    
    if (badge) {
        badge.textContent = '⏳ Writing...';
        badge.className = 'status-badge-large warning';
    }
    if (info) info.textContent = 'Writing to Firestore...';
    if (confirmBtn) confirmBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (syncBtn) syncBtn.disabled = true;
    
    var updateObj = {};
    for (var oldLabel in mappings) {
        var newLabel = mappings[oldLabel];
        if (oldLabel !== newLabel) {
            updateObj['labelHistory.' + oldLabel] = newLabel;
        }
    }
    updateObj.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    
    if (typeof WRV !== 'undefined' && WRV.update) {
        playersLogStep(3, 'Using WRV for update', 'info');
        WRV.update('playerInformation', 'players', updateObj, function(err, result) {
            if (err) {
                playersLogStep(3, '❌ WRV update failed: ' + err.message, 'error');
                if (badge) {
                    badge.textContent = '❌ Write failed';
                    badge.className = 'status-badge-large missing';
                }
                if (info) info.textContent = 'Error: ' + err.message;
                if (confirmBtn) confirmBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
                if (syncBtn) syncBtn.disabled = false;
                if (confirmSection) confirmSection.style.display = 'none';
                return;
            }
            
            playersLogStep(3, '✅ labelHistory update successful', 'success');
            handleSyncSuccess(count);
        });
    } else {
        playersLogStep(3, 'WRV not available, using direct update', 'warning');
        playersDb.collection('playerInformation').doc('players').update(updateObj)
            .then(function() {
                playersLogStep(3, '✅ labelHistory update successful', 'success');
                handleSyncSuccess(count);
            })
            .catch(function(err) {
                playersLogStep(3, '❌ Direct update failed: ' + err.message, 'error');
                if (badge) {
                    badge.textContent = '❌ Write failed';
                    badge.className = 'status-badge-large missing';
                }
                if (info) info.textContent = 'Error: ' + err.message;
                if (confirmBtn) confirmBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
                if (syncBtn) syncBtn.disabled = false;
                if (confirmSection) confirmSection.style.display = 'none';
            });
    }
}

function handleSyncSuccess(count) {
    var badge = document.getElementById('labelHistoryStatusBadge');
    var info = document.getElementById('labelHistoryStatusInfo');
    var confirmSection = document.getElementById('labelHistoryConfirmSection');
    var viewBtn = document.getElementById('labelHistoryViewBtn');
    var syncBtn = document.getElementById('labelHistorySyncBtn');
    
    if (badge) {
        badge.textContent = '✅ Exists (' + count + ' mappings)';
        badge.className = 'status-badge-large exists';
    }
    if (info) info.innerHTML = '📋 <strong>' + count + '</strong> mappings written successfully.';
    if (viewBtn) viewBtn.disabled = false;
    if (syncBtn) syncBtn.disabled = false;
    if (confirmSection) confirmSection.style.display = 'none';
    
    document.getElementById('labelHistoryPreview').style.display = 'none';
    stagedLabelHistory = null;
    
    playersLogStep(3, '=== SYNC labelHistory COMPLETE ===', 'success');
}

// ============================================================
// CANCEL FUNCTIONS (existing)
// ============================================================

function cancelUsedLabels() {
    var confirmSection = document.getElementById('usedLabelsConfirmSection');
    var preview = document.getElementById('usedLabelsPreview');
    
    if (confirmSection) confirmSection.style.display = 'none';
    if (preview) preview.style.display = 'none';
    
    stagedUsedLabels = null;
    
    var badge = document.getElementById('usedLabelsStatusBadge');
    var info = document.getElementById('usedLabelsStatusInfo');
    var rebuildBtn = document.getElementById('usedLabelsRebuildBtn');
    
    if (badge) {
        badge.textContent = '⏳ Loading...';
        badge.className = 'status-badge-large missing';
    }
    if (info) info.textContent = 'Loading usedLabels from Firestore...';
    if (rebuildBtn) rebuildBtn.disabled = false;
    
    loadUsedLabelsStatus();
    
    playersLog('usedLabels rebuild cancelled', 'info');
}

function cancelLabelHistory() {
    var confirmSection = document.getElementById('labelHistoryConfirmSection');
    var preview = document.getElementById('labelHistoryPreview');
    
    if (confirmSection) confirmSection.style.display = 'none';
    if (preview) preview.style.display = 'none';
    
    stagedLabelHistory = null;
    
    var badge = document.getElementById('labelHistoryStatusBadge');
    var info = document.getElementById('labelHistoryStatusInfo');
    var syncBtn = document.getElementById('labelHistorySyncBtn');
    
    if (badge) {
        badge.textContent = '⏳ Loading...';
        badge.className = 'status-badge-large missing';
    }
    if (info) info.textContent = 'Loading labelHistory from playerInformation...';
    if (syncBtn) syncBtn.disabled = false;
    
    loadLabelHistoryStatus();
    
    playersLog('labelHistory sync cancelled', 'info');
}

// ============================================================
// v1.02: PLAYER EDITOR FUNCTIONS (FIXED WRV)
// ============================================================

function loadPlayerEditorDropdown() {
    if (!playersDb) {
        playersLog("Select environment first", "error");
        return;
    }
    
    var select = document.getElementById('playerEditorSelect');
    if (!select) return;
    
    // Preserve selected value if any
    var currentValue = select.value;
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    playersLog('Loading player list for editor...', 'info');
    
    playersDb.collection('playerInformation').doc('players').get()
        .then(function(doc) {
            if (!doc.exists) {
                select.innerHTML = '<option value="">-- No players found --</option>';
                select.disabled = false;
                playersLog('playerInformation document not found', 'warning');
                return;
            }
            
            var data = doc.data();
            var players = data.players || [];
            
            if (players.length === 0) {
                select.innerHTML = '<option value="">-- No players found --</option>';
                select.disabled = false;
                playersLog('No players found', 'warning');
                return;
            }
            
            // Sort players by name
            players.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });
            
            // Build dropdown
            var html = '<option value="">-- Select a player --</option>';
            for (var i = 0; i < players.length; i++) {
                var p = players[i];
                var label = p.label || '?';
                var hcp = p.handicap || 0;
                var selected = (currentValue === p.name) ? ' selected' : '';
                html += '<option value="' + escapeHtml(p.name) + '"' + selected + '>' + escapeHtml(p.name) + ' (' + escapeHtml(label) + ', HCP ' + hcp + ')</option>';
            }
            
            select.innerHTML = html;
            select.disabled = false;
            
            playersLog('Loaded ' + players.length + ' players for editor', 'success');
            
            // If there was a selected value, load it
            if (currentValue && currentValue !== '') {
                loadPlayerForEdit();
            }
        })
        .catch(function(err) {
            playersLog('Error loading players: ' + err.message, 'error');
            select.innerHTML = '<option value="">-- Error loading players --</option>';
            select.disabled = false;
        });
}

function loadPlayerForEdit() {
    var select = document.getElementById('playerEditorSelect');
    var form = document.getElementById('editorForm');
    var emptyState = document.getElementById('editorEmptyState');
    var statusBadge = document.getElementById('editorStatusBadge');
    var saveBtn = document.getElementById('editorSaveBtn');
    var resetBtn = document.getElementById('editorResetBtn');
    
    if (!select) return;
    
    var selectedName = select.value;
    
    if (!selectedName || selectedName === '') {
        form.style.display = 'none';
        emptyState.style.display = 'block';
        if (statusBadge) {
            statusBadge.textContent = '⏳ No player selected';
            statusBadge.className = 'status-badge-large warning';
        }
        if (saveBtn) saveBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
        editorCurrentPlayer = null;
        editorCurrentIndex = -1;
        editorOriginalData = null;
        return;
    }
    
    // Load the player data
    playersDb.collection('playerInformation').doc('players').get()
        .then(function(doc) {
            if (!doc.exists) {
                playersLog('playerInformation not found', 'error');
                return;
            }
            
            var data = doc.data();
            var players = data.players || [];
            var playerIndex = -1;
            var player = null;
            
            for (var i = 0; i < players.length; i++) {
                if (players[i].name === selectedName) {
                    playerIndex = i;
                    player = players[i];
                    break;
                }
            }
            
            if (!player) {
                playersLog('Player not found: ' + selectedName, 'error');
                return;
            }
            
            // Store current player
            editorCurrentPlayer = player;
            editorCurrentIndex = playerIndex;
            editorOriginalData = JSON.parse(JSON.stringify(player));
            
            // Populate form
            document.getElementById('editorName').value = player.name || '';
            document.getElementById('editorLabel').value = player.label || '';
            document.getElementById('editorHandicap').value = player.handicap || 0;
            document.getElementById('editorTeam').value = player.defaultTeam || 'A';
            document.getElementById('editorFlight').value = player.flight !== undefined && player.flight !== null ? player.flight : '';
            document.getElementById('editorIsDefault').value = player.isDefault === true ? 'true' : 'false';
            document.getElementById('editorLastLabelChange').value = player.lastLabelChange || '';
            
            // Show form
            form.style.display = 'block';
            emptyState.style.display = 'none';
            
            if (statusBadge) {
                statusBadge.textContent = '✅ Editing: ' + player.name;
                statusBadge.className = 'status-badge-large exists';
            }
            
            if (saveBtn) saveBtn.disabled = false;
            if (resetBtn) resetBtn.disabled = false;
            
            // Clear status
            hideEditorStatus();
            
            playersLog('Loaded player for editing: ' + player.name, 'success');
        })
        .catch(function(err) {
            playersLog('Error loading player: ' + err.message, 'error');
            if (statusBadge) {
                statusBadge.textContent = '❌ Error loading';
                statusBadge.className = 'status-badge-large missing';
            }
        });
}

function validatePlayerForm() {
    var name = document.getElementById('editorName').value.trim();
    var label = document.getElementById('editorLabel').value.trim().toUpperCase();
    var handicap = parseInt(document.getElementById('editorHandicap').value);
    var team = document.getElementById('editorTeam').value;
    var flight = document.getElementById('editorFlight').value;
    var isDefault = document.getElementById('editorIsDefault').value === 'true';
    var lastLabelChange = document.getElementById('editorLastLabelChange').value.trim();
    
    var errors = [];
    var warnings = [];
    
    // Validate name
    if (!name || name === '') {
        errors.push('Name is required');
        document.getElementById('editorName').classList.add('editor-error');
    } else {
        document.getElementById('editorName').classList.remove('editor-error');
    }
    
    // Validate label
    if (!label || label === '') {
        errors.push('Label is required');
        document.getElementById('editorLabel').classList.add('editor-error');
    } else if (label.length > 3) {
        errors.push('Label must be 3 characters or less');
        document.getElementById('editorLabel').classList.add('editor-error');
    } else {
        document.getElementById('editorLabel').classList.remove('editor-error');
    }
    
    // Validate handicap
    if (isNaN(handicap) || handicap < 0 || handicap > 54) {
        errors.push('Handicap must be between 0 and 54');
        document.getElementById('editorHandicap').classList.add('editor-error');
    } else {
        document.getElementById('editorHandicap').classList.remove('editor-error');
    }
    
    // Validate team
    if (team !== 'A' && team !== 'B') {
        errors.push('Team must be A or B');
    }
    
    // Validate flight (optional)
    if (flight !== '' && flight !== '1' && flight !== '2') {
        errors.push('Flight must be 1, 2, or empty');
    }
    
    // Validate lastLabelChange format (if provided)
    if (lastLabelChange && lastLabelChange !== '') {
        var date = new Date(lastLabelChange);
        if (isNaN(date.getTime())) {
            warnings.push('lastLabelChange format may be invalid. Expected ISO format (e.g., 2026-07-02T06:45:07.220Z)');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        data: {
            name: name,
            label: label,
            handicap: handicap,
            defaultTeam: team,
            flight: flight === '' ? null : parseInt(flight),
            isDefault: isDefault,
            lastLabelChange: lastLabelChange || null
        }
    };
}

function buildUpdateObject(original, updated) {
    var changes = {};
    var changeLog = [];
    
    // Compare each field
    if (original.name !== updated.name) {
        changes.name = updated.name;
        changeLog.push('name: "' + original.name + '" → "' + updated.name + '"');
    }
    if (original.label !== updated.label) {
        changes.label = updated.label;
        changeLog.push('label: "' + original.label + '" → "' + updated.label + '"');
    }
    if (original.handicap !== updated.handicap) {
        changes.handicap = updated.handicap;
        changeLog.push('handicap: ' + original.handicap + ' → ' + updated.handicap);
    }
    if (original.defaultTeam !== updated.defaultTeam) {
        changes.defaultTeam = updated.defaultTeam;
        changeLog.push('team: "' + original.defaultTeam + '" → "' + updated.defaultTeam + '"');
    }
    if (original.flight !== updated.flight) {
        changes.flight = updated.flight;
        changeLog.push('flight: ' + (original.flight || 'null') + ' → ' + (updated.flight || 'null'));
    }
    if (original.isDefault !== updated.isDefault) {
        changes.isDefault = updated.isDefault;
        changeLog.push('isDefault: ' + original.isDefault + ' → ' + updated.isDefault);
    }
    if (original.lastLabelChange !== updated.lastLabelChange) {
        changes.lastLabelChange = updated.lastLabelChange;
        changeLog.push('lastLabelChange: "' + (original.lastLabelChange || 'null') + '" → "' + (updated.lastLabelChange || 'null') + '"');
    }
    
    return {
        changes: changes,
        changeLog: changeLog,
        hasChanges: changeLog.length > 0
    };
}

// ============================================================
// v1.02: savePlayerEdit - FIXED using WRV.write() with merge
// ============================================================

function savePlayerEdit() {
    var saveBtn = document.getElementById('editorSaveBtn');
    var resetBtn = document.getElementById('editorResetBtn');
    var statusDiv = document.getElementById('editorStatus');
    
    if (!editorCurrentPlayer || editorCurrentIndex < 0) {
        showEditorStatus('No player selected to save', 'error');
        return;
    }
    
    // Validate form
    var validation = validatePlayerForm();
    
    if (!validation.valid) {
        showEditorStatus('Validation failed:\n• ' + validation.errors.join('\n• '), 'error');
        return;
    }
    
    // Show warnings if any
    if (validation.warnings.length > 0) {
        showEditorStatus('⚠️ Warnings:\n• ' + validation.warnings.join('\n• '), 'info');
        // Continue with save - warnings don't block
    }
    
    // Build update object
    var updateResult = buildUpdateObject(editorOriginalData, validation.data);
    
    if (!updateResult.hasChanges) {
        showEditorStatus('No changes detected. Nothing to save.', 'info');
        return;
    }
    
    // Show changes and confirm
    var confirmMsg = 'The following changes will be saved:\n\n';
    for (var i = 0; i < updateResult.changeLog.length; i++) {
        confirmMsg += '• ' + updateResult.changeLog[i] + '\n';
    }
    confirmMsg += '\nProceed with save?';
    
    if (!confirm(confirmMsg)) {
        playersLog('Save cancelled by user', 'info');
        return;
    }
    
    // Disable buttons during save
    if (saveBtn) saveBtn.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    
    playersLogStep(1, '=== SAVING PLAYER EDIT ===', 'info');
    playersLogStep(1, 'Player: ' + editorCurrentPlayer.name, 'info');
    playersLogStep(1, 'Changes: ' + updateResult.changeLog.length + ' field(s)', 'info');
    
    // v1.02: Build the updated player object
    var updatedPlayer = JSON.parse(JSON.stringify(editorOriginalData));
    for (var key in updateResult.changes) {
        updatedPlayer[key] = updateResult.changes[key];
    }
    
    // v1.02: Use nested path with WRV.write() and merge
    var payload = {};
    payload['players.' + editorCurrentIndex] = updatedPlayer;
    
    // Also update document-level updatedAt
    var fullPayload = {
        players: null, // This will be merged
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    fullPayload['players.' + editorCurrentIndex] = updatedPlayer;
    
    playersLogStep(2, 'Writing to Firestore using WRV.write() with merge...', 'info');
    
    // v1.02: Use WRV.write() with merge instead of WRV.update()
    if (typeof WRV !== 'undefined' && WRV.write) {
        WRV.write('playerInformation', 'players', fullPayload, true, function(err, result) {
            if (err) {
                playersLogStep(2, '❌ WRV write failed: ' + err.message, 'error');
                showEditorStatus('❌ Save failed: ' + err.message, 'error');
                if (saveBtn) saveBtn.disabled = false;
                if (resetBtn) resetBtn.disabled = false;
                return;
            }
            
            playersLogStep(2, '✅ Player updated successfully', 'success');
            
            // Log each change
            for (var i = 0; i < updateResult.changeLog.length; i++) {
                playersLogStep(2, '  • ' + updateResult.changeLog[i], 'info');
            }
            
            // Update original data to reflect saved state
            editorOriginalData = JSON.parse(JSON.stringify(updatedPlayer));
            showEditorStatus('✅ Player saved successfully!\n' + updateResult.changeLog.length + ' field(s) updated.', 'success');
            
            if (saveBtn) saveBtn.disabled = false;
            if (resetBtn) resetBtn.disabled = false;
            
            // Reload status for other cards
            loadPlayersStatus();
            playersLogStep(2, '=== SAVE COMPLETE ===', 'success');
        });
    } else {
        // Fallback: direct update
        playersLogStep(2, 'WRV not available, using direct update', 'warning');
        playersDb.collection('playerInformation').doc('players').update(fullPayload)
            .then(function() {
                playersLogStep(2, '✅ Player updated successfully (direct)', 'success');
                
                for (var i = 0; i < updateResult.changeLog.length; i++) {
                    playersLogStep(2, '  • ' + updateResult.changeLog[i], 'info');
                }
                
                editorOriginalData = JSON.parse(JSON.stringify(updatedPlayer));
                showEditorStatus('✅ Player saved successfully!\n' + updateResult.changeLog.length + ' field(s) updated.', 'success');
                
                if (saveBtn) saveBtn.disabled = false;
                if (resetBtn) resetBtn.disabled = false;
                
                loadPlayersStatus();
                playersLogStep(2, '=== SAVE COMPLETE ===', 'success');
            })
            .catch(function(err) {
                playersLogStep(2, '❌ Direct update failed: ' + err.message, 'error');
                showEditorStatus('❌ Save failed: ' + err.message, 'error');
                if (saveBtn) saveBtn.disabled = false;
                if (resetBtn) resetBtn.disabled = false;
            });
    }
}

function resetPlayerEdit() {
    if (!editorOriginalData) {
        playersLog('No original data to reset to', 'warning');
        return;
    }
    
    // Confirm reset
    if (!confirm('Reset all fields to the original saved values?')) {
        return;
    }
    
    // Reset form fields
    document.getElementById('editorName').value = editorOriginalData.name || '';
    document.getElementById('editorLabel').value = editorOriginalData.label || '';
    document.getElementById('editorHandicap').value = editorOriginalData.handicap || 0;
    document.getElementById('editorTeam').value = editorOriginalData.defaultTeam || 'A';
    document.getElementById('editorFlight').value = editorOriginalData.flight !== undefined && editorOriginalData.flight !== null ? editorOriginalData.flight : '';
    document.getElementById('editorIsDefault').value = editorOriginalData.isDefault === true ? 'true' : 'false';
    document.getElementById('editorLastLabelChange').value = editorOriginalData.lastLabelChange || '';
    
    // Clear any error states
    document.querySelectorAll('.editor-error').forEach(function(el) {
        el.classList.remove('editor-error');
    });
    
    hideEditorStatus();
    
    playersLog('Form reset to original values', 'info');
}

function showEditorStatus(message, type) {
    var statusDiv = document.getElementById('editorStatus');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = 'editor-status ' + type;
    statusDiv.style.display = 'block';
}

function hideEditorStatus() {
    var statusDiv = document.getElementById('editorStatus');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'none';
    statusDiv.className = 'editor-status';
}

// ============================================================
// INFO GUIDE (existing)
// ============================================================

function showPlayersInfoGuide() {
    var existing = document.querySelector('.info-overlay');
    if (existing) existing.remove();
    
    var overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.innerHTML = `
        <div class="info-card" style="border-color: #8b5cf6;">
            <div class="info-header">
                <div class="info-title" style="color: #8b5cf6;">👤 PLAYERS TAB - Information & Guide</div>
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✕ CLOSE</button>
            </div>
            
            <div class="info-section">
                <div class="info-section-title">🎯 What This Tab Does</div>
                <div class="info-text">
                    The <strong>PLAYERS</strong> tab manages player data and label integrity across the system.
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">✏️ Player Editor - What It Does</div>
                <div class="info-text">
                    Allows admin to directly edit any player's data in the <code>playerInformation/players</code> document.
                    <br><br>
                    <strong>Editable fields:</strong>
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li><strong>Name:</strong> Player's full name</li>
                        <li><strong>Label:</strong> 1-3 character identifier (uppercase)</li>
                        <li><strong>Handicap:</strong> 0-54</li>
                        <li><strong>Team:</strong> A or B</li>
                        <li><strong>Flight:</strong> 1, 2, or empty (optional)</li>
                        <li><strong>Default:</strong> Yes/No (auto-populates in Setup Game)</li>
                        <li><strong>lastLabelChange:</strong> ISO timestamp (admin editable)</li>
                    </ul>
                    <br>
                    <strong>All changes use WRV for verification.</strong>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">🏷️ usedLabels - What It Is</div>
                <div class="info-text">
                    <strong>usedLabels</strong> is an index that tracks which labels have EVER appeared in a completed game.
                    <br><br>
                    <strong>Why it matters:</strong> This prevents label reuse. Once a label appears in a completed game, it's locked forever.
                    <br><br>
                    <strong>How to use:</strong>
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>Click <span class="highlight">"View Labels"</span> to see all labels in the index</li>
                        <li>Click <span class="highlight">"Rebuild from History"</span> to scan all completed games and rebuild the index</li>
                        <li>Review the preview, then <span class="highlight">"CONFIRM & UPDATE"</span> to write to Firestore</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📜 labelHistory - What It Is</div>
                <div class="info-text">
                    <strong>labelHistory</strong> tracks label changes over time. It maps old labels → new labels.
                    <br><br>
                    <strong>Why it matters:</strong> When viewing old history records, this shows which label a player is now using.
                    <br><br>
                    <strong>How to use:</strong>
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>Click <span class="highlight">"View Mappings"</span> to see all label changes</li>
                        <li>Click <span class="highlight">"Sync from Players"</span> to scan players and history for changes</li>
                        <li>Review the preview, then <span class="highlight">"CONFIRM & UPDATE"</span> to write to Firestore</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>Player Editor:</strong> Changes are immediate. Always double-check before saving.</li>
                    <li><strong>usedLabels Rebuild:</strong> This REPLACES the entire usedLabels document.</li>
                    <li><strong>labelHistory Sync:</strong> This MERGES mappings. Existing mappings are preserved, new ones are added.</li>
                    <li><strong>WRV Protection:</strong> All writes use WRV for verification and retry.</li>
                    <li><strong>PROD/DEV:</strong> Always double-check which environment you're working on before confirming.</li>
                </ul>
            </div>
            
            <div style="text-align:center; margin-top:20px;">
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✓ OK, I understand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ============================================================
// INIT
// ============================================================

function initPlayersTab() {
    playersLog('Initializing PLAYERS tab...', 'info');
    
    // Environment buttons
    var prodBtn = document.getElementById('playersProdBtn');
    var devBtn = document.getElementById('playersDevBtn');
    
    if (prodBtn) {
        prodBtn.addEventListener('click', function() {
            setPlayersEnvironment('PROD');
        });
    }
    if (devBtn) {
        devBtn.addEventListener('click', function() {
            setPlayersEnvironment('DEV');
        });
    }
    
    // Player Editor - Dropdown change
    var editorSelect = document.getElementById('playerEditorSelect');
    if (editorSelect) {
        editorSelect.addEventListener('change', function() {
            loadPlayerForEdit();
        });
    }
    
    // Player Editor - Save button
    var saveBtn = document.getElementById('editorSaveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            savePlayerEdit();
        });
    }
    
    // Player Editor - Reset button
    var resetBtn = document.getElementById('editorResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            resetPlayerEdit();
        });
    }
    
    // usedLabels buttons
    var viewUsedBtn = document.getElementById('usedLabelsViewBtn');
    var rebuildBtn = document.getElementById('usedLabelsRebuildBtn');
    var confirmBtn = document.getElementById('usedLabelsConfirmBtn');
    var cancelBtn = document.getElementById('usedLabelsCancelBtn');
    
    if (viewUsedBtn) {
        viewUsedBtn.addEventListener('click', function() {
            viewUsedLabels();
        });
    }
    if (rebuildBtn) {
        rebuildBtn.addEventListener('click', function() {
            rebuildUsedLabels();
        });
    }
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            executeRebuildUsedLabels();
        });
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            cancelUsedLabels();
        });
    }
    
    // labelHistory buttons
    var viewHistoryBtn = document.getElementById('labelHistoryViewBtn');
    var syncBtn = document.getElementById('labelHistorySyncBtn');
    var confirmHistoryBtn = document.getElementById('labelHistoryConfirmBtn');
    var cancelHistoryBtn = document.getElementById('labelHistoryCancelBtn');
    
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', function() {
            viewLabelHistory();
        });
    }
    if (syncBtn) {
        syncBtn.addEventListener('click', function() {
            syncLabelHistory();
        });
    }
    if (confirmHistoryBtn) {
        confirmHistoryBtn.addEventListener('click', function() {
            executeSyncLabelHistory();
        });
    }
    if (cancelHistoryBtn) {
        cancelHistoryBtn.addEventListener('click', function() {
            cancelLabelHistory();
        });
    }
    
    playersLog('✅ PLAYERS tab initialized', 'success');
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.setPlayersEnvironment = setPlayersEnvironment;
window.loadPlayersStatus = loadPlayersStatus;
window.loadUsedLabelsStatus = loadUsedLabelsStatus;
window.loadLabelHistoryStatus = loadLabelHistoryStatus;
window.rebuildUsedLabels = rebuildUsedLabels;
window.executeRebuildUsedLabels = executeRebuildUsedLabels;
window.syncLabelHistory = syncLabelHistory;
window.executeSyncLabelHistory = executeSyncLabelHistory;
window.viewUsedLabels = viewUsedLabels;
window.viewLabelHistory = viewLabelHistory;
window.cancelUsedLabels = cancelUsedLabels;
window.cancelLabelHistory = cancelLabelHistory;
window.showPlayersInfoGuide = showPlayersInfoGuide;
window.initPlayersTab = initPlayersTab;

// v1.01: Player Editor exports
window.loadPlayerEditorDropdown = loadPlayerEditorDropdown;
window.loadPlayerForEdit = loadPlayerForEdit;
window.savePlayerEdit = savePlayerEdit;
window.resetPlayerEdit = resetPlayerEdit;
window.validatePlayerForm = validatePlayerForm;
window.buildUpdateObject = buildUpdateObject;

// v1.02: Updated version
window.UTIL_PLAYERS_VERSION = "1.02";

console.log("[UTIL-PLAYERS] v1.02 loaded - Fixed WRV write with merge");

/*
FILE: js/util-players.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - FIXED: savePlayerEdit() now uses WRV.write() with merge instead of WRV.update()
   - FIXED: WRV verification now works correctly with nested path writes
   - CHANGED: Updated player object is written as a full object at the nested path
   - PRESERVED: All existing functionality from v1.01
DEPENDS ON: util-core.js, wrv.js
STATUS: Ready for integration
*/