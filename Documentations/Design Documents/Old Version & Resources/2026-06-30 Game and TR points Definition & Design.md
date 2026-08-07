# GAME LOGIC & TR POINT CALCULATION - DEFINITIVE REFERENCE

## Document Information
- **Date:** 2026-06-30
- **Purpose:** Single source of truth for all game logic and TR point calculations
- **Scope:** Match Game, Team Game (T-1, T-2), Stroke Game, and Total Results (TR)
- **Version:** 2.00 (DEFINITIVE)
- **Status:** FINAL - No further changes

---

## 1. OVERVIEW

The SICC Ryder Cup app has **4 games** running simultaneously:

1. **Match Game** (16 individual matches)
2. **Team Game - Flight 1** (T-1)
3. **Team Game - Flight 2** (T-2)
4. **Stroke Game** (Strk)

Each game contributes **TR points** (Total Results points) at every hole.

**TOTAL TR POINTS AT EVERY HOLE = 19. ALWAYS.**

---

## 2. PLAYER SETUP

### 2.1 Team Structure
- **Team A:** 4 players (2 in Flight 1, 2 in Flight 2)
- **Team B:** 4 players (2 in Flight 1, 2 in Flight 2)

### 2.2 Flight Structure

| Flight | Team A Players | Team B Players |
|--------|---------------|----------------|
| Flight 1 | A1, A2 | B1, B2 |
| Flight 2 | A3, A4 | B3, B4 |

### 2.3 Player Order Within Flight
Within each flight, players are ordered by **handicap** (lowest to highest):
- **Match 1:** Lowest handicap vs Lowest handicap
- **Match 2:** 2nd lowest handicap vs 2nd lowest handicap

---

## 3. MATCH GAME

### 3.1 Overview
The Match Game consists of **16 individual matches**:
- 4 Team A players × 4 Team B players = 16 matches

### 3.2 Handicap Application in Match Game

In Match Game, each match is between two players with different handicaps. The higher handicap player **receives strokes** from the lower handicap player.

**Stroke Allocation:**
- Handicap difference = |Hcp_A - Hcp_B|
- The higher handicap player receives strokes equal to the handicap difference
- Strokes are allocated to holes based on **Stroke Index (SI)** of the course
- The player receives 1 stroke on holes with SI from 1 to (handicap difference)

**Example: A1 (hcp 2) vs B2 (hcp 10)**
- Handicap difference = 10 - 2 = **8**
- B2 (higher handicap) receives **8 strokes** from A1
- B2 gets 1 stroke on holes with **SI 1 through 8**
- B2 gets 0 strokes on holes with **SI 9 through 18**

### 3.3 Match Scoring With Handicaps (Per Match, Per Hole)

**Step 1: Determine strokes for each player at the hole**
- Lower handicap player: 0 strokes
- Higher handicap player: 1 stroke if hole SI ≤ handicap difference, else 0

**Step 2: Calculate net scores**
- Player net score = Gross score - Strokes received

**Step 3: Compare net scores from Team A player's POV**

| Comparison | Result | Points |
|------------|--------|--------|
| A net < B net | A wins | **+1** |
| A net > B net | A loses | **-1** |
| A net = B net | AS | **0.5** |

**From the Team B player's POV, it is the opposite.**

### 3.4 Example: A1 (hcp 2) vs B2 (hcp 10) at Hole 1

Course SI at Hole 1 = **13**

- Handicap difference = 8
- B2 receives strokes on SI 1-8
- Hole 1 has SI 13 → B2 receives **0 strokes** at Hole 1

**Net scores:**
- A1 gross = 7, hcp 2 → A1 receives 0 strokes (lower handicap) → net = 7
- B2 gross = 6, hcp 10 → B2 receives 0 strokes (SI 13 > 8) → net = 6

**Result:** A1 7 vs B2 6 → B2 has lower net → **A1 loses the hole**

| Hole | A1 Gross | A1 Strokes | A1 Net | B2 Gross | B2 Strokes | B2 Net | Result (A1 POV) | Points |
|------|----------|------------|--------|----------|------------|--------|-----------------|--------|
| 1 (SI 13) | 7 | 0 | 7 | 6 | 0 | 6 | Lose | **-1** |

### 3.5 Example: A1 (hcp 2) vs B2 (hcp 10) at Hole 2

Course SI at Hole 2 = **15**

- Handicap difference = 8
- B2 receives strokes on SI 1-8
- Hole 2 has SI 15 → B2 receives **0 strokes** at Hole 2

