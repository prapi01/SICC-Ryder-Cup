/*
FILE: js/auth-pin.js
VERSION: 2.04
KEY CHANGES from v2.03:
   - REDESIGNED: Complete UI overhaul - sleek, compact, elegant
   - RESIZED: Modal is 1/2 the previous size (max-width: 280px)
   - RESIZED: PIN dots smaller (28×32px) with 6px border-radius
   - RESIZED: Number pad buttons smaller (36px min-height, 10px border-radius)
   - BORDER: Normal visible border (2px solid #2a5a2a) not faint
   - REMOVED: All glass-morphism effects for cleaner look
   - REMOVED: Padding reduced significantly
   - SIMPLIFIED: Clean dark theme with green accent
   - PRESERVED: All functionality from v2.03 unchanged
DEPENDS ON: None (pure DOM manipulation)
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
                showError("🔒 Locked " + remaining + "s");
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
                showError("🔒 Locked 30s");
            }
            return false;
        }
    }
    
    // ============================================================
    // Show PIN Modal - v2.04 Sleek Compact Design
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
        
        // Build modal HTML - Sleek Compact Design
        var modalHtml = `
            <div class="auth-modal-overlay" id="authModal" role="dialog" aria-label="Authentication">
                <div class="auth-modal" role="document">
                    <div class="auth-modal-icon">🔐</div>
                    <div class="auth-modal-title">Enter PIN</div>
                    
                    <div class="auth-pin-container">
                        <div class="auth-pin-dots" id="authPinDots" role="group" aria-label="PIN entry">
                            <span class="auth-pin-dot" data-index="0"></span>
                            <span class="auth-pin-dot" data-index="1"></span>
                            <span class="auth-pin-dot" data-index="2"></span>
                            <span class="auth-pin-dot" data-index="3"></span>
                        </div>
                        <div class="auth-pin-error" id="authPinError" role="alert"></div>
                    </div>
                    
                    <div class="auth-numpad" id="authNumpad" role="group" aria-label="Number pad">
                        <button class="auth-numpad-btn" data-digit="1">1</button>
                        <button class="auth-numpad-btn" data-digit="2">2</button>
                        <button class="auth-numpad-btn" data-digit="3">3</button>
                        <button class="auth-numpad-btn" data-digit="4">4</button>
                        <button class="auth-numpad-btn" data-digit="5">5</button>
                        <button class="auth-numpad-btn" data-digit="6">6</button>
                        <button class="auth-numpad-btn" data-digit="7">7</button>
                        <button class="auth-numpad-btn" data-digit="8">8</button>
                        <button class="auth-numpad-btn" data-digit="9">9</button>
                        <button class="auth-numpad-btn" data-digit="0">0</button>
                        <button class="auth-numpad-btn auth-numpad-btn-backspace" id="authBackspaceBtn">⌫</button>
                    </div>
                    
                    <button class="auth-modal-btn-cancel" id="authCancelBtn">Cancel</button>
                    
                    <div class="auth-modal-footer">
                        <span class="auth-modal-attempts">${failedAttempts}/${CONFIG.MAX_ATTEMPTS}</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        modal = document.getElementById('authModal');
        pinDots = document.querySelectorAll('.auth-pin-dot');
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
                pinDots[i].textContent = '';
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
            errorMsg.classList.add('shake');
            setTimeout(function() {
                errorMsg.classList.remove('shake');
            }, 500);
            
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
            attemptsEl.style.color = failedAttempts >= CONFIG.MAX_ATTEMPTS - 1 ? '#ff6b6b' : '#444';
        }
    }
    
    // ============================================================
    // Handle PIN Entry
    // ============================================================
    
    function handlePinDigit(digit) {
        if (currentPin.length >= CONFIG.MAX_PIN_LENGTH) return;
        hideError();
        currentPin += digit;
        updatePinDots();
        
        if (currentPin.length === CONFIG.MAX_PIN_LENGTH) {
            setTimeout(function() {
                validatePinAndExecute();
            }, 300);
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
            hideError();
            var modalElement = document.querySelector('.auth-modal');
            if (modalElement) {
                modalElement.style.transition = 'transform 0.25s, opacity 0.25s';
                modalElement.style.transform = 'scale(0.95)';
                modalElement.style.opacity = '0';
                setTimeout(function() {
                    removeModal();
                    if (onSuccessCallback) {
                        onSuccessCallback();
                    }
                    resetAuth();
                }, 250);
            } else {
                removeModal();
                if (onSuccessCallback) {
                    onSuccessCallback();
                }
                resetAuth();
            }
        } else {
            showError("Invalid PIN");
            updateAttemptsDisplay();
            currentPin = "";
            updatePinDots();
            
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
            btn.style.opacity = disabled ? '0.4' : '1';
            btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        });
        
        if (disabled) {
            setTimeout(function() {
                disableNumpad(false);
                hideError();
                showError("🔓 Try again");
                setTimeout(function() {
                    hideError();
                }, 1500);
            }, CONFIG.LOCKOUT_DURATION_MS);
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
        
        var numpadBtns = document.querySelectorAll('.auth-numpad-btn[data-digit]');
        numpadBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (this.disabled) return;
                var digit = this.getAttribute('data-digit');
                handlePinDigit(digit);
            });
        });
        
        var backspaceBtn = document.getElementById('authBackspaceBtn');
        if (backspaceBtn) {
            backspaceBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (this.disabled) return;
                handlePinBackspace();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleCancel();
            });
        }
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                handleCancel();
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (!modal) return;
            if (isLocked) return;
            
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                handlePinDigit(e.key);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                handlePinBackspace();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentPin.length === CONFIG.MAX_PIN_LENGTH) {
                    validatePinAndExecute();
                }
            }
        });
    }
    
    // ============================================================
    // Public API
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
        
        if (isAuthenticated()) {
            onSuccess();
            return;
        }
        
        showAuthModal(action, gameId, gameDate, onSuccess);
    }
    
    function logout() {
        resetAuth();
        removeModal();
    }
    
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
    
    function setPin(newPin) {
        if (newPin && newPin.length === CONFIG.MAX_PIN_LENGTH && /^\d{4}$/.test(newPin)) {
            CONFIG.PIN = newPin;
            AUTH_PIN = newPin;
            return true;
        }
        return false;
    }
    
    function getPin() {
        return CONFIG.PIN;
    }
    
    // ============================================================
    // Inject Styles - v2.04 Sleek Compact Design
    // ============================================================
    
    function injectStyles() {
        if (document.getElementById('auth-pin-styles')) return;
        
        var styles = document.createElement('style');
        styles.id = 'auth-pin-styles';
        styles.textContent = `
            /* Auth Modal - Overlay */
            .auth-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 30000;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                animation: authFadeIn 0.25s ease-out;
            }
            
            /* Auth Modal - Card */
            .auth-modal {
                background: #0a0a0a;
                border-radius: 20px;
                padding: 20px 20px 16px 20px;
                max-width: 280px;
                width: 92%;
                text-align: center;
                border: 2px solid #2a5a2a;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
                animation: authSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            /* Icon */
            .auth-modal-icon {
                font-size: 2rem;
                display: block;
                margin-bottom: 2px;
            }
            
            /* Title */
            .auth-modal-title {
                font-size: 0.8rem;
                font-weight: 500;
                color: #4caf50;
                letter-spacing: 2px;
                text-transform: uppercase;
                margin-bottom: 12px;
            }
            
            /* PIN Container */
            .auth-pin-container {
                margin: 0 0 8px 0;
            }
            
            /* PIN Dots - Square */
            .auth-pin-dots {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                user-select: none;
                padding: 4px 0;
            }
            
            .auth-pin-dot {
                display: inline-block;
                width: 28px;
                height: 32px;
                border-radius: 6px;
                background: #0a0a0a;
                border: 2px solid #2a2a2a;
                color: #4caf50;
                text-align: center;
                line-height: 28px;
                font-size: 1rem;
                font-weight: 600;
                font-family: monospace;
                transition: all 0.25s ease;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
            }
            
            .auth-pin-dot.filled {
                border-color: #4caf50;
                background: rgba(26, 58, 26, 0.6);
                box-shadow: 0 0 12px rgba(76, 175, 80, 0.08), inset 0 1px 3px rgba(0, 0, 0, 0.3);
            }
            
            .auth-pin-dot.animated {
                animation: authDotPop 0.2s ease-out;
            }
            
            /* Error */
            .auth-pin-error {
                font-size: 0.6rem;
                color: #ff6b6b;
                min-height: 16px;
                margin-top: 2px;
                display: none;
                font-weight: 400;
                letter-spacing: 0.3px;
            }
            
            /* Number Pad */
            .auth-numpad {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 6px;
                margin: 4px auto 10px auto;
                max-width: 200px;
                width: 100%;
            }
            
            .auth-numpad-btn {
                padding: 8px;
                border-radius: 10px;
                background: rgba(20, 20, 20, 0.6);
                border: 1px solid #2a2a2a;
                color: #e0e0e0;
                font-size: 1.1rem;
                font-weight: 400;
                cursor: pointer;
                transition: all 0.15s ease;
                user-select: none;
                min-height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                -webkit-tap-highlight-color: transparent;
            }
            
            .auth-numpad-btn:active:not(:disabled) {
                transform: scale(0.92);
                background: rgba(76, 175, 80, 0.12);
                border-color: #4caf50;
            }
            
            .auth-numpad-btn:hover:not(:disabled) {
                border-color: #4caf50;
                background: rgba(76, 175, 80, 0.05);
            }
            
            .auth-numpad-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .auth-numpad-btn-backspace {
                color: #666;
                font-size: 1rem;
            }
            
            .auth-numpad-btn-backspace:active:not(:disabled) {
                background: rgba(255, 107, 107, 0.1);
                border-color: #ff6b6b;
                color: #ff6b6b;
            }
            
            .auth-numpad-btn-backspace:hover:not(:disabled) {
                border-color: #ff6b6b;
                color: #ff6b6b;
            }
            
            /* Cancel Button */
            .auth-modal-btn-cancel {
                padding: 6px 0;
                border-radius: 16px;
                font-weight: 400;
                font-size: 0.7rem;
                cursor: pointer;
                transition: all 0.2s ease;
                background: transparent;
                border: none;
                color: #444;
                display: block;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin: 0 auto;
                width: 100%;
                max-width: 120px;
            }
            
            .auth-modal-btn-cancel:hover {
                color: #666;
            }
            
            /* Footer */
            .auth-modal-footer {
                margin-top: 6px;
                display: flex;
                justify-content: center;
            }
            
            .auth-modal-attempts {
                font-size: 0.5rem;
                color: #333;
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
                    transform: translateY(12px) scale(0.97);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes authDotPop {
                0% { transform: scale(0.7); opacity: 0.5; }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); opacity: 1; }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                20%, 40%, 60%, 80% { transform: translateX(4px); }
            }
            
            .shake {
                animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
            }
            
            /* Responsive */
            @media (max-width: 380px) {
                .auth-modal {
                    padding: 16px 16px 12px 16px;
                    max-width: 240px;
                }
                
                .auth-pin-dot {
                    width: 24px;
                    height: 28px;
                    line-height: 24px;
                    font-size: 0.85rem;
                }
                
                .auth-numpad {
                    max-width: 170px;
                    gap: 5px;
                }
                
                .auth-numpad-btn {
                    min-height: 32px;
                    font-size: 1rem;
                    padding: 6px;
                }
                
                .auth-modal-title {
                    font-size: 0.7rem;
                }
            }
            
            @media (min-width: 768px) {
                .auth-modal {
                    max-width: 300px;
                    padding: 24px 24px 18px 24px;
                }
                
                .auth-pin-dot {
                    width: 32px;
                    height: 36px;
                    line-height: 32px;
                    font-size: 1.1rem;
                }
                
                .auth-numpad {
                    max-width: 220px;
                }
                
                .auth-numpad-btn {
                    min-height: 40px;
                    font-size: 1.2rem;
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
        CONFIG: CONFIG
    };
    
})();

// Make available globally
window.AuthPin = AuthPin;

/*
FILE: js/auth-pin.js
VERSION: 2.04
KEY CHANGES from v2.03:
   - REDESIGNED: Complete UI overhaul - sleek, compact, elegant
   - RESIZED: Modal is 1/2 the previous size (max-width: 280px)
   - RESIZED: PIN dots smaller (28×32px) with 6px border-radius
   - RESIZED: Number pad buttons smaller (36px min-height, 10px border-radius)
   - BORDER: Normal visible border (2px solid #2a5a2a) not faint
   - REMOVED: All glass-morphism effects for cleaner look
   - REMOVED: Padding reduced significantly
   - SIMPLIFIED: Clean dark theme with green accent
   - PRESERVED: All functionality from v2.03 unchanged
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/