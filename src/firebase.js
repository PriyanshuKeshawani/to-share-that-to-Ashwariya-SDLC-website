import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from './supabaseClient';

const getEnv = (key) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const rawApiKey =
  getEnv('NEXT_PUBLIC_FIREBASE_API_KEY') ||
  getEnv('VITE_FIREBASE_API_KEY') ||
  'AIzaSyCJRCTpgdNwbrKO6VW2yEC-auqIGRsP5s0';

const rawVapid =
  getEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY') ||
  getEnv('VITE_FIREBASE_VAPID_KEY') ||
  'BCJg4OePBub_inm9aF8U_0WzT1oo1c2EEgFHtYBOG6ZJ-pwekdQxJRKM3Dv5Fl2l6hzkbHTDsosWhyPgYm6j9rI';

// Firebase configuration using sanitized environment variables
const firebaseConfig = {
  apiKey: String(rawApiKey).trim().split(/[\r\n]/)[0].trim(),
  authDomain: (getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') || getEnv('VITE_FIREBASE_AUTH_DOMAIN') || 'sistec-library-portal.firebaseapp.com').trim(),
  projectId: (getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || getEnv('VITE_FIREBASE_PROJECT_ID') || 'sistec-library-portal').trim(),
  storageBucket: (getEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') || getEnv('VITE_FIREBASE_STORAGE_BUCKET') || 'sistec-library-portal.firebasestorage.app').trim(),
  messagingSenderId: (getEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') || getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || '1076845729176').trim(),
  appId: (getEnv('NEXT_PUBLIC_FIREBASE_APP_ID') || getEnv('VITE_FIREBASE_APP_ID') || '1:1076845729176:web:8b35bc3b968dbd16cb07ed').trim()
}; 

export const VAPID_KEY = String(rawVapid).trim().split(/[\r\n]/)[0].trim();

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

const isValidUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || '').trim());

export const resolveUserUuid = async (user) => {
  if (!user) return null;
  const rawId = String(user.id || user.user_id || '').trim();
  if (isValidUuid(rawId)) return rawId;

  try {
    const ident = (user.roll_number || user.rollNumber || user.enrollment_no || user.username || rawId).trim();
    if (ident) {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .or(`username.eq.${ident},roll_number.eq.${ident}`)
        .limit(1);
      if (!error && data && data.length > 0 && data[0]?.id && isValidUuid(data[0].id)) {
        return data[0].id;
      }
    }
  } catch (err) {
    console.warn('Notice resolving user UUID for FCM push token:', err);
  }
  return null;
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
    return { 
      success: false, 
      reason: 'blocked', 
      error: 'Notifications are blocked in browser settings. (Note: Chrome blocks notifications in Incognito mode — please use a normal window, or click the 🔒 lock icon in the address bar to set Notifications to Allow).' 
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'denied', error: 'Notification permission was not granted.' };
    }

    // Register and wait for active service worker
    let registration = null;
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        registration = await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('Service worker registration note:', swErr);
      }
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, reason: 'unsupported', error: 'FCM messaging could not be initialized on this device.' };
    }

    // Retrieve FCM Device Push Token with active registration
    let token = null;
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration || undefined
      });
    } catch (firstErr) {
      console.warn('First getToken attempt with registration, trying default fallback...', firstErr);
      try {
        token = await getToken(messaging, {
          vapidKey: VAPID_KEY
        });
      } catch (fallbackErr) {
        // Provide user-friendly explanation and fallback for Chrome push service error
        if (fallbackErr.name === 'AbortError' || fallbackErr.message?.includes('push service error')) {
          console.info('Chrome push service not supported in this window mode (Incognito/Private). In-app live alerts remain active.');
          return {
            success: true,
            mode: 'in_app',
            message: 'In-app notifications active! (Note: Background desktop push requires a normal, non-incognito Chrome window).'
          };
        }
        throw fallbackErr;
      }
    }


    if (!token) {
      return { success: false, error: 'Failed to retrieve FCM push token from Firebase.' };
    }

    // Resolve valid UUID for user_fcm_tokens (prevents Postgres 22P02 error if user.id is an enrollment number)
    const resolvedUserId = await resolveUserUuid(user);

    // Save token in Supabase user_fcm_tokens
    const { error: dbError } = await supabase.from('user_fcm_tokens').upsert({
      user_id: resolvedUserId,
      fcm_token: token,
      branch_name: user?.branch_name || user?.branchName || 'General',
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
 * Save a native FCM token for the given user into Supabase.
 * Upserts into user_fcm_tokens on fcm_token conflict and optionally updates users.fcm_token.
 * @param {string} token
 * @param {Object} user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const saveNativeFcmToken = async (token, user) => {
  if (!token || !user) return { success: false, error: 'Missing token or user.' };
  try {
    const resolvedUserId = await resolveUserUuid(user);
    if (!resolvedUserId) return { success: false, error: 'Unable to resolve user UUID.' };

    const branchName = String(user?.branch_name || user?.branchName || 'General').trim();
    const deviceInfo = `${navigator.platform || ''} • ${navigator.userAgent || ''}`.substring(0, 180);
    const now = new Date().toISOString();

    const { error: fcmError } = await supabase
      .from('user_fcm_tokens')
      .upsert(
        { user_id: resolvedUserId, fcm_token: token, branch_name: branchName, device_info: deviceInfo, updated_at: now },
        { onConflict: 'fcm_token' }
      );

    if (fcmError) {
      console.warn('Notice saving native FCM token:', fcmError.message);
      return { success: false, error: fcmError.message };
    }

    try {
      await supabase.from('users').update({ fcm_token: token }).eq('id', resolvedUserId);
    } catch (userUpdateErr) {
      console.warn('Notice updating users.fcm_token:', userUpdateErr.message);
    }

    return { success: true };
  } catch (err) {
    console.warn('Error saving native FCM token:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
};

/**
 * Initialize a listener that watches for native FCM tokens from the app bridge / host.
 * Monitors:
 *  - Immediate window.__SISTEC_NATIVE_FCM_TOKEN__ value
 *  - Object.defineProperty setter trap on window.__SISTEC_NATIVE_FCM_TOKEN__
 *  - Custom 'sistec_native_fcm_token' window event
 * @param {Function} getCurrentUser - Returns the current authenticated user object
 * @returns {Function} Unsubscribe handler
 */
export const initNativeFcmTokenListener = (getCurrentUser) => {
  if (typeof window === 'undefined') return () => {};

  const persist = async (nativeToken) => {
    const currentUser = getCurrentUser?.();
    if (!nativeToken || !currentUser) return;
    await saveNativeFcmToken(nativeToken, currentUser);
  };

  const handleEvent = (event) => {
    const token = event?.detail?.token || event?.detail || '';
    if (token) persist(token);
  };

  window.addEventListener('sistec_native_fcm_token', handleEvent);

  let previousToken = window.__SISTEC_NATIVE_FCM_TOKEN__;
  if (previousToken) persist(previousToken);

  try {
    let descriptor = Object.getOwnPropertyDescriptor(window, '__SISTEC_NATIVE_FCM_TOKEN__');
    if (!descriptor || !descriptor.set) {
      Object.defineProperty(window, '__SISTEC_NATIVE_FCM_TOKEN__', {
        configurable: true,
        enumerable: true,
        get() { return previousToken; },
        set(value) {
          previousToken = value;
          if (value) persist(value);
        }
      });
    } else if (descriptor.set) {
      const originalSetter = descriptor.set.bind(window);
      Object.defineProperty(window, '__SISTEC_NATIVE_FCM_TOKEN__', {
        configurable: true,
        enumerable: true,
        get: descriptor.get,
        set(value) {
          previousToken = value;
          originalSetter(value);
          if (value) persist(value);
        }
      });
    }
  } catch (definePropertyErr) {
    console.warn('Notice installing native FCM token listener:', definePropertyErr.message);
  }

  return () => {
    window.removeEventListener('sistec_native_fcm_token', handleEvent);
  };
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
