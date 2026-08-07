# Handicap Adjustment System - Complete Design Document

## Document Information
- **Date:** 2026-07-01
- **Version:** 2.0
- **Status:** Active - Used by `hcp-adjust.js` and VALIDATE tab
- **Purpose:** Definitive reference for handicap adjustment calculation logic

---

## PART 1: OVERVIEW

### What Is Handicap Adjustment?

Handicap adjustment is performed **at the end of each game** to update individual player handicaps based on their performance in the current game. The adjusted handicaps are stored in Firestore and used as the starting handicaps for the **next game**.

### Why It Matters

| Aspect | Impact |
|--------|--------|
| Fair play | Handicaps reflect actual performance, not just historical data |
| Competitive balance | Players who perform well get harder handicaps (lower strokes) |
| Player motivation | Performance directly affects future handicaps |
| Data integrity | Stored handicaps must be consistent across all records |

---

## PART 2: CORE CONCEPTS

### 2.1 The Anchor Player

The **Anchor** is the player with the **lowest handicap** in the current game. All other players' handicaps are adjusted relative to the Anchor.

**Anchor Rules:**
- The Anchor always has a **0 handicap** for the current game (after zero-rise)
- If multiple players have the same lowest handicap, the user selects the Anchor at **Setup Game** time
- The Anchor can be **changed** at the Handicap Adjustment table by selecting a different 0-handicap player
- When the Anchor changes, **all adjustments are recalculated** against the new Anchor

**Example - Single Anchor:**
```
Players and their handicaps:
- Jeff Goh: 0  ← Anchor
- Ang Cheng Hoo: 2
- Kenneth Foo: 2
- Ong Chee Beng: 1
- Yip Hon Mun: 14
- James Ong: 10
- C K Lim: 10
- Piti Pramotedham: 10
```

**Example - Multiple Anchors (User Selects One):**
```
Players and their handicaps:
- Jeff Goh: 0  ← User selects as Anchor
- Ang Cheng Hoo: 0  ← Not Anchor (has 0 handicap but not selected)
- Kenneth Foo: 2
- Ong Chee Beng: 1
- Yip Hon Mun: 14
- James Ong: 10
- C K Lim: 10
- Piti Pramotedham: 10

Why multiple 0 handicaps can exist:
- Some players may have 0 handicap from previous adjustments
- New players may start with 0 handicap
- This is a valid scenario that the system handles
```

---

### 2.2 Two Components of Adjustment

#### Component 1: Anchor Adjustment (Player vs Anchor)

**Concept:** The player plays an imaginary 18-hole match against the Anchor, with handicap strokes applied based on the difference in their handicaps.

**Calculation:**
1. For each hole, both players' gross scores are retrieved from the flight data
2. Net scores are calculated using the handicap difference:
   - Higher handicap player receives strokes on holes according to SI (Stroke Index)
   - Net score = Gross score - strokes received
3. The hole result is determined: Win (+1), Loss (-1), or Tie (0)
4. **Raw score (anchorRaw)** = Total holes won - Total holes lost (net differential over 18 holes)
5. **Adjustment (anchorAdj)** = For every 2 holes won/lost, 1 stroke adjustment

**Formula:**
```
anchorAdj = -Math.floor(Math.abs(anchorRaw) / 2)   // if anchorRaw > 0 (player beat Anchor)
anchorAdj = +Math.floor(Math.abs(anchorRaw) / 2)   // if anchorRaw < 0 (Anchor beat player)
anchorAdj = 0                                      // if anchorRaw = 0 (tied)
```

**Examples:**

| Scenario | anchorRaw | Calculation | anchorAdj | Interpretation |
|----------|-----------|-------------|-----------|----------------|
| Player beats Anchor by **4 holes** | +4 | -Math.floor(4/2) = **-2** | **-2** | CUT 2 strokes (RED) |
| Player beats Anchor by **3 holes** | +3 | -Math.floor(3/2) = **-1** | **-1** | CUT 1 stroke (RED) |
| Player beats Anchor by **2 holes** | +2 | -Math.floor(2/2) = **-1** | **-1** | CUT 1 stroke (RED) |
| Player beats Anchor by **1 hole** | +1 | -Math.floor(1/2) = **0** | **0** | No change |
| Anchor beats Player by **5 holes** | -5 | +Math.floor(5/2) = **+2** | **+2** | ADD 2 strokes (GREEN) |
| Anchor beats Player by **3 holes** | -3 | +Math.floor(3/2) = **+1** | **+1** | ADD 1 stroke (GREEN) |
| Anchor beats Player by **2 holes** | -2 | +Math.floor(2/2) = **+1** | **+1** | ADD 1 stroke (GREEN) |
| Anchor beats Player by **1 hole** | -1 | +Math.floor(1/2) = **0** | **0** | No change |
| Tied match | 0 | 0 | **0** | Even performance → no change |

