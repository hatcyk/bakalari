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
 */
export async function registerServiceWorker() {
    try {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return null;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered:', registration.scope);

        return registration;

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
            vapidKey: 'YOUR_VAPID_KEY_HERE' // TODO: Add your VAPID key
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

    // Update enable/disable button
    if (dom.notificationToggle) {
        if (state.notificationsEnabled) {
            dom.notificationToggle.textContent = 'Vypnout notifikace';
            dom.notificationToggle.classList.add('danger');
        } else {
            dom.notificationToggle.textContent = 'Zapnout notifikace';
            dom.notificationToggle.classList.remove('danger');
        }
    }

    // Load watched timetables
    loadWatchedTimetables();
}

/**
 * Toggle notifications on/off
 */
export async function toggleNotifications() {
    try {
        if (state.notificationsEnabled) {
            await disableNotifications();
        } else {
            await requestNotificationPermission();
        }

        updateNotificationModalContent();

    } catch (error) {
        if (error.message === 'IOS_NOT_STANDALONE') {
            alert('Na iOS musíte nejdřív přidat web na plochu (Home Screen). Klikněte na tlačítko "Sdílet" a pak "Přidat na plochu".');
        } else {
            alert('Nepodařilo se zapnout notifikace: ' + error.message);
        }
    }
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

        // Update checkboxes
        updateWatchedTimetablesUI();

    } catch (error) {
        console.error('Failed to load watched timetables:', error);
    }
}

/**
 * Update watched timetables UI
 */
function updateWatchedTimetablesUI() {
    if (!dom.watchedTimetablesList) return;

    // This will be called after modal is fully loaded
    // Update checkboxes based on state.watchedTimetables
    const checkboxes = dom.watchedTimetablesList.querySelectorAll('input[type="checkbox"]');

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
            <h3>🔧 Debug Mode</h3>
            <div class="debug-info" style="font-size: 0.85em; margin-bottom: 15px;">
                <p><strong>User ID:</strong> <span id="debugUserId">${localStorage.getItem('userId') || 'N/A'}</span></p>
                <p><strong>FCM Token:</strong> <code id="debugFcmToken" style="word-break: break-all; font-size: 0.75em;">Loading...</code></p>
                <p><strong>Notifications:</strong> <span id="debugNotifStatus">Loading...</span></p>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="debugTestNotif" class="debug-btn">🧪 Test notifikace</button>
                <button id="debugCreateChange" class="debug-btn">📝 Vytořit fake změnu</button>
                <button id="debugViewChanges" class="debug-btn">📋 Zobrazit pending changes</button>
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
        statusEl.textContent = state.notificationsEnabled ? '✅ Enabled' : '❌ Disabled';
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
            alert('✅ ' + data.message);
        } else {
            alert('❌ Error: ' + data.error);
        }

    } catch (error) {
        alert('❌ Failed to send test notification: ' + error.message);
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
            alert('✅ Fake change created!\nChange ID: ' + data.changeId + '\n\nNow run /api/fcm/process-changes to send notifications.');
        } else {
            alert('❌ Error: ' + data.error);
        }

    } catch (error) {
        alert('❌ Failed to create fake change: ' + error.message);
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
                alert('ℹ️ No pending changes found.');
            } else {
                console.log('Pending changes:', data.changes);
                alert(`📋 Found ${data.count} pending change(s).\nCheck console for details.`);
            }
        } else {
            alert('❌ Error: ' + data.error);
        }

    } catch (error) {
        alert('❌ Failed to get pending changes: ' + error.message);
    }
}
