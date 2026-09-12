// SISTEC Library Portal — Background Firebase Messaging Service Worker
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker script
firebase.initializeApp({
  apiKey: "AIzaSyCJRCTpgdNwbrKO6VW2yEC-auqIGRsP5s0",
  authDomain: "sistec-library-portal.firebaseapp.com",
  projectId: "sistec-library-portal",
  storageBucket: "sistec-library-portal.firebasestorage.app",
  messagingSenderId: "1076845729176",
  appId: "1:1076845729176:web:8b35bc3b968dbd16cb07ed"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background push message:', payload);

  const title = payload.notification?.title || payload.data?.title || 'SISTEC Central Library';
  const body = payload.notification?.body || payload.data?.body || 'New library update available.';
  const bookId = payload.data?.book_id || payload.data?.bookId;
  const targetUrl = payload.data?.url || (bookId ? `/?book=${bookId}` : '/');

  const notificationOptions = {
    body: body,
    icon: '/logo.png',
    badge: '/favicon.png',
    image: payload.notification?.image || payload.data?.image || undefined,
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'sistec-library-notification',
    renotify: true,
    data: {
      url: targetUrl
    },
    actions: [
      {
        action: 'open_book',
        title: '📖 Open Book'
      }
    ]
  };

  self.registration.showNotification(title, notificationOptions);
});

// Handle notification tap / click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus already open window if available
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new tab/window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