**Visual Representation:**
```
anchorRaw:  -6  -5  -4  -3  -2  -1   0  +1  +2  +3  +4  +5  +6
             │   │   │   │   │   │   │   │   │   │   │   │   │
anchorAdj:  +3  +2  +2  +1  +1   0   0   0  -1  -1  -2  -2  -3
             │   │   │   │   │   │   │   │   │   │   │   │   │
Color:     GREEN (ADD)              GREY              RED (CUT)
```

**Display Format in Table:**
```
anchorAdj [anchorRaw]
Example: -2 [4]  → CUT 2 strokes (RED), raw score = 4
Example: +2 [-5] → ADD 2 strokes (GREEN), raw score = -5
Example: 0 [1]   → No adjustment (GREY), raw score = 1
```

---

#### Component 2: Performance Adjustment (Perf)

**Concept:** Based on the player's **match game performance** in the current game. Each player plays 4 matches (against all players on the opposite team).

**Calculation:**
1. For each of the 4 matches, the player's result against the opponent is determined:
   - **Win** = 1 point
   - **All Square (AS)** = 0.5 points
   - **Loss** = 0 points
2. **Raw score (perfRaw)** = Sum of points from all 4 matches (range: 0 to 4)
3. **Adjustment (perfAdj)** based on the raw score:

**Rules:**

| perfRaw Range | perfAdj | Interpretation |
|---------------|---------|----------------|
| ≤ 0.5 | **+1** | Poor performance → ADD 1 stroke (GREEN) |
| ≥ 3.5 | **-1** | Excellent performance → CUT 1 stroke (RED) |
| Otherwise (0.6 - 3.4) | **0** | Average performance → no change |

**Examples:**

| Match Results | perfRaw | perfAdj | Interpretation |
|---------------|---------|---------|----------------|
| Win, Win, Win, AS | 3.5 | **-1** | Excellent → CUT 1 stroke |
| Win, Win, Win, Win | 4.0 | **-1** | Perfect → CUT 1 stroke |
| Win, Win, AS, AS | 3.0 | **0** | Good → no change |
| Win, Win, Loss, AS | 2.5 | **0** | Average → no change |
| Win, Loss, Loss, AS | 1.5 | **0** | Average → no change |
| Loss, AS, Loss, Loss | 0.5 | **+1** | Poor → ADD 1 stroke |
| Loss, Loss, Loss, Loss | 0.0 | **+1** | Very poor → ADD 1 stroke |
| Win, Loss, Loss, Loss | 1.0 | **0** | Below average → no change |

**Display Format in Table:**
```
perfAdj [perfRaw]
Example: -1 [3.5] → CUT 1 stroke (RED), raw score = 3.5
Example: +1 [0.5] → ADD 1 stroke (GREEN), raw score = 0.5
Example: 0 [2.5]  → No adjustment (GREY), raw score = 2.5
```

---

### 2.3 Final Handicap Calculation

**Formula:**
```
finalHcp = startingHcp + anchorAdj + perfAdj
```

**Example - All Components (Corrected):**

| Player | Starting Hcp | anchorAdj | anchorRaw | perfAdj | perfRaw | finalHcp |
|--------|--------------|-----------|-----------|---------|---------|----------|
| Jeff Goh (Anchor) | 0 | 0 | 0 | 0 | 2.0 | 0 |
| Ang Cheng Hoo | 2 | **-2** | +4 | 0 | 2.5 | **0** |
| Kenneth Foo | 2 | **-1** | +2 | **-1** | 3.5 | **0** |
| Ong Chee Beng | 1 | **+1** | -2 | 0 | 2.0 | **2** |
| C K Lim | 10 | **-2** | +4 | 0 | 2.0 | **8** |
| James Ong | 10 | **+1** | -3 | **+1** | 0.5 | **12** |
| Yip Hon Mun | 14 | **-2** | +5 | 0 | 2.0 | **12** |
| Piti Pramotedham | 10 | **-1** | +3 | **-1** | 3.5 | **8** |

---

### 2.4 Zero-Rise

**Concept:** When the lowest handicap after adjustment is **not zero**, all handicaps are shifted upward by the same amount so that the lowest handicap becomes zero.

**Why Zero-Rise is Needed:**
- The Anchor should always have 0 handicap (by definition)
- If the Anchor performs poorly, their handicap might increase above 0
- Example: Anchor (0) gets +2 adjustment → finalHcp = 2 (Anchor no longer has 0)

**Zero-Rise Calculation:**
```
lowestFinalHcp = minimum of all finalHcp values
if (lowestFinalHcp < 0) {
    zeroRiseAmount = -lowestFinalHcp;
    for (each player) {
        finalHcp = finalHcp + zeroRiseAmount;
    }
}
```

