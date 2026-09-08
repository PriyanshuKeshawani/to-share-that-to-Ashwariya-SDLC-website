import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, User, BookOpen, Clock, FileText, Printer,
  Search, Bookmark,
  History, Laptop, UserCheck, UserX,
  Download, Activity, Eye, FileDown, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';

const StudentActivityModal = ({ student, onClose, onToggleBlock }) => {
  const { apiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'ebooks', 'permissions', 'logs'
  const [bookSearch, setBookSearch] = useState('');

  // Fetch full student activity
  const loadActivity = useCallback(async () => {
    if (!student?.id) return;
    try {
      setLoading(true);
      const data = await apiCall(`/students/${student.id}/activity`);
      setActivityData(data);
    } catch (err) {
      console.error('Failed to load student activity:', err);
    } finally {
      setLoading(false);
    }
  }, [apiCall, student?.id]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

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
    totalAccessRequests: 0
  };

  const bookProgress = activityData?.bookProgress || [];
  const logs = activityData?.logs || [];
  const permissions = activityData?.permissions || [];

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

  // Print Student Activity Report (E-book focused)
  const handlePrintReport = () => {
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (!printWin) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SISTec Library - Student Activity Transcript - ${student.full_name}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
            .logo-title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
            .subtitle { font-size: 12px; color: #64748b; }
            .profile-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 13px; }
            .stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .stat-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; }
            .stat-val { font-size: 18px; font-weight: 800; color: #2563eb; }
            .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
            th { background: #f1f5f9; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; font-weight: 700; }
            td { padding: 8px 12px; border: 1px solid #cbd5e1; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .badge-success { background: #dcfce7; color: #15803d; }
            .badge-warning { background: #fef3c7; color: #b45309; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo-title">SAGAR INSTITUTE OF SCIENCE &amp; TECHNOLOGY (SISTec)</div>
              <div class="subtitle">CENTRAL DIGITAL LIBRARY PORTAL &bull; OFFICIAL STUDENT ACTIVITY TRANSCRIPT</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              Generated: ${new Date().toLocaleString()}<br />
              Status: <strong>${student.status?.toUpperCase()}</strong>
            </div>
          </div>

          <div class="profile-box">
            <div><strong>Student Name:</strong> ${student.full_name}</div>
            <div><strong>Enrollment / Roll:</strong> ${student.roll_number || 'N/A'}</div>
            <div><strong>BT Code:</strong> ${student.bt_number || 'N/A'}</div>
            <div><strong>Branch:</strong> ${student.branch_name || 'General'}</div>
            <div><strong>Year / Semester:</strong> Year ${student.year || '1'} &bull; Sem ${student.semester || '1'}</div>
            <div><strong>Joined Date:</strong> ${new Date(student.created_at).toLocaleDateString()}</div>
          </div>

          <div class="stat-cards">
            <div class="stat-card">
              <div class="stat-val">${stats.eBooksRead}</div>
              <div class="stat-label">E-Books Read</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">${stats.totalReadingSessions}</div>
              <div class="stat-label">Reading Sessions</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">${stats.totalDownloads}</div>
              <div class="stat-label">Downloads</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">${stats.totalAccessRequests}</div>
              <div class="stat-label">Access Requests</div>
            </div>
          </div>

          <h3 style="font-size: 14px; margin-bottom: 8px; color: #1e3a8a;">E-Book Reading History</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Book Title &amp; Author</th>
                <th>Branch</th>
                <th>Last Page Read</th>
                <th>Total Sessions</th>
                <th>Downloaded</th>
                <th>Last Accessed</th>
              </tr>
            </thead>
            <tbody>
              ${bookProgress.length === 0
                ? '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">No e-books read by this student yet.</td></tr>'
                : bookProgress.map((item, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${item.book?.title || 'N/A'}</strong><br /><span style="color: #64748b;">${item.book?.author || ''}</span></td>
                    <td>${item.book?.branch?.name || 'General'}</td>
                    <td>Page ${item.last_page_read || 1}</td>
                    <td>${item.accessed_count || 1}</td>
                    <td>${(item.is_downloaded === 1 || item.downloaded_count > 0) ? 'Yes' : 'No'}</td>
                    <td>${item.last_accessed_at ? new Date(item.last_accessed_at).toLocaleString() : 'N/A'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>

          <div class="footer">
            This document is a certified computer-generated activity report from the SISTec Central Library Digital Portal.
          </div>
        </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 400);
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
          background-color: rgba(3, 7, 18, 0.85);
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
          background: var(--bg-card-solid);
          border: 1.5px solid var(--border-glass-hover);
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
          background: linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, rgba(13, 22, 42, 0.4) 100%);
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
          color: var(--text-primary);
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
        .sam-close-btn { padding: 7px 7px !important; }
        .sam-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }
        .sam-kpi-card {
          background: var(--input-bg);
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sam-kpi-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sam-kpi-value {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
          margin-bottom: 2px;
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
          background: var(--glass-bg, rgba(15,23,42,0.97));
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
          .sam-actions-desktop { display: none; }
          .sam-actions-mobile { display: flex; padding: 0 24px 12px; }
          .sam-header { padding: 16px; gap: 12px; }
          .sam-tabs-bar { padding: 0 16px; }
          .sam-tab-body { padding: 16px; }
          .sam-footer { padding: 10px 16px; }
          .sam-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .sam-student-name { font-size: 1rem; }
          .sam-kpi-grid { grid-template-columns: repeat(2, 1fr); }
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
                  <span>Year {student.year} · Sem {student.semester}</span>
                  {student.created_at && (
                    <>
                      <span>·</span>
                      <span>Joined {new Date(student.created_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Action buttons & Close */}
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

              <button onClick={onClose} className="btn btn-secondary sam-close-btn" title="Close">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Mobile Action Buttons Row */}
          <div className="sam-actions-mobile">
            <button
              onClick={handlePrintReport}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem', gap: '5px' }}
            >
              <Printer size={14} /> Print Transcript
            </button>
            {onToggleBlock && (
              <button
                onClick={() => onToggleBlock(student.id, student.is_blocked !== 1)}
                className="btn btn-secondary"
                style={{
                  flex: 1, padding: '8px 10px', fontSize: '0.78rem', gap: '5px',
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
            <button onClick={onClose} className="btn btn-secondary sam-close-btn" title="Close">
              <X size={18} />
            </button>
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
                  {/* Recent E-Books */}
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={16} color="var(--primary)" />
                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Recently Read E-Books</h4>
                      </div>
                      <button onClick={() => setActiveTab('ebooks')} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                        View all ({bookProgress.length})
                      </button>
                    </div>
                    {bookProgress.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No e-books read yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {bookProgress.slice(0, 3).map((item) => (
                          <div key={item.id} style={{
                            padding: '10px 12px', borderRadius: '8px',
                            background: 'var(--input-bg)', border: '1px solid var(--border-glass)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
                          }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.book?.title || 'Unknown Book'}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {item.book?.author} · {item.book?.branch?.name || 'General'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>Page {item.last_page_read || 1}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.accessed_count || 1} reads · {relativeTime(item.last_accessed_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Academic Profile Details */}
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <User size={16} color="var(--secondary)" />
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Academic &amp; Account File</h4>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', fontSize: '0.82rem' }}>
                      {[
                        { label: 'Full Legal Name',      val: student.full_name },
                        { label: 'Enrollment / Roll No', val: student.roll_number || 'N/A' },
                        { label: 'BT Number',            val: student.bt_number || 'N/A' },
                        { label: 'Assigned Branch',      val: student.branch_name || 'General' },
                        { label: 'Semester',             val: `Year ${student.year} · Sem ${student.semester}` },
                        { label: 'Account Status',       val: student.status?.toUpperCase(), color: student.status === 'approved' ? 'var(--success)' : 'var(--warning)' }
                      ].map(({ label, val, color }) => (
                        <div key={label}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>{label}</span>
                          <strong style={{ color: color || 'var(--text-primary)' }}>{val}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
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
                      {filteredBooks.map((item, idx) => (
                        <div key={item.id || idx} style={{
                          background: 'var(--input-bg)', border: '1px solid var(--border-glass)',
                          borderRadius: 12, padding: '14px 16px',
                          display: 'flex', alignItems: 'center', gap: 14
                        }}>
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
                              {item.book?.author} · {item.book?.branch?.name || 'General'} · {item.book?.category?.name || 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
                              Last read: {relativeTime(item.last_accessed_at)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, marginBottom: 4 }}>
                              Page {item.last_page_read || 1}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.accessed_count || 1} sessions</div>
                            {(item.is_downloaded === 1 || item.downloaded_count > 0) && (
                              <div style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '2px 7px', fontSize: '0.62rem', marginTop: 3 }}>
                                <Download size={9} style={{ display: 'inline', marginRight: 2 }} />Downloaded
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
                      <h4>No access requests</h4>
                      <p style={{ fontSize: '0.82rem' }}>Book access requests will appear here.</p>
                    </div>
                  ) : (
                    <div className="table-responsive-wrapper">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Book</th>
                            <th>Branch</th>
                            <th>Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {permissions.map((p, idx) => (
                            <tr key={p.id}>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600 }}>{p.book?.title || 'N/A'}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.branch?.name || p.branch_name || 'N/A'}</td>
                              <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                              <td><StatusBadge status={p.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ════ TAB 4: ACTIVITY LOGS ════ */}
              {activeTab === 'logs' && (
                <div>
                  {logs.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Activity size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <h4>No activity events yet</h4>
                      <p style={{ fontSize: '0.82rem' }}>All page reads, downloads, and logins will appear here.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {logs.map((log, idx) => {
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
