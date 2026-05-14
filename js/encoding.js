/*
FILE: js/encoding.js
VERSION: 1.01
KEY CHANGES:
   - FIXED: encodeTR() now validates input and defaults to 0 for invalid values
   - FIXED: encodeTR() clamps values to valid range 0-19
   - FIXED: decodeTR() now validates input and defaults to 9.5 for invalid values
   - ADDED: Console warnings for debugging invalid TR values
   - Prevents corrupted TR values from being saved to history records
   - All other functionality identical to v1.00
DEPENDS ON: None (pure mapping)
STATUS: Ready for integration
*/

var Encoding = (function() {
    
    // Score mapping: -10 to +15 → A to Z (K=0)
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
    
    // TR mapping: 0 to 19 (integer part) → A to T
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
    // Score Functions (-10 to +15)
    // ============================================================
    
    function encodeScore(value) {
        return SCORE_TO_LETTER[value.toString()];
    }
    
    function decodeScore(letter) {
        return LETTER_TO_SCORE[letter];
    }
    
    // ============================================================
    // TR Functions (0 to 19.5 in 0.5 increments)
    // ============================================================
    
    function encodeTR(value) {
        // Validate input
        if (typeof value !== 'number' || isNaN(value)) {
            console.warn('Invalid TR value:', value, 'defaulting to 0');
            return "A";  // A = 0
        }
        
        var isHalf = (value % 1 !== 0);
        var intPart = Math.floor(value);
        
        // Clamp to valid range 0-19
        if (intPart < 0) {
            console.warn('TR value below 0:', value, 'clamping to 0');
            intPart = 0;
        }
        if (intPart > 19) {
            console.warn('TR value above 19:', value, 'clamping to 19');
            intPart = 19;
        }
        
        var letter = TR_INT_TO_LETTER[intPart.toString()];
        if (!letter) {
            console.warn('Invalid TR int part:', intPart, 'defaulting to A');
            return "A";
        }
        
        return isHalf ? letter + "*" : letter;
    }
    
    function decodeTR(encoded) {
        // Handle invalid input
        if (!encoded || typeof encoded !== 'string' || encoded.length === 0) {
            console.warn('Invalid TR encoded string:', encoded, 'defaulting to 9.5');
            return 9.5;
        }
        
        // Check if it has suffix
        var hasSuffix = encoded.indexOf("*") !== -1;
        var letter = hasSuffix ? encoded.charAt(0) : encoded;
        
        // Handle multi-character invalid strings (e.g., "OF")
        if (letter.length !== 1) {
            console.warn('Invalid TR encoded string (multi-char):', encoded, 'defaulting to 9.5');
            return 9.5;
        }
        
        var intValue = LETTER_TO_TR_INT[letter];
        if (intValue === undefined) {
            console.warn('Unknown TR letter:', letter, 'defaulting to 9.5');
            return 9.5;
        }
        
        return hasSuffix ? intValue + 0.5 : intValue;
    }
    
    // ============================================================
    // Match Result Functions (-10 to +15, same as score)
    // ============================================================
    
    function encodeMatchResult(value) {
        // Clamp to valid range -10 to 15
        if (value > 15) value = 15;
        if (value < -10) value = -10;
        return SCORE_TO_LETTER[value.toString()];
    }
    
    function decodeMatchResult(letter) {
        return LETTER_TO_SCORE[letter];
    }
    
    // ============================================================
    // TR Color Functions
    // ============================================================
    // "GG" = Team A green, Team B green (tie or both winning context)
    // "GR" = Team A green, Team B red (Team A winning)
    // "RG" = Team A red, Team B green (Team B winning)
    // "RR" = Both red (should not happen in valid game)
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
    // Display Row Functions (T-1, T-2, Strk)
    // ============================================================
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
    // Public API
    // ============================================================
    
    return {
        encodeScore: encodeScore,
        decodeScore: decodeScore,
        encodeTR: encodeTR,
        decodeTR: decodeTR,
        encodeMatchResult: encodeMatchResult,
        decodeMatchResult: decodeMatchResult,
        encodeTRColor: encodeTRColor,
        decodeTRColor: decodeTRColor,
        encodeDisplayRow: encodeDisplayRow,
        decodeDisplayRow: decodeDisplayRow
    };
    
})();

/*
FILE: js/encoding.js
VERSION: 1.01
KEY CHANGES:
   - FIXED: encodeTR() now validates input and defaults to 0 for invalid values
   - FIXED: encodeTR() clamps values to valid range 0-19
   - FIXED: decodeTR() now validates input and defaults to 9.5 for invalid values
   - ADDED: Console warnings for debugging invalid TR values
   - Prevents corrupted TR values from being saved to history records
   - All other functionality identical to v1.00
DEPENDS ON: None (pure mapping)
STATUS: Ready for integration
*/