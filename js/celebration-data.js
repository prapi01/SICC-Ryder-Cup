/*
FILE: js/celebration-data.js
VERSION: 1.01
KEY CHANGES from v1.00:
   - FIXED: replayCelebration() now clears the celebration photo left in sessionStorage
     before showing a past game. sessionStorage survives navigation inside the tab, so a
     photo left by ANOTHER game was displayed as this game's celebration photo.
   - ensureCelebrationPhoto() gained a forceRefresh flag for that re-resolve.
   - NEW FILE (v1.00): shared celebration-data rebuild for any page that needs to show the
     celebration WITHOUT a live sessionStorage.celebrationData
   - WHY: post-game.html v1.13 and hcp-adjust.html v1.18 both render the celebration
     from sessionStorage ONLY, so after the playing session ends (new tab, reload,
     "GAME DAY" later the same day) they dead-ended with "No celebration data found."
     The design says TODAY's game stays accessible until midnight; this restores that
     without needing the original session.
   - REBUILDS from Firestore: historyGames/<gameId>_H.finalResults + .players
     (falls back to scheduledGames/<gameId> when the archive record is absent)
   - RECOVERS the photo via the existing design fallback chain in getCelebrationPhoto()
     (historyGames.celebration.imageUrl -> localStorage -> GitHub C.jpg) and puts it in
     sessionStorage so sign-card.js can display it unchanged
   - ISOLATED per GLOBAL "Isolation of Shared Codes": used by post-game.html AND
     hcp-adjust.html, so it lives in one place (no duplicated rebuild code)
   - NO logic change to sign-card.js / celebration-photo.js - shares their existing APIs
DEPENDS ON: js/firebase-config.js, js/celebration-photo.js (getCelebrationPhoto,
            downloadPhotoToSessionStorage), js/sign-card.js (showCelebrationScreen)
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.CELEBRATION_DATA_VERSION = "1.01";

(function () {
    'use strict';

    var HISTORY_COLLECTION = 'historyGames';
    var SCHEDULED_COLLECTION = 'scheduledGames';

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[CelebrationData]');
        console.log.apply(console, args);
    }

    function getArchiveDocId(gameId) {
        return gameId + '_H';
    }

    // Read the raw record, preferring the completed archive record.
    function loadRecord(gameId, callback) {
        var db = firebase.firestore();
        db.collection(HISTORY_COLLECTION).doc(getArchiveDocId(gameId)).get()
            .then(function (doc) {
                if (doc.exists) {
                    log('using archive record', getArchiveDocId(gameId));
                    callback(null, doc.data());
                    return;
                }
                log('no archive record, trying scheduledGames/' + gameId);
                return db.collection(SCHEDULED_COLLECTION).doc(gameId).get()
                    .then(function (sdoc) {
                        if (sdoc.exists) {
                            callback(null, sdoc.data());
                        } else {
                            callback(new Error('Game record not found: ' + gameId));
                        }
                    });
            })
            .catch(function (err) {
                callback(err);
            });
    }

    // Shape must match the live writer in js/real-game-nav.js so the existing
    // SignCard.showCelebrationScreen consumes it unchanged.
    function buildFromRecord(record, gameId) {
        var players = record.players || [];
        var results = record.results || {};
        var tr = results.tr || {};
        var final = record.finalResults || {};

        var teamAScore = final.teamAScore;
        var teamBScore = final.teamBScore;

        // Fall back to the final TR position (17 = last played hole) when the
        // record has no finalResults (e.g. not yet archived).
        if (typeof teamAScore !== 'number' && tr.teamA && tr.teamA[17] !== undefined) {
            teamAScore = tr.teamA[17];
        }
        if (typeof teamBScore !== 'number' && tr.teamB && tr.teamB[17] !== undefined) {
            teamBScore = tr.teamB[17];
        }
        if (typeof teamAScore !== 'number') teamAScore = 9.5;
        if (typeof teamBScore !== 'number') teamBScore = 9.5;

        var winner = final.winner;
        if (winner !== 'A' && winner !== 'B') {
            winner = teamAScore > teamBScore ? 'A' : (teamBScore > teamAScore ? 'B' : 'Tie');
        }

        return {
            winner: winner,
            teamAScore: teamAScore,
            teamBScore: teamBScore,
            winningPlayers: {
                teamA: players.filter(function (p) { return p.team === 'A'; }),
                teamB: players.filter(function (p) { return p.team === 'B'; })
            },
            gameId: gameId
        };
    }

    /**
     * Build celebrationData for gameId, using the live sessionStorage value when present.
     * Always leaves sessionStorage.celebrationData populated.
     * callback(err, data)
     */
    function buildCelebrationData(gameId, callback) {
        callback = callback || function () {};

        var stored = sessionStorage.getItem('celebrationData');
        if (stored) {
            try {
                var existing = JSON.parse(stored);
                if (existing && existing.gameId === gameId) {
                    log('reusing live sessionStorage celebrationData');
                    callback(null, existing);
                    return;
                }
            } catch (e) {
                log('ignoring unparsable stored celebrationData:', e.message);
            }
        }

        loadRecord(gameId, function (err, record) {
            if (err) {
                callback(err);
                return;
            }
            var data = buildFromRecord(record, gameId);
            sessionStorage.setItem('celebrationData', JSON.stringify(data));
            log('rebuilt celebrationData from Firestore:', data.winner, data.teamAScore + '-' + data.teamBScore);
            callback(null, data);
        });
    }

    /**
     * Ensure the celebration photo is in sessionStorage (sign-card reads that key).
     * Uses the existing design fallback chain via getCelebrationPhoto().
     * callback() is always called - a missing photo is not fatal (sign-card shows the emoji).
     */
    function ensureCelebrationPhoto(gameId, callback, forceRefresh) {
        callback = callback || function () {};

        if (!forceRefresh && sessionStorage.getItem('celebrationPhoto')) {
            log('celebration photo already present');
            callback();
            return;
        }
        if (typeof getCelebrationPhoto !== 'function' ||
            typeof downloadPhotoToSessionStorage !== 'function') {
            log('photo helpers unavailable - skipping photo');
            callback();
            return;
        }

        getCelebrationPhoto(gameId, function (err, url) {
            if (err || !url) {
                log('no photo URL resolved:', err ? err.message : 'none');
                callback();
                return;
            }
            log('resolved photo URL:', url.substring(0, 80));
            downloadPhotoToSessionStorage(url, function (dlErr) {
                if (dlErr) log('photo download failed:', dlErr.message);
                else log('photo stored in sessionStorage');
                callback();
            });
        });
    }

    /**
     * One call for pages that need to replay the celebration for a gameId
     * without a live session. Ensures data + photo, then shows the modal.
     * onError(message) is called when the game genuinely cannot be resolved.
     */
    function replayCelebration(gameId, onError) {
        if (!gameId) {
            if (onError) onError('No gameId provided');
            return;
        }
        buildCelebrationData(gameId, function (err, data) {
            if (err) {
                if (onError) onError(err.message);
                return;
            }
            // v1.01: sessionStorage survives navigation within the tab, so a photo
            // left there by ANOTHER game would be shown as this game's celebration.
            // This is a revisit, not the live session, so re-resolve for gameId.
            sessionStorage.removeItem('celebrationPhoto');
            sessionStorage.removeItem('celebrationPhotoUrl');
            log('cleared any photo left by a previous game in this tab');

            ensureCelebrationPhoto(gameId, function () {
                if (typeof SignCard === 'undefined' || !SignCard.showCelebrationScreen) {
                    if (onError) onError('SignCard not loaded');
                    return;
                }
                SignCard.showCelebrationScreen(
                    data.winner,
                    data.teamAScore,
                    data.teamBScore,
                    data.winningPlayers,
                    data.gameId,
                    function () { log('celebration closed'); }
                );
            }, true);
        });
    }

    window.CelebrationData = {
        buildCelebrationData: buildCelebrationData,
        ensureCelebrationPhoto: ensureCelebrationPhoto,
        replayCelebration: replayCelebration
    };
})();
