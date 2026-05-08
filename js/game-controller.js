/*
FILE: js/game-controller.js
VERSION: 1.20
KEY CHANGES:
   - Reads teamGameFormat from GameData.getTeamGameFormat()
   - Passes teamGameFormat to GameTeam.calculate()
   - UI-Builder architecture per VDN #007
   - Builds UI string: V01 + TR + F1_BUBBLES + F2_BUBBLES + T1_ROW + T2_ROW + STRK_ROW
   - Sends parsed UI data to game.html via window.updateGameUI()
STATUS: Complete. Ready for integration with UI-Painter (game.html v1.13)
*/

// FILE: js/game-controller.js - VERSION 1.20
// UI-Builder: Reads F1-18/F2-18, calls calculators, builds UI string
// Three-layer architecture per VDN #007
// ADDED: teamGameFormat support from GameData

var GameController = (function() {
    
    var isInitialized = false;
    var refreshInterval = null;
    var isRefreshing = false;
    var gameDataLoaded = false;
    var currentCourse = null;
    var currentPlayers = [];
    var currentTeamGameFormat = "tournament";  // From GameData
    
    var gameMode = null;
    var startingHole = 1;
    var editableFlight = null;
    
    // Last built UI string cache
    var lastUIString = "";
    var lastSyncedHoleCount = 0;
    
    // Local scores for unsaved changes
    var localScores = {};
    var currentHole = 1;
    var activeFlight = 1;
    
    // ============================================================
    // Core CRD - Compute, Build UI String, Dispatch
    // ============================================================
    
    function computeAndBuildUIString() {
        if (!gameDataLoaded || !currentCourse || !currentPlayers.length) {
            return "";
        }
        
        var flight1Data = GameData.getFlightData(1).data;
        var flight2Data = GameData.getFlightData(2).data;
        
        // Get current team game format from GameData
        currentTeamGameFormat = GameData.getTeamGameFormat();
        
        // ============================================================
        // STEP 1: Find max synced hole (both flights have 'T')
        // ============================================================
        var maxSyncedHole = 0;
        for (var pos = 0; pos < 18; pos++) {
            var actualHole = GameData.getHoleAtStoragePosition(pos);
            var f1Hole = GameData.parseHoleData(flight1Data, actualHole);
            var f2Hole = GameData.parseHoleData(flight2Data, actualHole);
            
            if (f1Hole && f1Hole.saved && f2Hole && f2Hole.saved) {
                maxSyncedHole = pos + 1;
            } else {
                break;
            }
        }
        
        // ============================================================
        // STEP 2: Call calculators (they process all 18 holes, stop at 'F')
        // ============================================================
        
        // Game 1 - Match Play (always full handicap difference)
        var matchResults = GameMatch.calculate(
            currentPlayers, flight1Data, flight2Data,
            currentCourse.si, startingHole
        );
        
        // Game 2 - Team Game (uses currentTeamGameFormat)
        var teamResults = GameTeam.calculate(
            currentPlayers, flight1Data, flight2Data,
            currentCourse.si, startingHole, currentTeamGameFormat
        );
        
        // Game 3 - Net Stroke (always raw handicap sum)
        var strkRow = GameStroke.calculate(
            currentPlayers, flight1Data, flight2Data,
            currentCourse.si, startingHole
        );
        
        // ============================================================
        // STEP 3: Calculate points for TR
        // ============================================================
        
        var game1Points = GameMatch.calculatePoints(matchResults, maxSyncedHole);
        var game2Points = GameTeam.calculatePoints(
            teamResults.flight1Cumulative,
            teamResults.flight2Cumulative,
            maxSyncedHole
        );
        var game3Points = GameStroke.calculatePoints(strkRow, maxSyncedHole);
        
        var trPoints = {
            teamA: game1Points.teamAPoints + game2Points.teamAPoints + game3Points.teamAPoints,
            teamB: game1Points.teamBPoints + game2Points.teamBPoints + game3Points.teamBPoints
        };
        
        // ============================================================
        // STEP 4: Build UI string segments
        // ============================================================
        
        // Version
        var version = "V01";
        
        // TR segment (format: TA9.5TB8.5)
        var trValueA = trPoints.teamA % 1 === 0 ? trPoints.teamA.toString() : trPoints.teamA.toFixed(1);
        var trValueB = trPoints.teamB % 1 === 0 ? trPoints.teamB.toString() : trPoints.teamB.toFixed(1);
        var trSegment = "TA" + trValueA + "TB" + trValueB;
        
        // F1_BUBBLES: 16 match bubbles for Flight 1 perspective
        var f1Bubbles = buildMatchBubbles(matchResults, maxSyncedHole, "f1");
        
        // F2_BUBBLES: 16 match bubbles for Flight 2 perspective
        var f2Bubbles = buildMatchBubbles(matchResults, maxSyncedHole, "f2");
        
        // T1_ROW: Flight 1 cumulative
        var t1Segment = buildRowSegment(teamResults.t1Row);
        
        // T2_ROW: Flight 2 cumulative
        var t2Segment = buildRowSegment(teamResults.t2Row);
        
        // STRK_ROW
        var strkSegment = buildRowSegment(strkRow);
        
        // Build complete UI string
        var uiString = version + trSegment + f1Bubbles + f2Bubbles + t1Segment + t2Segment + strkSegment;
        
        // Store for debugging
        lastUIString = uiString;
        lastSyncedHoleCount = maxSyncedHole;
        
        console.log("UI-Builder: teamGameFormat =", currentTeamGameFormat, "maxSyncedHole =", maxSyncedHole);
        
        return uiString;
    }
    
    // Build match bubbles for a specific flight perspective
    function buildMatchBubbles(matchResults, maxSyncedHole, flightPerspective) {
        var result = "";
        
        for (var m = 0; m < matchResults.length; m++) {
            var matchArray = matchResults[m];
            
            if (maxSyncedHole === 0) {
                result += "BAS";
                continue;
            }
            
            var value = matchArray[maxSyncedHole - 1];
            
            if (value === "AS") {
                result += "GAS";
            } else {
                var numVal = parseInt(value, 10);
                if (!isNaN(numVal)) {
                    if (flightPerspective === "f1") {
                        // F1 perspective: Green if positive (winning), Red if negative (losing)
                        if (numVal > 0) {
                            var padded = numVal.toString().padStart(2, ' ');
                            result += "G" + padded;
                        } else {
                            var absVal = Math.abs(numVal);
                            var padded2 = absVal.toString().padStart(2, ' ');
                            result += "R" + padded2;
                        }
                    } else {
                        // F2 perspective: Inverted (F2 wins when F1 is losing)
                        if (numVal < 0) {
                            var padded = Math.abs(numVal).toString().padStart(2, ' ');
                            result += "G" + padded;
                        } else if (numVal > 0) {
                            var padded2 = numVal.toString().padStart(2, ' ');
                            result += "R" + padded2;
                        } else {
                            result += "G0";
                        }
                    }
                } else {
                    result += "BAS";
                }
            }
        }
        
        return result;
    }
    
    // Build row segment (T-1, T-2, Strk)
    function buildRowSegment(rowArray) {
        var result = "";
        for (var i = 0; i < rowArray.length; i++) {
            var val = rowArray[i];
            if (val === "0") {
                result += "G0";
            } else {
                result += "G" + val;
            }
        }
        return result;
    }
    
    // ============================================================
    // Send UI string to UI-Painter
    // ============================================================
    
    function sendUIStringToPainter(uiString) {
        if (typeof window.updateGameUI === 'function') {
            var uiData = parseUIString(uiString);
            if (uiData) {
                // Add additional data needed by UI
                uiData.players = currentPlayers;
                uiData.course = currentCourse;
                uiData.startingHole = startingHole;
                uiData.editableFlight = editableFlight;
                uiData.gameMode = gameMode;
                uiData.currentHole = currentHole;
                uiData.currentActualHole = GameData.getHoleAtStoragePosition(currentHole - 1);
                uiData.canModify = (editableFlight === activeFlight);
                uiData.isSaved = isCurrentHoleSaved();
                uiData.activeFlight = activeFlight;
                
                window.updateGameUI(uiData);
            }
        }
    }
    
    function isCurrentHoleSaved() {
        var flightData = GameData.getFlightData(activeFlight).data;
        var currentActualHole = GameData.getHoleAtStoragePosition(currentHole - 1);
        var holeData = GameData.parseHoleData(flightData, currentActualHole);
        var isSaved = holeData ? holeData.saved : false;
        
        // Check for unsaved local changes
        for (var key in localScores) {
            if (key.indexOf(activeFlight + "_" + currentActualHole + "_") === 0) {
                isSaved = false;
                break;
            }
        }
        return isSaved;
    }
    
    // Parse UI string back into structured data
    function parseUIString(uiString) {
        if (!uiString || uiString.length < 10) {
            return null;
        }
        
        var pos = 0;
        
        // Version (3 chars)
        var version = uiString.substr(pos, 3);
        pos += 3;
        
        // Find TR segment
        var taIndex = uiString.indexOf("TA", pos);
        var tbIndex = uiString.indexOf("TB", taIndex);
        if (taIndex === -1 || tbIndex === -1) return null;
        
        var trEnd = uiString.indexOf("G", tbIndex);
        if (trEnd === -1) trEnd = uiString.length;
        
        var trSegment = uiString.substring(taIndex, trEnd);
        var trMatch = trSegment.match(/TA([\d\.]+)TB([\d\.]+)/);
        var trPoints = { teamA: 9.5, teamB: 9.5 };
        if (trMatch) {
            trPoints.teamA = parseFloat(trMatch[1]);
            trPoints.teamB = parseFloat(trMatch[2]);
        }
        
        pos = trEnd;
        
        // F1_BUBBLES (48 chars)
        var f1BubblesRaw = uiString.substr(pos, 48);
        pos += 48;
        
        // F2_BUBBLES (48 chars)
        var f2BubblesRaw = uiString.substr(pos, 48);
        pos += 48;
        
        // T1_ROW (36 chars)
        var t1Raw = uiString.substr(pos, 36);
        pos += 36;
        
        // T2_ROW (36 chars)
        var t2Raw = uiString.substr(pos, 36);
        pos += 36;
        
        // STRK_ROW (36 chars)
        var strkRaw = uiString.substr(pos, 36);
        
        function parseRow(raw, length) {
            var result = [];
            for (var i = 0; i < length; i++) {
                var cell = raw.substr(i * 2, 2);
                var value = cell.charAt(1);
                result.push(value === "0" ? "AS" : value);
            }
            return result;
        }
        
        function parseBubbles(raw) {
            var bubbles = [];
            for (var i = 0; i < 16; i++) {
                var bubble = raw.substr(i * 3, 3);
                var color = bubble.charAt(0);
                var value = bubble.substr(1, 2).trim();
                bubbles.push({ color: color, value: value });
            }
            return bubbles;
        }
        
        return {
            version: version,
            trPoints: trPoints,
            f1Bubbles: parseBubbles(f1BubblesRaw),
            f2Bubbles: parseBubbles(f2BubblesRaw),
            t1Row: parseRow(t1Raw, 18),
            t2Row: parseRow(t2Raw, 18),
            strkRow: parseRow(strkRaw, 18)
        };
    }
    
    // ============================================================
    // Main CRD entry point
    // ============================================================
    
    function crd() {
        if (!gameDataLoaded || isRefreshing) return;
        
        isRefreshing = true;
        
        try {
            var uiString = computeAndBuildUIString();
            if (uiString && uiString !== lastUIString) {
                console.log("UI-Builder: New UI string generated, length:", uiString.length);
                sendUIStringToPainter(uiString);
            }
        } catch (err) {
            console.error("UI-Builder error:", err);
        }
        
        isRefreshing = false;
    }
    
    // ============================================================
    // Auto-refresh and event handling
    // ============================================================
    
    function startAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(function() {
            if (gameDataLoaded && !isRefreshing) {
                GameData.forceRefresh();
                crd();
                GameData.clearCrossEvent();
                GameData.clearSaveEvent();
            }
        }, 5000);
    }
    
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }
    
    // ============================================================
    // Event handlers for UI actions
    // ============================================================
    
    function getPlayerPositionInFlight(player, flightPlayers) {
        var teamAPlayers = flightPlayers.filter(function(p) { return p.team === "A"; });
        var teamBPlayers = flightPlayers.filter(function(p) { return p.team === "B"; });
        
        teamAPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        teamBPlayers.sort(function(a, b) { return a.handicap - b.handicap; });
        
        if (player.team === "A") {
            if (teamAPlayers[0] && teamAPlayers[0].name === player.name) return "a1";
            if (teamAPlayers[1] && teamAPlayers[1].name === player.name) return "a2";
        } else {
            if (teamBPlayers[0] && teamBPlayers[0].name === player.name) return "b1";
            if (teamBPlayers[1] && teamBPlayers[1].name === player.name) return "b2";
        }
        return "a1";
    }
    
    function findPlayerIndex(playerName) {
        for (var i = 0; i < currentPlayers.length; i++) {
            if (currentPlayers[i].name === playerName) return i;
        }
        return -1;
    }
    
    function getCurrentScore(flight, hole, playerIdx) {
        var key = flight + "_" + hole + "_" + playerIdx;
        if (localScores[key] !== undefined) {
            return localScores[key];
        }
        
        var flightData = GameData.getFlightData(flight).data;
        var holeData = GameData.parseHoleData(flightData, hole);
        if (!holeData || !currentCourse) return 4;
        
        var player = currentPlayers[playerIdx];
        if (!player) return currentCourse.par[hole - 1] || 4;
        
        var flightPlayers = currentPlayers.filter(function(p) { return p.flight === flight; });
        var position = getPlayerPositionInFlight(player, flightPlayers);
        
        switch(position) {
            case "a1": return holeData.scores.a1;
            case "a2": return holeData.scores.a2;
            case "b1": return holeData.scores.b1;
            case "b2": return holeData.scores.b2;
            default: return currentCourse.par[hole - 1] || 4;
        }
    }
    
    function handleScoreChange(detail) {
        if (!detail) return;
        
        var playerIdx = detail.playerIdx;
        var flight = detail.flight;
        var hole = detail.hole;
        var delta = detail.delta;
        
        var currentScore = getCurrentScore(flight, hole, playerIdx);
        var newScore = currentScore + delta;
        if (newScore < 1) newScore = 1;
        if (newScore > 99) newScore = 99;
        
        var key = flight + "_" + hole + "_" + playerIdx;
        localScores[key] = newScore;
        
        crd();
    }
    
    function handleSaveHole() {
        var flight = activeFlight;
        var flightData = GameData.getFlightData(flight).data;
        var currentActualHole = GameData.getHoleAtStoragePosition(currentHole - 1);
        var currentHoleData = GameData.parseHoleData(flightData, currentActualHole);
        
        var a1Score = currentHoleData ? currentHoleData.scores.a1 : (currentCourse ? currentCourse.par[currentActualHole - 1] : 4);
        var a2Score = currentHoleData ? currentHoleData.scores.a2 : (currentCourse ? currentCourse.par[currentActualHole - 1] : 4);
        var b1Score = currentHoleData ? currentHoleData.scores.b1 : (currentCourse ? currentCourse.par[currentActualHole - 1] : 4);
        var b2Score = currentHoleData ? currentHoleData.scores.b2 : (currentCourse ? currentCourse.par[currentActualHole - 1] : 4);
        
        var flightPlayers = currentPlayers.filter(function(p) { return p.flight === flight; });
        
        for (var i = 0; i < flightPlayers.length; i++) {
            var p = flightPlayers[i];
            var playerIdx = findPlayerIndex(p.name);
            if (playerIdx === -1) continue;
            
            var key = flight + "_" + currentActualHole + "_" + playerIdx;
            if (localScores[key] !== undefined) {
                var position = getPlayerPositionInFlight(p, flightPlayers);
                switch(position) {
                    case "a1": a1Score = localScores[key]; break;
                    case "a2": a2Score = localScores[key]; break;
                    case "b1": b1Score = localScores[key]; break;
                    case "b2": b2Score = localScores[key]; break;
                }
            }
        }
        
        var scoresToSave = { a1: a1Score, a2: a2Score, b1: b1Score, b2: b2Score };
        
        GameData.saveCurrentHole(currentActualHole, scoresToSave, currentCourse ? currentCourse.par : null, function(success) {
            if (success) {
                var keysToDelete = [];
                for (var key in localScores) {
                    if (key.indexOf(flight + "_" + currentActualHole + "_") === 0) {
                        keysToDelete.push(key);
                    }
                }
                for (var k = 0; k < keysToDelete.length; k++) {
                    delete localScores[keysToDelete[k]];
                }
                crd();
            }
        });
    }
    
    function handleNextHole() {
        var flightData = GameData.getFlightData(activeFlight).data;
        var currentActualHole = GameData.getHoleAtStoragePosition(currentHole - 1);
        var currentHoleData = GameData.parseHoleData(flightData, currentActualHole);
        var isSaved = currentHoleData ? currentHoleData.saved : false;
        
        for (var key in localScores) {
            if (key.indexOf(activeFlight + "_" + currentActualHole + "_") === 0) {
                isSaved = false;
                break;
            }
        }
        
        if (!isSaved) return;
        if (currentHole < 18) {
            currentHole++;
            crd();
        }
    }
    
    function handlePrevHole() {
        if (currentHole > 1) {
            currentHole--;
            crd();
        }
    }
    
    function handleRefresh() {
        localScores = {};
        GameData.forceRefresh();
        crd();
    }
    
    function handleMainMenu() {
        window.location.href = "index.html";
    }
    
    function handleSwitchRole() {
        if (confirm("Switch role? This will reload the app.")) {
            localStorage.removeItem("userRole");
            localStorage.removeItem("sessionId");
            window.location.href = "pre-game.html";
        }
    }
    
    // ============================================================
    // Initialization
    // ============================================================
    
    function init() {
        if (isInitialized) return;
        console.log("GameController: Initializing v1.20 (UI-Builder)...");
        
        // Set up event listeners
        window.addEventListener('scoreChange', function(e) {
            if (e.detail) handleScoreChange(e.detail);
        });
        window.addEventListener('saveHole', function() { handleSaveHole(); });
        window.addEventListener('nextHole', function() { handleNextHole(); });
        window.addEventListener('prevHole', function() { handlePrevHole(); });
        window.addEventListener('refresh', function() { handleRefresh(); });
        window.addEventListener('mainMenu', function() { handleMainMenu(); });
        window.addEventListener('switchRole', function() { handleSwitchRole(); });
        
        // Set up GameData callbacks
        GameData.setCallbacks(function() {
            if (currentPlayers.length && currentCourse) {
                gameDataLoaded = true;
                crd();
            }
        }, function(msg) {
            console.error("GameData error:", msg);
        });
        
        // Load session and game data
        SessionManager.initSession("game.html", "index.html", function(session) {
            if (typeof window.setDeviceId === 'function') {
                window.setDeviceId(SessionManager.getDeviceIdDisplay());
            }
            
            GameData.loadGameFromSession(session, function(success) {
                if (success) {
                    var metadata = GameData.getGameMetadata();
                    gameMode = metadata.gameMode;
                    editableFlight = metadata.editableFlight;
                    activeFlight = metadata.editableFlight || 1;
                    startingHole = metadata.startingHole || 1;
                    currentTeamGameFormat = metadata.teamGameFormat || "tournament";
                    
                    var storedGame = sessionStorage.getItem("currentGame");
                    if (storedGame) {
                        var gameData = JSON.parse(storedGame);
                        currentCourse = gameData.course;
                        currentPlayers = gameData.players;
                        GameData.setCourse(currentCourse);
                        GameData.setPlayers(currentPlayers);
                    }
                    
                    gameDataLoaded = true;
                    startAutoRefresh();
                    crd();
                } else {
                    console.error("GameController: Failed to load game data");
                }
            });
        });
        
        isInitialized = true;
    }
    
    function refresh() {
        crd();
    }
    
    return {
        init: init,
        refresh: refresh,
        stopAutoRefresh: stopAutoRefresh
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        GameController.init();
    });
} else {
    GameController.init();
}

/*
FILE: js/game-controller.js
VERSION: 1.20
KEY CHANGES:
   - Reads teamGameFormat from GameData.getTeamGameFormat()
   - Passes teamGameFormat to GameTeam.calculate()
   - UI-Builder architecture per VDN #007
   - Builds UI string: V01 + TR + F1_BUBBLES + F2_BUBBLES + T1_ROW + T2_ROW + STRK_ROW
   - Sends parsed UI data to game.html via window.updateGameUI()
STATUS: Complete. Ready for integration with UI-Painter (game.html v1.13)
*/