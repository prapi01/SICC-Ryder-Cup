/*
FILE: util-validate-record.js
VERSION: 1.14
KEY CHANGES from v1.13:
   - ADDED: recalculateHandicapsFromRecord() - wrapper for HandicapAdjustment with zero rise logic
   - ADDED: validateHandicapAdjustment() - validates handicap adjustment data
   - ADDED: compareHandicapFields() - compares stored vs recalculated fields
   - ADDED: buildHandicapFixPayload() - builds fix payload for handicaps
   - ADDED: applyZeroRiseToResult() - applies zero rise to recalculated raw values
   - ADDED: Safety rule - never overwrite valid stored values with undefined/null
   - ADDED: Support for "*multiple*" as valid newAnchor state
   - FIXED: Handicap comparison now compares zero-rised final values against stored finalHcp
   - FIXED: Raw values now correctly displayed as "Raw New" before zero rise
DEPENDS ON: game-data.js, game-order.js, game-loader.js, hcp-adjust.js
STATUS: Ready for integration
*/

// Version exposure
window.UTIL_VALIDATE_VERSION = '1.14';

// ============================================================
// applyZeroRiseToResult()
// Applies zero rise to recalculated raw data to get final values
// ============================================================

function applyZeroRiseToResult(result) {
    if (!result) return null;
    if (!result.players || result.players.length === 0) return result;
    
    // Check if zero rise is needed
    if (!result.needsZeroRise || !result.zeroRiseAmount) {
        // No zero rise needed, just copy rawNew to finalNew
        result.players.forEach(function(p) {
            p.finalNew = p.rawNew !== undefined ? p.rawNew : p.newHcp;
        });
        return result;
    }
    
    var zeroAmount = result.zeroRiseAmount;
    console.log('[VALIDATE] Applying zero rise of ' + zeroAmount + ' to ' + result.players.length + ' players');
    
    // Apply zero rise to all players
    result.players.forEach(function(p) {
        if (p.rawNew !== undefined && p.rawNew !== null) {
            p.finalNew = p.rawNew + zeroAmount;
        } else if (p.newHcp !== undefined && p.newHcp !== null) {
            p.finalNew = p.newHcp + zeroAmount;
        } else {
            p.finalNew = p.rawNew || p.newHcp || 0;
        }
    });
    
    // Update the result object
    result.finalNewAnchorName = result.newAnchorName;
    
    console.log('[VALIDATE] Zero rise applied successfully');
    return result;
}

// ============================================================
// recalculateHandicapsFromRecord()
// Wrapper that calls HandicapAdjustment.calculateAllAdjustmentsFromRaw()
// and applies zero rise to get final values
// ============================================================

function recalculateHandicapsFromRecord(record) {
    console.log('[VALIDATE] recalculateHandicapsFromRecord() called');
    
    if (!record) {
        console.error('[VALIDATE] No record provided');
        return null;
    }
    
    try {
        // Build cache from the record document
        var cache = GameLoader.buildCacheFromDoc(record);
        if (!cache) {
            console.error('[VALIDATE] Failed to build cache from record');
            return null;
        }
        
        // Get raw data from cache
        var rawData = cache.rawData;
        if (!rawData) {
            console.error('[VALIDATE] No rawData in cache');
            return null;
        }
        
        // Extract required data
        var players = rawData.players || [];
        var holes = rawData.holes || [];
        var gameInfo = rawData.gameInfo || {};
        
        if (players.length === 0 || holes.length === 0) {
            console.error('[VALIDATE] Missing players or holes data');
            return null;
        }
        
        // Call HandicapAdjustment to get raw calculations
        var rawResult = HandicapAdjustment.calculateAllAdjustmentsFromRaw(players, holes, gameInfo);
        if (!rawResult) {
            console.error('[VALIDATE] HandicapAdjustment returned null/undefined');
            return null;
        }
        
        console.log('[VALIDATE] Raw calculation complete:', {
            players: rawResult.players?.length || 0,
            needsZeroRise: rawResult.needsZeroRise,
            zeroRiseAmount: rawResult.zeroRiseAmount,
            newAnchorName: rawResult.newAnchorName
        });
        
        // Apply zero rise to get final values
        var finalResult = applyZeroRiseToResult(rawResult);
        if (!finalResult) {
            console.error('[VALIDATE] Failed to apply zero rise');
            return null;
        }
        
        console.log('[VALIDATE] Final calculation complete:', {
            players: finalResult.players?.length || 0,
            zeroRiseAmount: finalResult.zeroRiseAmount,
            finalNewAnchorName: finalResult.finalNewAnchorName || finalResult.newAnchorName
        });
        
        return finalResult;
        
    } catch (e) {
        console.error('[VALIDATE] Error in recalculateHandicapsFromRecord:', e);
        return null;
    }
}

