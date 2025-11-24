/**
 * Notifications Core Module
 * Handles FCM initialization, permissions, and token management
 */

import { state, updateState } from './state.js';

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
export function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Check if app is running as standalone (added to homescreen)
 */
export function isStandalone() {
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
 * Register service worker and wait for it to be ready
 * Note: Firebase Messaging requires its own service worker
 */
export async function registerServiceWorker() {
    try {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return null;
        }

        // Check if service worker is already registered
        let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

        if (!registration) {
            // Register Firebase Messaging service worker
            console.log('📝 Registering Firebase Messaging Service Worker...');
            registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('✅ Service Worker registered:', registration.scope);
        } else {
            console.log('✅ Service Worker already registered:', registration.scope);
        }

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker is ready');

        return registration;

    } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
        throw error;
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

        // IMPORTANT: Register and wait for Service Worker FIRST
        console.log('🔄 Registering Service Worker...');
        await registerServiceWorker();

        // Wait a bit to ensure Service Worker is fully active
        await new Promise(resolve => setTimeout(resolve, 500));

        // Request permission
        console.log('🔔 Requesting notification permission...');
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            throw new Error('Notification permission denied');
        }

        console.log('✅ Notification permission granted');

        // Initialize Firebase Messaging
        if (!messaging) {
            console.log('🔄 Initializing Firebase Messaging...');
            await initializeMessaging();
        }

        // Get FCM token
        console.log('🔄 Getting FCM token...');
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

        return fcmToken;

    } catch (error) {
        console.error('❌ Failed to request notification permission:', error);
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

        console.log('✅ Notifications disabled');

    } catch (error) {
        console.error('Failed to disable notifications:', error);
    }
}

/**
 * Load watched timetables and notification state from server
 */
export async function loadNotificationPreferences() {
    try {
        const userId = localStorage.getItem('userId');

        if (!userId) return null;

        const response = await fetch(`/api/fcm/preferences/${userId}`);

        if (!response.ok) {
            throw new Error('Failed to load preferences');
        }

        const data = await response.json();

        // Update state
        updateState('watchedTimetables', data.watchedTimetables || []);
        updateState('notificationsEnabled', data.hasTokens || false);

        console.log(`✅ Loaded preferences - Watched: ${data.watchedTimetables?.length || 0}, Notifications: ${data.hasTokens ? 'ON' : 'OFF'}`);

        return data;

    } catch (error) {
        console.error('Failed to load preferences:', error);
        return null;
    }
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
