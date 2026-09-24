/**
 * Native Back Button & App Exit Manager for Mobile View and APK Wrappers
 * 
 * Solves:
 * 1. Single hardware back button press accidentally terminating the APK/app.
 * 2. Modals, drawers, and full-screen readers closing smoothly on back press.
 * 3. Sub-tabs navigating back to the Home/Catalog tab before exiting.
 * 4. Android native standard "Double tap back to exit" with floating toast and haptic feedback.
 * 5. Scoped exclusively to mobile viewports, touch devices, and Android APK wrappers.
 */

// Check if running on mobile device, touch screen, or inside an APK wrapper
export const isMobileOrAppView = () => {
  if (typeof window === 'undefined') return false;
  
  // Explicitly check for APK wrappers (Capacitor, Cordova, WebView, TWA)
  const isCapacitor = Boolean(window.Capacitor);
  const isCordova = Boolean(window.cordova);
  const isAndroidWebView = /wv|Android.*Version\/[0-9.]+/i.test(navigator.userAgent);
  const isStandalonePWA = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  if (isCapacitor || isCordova || isAndroidWebView || isStandalonePWA) {
    return true;
  }

  // Mobile viewport and touch detection
  const isSmallScreen = window.innerWidth <= 768;
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return (isSmallScreen && isTouchDevice) || isMobileUA;
};

// Registered back action handlers (LIFO stack with priority)
let backHandlers = [];
let exitToastListeners = [];
let exitTimer = null;
let isExitArmed = false;
let isInitialized = false;

// Register an exit toast subscriber
export const onExitToast = (listener) => {
  exitToastListeners.push(listener);
  return () => {
    exitToastListeners = exitToastListeners.filter(l => l !== listener);
  };
};

const notifyExitToast = (message = 'Press back again to exit') => {
  exitToastListeners.forEach(listener => {
    try {
      listener(message);
    } catch (e) {
      console.warn('[NativeBackManager] Toast notify note:', e);
    }
  });
};

/**
 * Register a back button handler.
 * @param {Object} item
 * @param {string} item.id - Unique ID for unregistering
 * @param {Function} item.handler - Callback executed on back press. Return false to bubble down.
 * @param {number} [item.priority=10] - Higher numbers run first (Modals: 20-30, Sub-tabs: 5)
 * @param {string} [item.label=''] - Debug label
 */
export const registerBackHandler = ({ id, handler, priority = 10, label = '' }) => {
  // Remove existing with same id to avoid duplicates
  backHandlers = backHandlers.filter(h => h.id !== id);
  backHandlers.unshift({ id, handler, priority, label, registeredAt: Date.now() });

  // Keep sorted: higher priority first; if equal priority, newer handler first
  backHandlers.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.registeredAt - a.registeredAt;
  });

  // Ensure sentinel state is armed if in mobile view
  ensureSentinelState();
};

/**
 * Unregister a back button handler by ID
 */
export const unregisterBackHandler = (id) => {
  backHandlers = backHandlers.filter(h => h.id !== id);
};

/**
 * Ensure browser history has a sentinel entry so hardware back can be trapped
 */
export const ensureSentinelState = () => {
  if (typeof window === 'undefined') return;
  if (!isMobileOrAppView()) return;

  try {
    const currentState = window.history.state;
    if (!currentState || !currentState._nativeSentinel) {
      window.history.pushState(
        { ...currentState, _nativeSentinel: true, timestamp: Date.now() },
        '',
        window.location.href
      );
    }
  } catch (e) {
    console.warn('[NativeBackManager] Sentinel state push note:', e);
  }
};

/**
 * Primary back action resolver.
 * Returns true if the back event was handled and consumed, false otherwise.
 */
export const handleBackAction = (event) => {
  // Only handle on mobile or in an app wrapper
  if (!isMobileOrAppView()) {
    return false;
  }

  // 1. If we have active modal or drawer or tab handlers registered
  if (backHandlers.length > 0) {
    const topHandler = backHandlers[0];
    
    try {
      const result = topHandler.handler();
      
      // If handler did not explicitly return false, consider it consumed
      if (result !== false) {
        // Re-arm history sentinel so subsequent back presses are also trapped
        ensureSentinelState();
        if (event && event.preventDefault) {
          event.preventDefault();
        }
        return true;
      }
    } catch (err) {
      console.error(`[NativeBackManager] Error in back handler "${topHandler.id}":`, err);
    }
  }

  // 2. No modal/drawer or subtab handler active -> Root screen exit sequence
  if (isExitArmed) {
    // User pressed back again within 2000ms -> Allow exit
    isExitArmed = false;
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }

    // Call native app exit if available in Capacitor or Cordova
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && window.Capacitor.Plugins.App.exitApp) {
      window.Capacitor.Plugins.App.exitApp();
      return true;
    }
    if (navigator.app && typeof navigator.app.exitApp === 'function') {
      navigator.app.exitApp();
      return true;
    }
    if (navigator.device && typeof navigator.device.exitApp === 'function') {
      navigator.device.exitApp();
      return true;
    }

    // In mobile browser/PWA, let the default back pop pass through to close tab/app
    return false;
  }

  // First back press at root -> Show double tap toast & re-arm sentinel
  isExitArmed = true;
  ensureSentinelState();

  if (event && event.preventDefault) {
    event.preventDefault();
  }

  // Native subtle tactile vibration (40ms haptic tap)
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(40);
    } catch {
      // Haptics not allowed without prior user interaction
    }
  }

  notifyExitToast('Press back again to exit');

  // Reset exit threshold after 2000ms
  if (exitTimer) clearTimeout(exitTimer);
  exitTimer = setTimeout(() => {
    isExitArmed = false;
    exitTimer = null;
  }, 2000);

  return true;
};

/**
 * Initialize global event listeners once
 */
export const initNativeBackManager = () => {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  // Initial sentinel setup for mobile view
  if (isMobileOrAppView()) {
    ensureSentinelState();
  }

  // 1. Standard HTML5 popstate (Mobile Browser / Android WebView)
  const onPopState = (e) => {
    if (!isMobileOrAppView()) return;
    handleBackAction(e);
  };
  window.addEventListener('popstate', onPopState);

  // 2. Cordova / Capacitor native hardware backbutton event
  const onBackButton = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    handleBackAction(e);
  };
  document.addEventListener('backbutton', onBackButton, false);

  // 3. Modern Capacitor App Plugin if present
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      window.Capacitor.Plugins.App.addListener('backButton', (data) => {
        handleBackAction(data);
      });
    } catch {
      // ignore
    }
  }

  // Handle re-orientation / window resize to ensure sentinel remains ready
  window.addEventListener('resize', () => {
    if (isMobileOrAppView()) {
      ensureSentinelState();
    }
  });
};