**Net scores:**
- A1 gross = 4, hcp 2 → A1 receives 0 strokes → net = 4
- B2 gross = 3, hcp 10 → B2 receives 0 strokes (SI 15 > 8) → net = 3

**Result:** A1 4 vs B2 3 → B2 has lower net → **A1 loses the hole**

| Hole | A1 Gross | A1 Strokes | A1 Net | B2 Gross | B2 Strokes | B2 Net | Result (A1 POV) | Points |
|------|----------|------------|--------|----------|------------|--------|-----------------|--------|
| 2 (SI 15) | 4 | 0 | 4 | 3 | 0 | 3 | Lose | **-1** |

### 3.6 Example: A1 (hcp 2) vs B2 (hcp 10) at Hole 3

Course SI at Hole 3 = **7**

- Handicap difference = 8
- B2 receives strokes on SI 1-8
- Hole 3 has SI 7 → B2 receives **1 stroke** at Hole 3

**Net scores:**
- A1 gross = 6, hcp 2 → A1 receives 0 strokes → net = 6
- B2 gross = 6, hcp 10 → B2 receives 1 stroke (SI 7 ≤ 8) → net = 6 - 1 = 5

**Result:** A1 6 vs B2 5 → B2 has lower net → **A1 loses the hole**

| Hole | A1 Gross | A1 Strokes | A1 Net | B2 Gross | B2 Strokes | B2 Net | Result (A1 POV) | Points |
|------|----------|------------|--------|----------|------------|--------|-----------------|--------|
| 3 (SI 7) | 6 | 0 | 6 | 6 | 1 | 5 | Lose | **-1** |

### 3.7 Example: A1 (hcp 2) vs B2 (hcp 10) at Hole 4

Course SI at Hole 4 = **3**

- Handicap difference = 8
- B2 receives strokes on SI 1-8
- Hole 4 has SI 3 → B2 receives **1 stroke** at Hole 4

**Net scores:**
- A1 gross = 5, hcp 2 → A1 receives 0 strokes → net = 5
- B2 gross = 7, hcp 10 → B2 receives 1 stroke (SI 3 ≤ 8) → net = 7 - 1 = 6

**Result:** A1 5 vs B2 6 → A1 has lower net → **A1 wins the hole**

| Hole | A1 Gross | A1 Strokes | A1 Net | B2 Gross | B2 Strokes | B2 Net | Result (A1 POV) | Points |
|------|----------|------------|--------|----------|------------|--------|-----------------|--------|
| 4 (SI 3) | 5 | 0 | 5 | 7 | 1 | 6 | Win | **+1** |

### 3.8 Cumulative Score (Per Match, Over Holes)

**Running Total = Sum of all hole results from H1 to Hx**

| Running Total | Meaning |
|---------------|---------|
| Positive (+1, +2, +3...) | Team A player is winning the match |
| Zero (0) | Match is AS (tie) |
| Negative (-1, -2, -3...) | Team A player is losing the match |

### 3.9 TR Points from Match Game (Per Hole, Per Match)

TR points are based on the **cumulative running score** at that hole:

| Running Total | Team A TR | Team B TR | Total |
|---------------|-----------|-----------|-------|
| Positive | **1** | **0** | 1 |
| Zero (AS) | **0.5** | **0.5** | 1 |
| Negative | **0** | **1** | 1 |

**Each match contributes exactly 1 TR point total at every hole.**

### 3.10 Example: A1 vs B2 Summary

| Hole | SI | B2 Strokes | A1 Net | B2 Net | Result (A1) | A1 Running | A1 TR | B2 TR |
|------|----|------------|--------|--------|-------------|------------|-------|-------|
| 1 | 13 | 0 | 7 | 6 | Lose (-1) | -1 | 0 | 1 |
| 2 | 15 | 0 | 4 | 3 | Lose (-1) | -2 | 0 | 1 |
| 3 | 7 | 1 | 6 | 5 | Lose (-1) | -3 | 0 | 1 |
| 4 | 3 | 1 | 5 | 6 | Win (+1) | -2 | 0 | 1 |

**Check:** At each hole, A1 TR + B2 TR = 1 ✅

### 3.11 Total Match Game TR Points Per Hole

16 matches × 1 TR point = **16 TR points per hole**

**Team A + Team B combined = 16 at every hole. ALWAYS.**

---

## 4. TEAM GAME (T-1 and T-2)

