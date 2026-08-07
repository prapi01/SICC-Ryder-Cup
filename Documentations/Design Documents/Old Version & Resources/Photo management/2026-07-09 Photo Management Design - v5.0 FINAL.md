# Photo Management System - Design Document v5.0 FINAL (UPDATED)

## SICC Ryder Cup App

---

### Document Information

| Property | Value |
|----------|-------|
| Document Type | System Design |
| Version | 5.0 FINAL |
| Date | 2026-07-14 |
| Status | ✓ FINAL - Approved |
| Purpose | Define the complete photo management flow with flag-based synchronization and user-first priority |

---

### Table of Contents

1. Critical Design Changes
2. Implementation Status
3. Overview
4. User-First Priority
5. Single Source of Truth: F1
6. Photo Flag System
7. Detailed Flows
8. Device Responsibilities
9. Flag Logic - Device Decision Matrix
10. Hole Save Flow - Correct Order
11. Data Separation
12. Key Functions
13. State Management
14. Error Handling & Resilience
15. VIEW Photo Trigger Mechanism
16. File Modification Summary
17. Testing Plan
18. Common Misunderstandings (FAQ)
19. Summary
20. Appendix A: iOS Shortcut Setup

---

## 1. Critical Design Changes

This document supersedes all previous versions.

| Change | Old Design (v4.0) | New Design (v5.0 FINAL) |
|--------|-------------------|-------------------------|
| **VIEW Photo Trigger** | Listener + flag check ONLY | **Score update detection** in realtime listener |
| **VIEW Trigger Timing** | On page load + listener | **Every F1/F2 score update** (H1-H17 play order) |
| **VIEW Trigger Skip** | Only when game complete | **Skip only on H18 play order completion** |
| **VIEW Navigation Photo Check** | Present in nextHole()/prevHole() | **REMOVED** - No longer triggers on navigation |
| **VIEW H17 Mandatory Check** | Present in nextHole()/prevHole() | **REMOVED** - Replaced by score update detection |
| **VIEW Reliability** | Depended on user navigating to H17 | **Checks on EVERY score update** - user can join anytime |
| **F1 Photo Upload** | ONLY F1 uploads photos | **UNCHANGED** - F1 remains the single source |
| **F2 Responsibility** | Photo download + History record | **UNCHANGED** - F2 remains history writer |

---

### Why This Change Was Needed

| Problem | Solution |
|---------|----------|
| VIEW users can join at any stage of the game | Photo check on EVERY score update ensures photo is ready regardless of join time |
| H17 trigger only fired when VIEW user manually navigated to H17 | Score update detection fires automatically when F1 or F2 saves H17 (or any hole) |
| Photo check on navigation was redundant | Navigation is not needed for photo detection - scores update via Firestore listener |
| ETag check is lightweight (HEAD request only) | Checking on every score update (up to 34 times per round) is acceptable |
| Users don't navigate in VIEW - it's read-only | Score updates are the only reliable trigger |

---

## 2. Implementation Status

**ALL COMPONENTS ARE NOW COMPLETE.** The photo management system is fully implemented and ready for production.

| # | Component | Status | Location | Notes |
|---|-----------|--------|----------|-------|
| 1 | `loadDefaultCelebrationPhoto()` | ✅ COMPLETE | celebration-photo.js | Loads default photo, sets flags T/F/F |
| 2 | `storeBlobInSessionStorage()` | ✅ COMPLETE | celebration-photo.js v1.12 | Stores blob directly (NO NETWORK) |
| 3 | `downloadPhotoToSessionStorage()` | ✅ COMPLETE | celebration-photo.js v1.12 | Downloads from URL to sessionStorage |
| 4 | Flag management functions | ✅ COMPLETE | celebration-photo.js | `setPhotoFlags()`, `checkPhotoFlags()`, `resetPhotoFlags()` |
| 5 | `loadDefaultCelebrationPhoto()` flag integration | ✅ COMPLETE | celebration-photo.js | Calls `setPhotoFlags()` with default URL |
| 6 | `checkAndRenameCelebrationPhoto()` flag integration | ✅ COMPLETE | celebration-photo.js | Calls `setPhotoFlags()` after upload |
| 7 | real-game-save.js - ONLY F1 calls photo check | ✅ COMPLETE | real-game-save.js | F2 never calls `checkAndRenameCelebrationPhoto()` |
| 8 | real-game-save.js - Photo check order | ✅ COMPLETE | real-game-save.js | Photo check AFTER UI update + user continues |
| 9 | F1 flag reset logic | ✅ COMPLETE | real-game-init.js | F1 listener: T/T/T → reset all flags |
| 10 | F2 flag check + download | ✅ COMPLETE | real-game-init.js | F2 checks flags, downloads if needed, sets f2Downloaded = true |
| 11 | VIEW flag check + download | ✅ COMPLETE | view-game.html v8.13 | VIEW checks flags, downloads if needed, sets viewDownloaded = true |
| 12 | **VIEW score update trigger** | ✅ **COMPLETE** | **view-game.html v8.13** | **Photo check on EVERY score update (H1-H17)** |
| 13 | **VIEW remove navigation trigger** | ✅ **COMPLETE** | **view-game.html v8.13** | **Removed from nextHole()/prevHole()** |
| 14 | `celebrationData` in `showGameCompleteModal()` | ✅ COMPLETE | real-game-nav.js v1.17 | Saves celebrationData before navigation |
| 15 | GitHub fallback removal | ✅ COMPLETE | sign-card.js v1.33 | No fallback - sessionStorage always has photo |
| 16 | `getCelebrationImage()` - sessionStorage only | ✅ COMPLETE | sign-card.js | Reads from sessionStorage only |
| 17 | `isHoleSavedInData()` helper | ✅ COMPLETE | view-game.html v8.13 | Checks if hole saved in data string |

---

## 3. Overview

### 3.1 System Goals

| Goal | Description |
|------|-------------|
| **User-First Priority** | UI updates immediately. All backend tasks (WRV, photo) happen in background. User never waits. |
| **Single Source of Truth** | ONE photo uploaded by ONE device (F1). All devices download the SAME photo from Firebase Storage. |
| **Reliable VIEW Photo Detection** | VIEW checks for new photo on EVERY score update (H1-H17 play order). User can join at ANY stage. |
| **Lightweight Checks** | ETag checks are HEAD requests (metadata only) - checking 34 times per round is acceptable. |

### 3.2 Key Design Principles