// ============================================================
// validateHandicapAdjustment()
// Validates handicap adjustment data in a record
// ============================================================

function validateHandicapAdjustment(record) {
    console.log('[VALIDATE] validateHandicapAdjustment() called');
    
    if (!record) {
        console.error('[VALIDATE] No record provided');
        return {
            valid: false,
            needsFix: false,
            mismatches: [],
            matches: [],
            summary: { totalFields: 0, matched: 0, mismatched: 0 },
            handicapStored: null,
            handicapRecalculated: null
        };
    }
    
    // Get stored handicap data
    var storedData = record.adjustedHandicaps || {};
    if (!storedData.players || storedData.players.length === 0) {
        console.warn('[VALIDATE] No adjustedHandicaps data in record');
        return {
            valid: false,
            needsFix: true,
            mismatches: [{ field: 'adjustedHandicaps', current: 'MISSING', expected: 'Should exist' }],
            matches: [],
            summary: { totalFields: 0, matched: 0, mismatched: 1 },
            handicapStored: storedData,
            handicapRecalculated: null
        };
    }
    
    // Recalculate handicaps from raw data
    var recalculatedData = recalculateHandicapsFromRecord(record);
    if (!recalculatedData) {
        console.error('[VALIDATE] Failed to recalculate handicaps');
        return {
            valid: false,
            needsFix: true,
            mismatches: [{ field: 'recalculation', current: 'FAILED', expected: 'Should succeed' }],
            matches: [],
            summary: { totalFields: 0, matched: 0, mismatched: 1 },
            handicapStored: storedData,
            handicapRecalculated: null
        };
    }
    
    // Compare stored vs recalculated
    var comparison = compareHandicapFields(storedData, recalculatedData);
    
    return {
        valid: comparison.valid,
        needsFix: !comparison.valid,
        mismatches: comparison.mismatches,
        matches: comparison.matches,
        summary: comparison.summary,
        handicapStored: storedData,
        handicapRecalculated: recalculatedData,
        zeroRiseAmount: recalculatedData.zeroRiseAmount || 0,
        needsZeroRise: recalculatedData.needsZeroRise || false,
        newAnchor: recalculatedData.finalNewAnchorName || recalculatedData.newAnchorName
    };
}

// ============================================================
// compareHandicapFields()
// Compares stored handicap fields with recalculated values
// ============================================================