### 4.1 Overview
Each flight has its own Team Game:
- **T-1:** Flight 1 Team Game (A1/A2 vs B1/B2)
- **T-2:** Flight 2 Team Game (A3/A4 vs B3/B4)

Each Team Game has **2 matches per hole**:
- **Best Nett (BN):** Lowest nett score from each team
- **2nd Best Nett (2BN):** 2nd lowest nett score from each team

### 4.2 Handicap Application in Team Game

Team Game has **two modes** for handicap application. The mode is selected at game setup.

#### Mode 1: Tournament (Standard)

**Effective Handicap = Full individual handicap**

- Each player receives strokes based on their **full handicap**
- A player gets **1 stroke** on holes where SI ≤ their full handicap
- A player gets **0 strokes** on holes where SI > their full handicap

**Net Score = Gross - (1 if SI ≤ Full Hcp, else 0)**

#### Mode 2: Relative Handicap

**Effective Handicap = Full individual handicap - Anchor handicap**

- Anchor = Lowest full handicap in the flight
- Each player receives strokes based on their **effective handicap**
- A player gets **1 stroke** on holes where SI ≤ their effective handicap
- A player gets **0 strokes** on holes where SI > their effective handicap

**Net Score = Gross - (1 if SI ≤ Effective Hcp, else 0)**

#### Summary Table

| Aspect | Tournament | Relative Handicap |
|--------|------------|-------------------|
| Effective Handicap | Full handicap | Full handicap - Anchor handicap |
| Anchor | None | Lowest handicap player in flight |
| Stroke allocation | Based on Effective Handicap vs SI | Based on Effective Handicap vs SI |
| Net Score | Gross - strokes | Gross - strokes |

### 4.3 Match Scoring (Per Match, Per Hole)

**From Team A's POV:**

| Result | Points |
|--------|--------|
| Team A wins the match (BN or 2BN) | **+1** |
| Team A loses the match (BN or 2BN) | **-1** |
| AS (tie) | **0** |

### 4.4 Hole Contribution (Per Flight, Per Hole)

**Hole Contribution = BN result + 2BN result**

| BN | 2BN | Hole Contribution |
|----|-----|-------------------|
| Win (+1) | Win (+1) | **+2** |
| Win (+1) | Draw (0) | **+1** |
| Win (+1) | Lose (-1) | **0** |
| Draw (0) | Draw (0) | **0** |
| Draw (0) | Win (+1) | **+1** |
| Draw (0) | Lose (-1) | **-1** |
| Lose (-1) | Lose (-1) | **-2** |
| Lose (-1) | Draw (0) | **-1** |
| Lose (-1) | Win (+1) | **0** |

### 4.5 Cumulative Running Score (Per Flight, Over Holes)

**Running Total = Sum of all Hole Contributions from H1 to Hx**

| Running Total | Meaning | Display |
|---------------|---------|---------|
| Positive (+1, +2, +3...) | Team A is winning the flight | **"A" + Running Total** |
| Zero (0) | Flight is AS (tie) | **"AS"** |
| Negative (-1, -2, -3...) | Team B is winning the flight | **"B" + Absolute(Running Total)** |

**Example:**
- Running = +1 → Display = **"A1"** (Team A leading by 1)
- Running = -3 → Display = **"B3"** (Team B leading by 3)
- Running = 0 → Display = **"AS"** (Tied)

### 4.6 TR Points from Team Game (Per Hole, Per Flight)

TR points are based on the **cumulative running score** at that hole:

| Running Total | Team A TR | Team B TR | Total |
|---------------|-----------|-----------|-------|
| Positive | **1** | **0** | 1 |
| Zero (AS) | **0.5** | **0.5** | 1 |
| Negative | **0** | **1** | 1 |

**Each flight (T-1 and T-2) contributes exactly 1 TR point total at every hole.**

### 4.7 Example: T-1 Flight 1 (Tournament Mode)

**Setup:**
- A1: hcp 2
- A2: hcp 10
- B1: hcp 1
- B2: hcp 10

| Hole | BN | 2BN | Hole Contribution | Running | Display | Team A TR | Team B TR |
|------|----|----|--------------------|---------|---------|-----------|-----------|
| 1 | AS (0) | AS (0) | 0 | 0 | **AS** | 0.5 | 0.5 |
| 2 | A wins (+1) | A wins (+1) | +2 | +2 | **A2** | 1 | 0 |
| 3 | AS (0) | AS (0) | 0 | +2 | **A2** | 1 | 0 |
| 4 | A wins (+1) | A wins (+1) | +2 | +4 | **A4** | 1 | 0 |
| 5 | B wins (-1) | B wins (-1) | -2 | +2 | **A2** | 1 | 0 |
| 6 | B wins (-1) | B wins (-1) | -2 | 0 | **AS** | 0.5 | 0.5 |
| 7 | B wins (-1) | B wins (-1) | -2 | -2 | **B2** | 0 | 1 |
| 8 | B wins (-1) | B wins (-1) | -2 | -4 | **B4** | 0 | 1 |

