/*
FILE: util-validate-ui.js
VERSION: 1.15
KEY CHANGES from v1.14:
   - CHANGED: Handicap Adjustment table now shows "Raw New" and "Final New" columns
   - CHANGED: renderHandicapAdjustmentCard() now displays both raw and final values
   - CHANGED: Displays zero rise amount and new anchor information
   - FIXED: Table now correctly shows rawNew before zero rise and finalNew after zero rise
   - PRESERVED: All existing validation UI rendering from v1.14
DEPENDS ON: util-core.js, util-validate-record.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_VALIDATE_UI_VERSION = '1.15';

// ============================================================
// renderValidateResults()
// Main function to render all validation results
// ============================================================

function renderValidateResults(record, validationResult) {
    console.log('[VALIDATE-UI] renderValidateResults() called');
    
    if (!record || !validationResult) {
        console.error('[VALIDATE-UI] Missing record or validation result');
        return;
    }
    
    // Store for global access
    window._validateCurrentRecord = record;
    window.validateCurrentValidation = validationResult;
    
    // Show results container
    var resultsDiv = document.getElementById('validateResults');
    if (resultsDiv) {
        resultsDiv.classList.add('active');
    }
    
    // Render each section
    renderGameInfo(record);
    renderFlightInfo(record, validationResult);
    renderT1Info(record, validationResult);
    renderT2Info(record, validationResult);
    renderStrkInfo(record, validationResult);
    renderMatchInfo(record, validationResult);
    renderTRInfo(record, validationResult);
    renderHandicapAdjustmentCard(record, validationResult);
    renderPhotoStatus(record, validationResult);
    renderValidationSummary(record, validationResult);
    
    // Show fix card if needed
    showFixCard(validationResult);
    
    console.log('[VALIDATE-UI] Rendering complete');
}

// ============================================================
// renderHandicapAdjustmentCard()
// Renders the Handicap Adjustment card with Raw New and Final New columns
// ============================================================

function renderHandicapAdjustmentCard(record, validationResult) {
    var container = document.getElementById('validateHandicapCard');
    if (!container) {
        console.warn('[VALIDATE-UI] validateHandicapCard container not found');
        return;
    }
    
    var handicapData = validationResult.handicapStored || {};
    var recalcData = validationResult.handicapRecalculated || {};
    var mismatches = validationResult.handicapMismatches || [];
    var matches = validationResult.handicapMatches || [];
    
    var storedPlayers = handicapData.players || [];
    var recalcPlayers = recalcData.players || [];
    var storedNewAnchor = handicapData.newAnchor || handicapData.newAnchorName || 'None';
    var recalcNewAnchor = recalcData.finalNewAnchorName || recalcData.newAnchorName || null;
    var zeroRiseAmount = recalcData.zeroRiseAmount || 0;
    var needsZeroRise = recalcData.needsZeroRise || false;
    
    // Check if there's any data to show
    if (storedPlayers.length === 0 && recalcPlayers.length === 0) {
        container.innerHTML = '<div style="color:#666; padding:12px; text-align:center;">No handicap data available</div>';
        return;
    }
    
    // Determine if handicap data is valid
    var isValid = validationResult.handicapValid !== undefined ? validationResult.handicapValid : true;
    var needsFix = validationResult.handicapNeedsFix || false;
    var mismatchCount = mismatches.length || 0;
    var matchCount = matches.length || 0;
    
    // Build status indicator
    var statusColor = isValid ? '#4caf50' : '#ff6b6b';
    var statusIcon = isValid ? '✅' : '❌';
    var statusText = isValid ? 'VALID' : 'NEEDS FIX';
    
    // Get players data - use recalc players if available, otherwise stored
    var displayPlayers = recalcPlayers.length > 0 ? recalcPlayers : storedPlayers;
    
    // Build HTML
    var html = '';
    html += '<div style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">';
    
    // Header
    html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">';
    html += '<span style="font-size:1.1rem;">🏌️</span>';
    html += '<span style="font-weight:600; color:#ffaa44; font-size:0.85rem;">Handicap Adjustment</span>';
    html += '<span style="font-size:0.7rem; color:' + statusColor + '; margin-left:auto; font-weight:600;">' + statusIcon + ' ' + statusText + '</span>';
    html += '</div>';
    
    // Summary bar
    html += '<div style="display:flex; gap:12px; font-size:0.65rem; color:#888; margin-bottom:8px; padding:4px 0; border-bottom:1px solid #1a1a1a; flex-wrap:wrap;">';
    html += '<span>Anchor: <strong style="color:#ffaa44;">' + escapeHtml(storedNewAnchor) + '</strong></span>';
    html += '<span>New Anchor: <strong style="color:#ffaa44;">' + formatNewAnchorDisplay(recalcNewAnchor) + '</strong></span>';
    if (needsZeroRise && zeroRiseAmount !== 0) {
        html += '<span>Zero Rise: <strong style="color:#4caf50;">+' + zeroRiseAmount + '</strong></span>';
    } else {
        html += '<span>Zero Rise: <strong style="color:#888;">None</strong></span>';
    }
    html += '<span style="margin-left:auto;">✅ ' + matchCount + ' ❌ ' + mismatchCount + '</span>';
    html += '</div>';
    
    // Table
    html += '<div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.6rem; min-width:420px;">';
    
    // Table header
    html += '<thead>';
    html += '<tr style="background:#1a1a1a; border-bottom:2px solid #333;">';
    html += '<th style="padding:6px 4px; text-align:left; color:#888; font-weight:600;">Player</th>';
    html += '<th style="padding:6px 4px; text-align:center; color:#888; font-weight:600;">Old</th>';
    html += '<th style="padding:6px 4px; text-align:center; color:#ffaa44; font-weight:600;">Raw New</th>';
    html += '<th style="padding:6px 4px; text-align:center; color:#4caf50; font-weight:600;">Final New</th>';
    html += '<th style="padding:6px 4px; text-align:center; color:#888; font-weight:600;">Status</th>';
    html += '</tr>';
    html += '</thead>';
    
    // Table body
    html += '<tbody>';
    
    var maxLen = Math.max(storedPlayers.length, displayPlayers.length);
    for (var i = 0; i < maxLen; i++) {
        var storedP = storedPlayers[i] || {};
        var displayP = displayPlayers[i] || {};
        var name = storedP.name || displayP.name || 'Player ' + (i + 1);
        var label = storedP.label || displayP.label || '';
        var startingHcp = storedP.startingHcp !== undefined ? storedP.startingHcp : displayP.startingHcp;
        var finalHcp = storedP.finalHcp;  // Stored final value
        var rawNew = displayP.rawNew;      // Raw value before zero rise
        var finalNew = displayP.finalNew !== undefined ? displayP.finalNew : displayP.newHcp; // Final after zero rise
        
        // Determine if this player is the new anchor
        var isNewAnchor = (recalcNewAnchor && recalcNewAnchor === name) ||
                         (recalcNewAnchor && displayP.newAnchor === true) ||
                         (displayP.isNewAnchor === true);
        
        // Determine status
        var isMatch = false;
        var mismatchField = null;
        
        // Check if this player's finalHcp matches
        if (finalHcp !== undefined && finalNew !== undefined) {
            if (finalHcp === finalNew) {
                isMatch = true;
            } else {
                // Find mismatch for this player
                mismatches.forEach(function(m) {
                    if (m.field && m.field.indexOf(name) !== -1 && m.field.indexOf('finalHcp') !== -1) {
                        mismatchField = m;
                    }
                });
            }
        }
        
        // Row styling
        var rowColor = isMatch ? '#0a1a0a' : '#1a0a0a';
        var statusDisplay = '';
        var statusColor = '';
        
        if (isMatch) {
            statusDisplay = '✅';
            statusColor = '#4caf50';
        } else {
            statusDisplay = '❌';
            statusColor = '#ff6b6b';
        }
        
        // Handle undefined/null display
        var displayRawNew = (rawNew !== undefined && rawNew !== null) ? rawNew : '-';
        var displayFinalNew = (finalNew !== undefined && finalNew !== null) ? finalNew : '-';
        var displayFinalHcp = (finalHcp !== undefined && finalHcp !== null) ? finalHcp : '-';
        
        // Highlight if mismatch
        var rawStyle = (rawNew !== undefined && rawNew !== null) ? '' : 'color:#555;';
        var finalStyle = '';
        if (!isMatch && finalNew !== undefined && finalNew !== null) {
            finalStyle = 'color:#ffaa44; font-weight:700;';
        }
        
        html += '<tr style="border-bottom:1px solid #1a1a1a; background:' + rowColor + ';">';
        html += '<td style="padding:6px 4px; text-align:left; color:#e0e0e0; font-weight:600; white-space:nowrap;">';
        if (isNewAnchor) {
            html += '👑 ';
        }
        html += escapeHtml(name);
        if (label) {
            html += ' <span style="color:#555; font-size:0.55rem;">(' + escapeHtml(label) + ')</span>';
        }
        html += '</td>';
        
        // Old Hcp
        html += '<td style="padding:6px 4px; text-align:center; color:#888;">';
        html += (startingHcp !== undefined && startingHcp !== null) ? startingHcp : '-';
        html += '</td>';
        
        // Raw New (before zero rise)
        html += '<td style="padding:6px 4px; text-align:center; color:#ffaa44; font-weight:600; ' + rawStyle + '">';
        html += displayRawNew;
        if (rawNew !== undefined && rawNew !== null && rawNew < 0) {
            html += ' <span style="color:#ff6b6b; font-size:0.5rem;">⬇</span>';
        }
        html += '</td>';
        
        // Final New (after zero rise)
        html += '<td style="padding:6px 4px; text-align:center; color:#4caf50; font-weight:700; ' + finalStyle + '">';
        html += displayFinalNew;
        if (isNewAnchor) {
            html += ' <span style="color:#ffaa44; font-size:0.5rem;">⭐</span>';
        }
        html += '</td>';
        
        // Status
        html += '<td style="padding:6px 4px; text-align:center; color:' + statusColor + '; font-weight:600;">';
        html += statusDisplay;
        if (!isMatch && mismatchField) {
            html += ' <span style="color:#888; font-size:0.5rem; display:block;">exp:' + mismatchField.expected + '</span>';
        }
        html += '</td>';
        
        html += '</tr>';
    }
    
    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    
    // Footer with mismatch count
    if (mismatchCount > 0) {
        html += '<div style="margin-top:8px; padding:6px 10px; background:#1a0a0a; border-radius:4px; border:1px solid #5a2a2a; font-size:0.65rem; color:#ff6b6b;">';
        html += '❌ ' + mismatchCount + ' field mismatches found. Click "Fix Record" to correct.';
        html += '</div>';
    } else {
        html += '<div style="margin-top:8px; padding:6px 10px; background:#0a1a0a; border-radius:4px; border:1px solid #2a5a2a; font-size:0.65rem; color:#4caf50;">';
        html += '✅ All handicap fields match.';
        html += '</div>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
    console.log('[VALIDATE-UI] Handicap Adjustment card rendered with Raw New and Final New columns');
}

// ============================================================
// formatNewAnchorDisplay()
// Formats the new anchor display value
// ============================================================

function formatNewAnchorDisplay(value) {
    if (!value) return 'None';
    if (value === '*multiple*') {
        return '<span style="color:#ffaa44;">Pending (Multiple)</span>';
    }
    return '<span style="color:#ffaa44;">' + escapeHtml(value) + '</span>';
}

// ============================================================
// renderGameInfo()
// Renders game info section
// ============================================================

function renderGameInfo(record) {
    var container = document.getElementById('validateGameInfo');
    if (!container) return;
    
    var html = '<div class="game-info-grid">';
    html += '<span class="label">Game ID:</span><span class="value">' + escapeHtml(record.gameId || record.id || 'Unknown') + '</span>';
    html += '<span class="label">Date:</span><span class="value">' + escapeHtml(record.gameDate || record.date || 'Unknown') + '</span>';
    html += '<span class="label">Course:</span><span class="value">' + escapeHtml(record.courseName || record.course || 'Unknown') + '</span>';
    html += '<span class="label">Status:</span><span class="value">' + escapeHtml(record.status || 'Unknown') + '</span>';
    html += '<span class="label">Players:</span><span class="value">' + (record.players ? record.players.length : '0') + '</span>';
    html += '</div>';
    
    container.innerHTML = html;
}

// ============================================================
// renderFlightInfo()
// Renders flight info section
// ============================================================

function renderFlightInfo(record, validationResult) {
    // Placeholder - will be implemented in future
    var container1 = document.getElementById('validateFlight1');
    var container2 = document.getElementById('validateFlight2');
    if (container1) container1.innerHTML = '<div style="color:#666; font-size:0.7rem;">Flight 1 data</div>';
    if (container2) container2.innerHTML = '<div style="color:#666; font-size:0.7rem;">Flight 2 data</div>';
}

// ============================================================
// renderT1Info()
// Renders T-1 info section
// ============================================================

function renderT1Info(record, validationResult) {
    var container = document.getElementById('validateT1');
    if (!container) return;
    container.innerHTML = '<div style="color:#666; font-size:0.7rem;">T-1 validation data</div>';
}

// ============================================================
// renderT2Info()
// Renders T-2 info section
// ============================================================

function renderT2Info(record, validationResult) {
    var container = document.getElementById('validateT2');
    if (!container) return;
    container.innerHTML = '<div style="color:#666; font-size:0.7rem;">T-2 validation data</div>';
}

// ============================================================
// renderStrkInfo()
// Renders Strk info section
// ============================================================

function renderStrkInfo(record, validationResult) {
    var container = document.getElementById('validateStrk');
    if (!container) return;
    container.innerHTML = '<div style="color:#666; font-size:0.7rem;">Strk validation data</div>';
}

// ============================================================
// renderMatchInfo()
// Renders Match info section
// ============================================================

function renderMatchInfo(record, validationResult) {
    var container = document.getElementById('validateMatch');
    if (!container) return;
    container.innerHTML = '<div style="color:#666; font-size:0.7rem;">Match game validation data</div>';
}

// ============================================================
// renderTRInfo()
// Renders TR info section
// ============================================================

function renderTRInfo(record, validationResult) {
    var container = document.getElementById('validateTR');
    if (!container) return;
    container.innerHTML = '<div style="color:#666; font-size:0.7rem;">TR per hole validation data</div>';
}

// ============================================================
// renderPhotoStatus()
// Renders photo status section
// ============================================================

function renderPhotoStatus(record, validationResult) {
    var container = document.getElementById('validatePhotoStatus');
    if (!container) return;
    
    var photoUrl = record.celebration || null;
    if (photoUrl) {
        container.innerHTML = '<div style="color:#4caf50;">✅ Photo present</div>';
        container.innerHTML += '<div style="margin-top:4px;"><img src="' + escapeHtml(photoUrl) + '" style="max-width:100%; max-height:150px; border-radius:8px; border:1px solid #333;"></div>';
    } else {
        container.innerHTML = '<div style="color:#888;">No celebration photo found</div>';
    }
}

// ============================================================
// renderValidationSummary()
// Renders validation summary section
// ============================================================

function renderValidationSummary(record, validationResult) {
    var container = document.getElementById('validateSummary');
    if (!container) return;
    
    var isValid = validationResult.valid || false;
    var needsFix = validationResult.needsFix || false;
    var mismatches = validationResult.mismatches || [];
    var matches = validationResult.matches || [];
    var summary = validationResult.summary || {};
    
    var totalFields = summary.totalFields || 0;
    var matchedCount = summary.matched || 0;
    var mismatchedCount = summary.mismatched || 0;
    var handicapMismatchCount = (validationResult.handicapMismatches || []).length || 0;
    
    var html = '<div style="padding:12px 0;">';
    
    // Status header
    if (isValid) {
        html += '<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:12px; border-radius:8px; background:#0a2a0a; border:1px solid #2a5a2a;">';
        html += '<span style="font-size:1.5rem;">✅</span>';
        html += '<div><div style="font-weight:700; color:#4caf50;">VALID</div>';
        html += '<div style="font-size:0.7rem; color:#888;">All fields match</div></div>';
        html += '</div>';
    } else {
        html += '<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:12px; border-radius:8px; background:#2a0a0a; border:1px solid #5a2a2a;">';
        html += '<span style="font-size:1.5rem;">❌</span>';
        html += '<div><div style="font-weight:700; color:#ff6b6b;">NEEDS FIX</div>';
        html += '<div style="font-size:0.7rem; color:#888;">' + matchedCount + ' fields match, ' + mismatchedCount + ' fields need attention' + (handicapMismatchCount > 0 ? ' (' + handicapMismatchCount + ' handicap)' : '') + '</div></div>';
        html += '</div>';
    }
    
    // Stats grid
    html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; font-size:0.75rem;">';
    
    // Status
    html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
    html += '<span style="color:#888;">Status</span><br>';
    html += '<span style="color:' + (isValid ? '#4caf50' : '#ff6b6b') + '; font-weight:600;">' + (record.status || 'unknown') + '</span>';
    html += '</div>';
    
    // Signatures
    var bothSigned = record.f1Signed && record.f2Signed;
    html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
    html += '<span style="color:#888;">Signatures</span><br>';
    html += '<span style="color:' + (bothSigned ? '#4caf50' : '#888') + '; font-weight:600;">' + (bothSigned ? '✅ Both signed' : 'Incomplete') + '</span>';
    html += '</div>';
    
    // Total fields
    html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
    html += '<span style="color:#888;">Total Fields</span><br>';
    html += '<span style="color:#ffaa44; font-weight:600;">' + totalFields + '</span>';
    html += '</div>';
    
    // Mismatches
    html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
    html += '<span style="color:#888;">Mismatches</span><br>';
    html += '<span style="color:' + (mismatchedCount > 0 ? '#ff6b6b' : '#4caf50') + '; font-weight:600;">' + mismatchedCount + '</span>';
    html += '</div>';
    
    html += '</div>';
    
    // Category breakdown
    html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:12px; font-size:0.6rem;">';
    var categories = ['Match', 'T-1', 'T-2', 'Stroke', 'TR', 'Handicap'];
    categories.forEach(function(cat) {
        var count = 0;
        // Count mismatches for this category
        mismatches.forEach(function(m) {
            if (m.field && m.field.indexOf(cat) !== -1) count++;
        });
        html += '<div style="background:#0a0a0a; padding:4px 6px; border-radius:4px; border:1px solid #1a1a1a; text-align:center;">';
        html += '<span style="color:#888;">' + cat + '</span><br>';
        html += '<span style="color:' + (count > 0 ? '#ff6b6b' : '#4caf50') + '; font-weight:600;">' + count + '</span>';
        html += '</div>';
    });
    html += '</div>';
    
    // Detailed mismatch list
    if (mismatches.length > 0) {
        html += '<div style="max-height:200px; overflow-y:auto; margin-top:8px; border-top:1px solid #1a1a1a; padding-top:8px;">';
        html += '<div style="font-size:0.6rem; color:#888; margin-bottom:4px;">Mismatches (' + mismatches.length + '):</div>';
        mismatches.slice(0, 20).forEach(function(m) {
            var bgColor = m.field && m.field.indexOf('Handicap') !== -1 ? '#1a0a0a' : '#0a0a0a';
            html += '<div style="padding:3px 6px; border-radius:3px; background:' + bgColor + '; margin:2px 0; font-size:0.6rem; display:flex; justify-content:space-between; flex-wrap:wrap;">';
            html += '<span style="color:#ff6b6b;">' + escapeHtml(m.field) + '</span>';
            html += '<span style="color:#888;">cur: <span style="color:#ff6b6b;">' + escapeHtml(String(m.current)) + '</span> exp: <span style="color:#4caf50;">' + escapeHtml(String(m.expected)) + '</span></span>';
            html += '</div>';
        });
        if (mismatches.length > 20) {
            html += '<div style="color:#888; font-size:0.55rem; text-align:center; padding:4px;">... and ' + (mismatches.length - 20) + ' more</div>';
        }
        html += '</div>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
}

// ============================================================
// showFixCard()
// Shows/hides the fix card based on validation result
// ============================================================

function showFixCard(validationResult) {
    var fixCard = document.getElementById('validateFixCard');
    if (!fixCard) return;
    
    if (validationResult && validationResult.needsFix) {
        fixCard.style.display = 'block';
    } else {
        fixCard.style.display = 'none';
    }
}

// ============================================================
// escapeHtml()
// Utility function for escaping HTML
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.renderValidateResults = renderValidateResults;
window.renderHandicapAdjustmentCard = renderHandicapAdjustmentCard;
window.formatNewAnchorDisplay = formatNewAnchorDisplay;
window.renderGameInfo = renderGameInfo;
window.renderValidationSummary = renderValidationSummary;
window.showFixCard = showFixCard;
window.escapeHtml = escapeHtml;

console.log('[VALIDATE-UI] util-validate-ui.js v1.15 loaded');
console.log('[VALIDATE-UI] Functions exposed: renderValidateResults, renderHandicapAdjustmentCard, formatNewAnchorDisplay, renderGameInfo, renderValidationSummary, showFixCard, escapeHtml');

/*
FILE: util-validate-ui.js
VERSION: 1.15
KEY CHANGES from v1.14:
   - CHANGED: Handicap Adjustment table now shows "Raw New" and "Final New" columns
   - CHANGED: renderHandicapAdjustmentCard() now displays both raw and final values
   - CHANGED: Displays zero rise amount and new anchor information
   - FIXED: Table now correctly shows rawNew before zero rise and finalNew after zero rise
   - PRESERVED: All existing validation UI rendering from v1.14
DEPENDS ON: util-core.js, util-validate-record.js
STATUS: Ready for integration
*/