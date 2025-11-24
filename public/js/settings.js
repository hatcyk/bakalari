/**
 * Settings Modal Module (Mobile Only)
 * Handles the settings modal that shows notifications, calendar, and theme options on mobile
 */

/**
 * Show settings modal
 */
export function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

/**
 * Close settings modal
 */
export function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    modal.classList.add('modal-closing');
    setTimeout(() => {
        modal.classList.remove('modal-closing');
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }, 250);
}

/**
 * Initialize settings modal and event listeners
 */
export function initSettings() {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsModalClose = document.getElementById('settingsModalClose');
    const settingsModal = document.getElementById('settingsModal');

    // Open settings modal
    if (settingsToggle) {
        settingsToggle.addEventListener('click', showSettingsModal);
    }

    // Close settings modal
    if (settingsModalClose) {
        settingsModalClose.addEventListener('click', closeSettingsModal);
    }

    // Close on overlay click
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    // Settings options handlers
    const settingsNotifications = document.getElementById('settingsNotifications');
    const settingsCalendar = document.getElementById('settingsCalendar');
    const settingsTheme = document.getElementById('settingsTheme');

    if (settingsNotifications) {
        settingsNotifications.addEventListener('click', () => {
            closeSettingsModal();
            // Trigger notification bell click
            const notificationBell = document.getElementById('notificationBell');
            if (notificationBell) {
                notificationBell.click();
            }
        });
    }

    if (settingsCalendar) {
        settingsCalendar.addEventListener('click', () => {
            closeSettingsModal();
            // Trigger week view toggle
            const weekViewToggle = document.getElementById('weekViewToggle');
            if (weekViewToggle) {
                weekViewToggle.click();
            }
        });
    }

    if (settingsTheme) {
        settingsTheme.addEventListener('click', () => {
            closeSettingsModal();
            // Trigger theme toggle
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.click();
            }
        });
    }
}
