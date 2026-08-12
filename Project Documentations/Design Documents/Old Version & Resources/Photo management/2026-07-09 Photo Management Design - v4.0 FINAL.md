# Photo Management System - Design Document v4.0 FINAL

## Document Information

| Property | Value |
|----------|-------|
| **Document Type** | System Design |
| **Version** | 4.0 FINAL |
| **Date** | 2026-07-11 |
| **Status** | ✓ FINAL - Approved |
| **Purpose** | Define the complete photo management flow with flag-based synchronization |
| **Supersedes** | v3.0 (2026-07-09) |

---

## Table of Contents

1. Critical Design Changes from v3.0
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
15. File Modification Summary
16. Testing Plan
17. Common Misunderstandings (FAQ)
18. Summary
19. Appendix A: iOS Shortcut Setup
20. Appendix B: a-shell Script Setup

---

## 1. Critical Design Changes from v3.0

This document supersedes v3.0 FINAL (2026-07-09). The following critical changes have been made based on real-world testing and bug fixes.

| Change | v3.0 Design | v4.0 FINAL (2026-07-11) |
|--------|-------------|------------------------|
| **Flag Reset** | F1 resets flags when T/T/T | **VIEW** resets flags to F/F/F after download |
| **F1 Responsibility** | Sets flags AND resets | Sets flags T/F/F → **STOPS** (NEVER resets) |
| **F2 Responsibility** | Sets f2Downloaded=true | Same - sets f2Downloaded=true → STOPS |
| **VIEW Responsibility** | Sets viewDownloaded=true | Downloads → **RESETS ALL FLAGS** to F/F/F |
| **Flag Write Method** | `update()` with dot notation | `set({ merge: true })` with nested `photo` object |
| **Photo Logic Order** | After WRV check | **BEFORE** WRV check (prevents blocking) |
| **VIEW Sync Method** | 10-minute poll + listener | **Listener only** (instant detection) |

### Why This Change Was Necessary

**The Problem:**
- F1's realtime listener fired on its own flag writes
- F1 saw stale flags from previous tests
- F1 was resetting within ~300ms → F2/VIEW never saw the photo
- F2 was blocked during WRV writes (which happen on every score save)

**The Solution:**
1. **F1** sets flags T/F/F → **STOPS** (no reset)
2. **F2** downloads → sets T/T/F → **STOPS** (no reset)
3. **VIEW** downloads → **RESETS** to F/F/F (completes the cycle)
4. Photo logic moved **BEFORE** WRV check
5. VIEW uses **listener only** (no poll)

---

## 2. Implementation Status

READ THIS FIRST - Know what's already done.

| # | Component | Status | Location | Notes |
|---|-----------|--------|----------|-------|
| 1 | loadDefaultCelebrationPhoto() | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Loads default photo, sets flags |
| 2 | storeBlobInSessionStorage() | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Stores photo in sessionStorage |
| 3 | downloadPhotoToSessionStorage() | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Downloads from URL to sessionStorage |
| 4 | setPhotoFlags() | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Sets T/F/F using nested `photo` object |
| 5 | resetPhotoFlags() | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Resets to F/F/F using `set({ merge: true })` |
| 6 | checkPhotoFlags() | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Reads flag state from Firestore |
| 7 | loadDefaultCelebrationPhoto() flag integration | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Calls setPhotoFlags() |
| 8 | checkAndRenameCelebrationPhoto() flag integration | ✅ IMPLEMENTED | celebration-photo.js v1.15 | Calls setPhotoFlags() |
| 9 | real-game-save.js - ONLY F1 calls photo check | ✅ IMPLEMENTED | real-game-save.js v1.41 | F2 never checks GitHub |
| 10 | real-game-save.js - Photo check order | ✅ IMPLEMENTED | real-game-save.js v1.41 | After UI update, background |
| 11 | real-game-init.js - F1 reset logic REMOVED | ✅ IMPLEMENTED | real-game-init.js v1.15 | F1 NEVER resets |
| 12 | real-game-init.js - F2 flag check + download | ✅ IMPLEMENTED | real-game-init.js v1.15 | BEFORE WRV check |
| 13 | view-game.html - VIEW flag check + download + reset | ✅ IMPLEMENTED | view-game.html v8.08 | Listener-based, resets F/F/F |
| 14 | celebrationData in showGameCompleteModal() | ✅ DONE | real-game-nav.js v1.17 | Saves celebration data |
| 15 | GitHub fallback removal | ✅ DONE | sign-card.js v1.33 | No fallback needed |
| 16 | getCelebrationImage() - sessionStorage only | ✅ IMPLEMENTED | sign-card.js v1.33 | Reads from sessionStorage |

---

## 3. Overview

### 3.1 System Goals

| Goal | Description |
|------|-------------|
| **User-First Priority** | UI updates immediately. All backend tasks (WRV, photo) happen in background. User never waits. |
| **Single Source of Truth** | ONE photo uploaded by ONE device (F1). All devices download the SAME photo from Firebase Storage. |
| **Flag-Based Synchronization** | Firestore flags ensure every device acknowledges photo download. Default AND new photos use same flow. |
| **Instant Display** | Photos display immediately from sessionStorage (NO network calls at display time). |
| **Resilient** | Flags persist in Firestore. Missed events are recovered on page load. |
| **No Duplicate Work** | F1 handles photo. F2 handles history. No redundant uploads. |