| Principle | Description |
|-----------|-------------|
| **User First** | UI updates → User continues → WRV → Photo. Never block the user. |
| **F1 is the Photo Orchestrator** | F1 detects, downloads, uploads, sets flags, and resets flags. |
| **F2 is the History Writer** | F2 downloads photo from FS, writes history record. |
| **VIEW is the Spectator** | VIEW downloads photo from FS, displays celebration. |
| **Flags are the Source of Truth** | Firestore flags track which devices have the photo. |
| **sessionStorage is for Display** | All devices read photos from sessionStorage for instant display. |
| **One Unified Flow** | Default photo AND new photo use the SAME flag-based mechanism. |
| **Score Update Detection** | VIEW triggers photo check on EVERY score update (H1-H17 play order). |

### 3.3 Critical Assumptions

| # | Assumption | Why It Matters | What If It Fails |
|---|------------|----------------|------------------|
| 1 | Default photo is ALWAYS in Firebase Storage at `celebration/SRC_Default_Photo.jpg` | All devices have a fallback | This is an operational requirement - must exist. |
| 2 | ONLY F1 checks GitHub ETag and uploads photos | Prevents redundant uploads and overwrites | Enforced in code. F2 never calls `checkAndRenameCelebrationPhoto()`. |
| 3 | Flags persist in Firestore until F1 resets them | Devices can recover missed events | Flags remain true until acknowledged by all devices. |
| 4 | VIEW realtime listener is ALWAYS active | VIEW detects score updates instantly | Reconnection logic handles disconnections. |

---

## 4. User-First Priority

### 4.1 The Golden Rule

The user should NEVER wait for backend tasks.

| Priority | Task | When? | Blocking? |
|----------|------|-------|-----------|
| 1 | Save hole → update local cache | Immediate | × NO |
| 2 | Calculate intra-flight, cross-flight, T-x, Strk | Immediate | × NO |
| 3 | Update UI (renderAll) | Immediate | × NO |
| 4 | **USER CONTINUES PLAYING** | **Immediate** | **× NO** |
| 5 | WRV write to Firestore | Background | × NO |
| 6 | Photo check (ETag → download → upload → set flags) | Background | × NO |

### 4.2 Why This Order

| If UI Updates First | If WRV/Photo First |
|---------------------|-------------------|
| User sees scores immediately | User waits for backend tasks |
| User continues playing | User experiences lag |
| Backend tasks happen in background | UI is blocked |

### 4.3 The Flow

```
1. ETag unchanged → skip
2. ETag changed → Download from GitHub (1-3s, background)
3. Upload to Firebase Storage (1-3s, background)
4. Store blob in sessionStorage (NO NETWORK)
5. Set flags T/F/F

Total background time: 2-6 seconds (user never waits)
```

---

## 5. Single Source of Truth: F1

### 5.1 Why F1?

| Reason | Explanation |
|--------|-------------|
| **First to act** | F1 is the first device to save holes and can detect photo changes earliest |
| **Prevents conflicts** | Only one device uploads → no overwrites, no duplicates |
| **Clear responsibility** | F1 = Photo, F2 = History. No confusion. |
| **Auditable** | One upload per photo change, one flag cycle per upload |

### 5.2 Device Responsibilities

| Device | Photo Responsibility | History Responsibility |
|--------|----------------------|----------------------|
| **F1** | ✓ Detects GitHub changes, downloads, uploads to FS, sets flags, resets flags | × NONE |
| **F2** | ✓ Downloads from FS, stores in SS, sets f2Downloaded = true | ✓ Writes history record |
| **VIEW** | ✓ Downloads from FS, stores in SS, sets viewDownloaded = true | × NONE |

---

## 6. Photo Flag System

### 6.1 Firestore Flags

| Field | Type | Description | Set By | Reset By |
|-------|------|-------------|--------|----------|
| `photo.newPhotoAvailable` | boolean | Set to true when F1 uploads new photo | F1 | F1 (when T/T/T) |
| `photo.f2Downloaded` | boolean | Set to true when F2 confirms download | F2 | F1 (when T/T/T) |
| `photo.viewDownloaded` | boolean | Set to true when VIEW confirms download | VIEW | F1 (when T/T/T) |
| `photo.imageUrl` | string | Firebase Storage URL for download | F1 | F1 (when T/T/T) |
| `photo.updatedAt` | timestamp | When photo was uploaded | F1 | F1 (when T/T/T) |

### 6.2 Flag States

| State | newPhotoAvailable | f2Downloaded | viewDownloaded | Meaning |
|-------|-------------------|--------------|----------------|---------|
| **IDLE** | false | false | false | No new photo. All devices have the same photo. |
| **NEW_PHOTO** | true | false | false | F1 uploaded new photo. Waiting for F2 and VIEW. |
| **F2_DONE** | true | true | false | F2 has downloaded. Waiting for VIEW. |
| **ALL_DONE** | true | true | true | All devices have downloaded. F1 will reset. |

### 6.3 Flag Lifecycle

