/*
FILE: js/util-validate-ui.js
VERSION: 1.12
KEY CHANGES from v1.11:
   - FIXED: formatSingleHandicapValue() now handles undefined/null/NaN values
   - FIXED: NaN no longer appears in handicap table
   - CHANGED: Undefined raw values default to 0
   - PRESERVED: All existing rendering functions from v1.11
DEPENDS ON: UtilValidate, util-core.js, util-photo.js
STATUS: Ready for integration
*/

window.UTIL_VALIDATE_UI_VERSION = "1.12";

var UtilValidateUI = (function() {
    
    console.log("[UTIL-VALIDATE-UI] Initializing v1.12 - Fixed NaN in handicap table");

    // ============================================================
    // HELPERS (with fallback to util-core.js)
    // ============================================================
    
    function escapeHtml(str) {
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
    
    function formatDate(dateStr) {
        if (typeof window.formatDate === 'function') {
            return window.formatDate(dateStr);
        }
        if (!dateStr) return 'Unknown';
        var parts = dateStr.split('-');
        if (parts.length === 3) {
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return parts[2] + ' ' + months[parseInt(parts[1])-1] + ' ' + parts[0];
        }
        return dateStr;
    }
    
    // ============================================================
    // RENDER: Game Info
    // ============================================================
    
    function renderGameInfo(data, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!data) {
            container.innerHTML = '<div style="color:#666; padding:12px;">No data available</div>';
            return;
        }
        
        var courseName = data.gameInfo?.course?.name || data.course?.name || 'Unknown';
        var date = data.gameInfo?.date || data.date || 'Unknown';
        var players = data.players || [];
        var courseSi = data.gameInfo?.course?.si || data.course?.si || [];
        
        var html = '<div class="game-info-grid" style="display:grid; grid-template-columns:auto 1fr; gap:4px 16px; font-size:0.85rem;">';
        html += '<span style="color:#666;">ID</span><span style="color:#e0e0e0;">' + escapeHtml(data.id || 'Unknown') + '</span>';
        html += '<span style="color:#666;">Date</span><span style="color:#e0e0e0;">' + escapeHtml(date) + '</span>';
        html += '<span style="color:#666;">Course</span><span style="color:#e0e0e0;">' + escapeHtml(courseName) + '</span>';
        html += '<span style="color:#666;">Players</span><span style="color:#e0e0e0;">' + (players.length > 0 ? players.map(function(p) { return p.label + ' (' + p.handicap + ')'; }).join(', ') : 'None') + '</span>';
        html += '<span style="color:#666;">Status</span><span style="color:#e0e0e0;">' + escapeHtml(data.status || 'unknown') + '</span>';
        html += '<span style="color:#666;">SI</span><span style="color:#e0e0e0;">' + (courseSi.length > 0 ? courseSi.join(', ') : 'Not available') + '</span>';
        html += '</div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // RENDER: Flight Table
    // ============================================================
    
    function renderFlightTable(scores, players, flightNum, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!scores || !players) {
            container.innerHTML = '<div class="empty-state" style="text-align:center; padding:20px; color:#666;">No data available</div>';
            return;
        }
        
        var flightPlayers = players.filter(function(p) { return p.flight === flightNum; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        
        var names = [];
        var maxTeamSize = Math.max(teamA.length, teamB.length);
        for (var i = 0; i < maxTeamSize; i++) {
            if (i < teamA.length) names.push(teamA[i].label);
            else names.push('-');
        }
        for (var i = 0; i < maxTeamSize; i++) {
            if (i < teamB.length) names.push(teamB[i].label);
            else names.push('-');
        }
        
        names = names.filter(function(n) { return n !== '-'; });
        
        if (names.length === 0) {
            container.innerHTML = '<div class="empty-state" style="text-align:center; padding:20px; color:#666;">No players</div>';
            return;
        }
        
        var html = '<div style="overflow-x:auto; max-width:100%;"><table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
        html += '<tr><th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Hole</th>';
        for (var i = 0; i < names.length; i++) {
            html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">' + escapeHtml(names[i]) + '</th>';
        }
        html += '<th style="background:#1a1a1a; color:#888; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Sv</th></tr>';
        
        for (var h = 0; h < 18; h++) {
            var hole = scores[h];
            var vals = [];
            if (hole) {
                for (var i = 0; i < teamA.length; i++) {
                    if (i === 0) vals.push(hole.a1);
                    else if (i === 1) vals.push(hole.a2);
                    else vals.push('-');
                }
                for (var i = 0; i < teamB.length; i++) {
                    if (i === 0) vals.push(hole.b1);
                    else if (i === 1) vals.push(hole.b2);
                    else vals.push('-');
                }
            } else {
                vals = names.map(function() { return '-'; });
            }
            
            html += '<tr><td style="color:#888;font-weight:600;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (h+1) + '</td>';
            for (var i = 0; i < vals.length; i++) {
                html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + vals[i] + '</td>';
            }
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (hole && hole.saved ? '✅' : '❌') + '</td></tr>';
        }
        html += '</table></div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // RENDER: Team Game Table
    // ============================================================
    
    function renderTeamGameTable(results, containerId, label) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!results) {
            container.innerHTML = '<div style="color:#666; padding:8px;">No data</div>';
            return;
        }
        
        var html = '<div style="overflow-x:auto; max-width:100%;"><table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
        html += '<tr><th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Hole</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">' + label + ' M1</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">' + label + ' M2</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Result</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Running</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Display</th></tr>';
        
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            var cls = (r.display && r.display !== '-' && r.display !== 'AS') ? 'col-total' : '';
            var m1 = (r.match1 !== null) ? (r.match1 > 0 ? 'A' : r.match1 < 0 ? 'B' : 'AS') : '-';
            var m2 = (r.match2 !== null) ? (r.match2 > 0 ? 'A' : r.match2 < 0 ? 'B' : 'AS') : '-';
            var result = (r.holeResult !== null) ? r.holeResult : '-';
            var running = (r.running !== null) ? r.running : '-';
            var display = r.display || '-';
            html += '<tr><td style="color:#888;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + r.hole + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + m1 + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + m2 + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + result + '</td>';
            html += '<td class="' + cls + '" style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + running + '</td>';
            html += '<td class="' + cls + '" style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + display + '</td></tr>';
        }
        html += '</table></div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // RENDER: Stroke Game Table
    // ============================================================
    
    function renderStrkTable(results, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!results) {
            container.innerHTML = '<div style="color:#666; padding:8px;">No data</div>';
            return;
        }
        
        var html = '<div style="overflow-x:auto; max-width:100%;"><table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
        html += '<tr><th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Hole</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Gross A</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Gross B</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Net A</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Net B</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Diff</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Display</th></tr>';
        
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            var cls = (r.display && r.display !== '-' && r.display !== 'AS') ? 'col-total' : '';
            html += '<tr><td style="color:#888;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + r.hole + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (r.grossA !== null ? r.grossA : '-') + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (r.grossB !== null ? r.grossB : '-') + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (r.netA !== null ? r.netA : '-') + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (r.netB !== null ? r.netB : '-') + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (r.diff !== null ? r.diff.toFixed(1) : '-') + '</td>';
            html += '<td class="' + cls + '" style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + r.display + '</td></tr>';
        }
        html += '</table></div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // RENDER: Match Table
    // ============================================================
    
    function renderMatchTable(orderedPlayers, matchResults, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!orderedPlayers || orderedPlayers.length === 0 || !matchResults) {
            container.innerHTML = '<div class="empty-state" style="text-align:center; padding:20px; color:#666;">No match data found</div>';
            return;
        }
        
        var html = '<div style="overflow-x:auto; max-width:100%;"><table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
        html += '<tr><th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Hole</th>';
        for (var p = 0; p < orderedPlayers.length; p++) {
            var player = orderedPlayers[p];
            var teamClass = player.team === 'A' ? 'team-a-col' : 'team-b-col';
            html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;" class="' + teamClass + '">' + escapeHtml(player.label) + '</th>';
        }
        html += '<th style="background:#1a1a1a; color:#ffaa44; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Total</th></tr>';
        
        for (var h = 0; h < matchResults.length; h++) {
            var holeData = matchResults[h];
            if (!holeData) continue;
            
            var holePoints = holeData.points || {};
            var holeClinch = holeData.clinchInfo || {};
            var total = 0;
            var isClinchRow = false;
            
            for (var p = 0; p < orderedPlayers.length; p++) {
                var player = orderedPlayers[p];
                if (holeClinch[player.name] && holeClinch[player.name].clinched) { 
                    isClinchRow = true; 
                    break; 
                }
            }
            
            html += '<tr><td style="color:#888;font-weight:600;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (h+1) + '</td>';
            for (var p = 0; p < orderedPlayers.length; p++) {
                var player = orderedPlayers[p];
                var score = holePoints[player.name] || 0;
                total += score;
                var clinchInfo = holeClinch[player.name] || {};
                var isClinched = clinchInfo.clinched || false;
                var isASAtH18 = clinchInfo.asAtH18 || false;
                var displayText = score.toFixed(1);
                var cellClass = '';
                if (score > 0) cellClass = 'col-green';
                else if (score === 0) cellClass = 'col-red';
                else cellClass = 'col-gold';
                if (isClinched) {
                    cellClass += ' clinch-cell';
                    displayText += ' 🏆';
                } else if (isASAtH18 && h === 17) {
                    displayText += ' ⭐';
                }
                html += '<td class="' + cellClass + '" style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + displayText + '</td>';
            }
            var totalClass = isClinchRow ? 'total-cell clinch-cell' : 'total-cell';
            html += '<td class="' + totalClass + '" style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + total.toFixed(1) + '</td></tr>';
        }
        html += '</table></div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // RENDER: TR Table
    // ============================================================
    
    function renderTRTable(t1Results, t2Results, strkResults, matchPointsPerHole, gameData, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!t1Results || !t2Results || !strkResults || !matchPointsPerHole) {
            container.innerHTML = '<div style="color:#666; padding:8px;">No TR data available</div>';
            return;
        }
        
        var html = '<div style="overflow-x:auto; max-width:100%;"><table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
        html += '<tr><th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Hole</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Team A</th>';
        html += '<th style="background:#1a1a1a; color:#ff6b6b; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Team B</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Rec A</th>';
        html += '<th style="background:#1a1a1a; color:#ff6b6b; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">Rec B</th>';
        html += '<th style="background:#1a1a1a; color:#4caf50; padding:4px 3px; text-align:center; border-bottom:2px solid #2a2a2a;">✅</th></tr>';
        
        for (var i = 0; i < 18; i++) {
            var t1 = t1Results[i] || {};
            var t2 = t2Results[i] || {};
            var strk = strkResults[i] || {};
            var holeMatchData = matchPointsPerHole[i] || {};
            var mA = 0, mB = 0;
            for (var matchKey in holeMatchData) {
                var match = holeMatchData[matchKey];
                mA += match.pointsA || 0;
                mB += match.pointsB || 0;
            }
            var t1A = t1.teamGameTR ? t1.teamGameTR.A : 0.5;
            var t1B = t1.teamGameTR ? t1.teamGameTR.B : 0.5;
            var t2A = t2.teamGameTR ? t2.teamGameTR.A : 0.5;
            var t2B = t2.teamGameTR ? t2.teamGameTR.B : 0.5;
            var sA = strk.strokeTR ? strk.strokeTR.A : 0.5;
            var sB = strk.strokeTR ? strk.strokeTR.B : 0.5;
            var trA = mA + t1A + t2A + sA;
            var trB = mB + t1B + t2B + sB;
            var teamABreakdown = '[' + mA.toFixed(1) + ' + ' + t1A.toFixed(1) + ' + ' + t2A.toFixed(1) + ' + ' + sA.toFixed(1) + ']';
            var teamBBreakdown = '[' + mB.toFixed(1) + ' + ' + t1B.toFixed(1) + ' + ' + t2B.toFixed(1) + ' + ' + sB.toFixed(1) + ']';
            var recA = gameData?.results?.tr?.teamA?.[i];
            var recB = gameData?.results?.tr?.teamB?.[i];
            var recMatch = (recA !== undefined && recA !== null && recB !== undefined && recB !== null);
            var match = recMatch && Math.abs(trA - recA) < 0.01 && Math.abs(trB - recB) < 0.01;
            var matchClass = match ? 'col-match' : 'col-mismatch';
            var recADisplay = (recA !== undefined && recA !== null) ? recA : '-';
            var recBDisplay = (recB !== undefined && recB !== null) ? recB : '-';
            var rowClass = (i === 17) ? ' final-row' : '';
            html += '<tr class="' + rowClass + '"><td style="color:#888;font-weight:600;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (i+1) + '</td>';
            html += '<td style="color:#4caf50;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + teamABreakdown + ' = <strong>' + trA.toFixed(1) + '</strong></td>';
            html += '<td style="color:#ff6b6b;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + teamBBreakdown + ' = <strong>' + trB.toFixed(1) + '</strong></td>';
            html += '<td class="' + matchClass + '" style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + recADisplay + '</td>';
            html += '<td class="' + matchClass + '" style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + recBDisplay + '</td>';
            html += '<td style="text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (match ? '✅' : '❌') + '</td></tr>';
            if (i === 17) {
                html += '<tr class="final-row"><td colspan="6" style="color:#ffaa44; font-weight:700; text-align:center; padding:8px; border-top:2px solid #ffaa44;">🏆 FINAL RESULT: ' + trA.toFixed(1) + ' - ' + trB.toFixed(1) + ' 🏆</td></tr>';
            }
        }
        html += '</table></div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // RENDER: Photo Status
    // ============================================================
    
    function renderPhotoStatus(photoStatus, containerId, onSelectPhoto) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!photoStatus) {
            container.innerHTML = '<div style="color:#666; padding:8px;">No photo data available</div>';
            return;
        }
        
        var hasPhoto = photoStatus.hasPhoto;
        var url = photoStatus.url || null;
        var path = photoStatus.path || null;
        var expectedPath = photoStatus.expectedPath || null;
        
        var html = '<div style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">';
        html += '<div style="font-size:0.75rem; font-weight:600; color:#ffaa44; margin-bottom:8px;">📸 CELEBRATION PHOTO</div>';
        
        if (hasPhoto && url) {
            html += '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">';
            html += '<div style="width:80px; height:80px; border-radius:8px; overflow:hidden; border:1px solid #4caf50; flex-shrink:0; background:#0a0a0a; display:flex; align-items:center; justify-content:center;">';
            html += '<img src="' + escapeHtml(url) + '" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display=\'none\'; this.parentNode.innerHTML=\'<span style=\'font-size:2rem;\'>📸</span>\';">';
            html += '</div>';
            html += '<div style="flex:1; min-width:120px;">';
            html += '<div style="font-size:0.7rem; color:#4caf50;">✅ Photo present</div>';
            html += '<div style="font-size:0.6rem; color:#888; word-break:break-all; margin-top:2px;">' + escapeHtml(path || '') + '</div>';
            html += '<button class="btn btn-secondary" style="margin-top:4px; padding:6px 12px; font-size:0.7rem; width:auto; display:inline-block;" onclick="' + (typeof onSelectPhoto === 'function' ? 'this._onSelect()' : '') + '">🔄 Change Photo</button>';
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">';
            html += '<div style="width:80px; height:80px; border-radius:8px; border:1px solid #ff6b6b; flex-shrink:0; background:#0a0a0a; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#555;">❌</div>';
            html += '<div style="flex:1; min-width:120px;">';
            html += '<div style="font-size:0.7rem; color:#ff6b6b;">❌ Photo MISSING</div>';
            if (expectedPath) {
                html += '<div style="font-size:0.6rem; color:#888; word-break:break-all; margin-top:2px;">Expected: ' + escapeHtml(expectedPath) + '</div>';
            }
            html += '<button class="btn btn-photo" style="margin-top:4px; padding:6px 12px; font-size:0.7rem; width:auto; display:inline-block;" onclick="' + (typeof onSelectPhoto === 'function' ? 'this._onSelect()' : '') + '">📂 Select Photo</button>';
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        if (typeof onSelectPhoto === 'function') {
            var buttons = container.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i]._onSelect = onSelectPhoto;
            }
        }
    }
    
    // ============================================================
    // v1.11: RENDER: Handicap Adjustment Card (separate card)
    // ============================================================
    
    function renderHandicapAdjustmentCard(validationResult, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        // Check if handicap data exists
        var storedHandicaps = validationResult.handicapStored;
        var recalculated = validationResult.handicapRecalculated;
        var isValid = validationResult.handicapValid !== undefined ? validationResult.handicapValid : true;
        var summary = validationResult.handicapSummary || { totalFields: 0, mismatched: 0, matched: 0 };
        var recordPlayers = validationResult.players || [];
        
        // If no stored handicaps, show missing state
        if (!storedHandicaps) {
            container.innerHTML = `
                <div style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span style="font-size:1.1rem;">❌</span>
                        <span style="font-weight:600; color:#ff6b6b; font-size:0.85rem;">Handicap Adjustment</span>
                        <span style="font-size:0.7rem; color:#ff6b6b; margin-left:auto;">MISSING</span>
                    </div>
                    <div style="font-size:0.75rem; color:#888; padding:4px 0;">
                        No adjustedHandicaps data found in this record.
                    </div>
                    <div style="font-size:0.7rem; color:#ffaa44; padding:4px 0; border-top:1px solid #1a1a1a; margin-top:4px;">
                        Click "Fix Record" to calculate and add handicap data.
                    </div>
                </div>
            `;
            return;
        }
        
        // Check if recalculated data exists
        if (!recalculated) {
            container.innerHTML = `
                <div style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span style="font-size:1.1rem;">⚠️</span>
                        <span style="font-weight:600; color:#ffaa44; font-size:0.85rem;">Handicap Adjustment</span>
                        <span style="font-size:0.7rem; color:#ffaa44; margin-left:auto;">CANNOT RECALCULATE</span>
                    </div>
                    <div style="font-size:0.75rem; color:#888; padding:4px 0;">
                        ${validationResult.handicapError || 'Could not recalculate handicaps from raw data.'}
                    </div>
                    <div style="font-size:0.7rem; color:#ffaa44; padding:4px 0; border-top:1px solid #1a1a1a; margin-top:4px;">
                        Ensure all 18 holes are complete and valid.
                    </div>
                </div>
            `;
            return;
        }
        
        // Build the handicap table
        var storedPlayers = storedHandicaps.players || [];
        var recalcPlayers = recalculated.players || [];
        
        // Build maps for lookup
        var storedMap = {};
        for (var i = 0; i < storedPlayers.length; i++) {
            storedMap[storedPlayers[i].name] = storedPlayers[i];
        }
        
        var recalcMap = {};
        for (var i = 0; i < recalcPlayers.length; i++) {
            recalcMap[recalcPlayers[i].name] = recalcPlayers[i];
        }
        
        // Build player map from record players (for correct team info)
        var recordPlayerMap = {};
        for (var i = 0; i < recordPlayers.length; i++) {
            recordPlayerMap[recordPlayers[i].name] = recordPlayers[i];
        }
        
        // Get all player names
        var allNames = {};
        for (var name in storedMap) { allNames[name] = true; }
        for (var name in recalcMap) { allNames[name] = true; }
        var playerNames = Object.keys(allNames);
        
        // Build player list with team from record
        var players = [];
        for (var i = 0; i < playerNames.length; i++) {
            var name = playerNames[i];
            var stored = storedMap[name];
            var recalc = recalcMap[name];
            var recordPlayer = recordPlayerMap[name];
            var team = recordPlayer ? recordPlayer.team : (stored ? stored.team : (recalc ? recalc.team : 'B'));
            var startingHcp = stored ? stored.startingHcp : (recalc ? recalc.startingHcp : 0);
            players.push({
                name: name,
                label: stored ? stored.label : (recalc ? recalc.label : name.substring(0, 3).toUpperCase()),
                team: team,
                startingHcp: startingHcp,
                stored: stored,
                recalc: recalc
            });
        }
        
        // Sort by team (A then B), then by starting handicap
        players.sort(function(a, b) {
            if (a.team !== b.team) return a.team === 'A' ? -1 : 1;
            return a.startingHcp - b.startingHcp;
        });
        
        // Build HTML
        var html = '<div style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">';
        
        // Header with summary
        var hcpStatusIcon = isValid ? '✅' : '❌';
        var hcpStatusColor = isValid ? '#4caf50' : '#ff6b6b';
        html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">';
        html += '<span style="font-size:1.1rem;">🏌️</span>';
        html += '<span style="font-weight:600; color:#ffaa44; font-size:0.85rem;">Handicap Adjustment</span>';
        html += '<span style="font-size:0.7rem; color:' + hcpStatusColor + '; margin-left:auto; font-weight:600;">' + hcpStatusIcon + ' ' + (isValid ? 'VALID' : 'NEEDS FIX') + '</span>';
        html += '</div>';
        
        // Summary line
        html += '<div style="display:flex; gap:12px; font-size:0.65rem; color:#888; margin-bottom:8px; padding:4px 0; border-bottom:1px solid #1a1a1a;">';
        html += '<span>Anchor: <strong style="color:#ffaa44;">' + escapeHtml(storedHandicaps.anchor || 'Unknown') + '</strong></span>';
        html += '<span>New Anchor: <strong style="color:#ffaa44;">' + escapeHtml(storedHandicaps.newAnchor || 'None') + '</strong></span>';
        html += '<span>Zero Rise: <strong style="color:#4caf50;">' + (storedHandicaps.zeroRiseAmount || 0) + '</strong></span>';
        if (summary.totalFields > 0) {
            html += '<span style="margin-left:auto;">✅ ' + summary.matched + ' ❌ ' + summary.mismatched + '</span>';
        }
        html += '</div>';
        
        // Table
        html += '<div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">';
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.6rem; min-width:380px;">';
        
        // Table header
        html += '<thead><tr style="background:#1a1a1a;">';
        html += '<th style="padding:3px 3px; text-align:left; font-size:0.6rem; color:#888;">Player</th>';
        html += '<th style="padding:3px 3px; text-align:center; font-size:0.6rem; color:#888;">Old</th>';
        html += '<th style="padding:3px 3px; text-align:center; font-size:0.6rem; color:#888;" colspan="2">Anc</th>';
        html += '<th style="padding:3px 3px; text-align:center; font-size:0.6rem; color:#888;" colspan="2">Perf</th>';
        html += '<th style="padding:3px 3px; text-align:center; font-size:0.6rem; color:#888;" colspan="2">New</th>';
        html += '<th style="padding:3px 3px; text-align:center; font-size:0.6rem; color:#888;">Status</th>';
        html += '</tr></thead><tbody>';
        
        // Sub-header
        html += '<tr style="background:#0a0a0a; border-bottom:1px solid #2a2a2a;">';
        html += '<td style="padding:2px 3px;"></td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#555;"></td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#4caf50;">Cur</td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#ffaa44;">Exp</td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#4caf50;">Cur</td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#ffaa44;">Exp</td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#4caf50;">Cur</td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#ffaa44;">Exp</td>';
        html += '<td style="padding:2px 3px; text-align:center; font-size:0.5rem; color:#555;"></td>';
        html += '</tr>';
        
        var currentTeam = null;
        var hasMismatch = false;
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var stored = p.stored;
            var recalc = p.recalc;
            
            // Team separator
            if (p.team !== currentTeam) {
                currentTeam = p.team;
                var teamLabel = currentTeam === 'A' ? 'TEAM A' : 'TEAM B';
                html += '<tr style="background:#1a2a1a; border-top:2px solid #000;">';
                html += '<td colspan="9" style="padding:4px 3px; text-align:center; color:#4caf50; font-weight:600; font-size:0.65rem;">' + teamLabel + '</td>';
                html += '</tr>';
            }
            
            // Check field mismatches
            var playerHasMismatch = false;
            var fields = ['anchorAdj', 'perfAdj', 'finalHcp'];
            var fieldStatus = {};
            for (var f = 0; f < fields.length; f++) {
                var field = fields[f];
                var storedVal = stored ? stored[field] : undefined;
                var recalcVal = recalc ? recalc[field] : undefined;
                var isEqual;
                if (typeof storedVal === 'number' && typeof recalcVal === 'number') {
                    isEqual = Math.abs(storedVal - recalcVal) < 0.01;
                } else {
                    isEqual = storedVal === recalcVal;
                }
                fieldStatus[field] = isEqual;
                if (!isEqual) playerHasMismatch = true;
            }
            if (playerHasMismatch) hasMismatch = true;
            
            // Starting handicap
            var stDisplay = (p.startingHcp !== undefined && p.startingHcp !== null) ? p.startingHcp : '?';
            var isAnchor = stored && storedHandicaps.anchor === p.name;
            var isNewAnchor = stored && storedHandicaps.newAnchor === p.name;
            
            // Get values
            var ancCur = stored ? stored.anchorAdj : 0;
            var ancExp = recalc ? recalc.anchorAdj : 0;
            var ancRawCur = stored ? stored.anchorRaw : undefined;
            var ancRawExp = recalc ? recalc.anchorRaw : 0;
            
            var perfCur = stored ? stored.perfAdj : 0;
            var perfExp = recalc ? recalc.perfAdj : 0;
            var perfRawCur = stored ? stored.perfRaw : undefined;
            var perfRawExp = recalc ? recalc.perfRaw : 0;
            
            // Get final handicap from recalc
            var finalCur = stored ? stored.finalHcp : '—';
            var finalExp = recalc ? (recalc.newHcp !== undefined ? recalc.newHcp : (recalc.finalHcp !== undefined ? recalc.finalHcp : recalc.rawNew)) : '—';
            
            var ancMatch = fieldStatus.anchorAdj;
            var perfMatch = fieldStatus.perfAdj;
            var finalMatch = (finalCur === finalExp) || (typeof finalCur === 'number' && typeof finalExp === 'number' && Math.abs(finalCur - finalExp) < 0.01);
            
            // v1.12: Format with NaN protection
            var ancDisplay = formatHandicapCell(ancCur, ancRawCur, ancExp, ancRawExp);
            var perfDisplay = formatHandicapCell(perfCur, perfRawCur, perfExp, perfRawExp);
            
            var finalColor = finalMatch ? '#4caf50' : '#ff6b6b';
            var stColor = isAnchor ? '#ffaa44' : '#ffffff';
            
            var rowBg = playerHasMismatch ? '#1a0a0a' : '#0a0a0a';
            html += '<tr style="border-bottom:1px solid #1a1a1a; background:' + rowBg + ';">';
            html += '<td style="padding:4px 3px; text-align:left; font-weight:600; color:' + stColor + ';">' + escapeHtml(p.label) + (isAnchor ? ' ⭐' : '') + (isNewAnchor ? ' 👑' : '') + '</td>';
            html += '<td style="padding:4px 3px; text-align:center; color:' + stColor + ';">' + stDisplay + '</td>';
            
            // Anc: Cur | Exp
            html += '<td style="padding:4px 3px; text-align:center;">' + ancDisplay.cur + '</td>';
            html += '<td style="padding:4px 3px; text-align:center;">' + ancDisplay.exp + '</td>';
            
            // Perf: Cur | Exp
            html += '<td style="padding:4px 3px; text-align:center;">' + perfDisplay.cur + '</td>';
            html += '<td style="padding:4px 3px; text-align:center;">' + perfDisplay.exp + '</td>';
            
            // New: Cur | Exp
            html += '<td style="padding:4px 3px; text-align:center; color:' + finalColor + '; font-weight:600;">' + escapeHtml(String(finalCur)) + '</td>';
            html += '<td style="padding:4px 3px; text-align:center; color:' + (finalMatch ? '#4caf50' : '#ffaa44') + '; font-weight:' + (finalMatch ? '400' : '700') + ';">' + escapeHtml(String(finalExp)) + '</td>';
            
            var statusIcon = playerHasMismatch ? '❌' : '✅';
            html += '<td style="padding:4px 3px; text-align:center;">' + statusIcon + '</td>';
            html += '</tr>';
        }
        
        html += '</tbody></table></div>';
        
        // Footer
        if (hasMismatch) {
            html += '<div style="font-size:0.65rem; color:#ff6b6b; padding:6px 0; border-top:1px solid #1a1a1a; margin-top:6px;">';
            html += '❌ ' + (summary.mismatched || 0) + ' field mismatch' + ((summary.mismatched || 0) > 1 ? 'es' : '') + ' found. Click "Fix Record" to correct.';
            html += '</div>';
        } else {
            html += '<div style="font-size:0.65rem; color:#4caf50; padding:6px 0; border-top:1px solid #1a1a1a; margin-top:6px;">';
            html += '✅ All handicap fields match recalculated values.';
            html += '</div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // v1.11: RENDER: Validation Summary (with integrated detailed validation)
    // ============================================================
    
    function renderValidationSummary(validationResult, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!validationResult) {
            container.innerHTML = '<div style="color:#666; padding:8px;">No validation data</div>';
            return;
        }
        
        var summary = validationResult.summary || { totalFields: 0, mismatched: 0, matched: 0 };
        var isCompletedGame = validationResult.isCompletedGame || false;
        var photoStatus = validationResult.photoStatus || { hasPhoto: false };
        var status = validationResult.status || 'unknown';
        var bothSigned = validationResult.bothSigned || false;
        var expectedStatus = validationResult.expectedStatus || status;
        var mismatches = validationResult.mismatches || [];
        
        var html = '<div style="padding:12px 0;">';
        
        // Overall status
        var isValid = validationResult.valid;
        html += '<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:12px; border-radius:8px; background:' + (isValid ? '#0a2a0a' : '#2a0a0a') + '; border:1px solid ' + (isValid ? '#2a5a2a' : '#5a2a2a') + ';">';
        html += '<span style="font-size:1.5rem;">' + (isValid ? '✅' : '❌') + '</span>';
        html += '<div><div style="font-weight:700; color:' + (isValid ? '#4caf50' : '#ff6b6b') + ';">' + (isValid ? 'VALID' : 'NEEDS FIX') + '</div>';
        html += '<div style="font-size:0.7rem; color:#888;">' + summary.matched + ' fields match, ' + summary.mismatched + ' fields need attention</div></div>';
        html += '</div>';
        
        // Status info
        html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; font-size:0.75rem;">';
        html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
        html += '<span style="color:#888;">Status</span><br><span style="color:' + (status === expectedStatus ? '#4caf50' : '#ff6b6b') + '; font-weight:600;">' + escapeHtml(status) + (status !== expectedStatus ? ' → ' + escapeHtml(expectedStatus) : '') + '</span>';
        html += '</div>';
        html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
        html += '<span style="color:#888;">Signatures</span><br><span style="color:' + (bothSigned ? '#4caf50' : '#888') + '; font-weight:600;">' + (bothSigned ? '✅ Both signed' : '⏳ Not both signed') + '</span>';
        html += '</div>';
        html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
        html += '<span style="color:#888;">Completed Game</span><br><span style="color:' + (isCompletedGame ? '#4caf50' : '#888') + '; font-weight:600;">' + (isCompletedGame ? '✅ Yes' : 'No') + '</span>';
        html += '</div>';
        html += '<div style="background:#0a0a0a; padding:8px; border-radius:6px; border:1px solid #2a2a2a;">';
        html += '<span style="color:#888;">Celebration Photo</span><br><span style="color:' + (photoStatus.hasPhoto ? '#4caf50' : (isCompletedGame ? '#ff6b6b' : '#888')) + '; font-weight:600;">' + (photoStatus.hasPhoto ? '✅ Present' : (isCompletedGame ? '❌ MISSING' : 'Not required')) + '</span>';
        html += '</div>';
        html += '</div>';
        
        // ============================================================
        // v1.11: INTEGRATED DETAILED VALIDATION TABLE (scrollable, 300px)
        // ============================================================
        
        if (mismatches && mismatches.length > 0) {
            html += '<div style="margin-top:12px;">';
            html += '<div style="font-size:0.7rem; font-weight:600; color:#ff6b6b; margin-bottom:6px;">🔴 Field Mismatches (' + mismatches.length + ')</div>';
            html += '<div style="max-height:300px; overflow-y:auto; background:#0a0a0a; border-radius:6px; border:1px solid #2a2a2a; padding:6px;">';
            
            for (var i = 0; i < mismatches.length; i++) {
                var m = mismatches[i];
                html += '<div style="font-size:0.7rem; padding:3px 6px; border-bottom:1px solid #1a1a1a; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">';
                html += '<span style="color:#888; flex:1; min-width:80px;">' + escapeHtml(m.field) + '</span>';
                html += '<span style="color:#ff6b6b;">' + escapeHtml(String(m.current)) + '</span>';
                html += '<span style="color:#666;">→</span>';
                html += '<span style="color:#4caf50;">' + escapeHtml(String(m.expected)) + '</span>';
                html += '</div>';
            }
            
            html += '</div>'; // end scrollable
            html += '</div>';
        } else {
            html += '<div style="margin-top:12px; padding:8px; background:#0a2a0a; border-radius:6px; border:1px solid #2a5a2a; text-align:center; font-size:0.75rem; color:#4caf50;">';
            html += '✅ All fields match. No mismatches found.';
            html += '</div>';
        }
        
        // Summary counts
        if (summary.totalFields > 0) {
            html += '<div style="display:flex; gap:16px; flex-wrap:wrap; padding:8px; margin-top:12px; background:#0a0a0a; border-radius:6px; border:1px solid #2a2a2a; font-size:0.75rem;">';
            html += '<div><span style="color:#888;">Total Fields:</span> <strong style="color:#fff;">' + summary.totalFields + '</strong></div>';
            html += '<div><span style="color:#4caf50;">✅ Matched:</span> <strong style="color:#4caf50;">' + summary.matched + '</strong></div>';
            html += '<div><span style="color:#ff6b6b;">❌ Mismatched:</span> <strong style="color:#ff6b6b;">' + summary.mismatched + '</strong></div>';
            html += '</div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // v1.12: FORMAT HANDICAP CELL - with NaN protection
    // ============================================================
    
    function formatHandicapCell(curAdj, curRaw, expAdj, expRaw) {
        var curDisplay = formatSingleHandicapValue(curAdj, curRaw);
        var expDisplay = formatSingleHandicapValue(expAdj, expRaw);
        
        return {
            cur: curDisplay,
            exp: expDisplay
        };
    }
    
    // v1.12: Fixed - handles undefined/null/NaN values
    function formatSingleHandicapValue(adj, raw) {
        // Safety checks - handle undefined, null, NaN
        var adjVal = (adj !== undefined && adj !== null && !isNaN(adj)) ? adj : 0;
        var rawVal = (raw !== undefined && raw !== null && !isNaN(raw)) ? raw : 0;
        
        var adjAbs = Math.abs(adjVal);
        var rawAbs = Math.abs(rawVal);
        
        var adjColor = '#888';
        var rawColor = '#888';
        
        if (adjVal > 0) {
            adjColor = '#4caf50';
            rawColor = '#ff6b6b';
        } else if (adjVal < 0) {
            adjColor = '#ff6b6b';
            rawColor = '#4caf50';
        } else {
            adjColor = '#888';
            rawColor = '#888';
        }
        
        var display = '<span style="color:' + adjColor + '; font-weight:600;">' + adjAbs + '</span>';
        display += ' <span style="color:' + rawColor + '; font-weight:400;">[' + rawAbs + ']</span>';
        
        return display;
    }
    
    // ============================================================
    // RENDER: Summary
    // ============================================================
    
    function renderSummary(t1Results, t2Results, strkResults, matchPointsPerHole, gameData, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        if (!t1Results || !t2Results || !strkResults || !matchPointsPerHole) {
            container.innerHTML = '<div style="color:#666; padding:8px;">No summary data available</div>';
            return;
        }
        
        var t1Final = t1Results[17] || {};
        var t2Final = t2Results[17] || {};
        var strkFinal = strkResults[17] || {};
        
        var t1Display = t1Final.display || '-';
        var t2Display = t2Final.display || '-';
        var strkDisplay = strkFinal.display || '-';
        
        var recT1 = gameData?.results?.game2?.displayT1?.[17] || '-';
        var recT2 = gameData?.results?.game2?.displayT2?.[17] || '-';
        var recStrk = gameData?.results?.game3?.displayStrk?.[17] || '-';
        
        var t1Match = (t1Display === recT1) || (t1Display === '-' && recT1 === '-');
        var t2Match = (t2Display === recT2) || (t2Display === '-' && recT2 === '-');
        var strkMatch = (strkDisplay === recStrk) || (strkDisplay === '-' && recStrk === '-');
        
        var h18MatchData = matchPointsPerHole[17] || {};
        var h18mA = 0, h18mB = 0;
        for (var matchKey in h18MatchData) {
            var match = h18MatchData[matchKey];
            h18mA += match.pointsA || 0;
            h18mB += match.pointsB || 0;
        }
        
        var t1A = t1Final.teamGameTR ? t1Final.teamGameTR.A : 0.5;
        var t1B = t1Final.teamGameTR ? t1Final.teamGameTR.B : 0.5;
        var t2A = t2Final.teamGameTR ? t2Final.teamGameTR.A : 0.5;
        var t2B = t2Final.teamGameTR ? t2Final.teamGameTR.B : 0.5;
        var sA = strkFinal.strokeTR ? strkFinal.strokeTR.A : 0.5;
        var sB = strkFinal.strokeTR ? strkFinal.strokeTR.B : 0.5;
        
        var trA_h18 = h18mA + t1A + t2A + sA;
        var trB_h18 = h18mB + t1B + t2B + sB;
        
        var recA = gameData?.finalResults?.teamAScore || gameData?.results?.tr?.teamA?.[17] || '-';
        var recB = gameData?.finalResults?.teamBScore || gameData?.results?.tr?.teamB?.[17] || '-';
        var trMatch = (typeof recA === 'number' && typeof recB === 'number' &&
                       Math.abs(trA_h18 - recA) < 0.01 && Math.abs(trB_h18 - recB) < 0.01);
        
        var html = '<div style="display:flex; gap:24px; flex-wrap:wrap; padding:12px 0;">';
        html += '<div style="background:#0a0a0a; padding:8px 16px; border-radius:8px; border-left:3px solid #4caf50;">';
        html += '<div style="font-size:0.65rem; color:#888;">T-1</div>';
        html += '<div style="font-size:1rem; font-weight:700; color:' + (t1Match ? '#fff' : '#ff6b6b') + ';">' + t1Display + ' | Record: ' + recT1 + ' ' + (t1Match ? '✅' : '❌') + '</div></div>';
        
        html += '<div style="background:#0a0a0a; padding:8px 16px; border-radius:8px; border-left:3px solid #4caf50;">';
        html += '<div style="font-size:0.65rem; color:#888;">T-2</div>';
        html += '<div style="font-size:1rem; font-weight:700; color:' + (t2Match ? '#fff' : '#ff6b6b') + ';">' + t2Display + ' | Record: ' + recT2 + ' ' + (t2Match ? '✅' : '❌') + '</div></div>';
        
        html += '<div style="background:#0a0a0a; padding:8px 16px; border-radius:8px; border-left:3px solid #4caf50;">';
        html += '<div style="font-size:0.65rem; color:#888;">Strk</div>';
        html += '<div style="font-size:1rem; font-weight:700; color:' + (strkMatch ? '#fff' : '#ff6b6b') + ';">' + strkDisplay + ' | Record: ' + recStrk + ' ' + (strkMatch ? '✅' : '❌') + '</div></div>';
        
        var trClass = trMatch ? '' : 'mismatch';
        html += '<div style="background:#0a0a0a; padding:8px 16px; border-radius:8px; border-left:4px solid #ffaa44; flex:1 1 100%;">';
        html += '<div style="font-size:0.65rem; color:#ffaa44; font-weight:700;">🏆 TR at H18 (FINAL RESULT)</div>';
        html += '<div style="font-size:1.5rem; font-weight:700; color:' + (trMatch ? '#fff' : '#ff6b6b') + ';">';
        html += trA_h18.toFixed(1) + ' - ' + trB_h18.toFixed(1) + ' | Record: ' + recA + ' - ' + recB + ' ' + (trMatch ? '✅' : '❌');
        html += '</div></div></div>';
        
        var allMatch = t1Match && t2Match && strkMatch;
        var verdict = (allMatch && trMatch) ? '✅ All values match the record.' : '❌ Mismatch detected. The record contains stale data.';
        html += '<div style="margin-top:12px; padding:8px 12px; border-radius:6px; background:' + (allMatch && trMatch ? '#0a2a0a' : '#2a0a0a') + '; border:1px solid ' + (allMatch && trMatch ? '#2a5a2a' : '#5a2a2a') + ';">' + verdict + '</div>';
        html += '<div style="margin-top:12px; font-size:0.7rem; color:#666; border-top:1px solid #2a2a2a; padding-top:8px;">';
        html += 'H18 Breakdown: Match (' + h18mA.toFixed(1) + ' - ' + h18mB.toFixed(1) + ') + T-1 (' + t1A.toFixed(1) + ' - ' + t1B.toFixed(1) + ') + T-2 (' + t2A.toFixed(1) + ' - ' + t2B.toFixed(1) + ') + Strk (' + sA.toFixed(1) + ' - ' + sB.toFixed(1) + ') = ' + trA_h18.toFixed(1) + ' - ' + trB_h18.toFixed(1);
        html += '</div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // RENDER: Fix Preview Modal
    // ============================================================
    
    function showFixPreview(record, recalculated, previewData, backupId, onConfirm) {
        var existing = document.getElementById('previewOverlay');
        if (existing) existing.remove();
        
        var overlay = document.createElement('div');
        overlay.id = 'previewOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:20000;padding:20px;overflow-y:auto;';
        
        var hasChanges = previewData.hasChanges;
        var changeCount = previewData.changeCount || previewData.changes.length;
        var unchangedCount = previewData.unchangedCount || previewData.unchanged.length;
        var notTouchedCount = previewData.notTouchedCount || previewData.notTouched.length;
        var mismatchedHoles = previewData.mismatchedHoles || [];
        var photoStatus = previewData.photoStatus || { hasPhoto: false };
        
        var data = record.rawData || record;
        var courseName = data.gameInfo?.course?.name || data.course?.name || 'Unknown';
        var date = data.gameInfo?.date || data.date || 'Unknown';
        var players = data.players || [];
        var playerNames = players.map(function(p) { return p.label + ' (' + p.handicap + ')'; }).join(', ');
        
        var html = '<div style="background:#1a1a1a;border-radius:28px;padding:28px;max-width:650px;width:95%;max-height:90vh;overflow-y:auto;border:2px solid #4caf50;">';
        html += '<div style="font-size:1.3rem;font-weight:700;color:#ffaa44;text-align:center;margin-bottom:4px;">🔍 Fix Preview</div>';
        html += '<div style="font-size:0.75rem;color:#888;text-align:center;margin-bottom:16px;">Review changes before writing to Firestore</div>';
        
        html += '<div style="background:#0a0a0a;border-radius:12px;padding:12px 16px;margin-bottom:16px;border:1px solid #2a2a2a;font-size:0.8rem;">';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Game ID</span><span style="color:#fff;">' + escapeHtml(record.id) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Date</span><span style="color:#fff;">' + escapeHtml(date) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Course</span><span style="color:#fff;">' + escapeHtml(courseName) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Players</span><span style="color:#fff;font-size:0.7rem;">' + escapeHtml(playerNames) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Status</span><span style="color:#fff;">';
        if (record.status !== 'completed') {
            html += '<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#2a2a1a;color:#ffaa44;">' + escapeHtml(record.status) + '</span> → <span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#0a2a0a;color:#4caf50;">completed</span>';
        } else {
            html += '<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#0a2a0a;color:#4caf50;">' + escapeHtml(record.status) + '</span>';
        }
        html += '</span></div>';
        
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid #1a1a1a;margin-top:4px;padding-top:4px;"><span style="color:#888;">📸 Celebration Photo</span><span style="color:#fff;">';
        if (photoStatus.hasPhoto) {
            html += '<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#0a2a0a;color:#4caf50;">✅ Present</span>';
        } else {
            html += '<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#2a0a0a;color:#ff6b6b;">❌ MISSING</span>';
        }
        html += '</span></div></div>';
        
        html += '<div style="margin-bottom:12px;padding:12px;background:#0a0a0a;border-radius:12px;border:1px solid #2a2a2a;">';
        html += '<div style="font-size:0.7rem;font-weight:700;color:#4caf50;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🏌️ Hole Status (TR Values)</div>';
        html += '<div style="font-size:0.7rem;color:#888;margin-bottom:6px;">✅ = Already correct &nbsp;|&nbsp; 🔴 = Needs fixing</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;">';
        for (var i = 1; i <= 18; i++) {
            var isMismatch = mismatchedHoles.indexOf(i) !== -1;
            var cls = isMismatch ? 'fix' : 'ok';
            var label = isMismatch ? '🔴 H' + i : '✅ H' + i;
            html += '<div style="padding:4px 6px;border-radius:4px;text-align:center;font-size:0.7rem;font-weight:600;' + (isMismatch ? 'background:#2a0a0a;color:#ff6b6b;border:1px solid #5a2a2a;' : 'background:#0a2a0a;color:#4caf50;border:1px solid #2a5a2a;') + '">' + label + '</div>';
        }
        html += '</div>';
        if (mismatchedHoles.length > 0) {
            html += '<div style="margin-top:6px;font-size:0.7rem;color:#ff6b6b;">Holes needing fix: ' + mismatchedHoles.join(', ') + '</div>';
        } else {
            html += '<div style="margin-top:6px;font-size:0.7rem;color:#4caf50;">All holes correct!</div>';
        }
        html += '</div>';
        
        html += '<div style="display:flex;justify-content:center;gap:20px;padding:10px 0;margin:12px 0;border-top:1px solid #2a2a2a;border-bottom:1px solid #2a2a2a;flex-wrap:wrap;">';
        if (hasChanges) {
            html += '<div style="font-size:0.8rem;text-align:center;"><span style="font-weight:700;font-size:1.2rem;display:block;color:#ff6b6b;">' + changeCount + '</span><span style="color:#888;font-size:0.65rem;">will be updated</span></div>';
        } else {
            html += '<div style="font-size:0.8rem;text-align:center;"><span style="font-weight:700;font-size:1.2rem;display:block;color:#4caf50;">0</span><span style="color:#888;font-size:0.65rem;">changes needed</span></div>';
        }
        html += '<div style="font-size:0.8rem;text-align:center;"><span style="font-weight:700;font-size:1.2rem;display:block;color:#4caf50;">' + unchangedCount + '</span><span style="color:#888;font-size:0.65rem;">already match</span></div>';
        html += '<div style="font-size:0.8rem;text-align:center;"><span style="font-weight:700;font-size:1.2rem;display:block;color:#4a8af4;">' + notTouchedCount + '</span><span style="color:#888;font-size:0.65rem;">not touched</span></div>';
        html += '</div>';
        
        if (!hasChanges) {
            html += '<div style="text-align:center;padding:30px 20px;color:#4caf50;font-size:1.1rem;">';
            html += '<span style="font-size:3rem;display:block;margin-bottom:12px;">✅</span>';
            html += 'Record is already correct. No changes needed.';
            html += '</div>';
        } else {
            html += '<div style="margin-bottom:12px;padding:12px;background:#0a0a0a;border-radius:12px;border:1px solid #2a2a2a;">';
            html += '<div style="font-size:0.7rem;font-weight:700;color:#ff6b6b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🔴 Changes to be applied (' + changeCount + ' items)</div>';
            for (var i = 0; i < previewData.changes.length; i++) {
                var change = previewData.changes[i];
                var changeIcon = change.type || '📝';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid #1a1a1a;font-size:0.8rem;">';
                html += '<span style="color:#888;flex:1;">' + changeIcon + ' ' + escapeHtml(change.field) + '</span>';
                html += '<span style="color:#ff6b6b;font-weight:600;">' + escapeHtml(String(change.current)) + '</span>';
                html += '<span style="color:#666;margin:0 8px;">→</span>';
                html += '<span style="color:#4caf50;font-weight:600;">' + escapeHtml(String(change.new)) + '</span>';
                html += '</div>';
            }
            html += '</div>';
            
            html += '<div style="margin-bottom:12px;padding:12px;background:#0a0a0a;border-radius:12px;border:1px solid #2a2a2a;">';
            html += '<div style="font-size:0.7rem;font-weight:700;color:#4a8af4;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🔵 NOT TOUCHED (preserved)</div>';
            for (var i = 0; i < previewData.notTouched.length; i++) {
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid #1a1a1a;font-size:0.8rem;">';
                html += '<span style="color:#888;flex:1;">🔒 ' + escapeHtml(previewData.notTouched[i]) + '</span>';
                html += '<span style="color:#4a8af4;">preserved</span>';
                html += '</div>';
            }
            html += '</div>';
        }
        
        html += '<div style="display:flex;gap:12px;margin-top:16px;justify-content:center;">';
        if (hasChanges) {
            html += '<button style="padding:14px 36px;border-radius:40px;font-weight:700;font-size:1rem;cursor:pointer;border:2px solid #4caf50;background:#1a3a1a;color:#4caf50;min-width:120px;" id="previewConfirmBtn">✅ CONFIRM & WRITE</button>';
        } else {
            html += '<button style="padding:14px 36px;border-radius:40px;font-weight:700;font-size:1rem;cursor:pointer;border:2px solid #4caf50;background:#1a3a1a;color:#4caf50;min-width:120px;opacity:0.4;cursor:not-allowed;" id="previewConfirmBtn" disabled>✅ Already Correct</button>';
        }
        html += '<button style="padding:14px 36px;border-radius:40px;font-weight:700;font-size:1rem;cursor:pointer;border:2px solid #555;background:#2a2a2a;color:#888;min-width:120px;" id="previewCancelBtn">✖ CANCEL</button>';
        html += '</div></div>';
        
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
        
        document.getElementById('previewCancelBtn').addEventListener('click', function() {
            overlay.remove();
        });
        
        if (hasChanges) {
            document.getElementById('previewConfirmBtn').addEventListener('click', function() {
                overlay.remove();
                if (onConfirm) onConfirm();
            });
        }
    }
    
    // ============================================================
    // v1.11: RENDER VALIDATE RESULTS
    // ============================================================
    
    function renderValidateResults(recordData, validation, validateGameData, validateCurrentValidation) {
        var resultsDiv = document.getElementById('validateResults');
        if (!resultsDiv) return;
        resultsDiv.classList.add('active');
        
        var statusDiv = document.getElementById('validateStatus');
        if (statusDiv) statusDiv.style.display = 'none';
        
        var fixCard = document.getElementById('validateFixCard');
        if (fixCard) fixCard.style.display = 'none';
        
        var progressDiv = document.getElementById('validateProgress');
        if (progressDiv) {
            progressDiv.className = 'validate-progress';
            progressDiv.innerHTML = '';
        }
        
        // Render game info
        renderGameInfo(recordData, 'validateGameInfo');
        
        var photoStatus = validation.photoStatus || { hasPhoto: false, path: null, url: null };
        var isCompleted = validation.isCompletedGame || false;
        var recordId = recordData.id || '';
        var collection = document.getElementById('validateCollection') ? document.getElementById('validateCollection').value : '';
        
        window._validatePhotoStatus = photoStatus;
        window._validateRecordId = recordId;
        window._validateCollection = collection;
        
        // Render photo status inline
        renderPhotoStatusInline(photoStatus, recordId, collection, isCompleted);
        
        var f1Scores = validation.f1Scores || [];
        var f2Scores = validation.f2Scores || [];
        var players = validation.players || [];
        
        renderFlightTable(f1Scores, players, 1, 'validateFlight1');
        renderFlightTable(f2Scores, players, 2, 'validateFlight2');
        
        var recalculated = validation.recalculated || {};
        
        if (typeof UtilValidate === 'undefined') {
            console.error('[UTIL-VALIDATE-UI] UtilValidate not available');
            return;
        }
        
        var t1Calc = UtilValidate.calculateTeamGame(f1Scores, players, 1, validation.courseSi || []);
        var t2Calc = UtilValidate.calculateTeamGame(f2Scores, players, 2, validation.courseSi || []);
        var strkCalc = UtilValidate.calculateStrokeGame(f1Scores, f2Scores, players);
        
        renderTeamGameTable(t1Calc, 'validateT1', 'T-1');
        renderTeamGameTable(t2Calc, 'validateT2', 'T-2');
        renderStrkTable(strkCalc, 'validateStrk');
        
        var matchData = UtilValidate.calculateMatchGamePerHole(f1Scores, f2Scores, players, validation.courseSi || [], validation.coursePar || []);
        var orderedPlayers = matchData.orderedPlayers || [];
        var matchResults = matchData.results || [];
        renderMatchTable(orderedPlayers, matchResults, 'validateMatch');
        
        var matchPointsPerHole = matchData.matchPointsPerHole || [];
        renderTRTable(t1Calc, t2Calc, strkCalc, matchPointsPerHole, recordData, 'validateTR');
        
        // v1.11: Render Handicap Adjustment card (separate card, above Photo)
        var hcpCardContainer = document.getElementById('validateHandicapCard');
        if (hcpCardContainer) {
            renderHandicapAdjustmentCard(validation, 'validateHandicapCard');
        }
        
        // v1.11: Render validation summary with integrated detailed validation
        renderValidationSummary(validation, 'validateSummary');
        
        // Show/hide fix card
        if (fixCard) {
            if (!validation.valid) {
                fixCard.style.display = 'block';
                var backupBtn = document.getElementById('validateBackupBtn');
                var fixBtn = document.getElementById('validateFixBtn');
                if (backupBtn) backupBtn.disabled = false;
                if (fixBtn) fixBtn.disabled = false;
            } else {
                fixCard.style.display = 'none';
            }
        }
        
        // v1.11: Remove separate details card (now integrated into validation summary)
        var detailsCard = document.getElementById('validateDetailsCard');
        if (detailsCard) {
            detailsCard.style.display = 'none';
        }
    }
    
    // ============================================================
    // v1.09: RENDER PHOTO STATUS INLINE
    // ============================================================
    
    function renderPhotoStatusInline(photoStatus, recordId, collection, isCompleted) {
        var container = document.getElementById('validatePhotoStatus');
        if (!container) return;
        
        var hasPhoto = photoStatus && photoStatus.hasPhoto;
        var url = photoStatus ? photoStatus.url : null;
        var path = photoStatus ? photoStatus.path : null;
        var expectedPath = photoStatus ? photoStatus.expectedPath : null;
        
        var html = '<div style="background:#0a0a0a; border-radius:8px; padding:12px; border:1px solid #2a2a2a;">';
        html += '<div style="font-size:0.75rem; font-weight:600; color:#ffaa44; margin-bottom:8px;">📸 CELEBRATION PHOTO</div>';
        
        if (hasPhoto && url) {
            html += '<div class="photo-inline-status" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">';
            html += '<div style="width:80px; height:80px; border-radius:8px; overflow:hidden; border:1px solid #4caf50; flex-shrink:0; background:#0a0a0a; display:flex; align-items:center; justify-content:center;">';
            html += '<img src="' + escapeHtml(url) + '" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display=\'none\'; this.parentNode.innerHTML=\'<span style=\'font-size:2rem;\'>📸</span>\';">';
            html += '</div>';
            html += '<div style="flex:1; min-width:120px;">';
            html += '<div style="font-size:0.7rem; color:#4caf50;">✅ Photo present</div>';
            html += '<div style="font-size:0.6rem; color:#888; word-break:break-all; margin-top:2px;">' + escapeHtml(path || '') + '</div>';
            html += '<div style="margin-top:4px;">';
            html += '<button onclick="toggleInlinePhotoSelector(\'' + escapeHtml(recordId) + '\', \'' + escapeHtml(collection) + '\')" style="padding:4px 12px; font-size:0.65rem; border-radius:20px; border:1px solid #ffaa44; background:#2a2a0a; color:#ffaa44; cursor:pointer; margin-right:4px;">🔄 Change Photo</button>';
            html += '<button onclick="clearPhotoFromRecord(\'' + escapeHtml(recordId) + '\', \'' + escapeHtml(collection) + '\')" style="padding:4px 12px; font-size:0.65rem; border-radius:20px; border:1px solid #333; background:#1a1a1a; color:#888; cursor:pointer;">✖ Remove</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '<div id="inlinePhotoSelectorContainer" style="display:none; margin-top:12px;"></div>';
        } else {
            html += '<div class="photo-inline-status" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">';
            html += '<div style="width:80px; height:80px; border-radius:8px; border:1px solid #ff6b6b; flex-shrink:0; background:#0a0a0a; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#555;">❌</div>';
            html += '<div style="flex:1; min-width:120px;">';
            html += '<div style="font-size:0.7rem; color:#ff6b6b;">❌ Photo MISSING</div>';
            if (isCompleted) {
                html += '<div style="font-size:0.65rem; color:#ffaa44;">⚠️ Required for completed games</div>';
            }
            if (expectedPath) {
                html += '<div style="font-size:0.6rem; color:#888; word-break:break-all; margin-top:2px;">Expected: ' + escapeHtml(expectedPath) + '</div>';
            }
            html += '<div style="margin-top:4px;">';
            html += '<button onclick="toggleInlinePhotoSelector(\'' + escapeHtml(recordId) + '\', \'' + escapeHtml(collection) + '\')" style="padding:4px 12px; font-size:0.65rem; border-radius:20px; border:1px solid #ffaa44; background:#2a2a0a; color:#ffaa44; cursor:pointer;">📂 Select Photo</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '<div id="inlinePhotoSelectorContainer" style="display:none; margin-top:12px;"></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // ============================================================
    // v1.09: INLINE PHOTO SELECTOR
    // ============================================================
    
    var inlinePhotoSelectorActive = false;
    var selectedPhotoPath = null;
    var selectedPhotoUrl = null;
    
    window._stagedPhoto = {
        fullPath: null,
        downloadUrl: null,
        recordId: null,
        collection: null
    };
    
    function toggleInlinePhotoSelector(recordId, collection) {
        var container = document.getElementById('inlinePhotoSelectorContainer');
        if (!container) return;
        
        if (container.style.display === 'block') {
            container.style.display = 'none';
            inlinePhotoSelectorActive = false;
            return;
        }
        
        container.style.display = 'block';
        inlinePhotoSelectorActive = true;
        
        selectedPhotoPath = null;
        selectedPhotoUrl = null;
        window._stagedPhoto.fullPath = null;
        window._stagedPhoto.downloadUrl = null;
        window._stagedPhoto.recordId = recordId;
        window._stagedPhoto.collection = collection;
        
        window._inlineSelectorRecordId = recordId;
        window._inlineSelectorCollection = collection;
        
        var html = '<div style="background:#0a0a0a; border-radius:8px; border:1px solid #2a2a2a; padding:12px; margin-top:8px; max-height:500px; overflow-y:auto;">';
        html += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; align-items:center;">';
        html += '<input type="text" id="inlinePhotoFolder" value="celebration/" placeholder="Folder path" style="flex:2; min-width:120px; padding:6px 12px; font-size:0.7rem; border-radius:20px; background:#0a0a0a; border:1px solid #2a2a2a; color:#fff;">';
        html += '<button onclick="loadInlinePhotos()" style="flex:0 0 auto; padding:6px 16px; font-size:0.65rem; border-radius:20px; border:1px solid #ffaa44; background:#2a2a0a; color:#ffaa44; cursor:pointer;">🔄 Load Photos</button>';
        html += '<button onclick="closeInlinePhotoSelector()" style="flex:0 0 auto; padding:6px 16px; font-size:0.65rem; border-radius:20px; border:1px solid #333; background:#1a1a1a; color:#888; cursor:pointer;">✕ Close</button>';
        html += '</div>';
        
        html += '<div id="inlinePhotoPreview" style="display:none; background:#0a0a0a; border-radius:8px; border:1px solid #2a2a2a; padding:8px; margin-bottom:8px; text-align:center;">';
        html += '<div style="font-size:0.6rem; color:#888; margin-bottom:4px;">📸 SELECTED PHOTO</div>';
        html += '<img id="inlinePhotoPreviewImg" src="" style="max-width:100%; max-height:150px; object-fit:contain; border-radius:4px; display:none;">';
        html += '<div id="inlinePhotoPreviewName" style="font-size:0.65rem; color:#e0e0e0; margin-top:4px;"></div>';
        html += '<button id="inlineAttachPhotoBtn" onclick="stageSelectedPhoto()" style="margin-top:6px; padding:4px 16px; font-size:0.65rem; border-radius:20px; border:1px solid #4caf50; background:#1a3a1a; color:#4caf50; cursor:pointer; display:none;">📎 Attach Photo</button>';
        html += '</div>';
        
        html += '<div id="inlinePhotoList" style="max-height:250px; overflow-y:auto;">';
        html += '<div style="text-align:center; padding:20px; color:#555;">Click "Load Photos" to browse</div>';
        html += '</div>';
        html += '<div id="inlinePhotoStatus" style="font-size:0.7rem; color:#888; padding:4px 0;">Ready</div>';
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    function closeInlinePhotoSelector() {
        var container = document.getElementById('inlinePhotoSelectorContainer');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        inlinePhotoSelectorActive = false;
        selectedPhotoPath = null;
        selectedPhotoUrl = null;
        window._stagedPhoto.fullPath = null;
        window._stagedPhoto.downloadUrl = null;
    }
    
    function loadInlinePhotos() {
        var folderInput = document.getElementById('inlinePhotoFolder');
        var folder = folderInput ? folderInput.value.trim() : 'celebration/';
        if (folder && !folder.endsWith('/')) {
            folder = folder + '/';
        }
        var listContainer = document.getElementById('inlinePhotoList');
        var statusDiv = document.getElementById('inlinePhotoStatus');
        var previewDiv = document.getElementById('inlinePhotoPreview');
        
        if (!listContainer) return;
        
        if (previewDiv) previewDiv.style.display = 'none';
        
        if (typeof listPhotosInStorage !== 'function') {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#ff6b6b;">❌ Photo listing not available</div>';
            return;
        }
        
        listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">⏳ Loading photos...</div>';
        if (statusDiv) statusDiv.textContent = '⏳ Loading from: ' + folder;
        
        listPhotosInStorage(folder, function(err, photos) {
            if (err) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#ff6b6b;">❌ Error: ' + err.message + '</div>';
                if (statusDiv) statusDiv.textContent = '❌ Error loading photos';
                return;
            }
            
            if (!photos || photos.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">📭 No photos found in ' + folder + '</div>';
                if (statusDiv) statusDiv.textContent = '📭 No photos found';
                return;
            }
            
            var html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:8px;">';
            
            photos.forEach(function(photo) {
                var displayName = photo.name.length > 25 ? photo.name.substring(0, 22) + '...' : photo.name;
                var size = photo.size > 1024 * 1024 ? (photo.size / (1024 * 1024)).toFixed(1) + ' MB' : 
                           photo.size > 1024 ? (photo.size / 1024).toFixed(0) + ' KB' : 
                           photo.size + ' B';
                
                html += '<div class="photo-item-inline" data-path="' + escapeHtml(photo.fullPath) + '" onclick="previewInlinePhoto(\'' + escapeHtml(photo.fullPath) + '\', \'' + escapeHtml(photo.name) + '\')" style="background:#111; border-radius:8px; padding:8px; border:1px solid #2a2a2a; cursor:pointer; transition:all 0.2s; text-align:center;">';
                html += '<div class="photo-thumb-inline" style="width:100%; height:80px; background:#0a0a0a; border-radius:4px; overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:1.5rem; color:#555;">📸</div>';
                html += '<div class="photo-name-inline" style="font-size:0.6rem; color:#e0e0e0; margin-top:4px; word-break:break-all;">' + escapeHtml(displayName) + '</div>';
                html += '<div class="photo-size-inline" style="font-size:0.5rem; color:#666;">' + size + '</div>';
                html += '</div>';
            });
            
            html += '</div>';
            listContainer.innerHTML = html;
            if (statusDiv) statusDiv.textContent = '📸 ' + photos.length + ' photos found. Click a photo to preview.';
            
            loadPhotoThumbnails();
        });
    }
    
    function loadPhotoThumbnails() {
        var items = document.querySelectorAll('#inlinePhotoList .photo-item-inline');
        items.forEach(function(item) {
            var path = item.getAttribute('data-path');
            if (path) {
                var thumbContainer = item.querySelector('.photo-thumb-inline');
                if (thumbContainer && thumbContainer.innerHTML === '📸') {
                    getPhotoDownloadUrl(path, function(err, url) {
                        if (!err && url) {
                            var img = document.createElement('img');
                            img.src = url;
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.objectFit = 'cover';
                            img.style.borderRadius = '4px';
                            thumbContainer.innerHTML = '';
                            thumbContainer.appendChild(img);
                        }
                    });
                }
            }
        });
    }
    
    function previewInlinePhoto(fullPath, fileName) {
        selectedPhotoPath = fullPath;
        selectedPhotoUrl = null;
        
        var previewDiv = document.getElementById('inlinePhotoPreview');
        var previewImg = document.getElementById('inlinePhotoPreviewImg');
        var previewName = document.getElementById('inlinePhotoPreviewName');
        var attachBtn = document.getElementById('inlineAttachPhotoBtn');
        var statusDiv = document.getElementById('inlinePhotoStatus');
        
        if (!previewDiv) return;
        
        previewDiv.style.display = 'block';
        previewImg.style.display = 'none';
        previewImg.src = '';
        previewName.textContent = 'Loading preview...';
        if (attachBtn) attachBtn.style.display = 'none';
        
        if (statusDiv) statusDiv.textContent = '📸 Loading preview...';
        
        getPhotoDownloadUrl(fullPath, function(err, url) {
            if (err) {
                if (statusDiv) statusDiv.textContent = '❌ Failed to load preview: ' + err.message;
                previewName.textContent = '❌ Failed to load: ' + fileName;
                return;
            }
            
            selectedPhotoUrl = url;
            previewImg.src = url;
            previewImg.style.display = 'block';
            previewName.textContent = '📸 ' + fileName;
            if (attachBtn) attachBtn.style.display = 'inline-block';
            if (statusDiv) statusDiv.textContent = '✅ Preview loaded. Click "Attach Photo" to stage it.';
            
            var items = document.querySelectorAll('#inlinePhotoList .photo-item-inline');
            items.forEach(function(item) {
                item.style.borderColor = '#2a2a2a';
                item.style.background = '#111';
            });
            var selectedItem = document.querySelector('#inlinePhotoList .photo-item-inline[data-path="' + fullPath + '"]');
            if (selectedItem) {
                selectedItem.style.borderColor = '#4caf50';
                selectedItem.style.background = '#1a2a1a';
            }
        });
    }
    
    function stageSelectedPhoto() {
        if (!selectedPhotoPath || !selectedPhotoUrl) {
            if (typeof window.log === 'function') {
                window.log('Select a photo first', 'error');
            }
            return;
        }
        
        var recordId = window._inlineSelectorRecordId;
        var collection = window._inlineSelectorCollection;
        
        if (!recordId || !collection) {
            if (typeof window.log === 'function') {
                window.log('Missing record info for photo staging', 'error');
            }
            return;
        }
        
        window._stagedPhoto.fullPath = selectedPhotoPath;
        window._stagedPhoto.downloadUrl = selectedPhotoUrl;
        window._stagedPhoto.recordId = recordId;
        window._stagedPhoto.collection = collection;
        
        if (typeof window.log === 'function') {
            window.log('📎 Photo staged for record: ' + recordId + ' - ' + selectedPhotoPath, 'success');
        }
        
        var statusDiv = document.getElementById('inlinePhotoStatus');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color:#4caf50;">✅ Photo staged! Click "Fix Record" to save it.</span>';
        }
        
        var attachBtn = document.getElementById('inlineAttachPhotoBtn');
        if (attachBtn) {
            attachBtn.textContent = '✅ Staged';
            attachBtn.style.borderColor = '#4caf50';
            attachBtn.style.background = '#0a2a0a';
            attachBtn.style.color = '#4caf50';
            attachBtn.disabled = true;
            attachBtn.style.cursor = 'default';
        }
        
        var photoContainer = document.getElementById('validatePhotoStatus');
        if (photoContainer) {
            var stagedHtml = '<div style="background:#0a2a0a; border-radius:8px; padding:12px; border:1px solid #4caf50;">';
            stagedHtml += '<div style="font-size:0.75rem; font-weight:600; color:#4caf50; margin-bottom:8px;">📎 PHOTO STAGED (not yet saved)</div>';
            stagedHtml += '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">';
            stagedHtml += '<div style="width:60px; height:60px; border-radius:4px; overflow:hidden; border:1px solid #4caf50; background:#0a0a0a; display:flex; align-items:center; justify-content:center;">';
            stagedHtml += '<img src="' + escapeHtml(selectedPhotoUrl) + '" style="width:100%; height:100%; object-fit:cover;">';
            stagedHtml += '</div>';
            stagedHtml += '<div style="flex:1; min-width:100px;">';
            stagedHtml += '<div style="font-size:0.7rem; color:#4caf50;">📎 Staged for record: ' + escapeHtml(recordId) + '</div>';
            stagedHtml += '<div style="font-size:0.6rem; color:#888; word-break:break-all;">' + escapeHtml(selectedPhotoPath) + '</div>';
            stagedHtml += '<div style="font-size:0.6rem; color:#ffaa44; margin-top:2px;">Click "Fix Record" to save</div>';
            stagedHtml += '</div>';
            stagedHtml += '</div>';
            stagedHtml += '</div>';
            photoContainer.innerHTML = stagedHtml;
        }
    }
    
    // ============================================================
    // v1.03: MODAL PHOTO SELECTOR (legacy)
    // ============================================================
    
    function openPhotoSelector(recordId, collection) {
        if (!recordId || !collection) {
            if (typeof window.log === 'function') {
                window.log('Record ID and collection required', 'error');
            }
            return;
        }
        
        if (typeof listPhotosInStorage !== 'function') {
            if (typeof window.log === 'function') {
                window.log('Photo listing not available. Make sure util-photo.js is loaded.', 'error');
            }
            return;
        }
        
        if (typeof window.log === 'function') {
            window.log('📂 Opening photo selector for record: ' + recordId, 'info');
        }
        
        var modalHtml = `
            <div id="photoSelectorModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:20000;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);animation:infoFadeIn 0.3s ease-out;">
                <div style="background:#1a1a1a;border-radius:28px;padding:32px;max-width:600px;width:95%;max-height:90vh;overflow-y:auto;border:2px solid #ffaa44;box-shadow:0 20px 60px rgba(0,0,0,0.9);animation:infoSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid #2a2a2a;padding-bottom:12px;">
                        <div style="font-size:1.2rem;font-weight:700;color:#ffaa44;">📸 Select Celebration Photo</div>
                        <button onclick="closePhotoSelector()" style="padding:8px 28px;border-radius:30px;font-size:0.85rem;font-weight:600;cursor:pointer;border:1px solid #ffaa44;background:rgba(255,170,68,0.1);color:#ffaa44;transition:all 0.2s ease;font-family:inherit;">✕ CLOSE</button>
                    </div>
                    <div style="font-size:0.8rem;color:#ccc;margin-bottom:12px;">
                        Select a photo from Firebase Storage to link to this record.
                        <br><strong style="color:#ffaa44;">Expected path:</strong> celebration/${recordId}.jpg
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                        <input type="text" id="photoSelectorFolder" placeholder="Folder" value="celebration/" style="flex:2;min-width:150px;padding:10px 14px;border-radius:20px;background:#0a0a0a;border:1px solid #2a2a2a;color:#fff;font-size:0.85rem;">
                        <button onclick="loadPhotoSelector()" style="flex:0 0 auto;padding:10px 24px;border-radius:20px;font-weight:600;font-size:0.85rem;cursor:pointer;border:1px solid #ffaa44;background:#2a2a0a;color:#ffaa44;">🔄 Load Photos</button>
                    </div>
                    <div id="photoSelectorList" style="max-height:300px;overflow-y:auto;background:#0a0a0a;border-radius:8px;border:1px solid #2a2a2a;padding:8px;">
                        <div style="text-align:center;padding:20px;color:#555;">Click "Load Photos" to browse</div>
                    </div>
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #2a2a2a;">
                        <div style="font-size:0.7rem;color:#888;" id="photoSelectorStatus">Ready</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        window._photoSelectorRecordId = recordId;
        window._photoSelectorCollection = collection;
    }
    
    function closePhotoSelector() {
        var modal = document.getElementById('photoSelectorModal');
        if (modal) modal.remove();
        window._photoSelectorRecordId = null;
        window._photoSelectorCollection = null;
    }
    
    function loadPhotoSelector() {
        var folderInput = document.getElementById('photoSelectorFolder');
        var folder = folderInput ? folderInput.value.trim() : 'celebration/';
        var listContainer = document.getElementById('photoSelectorList');
        var statusDiv = document.getElementById('photoSelectorStatus');
        
        if (!listContainer) return;
        
        if (typeof listPhotosInStorage !== 'function') {
            listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#ff6b6b;">❌ Photo listing not available</div>';
            return;
        }
        
        listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#555;">⏳ Loading photos...</div>';
        if (statusDiv) statusDiv.textContent = '⏳ Loading from: ' + folder;
        
        listPhotosInStorage(folder, function(err, photos) {
            if (err) {
                listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#ff6b6b;">❌ Error: ' + err.message + '</div>';
                if (statusDiv) statusDiv.textContent = '❌ Error loading photos';
                return;
            }
            
            if (!photos || photos.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#555;">📭 No photos found in ' + folder + '</div>';
                if (statusDiv) statusDiv.textContent = '📭 No photos found';
                return;
            }
            
            var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">';
            
            photos.forEach(function(photo) {
                var displayName = photo.name.length > 25 ? photo.name.substring(0, 22) + '...' : photo.name;
                var size = photo.size > 1024 * 1024 ? (photo.size / (1024 * 1024)).toFixed(1) + ' MB' : 
                           photo.size > 1024 ? (photo.size / 1024).toFixed(0) + ' KB' : 
                           photo.size + ' B';
                
                html += '<div onclick="selectPhotoFromList(\'' + escapeHtml(photo.fullPath) + '\', \'' + escapeHtml(photo.name) + '\')" style="background:#111;border-radius:8px;padding:8px;border:1px solid #2a2a2a;cursor:pointer;transition:all 0.2s;">';
                html += '<div style="width:100%;height:100px;background:#0a0a0a;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#555;">📸</div>';
                html += '<div style="font-size:0.65rem;color:#e0e0e0;margin-top:4px;text-align:center;word-break:break-all;">' + escapeHtml(displayName) + '</div>';
                html += '<div style="font-size:0.5rem;color:#666;text-align:center;">' + size + '</div>';
                html += '</div>';
            });
            
            html += '</div>';
            listContainer.innerHTML = html;
            if (statusDiv) statusDiv.textContent = '📸 ' + photos.length + ' photos found';
        });
    }
    
    function selectPhotoFromList(fullPath, fileName) {
        if (!window._photoSelectorRecordId || !window._photoSelectorCollection) {
            if (typeof window.log === 'function') {
                window.log('Missing record info for photo selection', 'error');
            }
            return;
        }
        
        var recordId = window._photoSelectorRecordId;
        var collection = window._photoSelectorCollection;
        
        if (typeof window.log === 'function') {
            window.log('📸 Previewing photo: ' + fullPath, 'info');
        }
        
        getPhotoDownloadUrl(fullPath, function(err, url) {
            if (err) {
                if (typeof window.log === 'function') {
                    window.log('❌ Failed to get download URL: ' + err.message, 'error');
                }
                return;
            }
            
            var previewArea = document.querySelector('#photoSelectorList');
            if (previewArea) {
                previewArea.innerHTML = '<div style="text-align:center; padding:12px; background:#0a0a0a; border-radius:8px; border:1px solid #ffaa44;">' +
                    '<div style="font-size:0.7rem; color:#ffaa44; margin-bottom:4px;">📸 PREVIEW</div>' +
                    '<img src="' + url + '" style="max-width:100%; max-height:200px; object-fit:contain; border-radius:4px;">' +
                    '<div style="font-size:0.65rem; color:#e0e0e0; margin-top:4px;">' + escapeHtml(fullPath) + '</div>' +
                    '<button onclick="applyPhotoToRecord(\'' + recordId + '\', \'' + collection + '\', \'' + escapeHtml(fullPath) + '\', \'' + url + '\')" style="margin-top:8px; padding:6px 16px; border-radius:20px; font-size:0.7rem; border:1px solid #4caf50; background:#1a3a1a; color:#4caf50; cursor:pointer;">📎 Attach Photo</button>' +
                    '<button onclick="loadPhotoSelector()" style="margin-top:8px; margin-left:8px; padding:6px 16px; border-radius:20px; font-size:0.7rem; border:1px solid #333; background:#1a1a1a; color:#888; cursor:pointer;">↩ Back</button>' +
                    '</div>';
            }
        });
    }
    
    function applyPhotoToRecord(recordId, collection, fullPath, url) {
        if (!recordId || !collection || !fullPath || !url) {
            if (typeof window.log === 'function') {
                window.log('Missing required data for photo staging', 'error');
            }
            return;
        }
        
        window._stagedPhoto.fullPath = fullPath;
        window._stagedPhoto.downloadUrl = url;
        window._stagedPhoto.recordId = recordId;
        window._stagedPhoto.collection = collection;
        
        if (typeof window.log === 'function') {
            window.log('📎 Photo staged for record: ' + recordId + ' - ' + fullPath, 'success');
            window.log('Click "Fix Record" to save this photo to the record.', 'info');
        }
        
        closePhotoSelector();
        
        var photoContainer = document.getElementById('validatePhotoStatus');
        if (photoContainer) {
            var stagedHtml = '<div style="background:#0a2a0a; border-radius:8px; padding:12px; border:1px solid #4caf50;">';
            stagedHtml += '<div style="font-size:0.75rem; font-weight:600; color:#4caf50; margin-bottom:8px;">📎 PHOTO STAGED (not yet saved)</div>';
            stagedHtml += '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">';
            stagedHtml += '<div style="width:60px; height:60px; border-radius:4px; overflow:hidden; border:1px solid #4caf50; background:#0a0a0a; display:flex; align-items:center; justify-content:center;">';
            stagedHtml += '<img src="' + escapeHtml(url) + '" style="width:100%; height:100%; object-fit:cover;">';
            stagedHtml += '</div>';
            stagedHtml += '<div style="flex:1; min-width:100px;">';
            stagedHtml += '<div style="font-size:0.7rem; color:#4caf50;">📎 Staged for record: ' + escapeHtml(recordId) + '</div>';
            stagedHtml += '<div style="font-size:0.6rem; color:#888; word-break:break-all;">' + escapeHtml(fullPath) + '</div>';
            stagedHtml += '<div style="font-size:0.6rem; color:#ffaa44; margin-top:2px;">Click "Fix Record" to save</div>';
            stagedHtml += '</div>';
            stagedHtml += '</div>';
            stagedHtml += '</div>';
            photoContainer.innerHTML = stagedHtml;
        }
        
        if (typeof window.loadAndValidate === 'function') {
            window.loadAndValidate();
        }
    }
    
    // ============================================================
    // v1.05: CLEAR STAGED PHOTO
    // ============================================================
    
    function clearStagedPhoto() {
        window._stagedPhoto.fullPath = null;
        window._stagedPhoto.downloadUrl = null;
        window._stagedPhoto.recordId = null;
        window._stagedPhoto.collection = null;
        selectedPhotoPath = null;
        selectedPhotoUrl = null;
        
        if (typeof window.log === 'function') {
            window.log('🧹 Staged photo cleared', 'info');
        }
    }
    
    // ============================================================
    // v1.05: GET STAGED PHOTO
    // ============================================================
    
    function getStagedPhoto() {
        return window._stagedPhoto;
    }
    
    // ============================================================
    // PUBLIC API
    // ============================================================
    
    return {
        escapeHtml: escapeHtml,
        formatDate: formatDate,
        renderGameInfo: renderGameInfo,
        renderFlightTable: renderFlightTable,
        renderTeamGameTable: renderTeamGameTable,
        renderStrkTable: renderStrkTable,
        renderMatchTable: renderMatchTable,
        renderTRTable: renderTRTable,
        renderSummary: renderSummary,
        showFixPreview: showFixPreview,
        renderPhotoStatus: renderPhotoStatus,
        renderValidationSummary: renderValidationSummary,
        renderValidateResults: renderValidateResults,
        renderPhotoStatusInline: renderPhotoStatusInline,
        toggleInlinePhotoSelector: toggleInlinePhotoSelector,
        closeInlinePhotoSelector: closeInlinePhotoSelector,
        loadInlinePhotos: loadInlinePhotos,
        loadPhotoThumbnails: loadPhotoThumbnails,
        previewInlinePhoto: previewInlinePhoto,
        stageSelectedPhoto: stageSelectedPhoto,
        clearStagedPhoto: clearStagedPhoto,
        getStagedPhoto: getStagedPhoto,
        openPhotoSelector: openPhotoSelector,
        closePhotoSelector: closePhotoSelector,
        loadPhotoSelector: loadPhotoSelector,
        selectPhotoFromList: selectPhotoFromList,
        applyPhotoToRecord: applyPhotoToRecord,
        renderHandicapAdjustmentCard: renderHandicapAdjustmentCard
    };
    
})();

window.UtilValidateUI = UtilValidateUI;

// ============================================================
// EXPOSE GLOBALLY FOR HTML ONCLICK BINDINGS
// ============================================================

window.openPhotoSelector = UtilValidateUI.openPhotoSelector;
window.closePhotoSelector = UtilValidateUI.closePhotoSelector;
window.loadPhotoSelector = UtilValidateUI.loadPhotoSelector;
window.selectPhotoFromList = UtilValidateUI.selectPhotoFromList;
window.applyPhotoToRecord = UtilValidateUI.applyPhotoToRecord;

window.toggleInlinePhotoSelector = UtilValidateUI.toggleInlinePhotoSelector;
window.closeInlinePhotoSelector = UtilValidateUI.closeInlinePhotoSelector;
window.loadInlinePhotos = UtilValidateUI.loadInlinePhotos;
window.loadPhotoThumbnails = UtilValidateUI.loadPhotoThumbnails;
window.previewInlinePhoto = UtilValidateUI.previewInlinePhoto;
window.stageSelectedPhoto = UtilValidateUI.stageSelectedPhoto;
window.clearStagedPhoto = UtilValidateUI.clearStagedPhoto;
window.getStagedPhoto = UtilValidateUI.getStagedPhoto;

window.renderValidateResults = UtilValidateUI.renderValidateResults;

console.log('[UTIL-VALIDATE-UI] v1.12 - Fixed NaN in handicap table');

/*
FILE: js/util-validate-ui.js
VERSION: 1.12
KEY CHANGES from v1.11:
   - FIXED: formatSingleHandicapValue() now handles undefined/null/NaN values
   - FIXED: NaN no longer appears in handicap table
   - CHANGED: Undefined raw values default to 0
   - PRESERVED: All existing rendering functions from v1.11
DEPENDS ON: UtilValidate, util-core.js, util-photo.js
STATUS: Ready for integration
*/