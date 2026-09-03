import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { 
  Book, BookOpen, Download, Lock, Unlock, Search, LogOut, CheckCircle, 
  Clock, ShieldAlert, User, GraduationCap, QrCode, AlertTriangle,
  CreditCard, ArrowLeftRight
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import QRScanner from '../components/QRScanner';

const StudentDashboard = ({ onSelectBook }) => {
  const { user, logout, apiCall } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'home', 'other', 'history', 'loans', 'fines'
  
  // Data
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // UI State
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScannerType, setQrScannerType] = useState('table');

  const showFeedback = useCallback((text, type = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg({ text: '', type: '' }), 5000);
  }, []);

  const fetchData = useCallback(async () => {
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
      
      setBooks(booksData);
      setCategories(catsData);
      setBranches(branchesData);
      setRequests(reqsData);
      setHistory(histData);
      setMyLoans(loansData.filter(l => l.status === 'issued'));
      setCurrentSession(sessionData);
    } catch (err) {
      showFeedback(err.message || 'Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiCall, showFeedback]);

  useEffect(() => {
    document.title = 'Student Dashboard - SISTEC Library';
    const timer = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Calculate fines for overdue loans
  const loansWithFines = useMemo(() => {
    const now = new Date();
    return myLoans.map(loan => {
      const dueDate = new Date(loan.due_date);
      const isOverdue = now > dueDate && !loan.returned_at;
      const daysOverdue = isOverdue ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0;
      const calculatedFine = daysOverdue * 5; // ₹5 per day default
      return {
        ...loan,
        isOverdue,
        daysOverdue,
        calculatedFine: Math.max(0, calculatedFine)
      };
    });
  }, [myLoans]);

  const totalFines = useMemo(() => {
    return loansWithFines.reduce((sum, l) => sum + l.calculatedFine + (l.fine_amount || 0), 0);
  }, [loansWithFines]);

  // QR Scanner handlers
  const handleTableScan = async (qrValue) => {
    setShowQRScanner(false);
    try {
      // Look up table by QR identifier
      const table = await apiCall(`/tables/by-qr/${qrValue}`);
      
      // Check-in
      await apiCall('/tables/check-in', {
        method: 'POST',
        body: JSON.stringify({ table_id: table.id })
      });

      showFeedback(`Checked in at Table ${table.table_number}${table.room ? ` (${table.room.name})` : ''}`);
      const session = await apiCall('/library-sessions/my-current');
      setCurrentSession(session);
    } catch (err) {
      showFeedback(err.message || 'Failed to check in', 'error');
    }
  };

  const handleCheckOut = async () => {
    try {
      await apiCall('/tables/check-out', { method: 'POST', body: JSON.stringify({}) });
      showFeedback('Checked out successfully');
      setCurrentSession(null);
    } catch (err) {
      showFeedback(err.message || 'Failed to check out', 'error');
    }
  };

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

  const handleDownload = async (book) => {
    try {
      showFeedback(`Starting download for "${book.title}"...`, 'success');
      await apiCall('/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ book_id: book.id, action_type: 'download' })
      });

      const link = document.createElement('a');
      if (book.pdf_url && book.pdf_url.startsWith('/uploads/')) {
        link.href = `${BASE_URL}${book.pdf_url}`;
        link.setAttribute('target', '_blank');
        const filename = book.pdf_url.split('/').pop();
        link.setAttribute('download', filename);
      } else {
        const blob = new Blob([`Simulated PDF Content for ${book.title}`], { type: 'application/pdf' });
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${book.title.toLowerCase().replace(/ /g, '_')}.pdf`);
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showFeedback(`"${book.title}" downloaded successfully!`, 'success');
      const [histData, booksData] = await Promise.all([
        apiCall('/analytics/my-history'),
        apiCall('/books')
      ]);
      setHistory(histData);
      setBooks(booksData);
    } catch (err) {
      showFeedback(err.message || 'Download failed', 'error');
    }
  };

  const isRequestPending = (branchId) => requests.some(r => r.branch_id === branchId && r.status === 'pending');
  const isRequestRejected = (branchId) => requests.some(r => r.branch_id === branchId && r.status === 'rejected');

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      if (activeTab === 'home' && book.branch_name !== user.branchName) return false;
      if (activeTab === 'other' && book.branch_name === user.branchName) return false;

      if (selectedCategory && book.category_id !== parseInt(selectedCategory, 10)) return false;
      if (selectedBranch && book.branch_id !== parseInt(selectedBranch, 10)) return false;

      if (search) {
        const query = search.toLowerCase();
        const matchTitle = book.title?.toLowerCase().includes(query) || false;
        const matchAuthor = book.author?.toLowerCase().includes(query) || false;
        const matchCat = book.category_name?.toLowerCase().includes(query) || false;
        if (!matchTitle && !matchAuthor && !matchCat) return false;
      }

      return true;
    });
  }, [books, activeTab, selectedCategory, selectedBranch, search, user.branchName]);

  const tabConfig = [
    { key: 'all', label: 'All Books', icon: Book },
    { key: 'home', label: 'Home Branch', icon: CheckCircle },
    { key: 'other', label: 'Extra Branches', icon: Lock },
    { key: 'loans', label: 'My Books', icon: ArrowLeftRight },
    { key: 'fines', label: 'Fines', icon: CreditCard },
    { key: 'history', label: 'Reading Progress', icon: Clock },
  ];

  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} color="var(--secondary)" />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            SISTEC Library
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationBell />
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <BookOpen size={28} color="var(--secondary)" />
            <h3 style={{ fontSize: '1.25rem', background: 'linear-gradient(135deg, #ffffff, var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SISTEC Library
            </h3>
          </div>

          {/* Current Session Card */}
          {currentSession && (
            <div className="glass-panel" style={{
              padding: '14px',
              marginBottom: '16px',
              borderLeft: '3px solid var(--success)',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <QrCode size={14} color="var(--success)" />
                <strong style={{ color: 'var(--success)' }}>Currently Checked In</strong>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Table {currentSession.table_number}
                {currentSession.room_name && ` • ${currentSession.room_name}`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Since {new Date(currentSession.entered_at).toLocaleTimeString()}
              </div>
              <button
                onClick={handleCheckOut}
                className="btn btn-secondary"
                style={{ marginTop: '8px', padding: '6px 12px', fontSize: '0.75rem', width: '100%' }}
              >
                Check Out
              </button>
            </div>
          )}

          {/* Student Profile */}
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
              ) : (
                <User size={16} color="var(--primary)" />
              )}
              <strong style={{ color: 'var(--text-primary)' }}>{user.fullName}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <GraduationCap size={14} />
              <span>{user.rollNumber}</span>
            </div>
            <div style={{ margin: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }} />
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>Branch:</strong> {user.branchName}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>Year:</strong> {user.year}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>Sem:</strong> {user.semester}
            </div>

            {/* Fine Summary */}
            {totalFines > 0 && (
              <div style={{
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <AlertTriangle size={14} color="var(--danger)" />
                <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>
                  Pending Fine: ₹{totalFines}
                </span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tabConfig.map(({ key, label, icon: Icon }) => (
              <button 
                key={key}
                onClick={() => { setActiveTab(key); setSelectedBranch(''); }}
                className={`btn ${activeTab === key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Icon size={16} /> {label}
                {key === 'loans' && myLoans.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--primary)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {myLoans.length}
                  </span>
                )}
              </button>
            ))}

            {/* Scan QR Button */}
            {!currentSession && (
              <button 
                onClick={() => { setQrScannerType('table'); setShowQRScanner(true); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'center', width: '100%', padding: '10px 16px', borderColor: 'rgba(6, 182, 212, 0.3)', color: 'var(--secondary)' }}
              >
                <QrCode size={16} /> Scan Table QR
              </button>
            )}
          </nav>
        </div>

        <button 
          onClick={logout}
          className="btn btn-secondary"
          style={{ justifyContent: 'center', width: '100%', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
        >
          <LogOut size={16} /> Log Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Toast */}
        {feedbackMsg.text && (
          <div className="animate-fade-in" style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 1000,
            padding: '14px 20px', borderRadius: '10px',
            background: feedbackMsg.type === 'error' ? '#7f1d1d' : '#064e3b',
            border: `1px solid ${feedbackMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
            color: '#ffffff', boxShadow: 'var(--shadow-glass)',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            {feedbackMsg.type === 'error' ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{feedbackMsg.text}</span>
          </div>
        )}

        <div style={{ marginBottom: '32px' }}>
          <h2>Welcome back, {user.fullName}!</h2>
          <p style={{ marginTop: '4px' }}>Browse the library archives and manage your books.</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p>Retrieving library catalog...</p>
          </div>
        ) : activeTab === 'loans' ? (
          /* My Loans Tab */
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '20px' }}>My Borrowed Books ({myLoans.length})</h3>
            
            {myLoans.length === 0 ? (
              <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
                <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h4>No books borrowed</h4>
                <p style={{ marginTop: '8px' }}>Scan a book QR or browse the catalog to issue books.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {loansWithFines.map(loan => (
                  <div key={loan.id} className="glass-panel" style={{
                    padding: '20px',
                    borderLeft: loan.isOverdue ? '3px solid var(--danger)' : '3px solid var(--success)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{loan.book_title}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>by {loan.book_author}</p>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <span>Issued: {new Date(loan.issued_at).toLocaleDateString()}</span>
                          <span>Due: {new Date(loan.due_date).toLocaleDateString()}</span>
                          {loan.copy_uuid && <span>Copy: {loan.copy_uuid.slice(0, 8)}...</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {loan.isOverdue ? (
                          <div>
                            <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                              {loan.daysOverdue} days overdue
                            </span>
                            <div style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600, marginTop: '4px' }}>
                              Fine: ₹{loan.calculatedFine}
                            </div>
                          </div>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'fines' ? (
          /* Fines Tab */
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '20px' }}>My Fines</h3>
            {totalFines === 0 ? (
              <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
                <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '16px' }} />
                <h4>No pending fines</h4>
                <p style={{ marginTop: '8px' }}>You are all clear. Return books on time to avoid fines.</p>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {loansWithFines.filter(l => l.calculatedFine > 0 || l.fine_amount > 0).map(loan => (
                    <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{loan.book_title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due: {new Date(loan.due_date).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--danger)' }}>₹{loan.calculatedFine + (loan.fine_amount || 0)}</div>
                        {loan.isOverdue && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>{loan.daysOverdue} days overdue</span>}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontWeight: 700 }}>Total Outstanding</span>
                    <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '1.1rem' }}>₹{totalFines}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'history' ? (
          /* Reading Progress Tab */
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '20px' }}>Reading Progress</h3>
            {history.length === 0 ? (
              <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
                <Clock size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h4>No reading history</h4>
                <p style={{ marginTop: '8px' }}>Start reading books to track your progress.</p>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Book</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                            {new Date(h.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{h.book_title || '-'}</td>
                          <td style={{ padding: '12px' }}>
                            <span className={`badge ${h.action_type === 'view' ? 'badge-primary' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                              {h.action_type}
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{h.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Books Grid View */
          <>
            {/* Search & Filters */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="glass-input"
                  placeholder="Search by book title or author..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                />
              </div>

              <div style={{ width: 'var(--filter-width, 200px)' }}>
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
                <div style={{ width: 'var(--filter-width, 200px)' }}>
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

            {filteredBooks.length === 0 ? (
              <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
                <Book size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h4>No books found</h4>
                <p style={{ marginTop: '8px' }}>No records match the current search filters.</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px'
              }}>
                {filteredBooks.map(book => (
                  <div key={book.id} className="glass-panel glass-card-interactive" style={{
                    padding: 'var(--card-inner-padding, 24px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '260px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Access Badge */}
                    <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                      {book.hasAccess ? (
                        <span className="badge badge-success" style={{ gap: '4px' }}>
                          <Unlock size={10} /> Unlocked
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ gap: '4px' }}>
                          <Lock size={10} /> Locked
                        </span>
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {book.priority === 'main' ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Main Subject</span>
                        ) : (
                          <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Sub Subject</span>
                        )}
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem', textTransform: 'none' }}>
                          {book.branch_name}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', lineHeight: '1.4', paddingRight: '60px' }}>
                        {book.title}
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        By {book.author}
                      </p>

                      {/* Copy count */}
                      {book.totalCopies > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          Copies: {book.availableCopies} available / {book.totalCopies} total
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0 0', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Category: {book.category_name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                        {book.hasAccess ? (
                          <>
                            <button
                              onClick={() => onSelectBook(book)}
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                            >
                              <BookOpen size={14} /> Read
                            </button>
                            <button
                              onClick={() => handleDownload(book)}
                              className="btn btn-secondary"
                              style={{ padding: '8px 12px' }}
                              title="Download PDF"
                            >
                              <Download size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            {isRequestPending(book.branch_id) ? (
                              <button
                                className="btn btn-secondary"
                                style={{ width: '100%', cursor: 'not-allowed', fontSize: '0.85rem' }}
                                disabled
                              >
                                Request Pending Approval
                              </button>
                            ) : isRequestRejected(book.branch_id) ? (
                              <button
                                onClick={() => handleRequestAccess(book.branch_id, book.branch_name)}
                                className="btn btn-danger"
                                style={{ width: '100%', fontSize: '0.85rem' }}
                                disabled={actionLoading[book.branch_id]}
                              >
                                {actionLoading[book.branch_id] ? 'Submitting...' : 'Rejected - Request Again'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRequestAccess(book.branch_id, book.branch_name)}
                                className="btn btn-secondary"
                                style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)', fontSize: '0.85rem' }}
                                disabled={actionLoading[book.branch_id]}
                              >
                                {actionLoading[book.branch_id] ? 'Submitting...' : `Request Access to ${book.branch_name}`}
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
          </>
        )}
      </main>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          type={qrScannerType}
          onScan={qrScannerType === 'table' ? handleTableScan : undefined}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
