import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, X, BookOpen, AlertTriangle } from 'lucide-react';

const NotificationBell = () => {
  const { user, apiCall } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [notifs, unread] = await Promise.all([
        apiCall('/notifications'),
        apiCall('/notifications/unread-count')
      ]);
      setNotifications(notifs);
      setUnreadCount(unread.count);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  }, [user, apiCall]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'loan': return <BookOpen size={16} color="var(--primary)" />;
      case 'return': return <Check size={16} color="var(--success)" />;
      case 'fine': return <AlertTriangle size={16} color="var(--warning)" />;
      default: return <Bell size={16} color="var(--text-secondary)" />;
    }
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }}>
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
          justifyContent: 'center'
        }}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-1px',
            right: '-1px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 700,
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-main)',
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
            animation: 'pulseGlow 2s infinite'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 99
            }}
            onClick={() => setIsOpen(false)}
          />
          
          <div className="glass-panel animate-fade-in notification-dropdown" style={{
            position: 'absolute',
            top: '46px',
            right: 0,
            width: '360px',
            maxHeight: '420px',
            overflowY: 'auto',
            zIndex: 100,
            padding: 0,
            boxShadow: 'var(--shadow-elevated)',
            borderRadius: '18px'
          }}>
            <div style={{
              padding: '16px 18px',
              borderBottom: '1px solid var(--border-glass)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-glow)'
            }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700 }}>Notifications</h4>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--secondary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.1)'}
                  onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 18px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Bell size={22} style={{ opacity: 0.5 }} />
                </div>
                <p style={{ fontSize: '0.88rem', fontWeight: 500 }}>No notifications yet</p>
                <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>You're all caught up!</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border-glass)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    background: notif.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.03)',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (notif.is_read) e.currentTarget.style.background = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (notif.is_read) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ 
                    marginTop: '2px', 
                    flexShrink: 0,
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: notif.type === 'loan' ? 'rgba(59, 130, 246, 0.1)' : notif.type === 'return' ? 'rgba(16, 185, 129, 0.1)' : notif.type === 'fine' ? 'rgba(245, 158, 11, 0.1)' : 'var(--input-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.84rem',
                      fontWeight: notif.is_read ? 500 : 700,
                      marginBottom: '3px',
                      color: 'var(--text-primary)'
                    }}>
                      {notif.title}
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45
                    }}>
                      {notif.message}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      marginTop: '5px'
                    }}>
                      {new Date(notif.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!notif.is_read && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      flexShrink: 0,
                      marginTop: '6px',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)'
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
