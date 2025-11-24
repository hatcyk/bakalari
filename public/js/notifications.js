/**
 * Notifications Module
 * Handles push notifications, service worker registration, and user preferences
 */

import { state, updateState } from './state.js';
import { dom } from './dom.js';

let messaging = null;
let fcmToken = null;

/**
 * Check if push notifications are supported
 */
export function isNotificationSupported() {
    return 'Notification' in window &&
           'serviceWorker' in navigator &&
           'PushManager' in window;
}

/**
 * Check if user is on iOS
 */
function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Check if app is running as standalone (added to homescreen)
 */
function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

/**
 * Initialize Firebase Messaging
 */
export async function initializeMessaging() {
    try {
        if (!firebase || !firebase.messaging) {
            console.error('Firebase Messaging not available');
            return false;
        }

        messaging = firebase.messaging();
        console.log('✅ Firebase Messaging initialized');
        return true;

    } catch (error) {
        console.error('Failed to initialize Firebase Messaging:', error);
        return false;
    }
}

/**
 * Register service worker
 * Note: Firebase Messaging requires its own service worker
 */
export async function registerServiceWorker() {
    try {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return null;
        }

        // Firebase Messaging will register its own service worker
        // at /firebase-messaging-sw.js automatically
        console.log('✅ Service Worker will be registered by Firebase Messaging');

        return null;

    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission() {
    try {
        if (!isNotificationSupported()) {
            throw new Error('Push notifications are not supported in this browser');
        }

        // Check if iOS and not standalone
        if (isIOS() && !isStandalone()) {
            throw new Error('IOS_NOT_STANDALONE');
        }

        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            throw new Error('Notification permission denied');
        }

        // Get FCM token
        if (!messaging) {
            await initializeMessaging();
        }

        fcmToken = await messaging.getToken({
            vapidKey: 'BA7vbWhWxiPOE6sZtC9k4FMb2wHt2jNOmt5mo1EGtYhHvkbGraSGmkvAgacQO5IBL1Eu1KM-wJGWyY0z_D7yYL0'
        });

        if (!fcmToken) {
            throw new Error('Failed to get FCM token');
        }

        console.log('✅ FCM token obtained:', fcmToken.substring(0, 20) + '...');

        // Save token to server
        await saveTokenToServer(fcmToken);

        // Update state
        updateState('notificationsEnabled', true);
        updateNotificationBellUI();

        return fcmToken;

    } catch (error) {
        console.error('Failed to request notification permission:', error);
        throw error;
    }
}

/**
 * Save FCM token to server
 */
async function saveTokenToServer(token) {
    try {
        const userId = localStorage.getItem('userId');

        if (!userId) {
            throw new Error('User ID not found');
        }

        const response = await fetch('/api/fcm/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, token })
        });

        if (!response.ok) {
            throw new Error('Failed to save token to server');
        }

        console.log('✅ FCM token saved to server');

    } catch (error) {
        console.error('Failed to save token:', error);
        throw error;
    }
}

/**
 * Disable notifications
 */
export async function disableNotifications() {
    try {
        const userId = localStorage.getItem('userId');

        if (!userId || !fcmToken) {
            updateState('notificationsEnabled', false);
            updateNotificationBellUI();
            return;
        }

        // Remove token from server
        await fetch('/api/fcm/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, token: fcmToken })
        });

        fcmToken = null;
        updateState('notificationsEnabled', false);
        updateNotificationBellUI();

        console.log('✅ Notifications disabled');

    } catch (error) {
        console.error('Failed to disable notifications:', error);
    }
}

/**
 * Update notification bell button UI
 */
function updateNotificationBellUI() {
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

    // Update modal content based on current state
    updateNotificationModalContent();

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
    }, 200);
}

/**
 * Update notification modal content
 */
function updateNotificationModalContent() {
    const isIosNotStandalone = isIOS() && !isStandalone();

    // Show/hide iOS warning
    if (dom.iosWarning) {
        if (isIosNotStandalone) {
            dom.iosWarning.style.display = 'block';
        } else {
            dom.iosWarning.style.display = 'none';
        }
    }

    // Populate dropdown options first
    populateMultiselectOptions();
    loadWatchedTimetables();

    // Update button and dropdown state based on notification status
    updateNotificationUIState();
}

/**
 * Update UI state based on notification enabled/disabled
 */
function updateNotificationUIState() {
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
}

/**
 * Update enable button state based on watched timetables
 */
function updateEnableButtonState() {
    if (!dom.notificationToggleEnable) return;

    const hasSelection = state.watchedTimetables && state.watchedTimetables.length > 0;

    if (hasSelection) {
        dom.notificationToggleEnable.disabled = false;
    } else {
        dom.notificationToggleEnable.disabled = true;
    }
}

