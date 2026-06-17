/*
FILE: js/auth-pin.js
VERSION: 1.00
KEY CHANGES:
   - NEW: PIN/Biometric authentication module for protected actions
   - Hardcoded PIN: 8888 (management modal later)
   - Face ID support via WebAuthn
   - 4-digit PIN entry with auto-submit
   - Session timeout: 5 minutes
   - Used for EDIT and DELETE actions in manage-games.html
DEPENDS ON: None (pure DOM manipulation, uses Modal.js for alerts)
STATUS: Ready for integration
*/

var AuthPin = (function() {
    
    // ============================================================
    // Configuration
    // ============================================================
    
    var CONFIG = {
        PIN: "8888",                    // Hardcoded PIN (management modal later)
        SESSION_TIMEOUT_MS: 5 * 60 * 1000,  // 5 minutes
        MAX_PIN_LENGTH: 4
    };
    
    // ============================================================
    // State
    // ============================================================
    
    var authenticated = false;
    var authTimestamp = null;
    var pendingAction = null;           // 'edit' or 'delete'
    var pendingGameId = null;
    var pendingGameDate = null;
    var onSuccessCallback = null;
    
    // ============================================================
    // DOM Element References (for modal)
    // ============================================================
    
    var modal = null;
    var pinDots = [];
    var pinInput = null;
    var faceIdBtn = null;
    var cancelBtn = null;
    var errorMsg = null;
    var currentPin = "";
    
    // ============================================================
    // Check if currently authenticated (within session)
    // ============================================================
    
    function isAuthenticated() {
        if (!authenticated) return false;
        if (!authTimestamp) return false;
        var now = Date.now();
        if (now - authTimestamp > CONFIG.SESSION_TIMEOUT_MS) {
            authenticated = false;
            authTimestamp = null;
            return false;
        }
        return true;
    }
    
    // ============================================================
    // Reset authentication state
    // ============================================================
    
    function resetAuth() {
        authenticated = false;
        authTimestamp = null;
        pendingAction = null;
        pendingGameId = null;
        pendingGameDate = null;
        onSuccessCallback = null;
    }
    
    // ============================================================
    // Authenticate with PIN
    // ============================================================
    
    function authenticateWithPin(enteredPin) {
        if (enteredPin === CONFIG.PIN) {
            authenticated = true;
            authTimestamp = Date.now();
            return true;
        }
        return false;
    }
    
    // ============================================================
    // Face ID / Biometric Authentication via WebAuthn
    // ============================================================
    
    async function authenticateWithBiometric() {
        // Check if WebAuthn is supported
        if (!window.PublicKeyCredential) {
            if (typeof Modal !== 'undefined' && Modal.alert) {
                Modal.alert("Biometric authentication is not supported on this device.\n\nPlease use PIN instead.");
            } else {
                alert("Biometric authentication is not supported on this device.\n\nPlease use PIN instead.");
            }
            return false;
        }
        
        try {
            // Create a challenge (random bytes)
            var challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            
            // Define the credential request options
            var options = {
                publicKey: {
                    challenge: challenge,
                    rpId: window.location.hostname,
                    timeout: 60000,
                    userVerification: "required",
                    extensions: {
                        appid: window.location.origin
                    }
                }
            };
            
            // Request credential
            var credential = await navigator.credentials.get(options);
            
            if (credential) {
                // Biometric authentication successful
                authenticated = true;
                authTimestamp = Date.now();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error("Biometric authentication error:", error);
            
            // User cancelled or authentication failed
            if (error.name === "NotAllowedError" || error.name === "AbortError") {
                if (typeof Modal !== 'undefined' && Modal.alert) {
                    Modal.alert("Biometric authentication was cancelled or timed out.\n\nPlease use PIN instead.");
                }
                return false;
            }
            
            if (typeof Modal !== 'undefined' && Modal.alert) {
                Modal.alert("Biometric authentication failed: " + error.message + "\n\nPlease use PIN instead.");
            }
            return false;
        }
    }
    
    // ============================================================
    // Show PIN/Biometric Modal
    // ============================================================
    
    function showAuthModal(action, gameId, gameDate, onSuccess) {
        // If already authenticated, execute immediately
        if (isAuthenticated()) {
            if (onSuccess) onSuccess();
            return;
        }
        
        // Store pending action
        pendingAction = action;
        pendingGameId = gameId;
        pendingGameDate = gameDate;
        onSuccessCallback = onSuccess;
        
        // Remove any existing modal
        removeModal();
        
        // Build modal HTML
        var modalHtml = `
            <div class="auth-modal-overlay" id="authModal">
                <div class="auth-modal">
                    <div class="auth-modal-title">🔐 AUTHENTICATE TO ${action.toUpperCase()}</div>
                    <div class="auth-modal-subtitle">Enter 4-digit PIN or use Face ID</div>
                    
                    <div class="auth-pin-container">
                        <div class="auth-pin-dots" id="authPinDots">
                            <span class="auth-pin-dot" data-index="0">●</span>
                            <span class="auth-pin-dot" data-index="1">●</span>
                            <span class="auth-pin-dot" data-index="2">●</span>
                            <span class="auth-pin-dot" data-index="3">●</span>
                            <span class="auth-pin-divider">|</span>
                            <span class="auth-pin-faceid" id="authFaceIdBtn">◉</span>
                        </div>
                        <div class="auth-pin-error" id="authPinError"></div>
                    </div>
                    
                    <div class="auth-modal-buttons">
                        <button class="auth-modal-btn auth-modal-btn-cancel" id="authCancelBtn">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        modal = document.getElementById('authModal');
        pinDots = document.querySelectorAll('.auth-pin-dot');
        faceIdBtn = document.getElementById('authFaceIdBtn');
        cancelBtn = document.getElementById('authCancelBtn');
        errorMsg = document.getElementById('authPinError');
        
        // Reset PIN state
        currentPin = "";
        updatePinDots();
        hideError();
        
        // Add event listeners
        attachEventListeners();
        
        // Focus the modal for keyboard input
        modal.focus();
    }
    
    // ============================================================
    // Remove Modal
    // ============================================================
    
    function removeModal() {
        if (modal) {
            modal.remove();
            modal = null;
        }
        pinDots = [];
        faceIdBtn = null;
        cancelBtn = null;
        errorMsg = null;
        currentPin = "";
    }
    
    // ============================================================
    // Update PIN Dots Display
    // ============================================================
    
    function updatePinDots() {
        for (var i = 0; i < pinDots.length; i++) {
            if (i < currentPin.length) {
                pinDots[i].textContent = '●';
                pinDots[i].classList.add('filled');
            } else {
                pinDots[i].textContent = '○';
                pinDots[i].classList.remove('filled');
            }
        }
    }
    
    // ============================================================
    // Show/Hide Error
    // ============================================================
    
    function showError(message) {
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
    }
    
    function hideError() {
        if (errorMsg) {
            errorMsg.textContent = '';
            errorMsg.style.display = 'none';
        }
    }
    
    // ============================================================
    // Handle PIN Entry
    // ============================================================
    
    function handlePinDigit(digit) {
        // Don't accept more than 4 digits
        if (currentPin.length >= CONFIG.MAX_PIN_LENGTH) return;
        
        // Hide any previous error
        hideError();
        
        // Add digit to PIN
        currentPin += digit;
        updatePinDots();
        
        // Check if PIN is complete (4 digits)
        if (currentPin.length === CONFIG.MAX_PIN_LENGTH) {
            validatePinAndExecute();
        }
    }
    
    function handlePinBackspace() {
        if (currentPin.length > 0) {
            currentPin = currentPin.slice(0, -1);
            updatePinDots();
            hideError();
        }
    }
    
    // ============================================================
    // Validate PIN and Execute Pending Action
    // ============================================================
    
    function validatePinAndExecute() {
        if (authenticateWithPin(currentPin)) {
            // PIN correct - execute the pending action
            hideError();
            removeModal();
            if (onSuccessCallback) {
                onSuccessCallback();
            }
            resetAuth();
        } else {
            // PIN incorrect - show error, clear dots, stay on modal
            showError("❌ Invalid PIN. Please try again.");
            currentPin = "";
            updatePinDots();
            
            // Auto-clear error after 2 seconds? No, user must retry.
            // Focus remains on modal for next input.
        }
    }
    
    // ============================================================
    // Handle Face ID Button
    // ============================================================
    
    async function handleFaceId() {
        hideError();
        var success = await authenticateWithBiometric();
        if (success) {
            // Biometric success - execute the pending action
            removeModal();
            if (onSuccessCallback) {
                onSuccessCallback();
            }
            resetAuth();
        } else {
            // Biometric failed - show error, stay on modal
            showError("❌ Face ID failed. Please use PIN.");
        }
    }
    
    // ============================================================
    // Handle Cancel
    // ============================================================
    
    function handleCancel() {
        removeModal();
        resetAuth();
    }
    
    // ============================================================
    // Attach Event Listeners
    // ============================================================
    
    function attachEventListeners() {
        if (!modal) return;
        
        // Face ID button
        if (faceIdBtn) {
            faceIdBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleFaceId();
            });
        }
        
        // Cancel button
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleCancel();
            });
        }
        
        // Close on overlay click (click outside modal)
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                handleCancel();
            }
        });
        
        // Keyboard input for PIN (numbers and backspace)
        document.addEventListener('keydown', function(e) {
            // Only handle if modal is visible
            if (!modal) return;
            
            // Number keys (0-9)
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                handlePinDigit(e.key);
            }
            // Backspace
            else if (e.key === 'Backspace') {
                e.preventDefault();
                handlePinBackspace();
            }
            // Escape - cancel
            else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
            // Enter - if 4 digits entered, triggers validation
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentPin.length === CONFIG.MAX_PIN_LENGTH) {
                    validatePinAndExecute();
                }
            }
        });
        
        // Virtual number pad support (click on dots to input?)
        // The dots are visual only - user uses keyboard or on-screen numeric keypad
    }
    
    // ============================================================
    // Public API: Require Authentication Before Action
    // ============================================================
    
    function requireAuth(action, gameId, gameDate, onSuccess) {
        if (!action) {
            console.error("AuthPin: Action is required (edit/delete)");
            return;
        }
        
        if (!onSuccess || typeof onSuccess !== 'function') {
            console.error("AuthPin: onSuccess callback is required");
            return;
        }
        
        // If already authenticated, execute immediately
        if (isAuthenticated()) {
            onSuccess();
            return;
        }
        
        // Show the authentication modal
        showAuthModal(action, gameId, gameDate, onSuccess);
    }
    
    // ============================================================
    // Public API: Force logout (clear session)
    // ============================================================
    
    function logout() {
        resetAuth();
        removeModal();
    }
    
    // ============================================================
    // Public API: Check auth status
    // ============================================================
    
    function getAuthStatus() {
        return {
            authenticated: isAuthenticated(),
            timestamp: authTimestamp,
            expiresIn: authTimestamp ? Math.max(0, (authTimestamp + CONFIG.SESSION_TIMEOUT_MS - Date.now()) / 1000) : 0
        };
    }
    
    // ============================================================
    // Public API: Change PIN (for future management modal)
    // ============================================================
    
    function setPin(newPin) {
        if (newPin && newPin.length === CONFIG.MAX_PIN_LENGTH && /^\d{4}$/.test(newPin)) {
            CONFIG.PIN = newPin;
            return true;
        }
        return false;
    }
    
    // ============================================================
    // Public API: Get current PIN (for debugging only)
    // ============================================================
    
    function getPin() {
        return CONFIG.PIN;
    }
    
    // ============================================================
    // Expose Styles (injected once)
    // ============================================================
    
    function injectStyles() {
        if (document.getElementById('auth-pin-styles')) return;
        
        var styles = document.createElement('style');
        styles.id = 'auth-pin-styles';
        styles.textContent = `
            /* Auth Modal */
            .auth-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 30000;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            }
            .auth-modal {
                background: #1a1a1a;
                border-radius: 28px;
                padding: 28px;
                max-width: 360px;
                width: 90%;
                text-align: center;
                border: 2px solid #4caf50;
                animation: sharedModalFadeIn 0.2s ease-out;
            }
            .auth-modal-title {
                font-size: 1.1rem;
                font-weight: 600;
                color: #4caf50;
                margin-bottom: 4px;
            }
            .auth-modal-subtitle {
                font-size: 0.7rem;
                color: #888;
                margin-bottom: 24px;
            }
            
            /* PIN Dots */
            .auth-pin-container {
                margin: 20px 0 16px 0;
            }
            .auth-pin-dots {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                font-size: 1.8rem;
                font-weight: 700;
                font-family: monospace;
                letter-spacing: 4px;
                user-select: none;
            }
            .auth-pin-dot {
                display: inline-block;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #0a0a0a;
                border: 2px solid #333;
                color: #4caf50;
                text-align: center;
                line-height: 28px;
                font-size: 1.2rem;
                transition: border-color 0.2s, background 0.2s;
            }
            .auth-pin-dot.filled {
                border-color: #4caf50;
                background: #1a3a1a;
            }
            .auth-pin-divider {
                color: #333;
                font-size: 1.5rem;
                margin: 0 4px;
            }
            .auth-pin-faceid {
                display: inline-block;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #0a0a0a;
                border: 2px solid #4caf50;
                color: #4caf50;
                text-align: center;
                line-height: 28px;
                font-size: 1.2rem;
                cursor: pointer;
                transition: all 0.2s;
                margin-left: 4px;
            }
            .auth-pin-faceid:active {
                transform: scale(0.95);
                background: #1a3a1a;
            }
            .auth-pin-faceid:hover {
                background: #1a3a1a;
            }
            
            .auth-pin-error {
                margin-top: 12px;
                font-size: 0.75rem;
                color: #ff6b6b;
                min-height: 20px;
                display: none;
            }
            
            /* Buttons */
            .auth-modal-buttons {
                display: flex;
                justify-content: center;
                margin-top: 16px;
            }
            .auth-modal-btn {
                padding: 12px 32px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;
                min-width: 120px;
            }
            .auth-modal-btn:active {
                transform: scale(0.98);
            }
            .auth-modal-btn-cancel {
                background: #1a1a1a;
                border: 1px solid #333;
                color: #888;
            }
            .auth-modal-btn-cancel:hover {
                border-color: #4caf50;
            }
            
            @keyframes sharedModalFadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
            
            /* Number pad for mobile (optional - shown below modal) */
            .auth-numpad {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-top: 16px;
                max-width: 240px;
                margin-left: auto;
                margin-right: auto;
            }
            .auth-numpad-btn {
                padding: 14px;
                border-radius: 40px;
                background: #0a0a0a;
                border: 1px solid #333;
                color: #fff;
                font-size: 1.2rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            .auth-numpad-btn:active {
                transform: scale(0.95);
                background: #1a1a1a;
                border-color: #4caf50;
            }
            .auth-numpad-btn-empty {
                visibility: hidden;
            }
            .auth-numpad-btn-backspace {
                background: #1a1a1a;
                border-color: #333;
                color: #ff6b6b;
            }
            .auth-numpad-btn-backspace:active {
                border-color: #ff6b6b;
            }
        `;
        document.head.appendChild(styles);
    }
    
    // ============================================================
    // Auto-inject styles on load
    // ============================================================
    
    injectStyles();
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        requireAuth: requireAuth,
        logout: logout,
        getAuthStatus: getAuthStatus,
        setPin: setPin,
        getPin: getPin,
        CONFIG: CONFIG
    };
    
})();

// Make available globally
window.AuthPin = AuthPin;

/*
FILE: js/auth-pin.js
VERSION: 1.00
KEY CHANGES:
   - NEW: PIN/Biometric authentication module for protected actions
   - Hardcoded PIN: 8888 (management modal later)
   - Face ID support via WebAuthn
   - 4-digit PIN entry with auto-submit
   - Session timeout: 5 minutes
   - Used for EDIT and DELETE actions in manage-games.html
DEPENDS ON: None (pure DOM manipulation, uses Modal.js for alerts)
STATUS: Ready for integration
*/