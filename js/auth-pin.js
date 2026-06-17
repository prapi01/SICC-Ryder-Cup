/*
FILE: js/auth-pin.js
VERSION: 2.02
KEY CHANGES from v2.01:
   - ADDED: Platform detection (macOS vs iOS vs other)
   - UPDATED: Dynamic labels - "Face ID" on iPhone, "Touch ID" on Mac
   - UPDATED: Subtitle text changes based on platform
   - UPDATED: Button aria-label changes based on platform
   - FIXED: Error messages now reference correct biometric name
   - ALL OTHER FUNCTIONS unchanged from v2.01
DEPENDS ON: None (pure DOM manipulation, uses Modal.js for alerts)
STATUS: Ready for integration
*/

// ============================================================
// 🔐 AUTHENTICATION CONFIGURATION - EDIT PIN BELOW
// ============================================================
// To change the PIN, edit the value below.
// PIN must be exactly 4 digits.
// Default: 8888
// ============================================================

var AUTH_PIN = "8888";

// ============================================================
// End of Configuration
// ============================================================

var AuthPin = (function() {
    
    // ============================================================
    // Configuration
    // ============================================================
    
    var CONFIG = {
        PIN: AUTH_PIN,
        SESSION_TIMEOUT_MS: 5 * 60 * 1000,  // 5 minutes
        MAX_PIN_LENGTH: 4,
        MAX_ATTEMPTS: 5,                     // Lock after 5 failed attempts
        LOCKOUT_DURATION_MS: 30 * 1000       // 30 second lockout
    };
    
    // ============================================================
    // Platform Detection
    // ============================================================
    
    function getPlatformInfo() {
        var ua = navigator.userAgent || navigator.vendor || window.opera || '';
        var isMac = /Mac/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        var isTouchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Determine biometric name
        var biometricName = 'Biometric';
        var biometricIcon = '🔐';
        
        if (isMac) {
            biometricName = 'Touch ID';
            biometricIcon = '🖐️';
        } else if (isIOS) {
            biometricName = 'Face ID';
            biometricIcon = '📱';
        } else if (isTouchSupported) {
            // Android or other touch devices - may have fingerprint
            biometricName = 'Fingerprint';
            biometricIcon = '👆';
        }
        
        return {
            isMac: isMac,
            isIOS: isIOS,
            isTouchSupported: isTouchSupported,
            biometricName: biometricName,
            biometricIcon: biometricIcon,
            isBiometricSupported: isMac || isIOS // WebAuthn works on both
        };
    }
    
    // ============================================================
    // State
    // ============================================================
    
    var authenticated = false;
    var authTimestamp = null;
    var pendingAction = null;
    var pendingGameId = null;
    var pendingGameDate = null;
    var onSuccessCallback = null;
    var failedAttempts = 0;
    var lockoutUntil = null;
    var modal = null;
    var pinDots = [];
    var pinInput = null;
    var faceIdBtn = null;
    var cancelBtn = null;
    var errorMsg = null;
    var currentPin = "";
    var isLocked = false;
    
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
        failedAttempts = 0;
        lockoutUntil = null;
        isLocked = false;
    }
    
    // ============================================================
    // Authenticate with PIN
    // ============================================================
    
    function authenticateWithPin(enteredPin) {
        // Check if locked out
        if (isLocked) {
            var remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            if (remaining > 0) {
                showError("🔒 Too many attempts. Try again in " + remaining + "s");
                return false;
            } else {
                // Lockout expired
                isLocked = false;
                failedAttempts = 0;
                lockoutUntil = null;
            }
        }
        
        if (enteredPin === CONFIG.PIN) {
            authenticated = true;
            authTimestamp = Date.now();
            failedAttempts = 0;
            lockoutUntil = null;
            isLocked = false;
            return true;
        } else {
            failedAttempts++;
            if (failedAttempts >= CONFIG.MAX_ATTEMPTS) {
                isLocked = true;
                lockoutUntil = Date.now() + CONFIG.LOCKOUT_DURATION_MS;
                showError("🔒 Too many failed attempts. Locked for 30s");
            }
            return false;
        }
    }
    
    // ============================================================
    // Face ID / Touch ID / Biometric Authentication via WebAuthn
    // ============================================================
    
    async function authenticateWithBiometric() {
        var platform = getPlatformInfo();
        var biometricLabel = platform.biometricName;
        
        // Check if WebAuthn is supported
        if (!window.PublicKeyCredential) {
            if (typeof Modal !== 'undefined' && Modal.alert) {
                Modal.alert(biometricLabel + " is not supported on this device.\n\nPlease use PIN instead.");
            } else {
                alert(biometricLabel + " is not supported on this device.\n\nPlease use PIN instead.");
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
                failedAttempts = 0;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error("Biometric authentication error:", error);
            
            // User cancelled or authentication failed
            if (error.name === "NotAllowedError" || error.name === "AbortError") {
                if (typeof Modal !== 'undefined' && Modal.alert) {
                    Modal.alert(biometricLabel + " was cancelled or timed out.\n\nPlease use PIN instead.");
                }
                return false;
            }
            
            if (typeof Modal !== 'undefined' && Modal.alert) {
                Modal.alert(biometricLabel + " failed: " + error.message + "\n\nPlease use PIN instead.");
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
        
        // Reset state
        currentPin = "";
        failedAttempts = 0;
        isLocked = false;
        lockoutUntil = null;
        
        // Get platform info for dynamic labels
        var platform = getPlatformInfo();
        var biometricLabel = platform.biometricName;
        var subtitleText = "Enter PIN or use " + biometricLabel;
        var ariaLabel = "Use " + biometricLabel;
        
        // Build modal HTML
        var modalHtml = `
            <div class="auth-modal-overlay" id="authModal" role="dialog" aria-label="Authentication">
                <div class="auth-modal" role="document">
                    <div class="auth-modal-header">
                        <div class="auth-modal-icon">🔐</div>
                        <div class="auth-modal-title">AUTHENTICATE</div>
                        <div class="auth-modal-subtitle">${subtitleText}</div>
                    </div>
                    
                    <div class="auth-pin-container">
                        <div class="auth-pin-dots" id="authPinDots" role="group" aria-label="PIN entry">
                            <span class="auth-pin-dot" data-index="0" aria-hidden="true">●</span>
                            <span class="auth-pin-dot" data-index="1" aria-hidden="true">●</span>
                            <span class="auth-pin-dot" data-index="2" aria-hidden="true">●</span>
                            <span class="auth-pin-dot" data-index="3" aria-hidden="true">●</span>
                        </div>
                        <div class="auth-pin-error" id="authPinError" role="alert"></div>
                    </div>
                    
                    <div class="auth-numpad" id="authNumpad" role="group" aria-label="Number pad">
                        <button class="auth-numpad-btn" data-digit="1" aria-label="1">1</button>
                        <button class="auth-numpad-btn" data-digit="2" aria-label="2">2</button>
                        <button class="auth-numpad-btn" data-digit="3" aria-label="3">3</button>
                        <button class="auth-numpad-btn" data-digit="4" aria-label="4">4</button>
                        <button class="auth-numpad-btn" data-digit="5" aria-label="5">5</button>
                        <button class="auth-numpad-btn" data-digit="6" aria-label="6">6</button>
                        <button class="auth-numpad-btn" data-digit="7" aria-label="7">7</button>
                        <button class="auth-numpad-btn" data-digit="8" aria-label="8">8</button>
                        <button class="auth-numpad-btn" data-digit="9" aria-label="9">9</button>
                        <button class="auth-numpad-btn auth-numpad-btn-biometric" id="authFaceIdBtn" aria-label="${ariaLabel}">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c0/Face_ID_logo.svg"
                                 alt="${biometricLabel}"
                                 class="auth-faceid-icon"
                                 style="width:28px; height:28px; display:block; filter: brightness(0) saturate(100%) invert(68%) sepia(43%) saturate(750%) hue-rotate(80deg) brightness(95%) contrast(95%);">
                        </button>
                        <button class="auth-numpad-btn" data-digit="0" aria-label="0">0</button>
                        <button class="auth-numpad-btn auth-numpad-btn-backspace" id="authBackspaceBtn" aria-label="Delete">
                            <span class="auth-numpad-icon">⌫</span>
                        </button>
                    </div>
                    
                    <div class="auth-modal-buttons">
                        <button class="auth-modal-btn auth-modal-btn-cancel" id="authCancelBtn">Cancel</button>
                    </div>
                    
                    <div class="auth-modal-footer">
                        <span class="auth-modal-attempts">${failedAttempts}/${CONFIG.MAX_ATTEMPTS}</span>
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
        
        // Add event listeners
        attachEventListeners();
        
        // Focus the modal for keyboard input
        modal.focus();
        
        // Update attempts counter
        updateAttemptsDisplay();
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
                pinDots[i].classList.add('animated');
            } else {
                pinDots[i].textContent = '○';
                pinDots[i].classList.remove('filled');
                pinDots[i].classList.remove('animated');
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
            // Shake animation
            errorMsg.classList.add('shake');
            setTimeout(function() {
                errorMsg.classList.remove('shake');
            }, 500);
            
            // Shake the entire modal
            var modalElement = document.querySelector('.auth-modal');
            if (modalElement) {
                modalElement.classList.add('shake');
                setTimeout(function() {
                    modalElement.classList.remove('shake');
                }, 500);
            }
        }
    }
    
    function hideError() {
        if (errorMsg) {
            errorMsg.textContent = '';
            errorMsg.style.display = 'none';
            errorMsg.classList.remove('shake');
        }
        var modalElement = document.querySelector('.auth-modal');
        if (modalElement) {
            modalElement.classList.remove('shake');
        }
    }
    
    // ============================================================
    // Update Attempts Display
    // ============================================================
    
    function updateAttemptsDisplay() {
        var attemptsEl = document.querySelector('.auth-modal-attempts');
        if (attemptsEl) {
            attemptsEl.textContent = failedAttempts + '/' + CONFIG.MAX_ATTEMPTS;
            attemptsEl.style.color = failedAttempts >= CONFIG.MAX_ATTEMPTS - 1 ? '#ff6b6b' : '#888';
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
            setTimeout(function() {
                validatePinAndExecute();
            }, 300); // Small delay for visual feedback
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
            // Success animation
            var modalElement = document.querySelector('.auth-modal');
            if (modalElement) {
                modalElement.style.transition = 'transform 0.3s, opacity 0.3s';
                modalElement.style.transform = 'scale(1.05)';
                modalElement.style.opacity = '0';
                setTimeout(function() {
                    removeModal();
                    if (onSuccessCallback) {
                        onSuccessCallback();
                    }
                    resetAuth();
                }, 300);
            } else {
                removeModal();
                if (onSuccessCallback) {
                    onSuccessCallback();
                }
                resetAuth();
            }
        } else {
            // PIN incorrect - show error, clear dots, stay on modal
            showError("❌ Invalid PIN. Attempts: " + failedAttempts + "/" + CONFIG.MAX_ATTEMPTS);
            updateAttemptsDisplay();
            currentPin = "";
            updatePinDots();
            
            // If locked out, disable input temporarily
            if (isLocked) {
                disableNumpad(true);
            }
        }
    }
    
    // ============================================================
    // Disable/Enable Numpad
    // ============================================================
    
    function disableNumpad(disabled) {
        var numpadBtns = document.querySelectorAll('.auth-numpad-btn');
        numpadBtns.forEach(function(btn) {
            btn.disabled = disabled;
            btn.style.opacity = disabled ? '0.5' : '1';
            btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        });
        
        if (disabled) {
            // Re-enable after lockout duration
            setTimeout(function() {
                disableNumpad(false);
                hideError();
                showError("🔓 Lockout expired. Try again.");
                setTimeout(function() {
                    hideError();
                }, 2000);
            }, CONFIG.LOCKOUT_DURATION_MS);
        }
    }
    
    // ============================================================
    // Handle Biometric Button (Face ID / Touch ID)
    // ============================================================
    
    async function handleBiometric() {
        var platform = getPlatformInfo();
        var biometricLabel = platform.biometricName;
        
        hideError();
        var bioBtn = document.getElementById('authFaceIdBtn');
        if (bioBtn) {
            // Show loading state - replace icon with spinner
            bioBtn.innerHTML = '<span style="font-size:1.4rem;">⏳</span>';
            bioBtn.disabled = true;
        }
        
        var success = await authenticateWithBiometric();
        
        if (bioBtn) {
            // Restore the biometric SVG icon
            bioBtn.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/c/c0/Face_ID_logo.svg"
                                     alt="${biometricLabel}"
                                     class="auth-faceid-icon"
                                     style="width:28px; height:28px; display:block; filter: brightness(0) saturate(100%) invert(68%) sepia(43%) saturate(750%) hue-rotate(80deg) brightness(95%) contrast(95%);">`;
            bioBtn.disabled = false;
        }
        
        if (success) {
            // Biometric success - execute the pending action
            var modalElement = document.querySelector('.auth-modal');
            if (modalElement) {
                modalElement.style.transition = 'transform 0.3s, opacity 0.3s';
                modalElement.style.transform = 'scale(1.05)';
                modalElement.style.opacity = '0';
                setTimeout(function() {
                    removeModal();
                    if (onSuccessCallback) {
                        onSuccessCallback();
                    }
                    resetAuth();
                }, 300);
            } else {
                removeModal();
                if (onSuccessCallback) {
                    onSuccessCallback();
                }
                resetAuth();
            }
        } else {
            // Biometric failed - show error, stay on modal
            showError("❌ " + biometricLabel + " failed. Please use PIN.");
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
        
        // Numpad buttons
        var numpadBtns = document.querySelectorAll('.auth-numpad-btn[data-digit]');
        numpadBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (this.disabled) return;
                var digit = this.getAttribute('data-digit');
                handlePinDigit(digit);
            });
        });
        
        // Backspace button
        var backspaceBtn = document.getElementById('authBackspaceBtn');
        if (backspaceBtn) {
            backspaceBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (this.disabled) return;
                handlePinBackspace();
            });
        }
        
        // Biometric button (Face ID / Touch ID)
        if (faceIdBtn) {
            faceIdBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (this.disabled) return;
                handleBiometric();
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
            if (isLocked) return;
            
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
            expiresIn: authTimestamp ? Math.max(0, (authTimestamp + CONFIG.SESSION_TIMEOUT_MS - Date.now()) / 1000) : 0,
            failedAttempts: failedAttempts,
            maxAttempts: CONFIG.MAX_ATTEMPTS,
            isLocked: isLocked
        };
    }
    
    // ============================================================
    // Public API: Change PIN (for future management modal)
    // ============================================================
    
    function setPin(newPin) {
        if (newPin && newPin.length === CONFIG.MAX_PIN_LENGTH && /^\d{4}$/.test(newPin)) {
            CONFIG.PIN = newPin;
            // Also update the global variable for visibility
            AUTH_PIN = newPin;
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
            /* Auth Modal - Enhanced */
            .auth-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.92);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 30000;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                animation: authFadeIn 0.3s ease-out;
            }
            
            .auth-modal {
                background: linear-gradient(145deg, #1e1e1e, #2a2a2a);
                border-radius: 32px;
                padding: 32px 28px;
                max-width: 380px;
                width: 92%;
                text-align: center;
                border: 1px solid rgba(76, 175, 80, 0.3);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(76, 175, 80, 0.1);
                animation: authSlideUp 0.3s ease-out;
                position: relative;
                overflow: hidden;
            }
            
            .auth-modal::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                background: linear-gradient(45deg, transparent, rgba(76, 175, 80, 0.2), transparent);
                border-radius: 34px;
                z-index: -1;
            }
            
            .auth-modal-header {
                margin-bottom: 24px;
            }
            
            .auth-modal-icon {
                font-size: 2.8rem;
                margin-bottom: 8px;
                display: block;
                animation: authPulse 2s ease-in-out infinite;
            }
            
            .auth-modal-title {
                font-size: 1.2rem;
                font-weight: 700;
                color: #4caf50;
                letter-spacing: 2px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            
            .auth-modal-subtitle {
                font-size: 0.75rem;
                color: #888;
                letter-spacing: 1px;
            }
            
            /* PIN Dots */
            .auth-pin-container {
                margin: 24px 0 20px 0;
            }
            
            .auth-pin-dots {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 14px;
                font-size: 2rem;
                font-weight: 700;
                font-family: monospace;
                letter-spacing: 4px;
                user-select: none;
                padding: 8px 0;
            }
            
            .auth-pin-dot {
                display: inline-block;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(10, 10, 10, 0.6);
                border: 2px solid #333;
                color: #4caf50;
                text-align: center;
                line-height: 36px;
                font-size: 1.4rem;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
            }
            
            .auth-pin-dot.filled {
                border-color: #4caf50;
                background: rgba(76, 175, 80, 0.15);
                box-shadow: 0 0 20px rgba(76, 175, 80, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.4);
                transform: scale(1.05);
            }
            
            .auth-pin-dot.animated {
                animation: authDotPop 0.2s ease-out;
            }
            
            .auth-pin-error {
                margin-top: 12px;
                font-size: 0.8rem;
                color: #ff6b6b;
                min-height: 24px;
                display: none;
                font-weight: 500;
                letter-spacing: 0.3px;
            }
            
            /* Number Pad */
            .auth-numpad {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin: 12px auto 16px auto;
                max-width: 280px;
                width: 100%;
            }
            
            .auth-numpad-btn {
                padding: 16px;
                border-radius: 16px;
                background: rgba(20, 20, 20, 0.8);
                border: 1px solid #333;
                color: #fff;
                font-size: 1.4rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
                min-height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .auth-numpad-btn:active:not(:disabled) {
                transform: scale(0.92);
                background: rgba(76, 175, 80, 0.2);
                border-color: #4caf50;
            }
            
            .auth-numpad-btn:hover:not(:disabled) {
                border-color: #4caf50;
                background: rgba(76, 175, 80, 0.05);
            }
            
            .auth-numpad-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Biometric Button - Square box matching handover spec */
            .auth-numpad-btn-biometric {
                background: #0a0a0a;
                border: 2px solid #4caf50;
                border-radius: 8px;
                font-size: 1.6rem;
                min-height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
            }
            
            .auth-numpad-btn-biometric:active:not(:disabled) {
                transform: scale(0.95);
                background: #1a3a1a;
                border-color: #4caf50;
            }
            
            .auth-numpad-btn-biometric:hover:not(:disabled) {
                background: #1a3a1a;
                border-color: #4caf50;
            }
            
            .auth-faceid-icon {
                width: 28px;
                height: 28px;
                display: block;
                filter: brightness(0) saturate(100%) invert(68%) sepia(43%) saturate(750%) hue-rotate(80deg) brightness(95%) contrast(95%);
            }
            
            .auth-numpad-btn-backspace {
                background: rgba(255, 107, 107, 0.05);
                border-color: #444;
                color: #ff6b6b;
                font-size: 1.4rem;
            }
            
            .auth-numpad-btn-backspace:active:not(:disabled) {
                background: rgba(255, 107, 107, 0.15);
                border-color: #ff6b6b;
            }
            
            .auth-numpad-icon {
                font-size: 1.6rem;
                line-height: 1;
            }
            
            /* Buttons */
            .auth-modal-buttons {
                display: flex;
                justify-content: center;
                margin-top: 8px;
            }
            
            .auth-modal-btn {
                padding: 12px 40px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 0.85rem;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;
                min-width: 120px;
                letter-spacing: 1px;
                text-transform: uppercase;
            }
            
            .auth-modal-btn:active {
                transform: scale(0.96);
            }
            
            .auth-modal-btn-cancel {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid #333;
                color: #888;
            }
            
            .auth-modal-btn-cancel:hover {
                border-color: #4caf50;
                color: #aaa;
                background: rgba(76, 175, 80, 0.05);
            }
            
            .auth-modal-footer {
                margin-top: 12px;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 12px;
            }
            
            .auth-modal-attempts {
                font-size: 0.7rem;
                color: #888;
                letter-spacing: 0.5px;
            }
            
            /* Animations */
            @keyframes authFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes authSlideUp {
                from { 
                    opacity: 0; 
                    transform: translateY(20px) scale(0.96);
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes authPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            
            @keyframes authDotPop {
                0% { transform: scale(0.6); opacity: 0.5; }
                50% { transform: scale(1.15); }
                100% { transform: scale(1.05); opacity: 1; }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
                20%, 40%, 60%, 80% { transform: translateX(8px); }
            }
            
            .shake {
                animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                .auth-modal {
                    padding: 24px 20px;
                    max-width: 340px;
                }
                
                .auth-pin-dot {
                    width: 36px;
                    height: 36px;
                    line-height: 32px;
                    font-size: 1.2rem;
                }
                
                .auth-numpad-btn {
                    padding: 14px;
                    min-height: 48px;
                    font-size: 1.2rem;
                }
                
                .auth-modal-title {
                    font-size: 1rem;
                }
            }
            
            @media (max-width: 380px) {
                .auth-modal {
                    padding: 20px 16px;
                    max-width: 300px;
                }
                
                .auth-pin-dot {
                    width: 32px;
                    height: 32px;
                    line-height: 28px;
                    font-size: 1rem;
                    gap: 10px;
                }
                
                .auth-numpad-btn {
                    padding: 12px;
                    min-height: 42px;
                    font-size: 1rem;
                }
            }
            
            @media (min-width: 768px) {
                .auth-numpad-btn {
                    min-height: 64px;
                }
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
        CONFIG: CONFIG,
        getPlatformInfo: getPlatformInfo  // Exposed for debugging
    };
    
})();

// Make available globally
window.AuthPin = AuthPin;

/*
FILE: js/auth-pin.js
VERSION: 2.02
KEY CHANGES from v2.01:
   - ADDED: Platform detection (macOS vs iOS vs other)
   - UPDATED: Dynamic labels - "Face ID" on iPhone, "Touch ID" on Mac
   - UPDATED: Subtitle text changes based on platform
   - UPDATED: Button aria-label changes based on platform
   - FIXED: Error messages now reference correct biometric name
   - ALL OTHER FUNCTIONS unchanged from v2.01
DEPENDS ON: None (pure DOM manipulation, uses Modal.js for alerts)
STATUS: Ready for integration
*/