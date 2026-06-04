/*
FILE: js/firebase-config.js
VERSION: 1.02
KEY CHANGES:
   - FIXED: Changed detection from 'dev' to 'staging' subdomain
   - Staging URL: staging.sicc-ryder-cup.pages.dev
   - Production URL: sicc-ryder-cup.pages.dev (no false positive)
   - Preview hash URLs still detected as DEV
   - Localhost still detected as DEV
DEPENDS ON: Firebase SDK (loaded before this file)
STATUS: Ready for integration
*/

// Version exposure for console debugging
window.FIREBASE_CONFIG_VERSION = "1.02";

// Production config (main branch)
var PROD_CONFIG = {
    apiKey: "AIzaSyB-9hqHpG_Op_kxp9sj8pLs1LS261o2oc",
    authDomain: "sicc-ryder-cup.firebaseapp.com",
    projectId: "sicc-ryder-cup",
    storageBucket: "sicc-ryder-cup.firebasestorage.app",
    messagingSenderId: "137641493845",
    appId: "1:137641493845:web:32399940bce639b01ddbdc"
};

// Development config (staging branch)
var DEV_CONFIG = {
    apiKey: "AIzaSyAw3UVNMET59rjgHNQvu_3qXUQ4RileQeQ",
    authDomain: "sicc-ryder-cup-dev.firebaseapp.com",
    projectId: "sicc-ryder-cup-dev",
    storageBucket: "sicc-ryder-cup-dev.firebasestorage.app",
    messagingSenderId: "181134548931",
    appId: "1:181134548931:web:2e4b0d5e3a513ac21e2776"
};

function getFirebaseConfig() {
    var isDev = false;
    var hostname = window.location.hostname;
    
    // Check for Cloudflare Pages preview deployment (hash URL pattern)
    // Preview URLs look like: 8b7189f3.sicc-ryder-cup.pages.dev
    var isPreviewHash = /^[a-f0-9]{7,8}\./.test(hostname);
    
    // Check for staging subdomain (staging.sicc-ryder-cup.pages.dev)
    var isStagingSubdomain = hostname.startsWith('staging.');
    
    // Check for localhost
    var isLocalhost = (hostname === 'localhost' || hostname === '127.0.0.1');
    
    if (isPreviewHash || isStagingSubdomain || isLocalhost) {
        isDev = true;
        if (isPreviewHash) console.log("Detected Cloudflare preview deployment (hash URL)");
        if (isStagingSubdomain) console.log("Detected staging subdomain");
        if (isLocalhost) console.log("Detected localhost");
    }
    
    console.log("Firebase using", isDev ? "DEV" : "PROD", "configuration");
    console.log("Hostname:", hostname);
    
    return isDev ? DEV_CONFIG : PROD_CONFIG;
}

var FIREBASE_CONFIG = getFirebaseConfig();

// Auto-initialize Firebase if not already initialized
if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log("Firebase initialized with project:", firebase.apps[0].options.projectId);
}

/*
FILE: js/firebase-config.js
VERSION: 1.02
KEY CHANGES:
   - FIXED: Changed detection from 'dev' to 'staging' subdomain
   - Staging URL: staging.sicc-ryder-cup.pages.dev
   - Production URL: sicc-ryder-cup.pages.dev (no false positive)
   - Preview hash URLs still detected as DEV
   - Localhost still detected as DEV
DEPENDS ON: Firebase SDK (loaded before this file)
STATUS: Ready for integration
*/