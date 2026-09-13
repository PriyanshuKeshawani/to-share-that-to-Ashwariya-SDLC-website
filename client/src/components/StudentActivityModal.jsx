import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, BookOpen, Clock,
  Printer,
  Search, Bookmark,
  History, Laptop, UserCheck, UserX, User,
  Download, Activity, Eye, FileDown, CheckCircle2,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import StatusBadge from './StatusBadge';
import { printStudentTranscript } from '../utils/studentTranscriptGenerator';
export { printStudentTranscript };

const relativeTime = (iso) => {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const StudentActivityModal = ({ student, onClose, onToggleBlock, onSelectBook }) => {
  const { apiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'ebooks', 'permissions', 'logs'
  const [bookSearch, setBookSearch] = useState('');
  const [logFilter, setLogFilter] = useState('all'); // 'all', 'reads', 'downloads', 'auth'
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const loadActivity = async (isSilent = false) => {
      if (!student?.id) return;
      try {
        if (!isSilent) setLoading(true);
        const data = await apiCall(`/students/${student.id}/activity`);
        if (isMountedRef.current && data) {
          setActivityData(data);
        }
      } catch (err) {
        if (isMountedRef.current) console.error('Failed to load student activity:', err);
      } finally {
        if (isMountedRef.current && !isSilent) setLoading(false);
      }
    };

    // 1. Initial Load
    loadActivity(false);

    // 2. Real-time Supabase Subscription to user_book_progress and activity_logs
    const channel = supabase
      .channel(`live-student-progress-${student.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_book_progress',
          filter: `user_id=eq.${student.id}`
        },
        () => {
          loadActivity(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `user_id=eq.${student.id}`
        },
        () => {
          loadActivity(true);
        }
      )
      .subscribe();

    // 3. Heartbeat polling fallback (every 2s) to guarantee real-time updates even under connection blips
    const heartbeat = setInterval(() => {
      loadActivity(true);
    }, 2000);

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
      clearInterval(heartbeat);
    };
  }, [apiCall, student?.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const stats = activityData?.stats || {
    eBooksRead: 0,
    totalReadingSessions: 0,
    totalDownloads: 0,
    totalAccessRequests: 0,
    totalReadingMinutes: 0
  };

  const bookProgress = useMemo(() => activityData?.bookProgress || [], [activityData]);
  const logs = useMemo(() => activityData?.logs || [], [activityData]);
  const permissions = activityData?.permissions || [];

  // Filtered book progress
  const filteredBooks = useMemo(() => {
    const q = bookSearch.toLowerCase();
    if (!q) return bookProgress;
    return bookProgress.filter(b =>
      (b.book?.title || '').toLowerCase().includes(q) ||
      (b.book?.author || '').toLowerCase().includes(q) ||
      (b.book?.branch?.name || '').toLowerCase().includes(q)
    );
  }, [bookProgress, bookSearch]);

  // Filtered activity logs
  const filteredLogs = useMemo(() => {
    if (logFilter === 'reads') return logs.filter(l => l.action_type === 'view' || (l.details && l.details.toLowerCase().includes('page')));
    if (logFilter === 'downloads') return logs.filter(l => l.action_type === 'download');
    if (logFilter === 'auth') return logs.filter(l => l.action_type === 'login' || l.action_type === 'logout');
    return logs;
  }, [logs, logFilter]);

  // Print Student Activity Report (Certified Library Transcript)
  const handlePrintReport = () => {
    printStudentTranscript({ student, activityData });
  };

  return (
    <div
      className="sam-modal-backdrop animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .sam-modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: var(--modal-backdrop, rgba(3, 7, 18, 0.82));
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }
        .sam-modal-container {
          width: 100%;
          max-width: 1040px;
          max-height: 94vh;
          background: var(--modal-bg, var(--bg-card-solid));
          border: 1.5px solid var(--border-glass);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-elevated);
          overflow: hidden;
          position: relative;
        }
        .sam-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-glass);
          background: var(--modal-header-bg);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .sam-header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }
        .sam-student-profile {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }
        .sam-avatar {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--primary), #1e40af);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          font-weight: 800;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .sam-student-meta { flex: 1; min-width: 0; }
        .sam-student-name {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-primary) !important;
          -webkit-text-fill-color: initial !important;
          background: none !important;
          margin-bottom: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sam-student-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .sam-actions-desktop {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .sam-actions-mobile {
          display: none;
          gap: 8px;
        }
        .sam-close-btn {
          min-width: 44px;
          min-height: 44px;
          padding: 0 !important;
          display: flex !important;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px !important;
          cursor: pointer;
        }
        .sam-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }
        .sam-kpi-card {
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--modal-card-bg, rgba(255,255,255,0.03));
          border: 1px solid var(--modal-card-border, var(--border-glass));
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sam-kpi-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sam-kpi-val {
          font-size: 1.25rem;
          font-weight: 800;
          line-height: 1.1;
        }
        .sam-kpi-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sam-tabs-bar {
          display: flex;
          gap: 0;
          overflow-x: auto;
          scrollbar-width: none;
          border-bottom: 1px solid var(--border-glass);
          padding: 0 24px;
          background: var(--modal-card-bg, var(--bg-surface));
          flex-shrink: 0;
        }
        .sam-tabs-bar::-webkit-scrollbar { display: none; }
        .sam-tab-btn {
          background: none;
          border: none;
          padding: 12px 16px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .sam-tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
        .sam-tab-btn:hover:not(.active) { color: var(--text-primary); }
        .sam-tab-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .sam-footer {
          padding: 12px 24px;
          border-top: 1px solid var(--border-glass);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .sam-modal-backdrop { padding: 0 !important; }
          .sam-modal-container {
            border-radius: 0 !important;
            max-height: 100dvh !important;
            height: 100dvh !important;
            border: none !important;
          }
          .sam-actions-desktop { display: none; }
          .sam-actions-mobile { display: flex; padding: 0 16px 12px; gap: 8px; }
          .sam-header { padding: max(14px, env(safe-area-inset-top, 14px)) 14px 12px; gap: 12px; }
          .sam-tabs-bar { padding: 0 14px; }
          .sam-tab-body { padding: 14px; }
          .sam-footer { padding: 10px 14px max(14px, env(safe-area-inset-bottom, 14px)); }
          .sam-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .sam-student-name { font-size: 1rem; }
          .sam-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .sam-tab-btn { padding: 10px 10px; font-size: 0.75rem; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="sam-modal-container">
        {/* ── Header ── */}
        <div className="sam-header">
          <div className="sam-header-top">
            <div className="sam-student-profile">
              <div className="sam-avatar">
                {(student.full_name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="sam-student-meta">
                <div className="sam-student-name">{student.full_name}</div>
                <div className="sam-student-sub">
                  <span>Roll: <strong>{student.roll_number || 'N/A'}</strong></span>
                  <span>·</span>
                  <span>{student.branch_name || 'General Branch'}</span>
                  <span>·</span>
                  <span>·</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 6px #10b981'
                    }} />
                    Live 100%
                  </span>
                  {student.created_at && (
                    <>
                      <span>·</span>
                      <span>Joined {new Date(student.created_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Action buttons */}
            <div className="sam-actions-desktop">
              <button
                onClick={handlePrintReport}
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: '0.8rem', gap: '5px' }}
                title="Print or export complete activity transcript"
              >
                <Printer size={14} /> Print Transcript
              </button>

              {onToggleBlock && (
                <button
                  onClick={() => onToggleBlock(student.id, student.is_blocked !== 1)}
                  className="btn btn-secondary"
                  style={{
                    padding: '7px 12px',
                    fontSize: '0.8rem',
                    gap: '5px',
                    color: student.is_blocked === 1 ? 'var(--success)' : 'var(--warning)',
                    borderColor: student.is_blocked === 1 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'
                  }}
                >
                  {student.is_blocked === 1 ? (
                    <><UserCheck size={14} /> Unblock</>
                  ) : (
                    <><UserX size={14} /> Block</>
                  )}
                </button>
              )}
            </div>

            {/* Top-Right Always Visible 44px Close Button */}
            <button 
              onClick={onClose} 
              className="btn btn-secondary sam-close-btn" 
              title="Close"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Action Buttons Row */}
          <div className="sam-actions-mobile">
            <button
              onClick={handlePrintReport}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem', gap: '5px', minHeight: '40px' }}
            >
              <Printer size={14} /> Print Transcript
            </button>
            {onToggleBlock && (
              <button
                onClick={() => onToggleBlock(student.id, student.is_blocked !== 1)}
                className="btn btn-secondary"
                style={{
                  flex: 1, padding: '8px 10px', fontSize: '0.78rem', gap: '5px', minHeight: '40px',
                  color: student.is_blocked === 1 ? 'var(--success)' : 'var(--warning)'
                }}
              >
                {student.is_blocked === 1 ? (
                  <><UserCheck size={14} /> Unblock</>
                ) : (
                  <><UserX size={14} /> Block</>
                )}
              </button>
            )}
          </div>

          {/* ── KPI Stat Cards (E-Book Monitoring) ── */}
          <div className="sam-kpi-grid">
            {[
              { label: 'E-Books Read',       value: stats.eBooksRead,           suffix: 'titles',   color: '#3b82f6', icon: BookOpen },
              { label: 'Reading Sessions',   value: stats.totalReadingSessions, suffix: 'times',    color: '#8b5cf6', icon: Eye },
              { label: 'Downloads',          value: stats.totalDownloads,       suffix: 'files',    color: '#10b981', icon: Download },
              { label: 'Access Requests',    value: stats.totalAccessRequests,  suffix: 'requests', color: '#f59e0b', icon: Bookmark }
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="sam-kpi-card">
                  <div className="sam-kpi-icon" style={{ background: `${card.color}20`, color: card.color }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sam-kpi-value">
                      {card.value} {card.suffix && <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>{card.suffix}</span>}
                    </div>
                    <div className="sam-kpi-label">{card.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tabs Bar ── */}
        <div className="sam-tabs-bar">
          {[
            { id: 'overview',     label: 'Overview',       icon: History,      count: null },
            { id: 'ebooks',       label: 'E-Books Read',   icon: Laptop,       count: bookProgress.length },
            { id: 'permissions',  label: 'Permissions',    icon: CheckCircle2, count: permissions.length },
            { id: 'logs',         label: 'Activity Logs',  icon: Activity,     count: logs.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`sam-tab-btn ${isActive ? 'active' : ''}`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span style={{
                    fontSize: '0.68rem', padding: '1px 6px', borderRadius: '8px',
                    background: isActive ? 'var(--primary)' : 'var(--input-bg)',
                    color: isActive ? '#fff' : 'var(--text-muted)', fontWeight: 700
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Scrollable Tab Body ── */}
        <div className="sam-tab-body">
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{
                width: '32px', height: '32px', border: '3px solid var(--border-glass)',
                borderTopColor: 'var(--primary)', borderRadius: '50%',
                margin: '0 auto 14px auto', animation: 'spin 1s linear infinite'
              }} />
              <p style={{ fontSize: '0.88rem' }}>Fetching student activity records...</p>
            </div>
          ) : (
            <>
              {/* ════ TAB 1: OVERVIEW ════ */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Academic Profile & Account File */}
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <User size={16} color="var(--secondary)" />
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Academic Identification &amp; Account File</h4>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '0.82rem' }}>
                      {[
                        { label: 'Full Legal Name',       val: student.full_name || 'N/A' },
                        { label: 'Enrollment / Roll No',  val: student.roll_number || 'N/A' },
                        { label: 'BT Code',               val: student.bt_number || 'N/A' },
                        { label: 'Assigned Department',   val: student.branch_name || student.branch || 'General Branch' },
                        { label: 'Academic Standing',     val: `Year ${student.year || '1'} · Sem ${student.semester || '1'}` },
                        { label: 'Institutional User ID', val: student.username || 'N/A' },
                        { label: 'Registration Date',     val: student.created_at ? new Date(student.created_at).toLocaleDateString('en-IN') : 'N/A' },
                        { label: 'Authentication Mode',   val: (student.auth_provider || 'Password').toUpperCase() },
                        { label: 'Account Clearance',     val: student.status?.toUpperCase(), color: student.status === 'approved' ? 'var(--success)' : 'var(--warning)' },
                        { label: 'Library Access Status', val: student.is_blocked === 1 ? 'BLOCKED' : 'ACTIVE / GRANTED', color: student.is_blocked === 1 ? 'var(--danger)' : 'var(--success)' }
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ background: 'var(--modal-card-bg, var(--input-bg))', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--modal-card-border, var(--border-glass))' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                          <strong style={{ color: color || 'var(--text-primary)', fontSize: '0.82rem' }}>{val}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reading Engagement Summary */}
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={16} color="var(--primary)" />
                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Recent Digital Reading Activity</h4>
                      </div>
                      <button onClick={() => setActiveTab('ebooks')} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                        View all ({bookProgress.length})
                      </button>
                    </div>
                    {bookProgress.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No e-books read yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {bookProgress.slice(0, 4).map((item) => {
                          const totalPgs = item.total_pages || item.book?.total_pages || 100;
                          const lastRead = item.last_page_read || 1;
                          const progressPct = item.progress_percentage && item.progress_percentage > 0
                            ? item.progress_percentage
                            : Math.min(100, Math.max(1, Math.round((lastRead / totalPgs) * 100)));
                          return (
                            <div
                              key={item.id}
                              style={{
                                padding: '10px 12px', borderRadius: '8px',
                                background: 'var(--modal-card-bg, var(--input-bg))', border: '1px solid var(--modal-card-border, var(--border-glass))',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                cursor: onSelectBook ? 'pointer' : 'default',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => {
                                if (onSelectBook && (item.book || item.book_id)) {
                                  onSelectBook(item.book || { id: item.book_id, title: item.book_title });
                                  onClose();
                                }
                              }}
                              title={onSelectBook ? "Click to inspect book analytics & reader activity" : undefined}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{item.book?.title || 'Unknown Book'}</span>
                                  {onSelectBook && <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>➔</span>}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {item.book?.author ? `${item.book.author} · ` : ''}{item.book?.branch?.name || 'General'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary)' }}>
                                  Page {lastRead} / {totalPgs} ({progressPct}%)
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.accessed_count || 1} reads · {relativeTime(item.last_accessed_at)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Inter-Departmental Requests Overview */}
                  {permissions.length > 0 && (
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={16} color="#10b981" />
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Resource Clearance History ({permissions.length})</h4>
                        </div>
                        <button onClick={() => setActiveTab('permissions')} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                          View Details
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {permissions.slice(0, 3).map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'var(--input-bg)', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                              {p.book?.title || p.book_title || 'Book Access'}
                            </span>
                            <StatusBadge status={p.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ════ TAB 2: E-BOOKS READ ════ */}
              {activeTab === 'ebooks' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--input-bg)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                    <Search size={14} color="var(--text-muted)" />
                    <input
                      style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.83rem', flex: 1 }}
                      placeholder="Search by book title, author or branch..."
                      value={bookSearch}
                      onChange={(e) => setBookSearch(e.target.value)}
                    />
                  </div>

                  {filteredBooks.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Laptop size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <h4>No e-books read yet</h4>
                      <p style={{ fontSize: '0.82rem' }}>Reading progress will appear here as the student opens books.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {filteredBooks.map((item, idx) => {
                        const totalPgs = item.total_pages || item.book?.total_pages || 100;
                        const lastRead = item.last_page_read || 1;
                        const progressPct = item.progress_percentage && item.progress_percentage > 0
                          ? item.progress_percentage
                          : Math.min(100, Math.max(1, Math.round((lastRead / totalPgs) * 100)));
                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              background: 'var(--input-bg)', border: '1px solid var(--border-glass)',
                              borderRadius: 12, padding: '14px 16px',
                              display: 'flex', alignItems: 'center', gap: 14,
                              cursor: onSelectBook ? 'pointer' : 'default',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => {
                              if (onSelectBook && (item.book || item.book_id)) {
                                onSelectBook(item.book || { id: item.book_id, title: item.book_title });
                                onClose();
                              }
                            }}
                            title={onSelectBook ? "Click to inspect book analytics & readers" : undefined}
                          >
                            <div style={{
                              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <BookOpen size={20} color="white" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 2 }}>
                                {item.book?.title || 'Unknown Book'}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {item.book?.author} · {item.book?.branch?.name || item.book?.branch_name || 'General'} · {item.book?.category?.name || 'General'}
                              </div>
                              {/* Progress bar */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                <div style={{ flex: 1, maxWidth: 160, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #8b5cf6)', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                  Page {lastRead} of {totalPgs} · {progressPct}% completed
                                </span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
                                Last read: {relativeTime(item.last_accessed_at)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{
                                background: 'rgba(59,130,246,0.15)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59,130,246,0.25)',
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                marginBottom: 4,
                                whiteSpace: 'nowrap'
                              }}>
                                Page {lastRead} / {totalPgs}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.accessed_count || 1} sessions</div>
                              {(item.is_downloaded === 1 || item.downloaded_count > 0) && (
                                <div style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '2px 7px', fontSize: '0.62rem', marginTop: 3 }}>
                                  <Download size={9} style={{ display: 'inline', marginRight: 2 }} />Downloaded
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ════ TAB 3: PERMISSION REQUESTS ════ */}
              {activeTab === 'permissions' && (
                <div>
                  {permissions.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <h4>No access requests on record</h4>
                      <p style={{ fontSize: '0.82rem' }}>All inter-departmental book clearance requests will appear here.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop View (>= 768px) */}
                      <div className="desktop-table-view">
                        <div className="table-responsive-wrapper">
                          <table className="custom-table" style={{ minWidth: '550px' }}>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Resource Title</th>
                                <th>Target Department</th>
                                <th>Requested On</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {permissions.map((p, idx) => (
                                <tr key={p.id || idx}>
                                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                                  <td style={{ fontWeight: 600 }}>{p.book?.title || p.book_title || 'General Department Catalog'}</td>
                                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.branch?.name || p.requested_branch_name || p.branch_name || 'Department'}</td>
                                  <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : 'N/A'}</td>
                                  <td><StatusBadge status={p.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile Cards View (< 768px) */}
                      <div className="mobile-cards-view">
                        {permissions.map((p, idx) => (
                          <div key={p.id || idx} className="mobile-data-card">
                            <div className="mobile-card-header">
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {p.book?.title || p.book_title || 'General Department Catalog'}
                                </h4>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Target: {p.branch?.name || p.requested_branch_name || p.branch_name || 'Department'}
                                </div>
                              </div>
                              <StatusBadge status={p.status} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                              <span>Requested On:</span>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : 'N/A'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ════ TAB 4: ACTIVITY LOGS ════ */}
              {activeTab === 'logs' && (
                <div>
                  {/* Log Filter Pills */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'all',       label: `All Events (${logs.length})` },
                      { id: 'reads',     label: 'Reading Sessions' },
                      { id: 'downloads', label: 'PDF Downloads' },
                      { id: 'auth',      label: 'Logins & Auth' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setLogFilter(f.id)}
                        style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                          background: logFilter === f.id ? 'var(--primary)' : 'var(--input-bg)',
                          color: logFilter === f.id ? '#fff' : 'var(--text-secondary)',
                          border: logFilter === f.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {filteredLogs.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Activity size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <h4>No activity events match this filter</h4>
                      <p style={{ fontSize: '0.82rem' }}>All page milestones, downloads, and logins will appear here.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {filteredLogs.map((log, idx) => {
                        const isDownload = log.action_type === 'download';
                        const isLogin = log.action_type === 'login' || log.action_type === 'logout';
                        return (
                          <div key={log.id || idx} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12,
                            padding: '10px 0',
                            borderBottom: '1px solid var(--border-glass)'
                          }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: isDownload ? 'rgba(16,185,129,0.15)' : isLogin ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)'
                            }}>
                              {isDownload ? <FileDown size={13} color="#34d399" /> :
                               isLogin ? <User size={13} color="#fbbf24" /> :
                               <BookOpen size={13} color="#60a5fa" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                {log.details || log.action_type}
                              </div>
                              {log.book?.title && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Book: {log.book.title}
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              {relativeTime(log.created_at)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sam-footer">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
            UUID: <code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{student.id?.slice(0, 8)}...</code>
          </div>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '6px 18px', fontSize: '0.82rem' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentActivityModal;
