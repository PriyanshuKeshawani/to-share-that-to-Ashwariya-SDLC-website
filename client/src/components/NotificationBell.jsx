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
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
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
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-main)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 99
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="glass-panel animate-fade-in" style={{
            position: 'absolute',
            top: '44px',
            right: 0,
            width: '340px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 100,
            padding: 0,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Notifications</h4>
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
                    fontWeight: 600
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                <Bell size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p style={{ fontSize: '0.85rem' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    background: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: notif.is_read ? 400 : 600,
                      marginBottom: '2px'
                    }}>
                      {notif.title}
                    </div>
                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4
                    }}>
                      {notif.message}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      marginTop: '4px'
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
                      marginTop: '6px'
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
