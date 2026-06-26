/*
FILE: js/real-game-state.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: _firestoreChanged flag to track Firestore changes during WRV
   - ADDED: isFirestoreChanged() getter
   - ADDED: setFirestoreChanged() setter
   - This flag allows WRV to detect if Firestore changed while it was running
   - Enables cache refresh to be triggered by WRV completion, not by listener
   - PRESERVED: ALL v1.01 functions and API unchanged
   - PRESERVED: ALL existing functionality
DEPENDS ON: None (pure state management)
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.REAL_GAME_STATE_VERSION = "1.02";

var RealGameState = (function() {
    
    console.log("[REAL-GAME-STATE] Initializing v1.02 - Firestore changed flag added");
    
    // ============================================================
    // State Variables
    // ============================================================
    
    var _gameId = null;
    var _editableFlight = 1;
    var _canEdit = true;
    var _currentHole = 1;
    var _localChanges = {};
    var _startingHole = 1;
    var _teamGameFormat = "tournament";
    
    var _courseName = "";
    var _coursePar = [];
    var _courseSi = [];
    var _allPlayers = [];
    
    var _isGameCompleteFlag = false;
    var _celebrationTriggered = false;
    var _saveInProgress = false;
    
    var _activeWaitModal = null;
    var _activeCompleteModal = null;
    
    var _usedPreloadedData = false;
    var _takeoverDetected = false;
    var _viewOtherFlight = false;
    
    var _firestoreUnsubscribe = null;
    
    // ============================================================
    // v1.01: WRV In Progress Flag
    // ============================================================
    var _wrvInProgress = false;
    
    // ============================================================
    // v1.02: Firestore Changed Flag
    // ============================================================
    var _firestoreChanged = false;
    
    // ============================================================
    // Debug Configuration
    // ============================================================
    
    var _DEBUG_TARGET_HOLE = 10;
    var _DEBUG_CALL_COUNTERS = {
        calc: 0,
        update: 0,
        write: 0,
        save: 0
    };
    
    // ============================================================
    // Getters and Setters
    // ============================================================
    
    function getGameId() { return _gameId; }
    function setGameId(value) { _gameId = value; }
    
    function getEditableFlight() { return _editableFlight; }
    function setEditableFlight(value) { _editableFlight = value; }
    
    function getCanEdit() { return _canEdit; }
    function setCanEdit(value) { _canEdit = value; }
    
    function getCurrentHole() { return _currentHole; }
    function setCurrentHole(value) { _currentHole = value; }
    
    function getLocalChanges() { return _localChanges; }
    function setLocalChanges(value) { _localChanges = value; }
    function addLocalChange(flight, hole, playerName, score) {
        var key = flight + "_" + hole + "_" + playerName;
        _localChanges[key] = score;
    }
    function removeLocalChangesForHole(flight, hole) {
        for (var key in _localChanges) {
            if (key.startsWith(flight + "_" + hole + "_")) {
                delete _localChanges[key];
            }
        }
    }
    function getLocalChange(flight, hole, playerName) {
        var key = flight + "_" + hole + "_" + playerName;
        return _localChanges[key];
    }
    function clearLocalChanges() {
        _localChanges = {};
    }
    function hasUnsavedChanges(flight, hole) {
        for (var key in _localChanges) {
            if (key.startsWith(flight + "_" + hole + "_")) {
                return true;
            }
        }
        return false;
    }
    
    function getStartingHole() { return _startingHole; }
    function setStartingHole(value) { _startingHole = value; }
    
    function getTeamGameFormat() { return _teamGameFormat; }
    function setTeamGameFormat(value) { _teamGameFormat = value; }
    
    function getCourseName() { return _courseName; }
    function setCourseName(value) { _courseName = value; }
    
    function getCoursePar() { return _coursePar; }
    function setCoursePar(value) { _coursePar = value; }
    
    function getCourseSi() { return _courseSi; }
    function setCourseSi(value) { _courseSi = value; }
    
    function getAllPlayers() { return _allPlayers; }
    function setAllPlayers(value) { _allPlayers = value; }
    
    function isGameComplete() { return _isGameCompleteFlag; }
    function setGameComplete(value) { _isGameCompleteFlag = value; }
    
    function isCelebrationTriggered() { return _celebrationTriggered; }
    function setCelebrationTriggered(value) { _celebrationTriggered = value; }
    
    function isSaveInProgress() { return _saveInProgress; }
    function setSaveInProgress(value) { _saveInProgress = value; }
    
    function getActiveWaitModal() { return _activeWaitModal; }
    function setActiveWaitModal(value) { _activeWaitModal = value; }
    
    function getActiveCompleteModal() { return _activeCompleteModal; }
    function setActiveCompleteModal(value) { _activeCompleteModal = value; }
    
    function isUsedPreloadedData() { return _usedPreloadedData; }
    function setUsedPreloadedData(value) { _usedPreloadedData = value; }
    
    function isTakeoverDetected() { return _takeoverDetected; }
    function setTakeoverDetected(value) { _takeoverDetected = value; }
    
    function isViewOtherFlight() { return _viewOtherFlight; }
    function setViewOtherFlight(value) { _viewOtherFlight = value; }
    
    function getFirestoreUnsubscribe() { return _firestoreUnsubscribe; }
    function setFirestoreUnsubscribe(value) { _firestoreUnsubscribe = value; }
    
    function getDebugTargetHole() { return _DEBUG_TARGET_HOLE; }
    function getDebugCallCounters() { return _DEBUG_CALL_COUNTERS; }
    function incrementDebugCounter(counterName) {
        if (_DEBUG_CALL_COUNTERS[counterName] !== undefined) {
            _DEBUG_CALL_COUNTERS[counterName]++;
        }
    }
    
    // ============================================================
    // v1.01: WRV Flag Getters and Setters
    // ============================================================
    
    function isWRVInProgress() { return _wrvInProgress; }
    function setWRVInProgress(value) { _wrvInProgress = value === true; }
    
    // ============================================================
    // v1.02: Firestore Changed Flag Getters and Setters
    // ============================================================
    
    function isFirestoreChanged() { return _firestoreChanged; }
    function setFirestoreChanged(value) { _firestoreChanged = value === true; }
    
    // ============================================================
    // Reset State
    // ============================================================
    
    function resetState() {
        _gameId = null;
        _editableFlight = 1;
        _canEdit = true;
        _currentHole = 1;
        _localChanges = {};
        _startingHole = 1;
        _teamGameFormat = "tournament";
        _courseName = "";
        _coursePar = [];
        _courseSi = [];
        _allPlayers = [];
        _isGameCompleteFlag = false;
        _celebrationTriggered = false;
        _saveInProgress = false;
        _activeWaitModal = null;
        _activeCompleteModal = null;
        _usedPreloadedData = false;
        _takeoverDetected = false;
        _viewOtherFlight = false;
        _firestoreUnsubscribe = null;
        _wrvInProgress = false;
        _firestoreChanged = false;
        _DEBUG_CALL_COUNTERS = {
            calc: 0,
            update: 0,
            write: 0,
            save: 0
        };
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        // Getters
        getGameId: getGameId,
        getEditableFlight: getEditableFlight,
        getCanEdit: getCanEdit,
        getCurrentHole: getCurrentHole,
        getLocalChanges: getLocalChanges,
        getStartingHole: getStartingHole,
        getTeamGameFormat: getTeamGameFormat,
        getCourseName: getCourseName,
        getCoursePar: getCoursePar,
        getCourseSi: getCourseSi,
        getAllPlayers: getAllPlayers,
        isGameComplete: isGameComplete,
        isCelebrationTriggered: isCelebrationTriggered,
        isSaveInProgress: isSaveInProgress,
        getActiveWaitModal: getActiveWaitModal,
        getActiveCompleteModal: getActiveCompleteModal,
        isUsedPreloadedData: isUsedPreloadedData,
        isTakeoverDetected: isTakeoverDetected,
        isViewOtherFlight: isViewOtherFlight,
        getFirestoreUnsubscribe: getFirestoreUnsubscribe,
        getDebugTargetHole: getDebugTargetHole,
        getDebugCallCounters: getDebugCallCounters,
        // v1.01: WRV Flag
        isWRVInProgress: isWRVInProgress,
        // v1.02: Firestore Changed Flag
        isFirestoreChanged: isFirestoreChanged,
        
        // Setters
        setGameId: setGameId,
        setEditableFlight: setEditableFlight,
        setCanEdit: setCanEdit,
        setCurrentHole: setCurrentHole,
        setLocalChanges: setLocalChanges,
        setStartingHole: setStartingHole,
        setTeamGameFormat: setTeamGameFormat,
        setCourseName: setCourseName,
        setCoursePar: setCoursePar,
        setCourseSi: setCourseSi,
        setAllPlayers: setAllPlayers,
        setGameComplete: setGameComplete,
        setCelebrationTriggered: setCelebrationTriggered,
        setSaveInProgress: setSaveInProgress,
        setActiveWaitModal: setActiveWaitModal,
        setActiveCompleteModal: setActiveCompleteModal,
        setUsedPreloadedData: setUsedPreloadedData,
        setTakeoverDetected: setTakeoverDetected,
        setViewOtherFlight: setViewOtherFlight,
        setFirestoreUnsubscribe: setFirestoreUnsubscribe,
        // v1.01: WRV Flag Setter
        setWRVInProgress: setWRVInProgress,
        // v1.02: Firestore Changed Flag Setter
        setFirestoreChanged: setFirestoreChanged,
        
        // Local changes helpers
        addLocalChange: addLocalChange,
        removeLocalChangesForHole: removeLocalChangesForHole,
        getLocalChange: getLocalChange,
        clearLocalChanges: clearLocalChanges,
        hasUnsavedChanges: hasUnsavedChanges,
        
        // Debug counters
        incrementDebugCounter: incrementDebugCounter,
        
        // Reset
        resetState: resetState
    };
    
})();

// Make available globally
window.RealGameState = RealGameState;

/*
FILE: js/real-game-state.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: _firestoreChanged flag to track Firestore changes during WRV
   - ADDED: isFirestoreChanged() getter
   - ADDED: setFirestoreChanged() setter
   - This flag allows WRV to detect if Firestore changed while it was running
   - Enables cache refresh to be triggered by WRV completion, not by listener
   - PRESERVED: ALL v1.01 functions and API unchanged
   - PRESERVED: ALL existing functionality
DEPENDS ON: None (pure state management)
STATUS: Ready for integration
*/