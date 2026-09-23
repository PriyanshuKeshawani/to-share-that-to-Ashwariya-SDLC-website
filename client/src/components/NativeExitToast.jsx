import { useState, useEffect } from 'react';
import { onExitToast } from '../utils/nativeBackManager';

/**
 * NativeExitToast Component
 * 
 * Renders the classic Android native bottom toast: "Press back again to exit"
 * Displays when a user hits hardware Back on the root/home screen of the mobile view / APK.
 */
const NativeExitToast = () => {
  const [toastMessage, setToastMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onExitToast((msg) => {
      setToastMessage(msg || 'Press back again to exit');
      setIsVisible(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className="native-exit-toast-wrapper"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        pointerEvents: 'none',
        animation: 'nativeToastEntrance 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.94)',
          color: '#f8fafc',
          padding: '9px 18px',
          borderRadius: '9999px',
          fontSize: '0.82rem',
          fontWeight: 600,
          letterSpacing: '0.01em',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap'
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--primary, #6366f1)',
            display: 'inline-block'
          }}
        />
        <span>{toastMessage}</span>
      </div>
    </div>
  );
};

export default NativeExitToast;
