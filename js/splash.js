/*
FILE: js/splash.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - FIXED: Replaced margin-bottom with gap on flex container for consistent spacing
   - Removed iconContainer margin-bottom (now using gap)
   - Gap set to 100px between icon and title
   - All other functionality unchanged
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/

// ============================================================
// VERSION DEFINITION - SINGLE SOURCE OF TRUTH
// ============================================================
var SPLASH_VERSION = "1.03";

// ============================================================
// VERSION EXPOSURE FOR CONSOLE DEBUGGING
// ============================================================
window.SPLASH_VERSION = SPLASH_VERSION;

// ============================================================
// CACHE-BUSTING - Forces reload on new deployment
// ============================================================
var SPLASH_CACHE_KEY = "splash_version";
var storedSplashVersion = localStorage.getItem(SPLASH_CACHE_KEY);
if (storedSplashVersion !== SPLASH_VERSION) {
    localStorage.setItem(SPLASH_CACHE_KEY, SPLASH_VERSION);
    if (document.getElementById('splashOverlay')) {
        window.location.reload();
    }
}

var SplashScreen = (function() {
    
    function show() {
        var golfIcon = document.getElementById('golfIcon');
        if (!golfIcon) {
            console.log('Golf icon not found, skipping splash');
            return;
        }
        
        var originalParent = golfIcon.parentNode;
        var originalNextSibling = golfIcon.nextSibling;
        
        var splash = document.createElement('div');
        splash.id = 'splashOverlay';
        splash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(145deg, #0a1a0a 0%, #000000 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 100px;
            z-index: 10000;
            opacity: 1;
            transition: opacity 0.8s ease;
        `;
        
        var iconContainer = document.createElement('div');
        iconContainer.style.cssText = `
            text-align: center;
        `;
        
        golfIcon.remove();
        iconContainer.appendChild(golfIcon);
        
        golfIcon.style.cssText = `
            font-size: 6rem;
            display: inline-block;
            cursor: default;
            transform: translateY(-300px);
            transition: none;
            filter: drop-shadow(0 0 20px rgba(76,175,80,0.5));
        `;
        
        var title = document.createElement('div');
        title.innerHTML = 'SICC RYDER CUP';
        title.style.cssText = `
            font-size: 1.8rem;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 0%, #4caf50 100%);
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            text-align: center;
            letter-spacing: 2px;
            opacity: 0;
            animation: splashFadeInUp 0.6s ease-out 0.5s forwards;
        `;
        
        var subtitle = document.createElement('div');
        subtitle.innerHTML = 'Match Play · Team Game · Net Stroke';
        subtitle.style.cssText = `
            font-size: 0.75rem;
            color: #888;
            margin-top: 8px;
            letter-spacing: 1px;
            opacity: 0;
            animation: splashFadeInUp 0.6s ease-out 0.8s forwards;
        `;
        
        splash.appendChild(iconContainer);
        splash.appendChild(title);
        splash.appendChild(subtitle);
        document.body.appendChild(splash);
        
        if (!document.getElementById('splash-animations')) {
            var style = document.createElement('style');
            style.id = 'splash-animations';
            style.textContent = `
                @keyframes splashDropDown {
                    0% { transform: translateY(-300px) rotate(0deg); }
                    55% { transform: translateY(10px) rotate(180deg); }
                    75% { transform: translateY(-5px) rotate(270deg); }
                    100% { transform: translateY(0) rotate(360deg); }
                }
                @keyframes splashFadeInUp {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes splashThumpRing {
                    0% { transform: scale(0); opacity: 0.8; }
                    100% { transform: scale(4); opacity: 0; }
                }
                @keyframes splashShake {
                    0% { transform: translate(1px, 1px); }
                    10% { transform: translate(-1px, -2px); }
                    20% { transform: translate(-3px, 0px); }
                    30% { transform: translate(3px, 2px); }
                    40% { transform: translate(1px, -1px); }
                    50% { transform: translate(-1px, 2px); }
                    60% { transform: translate(-3px, 1px); }
                    70% { transform: translate(3px, 1px); }
                    80% { transform: translate(-1px, -1px); }
                    90% { transform: translate(1px, 2px); }
                    100% { transform: translate(0, 0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(function() {
            golfIcon.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            golfIcon.style.transform = 'translateY(0) rotate(360deg)';
        }, 100);
        
        var thumpRing = document.createElement('div');
        thumpRing.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 50px;
            height: 50px;
            margin-left: -25px;
            margin-top: -25px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(76,175,80,0.5) 0%, transparent 70%);
            transform: scale(0);
            pointer-events: none;
            z-index: 10001;
        `;
        splash.appendChild(thumpRing);
        
        setTimeout(function() {
            thumpRing.style.animation = 'splashThumpRing 0.4s ease-out forwards';
        }, 700);
        
        setTimeout(function() {
            splash.style.animation = 'splashShake 0.3s ease-in-out';
        }, 700);
        
        if (navigator.vibrate) {
            setTimeout(function() {
                navigator.vibrate(50);
            }, 700);
        }
        
        setTimeout(function() {
            splash.style.opacity = '0';
            setTimeout(function() {
                splash.remove();
                golfIcon.style.cssText = '';
                golfIcon.style.cursor = 'pointer';
                if (originalParent) {
                    if (originalNextSibling) {
                        originalParent.insertBefore(golfIcon, originalNextSibling);
                    } else {
                        originalParent.appendChild(golfIcon);
                    }
                }
            }, 800);
        }, 2800);
    }
    
    return {
        show: show
    };
})();

/*
FILE: js/splash.js
VERSION: 1.03
KEY CHANGES from v1.02:
   - FIXED: Replaced margin-bottom with gap on flex container for consistent spacing
   - Removed iconContainer margin-bottom (now using gap)
   - Gap set to 100px between icon and title
   - All other functionality unchanged
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/