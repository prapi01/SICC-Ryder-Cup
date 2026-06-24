/*
FILE: js/util-compare-record.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: Now uses initFirebase, log, logStep, escapeHtml from main HTML
   - FIXED: Removed duplicate function definitions that conflicted with main HTML
   - FIXED: Compare functions now properly reference currentDb and currentEnv
   - PRESERVED: All COMPARE tab functionality
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, logStep, escapeHtml
STATUS: Ready for integration
*/

/*
============================================================
SHARED STATE (defined in main HTML)
============================================================
- currentDb: Firestore instance
- currentEnv: 'PROD' or 'DEV'
- leftData: Left record data (loaded from Firestore)
- rightData: Right record data (loaded from Firestore)
- leftId: Left record ID
- rightId: Right record ID
============================================================
*/

// ============================================================
// COMPARE TAB: LOAD RECORDS (INDEPENDENT SIDES)
// ============================================================

function loadCompareRecords() {
    if (!currentDb) return;
    
    // Load LEFT records
    var leftCollection = document.getElementById('compareLeftCollection').value;
    var leftSelect = document.getElementById('compareLeftRecord');
    var currentLeftValue = leftSelect.value;
    leftSelect.innerHTML = '<option value="">Loading...</option>';
    leftSelect.disabled = true;
    
    currentDb.collection(leftCollection)
        .orderBy('date', 'desc')
        .limit(100)
        .get()
        .then(function(snapshot) {
            leftSelect.innerHTML = '<option value="">-- Select left record --</option>';
            leftSelect.disabled = false;
            
            if (!snapshot.empty) {
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    var option = document.createElement('option');
                    option.value = doc.id;
                    var displayDate = data.date || 'No date';
                    var courseName = data.course ? data.course.name : 'Unknown';
                    option.textContent = doc.id + ' | ' + displayDate + ' | ' + courseName;
                    leftSelect.appendChild(option);
                });
            }
            
            // Restore selection if it still exists
            if (currentLeftValue) {
                var options = leftSelect.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i].value === currentLeftValue) {
                        leftSelect.value = currentLeftValue;
                        break;
                    }
                }
            }
            
            if (leftSelect.value) {
                loadCompareRecordData('left');
            } else {
                leftData = null;
                leftId = null;
                document.getElementById('compareLeftInfo').style.display = 'none';
            }
        })
        .catch(function() {
            leftSelect.innerHTML = '<option value="">-- Error loading --</option>';
            leftSelect.disabled = false;
        });
    
    // Load RIGHT records
    var rightCollection = document.getElementById('compareRightCollection').value;
    var rightSelect = document.getElementById('compareRightRecord');
    var currentRightValue = rightSelect.value;
    rightSelect.innerHTML = '<option value="">Loading...</option>';
    rightSelect.disabled = true;
    
    currentDb.collection(rightCollection)
        .orderBy('date', 'desc')
        .limit(100)
        .get()
        .then(function(snapshot) {
            rightSelect.innerHTML = '<option value="">-- Select right record --</option>';
            rightSelect.disabled = false;
            
            if (!snapshot.empty) {
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    var option = document.createElement('option');
                    option.value = doc.id;
                    var displayDate = data.date || 'No date';
                    var courseName = data.course ? data.course.name : 'Unknown';
                    option.textContent = doc.id + ' | ' + displayDate + ' | ' + courseName;
                    rightSelect.appendChild(option);
                });
            }
            
            if (currentRightValue) {
                var options = rightSelect.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i].value === currentRightValue) {
                        rightSelect.value = currentRightValue;
                        break;
                    }
                }
            }
            
            if (rightSelect.value) {
                loadCompareRecordData('right');
            } else {
                rightData = null;
                rightId = null;
                document.getElementById('compareRightInfo').style.display = 'none';
            }
        })
        .catch(function() {
            rightSelect.innerHTML = '<option value="">-- Error loading --</option>';
            rightSelect.disabled = false;
        });
}

// ============================================================
// COMPARE TAB: LOAD INDIVIDUAL RECORD DATA
// ============================================================

function loadCompareRecordData(side) {
    if (!currentDb) {
        log("Select an environment first", "error");
        return;
    }
    
    var collectionId = side === 'left' ? 'compareLeftCollection' : 'compareRightCollection';
    var selectId = side === 'left' ? 'compareLeftRecord' : 'compareRightRecord';
    var infoId = side === 'left' ? 'compareLeftInfo' : 'compareRightInfo';
    
    var collection = document.getElementById(collectionId).value;
    var recordId = document.getElementById(selectId).value;
    
    if (!recordId) {
        document.getElementById(infoId).style.display = 'none';
        if (side === 'left') { leftData = null; leftId = null; }
        else { rightData = null; rightId = null; }
        document.getElementById('compareResults').style.display = 'none';
        return;
    }
    
    log('Loading ' + side + ' record: ' + recordId + ' from ' + collection, 'info');
    
    currentDb.collection(collection).doc(recordId).get()
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
                var courseName = data.course ? data.course.name : 'Unknown';
                var playerCount = data.players ? data.players.length : 0;
                
                infoDiv.innerHTML = `
                    <div class="game-info" style="margin:0;">
                        <div class="game-info-row">
                            <span class="game-info-label">ID:</span>
                            <span class="game-info-value gold" style="word-break:break-all;">${escapeHtml(recordId)}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Date:</span>
                            <span class="game-info-value">${escapeHtml(data.date || 'Unknown')}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Course:</span>
                            <span class="game-info-value">${escapeHtml(courseName)}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Players:</span>
                            <span class="game-info-value">${playerCount}</span>
                        </div>
                        <div class="game-info-row">
                            <span class="game-info-label">Status:</span>
                            <span class="game-info-value">${escapeHtml(data.status || 'unknown')}</span>
                        </div>
                    </div>
                `;
                infoDiv.style.display = 'block';
                
                log('Loaded ' + side + ' record: ' + recordId, 'success');
            } else {
                document.getElementById(infoId).style.display = 'none';
                if (side === 'left') { leftData = null; leftId = null; }
                else { rightData = null; rightId = null; }
                document.getElementById('compareResults').style.display = 'none';
                log('Record not found: ' + recordId, 'error');
            }
        })
        .catch(function(err) {
            document.getElementById(infoId).style.display = 'none';
            if (side === 'left') { leftData = null; leftId = null; }
            else { rightData = null; rightId = null; }
            document.getElementById('compareResults').style.display = 'none';
            log('Error loading ' + side + ' record: ' + err.message, 'error');
        });
}