```
                    ┌─────────────────────────────────────────────────┐
                    │                                                 │
                    ▼                                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                         IDLE (F/F/F)                               │
│                                                                     │
│  No new photo. All devices have the same photo in sessionStorage.  │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    │ F1 detects ETag change → downloads → uploads
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       NEW_PHOTO (T/F/F)                            │
│                                                                     │
│  F1 has uploaded new photo. Waiting for F2 and VIEW to download.   │
└─────────────────────────────────────────────────────────────────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│   F2 downloads   │  │  VIEW downloads  │
│   sets F2=T      │  │   sets VIEW=T    │
└──────────────────┘  └──────────────────┘
          │                   │
          └─────────┬─────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         ALL_DONE (T/T/T)                           │
│                                                                     │
│  All devices have downloaded. F1 resets flags to IDLE (F/F/F).     │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    │ F1 resets flags
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         IDLE (F/F/F)                               │
│                                                                     │
│  Cycle complete. Ready for next photo change.                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.4 One Unified Flow

Both default photo AND new photo use the SAME flag-based mechanism.

| Photo Type | Source | Flow |
|------------|--------|------|
| **Default Photo** | `celebration/SRC_Default_Photo.jpg` | F1 loads → sets flags T/F/F → F2/VIEW download → F1 resets |
| **New Photo** | `celebration/{gameId}_H.jpg` | F1 uploads → sets flags T/F/F → F2/VIEW download → F1 resets |

No special cases. No independent downloads. Everything goes through flags.

---

## 7. Detailed Flows

### 7.1 Game Start - Default Photo Distribution (F1 ONLY)

| Step | Action | Device | Timing |
|------|--------|--------|--------|
| 1 | Game loads | F1 | T0 |
| 2 | F1 loads default photo from Firebase Storage: `celebration/SRC_Default_Photo.jpg` | F1 | T0+100ms |
| 3 | F1 stores blob in sessionStorage (NO NETWORK) | F1 | T0+500ms |
| 4 | F1 sets flags: `newPhotoAvailable = true`, `f2Downloaded = false`, `viewDownloaded = false` | F1 | T0+500ms |
| 5 | F1 sets `photo.imageUrl` = Firebase Storage URL of default photo | F1 | T0+500ms |
| 6 | F2 listener fires → sees T/F/F → downloads default photo from FS → stores in SS → sets `f2Downloaded = true` | F2 | T0+1000ms |
| 7 | VIEW listener fires → sees T/x/F → downloads default photo from FS → stores in SS → sets `viewDownloaded = true` | VIEW | T0+1000ms |
| 8 | F1 sees T/T/T → resets all flags to F/F/F | F1 | T0+2000ms |

**RESULT:** All devices have the default photo in sessionStorage. Flags reset to IDLE.

### 7.2 During Game - New Photo Detection (F1 ONLY)

| Step | Action | Device | Timing |
|------|--------|--------|--------|
| 1 | F1 saves a hole | F1 | T0 |
| 2 | UI updates immediately (user continues playing) | F1 | T0+100ms |
| 3 | WRV writes hole data to Firestore (background) | F1 | T0+200ms |
| 4 | Photo check starts (background, non-blocking) | F1 | T0+500ms |
| 5 | HEAD request to GitHub for ETag | F1 | T0+700ms |
| 6 | If ETag unchanged → skip (no new photo) | F1 | T0+900ms |
| 7 | If ETag changed → download new photo from GitHub | F1 | T0+900ms |
| 8 | Compress image (canvas.toBlob) | F1 | T0+1500ms |
| 9 | Upload to Firebase Storage: `celebration/{gameId}_H.jpg` | F1 | T0+2500ms |
| 10 | Verify upload with getMetadata() | F1 | T0+3000ms |
| 11 | Store blob directly in sessionStorage (NO NETWORK) | F1 | T0+3000ms |
| 12 | Set flags: `newPhotoAvailable = true`, `f2Downloaded = false`, `viewDownloaded = false` | F1 | T0+3000ms |
| 13 | Set `photo.imageUrl` in Firestore | F1 | T0+3000ms |
| 14 | F2 listener fires → sees T/F/F → downloads from FS → stores in SS → sets `f2Downloaded = true` | F2 | T0+3500ms |
| 15 | VIEW listener fires → sees T/x/F → downloads from FS → stores in SS → sets `viewDownloaded = true` | VIEW | T0+3500ms |
| 16 | F1 sees T/T/T → resets all flags to F/F/F | F1 | T0+4500ms |

**TOTAL BACKGROUND TIME:** ~4.5 seconds (user never waits)

**RESULT:** New photo in Firebase Storage. All devices have the new photo in sessionStorage. Flags reset to IDLE.

### 7.3 F2 Photo Download Flow (Listener + Flag Check)

| Step | Action | How |
|------|--------|-----|
| 1 | F2's realtime listener fires (or F2 loads page) | Firestore `onSnapshot()` |
| 2 | F2 reads flag state | `photo.newPhotoAvailable` and `photo.f2Downloaded` |
| 3 | If `newPhotoAvailable = false` → ignore (no new photo) | - |
| 4 | If `newPhotoAvailable = true` AND `f2Downloaded = true` → ignore (already downloaded) | - |
| 5 | If `newPhotoAvailable = true` AND `f2Downloaded = false` → **DOWNLOAD** | `downloadPhotoToSessionStorage(imageUrl)` |
| 6 | Store photo in sessionStorage | `sessionStorage.setItem('celebrationPhoto', base64)` |
| 7 | Set `f2Downloaded = true` | Firestore update |
| 8 | Continue with game | - |

### 7.4 VIEW Photo Download Flow (Listener + Flag Check + Score Update)

| Step | Action | How |
|------|--------|-----|
| 1 | VIEW's realtime listener fires on **ANY score update** | Firestore `onSnapshot()` detects `f1Changed` or `f2Changed` |
| 2 | **CHECK**: Is this H18 play order completion? | `isHoleSavedInData(data.f1?.d, h18NaturalHole) && isHoleSavedInData(data.f2?.d, h18NaturalHole)` |
| 3 | If **YES** (H18 complete) → **SKIP** (game complete, no need) | Log: "H18 play order completed - skipping photo check (game complete)" |
| 4 | If **NO** (H1-H17 play order) → **CONTINUE** | Log: "Score update detected - checking photo" |
| 5 | VIEW reads flag state | `photo.newPhotoAvailable` and `photo.viewDownloaded` |
| 6 | If `newPhotoAvailable = false` → ignore (no new photo) | - |
| 7 | If `newPhotoAvailable = true` AND `viewDownloaded = true` → ignore (already downloaded) | - |
| 8 | If `newPhotoAvailable = true` AND `viewDownloaded = false` → **DOWNLOAD** | `downloadPhotoToSessionStorage(imageUrl)` |
| 9 | Store photo in sessionStorage | `sessionStorage.setItem('celebrationPhoto', base64)` |
| 10 | Set `viewDownloaded = true` | Firestore update |
| 11 | Continue with game | - |

**KEY CHANGE (v5.0):** VIEW triggers photo check on **EVERY score update** (H1-H17 play order). This ensures users can join at ANY stage and still get the photo.

### 7.5 F1 Flag Reset Flow

| Step | Action | How |
|------|--------|-----|
| 1 | F1's realtime listener fires | Firestore `onSnapshot()` |
| 2 | F1 reads flag state | `photo.newPhotoAvailable`, `photo.f2Downloaded`, `photo.viewDownloaded` |
| 3 | If `newPhotoAvailable = true` AND `f2Downloaded = true` AND `viewDownloaded = true` | All devices have confirmed |
| 4 | **RESET ALL FLAGS TO FALSE** | `resetPhotoFlags(gameId)` |
| 5 | Log: "Photo flags reset - all devices have the photo" | - |

---

## 8. Device Responsibilities

### 8.1 F1 Device

| # | Responsibility | When | Network? |
|---|----------------|------|----------|
| 1 | Load default photo from FS, store in SS, set flags T/F/F | Game start | ✓ Yes (once) |
| 2 | Check GitHub ETag for photo changes | After UI update + WRV write, in background | ✓ Yes (HEAD request) |
| 3 | Download new photo from GitHub | When ETag changed, in background | ✓ Yes |
| 4 | Compress and upload to Firebase Storage | After download, in background | ✓ Yes |
| 5 | Store blob directly in sessionStorage | After upload | × NO |
| 6 | Set `newPhotoAvailable = true` in Firestore | After upload | ✓ Yes |
| 7 | Set `photo.imageUrl` in Firestore | After upload | ✓ Yes |
| 8 | Monitor flags: `f2Downloaded` and `viewDownloaded` | Continuous (listener) | ✓ Yes |
| 9 | Reset all flags to false when T/T/T | When both flags true | ✓ Yes |

### 8.2 F2 Device

| # | Responsibility | When | Network? |
|---|----------------|------|----------|
| 1 | Monitor Firestore for `newPhotoAvailable = true` | Continuous (listener) | ✓ Yes |
| 2 | Download photo from Firebase Storage | When `newPhotoAvailable = true` AND `f2Downloaded = false` | ✓ Yes |
| 3 | Store photo in sessionStorage | After download | × NO |
| 4 | Set `f2Downloaded = true` | After download | ✓ Yes |
| 5 | Write history record | When both signatures signed | ✓ Yes |

### 8.3 VIEW Device

| # | Responsibility | When | Network? |
|---|----------------|------|----------|
| 1 | Monitor Firestore for **score updates** (f1Changed/f2Changed) | Continuous (listener) | ✓ Yes |
| 2 | **Check if H18 play order is complete → skip if YES** | On every score update | × NO |
| 3 | Check photo flags | On every score update (H1-H17) | ✓ Yes |
| 4 | Download photo from Firebase Storage | When `newPhotoAvailable = true` AND `viewDownloaded = false` | ✓ Yes |
| 5 | Store photo in sessionStorage | After download | × NO |
| 6 | Set `viewDownloaded = true` | After download | ✓ Yes |

---

## 9. Flag Logic - Device Decision Matrix

### 9.1 F2 Decision Matrix

| newPhotoAvailable | f2Downloaded | Action |
|-------------------|--------------|--------|
| false | false | IGNORE - No new photo |
| false | true | IGNORE - No new photo (should not happen) |
| true | false | **DOWNLOAD** - New photo, need to download |
| true | true | IGNORE - Already downloaded this photo |

**F2 Logic:**
```javascript
if (newPhotoAvailable == true && f2Downloaded == false) {
    downloadPhotoToSessionStorage(imageUrl);
    set f2Downloaded = true;
} else {
    // Ignore
}
```

### 9.2 VIEW Decision Matrix

| newPhotoAvailable | viewDownloaded | Action |
|-------------------|----------------|--------|
| false | false | IGNORE - No new photo |
| false | true | IGNORE - No new photo (should not happen) |
| true | false | **DOWNLOAD** - New photo, need to download |
| true | true | IGNORE - Already downloaded this photo |

**VIEW Logic:**
```javascript
if (newPhotoAvailable == true && viewDownloaded == false) {
    downloadPhotoToSessionStorage(imageUrl);
    set viewDownloaded = true;
} else {
    // Ignore
}
```

### 9.3 VIEW Score Update Trigger Matrix (v5.0 NEW)

| Score Update | Play Order Position | Natural Hole | Trigger Photo Check? |
|--------------|---------------------|--------------|---------------------|
| F1 or F2 saves score | H1-H17 | Any | ✅ **YES** - Check for new photo |
| F1 or F2 saves score | H18 | Last hole | ❌ **NO** - Game complete, skip |

**VIEW Score Update Logic (v5.0):**
```javascript
if (f1Changed || f2Changed) {
    // Get the H18 play order hole (last hole in play order)
    var playOrder = getPlayOrder();
    var h18NaturalHole = playOrder[playOrder.length - 1];
    
    // Check if H18 play order hole is now fully saved
    var h18SavedNow = isHoleSavedInData(data.f1?.d, h18NaturalHole) &&
                      isHoleSavedInData(data.f2?.d, h18NaturalHole);
    var h18WasSaved = currentCache.savedHoles?.[1]?.includes(h18NaturalHole) &&
                      currentCache.savedHoles?.[2]?.includes(h18NaturalHole);
    
    if (h18SavedNow && !h18WasSaved) {
        // SKIP - game complete
        console.log('H18 play order completed - skipping photo check');
    } else {
        // TRIGGER - every other score update
        console.log('Score update detected - checking photo');
        checkPhotoForView();
    }
}
```

### 9.4 F1 Reset Decision Matrix

| newPhotoAvailable | f2Downloaded | viewDownloaded | Action |
|-------------------|--------------|----------------|--------|
| true | true | true | **RESET ALL FLAGS TO FALSE** |
| true | true | false | WAIT - VIEW hasn't downloaded yet |
| true | false | true | WAIT - F2 hasn't downloaded yet |
| true | false | false | WAIT - No one has downloaded yet |
| false | - | - | IGNORE - No new photo |

**F1 Logic:**
```javascript
if (newPhotoAvailable == true && f2Downloaded == true && viewDownloaded == true) {
    // Reset all flags to false
    set newPhotoAvailable = false;
    set f2Downloaded = false;
    set viewDownloaded = false;
    console.log('[F1] Photo flags reset - all devices have the photo');
} else {
    // Wait
}
```

---

## 10. Hole Save Flow - Correct Order

### 10.1 The Golden Rule

**UI Update → User Continues → WRV → Photo Check**

| Order | Task | Priority | Blocking? |
|-------|------|----------|-----------|
| 1 | Save hole → update local cache | CRITICAL | × NO |
| 2 | Calculate intra-flight, cross-flight, T-x, Strk | CRITICAL | × NO |
| 3 | Update UI (renderAll) | CRITICAL | × NO |
| 4 | **USER CONTINUES PLAYING** | **CRITICAL** | **× NO** |
| 5 | WRV write to Firestore (hole data) | Background | × NO |
| 6 | Photo check (ETag → download → upload → set flags) | Background | × NO |

### 10.2 Implementation Pattern

```javascript
// In real-game-save.js

