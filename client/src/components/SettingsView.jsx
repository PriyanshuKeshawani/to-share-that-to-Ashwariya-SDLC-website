import { useState, useEffect, useCallback } from 'react';
import { 
  Sun, Moon, Palette, Check, User, Shield, Laptop,
  Bell, Send, Volume2, Radio, Sparkles, AlertCircle, Info, CheckCircle2, 
  AlertTriangle, Users, BookOpen, Clock, Loader2, RefreshCw, Megaphone,
  LogOut
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const OFFICIAL_BRANCHES = [
  'CSE (Computer Science & Engineering)',
  'CSE (Artificial Intelligence & Data Science)',
  'IT (Information Technology)',
  'ECE (Electronics & Communication Engineering)',
  'Cyber Security',
  'Civil Engineering',
  'Mechanical Engineering (ME)',
  'Electrical Engineering (EX/EE)',
  'B.Pharm',
  'M.Pharm (Pharmaceutical Chemistry)',
  'M.Pharm (Pharmaceutics)',
  'BBA',
  'MBA',
  'M.Tech CSE',
  'CTM (Construction Technology & Management)',
  'SE (Structural Engineering)',
  'Machine Design',
  'Thermal Engineering',
  'Digital Communication',
  'VLSI Design'
];

const NOTIF_TYPES = [
  { id: 'announcement', label: 'Announcement', icon: Megaphone, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.14)' },
  { id: 'info', label: 'Notice / Info', icon: Info, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)' },
  { id: 'success', label: 'Good News / Approval', icon: CheckCircle2, color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)' },
  { id: 'warning', label: 'Reminder / Warning', icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' },
  { id: 'alert', label: 'Urgent Alert', icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)' }
];

const QUICK_TEMPLATES = [
  {
    label: '📚 New Books Arrived',
    title: 'New Books Added to Central Library',
    message: 'Exciting new reference books, textbooks, and syllabus guides have just been added to the Central Library portal for the current semester.',
    type: 'announcement'
  },
  {
    label: '⏰ Extended Study Hours',
    title: 'Extended Library & Reading Hours',
    message: 'The Central Library and e-portal reading access will remain open with extended hours to support students preparing for upcoming examinations.',
    type: 'info'
  },
  {
    label: '⚠️ Book Review Reminder',
    title: 'Annual Library Inventory & Book Review',
    message: 'All students are kindly requested to verify their issued digital textbooks and complete their reading progress reviews this week.',
    type: 'warning'
  },
  {
    label: '🚨 Urgent Department Notice',
    title: 'Important Academic Curriculum Notice',
    message: 'Department faculty has released updated reference publications. Please access your branch collection to view available reading materials.',
    type: 'alert'
  }
];

const SettingsView = ({ isAdmin = false }) => {
  const {
    mode,
    toggleMode,
    paletteId,
    selectPalette,
    palettes
  } = useTheme();

  const { user, logout, apiCall } = useAuth();
  const isDark = mode === 'dark';

  // Account Session & Logout States
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ── Admin Notification States ──
  const [branches, setBranches] = useState(OFFICIAL_BRANCHES);
  const [targetAudience, setTargetAudience] = useState('all_students'); // 'all_students' | 'branch' | 'all_users'
  const [selectedBranch, setSelectedBranch] = useState(OFFICIAL_BRANCHES[0]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState('announcement');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState(null);

  // Self Test state
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Broadcast History state
  const [recentBroadcasts, setRecentBroadcasts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchBroadcastHistory = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('action_type', 'admin_broadcast_notification')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!error && data) {
        setRecentBroadcasts(data);
      }
    } catch (err) {
      console.warn('Notice fetching broadcast history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadBranches = async () => {
      try {
        const { data, error } = await supabase.from('branches').select('name').order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          const names = Array.from(new Set(data.map(b => b.name).filter(Boolean)));
          if (names.length >= 10) {
            setBranches(names);
            setSelectedBranch(names[0]);
          }
        }
      } catch (err) {
        console.warn('Using default official branches:', err);
      }
    };
    loadBranches();
    fetchBroadcastHistory();
  }, [isAdmin, fetchBroadcastHistory]);

  const handleSelfTest = async () => {
    setIsTestingNotification(true);
    setTestResult(null);
    try {
      // 1. Play dual-harmonic audio chime via Web Audio API (works 100% reliably on all devices)
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (audioErr) {
        console.warn('Web Audio synthesis notice:', audioErr);
      }

      // Also trigger audio file playback
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch {}

      // 2. Insert test alert into notifications via secure backend endpoint
      await apiCall('/notifications/test', { method: 'POST' });

      // 3. Immediately trigger local NotificationBell sync
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('library:notification-refresh'));
      }

      // 4. Native desktop notification if permission granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('SISTec Library Diagnostic Test', {
            body: 'Notification chime & alert system are active!',
            icon: '/logo.png'
          });
        } catch {}
      }

      setTestResult({
        success: true,
        message: 'Notification chime played and test alert added to your bell icon (top right)!'
      });
    } catch (err) {
      console.error('Test notification failure:', err);
      setTestResult({
        success: false,
        message: err.message || 'Error triggering test notification'
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const applyTemplate = (tpl) => {
    setNotifTitle(tpl.title);
    setNotifMessage(tpl.message);
    setNotifType(tpl.type);
    setBroadcastStatus(null);
  };

  const handleSendBroadcast = async (e) => {
    e?.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      setBroadcastStatus({ success: false, message: 'Please provide both a Title and a Message.' });
      return;
    }

    setIsBroadcasting(true);
    setBroadcastStatus(null);

    try {
      // 1. Fetch targeted users from Supabase
      let query = supabase.from('users').select('id, full_name, username, branch_name, role, status');
      
      if (targetAudience === 'all_students') {
        query = query.eq('role', 'student').eq('status', 'approved');
      } else if (targetAudience === 'branch') {
        query = query.eq('role', 'student').eq('status', 'approved');
      } else if (targetAudience === 'all_users') {
        query = query.eq('status', 'approved');
      }

      const { data: targetUsers, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      let recipients = targetUsers || [];
      if (targetAudience === 'branch') {
        recipients = recipients.filter(u => {
          const userBranch = (u.branch_name || '').toLowerCase().trim();
          const target = selectedBranch.toLowerCase().trim();
          return userBranch === target || userBranch.includes(target) || target.includes(userBranch);
        });
      }

      if (recipients.length === 0) {
        setBroadcastStatus({ 
          success: false, 
          message: `No approved users found for target: ${targetAudience === 'branch' ? selectedBranch : 'selected audience'}.` 
        });
        setIsBroadcasting(false);
        return;
      }

      // 2. Prepare notification rows
      const notifRows = recipients.map(r => ({
        user_id: r.id,
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        type: notifType,
        is_read: false
      }));

      // 3. Batch insert in chunks of 100
      const CHUNK_SIZE = 100;
      for (let i = 0; i < notifRows.length; i += CHUNK_SIZE) {
        const chunk = notifRows.slice(i, i + CHUNK_SIZE);
        const { error: insErr } = await supabase.from('notifications').insert(chunk);
        if (insErr) throw insErr;
      }

      // 4. Log in activity_logs
      const targetLabel = targetAudience === 'all_students'
        ? 'All Approved Students'
        : targetAudience === 'branch'
        ? `Department: ${selectedBranch}`
        : 'All Registered Portal Users';

      if (user?.id) {
        const isValidUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || '').trim());
        const effectiveAdminId = isValidUuid(user.id) ? user.id : null;
        if (effectiveAdminId) {
          await supabase.from('activity_logs').insert([{
            user_id: effectiveAdminId,
            action_type: 'admin_broadcast_notification',
            details: `Broadcast sent to ${targetLabel} (${recipients.length} recipients): "${notifTitle.trim()}"`
          }]);
        }
      }

      // 5. Play chime on admin screen
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('library:notification-refresh'));
      }

      setBroadcastStatus({
        success: true,
        message: `Successfully broadcasted to ${recipients.length} ${targetAudience === 'branch' ? selectedBranch + ' ' : ''}user(s) in real-time! Their screens and bells will update automatically without page refresh.`
      });

      // Reset form fields
      setNotifTitle('');
      setNotifMessage('');
      fetchBroadcastHistory();
    } catch (err) {
      console.error('Error broadcasting notification:', err);
      setBroadcastStatus({
        success: false,
        message: err.message || 'Failed to dispatch broadcast notification.'
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Settings & Appearance
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Personalize your library portal interface, select color palettes, and view account details
        </p>
      </div>

      {/* ── Section 1: Theme Mode ── */}
      <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ 
            padding: '10px', borderRadius: '12px', 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(6, 182, 212, 0.08))', 
            color: 'var(--primary)' 
          }}>
            <Laptop size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Theme Mode</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Choose between dark academic study mode or crisp daylight mode</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Dark Mode Card */}
          <div
            onClick={() => { if (!isDark) toggleMode(); }}
            style={{
              padding: '18px',
              borderRadius: '14px',
              border: isDark ? '2px solid var(--primary)' : '1.5px solid var(--border-glass)',
              background: isDark ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: isDark ? 'var(--shadow-glow-primary)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: '#0a0f1d', color: '#38bdf8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Moon size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Dark Academic</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Comfortable night reading</div>
              </div>
            </div>
            {isDark && (
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                background: 'var(--primary)', color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}>
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </div>

          {/* Light Mode Card */}
          <div
            onClick={() => { if (isDark) toggleMode(); }}
            style={{
              padding: '18px',
              borderRadius: '14px',
              border: !isDark ? '2px solid var(--primary)' : '1.5px solid var(--border-glass)',
              background: !isDark ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: !isDark ? 'var(--shadow-glow-primary)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: '#ffffff', color: '#f59e0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}>
                <Sun size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Daylight Campus</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>High contrast daylight</div>
              </div>
            </div>
            {!isDark && (
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                background: 'var(--primary)', color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}>
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Color Palettes ── */}
      <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ 
            padding: '10px', borderRadius: '12px', 
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.08))', 
            color: 'var(--secondary)' 
          }}>
            <Palette size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Institutional Color Palettes</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Select your primary college accent and button highlights</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }}>
          {palettes.filter(p => p.id !== 'custom').map((p) => {
            const isSelected = paletteId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => selectPalette(p.id)}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: isSelected ? `2px solid ${p.primary}` : '1.5px solid var(--border-glass)',
                  background: isSelected ? `${p.primary}08` : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ 
                      width: '22px', height: '22px', borderRadius: '50%', 
                      background: p.primary, 
                      border: '2px solid rgba(255,255,255,0.15)',
                      boxShadow: `0 2px 6px ${p.primary}40`
                    }} />
                    <div style={{ 
                      width: '22px', height: '22px', borderRadius: '50%', 
                      background: p.secondary, marginLeft: '-10px', 
                      border: '2px solid rgba(255,255,255,0.15)',
                      boxShadow: `0 2px 6px ${p.secondary}40`
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.primary}</div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ 
                    width: '20px', height: '20px', borderRadius: '50%', 
                    background: p.primary, color: '#fff', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 2px 8px ${p.primary}40`
                  }}>
                    <Check size={13} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Admin Section: Notification Diagnostic & Self-Test ── */}
      {isAdmin && (
        <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                padding: '10px', borderRadius: '12px', 
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(168, 85, 247, 0.12))', 
                color: 'var(--primary)' 
              }}>
                <Volume2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  Notification Diagnostics & Audio Self-Test
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Test live notification sound chime, top-right bell counters, and desktop alerts
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSelfTest}
              disabled={isTestingNotification}
              className="btn btn-primary"
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)'
              }}
            >
              {isTestingNotification ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Testing System...
                </>
              ) : (
                <>
                  <Bell size={16} />
                  Test Sound Chime & Bell Alert
                </>
              )}
            </button>
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
            Clicking this button triggers the <strong>/sounds/notification.mp3</strong> chime and inserts an immediate real-time test notification into your administrator account. Check the notification bell icon at the top right to verify that unread counter badge and popup list update dynamically without reloading.
          </p>

          {testResult && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: testResult.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: testResult.success ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
              color: testResult.success ? 'var(--success)' : 'var(--danger)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Admin Section: Custom Broadcast Notification Center ── */}
      {isAdmin && (
        <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px', border: '1.5px solid rgba(168, 85, 247, 0.25)' }}>
          <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                padding: '10px', borderRadius: '12px', 
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.12))', 
                color: '#a855f7' 
              }}>
                <Radio size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                    Instant Realtime Broadcast Dispatcher
                  </h3>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(168, 85, 247, 0.16)',
                    color: '#a855f7',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}>
                    Live Sync
                  </span>
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Dispatch custom notices, book announcements, or alerts to all students or specific departments in real-time
                </span>
              </div>
            </div>
          </div>

          {/* Quick Pre-Set Templates */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              fontWeight: 700, 
              display: 'block', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              marginBottom: '8px' 
            }}>
              Quick 1-Click Templates
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {QUICK_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    padding: '7px 13px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-glass)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <Sparkles size={13} color="var(--primary)" />
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSendBroadcast}>
            {/* Target Audience Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                fontWeight: 700, 
                display: 'block', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                marginBottom: '8px' 
              }}>
                Target Audience
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {[
                  { id: 'all_students', title: 'All Approved Students', desc: 'Broadcast to all enrolled students' },
                  { id: 'branch', title: 'Specific Department / Branch', desc: 'Target a particular academic branch' },
                  { id: 'all_users', title: 'All Portal Users', desc: 'Includes both students and administrators' }
                ].map(aud => {
                  const isSel = targetAudience === aud.id;
                  return (
                    <div
                      key={aud.id}
                      onClick={() => setTargetAudience(aud.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: isSel ? '2px solid var(--primary)' : '1.5px solid var(--border-glass)',
                        background: isSel ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{aud.title}</span>
                        {isSel && <Check size={15} color="var(--primary)" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3, display: 'block' }}>
                        {aud.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Branch Dropdown (When branch is targeted) */}
            {targetAudience === 'branch' && (
              <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '12px', background: 'var(--input-bg)', border: '1px solid var(--border-glass)' }}>
                <label style={{ 
                  fontSize: '0.78rem', 
                  color: 'var(--text-secondary)', 
                  fontWeight: 700, 
                  display: 'block', 
                  marginBottom: '8px' 
                }}>
                  Select College Academic Department (All 20 Official Branches Available):
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  {branches.map((b, idx) => (
                    <option key={idx} value={b} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notification Type Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                fontWeight: 700, 
                display: 'block', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                marginBottom: '8px' 
              }}>
                Notification Category & Color Accent
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {NOTIF_TYPES.map(nt => {
                  const isSel = notifType === nt.id;
                  const IconComp = nt.icon;
                  return (
                    <button
                      key={nt.id}
                      type="button"
                      onClick={() => setNotifType(nt.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: isSel ? `2px solid ${nt.color}` : '1.5px solid var(--border-glass)',
                        background: isSel ? nt.bg : 'var(--bg-card)',
                        color: isSel ? nt.color : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <IconComp size={15} color={nt.color} />
                      <span>{nt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notification Title Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                fontWeight: 700, 
                display: 'block', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                marginBottom: '6px' 
              }}>
                Notification Title *
              </label>
              <input
                type="text"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="e.g., Important Notice: New Engineering Reference Books Available"
                className="input-field"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  fontWeight: 600
                }}
              />
            </div>

            {/* Notification Message Textarea */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                fontWeight: 700, 
                display: 'block', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                marginBottom: '6px' 
              }}>
                Notification Message Body *
              </label>
              <textarea
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Write the full notification message to be delivered instantly to users' notification bells and screens..."
                rows={3}
                className="input-field"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Live Card Preview */}
            <div style={{ marginBottom: '22px', padding: '16px 20px', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px dashed var(--border-glass)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '10px' }}>
                Live Student Bell Dropdown Preview
              </span>
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: NOTIF_TYPES.find(t => t.id === notifType)?.bg || 'rgba(59, 130, 246, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {(() => {
                    const found = NOTIF_TYPES.find(t => t.id === notifType);
                    const Comp = found?.icon || Bell;
                    return <Comp size={16} color={found?.color || 'var(--primary)'} />;
                  })()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {notifTitle || 'Notification Title Preview'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Just now</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {notifMessage || 'Notification message description will appear here on recipients devices...'}
                  </p>
                </div>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '6px' }} />
              </div>
            </div>

            {/* Broadcast Status Alerts */}
            {broadcastStatus && (
              <div style={{
                padding: '14px 18px',
                borderRadius: '12px',
                marginBottom: '20px',
                background: broadcastStatus.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: broadcastStatus.success ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: broadcastStatus.success ? 'var(--success)' : 'var(--danger)',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                {broadcastStatus.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <span>{broadcastStatus.message}</span>
              </div>
            )}

            {/* Submit Dispatch Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isBroadcasting || !notifTitle.trim() || !notifMessage.trim()}
                className="btn btn-primary"
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #a855f7, var(--primary))',
                  boxShadow: '0 4px 16px rgba(168, 85, 247, 0.35)',
                  border: 'none',
                  color: '#ffffff'
                }}
              >
                {isBroadcasting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Broadcasting in Real-Time...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Dispatch Realtime Broadcast
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Broadcast History */}
          {recentBroadcasts.length > 0 && (
            <div style={{ marginTop: '30px', paddingTop: '22px', borderTop: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="var(--text-muted)" />
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Recent Broadcast Activity Log
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={fetchBroadcastHistory}
                  disabled={loadingHistory}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '8px', gap: '4px' }}
                >
                  <RefreshCw size={12} className={loadingHistory ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentBroadcasts.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                        {log.details || 'Broadcast notification sent'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                      Delivered Live
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 3: Profile Details ── */}
      {user && (
        <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ 
              padding: '10px', borderRadius: '12px', 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.08))', 
              color: 'var(--success)' 
            }}>
              {isAdmin ? <Shield size={20} /> : <User size={20} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {isAdmin ? 'System Administrator Profile' : 'Student Academic Credentials'}
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Registered identity details on SISTec Central Library</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
            {[
              { label: 'Full Name', value: user.fullName || user.username },
              { label: 'Username', value: user.username },
              ...(!isAdmin ? [
                { label: 'Enrollment / Roll No', value: user.rollNumber || user.roll_number || 'Not Assigned' },
                { label: 'BT Library Number', value: user.btNumber || user.bt_number || 'Not Assigned' },
                { label: 'Department / Branch', value: user.branchName || 'Engineering' },
                { label: 'Academic Year & Semester', value: `${user.year || '1st Year'} • ${user.semester || '1st Sem'}` }
              ] : []),
              { 
                label: 'Account Role', 
                value: user.role, 
                valueColor: isAdmin ? 'var(--primary)' : 'var(--success)',
                uppercase: true 
              },
              { label: 'Auth Provider', value: user.authProvider || 'Database', capitalize: true }
            ].map((item, i) => (
              <div key={i} style={{ 
                background: 'var(--input-bg)', 
                padding: '14px 16px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-glass)',
                transition: 'all 0.2s ease'
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                  e.currentTarget.style.background = 'var(--input-bg-focus)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                  e.currentTarget.style.background = 'var(--input-bg)';
                }}
              >
                <span style={{ 
                  fontSize: '0.72rem', color: 'var(--text-muted)', 
                  display: 'block', textTransform: 'uppercase', 
                  letterSpacing: '0.06em', marginBottom: '4px',
                  fontWeight: 600
                }}>{item.label}</span>
                <strong style={{ 
                  fontSize: '0.95rem', 
                  color: item.valueColor || 'var(--text-primary)',
                  textTransform: item.uppercase ? 'uppercase' : item.capitalize ? 'capitalize' : 'none'
                }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 4: Account Session & Sign Out ── */}
      {user && (
        <div className="glass-panel settings-section-card" style={{ 
          padding: '28px', 
          marginBottom: '24px', 
          border: '1.5px solid rgba(239, 68, 68, 0.28)',
          background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(239, 68, 68, 0.04) 100%)',
          borderRadius: '16px'
        }}>
          <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                padding: '10px', borderRadius: '12px', 
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16), rgba(244, 63, 94, 0.1))', 
                color: '#ef4444' 
              }}>
                <LogOut size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Session Security & Sign Out
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Manage active portal authorization and sign out of your account
                </span>
              </div>
            </div>

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              Active Session
            </span>
          </div>

          <div style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border-glass)',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.15rem',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                flexShrink: 0
              }}>
                {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.fullName || user.username}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  {user.rollNumber || user.roll_number || user.branchName || (isAdmin ? 'Central Library Administrator' : 'Enrolled Student')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Method:</span>
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'var(--surface-glow)',
                border: '1px solid var(--border-glass)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textTransform: 'capitalize'
              }}>
                {user.authProvider || 'Database'}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.55 }}>
            Logging out will safely end your academic session, clear cached credentials, and prevent unauthorized library actions from this device. You can sign back in at any time.
          </p>

          {showConfirmLogout ? (
            <div style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1.5px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Are you sure you want to end your library session and log out?
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '300px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmLogout(false)}
                  className="btn btn-secondary"
                  disabled={isLoggingOut}
                  style={{ flex: 1, padding: '9px 14px', fontSize: '0.82rem', justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="btn"
                  style={{
                    flex: 1.2,
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 16px',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Signing out...
                    </>
                  ) : (
                    <>
                      <LogOut size={14} /> Yes, Log Out
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmLogout(true)}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(244, 63, 94, 0.08))',
                color: '#ef4444',
                border: '1.5px solid rgba(239, 68, 68, 0.35)',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                maxWidth: '280px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(239, 68, 68, 0.35)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(244, 63, 94, 0.08))';
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <LogOut size={16} /> Log Out of SISTec Library
            </button>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="glass-panel settings-footer" style={{ 
        padding: '18px 28px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        fontSize: '0.8rem', 
        color: 'var(--text-muted)',
        borderRadius: '14px'
      }}>
        <span>SISTec Central Library Portal v2.0 • Academic Edition</span>
        <span style={{
          padding: '3px 10px',
          borderRadius: '6px',
          background: 'var(--surface-glow)',
          border: '1px solid var(--border-glass)',
          fontSize: '0.72rem',
          fontWeight: 600
        }}>
          Sagar Institute of Science & Technology
        </span>
      </div>
    </div>
  );
};

export default SettingsView;
