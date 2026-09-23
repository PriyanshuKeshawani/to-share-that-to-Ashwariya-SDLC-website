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

    // 1. Collapsed heading with stylish pill badge (Dark & Light mode friendly)
    groupCollapsed(
      '%c 🛠️ Developer Information %c DOMAINEXPANDERS // ',
      'background: #1e293b; color: #38bdf8; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 4px 0 0 4px; border: 1px solid #334155; font-family: system-ui, -apple-system, sans-serif;',
      'background: #2563eb; color: #ffffff; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 0 4px 4px 0; border: 1px solid #2563eb; font-family: system-ui, -apple-system, sans-serif;'
    );

    // 2. Card Header Banner Chips
    console.log(
      '%c DOMAINEXPANDERS // %c CORE DEV TEAM %c VERIFIED BUILD ',
      'background: #2563eb; color: #ffffff; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 4px 0 0 4px;',
      'background: #0f172a; color: #38bdf8; font-weight: 700; font-size: 11px; padding: 3px 8px; border: 1px solid #1e3a8a;',
      'background: #059669; color: #ffffff; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 0 4px 4px 0;'
    );

    // 3. Interactive Graphical Card Table (DevTools natively renders as a rich interactive card with 1-click hyperlinks)
    if (typeof console.table === 'function') {
      console.table([
        {
          'Developer / Organization': '🏢 DOMAINEXPANDERS//',
          'Role & Responsibilities': 'Engineering & Product Architecture',
          'Direct Profile Link (Clickable)': 'https://www.domainexpanders.in/'
        },
        {
          'Developer / Organization': '👨‍💻 Anshul Soni',
          'Role & Responsibilities': 'Senior Developer (Fullstack & Core)',
          'Direct Profile Link (Clickable)': 'https://www.instagram.com/otaku_anshul_'
        },
        {
          'Developer / Organization': '👨‍💻 Adarah Mishra',
          'Role & Responsibilities': 'Junior Developer & Non-Dev Works',
          'Direct Profile Link (Clickable)': 'https://www.instagram.com/adarshmishra121325'
        }
      ]);
    }

    // 4. Quick-access console shortcuts & pro-tip
    console.log(
      '%c💡 ProTip:%c Click any URL in the table above, or type %canshul()%c, %cadarsh()%c, or %cdomainexpanders()%c in the console to open directly.',
      'color: #38bdf8; font-weight: bold;',
      'color: #94a3b8;',
      'color: #fbbf24; font-family: monospace; font-weight: bold;',
      'color: #94a3b8;',
      'color: #fbbf24; font-family: monospace; font-weight: bold;',
      'color: #94a3b8;',
      'color: #fbbf24; font-family: monospace; font-weight: bold;',
      'color: #94a3b8;'
    );

    // 5. Register global console helper functions for effortless 1-command navigation
    if (typeof window !== 'undefined') {
      window.domainexpanders = () => {
        safeOpenUrl('https://www.domainexpanders.in/');
        return '🌐 Opening DomainExpanders official site...';
      };
      window.anshul = () => {
        safeOpenUrl('https://www.instagram.com/otaku_anshul_');
        return '👨‍💻 Opening Anshul Soni (Senior Developer) profile...';
      };
      window.adarsh = () => {
        safeOpenUrl('https://www.instagram.com/adarshmishra121325');
        return '👨‍💻 Opening Adarah Mishra profile...';
      };
    }

    groupEnd();
  } catch {
    // Fail silently without disrupting page execution or console state
  }
}
