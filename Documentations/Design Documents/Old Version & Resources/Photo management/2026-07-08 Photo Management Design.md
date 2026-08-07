## Photo Management System - Design Document

---

# Photo Management System
## SICC Ryder Cup App - Version 1.0

---

### Document Information

| Property | Value |
|----------|-------|
| **Document Type** | System Design |
| **Version** | 1.0 |
| **Date** | 2026-07-08 |
| **Status** | ✅ Approved |
| **Purpose** | Define the complete photo management flow for all devices |

---

## 1. Overview

### 1.1 System Goals

| Goal | Description |
|------|-------------|
| **Instant Display** | Photos must display immediately on celebration screen (NO network calls at display time) |
| **Unified Source** | All devices (F1, F2, VIEW) must show the SAME photo |
| **Background Updates** | All photo downloads/uploads happen in background (user never waits) |
| **Resilient** | Default photo always available if new photo fails |
| **Consistent State** | All devices start with the same default photo in sessionStorage |

### 1.2 Key Design Principle

**sessionStorage is the single source of truth for photo display.**

- All devices load default photo into sessionStorage at game start
- All devices update sessionStorage when a new photo is available
- Celebration screen reads from sessionStorage (INSTANT, NO NETWORK)

---

## 2. Photo Sources

### 2.1 Source Types

| Source | Location | Used By | Purpose |
|--------|----------|---------|---------|
| **Default Photo** | Firebase Storage: `celebration/SRC_Default_Photo.jpg` | ALL devices | Fallback when no photo is available |
| **GitHub Photo** | `https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg` | F1/F2 only | Source for detecting photo changes via ETag |
| **Game Photo** | Firebase Storage: `celebration/{gameId}_H.jpg` | ALL devices | The photo for this specific game |

---

## 3. System Architecture

### 3.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PHOTO MANAGEMENT SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    celebration-photo.js (Shared Library)                     │   │
│  │                                                                              │   │
│  │  Functions:                                                                  │   │
│  │  - loadDefaultCelebrationPhoto()      → Load default from FS to sessionStorage│  │
│  │  - checkPhotoChanged()               → HEAD request to GitHub for ETag      │   │
│  │  - checkAndRenameCelebrationPhoto()  → Main orchestrator                    │   │
│  │  - uploadAndVerifyPhoto()            → Upload to FS with verification       │   │
│  │  - storeBlobInSessionStorage()       → Store blob directly (NO NETWORK)     │   │
│  │  - getPhotoFromSessionStorage()      → Read from sessionStorage             │   │
│  │  - downloadPhotoToSessionStorage()   → Download from URL to sessionStorage  │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│         ┌────────────────────────────┼────────────────────────────┐               │
│         │                            │                            │               │
│         ▼                            ▼                            ▼               │
│  ┌───────────────┐          ┌───────────────┐          ┌───────────────┐        │
│  │   F1 Device   │          │   F2 Device   │          │  VIEW Device  │        │
│  │  (Player 1)   │          │  (Player 2)   │          │  (Spectator)  │        │
│  ├───────────────┤          ├───────────────┤          ├───────────────┤        │
│  │ real-game.html│          │ real-game.html│          │ view-game.html│        │
│  │               │          │               │          │               │        │
│  │ Photo Source: │          │ Photo Source: │          │ Photo Source: │        │
│  │ GitHub (ETag) │          │ GitHub (ETag) │          │ Firestore URL │        │
│  └───────────────┘          └───────────────┘          └───────────────┘        │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Flows