/**
 * Toggle notifications on/off - Enable
 */
export async function enableNotifications() {
    const button = dom.notificationToggleEnable;
    if (!button) return;

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
        updateNotificationModalContent();
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
 * Toggle notifications on/off - Disable
 */
export async function disableNotificationsHandler() {
    const button = dom.notificationToggleDisable;
    if (!button) return;

    // Disable button during processing to prevent spam clicks
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Zpracovávám...';

    try {
        await disableNotifications();
        updateNotificationModalContent();
    } catch (error) {
        alert('Nepodařilo se vypnout notifikace: ' + error.message);
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = originalText;
    }
}

/**
 * Populate multiselect dropdown options
 */
function populateMultiselectOptions() {
    if (!dom.multiselectOptions || !state.definitions) return;

    const scheduleTypes = [
        { value: 'Actual', label: 'Aktuální' },
        { value: 'Next', label: 'Příští' }
    ];

    let html = '';

    // Add Classes section
    if (state.definitions.classes && state.definitions.classes.length > 0) {
        html += '<div class="multiselect-category">Třídy</div>';

        state.definitions.classes.forEach(item => {
            scheduleTypes.forEach(schedule => {
                const id = `watch_Class_${item.id}_${schedule.value}`;
                html += `
                    <label class="multiselect-option">
                        <input type="checkbox"
                               id="${id}"
                               data-type="Class"
                               data-id="${item.id}"
                               data-name="${item.name}"
                               data-schedule-type="${schedule.value}">
                        <span>${item.name} - ${schedule.label}</span>
                    </label>
                `;
            });
        });
    }

    // Add Teachers section
    if (state.definitions.teachers && state.definitions.teachers.length > 0) {
        html += '<div class="multiselect-category">Učitelé</div>';

        state.definitions.teachers.forEach(item => {
            scheduleTypes.forEach(schedule => {
                const id = `watch_Teacher_${item.id}_${schedule.value}`;
                html += `
                    <label class="multiselect-option">
                        <input type="checkbox"
                               id="${id}"
                               data-type="Teacher"
                               data-id="${item.id}"
                               data-name="${item.name}"
                               data-schedule-type="${schedule.value}">
                        <span>${item.name} - ${schedule.label}</span>
                    </label>
                `;
            });
        });
    }

    // Add Rooms section
    if (state.definitions.rooms && state.definitions.rooms.length > 0) {
        html += '<div class="multiselect-category">Místnosti</div>';

        state.definitions.rooms.forEach(item => {
            scheduleTypes.forEach(schedule => {
                const id = `watch_Room_${item.id}_${schedule.value}`;
                html += `
                    <label class="multiselect-option">
                        <input type="checkbox"
                               id="${id}"
                               data-type="Room"
                               data-id="${item.id}"
                               data-name="${item.name}"
                               data-schedule-type="${schedule.value}">
                        <span>${item.name} - ${schedule.label}</span>
                    </label>
                `;
            });
        });
    }

    dom.multiselectOptions.innerHTML = html;

    // Add event listeners to all checkboxes
    const checkboxes = dom.multiselectOptions.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleMultiselectChange);
    });
}

/**
 * Handle checkbox change in multiselect
 */
async function handleMultiselectChange(event) {
    const checkbox = event.target;
    const type = checkbox.dataset.type;
    const id = checkbox.dataset.id;
    const name = checkbox.dataset.name;
    const scheduleType = checkbox.dataset.scheduleType;

    const timetableEntry = { type, id, name, scheduleType };

    let watchedTimetables = [...state.watchedTimetables];

    if (checkbox.checked) {
        // Add to watched list
        const exists = watchedTimetables.some(t =>
            t.type === type && t.id === id && t.scheduleType === scheduleType
        );

        if (!exists) {
            watchedTimetables.push(timetableEntry);
        }
    } else {
        // Remove from watched list
        watchedTimetables = watchedTimetables.filter(t =>
            !(t.type === type && t.id === id && t.scheduleType === scheduleType)
        );
    }

    // Update state immediately for UI responsiveness
    updateState('watchedTimetables', watchedTimetables);
    updateMultiselectLabel();
    updateEnableButtonState();

    // Save to server
    try {
        await saveWatchedTimetables(watchedTimetables);
        console.log('Watched timetables updated:', watchedTimetables);
    } catch (error) {
        console.error('Failed to save watched timetables:', error);
        // Revert checkbox state on error
        checkbox.checked = !checkbox.checked;
        // Revert state
        if (checkbox.checked) {
            watchedTimetables = watchedTimetables.filter(t =>
                !(t.type === type && t.id === id && t.scheduleType === scheduleType)
            );
        } else {
            watchedTimetables.push(timetableEntry);
        }
        updateState('watchedTimetables', watchedTimetables);
        updateMultiselectLabel();
        updateEnableButtonState();
    }
}

