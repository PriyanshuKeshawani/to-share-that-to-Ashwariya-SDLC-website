import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from './supabaseClient';

// Firebase configuration using Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCJRCTpgdNwbrKO6VW2yEC-auqIGRsP5s0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sistec-library-portal.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sistec-library-portal',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sistec-library-portal.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1076845729176',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1076845729176:web:8b35bc3b968dbd16cb07ed'
};

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BCJg4OePBub_inm9aF8U_0WzT1oo1c2EEgFHtYBOG6ZJ-pwekdQxJRKM3Dv5Fl2l6hzkbHTDsosWhyPgYm6j9rI';

// Initialize or reuse existing Firebase instance
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let messagingInstance = null;

// Asynchronously initialize messaging with feature-detection
export const getMessagingInstance = async () => {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.info('Firebase Cloud Messaging is not supported in this browser context.');
    return null;
  }
  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch (err) {
      console.warn('Notice initializing Firebase messaging:', err);
    }
  }
  return messagingInstance;
};

/**
 * Request notification permission and register FCM token into Supabase user_fcm_tokens
 * @param {Object} user - Currently logged-in user object
 * @returns {Promise<{success: boolean, token?: string, error?: string, reason?: string}>}
 */
export const requestNotificationPermission = async (user) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, reason: 'unsupported', error: 'Notifications are not supported by your browser.' };
  }

  if (Notification.permission === 'denied') {
    return { success: false, reason: 'blocked', error: 'Notifications have been blocked in your browser settings. Please enable them in site permissions.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'denied', error: 'Notification permission was not granted.' };
    }

    // Register our custom service worker
    let registration = null;
    if ('serviceWorker' in navigator) {
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('Service worker registration note:', swErr);
      }
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, reason: 'unsupported', error: 'FCM messaging could not be initialized on this device.' };
    }

    // Retrieve FCM Device Push Token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration || undefined
    });

    if (!token) {
      return { success: false, error: 'Failed to retrieve FCM push token from Firebase.' };
    }

    // Save token in Supabase user_fcm_tokens
    const { error: dbError } = await supabase.from('user_fcm_tokens').upsert({
      user_id: user?.id || null,
      fcm_token: token,
      branch_name: user?.branch_name || 'General',
      device_info: `${navigator.platform || ''} • ${navigator.userAgent || ''}`.substring(0, 180),
      updated_at: new Date().toISOString()
    }, { onConflict: 'fcm_token' });

    if (dbError) {
      console.warn('Notice saving FCM token in Supabase:', dbError.message);
    }

    return { success: true, token };
  } catch (err) {
    console.error('Error enabling push notifications:', err);
    return { success: false, error: err.message || 'Error configuring push notifications.' };
  }
};

/**
 * Register foreground notification listener to display in-app notifications while browsing
 * @param {Function} onReceive - Callback called with notification payload
 * @returns {Function|null} Unsubscribe function
 */
export const subscribeToForegroundMessages = async (onReceive) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  return onMessage(messaging, (payload) => {
    if (typeof onReceive === 'function') {
      onReceive(payload);
    }
  });
};
