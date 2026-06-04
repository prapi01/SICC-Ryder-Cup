/*
FILE: js/firebase-config.js
VERSION: 1.00
PURPOSE: Dynamic Firebase config based on branch/environment
*/

window.FIREBASE_CONFIG_VERSION = "1.00";

// Production config (main branch)
var PROD_CONFIG = {
    apiKey: "AIzaSyB-9hqHpG_Op_kxp9sj8pLs1LS261o2oc",
    authDomain: "sicc-ryder-cup.firebaseapp.com",
    projectId: "sicc-ryder-cup",
    storageBucket: "sicc-ryder-cup.firebasestorage.app",
    messagingSenderId: "137641493845",
    appId: "1:137641493845:web:32399940bce639b01ddbdc"
};

// Development config (dev branch)
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
    
    // Cloudflare Pages branch detection
    if (typeof CF_PAGES_BRANCH !== 'undefined') {
        isDev = (CF_PAGES_BRANCH === 'dev');
    }
    
    // Localhost detection
    if (!isDev && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        isDev = true;
    }
    
    // URL hostname detection
    if (!isDev && window.location.hostname.includes('dev')) {
        isDev = true;
    }
    
    console.log("Firebase using", isDev ? "DEV" : "PROD", "configuration");
    return isDev ? DEV_CONFIG : PROD_CONFIG;
}

var FIREBASE_CONFIG = getFirebaseConfig();

// Auto-initialize Firebase if not already initialized
if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log("Firebase initialized with project:", firebase.apps[0].options.projectId);
}