import { useState, useEffect, useRef } from 'react';
import {
  X, BookOpen, Users, Download, TrendingUp, Clock,
  Award, Activity, Eye, FileDown, Loader2, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

// Relative time helper
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

const formatDateTime = (iso) => {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const BookActivityModal = ({ book, onClose, onSelectStudent }) => {
  const { apiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('readers');
  const [readerSearch, setReaderSearch] = useState('');
  const isMountedRef = useRef(true);

  const targetBookId = Number(book?.id || book?.book_id);

  useEffect(() => {
    isMountedRef.current = true;
    if (!targetBookId) {
      setLoading(false);
      return;
    }

    const loadActivity = async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);
        const result = await apiCall(`/books/${targetBookId}/activity`);
        if (isMountedRef.current && result) setData(result);
      } catch (err) {
        if (isMountedRef.current) console.error('Failed to load book activity:', err);
      } finally {
        if (isMountedRef.current && !isSilent) setLoading(false);
      }
    };

    loadActivity(false);

    // Supabase Real-time Channel for book reading activity
    const channel = supabase
      .channel(`live-book-progress-${targetBookId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_book_progress',
          filter: `book_id=eq.${targetBookId}`
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
          filter: `book_id=eq.${targetBookId}`
        },
        () => {
          loadActivity(true);
        }
      )
      .subscribe();

    // Heartbeat fallback polling (every 2s)
    const heartbeat = setInterval(() => {
      loadActivity(true);
    }, 2000);

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
      clearInterval(heartbeat);
    };
  }, [apiCall, targetBookId]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const stats = data?.stats || {
    totalUniqueReaders: 0,
    totalReadSessions: 0,
    totalDownloads: 0,
    maxPageRead: 1,
    avgPageRead: 0
  };

  const readers = data?.readers || [];
  const logs = data?.logs || [];

  const filteredReaders = readers.filter(r => {
    const q = readerSearch.toLowerCase();
    if (!q) return true;
    return (
      (r.user?.full_name || '').toLowerCase().includes(q) ||
      (r.user?.roll_number || '').toLowerCase().includes(q) ||
      (r.user?.branch_name || '').toLowerCase().includes(q)
    );
  });

  const bookInfo = data?.book || book;

  return (
    <>
      <style>{`
        .bam-overlay {
          position: fixed;
          inset: 0;
          background: var(--modal-backdrop, rgba(0,0,0,0.7));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: bam-fade-in 0.2s ease;
        }
        @keyframes bam-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .bam-modal {
          background: var(--modal-bg, var(--bg-card-solid));
          border: 1px solid var(--border-glass);
          border-radius: 20px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--shadow-elevated, 0 30px 80px rgba(0,0,0,0.5));
          animation: bam-scale-up 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes bam-scale-up {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .bam-header {
          padding: 20px 24px 0;
          flex-shrink: 0;
        }
        .bam-header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }
        .bam-book-info { flex: 1; min-width: 0; }
        .bam-book-label {
          font-size: 0.72rem;
          color: var(--primary, #3b82f6);
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .bam-book-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text-primary) !important;
          -webkit-text-fill-color: initial !important;
          background: none !important;
          margin: 0 0 4px 0;
          line-height: 1.2;
        }
        .bam-book-meta {
          font-size: 0.8rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .bam-close-btn {
          background: var(--modal-card-bg, var(--input-bg));
          border: 1px solid var(--modal-card-border, var(--border-glass));
          color: var(--text-muted);
          border-radius: 10px;
          padding: 8px;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .bam-close-btn:hover {
          background: rgba(239,68,68,0.15);
          color: #ef4444;
          border-color: rgba(239,68,68,0.3);
        }
        .bam-stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .bam-stat-card {
          background: var(--modal-card-bg, var(--input-bg));
          border: 1px solid var(--modal-card-border, var(--border-glass));
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bam-stat-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .bam-stat-val {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
          margin-bottom: 2px;
        }
        .bam-stat-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .bam-tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--border-glass);
        }
        .bam-tab-btn {
          background: none;
          border: none;
          padding: 12px 20px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.15s;
        }
        .bam-tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
        .bam-tab-btn:hover:not(.active) {
          color: var(--text-primary);
        }
        .bam-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px 24px;
        }
        .bam-reader-card {
          background: var(--modal-card-bg, var(--input-bg));
          border: 1px solid var(--modal-card-border, var(--border-glass));
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: border-color 0.15s;
        }
        .bam-reader-card:hover {
          border-color: rgba(59,130,246,0.3);
        }
        .bam-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--primary), #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 800;
          color: white;
          flex-shrink: 0;
        }
        .bam-reader-info { flex: 1; min-width: 0; }
        .bam-reader-name {
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .bam-reader-meta {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .bam-reader-stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }
        .bam-page-badge {
          background: rgba(59,130,246,0.15);
          color: var(--primary);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .bam-dl-badge {
          background: rgba(16,185,129,0.12);
          color: #10b981;
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 0.65rem;
          font-weight: 600;
        }
        .bam-log-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-glass);
        }
        .bam-log-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .bam-log-body { flex: 1; min-width: 0; }
        .bam-log-desc {
          font-size: 0.82rem;
          color: var(--text-primary);
          font-weight: 600;
          margin-bottom: 2px;
        }
        .bam-log-meta {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
        .bam-log-time {
          font-size: 0.68rem;
          color: var(--text-muted);
          flex-shrink: 0;
          white-space: nowrap;
        }
        .bam-search {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--modal-card-bg, var(--input-bg));
          border: 1px solid var(--modal-card-border, var(--border-glass));
          border-radius: 10px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }
        .bam-search input {
          background: none;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 0.83rem;
          flex: 1;
        }
        .bam-search input::placeholder { color: var(--text-muted); }
        .bam-empty {
          text-align: center;
          padding: 48px 20px;
          color: var(--text-muted);
        }
        .bam-empty h4 { margin: 12px 0 6px; font-size: 1rem; font-weight: 700; color: var(--text-primary); }
        .bam-empty p { font-size: 0.8rem; margin: 0; }
        @media (max-width: 640px) {
          .bam-modal { border-radius: 16px; max-height: 95vh; }
          .bam-header { padding: 16px 16px 0; }
          .bam-body { padding: 16px; }
          .bam-book-title { font-size: 1.1rem; }
          .bam-stats-row { grid-template-columns: repeat(2, 1fr); }
          .bam-tab-btn { padding: 10px 12px; font-size: 0.76rem; }
        }
      `}</style>

      <div className="bam-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bam-modal">
          {/* Header */}
          <div className="bam-header">
            <div className="bam-header-top">
              <div className="bam-book-info">
                <div className="bam-book-label">📖 Book Activity Monitor</div>
                <h2 className="bam-book-title">{bookInfo?.title || 'Book Activity'}</h2>
                <div className="bam-book-meta">
                  <span>{bookInfo?.author || 'Unknown Author'}</span>
                  {(bookInfo?.branch?.name || bookInfo?.branch_name) && (
                    <><span>•</span><span>{bookInfo.branch?.name || bookInfo.branch_name}</span></>
                  )}
                  {(bookInfo?.category?.name || bookInfo?.category_name) && (
                    <><span>•</span><span>{bookInfo.category?.name || bookInfo.category_name}</span></>
                  )}
                </div>
              </div>
              <button className="bam-close-btn" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Overall Stats */}
            <div className="bam-stats-row">
              <div className="bam-stat-card">
                <div className="bam-stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <Users size={15} color="#60a5fa" />
                </div>
                <div>
                  <div className="bam-stat-val">{loading ? '—' : stats.totalUniqueReaders}</div>
                  <div className="bam-stat-label">Unique Readers</div>
                </div>
              </div>
              <div className="bam-stat-card">
                <div className="bam-stat-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <Eye size={15} color="#a78bfa" />
                </div>
                <div>
                  <div className="bam-stat-val">{loading ? '—' : stats.totalReadSessions}</div>
                  <div className="bam-stat-label">Total Read Sessions</div>
                </div>
              </div>
              <div className="bam-stat-card">
                <div className="bam-stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <Download size={15} color="#34d399" />
                </div>
                <div>
                  <div className="bam-stat-val">{loading ? '—' : stats.totalDownloads}</div>
                  <div className="bam-stat-label">Downloads</div>
                </div>
              </div>
              <div className="bam-stat-card">
                <div className="bam-stat-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <TrendingUp size={15} color="#fbbf24" />
                </div>
                <div>
                  <div className="bam-stat-val">{loading ? '—' : `P${stats.avgPageRead}`}</div>
                  <div className="bam-stat-label">Avg Page Read</div>
                </div>
              </div>
              <div className="bam-stat-card">
                <div className="bam-stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <Award size={15} color="#f87171" />
                </div>
                <div>
                  <div className="bam-stat-val">{loading ? '—' : `P${stats.maxPageRead}`}</div>
                  <div className="bam-stat-label">Highest Page</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bam-tabs">
              <button
                className={`bam-tab-btn ${activeTab === 'readers' ? 'active' : ''}`}
                onClick={() => setActiveTab('readers')}
              >
                <Users size={14} /> Readers ({readers.length})
              </button>
              <button
                className={`bam-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                <Activity size={14} /> Activity Logs ({logs.length})
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bam-body">
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: 'var(--text-muted)' }}>
                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.9rem' }}>Loading reading activity...</span>
              </div>
            ) : (
              <>
                {/* ── TAB: READERS ── */}
                {activeTab === 'readers' && (
                  <div>
                    {/* Search */}
                    <div className="bam-search">
                      <Search size={14} color="var(--text-muted)" />
                      <input
                        placeholder="Search by name, roll number or branch..."
                        value={readerSearch}
                        onChange={(e) => setReaderSearch(e.target.value)}
                      />
                    </div>

                    {filteredReaders.length === 0 ? (
                      <div className="bam-empty">
                        <BookOpen size={40} opacity={0.3} style={{ margin: '0 auto' }} />
                        <h4>No readers yet</h4>
                        <p>When students open this book, their reading activity will appear here.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filteredReaders.map((r, idx) => {
                          const studentInfo = r.user || {};
                          const initials = (studentInfo.full_name || 'S').charAt(0).toUpperCase();
                          return (
                            <div
                              key={r.id || r.user_id || idx}
                              className="bam-reader-card"
                              style={{ cursor: onSelectStudent ? 'pointer' : 'default', transition: 'all 0.2s ease' }}
                              onClick={() => {
                                if (onSelectStudent && r.user) {
                                  onSelectStudent(r.user);
                                  onClose();
                                }
                              }}
                              title={onSelectStudent ? "Click to inspect student profile and library dossier" : undefined}
                            >
                              <div className="bam-avatar">{initials}</div>
                              <div className="bam-reader-info">
                                <div className="bam-reader-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{studentInfo.full_name || 'Student'}</span>
                                  {onSelectStudent && (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--primary, #3b82f6)', fontWeight: 600 }}>
                                      View Dossier ➔
                                    </span>
                                  )}
                                </div>
                                <div className="bam-reader-meta">
                                  Roll: <strong>{studentInfo.roll_number || 'N/A'}</strong>
                                  {studentInfo.branch_name && <> · {studentInfo.branch_name}</>}
                                  {studentInfo.year && <> · Year {studentInfo.year}, Sem {studentInfo.semester}</>}
                                </div>
                                <div className="bam-reader-meta" style={{ marginTop: 3 }}>
                                  <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                                  Last read: <strong>{relativeTime(r.last_accessed_at)}</strong>
                                  &nbsp;({formatDateTime(r.last_accessed_at)})
                                </div>
                              </div>
                              <div className="bam-reader-stats">
                                <div className="bam-page-badge" style={{ whiteSpace: 'nowrap' }}>
                                  Page {r.last_page_read || 1} / {r.total_pages || book?.total_pages || 100} ({r.progress_percentage || Math.min(100, Math.round(((r.last_page_read || 1) / (r.total_pages || book?.total_pages || 100)) * 100))}%)
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                  {r.accessed_count || 1} reads
                                </div>
                                {(r.is_downloaded === 1 || r.downloaded_count > 0) && (
                                  <div className="bam-dl-badge">
                                    <Download size={9} style={{ display: 'inline', marginRight: 2 }} />
                                    Downloaded
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

                {/* ── TAB: ACTIVITY LOGS ── */}
                {activeTab === 'logs' && (
                  <div>
                    {logs.length === 0 ? (
                      <div className="bam-empty">
                        <Activity size={40} opacity={0.3} style={{ margin: '0 auto' }} />
                        <h4>No activity logs yet</h4>
                        <p>Detailed reading events will appear here as students interact with this book.</p>
                      </div>
                    ) : (
                      <div>
                        {logs.map((log, idx) => {
                          const isDownload = log.action_type === 'download';
                          return (
                            <div key={log.id || idx} className="bam-log-item">
                              <div
                                className="bam-log-icon"
                                style={{
                                  background: isDownload
                                    ? 'rgba(16,185,129,0.15)'
                                    : 'rgba(59,130,246,0.15)'
                                }}
                              >
                                {isDownload
                                  ? <FileDown size={13} color="#34d399" />
                                  : <BookOpen size={13} color="#60a5fa" />
                                }
                              </div>
                              <div className="bam-log-body">
                                <div className="bam-log-desc">
                                  {log.student_name || log.user?.full_name || 'Student'}{' '}
                                  {isDownload ? 'downloaded this eBook' : log.details || 'read this eBook'}
                                </div>
                                <div className="bam-log-meta">
                                  Roll: {log.roll_number || log.user?.roll_number || 'N/A'}
                                  {log.branch_name && <> · {log.branch_name}</>}
                                </div>
                              </div>
                              <div className="bam-log-time">
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
        </div>
      </div>
    </>
  );
};

export default BookActivityModal;