**Check:** At each hole, Team A TR + Team B TR = 1 ✅

### 4.8 Total Team Game TR Points Per Hole

- T-1: 1 TR point
- T-2: 1 TR point
- **Total = 2 TR points per hole**

**Team A + Team B combined = 2 at every hole. ALWAYS.**

---

## 5. STROKE GAME

### 5.1 Overview
The Stroke Game compares **cumulative nett scores** between Team A and Team B from Hole 1 to current hole Hx.

### 5.2 Handicap Application in Stroke Game

**Team Nett Score at Hx = Cumulative Total Team Gross Strokes up to Hx - Total Team Handicap**

- Team Total Handicap = Sum of all players' full handicaps
- No per-hole stroke allocation. The total team handicap is subtracted from the cumulative gross total.

**Score Display:**
- Difference = |Team A Nett - Team B Nett|
- If Team A Nett < Team B Nett → Display = **"A" + Difference**
- If Team B Nett < Team A Nett → Display = **"B" + Difference**
- If equal → Display = **"AS"**

**Example:**

Team A total handicap = 24, Team B total handicap = 19

| Hole | Team A Cum Gross | Team A Nett | Team B Cum Gross | Team B Nett | Difference | Display | TR |
|------|------------------|-------------|------------------|-------------|------------|---------|-----|
| 1 | 25 | 25 - 24 = 1 | 23 | 23 - 19 = 4 | A by 3 | **A3** | A=1, B=0 |
| 2 | 44 | 44 - 24 = 20 | 41 | 41 - 19 = 22 | A by 2 | **A2** | A=1, B=0 |
| 3 | 66 | 66 - 24 = 42 | 62 | 62 - 19 = 43 | A by 1 | **A1** | A=1, B=0 |
| 4 | 88 | 88 - 24 = 64 | 82 | 82 - 19 = 63 | B by 1 | **B1** | A=0, B=1 |
| 5 | 110 | 110 - 24 = 86 | 103 | 103 - 19 = 84 | B by 2 | **B2** | A=0, B=1 |

### 5.3 TR Points from Stroke Game (Per Hole)

At each hole Hx:

| Comparison | Team A TR | Team B TR | Total |
|------------|-----------|-----------|-------|
| Team A nett < Team B nett (A lower) | **1** | **0** | 1 |
| Team A nett > Team B nett (B lower) | **0** | **1** | 1 |
| Team A nett = Team B nett (AS) | **0.5** | **0.5** | 1 |

**1 TR point total per hole from Stroke Game. ALWAYS.**

---

## 6. TOTAL RESULTS (TR) - COMBINED

### 6.1 TR Point Contribution Per Hole

| Game | TR Points | Calculation |
|------|-----------|-------------|
| Match Game | **16** | 16 matches × 1 TR point |
| Team Game T-1 | **1** | 1 flight × 1 TR point |
| Team Game T-2 | **1** | 1 flight × 1 TR point |
| Stroke Game | **1** | 1 game × 1 TR point |
| **TOTAL** | **19** | |

**19 TR points per hole. ALWAYS.**

### 6.2 TR Breakdown Formula

At each hole Hx:

```
TR Team A[Hx] = MatchGame TR A[Hx] + T-1 TR A[Hx] + T-2 TR A[Hx] + Stroke TR A[Hx]
TR Team B[Hx] = MatchGame TR B[Hx] + T-1 TR B[Hx] + T-2 TR B[Hx] + Stroke TR B[Hx]
```

**Validation:**
```
TR Team A[Hx] + TR Team B[Hx] = 19
```

### 6.3 Data Structures

```javascript
// Match Game TR Points
results.matchPlay.pointsA[H]   // Team A TR at hole H
results.matchPlay.pointsB[H]   // Team B TR at hole H

// Team Game TR Points (T-1 + T-2 combined)
results.teamGame.pointsA[H]    // Team A TR at hole H
results.teamGame.pointsB[H]    // Team B TR at hole H

// Stroke Game TR Points
results.strokeGame.pointsA[H]  // Team A TR at hole H
results.strokeGame.pointsB[H]  // Team B TR at hole H

// Total TR Points
results.tr.teamA[H]            // Team A TR at hole H
results.tr.teamB[H]            // Team B TR at hole H
results.tr.teamAGreen[H]       // Boolean: Is Team A winning at hole H?
results.tr.teamBGreen[H]       // Boolean: Is Team B winning at hole H?
```

