import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen, LogOut, CheckCircle, ShieldAlert, Download,
  Search, Lock, Unlock,
  Clock, BookMarked, Home, Library, Compass,
  Activity, X, ChevronRight, User, Settings
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import BottomNav from '../components/BottomNav';
import SettingsView from '../components/SettingsView';
import { SkeletonCard } from '../components/SkeletonLoader';

const StudentDashboard = ({ onSelectBook }) => {
  const { user, logout, apiCall, extractDriveFileId } = useAuth();
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [toastExiting, setToastExiting] = useState(false);

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
      const [booksData, catsData, branchesData, reqsData, histData] = await Promise.all([
        apiCall('/books'),
        apiCall('/books/categories'),
        apiCall('/books/branches'),
        apiCall('/permissions/my-requests'),
        apiCall('/analytics/my-history')
      ]);

      setBooks(booksData || []);
      setCategories(catsData || []);
      setBranches(branchesData || []);
      setRequests(reqsData || []);
      setHistory(histData || []);
    } catch (err) {
      showFeedback(err.message || 'Failed to retrieve library data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Student Portal - SISTec Digital Library';
    fetchData();
  }, []);

  const handleRequestAccess = async (book) => {
    if (!book) return;
    const actionKey = `book-${book.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      const data = await apiCall('/permissions/request', {
        method: 'POST',
        body: JSON.stringify({
          book_id: book.id,
          book_title: book.title,
          branch_id: book.branch_id,
          branch_name: book.branch_name || book.branch?.name || ''
        })
      });
      showFeedback(data.message || `Requested reading permission for "${book.title}"`);
      const reqsData = await apiCall('/permissions/my-requests');
      setRequests(reqsData);
    } catch (err) {
      showFeedback(err.message || 'Failed to request book permission', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleDownload = async (book) => {
    const access = getBookAccess(book);
    if (!access.hasAccess) {
      showFeedback(`Permission required: You must request permission from Admin to download books outside your department.`, 'error');
      return;
    }

    try {
      showFeedback(`Preparing "${book.title}"...`, 'success');
      await apiCall('/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ book_id: book.id, action_type: 'download' })
      });

      const safeTitle = (book.title || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${safeTitle}.pdf`;

      // Drive download (open in new tab)
      if (book.drive_link || book.drive_file_id) {
        const driveUrl = book.drive_link || `https://drive.google.com/file/d/${book.drive_file_id}/view`;
        const downloadUrl = book.drive_link
          ? driveUrl.replace('/view', '/view').concat('?usp=sharing')
          : driveUrl;
        window.open(downloadUrl, '_blank', 'noopener');
        showFeedback(`Opening "${book.title}" in Google Drive...`, 'success');
        return;
      }

      if (book.pdf_url && book.pdf_url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = book.pdf_url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (book.pdf_url && book.pdf_url.startsWith('http')) {
        const fullUrl = book.pdf_url;
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
          window.open(fullUrl, '_blank');
        }
      } else {
        showFeedback('No downloadable file is linked to this book yet.', 'error');
        return;
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

  const getBookAccess = useCallback((book) => {
    if (!book) return { hasAccess: false, isHomeBranch: false, status: 'none' };
    if (user?.role === 'admin') return { hasAccess: true, isHomeBranch: true, status: 'approved' };

    const userBranch = (user?.branchName || user?.branch_name || '').trim().toLowerCase();
    const bookBranch = (book.branch_name || book.branch?.name || '').trim().toLowerCase();

    const isHomeBranch = Boolean(userBranch && bookBranch && userBranch === bookBranch);
    if (isHomeBranch) {
      return { hasAccess: true, isHomeBranch: true, status: 'approved' };
    }

    const req = requests.find(r =>
      book.id != null && r.book_id != null && String(r.book_id) === String(book.id)
    );

    if (req && req.status === 'approved') {
      return { hasAccess: true, isHomeBranch: false, status: 'approved' };
    }
    if (req && req.status === 'pending') {
      return { hasAccess: false, isHomeBranch: false, status: 'pending' };
    }
    if (req && req.status === 'rejected') {
      return { hasAccess: false, isHomeBranch: false, status: 'rejected' };
    }

    return { hasAccess: false, isHomeBranch: false, status: 'none' };
  }, [user, requests]);

  const handleOpenBook = (book) => {
    const access = getBookAccess(book);
    if (!access.hasAccess) {
      showFeedback(`Permission required: You must request permission to read books from ${book.branch_name || 'other departments'}.`, 'error');
      return;
    }
    onSelectBook(book);
  };

  const filteredBooks = useMemo(() => {
    const userBranch = (user?.branchName || user?.branch_name || '').trim().toLowerCase();

    return books.filter(book => {
      const bookBranch = (book.branch_name || book.branch?.name || '').trim().toLowerCase();
      const isHome = Boolean(userBranch && bookBranch && userBranch === bookBranch);

      if (selectedBranch) {
        const selectedBranchObj = branches.find(b => String(b.id) === String(selectedBranch));
        const matchBranchId = book.branch_id != null && String(book.branch_id) === String(selectedBranch);
        const matchBranchName = selectedBranchObj && bookBranch === selectedBranchObj.name.trim().toLowerCase();
        if (!matchBranchId && !matchBranchName) return false;
      } else {
        if (activeTab === 'home' && !isHome) return false;
        if (activeTab === 'other' && isHome) return false;
      }

      if (selectedCategory) {
        const selectedCatObj = categories.find(c => String(c.id) === String(selectedCategory));
        const bookCatName = (book.category_name || book.category?.name || '').trim().toLowerCase();
        const matchCatId = book.category_id != null && String(book.category_id) === String(selectedCategory);
        const matchCatName = selectedCatObj && bookCatName === selectedCatObj.name.trim().toLowerCase();
        if (!matchCatId && !matchCatName) return false;
      }

      if (search) {
        const q = search.toLowerCase().trim();
        const matchTitle = (book.title || '').toLowerCase().includes(q);
        const matchAuthor = (book.author || '').toLowerCase().includes(q);
        const matchBranch = bookBranch.includes(q);
        const matchCat = (book.category_name || book.category?.name || '').toLowerCase().includes(q);
        const matchPriority = (book.priority || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor && !matchBranch && !matchCat && !matchPriority) {
          return false;
        }
      }

      return true;
    });
  }, [books, activeTab, selectedCategory, selectedBranch, search, user?.branchName, user?.branch_name, branches, categories]);

  const navItems = [
    { key: 'all', label: 'All Catalog', icon: Home },
    { key: 'home', label: 'Home Branch', icon: Library },
    { key: 'other', label: 'Other Branches', icon: Compass },
    { key: 'history', label: 'Reading History', icon: Activity },
    { key: 'settings', label: 'Settings & Theme', icon: Settings }
  ];

  return (
    <div className="app-container">
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '11px',
            background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '3px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
            flexShrink: 0
          }}>
            <img src="/logo.png" alt="SISTec Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
          <NotificationBell />
        </div>
      </header>

      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '4px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
              flexShrink: 0
            }}>
              <img src="/logo.png" alt="SISTec Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

          <div className="glass-panel" style={{ padding: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(37, 99, 235, 0.15)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.9rem'
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
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => { setActiveTab(key); setSelectedBranch(''); }}
                  className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start', width: '100%', padding: '9px 14px', fontSize: '0.84rem' }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{ justifyContent: 'center', width: '100%', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '0.82rem' }}
          >
            <LogOut size={15} /> Log Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        {feedbackMsg.text && (
          <div className={`toast-notification ${toastExiting ? 'toast-exit' : ''}`} style={{
            position: 'fixed', top: '72px', right: '20px', left: '20px', zIndex: 3000,
            padding: '12px 18px', borderRadius: '12px',
            background: feedbackMsg.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            backdropFilter: 'blur(10px)', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 500,
            pointerEvents: 'auto'
          }}>
            {feedbackMsg.type === 'error' ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {activeTab === 'all' && (
          <div className="motion-ambient-banner animate-fade-in" style={{ marginBottom: '26px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                Welcome back, {user?.fullName || user?.username}!
              </h2>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                SISTec Digital Library • {user?.branchName || 'All Departments'}
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '14px', marginTop: '20px', position: 'relative', zIndex: 1
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
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{requests.filter(r => r.status === 'approved').length}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Approved Access</div>
                </div>
              </div>

              <div className="glass-panel motion-stat-card animate-stagger-in stagger-3" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="motion-card-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.14)', color: 'var(--sistec-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{history.length}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Reading Activity</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : activeTab === 'settings' ? (
          <div className="animate-section-enter"><SettingsView /></div>
        ) : activeTab === 'history' ? (
          <div className="animate-section-enter">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Reading History & Activity
            </h3>
            {history.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No reading history recorded"
                description="Start reading books online to build your reading tracker."
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
          <div className="animate-section-enter">
            <div className="glass-panel" style={{ padding: '16px 18px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: '1 1 240px', position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Search books by title, author, topic, branch..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: '40px', width: '100%' }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ flex: '1 1 180px' }}>
                  <select
                    className="glass-input glass-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={String(cat.id)}>
                        {cat.name} {cat.parent_name ? `(${cat.parent_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 180px' }}>
                  <select
                    className="glass-input glass-select"
                    value={selectedBranch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedBranch(val);
                      if (val) setActiveTab('all');
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">All Branches</option>
                    {branches.map(br => (
                      <option key={br.id} value={String(br.id)}>{br.name}</option>
                    ))}
                  </select>
                </div>

                {(search || selectedCategory || selectedBranch || activeTab !== 'all') && (
                  <button
                    onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedBranch(''); setActiveTab('all'); }}
                    className="btn btn-secondary"
                    style={{ padding: '9px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap', gap: '6px' }}
                    title="Reset all search and department filters"
                  >
                    <X size={13} /> Reset Filters
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick Filter:
                </span>
                <button
                  onClick={() => { setActiveTab('all'); setSelectedBranch(''); }}
                  style={{
                    padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: activeTab === 'all' && !selectedBranch ? 'var(--primary-glow)' : 'rgba(255,255,255,0.04)',
                    color: activeTab === 'all' && !selectedBranch ? 'var(--primary)' : 'var(--text-secondary)',
                    border: activeTab === 'all' && !selectedBranch ? '1px solid var(--primary)' : '1px solid var(--border-glass)'
                  }}
                >
                  All Catalog ({books.length})
                </button>
                <button
                  onClick={() => { setSelectedBranch(''); setActiveTab('home'); }}
                  style={{
                    padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: activeTab === 'home' && !selectedBranch ? 'var(--primary-glow)' : 'rgba(255,255,255,0.04)',
                    color: activeTab === 'home' && !selectedBranch ? 'var(--primary)' : 'var(--text-secondary)',
                    border: activeTab === 'home' && !selectedBranch ? '1px solid var(--primary)' : '1px solid var(--border-glass)'
                  }}
                >
                  My Branch ({user?.branchName || 'Department'})
                </button>
                <button
                  onClick={() => { setSelectedBranch(''); setActiveTab('other'); }}
                  style={{
                    padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: activeTab === 'other' && !selectedBranch ? 'var(--primary-glow)' : 'rgba(255,255,255,0.04)',
                    color: activeTab === 'other' && !selectedBranch ? 'var(--primary)' : 'var(--text-secondary)',
                    border: activeTab === 'other' && !selectedBranch ? '1px solid var(--primary)' : '1px solid var(--border-glass)'
                  }}
                >
                  Other Branches
                </button>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredBooks.length}</strong> of {books.length} books
                </span>
              </div>
            </div>

            {filteredBooks.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No books match your criteria"
                description="Try clearing your search query or switching to another department category."
                actionLabel="Reset Search Filters"
                onAction={() => { setSearch(''); setSelectedCategory(''); setSelectedBranch(''); setActiveTab('all'); }}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
                {filteredBooks.map((book, idx) => {
                  const access = getBookAccess(book);
                  const hasDrive = !!(book.drive_link || book.drive_file_id);
                  const hasPdf = !!book.pdf_url;
                  return (
                    <div
                      key={book.id}
                      className="glass-panel glass-panel-hover animate-stagger-in"
                      style={{
                        padding: '18px', display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between', minHeight: '260px',
                        animationDelay: `${Math.min(idx * 0.04, 0.4)}s`
                      }}
                    >
                      {/* Book Cover Thumbnail */}
                      {book.cover_url && (
                        <div style={{
                          width: '100%',
                          height: '140px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          marginBottom: '12px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-glass)'
                        }}>
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {book.priority === 'main' ? (
                              <span className="badge badge-gold">Main Syllabus</span>
                            ) : (
                              <span className="badge badge-secondary">Reference</span>
                            )}
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                              {book.branch_name || 'All Branches'}
                            </span>
                            {hasDrive && (
                              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontSize: '0.62rem' }}>
                                Drive
                              </span>
                            )}
                          </div>

                          {access.hasAccess ? (
                            <span className="badge badge-success" title={access.isHomeBranch ? "Unlocked for your department" : "Permission granted by Admin"}>
                              <Unlock size={11} /> {access.isHomeBranch ? "Unlocked" : "Access Granted"}
                            </span>
                          ) : (
                            <span className="badge badge-danger" title="Access requires admin permission">
                              <Lock size={11} /> Locked
                            </span>
                          )}
                        </div>

                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '6px' }}>
                          {book.title}
                        </h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                          by {book.author || 'Author not specified'}
                        </p>
                        {!hasDrive && !hasPdf && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
                            Preview only — no file linked yet
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <span>{book.category_name || 'General Engineering'}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          {access.hasAccess ? (
                            <>
                              <button
                                onClick={() => handleOpenBook(book)}
                                className="btn btn-primary btn-shine"
                                style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                              >
                                <BookOpen size={14} /> Read
                              </button>
                              {(hasDrive || hasPdf) && (
                                <button
                                  onClick={() => handleDownload(book)}
                                  className="btn btn-secondary"
                                  style={{ padding: '8px 12px' }}
                                  title="Download / Open in Drive"
                                >
                                  <Download size={14} />
                                </button>
                              )}
                            </>
                          ) : access.status === 'pending' ? (
                            <button
                              className="btn btn-secondary"
                              style={{ width: '100%', cursor: 'not-allowed', fontSize: '0.8rem', opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                              disabled
                            >
                              <Clock size={13} /> Permission Requested (Pending Admin Approval)
                            </button>
                          ) : access.status === 'rejected' ? (
                            <button
                              onClick={() => handleRequestAccess(book)}
                              className="btn btn-danger"
                              style={{ width: '100%', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              disabled={actionLoading[`book-${book.id}`]}
                            >
                              <ShieldAlert size={13} /> {actionLoading[`book-${book.id}`] ? 'Submitting...' : 'Permission Denied - Request Again'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRequestAccess(book)}
                              className="btn btn-primary btn-shine"
                              style={{ width: '100%', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              disabled={actionLoading[`book-${book.id}`]}
                            >
                              <Lock size={13} /> {actionLoading[`book-${book.id}`] ? 'Requesting...' : 'Request Permission to Read'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tabKey) => {
          setActiveTab(tabKey);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenMenu={() => {}}
        badges={{}}
      />
    </div>
  );
};

export default StudentDashboard;
