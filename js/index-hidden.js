/*
FILE: js/index-hidden.js
VERSION: 1.08
KEY CHANGES from v1.07:
   - REDESIGNED: Admin modal now uses Modal from modal.js (consistent UI)
   - Clean dark background with green borders
   - Proper pill buttons with icons and descriptions
   - Larger tap targets for mobile
   - Consistent with app's design language
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
// v1.08: Show Admin Modal using Modal from modal.js
// ============================================================

function showAdminModal() {
    // Remove any existing admin modal
    var existing = document.getElementById('adminModal');
    if (existing) existing.remove();
    
    var modalHtml = `
        <div class="shared-modal-overlay" id="adminModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; z-index:30000; padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);">
            <div class="shared-modal-container" style="background:#1a1a1a; border-radius:28px; padding:24px; max-width:380px; width:90%; text-align:center; border:2px solid #4caf50; animation:sharedModalFadeIn 0.2s ease-out;">
                
                <div style="font-size:1.2rem; font-weight:700; color:#4caf50; margin-bottom:4px;">⚙️ ADMIN FUNCTIONS</div>
                <div style="font-size:0.6rem; color:#888; margin-bottom:20px;">Cmd+Click or long press on the golf icon</div>
                
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
                    
                    <!-- Option 1: Duplicate Master Record -->
                    <button id="adminDuplicateBtn" style="background:#0a0a0a; border:1px solid #333; border-radius:16px; padding:14px 16px; text-align:left; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:12px; width:100%;">
                        <span style="font-size:1.5rem; width:36px; text-align:center; flex-shrink:0;">📋</span>
                        <div style="flex:1; text-align:left;">
                            <div style="font-size:0.85rem; font-weight:600; color:#4caf50;">Duplicate Master Record</div>
                            <div style="font-size:0.55rem; color:#666;">Create today's game from MASTER_RECORD</div>
                        </div>
                    </button>
                    
                    <!-- Option 2: Manage All Games -->
                    <button id="adminManageGamesBtn" style="background:#0a0a0a; border:1px solid #333; border-radius:16px; padding:14px 16px; text-align:left; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:12px; width:100%;">
                        <span style="font-size:1.5rem; width:36px; text-align:center; flex-shrink:0;">📂</span>
                        <div style="flex:1; text-align:left;">
                            <div style="font-size:0.85rem; font-weight:600; color:#4caf50;">Manage All Games</div>
                            <div style="font-size:0.55rem; color:#666;">View all scheduled games (including past)</div>
                        </div>
                    </button>
                    
                    <!-- Option 3: Refresh Game Data -->
                    <button id="adminRefreshBtn" style="background:#0a0a0a; border:1px solid #333; border-radius:16px; padding:14px 16px; text-align:left; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:12px; width:100%;">
                        <span style="font-size:1.5rem; width:36px; text-align:center; flex-shrink:0;">🔄</span>
                        <div style="flex:1; text-align:left;">
                            <div style="font-size:0.85rem; font-weight:600; color:#4caf50;">Refresh Game Data</div>
                            <div style="font-size:0.55rem; color:#666;">Reload games from Firestore</div>
                        </div>
                    </button>
                    
                </div>
                
                <button id="adminCloseBtn" style="background:#1a1a1a; border:1px solid #333; color:#888; padding:12px; border-radius:40px; font-size:0.9rem; font-weight:600; cursor:pointer; width:100%;">Close</button>
                
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add hover effects via CSS
    var style = document.createElement('style');
    style.textContent = `
        #adminModal button[id^="admin"]:not(#adminCloseBtn):hover {
            border-color: #4caf50 !important;
            background: #111 !important;
        }
        #adminModal button[id^="admin"]:not(#adminCloseBtn):active {
            transform: scale(0.98);
        }
        #adminModal #adminCloseBtn:hover {
            border-color: #4caf50 !important;
        }
        @keyframes sharedModalFadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    // Close button
    document.getElementById('adminCloseBtn').onclick = function() {
        document.getElementById('adminModal').remove();
        style.remove();
    };
    
    // Click on overlay to close
    document.getElementById('adminModal').onclick = function(e) {
        if (e.target === this) {
            this.remove();
            style.remove();
        }
    };
    
    // Option 1: Duplicate Master Record
    document.getElementById('adminDuplicateBtn').onclick = function() {
        document.getElementById('adminModal').remove();
        style.remove();
        duplicateMasterRecord();
    };
    
    // Option 2: Manage All Games
    document.getElementById('adminManageGamesBtn').onclick = function() {
        document.getElementById('adminModal').remove();
        style.remove();
        window.location.href = "manage-games.html?showAll=true";
    };
    
    // Option 3: Refresh Game Data
    document.getElementById('adminRefreshBtn').onclick = function() {
        document.getElementById('adminModal').remove();
        style.remove();
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
VERSION: 1.08
KEY CHANGES from v1.07:
   - REDESIGNED: Admin modal now uses consistent styling (dark background, green border)
   - Clean pill buttons with icons and descriptions
   - Larger tap targets for mobile
   - Uses shared-modal-container styling from modal.js
   - All existing functionality preserved
DEPENDS ON: Firebase Firestore (db object must be available), Modal.js
STATUS: Ready for integration
*/