**Example 1 - Zero-Rise Applied (Corrected):**
```
Before Zero-Rise:
- Jeff Goh (Anchor): 0
- Ang Cheng Hoo: 0
- Kenneth Foo: 0
- Ong Chee Beng: 2
- C K Lim: 8
- James Ong: 12
- Yip Hon Mun: 12
- Piti Pramotedham: 8

lowest = 0

zeroRiseAmount = 0
No changes needed.
```

**Example 2 - Zero-Rise Applied (Anchor Performs Poorly):**
```
Before Zero-Rise:
- Jeff Goh (Anchor): +2  ← lowest is +2 (not zero!)
- Ang Cheng Hoo: -1
- Kenneth Foo: -2
- Ong Chee Beng: 1
- C K Lim: 7
- James Ong: 11
- Yip Hon Mun: 11
- Piti Pramotedham: 7

lowest = -2

zeroRiseAmount = 2

After Zero-Rise:
- Jeff Goh (Anchor): 4
- Ang Cheng Hoo: 1
- Kenneth Foo: 0  ← New Anchor
- Ong Chee Beng: 3
- C K Lim: 9
- James Ong: 13
- Yip Hon Mun: 13
- Piti Pramotedham: 9

newAnchor = Kenneth Foo (first player with 0)
```

---

## PART 3: DISPLAY FORMAT

### 3.1 Handicap Adjustment Table

The table displays each player's adjustment in the following format:

| Player | Old | Anc | Perf | New |
|--------|-----|-----|------|-----|
| ACH | 2 | **-2 [4]** | **0 [2.5]** | **0** |
| KF | 2 | **-1 [2]** | **-1 [3.5]** | **0** |
| CK | 10 | **-2 [4]** | **0 [2.0]** | **8** |
| YHM | 14 | **-2 [5]** | **0 [2.0]** | **12** |
| JG | 0 | **0 [0]** | **0 [2.0]** | **0** |
| OCB | 1 | **+1 [-2]** | **0 [2.0]** | **2** |
| P | 10 | **-1 [3]** | **-1 [3.5]** | **8** |
| JO | 10 | **+1 [-3]** | **+1 [0.5]** | **12** |

### 3.2 Color Coding

| Element | Color | Meaning |
|---------|-------|---------|
| **ADD** (positive adjustment) | 🟢 **GREEN** | Handicap increases → player receives more strokes |
| **CUT** (negative adjustment) | 🔴 **RED** | Handicap decreases → player receives fewer strokes |
| **No adjustment** | ⚪ **GREY** | No change to handicap |
| **Anchor** | 🟡 **GOLD** | Player is the Anchor (always 0) |
| **New = 0** | 🟡 **GOLD** | Player's new handicap is 0 (possible new Anchor) |

### 3.3 Display Rules

1. **Anchor Column:** `adjustment [raw]` where:
   - `adjustment` is the anchorAdj value (colored GREEN/RED/GREY)
   - `[raw]` is the anchorRaw value (net hole differential)
   - Example: `-2 [4]` = CUT 2 strokes, raw differential = +4 (RED)
   - Example: `+1 [-2]` = ADD 1 stroke, raw differential = -2 (GREEN)

2. **Perf Column:** `adjustment [raw]` where:
   - `adjustment` is the perfAdj value (colored GREEN/RED/GREY)
   - `[raw]` is the perfRaw value (performance points)
   - Example: `-1 [3.5]` = CUT 1 stroke, raw performance points = 3.5 (RED)
   - Example: `+1 [0.5]` = ADD 1 stroke, raw performance points = 0.5 (GREEN)

3. **New Column:** The final handicap after all adjustments and zero-rise
   - Colored GOLD if the value is 0 (new possible Anchor)
   - Colored WHITE otherwise

---

## PART 4: MULTIPLE ANCHORS SCENARIO

### 4.1 Problem Statement

When multiple players have the same lowest handicap (e.g., two players with 0), the system must determine who is the Anchor.

**Example Scenario:**
```
Players and their handicaps:
- Jeff Goh: 0
- Ang Cheng Hoo: 0  ← Also 0 handicap
- Kenneth Foo: 2
- Ong Chee Beng: 1
- Yip Hon Mun: 14
- James Ong: 10
- C K Lim: 10
- Piti Pramotedham: 10
```

### 4.2 Resolution Logic

**Step 1: At Setup Game**
1. The system detects multiple players with 0 handicap
2. The Setup Game screen prompts the user: **"Who is today's Anchor?"**
3. User selects one of the 0-handicap players as the Anchor
4. The selected Anchor is stored in Firestore (`anchor` field)

