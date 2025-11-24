/**
 * Notifications Modal Module
 * Handles notification modal UI and state management
 */

import { state } from './state.js';
import { dom } from './dom.js';
import { isIOS, isStandalone, requestNotificationPermission, disableNotifications, loadNotificationPreferences } from './notifications-core.js';
import { populateMultiselectOptions, updateMultiselectLabel, updateMultiselectCheckboxes } from './notifications-multiselect.js';

/**
 * Update notification bell button UI
 */
export function updateNotificationBellUI() {
    if (!dom.notificationBell) return;

    if (state.notificationsEnabled) {
        dom.notificationBell.classList.remove('disabled');
        dom.notificationBell.setAttribute('title', 'Notifikace zapnuty');
    } else {
        dom.notificationBell.classList.add('disabled');
        dom.notificationBell.setAttribute('title', 'Notifikace vypnuty');
    }
}

/**
 * Show notification settings modal
 */
export function showNotificationModal() {
    if (!dom.notificationModal) return;

    // Load preferences and update UI - this will only happen ONCE when modal opens
    initializeModal();

    dom.notificationModal.classList.remove('hidden');
    dom.notificationModal.style.display = 'flex';
}

/**
 * Close notification settings modal
 */
export function closeNotificationModal() {
    if (!dom.notificationModal) return;

    dom.notificationModal.classList.add('modal-closing');
    setTimeout(() => {
        dom.notificationModal.classList.remove('modal-closing');
        dom.notificationModal.classList.add('hidden');
        dom.notificationModal.style.display = 'none';
    }, 250);
}

/**
 * Initialize modal - ONLY called when modal is opened
 */
async function initializeModal() {
    // Show/hide iOS warning
    const isIosNotStandalone = isIOS() && !isStandalone();
    if (dom.iosWarning) {
        dom.iosWarning.style.display = isIosNotStandalone ? 'block' : 'none';
    }

    // Populate dropdown options
    populateMultiselectOptions();

    // Load preferences from server
    await loadNotificationPreferences();

    // Update UI based on loaded state
    updateMultiselectCheckboxes();
    updateMultiselectLabel();
    updateNotificationUIState();
}

/**
 * Update UI state based on notification enabled/disabled
 */
export function updateNotificationUIState() {
    const multiselect = document.getElementById('timetablesMultiselect');

    if (state.notificationsEnabled) {
        // Notifications are ON - show disable button, disable dropdown
        if (dom.notificationToggleEnable) dom.notificationToggleEnable.style.display = 'none';
        if (dom.notificationToggleDisable) dom.notificationToggleDisable.style.display = 'block';
        if (multiselect) multiselect.classList.add('disabled');
    } else {
        // Notifications are OFF - show enable button, enable dropdown
        if (dom.notificationToggleEnable) dom.notificationToggleEnable.style.display = 'block';
        if (dom.notificationToggleDisable) dom.notificationToggleDisable.style.display = 'none';
        if (multiselect) multiselect.classList.remove('disabled');

        // Update enable button state based on selection
        updateEnableButtonState();
    }

    // Update bell icon
    updateNotificationBellUI();
}

/**
 * Update enable button state based on watched timetables
 */
export function updateEnableButtonState() {
    if (!dom.notificationToggleEnable) return;

    const hasSelection = state.watchedTimetables && state.watchedTimetables.length > 0;

    if (hasSelection) {
        dom.notificationToggleEnable.disabled = false;
    } else {
        dom.notificationToggleEnable.disabled = true;
    }
}

/**
 * Enable notifications handler
 */
export async function enableNotifications() {
    const button = dom.notificationToggleEnable;
    if (!button) return;

    // Prevent multiple simultaneous clicks
    if (button.disabled) return;

    // Check if at least one timetable is selected
    if (!state.watchedTimetables || state.watchedTimetables.length === 0) {
        alert('Nejdřív vyberte alespoň jeden rozvrh ke sledování.');
        return;
    }

    // Disable button during processing to prevent spam clicks
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Zpracovávám...';

    try {
        await requestNotificationPermission();

        // Restore button state before updating UI (button will be hidden by updateNotificationUIState)
        button.disabled = false;
        button.textContent = originalText;

        // Update UI after successful enable
        updateNotificationUIState();
    } catch (error) {
        if (error.message === 'IOS_NOT_STANDALONE') {
            alert('Na iOS musíte nejdřív přidat web na plochu (Home Screen). Klikněte na tlačítko "Sdílet" a pak "Přidat na plochu".');
        } else {
            alert('Nepodařilo se zapnout notifikace: ' + error.message);
        }
        // Re-enable button on error
        button.disabled = false;
        button.textContent = originalText;
    }
}

/**
 * Disable notifications handler
 */
export async function disableNotificationsHandler() {
    const button = dom.notificationToggleDisable;
    if (!button) return;

    // Prevent multiple simultaneous clicks
    if (button.disabled) return;

    // Disable button during processing to prevent spam clicks
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Zpracovávám...';

    try {
        await disableNotifications();

        // Update UI after successful disable
        updateNotificationUIState();
    } catch (error) {
        alert('Nepodařilo se vypnout notifikace: ' + error.message);
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = originalText;
    }
}

/**
 * Initialize event listeners
 */
export function initNotificationButton() {
    if (dom.notificationBell) {
        dom.notificationBell.addEventListener('click', showNotificationModal);
    }

    // Listen for changes in watched timetables to update button state
    window.addEventListener('watchedTimetablesChanged', () => {
        updateEnableButtonState();
    });
}
