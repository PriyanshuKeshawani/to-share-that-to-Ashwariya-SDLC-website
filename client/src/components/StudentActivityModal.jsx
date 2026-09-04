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
    if (hrs === 0) return `${remMins} mins`;
    if (remMins === 0) return `${hrs} hrs`;
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
      className="modal-backdrop animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          background: 'var(--bg-card-solid)',
          border: '1.5px solid var(--border-glass-hover)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* ── Modal Header & Student Info Card ── */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid var(--border-glass)',
          background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, rgba(13, 22, 42, 0.4) 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Avatar */}
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, var(--primary), #1e40af)',
                color: '#fff',
                fontSize: '1.4rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px var(--primary-glow)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                flexShrink: 0
              }}>
                {student.full_name?.charAt(0).toUpperCase() || 'S'}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {student.full_name}
                  </h2>
                  <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                    @{student.username}
                  </span>
                  {student.is_blocked === 1 ? (
                    <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                      Account Blocked
                    </span>
                  ) : (
                    <StatusBadge status={student.status} />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span><strong>Roll:</strong> {student.roll_number || 'N/A'}</span>
                  <span>&bull;</span>
                  <span><strong>BT:</strong> {student.bt_number || 'N/A'}</span>
                  <span>&bull;</span>
                  <span><strong>Branch:</strong> {student.branch_name || 'General'}</span>
                  <span>&bull;</span>
                  <span><strong>Year:</strong> {student.year} &bull; <strong>Sem:</strong> {student.semester}</span>
                  <span>&bull;</span>
                  <span><strong>Joined:</strong> {new Date(student.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Action buttons & Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handlePrintReport}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
                title="Print or export complete activity transcript"
              >
                <Printer size={15} /> Print Transcript
              </button>

              {onToggleBlock && (
                <button
                  onClick={() => onToggleBlock(student.id, student.is_blocked !== 1)}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    gap: '6px',
                    color: student.is_blocked === 1 ? 'var(--success)' : 'var(--warning)',
                    borderColor: student.is_blocked === 1 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'
                  }}
                >
                  {student.is_blocked === 1 ? (
                    <><UserCheck size={15} /> Unblock</>
                  ) : (
                    <><UserX size={15} /> Block</>
                  )}
                </button>
              )}

              <button
                onClick={onClose}
                className="btn btn-secondary"
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  borderRadius: '50%',
                  color: 'var(--text-muted)'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Currently Seated Banner (if active) */}
          {currentDesk && (
            <div style={{
              padding: '10px 16px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                  animation: 'pulse 2s infinite'
                }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>
                  Currently Seated & Studying at <strong>{currentDesk.table_number}</strong> in <strong>{currentDesk.room_name}</strong>
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Session started: {new Date(currentDesk.session_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {/* ── KPI Stat Cards ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginTop: '4px'
          }}>
            {[
              {
                label: 'Currently Borrowed',
                value: stats.activeLoansCount,
                suffix: 'books',
                color: stats.activeLoansCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                icon: BookOpen
              },
              {
                label: 'Lifetime Borrowed',
                value: stats.totalLoans,
                suffix: 'total',
                color: '#38bdf8',
                icon: Bookmark
              },
              {
                label: 'Study Desk Visits',
                value: stats.totalSessions,
                suffix: 'sessions',
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
                suffix: stats.totalFine > 0 ? 'Pending' : 'Clear',
                color: stats.totalFine > 0 ? '#ef4444' : 'var(--success)',
                icon: DollarSign
              },
              {
                label: 'Digital E-Books Read',
                value: stats.eBooksRead,
                suffix: 'titles',
                color: '#f59e0b',
                icon: Laptop
              }
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: `${card.color}18`,
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      {card.value} {card.suffix && <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>{card.suffix}</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {card.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tabs Bar ── */}
        <div style={{
          padding: '0 28px',
          borderBottom: '1px solid var(--border-glass)',
          background: 'rgba(0, 0, 0, 0.1)',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto'
        }}>
          {[
            { id: 'overview', label: 'Summary Overview', icon: History, count: null },
            { id: 'loans', label: 'Physical Book Loans', icon: BookOpen, count: loans.length },
            { id: 'sessions', label: 'Desk & Room Check-Ins', icon: MapPin, count: sessions.length },
            { id: 'ebooks', label: 'E-Books Progress', icon: Laptop, count: bookProgress.length },
            { id: 'logs', label: 'Audit Trail & Permissions', icon: FileText, count: logs.length + permissions.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 7px',
                    borderRadius: '10px',
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
        <div style={{
          padding: '24px 28px',
          overflowY: 'auto',
          flex: 1
        }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{
                width: '36px', height: '36px', border: '3px solid var(--border-glass)',
                borderTopColor: 'var(--primary)', borderRadius: '50%',
                margin: '0 auto 16px auto', animation: 'spin 1s linear infinite'
              }} />
              <p>Fetching complete student activity history...</p>
            </div>
          ) : (
            <>
              {/* ════ TAB 1: OVERVIEW ════ */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Quick Recent Activity Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                    {/* Recent Book Circulation */}
                    <div className="glass-panel" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BookOpen size={18} color="var(--primary)" />
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recent Book Loans</h4>
                        </div>
                        <button
                          onClick={() => setActiveTab('loans')}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          View All ({loans.length})
                        </button>
                      </div>

                      {loans.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No books have been issued to this student yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {loans.slice(0, 3).map((loan) => (
                            <div
                              key={loan.id}
                              style={{
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-glass)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                  {loan.book_title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {loan.book_author} &bull; Copy: {loan.qr_code || loan.copy_uuid || 'N/A'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span className={`badge ${loan.status === 'returned' ? 'badge-success' : (loan.status === 'issued' ? 'badge-warning' : 'badge-danger')}`} style={{ fontSize: '0.68rem' }}>
                                  {loan.status}
                                </span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  {loan.returned_at ? `Returned ${new Date(loan.returned_at).toLocaleDateString()}` : `Due ${new Date(loan.due_date).toLocaleDateString()}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Desk Visits */}
                    <div className="glass-panel" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={18} color="#10b981" />
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recent Study Desk Visits</h4>
                        </div>
                        <button
                          onClick={() => setActiveTab('sessions')}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          View All ({sessions.length})
                        </button>
                      </div>

                      {sessions.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No desk seating check-ins recorded yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {sessions.slice(0, 3).map((sess) => (
                            <div
                              key={sess.id}
                              style={{
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-glass)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                  Table {sess.table_number}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {sess.room_name}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                                  {sess.duration_minutes ? formatDuration(sess.duration_minutes) : 'Active'}
                                </span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  {new Date(sess.entered_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Academic Profile Details */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <User size={18} color="var(--secondary)" />
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Academic & System Record</h4>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      fontSize: '0.85rem'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Full Legal Name</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.full_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Enrollment / Roll No</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.roll_number || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>BT Number</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.bt_number || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Assigned Branch</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{student.branch_name || 'General'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Current Semester</span>
                        <strong style={{ color: 'var(--text-primary)' }}>Year {student.year} &bull; Semester {student.semester}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Account Status</span>
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
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Search books by title, author, or QR copy..."
                        value={loanSearch}
                        onChange={(e) => setLoanSearch(e.target.value)}
                        style={{ paddingLeft: '36px' }}
                      />
                    </div>
                    <select
                      className="glass-input glass-select"
                      value={loanFilter}
                      onChange={(e) => setLoanFilter(e.target.value)}
                      style={{ width: '160px' }}
                    >
                      <option value="all">All Loans ({loans.length})</option>
                      <option value="issued">Issued / Holding</option>
                      <option value="returned">Returned</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>

                  {filteredLoans.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <BookOpen size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                      <h4>No book loans found</h4>
                      <p style={{ fontSize: '0.85rem' }}>This student has no book loan records matching your criteria.</p>
                    </div>
                  ) : (
                    <div className="table-responsive-wrapper">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Book Title & Author</th>
                            <th>Copy QR Code</th>
                            <th>Issued Date</th>
                            <th>Due Date</th>
                            <th>Returned Date</th>
                            <th>Status</th>
                            <th>Fine Dues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLoans.map((loan, idx) => (
                            <tr key={loan.id}>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loan.book_title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{loan.book_author}</div>
                              </td>
                              <td style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                                {loan.qr_code || loan.copy_uuid || 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                {loan.issued_at ? new Date(loan.issued_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                {loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                {loan.returned_at ? new Date(loan.returned_at).toLocaleDateString() : (
                                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Currently Holding</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${loan.status === 'returned' ? 'badge-success' : (loan.status === 'issued' ? 'badge-warning' : 'badge-danger')}`}>
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
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <MapPin size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                      <h4>No study desk visits recorded</h4>
                      <p style={{ fontSize: '0.85rem' }}>When the student scans a desk QR badge, their session history will appear here.</p>
                    </div>
                  ) : (
                    <div className="table-responsive-wrapper">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Hall / Room</th>
                            <th>Desk No</th>
                            <th>Check-In Time</th>
                            <th>Check-Out Time</th>
                            <th>Duration</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((sess, idx) => (
                            <tr key={sess.id}>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {sess.room_name}
                              </td>
                              <td>
                                <span className="badge badge-secondary" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                  {sess.table_number}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                {new Date(sess.entered_at).toLocaleString()}
                              </td>
                              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                {sess.exited_at ? new Date(sess.exited_at).toLocaleString() : (
                                  <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                    Active Now
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                {sess.duration_minutes ? formatDuration(sess.duration_minutes) : 'In Progress'}
                              </td>
                              <td>
                                <span className={`badge ${sess.exited_at ? 'badge-success' : 'badge-primary'}`}>
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
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Laptop size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                      <h4>No digital e-books read yet</h4>
                      <p style={{ fontSize: '0.85rem' }}>When the student opens digital PDFs in the reader, their reading progress will sync here.</p>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '16px'
                    }}>
                      {bookProgress.map((item) => (
                        <div
                          key={item.id}
                          className="glass-panel"
                          style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                                {item.book?.branch?.name || 'All Branches'}
                              </span>
                              <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                                {item.book?.category?.name || 'General'}
                              </span>
                            </div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.book?.title || 'Unknown E-Book'}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Author: {item.book?.author || 'Unknown'}
                            </p>
                          </div>

                          <div style={{
                            marginTop: '16px',
                            paddingTop: '12px',
                            borderTop: '1px solid var(--border-glass)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem'
                          }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Last Page: </span>
                              <strong style={{ color: 'var(--primary)' }}>Page {item.last_page_read || 1}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Read Count: </span>
                              <strong>{item.accessed_count || 1} times</strong>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Branch Requests */}
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
                      Branch Access Request Records ({permissions.length})
                    </h4>
                    {permissions.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No extra branch permission requests filed.</p>
                    ) : (
                      <div className="table-responsive-wrapper">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Requested Branch</th>
                              <th>Date Requested</th>
                              <th>Approval Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {permissions.map((p) => (
                              <tr key={p.id}>
                                <td style={{ fontWeight: 600 }}>{p.branch?.name || p.branch_name || 'Branch Access'}</td>
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
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
                      System Activity Trail ({logs.length})
                    </h4>
                    {logs.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No recent activity events recorded.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {logs.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-glass)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.82rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                                {log.action_type?.toUpperCase()}
                              </span>
                              <span style={{ color: 'var(--text-primary)' }}>{log.details}</span>
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {new Date(log.created_at).toLocaleString()}
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
        <div style={{
          padding: '14px 28px',
          borderTop: '1px solid var(--border-glass)',
          background: 'rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Student UUID: <code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{student.id}</code>
          </div>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.85rem' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentActivityModal;