**Step 2: At Handicap Adjustment**
1. The system reads the stored Anchor from Firestore
2. If the stored Anchor is found, it is used for calculations
3. If the stored Anchor is not found (older records), the system:
   - Looks for players with 0 handicap
   - If exactly one, uses that player as Anchor
   - If multiple, prompts user to select (fallback)

**Step 3: Changing the Anchor**
1. At the Handicap Adjustment table, if multiple 0-handicap players exist, a **"Change Anchor"** button appears
2. User selects a different 0-handicap player from a dropdown
3. System recalculates ALL adjustments against the new Anchor
4. The new Anchor is saved to Firestore

**Step 4: After Recalculation**
1. All player handicaps are recalculated using the new Anchor
2. The Anchor's own handicap remains 0
3. The new Anchor name is stored in `adjustedHandicaps.newAnchor`
4. The Anchor field in the main record is updated

### 4.3 Example - Changing Anchor

**Initial State:**
```
Anchor selected at Setup: Jeff Goh

Players:
- Jeff Goh (Anchor): 0
- Ang Cheng Hoo: 0
- Kenneth Foo: 2
- Ong Chee Beng: 1
- Yip Hon Mun: 14
- James Ong: 10
- C K Lim: 10
- Piti Pramotedham: 10

Calculated handicaps against Jeff Goh:
- Jeff Goh (Anchor): 0
- Ang Cheng Hoo: 3
- Kenneth Foo: 5
- Ong Chee Beng: 4
- Yip Hon Mun: 16
- James Ong: 12
- C K Lim: 12
- Piti Pramotedham: 11
```

**User changes Anchor to Ang Cheng Hoo:**

```
Recalculated handicaps against Ang Cheng Hoo:
- Jeff Goh: 3
- Ang Cheng Hoo (New Anchor): 0
- Kenneth Foo: 5
- Ong Chee Beng: 4
- Yip Hon Mun: 16
- James Ong: 12
- C K Lim: 12
- Piti Pramotedham: 11
```

**Effect:**
- All handicaps are recalculated relative to the new Anchor
- The new Anchor (Ang Cheng Hoo) now has 0
- Jeff Goh's handicap increases (no longer the Anchor)
- All other players' handicaps shift accordingly

---

## PART 5: VALIDATION

### 5.1 What VALIDATE Checks

The VALIDATE tab checks the following for `adjustedHandicaps`:

1. **Exists:** The `adjustedHandicaps` field must exist in the record
2. **Complete:** All players must have adjustment data
3. **Correct:** Each player's stored values must match recalculated values

### 5.2 Validation Fields

| Field | Check | Purpose |
|-------|-------|---------|
| `startingHcp` | Must match player's handicap from record | Ensure baseline is correct |
| `anchorAdj` | Must match recalculated value | Ensure adjustment is correct |
| `perfAdj` | Must match recalculated value | Ensure adjustment is correct |
| `finalHcp` | Must match recalculated value | Ensure final result is correct |
| `anchorRaw` | Must match recalculated value | Ensure raw data is correct |
| `perfRaw` | Must match recalculated value | Ensure raw data is correct |
| `anchor` | Must match lowest handicap player | Ensure correct Anchor |
| `newAnchor` | Must match recalculated value | Ensure correct new Anchor |
| `needsZeroRise` | Must match recalculated value | Ensure zero-rise flag is correct |
| `zeroRiseAmount` | Must match recalculated value | Ensure zero-rise amount is correct |
| `calculatedAt` | Warning if older than game date | Ensure data is fresh |

### 5.3 Validation Results

| Result | Condition | UI Display |
|--------|-----------|------------|
| ✅ VALID | All fields match recalculated values | Green checkmark |
| ❌ MISSING | `adjustedHandicaps` field does not exist | Red "MISSING" label |
| ❌ INVALID | `adjustedHandicaps.players` is incomplete | Red "INVALID" label |
| ❌ STALE | Some fields don't match recalculated values | Red "NEEDS FIX" label |

### 5.4 Validation Mismatch Display

When mismatches are found, the VALIDATE tab displays:

```
🔴 Handicap Mismatches (3)

| Player | Field | Current | Expected |
|--------|-------|---------|----------|
| C K Lim | anchorAdj | -1 | -2 |
| C K Lim | finalHcp | 9 | 8 |
| James Ong | anchorAdj | 0 | +1 |
```

---

## PART 6: COMPLETE CALCULATION EXAMPLE

### 6.1 Starting Data

**Players and Handicaps:**
```
Team A:
- Ang Cheng Hoo (ACH): 2
- Kenneth Foo (KF): 2
- C K Lim (CK): 10
- Yip Hon Mun (YHM): 14

Team B:
- Jeff Goh (JG): 0  ← Anchor
- Ong Chee Beng (OCB): 1
- Piti Pramotedham (P): 10
- James Ong (JO): 10
```

### 6.2 Course Data

