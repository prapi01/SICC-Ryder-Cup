/*
FILE: js/index-hidden.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Hidden admin functions for index.html
   - duplicateMasterRecord(): Copies Master_Record_H17_2028 to today's date
   - Sets gameStarted: true, resets locks/signatures/submitted
   - Displays new Game ID in faint green next to device ID
   - Called by double-clicking golf flag icon in index.html
DEPENDS ON: Firebase Firestore (db object must be available)
STATUS: Ready for integration
*/

// ============================================================
// Display Game ID in faint green next to device tag
// ============================================================

function displayGameId(gameId) {
    var deviceTag = document.getElementById("deviceTag");
    if (deviceTag) {
        // Check if game ID already displayed
        var currentText = deviceTag.innerHTML;
        if (currentText.indexOf("Game:") !== -1) {
            // Replace existing game ID
            deviceTag.innerHTML = currentText.replace(/Game: [A-Za-z0-9_]+/, "Game: " + gameId);
        } else {
            // Append game ID
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
    
    var today = new Date().toISOString().split('T')[0];
    
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
    
    // Reference to Master Record
    var masterRef = db.collection("scheduledGames").doc("Master_Record_H17_2028");
    
    masterRef.get().then(function(doc) {
        if (!doc.exists) {
            alert("❌ Master_Record_H17_2028 not found in Firestore");
            return;
        }
        
        var original = doc.data();
        var today = new Date().toISOString().split('T')[0];
        var newId = 'Game_H17_' + today.replace(/-/g, '') + '_' + Date.now();
        
        // Create duplicate with correct settings
        var duplicate = JSON.parse(JSON.stringify(original));
        
        // Update fields for new game
        duplicate.date = today;
        duplicate.gameStarted = true;  // Prevents reset on load
        duplicate.locks = { f1: null, f2: null };
        duplicate.signatures = {};
        duplicate.submitted = {};
        
        // Remove old timestamps and id
        delete duplicate.id;
        delete duplicate.createdAt;
        delete duplicate.updatedAt;
        
        // Add new timestamps
        duplicate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        duplicate.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        // Save the new game
        return db.collection("scheduledGames").doc(newId).set(duplicate);
    }).then(function() {
        console.log("✅ Game created with today's date. ID:", newId);
        alert("✅ Game created!\n\nGame ID: " + newId + "\n\nRefresh the page and click TODAY GAME.");
        displayGameId(newId);
        
        // Optional: Refresh the page after user clicks OK
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
    // Wait for DOM to load
    setTimeout(function() {
        // Get current game ID on page load
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
VERSION: 1.00
KEY CHANGES:
   - NEW: Hidden admin functions for index.html
   - duplicateMasterRecord(): Copies Master_Record_H17_2028 to today's date
   - Sets gameStarted: true, resets locks/signatures/submitted
   - Displays new Game ID in faint green next to device ID
   - Called by double-clicking golf flag icon in index.html
DEPENDS ON: Firebase Firestore (db object must be available)
STATUS: Ready for integration
*/