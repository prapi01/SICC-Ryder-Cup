/*
FILE: js/util-validate-ui.js
VERSION: 1.00
KEY CHANGES:
   - NEW: UI rendering functions for validate tab
   - Functions: renderGameInfo, renderFlightTable, renderTeamGameTable
   - Functions: renderStrkTable, renderMatchTable, renderTRTable, renderSummary
   - Functions: showFixPreview, renderFixPreview
DEPENDS ON: UtilValidate
STATUS: Ready for integration
*/

window.UTIL_VALIDATE_UI_VERSION = "1.00";

var UtilValidateUI = (function() {
    
    console.log("[UTIL-VALIDATE-UI] Initializing v1.00");
    
    // ============================================================
    // HELPERS
    // ============================================================
    
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    function formatDate(dateStr) {
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
        
        var flightPlayers = players.filter(function(p) { return p.flight === flightNum; });
        var teamA = flightPlayers.filter(function(p) { return p.team === 'A'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var teamB = flightPlayers.filter(function(p) { return p.team === 'B'; }).sort(function(a, b) { return a.handicap - b.handicap; });
        var names = [];
        for (var i = 0; i < teamA.length; i++) names.push(teamA[i].label);
        for (var i = 0; i < teamB.length; i++) names.push(teamB[i].label);
        
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
            var vals = hole ? [hole.a1, hole.a2, hole.b1, hole.b2] : ['-', '-', '-', '-'];
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
        
        if (!orderedPlayers || orderedPlayers.length === 0) {
            container.innerHTML = '<div class="empty-state" style="text-align:center; padding:20px; color:#666;">No players found</div>';
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
            var holePoints = holeData.points;
            var holeClinch = holeData.clinchInfo;
            var total = 0;
            var isClinchRow = false;
            for (var p = 0; p < orderedPlayers.length; p++) {
                var player = orderedPlayers[p];
                if (holeClinch[player.name] && holeClinch[player.name].clinched) { isClinchRow = true; break; }
            }
            html += '<tr><td style="color:#888;font-weight:600;text-align:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;">' + (h+1) + '</td>';
            for (var p = 0; p < orderedPlayers.length; p++) {
                var player = orderedPlayers[p];
                var score = holePoints[player.name] || 0;
                total += score;
                var clinchInfo = holeClinch[player.name] || {};
                var isClinched = clinchInfo.clinched;
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
            var recA = gameData.results?.tr?.teamA?.[i];
            var recB = gameData.results?.tr?.teamB?.[i];
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
    // RENDER: Summary
    // ============================================================
    
    function renderSummary(t1Results, t2Results, strkResults, matchPointsPerHole, gameData, containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var t1Final = t1Results[17] || {};
        var t2Final = t2Results[17] || {};
        var strkFinal = strkResults[17] || {};
        
        var t1Display = t1Final.display || '-';
        var t2Display = t2Final.display || '-';
        var strkDisplay = strkFinal.display || '-';
        
        var recT1 = gameData.results?.game2?.displayT1?.[17] || '-';
        var recT2 = gameData.results?.game2?.displayT2?.[17] || '-';
        var recStrk = gameData.results?.game3?.displayStrk?.[17] || '-';
        
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
        
        var recA = gameData.finalResults?.teamAScore || gameData.results?.tr?.teamA?.[17] || '-';
        var recB = gameData.finalResults?.teamBScore || gameData.results?.tr?.teamB?.[17] || '-';
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
        // Remove existing overlay
        var existing = document.getElementById('previewOverlay');
        if (existing) existing.remove();
        
        var overlay = document.createElement('div');
        overlay.id = 'previewOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:20000;padding:20px;overflow-y:auto;';
        
        var hasChanges = previewData.hasChanges;
        var changeCount = previewData.changes.length;
        var unchangedCount = previewData.unchanged.length;
        var notTouchedCount = previewData.notTouched.length;
        var mismatchedHoles = previewData.mismatchedHoles || [];
        
        var data = record.rawData || record;
        var courseName = data.gameInfo?.course?.name || data.course?.name || 'Unknown';
        var date = data.gameInfo?.date || data.date || 'Unknown';
        var players = data.players || [];
        var playerNames = players.map(function(p) { return p.label + ' (' + p.handicap + ')'; }).join(', ');
        
        var html = '<div style="background:#1a1a1a;border-radius:28px;padding:28px;max-width:650px;width:95%;max-height:90vh;overflow-y:auto;border:2px solid #4caf50;">';
        html += '<div style="font-size:1.3rem;font-weight:700;color:#ffaa44;text-align:center;margin-bottom:4px;">🔍 Fix Preview</div>';
        html += '<div style="font-size:0.75rem;color:#888;text-align:center;margin-bottom:16px;">Review changes before writing to Firestore</div>';
        
        // Game Info
        html += '<div style="background:#0a0a0a;border-radius:12px;padding:12px 16px;margin-bottom:16px;border:1px solid #2a2a2a;font-size:0.8rem;">';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Game ID</span><span style="color:#fff;">' + escapeHtml(record.id) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Date</span><span style="color:#fff;">' + escapeHtml(date) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Course</span><span style="color:#fff;">' + escapeHtml(courseName) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;">Players</span><span style="color:#fff;font-size:0.7rem;">' + escapeHtml(playerNames) + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#888;">Status</span><span style="color:#fff;">';
        if (record.status !== 'completed') {
            html += '<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#2a2a1a;color:#ffaa44;">' + escapeHtml(record.status) + '</span> → <span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#0a2a0a;color:#4caf50;">completed</span>';
        } else {
            html += '<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#0a2a0a;color:#4caf50;">' + escapeHtml(record.status) + '</span>';
        }
        html += '</span></div></div>';
        
        // Hole Status
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
        
        // Summary counts
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
            // Changes
            html += '<div style="margin-bottom:12px;padding:12px;background:#0a0a0a;border-radius:12px;border:1px solid #2a2a2a;">';
            html += '<div style="font-size:0.7rem;font-weight:700;color:#ff6b6b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🔴 Changes to be applied (' + changeCount + ' items)</div>';
            for (var i = 0; i < previewData.changes.length; i++) {
                var change = previewData.changes[i];
                var changeIcon = '';
                if (change.type === 'status') changeIcon = '📌';
                else if (change.type === 'tr') changeIcon = '🏆';
                else if (change.type === 'team') changeIcon = '📊';
                else if (change.type === 'strk') changeIcon = '🎯';
                else changeIcon = '📝';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid #1a1a1a;font-size:0.8rem;">';
                html += '<span style="color:#888;flex:1;">' + changeIcon + ' ' + escapeHtml(change.field) + '</span>';
                html += '<span style="color:#ff6b6b;font-weight:600;">' + escapeHtml(change.current) + '</span>';
                html += '<span style="color:#666;margin:0 8px;">→</span>';
                html += '<span style="color:#4caf50;font-weight:600;">' + escapeHtml(change.new) + '</span>';
                html += '</div>';
            }
            html += '</div>';
            
            // Not touched
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
        
        // Buttons
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
        showFixPreview: showFixPreview
    };
    
})();

window.UtilValidateUI = UtilValidateUI;

/*
FILE: js/util-validate-ui.js
VERSION: 1.00
KEY CHANGES:
   - NEW: UI rendering functions for validate tab
   - Functions: renderGameInfo, renderFlightTable, renderTeamGameTable
   - Functions: renderStrkTable, renderMatchTable, renderTRTable, renderSummary
   - Functions: showFixPreview, renderFixPreview
DEPENDS ON: UtilValidate
STATUS: Ready for integration
*/