**SI (Stroke Index):**
```
Hole:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18
SI:   13 15  7  3 17  1  5 11  9 14  2  8  6 16 10  4 18 12
```

**Par:**
```
Hole:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18
Par:   4  3  4  5  3  4  4  4  4  4  4  3  5  3  5  4  3  5
```

### 6.3 Raw Data (Flight Scores)

**Flight 1 (Players: ACH, YHM, JG, OCB):**

| Hole | ACH | YHM | JG | OCB |
|------|-----|-----|----|-----|
| 1 | 4 | 5 | 5 | 6 |
| 2 | 3 | 4 | 4 | 5 |
| 3 | 4 | 6 | 5 | 5 |
| 4 | 5 | 7 | 6 | 6 |
| 5 | 4 | 5 | 4 | 5 |
| 6 | 5 | 7 | 6 | 6 |
| 7 | 4 | 6 | 5 | 5 |
| 8 | 3 | 5 | 4 | 4 |
| 9 | 4 | 6 | 5 | 5 |
| 10 | 4 | 5 | 5 | 5 |
| 11 | 4 | 5 | 5 | 5 |
| 12 | 4 | 6 | 5 | 6 |
| 13 | 3 | 4 | 4 | 5 |
| 14 | 4 | 5 | 5 | 5 |
| 15 | 4 | 6 | 5 | 6 |
| 16 | 5 | 6 | 6 | 6 |
| 17 | 4 | 5 | 5 | 5 |
| 18 | 5 | 7 | 6 | 6 |

**Flight 2 (Players: KF, CK, P, JO):**

| Hole | KF | CK | P | JO |
|------|----|----|----|----|
| 1 | 5 | 6 | 6 | 6 |
| 2 | 4 | 5 | 5 | 5 |
| 3 | 4 | 5 | 5 | 5 |
| 4 | 5 | 6 | 6 | 6 |
| 5 | 4 | 5 | 5 | 5 |
| 6 | 5 | 6 | 6 | 6 |
| 7 | 5 | 6 | 6 | 6 |
| 8 | 3 | 5 | 4 | 4 |
| 9 | 5 | 6 | 6 | 6 |
| 10 | 5 | 6 | 6 | 6 |
| 11 | 4 | 5 | 5 | 5 |
| 12 | 5 | 6 | 6 | 6 |
| 13 | 4 | 5 | 5 | 5 |
| 14 | 5 | 6 | 6 | 6 |
| 15 | 5 | 6 | 6 | 6 |
| 16 | 5 | 6 | 6 | 6 |
| 17 | 4 | 5 | 5 | 5 |
| 18 | 5 | 6 | 6 | 6 |

### 6.4 Anchor Adjustment Calculation Detail

**Ang Cheng Hoo (ACH) vs Anchor (JG):**
- Starting Hcp: 2
- Hcp difference vs Anchor: 2 - 0 = 2
- ACH receives strokes on SI 1 and 2 holes (Hole 6 and Hole 11)

**Hole-by-Hole Calculation:**

| Hole | SI | ACH Gross | JG Gross | ACH Strokes | ACH Net | JG Net | Result |
|------|----|-----------|----------|-------------|---------|--------|--------|
| 1 | 13 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 2 | 15 | 3 | 4 | 0 | 3 | 4 | ACH wins (+1) |
| 3 | 7 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 4 | 3 | 5 | 6 | 0 | 5 | 6 | ACH wins (+1) |
| 5 | 17 | 4 | 4 | 0 | 4 | 4 | Tie (0) |
| 6 | 1 | 5 | 6 | 1 | 4 | 6 | ACH wins (+1) |
| 7 | 5 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 8 | 11 | 3 | 4 | 0 | 3 | 4 | ACH wins (+1) |
| 9 | 9 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 10 | 14 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 11 | 2 | 4 | 5 | 1 | 3 | 5 | ACH wins (+1) |
| 12 | 8 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 13 | 6 | 3 | 4 | 0 | 3 | 4 | ACH wins (+1) |
| 14 | 16 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 15 | 10 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 16 | 4 | 5 | 6 | 0 | 5 | 6 | ACH wins (+1) |
| 17 | 18 | 4 | 5 | 0 | 4 | 5 | ACH wins (+1) |
| 18 | 12 | 5 | 6 | 0 | 5 | 6 | ACH wins (+1) |

**Summary:**
- ACH wins: 16 holes
- Ties: 1 hole
- Anchor wins: 1 hole

**anchorRaw = 16 - 1 = +15**
**anchorAdj = -Math.floor(15/2) = -7**

**Interpretation:** ACH beat Anchor by 15 holes → CUT 7 strokes

### 6.5 Performance Adjustment Calculation Detail

**Match Results for Each Player (based on Hole 18 final results):**