### 4.1 Game Start Flow (ALL Devices)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         GAME START - ALL DEVICES                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Game loads (real-game.html or view-game.html)                                     │
│         │                                                                          │
│         ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ loadDefaultCelebrationPhoto()                                                │   │
│  │                                                                              │   │
│  │  1. Check if sessionStorage already has a photo                             │   │
│  │     ├── YES → Log and return (already loaded)                              │   │
│  │     └── NO  → Continue                                                     │   │
│  │                                                                              │   │
│  │  2. Get default photo from Firebase Storage:                               │   │
│  │     storage.ref('celebration/SRC_Default_Photo.jpg').getDownloadURL()      │   │
│  │                                                                              │   │
│  │  3. Download image and convert to base64                                   │   │
│  │     storeImageInSessionStorage(url)                                        │   │
│  │                                                                              │   │
│  │  4. ✅ sessionStorage has default photo                                    │   │
│  │     Key: 'celebrationPhoto'                                                │   │
│  │     Value: base64 image data                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                          │
│         ▼                                                                          │
│  ✅ sessionStorage ALWAYS has a photo from game start                             │
│     All devices start with the SAME default photo                                 │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 F1/F2 Photo Update Flow (During Game)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    F1/F2 PHOTO UPDATE FLOW (On Every Hole Save)                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Hole saved by F1 or F2                                                             │
│         │                                                                          │
│         ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ checkAndRenameCelebrationPhoto(gameId, callback)                            │   │
│  │                                                                              │   │
│  │  STEP 1: Check if photo has changed on GitHub                               │   │
│  │  ─────────────────────────────────────────                                   │   │
│  │  fetch(GITHUB_PHOTO_URL, { method: 'HEAD' })                               │   │
│  │         │                                                                   │   │
│  │         ├── ETag unchanged → ✅ Skip (photo same)                           │   │
│  │         └── ETag changed   → ✅ New photo detected                          │   │
│  │                                                                              │   │
│  │  STEP 2: Download new photo (only if changed)                               │   │
│  │  ─────────────────────────────────────────                                   │   │
│  │  loadAndCompressImage(GITHUB_PHOTO_URL + cacheBuster)                       │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  ✅ blob in memory (new photo)                                              │   │
│  │                                                                              │   │
│  │  STEP 3: Upload to Firebase Storage                                         │   │
│  │  ─────────────────────────────────────────                                   │   │
│  │  uploadAndVerifyPhoto(archiveId, blob, 0)                                  │   │
│  │         │                                                                   │   │
│  │         ├── Upload to FS: celebration/{gameId}_H.jpg                       │   │
│  │         ├── Verify with getMetadata()                                      │   │
│  │         ├── Retry up to 3 times if fails                                   │   │
│  │         └── ✅ Upload VERIFIED                                              │   │
│  │                                                                              │   │
│  │  STEP 4: Update Firestore with URL (for VIEW devices)                      │   │
│  │  ─────────────────────────────────────────                                   │   │
│  │  WRV.update('historyGames', archiveId, {                                    │   │
│  │      'celebration.imageRef': 'celebration/{gameId}_H.jpg',                 │   │
│  │      'celebration.imageUrl': verifiedUrl,                                  │   │
│  │      'celebration.copiedAt': serverTimestamp()                             │   │
│  │  })                                                                         │   │
│  │                                                                              │   │
│  │  STEP 5: 🔴 UPDATE SESSIONSTORAGE WITH BLOB DIRECTLY (NO NETWORK)          │   │
│  │  ───────────────────────────────────────────────────────                     │   │
│  │  storeBlobInSessionStorage(blob)                                            │   │
│  │         │                                                                   │   │
│  │         ├── FileReader.readAsDataURL(blob) (NO NETWORK)                    │   │
│  │         ├── sessionStorage.setItem('celebrationPhoto', base64)             │   │
│  │         └── ✅ sessionStorage UPDATED with new photo                        │   │
│  │                                                                              │   │
│  │  RESULT:                                                                    │   │
│  │  ✅ New photo in Firebase Storage (for VIEW)                                │   │
│  │  ✅ sessionStorage updated with new photo (for F1/F2)                       │   │
│  │  ✅ ALL devices have access to the new photo                                │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ✅ COMPLETE - No user waiting, all background operations                          │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 VIEW Device Photo Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         VIEW DEVICE PHOTO FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  VIEW loads game                                                                    │
│         │                                                                          │
│         ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 1: Load default photo (same as F1/F2)                                   │   │
│  │ ─────────────────────────────────────────                                    │   │
│  │ loadDefaultCelebrationPhoto()                                                │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  ✅ sessionStorage has default photo                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                          │
│         ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 2: Setup realtime Firestore listener                                    │   │
│  │ ─────────────────────────────────────────                                    │   │
│  │ onSnapshot(scheduledGames/{gameId})                                          │   │
│  │                                                                              │   │
│  │  Every time data changes:                                                   │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  Check if celebration.imageUrl exists in the data                          │   │
│  │         │                                                                   │   │
│  │         ├── NO → Wait (photo not uploaded yet)                             │   │
│  │         └── YES → Download photo from Firebase Storage (BACKGROUND)        │   │
│  │                     │                                                       │   │
│  │                     ▼                                                       │   │
│  │              downloadPhotoToSessionStorage(imageUrl)                        │   │
│  │                     │                                                       │   │
│  │                     ├── fetch image from FS URL                             │   │
│  │                     ├── convert to base64                                  │   │
│  │                     ├── sessionStorage.setItem('celebrationPhoto', base64) │   │
│  │                     └── ✅ sessionStorage updated with new photo            │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                          │
│         ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 3: Game completes                                                       │   │
│  │ ─────────────────────────────────────────                                    │   │
│  │ Realtime listener detects: f1.signed = true AND f2.signed = true            │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  Show RESULT button                                                         │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  User clicks RESULT                                                         │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  SignCard.showCelebrationScreen()                                           │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  getPhotoFromSessionStorage() → base64 (INSTANT, NO NETWORK)               │   │
│  │         │                                                                   │   │
│  │         ▼                                                                   │   │
│  │  ✅ Photo displays immediately                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Celebration Screen Flow (ALL Devices)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    CELEBRATION SCREEN - ALL DEVICES                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  User clicks RESULT button (F1, F2, or VIEW)                                       │
│         │                                                                          │
│         ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ SignCard.showCelebrationScreen()                                              │   │
│  │                                                                              │   │
│  │  STEP 1: Get photo from sessionStorage                                      │   │
│  │  ─────────────────────────────────────────                                   │   │
│  │  var photoDataUrl = sessionStorage.getItem('celebrationPhoto');             │   │
│  │         │                                                                   │   │
│  │         ├── ✅ Exists → Use it (INSTANT, NO NETWORK)                       │   │
│  │         └── ❌ Empty → Fallback to default photo (should never happen)     │   │
│  │                                                                              │   │
│  │  STEP 2: Display celebration screen                                         │   │
│  │  ─────────────────────────────────────────                                   │   │
│  │  <img src="data:image/jpeg;base64,{photoDataUrl}" />                       │   │
│  │                                                                              │   │
│  │  RESULT:                                                                    │   │
│  │  ✅ Photo displays INSTANTLY                                                │   │
│  │  ✅ NO network calls                                                        │   │
│  │  ✅ NO user waiting                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Key Functions