// ============================================================
// COMPARE TAB: PERFORM COMPARISON
// ============================================================

function performCompare() {
    if (!currentDb) {
        log("Select an environment first", "error");
        return;
    }
    
    if (!leftData || !leftId) {
        log("Load a left record first", "error");
        return;
    }
    
    if (!rightData || !rightId) {
        log("Load a right record first", "error");
        return;
    }
    
    log('=== START COMPARISON ===', 'info');
    log('Left: ' + leftId, 'info');
    log('Right: ' + rightId, 'info');
    
    var results = compareObjects(leftData, rightData);
    displayCompareResults(results);
    
    log('=== COMPARISON COMPLETE ===', 'success');
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
    
    document.getElementById('compareResults').style.display = 'block';
    
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
    document.getElementById('compareSummary').innerHTML = summaryHtml;
    
    var detailHtml = '';
    
    if (diffCount > 0) {
        detailHtml += '<div style="margin-bottom:8px; color:#ff6b6b; font-weight:600;">🔴 DIFFERENCES (' + diffCount + ')</div>';
        results.diffs.forEach(function(diff) {
            detailHtml += `
                <div class="diff-item diff">
                    <span class="field-name">${escapeHtml(diff.path)}</span>
                    <span>
                        <span class="field-value-left">${escapeHtml(diff.left)}</span>
                        <span style="color:#666; margin:0 4px;">≠</span>
                        <span class="field-value-right">${escapeHtml(diff.right)}</span>
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
                    <span class="field-name">${escapeHtml(match.path)}</span>
                    <span class="field-value-left">${escapeHtml(match.value)}</span>
                </div>
            `;
        });
        if (results.matches.length > 50) {
            detailHtml += '<div style="padding:4px 8px; color:#888; font-size:0.65rem;">... and ' + (results.matches.length - 50) + ' more matching fields</div>';
        }
    }
    
    document.getElementById('compareDetail').innerHTML = detailHtml;
    
    log('Comparison complete: ' + matchCount + ' match, ' + diffCount + ' diff', 'info');
    if (diffCount > 0) {
        log('Differences found in ' + diffCount + ' fields', 'diff');
        results.diffs.slice(0, 10).forEach(function(diff) {
            log('  ' + diff.path + ': ' + diff.left + ' ≠ ' + diff.right, 'diff');
        });
        if (results.diffs.length > 10) {
            log('  ... and ' + (results.diffs.length - 10) + ' more differences', 'diff');
        }
    } else {
        log('Records are identical', 'match');
    }
}

// ============================================================
// COMPARE TAB: INDEPENDENT LOAD FUNCTIONS
// ============================================================

function loadCompareRecordsLeft() {
    if (!currentDb) return;
    
    var collection = document.getElementById('compareLeftCollection').value;
    var select = document.getElementById('compareLeftRecord');
    var currentValue = select.value;
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    currentDb.collection(collection)
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
            }
        })
        .catch(function() {
            select.innerHTML = '<option value="">-- Error loading --</option>';
            select.disabled = false;
        });
}

function loadCompareRecordsRight() {
    if (!currentDb) return;
    
    var collection = document.getElementById('compareRightCollection').value;
    var select = document.getElementById('compareRightRecord');
    var currentValue = select.value;
    
    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;
    
    currentDb.collection(collection)
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
            }
        })
        .catch(function() {
            select.innerHTML = '<option value="">-- Error loading --</option>';
            select.disabled = false;
        });
}

// ============================================================
// EXPOSE FOR DEBUGGING
// ============================================================

window.COMPARE_UTIL_VERSION = "1.01";
console.log("[COMPARE-UTIL] v1.01 loaded");

/*
FILE: js/util-compare-record.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: Now uses initFirebase, log, logStep, escapeHtml from main HTML
   - FIXED: Removed duplicate function definitions that conflicted with main HTML
   - FIXED: Compare functions now properly reference currentDb and currentEnv
   - PRESERVED: All COMPARE tab functionality
DEPENDS ON: Main HTML (util-record-management.html) for initFirebase, log, logStep, escapeHtml
STATUS: Ready for integration
*/