**Ang Cheng Hoo (ACH):**
| Opponent | Result | Points |
|----------|--------|--------|
| Jeff Goh | Win | 1.0 |
| Ong Chee Beng | Win | 1.0 |
| Piti Pramotedham | Win | 1.0 |
| James Ong | Win | 1.0 |

**perfRaw = 4.0**
**perfAdj = -1** (≥ 3.5 → CUT 1 stroke)

**Kenneth Foo (KF):**
| Opponent | Result | Points |
|----------|--------|--------|
| Jeff Goh | Win | 1.0 |
| Ong Chee Beng | Win | 1.0 |
| Piti Pramotedham | Loss | 0.0 |
| James Ong | Loss | 0.0 |

**perfRaw = 2.0**
**perfAdj = 0** (0.6 - 3.4 → no change)

**C K Lim (CK):**
| Opponent | Result | Points |
|----------|--------|--------|
| Jeff Goh | Win | 1.0 |
| Ong Chee Beng | Win | 1.0 |
| Piti Pramotedham | Win | 1.0 |
| James Ong | AS | 0.5 |

**perfRaw = 3.5**
**perfAdj = -1** (≥ 3.5 → CUT 1 stroke)

**Yip Hon Mun (YHM):**
| Opponent | Result | Points |
|----------|--------|--------|
| Jeff Goh | Loss | 0.0 |
| Ong Chee Beng | Loss | 0.0 |
| Piti Pramotedham | Loss | 0.0 |
| James Ong | Loss | 0.0 |

**perfRaw = 0.0**
**perfAdj = +1** (≤ 0.5 → ADD 1 stroke)

**Jeff Goh (JG) - Anchor:**
| Opponent | Result | Points |
|----------|--------|--------|
| Ang Cheng Hoo | Loss | 0.0 |
| Kenneth Foo | Loss | 0.0 |
| C K Lim | Loss | 0.0 |
| Yip Hon Mun | Win | 1.0 |

**perfRaw = 1.0**
**perfAdj = 0** (0.6 - 3.4 → no change)

**Ong Chee Beng (OCB):**
| Opponent | Result | Points |
|----------|--------|--------|
| Ang Cheng Hoo | Loss | 0.0 |
| Kenneth Foo | Loss | 0.0 |
| C K Lim | Loss | 0.0 |
| Yip Hon Mun | Win | 1.0 |

**perfRaw = 1.0**
**perfAdj = 0** (0.6 - 3.4 → no change)

**Piti Pramotedham (P):**
| Opponent | Result | Points |
|----------|--------|--------|
| Ang Cheng Hoo | Loss | 0.0 |
| Kenneth Foo | Win | 1.0 |
| C K Lim | Loss | 0.0 |
| Yip Hon Mun | Win | 1.0 |

**perfRaw = 2.0**
**perfAdj = 0** (0.6 - 3.4 → no change)

**James Ong (JO):**
| Opponent | Result | Points |
|----------|--------|--------|
| Ang Cheng Hoo | Loss | 0.0 |
| Kenneth Foo | Win | 1.0 |
| C K Lim | AS | 0.5 |
| Yip Hon Mun | Win | 1.0 |

**perfRaw = 2.5**
**perfAdj = 0** (0.6 - 3.4 → no change)

### 6.6 Final Calculation Summary

| Player | Starting | anchorAdj | anchorRaw | perfAdj | perfRaw | Raw Final | Zero-Rise | Final |
|--------|----------|-----------|-----------|---------|---------|-----------|-----------|-------|
| JG (Anchor) | 0 | 0 | 0 | 0 | 1.0 | 0 | 0 | **0** |
| ACH | 2 | -7 | +15 | -1 | 4.0 | -6 | +6 | **0** |
| KF | 2 | -1 | +2 | 0 | 2.0 | 1 | 0 | **1** |
| CK | 10 | -2 | +4 | -1 | 3.5 | 7 | 0 | **7** |
| YHM | 14 | -2 | +5 | +1 | 0.0 | 13 | 0 | **13** |
| OCB | 1 | 0 | 0 | 0 | 1.0 | 1 | 0 | **1** |
| P | 10 | -1 | +3 | 0 | 2.0 | 9 | 0 | **9** |
| JO | 10 | +1 | -3 | 0 | 2.5 | 11 | 0 | **11** |

### 6.7 Zero-Rise Check

**Raw Final values:** 0, -6, 1, 7, 13, 1, 9, 11
**Lowest = -6**

Since the lowest is **less than 0**, zero-rise is needed:

```
zeroRiseAmount = 6
```

Apply to all players:
- JG: 0 + 6 = 6
- ACH: -6 + 6 = 0
- KF: 1 + 6 = 7
- CK: 7 + 6 = 13
- YHM: 13 + 6 = 19
- OCB: 1 + 6 = 7
- P: 9 + 6 = 15
- JO: 11 + 6 = 17