// Step 1-2: Save and update cache
// Step 3-4: Calculate and render UI
// Step 5: User continues playing

// Step 6: WRV write (background, non-blocking)
setTimeout(function() {
    writeConsolidatedPayload(payload, function(err) {
        if (err) {
            console.warn('[SAVE] WRV write failed:', err.message);
        } else {
            console.log('[SAVE] WRV write completed');
        }
    });
});

// Step 7: Photo check (background, non-blocking)
// ONLY F1 checks photos
if (editableFlight === 1) {
    setTimeout(function() {
        console.log('[SAVE] Photo check starting (background)...');
        if (typeof checkAndRenameCelebrationPhoto === 'function') {
            checkAndRenameCelebrationPhoto(gameId, holeNumber, function(err) {
                if (err) {
                    console.warn('[SAVE] Photo check failed:', err.message);
                } else {
                    console.log('[SAVE] Photo check completed');
                }
            });
        }
    }, 100); // After WRV
}
```

---

## 11. Data Separation

### 11.1 Photo vs. CelebrationData

| Data Type | Storage Key | Set By |
|-----------|-------------|--------|
| **Photo** | `sessionStorage.celebrationPhoto` | ALL devices (background) |
| **Photo Flags** | `Firestore.photo.*` | F1 sets, F2/VIEW update |
| **celebrationData (scores)** | `sessionStorage.celebrationData` | F1/F2 only (in `showGameCompleteModal()`) |
| **celebrationData (VIEW)** | Firestore / cache | VIEW reads directly |

### 11.2 VIEW Does NOT Need celebrationData in sessionStorage

| Question | Answer |
|----------|--------|
| Does VIEW need `celebrationData` in sessionStorage? | **NO**. VIEW reads scores from the cache or Firestore directly. |
| Why? | VIEW is a spectator device. It doesn't navigate to `post-game.html`. |
| What does VIEW display? | Celebration screen with photo (from sessionStorage) and scores (from cache/Firestore). |

### 11.3 F1/F2 Need celebrationData in sessionStorage

| Question | Answer |
|----------|--------|
| Do F1/F2 need `celebrationData` in sessionStorage? | **YES**. When they click "SEE RESULTS", they navigate to `post-game.html`. |
| Why? | `post-game.html` reads `celebrationData` from sessionStorage to display results. |
| When is it saved? | In `showGameCompleteModal()` - before the modal is shown to the user. |
| Where is this implemented? | `real-game-nav.js` v1.17 - `showGameCompleteModal()` function. |

---

## 12. Key Functions

### 12.1 celebration-photo.js - Function Summary (v5.0)

| Function | Purpose | Network? | Called By |
|----------|---------|----------|-----------|
| `loadDefaultCelebrationPhoto()` | Load default photo, store in SS, set flags | Yes | F1 ONLY at game start |
| `checkPhotoChanged()` | HEAD request to GitHub for ETag | Yes (cheap) | F1 ONLY on hole save |
| `checkAndRenameCelebrationPhoto()` | F1 ONLY - Download, upload, set flags | Yes | F1 ONLY on hole save |
| `uploadAndVerifyPhoto()` | Upload to FS with verification | Yes | F1 (via checkAndRename) |
| `storeBlobInSessionStorage()` | Store blob directly in sessionStorage | NO | F1 (after upload) |
| `downloadPhotoToSessionStorage()` | Download from URL to sessionStorage | Yes | F2, VIEW (when flags true) |
| `getPhotoFromSessionStorage()` | Read photo from sessionStorage | NO | ALL devices (celebration) |
| `setPhotoFlags()` | Set photo flags in Firestore | Yes | F1 (after upload) |
| `checkPhotoFlags()` | Read photo flags from Firestore | Yes | F2, VIEW (listener) |
| `resetPhotoFlags()` | Reset photo flags to false | Yes | F1 (when T/T/T) |
| `storeImageInSessionStorage()` | Load from URL and store as base64 | Yes | Default photo loader |

### 12.2 Core Function: `setPhotoFlags()`

```javascript
/**
 * Set photo flags in Firestore after F1 uploads a new photo
 * Called by F1 only
 *
 * @param {string} gameId - The game ID
 * @param {string} imageUrl - Firebase Storage download URL
 * @param {function} callback - Called with (err)
 */
