// FILE: js/game-controller.js - VERSION 1.18
// SEPARATE START OF GAME STATE: No calculations until any flight saves a hole

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
    
    // Track the highest hole where both flights have saved
    var lastSyncedHole = 0;
    
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
    
    // Calculate ONLY intra-flight bubbles for a specific flight
    function calculateIntraFlightBubbles(players, scores, flight, currentHoleForFlight) {
        var bubbles = {};
        var flightPlayers = players.filter(function(p) { return p.flight === flight; });
        var courseSi = currentCourse ? currentCourse.si : null;
        
        for (var i = 0; i < flightPlayers.length; i++) {
            var playerA = flightPlayers[i];
            for (var j = 0; j < flightPlayers.length; j++) {
                var playerB = flightPlayers[j];
                if (playerA.team !== playerB.team) {
                    var key = playerA.name + "_vs_" + playerB.name;
                    var upToHole = currentHoleForFlight;
                    var flightSavedHoles = []; // Use current hole as upToHole
                    
                    var result = GameMatch.getMatchResult(
                        playerA, playerB, scores, flightSavedHoles, players, upToHole, courseSi
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
    
    // Calculate ALL bubbles (intra + cross) for a flight when synced
    function calculateAllBubblesForFlight(players, scores, savedHoles, flight, currentHoleForFlight, maxCompletedHole) {
        var bubbles = {};
        var flightPlayers = players.filter(function(p) { return p.flight === flight; });
        var courseSi = currentCourse ? currentCourse.si : null;
        
        // Intra-flight bubbles
        for (var i = 0; i < flightPlayers.length; i++) {
            var playerA = flightPlayers[i];
            for (var j = 0; j < flightPlayers.length; j++) {
                var playerB = flightPlayers[j];
                if (playerA.team !== playerB.team) {
                    var key = playerA.name + "_vs_" + playerB.name;
                    var upToHole = currentHoleForFlight;
                    var flightSavedHoles = savedHoles[flight] || [];
                    
                    var result = GameMatch.getMatchResult(
                        playerA, playerB, scores, flightSavedHoles, players, upToHole, courseSi
                    );
                    
                    if (result === "⏳") {
                        result = "AS";
                    }
                    bubbles[key] = result;
                }
            }
        }
        
        // Cross-flight bubbles (only if synced)
        if (maxCompletedHole > 0) {
            for (var i = 0; i < flightPlayers.length; i++) {
                var playerA = flightPlayers[i];
                for (var j = 0; j < players.length; j++) {
                    var playerB = players[j];
                    if (playerA.team !== playerB.team && playerA.flight !== playerB.flight) {
                        var key = playerA.name + "_vs_" + playerB.name;
                        var upToHole = maxCompletedHole;
                        
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
        }
        
        return bubbles;
    }
    
    function calculateGame1Points(players, flight1Data, flight2Data, maxCompletedHole) {
        if (maxCompletedHole === 0) {
            return { teamAPoints: 8, teamBPoints: 8 };
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
        return GameTeam.calculate(players, flight1Scores, flight2Scores, maxCompletedHole, courseSi);
    }
    
    function calculateGame3Points(players, flight1Data, flight2Data, maxCompletedHole, course, flight1Scores, flight2Scores) {
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
    
    function crd() {
        if (!gameDataLoaded || isRefreshing) return;
        if (!currentPlayers.length || !currentCourse) {
            return;
        }
        
        isRefreshing = true;
        
        try {
            var flight1Data = GameData.getFlightData(1).data;
            var flight2Data = GameData.getFlightData(2).data;
            
            // Find max completed hole (both flights have saved)
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
            
            lastSyncedHole = maxCompletedHole;
            
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
            
            var flight1Scores = {};
            var flight2Scores = {};
            for (var key in displayScores) {
                if (key.indexOf("1_") === 0) flight1Scores[key] = displayScores[key];
                else if (key.indexOf("2_") === 0) flight2Scores[key] = displayScores[key];
            }
            
            var game1Points = calculateGame1Points(currentPlayers, flight1Data, flight2Data, maxCompletedHole);
            var game2Points = calculateGame2Points(currentPlayers, flight1Data, flight2Data, maxCompletedHole, currentCourse.si, flight1Scores, flight2Scores);
            var game3Points = calculateGame3Points(currentPlayers, flight1Data, flight2Data, maxCompletedHole, currentCourse, flight1Scores, flight2Scores);
            var trPoints = aggregateTR(game1Points, game2Points, game3Points);
            
            var currentHoleByFlight = { 1: currentHole, 2: currentHole };
            
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
            
            // ============================================================
            // START OF GAME STATE DETECTION
            // ============================================================
            var gameStarted = (displaySavedHoles[1].length > 0 || displaySavedHoles[2].length > 0);
            
            var matchBubbles = {};
            
            if (!gameStarted) {
                // START OF GAME STATE - No calculations, all bubbles remain default "AS"
                // matchBubbles remains empty - UI will show grey "AS"
                console.log("START OF GAME: No bubbles calculated");
            } else if (maxCompletedHole === 0) {
                // GAME STARTED but no holes synced yet
                // Calculate ONLY intra-flight bubbles for the active flight
                var activeFlightBubbles = calculateIntraFlightBubbles(currentPlayers, displayScores, activeFlight, currentHole);
                for (var key in activeFlightBubbles) {
                    matchBubbles[key] = activeFlightBubbles[key];
                }
                console.log("GAME STARTED - Active flight intra bubbles calculated");
            } else {
                // GAME STARTED and holes are synced
                // Calculate all bubbles for both flights
                var flight1AllBubbles = calculateAllBubblesForFlight(currentPlayers, displayScores, displaySavedHoles, 1, currentHole, maxCompletedHole);
                var flight2AllBubbles = calculateAllBubblesForFlight(currentPlayers, displayScores, displaySavedHoles, 2, currentHole, maxCompletedHole);
                
                for (var key in flight1AllBubbles) matchBubbles[key] = flight1AllBubbles[key];
                for (var key in flight2AllBubbles) matchBubbles[key] = flight2AllBubbles[key];
                console.log("GAME STARTED - All bubbles calculated (synced)");
            }
            
            var flight1Started = (displaySavedHoles[1].length > 0);
            var flight2Started = (displaySavedHoles[2].length > 0);
            
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
                naturalOrder: GameData.getNaturalOrder(),
                flight1Started: flight1Started,
                flight2Started: flight2Started,
                lastSyncedHole: lastSyncedHole
            };
            
            if (typeof window.updateGameUI === 'function') {
                window.updateGameUI(newUIData);
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
                    localScores = {};
                    crd();
                    GameData.clearCrossEvent();
                    GameData.clearSaveEvent();
                }
            }
        }, 30000);
    }
    
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
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
    
    function init() {
        if (isInitialized) return;
        console.log("GameController: Initializing v1.18...");
        
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
            if (currentPlayers.length && currentCourse) {
                gameDataLoaded = true;
                crd();
            }
        }, function(msg) {
            console.error("GameData error:", msg);
        });
        
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