### 6.8 Final Adjusted Handicaps (Corrected)

| Player | Starting | anchorAdj | anchorRaw | perfAdj | perfRaw | Final |
|--------|----------|-----------|-----------|---------|---------|-------|
| **Ang Cheng Hoo (ACH)** | 2 | -7 [15] | -1 [4.0] | **0** |
| **Kenneth Foo (KF)** | 2 | -1 [2] | 0 [2.0] | **7** |
| **C K Lim (CK)** | 10 | -2 [4] | -1 [3.5] | **13** |
| **Yip Hon Mun (YHM)** | 14 | -2 [5] | +1 [0.0] | **19** |
| **Jeff Goh (JG)** | 0 | 0 [0] | 0 [1.0] | **6** |
| **Ong Chee Beng (OCB)** | 1 | 0 [0] | 0 [1.0] | **7** |
| **Piti Pramotedham (P)** | 10 | -1 [3] | 0 [2.0] | **15** |
| **James Ong (JO)** | 10 | +1 [-3] | 0 [2.5] | **17** |

**New Anchor:** Ang Cheng Hoo (ACH) has 0 → becomes the new Anchor

---

## PART 7: STORED DATA STRUCTURE

### 7.1 Firestore Schema

```json
"adjustedHandicaps": {
  "calculatedAt": "2026-07-01T14:30:00.000Z",
  "anchor": "Jeff Goh",
  "newAnchor": "Ang Cheng Hoo",
  "needsZeroRise": true,
  "zeroRiseAmount": 6,
  "players": [
    {
      "name": "Ang Cheng Hoo",
      "label": "ACH",
      "startingHcp": 2,
      "anchorAdj": -7,
      "perfAdj": -1,
      "finalHcp": 0,
      "anchorRaw": 15,
      "perfRaw": 4.0
    },
    {
      "name": "Kenneth Foo",
      "label": "KF",
      "startingHcp": 2,
      "anchorAdj": -1,
      "perfAdj": 0,
      "finalHcp": 7,
      "anchorRaw": 2,
      "perfRaw": 2.0
    },
    {
      "name": "C K Lim",
      "label": "CK",
      "startingHcp": 10,
      "anchorAdj": -2,
      "perfAdj": -1,
      "finalHcp": 13,
      "anchorRaw": 4,
      "perfRaw": 3.5
    },
    {
      "name": "Yip Hon Mun",
      "label": "YHM",
      "startingHcp": 14,
      "anchorAdj": -2,
      "perfAdj": 1,
      "finalHcp": 19,
      "anchorRaw": 5,
      "perfRaw": 0.0
    },
    {
      "name": "Jeff Goh",
      "label": "JG",
      "startingHcp": 0,
      "anchorAdj": 0,
      "perfAdj": 0,
      "finalHcp": 6,
      "anchorRaw": 0,
      "perfRaw": 1.0
    },
    {
      "name": "Ong Chee Beng",
      "label": "OCB",
      "startingHcp": 1,
      "anchorAdj": 0,
      "perfAdj": 0,
      "finalHcp": 7,
      "anchorRaw": 0,
      "perfRaw": 1.0
    },
    {
      "name": "Piti Pramotedham",
      "label": "P",
      "startingHcp": 10,
      "anchorAdj": -1,
      "perfAdj": 0,
      "finalHcp": 15,
      "anchorRaw": 3,
      "perfRaw": 2.0
    },
    {
      "name": "James Ong",
      "label": "JO",
      "startingHcp": 10,
      "anchorAdj": 1,
      "perfAdj": 0,
      "finalHcp": 17,
      "anchorRaw": -3,
      "perfRaw": 2.5
    }
  ]
}
```

### 7.2 Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `calculatedAt` | timestamp | When the adjustment was calculated |
| `anchor` | string | Name of the Anchor used for calculation |
| `newAnchor` | string | Name of the new Anchor (player with 0 after zero-rise) |
| `needsZeroRise` | boolean | Whether zero-rise was applied |
| `zeroRiseAmount` | number | Amount added to all handicaps (0 if not applied) |
| `players` | array | Array of player adjustment objects |

**Player Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Player full name |
| `label` | string | Player short label |
| `startingHcp` | number | Handicap before adjustment |
| `anchorAdj` | number | Anchor adjustment (positive = ADD/GREEN, negative = CUT/RED) |
| `perfAdj` | number | Performance adjustment (positive = ADD/GREEN, negative = CUT/RED) |
| `finalHcp` | number | Final handicap after all adjustments and zero-rise |
| `anchorRaw` | number | Raw anchor adjustment value (net hole differential) |
| `perfRaw` | number | Raw performance adjustment value (total match points) |

---

## PART 8: VALIDATION RULES

### 8.1 When VALIDATE Checks