### 3.2 Key Design Principles

| Principle | Description |
|-----------|-------------|
| **User First** | UI updates → User continues → WRV → Photo. Never block the user. |
| **F1 is the Photo Orchestrator** | F1 detects, downloads, uploads, and sets flags. F1 **NEVER** resets flags. |
| **F2 is the History Writer** | F2 downloads photo from FS, acknowledges, writes history record. |
| **VIEW is the Cleanup Device** | VIEW downloads photo from FS, displays celebration, **RESETS** flags. |
| **Flags are the Source of Truth** | Firestore flags track which devices have the photo. |
| **sessionStorage is for Display** | All devices read photos from sessionStorage for instant display. |
| **One Unified Flow** | Default photo AND new photo use the SAME flag-based mechanism. |

### 3.3 Critical Assumptions

| # | Assumption | Why It Matters | What If It Fails? |
|---|------------|----------------|-------------------|
| 1 | Default photo is ALWAYS in Firebase Storage at `celebration/SRC_Default_Photo.jpg` | All devices have a fallback | This is an operational requirement. Must exist. |
| 2 | ONLY F1 checks GitHub ETag and uploads photos | Prevents redundant uploads and overwrites | Enforced in code. F2 never calls checkAndRenameCelebrationPhoto() |
| 3 | Flags persist in Firestore until VIEW resets them | Devices can recover missed events | Flags remain true until acknowledged by all devices |

---

## 4. User-First Priority

### 4.1 The Golden Rule

The user should NEVER wait for backend tasks.

| Priority | Task | When | Blocking? |
|----------|------|------|-----------|
| 1 | Save hole → update local cache | Immediate | × NO |
| 2 | Calculate intra-flight, cross-flight, T-x, Strk | Immediate | × NO |
| 3 | Update UI (renderAll) | Immediate | × NO |
| 4 | **USER CONTINUES PLAYING** | Immediate | × NO |
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
Step 1: User saves hole
         ↓
Step 2: UI updates instantly
         ↓
Step 3: User continues playing
         ↓
Step 4: WRV writes to Firestore (background)
         ↓
Step 5: Photo check starts (background)
         ↓
         ETag unchanged → skip
         │
         ETag changed → Download from GitHub (1-3s, background)
                       → Upload to Firebase Storage (1-3s, background)
                       → Store blob in sessionStorage (NO NETWORK)
                       → Set flags T/F/F
         ↓
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
|--------|---------------------|----------------------|
| **F1** | ✓ Detects GitHub changes, downloads, uploads to FS, sets flags T/F/F | × NONE |
| **F2** | ✓ Downloads from FS, stores in SS, sets f2Downloaded = true | ✓ Writes history record |
| **VIEW** | ✓ Downloads from FS, stores in SS, **RESETS flags to F/F/F** | × NONE |

---

## 6. Photo Flag System

### 6.1 Firestore Flags

| Field | Type | Description | Set By | Reset By |
|-------|------|-------------|--------|----------|
| `photo.newPhotoAvailable` | boolean | New photo available for download | F1 | **VIEW** (when downloaded) |
| `photo.f2Downloaded` | boolean | F2 has downloaded the photo | F2 | **VIEW** (when downloaded) |
| `photo.viewDownloaded` | boolean | VIEW has downloaded the photo | VIEW | **VIEW** (when downloaded) |
| `photo.imageUrl` | string | Firebase Storage URL for download | F1 | **VIEW** (when reset) |
| `photo.updatedAt` | timestamp | When photo was uploaded | F1 | **VIEW** (when reset) |

### 6.2 Flag States

| State | newPhotoAvailable | f2Downloaded | viewDownloaded | Meaning |
|-------|-------------------|--------------|----------------|---------|
| **IDLE** | false | false | false | No new photo. All devices have the same photo. |
| **NEW_PHOTO** | true | false | false | F1 uploaded new photo. Waiting for F2. |
| **F2_DONE** | true | true | false | F2 has downloaded. Waiting for VIEW. |
| **COMPLETE** | false | false | false | VIEW reset. Ready for next photo. |

### 6.3 Flag Lifecycle (v4.0 FINAL)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLAG LIFECYCLE - v4.0                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  F1 Uploads Photo                                                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌──────────────────────────────────────┐                                  │
│  │         T / F / F                    │                                  │
│  │  newPhotoAvailable: true             │                                  │
│  │  f2Downloaded: false                 │  ← F1 STOPS. NO RESET.           │
│  │  viewDownloaded: false               │                                  │
│  └──────────────────────────────────────┘                                  │
│       │                                                                     │
│       │ F2 listener fires                                                  │
│       │ F2 checks: newPhotoAvailable = true AND f2Downloaded = false       │
│       │ F2 downloads photo from Firebase Storage                           │
│       ▼                                                                     │
│  ┌──────────────────────────────────────┐                                  │
│  │         T / T / F                    │                                  │
│  │  newPhotoAvailable: true             │                                  │
│  │  f2Downloaded: true                  │  ← F2 STOPS. NO RESET.           │
│  │  viewDownloaded: false               │                                  │
│  └──────────────────────────────────────┘                                  │
│       │                                                                     │
│       │ VIEW listener fires                                                │
│       │ VIEW checks: f2Downloaded = true AND viewDownloaded = false        │
│       │ VIEW downloads photo from Firebase Storage                         │
│       │ VIEW RESETS ALL FLAGS                                              │
│       ▼                                                                     │
│  ┌──────────────────────────────────────┐                                  │
│  │         F / F / F                    │                                  │
│  │  newPhotoAvailable: false            │                                  │
│  │  f2Downloaded: false                 │  ← VIEW RESETS. CYCLE COMPLETE.  │
│  │  viewDownloaded: false               │                                  │
│  └──────────────────────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 One Unified Flow

