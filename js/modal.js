/*
FILE: js/modal.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: confirmGameComplete() method for GAME COMPLETE modal
   - Consistent styling with green border, gold title, emojis
   - Single "SEE RESULTS" button with green theme
   - All existing functionality preserved from v1.01
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/

var Modal = (function() {
    
    // ============================================================
    // Helper: Remove any existing modal
    // ============================================================
    
    function removeExistingModal() {
        var existingModal = document.getElementById('sharedModal');
        if (existingModal) {
            existingModal.remove();
        }
    }
    
    // ============================================================
    // Helper: Create modal overlay with content
    // ============================================================
    
    function createModalOverlay(contentHtml) {
        var overlay = document.createElement('div');
        overlay.id = 'sharedModal';
        overlay.className = 'shared-modal-overlay';
        overlay.style.cssText = `
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
        `;
        overlay.innerHTML = contentHtml;
        return overlay;
    }
    
    // ============================================================
    // Helper: Add global styles if not present
    // ============================================================
    
    function ensureStyles() {
        if (document.getElementById('shared-modal-styles')) return;
        
        var styles = document.createElement('style');
        styles.id = 'shared-modal-styles';
        styles.textContent = `
            .shared-modal-container {
                background: #1a1a1a;
                border-radius: 28px;
                padding: 28px;
                max-width: 360px;
                width: 90%;
                text-align: center;
                border: 2px solid #4caf50;
                animation: sharedModalFadeIn 0.2s ease-out;
            }
            .shared-modal-title {
                font-size: 1.1rem;
                font-weight: 600;
                color: #888;
                margin-bottom: 16px;
            }
            .shared-modal-message {
                font-size: 0.85rem;
                color: #ccc;
                margin-bottom: 24px;
                line-height: 1.4;
            }
            .shared-modal-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            .shared-modal-buttons-3 {
                display: flex;
                gap: 8px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .shared-modal-btn {
                flex: 1;
                padding: 12px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;
                min-width: 100px;
            }
            .shared-modal-btn:active {
                transform: scale(0.98);
            }
            .shared-modal-btn-cancel {
                background: #1a1a1a;
                border: 1px solid #333;
                color: #888;
            }
            .shared-modal-btn-confirm {
                background: #1a3a1a;
                border: 1px solid #4caf50;
                color: #4caf50;
            }
            .shared-modal-btn-discard {
                background: #3a1a1a;
                border: 1px solid #ff6b6b;
                color: #ff6b6b;
            }
            .shared-modal-btn-save {
                background: #1a3a1a;
                border: 1px solid #ffaa44;
                color: #ffaa44;
            }
            .shared-modal-btn-single {
                background: #1a3a1a;
                border: 1px solid #4caf50;
                color: #4caf50;
                width: 100%;
            }
            @keyframes sharedModalFadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // ============================================================
    // Helper: Escape HTML to prevent injection
    // ============================================================
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    // ============================================================
    // Confirm Modal (Yes/No) - Standard two buttons
    // ============================================================
    
    function confirm(message, onConfirm, onCancel) {
        ensureStyles();
        removeExistingModal();
        
        var modalHtml = `
            <div class="shared-modal-container">
                <div class="shared-modal-title">CONFIRM</div>
                <div class="shared-modal-message">${escapeHtml(message)}</div>
                <div class="shared-modal-buttons">
                    <button class="shared-modal-btn shared-modal-btn-cancel" id="sharedModalCancelBtn">Cancel</button>
                    <button class="shared-modal-btn shared-modal-btn-confirm" id="sharedModalConfirmBtn">OK</button>
                </div>
            </div>
        `;
        
        var overlay = createModalOverlay(modalHtml);
        document.body.appendChild(overlay);
        
        document.getElementById('sharedModalCancelBtn').onclick = function() {
            removeExistingModal();
            if (onCancel && typeof onCancel === 'function') {
                onCancel();
            }
        };
        
        document.getElementById('sharedModalConfirmBtn').onclick = function() {
            removeExistingModal();
            if (onConfirm && typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    }
    
    // ============================================================
    // Alert Modal (Single button)
    // ============================================================
    
    function alert(message, onClose) {
        ensureStyles();
        removeExistingModal();
        
        var modalHtml = `
            <div class="shared-modal-container">
                <div class="shared-modal-title">NOTICE</div>
                <div class="shared-modal-message">${escapeHtml(message)}</div>
                <button class="shared-modal-btn shared-modal-btn-single" id="sharedModalCloseBtn">OK</button>
            </div>
        `;
        
        var overlay = createModalOverlay(modalHtml);
        document.body.appendChild(overlay);
        
        document.getElementById('sharedModalCloseBtn').onclick = function() {
            removeExistingModal();
            if (onClose && typeof onClose === 'function') {
                onClose();
            }
        };
    }
    
    // ============================================================
    // v1.01: Confirm with Custom Buttons
    // ============================================================
    
    function confirmWithCustomButtons(message, onConfirm, onCancel, confirmText, cancelText) {
        ensureStyles();
        removeExistingModal();
        
        var confirmBtnText = confirmText || "OK";
        var cancelBtnText = cancelText || "Cancel";
        
        var isDiscardButton = (cancelBtnText.toUpperCase() === "DISCARD");
        var isUpdateSaveButton = (confirmBtnText.toUpperCase() === "UPDATE & SAVE" || confirmBtnText === "UPDATE & SAVE");
        
        var confirmBtnClass = isUpdateSaveButton ? "shared-modal-btn-save" : "shared-modal-btn-confirm";
        var cancelBtnClass = isDiscardButton ? "shared-modal-btn-discard" : "shared-modal-btn-cancel";
        
        var modalHtml = `
            <div class="shared-modal-container">
                <div class="shared-modal-title">UNSAVED CHANGES</div>
                <div class="shared-modal-message">${escapeHtml(message)}</div>
                <div class="shared-modal-buttons">
                    <button class="shared-modal-btn ${cancelBtnClass}" id="sharedModalCancelBtn">${escapeHtml(cancelBtnText)}</button>
                    <button class="shared-modal-btn ${confirmBtnClass}" id="sharedModalConfirmBtn">${escapeHtml(confirmBtnText)}</button>
                </div>
            </div>
        `;
        
        var overlay = createModalOverlay(modalHtml);
        document.body.appendChild(overlay);
        
        document.getElementById('sharedModalCancelBtn').onclick = function() {
            removeExistingModal();
            if (onCancel && typeof onCancel === 'function') {
                onCancel();
            }
        };
        
        document.getElementById('sharedModalConfirmBtn').onclick = function() {
            removeExistingModal();
            if (onConfirm && typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    }
    
    // ============================================================
    // v1.01: Confirm with Three Buttons
    // ============================================================
    
    function confirmWithThreeButtons(message, onConfirm, onDiscard, onCancel, confirmText, discardText) {
        ensureStyles();
        removeExistingModal();
        
        var confirmBtnText = confirmText || "UPDATE & SAVE";
        var discardBtnText = discardText || "DISCARD";
        
        var modalHtml = `
            <div class="shared-modal-container">
                <div class="shared-modal-title">UNSAVED CHANGES</div>
                <div class="shared-modal-message">${escapeHtml(message)}</div>
                <div class="shared-modal-buttons-3">
                    <button class="shared-modal-btn shared-modal-btn-cancel" id="sharedModalCancelBtn">Cancel</button>
                    <button class="shared-modal-btn shared-modal-btn-discard" id="sharedModalDiscardBtn">${escapeHtml(discardBtnText)}</button>
                    <button class="shared-modal-btn shared-modal-btn-save" id="sharedModalConfirmBtn">${escapeHtml(confirmBtnText)}</button>
                </div>
            </div>
        `;
        
        var overlay = createModalOverlay(modalHtml);
        document.body.appendChild(overlay);
        
        document.getElementById('sharedModalCancelBtn').onclick = function() {
            removeExistingModal();
            if (onCancel && typeof onCancel === 'function') {
                onCancel();
            }
        };
        
        document.getElementById('sharedModalDiscardBtn').onclick = function() {
            removeExistingModal();
            if (onDiscard && typeof onDiscard === 'function') {
                onDiscard();
            }
        };
        
        document.getElementById('sharedModalConfirmBtn').onclick = function() {
            removeExistingModal();
            if (onConfirm && typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    }
    
    // ============================================================
    // v1.02: GAME COMPLETE Modal (Single button, gold title, green border)
    // ============================================================
    
    function confirmGameComplete(onConfirm) {
        ensureStyles();
        removeExistingModal();
        
        var modalHtml = `
            <div class="shared-modal-container" style="padding: 32px 28px;">
                <div style="font-size: 1.5rem; font-weight: 700; color: #ffaa44; margin-bottom: 12px; text-align: center;">🏆 GAME COMPLETE</div>
                <div style="font-size: 0.9rem; color: #ccc; text-align: center; margin-bottom: 16px;">Both cards have been signed!</div>
                <div style="font-size: 1.5rem; text-align: center; margin-bottom: 24px;">🍺 🏆 🍺</div>
                <button class="shared-modal-btn shared-modal-btn-confirm" id="sharedModalConfirmBtn" style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700;">🏆 SEE RESULTS</button>
            </div>
        `;
        
        var overlay = createModalOverlay(modalHtml);
        document.body.appendChild(overlay);
        
        document.getElementById('sharedModalConfirmBtn').onclick = function() {
            removeExistingModal();
            if (onConfirm && typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    }
    
    // ============================================================
    // Public API
    // ============================================================
    
    return {
        confirm: confirm,
        alert: alert,
        confirmWithCustomButtons: confirmWithCustomButtons,
        confirmWithThreeButtons: confirmWithThreeButtons,
        confirmGameComplete: confirmGameComplete
    };
    
})();

// Make available globally
window.Modal = Modal;

/*
FILE: js/modal.js
VERSION: 1.02
KEY CHANGES from v1.01:
   - ADDED: confirmGameComplete() method for GAME COMPLETE modal
   - Consistent styling with green border, gold title, emojis
   - Single "SEE RESULTS" button with green theme
   - All existing functionality preserved from v1.01
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/