/*
FILE: js/index-hidden.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - CHANGED: Game ID format from "Game_YYYYMMDD_timestamp" to "GM_YYMMDD_HHMM_XX"
   - ADDED: generateGameId() function for short, readable game IDs
   - Format: GM_260605_1503_42 (GM_YYMMDD_HHMM_XX)
   - WHERE: YYMMDD = 2-digit year, 2-digit month, 2-digit day
   -        HHMM = 2-digit hour, 2-digit minute
   -        XX = 2-digit random number (00-99)
   - All other functionality identical to v1.05
DEPENDS ON: Firebase Firestore (db object must be available)
STATUS: Ready for integration
*/

// ============================================================
// Helper: Get local date string (YYYY-MM-DD)
// ============================================================

function getLocalDate() {
    var today = new Date();
    var year = today.getFullYear();
    var month = String(today.getMonth() + 1).padStart(2, '0');
    var day = String(today.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

// ============================================================
// NEW v1.06: Generate Short Game ID
// Format: GM_YYMMDD_HHMM_XX
// Example: GM_260605_1503_42
// ============================================================

function generateGameId() {
    var now = new Date();
    
    // Get YYMMDD (2-digit year, month, day)
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var yymmdd = yy + mm + dd;
    
    // Get HHMM (24-hour hour and minute)
    var hh = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var hhmm = hh + min;
    
    // Get random 2-digit number (00-99)
    var random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    
    return 'GM_' + yymmdd + '_' + hhmm + '_' + random;
}

// ============================================================
// Display Game ID in faint green next to device tag
// ============================================================

function displayGameId(gameId) {
    var deviceTag = document.getElementById("deviceTag");
    if (deviceTag) {
        var currentText = deviceTag.innerHTML;
        if (currentText.indexOf("Game:") !== -1) {
            deviceTag.innerHTML = currentText.replace(/Game: [A-Za-z0-9_]+/, "Game: " + gameId);
        } else {
            deviceTag.innerHTML = currentText + ' | <span style="color: #4caf50; opacity: 0.7;">Game: ' + gameId + '</span>';
        }
    }
}

// ============================================================
// Clear displayed Game ID
// ============================================================

function clearDisplayedGameId() {
    var deviceTag = document.getElementById("deviceTag");
    if (deviceTag) {
        var currentText = deviceTag.innerHTML;
        var gameIdIndex = currentText.indexOf(" | Game:");
        if (gameIdIndex !== -1) {
            deviceTag.innerHTML = currentText.substring(0, gameIdIndex);
        }
    }
}

// ============================================================
// Get current game ID from Firestore (for active game)
// ============================================================

function getCurrentGameId() {
    if (!db) {
        console.warn("Firebase not ready");
        return;
    }
    
    var today = getLocalDate();
    
    db.collection("scheduledGames")
        .where("date", "==", today)
        .limit(1)
        .get()
        .then(function(snapshot) {
            if (!snapshot.empty) {
                var gameId = snapshot.docs[0].id;
                displayGameId(gameId);
            }
        })
        .catch(function(err) {
            console.warn("Error getting current game:", err);
        });
}

// ============================================================
// Duplicate Master Record to Today's Date
// ============================================================

function duplicateMasterRecord() {
    if (!db) {
        alert("Firebase not ready. Please refresh and try again.");
        return;
    }
    
    var newId;
    
    // Using generic MASTER_RECORD name (no year dependency)
    var masterRef = db.collection("scheduledGames").doc("MASTER_RECORD");
    
    masterRef.get().then(function(doc) {
        if (!doc.exists) {
            alert("❌ MASTER_RECORD not found in Firestore.\n\nPlease ensure the Master Record has been created.");
            return;
        }
        
        var original = doc.data();
        var today = getLocalDate();
        
        // NEW v1.06: Use short game ID format
        newId = generateGameId();
        
        var duplicate = JSON.parse(JSON.stringify(original));
        
        duplicate.date = today;
        duplicate.gameStarted = true;
        duplicate.locks = { f1: null, f2: null };
        duplicate.signatures = {};
        duplicate.submitted = {};
        
        delete duplicate.id;
        delete duplicate.createdAt;
        delete duplicate.updatedAt;
        
        duplicate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        duplicate.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        return db.collection("scheduledGames").doc(newId).set(duplicate);
    }).then(function() {
        console.log("✅ Game created with today's date. ID:", newId);
        alert("✅ Game created from MASTER_RECORD!\n\nGame ID: " + newId + "\n\nRefresh the page and click TODAY GAME.");
        if (typeof displayGameId === 'function') {
            displayGameId(newId);
        }
        setTimeout(function() {
            window.location.reload();
        }, 1000);
    }).catch(function(err) {
        console.error("Error creating duplicate:", err);
        alert("❌ Error creating game: " + err.message);
    });
}

// ============================================================
// Initialize hidden admin listeners (called from index.html)
// ============================================================

function initHiddenAdmin() {
    setTimeout(function() {
        getCurrentGameId();
    }, 2000);
}

// Export functions for global access
window.duplicateMasterRecord = duplicateMasterRecord;
window.initHiddenAdmin = initHiddenAdmin;
window.displayGameId = displayGameId;
window.getCurrentGameId = getCurrentGameId;
window.clearDisplayedGameId = clearDisplayedGameId;
window.generateGameId = generateGameId;

/*
FILE: js/index-hidden.js
VERSION: 1.06
KEY CHANGES from v1.05:
   - CHANGED: Game ID format from "Game_YYYYMMDD_timestamp" to "GM_YYMMDD_HHMM_XX"
   - ADDED: generateGameId() function for short, readable game IDs
   - Format: GM_260605_1503_42 (GM_YYMMDD_HHMM_XX)
   - WHERE: YYMMDD = 2-digit year, 2-digit month, 2-digit day
   -        HHMM = 2-digit hour, 2-digit minute
   -        XX = 2-digit random number (00-99)
   - All other functionality identical to v1.05
DEPENDS ON: Firebase Firestore (db object must be available)
STATUS: Ready for integration
*/