function setPhotoFlags(gameId, imageUrl, callback) {
    var db = firebase.firestore();
    var payload = {
        'photo.newPhotoAvailable': true,
        'photo.f2Downloaded': false,
        'photo.viewDownloaded': false,
        'photo.imageUrl': imageUrl,
        'photo.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('scheduledGames').doc(gameId).update(payload)
        .then(function() {
            console.log('[CelebrationPhoto] Flags set: T/F/F');
            if (callback) callback(null);
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] Failed to set flags:', err.message);
            if (callback) callback(err);
        });
}
```

### 12.3 Core Function: `resetPhotoFlags()`

```javascript
/**
 * Reset photo flags to false
 * Called by F1 only when both f2Downloaded and viewDownloaded are true
 *
 * @param {string} gameId - The game ID
 * @param {Function} callback - Called with (err)
 */
function resetPhotoFlags(gameId, callback) {
    var db = firebase.firestore();
    var payload = {
        'photo.newPhotoAvailable': false,
        'photo.f2Downloaded': false,
        'photo.viewDownloaded': false,
        'photo.updatedAt': firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('scheduledGames').doc(gameId).update(payload)
        .then(function() {
            console.log('[CelebrationPhoto] Flags reset: F/F/F');
            if (callback) callback(null);
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] Failed to reset flags:', err.message);
            if (callback) callback(err);
        });
}
```

### 12.4 Core Function: `checkPhotoFlags()`

```javascript
/**
 * Check photo flags from Firestore
 * Called by F2 and VIEW to determine if a new photo is available
 *
 * @param {string} gameId - The game ID
 * @param {Function} callback - Called with (err, flags)
 */
function checkPhotoFlags(gameId, callback) {
    var db = firebase.firestore();
    db.collection('scheduledGames').doc(gameId).get()
        .then(function(doc) {
            if (!doc.exists) {
                callback(new Error('Game not found'), null);
                return;
            }
            var data = doc.data();
            var photo = data.photo || {};
            var flags = {
                newPhotoAvailable: photo.newPhotoAvailable === true,
                f2Downloaded: photo.f2Downloaded === true,
                viewDownloaded: photo.viewDownloaded === true,
                imageUrl: photo.imageUrl || null,
                updatedAt: photo.updatedAt || null
            };
            callback(null, flags);
        })
        .catch(function(err) {
            callback(err, null);
        });
}
```

### 12.5 Core Function: `isHoleSavedInData()` (v5.0 NEW)

```javascript
/**
 * Helper to check if a hole is saved in a data string
 * Used by VIEW to detect score updates and H18 completion
 *
 * @param {string} dataString - The flight data string (f1.d or f2.d)
 * @param {number} holeNumber - The natural hole number to check
 * @returns {boolean} - True if the hole is saved in the data string
 */
