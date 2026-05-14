/*
FILE: js/display-cache.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared display cache module for all game views
   - Defines fixed positions for all elements in the 594-char display cache
   - Provides encodeHoleSnapshot() - builds 33-char block for a hole
   - Provides decodeHoleSnapshot() - parses 33-char block into object
   - Provides updateDisplayCache() - updates specific hole in cache string
   - Provides getPlayerScore(), getMatchValue(), getTR(), getDisplayRows()
   - Single source of truth for ALL files (real-game, view-game, view-history, preview-game)
DEPENDS ON: None (pure functions)
STATUS: Ready for integration
*/

var DisplayCache = (function() {
    
    // ============================================================
    // Constants - Fixed Positions (0-indexed)
    // ============================================================
    // Each hole occupies 33 characters:
    //   [0-3]   Flight 1 scores (4 players)
    //   [4-7]   Flight 2 scores (4 players)
    //   [8-23]  Match bubbles (16 matches)
    //   [24-25] TR Team A (1-2 chars with optional *)
    //   [26-27] TR Team B (1-2 chars with optional *)
    //   [28-29] TR Colors (GG, GR, RG, RR)
    //   [30-32] Display rows (T-1, T-2, Strk) - each "A", "B", or "S"
    // ============================================================
    
    var CHARS_PER_HOLE = 33;
    var TOTAL_HOLES = 18;
    var TOTAL_CHARS = CHARS_PER_HOLE * TOTAL_HOLES; // 594
    
    // Offsets within a hole (0-indexed)
    var OFFSET = {
        F1_SCORES: 0,      // 4 chars
        F2_SCORES: 4,      // 4 chars
        MATCH_BUBBLES: 8,  // 16 chars
        TR_A: 24,          // 2 chars
        TR_B: 26,          // 2 chars
        TR_COLORS: 28,     // 2 chars
        DISPLAY_ROWS: 30   // 3 chars
    };
    
    // ============================================================
    // A-Z Mapping for Scores (-10 to +15, K=0)
    // ============================================================
    
    var SCORE_TO_LETTER = {
        "-10": "A", "-9": "B", "-8": "C", "-7": "D", "-6": "E",
        "-5": "F", "-4": "G", "-3": "H", "-2": "I", "-1": "J",
        "0": "K", "1": "L", "2": "M", "3": "N", "4": "O",
        "5": "P", "6": "Q", "7": "R", "8": "S", "9": "T",
        "10": "U", "11": "V", "12": "W", "13": "X", "14": "Y", "15": "Z"
    };
    
    var LETTER_TO_SCORE = {
        "A": -10, "B": -9, "C": -8, "D": -7, "E": -6,
        "F": -5, "G": -4, "H": -3, "I": -2, "J": -1,
        "K": 0, "L": 1, "M": 2, "N": 3, "O": 4,
        "P": 5, "Q": 6, "R": 7, "S": 8, "T": 9,
        "U": 10, "V": 11, "W": 12, "X": 13, "Y": 14, "Z": 15
    };
    
    // ============================================================
    // TR Mapping (0 to 19.5, A=0, T=19, * = +0.5)
    // ============================================================
    
    var TR_INT_TO_LETTER = {
        "0": "A", "1": "B", "2": "C", "3": "D", "4": "E",
        "5": "F", "6": "G", "7": "H", "8": "I", "9": "J",
        "10": "K", "11": "L", "12": "M", "13": "N", "14": "O",
        "15": "P", "16": "Q", "17": "R", "18": "S", "19": "T"
    };
    
    var LETTER_TO_TR_INT = {
        "A": 0, "B": 1, "C": 2, "D": 3, "E": 4,
        "F": 5, "G": 6, "H": 7, "I": 8, "J": 9,
        "K": 10, "L": 11, "M": 12, "N": 13, "O": 14,
        "P": 15, "Q": 16, "R": 17, "S": 18, "T": 19
    };
    
    // ============================================================
    // Helper: Get start index for a hole
    // ============================================================
    
    function getHoleStartIndex(holeNumber) {
        var holeIndex = holeNumber - 1;  // 0-based
        return holeIndex * CHARS_PER_HOLE;
    }
    
    // ============================================================
    // Encode a single player's score (relative to par)
    // ============================================================
    
    function encodePlayerScore(relativeScore) {
        // Clamp to valid range -10 to 15
        if (relativeScore > 15) relativeScore = 15;
        if (relativeScore < -10) relativeScore = -10;
        return SCORE_TO_LETTER[relativeScore.toString()];
    }
    
    function decodePlayerScore(letter) {
        return LETTER_TO_SCORE[letter];
    }
    
    // ============================================================
    // Encode TR value (0-19.5)
    // ============================================================
    
    function encodeTR(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return "A";
        }
        var isHalf = (value % 1 !== 0);
        var intPart = Math.floor(value);
        if (intPart < 0) intPart = 0;
        if (intPart > 19) intPart = 19;
        var letter = TR_INT_TO_LETTER[intPart.toString()];
        return isHalf ? letter + "*" : letter;
    }
    
    function decodeTR(encoded) {
        if (!encoded || encoded.length === 0) return 9.5;
        var hasSuffix = encoded.indexOf("*") !== -1;
        var letter = hasSuffix ? encoded.charAt(0) : encoded;
        if (letter.length !== 1) return 9.5;
        var intValue = LETTER_TO_TR_INT[letter];
        if (intValue === undefined) return 9.5;
        return hasSuffix ? intValue + 0.5 : intValue;
    }
    
    // ============================================================
    // Encode TR Colors
    // ============================================================
    
    function encodeTRColor(teamAGreen, teamBGreen) {
        if (teamAGreen && teamBGreen) return "GG";
        if (teamAGreen && !teamBGreen) return "GR";
        if (!teamAGreen && teamBGreen) return "RG";
        return "RR";
    }
    
    function decodeTRColor(colorStr) {
        if (!colorStr || colorStr.length !== 2) {
            return { teamAGreen: true, teamBGreen: true };
        }
        return {
            teamAGreen: colorStr[0] === "G",
            teamBGreen: colorStr[1] === "G"
        };
    }
    
    // ============================================================
    // Encode Display Row (T-1, T-2, Strk)
    // "A" → "A", "B" → "B", "AS" → "S"
    // ============================================================
    
    function encodeDisplayRow(value) {
        if (value === "AS") return "S";
        return value;
    }
    
    function decodeDisplayRow(letter) {
        if (letter === "S") return "AS";
        return letter;
    }
    
    // ============================================================
    // Encode Match Result (-10 to +15)
    // ============================================================
    
    function encodeMatchResult(value) {
        if (value > 15) value = 15;
        if (value < -10) value = -10;
        return SCORE_TO_LETTER[value.toString()];
    }
    
    function decodeMatchResult(letter) {
        return LETTER_TO_SCORE[letter];
    }
    
    // ============================================================
    // Build a 33-char snapshot for a single hole
    // ============================================================
    
    function encodeHoleSnapshot(f1Scores, f2Scores, matchResults, trA, trB, teamAGreen, teamBGreen, t1Row, t2Row, strkRow) {
        // f1Scores: array of 4 numbers (gross scores, not relative)
        // f2Scores: array of 4 numbers
        // matchResults: array of 16 numbers (-10 to +15)
        // trA, trB: numbers (0-19.5)
        // teamAGreen, teamBGreen: booleans
        // t1Row, t2Row, strkRow: strings ("A", "B", or "AS")
        
        var result = "";
        
        // Flight 1 scores (4 chars)
        for (var i = 0; i < 4; i++) {
            result += encodePlayerScore(f1Scores[i]);
        }
        
        // Flight 2 scores (4 chars)
        for (var i = 0; i < 4; i++) {
            result += encodePlayerScore(f2Scores[i]);
        }
        
        // Match bubbles (16 chars)
        for (var i = 0; i < 16; i++) {
            result += encodeMatchResult(matchResults[i]);
        }
        
        // TR values (2 + 2 = 4 chars)
        result += encodeTR(trA);
        result += encodeTR(trB);
        
        // TR colors (2 chars)
        result += encodeTRColor(teamAGreen, teamBGreen);
        
        // Display rows (3 chars)
        result += encodeDisplayRow(t1Row);
        result += encodeDisplayRow(t2Row);
        result += encodeDisplayRow(strkRow);
        
        return result;
    }
    
    // ============================================================
    // Parse a 33-char snapshot into an object
    // ============================================================
    
    function decodeHoleSnapshot(snapshot) {
        if (!snapshot || snapshot.length !== 33) {
            return null;
        }
        
        // Flight 1 scores
        var f1Scores = [];
        for (var i = 0; i < 4; i++) {
            f1Scores.push(decodePlayerScore(snapshot[OFFSET.F1_SCORES + i]));
        }
        
        // Flight 2 scores
        var f2Scores = [];
        for (var i = 0; i < 4; i++) {
            f2Scores.push(decodePlayerScore(snapshot[OFFSET.F2_SCORES + i]));
        }
        
        // Match bubbles
        var matchResults = [];
        for (var i = 0; i < 16; i++) {
            matchResults.push(decodeMatchResult(snapshot[OFFSET.MATCH_BUBBLES + i]));
        }
        
        // TR values
        var trAEncoded = snapshot.substring(OFFSET.TR_A, OFFSET.TR_A + 2);
        var trBEncoded = snapshot.substring(OFFSET.TR_B, OFFSET.TR_B + 2);
        var trA = decodeTR(trAEncoded);
        var trB = decodeTR(trBEncoded);
        
        // TR colors
        var trColors = snapshot.substring(OFFSET.TR_COLORS, OFFSET.TR_COLORS + 2);
        var colors = decodeTRColor(trColors);
        
        // Display rows
        var t1Row = decodeDisplayRow(snapshot[OFFSET.DISPLAY_ROWS]);
        var t2Row = decodeDisplayRow(snapshot[OFFSET.DISPLAY_ROWS + 1]);
        var strkRow = decodeDisplayRow(snapshot[OFFSET.DISPLAY_ROWS + 2]);
        
        return {
            f1Scores: f1Scores,
            f2Scores: f2Scores,
            matchResults: matchResults,
            trA: trA,
            trB: trB,
            teamAGreen: colors.teamAGreen,
            teamBGreen: colors.teamBGreen,
            t1Row: t1Row,
            t2Row: t2Row,
            strkRow: strkRow
        };
    }
    
    // ============================================================
    // Update display cache for a specific hole
    // ============================================================
    
    function updateDisplayCache(displayCache, holeNumber, holeSnapshot) {
        if (!displayCache || displayCache.length !== TOTAL_CHARS) {
            // Initialize empty cache
            displayCache = "K".repeat(TOTAL_CHARS);
        }
        
        var startIndex = getHoleStartIndex(holeNumber);
        var newCache = displayCache.substring(0, startIndex) + 
                       holeSnapshot + 
                       displayCache.substring(startIndex + CHARS_PER_HOLE);
        return newCache;
    }
    
    // ============================================================
    // Get a specific hole's snapshot from display cache
    // ============================================================
    
    function getHoleSnapshot(displayCache, holeNumber) {
        if (!displayCache || displayCache.length !== TOTAL_CHARS) {
            return null;
        }
        var startIndex = getHoleStartIndex(holeNumber);
        return displayCache.substring(startIndex, startIndex + CHARS_PER_HOLE);
    }
    
    // ============================================================
    // Create empty display cache (all "K")
    // ============================================================
    
    function createEmptyDisplayCache() {
        return "K".repeat(TOTAL_CHARS);
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        // Constants
        CHARS_PER_HOLE: CHARS_PER_HOLE,
        TOTAL_HOLES: TOTAL_HOLES,
        TOTAL_CHARS: TOTAL_CHARS,
        OFFSET: OFFSET,
        
        // Encode/Decode
        encodePlayerScore: encodePlayerScore,
        decodePlayerScore: decodePlayerScore,
        encodeTR: encodeTR,
        decodeTR: decodeTR,
        encodeTRColor: encodeTRColor,
        decodeTRColor: decodeTRColor,
        encodeDisplayRow: encodeDisplayRow,
        decodeDisplayRow: decodeDisplayRow,
        encodeMatchResult: encodeMatchResult,
        decodeMatchResult: decodeMatchResult,
        
        // Snapshot functions
        encodeHoleSnapshot: encodeHoleSnapshot,
        decodeHoleSnapshot: decodeHoleSnapshot,
        
        // Cache management
        updateDisplayCache: updateDisplayCache,
        getHoleSnapshot: getHoleSnapshot,
        createEmptyDisplayCache: createEmptyDisplayCache
    };
    
})();

/*
FILE: js/display-cache.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared display cache module for all game views
   - Defines fixed positions for all elements in the 594-char display cache
   - Provides encodeHoleSnapshot() - builds 33-char block for a hole
   - Provides decodeHoleSnapshot() - parses 33-char block into object
   - Provides updateDisplayCache() - updates specific hole in cache string
   - Provides getPlayerScore(), getMatchValue(), getTR(), getDisplayRows()
   - Single source of truth for ALL files (real-game, view-game, view-history, preview-game)
DEPENDS ON: None (pure functions)
STATUS: Ready for integration
*/