/**
 * Update multiselect label based on selected items
 */
function updateMultiselectLabel() {
    if (!dom.multiselectLabel) return;

    const count = state.watchedTimetables.length;

    if (count === 0) {
        dom.multiselectLabel.textContent = 'Vyberte rozvrhy...';
    } else if (count === 1) {
        const item = state.watchedTimetables[0];
        dom.multiselectLabel.textContent = `${item.name} - ${item.scheduleType}`;
    } else {
        dom.multiselectLabel.textContent = `${count} rozvrhů vybráno`;
    }
}

/**
 * Toggle multiselect dropdown
 */
export function toggleMultiselect() {
    if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

    const isActive = dom.multiselectMenu.classList.contains('active');

    if (isActive) {
        closeMultiselect();
    } else {
        openMultiselect();
    }
}

/**
 * Open multiselect dropdown
 */
function openMultiselect() {
    if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

    dom.multiselectTrigger.classList.add('active');
    dom.multiselectMenu.classList.add('active');

    // Focus search input
    if (dom.multiselectSearch) {
        setTimeout(() => dom.multiselectSearch.focus(), 100);
    }
}

/**
 * Close multiselect dropdown
 */
function closeMultiselect() {
    if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

    dom.multiselectTrigger.classList.remove('active');
    dom.multiselectMenu.classList.remove('active');

    // Clear search
    if (dom.multiselectSearch) {
        dom.multiselectSearch.value = '';
        filterMultiselectOptions('');
    }
}

/**
 * Filter multiselect options based on search
 */
export function filterMultiselectOptions(searchTerm) {
    if (!dom.multiselectOptions) return;

    const options = dom.multiselectOptions.querySelectorAll('.multiselect-option');
    const categories = dom.multiselectOptions.querySelectorAll('.multiselect-category');
    const term = searchTerm.toLowerCase();

    options.forEach(option => {
        const label = option.querySelector('span').textContent.toLowerCase();
        if (label.includes(term)) {
            option.style.display = 'flex';
        } else {
            option.style.display = 'none';
        }
    });

    // Hide categories if all options are hidden
    categories.forEach(category => {
        let nextElement = category.nextElementSibling;
        let hasVisibleOptions = false;

        while (nextElement && !nextElement.classList.contains('multiselect-category')) {
            if (nextElement.style.display !== 'none') {
                hasVisibleOptions = true;
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }

        category.style.display = hasVisibleOptions ? 'block' : 'none';
    });
}

/**
 * Load watched timetables from server
 */
async function loadWatchedTimetables() {
    try {
        const userId = localStorage.getItem('userId');

        if (!userId) return;

        const response = await fetch(`/api/fcm/preferences/${userId}`);

        if (!response.ok) {
            throw new Error('Failed to load preferences');
        }

        const data = await response.json();
        updateState('watchedTimetables', data.watchedTimetables || []);

        // Update notification enabled state based on server data
        const hasNotifications = data.hasTokens || false;
        updateState('notificationsEnabled', hasNotifications);

        console.log(`✅ Loaded preferences - Watched: ${data.watchedTimetables?.length || 0}, Notifications: ${hasNotifications ? 'ON' : 'OFF'}`);

        // Update UI
        updateWatchedTimetablesUI();
        updateNotificationBellUI();
        updateNotificationUIState();

    } catch (error) {
        console.error('Failed to load watched timetables:', error);
    }
}

/**
 * Update watched timetables UI
 */
function updateWatchedTimetablesUI() {
    if (!dom.multiselectOptions) return;

    // Update checkboxes based on state.watchedTimetables
    const checkboxes = dom.multiselectOptions.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const type = checkbox.dataset.type;
        const id = checkbox.dataset.id;
        const scheduleType = checkbox.dataset.scheduleType;

        const isWatched = state.watchedTimetables.some(watched =>
            watched.type === type &&
            watched.id === id &&
            watched.scheduleType === scheduleType
        );

        checkbox.checked = isWatched;
    });

    // Update label and button state
    updateMultiselectLabel();
    updateEnableButtonState();
}

/**
 * Save watched timetables to server
 */
export async function saveWatchedTimetables(timetables) {
    try {
        const userId = localStorage.getItem('userId');

        if (!userId) {
            throw new Error('User ID not found');
        }

        const response = await fetch('/api/fcm/update-preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, watchedTimetables: timetables })
        });

        if (!response.ok) {
            throw new Error('Failed to save preferences');
        }

        updateState('watchedTimetables', timetables);
        console.log('✅ Watched timetables saved');

    } catch (error) {
        console.error('Failed to save watched timetables:', error);
        throw error;
    }
}

/**
 * Initialize notification button
 */