### 5.1 `celebration-photo.js` - Function Summary

| Function | Purpose | Network? | Called By |
|----------|---------|----------|-----------|
| `loadDefaultCelebrationPhoto()` | Load default photo from FS to sessionStorage | ✅ Yes (once) | All devices at game start |
| `checkPhotoChanged()` | HEAD request to GitHub for ETag | ✅ Yes (cheap) | F1/F2 on every hole save |
| `checkAndRenameCelebrationPhoto()` | Main orchestrator for photo updates | ✅ Yes (if changed) | F1/F2 on every hole save |
| `uploadAndVerifyPhoto()` | Upload to FS with verification | ✅ Yes | F1/F2 (via checkAndRename) |
| `storeBlobInSessionStorage()` | Store blob directly in sessionStorage | ❌ NO | F1/F2 (after upload) |
| `downloadPhotoToSessionStorage()` | Download from URL to sessionStorage | ✅ Yes | VIEW (when imageUrl appears) |
| `getPhotoFromSessionStorage()` | Read photo from sessionStorage | ❌ NO | Celebration screen (ALL) |
| `storeImageInSessionStorage()` | Load from URL and store as base64 | ✅ Yes | Default photo loader |

---

### 5.2 Core Function: `storeBlobInSessionStorage(blob, callback)`

```javascript
/**
 * Store a blob directly in sessionStorage (NO NETWORK)
 * Converts blob to base64 using FileReader
 *
 * @param {Blob} blob - The image blob to store
 * @param {Function} callback - Called with (err)
 */
function storeBlobInSessionStorage(blob, callback) {
    var reader = new FileReader();
    reader.onload = function(event) {
        try {
            var base64 = event.target.result;
            sessionStorage.setItem(SESSION_STORAGE_KEY, base64);
            console.log('[CelebrationPhoto] ✅ Stored blob in sessionStorage');
            if (callback) callback(null);
        } catch(e) {
            console.warn('[CelebrationPhoto] ❌ Failed to store:', e.message);
            if (callback) callback(e);
        }
    };
    reader.onerror = function() {
        if (callback) callback(new Error('Failed to read blob'));
    };
    reader.readAsDataURL(blob);
}
```

---

## 6. State Management

### 6.1 sessionStorage Keys

| Key | Value | Set By | Used By |
|-----|-------|--------|---------|
| `celebrationPhoto` | base64 image data | ALL devices | Celebration screen (ALL) |
| `celebrationPhotoUrl` | Firebase Storage URL | VIEW (when downloaded) | VIEW (to detect changes) |

### 6.2 localStorage Keys

| Key | Value | Set By | Used By |
|-----|-------|--------|---------|
| `celebration_photo_etag` | GitHub ETag | F1/F2 | F1/F2 (to detect changes) |
| `celebration_photo_size` | GitHub content-length | F1/F2 | F1/F2 (to detect changes) |

---

## 7. Error Handling & Resilience

