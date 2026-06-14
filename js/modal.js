/*
FILE: js/modal.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared modal module for consistent UI across all pages
   - Modal.confirm() - Yes/No confirmation with green border
   - Modal.alert() - Information alert with single button
   - Green border (#4caf50), grey title (#888)
   - Supports custom messages and callback functions
   - Auto-removes previous modals before showing new one
   - Respects safe-area-inset for iOS devices
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
                max-width: 340px;
                width: 90%;
                text-align: center;
                border: 2px solid #4caf50;
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
            .shared-modal-btn {
                flex: 1;
                padding: 12px;
                border-radius: 40px;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;
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
            .shared-modal-container {
                animation: sharedModalFadeIn 0.2s ease-out;
            }
        `;
        document.head.appendChild(styles);
    }
    
    // ============================================================
    // Confirm Modal (Yes/No)
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
    // Public API
    // ============================================================
    
    return {
        confirm: confirm,
        alert: alert
    };
    
})();

// Make available globally
window.Modal = Modal;

/*
FILE: js/modal.js
VERSION: 1.00
KEY CHANGES:
   - NEW: Shared modal module for consistent UI across all pages
   - Modal.confirm() - Yes/No confirmation with green border
   - Modal.alert() - Information alert with single button
   - Green border (#4caf50), grey title (#888)
   - Supports custom messages and callback functions
   - Auto-removes previous modals before showing new one
   - Respects safe-area-inset for iOS devices
DEPENDS ON: None (pure DOM manipulation)
STATUS: Ready for integration
*/