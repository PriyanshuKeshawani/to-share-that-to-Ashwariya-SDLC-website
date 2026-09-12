import { useState, useEffect, useCallback, Component, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import { Clock, AlertTriangle, ArrowLeft } from 'lucide-react';

// Route-level Dynamic Code Splitting for Ultra-Fast Initial Load (<85kB)
const Register = lazy(() => import('./pages/Register'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const BookReader = lazy(() => import('./pages/BookReader'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const GoogleProfileCompletion = lazy(() => import('./components/GoogleProfileCompletion'));

const LoadingFallback = ({ label = 'Loading SISTEC Portal...' }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '75vh',
    gap: '14px',
    color: 'var(--text-secondary)'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid rgba(239, 68, 68, 0.18)',
      borderTopColor: 'var(--primary, #ef4444)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <span style={{ fontSize: '0.88rem', fontWeight: 500, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>
      {label}
    </span>
  </div>
);

class ReaderErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Reader caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '75vh',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-primary)'
        }}>
          <div className="glass-panel" style={{ padding: '36px 28px', maxWidth: '460px', borderRadius: '16px' }}>
            <AlertTriangle size={44} color="#f59e0b" style={{ margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', fontWeight: 600 }}>
              Unable to Open Book
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '22px', lineHeight: '1.5' }}>
              We encountered an issue rendering this book's pages. You can return to your dashboard or retry opening it.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.props.onClose}
                className="btn btn-primary"
                style={{ fontSize: '0.84rem', gap: '6px' }}
              >
                <ArrowLeft size={14} /> Back to Catalog
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent = () => {
  const { user, loading, needsProfile, logout } = useAuth();
  const [selectedBook, setSelectedBook] = useState(null);

  const [isRegistering, setIsRegisteringState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/^\/+/, '');
    return params.get('view') === 'register' || path === 'register';
  });

  const setIsRegistering = useCallback((val) => {
    setIsRegisteringState(val);
    const params = new URLSearchParams(window.location.search);
    if (val) {
      params.set('view', 'register');
    } else {
      params.delete('view');
    }
    const newSearch = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.pushState(null, '', newSearch);
  }, []);

  // Restore book on refresh if ?read=:id exists in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/^\/+/, '');
    const readBookId = params.get('read') || params.get('book') || (path.startsWith('read/') ? path.split('/')[1] : null);

    if (readBookId && !selectedBook && user && user.role === 'student' && user.status === 'approved') {
      supabase
        .from('books')
        .select('*, category:category_id(name), branch:branch_id(name)')
        .eq('id', readBookId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (data && !error) {
            setSelectedBook(data);
          }
        });
    }
  }, [user]);

  const handleOpenBook = useCallback((book) => {
    setSelectedBook(book);
    const params = new URLSearchParams(window.location.search);
    if (book && book.id) {
      params.set('read', book.id);
    }
    const newUrl = `?${params.toString()}`;
    window.history.pushState(null, '', newUrl);
  }, []);

  const handleCloseBook = useCallback(() => {
    setSelectedBook(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('read');
    params.delete('book');
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.pushState(null, '', newUrl);
  }, []);

  // Listen to popstate for browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname.replace(/^\/+/, '');
      const isReg = params.get('view') === 'register' || path === 'register';
      setIsRegisteringState(isReg);

      const readBookId = params.get('read') || params.get('book') || (path.startsWith('read/') ? path.split('/')[1] : null);
      if (!readBookId && selectedBook) {
        setSelectedBook(null);
      } else if (readBookId && (!selectedBook || String(selectedBook.id) !== String(readBookId))) {
        supabase
          .from('books')
          .select('*, category:category_id(name), branch:branch_id(name)')
          .eq('id', readBookId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setSelectedBook(data);
          });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedBook]);

  // If user needs profile, reflect in URL
  useEffect(() => {
    if (needsProfile) {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'complete-profile');
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [needsProfile]);

  if (loading && !user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-main)',
        color: 'var(--text-primary)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem' }}>Authenticating user session...</p>
      </div>
    );
  }

  // Google first-time user - needs to complete profile
  if (needsProfile) {
    return (
      <Suspense fallback={<LoadingFallback label="Loading profile setup..." />}>
        <GoogleProfileCompletion />
      </Suspense>
    );
  }

  // Not Logged In
  if (!user) {
    return isRegistering ? (
      <Suspense fallback={<LoadingFallback label="Loading registration portal..." />}>
        <Register onToggleView={() => setIsRegistering(false)} />
      </Suspense>
    ) : (
      <Login onToggleView={() => setIsRegistering(true)} />
    );
  }

  // Admin View
  if (user.role === 'admin') {
    return (
      <Suspense fallback={<LoadingFallback label="Loading Admin Console..." />}>
        <AdminDashboard />
      </Suspense>
    );
  }

  // Student Account Pending or Rejected Access Blocker
  if (user.role === 'student' && (user.status === 'pending' || user.status === 'rejected')) {
    const isRejected = user.status === 'rejected';

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px 16px',
        background: 'var(--bg-main)'
      }}>
        <div className="glass-panel animate-fade-in" style={{
          width: '100%',
          maxWidth: '480px',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          borderRadius: '18px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: isRejected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1.5px solid ${isRejected ? 'var(--danger)' : 'var(--warning)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            color: isRejected ? 'var(--danger)' : 'var(--warning)'
          }}>
            <Clock size={32} />
          </div>

          <h2 style={{ marginBottom: '10px', fontSize: '1.45rem', fontWeight: 800 }}>
            {isRejected ? 'Registration Not Approved' : 'Approval Pending'}
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '22px', lineHeight: 1.6 }}>
            {isRejected ? (
              <>
                Hello <strong>{user.fullName || user.username}</strong>, your library registration request was not approved by the administrator. Please connect with your department library in-charge.
              </>
            ) : (
              <>
                Your account has been registered successfully. Please connect with the administrator for approval. You will be able to access SISTECH-LIB after your account is approved.
              </>
            )}
          </p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '16px 18px',
            marginBottom: '24px',
            textAlign: 'left',
            fontSize: '0.84rem'
          }}>
            <div style={{ fontSize: '0.76rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Student Identity Profile
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Student Name:</span>
              <span style={{ fontWeight: 600 }}>{user.fullName || 'Student'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Enrollment No:</span>
              <span style={{ fontWeight: 600 }}>{user.rollNumber || 'Pending'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Department:</span>
              <span style={{ fontWeight: 600 }}>{user.branchName || 'Not Assigned'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Year &amp; Semester:</span>
              <span style={{ fontWeight: 600 }}>{user.year || '1st Year'} • {user.semester || '1st Sem'}</span>
            </div>
            {user.btNumber && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>BT Code:</span>
                <span style={{ fontWeight: 600 }}>{user.btNumber}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Current Status:</span>
              <span style={{
                background: isRejected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: isRejected ? '#f87171' : '#fbbf24',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase'
              }}>
                {user.status || 'pending'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ flex: 1, padding: '11px', fontSize: '0.88rem', fontWeight: 600, borderRadius: '10px' }}
            >
              Refresh Status
            </button>
            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '11px', fontSize: '0.88rem', borderRadius: '10px' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Student View (Reader or Dashboard)
  if (selectedBook) {
    return (
      <div className="reader-page-wrapper">
        <ReaderErrorBoundary onClose={handleCloseBook}>
          <Suspense fallback={<LoadingFallback label="Opening eBook Reader..." />}>
            <BookReader
              book={selectedBook}
              onClose={handleCloseBook}
            />
          </Suspense>
        </ReaderErrorBoundary>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback label="Loading Student Portal..." />}>
      <StudentDashboard
        onSelectBook={handleOpenBook}
      />
    </Suspense>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <AppContent />
        </Suspense>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
