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

    // 2. Unified Developer Card (Single clean card with 1-click active links, zero quote artifacts, no table noise)
    const cardContent = [
      '╭────────────────────────────────────────────────────────────╮',
      '│  🚀 DOMAINEXPANDERS // CORE ENGINEERING TEAM               │',
      '├────────────────────────────────────────────────────────────┤',
      '│  🏢 DOMAINEXPANDERS//                                      │',
      '│     🌐 https://www.domainexpanders.in/                     │',
      '│                                                            │',
      '│  👤 Anshul Soni (Senior Developer)                         │',
      '│     📸 https://www.instagram.com/otaku_anshul_             │',
      '│                                                            │',
      '│  👤 Adarah Mishra (Junior Developer & Non-Dev Works)       │',
      '│     📸 https://www.instagram.com/adarshmishra121325        │',
      '│                                                            │',
      '│  💡 Run anshul() or domainexpanders() in console to open   │',
      '╰────────────────────────────────────────────────────────────╯'
    ].join('\n');

    console.log(
      '%c' + cardContent,
      'color: #38bdf8; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; line-height: 1.45; font-weight: 600;'
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
