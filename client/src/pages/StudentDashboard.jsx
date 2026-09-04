import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, LogOut, CheckCircle, ShieldAlert, Download, 
  Search, Lock, Unlock, QrCode, MapPin, 
  Clock, AlertTriangle, BookMarked, Home, Library, Compass, DollarSign,
  Activity, X, ChevronRight, User, Settings
} from 'lucide-react';
import QRScanner from '../components/QRScanner';
import NotificationBell from '../components/NotificationBell';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import BottomNav from '../components/BottomNav';
import SettingsView from '../components/SettingsView';
import { SkeletonCard, SkeletonStatCard, SkeletonTable } from '../components/SkeletonLoader';
import DeskCheckinSuccessModal from '../components/DeskCheckinSuccessModal';

const StudentDashboard = ({ onSelectBook }) => {
  const { user, logout, apiCall, BASE_URL } = useAuth();
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState('all'); // all, catalog, home, other, loans, fines, history
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [prevTab, setPrevTab] = useState('all');
  const [tabTransition, setTabTransition] = useState(false);
  const [toastExiting, setToastExiting] = useState(false);

  // QR Scanner Modal
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScannerType, setQrScannerType] = useState('table');
  const [checkinSuccessData, setCheckinSuccessData] = useState(null);

  const showFeedback = useCallback((text, type = 'success') => {
    setToastExiting(false);
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setToastExiting(true);
      setTimeout(() => setFeedbackMsg({ text: '', type: '' }), 300);
    }, 3500);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [booksData, catsData, branchesData, reqsData, histData, loansData, sessionData] = await Promise.all([
        apiCall('/books'),
        apiCall('/books/categories'),
        apiCall('/books/branches'),
        apiCall('/permissions/my-requests'),
        apiCall('/analytics/my-history'),
        apiCall('/book-loans/my'),
        apiCall('/library-sessions/my-current')
      ]);

      setBooks(booksData || []);
      setCategories(catsData || []);
      setBranches(branchesData || []);
      setRequests(reqsData || []);
      setHistory(histData || []);
      setMyLoans(loansData || []);
      setCurrentSession(sessionData || null);
    } catch (err) {
      showFeedback(err.message || 'Failed to retrieve library data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Student Portal - SISTec Central Library';
    fetchData();
  }, []);

  // Fine Calculations
  const loansWithFines = useMemo(() => {
    const today = new Date();
    return myLoans.map(loan => {
      const dueDate = new Date(loan.due_date);
      const isOverdue = loan.status === 'issued' && today > dueDate;
      let calculatedFine = 0;
      let daysOverdue = 0;

      if (isOverdue) {
        const diffTime = Math.abs(today - dueDate);
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        calculatedFine = daysOverdue * 2; // ₹2/day fine default
      }

      return {
        ...loan,
        isOverdue,
        daysOverdue,
        calculatedFine: loan.fine_amount || calculatedFine
      };
    });
  }, [myLoans]);

  const totalFines = useMemo(() => {
    return loansWithFines.reduce((sum, loan) => sum + (loan.calculatedFine || 0), 0);
  }, [loansWithFines]);

  // QR Check-in / out
  const handleTableScan = async (qrValue) => {
    setShowQRScanner(false);
    try {
      const table = await apiCall(`/tables/by-qr/${qrValue}`);
      await apiCall('/tables/check-in', {
        method: 'POST',
        body: JSON.stringify({ table_id: table.id })
      });
      const session = await apiCall('/library-sessions/my-current');
      setCurrentSession(session);
      setCheckinSuccessData({ sessionData: session, tableInfo: table });
      showFeedback(`Checked in at Table ${table.table_number}${table.room ? ` (${table.room.name})` : ''}`);
    } catch (err) {
      showFeedback(err.message || 'Failed to check in', 'error');
    }
  };

  const handleCheckOut = async () => {
    try {
      await apiCall('/tables/check-out', { method: 'POST', body: JSON.stringify({}) });
      showFeedback('Checked out from table successfully');
      setCurrentSession(null);
    } catch (err) {
      showFeedback(err.message || 'Failed to check out', 'error');
    }
  };

  // Branch Access Request
  const handleRequestAccess = async (branchId, branchName) => {
    try {
      setActionLoading(prev => ({ ...prev, [branchId]: true }));
      const data = await apiCall('/permissions/request', {
        method: 'POST',
        body: JSON.stringify({ branch_id: branchId })
      });
      showFeedback(data.message || `Requested access for ${branchName}`);
      setRequests(prev => [...prev, { branch_id: branchId, status: 'pending' }]);
      const reqsData = await apiCall('/permissions/my-requests');
      setRequests(reqsData);
    } catch (err) {
      showFeedback(err.message || 'Failed to request branch access', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [branchId]: false }));
    }
  };

  // Download PDF
  const handleDownload = async (book) => {
    try {
      showFeedback(`Downloading "${book.title}"...`, 'success');
      await apiCall('/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ book_id: book.id, action_type: 'download' })
      });

      const safeTitle = (book.title || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${safeTitle}.pdf`;

      if (book.pdf_url && book.pdf_url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = book.pdf_url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (book.pdf_url && (book.pdf_url.startsWith('http') || book.pdf_url.startsWith('/uploads/'))) {
        const fullUrl = book.pdf_url.startsWith('http') ? book.pdf_url : `${BASE_URL}${book.pdf_url}`;
        try {
          const resp = await fetch(fullUrl);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch {
          const link = document.createElement('a');
          link.href = fullUrl;
          link.target = '_blank';
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        const blob = new Blob([`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF`], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      showFeedback(`"${book.title}" downloaded successfully!`, 'success');
      const [histData, booksData] = await Promise.all([
        apiCall('/analytics/my-history'),
        apiCall('/books')
      ]);
      setHistory(histData || []);
      setBooks(booksData || []);
    } catch (err) {
      showFeedback(err.message || 'Download failed', 'error');
    }
  };

  const isRequestPending = (branchId) => requests.some(r => r.branch_id === branchId && r.status === 'pending');
  const isRequestRejected = (branchId) => requests.some(r => r.branch_id === branchId && r.status === 'rejected');

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      if (activeTab === 'home' && book.branch_name !== user?.branchName) return false;
      if (activeTab === 'other' && book.branch_name === user?.branchName) return false;

      if (selectedCategory && book.category_id !== parseInt(selectedCategory, 10)) return false;
      if (selectedBranch && book.branch_id !== parseInt(selectedBranch, 10)) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchTitle = book.title?.toLowerCase().includes(q);
        const matchAuthor = book.author?.toLowerCase().includes(q);
        return matchTitle || matchAuthor;
      }
      return true;
    });
  }, [books, activeTab, selectedCategory, selectedBranch, search, user?.branchName]);

  const navItems = [
    { key: 'all', label: 'All Catalog', icon: Home },
    { key: 'home', label: 'Home Branch', icon: Library },
    { key: 'other', label: 'Other Branches', icon: Compass },
    { key: 'loans', label: 'My Borrowed Books', icon: BookMarked, badge: myLoans.length },
    { key: 'fines', label: 'Fines & Dues', icon: DollarSign, badge: totalFines > 0 ? `₹${totalFines}` : null, isDanger: totalFines > 0 },
    { key: 'history', label: 'Reading Progress', icon: Activity },
    { key: 'settings', label: 'Settings & Theme', icon: Settings },
  ];

  return (
    <div className="app-container">
      {/* ── Mobile Top Header (≤ 767px) ── */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
            flexShrink: 0
          }}>
            <img
              src="/logo.png"
              alt="SISTec Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              SISTec Library
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {user?.department || user?.branchName || 'Student'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentSession ? (
            <button
              onClick={handleCheckOut}
              className="badge badge-success"
              style={{ padding: '6px 10px', fontSize: '0.72rem', cursor: 'pointer', border: 'none' }}
              title="Click to check out"
            >
              <MapPin size={12} /> T-{currentSession.table_number || 'Desk'}
            </button>
          ) : (
            <button
              onClick={() => { setQrScannerType('table'); setShowQRScanner(true); }}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
              title="Scan Table QR"
            >
              <QrCode size={14} /> Scan
            </button>
          )}

          <NotificationBell />
        </div>
      </header>

      {/* ── Desktop Sidebar (≥ 768px) ── */}
      <aside className="sidebar">
        <div>
          {/* Logo & College Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
              flexShrink: 0
            }}>
              <img
                src="/logo.png"
                alt="SISTec Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                SISTec
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                Digital Library Portal
              </p>
            </div>
          </div>

          {/* Student Profile Summary Card */}
          <div className="glass-panel" style={{ padding: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(37, 99, 235, 0.15)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}>
                {(user?.fullName || user?.username || 'S')[0].toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.fullName || user?.username}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {user?.rollNumber || user?.roll_number || user?.rollNo || 'Enrolled Student'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)', paddingTop: '8px' }}>
              <span>{user?.branchName || 'Engineering'}</span>
              <span>{user?.year || '1st Year'} • {user?.semester || '1st Sem'}</span>
            </div>

            {/* Current Study Desk Session */}
            {currentSession && (
              <div style={{
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#10b981', fontWeight: 600 }}>
                  <MapPin size={13} />
                  <span>Table {currentSession.table_number}</span>
                </div>
                <button
                  onClick={handleCheckOut}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Leave
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map(({ key, label, icon: Icon, badge, isDanger }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => { setPrevTab(activeTab); setTabTransition(true); setActiveTab(key); setSelectedBranch(''); setTimeout(() => setTabTransition(false), 50); }}
                  className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    justifyContent: 'flex-start',
                    width: '100%',
                    padding: '9px 14px',
                    fontSize: '0.84rem'
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {badge && (
                    <span style={{
                      marginLeft: 'auto',
                      background: isDanger ? '#ef4444' : isActive ? '#ffffff' : 'var(--primary)',
                      color: isActive && !isDanger ? 'var(--primary)' : '#ffffff',
                      borderRadius: '999px',
                      padding: '1px 7px',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Quick Table Scan on Desktop */}
            {!currentSession && (
              <button
                onClick={() => { setQrScannerType('table'); setShowQRScanner(true); }}
                className="btn btn-secondary"
                style={{
                  justifyContent: 'flex-start',
                  width: '100%',
                  padding: '9px 14px',
                  fontSize: '0.84rem',
                  borderColor: 'rgba(14, 165, 233, 0.3)',
                  color: 'var(--secondary)'
                }}
              >
                <QrCode size={16} />
                <span>Scan Study Desk QR</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div>
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{
              justifyContent: 'center',
              width: '100%',
              borderColor: 'rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              fontSize: '0.82rem'
            }}
          >
            <LogOut size={15} /> Log Out
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="main-content">
        {/* Toast Feedback — smooth slide in/out */}
        {feedbackMsg.text && (
          <div className={`toast-notification ${toastExiting ? 'toast-exit' : ''}`} style={{
            position: 'fixed',
            top: '72px',
            right: '20px',
            left: '20px',
            zIndex: 3000,
            padding: '12px 18px',
            borderRadius: '12px',
            background: feedbackMsg.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            fontWeight: 500,
            pointerEvents: 'auto'
          }}>
            {feedbackMsg.type === 'error' ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Welcome Section & Quick Stats - Only visible on All Catalog tab */}
        {activeTab === 'all' && (
          <div className="motion-ambient-banner animate-fade-in" style={{ marginBottom: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', position: 'relative', zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Welcome back, {user?.fullName || user?.username}!
                </h2>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  SISTec Central Digital Library • {user?.branchName || 'All Departments'}
                </p>
              </div>

              {/* Desktop Quick Desk Status with Live Pulse */}
              {currentSession && (
                <div className="badge badge-success" style={{ padding: '7px 14px', fontSize: '0.78rem', gap: '8px' }}>
                  <span className="status-live-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}>
                    <span className="status-live-ping" style={{ backgroundColor: '#10b981' }} />
                  </span>
                  <MapPin size={13} /> Seated at Table {currentSession.table_number}
                </div>
              )}
            </div>

            {/* Quick Metrics Grid with Interactive Micro-Motions */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '14px',
              marginTop: '20px',
              position: 'relative',
              zIndex: 1
            }}>
              <div className="glass-panel motion-stat-card animate-stagger-in stagger-1" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="motion-card-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.14)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{books.length}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Library Catalog</div>
                </div>
              </div>

              <div className="glass-panel motion-stat-card animate-stagger-in stagger-2" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="motion-card-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.14)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookMarked size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{myLoans.length}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Borrowed Books</div>
                </div>
              </div>

              <div className="glass-panel motion-stat-card animate-stagger-in stagger-3" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="motion-card-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: totalFines > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.14)', color: totalFines > 0 ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: totalFines > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                    ₹{totalFines}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Pending Fine</div>
                </div>
              </div>

              <div className="glass-panel motion-stat-card animate-stagger-in stagger-4" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="motion-card-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.14)', color: 'var(--sistec-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{history.length}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Reading Sessions</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content Switcher based on activeTab ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : activeTab === 'settings' ? (
          <div className="animate-section-enter"><SettingsView /></div>
        ) : activeTab === 'loans' ? (
          /* ── My Loans View ── */
          <div className="animate-section-enter">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                My Borrowed Books ({myLoans.length})
              </h3>
            </div>

            {myLoans.length === 0 ? (
              <EmptyState
                icon={BookMarked}
                title="No books currently issued"
                description="Browse your departmental catalog to read or issue textbooks."
                actionLabel="Explore Catalog"
                onAction={() => setActiveTab('all')}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {loansWithFines.map((loan, idx) => (
                  <div key={loan.id} className="glass-panel glass-panel-hover animate-stagger-in" style={{
                    padding: '16px 20px',
                    borderLeft: loan.isOverdue ? '3px solid #ef4444' : '3px solid #10b981',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    animationDelay: `${Math.min(idx * 0.05, 0.4)}s`
                  }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
                        {loan.book_title}
                      </h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        by {loan.book_author}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span>Issued: {new Date(loan.issued_at).toLocaleDateString()}</span>
                        <span>Due Date: {new Date(loan.due_date).toLocaleDateString()}</span>
                        {loan.copy_uuid && <span>Copy ID: {loan.copy_uuid.slice(0, 8)}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {loan.isOverdue ? (
                        <div style={{ textAlign: 'right' }}>
                          <StatusBadge status="overdue" customLabel={`${loan.daysOverdue}d overdue`} />
                          <div style={{ fontSize: '0.84rem', color: '#ef4444', fontWeight: 700, marginTop: '3px' }}>
                            Fine: ₹{loan.calculatedFine}
                          </div>
                        </div>
                      ) : (
                        <StatusBadge status="issued" customLabel="Active Loan" />
                      )}

                      {/* Read Button if book is available */}
                      <button
                        onClick={() => onSelectBook({ id: loan.book_id, title: loan.book_title, author: loan.book_author })}
                        className="btn btn-primary btn-shine"
                        style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                      >
                        <BookOpen size={14} /> Read
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'fines' ? (
          /* ── Fines Tab ── */
          <div className="animate-section-enter">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Fines & Overdue Charges
            </h3>

            {totalFines === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="All clear! Zero pending fines"
                description="You have returned all library books on schedule without any overdue penalties."
              />
            ) : (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {loansWithFines.filter(l => l.calculatedFine > 0 || l.fine_amount > 0).map(loan => (
                    <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-glass)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{loan.book_title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Due date was {new Date(loan.due_date).toLocaleDateString()} ({loan.daysOverdue} days late)
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '1.05rem' }}>
                          ₹{loan.calculatedFine + (loan.fine_amount || 0)}
                        </div>
                        <span className="badge badge-danger" style={{ fontSize: '0.64rem' }}>Overdue</span>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Total Outstanding Fine</span>
                    <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '1.25rem' }}>₹{totalFines}</span>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    * Fines can be cleared in-person with the Library Admin desk or via student accounts.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'history' ? (
          /* ── Reading Progress View ── */
          <div className="animate-section-enter">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Reading Progress & Download Log
            </h3>

            {history.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No reading history recorded"
                description="Start reading books online or downloading syllabus chapters to build your reading tracker."
              />
            ) : (
              <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden' }}>
                <div className="table-responsive-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Book Title</th>
                        <th>Activity</th>
                        <th>Status / Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontWeight: 600 }}>{h.book_title || 'Reference Reading'}</td>
                          <td>
                            <StatusBadge status={h.action_type === 'download' ? 'approved' : 'available'} customLabel={h.action_type?.toUpperCase()} />
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                            {h.details || 'Completed reading session'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Catalog & Book Discovery View ── */
          <div className="animate-section-enter">
            {/* Search & Category Filter Bar */}
            <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: '1 1 240px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="glass-input"
                  placeholder="Search books by title, author, topic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
              </div>

              <div style={{ flex: '1 1 180px' }}>
                <select
                  className="glass-input glass-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.parent_name ? `(${cat.parent_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === 'all' && (
                <div style={{ flex: '1 1 180px' }}>
                  <select
                    className="glass-input glass-select"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option value="">All Branches</option>
                    {branches.map(br => (
                      <option key={br.id} value={br.id}>{br.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Book Cards Grid */}
            {filteredBooks.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No books match your criteria"
                description="Try clearing your search query or switching to another department category."
                actionLabel="Reset Search Filters"
                onAction={() => { setSearch(''); setSelectedCategory(''); setSelectedBranch(''); }}
              />
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '18px'
              }}>
                {filteredBooks.map((book, idx) => (
                  <div
                    key={book.id}
                    className="glass-panel glass-panel-hover animate-stagger-in"
                    style={{
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '260px',
                      animationDelay: `${Math.min(idx * 0.04, 0.4)}s`
                    }}
                  >
                    <div>
                      {/* Top Chips */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {book.priority === 'main' ? (
                            <span className="badge badge-gold">Main Syllabus</span>
                          ) : (
                            <span className="badge badge-secondary">Reference</span>
                          )}
                          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                            {book.branch_name}
                          </span>
                        </div>

                        {book.hasAccess ? (
                          <span className="badge badge-success" title="Unlocked for your account">
                            <Unlock size={11} /> Unlocked
                          </span>
                        ) : (
                          <span className="badge badge-danger" title="Access requires branch permission">
                            <Lock size={11} /> Locked
                          </span>
                        )}
                      </div>

                      {/* Title & Author */}
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '6px' }}>
                        {book.title}
                      </h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        by {book.author || 'Author not specified'}
                      </p>

                      {/* Copies Availability Indicator with live radar pulse */}
                      {book.totalCopies > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          <span className="status-live-dot" style={{
                            backgroundColor: book.availableCopies > 0 ? '#10b981' : '#ef4444',
                            boxShadow: book.availableCopies > 0 ? '0 0 6px #10b981' : 'none'
                          }}>
                            {book.availableCopies > 0 && (
                              <span className="status-live-ping" style={{ backgroundColor: '#10b981' }} />
                            )}
                          </span>
                          <span>{book.availableCopies} available / {book.totalCopies} total copies</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <span>{book.category_name || 'General Engineering'}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {book.hasAccess ? (
                          <>
                            <button
                              onClick={() => onSelectBook(book)}
                              className="btn btn-primary btn-shine"
                              style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                            >
                              <BookOpen size={14} /> Read
                            </button>
                            <button
                              onClick={() => handleDownload(book)}
                              className="btn btn-secondary"
                              style={{ padding: '8px 12px' }}
                              title="Download PDF Chapter"
                            >
                              <Download size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            {isRequestPending(book.branch_id) ? (
                              <button
                                className="btn btn-secondary"
                                style={{ width: '100%', cursor: 'not-allowed', fontSize: '0.8rem', opacity: 0.7 }}
                                disabled
                              >
                                Permission Requested
                              </button>
                            ) : isRequestRejected(book.branch_id) ? (
                              <button
                                onClick={() => handleRequestAccess(book.branch_id, book.branch_name)}
                                className="btn btn-danger"
                                style={{ width: '100%', fontSize: '0.8rem' }}
                                disabled={actionLoading[book.branch_id]}
                              >
                                {actionLoading[book.branch_id] ? 'Submitting...' : 'Request Again'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRequestAccess(book.branch_id, book.branch_name)}
                                className="btn btn-secondary"
                                style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)', fontSize: '0.8rem' }}
                                disabled={actionLoading[book.branch_id]}
                              >
                                {actionLoading[book.branch_id] ? 'Submitting...' : `Request ${book.branch_name} Access`}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Native-Style Mobile Bottom Navigation (≤ 767px) ── */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tabKey) => {
          setActiveTab(tabKey);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenMenu={() => setShowDrawer(true)}
        badges={{ loans: myLoans.length }}
      />

      {/* ── Mobile More / Profile Drawer (≤ 767px) ── */}
      {showDrawer && (
        <>
          <div className="mobile-sheet-overlay" onClick={() => setShowDrawer(false)} />
          <div className="mobile-sheet-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  flexShrink: 0
                }}>
                  <img src="/logo.png" alt="SISTec" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {user?.fullName || user?.username}
                  </h4>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {user?.rollNumber || user?.roll_number || user?.rollNo || 'SISTec Student'} • {user?.branchName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Actions in Mobile Drawer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => { setShowDrawer(false); setQrScannerType('table'); setShowQRScanner(true); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
              >
                <QrCode size={18} color="var(--primary)" />
                <span>Scan Study Desk QR Code</span>
              </button>

              <button
                onClick={() => { setShowDrawer(false); setActiveTab('fines'); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', padding: '12px 14px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={18} color={totalFines > 0 ? '#ef4444' : 'var(--text-muted)'} />
                  <span>My Fines & Dues</span>
                </div>
                {totalFines > 0 && <span className="badge badge-danger">₹{totalFines}</span>}
              </button>

              <button
                onClick={() => { setShowDrawer(false); setActiveTab('history'); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
              >
                <Activity size={18} color="var(--sistec-gold)" />
                <span>Reading Activity Log</span>
              </button>

              <button
                onClick={() => { setShowDrawer(false); setActiveTab('settings'); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
              >
                <Settings size={18} color="var(--primary)" />
                <span>Settings & Theme Preferences</span>
              </button>
            </div>

            <button
              onClick={logout}
              className="btn btn-danger"
              style={{ width: '100%', padding: '12px', fontSize: '0.88rem' }}
            >
              <LogOut size={16} /> Log Out from Portal
            </button>
          </div>
        </>
      )}

      {/* ── QR Scanner Modal ── */}
      {showQRScanner && (
        <QRScanner
          type={qrScannerType}
          onScan={qrScannerType === 'table' ? handleTableScan : undefined}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {/* ── Desk Check-in Instant Confirmation Modal ── */}
      {checkinSuccessData && (
        <DeskCheckinSuccessModal
          sessionData={checkinSuccessData.sessionData}
          tableInfo={checkinSuccessData.tableInfo}
          onClose={() => setCheckinSuccessData(null)}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