Both default photo AND new photo use the SAME flag-based mechanism.

| Photo Type | Source | Flow |
|------------|--------|------|
| **Default Photo** | `celebration/SRC_Default_Photo.jpg` | F1 loads → sets flags T/F/F → F2 downloads → VIEW downloads → VIEW resets F/F/F |
| **New Photo** | `celebration/{gameId}_H.jpg` | F1 uploads → sets flags T/F/F → F2 downloads → VIEW downloads → VIEW resets F/F/F |

No special cases. No independent downloads. Everything goes through flags.

---

## 7. Detailed Flows

### 7.1 Game Start - Default Photo Distribution

| Step | Action | Device | Timing |
|------|--------|--------|--------|
| 1 | Game loads | F1 | T0 |
| 2 | F1 loads default photo from Firebase Storage: `celebration/SRC_Default_Photo.jpg` | F1 | T0+100ms |
| 3 | F1 stores blob in sessionStorage (NO NETWORK) | F1 | T0+500ms |
| 4 | F1 sets flags: `newPhotoAvailable = true`, `f2Downloaded = false`, `viewDownloaded = false` | F1 | T0+500ms |
| 5 | F1 sets `photo.imageUrl` = Firebase Storage URL of default photo | F1 | T0+500ms |
| 6 | **F1 STOPS. NO RESET.** | F1 | T0+500ms |
| 7 | F2 listener fires → sees T/F/F → downloads default photo from FS → stores in SS → sets `f2Downloaded = true` | F2 | T0+1000ms |
| 8 | **F2 STOPS. NO RESET.** | F2 | T0+1000ms |
| 9 | VIEW listener fires → sees T/T/F → downloads default photo from FS → stores in SS | VIEW | T0+1500ms |
| 10 | VIEW **RESETS ALL FLAGS** to F/F/F | VIEW | T0+1500ms |

**RESULT:** All devices have the default photo in sessionStorage. Flags reset to IDLE.

### 7.2 During Game - New Photo Detection

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
| 14 | **F1 STOPS. NO RESET.** | F1 | T0+3000ms |
| 15 | F2 listener fires → sees T/F/F → downloads from FS → stores in SS → sets `f2Downloaded = true` | F2 | T0+3500ms |
| 16 | **F2 STOPS. NO RESET.** | F2 | T0+3500ms |
| 17 | VIEW listener fires → sees T/T/F → downloads from FS → stores in SS | VIEW | T0+4000ms |
| 18 | VIEW **RESETS ALL FLAGS** to F/F/F | VIEW | T0+4000ms |

**TOTAL BACKGROUND TIME:** ~4 seconds (user never waits)

**RESULT:** New photo in Firebase Storage. All devices have the new photo in sessionStorage. Flags reset to IDLE.

### 7.3 F2 Photo Download Flow (Listener + Flag Check)

| Step | Action | How |
|------|--------|-----|
| 1 | F2's realtime listener fires (or F2 loads page) | Firestore onSnapshot() |
| 2 | F2 reads flag state | `photo.newPhotoAvailable` and `photo.f2Downloaded` |
| 3 | If `newPhotoAvailable = false` → ignore (no new photo) | - |
| 4 | If `newPhotoAvailable = true` AND `f2Downloaded = true` → ignore (already downloaded) | - |
| 5 | If `newPhotoAvailable = true` AND `f2Downloaded = false` → **DOWNLOAD** | `downloadPhotoToSessionStorage(imageUrl)` |
| 6 | Store photo in sessionStorage | `sessionStorage.setItem('celebrationPhoto', base64)` |
| 7 | Set `f2Downloaded = true` | Firestore update |
| 8 | **F2 STOPS. NO RESET.** | - |

### 7.4 VIEW Photo Download + Reset Flow

