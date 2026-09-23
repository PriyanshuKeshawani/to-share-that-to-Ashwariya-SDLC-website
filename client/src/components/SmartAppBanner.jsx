import { useState, useEffect } from 'react';
import { Smartphone, X, ExternalLink } from 'lucide-react';

/**
 * SmartAppBanner Component
 * 
 * Displays a smart banner on mobile browsers offering to open the shared
 * book or library page directly inside the installed SISTec Android APK.
 * 
 * Uses Android Intent URLs and the custom scheme 'sisteclib://'
 */
const SmartAppBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [deepLinkData, setDeepLinkData] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Don't show inside Capacitor or native APK wrapper
    if (window.Capacitor || window.cordova || navigator.userAgent.includes('wv')) {
      return;
    }

    // Only show on mobile devices
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if (!isMobile) return;

    // Check if user dismissed banner recently
    try {
      const dismissed = sessionStorage.getItem('sistec_app_banner_dismissed');
      if (dismissed === 'true') return;
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book') || params.get('read');
    const projectId = params.get('project');

    // Show banner if viewing a specific book or project, or on first visit to catalog
    if (bookId || projectId || window.location.pathname.startsWith('/read/')) {
      setDeepLinkData({ bookId, projectId });
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem('sistec_app_banner_dismissed', 'true');
    } catch {}
  };

  const handleOpenInApp = () => {
    if (typeof window === 'undefined') return;

    const pathAndQuery = window.location.pathname + window.location.search;
    const cleanPath = pathAndQuery.replace(/^\/+/, '');
    const customSchemeUrl = `sistec-elibrary://${cleanPath}`;
    const altSchemeUrl = `sisteclib://${cleanPath}`;
    // Explicit Android Intent targeting the installed SISTec eLibrary package (com.sistec.elibrary)
    const androidIntentUrl = `intent://${window.location.host}${pathAndQuery}#Intent;scheme=https;package=com.sistec.elibrary;fallback_url=${encodeURIComponent(window.location.href)};end;`;

    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Direct intent to open APK
      window.location.href = androidIntentUrl;
      // Backup attempt via custom URI scheme after short timeout if intent doesn't grab immediately
      setTimeout(() => {
        window.location.href = customSchemeUrl;
      }, 350);
    } else {
      window.location.href = customSchemeUrl;
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="smart-app-banner"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.96) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
        animation: 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px'
          }}
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>

        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
            flexShrink: 0
          }}
        >
          <Smartphone size={20} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            SISTec Library App
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Open in installed app for the best experience
          </div>
        </div>
      </div>

      <button
        onClick={handleOpenInApp}
        className="btn btn-primary"
        style={{
          padding: '7px 14px',
          fontSize: '0.78rem',
          fontWeight: 700,
          borderRadius: '9999px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        <span>Open</span>
        <ExternalLink size={12} />
      </button>
    </div>
  );
};

export default SmartAppBanner;