export function initNotificationButton() {
    if (!dom.notificationBell) return;

    dom.notificationBell.addEventListener('click', () => {
        showNotificationModal();
    });

    // Set initial UI state
    updateNotificationBellUI();

    // Load debug status and show debug panel if enabled
    loadDebugStatus();
}

/**
 * Check if debug mode is enabled
 */
let debugModeEnabled = false;

async function loadDebugStatus() {
    try {
        const response = await fetch('/api/debug/status');
        const data = await response.json();
        debugModeEnabled = data.debugMode;

        if (debugModeEnabled) {
            console.log('🔧 Debug mode is enabled');
            showDebugPanel();
        }

    } catch (error) {
        // Debug endpoint not available or error
        debugModeEnabled = false;
    }
}

/**
 * Show debug panel in notification modal
 */
function showDebugPanel() {
    // Create debug panel if it doesn't exist
    if (!document.getElementById('debugPanel')) {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.className = 'notification-section debug-section';
        debugPanel.innerHTML = `
            <h3>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6"/>
                    <path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24"/>
                    <path d="M1 12h6m6 0h6"/>
                    <path d="m4.93 19.07 4.24-4.24m5.66-5.66 4.24-4.24"/>
                </svg>
                Debug Mode
            </h3>
            <div class="debug-info" style="font-size: 0.85em; margin-bottom: 15px;">
                <p><strong>User ID:</strong> <span id="debugUserId">${localStorage.getItem('userId') || 'N/A'}</span></p>
                <p><strong>FCM Token:</strong> <code id="debugFcmToken" style="word-break: break-all; font-size: 0.75em;">Loading...</code></p>
                <p><strong>Notifications:</strong> <span id="debugNotifStatus">Loading...</span></p>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="debugTestNotif" class="debug-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Test notifikace
                </button>
                <button id="debugCreateChange" class="debug-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    Vytvořit fake změnu
                </button>
                <button id="debugViewChanges" class="debug-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Zobrazit pending changes
                </button>
            </div>
        `;

        // Insert before the first notification-section or at the end
        const modalBody = dom.notificationModal?.querySelector('.modal-body');
        if (modalBody) {
            const firstSection = modalBody.querySelector('.notification-section');
            if (firstSection) {
                modalBody.insertBefore(debugPanel, firstSection);
            } else {
                modalBody.appendChild(debugPanel);
            }

            // Add event listeners
            document.getElementById('debugTestNotif')?.addEventListener('click', sendTestNotification);
            document.getElementById('debugCreateChange')?.addEventListener('click', createFakeChange);
            document.getElementById('debugViewChanges')?.addEventListener('click', viewPendingChanges);

            // Update debug info
            updateDebugInfo();
        }
    }
}

/**
 * Update debug info display
 */
function updateDebugInfo() {
    const tokenEl = document.getElementById('debugFcmToken');
    const statusEl = document.getElementById('debugNotifStatus');

    if (tokenEl) {
        tokenEl.textContent = fcmToken ? fcmToken.substring(0, 50) + '...' : 'No token';
    }

    if (statusEl) {
        if (state.notificationsEnabled) {
            statusEl.innerHTML = '<span style="color: #4caf50;">Enabled</span>';
        } else {
            statusEl.innerHTML = '<span style="color: #f44336;">Disabled</span>';
        }
    }
}

/**
 * Send test notification
 */
async function sendTestNotification() {
    try {
        const userId = localStorage.getItem('userId');

        if (!userId) {
            alert('User ID not found. Authenticate first.');
            return;
        }

        const response = await fetch('/api/debug/test-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Success: ' + data.message);
        } else {
            alert('Error: ' + data.error);
        }

    } catch (error) {
        alert('Failed to send test notification: ' + error.message);
    }
}

/**
 * Create fake change
 */
async function createFakeChange() {
    try {
        const response = await fetch('/api/debug/create-fake-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timetableType: 'Class',
                timetableId: 'DEBUG',
                timetableName: 'Debug Test Class'
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Fake change created!\nChange ID: ' + data.changeId + '\n\nNow run /api/fcm/process-changes to send notifications.');
        } else {
            alert('Error: ' + data.error);
        }

    } catch (error) {
        alert('Failed to create fake change: ' + error.message);
    }
}

/**
 * View pending changes
 */
async function viewPendingChanges() {
    try {
        const response = await fetch('/api/debug/pending-changes');
        const data = await response.json();

        if (response.ok) {
            if (data.count === 0) {
                alert('No pending changes found.');
            } else {
                console.log('Pending changes:', data.changes);
                alert(`Found ${data.count} pending change(s).\nCheck console for details.`);
            }
        } else {
            alert('Error: ' + data.error);
        }

    } catch (error) {
        alert('Failed to get pending changes: ' + error.message);
    }
}