### 6.4 Complete Example: Hole 1

| Component | Team A | Team B | Total |
|-----------|--------|--------|-------|
| Match Game | 11.0 | 5.0 | 16 |
| T-1 (Running = +1 → A1) | 1.0 | 0 | 1 |
| T-2 (Running = 0 → AS) | 0.5 | 0.5 | 1 |
| Stroke (A lower → A3) | 1.0 | 0 | 1 |
| **TOTAL** | **13.5** | **5.5** | **19** |

**Check:** 13.5 + 5.5 = 19 ✅

---

## 7. VALIDATION CHECKS

### 7.1 Per Hole Validation

For each hole H (1-18), the following MUST be true:

```
1. matchPlay.pointsA[H] + matchPlay.pointsB[H] = 16
2. teamGame.pointsA[H] + teamGame.pointsB[H] = 2
3. strokeGame.pointsA[H] + strokeGame.pointsB[H] = 1
4. tr.teamA[H] + tr.teamB[H] = 19
```

### 7.2 Cumulative Validation

```
tr.teamA[17] = Final Team A TR score
tr.teamB[17] = Final Team B TR score
Winner = Team with higher TR at Hole 18
```

---

## 8. KEY RULES SUMMARY

| Game | Matches | TR Points Per Hole |
|------|---------|-------------------|
| Match Game | 16 matches | **16** |
| Team Game T-1 | 2 matches (BN, 2BN) | **1** |
| Team Game T-2 | 2 matches (BN, 2BN) | **1** |
| Stroke Game | 1 comparison | **1** |
| **TOTAL** | | **19** |

### Match Game:
- Each match: Win = +1, Loss = -1, AS = 0 (from Team A POV)
- Handicap: Higher handicap player receives strokes based on SI
- TR based on cumulative: Positive = 1-0, Zero = 0.5-0.5, Negative = 0-1
- **16 TR points per hole**

### Team Game (T-1, T-2):
- Each flight: 2 matches (BN, 2BN)
- Each match: Win = +1, Loss = -1, AS = 0 (from Team A POV)
- Two modes: Tournament (full handicap) or Relative (effective handicap)
- Running = cumulative sum of BN + 2BN
- TR based on running: Positive = 1-0, Zero = 0.5-0.5, Negative = 0-1
- **1 TR point per flight per hole**
- **2 TR points total per hole (T-1 + T-2)**

### Stroke Game:
- Compare cumulative nett scores: Team Nett = Team Cum Gross - Team Total Handicap
- Display: A/B + difference, or AS
- A lower = 1-0, B lower = 0-1, Equal = 0.5-0.5
- **1 TR point per hole**

---

## 9. VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-30 | Initial definitive reference |
| 1.1 | 2026-06-30 | Added Team Game handicap modes (Tournament/Relative) with detailed examples |
| 2.00 | 2026-06-30 | Added Display column to Team Game; Added Stroke Game display examples; Complete rewrite for clarity |

---

## 10. CONCLUSION

This document defines the complete logic for all games and TR point calculations.

**Key invariants to remember:**
1. Match Game = 16 TR points per hole
2. Team Game = 2 TR points per hole (T-1 + T-2)
3. Stroke Game = 1 TR point per hole
4. **Total = 19 TR points per hole. ALWAYS.**
5. Individual matches: Win = +1, Loss = -1, AS = 0 (from Team A POV)
6. TR from cumulative scores: Positive = 1-0, Zero = 0.5-0.5, Negative = 0-1
7. Team Game BN/2BN: Win = +1, Loss = -1, AS = 0 (from Team A POV)
8. Team Game Display: Running > 0 = "A" + Running, Running < 0 = "B" + Absolute(Running), Running = 0 = "AS"
9. Stroke Game: Team Nett = Team Cum Gross - Team Total Handicap
10. Stroke Game Display: A/B + difference, or AS
11. **Match Game Handicap:** Higher handicap player receives strokes based on SI difference
12. **Team Game Handicap:** Two modes - Tournament (full handicap) or Relative (effective handicap)

**Any code that implements these calculations MUST produce results that match these rules.**