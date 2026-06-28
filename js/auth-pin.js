/*
FILE: js/auth-pin.js
VERSION: 2.07
KEY CHANGES from v2.06:
   - FIXED: "2" now aligned with "1" and "3" (left edge)
   - FIXED: "9" now aligned with "0" and "8" (right edge)
   - CHANGED: Middle row uses justify-content: space-between for proper alignment
   - PRESERVED: All functionality unchanged
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
        MAX_ATTEMPTS: 5,
        LOCKOUT_DURATION_MS: 30 * 1000
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
        if (isLocked) {
            var remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            if (remaining > 0) {
                showError("🔒 Locked " + remaining + "s");
                return false;
            } else {
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
    // Show PIN Modal - v2.07 Fixed Edge Alignment
    // ============================================================
    
    function showAuthModal(action, gameId, gameDate, onSuccess) {
        if (isAuthenticated()) {
            if (onSuccess) onSuccess();
            return;
        }
        
        pendingAction = action;
        pendingGameId = gameId;
        pendingGameDate = gameDate;
        onSuccessCallback = onSuccess;
        
        removeModal();
        
        currentPin = "";
        failedAttempts = 0;
        isLocked = false;
        lockoutUntil = null;
        
        var modalHtml = `
            <div class="auth-modal-overlay" id="authModal" role="dialog" aria-label="Authentication">
                <div class="auth-modal" role="document">
                    <!-- Row 1: [1] [●] [●] [●] [●] [0] -->
                    <div class="auth-row auth-row-top">
                        <button class="auth-btn" data-digit="1">1</button>
                        <div class="auth-pin-dots" id="authPinDots">
                            <span class="auth-pin-dot" data-index="0"></span>
                            <span class="auth-pin-dot" data-index="1"></span>
                            <span class="auth-pin-dot" data-index="2"></span>
                            <span class="auth-pin-dot" data-index="3"></span>
                        </div>
                        <button class="auth-btn" data-digit="0">0</button>
                    </div>
                    
                    <!-- Row 2: [2] [⌫] [9] - aligned left/right -->
                    <div class="auth-row auth-row-middle">
                        <button class="auth-btn" data-digit="2">2</button>
                        <button class="auth-btn auth-btn-backspace" id="authBackspaceBtn">⌫</button>
                        <button class="auth-btn" data-digit="9">9</button>
                    </div>
                    
                    <!-- Row 3: [3] [4] [5] [6] [7] [8] -->
                    <div class="auth-row auth-row-bottom">
                        <button class="auth-btn" data-digit="3">3</button>
                        <button class="auth-btn" data-digit="4">4</button>
                        <button class="auth-btn" data-digit="5">5</button>
                        <button class="auth-btn" data-digit="6">6</button>
                        <button class="auth-btn" data-digit="7">7</button>
                        <button class="auth-btn" data-digit="8">8</button>
                    </div>
                    
                    <div class="auth-pin-error" id="authPinError" role="alert"></div>
                    
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
        
        attachEventListeners();
        modal.focus();
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
        var numpadBtns = document.querySelectorAll('.auth-btn');
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
        
        var numpadBtns = document.querySelectorAll('.auth-btn[data-digit]');
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
    // Inject Styles - v2.07 Fixed Edge Alignment
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
                padding: 20px 12px 16px 12px;
                max-width: 360px;
                width: 92%;
                text-align: center;
                border: 2px solid #2a5a2a;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
                animation: authSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            /* Rows */
            .auth-row {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .auth-row-top {
                justify-content: center;
                margin-bottom: 8px;
            }
            
            .auth-row-middle {
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 0 0;
            }
            
            .auth-row-bottom {
                justify-content: center;
                gap: 6px;
            }
            
            /* PIN Dots Container */
            .auth-pin-dots {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                flex: 2;
            }
            
            /* PIN Dot */
            .auth-pin-dot {
                display: inline-block;
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: #0a0a0a;
                border: 2px solid #2a2a2a;
                color: #4caf50;
                text-align: center;
                line-height: 40px;
                font-size: 1.2rem;
                font-weight: 600;
                font-family: monospace;
                transition: all 0.25s ease;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
                flex-shrink: 0;
            }
            
            .auth-pin-dot.filled {
                border-color: #4caf50;
                background: rgba(26, 58, 26, 0.6);
                box-shadow: 0 0 12px rgba(76, 175, 80, 0.08), inset 0 1px 3px rgba(0, 0, 0, 0.3);
            }
            
            .auth-pin-dot.animated {
                animation: authDotPop 0.2s ease-out;
            }
            
            /* Number Buttons */
            .auth-btn {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: rgba(20, 20, 20, 0.6);
                border: 1px solid #2a2a2a;
                color: #e0e0e0;
                font-size: 1.2rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                flex-shrink: 0;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                font-family: inherit;
            }
            
            .auth-btn:active:not(:disabled) {
                transform: scale(0.92);
                background: rgba(76, 175, 80, 0.12);
                border-color: #4caf50;
            }
            
            .auth-btn:hover:not(:disabled) {
                border-color: #4caf50;
                background: rgba(76, 175, 80, 0.05);
            }
            
            .auth-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            /* Backspace Button - Double width */
            .auth-btn-backspace {
                flex: 0 0 94px;
                width: 94px;
                height: 44px;
                border-radius: 12px;
                background: rgba(20, 20, 20, 0.6);
                border: 1px solid #2a2a2a;
                color: #666;
                font-size: 1.1rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                font-family: inherit;
            }
            
            .auth-btn-backspace:active:not(:disabled) {
                background: rgba(255, 107, 107, 0.1);
                border-color: #ff6b6b;
                color: #ff6b6b;
                transform: scale(0.92);
            }
            
            .auth-btn-backspace:hover:not(:disabled) {
                border-color: #ff6b6b;
                color: #ff6b6b;
            }
            
            .auth-btn-backspace:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            /* Error */
            .auth-pin-error {
                font-size: 0.6rem;
                color: #ff6b6b;
                min-height: 18px;
                margin-top: 6px;
                display: none;
                font-weight: 400;
                letter-spacing: 0.3px;
            }
            
            /* Cancel Button */
            .auth-modal-btn-cancel {
                padding: 8px 0;
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
                margin: 8px auto 0 auto;
                width: 100%;
                max-width: 120px;
                font-family: inherit;
            }
            
            .auth-modal-btn-cancel:hover {
                color: #666;
            }
            
            /* Footer */
            .auth-modal-footer {
                margin-top: 4px;
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
                    padding: 16px 8px 12px 8px;
                    max-width: 300px;
                }
                
                .auth-pin-dot,
                .auth-btn {
                    width: 36px;
                    height: 36px;
                    font-size: 1rem;
                    border-radius: 10px;
                }
                
                .auth-pin-dot {
                    line-height: 32px;
                }
                
                .auth-btn-backspace {
                    flex: 0 0 78px;
                    width: 78px;
                    height: 36px;
                    font-size: 0.9rem;
                }
                
                .auth-row {
                    gap: 4px;
                }
                
                .auth-pin-dots {
                    gap: 4px;
                }
            }
            
            @media (min-width: 768px) {
                .auth-modal {
                    max-width: 380px;
                    padding: 24px 16px 18px 16px;
                }
                
                .auth-pin-dot,
                .auth-btn {
                    width: 48px;
                    height: 48px;
                    font-size: 1.3rem;
                    border-radius: 14px;
                }
                
                .auth-pin-dot {
                    line-height: 44px;
                }
                
                .auth-btn-backspace {
                    flex: 0 0 102px;
                    width: 102px;
                    height: 48px;
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
VERSION: 2.07
KEY CHANGES from v2.06:
   - FIXED: "2" now aligned with "1" and "3" (left edge)
   - FIXED: "9" now aligned with "0" and "8" (right edge)
   - CHANGED: Middle row uses justify-content: space-between for proper alignment
   - PRESERVED: All functionality unchanged
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/