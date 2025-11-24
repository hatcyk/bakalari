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

        // Wait 2 seconds before allowing next action
        await new Promise(resolve => setTimeout(resolve, 2000));

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

        // Wait 2 seconds before allowing next action (even on error)
        await new Promise(resolve => setTimeout(resolve, 2000));

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

        // Wait 2 seconds before allowing next action
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update UI after successful disable
        updateNotificationUIState();
    } catch (error) {
        alert('Nepodařilo se vypnout notifikace: ' + error.message);

        // Wait 2 seconds before allowing next action (even on error)
        await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = originalText;
    }
}

/**
 * Simulate timetable change (DEBUG only)
 */
async function simulateTimetableChange() {
    const button = document.getElementById('debugSimulateChange');
    if (!button) return;

    // Get first watched timetable
    const watched = state.watchedTimetables?.[0];
    if (!watched) {
        alert('Nejdřív musíš sledovat alespoň jeden rozvrh!');
        return;
    }

    button.disabled = true;
    button.textContent = '⏳ Vytvářím změnu...';

    try {
        const response = await fetch('/api/debug/simulate-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timetableType: watched.type,
                timetableId: watched.id,
                timetableName: watched.name,
                scheduleType: watched.scheduleType
            })
        });

        if (!response.ok) {
            throw new Error('Failed to simulate change');
        }

        const result = await response.json();

        console.log('✅ Simulated change result:', result);

        alert(`✅ Hotovo!\n\n` +
              `Změna vytvořena pro: ${watched.name}\n` +
              `Notifikace poslány: ${result.notificationResult?.sentCount || 0}x\n` +
              `Zpracováno změn: ${result.notificationResult?.processedCount || 0}`);

    } catch (error) {
        console.error('Failed to simulate change:', error);
        alert('❌ Chyba při simulaci změny: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = '🚀 Simulovat změnu v rozvrhu';
    }
}

/**
 * Update debug button text with current watched timetable
 */
function updateDebugButtonText() {
    const button = document.getElementById('debugSimulateChange');
    if (!button) return;

    const watched = state.watchedTimetables?.[0];

    if (watched) {
        button.textContent = `🚀 Simulovat změnu: ${watched.name}`;
        button.disabled = false;
    } else {
        button.textContent = '🚀 Simulovat změnu (nejdřív vyber rozvrh)';
        button.disabled = true;
    }
}

/**
 * Show/hide debug section based on DEBUG mode
 */
function updateDebugSectionVisibility() {
    const debugSection = document.getElementById('debugSimulateSection');
    if (!debugSection) return;

    // Check if in debug mode by trying to access debug endpoint
    fetch('/api/debug/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test' })
    }).then(response => {
        // If we get 200 or 500, debug mode is enabled
        // If we get 403, debug mode is disabled
        if (response.status !== 403) {
            debugSection.style.display = 'block';
            updateDebugButtonText();
        }
    }).catch(() => {
        // Network error or other issue - hide debug section
        debugSection.style.display = 'none';
    });
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
        updateDebugButtonText();
    });

    // Initialize debug simulate button
    const debugButton = document.getElementById('debugSimulateChange');
    if (debugButton) {
        debugButton.addEventListener('click', simulateTimetableChange);
    }

    // Check debug mode and show/hide debug section
    updateDebugSectionVisibility();
}
