/*
FILE: js/util-compare-record.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - REMOVED: Dependency on HTML for initFirebase, log, logStep, escapeHtml
   - CHANGED: Now uses window.log and window.escapeHtml from util-core.js
   - CHANGED: Now uses window.prodDb and window.devDb from util-core.js
   - ADDED: Fallback logging and escaping functions if util-core.js not loaded
   - ADDED: Explicit state variables leftData, rightData, leftId, rightId
   - PRESERVED: All existing functionality from v1.03
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_COMPARE_VERSION = "1.04";
console.log("[UTIL-COMPARE] Initializing v1.04");

// ============================================================
// FALLBACK HELPERS (if util-core.js not loaded)
// ============================================================

function compareLog(message, type) {
    if (typeof window.log === 'function') {
        window.log(message, type);
    } else {
        console.log('[COMPARE-UTIL] ' + message);
    }
}

function compareEscapeHtml(str) {
    if (typeof window.escapeHtml === 'function') {
        return window.escapeHtml(str);
    }
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================================
// SHARED STATE
// ============================================================
// prodDb, devDb are from util-core.js
// compareLeftDb, compareRightDb: Firestore instances
// compareLeftEnv, compareRightEnv: 'PROD' or 'DEV'
// leftData, rightData: Loaded record data
// leftId, rightId: Record IDs
// ============================================================

var compareLeftDb = null;
var compareRightDb = null;
var compareLeftEnv = null;
var compareRightEnv = null;
var leftData = null;
var rightData = null;
var leftId = null;
var rightId = null;

// ============================================================
// COMPARE TAB: ENVIRONMENT FUNCTIONS
// ============================================================

function setCompareLeftEnvironment(env) {
    if (env === 'PROD') {
        if (!window.prodDb) {
            compareLog("Cannot connect to PRODUCTION for Left", "error");
            return;
        }
        compareLeftDb = window.prodDb;
        compareLeftEnv = 'PROD';
        updateCompareLeftUI('PROD');
        compareLog('Left environment set to: PRODUCTION', 'info');
    } else if (env === 'DEV') {
        if (!window.devDb) {
            compareLog("Cannot connect to DEVELOPMENT for Left", "error");
            return;
        }
        compareLeftDb = window.devDb;
        compareLeftEnv = 'DEV';
        updateCompareLeftUI('DEV');
        compareLog('Left environment set to: DEVELOPMENT', 'info');
    } else {
        compareLeftDb = null;
        compareLeftEnv = null;
        updateCompareLeftUI(null);
    }
    
    // Load left records if database is set
    if (compareLeftDb) {
        loadCompareRecordsLeft();
    }
}

function setCompareRightEnvironment(env) {
    if (env === 'PROD') {
        if (!window.prodDb) {
            compareLog("Cannot connect to PRODUCTION for Right", "error");
            return;
        }
        compareRightDb = window.prodDb;
        compareRightEnv = 'PROD';
        updateCompareRightUI('PROD');
        compareLog('Right environment set to: PRODUCTION', 'info');
    } else if (env === 'DEV') {
        if (!window.devDb) {
            compareLog("Cannot connect to DEVELOPMENT for Right", "error");
            return;
        }
        compareRightDb = window.devDb;
        compareRightEnv = 'DEV';
        updateCompareRightUI('DEV');
        compareLog('Right environment set to: DEVELOPMENT', 'info');
    } else {
        compareRightDb = null;
        compareRightEnv = null;
        updateCompareRightUI(null);
    }
    
    // Load right records if database is set
    if (compareRightDb) {
        loadCompareRecordsRight();
    }
}

function updateCompareLeftUI(env) {
    var prodBtn = document.getElementById('compareLeftProdBtn');
    var devBtn = document.getElementById('compareLeftDevBtn');
    var indicator = document.getElementById('compareLeftIndicator');
    
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

function updateCompareRightUI(env) {
    var prodBtn = document.getElementById('compareRightProdBtn');
    var devBtn = document.getElementById('compareRightDevBtn');
    var indicator = document.getElementById('compareRightIndicator');
    
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
// COMPARE TAB: LOAD RECORDS (INDEPENDENT SIDES)
// ============================================================

function loadCompareRecords() {
    // Load LEFT records
    if (compareLeftDb) {
        loadCompareRecordsLeft();
    } else {
        compareLog("Select Left environment first", "error");
    }
    
    // Load RIGHT records
    if (compareRightDb) {
        loadCompareRecordsRight();
    } else {
        compareLog("Select Right environment first", "error");
    }
}

function loadCompareRecordsLeft() {
    if (!compareLeftDb) {
        compareLog("Select Left environment first", "error");
        return;
    }
    
    var collection = document.getElementById('compareLeftCollection').value;
    var select = document.getElementById('compareLeftRecord');
    var currentValue = select.value;
    var envLabel = compareLeftEnv || 'Unknown';
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    compareLog('Loading Left records from: ' + collection + ' (' + envLabel + ')', 'info');
    
    compareLeftDb.collection(collection)
        .orderBy('date', 'desc')
        .limit(100)
        .get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select left record --</option>';
            select.disabled = false;
            
            if (!snapshot.empty) {
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    var option = document.createElement('option');
                    option.value = doc.id;
                    var displayDate = data.date || 'No date';
                    var courseName = data.course ? data.course.name : 'Unknown';
                    option.textContent = doc.id + ' | ' + displayDate + ' | ' + courseName;
                    select.appendChild(option);
                });
            }
            
            // Restore selection if it still exists
            if (currentValue) {
                var options = select.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i].value === currentValue) {
                        select.value = currentValue;
                        break;
                    }
                }
            }
            
            if (select.value) {
                loadCompareRecordData('left');
            } else {
                leftData = null;
                leftId = null;
                var infoDiv = document.getElementById('compareLeftInfo');
                if (infoDiv) infoDiv.style.display = 'none';
            }
            
            compareLog('Loaded ' + snapshot.size + ' Left records from ' + collection + ' (' + envLabel + ')', 'success');
        })
        .catch(function(err) {
            select.innerHTML = '<option value="">-- Error loading --</option>';
            select.disabled = false;
            compareLog('Error loading Left records: ' + err.message, 'error');
        });
}

function loadCompareRecordsRight() {
    if (!compareRightDb) {
        compareLog("Select Right environment first", "error");
        return;
    }
    
    var collection = document.getElementById('compareRightCollection').value;
    var select = document.getElementById('compareRightRecord');
    var currentValue = select.value;
    var envLabel = compareRightEnv || 'Unknown';
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    compareLog('Loading Right records from: ' + collection + ' (' + envLabel + ')', 'info');
    
    compareRightDb.collection(collection)
        .orderBy('date', 'desc')
        .limit(100)
        .get()
        .then(function(snapshot) {
            select.innerHTML = '<option value="">-- Select right record --</option>';
            select.disabled = false;
            
            if (!snapshot.empty) {
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    var option = document.createElement('option');
                    option.value = doc.id;
                    var displayDate = data.date || 'No date';
                    var courseName = data.course ? data.course.name : 'Unknown';
                    option.textContent = doc.id + ' | ' + displayDate + ' | ' + courseName;
                    select.appendChild(option);
                });
            }
            
            // Restore selection if it still exists
            if (currentValue) {
                var options = select.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i].value === currentValue) {
                        select.value = currentValue;
                        break;
                    }
                }
            }
            
            if (select.value) {
                loadCompareRecordData('right');
            } else {
                rightData = null;
                rightId = null;
                var infoDiv = document.getElementById('compareRightInfo');
                if (infoDiv) infoDiv.style.display = 'none';
            }
            
            compareLog('Loaded ' + snapshot.size + ' Right records from ' + collection + ' (' + envLabel + ')', 'success');
        })
        .catch(function(err) {
            select.innerHTML = '<option value="">-- Error loading --</option>';
            select.disabled = false;
            compareLog('Error loading Right records: ' + err.message, 'error');
        });
}

// ============================================================
// COMPARE TAB: LOAD INDIVIDUAL RECORD DATA
// ============================================================

function loadCompareRecordData(side) {
    var db = side === 'left' ? compareLeftDb : compareRightDb;
    var env = side === 'left' ? compareLeftEnv : compareRightEnv;
    
    if (!db) {
        compareLog("Select " + (side === 'left' ? 'Left' : 'Right') + " environment first", "error");
        return;
    }
    
    var collectionId = side === 'left' ? 'compareLeftCollection' : 'compareRightCollection';
    var selectId = side === 'left' ? 'compareLeftRecord' : 'compareRightRecord';
    var infoId = side === 'left' ? 'compareLeftInfo' : 'compareRightInfo';
    
    var collection = document.getElementById(collectionId).value;
    var recordId = document.getElementById(selectId).value;
    var envLabel = env || 'Unknown';
    
    if (!recordId) {
        var infoDiv = document.getElementById(infoId);
        if (infoDiv) infoDiv.style.display = 'none';
        if (side === 'left') { leftData = null; leftId = null; }
        else { rightData = null; rightId = null; }
        var resultsDiv = document.getElementById('compareResults');
        if (resultsDiv) resultsDiv.style.display = 'none';
        return;
    }
    
    compareLog('Loading ' + side + ' record: ' + recordId + ' from ' + collection + ' (' + envLabel + ')', 'info');
    
    db.collection(collection).doc(recordId).get()
        .then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                if (side === 'left') {
                    leftData = data;
                    leftId = recordId;
                } else {
                    rightData = data;
                    rightId = recordId;
                }
                
                var infoDiv = document.getElementById(infoId);
                if (!infoDiv) return;
                
                var courseName = data.course ? data.course.name : 'Unknown';
                var playerCount = data.players ? data.players.length : 0;
                var envIcon = env === 'PROD' ? '🔴' : (env === 'DEV' ? '🟡' : '⚪');
                
                infoDiv.innerHTML = `
                    <div class="game-info" style="margin:0;">
                        <div class="game-info-row">
                            <span class="game-info-label">Environment:</span>
                            <span class="game-info-value">${envIcon} ${envLabel}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">ID:</span>
                            <span class="game-info-value gold" style="word-break:break-all;">${compareEscapeHtml(recordId)}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Date:</span>
                            <span class="game-info-value">${compareEscapeHtml(data.date || 'Unknown')}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Course:</span>
                            <span class="game-info-value">${compareEscapeHtml(courseName)}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Players:</span>
                            <span class="game-info-value">${playerCount}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Status:</span>
                            <span class="game-info-value">${compareEscapeHtml(data.status || 'unknown')}</span>
                        </div>
                    </div>
                `;
                infoDiv.style.display = 'block';
                
                compareLog('Loaded ' + side + ' record: ' + recordId, 'success');
            } else {
                var infoDiv = document.getElementById(infoId);
                if (infoDiv) infoDiv.style.display = 'none';
                if (side === 'left') { leftData = null; leftId = null; }
                else { rightData = null; rightId = null; }
                var resultsDiv = document.getElementById('compareResults');
                if (resultsDiv) resultsDiv.style.display = 'none';
                compareLog('Record not found: ' + recordId, 'error');
            }
        })
        .catch(function(err) {
            var infoDiv = document.getElementById(infoId);
            if (infoDiv) infoDiv.style.display = 'none';
            if (side === 'left') { leftData = null; leftId = null; }
            else { rightData = null; rightId = null; }
            var resultsDiv = document.getElementById('compareResults');
            if (resultsDiv) resultsDiv.style.display = 'none';
            compareLog('Error loading ' + side + ' record: ' + err.message, 'error');
        });
}

// ============================================================
// COMPARE TAB: PERFORM COMPARISON
// ============================================================

function performCompare() {
    if (!compareLeftDb) {
        compareLog("Select Left environment first", "error");
        return;
    }
    
    if (!compareRightDb) {
        compareLog("Select Right environment first", "error");
        return;
    }
    
    if (!leftData || !leftId) {
        compareLog("Load a left record first", "error");
        return;
    }
    
    if (!rightData || !rightId) {
        compareLog("Load a right record first", "error");
        return;
    }
    
    var leftEnv = compareLeftEnv || 'Unknown';
    var rightEnv = compareRightEnv || 'Unknown';
    
    compareLog('=== START COMPARISON ===', 'info');
    compareLog('Left: ' + leftId + ' (' + leftEnv + ')', 'info');
    compareLog('Right: ' + rightId + ' (' + rightEnv + ')', 'info');
    compareLog('Comparing across: ' + leftEnv + ' ↔ ' + rightEnv, 'info');
    
    var results = compareObjects(leftData, rightData);
    displayCompareResults(results);
    
    compareLog('=== COMPARISON COMPLETE ===', 'success');
}

// ============================================================
// COMPARE OBJECTS (Deep comparison)
// ============================================================

function compareObjects(obj1, obj2, path) {
    path = path || '';
    var diffs = [];
    var matches = [];
    var allKeys = new Set();
    
    if (obj1 && typeof obj1 === 'object' && obj1 !== null) {
        Object.keys(obj1).forEach(function(k) { allKeys.add(k); });
    }
    if (obj2 && typeof obj2 === 'object' && obj2 !== null) {
        Object.keys(obj2).forEach(function(k) { allKeys.add(k); });
    }
    
    var keys = Array.from(allKeys).sort();
    
    keys.forEach(function(key) {
        var currentPath = path ? path + '.' + key : key;
        var val1 = (obj1 && typeof obj1 === 'object' && obj1 !== null) ? obj1[key] : undefined;
        var val2 = (obj2 && typeof obj2 === 'object' && obj2 !== null) ? obj2[key] : undefined;
        
        if (val1 === undefined && val2 !== undefined) {
            diffs.push({
                path: currentPath,
                left: 'undefined',
                right: String(val2),
                reason: 'Missing in left'
            });
            return;
        }
        if (val2 === undefined && val1 !== undefined) {
            diffs.push({
                path: currentPath,
                left: String(val1),
                right: 'undefined',
                reason: 'Missing in right'
            });
            return;
        }
        
        if (val1 === undefined && val2 === undefined) {
            matches.push({
                path: currentPath,
                value: 'undefined',
                reason: 'Both undefined'
            });
            return;
        }
        
        if (val1 !== null && val2 !== null && 
            typeof val1 === 'object' && typeof val2 === 'object' &&
            !Array.isArray(val1) && !Array.isArray(val2)) {
            
            var nested = compareObjects(val1, val2, currentPath);
            diffs = diffs.concat(nested.diffs);
            matches = matches.concat(nested.matches);
            return;
        }
        
        if (Array.isArray(val1) && Array.isArray(val2)) {
            if (val1.length !== val2.length) {
                diffs.push({
                    path: currentPath,
                    left: 'Array length ' + val1.length,
                    right: 'Array length ' + val2.length,
                    reason: 'Array length mismatch'
                });
            } else {
                var arrayMatch = true;
                for (var i = 0; i < val1.length; i++) {
                    if (val1[i] !== val2[i]) {
                        arrayMatch = false;
                        break;
                    }
                }
                if (arrayMatch) {
                    matches.push({
                        path: currentPath,
                        value: 'Array length ' + val1.length + ' (all elements match)',
                        reason: 'Array match'
                    });
                } else {
                    var nestedArray = compareObjects(val1, val2, currentPath);
                    diffs = diffs.concat(nestedArray.diffs);
                    matches = matches.concat(nestedArray.matches);
                }
            }
            return;
        }
        
        if (val1 === val2) {
            matches.push({
                path: currentPath,
                value: String(val1 !== undefined && val1 !== null ? val1 : 'null'),
                reason: 'Match'
            });
        } else {
            diffs.push({
                path: currentPath,
                left: String(val1 !== undefined && val1 !== null ? val1 : 'null'),
                right: String(val2 !== undefined && val2 !== null ? val2 : 'null'),
                reason: 'Value mismatch'
            });
        }
    });
    
    return { diffs: diffs, matches: matches };
}

// ============================================================
// DISPLAY COMPARE RESULTS
// ============================================================

function displayCompareResults(results) {
    var diffCount = results.diffs.length;
    var matchCount = results.matches.length;
    var totalCount = diffCount + matchCount;
    
    var resultsDiv = document.getElementById('compareResults');
    if (resultsDiv) resultsDiv.style.display = 'block';
    
    var summaryHtml = `
        <div class="diff-summary">
            <div class="diff-summary-item">
                <span class="count total">${totalCount}</span>
                <span class="label">Total Fields</span>
            </div>
            <div class="diff-summary-item">
                <span class="count match">${matchCount}</span>
                <span class="label">Matching</span>
            </div>
            <div class="diff-summary-item">
                <span class="count diff">${diffCount}</span>
                <span class="label">Differences</span>
            </div>
        </div>
        ${diffCount === 0 ? 
            '<div style="text-align:center; padding:12px; color:#4caf50; font-weight:700;">✅ RECORDS ARE IDENTICAL</div>' :
            '<div style="text-align:center; padding:8px; color:#ff6b6b; font-weight:600;">🔴 ' + diffCount + ' difference(s) found</div>'
        }
    `;
    var summaryDiv = document.getElementById('compareSummary');
    if (summaryDiv) summaryDiv.innerHTML = summaryHtml;
    
    var detailHtml = '';
    
    if (diffCount > 0) {
        detailHtml += '<div style="margin-bottom:8px; color:#ff6b6b; font-weight:600;">🔴 DIFFERENCES (' + diffCount + ')</div>';
        results.diffs.forEach(function(diff) {
            detailHtml += `
                <div class="diff-item diff">
                    <span class="field-name">${compareEscapeHtml(diff.path)}</span>
                    <span>
                        <span class="field-value-left">${compareEscapeHtml(diff.left)}</span>
                        <span style="color:#666; margin:0 4px;">≠</span>
                        <span class="field-value-right">${compareEscapeHtml(diff.right)}</span>
                    </span>
                </div>
            `;
        });
    } else {
        detailHtml += '<div style="padding:12px; text-align:center; color:#4caf50;">✅ No differences found — records match perfectly</div>';
    }
    
    if (matchCount > 0) {
        detailHtml += '<div style="margin:12px 0 8px 0; color:#4caf50; font-weight:600;">🟢 MATCHING FIELDS (' + matchCount + ')</div>';
        var matchDisplay = results.matches.slice(0, 50);
        matchDisplay.forEach(function(match) {
            detailHtml += `
                <div class="diff-item match">
                    <span class="field-name">${compareEscapeHtml(match.path)}</span>
                    <span class="field-value-left">${compareEscapeHtml(match.value)}</span>
                </div>
            `;
        });
        if (results.matches.length > 50) {
            detailHtml += '<div style="padding:4px 8px; color:#888; font-size:0.65rem;">... and ' + (results.matches.length - 50) + ' more matching fields</div>';
        }
    }
    
    var detailDiv = document.getElementById('compareDetail');
    if (detailDiv) detailDiv.innerHTML = detailHtml;
    
    compareLog('Comparison complete: ' + matchCount + ' match, ' + diffCount + ' diff', 'info');
    if (diffCount > 0) {
        compareLog('Differences found in ' + diffCount + ' fields', 'diff');
        results.diffs.slice(0, 10).forEach(function(diff) {
            compareLog('  ' + diff.path + ': ' + diff.left + ' ≠ ' + diff.right, 'diff');
        });
        if (results.diffs.length > 10) {
            compareLog('  ... and ' + (results.diffs.length - 10) + ' more differences', 'diff');
        }
    } else {
        compareLog('Records are identical', 'match');
    }
}

// ============================================================
// COMPARE TAB: INFORMATION GUIDE
// ============================================================

function showCompareInfoGuide() {
    // Remove existing overlay if present
    var existing = document.querySelector('.info-overlay');
    if (existing) existing.remove();
    
    var overlay = document.createElement('div');
    overlay.className = 'info-overlay';
    overlay.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <div class="info-title">🔍 COMPARE TAB - Information & Guide</div>
                <button class="info-close-btn" onclick="this.closest('.info-overlay').remove()">✕ CLOSE</button>
            </div>
            
            <div class="info-section">
                <div class="info-section-title">🎯 What This Tab Does</div>
                <div class="info-text">
                    The <strong>COMPARE</strong> tab performs a field-by-field comparison between two game records.
                    This is useful for:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>🔍 Verifying data consistency between PROD and DEV environments</li>
                        <li>🐛 Debugging differences between two records</li>
                        <li>✅ Confirming that a copy operation was successful</li>
                        <li>📊 Identifying what changed between two versions of a record</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📖 How To Use</div>
                <ol class="info-steps">
                    <li><strong>Step 1 - Environments:</strong> Select the <span class="highlight">LEFT</span> environment (PROD/DEV) and <span class="highlight">RIGHT</span> environment (PROD/DEV)</li>
                    <li><strong>Step 2 - Collections:</strong> Choose the collection for each side (<code>scheduledGames</code>, <code>historyGames</code>, or <code>backupFolder</code>)</li>
                    <li><strong>Step 3 - Load Records:</strong> Click <span class="highlight">"Load Records"</span> to populate the dropdowns</li>
                    <li><strong>Step 4 - Select Records:</strong> Choose a record from each dropdown</li>
                    <li><strong>Step 5 - Compare:</strong> Click <span class="highlight">"COMPARE"</span> to perform the comparison</li>
                </ol>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📊 What Gets Compared</div>
                <div class="info-text">
                    The comparison is <strong>deep and exhaustive</strong> - it examines every field in the record:
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li>📋 <strong>Game metadata:</strong> date, status, gameStarted, startingHole, format</li>
                        <li>✈️ <strong>Flight data:</strong> f1.d, f1.se, f1.x, f2.d, f2.se, f2.x</li>
                        <li>🏆 <strong>Results:</strong> TR values, T-1, T-2, Strk, match results, player totals</li>
                        <li>📊 <strong>Arrays:</strong> Compares each element (teamA, teamB, displayT1, etc.)</li>
                        <li>👥 <strong>Players:</strong> Names, handicaps, teams, flights, labels</li>
                        <li>⛳ <strong>Course:</strong> Name, par, si values</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">📊 Understanding the Results</div>
                <div class="info-text">
                    <ul style="padding-left:20px; margin:6px 0; color:#ccc; font-size:0.85rem; line-height:1.6;">
                        <li><span style="color:#4caf50;">🟢 MATCHING FIELDS</span> - Values are identical in both records</li>
                        <li><span style="color:#ff6b6b;">🔴 DIFFERENCES</span> - Values differ between records (shown with left ≠ right)</li>
                        <li><span style="color:#ffaa44;">📊 SUMMARY</span> - Total fields, matching count, difference count</li>
                        <li><span style="color:#ff6b6b;">⚠️ MISSING FIELDS</span> - A field exists in one record but not the other</li>
                    </ul>
                </div>
            </div>
            
            <hr class="info-divider">
            
            <div class="info-section">
                <div class="info-section-title">⚠️ Important Notes</div>
                <ul class="info-warnings">
                    <li><strong>No modifications:</strong> Comparison does not change any data. It is read-only.</li>
                    <li><strong>Deep comparison:</strong> Nested objects and arrays are compared recursively.</li>
                    <li><strong>Performance:</strong> For large records, comparison may take a few seconds.</li>
                    <li><strong>Cross-environment:</strong> You can compare PROD vs DEV, PROD vs PROD, or DEV vs DEV.</li>
                    <li><strong>Different collections:</strong> You can compare records from different collections (e.g., scheduledGames vs historyGames).</li>
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
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.setCompareLeftEnvironment = setCompareLeftEnvironment;
window.setCompareRightEnvironment = setCompareRightEnvironment;
window.loadCompareRecords = loadCompareRecords;
window.loadCompareRecordsLeft = loadCompareRecordsLeft;
window.loadCompareRecordsRight = loadCompareRecordsRight;
window.loadCompareRecordData = loadCompareRecordData;
window.performCompare = performCompare;
window.showCompareInfoGuide = showCompareInfoGuide;

// ============================================================
// EXPOSE FOR DEBUGGING
// ============================================================

window.COMPARE_UTIL_VERSION = "1.04";
console.log("[COMPARE-UTIL] v1.04 loaded");

/*
FILE: js/util-compare-record.js
VERSION: 1.04
KEY CHANGES from v1.03:
   - REMOVED: Dependency on HTML for initFirebase, log, logStep, escapeHtml
   - CHANGED: Now uses window.log and window.escapeHtml from util-core.js
   - CHANGED: Now uses window.prodDb and window.devDb from util-core.js
   - ADDED: Fallback logging and escaping functions if util-core.js not loaded
   - ADDED: Explicit state variables leftData, rightData, leftId, rightId
   - PRESERVED: All existing functionality from v1.03
DEPENDS ON: util-core.js
STATUS: Ready for integration
*/