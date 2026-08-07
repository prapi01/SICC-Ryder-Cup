# Firestore Record Schema - Definitive v4.0

## Document Information
- **Date:** 2026-06-30
- **Version:** 4.0
- **Purpose:** Complete, authoritative reference for the Firestore record structure
- **Status:** Active Schema - All fields documented here are actively maintained

---

## PART 1: DOCUMENT OVERVIEW

### What This Document Describes

This document defines the complete schema for a **Game Record** stored in Firestore. A Game Record represents a single Ryder Cup-style team golf match between two teams (Team A and Team B), with 4 players per team, divided into 2 flights of 4 players each.

### Record Lifecycle States

A record moves through the following states:

| State | Description | Transitions |
|-------|-------------|-------------|
| `scheduled` | Game is created but not yet started | → `in_progress` |
| `in_progress` | Game is active, holes are being played and saved | → `completed` |
| `completed` | All holes played, both flights signed, game finalized | (terminal) |

### Core Data Relationships

```
Game Record
├── Metadata (gameId, status, date, course)
├── Players (8 players with teams, flights, handicaps)
├── Flight Data (raw hole-by-hole scores for each flight)
├── Results (computed match data)
│   ├── matchResults (all 16 player vs player match outcomes)
│   ├── f1IntraMatches (Flight 1 intra-team match outcomes)
│   ├── f2IntraMatches (Flight 2 intra-team match outcomes)
│   ├── game1 (Match Play display data)
│   ├── game2 (Team Game display data)
│   ├── game3 (Stroke Play display data)
│   ├── tr (Total Results per hole)
│   ├── playerTotals (per-player statistics)
│   └── clinchedAt (match clinch data)
├── Adjusted Handicaps (performance-adjusted handicaps)
└── Celebration Photo (optional winner photo)
```

---

## PART 2: TOP-LEVEL FIELDS

### 2.1 Game Identification

```json
"gameId": "GM_260628_1329_73",
"gameType": "real",
"archiveId": "GM_260624_0902_70_Stop_at_H17_COPY_H",
"originalGameId": "GM_260624_0902_70"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gameId` | string | ✅ | Unique game identifier. Format: `GM_YYMMDD_HHMM_SS` where SS is a sequence number. |
| `gameType` | string | ✅ | Type of game. Values: `"real"` (actual match) or `"practice"` (practice round). |
| `archiveId` | string | ❌ | If this record is a copy, contains the document ID from the source collection. Present only on copied records. |
| `originalGameId` | string | ❌ | If this record is a copy, contains the original game ID from the source. Present only on copied records. |

---

### 2.2 Game Status

```json
"status": "completed",
"gameStarted": true,
"completedAt": "2026-06-24T08:00:47.821Z"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | ✅ | Current state of the game. Values: `"scheduled"` → `"in_progress"` → `"completed"`. |
| `gameStarted` | boolean | ✅ | `true` if the game has been started (first hole saved). `false` for scheduled games. |
| `completedAt` | timestamp | ❌ | Timestamp when the game was completed. Set when both flights are signed and status becomes `"completed"`. |

**Status Transitions:**
- `scheduled` → `in_progress`: When first hole is saved
- `in_progress` → `completed`: When both flights are signed AND all holes are played

---

### 2.3 Game Date & Course

```json
"date": "2026-06-24",
"teamGameFormat": "tournament",
"startingHole": 1
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | ✅ | Game date in `YYYY-MM-DD` format. |
| `teamGameFormat` | string | ✅ | Format of the team game. Value: `"tournament"` (currently the only supported format). |
| `startingHole` | number | ✅ | Starting hole number (1-18). Default is 1. Used for shotgun starts or non-traditional order. |

---

### 2.4 Timestamps

