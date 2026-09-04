import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, User, BookOpen, Clock, Calendar, DollarSign, 
  MapPin, CheckCircle2, AlertTriangle, FileText, Printer, 
  Search, ShieldAlert, Award, ArrowRight, Bookmark, 
  History, Laptop, Smartphone, AlertCircle, UserCheck, UserX
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';

const StudentActivityModal = ({ student, onClose, onToggleBlock }) => {
  const { apiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'loans', 'sessions', 'ebooks', 'logs'
  const [loanSearch, setLoanSearch] = useState('');
  const [loanFilter, setLoanFilter] = useState('all'); // 'all', 'issued', 'returned', 'overdue'

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

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const stats = activityData?.stats || {
    totalLoans: 0,
    activeLoansCount: 0,
    returnedLoansCount: 0,
    overdueLoansCount: 0,
    totalFine: 0,
    totalSessions: 0,
    totalStudyMinutes: 0,
    eBooksRead: 0
  };

  const loans = activityData?.loans || [];
  const sessions = activityData?.sessions || [];
  const bookProgress = activityData?.bookProgress || [];
  const logs = activityData?.logs || [];
  const permissions = activityData?.permissions || [];
  const currentDesk = activityData?.currentDesk;

  // Filtered loans
  const filteredLoans = useMemo(() => {
    const q = loanSearch.toLowerCase();
    return loans.filter(l => {
      const matchSearch = !q ||
        l.book_title?.toLowerCase().includes(q) ||
        l.book_author?.toLowerCase().includes(q) ||
        l.qr_code?.toLowerCase().includes(q);
      const matchFilter = loanFilter === 'all' || l.status === loanFilter;
      return matchSearch && matchFilter;
    });
  }, [loans, loanSearch, loanFilter]);

  // Format study duration
  const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0 mins';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs === 0) return `${remMins}m`;
    if (remMins === 0) return `${hrs}h`;
    return `${hrs}h ${remMins}m`;
  };

  // Print Student Activity Report
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
            .badge-danger { background: #fee2e2; color: #b91c1c; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo-title">SAGAR INSTITUTE OF SCIENCE & TECHNOLOGY (SISTec)</div>
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
              <div class="stat-val">${stats.totalLoans}</div>
              <div class="stat-label">Total Books Issued</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">${stats.activeLoansCount}</div>
              <div class="stat-label">Currently Borrowed</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">${stats.totalSessions}</div>
              <div class="stat-label">Desk Study Sessions</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">₹${stats.totalFine}</div>
              <div class="stat-label">Total Fine Dues</div>
            </div>
          </div>

          <h3 style="font-size: 14px; margin-bottom: 8px; color: #1e3a8a;">Physical Book Loans History</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Book Title & Author</th>
                <th>Copy QR</th>
                <th>Issued On</th>
                <th>Due Date</th>
                <th>Returned On</th>
                <th>Status</th>
                <th>Fine</th>
              </tr>
            </thead>
            <tbody>
              ${loans.length === 0 ? '<tr><td colspan="8" style="text-align: center; color: #94a3b8;">No physical book loans recorded for this student.</td></tr>' : 
                loans.map((l, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${l.book_title}</strong><br /><span style="color: #64748b;">${l.book_author}</span></td>
                    <td>${l.qr_code || l.copy_uuid || 'N/A'}</td>
                    <td>${l.issued_at ? new Date(l.issued_at).toLocaleDateString() : 'N/A'}</td>
                    <td>${l.due_date ? new Date(l.due_date).toLocaleDateString() : 'N/A'}</td>
                    <td>${l.returned_at ? new Date(l.returned_at).toLocaleDateString() : 'Holding'}</td>
                    <td><span class="badge ${l.status === 'returned' ? 'badge-success' : (l.status === 'issued' ? 'badge-warning' : 'badge-danger')}">${l.status}</span></td>
                    <td>₹${l.fine_amount || 0}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>

          <h3 style="font-size: 14px; margin-bottom: 8px; color: #1e3a8a;">Library Desk & Room Seating History</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Room Location</th>
                <th>Table / Desk</th>
                <th>Checked In</th>
                <th>Checked Out</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No physical desk check-ins recorded for this student.</td></tr>' :
                sessions.map((s, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${s.room_name}</td>
                    <td><strong>${s.table_number}</strong></td>
                    <td>${new Date(s.entered_at).toLocaleString()}</td>
                    <td>${s.exited_at ? new Date(s.exited_at).toLocaleString() : 'Currently Active'}</td>
                    <td>${s.duration_minutes ? formatDuration(s.duration_minutes) : 'Active Session'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>

          <div class="footer">
            This document is a certified computer-generated activity report from the SISTec Central Library Portal.
          </div>
        </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
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
          color: #fff;
          font-size: 1.35rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px var(--primary-glow);
          border: 2px solid rgba(255, 255, 255, 0.15);
          flex-shrink: 0;
        }
        .sam-profile-info {
          min-width: 0;
          flex: 1;
        }
        .sam-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .sam-student-name {
          font-size: 1.3rem;
          font-weight: 800;
          margin: 0;
          color: var(--text-primary);
          word-break: break-word;
          line-height: 1.25;
        }
        .sam-details-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 0.78rem;
          color: var(--text-secondary);
          flex-wrap: wrap;
        }
        .sam-detail-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--input-bg);
          padding: 2px 7px;
          border-radius: 6px;
          border: 1px solid var(--border-glass);
          white-space: nowrap;
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
          width: 100%;
          margin-top: 2px;
        }
        .sam-close-btn {
          width: 36px;
          height: 36px;
          padding: 0;
          border-radius: 50%;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sam-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 2px;
        }
        .sam-kpi-card {
          padding: 10px 12px;
          border-radius: 12px;
          background: var(--input-bg);
          border: 1px solid var(--border-glass);
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
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.2;
        }
        .sam-kpi-label {
          font-size: 0.7rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .sam-tabs-bar {
          padding: 0 20px;
          border-bottom: 1px solid var(--border-glass);
          background: rgba(0, 0, 0, 0.1);
          display: flex;
          gap: 6px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .sam-tabs-bar::-webkit-scrollbar {
          display: none;
        }
        .sam-tab-btn {
          padding: 12px 14px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 0.84rem;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
        }
        .sam-tab-btn.active {
          color: var(--primary);
          font-weight: 700;
          border-bottom-color: var(--primary);
        }
        .sam-tab-body {
          padding: 20px 24px;
          overflow-y: auto;
          flex: 1;
        }
        .sam-footer {
          padding: 12px 24px;
          border-top: 1px solid var(--border-glass);
          background: rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* ── Mobile Layout Adjustments (max-width: 640px) ── */
        @media (max-width: 640px) {
          .sam-modal-backdrop {
            padding: 8px !important;
          }
          .sam-modal-container {
            max-height: 96vh !important;
            border-radius: 16px !important;
          }
          .sam-header {
            padding: 14px 14px !important;
            gap: 10px !important;
          }
          .sam-header-top {
            gap: 8px !important;
            align-items: flex-start !important;
          }
          .sam-avatar {
            width: 42px !important;
            height: 42px !important;
            font-size: 1.1rem !important;
            border-radius: 11px !important;
          }
          .sam-student-name {
            font-size: 1.1rem !important;
          }
          .sam-actions-desktop {
            display: none !important;
          }
          .sam-actions-mobile {
            display: flex !important;
          }
          .sam-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .sam-kpi-card {
            padding: 8px 10px !important;
            gap: 8px !important;
          }
          .sam-kpi-icon {
            width: 28px !important;
            height: 28px !important;
            border-radius: 7px !important;
          }
          .sam-kpi-value {
            font-size: 0.95rem !important;
          }
          .sam-kpi-label {
            font-size: 0.65rem !important;
          }
          .sam-tabs-bar {
            padding: 0 10px !important;
          }
          .sam-tab-btn {
            padding: 10px 10px !important;
            font-size: 0.76rem !important;
            gap: 4px !important;
          }
          .sam-tab-body {
            padding: 14px 12px !important;
          }
          .sam-footer {
            padding: 10px 14px !important;
          }
        }
      `}</style>

      <div className="sam-modal-container animate-scale-up">
        {/* ── Modal Header & Student Info Card ── */}
        <div className="sam-header">
          <div className="sam-header-top">
            <div className="sam-student-profile">
              {/* Avatar */}
              <div className="sam-avatar">
                {student.full_name?.charAt(0).toUpperCase() || 'S'}
              </div>

              <div className="sam-profile-info">
                <div className="sam-name-row">
                  <h2 className="sam-student-name">
                    {student.full_name}
                  </h2>
                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                    @{student.username}
                  </span>
                  {student.is_blocked === 1 ? (
                    <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                      Blocked
                    </span>
                  ) : (
                    <StatusBadge status={student.status} />
                  )}
                </div>

                <div className="sam-details-row">
                  <span className="sam-detail-chip">
                    <strong>Roll:</strong> {student.roll_number || 'N/A'}
                  </span>
                  <span className="sam-detail-chip">
                    <strong>BT:</strong> {student.bt_number || 'N/A'}
                  </span>
                  <span className="sam-detail-chip">
                    <strong>Branch:</strong> {student.branch_name || 'General'}
                  </span>
                  <span className="sam-detail-chip">
                    Year {student.year}&bull;Sem {student.semester}
                  </span>
                  <span className="sam-detail-chip">
                    Joined {new Date(student.created_at).toLocaleDateString()}
                  </span>
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

              <button
                onClick={onClose}
                className="btn btn-secondary sam-close-btn"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mobile Close Button (Always visible on mobile) */}
            <button
              onClick={onClose}
              className="btn btn-secondary sam-close-btn"
              style={{ display: window.innerWidth <= 640 ? 'flex' : 'none' }}
              title="Close"
            >
              <X size={18} />
            </button>
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
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: '0.78rem',
                  gap: '5px',
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

          {/* Currently Seated Banner (if active) */}
          {currentDesk && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                  animation: 'pulse 2s infinite',
                  flexShrink: 0
                }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34d399' }}>
                  Seated at <strong>{currentDesk.table_number}</strong> ({currentDesk.room_name})
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Since {new Date(currentDesk.session_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {/* ── KPI Stat Cards ── */}
          <div className="sam-kpi-grid">
            {[
              {
                label: 'Borrowed Now',
                value: stats.activeLoansCount,
                suffix: 'books',
                color: stats.activeLoansCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                icon: BookOpen
              },
              {
                label: 'All-Time Borrowed',
                value: stats.totalLoans,
                suffix: 'total',
                color: '#38bdf8',
                icon: Bookmark
              },
              {
                label: 'Desk Visits',
                value: stats.totalSessions,
                suffix: 'visits',
                color: '#10b981',
                icon: MapPin
              },
              {
                label: 'Total Study Time',
                value: formatDuration(stats.totalStudyMinutes),
                suffix: '',
                color: '#a855f7',
                icon: Clock
              },
              {
                label: 'Fines Incurred',
                value: stats.totalFine > 0 ? `₹${stats.totalFine}` : '₹0',
                suffix: stats.totalFine > 0 ? 'Dues' : 'Clear',
                color: stats.totalFine > 0 ? '#ef4444' : 'var(--success)',
                icon: DollarSign
              },
              {
                label: 'E-Books Read',
                value: stats.eBooksRead,
                suffix: 'titles',
                color: '#f59e0b',
                icon: Laptop
              }
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="sam-kpi-card">
                  <div
                    className="sam-kpi-icon"
                    style={{
                      background: `${card.color}18`,
                      color: card.color
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sam-kpi-value">
                      {card.value} {card.suffix && <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>{card.suffix}</span>}
                    </div>
                    <div className="sam-kpi-label">
                      {card.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tabs Bar ── */}
        <div className="sam-tabs-bar">
          {[
            { id: 'overview', label: 'Overview', icon: History, count: null },
            { id: 'loans', label: 'Loans', icon: BookOpen, count: loans.length },
            { id: 'sessions', label: 'Desk Visits', icon: MapPin, count: sessions.length },
            { id: 'ebooks', label: 'E-Books', icon: Laptop, count: bookProgress.length },
            { id: 'logs', label: 'Audit Trail', icon: FileText, count: logs.length + permissions.length }
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
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    background: isActive ? 'var(--primary)' : 'var(--input-bg)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700
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
                  {/* Quick Recent Activity Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {/* Recent Book Circulation */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BookOpen size={16} color="var(--primary)" />
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Recent Book Loans</h4>
                        </div>
                        <button
                          onClick={() => setActiveTab('loans')}
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          View ({loans.length})
                        </button>
                      </div>

                      {loans.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          No books have been issued to this student yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {loans.slice(0, 3).map((loan) => (
                            <div
                              key={loan.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-glass)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px'
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {loan.book_title}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {loan.book_author} &bull; {loan.qr_code || loan.copy_uuid || 'Copy'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span className={`badge ${loan.status === 'returned' ? 'badge-success' : (loan.status === 'issued' ? 'badge-warning' : 'badge-danger')}`} style={{ fontSize: '0.65rem' }}>
                                  {loan.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Desk Visits */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={16} color="#10b981" />
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Recent Desk Visits</h4>
                        </div>
                        <button
                          onClick={() => setActiveTab('sessions')}
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          View ({sessions.length})
                        </button>
                      </div>

                      {sessions.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          No desk seating check-ins recorded yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sessions.slice(0, 3).map((sess) => (
                            <div
                              key={sess.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-glass)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                                  Table {sess.table_number}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {sess.room_name}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                                  {sess.duration_minutes ? formatDuration(sess.duration_minutes) : 'Active'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Academic Profile Details */}
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <User size={16} color="var(--secondary)" />
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Academic & Account File</h4>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '12px',
                      fontSize: '0.82rem'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Full Legal Name</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.full_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Enrollment / Roll No</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.roll_number || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>BT Number</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.bt_number || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Assigned Branch</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.branch_name || 'General'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Semester</span>
                        <strong style={{ color: 'var(--text-primary)' }}>Year {student.year} &bull; Sem {student.semester}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Account Status</span>
                        <strong style={{ color: student.status === 'approved' ? 'var(--success)' : 'var(--warning)' }}>
                          {student.status?.toUpperCase()}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════ TAB 2: BOOK LOANS ════ */}
              {activeTab === 'loans' && (
                <div>
                  {/* Filter & Search */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Search loans..."
                        value={loanSearch}
                        onChange={(e) => setLoanSearch(e.target.value)}
                        style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
                      />
                    </div>
                    <select
                      className="glass-input glass-select"
                      value={loanFilter}
                      onChange={(e) => setLoanFilter(e.target.value)}
                      style={{ width: '140px', fontSize: '0.84rem' }}
                    >
                      <option value="all">All Loans ({loans.length})</option>
                      <option value="issued">Holding</option>
                      <option value="returned">Returned</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>

                  {filteredLoans.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <BookOpen size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <h4>No book loans found</h4>
                      <p style={{ fontSize: '0.82rem' }}>No loans match your search or filter.</p>
                    </div>
                  ) : (
                    <div className="table-responsive-wrapper">
                      <table className="custom-table" style={{ minWidth: '600px' }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Book Title & Author</th>
                            <th>Copy QR Code</th>
                            <th>Issued Date</th>
                            <th>Due Date</th>
                            <th>Returned</th>
                            <th>Status</th>
                            <th>Fine</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLoans.map((loan, idx) => (
                            <tr key={loan.id}>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loan.book_title}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loan.book_author}</div>
                              </td>
                              <td style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>
                                {loan.qr_code || loan.copy_uuid || 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {loan.issued_at ? new Date(loan.issued_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {loan.returned_at ? new Date(loan.returned_at).toLocaleDateString() : (
                                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Holding</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${loan.status === 'returned' ? 'badge-success' : (loan.status === 'issued' ? 'badge-warning' : 'badge-danger')}`} style={{ fontSize: '0.65rem' }}>
                                  {loan.status}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: loan.fine_amount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                {loan.fine_amount > 0 ? `₹${loan.fine_amount}` : '₹0'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ════ TAB 3: SEATING SESSIONS ════ */}
              {activeTab === 'sessions' && (
                <div>
                  {sessions.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <MapPin size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <h4>No desk check-ins recorded</h4>
                      <p style={{ fontSize: '0.82rem' }}>When the student scans a desk QR badge, history will appear here.</p>
                    </div>
                  ) : (
                    <div className="table-responsive-wrapper">
                      <table className="custom-table" style={{ minWidth: '550px' }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Room Location</th>
                            <th>Desk No</th>
                            <th>Check-In</th>
                            <th>Check-Out</th>
                            <th>Duration</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((sess, idx) => (
                            <tr key={sess.id}>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {sess.room_name}
                              </td>
                              <td>
                                <span className="badge badge-secondary" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                  {sess.table_number}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {new Date(sess.entered_at).toLocaleString()}
                              </td>
                              <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {sess.exited_at ? new Date(sess.exited_at).toLocaleString() : (
                                  <span style={{ color: '#10b981', fontWeight: 700 }}>Active</span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                {sess.duration_minutes ? formatDuration(sess.duration_minutes) : 'In Progress'}
                              </td>
                              <td>
                                <span className={`badge ${sess.exited_at ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.65rem' }}>
                                  {sess.exited_at ? 'Completed' : 'Seated'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ════ TAB 4: E-BOOKS PROGRESS ════ */}
              {activeTab === 'ebooks' && (
                <div>
                  {bookProgress.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Laptop size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <h4>No digital e-books read yet</h4>
                      <p style={{ fontSize: '0.82rem' }}>Digital reading progress will sync here as student browses books.</p>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '12px'
                    }}>
                      {bookProgress.map((item) => (
                        <div
                          key={item.id}
                          className="glass-panel"
                          style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <span className="badge badge-secondary" style={{ fontSize: '0.62rem' }}>
                                {item.book?.branch?.name || 'All'}
                              </span>
                              <span className="badge badge-primary" style={{ fontSize: '0.62rem' }}>
                                {item.book?.category?.name || 'General'}
                              </span>
                            </div>
                            <h4 style={{ margin: '0 0 3px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.book?.title || 'Unknown E-Book'}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.book?.author || 'Unknown'}
                            </p>
                          </div>

                          <div style={{
                            marginTop: '12px',
                            paddingTop: '10px',
                            borderTop: '1px solid var(--border-glass)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem'
                          }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Last Page: </span>
                              <strong style={{ color: 'var(--primary)' }}>Page {item.last_page_read || 1}</strong>
                            </div>
                            <div>
                              <strong>{item.accessed_count || 1} reads</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════ TAB 5: AUDIT LOGS & PERMISSIONS ════ */}
              {activeTab === 'logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Branch Requests */}
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                      Branch Requests ({permissions.length})
                    </h4>
                    {permissions.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No extra branch requests.</p>
                    ) : (
                      <div className="table-responsive-wrapper">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Branch</th>
                              <th>Date</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {permissions.map((p) => (
                              <tr key={p.id}>
                                <td style={{ fontWeight: 600 }}>{p.branch?.name || p.branch_name || 'Branch'}</td>
                                <td>{new Date(p.created_at).toLocaleDateString()}</td>
                                <td>
                                  <StatusBadge status={p.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Activity Trail */}
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                      System Events ({logs.length})
                    </h4>
                    {logs.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No recent activity events recorded.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {logs.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-glass)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.78rem',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span className="badge badge-primary" style={{ fontSize: '0.62rem' }}>
                                {log.action_type?.toUpperCase()}
                              </span>
                              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.details}
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {new Date(log.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
