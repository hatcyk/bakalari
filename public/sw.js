/**
 * Service Worker for Push Notifications
 * Handles FCM push messages and displays notifications
 */

// Import Firebase Messaging for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (must match public/js/firebase-client.js)
const firebaseConfig = {
    apiKey: "AIzaSyDCUbLugBGStqn8XOlJFEhtP5l2u17ooSg",
    authDomain: "rozvrh-6d825.firebaseapp.com",
    projectId: "rozvrh-6d825",
    storageBucket: "rozvrh-6d825.firebasestorage.app",
    messagingSenderId: "686089293003",
    appId: "1:686089293003:web:ee37bf95597e4b93b5ead6"
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[Service Worker] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'Nová notifikace';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: payload.notification?.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: payload.data || {},
        requireInteraction: true, // Keep notification visible until user interacts
        tag: payload.data?.type || 'default' // Group similar notifications
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event);

    event.notification.close();

    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }

                // Otherwise, open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Service worker installation
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    self.skipWaiting(); // Activate immediately
});

// Service worker activation
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(clients.claim()); // Take control immediately
});

console.log('[Service Worker] Loaded successfully');