function isHoleSavedInData(dataString, holeNumber) {
    if (!dataString) return false;
    var holeData = GameData.parseHoleData(dataString, holeNumber);
    return holeData && holeData.saved === true;
}
```

---

## 13. State Management

### 13.1 Firestore State (Source of Truth for Photo Sync)

| Field | Type | Description | Set By |
|-------|------|-------------|--------|
| `photo.newPhotoAvailable` | boolean | New photo available for download | F1 |
| `photo.f2Downloaded` | boolean | F2 has downloaded the photo | F2 |
| `photo.viewDownloaded` | boolean | VIEW has downloaded the photo | VIEW |
| `photo.imageUrl` | string | Firebase Storage download URL | F1 |
| `photo.updatedAt` | timestamp | When photo was uploaded | F1 |

### 13.2 sessionStorage State (Source of Truth for Display)

| Key | Value | Set By | Used By | When Set |
|-----|-------|--------|---------|----------|
| `celebrationPhoto` | base64 image data | ALL devices | Celebration screen (ALL) | Via flags (default + new) |
| `celebrationData` | JSON (scores, winner, players) | F1/F2 only | `post-game.html` | When "SEE RESULTS" button shown |
| `isPostGame` | "true" | ALL devices | Navigation | When game completes |

### 13.3 localStorage State (Cache for Detection)

| Key | Value | Set By | Used By | Purpose |
|-----|-------|--------|---------|---------|
| `celebration_photo_etag` | GitHub ETag | F1 ONLY | F1 ONLY | Detect photo changes |
| `celebration_photo_size` | GitHub content-length | F1 ONLY | F1 ONLY | Detect photo changes |

---

## 14. Error Handling & Resilience

### 14.1 Failure Scenarios

| Scenario | Recovery |
|----------|----------|
| F1 misses ETag change | F1 checks ETag on EVERY hole save |
| F2 misses listener event | F2 checks flags on page load |
| VIEW misses listener event | VIEW checks flags on page load AND on EVERY score update |
| Firestore write fails | WRV retry with exponential backoff |
| Firebase Storage download fails | Retry logic in `downloadPhotoToSessionStorage()` |
| GitHub HEAD request fails | Assume changed (conservative) |

### 14.2 Retry Logic

| Parameter | Value |
|-----------|-------|
| `MAX_UPLOAD_RETRIES` | 3 |
| `RETRY_BASE_DELAY_MS` | 2000 |
| Retry 1 delay | 2s |
| Retry 2 delay | 3s |
| Retry 3 delay | 4.5s |

---

## 15. VIEW Photo Trigger Mechanism (v5.0 NEW)

### 15.1 The Problem (v4.0 and Earlier)

| Issue | Explanation |
|-------|-------------|
| **Navigation dependency** | Photo check only triggered when VIEW user manually navigated to H17 |
| **Read-only limitation** | VIEW users don't navigate - they watch scores auto-update |
| **Late joiners** | Users joining at H18 would never trigger the check |
| **Unreliable** | If user didn't click "next" at the right time, photo wouldn't download |

### 15.2 The Solution (v5.0)

| Feature | Explanation |
|---------|-------------|
| **Score update detection** | VIEW triggers photo check on EVERY F1 or F2 score update |
| **H1-H17 only** | Check runs for all score updates except H18 play order completion |
| **H18 skip** | When H18 play order is saved, game is complete - no need to check |
| **No navigation dependency** | VIEW user never needs to navigate for photo to download |
| **Late join support** | User joining at H18 still gets photo (from flag check on page load) |

### 15.3 Implementation in view-game.html

```javascript
// In setupRealtimeListener() - view-game.html v8.13
firestoreUnsubscribe = db.collection("scheduledGames").doc(gameId)
    .onSnapshot(function(doc) {
        if (!doc.exists) return;
        if (hasSwitchedToHistory) return;
        
        var data = doc.data();
        var currentCache = GameLoader.getLocalCache();
        var imageUrl = data.celebration?.imageUrl || null;
        
        // Check what changed
        var f1Changed = (currentCache.f1DataString !== data.f1?.d);
        var f2Changed = (currentCache.f2DataString !== data.f2?.d);
        
        // ============================================================
        // v8.13: PHOTO CHECK - Trigger on every score update EXCEPT H18 play order
        // ============================================================
        if (f1Changed || f2Changed) {
            // Get the H18 play order hole (last hole in play order)
            var playOrder = getPlayOrder();
            var h18NaturalHole = playOrder[playOrder.length - 1];
            
            // Check if H18 play order hole is now fully saved
            var h18SavedNow = isHoleSavedInData(data.f1?.d, h18NaturalHole) &&
                              isHoleSavedInData(data.f2?.d, h18NaturalHole);
            var h18WasSaved = currentCache.savedHoles?.[1]?.includes(h18NaturalHole) &&
                              currentCache.savedHoles?.[2]?.includes(h18NaturalHole);
            
            if (h18SavedNow && !h18WasSaved) {
                console.log('[VIEW-GAME] 📸 H18 play order completed - skipping photo check');
            } else {
                console.log('[VIEW-GAME] 📸 Score update detected - checking photo');
                checkPhotoForView();
            }
        } else if (imageUrl) {
            // Fallback: if imageUrl exists but no score change, still check
            console.log('[VIEW-GAME] Listener: Photo URL present - checking ETag');
            checkPhotoForView();
        }
        // ... rest of listener
    });
