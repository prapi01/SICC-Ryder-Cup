/*
FILE: js/index-hidden.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - CHANGED: Master Record reference from "MR_17H_2030" to "MASTER_RECORD"
   - UPDATED: Alert message to reflect new MR name
   - Generic name allows future master records without HTML changes
   - ALL other functionality identical to v1.04
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
        newId = 'Game_' + today.replace(/-/g, '') + '_' + Date.now();
        
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

/*
FILE: js/index-hidden.js
VERSION: 1.05
KEY CHANGES from v1.04:
   - CHANGED: Master Record reference from "MR_17H_2030" to "MASTER_RECORD"
   - UPDATED: Alert message to reflect new MR name
   - Generic name allows future master records without HTML changes
   - ALL other functionality identical to v1.04
DEPENDS ON: Firebase Firestore (db object must be available)
STATUS: Ready for integration
*/