The VALIDATE tab performs these checks whenever a record is loaded:

1. **Exists Check:** Does `adjustedHandicaps` exist in the record?
2. **Complete Check:** Does `adjustedHandicaps.players` contain all players?
3. **Accuracy Check:** Do stored values match recalculated values?

### 8.2 Validation Logic

```
For each player in allPlayers:
    1. Find matching player in adjustedHandicaps.players
    2. If not found → report "MISSING"
    3. If found:
        a. Compare startingHcp
        b. Compare anchorAdj
        c. Compare perfAdj
        d. Compare finalHcp
        e. Compare anchorRaw
        f. Compare perfRaw
    4. If any mismatch → report "STALE"
    5. If all match → report "VALID"

Additional checks:
    6. Compare adjustedHandicaps.anchor with recalculated anchor
    7. Compare adjustedHandicaps.newAnchor with recalculated newAnchor
    8. Compare adjustedHandicaps.needsZeroRise with recalculated value
    9. Compare adjustedHandicaps.zeroRiseAmount with recalculated value
```

### 8.3 Validation Report Format

**When Valid:**
```
✅ Handicap Adjustment: VALID
   - All 8 players have correct data
   - Anchor: Jeff Goh
   - New Anchor: Ang Cheng Hoo
   - Zero Rise: 6 strokes
   - Calculated: 2026-07-01 14:30:00
```

**When Missing:**
```
❌ Handicap Adjustment: MISSING
   - No adjustedHandicaps data found
   - Expected: 8 players
   - Click "Fix Record" to create
```

**When Stale:**
```
❌ Handicap Adjustment: STALE (3 mismatches)

| Player | Field | Current | Expected |
|--------|-------|---------|----------|
| C K Lim | anchorAdj | -1 | -2 |
| C K Lim | finalHcp | 9 | 8 |
| James Ong | anchorAdj | 0 | +1 |
```

### 8.4 Validation Rules Summary

| Rule | Validation | Action if Violated |
|------|------------|-------------------|
| 1 | `adjustedHandicaps` exists | Report MISSING |
| 2 | `adjustedHandicaps.players` length = players.length | Report INCOMPLETE |
| 3 | Each player has all required fields | Report INVALID |
| 4 | `startingHcp` matches record | Report STALE |
| 5 | `anchorAdj` matches recalculated | Report STALE |
| 6 | `perfAdj` matches recalculated | Report STALE |
| 7 | `finalHcp` matches recalculated | Report STALE |
| 8 | `anchorRaw` matches recalculated | Report STALE |
| 9 | `perfRaw` matches recalculated | Report STALE |
| 10 | `anchor` matches recalculated | Report STALE |
| 11 | `newAnchor` matches recalculated | Report STALE |
| 12 | `needsZeroRise` matches recalculated | Report STALE |
| 13 | `zeroRiseAmount` matches recalculated | Report STALE |

---

## PART 9: QUICK REFERENCE

### 9.1 Formula Summary

| Component | Formula |
|-----------|---------|
| **Anchor Raw** | `anchorRaw = wins - losses` (vs Anchor over 18 holes) |
| **Anchor Adjustment** | `anchorAdj = -Math.floor(abs(anchorRaw) / 2)` if anchorRaw > 0 (CUT) |
| | `anchorAdj = +Math.floor(abs(anchorRaw) / 2)` if anchorRaw < 0 (ADD) |
| **Perf Raw** | `perfRaw = sum(points from 4 matches)` where win=1, AS=0.5, loss=0 |
| **Perf Adjustment** | `perfAdj = +1` if perfRaw ≤ 0.5 (ADD) |
| | `perfAdj = -1` if perfRaw ≥ 3.5 (CUT) |
| | `perfAdj = 0` otherwise |
| **Raw Final** | `rawFinal = startingHcp + anchorAdj + perfAdj` |
| **Zero Rise** | `zeroRiseAmount = -Math.min(rawFinal)` if min < 0, else 0 |
| **Final Hcp** | `finalHcp = rawFinal + zeroRiseAmount` |

### 9.2 Color Guide

| Value | Color | Meaning |
|-------|-------|---------|
| Positive adjustment (+1, +2, +3...) | 🟢 **GREEN** | ADD strokes (handicap increases) |
| Negative adjustment (-1, -2, -3...) | 🔴 **RED** | CUT strokes (handicap decreases) |
| Zero adjustment (0) | ⚪ **GREY** | No change |
| New handicap = 0 | 🟡 **GOLD** | Player is the new Anchor |

### 9.3 Display Format

| Column | Format | Example |
|--------|--------|---------|
| Anc | `adjustment [raw]` | `-2 [4]` |
| Perf | `adjustment [raw]` | `-1 [3.5]` |
| New | `finalHcp` | `8` |

---

## END OF DOCUMENT