```

### 15.4 What Was Removed from v4.0

| Removed Feature | Location | Reason |
|-----------------|----------|--------|
| Photo check on every navigation | `nextHole()` / `prevHole()` | Redundant - score updates are the real trigger |
| H17 mandatory check | `nextHole()` / `prevHole()` | Replaced by score update detection |
| Navigation dependency | `nextHole()` / `prevHole()` | VIEW is read-only - users don't navigate |

### 15.5 Trigger Frequency Analysis

| Scenario | Score Updates | Photo Checks | Notes |
|----------|---------------|--------------|-------|
| **Full round (H1-H18 play order)** | 18 holes × 2 flights = 36 | 34 (skip H18) | ETag check is lightweight (HEAD request) |
| **Late join at H10** | 9 holes × 2 flights = 18 | 16 (skip H18) | User gets photo regardless |
| **Late join at H17** | 2 holes × 2 flights = 4 | 2 (skip H18) | Photo downloaded before game completes |
| **Default photo only** | 0 | 0 (but page load check) | Flags ensure default photo distribution |

---

## 16. File Modification Summary

**ALL FILES ARE NOW COMPLETE.**

| # | File | Change | Priority | Status |
|---|------|--------|----------|--------|
| 1 | `celebration-photo.js` | Add `setPhotoFlags()`, `resetPhotoFlags()`, `checkPhotoFlags()` | HIGH | ✅ COMPLETE |
| 2 | `celebration-photo.js` | Modify `loadDefaultCelebrationPhoto()` to call `setPhotoFlags()` with default URL | HIGH | ✅ COMPLETE |
| 3 | `celebration-photo.js` | Modify `checkAndRenameCelebrationPhoto()` to call `setPhotoFlags()` | HIGH | ✅ COMPLETE |
| 4 | `real-game-save.js` | ONLY F1 calls `checkAndRenameCelebrationPhoto()` | HIGH | ✅ COMPLETE |
| 5 | `real-game-save.js` | Move photo check to AFTER UI update + user continues (background) | HIGH | ✅ COMPLETE |
| 6 | `real-game-init.js` | F2 listener: check flags, download if needed, set `f2Downloaded = true` | HIGH | ✅ COMPLETE |
| 7 | **`view-game.html`** | **VIEW listener: check flags, download if needed, set `viewDownloaded = true`** | **HIGH** | **✅ COMPLETE** |
| 8 | **`view-game.html`** | **VIEW score update trigger - check photo on EVERY score update (H1-H17)** | **HIGH** | **✅ COMPLETE** |
| 9 | **`view-game.html`** | **Remove photo check from `nextHole()` and `prevHole()`** | **HIGH** | **✅ COMPLETE** |
| 10 | **`view-game.html`** | **Add `isHoleSavedInData()` helper function** | **HIGH** | **✅ COMPLETE** |
| 11 | `real-game-init.js` | F1 listener: check T/T/T → reset all flags | HIGH | ✅ COMPLETE |
| 12 | `real-game-nav.js` | Add `celebrationData` save in `showGameCompleteModal()` | HIGH | ✅ COMPLETE |
| 13 | `sign-card.js` | GitHub fallback removal | MEDIUM | ✅ COMPLETE |
| 14 | `celebration-photo.js` | `storeBlobInSessionStorage()` | HIGH | ✅ COMPLETE |
| 15 | `celebration-photo.js` | `downloadPhotoToSessionStorage()` | HIGH | ✅ COMPLETE |

---

## 17. Testing Plan

### 17.1 Test Cases

| # | Test | Expected Result | Device | Status |
|---|------|-----------------|--------|--------|
| 1 | New game starts on F1 | F1 loads default → sets flags T/F/F | F1 | ✅ |
| 2 | New game starts on F2 | F2 sees flags T/F → downloads default from FS | F2 | ✅ |
| 3 | New game starts on VIEW | VIEW sees flags T/x/F → downloads default from FS | VIEW | ✅ |
| 4 | F1 sees T/T/T → resets flags | Flags become F/F/F | F1 | ✅ |
| 5 | C.jpg changes → F1 saves hole | UI updates first, then photo check in background | F1 | ✅ |
| 6 | F1 ETag changed → downloads → uploads → sets flags T/F/F | Flags set correctly | F1 | ✅ |
| 7 | F2 listener sees flags T/F | F2 downloads from FS, sets f2Downloaded = true | F2 | ✅ |
| 8 | VIEW listener sees flags T/x/F | VIEW downloads from FS, sets viewDownloaded = true | VIEW | ✅ |
| 9 | F1 sees flags T/T/T | F1 resets all flags to F/F/F | F1 | ✅ |
| 10 | F2 loads page after flag set | F2 checks flags, sees T/F → downloads | F2 | ✅ |
| 11 | VIEW loads page after flag set | VIEW checks flags, sees T/F → downloads | VIEW | ✅ |
| 12 | F2 checks flags T/T | F2 ignores (already downloaded) | F2 | ✅ |
| 13 | VIEW checks flags T/T | VIEW ignores (already downloaded) | VIEW | ✅ |
| 14 | Game completes → F1 clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | F1 | ✅ |
| 15 | Game completes → F2 clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | F2 | ✅ |
| 16 | Game completes → VIEW clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | VIEW | ✅ |
| **17** | **VIEW scores update (H1-H17 play order)** | **Photo check triggered** | **VIEW** | **✅** |
| **18** | **VIEW scores update (H18 play order)** | **Photo check SKIPPED** | **VIEW** | **✅** |
| **19** | **VIEW user joins at H17** | **Photo check triggers on score update** | **VIEW** | **✅** |
| **20** | **VIEW user joins at H18** | **Photo check triggers on page load (flags)** | **VIEW** | **✅** |

### 17.2 Console Commands

```javascript
// Check sessionStorage photo
console.log('Photo in sessionStorage:', sessionStorage.getItem('celebrationPhoto') ? '✅' : '❌');

// Check photo size
var photo = sessionStorage.getItem('celebrationPhoto');
if (photo) console.log('Photo size:', (photo.length / 1024).toFixed(1), 'KB');

// Check Firestore flags (run on any device)
var gameId = sessionStorage.getItem('currentGameId');
firebase.firestore().collection('scheduledGames').doc(gameId).get()
    .then(function(doc) {
        var photo = doc.data().photo || {};
        console.log('Flags:', photo);
    });

// Force load default photo (F1 only)
loadDefaultCelebrationPhoto(function(err) {
    console.log('Default photo loaded:', err ? '❌' : '✅');
});

// Check ETag (F1 only)
console.log('ETag:', localStorage.getItem('celebration_photo_etag'));