| Step | Action | How |
|------|--------|-----|
| 1 | VIEW's realtime listener fires (or VIEW loads page) | Firestore onSnapshot() |
| 2 | VIEW reads flag state | `photo.f2Downloaded` and `photo.viewDownloaded` |
| 3 | If `f2Downloaded = false` → wait (F2 hasn't downloaded yet) | - |
| 4 | If `f2Downloaded = true` AND `viewDownloaded = true` → ignore (already downloaded) | - |
| 5 | If `f2Downloaded = true` AND `viewDownloaded = false` → **DOWNLOAD** | `downloadPhotoToSessionStorage(imageUrl)` |
| 6 | Store photo in sessionStorage | `sessionStorage.setItem('celebrationPhoto', base64)` |
| 7 | Set `viewDownloaded = true` | Firestore update |
| 8 | **VIEW RESETS ALL FLAGS** to F/F/F | Firestore update |
| 9 | Cycle complete. Ready for next photo. | - |

### 7.5 VIEW Flag Reset Logic (v4.0 NEW)

VIEW is the designated reset device. It resets flags ONLY after confirming:
1. `f2Downloaded = true` (F2 has the photo)
2. `viewDownloaded = false` (VIEW hasn't downloaded yet)

```javascript
// VIEW reset logic (v8.08)
if (f2Downloaded && !viewDownloaded && imageUrl) {
    console.log('[VIEW-GAME] Listener: F2 has downloaded. VIEW downloading and resetting...');
    
    // Download photo
    downloadPhotoToSessionStorage(imageUrl, function(err) {
        if (err) {
            console.warn('[VIEW-GAME] Download failed:', err.message);
            return;
        }
        
        // Reset ALL flags to F/F/F
        db.collection('scheduledGames').doc(gameId).update({
            photo: {
                newPhotoAvailable: false,
                f2Downloaded: false,
                viewDownloaded: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        });
        
        console.log('[VIEW-GAME] Listener: Flags reset to F/F/F');
    });
}
```

---

## 8. Device Responsibilities

### 8.1 F1 Device

| # | Responsibility | When | Network? |
|---|----------------|------|----------|
| 1 | Load default photo from FS, store in SS, set flags T/F/F | Game start | ✓ Yes (once) |
| 2 | Check GitHub ETag for photo changes | After UI update + WRV write, in background | ✓ Yes (HEAD request) |
| 3 | Download new photo from GitHub | When ETag changed, in background | ✓ Yes |
| 4 | Compress and upload to Firebase Storage | After download, in background | ✓ Yes |
| 5 | Store blob directly in sessionStorage | After upload | × No |
| 6 | Set `newPhotoAvailable = true` in Firestore | After upload | ✓ Yes |
| 7 | Set `photo.imageUrl` in Firestore | After upload | ✓ Yes |
| 8 | **F1 NEVER RESETS FLAGS** | N/A | N/A |

**CRITICAL RULE:** F1 sets flags and STOPS. F1 NEVER resets flags.

### 8.2 F2 Device

| # | Responsibility | When | Network? |
|---|----------------|------|----------|
| 1 | Monitor Firestore for `newPhotoAvailable = true` | Continuous (listener) | ✓ Yes |
| 2 | Download photo from Firebase Storage | When `newPhotoAvailable = true` AND `f2Downloaded = false` | ✓ Yes |
| 3 | Store photo in sessionStorage | After download | × No |
| 4 | Set `f2Downloaded = true` | After download | ✓ Yes |
| 5 | **F2 NEVER RESETS FLAGS** | N/A | N/A |
| 6 | Write history record | When both signatures signed | ✓ Yes |

**CRITICAL RULE:** F2 sets `f2Downloaded = true` and STOPS. F2 NEVER resets flags.

### 8.3 VIEW Device

| # | Responsibility | When | Network? |
|---|----------------|------|----------|
| 1 | Monitor Firestore for flags | Continuous (listener) | ✓ Yes |
| 2 | Wait for `f2Downloaded = true` | Listener | ✓ Yes |
| 3 | Download photo from Firebase Storage | When `f2Downloaded = true` AND `viewDownloaded = false` | ✓ Yes |
| 4 | Store photo in sessionStorage | After download | × No |
| 5 | Set `viewDownloaded = true` | After download | ✓ Yes |
| 6 | **RESET ALL FLAGS to F/F/F** | After download and viewDownloaded set | ✓ Yes |

**CRITICAL RULE:** VIEW is the ONLY device that resets flags. VIEW resets to F/F/F.

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
    // STOPS. NO RESET.
} else {
    // Ignore
}
```

### 9.2 VIEW Decision Matrix

| f2Downloaded | viewDownloaded | Action |
|--------------|----------------|--------|
| false | false | WAIT - F2 hasn't downloaded yet |
| false | true | WAIT - F2 hasn't downloaded yet (should not happen) |
| true | false | **DOWNLOAD + RESET** - F2 done, VIEW downloads and resets |
| true | true | IGNORE - Already downloaded this photo |

**VIEW Logic:**
```javascript
if (f2Downloaded == true && viewDownloaded == false) {
    downloadPhotoToSessionStorage(imageUrl);
    set viewDownloaded = true;
    // RESET ALL FLAGS to F/F/F
    set newPhotoAvailable = false;
    set f2Downloaded = false;
    set viewDownloaded = false;
    console.log('[VIEW] Photo downloaded. Flags reset to F/F/F');
} else {
    // Ignore or wait
}
```

### 9.3 VIEW Reset Decision Matrix (v4.0 NEW)

VIEW resets flags ONLY when:

| Condition | Action |
|-----------|--------|
| `f2Downloaded = true` AND `viewDownloaded = false` | **RESET** - All flags to F/F/F |
| `f2Downloaded = false` OR `viewDownloaded = true` | **NO RESET** - Wait or ignore |

**VIEW Reset Logic:**
```javascript
// VIEW is the ONLY device that resets flags
if (f2Downloaded == true && viewDownloaded == false) {
    // Download photo
    // Set viewDownloaded = true
    // RESET ALL FLAGS to F/F/F
    db.collection('scheduledGames').doc(gameId).update({
        photo: {
            newPhotoAvailable: false,
            f2Downloaded: false,
            viewDownloaded: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    });
}
```

---

## 10. Hole Save Flow - Correct Order

### 10.1 The Golden Rule

```
UI Update → User Continues → WRV → Photo Check
```

| Order | Task | Priority | Blocking? |
|-------|------|----------|-----------|
| 1 | Save hole → update local cache | CRITICAL | × NO |
| 2 | Calculate intra-flight, cross-flight, T-x, Strk | CRITICAL | × NO |
| 3 | Update UI (renderAll) | CRITICAL | × NO |
| 4 | **USER CONTINUES PLAYING** | CRITICAL | × NO |
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
}, 50);

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

| Data Type | Storage Key | Set By | Notes |
|-----------|-------------|--------|-------|
| **Photo** | `sessionStorage.celebrationPhoto` | ALL devices (background) | Stored via flags |
| **Photo Flags** | Firestore.photo.* | F1 sets, F2/VIEW update | Source of truth for sync |
| **celebrationData (scores)** | `sessionStorage.celebrationData` | F1/F2 only (in showGameCompleteModal()) | For post-game.html |
| **celebrationData (VIEW)** | Firestore / cache | VIEW reads directly | VIEW doesn't navigate to post-game.html |

### 11.2 VIEW Does NOT Need celebrationData in sessionStorage

| Question | Answer |
|----------|--------|
| Does VIEW need celebrationData in sessionStorage? | **NO.** VIEW reads scores from the cache or Firestore directly. |
| Why? | VIEW is a spectator device. It doesn't navigate to post-game.html. |
| What does VIEW display? | Celebration screen with photo (from sessionStorage) and scores (from cache/Firestore). |

### 11.3 F1/F2 Need celebrationData in sessionStorage

| Question | Answer |
|----------|--------|
| Do F1/F2 need celebrationData in sessionStorage? | **YES.** When they click "SEE RESULTS", they navigate to post-game.html. |
| Why? | post-game.html reads celebrationData from sessionStorage to display results. |
| When is it saved? | In `showGameCompleteModal()` - before the modal is shown to the user. |
| Where is this implemented? | `real-game-nav.js v1.17` - `showGameCompleteModal()` function. |

---

## 12. Key Functions

### 12.1 celebration-photo.js - Function Summary (v4.0)

| Function | Purpose | Network? | Called By |
|----------|---------|----------|-----------|
| `loadDefaultCelebrationPhoto()` | Load default photo, store in SS, set flags | Yes | F1 ONLY at game start |
| `checkPhotoChanged()` | HEAD request to GitHub for ETag | Yes (cheap) | F1 ONLY on hole save |
| `checkAndRenameCelebrationPhoto()` | F1 ONLY - Download, upload, set flags | Yes | F1 ONLY on hole save |
| `uploadAndVerifyPhoto()` | Upload to FS with verification | Yes | F1 (via checkAndRename) |
| `storeBlobInSessionStorage()` | Store blob directly in sessionStorage | No | F1 (after upload) |
| `downloadPhotoToSessionStorage()` | Download from URL to sessionStorage | Yes | F2, VIEW (when flags true) |
| `getPhotoFromSessionStorage()` | Read photo from sessionStorage | No | ALL devices (celebration) |
| `setPhotoFlags()` | Set photo flags T/F/F in Firestore | Yes | F1 (after upload) |
| `resetPhotoFlags()` | Reset flags to F/F/F in Firestore | Yes | **VIEW ONLY** (after download) |

### 12.2 Core Function: setPhotoFlags()

```javascript
/**
 * Set photo flags in Firestore
 * Called by F1 ONLY after uploading a photo
 *
 * @param {string} gameId - The game ID
 * @param {string} imageUrl - Firebase Storage URL
 * @param {Function} callback - Called with (err)
 */
function setPhotoFlags(gameId, imageUrl, callback) {
    var db = firebase.firestore();
    var payload = {
        photo: {
            newPhotoAvailable: true,
            f2Downloaded: false,
            viewDownloaded: false,
            imageUrl: imageUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    };
    
    db.collection('scheduledGames').doc(gameId).set(payload, { merge: true })
        .then(function() {
            console.log('[CelebrationPhoto] ✅ Flags set: T/F/F');
            if (callback) callback(null);
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] Failed to set flags:', err.message);
            if (callback) callback(err);
        });
}
```

### 12.3 Core Function: resetPhotoFlags()

```javascript
/**
 * Reset photo flags to F/F/F
 * Called by VIEW ONLY after downloading the photo
 *
 * @param {string} gameId - The game ID
 * @param {Function} callback - Called with (err)
 */
function resetPhotoFlags(gameId, callback) {
    var db = firebase.firestore();
    var payload = {
        photo: {
            newPhotoAvailable: false,
            f2Downloaded: false,
            viewDownloaded: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    };
    
    db.collection('scheduledGames').doc(gameId).set(payload, { merge: true })
        .then(function() {
            console.log('[CelebrationPhoto] ✅ Flags reset: F/F/F');
            if (callback) callback(null);
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] Failed to reset flags:', err.message);
            if (callback) callback(err);
        });
}
```

### 12.4 Core Function: checkPhotoFlags()

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
                newPhotoAvailable: photo.newPhotoAvailable || false,
                f2Downloaded: photo.f2Downloaded || false,
                viewDownloaded: photo.viewDownloaded || false,
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

### 12.5 VIEW Reset Logic (v4.0 NEW)

```javascript
// VIEW reset logic in view-game.html v8.08
// This runs in the realtime listener

if (f2Downloaded && !viewDownloaded && imageUrl) {
    console.log('[VIEW-GAME] Listener: F2 has downloaded. VIEW downloading and resetting...');
    
    downloadPhotoToSessionStorage(imageUrl, function(err) {
        if (err) {
            console.warn('[VIEW-GAME] Download failed:', err.message);
            return;
        }
        
        // Reset ALL flags to F/F/F
        db.collection('scheduledGames').doc(gameId).update({
            photo: {
                newPhotoAvailable: false,
                f2Downloaded: false,
                viewDownloaded: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        })
        .then(function() {
            console.log('[VIEW-GAME] Listener: Flags reset to F/F/F');
        })
        .catch(function(err) {
            console.warn('[VIEW-GAME] Reset failed:', err.message);
        });
    });
}
```

---

## 13. State Management

### 13.1 Firestore State (Source of Truth for Photo Sync)

| Field | Type | Description | Set By | Reset By |
|-------|------|-------------|--------|----------|
| `photo.newPhotoAvailable` | boolean | New photo available for download | F1 | VIEW |
| `photo.f2Downloaded` | boolean | F2 has downloaded the photo | F2 | VIEW |
| `photo.viewDownloaded` | boolean | VIEW has downloaded the photo | VIEW | VIEW |
| `photo.imageUrl` | string | Firebase Storage download URL | F1 | VIEW |
| `photo.updatedAt` | timestamp | When photo was uploaded | F1 | VIEW |

### 13.2 sessionStorage State (Source of Truth for Display)

| Key | Value | Set By | Used By | When Set |
|-----|-------|--------|---------|----------|
| `celebrationPhoto` | base64 image data | ALL devices | Celebration screen (ALL) | Via flags (default + new) |
| `celebrationData` | JSON (scores, winner, players) | F1/F2 only | post-game.html | When "SEE RESULTS" button shown |
| `isPostGame` | "true" | ALL devices | Navigation | When game completes |

### 13.3 localStorage State (Cache for Detection)

| Key | Value | Set By | Used By | Purpose |
|-----|-------|--------|---------|---------|
| `celebration_photo_etag` | GitHub ETag | F1 ONLY | F1 ONLY | Detect photo changes |
| `celebration_photo_size` | GitHub content-length | F1 ONLY | F1 ONLY | Detect photo changes |

---

## 14. Error Handling & Resilience

### 14.1 Failure Scenarios

| Scenario | Impact | Recovery |
|----------|--------|----------|
| **F1 upload fails** | No new photo | Retry with exponential backoff (3 retries) |
| **F2 misses listener** | Flags stay T/F/F | F2 checks flags on page load → downloads |
| **VIEW misses listener** | Flags stay T/T/F | VIEW checks flags on page load → downloads + resets |
| **Firestore write fails** | Flags not set | Retry with exponential backoff |
| **VIEW offline** | Flags stay T/T/F | Stays until VIEW comes online, then resets |
| **F2 offline** | Flags stay T/F/F | Stays until F2 comes online, then sets T/T/F |
| **GitHub ETag check fails** | No photo detection | Silent fail, retry on next hole save |
| **Photo download fails** | No photo in SS | Retry with exponential backoff (3 retries) |

### 14.2 Retry Logic

| Parameter | Value |
|-----------|-------|
| `MAX_UPLOAD_RETRIES` | 3 |
| `RETRY_BASE_DELAY_MS` | 2000 |
| Retry 1 delay | 2s |
| Retry 2 delay | 3s |
| Retry 3 delay | 4.5s |

---

## 15. File Modification Summary

| # | File | Change | Priority | Status |
|---|------|--------|----------|--------|
| 1 | celebration-photo.js | Add setPhotoFlags(), resetPhotoFlags(), checkPhotoFlags() | HIGH | ✅ DONE |
| 2 | celebration-photo.js | Modify loadDefaultCelebrationPhoto() to call setPhotoFlags() | HIGH | ✅ DONE |
| 3 | celebration-photo.js | Modify checkAndRenameCelebrationPhoto() to call setPhotoFlags() | HIGH | ✅ DONE |
| 4 | real-game-save.js | ONLY F1 calls checkAndRenameCelebrationPhoto() | HIGH | ✅ DONE |
| 5 | real-game-save.js | Move photo check to AFTER UI update (background) | HIGH | ✅ DONE |
| 6 | real-game-init.js | F1 reset logic REMOVED | HIGH | ✅ DONE |
| 7 | real-game-init.js | F2 listener: check flags BEFORE WRV, download if needed, set f2Downloaded = true | HIGH | ✅ DONE |
| 8 | view-game.html | VIEW listener: check flags, download if needed, set viewDownloaded = true, RESET ALL FLAGS | HIGH | ✅ DONE |
| 9 | real-game-nav.js | Add celebrationData save in showGameCompleteModal() | HIGH | ✅ DONE |
| 10 | sign-card.js | GitHub fallback removed | MEDIUM | ✅ DONE |
| 11 | celebration-photo.js | storeBlobInSessionStorage() | HIGH | ✅ DONE |
| 12 | celebration-photo.js | downloadPhotoToSessionStorage() | HIGH | ✅ DONE |

---

## 16. Testing Plan

### 16.1 Test Cases

| # | Test | Expected Result | Device |
|---|------|-----------------|--------|
| 1 | New game starts on F1 | F1 loads default → sets flags T/F/F | F1 |
| 2 | New game starts on F2 | F2 sees flags T/F → downloads default from FS | F2 |
| 3 | New game starts on VIEW | VIEW sees flags T/T/F → downloads default from FS → resets F/F/F | VIEW |
| 4 | VIEW sees T/T/F → resets | Flags become F/F/F | VIEW |
| 5 | C.jpg changes → F1 saves hole | UI updates first, then photo check in background | F1 |
| 6 | F1 ETag changed → downloads → uploads → sets flags T/F/F | Flags set correctly | F1 |
| 7 | F2 listener sees flags T/F | F2 downloads from FS, sets f2Downloaded = true | F2 |
| 8 | VIEW listener sees flags T/T/F | VIEW downloads from FS, sets viewDownloaded = true, RESETS all flags | VIEW |
| 9 | VIEW resets to F/F/F | All flags false | VIEW |
| 10 | F2 loads page after flag set | F2 checks flags, sees T/F → downloads | F2 |
| 11 | VIEW loads page after flag set | VIEW checks flags, sees T/T/F → downloads + resets | VIEW |
| 12 | F2 checks flags T/T | F2 ignores (already downloaded) | F2 |
| 13 | VIEW checks flags T/T | VIEW ignores (already downloaded) | VIEW |
| 14 | Game completes → F1 clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | F1 |
| 15 | Game completes → F2 clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | F2 |
| 16 | Game completes → VIEW clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | VIEW |

### 16.2 Console Commands

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

// Check all flags in one command (copy and run)
var gameId = sessionStorage.getItem('currentGameId');
if (gameId) {
    firebase.firestore().collection('scheduledGames').doc(gameId).get()
        .then(function(doc) {
            if (doc.exists) {
                var photo = doc.data().photo || {};
                console.log('[FLAGS] newPhotoAvailable:', photo.newPhotoAvailable);
                console.log('[FLAGS] f2Downloaded:', photo.f2Downloaded);
                console.log('[FLAGS] viewDownloaded:', photo.viewDownloaded);
                console.log('[FLAGS] imageUrl:', photo.imageUrl ? photo.imageUrl.substring(0, 60) + '...' : 'null');
                console.log('[FLAGS] updatedAt:', photo.updatedAt);
            } else {
                console.log('[FLAGS] Game not found');
            }
        })
        .catch(function(err) {
            console.error('[FLAGS] Error:', err.message);
        });
} else {
    console.log('[FLAGS] No currentGameId in sessionStorage');
}
```

---

## 17. Common Misunderstandings (FAQ)

| # | Question | Answer |
|---|----------|--------|
| 1 | "Does F2 still check GitHub ETag?" | **NO.** ONLY F1 checks GitHub ETag. F2 downloads from Firebase Storage. |
| 2 | "Does F2 still upload photos?" | **NO.** ONLY F1 uploads photos. F2 handles history records only. |
| 3 | "How does F2 get the default photo?" | Via flags. F1 loads default → sets flags → F2 downloads from FS. Same as new photo. |
| 4 | "How does VIEW get the default photo?" | Via flags. F1 loads default → sets flags → F2 downloads → VIEW downloads + resets. Same as new photo. |
| 5 | "What if F1 never saves a hole after photo changes?" | The photo in sessionStorage remains the default photo. When game completes, if no new photo exists, the default photo is used. |
| 6 | "What if F2 misses the listener event?" | F2 checks flags on page load. If `newPhotoAvailable = true` and `f2Downloaded = false`, F2 downloads. |
| 7 | "What if VIEW misses the listener event?" | VIEW checks flags on page load. If `f2Downloaded = true` and `viewDownloaded = false`, VIEW downloads + resets. |
| 8 | "Why did VIEW become the reset device?" | F1's realtime listener was resetting flags within ~300ms, before F2 and VIEW could detect them. VIEW now resets after confirming F2 has downloaded. |
| 9 | "Does photo check block the user?" | **NO.** Photo check happens AFTER UI update and AFTER user continues playing. It's background and non-blocking. |
| 10 | "Does VIEW need celebrationData in sessionStorage?" | **NO.** VIEW reads scores from cache/Firestore directly. |
| 11 | "Is the GitHub fallback needed in sign-card.js?" | **NO.** sessionStorage ALWAYS has a photo (default loaded via flags). |
| 12 | "Does F2 write the history record?" | **YES.** F2 is the designated history record writer. F1 does not write history. |
| 13 | "What if VIEW is never online?" | Flags stay T/T/F. F1 and F2 still have the photo. VIEW will reset when it eventually connects. |
| 14 | "What if multiple photos arrive before VIEW resets?" | Each new photo overwrites the flags. Only the latest photo matters. |
| 15 | "Why use `set({ merge: true })` instead of `update()`?" | `set({ merge: true })` overwrites ALL specified fields in the payload. `update()` only changes specified fields, leaving stale flags untouched. |

---

## 18. Summary

### 18.1 Key Principles (v4.0 FINAL)

| Principle | Description | Why It Matters |
|-----------|-------------|----------------|
| **User First** | UI updates → User continues → WRV → Photo | User never waits |
| **F1 is the Single Source** | ONLY F1 detects, downloads, uploads, and sets flags | Prevents conflicts, overwrites, and redundant work |
| **F1 NEVER resets** | F1 sets flags T/F/F and STOPS | Prevents race conditions |
| **F2 is the History Writer** | F2 downloads photo from FS, sets f2Downloaded=true, and STOPS | Clear separation of responsibilities |
| **VIEW is the Cleanup Device** | VIEW downloads photo, sets viewDownloaded=true, **RESETS ALL FLAGS** | Completes the cycle |
| **One Unified Flow** | Default AND new photos use SAME flag-based mechanism | No special cases, clean code |
| **Flags are the Synchronization** | Firestore flags track download status | No missed events, no race conditions |
| **sessionStorage is for Display** | All devices read photos from sessionStorage | Celebration screen is INSTANT (NO NETWORK) |
| **No GitHub fallback** | Proper management is better than fallbacks | Fallbacks mask bugs and create false security |

### 18.2 Device Responsibility Summary (v4.0 FINAL)

| Device | Photo Check | Photo Download | Photo Upload | Flag Set | Flag Reset | History |
|--------|-------------|----------------|--------------|----------|------------|---------|
| **F1** | ✅ (GitHub ETag) | ✅ (from GitHub) | ✅ (to FS) | ✅ (T/F/F) | ❌ (NEVER) | ❌ |
| **F2** | ❌ | ✅ (from FS) | ❌ | ✅ (f2=T) | ❌ (NEVER) | ✅ |
| **VIEW** | ❌ | ✅ (from FS) | ❌ | ✅ (view=T) | ✅ (F/F/F) | ❌ |

### 18.3 What's Already Working (v4.0 FINAL)

| # | Feature | Status | Location |
|---|---------|--------|----------|
| 1 | Default photo loading with flags | ✅ | celebration-photo.js v1.15 |
| 2 | GitHub ETag detection (F1 only) | ✅ | celebration-photo.js v1.15 |
| 3 | Photo upload to Firebase Storage | ✅ | celebration-photo.js v1.15 |
| 4 | setPhotoFlags() T/F/F | ✅ | celebration-photo.js v1.15 |
| 5 | resetPhotoFlags() F/F/F (called by VIEW) | ✅ | celebration-photo.js v1.15 |
| 6 | F1 STOPS (no reset) | ✅ | real-game-init.js v1.15 |
| 7 | F2 downloads and sets f2Downloaded=true | ✅ | real-game-init.js v1.15 |
| 8 | F2 STOPS (no reset) | ✅ | real-game-init.js v1.15 |
| 9 | VIEW downloads and resets F/F/F | ✅ | view-game.html v8.08 |
| 10 | Photo logic BEFORE WRV check | ✅ | real-game-init.js v1.15 |
| 11 | View uses listener only (no 10-min poll) | ✅ | view-game.html v8.08 |
| 12 | Nested `photo` object (not flat fields) | ✅ | celebration-photo.js v1.15 |

### 18.4 What Still Needs to Be Done (v4.0 FINAL)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | All items complete | - | ✅ **ALL DONE** |

---

## 19. Appendix A: iOS Shortcut Setup

### What It Does

- **User Selection:** You select a photo from the iOS Photos app.
- **Processing:** The Shortcut resizes the image to 1920px wide (auto-height) and converts it to JPEG format.
- **Saving:** The file is saved as C.jpg in the a-shell folder.
- **Trigger:** The process initiates the upload script.

### Required Apps

- **a-shell** (iOS app): Required for running the script.

### Shortcut Configuration

- **Name:** Upload Celebration Photo
- **Actions:**
  - **Receive:** Images from the Share Sheet (if no input, it gets the image from the Clipboard).
  - **Resize Image:** Width: 1280, Height: Auto.
  - **Convert Image:** JPEG.
  - **Save File:** Destination is a-Shell, and the Path is `Documents/SICC-Ryder-Cup/C.jpg`.
- **Trigger:** Use the Share Sheet extension from the Photos app.

---

## 20. Appendix B: a-shell Script Setup

### Location

| Device | Path |
|--------|------|
| iPhone | `~/Documents/SICC-Ryder-Cup/sync_celebration.sh` |
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

**1. Install Required Tools in a-shell**
- Install gsutil (Google Cloud Storage CLI): `pip install gsutil`
- Authenticate: Run `gcloud auth login` (this will open a browser window for you to log in)

**2. Make Script Executable**
```bash
cd ~/Documents/SICC-Ryder-Cup
chmod +x sync_celebration.sh
```

**3. Test the Script**
```bash
./upload_celebration.sh
```

---

## END OF DOCUMENT v4.0 FINAL

---

### Document Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | Development Team | 2026-07-11 | - |
| Reviewer | | | |
| Approver | | | |