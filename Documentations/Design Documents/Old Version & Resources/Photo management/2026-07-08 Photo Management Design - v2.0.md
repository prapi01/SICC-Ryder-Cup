You're right. Let me provide a properly formatted markdown document with real tables, not ASCII art.

---

# Photo Management System - Design Document v2.0

## SICC Ryder Cup App

---

### Document Information

| Property | Value |
|----------|-------|
| **Document Type** | System Design |
| **Version** | 2.0 |
| **Date** | 2026-07-08 |
| **Status** | ✅ Approved |
| **Purpose** | Define the complete photo management flow for all devices |

---

## Table of Contents

1. [Implementation Status](#1-implementation-status)
2. [Overview](#2-overview)
3. [Photo Sources](#3-photo-sources)
4. [System Architecture](#4-system-architecture)
5. [Detailed Flows with Timing](#5-detailed-flows-with-timing)
6. [Data Separation](#6-data-separation)
7. [Key Functions](#7-key-functions)
8. [State Management](#8-state-management)
9. [Error Handling & Resilience](#9-error-handling--resilience)
10. [File Modification Summary](#10-file-modification-summary)
11. [Testing Plan](#11-testing-plan)
12. [Common Misunderstandings (FAQ)](#12-common-misunderstandings-faq)
13. [Summary](#13-summary)

---

## 1. Implementation Status

**READ THIS FIRST** - Know what's already done vs what needs to be added.

| # | Component | Status | Location | Notes |
|---|-----------|--------|----------|-------|
| 1 | `loadDefaultCelebrationPhoto()` | ✅ IMPLEMENTED | `celebration-photo.js` | Called in `real-game-init.js` and `view-game.html` init() |
| 2 | VIEW photo listener | ✅ IMPLEMENTED | `view-game.html` v8.01 `setupRealtimeListener()` | Listens for `celebration.imageUrl` |
| 3 | F1/F2 photo update on hole save | ✅ IMPLEMENTED | `celebration-photo.js` `checkAndRenameCelebrationPhoto()` | Called from save flow |
| 4 | `storeBlobInSessionStorage()` | ⬜ TO BE IMPLEMENTED | `celebration-photo.js` | Needed for F1/F2 to store blob directly (NO NETWORK) |
| 5 | `downloadPhotoToSessionStorage()` | ⬜ TO BE IMPLEMENTED | `celebration-photo.js` | Needed for VIEW to download from URL |
| 6 | `celebrationData` in `showGameCompleteModal()` | ⬜ TO BE IMPLEMENTED | `real-game-nav.js` | Needed for F1/F2 "SEE RESULTS" button |
| 7 | GitHub fallback removal | ✅ ALREADY DONE | `sign-card.js` v1.33 | No fallback - proper management only |
| 8 | `getCelebrationImage()` - sessionStorage only | ✅ IMPLEMENTED | `sign-card.js` | Reads ONLY from sessionStorage |

---

## 2. Overview

### 2.1 System Goals

| Goal | Description |
|------|-------------|
| **Instant Display** | Photos must display immediately on celebration screen (NO network calls at display time) |
| **Unified Source** | All devices (F1, F2, VIEW) must show the SAME photo |
| **Background Updates** | All photo downloads/uploads happen in background (user never waits) |
| **Resilient** | Default photo always available if new photo fails |
| **Consistent State** | All devices start with the same default photo in sessionStorage |

### 2.2 Key Design Principle

**sessionStorage is the single source of truth for photo display.**

| Principle | Description |
|-----------|-------------|
| Default photo at start | All devices load default photo into sessionStorage at game start |
| Background updates | All devices update sessionStorage when a new photo is available |
| Instant display | Celebration screen reads from sessionStorage (NO NETWORK) |

### 2.3 Critical Assumptions

**READ THESE - They are the foundation of the system.**

| # | Assumption | Why It Matters | What If It Fails? |
|---|------------|----------------|-------------------|
| 1 | `loadDefaultCelebrationPhoto()` is called at game start on ALL devices | sessionStorage is NEVER empty | This is enforced in code. If it fails, show trophy icon. |
| 2 | Default photo is ALWAYS in Firebase Storage at `celebration/SRC_Default_Photo.jpg` | All devices have a fallback | This is an operational requirement. File must exist. |
| 3 | VIEW downloads photo when `imageUrl` appears in Firestore | Photo is in sessionStorage BEFORE game completes | This is enforced by the realtime listener. |
| 4 | `celebrationData` (scores) is separate from photo data | VIEW reads scores from cache/Firestore, not sessionStorage | VIEW doesn't need `celebrationData` in sessionStorage. |
| 5 | No GitHub fallback in `sign-card.js` | Fallbacks create false security; proper management is better | See Section 3.3 for full rationale. |

### 2.4 Device Comparison

| Aspect | F1/F2 | VIEW |
|--------|-------|------|
| **Game Start** | Load default photo from FS | Load default photo from FS |
| **Photo Source** | GitHub (ETag detection) | Firestore (imageUrl) |
| **Update Trigger** | Every hole save | Every listener update |
| **Update Method** | Blob → sessionStorage (NO NETWORK) | URL → download → sessionStorage |
| **Celebration Screen** | sessionStorage (INSTANT) | sessionStorage (INSTANT) |
| **celebrationData (scores)** | Saved in sessionStorage for post-game.html | Reads from cache/Firestore directly |

---

## 3. Photo Sources

### 3.1 Source Types

| Source | Location | Used By | Purpose |
|--------|----------|---------|---------|
| **Default Photo** | Firebase Storage: `celebration/SRC_Default_Photo.jpg` | ALL devices | Ensures sessionStorage is NEVER empty |
| **GitHub Photo** | `https://sicc-ryder-cup.pages.dev/images/celebration/C.jpg` | F1/F2 only | Source for detecting photo changes via ETag |
| **Game Photo** | Firebase Storage: `celebration/{gameId}_H.jpg` | ALL devices | The photo for this specific game |

### 3.2 Photo Flow Summary

| Phase | Device | Action | Result |
|-------|--------|--------|--------|
| **Game Start** | ALL | `loadDefaultCelebrationPhoto()` | sessionStorage has default photo |
| **During Game** | F1/F2 | `checkAndRenameCelebrationPhoto()` on every hole save | If ETag changed: download → upload to FS → store in SS |
| **During Game** | VIEW | Realtime listener sees `celebration.imageUrl` | `downloadPhotoToSessionStorage()` → store in SS |
| **Celebration** | ALL | `getPhotoFromSessionStorage()` | INSTANT display (NO NETWORK) |

### 3.3 Why No GitHub Fallback in sign-card.js

| Argument | Response |
|----------|----------|
| "What if sessionStorage is empty?" | **It can't be.** `loadDefaultCelebrationPhoto()` runs at game start on ALL devices. This is enforced in code. |
| "What if `loadDefaultCelebrationPhoto()` fails?" | The default photo is ALWAYS in Firebase Storage. If the app can't load it, the app has bigger problems (network, Firebase auth, etc.). |
| "Fallbacks are safe" | **Fallbacks create false security.** They mask bugs. When a fallback works, you don't know the primary path is broken. A properly managed system is better. |
| "GitHub is a backup" | **GitHub is the SOURCE for F1/F2**, not a backup. F1/F2 use it to detect changes. VIEW uses Firestore URL. Both paths converge on sessionStorage. |

**Decision:** NO GitHub fallback in `sign-card.js`. The photo management system ensures sessionStorage always has a photo.

---

## 4. System Architecture

### 4.1 Component Diagram

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **Shared Library** | `celebration-photo.js` | All photo management functions |
| | `loadDefaultCelebrationPhoto()` | Load default from FS to sessionStorage |
| | `checkPhotoChanged()` | HEAD request to GitHub for ETag |
| | `checkAndRenameCelebrationPhoto()` | Main orchestrator for F1/F2 |
| | `uploadAndVerifyPhoto()` | Upload to FS with verification |
| | `storeBlobInSessionStorage()` | Store blob directly (NO NETWORK) ⬜ |
| | `getPhotoFromSessionStorage()` | Read from sessionStorage |
| | `downloadPhotoToSessionStorage()` | Download from URL to SS ⬜ |
| | `storeImageInSessionStorage()` | Load from URL and store as base64 |
| **F1 Device** | `real-game.html` | Photo Source: GitHub (ETag) |
| | | Update Method: blob → sessionStorage |
| **F2 Device** | `real-game.html` | Photo Source: GitHub (ETag) |
| | | Update Method: blob → sessionStorage |
| **VIEW Device** | `view-game.html` | Photo Source: Firestore URL |
| | | Update Method: URL → sessionStorage |

---

## 5. Detailed Flows with Timing

### 5.1 Game Start Flow (ALL Devices)

| Step | Action | Timing | Result |
|------|--------|--------|--------|
| 1 | Game loads (real-game.html or view-game.html) | T0 | - |
| 2 | `loadDefaultCelebrationPhoto()` called | T0+100ms | Checks if sessionStorage has photo |
| 3 | If no photo: get from Firebase Storage | T0+200ms | `storage.ref('celebration/SRC_Default_Photo.jpg').getDownloadURL()` |
| 4 | Download image and convert to base64 | T0+500ms | `storeImageInSessionStorage(url)` |
| 5 | Store in sessionStorage | T0+500ms | Key: 'celebrationPhoto', Value: base64 |

**✅ RESULT:** sessionStorage ALWAYS has a photo from game start. All devices start with the SAME default photo.

### 5.2 F1/F2 Photo Update Flow (During Game)

| Step | Action | Timing | Network? |
|------|--------|--------|----------|
| 1 | Hole saved by F1 or F2 | T0 | - |
| 2 | `checkAndRenameCelebrationPhoto()` called | T0+100ms | - |
| 3 | HEAD request to GitHub for ETag | T0+200ms | ✅ Yes (~200ms) |
| 4 | If ETag unchanged: skip | T0+400ms | - |
| 5 | If ETag changed: download new photo | T0+400ms | ✅ Yes (~500-1000ms) |
| 6 | Upload to Firebase Storage | T0+1500ms | ✅ Yes (~1000-2000ms) |
| 7 | Update Firestore with imageUrl | T0+2500ms | ✅ Yes (~500ms) |
| 8 | `storeBlobInSessionStorage(blob)` | T0+3000ms | ❌ NO (~50ms, FileReader) |
| 9 | sessionStorage updated with new photo | T0+3050ms | - |

**⏱️ TOTAL TIME:** ~2-4 seconds (all in background, user continues playing)

**✅ RESULT:** New photo in Firebase Storage (for VIEW) + sessionStorage updated (for F1/F2)

### 5.3 VIEW Device Photo Flow WITH TIMING

| Time | Event | Action |
|------|-------|--------|
| **T0** | VIEW loads game | `loadDefaultCelebrationPhoto()` → sessionStorage has default photo |
| **T0+500ms** | Default photo loaded | - |
| **T0+1s** | Realtime listener active | `onSnapshot(scheduledGames/{gameId})` |
| **T1** | F1/F2 uploads new photo | Firestore updated with `celebration.imageUrl` |
| **T1+100ms** | VIEW listener fires | Detects `celebration.imageUrl` exists |
| **T1+500ms** | `downloadPhotoToSessionStorage()` | fetch image from Firebase Storage URL |
| **T1+2s** | Photo stored in sessionStorage | `sessionStorage.setItem('celebrationPhoto', base64)` |
| **T2** (much later) | Game completes | Both signatures detected → Show "SEE RESULTS" button |
| **T3** | User clicks "SEE RESULTS" | `getPhotoFromSessionStorage()` → INSTANT (NO NETWORK) |

**🔑 KEY INSIGHT:** T1+2s (photo downloaded) happens LONG BEFORE T2 (game completes). By the time user clicks "SEE RESULTS" (T3), photo is ALREADY in sessionStorage.

### 5.4 Celebration Screen Flow (ALL Devices)

| Step | Action | Timing | Network? |
|------|--------|--------|----------|
| 1 | User clicks "SEE RESULTS" | T0 | - |
| 2 | `SignCard.showCelebrationScreen()` | T0+0ms | - |
| 3 | `sessionStorage.getItem('celebrationPhoto')` | T0+0ms | ❌ NO |
| 4 | Photo ALWAYS exists (default loaded at start) | - | - |
| 5 | Display image from base64 | T0+0ms | ❌ NO |

**✅ RESULT:** Photo displays INSTANTLY. NO network calls. NO user waiting.

---

## 6. Data Separation

### 6.1 Photo vs. CelebrationData

**These are separate data types with different sources and purposes.**

| Data Type | Storage Key | Set By | Used By | Network? |
|-----------|-------------|--------|---------|----------|
| **Photo** | `sessionStorage.celebrationPhoto` | ALL devices (background) | Celebration screen | NO (at display time) |
| **celebrationData (scores)** | `sessionStorage.celebrationData` | F1/F2 only (in `showGameCompleteModal()`) | `post-game.html` | NO |
| **celebrationData (VIEW)** | Firestore / cache | VIEW reads directly | VIEW celebration screen | YES (but data is tiny) |

### 6.2 VIEW Does NOT Need celebrationData in sessionStorage

| Question | Answer |
|----------|--------|
| Does VIEW need `celebrationData` in sessionStorage? | **NO.** VIEW reads scores from the cache or Firestore directly. |
| Why? | VIEW is a spectator device. It doesn't need to navigate to `post-game.html`. It displays celebration on the current page. |
| What does VIEW display? | Celebration screen with photo (from sessionStorage) and scores (from cache/Firestore). |
| When does VIEW read scores? | When `SignCard.showCelebrationScreen()` is called, it builds the score data from the cache. |

### 6.3 F1/F2 Need celebrationData in sessionStorage

| Question | Answer |
|----------|--------|
| Do F1/F2 need `celebrationData` in sessionStorage? | **YES.** When they click "SEE RESULTS", they navigate to `post-game.html`. |
| Why? | `post-game.html` reads `celebrationData` from sessionStorage to display results. |
| When is it saved? | In `showGameCompleteModal()` - before the modal is shown to the user. |
| Where is this implemented? | `real-game-nav.js` - `showGameCompleteModal()` function. |

---

## 7. Key Functions

### 7.1 celebration-photo.js - Function Summary

| Function | Purpose | Network? | Called By | Status |
|----------|---------|----------|-----------|--------|
| `loadDefaultCelebrationPhoto()` | Load default photo from FS to sessionStorage | ✅ Yes (once) | All devices at game start | ✅ IMPLEMENTED |
| `checkPhotoChanged()` | HEAD request to GitHub for ETag | ✅ Yes (cheap) | F1/F2 on every hole save | ✅ IMPLEMENTED |
| `checkAndRenameCelebrationPhoto()` | Main orchestrator for photo updates | ✅ Yes (if changed) | F1/F2 on every hole save | ✅ IMPLEMENTED |
| `uploadAndVerifyPhoto()` | Upload to FS with verification | ✅ Yes | F1/F2 (via checkAndRename) | ✅ IMPLEMENTED |
| `storeBlobInSessionStorage()` | Store blob directly in sessionStorage | ❌ NO | F1/F2 (after upload) | ⬜ TO BE IMPLEMENTED |
| `downloadPhotoToSessionStorage()` | Download from URL to sessionStorage | ✅ Yes | VIEW (when imageUrl appears) | ⬜ TO BE IMPLEMENTED |
| `getPhotoFromSessionStorage()` | Read photo from sessionStorage | ❌ NO | Celebration screen (ALL) | ✅ IMPLEMENTED |
| `storeImageInSessionStorage()` | Load from URL and store as base64 | ✅ Yes | Default photo loader | ✅ IMPLEMENTED |

### 7.2 Core Function: storeBlobInSessionStorage()

**Purpose:** Store a blob directly in sessionStorage with NO network calls.

**Why This Matters:**
- F1/F2 upload photo to Firebase Storage (for VIEW)
- Then store the SAME blob in sessionStorage (for F1/F2)
- NO NETWORK CALL - blob is already in memory from the download
- This is why celebration screen is INSTANT on F1/F2

**⏱️ Timing:** ~50ms (FileReader, NO NETWORK)

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

### 7.3 Core Function: downloadPhotoToSessionStorage()

**Purpose:** Download photo from URL and store in sessionStorage.

**Why This Matters:**
- VIEW has no other way to get the photo (no GitHub ETag detection)
- VIEW listens for imageUrl in Firestore and downloads in background
- By the time game completes, photo is ALREADY in sessionStorage
- Celebration screen on VIEW is INSTANT

**⏱️ Timing:** ~1000-2000ms (depends on image size)

```javascript
/**
 * Download photo from URL and store in sessionStorage
 * Used by VIEW when celebration.imageUrl appears in Firestore
 *
 * @param {string} url - Firebase Storage download URL
 * @param {Function} callback - Called with (err)
 */
function downloadPhotoToSessionStorage(url, callback) {
    fetch(url + '?t=' + Date.now())
        .then(function(response) {
            if (!response.ok) throw new Error('Failed to fetch: ' + response.status);
            return response.blob();
        })
        .then(function(blob) {
            var reader = new FileReader();
            reader.onload = function(event) {
                try {
                    var base64 = event.target.result;
                    sessionStorage.setItem(SESSION_STORAGE_KEY, base64);
                    console.log('[CelebrationPhoto] ✅ Downloaded and stored photo from URL');
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
        })
        .catch(function(err) {
            console.warn('[CelebrationPhoto] ❌ Download failed:', err.message);
            if (callback) callback(err);
        });
}
```

---

## 8. State Management

### 8.1 sessionStorage Keys

| Key | Value | Set By | Used By | When Set |
|-----|-------|--------|---------|----------|
| `celebrationPhoto` | base64 image data | ALL devices | Celebration screen (ALL) | Game start (default) + During game (updates) |
| `celebrationPhotoUrl` | Firebase Storage URL | VIEW (when downloaded) | VIEW (to detect changes) | When VIEW downloads photo |
| `celebrationData` | JSON (scores, winner, players) | F1/F2 only (in `showGameCompleteModal()`) | `post-game.html` | When "SEE RESULTS" button shown |
| `isPostGame` | "true" | ALL devices | Navigation | When game completes |

### 8.2 localStorage Keys

| Key | Value | Set By | Used By | Purpose |
|-----|-------|--------|---------|---------|
| `celebration_photo_etag` | GitHub ETag | F1/F2 | F1/F2 | Detect photo changes |
| `celebration_photo_size` | GitHub content-length | F1/F2 | F1/F2 | Detect photo changes |

---

## 9. Error Handling & Resilience

### 9.1 Failure Scenarios

| Scenario | Recovery | Who Handles |
|----------|----------|-------------|
| **C.jpg not found on GitHub** | Load default photo from FS | `checkAndRenameCelebrationPhoto()` |
| **GitHub ETag check fails** | Assume changed (download anyway) | `checkPhotoChanged()` |
| **FS upload fails** | Retry 3 times with exponential backoff | `uploadAndVerifyPhoto()` |
| **FS verification fails** | Retry upload 3 times | `uploadAndVerifyPhoto()` |
| **sessionStorage quota exceeded** | Log error, continue with default | `storeBlobInSessionStorage()` |
| **VIEW download from FS fails** | Keep default photo in sessionStorage | `downloadPhotoToSessionStorage()` |
| **Celebration screen has no photo** | Show trophy icon (should never happen) | `sign-card.js` fallback |

### 9.2 Retry Logic

| Parameter | Value |
|-----------|-------|
| MAX_UPLOAD_RETRIES | 3 |
| RETRY_BASE_DELAY_MS | 2000 |
| Retry 1 delay | 2s |
| Retry 2 delay | 3s |
| Retry 3 delay | 4.5s |

```javascript
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

## 10. File Modification Summary

| # | File | Change | Priority | Status |
|---|------|--------|----------|--------|
| 1 | `celebration-photo.js` | Add `storeBlobInSessionStorage()` | HIGH | ⬜ TO DO |
| 2 | `celebration-photo.js` | Modify `checkAndRenameCelebrationPhoto()` to use `storeBlobInSessionStorage()` | HIGH | ⬜ TO DO |
| 3 | `celebration-photo.js` | Add `downloadPhotoToSessionStorage()` for VIEW | HIGH | ⬜ TO DO |
| 4 | `celebration-photo.js` | Ensure `loadDefaultCelebrationPhoto()` is available | HIGH | ✅ DONE |
| 5 | `real-game-init.js` | Call `loadDefaultCelebrationPhoto()` at game start | HIGH | ✅ DONE |
| 6 | `view-game.html` | Call `loadDefaultCelebrationPhoto()` at game start | HIGH | ✅ DONE (v8.01) |
| 7 | `view-game.html` | Add listener: when `celebration.imageUrl` appears → download to sessionStorage | HIGH | ✅ DONE (v8.01) |
| 8 | `real-game-nav.js` | Add `celebrationData` save in `showGameCompleteModal()` | HIGH | ⬜ TO DO |
| 9 | `sign-card.js` | Remove GitHub fallback from `getCelebrationImage()` | MEDIUM | ✅ DONE (v1.33) |

**Total Files to Change:**
- `celebration-photo.js` - 3 changes (HIGH priority)
- `real-game-nav.js` - 1 change (HIGH priority)

---

## 11. Testing Plan

### 11.1 Test Cases

| # | Test | Expected Result | Device |
|---|------|-----------------|--------|
| 1 | New game starts on F1 | sessionStorage has default photo | F1 |
| 2 | New game starts on VIEW | sessionStorage has default photo | VIEW |
| 3 | C.jpg changes → F1 saves hole | sessionStorage updated with new photo (NO NETWORK) | F1 |
| 4 | VIEW listener detects `celebration.imageUrl` | VIEW downloads new photo from FS | VIEW |
| 5 | Game completes → F1 clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | F1 |
| 6 | Game completes → VIEW clicks "SEE RESULTS" | Photo displays instantly (from sessionStorage) | VIEW |
| 7 | C.jpg not found | Default photo loaded and displayed | F1/F2 |
| 8 | FS upload fails | Retry 3 times, default photo remains | F1/F2 |
| 9 | VIEW downloads photo before game completes | Photo is in sessionStorage when game completes | VIEW |

### 11.2 Console Commands

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

// Check VIEW photo URL tracking
console.log('Current photo URL:', sessionStorage.getItem('celebrationPhotoUrl'));
```

---

## 12. Common Misunderstandings (FAQ)

| # | Question | Answer |
|---|----------|--------|
| 1 | **"Does VIEW need to call loadDefaultCelebrationPhoto()?"** | **YES.** All devices do. This ensures sessionStorage is NEVER empty. Already implemented in view-game.html v8.01. |
| 2 | **"Does VIEW download the photo when user clicks 'SEE RESULTS'?"** | **NO.** VIEW downloads when `imageUrl` appears in Firestore (way BEFORE game completes). Already implemented in view-game.html v8.01. |
| 3 | **"Does VIEW need celebrationData in sessionStorage?"** | **NO.** VIEW reads scores from cache/Firestore directly. VIEW doesn't navigate to `post-game.html`. |
| 4 | **"Is the GitHub fallback needed in sign-card.js?"** | **NO.** The photo management system makes it unnecessary and dangerous (masks bugs). Already removed in v1.33. |
| 5 | **"When is sessionStorage updated with the new photo?"** | **F1/F2:** Immediately after upload (blob → base64, NO NETWORK). **VIEW:** When listener fires (background). Both happen BEFORE game completes. |
| 6 | **"What if sessionStorage is empty at celebration time?"** | **It can't be.** Default photo is loaded at game start on ALL devices. If it happens, show trophy icon (should never occur). |
| 7 | **"What if loadDefaultCelebrationPhoto() fails?"** | The default photo is ALWAYS in Firebase Storage. If it fails, the app has bigger problems (network, Firebase auth, etc.). |
| 8 | **"Does F2 write the history record?"** | **YES.** F2 is the designated history record writer. F1 does not write history. This is handled in `sign-card.js` `submitSignature()`. |
| 9 | **"Does F2 also store the photo in sessionStorage?"** | **YES.** Both F1 and F2 store the blob in sessionStorage after upload (NO NETWORK). |
| 10 | **"Does VIEW update sessionStorage when the photo changes?"** | **YES.** The realtime listener detects `celebration.imageUrl` changes and downloads the new photo. |

---

## 13. Summary

### 13.1 Key Principles

| Principle | Description | Why It Matters |
|-----------|-------------|----------------|
| **sessionStorage is source of truth** | All devices read photos from sessionStorage | Celebration screen is INSTANT (NO NETWORK) |
| **Default photo always loaded** | All devices start with same default photo | sessionStorage is NEVER empty |
| **No network at display time** | Celebration screen reads from sessionStorage | 0ms display time, no waiting |
| **Background updates** | All downloads/uploads happen in background | User never waits |
| **Data separation** | Photo and celebrationData are separate | VIEW doesn't need celebrationData in sessionStorage |

### 13.2 What's Already Working

| Component | Status |
|-----------|--------|
| `loadDefaultCelebrationPhoto()` in real-game-init.js | ✅ WORKING |
| `loadDefaultCelebrationPhoto()` in view-game.html | ✅ WORKING (v8.01) |
| VIEW photo listener for `celebration.imageUrl` | ✅ WORKING (v8.01) |
| F1/F2 photo update on hole save | ✅ WORKING |
| No GitHub fallback in sign-card.js | ✅ WORKING (v1.33) |
| Celebration screen reads from sessionStorage | ✅ WORKING |

### 13.3 What Still Needs to Be Done

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | `celebration-photo.js` | Add `storeBlobInSessionStorage()` | HIGH |
| 2 | `celebration-photo.js` | Modify `checkAndRenameCelebrationPhoto()` to use `storeBlobInSessionStorage()` | HIGH |
| 3 | `celebration-photo.js` | Add `downloadPhotoToSessionStorage()` for VIEW | HIGH |
| 4 | `real-game-nav.js` | Add `celebrationData` save in `showGameCompleteModal()` | HIGH |

---

**END OF DOCUMENT**