/*
FILE: js/index-hidden.js
VERSION: 1.07
KEY CHANGES from v1.06:
   - ADDED: showAdminModal() - displays admin options on Cmd+Click or Long-click
   - ADDED: refreshGameList() - force refresh the game list (reload page)
   - ADDED: viewAllGames() - navigate to manage-games with showAll flag
   - ADDED: attachAdminHandler() - attaches Cmd+Click and Long-click to golf icon
   - All admin functions now use Modal.alert() instead of system alert()
   - Exported all functions for global access
   - All existing functionality preserved
DEPENDS ON: Firebase Firestore (db object must be available), Modal.js
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
// Generate Short Game ID - Format: GM_YYMMDD_HHMM_XX
// ============================================================

function generateGameId() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var yymmdd = yy + mm + dd;
    var hh = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var hhmm = hh + min;
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
        if (typeof Modal !== 'undefined' && Modal.alert) {
            Modal.alert("Firebase not ready. Please refresh and try again.");
        } else {
            alert("Firebase not ready. Please refresh and try again.");
        }
        return;
    }
    
    var newId;
    var masterRef = db.collection("scheduledGames").doc("MASTER_RECORD");
    
    masterRef.get().then(function(doc) {
        if (!doc.exists) {
            var msg = "❌ MASTER_RECORD not found in Firestore.\n\nPlease ensure the Master Record has been created.";
            if (typeof Modal !== 'undefined' && Modal.alert) {
                Modal.alert(msg);
            } else {
                alert(msg);
            }
            return;
        }
        
        var original = doc.data();
        var today = getLocalDate();
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
        var msg = "✅ Game created from MASTER_RECORD!\n\nGame ID: " + newId + "\n\nRefresh the page and click GAME DAY.";
        if (typeof Modal !== 'undefined' && Modal.alert) {
            Modal.alert(msg);
        } else {
            alert(msg);
        }
        if (typeof displayGameId === 'function') {
            displayGameId(newId);
        }
        setTimeout(function() {
            window.location.reload();
        }, 1000);
    }).catch(function(err) {
        console.error("Error creating duplicate:", err);
        var msg = "❌ Error creating game: " + err.message;
        if (typeof Modal !== 'undefined' && Modal.alert) {
            Modal.alert(msg);
        } else {
            alert(msg);
        }
    });
}

// ============================================================
// v1.07: Show Admin Modal with options
// ============================================================

function showAdminModal() {
    var modalHtml = `
        <div class="admin-modal-overlay" id="adminModal">
            <div class="admin-modal">
                <div class="admin-modal-title">⚙️ ADMIN FUNCTIONS</div>
                <div class="admin-modal-subtitle">Cmd+Click or long press on the golf icon to access</div>
                <div class="admin-modal-options">
                    <button class="admin-modal-option" id="adminDuplicateBtn">
                        <span class="admin-option-icon">📋</span>
                        <span class="admin-option-label">Duplicate Master Record</span>
                        <span class="admin-option-desc">Create today's game from MASTER_RECORD</span>
                    </button>
                    <button class="admin-modal-option" id="adminManageGamesBtn">
                        <span class="admin-option-icon">📂</span>
                        <span class="admin-option-label">Manage All Games</span>
                        <span class="admin-option-desc">View all scheduled games (including past)</span>
                    </button>
                    <button class="admin-modal-option" id="adminRefreshBtn">
                        <span class="admin-option-icon">🔄</span>
                        <span class="admin-option-label">Refresh Game Data</span>
                        <span class="admin-option-desc">Reload games from Firestore</span>
                    </button>
                </div>
                <button class="admin-modal-close" id="adminCloseBtn">Close</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('adminCloseBtn').onclick = function() {
        document.getElementById('adminModal').remove();
    };
    
    document.getElementById('adminModal').onclick = function(e) {
        if (e.target === this) {
            this.remove();
        }
    };
    
    document.getElementById('adminDuplicateBtn').onclick = function() {
        document.getElementById('adminModal').remove();
        duplicateMasterRecord();
    };
    
    document.getElementById('adminManageGamesBtn').onclick = function() {
        document.getElementById('adminModal').remove();
        window.location.href = "manage-games.html?showAll=true";
    };
    
    document.getElementById('adminRefreshBtn').onclick = function() {
        document.getElementById('adminModal').remove();
        refreshGameList();
    };
}

// ============================================================
// v1.07: Refresh Game List
// ============================================================

function refreshGameList() {
    if (typeof Modal !== 'undefined' && Modal.alert) {
        Modal.alert("🔄 Refreshing game data...\n\nThe page will reload.");
    } else {
        alert("Refreshing game data...");
    }
    setTimeout(function() {
        window.location.reload();
    }, 500);
}

// ============================================================
// v1.07: View All Games (redirect to manage-games with showAll)
// ============================================================

function viewAllGames() {
    window.location.href = "manage-games.html?showAll=true";
}

// ============================================================
// Initialize hidden admin listeners (called from index.html)
// ============================================================

function initHiddenAdmin() {
    setTimeout(function() {
        getCurrentGameId();
    }, 2000);
}

// ============================================================
// v1.07: Attach Cmd+Click and Long-click handler to golf icon
// ============================================================

function attachAdminHandler() {
    var golfIcon = document.getElementById('golfIcon');
    if (!golfIcon) {
        // Try again after a short delay
        setTimeout(attachAdminHandler, 500);
        return;
    }
    
    // Remove existing listeners to avoid duplicates
    var newGolfIcon = golfIcon.cloneNode(true);
    golfIcon.parentNode.replaceChild(newGolfIcon, golfIcon);
    
    // Cmd+Click (Mac) or Ctrl+Click (Windows)
    newGolfIcon.addEventListener('click', function(e) {
        if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            showAdminModal();
        }
    });
    
    // Double-click as fallback (for users who don't know Cmd+Click)
    newGolfIcon.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showAdminModal();
    });
    
    // Long-click support for mobile (800ms hold)
    var holdTimer = null;
    newGolfIcon.addEventListener('pointerdown', function(e) {
        // Don't trigger on Cmd+Click
        if (e.metaKey || e.ctrlKey) return;
        holdTimer = setTimeout(function() {
            showAdminModal();
        }, 800);
    });
    newGolfIcon.addEventListener('pointerup', function(e) {
        clearTimeout(holdTimer);
    });
    newGolfIcon.addEventListener('pointerleave', function(e) {
        clearTimeout(holdTimer);
    });
}

// ============================================================
// v1.07: Show admin modal directly (called from index.html bubble)
// ============================================================

// Make functions available globally
window.duplicateMasterRecord = duplicateMasterRecord;
window.initHiddenAdmin = initHiddenAdmin;
window.displayGameId = displayGameId;
window.getCurrentGameId = getCurrentGameId;
window.clearDisplayedGameId = clearDisplayedGameId;
window.generateGameId = generateGameId;
window.showAdminModal = showAdminModal;
window.refreshGameList = refreshGameList;
window.viewAllGames = viewAllGames;
window.attachAdminHandler = attachAdminHandler;

/*
FILE: js/index-hidden.js
VERSION: 1.07
KEY CHANGES from v1.06:
   - ADDED: showAdminModal() - displays admin options on Cmd+Click or Long-click
   - ADDED: refreshGameList() - force refresh the game list (reload page)
   - ADDED: viewAllGames() - navigate to manage-games with showAll flag
   - ADDED: attachAdminHandler() - attaches Cmd+Click and Long-click to golf icon
   - All admin functions now use Modal.alert() instead of system alert()
   - Exported all functions for global access
   - All existing functionality preserved
DEPENDS ON: Firebase Firestore (db object must be available), Modal.js
STATUS: Ready for integration
*/