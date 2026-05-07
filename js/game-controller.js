// FILE: js/game-controller.js - VERSION 1.11
// INTEGRATED: Game 1 (Match Play), Game 2 (Team Game), Game 3 (Net Stroke)
// All three games calculate correctly and feed into TR

var GameController = (function() {
    
    var isInitialized = false;
    var refreshInterval = null;
    var isRefreshing = false;
    var gameDataLoaded = false;
    var currentCourse = null;
    var currentPlayers = [];
    
    var currentHole = 1;
    var activeFlight = 1;
    var editableFlight = null;
    var gameMode = null;
    var startingHole = 1;
    
    var localScores = {};
    
    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================
    
    function findPlayerIndex(playerName) {
        if (!currentPlayers || !currentPlayers.length) return -1;
        for (var i = 0; i < currentPlayers.length; i++) {
            if (currentPlayers[i].name === playerName) return i;
        }
        return -1;
    }
    
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
    
    function getCurrentScore(flight, hole, playerIdx) {
        var key = flight + "_" + hole + "_" + playerIdx;
        
        if (localScores[key] !== undefined && localScores[key] !== null) {
            return localScores[key];
        }
        
        var flightData = GameData.getFlightData(flight).data;
        var holeData = GameData.parseHoleData(flightData, hole);
        
        if (!holeData || !currentCourse) {
            return 4;
        }
        
        var player = currentPlayers[playerIdx];
        if (!player) {
            return currentCourse.par[hole - 1] || 4;
        }
        
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
    
    // ============================================================
    // Core Calculation Functions
    // ============================================================
    
    function calculateMatchBubblesForFlight(players, scores, savedHoles, flight, currentHoleForFlight, maxCompletedHole) {
        var bubbles = {};
        
        // If no holes completed, return all "AS"
        if (maxCompletedHole === 0) {
            var flightPlayers = players.filter(function(p) { return p.flight === flight; });
            for (var i = 0; i < flightPlayers.length; i++) {
                var playerA = flightPlayers[i];
                for (var j = 0; j < players.length; j++) {
                    var playerB = players[j];
                    if (playerA.team !== playerB.team) {
                        var key = playerA.name + "_vs_" + playerB.name;
                        bubbles[key] = "AS";
                    }
                }
            }
            return bubbles;
        }
        
        var flightPlayers = players.filter(function(p) { return p.flight === flight; });
        var courseSi = currentCourse ? currentCourse.si : null;
        
        for (var i = 0; i < flightPlayers.length; i++) {
            var playerA = flightPlayers[i];
            for (var j = 0; j < players.length; j++) {
                var playerB = players[j];
                if (playerA.team !== playerB.team) {
                    var key = playerA.name + "_vs_" + playerB.name;
                    var upToHole = currentHoleForFlight;
                    
                    var result = GameMatch.getMatchResult(
                        playerA, playerB, scores, savedHoles, players, upToHole, courseSi
                    );
                    
                    if (result === "⏳") {
                        result = "AS";
                    }
                    bubbles[key] = result;
                }
            }
        }
        return bubbles;
    }
    
    function calculateMatchBubbles(players, scores, savedHoles, currentHoleByFlight, maxCompletedHole) {
        var allBubbles = {};
        var flight1Bubbles = calculateMatchBubblesForFlight(players, scores, savedHoles, 1, currentHoleByFlight[1], maxCompletedHole);
        var flight2Bubbles = calculateMatchBubblesForFlight(players, scores, savedHoles, 2, currentHoleByFlight[2], maxCompletedHole);
        
        for (var key in flight1Bubbles) allBubbles[key] = flight1Bubbles[key];
        for (var key in flight2Bubbles) allBubbles[key] = flight2Bubbles[key];
        return allBubbles;
    }
    
    function calculateGame1Points(players, flight1Data, flight2Data, maxCompletedHole) {
        // If no holes completed, return default 8-8
        if (maxCompletedHole === 0) {
            console.log("Game1: No holes completed - returning 8-8");
            return {
                teamAPoints: 8,
                teamBPoints: 8
            };
        }
        
        var scores = {};
        var savedHoles = { 1: [], 2: [] };
        
        for (var flight = 1; flight <= 2; flight++) {
            var flightData = (flight === 1) ? flight1Data : flight2Data;
            for (var pos = 0; pos < maxCompletedHole; pos++) {
                var actualHole = GameData.getHoleAtStoragePosition(pos);
                var holeData = GameData.parseHoleData(flightData, actualHole);
                if (!holeData || !holeData.saved) continue;
                
                savedHoles[flight].push(pos + 1);
                
                var flightPlayers = players.filter(function(p) { return p.flight === flight; });
                for (var i = 0; i < flightPlayers.length; i++) {
                    var p = flightPlayers[i];
                    var playerIdx = findPlayerIndex(p.name);
                    if (playerIdx === -1) continue;
                    
                    var score = 0;
                    var position = getPlayerPositionInFlight(p, flightPlayers);
                    switch(position) {
                        case "a1": score = holeData.scores.a1; break;
                        case "a2": score = holeData.scores.a2; break;
                        case "b1": score = holeData.scores.b1; break;
                        case "b2": score = holeData.scores.b2; break;
                    }
                    scores[flight + "_" + (pos + 1) + "_" + playerIdx] = score;
                }
            }
        }
        
        var courseSi = currentCourse ? currentCourse.si : null;
        return GameMatch.getPoints(players, scores, savedHoles, maxCompletedHole, courseSi);
    }
    
    function calculateGame2Points(players, flight1Data, flight2Data, maxCompletedHole, courseSi, flight1Scores, flight2Scores) {
        // If no holes completed, return default display (all "-")
        if (maxCompletedHole === 0) {
            return {
                teamAPoints: 1,
                teamBPoints: 1,
                t1Row: new Array(18).fill("-"),
                t2Row: new Array(18).fill("-"),
                t1Cumulative: new Array(18).fill(0),
                t2Cumulative: new Array(18).fill(0)
            };
        }
        
        // Pass the scores to GameTeam.calculate
        var allScores = {};
        // Merge flight1Scores and flight2Scores
        for (var key in flight1Scores) allScores[key] = flight1Scores[key];
        for (var key in flight2Scores) allScores[key] = flight2Scores[key];
        
        return GameTeam.calculate(players, flight1Scores, flight2Scores, maxCompletedHole, courseSi);
    }
    
    function calculateGame3Points(players, flight1Data, flight2Data, maxCompletedHole, course, flight1Scores, flight2Scores) {
        // If no holes completed, return default
        if (maxCompletedHole === 0) {
            var strkRow = new Array(18).fill("-");
            return {
                teamAPoints: 0.5,
                teamBPoints: 0.5,
                strkRow: strkRow,
                strkTotal: "-"
            };
        }
        
        return GameStroke.calculate(players, flight1Scores, flight2Scores, maxCompletedHole);
    }
    
    function aggregateTR(game1Points, game2Points, game3Points) {
        return {
            teamA: game1Points.teamAPoints + game2Points.teamAPoints + game3Points.teamAPoints,
            teamB: game1Points.teamBPoints + game2Points.teamBPoints + game3Points.teamBPoints
        };
    }
    
    // ============================================================
    // CRD (Compute, Report, Display)
    // ============================================================
    
    function crd() {
        if (!gameDataLoaded || isRefreshing) return;
        if (!currentPlayers.length || !currentCourse) {
            console.log("GameController: CRD skipped - waiting for data");
            return;
        }
        
        isRefreshing = true;
        console.log("GameController: CRD started - startingHole:", startingHole);
        
        try {
            var flight1Data = GameData.getFlightData(1).data;
            var flight2Data = GameData.getFlightData(2).data;
            
            // Find max completed hole (based on PLAY ORDER - sequential processing)
            var maxCompletedHole = 0;
            for (var pos = 0; pos < 18; pos++) {
                var actualHole = GameData.getHoleAtStoragePosition(pos);
                var f1Hole = GameData.parseHoleData(flight1Data, actualHole);
                var f2Hole = GameData.parseHoleData(flight2Data, actualHole);
                if (f1Hole && f1Hole.saved && f2Hole && f2Hole.saved) {
                    maxCompletedHole = pos + 1;
                } else {
                    break;
                }
            }
            
            console.log("CRD: maxCompletedHole =", maxCompletedHole);
            
            // Build display scores with local changes
            var displayScores = {};
            for (var flight = 1; flight <= 2; flight++) {
                var flightPlayers = currentPlayers.filter(function(p) { return p.flight === flight; });
                
                for (var pos = 0; pos < 18; pos++) {
                    var actualHole = GameData.getHoleAtStoragePosition(pos);
                    for (var i = 0; i < flightPlayers.length; i++) {
                        var p = flightPlayers[i];
                        var playerIdx = findPlayerIndex(p.name);
                        if (playerIdx === -1) continue;
                        
                        var score = getCurrentScore(flight, actualHole, playerIdx);
                        displayScores[flight + "_" + actualHole + "_" + playerIdx] = score;
                    }
                }
            }
            
            // Separate scores by flight for Game 2 and Game 3
            var flight1Scores = {};
            var flight2Scores = {};
            for (var key in displayScores) {
                if (key.indexOf("1_") === 0) {
                    flight1Scores[key] = displayScores[key];
                } else if (key.indexOf("2_") === 0) {
                    flight2Scores[key] = displayScores[key];
                }
            }
            
            // Calculate all three games
            var game1Points = calculateGame1Points(currentPlayers, flight1Data, flight2Data, maxCompletedHole);
            var game2Points = calculateGame2Points(currentPlayers, flight1Data, flight2Data, maxCompletedHole, currentCourse.si, flight1Scores, flight2Scores);
            var game3Points = calculateGame3Points(currentPlayers, flight1Data, flight2Data, maxCompletedHole, currentCourse, flight1Scores, flight2Scores);
            var trPoints = aggregateTR(game1Points, game2Points, game3Points);
            
            var currentHoleByFlight = { 1: currentHole, 2: currentHole };
            
            // Check if current hole is saved
            var activeFlightData = (activeFlight === 1) ? flight1Data : flight2Data;
            var currentActualHole = GameData.getHoleAtStoragePosition(currentHole - 1);
            var currentHoleData = GameData.parseHoleData(activeFlightData, currentActualHole);
            var isSaved = currentHoleData ? currentHoleData.saved : false;
            
            for (var key in localScores) {
                if (key.indexOf(activeFlight + "_" + currentActualHole + "_") === 0) {
                    isSaved = false;
                    break;
                }
            }
            
            var canModify = (editableFlight === activeFlight);
            var modeDisplay = GameData.getModeDisplay();
            var modeClass = GameData.getModeClass();
            
            // Build saved holes arrays
            var displaySavedHoles = { 1: [], 2: [] };
            for (var pos = 0; pos < 18; pos++) {
                var actualHole = GameData.getHoleAtStoragePosition(pos);
                var f1Data = GameData.parseHoleData(flight1Data, actualHole);
                var f2Data = GameData.parseHoleData(flight2Data, actualHole);
                if (f1Data && f1Data.saved) displaySavedHoles[1].push(actualHole);
                if (f2Data && f2Data.saved) displaySavedHoles[2].push(actualHole);
            }
            
            // Calculate match bubbles
            var matchBubbles = calculateMatchBubbles(currentPlayers, displayScores, displaySavedHoles, currentHoleByFlight, maxCompletedHole);
            
            var newUIData = {
                players: currentPlayers,
                course: currentCourse,
                scores: displayScores,
                savedHoles: displaySavedHoles,
                currentHole: currentHole,
                currentActualHole: currentActualHole,
                currentHoleByFlight: currentHoleByFlight,
                activeFlight: activeFlight,
                isSaved: isSaved,
                canModify: canModify,
                userRole: (editableFlight === 1 ? "update1" : (editableFlight === 2 ? "update2" : "view")),
                editableFlight: editableFlight,
                gameDate: null,
                modeDisplay: modeDisplay,
                modeClass: modeClass,
                matchPoints: { teamA: game1Points.teamAPoints, teamB: game1Points.teamBPoints },
                teamPoints: { teamA: game2Points.teamAPoints, teamB: game2Points.teamBPoints },
                strokePoints: { teamA: game3Points.teamAPoints, teamB: game3Points.teamBPoints },
                t1Row: game2Points.t1Row,
                t2Row: game2Points.t2Row,
                t1Total: 0,
                t2Total: 0,
                strkRow: game3Points.strkRow,
                strkTotal: game3Points.strkTotal,
                matchBubbles: matchBubbles,
                trPoints: trPoints,
                startingHole: startingHole,
                playOrder: GameData.getPlayOrder(),
                naturalOrder: GameData.getNaturalOrder()
            };
            
            if (typeof window.updateGameUI === 'function') {
                window.updateGameUI(newUIData);
                console.log("GameController: UI updated");
                console.log("TR:", trPoints.teamA, "-", trPoints.teamB);
                console.log("Game1:", game1Points.teamAPoints, "-", game1Points.teamBPoints);
                console.log("Game2:", game2Points.teamAPoints, "-", game2Points.teamBPoints);
                console.log("Game3:", game3Points.teamAPoints, "-", game3Points.teamBPoints);
            }
        } catch (err) {
            console.error("GameController: CRD error", err);
        }
        
        isRefreshing = false;
    }
    
    function startAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(function() {
            if (gameDataLoaded && !isRefreshing) {
                if (GameData.hasPendingCrossEvent() || GameData.hasPendingSaveEvent()) {
                    console.log("GameController: Auto-refresh triggered");
                    localScores = {};
                    crd();
                    GameData.clearCrossEvent();
                    GameData.clearSaveEvent();
                }
            }
        }, 30000);
        console.log("GameController: Auto-refresh enabled (30 seconds)");
    }
    
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }
    
    // ============================================================
    // Event Handlers
    // ============================================================
    
    function handleScoreChange(detail) {
        console.log("GameController: Score change received", detail);
        
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
        
        console.log("GameController: Updated localScores[" + key + "] = " + newScore);
        
        crd();
    }
    
    function handleSaveHole() {
        console.log("GameController: Save hole - currentHole:", currentHole);
        
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
        
        var scoresToSave = {
            a1: a1Score,
            a2: a2Score,
            b1: b1Score,
            b2: b2Score
        };
        
        GameData.saveCurrentHole(currentActualHole, scoresToSave, currentCourse ? currentCourse.par : null, function(success) {
            if (success) {
                console.log("GameController: Save completed for hole", currentActualHole);
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
            } else {
                console.error("GameController: Save failed");
            }
        });
    }
    
    function handleNextHole() {
        console.log("GameController: Next hole - current:", currentHole);
        
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
        
        if (!isSaved) {
            console.log("GameController: Cannot go to next hole - current hole not saved");
            return;
        }
        
        if (currentHole < 18) {
            currentHole++;
            crd();
        } else {
            console.log("GameController: Already at last hole");
        }
    }
    
    function handlePrevHole() {
        console.log("GameController: Prev hole - current:", currentHole);
        if (currentHole > 1) {
            currentHole--;
            crd();
        }
    }
    
    function handleRefresh() {
        console.log("GameController: Manual refresh");
        localScores = {};
        GameData.forceRefresh();
        crd();
    }
    
    function handleMainMenu() {
        console.log("GameController: Main menu");
        window.location.href = "index.html";
    }
    
    function handleSwitchRole() {
        console.log("GameController: Switch role");
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
        console.log("GameController: Initializing v1.11...");
        
        window.addEventListener('scoreChange', function(e) {
            if (e.detail) handleScoreChange(e.detail);
        });
        window.addEventListener('saveHole', function() { handleSaveHole(); });
        window.addEventListener('nextHole', function() { handleNextHole(); });
        window.addEventListener('prevHole', function() { handlePrevHole(); });
        window.addEventListener('refresh', function() { handleRefresh(); });
        window.addEventListener('mainMenu', function() { handleMainMenu(); });
        window.addEventListener('switchRole', function() { handleSwitchRole(); });
        
        GameData.setCallbacks(function() {
            console.log("GameData: Data changed");
            if (currentPlayers.length && currentCourse) {
                gameDataLoaded = true;
                crd();
            }
        }, function(msg) {
            console.error("GameData error:", msg);
        });
        
        SessionManager.initSession("game.html", "index.html", function(session) {
            console.log("GameController: Session initialized");
            
            if (typeof window.setDeviceId === 'function') {
                window.setDeviceId(SessionManager.getDeviceIdDisplay());
            }
            
            GameData.loadGameFromSession(session, function(success) {
                if (success) {
                    console.log("GameController: Game data loaded");
                    
                    var metadata = GameData.getGameMetadata();
                    gameMode = metadata.gameMode;
                    editableFlight = metadata.editableFlight;
                    activeFlight = metadata.editableFlight || 1;
                    startingHole = metadata.startingHole || 1;
                    
                    var storedGame = sessionStorage.getItem("currentGame");
                    if (storedGame) {
                        var gameData = JSON.parse(storedGame);
                        currentCourse = gameData.course;
                        currentPlayers = gameData.players;
                        GameData.setCourse(currentCourse);
                        GameData.setPlayers(currentPlayers);
                        console.log("GameController: Course and players loaded", currentCourse.name, currentPlayers.length);
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