// Check VIEW trigger status
console.log('VIEW trigger: Score update detection active');
```

---

## 18. Common Misunderstandings (FAQ)

| # | Question | Answer |
|---|----------|--------|
| 1 | "Does F2 still check GitHub ETag?" | **NO.** ONLY F1 checks GitHub ETag. F2 downloads from Firebase Storage. |
| 2 | "Does F2 still upload photos?" | **NO.** ONLY F1 uploads photos. F2 handles history records only. |
| 3 | "How does F2 get the default photo?" | Via flags. F1 loads default → sets flags → F2 downloads from FS. Same as new photo. |
| 4 | "How does VIEW get the default photo?" | Via flags. F1 loads default → sets flags → VIEW downloads from FS. Same as new photo. |
| 5 | "What if F1 never saves a hole after photo changes?" | The photo in sessionStorage remains the default photo. When game completes, if no new photo exists, the default photo is used. |
| 6 | "What if F2 misses the listener event?" | F2 checks flags on page load. If `newPhotoAvailable = true` and `f2Downloaded = false`, F2 downloads. |
| 7 | "What if VIEW misses the listener event?" | VIEW checks flags on page load AND on EVERY score update. If `newPhotoAvailable = true` and `viewDownloaded = false`, VIEW downloads. |
| 8 | "When does F1 reset the flags?" | F1 resets flags ONLY when `newPhotoAvailable = true`, `f2Downloaded = true`, AND `viewDownloaded = true`. |
| 9 | "Does photo check block the user?" | **NO.** Photo check happens AFTER UI update and AFTER user continues playing. It's background and non-blocking. |
| 10 | "Does VIEW need `celebrationData` in sessionStorage?" | **NO.** VIEW reads scores from cache/Firestore directly. |
| 11 | "Is the GitHub fallback needed in `sign-card.js`?" | **NO.** `sessionStorage` ALWAYS has a photo (default loaded via flags). |
| 12 | "Does F2 write the history record?" | **YES.** F2 is the designated history record writer. F1 does not write history. |
| 13 | **"When does VIEW trigger photo checks?" (v5.0 NEW)** | **On EVERY score update (H1-H17 play order).** User navigation is no longer required. |
| 14 | **"Why was H17 navigation trigger removed?" (v5.0 NEW)** | **VIEW is read-only.** Users don't navigate. Score updates are the real trigger. |
| 15 | **"What about H18 play order?" (v5.0 NEW)** | **SKIPPED.** When H18 play order is completed, game is complete. No need to check. |
| 16 | **"What if VIEW joins at H18?" (v5.0 NEW)** | **Page load flag check.** VIEW checks flags on initialization and downloads if needed. |
| 17 | **"Is checking on every score update too frequent?" (v5.0 NEW)** | **NO.** ETag check is a lightweight HEAD request (metadata only). Up to 34 checks per round is acceptable. |

---

## 19. Summary

### 19.1 Key Principles

| Principle | Description | Why It Matters |
|-----------|-------------|----------------|
| **User First** | UI updates → User continues → WRV → Photo | User never waits |
| **F1 is the Single Source** | ONLY F1 detects, downloads, uploads, and sets flags | Prevents conflicts, overwrites, and redundant work |
| **F2 is the History Writer** | F2 downloads photo from FS and writes history | Clear separation of responsibilities |
| **One Unified Flow** | Default AND new photos use SAME flag-based mechanism | No special cases, clean code |
| **Flags are the Synchronization** | Firestore flags track download status | No missed events, no race conditions |
| **sessionStorage is for Display** | All devices read photos from sessionStorage | Celebration screen is INSTANT (NO NETWORK) |
| **No GitHub fallback** | Proper management is better than fallbacks | Fallbacks mask bugs and create false security |
| **Score Update Detection (v5.0)** | VIEW triggers on EVERY score update (H1-H17) | Users can join at ANY stage |

### 19.2 Device Responsibility Summary (v5.0)

| Device | Photo Check | Photo Download | Photo Upload | Flag Set | Flag Reset | History |
|--------|-------------|----------------|--------------|----------|------------|---------|
| **F1** | ✓ (GitHub ETag) | ✓ (from GitHub) | ✓ (to FS) | ✓ (T/F/F) | ✓ (when T/T/T) | × |
| **F2** | × | ✓ (from FS) | × | ✓ (f2=T) | × | ✓ |
| **VIEW** | ✓ (Score Update) | ✓ (from FS) | × | ✓ (view=T) | × | × |

### 19.3 All Components Complete

| # | Component | Status |
|---|-----------|--------|
| 1 | `loadDefaultCelebrationPhoto()` | ✅ COMPLETE |
| 2 | `storeBlobInSessionStorage()` | ✅ COMPLETE |
| 3 | `downloadPhotoToSessionStorage()` | ✅ COMPLETE |
| 4 | `celebrationData` in `showGameCompleteModal()` | ✅ COMPLETE |
| 5 | GitHub fallback removal in `sign-card.js` | ✅ COMPLETE |
| 6 | `getCelebrationImage()` - sessionStorage only | ✅ COMPLETE |
| 7 | Flag management functions (`setPhotoFlags`, `resetPhotoFlags`, `checkPhotoFlags`) | ✅ COMPLETE |
| 8 | Flag integration in `loadDefaultCelebrationPhoto()` | ✅ COMPLETE |
| 9 | Flag integration in `checkAndRenameCelebrationPhoto()` | ✅ COMPLETE |
| 10 | F1-only photo check in `real-game-save.js` | ✅ COMPLETE |
| 11 | Photo check order in `real-game-save.js` | ✅ COMPLETE |
| 12 | F2 flag check + download in `real-game-init.js` | ✅ COMPLETE |
| 13 | F1 flag reset in `real-game-init.js` | ✅ COMPLETE |
| 14 | **VIEW score update trigger (v5.0)** | ✅ **COMPLETE** |
| 15 | **VIEW remove navigation trigger (v5.0)** | ✅ **COMPLETE** |
| 16 | **`isHoleSavedInData()` helper (v5.0)** | ✅ **COMPLETE** |

---

## 20. Appendix A: iOS Shortcut Setup

### What It Does

- **User Selection**: You select a photo from the iOS Photos app.
- **Processing**: The Shortcut resizes the image to 1920px wide (auto-height) and converts it to JPEG format.
- **Saving**: The file is saved as C.jpg in the a-shell folder.
- **Trigger**: The process initiates the upload script.

### Required Apps

- **a-shell** (iOS app): Required for running the script.

### Shortcut Configuration

- **Name**: Upload Celebration Photo
- **Actions**:
  - **Receive**: Images from the Share Sheet (if no input, it gets the image from the Clipboard).
  - **Resize Image**: Width: 1280, Height: Auto.
  - **Convert Image**: JPEG.
  - **Save File**: Destination is a-Shell, and the Path is Documents/SICC-Ryder-Cup/C.jpg.
- **Trigger**: Use the Share Sheet extension from the Photos app.

![Description of your image](SCR-20260709-mjza.jpg)

---

### Part 2: a-shell Script Setup

### Location

| Device | Path |
|--------|------|
| iPhone (On my iPhone) | `~/Documents/SICC-Ryder-Cup/sync_celebration.sh` |
| Mac | `/Users/piti/Documents/a-shell/sync_celebration.sh` |

### Script Content

```bash
#!/bin/sh
# Version: 1.2

# Navigate to your repository folder cleanly
echo "Starting Sync Process"
echo "Navigating to repository..."
cd ~/Documents/SICC-Ryder-Cup || {
    echo "ERROR: Could not find repository folder!"
    exit 1
}

# Configure local tracking identity cleanly without syntax issues
echo "Configuring git identity..."
printf "[user]\n\tname = Piti Pramotedham\n\temail = piti@pramotedham.com" > .git/config.local
lg2 config include.path config.local

# Fetch the absolute latest history from GitHub
echo "Fetching latest updates from GitHub..."
lg2 fetch origin

# Merge remote changes into your local main branch to resolve the non-fastforward error
echo "Merging remote changes securely..."
lg2 merge origin/main

# Move the capital C.jpg from your Documents folder into the repo images folder
echo "Checking for new image C.jpg..."
if [ -f ~/Documents/C.jpg ]; then
    echo "Found C.jpg. Moving to repository..."
    mv -f ~/Documents/C.jpg ./images/celebration/C.jpg
else
    echo "ERROR: C.jpg not found in Documents folder!"
    exit 1
fi

# Stage, commit, and push up
echo "Staging image for commit..."
lg2 add images/celebration/C.jpg

echo "Committing changes..."
lg2 commit -m "Update celebration photo"

echo "Pushing updates to GitHub..."
lg2 push

echo "Sync Complete!"
```

### Setup Instructions

#### 1. Install Required Tools in a-shell

1. Install gsutil (Google Cloud Storage CLI):
   ```
   pip install gsutil
   ```
2. Authenticate:
   ```
   gcloud auth login
   ```
   (This will open a browser window for you to log in.)

#### 2. Make Script Executable

Run the following commands in the terminal:
```bash
cd ~/Documents/SICC-Ryder-Cup
chmod +x sync_celebration.sh
```

#### 3. Test the Script

Execute the script by running:
```bash
./sync_celebration.sh
```

---

## END OF DOCUMENT v5.0 FINAL