```json
"createdAt": "2026-06-24T08:00:47.821Z",
"updatedAt": "2026-06-24T14:54:28.335Z",
"lastActive": "2026-06-24T06:20:09.813Z"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `createdAt` | timestamp | ✅ | When the record was first created in Firestore. |
| `updatedAt` | timestamp | ❌ | When the record was last updated. Updated on every write operation. |
| `lastActive` | timestamp | ✅ | When the game was last active (any user interaction). Used for session management and cleanup. |

---

### 2.5 Schema Version

```json
"version": 3,
"schema": "v3_strings"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | ✅ | Schema version number. Current: 3. |
| `schema` | string | ✅ | Schema identifier. Value: `"v3_strings"`. |

---

## PART 3: FLIGHT DATA

### 3.1 Overview

Flight data stores the **raw hole-by-hole scores** for each flight. Each flight has 4 players (2 from Team A, 2 from Team B). The data is stored as a compact string where each hole is encoded in 9 characters.

```json
"f1": {
  "d": "T05070804T05050706T04080604T06070807T03040403T05070505T09070907T06030504T05060506T05050404T04050404T05070606T03060303T04060406T06070505T06060504T06060604T05060606",
  "se": true,
  "x": false
},
"f2": {
  "d": "T06060608T05060607T04050405T06050507T05040603T06060505T07070606T03030504T06060705T06070805T03050403T07070707T05050403T06070605T05080706T06060706T05050405T07060707",
  "se": false,
  "x": true
}
```

### 3.2 Flight Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `f1` | object | Flight 1 data (players 1-4). |
| `f2` | object | Flight 2 data (players 5-8). |
| `f1.d` | string | Data string for Flight 1 (18 holes × 9 chars = 162 chars). |
| `f1.se` | boolean | Sending enabled flag. `true` if Flight 1 has sent data. |
| `f1.x` | boolean | X flag. Used for synchronization. |

### 3.3 Data String Format

Each hole is encoded as **9 characters**:

```
Position: 0  1  2  3  4  5  6  7  8
         │  │  │  │  │  │  │  │  │
         T  0  5  0  7  0  8  0  4
         │  │  │  │  │  │  │  │  │
         │  │  │  │  │  │  │  │  └── Team B Player 2 (B2) score (2 digits)
         │  │  │  │  │  │  │  └─── Team B Player 1 (B1) score (2 digits)
         │  │  │  │  │  │  └──── Team A Player 2 (A2) score (2 digits)
         │  │  │  │  │  └───── Team A Player 1 (A1) score (2 digits)
         │  │  │  │  └────── Saved flag: 'T' = saved, 'F' = free/not saved
         │  │  │  └─────── Hole number (implied by position)
         │  │  └─────────── Not used
         │  └────────────── Not used
         └───────────────── Start marker
```

**Example:**
- `T05070804` = Hole saved (T), A1=5, A2=7, B1=8, B2=4

**Partial Data:**
- Records may have less than 162 characters if the game is incomplete
- The data string may be cut off at any point
- Missing holes are treated as "not saved"

---

## PART 4: LOCKS

### 4.1 Overview

Locks prevent concurrent editing of the same flight by multiple devices. Each flight can be locked independently.

```json
"locks": {
  "f1": {
    "sid": "sess_1782627593477_mjbfyzs367",
    "did": "🖥️ DEV-71",
    "at": 1782627609681,
    "ex": 1782649209681
  },
  "f2": null
}
```

### 4.2 Lock Fields

| Field | Type | Description |
|-------|------|-------------|
| `locks` | object | Container for flight locks. |
| `locks.f1` | object \| null | Flight 1 lock data. `null` if not locked. |
| `locks.f2` | object \| null | Flight 2 lock data. `null` if not locked. |
| `sid` | string | Session ID that owns the lock. |
| `did` | string | Device ID that owns the lock. Format: `🖥️ DEV-XX`. |
| `at` | number | Lock acquisition timestamp (milliseconds since epoch). |
| `ex` | number | Lock expiry timestamp (milliseconds since epoch). |

