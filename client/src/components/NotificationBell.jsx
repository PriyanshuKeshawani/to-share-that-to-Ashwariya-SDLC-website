import { useState, useEffect, useCallback, useRef, Component } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, Check, X, BookOpen, CheckCheck, BellRing, 
  Megaphone, AlertTriangle, AlertCircle, Info,
  UserPlus, KeyRound, Download
} from 'lucide-react';
import { requestNotificationPermission, resolveUserUuid } from '../firebase';
import { supabase } from '../supabaseClient';

const isValidUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || '').trim());
const toDeterministicUuid = (str) => {
  if (!str) return '00000000-0000-4000-8000-000000000000';
  const clean = String(str).trim();
  if (isValidUuid(clean)) return clean;
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d, h3 = 0x9e3779b9, h4 = 0x27d4eb2f;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2246822519);
  }
  const toHex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  const rawHex = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).toLowerCase();
  return `${rawHex.slice(0, 8)}-${rawHex.slice(8, 12)}-4${rawHex.slice(13, 16)}-a${rawHex.slice(17, 20)}-${rawHex.slice(20, 32)}`;
};

const NotificationBell = ({ variant = 'icon' }) => {
  const { user, apiCall } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const buttonRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 'auto', right: 'auto', transformOrigin: 'top right' });
  const [pushStatus, setPushStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

  // Track responsive screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update popover coordinates on desktop
  const updatePosition = useCallback(() => {
    if (buttonRef.current && window.innerWidth >= 768) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isNearBottom = rect.bottom > window.innerHeight - 240;
      const isNearRight = rect.left > window.innerWidth / 2;

      if (isNearBottom) {
        // Pop upward from bottom sidebar button
        setDropdownCoords({
          top: 'auto',
          bottom: Math.max(16, window.innerHeight - rect.top + 8),
          left: Math.max(16, rect.left),
          right: 'auto',
          transformOrigin: 'bottom left'
        });
      } else if (isNearRight) {
        const top = Math.min(window.innerHeight - 520, Math.max(10, rect.bottom + 8));
        setDropdownCoords({
          top,
          bottom: 'auto',
          right: Math.max(12, window.innerWidth - rect.right),
          left: 'auto',
          transformOrigin: 'top right'
        });
      } else {
        const top = Math.min(window.innerHeight - 520, Math.max(10, rect.bottom + 8));
        const left = Math.min(window.innerWidth - 380, Math.max(12, rect.left));
        setDropdownCoords({
          top,
          bottom: 'auto',
          left,
          right: 'auto',
          transformOrigin: 'top left'
        });
      }
    }
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  // Close on Escape or outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Audio chime for new notifications
  const playChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy fallback
    }
  }, []);

  // Fetch notification list and unread count
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [notifs, unread] = await Promise.all([
        apiCall('/notifications'),
        apiCall('/notifications/unread-count')
      ]);
      setNotifications(Array.isArray(notifs) ? notifs : []);
      setUnreadCount(typeof unread?.count === 'number' ? unread.count : 0);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  }, [user, apiCall]);

  // Initial load, Realtime subscription, local event & focus sync
  useEffect(() => {
    if (!user) return;

    let isCancelled = false;
    let channel = null;

    const setupLiveAlerts = async () => {
      let effectiveUserId = user?.id;
      if (user?.role === 'admin') {
        effectiveUserId = (effectiveUserId && isValidUuid(effectiveUserId) && !String(effectiveUserId).includes('branch-'))
          ? effectiveUserId 
          : '0271446c-5515-4406-9c4d-19fe5d4e9c9a';
      } else if (!isValidUuid(effectiveUserId)) {
        const resolved = await resolveUserUuid(user);
        effectiveUserId = resolved || (effectiveUserId ? toDeterministicUuid(effectiveUserId) : null);
      }

      if (isCancelled || !effectiveUserId) return;

      // 1. Instant Supabase Realtime WebSocket subscription
      try {
        const channelId = `bell-${effectiveUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        channel = supabase
          .channel(channelId)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${effectiveUserId}`
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                if (payload.new) {
                  setNotifications(prev => [payload.new, ...prev.filter(n => n.id !== payload.new.id)]);
                  setUnreadCount(prev => prev + 1);
                  playChime();

                  // Display native desktop / mobile browser notification banner if permission granted
                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    try {
                      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.ready.then(reg => {
                          reg.showNotification(payload.new.title || 'SISTec Central Library', {
                            body: payload.new.message || 'New library notification',
                            icon: '/logo.png',
                            badge: '/favicon.png',
                            tag: `notif-${payload.new.id}`,
                            renotify: true,
                            data: { url: '/' }
                          });
                        }).catch(() => {
                          new Notification(payload.new.title || 'SISTec Central Library', {
                            body: payload.new.message || 'New library notification',
                            icon: '/logo.png'
                          });
                        });
                      } else {
                        new Notification(payload.new.title || 'SISTec Central Library', {
                          body: payload.new.message || 'New library notification',
                          icon: '/logo.png'
                        });
                      }
                    } catch (bannerErr) {
                      console.warn('Native notification banner notice:', bannerErr);
                    }
                  }
                }
              } else {
                fetchNotifications();
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime notifications subscribe notice:', e?.message);
      }
    };

    fetchNotifications();
    setupLiveAlerts();

    // 2. Custom event listener for instant local test / broadcast events
    const handleLocalRefresh = () => {
      fetchNotifications();
      playChime();
    };
    window.addEventListener('library:notification-refresh', handleLocalRefresh);

    // 3. Window focus listener: immediately sync when user tabs back
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    // 4. Periodic background sync (every 15s)
    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      isCancelled = true;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
      window.removeEventListener('library:notification-refresh', handleLocalRefresh);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [user, fetchNotifications, playChime]);

  // Mark all notifications as read
  const markAllRead = async () => {
    try {
      setLoading(true);
      // Optimistic update
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      await apiCall('/notifications/mark-read', { method: 'POST' });
    } catch (err) {
      console.warn('Failed to mark notifications as read:', err);
      fetchNotifications();
    } finally {
      setLoading(false);
    }
  };

  // Mark a single notification as read
  const markSingleRead = async (id) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await apiCall(`/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // Optimistic update retained
    }
  };

  // Enable live browser push notifications
  const handleEnablePush = async () => {
    setPushEnabling(true);
    setPushMessage('');
    try {
      const res = await requestNotificationPermission(user);
      if (res.success) {
        setPushStatus('granted');
        setPushMessage('Live push alerts enabled on this device!');
        setTimeout(() => setPushMessage(''), 4000);
      } else {
        setPushMessage(res.error || 'Could not enable push notifications.');
      }
    } catch (err) {
      setPushMessage(err.message || 'Error enabling notifications');
    } finally {
      setPushEnabling(false);
    }
  };

  // Map notification types to icons
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'announcement':
        return <Megaphone size={16} color="#a855f7" />;
      case 'approval':
        return <Check size={16} color="#10b981" />;
      case 'rejection':
        return <X size={16} color="#ef4444" />;
      case 'book':
        return <BookOpen size={16} color="var(--primary, #6366f1)" />;
      case 'student':
        return <UserPlus size={16} color="#06b6d4" />;
      case 'download':
        return <Download size={16} color="#3b82f6" />;
      case 'access':
        return <KeyRound size={16} color="#f59e0b" />;
      case 'warning':
      case 'system':
        return <AlertTriangle size={16} color="#f59e0b" />;
      case 'alert':
      case 'danger':
        return <AlertCircle size={16} color="#ef4444" />;
      case 'info':
        return <Info size={16} color="#38bdf8" />;
      default:
        return <Bell size={16} color="var(--primary, #6366f1)" />;
    }
  };

  // Map notification types to pill background color
  const getNotificationBg = (type) => {
    switch (type) {
      case 'announcement':
        return 'rgba(168, 85, 247, 0.15)';
      case 'approval':
        return 'rgba(16, 185, 129, 0.15)';
      case 'rejection':
      case 'alert':
      case 'danger':
        return 'rgba(239, 68, 68, 0.15)';
      case 'book':
        return 'rgba(99, 102, 241, 0.15)';
      case 'student':
        return 'rgba(6, 182, 212, 0.15)';
      case 'download':
        return 'rgba(59, 130, 246, 0.15)';
      case 'access':
      case 'warning':
      case 'system':
        return 'rgba(245, 158, 11, 0.15)';
      case 'info':
        return 'rgba(56, 189, 248, 0.15)';
      default:
        return 'rgba(99, 102, 241, 0.12)';
    }
  };

  // Human-friendly relative timestamp formatter
  const formatNotificationTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSeconds < 60) {
        return 'Just now';
      }
      if (diffMinutes < 60) {
        return `${diffMinutes} min ago`;
      }
      if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      }
      if (diffDays === 1) {
        return 'Yesterday';
      }
      if (diffDays < 7) {
        return `${diffDays} days ago`;
      }
      
      // Older records: "12 Sep 2026"
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  if (!user) return null;

  const displayedNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div style={{ position: 'relative', display: variant === 'sidebar' ? 'block' : 'inline-flex', width: variant === 'sidebar' ? '100%' : 'auto', alignItems: 'center' }}>
      {/* ── Bell Trigger Button (Sidebar variant vs Compact Icon variant) ── */}
      {variant === 'sidebar' ? (
        <button
          ref={buttonRef}
          onClick={toggleOpen}
          className={`btn ${isOpen ? 'btn-primary' : 'btn-secondary'} notification-bell-sidebar-trigger`}
          style={{
            position: 'relative',
            width: '100%',
            padding: '9px 14px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '10px',
            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            background: isOpen ? 'var(--primary-glow, rgba(99, 102, 241, 0.15))' : undefined,
            borderColor: isOpen ? 'var(--primary, #6366f1)' : undefined,
            cursor: 'pointer'
          }}
          title="Open Notifications"
          aria-label={`Notifications (${unreadCount} unread)`}
          aria-expanded={isOpen}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell 
              size={16} 
              strokeWidth={2.2} 
              className={unreadCount > 0 ? 'animate-bell-wiggle' : ''} 
              style={{ color: unreadCount > 0 ? 'var(--primary, #6366f1)' : undefined }}
            />
            <span style={{ fontWeight: 600 }}>Notifications</span>
          </div>
          {unreadCount > 0 ? (
            <span 
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                fontSize: '0.64rem',
                fontWeight: 800,
                borderRadius: '999px',
                minWidth: '18px',
                height: '18px',
                padding: '0 5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>0</span>
          )}
        </button>
      ) : (
        <button
          ref={buttonRef}
          onClick={toggleOpen}
          className="btn btn-secondary notification-bell-trigger"
          style={{
            position: 'relative',
            padding: '7px',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            minWidth: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            background: isOpen ? 'var(--primary-glow, rgba(99, 102, 241, 0.15))' : undefined,
            borderColor: isOpen ? 'var(--primary, #6366f1)' : undefined,
            cursor: 'pointer',
            flexShrink: 0
          }}
          title="Notifications"
          aria-label={`Notifications (${unreadCount} unread)`}
          aria-expanded={isOpen}
        >
          <Bell 
            size={18} 
            strokeWidth={2.2} 
            className={unreadCount > 0 ? 'animate-bell-wiggle' : ''} 
            style={{ color: unreadCount > 0 ? 'var(--primary, #6366f1)' : 'var(--text-secondary)' }}
          />
          {unreadCount > 0 && (
            <span 
              className="notification-bell-badge"
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                fontSize: '0.62rem',
                fontWeight: 800,
                borderRadius: '999px',
                minWidth: '17px',
                height: '17px',
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-surface, #0f172a)',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.55)',
                animation: 'pulseGlow 2s infinite',
                lineHeight: 1,
                pointerEvents: 'none'
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* ── Modal / Drawer via Portal ── */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99998,
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              animation: 'fadeIn 0.15s ease'
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Panel: Responsive Bottom Sheet on Mobile (<768px), Anchored Popover on Desktop (>=768px) */}
          <div
            className={`notification-panel-container ${isMobile ? 'notification-sheet-mobile' : 'notification-dropdown animate-fade-in-scale'}`}
            style={isMobile ? {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              width: '100vw',
              maxWidth: '100vw',
              maxHeight: '85vh',
              zIndex: 99999,
              background: 'var(--bg-surface, #0f172a)',
              borderTop: '1px solid var(--border-glass-hover, rgba(255, 255, 255, 0.15))',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6), 0 -1px 0 rgba(255, 255, 255, 0.1)',
              borderRadius: '24px 24px 0 0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))'
            } : {
              position: 'fixed',
              top: dropdownCoords.top !== 'auto' ? dropdownCoords.top : undefined,
              bottom: dropdownCoords.bottom !== 'auto' ? dropdownCoords.bottom : undefined,
              left: dropdownCoords.left !== 'auto' ? dropdownCoords.left : undefined,
              right: dropdownCoords.right !== 'auto' ? dropdownCoords.right : undefined,
              width: 'min(380px, calc(100vw - 32px))',
              maxHeight: '520px',
              zIndex: 99999,
              background: 'var(--bg-surface, #0f172a)',
              border: '1px solid var(--border-glass-hover, rgba(255, 255, 255, 0.12))',
              boxShadow: '0 24px 60px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border-glass, rgba(255, 255, 255, 0.08))',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transformOrigin: dropdownCoords.transformOrigin || 'top right'
            }}
          >
            {/* Mobile Drag Indicator Handle */}
            {isMobile && (
              <div 
                style={{
                  width: '40px',
                  height: '4px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.25)',
                  margin: '10px auto 4px',
                  flexShrink: 0
                }}
              />
            )}

            {/* Header */}
            <div style={{
              padding: isMobile ? '12px 18px' : '16px 18px 12px',
              borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
              background: 'var(--bg-surface, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '9px',
                  background: 'var(--primary-glow, rgba(99, 102, 241, 0.15))',
                  color: 'var(--primary, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Bell size={16} strokeWidth={2.4} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0, lineHeight: 1.15, color: 'var(--text-primary)' }}>
                    Notifications
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: unreadCount > 0 ? 'var(--primary, #6366f1)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={loading}
                    className="btn btn-secondary"
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.72rem',
                      borderRadius: '8px',
                      height: 'auto',
                      fontWeight: 600,
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                    title="Mark all notifications as read"
                  >
                    <CheckCheck size={13} /> Mark all as read
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    minHeight: '32px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.color = 'var(--text-primary)'; 
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; 
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.color = 'var(--text-muted)'; 
                    e.currentTarget.style.background = 'transparent'; 
                  }}
                  aria-label="Close notifications"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Push Notifications Enable Banner */}
            {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
              <div style={{
                padding: '9px 16px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(168, 85, 247, 0.14))',
                borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <BellRing size={15} color="var(--primary, #6366f1)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Receive instant alerts on this device
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={pushEnabling}
                  className="btn btn-primary"
                  style={{
                    padding: '3px 9px',
                    fontSize: '0.68rem',
                    borderRadius: '6px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  {pushEnabling ? 'Enabling...' : 'Enable'}
                </button>
              </div>
            )}

            {pushMessage && (
              <div style={{
                padding: '6px 16px',
                fontSize: '0.68rem',
                background: pushStatus === 'granted' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: pushStatus === 'granted' ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {pushMessage}
              </div>
            )}

            {/* Filter Tabs (All / Unread) */}
            {notifications.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '8px 18px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setActiveTab('all')}
                  style={{
                    background: activeTab === 'all' ? 'var(--primary-glow, rgba(99, 102, 241, 0.15))' : 'transparent',
                    color: activeTab === 'all' ? 'var(--primary, #6366f1)' : 'var(--text-muted)',
                    border: activeTab === 'all' ? '1px solid var(--border-glass-focus, rgba(99, 102, 241, 0.3))' : '1px solid transparent',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveTab('unread')}
                  style={{
                    background: activeTab === 'unread' ? 'var(--primary-glow, rgba(99, 102, 241, 0.15))' : 'transparent',
                    color: activeTab === 'unread' ? 'var(--primary, #6366f1)' : 'var(--text-muted)',
                    border: activeTab === 'unread' ? '1px solid var(--border-glass-focus, rgba(99, 102, 241, 0.3))' : '1px solid transparent',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            )}

            {/* Notification Items List */}
            <div 
              style={{ 
                overflowY: 'auto', 
                flex: 1, 
                maxHeight: isMobile ? '55vh' : '380px',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {displayedNotifications.length === 0 ? (
                /* Empty State */
                <div style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '18px',
                    background: 'var(--primary-glow, rgba(99, 102, 241, 0.12))',
                    border: '1px solid var(--border-glass-focus, rgba(99, 102, 241, 0.25))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)'
                  }}>
                    {activeTab === 'unread' ? (
                      <CheckCheck size={26} color="var(--success, #10b981)" />
                    ) : (
                      <Bell size={26} color="var(--primary, #6366f1)" style={{ opacity: 0.8 }} />
                    )}
                  </div>
                  <h5 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </h5>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '240px', margin: '0 auto', lineHeight: 1.45 }}>
                    {activeTab === 'unread'
                      ? "You're all caught up."
                      : "You're all caught up."}
                  </p>
                </div>
              ) : (
                displayedNotifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => !notif.is_read && markSingleRead(notif.id)}
                    style={{
                      padding: '13px 18px',
                      borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.06))',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      background: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.07)',
                      cursor: notif.is_read ? 'default' : 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!notif.is_read) {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                      } else {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = notif.is_read 
                        ? 'transparent' 
                        : 'rgba(99, 102, 241, 0.07)';
                    }}
                  >
                    {/* Icon pill */}
                    <div style={{
                      marginTop: '2px',
                      flexShrink: 0,
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: getNotificationBg(notif.type),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      {getNotificationIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '8px',
                        marginBottom: '3px'
                      }}>
                        <span style={{
                          fontSize: '0.84rem',
                          fontWeight: notif.is_read ? 600 : 800,
                          color: notif.is_read ? 'var(--text-primary)' : 'var(--primary, #6366f1)',
                          lineHeight: 1.25,
                          wordBreak: 'break-word'
                        }}>
                          {notif.title}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          whiteSpace: 'nowrap'
                        }}>
                          {formatNotificationTime(notif.created_at)}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word'
                      }}>
                        {notif.message}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!notif.is_read && (
                      <span
                        title="Unread notification"
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: 'var(--primary, #6366f1)',
                          flexShrink: 0,
                          marginTop: '6px',
                          boxShadow: '0 0 8px var(--primary, #6366f1)'
                        }}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div style={{
                padding: '10px 18px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderTop: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                textAlign: 'center',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                flexShrink: 0
              }}>
                SISTec Digital Library Notifications
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

class NotificationBellErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('NotificationBell caught non-fatal exception:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <button className="btn-icon" style={{ opacity: 0.6 }} title="Notifications">
          <Bell size={18} />
        </button>
      );
    }
    return this.props.children;
  }
}

export default function SafeNotificationBell(props) {
  return (
    <NotificationBellErrorBoundary>
      <NotificationBell {...props} />
    </NotificationBellErrorBoundary>
  );
}