### 7.1 Failure Scenarios

| Scenario | Recovery |
|----------|----------|
| **C.jpg not found on GitHub** | Load default photo from FS |
| **GitHub ETag check fails** | Assume changed (download anyway) |
| **FS upload fails** | Retry 3 times with exponential backoff |
| **FS verification fails** | Retry upload 3 times |
| **sessionStorage quota exceeded** | Log error, continue with default |
| **VIEW download from FS fails** | Keep default photo |
| **Celebration screen has no photo** | Fallback to default photo |

### 7.2 Retry Logic

```javascript
var MAX_UPLOAD_RETRIES = 3;
var RETRY_BASE_DELAY_MS = 2000;

// Exponential backoff: 2s, 3s, 4.5s
function handleVerificationFailure(archiveId, blob, retryCount, callback) {
    var nextRetry = retryCount + 1;
    if (nextRetry < MAX_UPLOAD_RETRIES) {
        var delay = RETRY_BASE_DELAY_MS * Math.pow(1.5, retryCount);
        setTimeout(function() {
            uploadAndVerifyPhoto(archiveId, blob, nextRetry, callback);
        }, delay);
    } else {
        callback(new Error('All upload attempts failed'));
    }
}
```

---

## 8. File Modification Summary

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | `celebration-photo.js` | Add `storeBlobInSessionStorage()` | HIGH |
| 2 | `celebration-photo.js` | Modify `checkAndRenameCelebrationPhoto()` to use `storeBlobInSessionStorage()` | HIGH |
| 3 | `celebration-photo.js` | Ensure `loadDefaultCelebrationPhoto()` is available | HIGH |
| 4 | `real-game-init.js` | Call `loadDefaultCelebrationPhoto()` at game start | HIGH |
| 5 | `view-game.html` | Call `loadDefaultCelebrationPhoto()` at game start | HIGH |
| 6 | `view-game.html` | Add listener: when `celebration.imageUrl` appears → download to sessionStorage | HIGH |
| 7 | `sign-card.js` | Remove GitHub fallback from `getCelebrationImage()` | MEDIUM |
| 8 | `celebration-photo.js` | Add `downloadPhotoToSessionStorage()` for VIEW | MEDIUM |

---

## 9. Testing Plan

### 9.1 Test Cases

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | New game starts on F1 | sessionStorage has default photo |
| 2 | New game starts on VIEW | sessionStorage has default photo |
| 3 | C.jpg changes → F1 saves hole | sessionStorage updated with new photo (NO NETWORK) |
| 4 | VIEW listener detects `celebration.imageUrl` | VIEW downloads new photo from FS |
| 5 | Game completes → F1 clicks RESULT | Photo displays instantly (from sessionStorage) |
| 6 | Game completes → VIEW clicks RESULT | Photo displays instantly (from sessionStorage) |
| 7 | C.jpg not found | Default photo loaded and displayed |
| 8 | FS upload fails | Retry 3 times, default photo remains |

### 9.2 Console Commands

```javascript
// Check sessionStorage photo
console.log('Photo in sessionStorage:', sessionStorage.getItem('celebrationPhoto') ? '✅' : '❌');

// Check photo size
var photo = sessionStorage.getItem('celebrationPhoto');
if (photo) console.log('Photo size:', (photo.length / 1024).toFixed(1), 'KB');

// Force load default photo
loadDefaultCelebrationPhoto(function(err) {
    console.log('Default photo loaded:', err ? '❌' : '✅');
});

// Check ETag status
console.log('ETag:', localStorage.getItem('celebration_photo_etag'));
console.log('Size:', localStorage.getItem('celebration_photo_size'));
```

---

## 10. Summary

### 10.1 Key Principles

| Principle | Description |
|-----------|-------------|
| **sessionStorage is source of truth** | All devices read photos from sessionStorage |
| **Default photo always loaded** | All devices start with same default photo |
| **No network at display time** | Celebration screen is INSTANT |
| **Background updates** | All downloads/uploads happen in background |
| **Resilient** | Default photo ensures display always works |

### 10.2 Device Comparison

| Aspect | F1/F2 | VIEW |
|--------|-------|------|
| **Game Start** | Load default photo from FS | Load default photo from FS |
| **Photo Source** | GitHub (ETag detection) | Firestore (imageUrl) |
| **Update Trigger** | Every hole save | Every listener update |
| **Update Method** | Blob → sessionStorage (NO NETWORK) | URL → download → sessionStorage |
| **Celebration Screen** | sessionStorage (INSTANT) | sessionStorage (INSTANT) |

---

## END OF DOCUMENT