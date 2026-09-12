import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, X, BookOpen, CheckCheck, BellRing, Sparkles } from 'lucide-react';
import { requestNotificationPermission } from '../firebase';

const NotificationBell = () => {
  const { user, apiCall } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [pushStatus, setPushStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

  // Silently refresh token in Supabase if permission is already granted
  useEffect(() => {
    if (user && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      requestNotificationPermission(user).catch(() => {});
    }
  }, [user]);

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

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [notifs, unread] = await Promise.all([
        apiCall('/notifications'),
        apiCall('/notifications/unread-count')
      ]);
      setNotifications(notifs || []);
      setUnreadCount(unread?.count || 0);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  }, [user, apiCall]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!isMounted) return;
      await fetchNotifications();
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      setLoading(true);
      await apiCall('/notifications/mark-read', { method: 'POST' });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.warn('Failed to mark notifications as read:', err);
    } finally {
      setLoading(false);
    }
  };

  const markSingleRead = async (id) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await apiCall(`/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // Optimistic update already performed
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approval':
      case 'rejection':
        return <Check size={16} color="var(--success)" />;
      case 'download':
        return <BookOpen size={16} color="var(--primary)" />;
      default:
        return <Bell size={16} color="var(--primary)" />;
    }
  };

  const formatNotificationTime = (dateString) => {
    try {
      const d = new Date(dateString);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!user) return null;

  const displayedNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Bell Trigger Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary"
        style={{
          position: 'relative',
          padding: '8px',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          background: isOpen ? 'var(--primary-glow)' : undefined,
          borderColor: isOpen ? 'var(--primary)' : undefined,
        }}
        aria-label="Toggle notifications"
        aria-expanded={isOpen}
      >
        <Bell size={18} strokeWidth={2} className={unreadCount > 0 ? 'animate-bell-wiggle' : ''} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#ffffff',
            fontSize: '0.62rem',
            fontWeight: 800,
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-main)',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
            animation: 'pulseGlow 2s infinite'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown & Backdrop ── */}
      {isOpen && (
        <>
          {/* Subtle dimming backdrop to dismiss on click */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1199,
              background: 'rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              animation: 'fadeIn 0.15s ease'
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Opaque, elevated Popover Dialog */}
          <div
            className="notification-dropdown animate-fade-in-scale"
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              width: 'min(360px, calc(100vw - 32px))',
              maxHeight: '480px',
              zIndex: 1200,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-glass-hover)',
              boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-glass)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transformOrigin: 'top right'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 18px 12px',
              borderBottom: '1px solid var(--border-glass)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Bell size={15} strokeWidth={2.4} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.94rem', fontWeight: 800, margin: 0, lineHeight: 1.1, color: 'var(--text-primary)' }}>
                    Notifications
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={loading}
                    className="btn btn-secondary"
                    style={{
                      padding: '5px 9px',
                      fontSize: '0.72rem',
                      borderRadius: '8px',
                      height: 'auto',
                      fontWeight: 600,
                      gap: '4px'
                    }}
                    title="Mark all notifications as read"
                  >
                    <CheckCheck size={13} /> Read all
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
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Close notifications"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Push Notifications Enable Banner */}
            {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
              <div style={{
                padding: '10px 14px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(147, 51, 234, 0.14))',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BellRing size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.2 }}>
                    Live alerts for new books & approvals
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={pushEnabling}
                  className="btn btn-primary"
                  style={{
                    padding: '3px 9px',
                    fontSize: '0.7rem',
                    borderRadius: '6px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  {pushEnabling ? 'Enabling...' : 'Enable'}
                </button>
              </div>
            )}
            {pushMessage && (
              <div style={{
                padding: '6px 14px',
                fontSize: '0.68rem',
                background: pushStatus === 'granted' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: pushStatus === 'granted' ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)',
                fontWeight: 600
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
                background: 'var(--surface-glow)',
                borderBottom: '1px solid var(--border-glass)'
              }}>
                <button
                  onClick={() => setActiveTab('all')}
                  style={{
                    background: activeTab === 'all' ? 'var(--primary-glow)' : 'transparent',
                    color: activeTab === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                    border: activeTab === 'all' ? '1px solid var(--border-glass-focus)' : '1px solid transparent',
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
                    background: activeTab === 'unread' ? 'var(--primary-glow)' : 'transparent',
                    color: activeTab === 'unread' ? 'var(--primary)' : 'var(--text-muted)',
                    border: activeTab === 'unread' ? '1px solid var(--border-glass-focus)' : '1px solid transparent',
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
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '350px' }}>
              {displayedNotifications.length === 0 ? (
                <div style={{
                  padding: '44px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '18px',
                    background: 'var(--primary-glow)',
                    border: '1px solid var(--border-glass-focus)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)'
                  }}>
                    {activeTab === 'unread' ? (
                      <CheckCheck size={26} color="var(--success)" />
                    ) : (
                      <Bell size={26} color="var(--primary)" style={{ opacity: 0.8 }} />
                    )}
                  </div>
                  <h5 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {activeTab === 'unread' ? 'No unread alerts' : 'No notifications yet'}
                  </h5>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '240px', margin: '0 auto', lineHeight: 1.45 }}>
                    {activeTab === 'unread'
                      ? "You've read all your recent notifications!"
                      : "Book access requests and library announcements will appear here."}
                  </p>
                </div>
              ) : (
                displayedNotifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => !notif.is_read && markSingleRead(notif.id)}
                    style={{
                      padding: '13px 18px',
                      borderBottom: '1px solid var(--border-glass)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      background: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = notif.is_read 
                        ? 'rgba(255, 255, 255, 0.04)' 
                        : 'rgba(99, 102, 241, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = notif.is_read 
                        ? 'transparent' 
                        : 'rgba(99, 102, 241, 0.05)';
                    }}
                  >
                    <div style={{
                      marginTop: '2px',
                      flexShrink: 0,
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '6px',
                        marginBottom: '3px'
                      }}>
                        <span style={{
                          fontSize: '0.84rem',
                          fontWeight: notif.is_read ? 600 : 800,
                          color: notif.is_read ? 'var(--text-primary)' : 'var(--primary)',
                          lineHeight: 1.2
                        }}>
                          {notif.title}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          flexShrink: 0
                        }}>
                          {formatNotificationTime(notif.created_at)}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4
                      }}>
                        {notif.message}
                      </div>
                    </div>

                    {!notif.is_read && (
                      <span
                        title="Unread"
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          flexShrink: 0,
                          marginTop: '6px',
                          boxShadow: '0 0 8px var(--primary)'
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
                background: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-glass)',
                textAlign: 'center',
                fontSize: '0.72rem',
                color: 'var(--text-muted)'
              }}>
                Showing recent SISTec Library notifications
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
