import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import BookReader from './pages/BookReader';
import AdminDashboard from './pages/AdminDashboard';
import GoogleProfileCompletion from './components/GoogleProfileCompletion';
import { Clock } from 'lucide-react';

const AppContent = () => {
  const { user, loading, needsProfile, logout } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

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
    return <GoogleProfileCompletion />;
  }

  // Not Logged In
  if (!user) {
    return isRegistering ? (
      <Register onToggleView={() => setIsRegistering(false)} />
    ) : (
      <Login onToggleView={() => setIsRegistering(true)} />
    );
  }

  // Admin View
  if (user.role === 'admin') {
    return <AdminDashboard />;
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
        <BookReader
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
        />
      </div>
    );
  }

  return (
    <StudentDashboard
      onSelectBook={(book) => setSelectedBook(book)}
    />
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
