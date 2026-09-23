/**
 * Developer Credits Utility
 *
 * Console-only engineering signature.
 * Displays developer information in the browser developer console only.
 * Does not render any UI elements, watermarks, or visible DOM changes.
 * Executes once on the client-side browser context.
 */

let isInitialized = false;

/**
 * Safely navigates to a trusted HTTPS URL in a new browser tab.
 * Enforces noopener and noreferrer behavior.
 * @param {string} url - Static trusted destination
 */
function safeOpenUrl(url) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return;
  try {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      newWindow.opener = null;
    }
  } catch {
    // Fail silently to prevent interrupting application flow
  }
}

/**
 * Initializes the console-only developer credit section.
 * Native console.groupCollapsed ensures initial output remains collapsed.
 */
export function initDeveloperCredits() {
  // Guard against SSR / server execution and double initialization
  if (typeof window === 'undefined' || typeof console === 'undefined' || isInitialized) {
    return;
  }
  isInitialized = true;

  try {
    const groupCollapsed = typeof console.groupCollapsed === 'function'
      ? console.groupCollapsed.bind(console)
      : console.log.bind(console);

    const groupEnd = typeof console.groupEnd === 'function'
      ? console.groupEnd.bind(console)
      : () => {};

    // 1. Collapsed heading (DevTools natively renders as '▶ 🛠️ Developer Information')
    groupCollapsed('%c🛠️ Developer Information', 'color: #64748b; font-weight: 600; font-size: 11px; padding: 2px 0;');

    // 2. Company entry: DOMAINEXPANDERS//
    console.log(
      '%cDOMAINEXPANDERS//\n%chttps://www.domainexpanders.in/',
      'color: #2563eb; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;',
      'color: #3b82f6; font-size: 11px; text-decoration: underline; cursor: pointer;'
    );

    // 3. Developer 1: Anshul Soni (Senior Developer)
    console.log(
      '%cAnshul Soni\n%c  Senior Developer\n  %chttps://www.instagram.com/otaku_anshul_',
      'color: #0f172a; font-weight: 600; font-size: 12px;',
      'color: #64748b; font-size: 11px;',
      'color: #2563eb; font-size: 11px; text-decoration: underline; cursor: pointer;'
    );

    // 4. Developer 2: Adarah Mishra (Junior Developer & Non-Development Works)
    console.log(
      '%cAdarah Mishra\n%c  Junior Developer & Non-Development Works\n  %chttps://www.instagram.com/adarshmishra121325',
      'color: #0f172a; font-weight: 600; font-size: 12px;',
      'color: #64748b; font-size: 11px;',
      'color: #2563eb; font-size: 11px; text-decoration: underline; cursor: pointer;'
    );

    // 5. Interactive getter object for safe programmatic navigation
    const interactiveLinks = {
      get 'DOMAINEXPANDERS//'() {
        safeOpenUrl('https://www.domainexpanders.in/');
        return 'https://www.domainexpanders.in/';
      },
      get 'Anshul Soni (Senior Developer)'() {
        safeOpenUrl('https://www.instagram.com/otaku_anshul_');
        return 'https://www.instagram.com/otaku_anshul_';
      },
      get 'Adarah Mishra (Junior Developer & Non-Development Works)'() {
        safeOpenUrl('https://www.instagram.com/adarshmishra121325');
        return 'https://www.instagram.com/adarshmishra121325';
      }
    };

    if (typeof console.dir === 'function') {
      console.dir(interactiveLinks);
    }

    groupEnd();
  } catch {
    // Fail silently without disrupting page execution or console state
  }
}