function compareHandicapFields(storedData, recalculatedData) {
    console.log('[VALIDATE] compareHandicapFields() called');
    
    var mismatches = [];
    var matches = [];
    var summary = {
        totalFields: 0,
        matched: 0,
        mismatched: 0
    };
    
    if (!storedData || !recalculatedData) {
        console.error('[VALIDATE] Missing stored or recalculated data');
        return { valid: false, mismatches: [], matches: [], summary: summary };
    }
    
    var storedPlayers = storedData.players || [];
    var recalcPlayers = recalculatedData.players || [];
    var storedNewAnchor = storedData.newAnchor || storedData.newAnchorName || null;
    var recalcNewAnchor = recalculatedData.finalNewAnchorName || recalculatedData.newAnchorName || null;
    
    // ============================================================
    // Compare newAnchor
    // ============================================================
    summary.totalFields++;
    
    // Check for "*multiple*" - valid state, skip validation
    if (storedNewAnchor === '*multiple*') {
        matches.push({
            field: 'newAnchor',
            current: storedNewAnchor,
            expected: storedNewAnchor + ' (valid - multiple pending)'
        });
        summary.matched++;
        console.log('[VALIDATE] newAnchor is "*multiple*" - valid state, skipping');
    } else if (recalcNewAnchor === undefined || recalcNewAnchor === null) {
        // Recalc missing - preserve stored value
        if (storedNewAnchor !== undefined && storedNewAnchor !== null) {
            matches.push({
                field: 'newAnchor',
                current: storedNewAnchor,
                expected: storedNewAnchor + ' (preserved - recalc missing)'
            });
            summary.matched++;
        }
    } else if (storedNewAnchor !== recalcNewAnchor) {
        mismatches.push({
            field: 'newAnchor',
            current: storedNewAnchor,
            expected: recalcNewAnchor
        });
        summary.mismatched++;
    } else {
        matches.push({
            field: 'newAnchor',
            current: storedNewAnchor,
            expected: recalcNewAnchor
        });
        summary.matched++;
    }
    
    // ============================================================
    // Compare players - finalNew (zero-rised) vs stored finalHcp
    // Also store rawNew for display purposes
    // ============================================================
    var maxLen = Math.max(storedPlayers.length, recalcPlayers.length);
    
    for (var i = 0; i < maxLen; i++) {
        var storedP = storedPlayers[i] || {};
        var recalcP = recalcPlayers[i] || {};
        var name = storedP.name || recalcP.name || 'Player ' + (i + 1);
        
        // Stored fields
        var storedFinalHcp = storedP.finalHcp;
        var storedAnchorAdj = storedP.anchorAdj;
        var storedPerfAdj = storedP.perfAdj;
        var storedStartingHcp = storedP.startingHcp;
        
        // Recalculated fields (with zero rise applied)
        var recalcFinalNew = recalcP.finalNew;      // Zero-rised final value
        var recalcRawNew = recalcP.rawNew;          // Raw value before zero rise
        var recalcAnchorAdj = recalcP.anchorAdj;
        var recalcPerfAdj = recalcP.perfAdj;
        var recalcStartingHcp = recalcP.startingHcp;
        
        // ============================================================
        // Compare Final New (zero-rised) vs stored finalHcp
        // ============================================================
        var fieldName = name + '.finalHcp';
        summary.totalFields++;
        
        // Safety rule: if recalcFinalNew is undefined/null, preserve stored value
        if (recalcFinalNew === undefined || recalcFinalNew === null) {
            if (storedFinalHcp !== undefined && storedFinalHcp !== null) {
                matches.push({
                    field: fieldName,
                    current: storedFinalHcp,
                    expected: storedFinalHcp + ' (preserved - recalc missing)'
                });
                summary.matched++;
            }
            continue;
        }
        
        if (storedFinalHcp !== recalcFinalNew) {
            mismatches.push({
                field: fieldName,
                current: storedFinalHcp,
                expected: recalcFinalNew,
                rawNew: recalcRawNew  // Store rawNew for display
            });
            summary.mismatched++;
        } else {
            matches.push({
                field: fieldName,
                current: storedFinalHcp,
                expected: recalcFinalNew,
                rawNew: recalcRawNew  // Store rawNew for display
            });
            summary.matched++;
        }
        
        // ============================================================
        // Compare anchorAdj
        // ============================================================
        var anchorFieldName = name + '.anchorAdj';
        summary.totalFields++;
        
        if (recalcAnchorAdj === undefined || recalcAnchorAdj === null) {
            if (storedAnchorAdj !== undefined && storedAnchorAdj !== null) {
                matches.push({
                    field: anchorFieldName,
                    current: storedAnchorAdj,
                    expected: storedAnchorAdj + ' (preserved)'
                });
                summary.matched++;
            }
            continue;
        }
        
        if (storedAnchorAdj !== recalcAnchorAdj) {
            mismatches.push({
                field: anchorFieldName,
                current: storedAnchorAdj,
                expected: recalcAnchorAdj
            });
            summary.mismatched++;
        } else {
            matches.push({
                field: anchorFieldName,
                current: storedAnchorAdj,
                expected: recalcAnchorAdj
            });
            summary.matched++;
        }
        
        // ============================================================
        // Compare perfAdj
        // ============================================================
        var perfFieldName = name + '.perfAdj';
        summary.totalFields++;
        
        if (recalcPerfAdj === undefined || recalcPerfAdj === null) {
            if (storedPerfAdj !== undefined && storedPerfAdj !== null) {
                matches.push({
                    field: perfFieldName,
                    current: storedPerfAdj,
                    expected: storedPerfAdj + ' (preserved)'
                });
                summary.matched++;
            }
            continue;
        }
        
        if (storedPerfAdj !== recalcPerfAdj) {
            mismatches.push({
                field: perfFieldName,
                current: storedPerfAdj,
                expected: recalcPerfAdj
            });
            summary.mismatched++;
        } else {
            matches.push({
                field: perfFieldName,
                current: storedPerfAdj,
                expected: recalcPerfAdj
            });
            summary.matched++;
        }
    }
    
    var valid = summary.mismatched === 0;
    
    console.log('[VALIDATE] Comparison complete:', {
        valid: valid,
        matched: summary.matched,
        mismatched: summary.mismatched,
        total: summary.totalFields
    });
    
    return {
        valid: valid,
        mismatches: mismatches,
        matches: matches,
        summary: summary
    };
}

// ============================================================
// buildHandicapFixPayload()
// Builds the fix payload for handicap data
// ============================================================