**Lock Rules:**
- A flight can only be edited by the device that holds the lock
- Locks expire after a period of inactivity
- Expired locks can be acquired by another device

---

## PART 5: CURRENT HOLE & SAVED HOLES

### 5.1 Current Hole

```json
"currentHoleF1": 1,
"currentHoleF2": 1
```

| Field | Type | Description |
|-------|------|-------------|
| `currentHoleF1` | number | The current hole being played in Flight 1 (1-18). |
| `currentHoleF2` | number | The current hole being played in Flight 2 (1-18). |

### 5.2 Saved Holes

```json
"savedHoles": {
  "1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  "2": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `savedHoles` | object | Keys are flight numbers ("1", "2"), values are arrays of saved hole numbers. |

**Usage:**
- Used to track which holes have been saved for each flight
- Allows resuming games from the last saved position
- Determines which holes are available for editing

---

## PART 6: COURSE DATA

### 6.1 Overview

```json
"course": {
  "id": "iTph634Zg0h768bJleyO",
  "name": "SICC Bukit Course",
  "par": [4, 3, 4, 5, 3, 4, 4, 4, 4, 4, 4, 3, 5, 3, 5, 4, 3, 5],
  "si": [13, 15, 7, 3, 17, 1, 5, 11, 9, 14, 2, 8, 6, 16, 10, 4, 18, 12]
}
```

### 6.2 Course Fields

| Field | Type | Description |
|-------|------|-------------|
| `course` | object | Course information. |
| `course.id` | string | Firestore document ID of the course. |
| `course.name` | string | Full course name. |
| `course.par` | array | Par values for all 18 holes (index 0 = hole 1). |
| `course.si` | array | Stroke index values for all 18 holes (index 0 = hole 1). |

**Note on Starting Hole:**
- The `startingHole` field at the top level determines which hole is considered "hole 1" for the game
- The `par` and `si` arrays are always indexed from the actual hole number (1-18)

---

## PART 7: PLAYERS

### 7.1 Overview

```json
"players": [
  {
    "name": "Ang Cheng Hoo",
    "label": "ACH",
    "team": "A",
    "flight": 1,
    "handicap": 1
  },
  {
    "name": "Kenneth Foo",
    "label": "KF",
    "team": "A",
    "flight": 2,
    "handicap": 3
  },
  {
    "name": "C K Lim",
    "label": "CK",
    "team": "A",
    "flight": 2,
    "handicap": 8
  },
  {
    "name": "Yip Hon Mun",
    "label": "YHM",
    "team": "A",
    "flight": 1,
    "handicap": 12
  },
  {
    "name": "Jeff Goh",
    "label": "JG",
    "team": "B",
    "flight": 1,
    "handicap": 0
  },
  {
    "name": "Ong Chee Beng",
    "label": "OCB",
    "team": "B",
    "flight": 1,
    "handicap": 1
  },
  {
    "name": "Piti Pramotedham",
    "label": "P",
    "team": "B",
    "flight": 2,
    "handicap": 8
  },
  {
    "name": "James Ong",
    "label": "JO",
    "team": "B",
    "flight": 2,
    "handicap": 11
  }
]
```

### 7.2 Player Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Player's full name (unique identifier). |
| `label` | string | ✅ | Short 2-4 character label used for display (e.g., "ACH", "KF"). |
| `team` | string | ✅ | Team assignment. Values: `"A"` or `"B"`. |
| `flight` | number | ✅ | Flight assignment. Values: `1` or `2`. |
| `handicap` | number | ✅ | Player's handicap (strokes). Higher handicap = more strokes received. |

### 7.3 Player Ordering Rules

**Within each flight, players are ordered by handicap (lowest to highest):**

| Flight | Team A | Team B |
|--------|--------|--------|
| Flight 1 | A1 (lowest hcp), A2 | B1 (lowest hcp), B2 |
| Flight 2 | A3, A4 (highest hcp) | B3, B4 (highest hcp) |

**This ordering is critical for matching:**
- A1 vs B1 (match 1)
- A1 vs B2 (match 2)
- A2 vs B1 (match 3)
- A2 vs B2 (match 4)

---

## PART 8: RESULTS

### 8.1 Results Container

```json
"results": {
  "version": 1,
  "lastComputedAt": "2026-06-24T08:00:42.742Z",
  "computedUpToHole": 18
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Results schema version. Current: 1. |
| `lastComputedAt` | timestamp | When the results were last computed. |
| `computedUpToHole` | number | The last hole that was fully computed. `0` if not computed. |

---

### 8.2 Match Results

```json
"matchResults": {
  "0": [1, 0, -1, 2, 0, -1, 1, 0, -1, 2, 0, -1, 1, 0, -1, 2],
  "1": [1, 0, -1, 2, 0, -1, 1, 0, -1, 2, 0, -1, 1, 0, -1, 2],
  "2": null,
  "3": null,
  "4": null,
  "5": null,
  "6": null,
  "7": null,
  "8": null,
  "9": null,
  "10": null,
  "11": null,
  "12": null,
  "13": null,
  "14": null,
  "15": null,
  "16": null,
  "17": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `matchResults` | object | **Source of truth for match data.** Keys are position "0"-"17" (hole position). Values are arrays of 16 integers (one per match pairing). `null` if the hole hasn't been computed. |

**Match Results Array (16 values):**

The array contains results for all 16 match pairings in the following order:

| Index | Match | Type |
|-------|-------|------|
| 0 | A1 vs B1 | Cross-flight |
| 1 | A1 vs B2 | Cross-flight |
| 2 | A1 vs B3 | Cross-flight |
| 3 | A1 vs B4 | Cross-flight |
| 4 | A2 vs B1 | Cross-flight |
| 5 | A2 vs B2 | Cross-flight |
| 6 | A2 vs B3 | Cross-flight |
| 7 | A2 vs B4 | Cross-flight |
| 8 | A1 vs B1 | Intra-flight |
| 9 | A1 vs B2 | Intra-flight |
| 10 | A2 vs B1 | Intra-flight |
| 11 | A2 vs B2 | Intra-flight |
| 12 | A3 vs B3 | Intra-flight |
| 13 | A3 vs B4 | Intra-flight |
| 14 | A4 vs B3 | Intra-flight |
| 15 | A4 vs B4 | Intra-flight |

**Value Meaning:**
- `1` = Team A player wins the hole
- `0` = Hole is tied (All Square)
- `-1` = Team A player loses the hole

---

### 8.3 Intra-Flight Matches

```json
"f1IntraMatches": {
  "0": {
    "Ang Cheng Hoo_vs_Jeff Goh": -1,
    "Ang Cheng Hoo_vs_Ong Chee Beng": -1,
    "Yip Hon Mun_vs_Jeff Goh": 1,
    "Yip Hon Mun_vs_Ong Chee Beng": 0
  },
  "1": null,
  "2": null,
  // ... up to "17": null
},
"f2IntraMatches": {
  "0": {
    "Kenneth Foo_vs_Piti Pramotedham": -1,
    "Kenneth Foo_vs_James Ong": -1,
    "C K Lim_vs_Piti Pramotedham": 0,
    "C K Lim_vs_James Ong": -1
  },
  "1": null,
  "2": null,
  // ... up to "17": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `f1IntraMatches` | object | Flight 1 intra-flight match results. Keys are position "0"-"17". Values are objects mapping player names to match results. |
| `f2IntraMatches` | object | Flight 2 intra-flight match results. Keys are position "0"-"17". Values are objects mapping player names to match results. |

**Key Format:** `PlayerA_vs_PlayerB` (alphabetical order)
**Value Meaning:** `1` = Player A wins, `0` = Tie, `-1` = Player A loses

---

### 8.4 Game 1 - Match Play (Cross-Flight)

```json
"game1": {}
```

| Field | Type | Description |
|-------|------|-------------|
| `game1` | object | Container for match play data. **Note:** No summary fields are stored here. Match play data is derived from `matchResults`. |

**Data Source:** All match play data is computed from `matchResults` on-the-fly.

---

### 8.5 Game 2 - Team Game

```json
"game2": {
  "displayT1": ["AS", "A2", "A1", "A3", "A4", "A3", "A4", "A4", "A5", "A4", "A3", "A4", "A3", "A4", "A2", "AS", "B1", "A1"],
  "displayT2": ["A1", "A3", "A3", "A3", "A3", "A1", "B1", "A1", "A1", "A1", "AS", "AS", "B2", "B4", "B4", "B4", "B5", "B5"],
  "flight1": {
    "leader": ["AS", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "AS", "B", "A"],
    "cumulativePoints": [0, 2, 1, 3, 4, 3, 4, 4, 5, 4, 3, 4, 3, 4, 2, 0, -1, 1],
    "clinchedHole": 18
  },
  "flight2": {
    "leader": ["A", "A", "A", "A", "A", "A", "B", "A", "A", "A", "AS", "AS", "B", "B", "B", "B", "B", "B"],
    "cumulativePoints": [1, 3, 3, 3, 3, 1, -1, 1, 1, 1, 0, 0, -2, -4, -4, -4, -5, -5],
    "clinchedHole": 17
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `displayT1` | array | T-1 (Flight 1 Team Game) display per hole. Values: `"A N"` (Team A leads by N), `"B N"` (Team B leads by N), `"AS"` (All Square). |
| `displayT2` | array | T-2 (Flight 2 Team Game) display per hole. Same format as `displayT1`. |
| `flight1.leader` | array | Flight 1 leader per hole. Values: `"A"`, `"B"`, `"AS"`. |
| `flight1.cumulativePoints` | array | Flight 1 cumulative points per hole. Positive = Team A leads, negative = Team B leads. |
| `flight1.clinchedHole` | number | Hole number where Flight 1 clinched. `null` if not clinched. |
| `flight2.leader` | array | Flight 2 leader per hole. Same format as `flight1.leader`. |
| `flight2.cumulativePoints` | array | Flight 2 cumulative points per hole. Same format as `flight1.cumulativePoints`. |
| `flight2.clinchedHole` | number | Hole number where Flight 2 clinched. `null` if not clinched. |

---

### 8.6 Game 3 - Stroke Play

```json
"game3": {
  "leader": ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B"],
  "displayStrk": ["A6", "A11", "A9", "A12", "A12", "A8", "A6", "A9", "A9", "A7", "A5", "A5", "B1", "B3", "B6", "B8", "B11", "B9"],
  "nettA": [0, 21, 42, 66, 82, 106, 136, 151, 174, 197, 214, 240, 259, 282, 308, 332, 354, 378],
  "nettB": [6, 32, 51, 78, 94, 114, 142, 160, 183, 204, 219, 245, 258, 279, 302, 324, 343, 369]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `leader` | array | Leader per hole. Values: `"A"` (Team A leads), `"B"` (Team B leads), `"AS"` (All Square). |
| `displayStrk` | array | Stroke display per hole. Format: `"A N"` (Team A leads by N strokes), `"B N"` (Team B leads by N strokes), `"AS"` (All Square). |
| `nettA` | array | Team A cumulative nett score per hole. |
| `nettB` | array | Team B cumulative nett score per hole. |

---

### 8.7 Total Results (TR)

```json
"tr": {
  "teamA": [11.5, 15, 13.5, 14, 14.5, 12, 10, 12, 12.5, 12, 11.5, 11, 7, 7.5, 7, 6, 5.5, 7.5],
  "teamB": [7.5, 4, 5.5, 5, 4.5, 7, 9, 7, 6.5, 7, 7.5, 8, 12, 11.5, 12, 13, 13.5, 11.5],
  "teamAGreen": [true, true, true, true, true, true, true, true, true, true, true, true, false, false, false, false, false, false],
  "teamBGreen": [false, false, false, false, false, false, false, false, false, false, false, false, true, true, true, true, true, true]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `teamA` | array | Team A TR (Total Results) per hole. Values are cumulative points across all games. |
| `teamB` | array | Team B TR per hole. Same format as `teamA`. |
| `teamAGreen` | array | Team A lead indicator per hole. `true` if Team A is winning on that hole. |
| `teamBGreen` | array | Team B lead indicator per hole. `true` if Team B is winning on that hole. |

**TR Calculation:**
```
TR per hole = Match Play Points + T-1 Points + T-2 Points + Stroke Points
```

**Final Result:**
- Team with higher TR on hole 18 wins the match

---

### 8.8 Player Totals

```json
"playerTotals": {
  "Piti Pramotedham": {
    "name": "Piti Pramotedham",
    "label": "P",
    "holesPlayed": 18,
    "totalGross": 104,
    "totalPar": 72,
    "relativeToPar": 32
  },
  "Yip Hon Mun": {
    "name": "Yip Hon Mun",
    "label": "YHM",
    "holesPlayed": 18,
    "totalGross": 108,
    "totalPar": 72,
    "relativeToPar": 36
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `playerTotals` | object | Keys are player full names, values are player statistics. |
| `name` | string | Player full name. |
| `label` | string | Player short label. |
| `holesPlayed` | number | Number of holes played by this player. |
| `totalGross` | number | Total gross score (sum of all hole scores). |
| `totalPar` | number | Total par for holes played. |
| `relativeToPar` | number | Score relative to par (`totalGross - totalPar`). |

---

### 8.9 Clinch Data

```json
"clinchedAt": {
  "Ang Cheng Hoo_vs_Jeff Goh": {
    "winner": "Ang Cheng Hoo",
    "loser": "Jeff Goh",
    "clinchedAtHole": 14,
    "leadAtClinch": 5,
    "remainingHolesAtClinch": 4,
    "cascadeVersion": "6.20",
    "recordedAt": "2026-06-24T01:29:41.281Z",
    "recordedByDevice": "🖥️ DEV-14"
  },
  "James Ong_vs_C K Lim": {
    "winner": "James Ong",
    "loser": "C K Lim",
    "clinchedAtHole": 15,
    "leadAtClinch": 5,
    "remainingHolesAtClinch": 3,
    "cascadeVersion": "6.20",
    "recordedAt": "2026-06-24T01:30:55.077Z",
    "recordedByDevice": "🖥️ DEV-24"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `clinchedAt` | object | Keys are `"PlayerA_vs_PlayerB"` (alphabetical order), values are clinch details. |
| `winner` | string | Name of the winning player. |
| `loser` | string | Name of the losing player. |
| `clinchedAtHole` | number | Hole number where the match was clinched (1-18). |
| `leadAtClinch` | number | The lead at the time of clinch (number of holes up). |
| `remainingHolesAtClinch` | number | Number of holes remaining when clinched. |
| `cascadeVersion` | string | Version of the cascade calculation that produced this result. |
| `recordedAt` | timestamp | When the clinch was recorded. |
| `recordedByDevice` | string | Device that recorded the clinch. Format: `🖥️ DEV-XX`. |

**Clinch Rules:**
- A match is clinched when one player's lead exceeds the number of holes remaining
- Example: If Player A is 4 holes up with 3 holes remaining, Player A has clinched

---

## PART 9: ADJUSTED HANDICAPS

### 9.1 Overview

Adjusted handicaps are calculated based on actual performance during the game. They are used for future games to adjust player handicaps based on recent performance.

```json
"adjustedHandicaps": {
  "calculatedAt": "2026-06-24T14:54:28.335Z",
  "anchor": "Jeff Goh",
  "newAnchor": "Jeff Goh",
  "needsZeroRise": false,
  "zeroRiseAmount": 0,
  "players": [
    {
      "name": "Ang Cheng Hoo",
      "label": "ACH",
      "startingHcp": 1,
      "anchorAdj": 1,
      "perfAdj": 1.1,
      "finalHcp": 3.1,
      "anchorRaw": 1,
      "perfRaw": 20
    },
    {
      "name": "Kenneth Foo",
      "label": "KF",
      "startingHcp": 3,
      "anchorAdj": 3,
      "perfAdj": 1.4,
      "finalHcp": 7.4,
      "anchorRaw": 3,
      "perfRaw": 26
    }
  ]
}
```

### 9.2 Adjusted Handicap Fields

| Field | Type | Description |
|-------|------|-------------|
| `calculatedAt` | timestamp | When the adjustment was calculated. |
| `anchor` | string | Anchor player name (lowest handicap, used as baseline). |
| `newAnchor` | string | New anchor player name (may change after recalculation). |
| `needsZeroRise` | boolean | Whether zero rise is needed (true if lowest handicap is not zero). |
| `zeroRiseAmount` | number | Amount to add to all handicaps to bring the anchor to zero. |

**Player Adjustment Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Player full name. |
| `label` | string | Player short label. |
| `startingHcp` | number | Handicap before adjustment. |
| `anchorAdj` | number | Adjustment based on anchor player's handicap. |
| `perfAdj` | number | Adjustment based on performance. |
| `finalHcp` | number | Final adjusted handicap (`startingHcp + anchorAdj + perfAdj`). |
| `anchorRaw` | number | Raw anchor adjustment (before rounding). |
| `perfRaw` | number | Raw performance adjustment (before rounding). |

---

## PART 10: CELEBRATION PHOTO

### 10.1 Overview

The celebration photo is an optional image uploaded by the winning team after the match is completed.

```json
"celebration": {
  "imageRef": "celebration/GM_260606_1010_13_H.jpg",
  "imageUrl": "https://firebasestorage.googleapis.com/v0/b/sicc-ryder-cup.firebasestorage.app/o/celebration%2FGM_260606_1010_13_H.jpg?alt=media&token=4ddf0811-790d-4aba-a6ca-83ee97a63444",
  "copiedAt": "2026-06-30T09:22:25.131Z"
}
```

### 10.2 Photo Fields

| Field | Type | Description |
|-------|------|-------------|
| `imageRef` | string | Storage reference path. Format: `celebration/{gameId}.jpg`. |
| `imageUrl` | string | Firebase Storage download URL with auth token. |
| `copiedAt` | timestamp | When the photo was added to the record. |

**Photo Rules:**
- Photo is optional (not required for game completion)
- Photo is stored in Firebase Storage under `celebration/{gameId}.jpg`
- Photo is displayed on the scorecard view when the game is viewed in history

---

## PART 11: SIGNS & SIGNATURES

### 11.1 Overview

Signatures indicate that a flight has been verified and signed off by the flight captain.

```json
"signatures": {
  "f1": {
    "signed": true,
    "signedAt": "2026-06-24T08:00:30.195Z",
    "captainName": null
  },
  "f2": {
    "signed": true,
    "signedAt": "2026-06-24T08:00:45.818Z",
    "captainName": null
  }
}
```

### 11.2 Signature Fields

| Field | Type | Description |
|-------|------|-------------|
| `signatures` | object | Container for flight signatures. |
| `f1` | object | Flight 1 signature data. |
| `f2` | object | Flight 2 signature data. |
| `signed` | boolean | `true` if the flight has been signed off. |
| `signedAt` | timestamp | When the flight was signed. `null` if not signed. |
| `captainName` | string | Name of the captain who signed. `null` if not signed. |

**Signature Rules:**
- Both flights must be signed for the game to be considered `completed`
- Signatures are typically captured at the end of the game
- Captains verify the scores before signing

---

## PART 12: FINAL RESULTS

### 12.1 Overview

Final results summarize the outcome of the game.

```json
"finalResults": {
  "teamAScore": 7.5,
  "teamBScore": 11.5,
  "winner": "B",
  "winnerText": "Team B Wins!"
}
```

### 12.2 Final Results Fields

| Field | Type | Description |
|-------|------|-------------|
| `teamAScore` | number | Team A's final TR score (hole 18 TR value). |
| `teamBScore` | number | Team B's final TR score (hole 18 TR value). |
| `winner` | string | Winning team. Values: `"A"`, `"B"`, `"Tie"`. |
| `winnerText` | string | Human-readable winner text. Values: `"Team A Wins!"`, `"Team B Wins!"`, `"Match Tied!"`. |

---

## PART 13: FIELD REFERENCE SUMMARY

### 13.1 All Fields by Category

| Category | Fields |
|----------|--------|
| **Metadata** | `gameId`, `gameType`, `status`, `date`, `teamGameFormat`, `anchor`, `startingHole`, `gameStarted`, `createdAt`, `updatedAt`, `lastActive`, `completedAt`, `archiveId`, `originalGameId` |
| **Flight Data** | `f1`, `f2` (each with `d`, `se`, `x`) |
| **Locks** | `locks.f1`, `locks.f2` (each with `sid`, `did`, `at`, `ex`) |
| **Progress** | `currentHoleF1`, `currentHoleF2`, `savedHoles` |
| **Course** | `course.id`, `course.name`, `course.par`, `course.si` |
| **Players** | `players[].name`, `players[].label`, `players[].team`, `players[].flight`, `players[].handicap` |
| **Results** | `results.version`, `results.lastComputedAt`, `results.computedUpToHole`, `results.matchResults`, `results.f1IntraMatches`, `results.f2IntraMatches`, `results.game1`, `results.game2`, `results.game3`, `results.tr`, `results.playerTotals`, `results.clinchedAt` |
| **Handicaps** | `adjustedHandicaps.calculatedAt`, `adjustedHandicaps.anchor`, `adjustedHandicaps.newAnchor`, `adjustedHandicaps.needsZeroRise`, `adjustedHandicaps.zeroRiseAmount`, `adjustedHandicaps.players` |
| **Photo** | `celebration.imageRef`, `celebration.imageUrl`, `celebration.copiedAt` |
| **Signatures** | `signatures.f1.signed`, `signatures.f1.signedAt`, `signatures.f1.captainName`, `signatures.f2.signed`, `signatures.f2.signedAt`, `signatures.f2.captainName` |
| **Final** | `finalResults.teamAScore`, `finalResults.teamBScore`, `finalResults.winner`, `finalResults.winnerText` |

---

## PART 14: SCHEMA VERSIONING

### 14.1 Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | - | Initial schema |
| v2.0 | - | Nested flight data structure |
| v3.0 | 2026-06-28 | Object-based results (no nested arrays) |
| v4.0 | 2026-06-30 | **Current version.** Removed duplicated summary fields (`game1.pointsA/B`, `game2.pointsA/B`, `game3.pointsA/B`). These fields are derived from `matchResults` and are no longer stored. |

### 14.2 Current Schema

**Version: 4.0**

All fields documented above are active and maintained. The schema is backward compatible with v3.0 records; the removed fields are simply ignored.

### 14.3 Compatibility Notes

| Version | Status | Notes |
|---------|--------|-------|
| v3.0 | ✅ Supported | Records with duplicate fields are read correctly |
| v4.0 | ✅ Current | New records omit duplicate fields |

---

## END OF DOCUMENT