function buildHandicapFixPayload(record, validationResult) {
    console.log('[VALIDATE] buildHandicapFixPayload() called');
    
    if (!record || !validationResult) {
        console.error('[VALIDATE] Missing record or validation result');
        return null;
    }
    
    var recalculated = validationResult.handicapRecalculated;
    if (!recalculated) {
        console.error('[VALIDATE] No recalculated data available');
        return null;
    }
    
    var storedData = record.adjustedHandicaps || {};
    var payload = {};
    var updates = [];
    
    // ============================================================
    // Build players array with final values (zero-rised)
    // ============================================================
    var newPlayers = [];
    var recalcPlayers = recalculated.players || [];
    
    recalcPlayers.forEach(function(p) {
        var playerData = {
            name: p.name,
            label: p.label || '',
            startingHcp: p.startingHcp || 0,
            anchorAdj: p.anchorAdj || 0,
            perfAdj: p.perfAdj || 0,
            finalHcp: p.finalNew !== undefined ? p.finalNew : (p.newHcp || 0),
            rawNew: p.rawNew !== undefined ? p.rawNew : null
        };
        newPlayers.push(playerData);
    });
    
    // ============================================================
    // Build the full adjustedHandicaps object
    // ============================================================
    var newAdjustedHandicaps = {
        players: newPlayers,
        newAnchor: recalculated.finalNewAnchorName || recalculated.newAnchorName || null,
        anchor: storedData.anchor || null,  // Preserve old anchor
        calculatedAt: new Date().toISOString(),
        needsZeroRise: recalculated.needsZeroRise || false,
        zeroRiseAmount: recalculated.zeroRiseAmount || 0
    };
    
    // Handle "*multiple*" case - preserve it
    if (storedData.newAnchor === '*multiple*') {
        newAdjustedHandicaps.newAnchor = '*multiple*';
    }
    
    // ============================================================
    // Safety check: preserve any valid stored values that recalc is missing
    // ============================================================
    if (storedData.anchor && !newAdjustedHandicaps.anchor) {
        newAdjustedHandicaps.anchor = storedData.anchor;
        console.log('[VALIDATE] Preserved stored anchor:', storedData.anchor);
    }
    
    // Check if players match in length
    if (storedData.players && storedData.players.length === newPlayers.length) {
        // Preserve any fields that might be missing from recalc
        newPlayers.forEach(function(newP, idx) {
            var storedP = storedData.players[idx] || {};
            // If recalc has no name but stored does, preserve stored name
            if (!newP.name && storedP.name) {
                newP.name = storedP.name;
            }
            if (!newP.label && storedP.label) {
                newP.label = storedP.label;
            }
        });
    }
    
    // ============================================================
    // Build payload
    // ============================================================
    payload['adjustedHandicaps'] = newAdjustedHandicaps;
    updates.push('adjustedHandicaps');
    
    console.log('[VALIDATE] Fix payload built:', {
        updates: updates,
        players: newPlayers.length,
        newAnchor: newAdjustedHandicaps.newAnchor,
        zeroRiseAmount: newAdjustedHandicaps.zeroRiseAmount
    });
    
    return {
        payload: payload,
        updates: updates,
        newData: newAdjustedHandicaps
    };
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.recalculateHandicapsFromRecord = recalculateHandicapsFromRecord;
window.validateHandicapAdjustment = validateHandicapAdjustment;
window.compareHandicapFields = compareHandicapFields;
window.buildHandicapFixPayload = buildHandicapFixPayload;
window.applyZeroRiseToResult = applyZeroRiseToResult;

console.log('[VALIDATE] util-validate-record.js v1.14 loaded');
console.log('[VALIDATE] Functions exposed: recalculateHandicapsFromRecord, validateHandicapAdjustment, compareHandicapFields, buildHandicapFixPayload, applyZeroRiseToResult');

/*
FILE: util-validate-record.js
VERSION: 1.14
KEY CHANGES from v1.13:
   - ADDED: recalculateHandicapsFromRecord() - wrapper for HandicapAdjustment with zero rise logic
   - ADDED: validateHandicapAdjustment() - validates handicap adjustment data
   - ADDED: compareHandicapFields() - compares stored vs recalculated fields
   - ADDED: buildHandicapFixPayload() - builds fix payload for handicaps
   - ADDED: applyZeroRiseToResult() - applies zero rise to recalculated raw values
   - ADDED: Safety rule - never overwrite valid stored values with undefined/null
   - ADDED: Support for "*multiple*" as valid newAnchor state
   - FIXED: Handicap comparison now compares zero-rised final values against stored finalHcp
   - FIXED: Raw values now correctly displayed as "Raw New" before zero rise
DEPENDS ON: game-data.js, game-order.js, game-loader.js, hcp-adjust.js
STATUS: Ready for integration
*/