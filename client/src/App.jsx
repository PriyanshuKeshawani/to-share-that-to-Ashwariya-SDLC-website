import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
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

  if (loading) {
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
    return (
      <>
        <AdminDashboard />
        <ThemeToggle />
      </>
    );
  }

  // Student Account Pending Approval View
  if (user.role === 'student' && user.status === 'pending') {
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
          maxWidth: '460px',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--warning)'
          }}>
            <Clock size={30} />
          </div>
          <h2 style={{ marginBottom: '8px', fontSize: '1.4rem' }}>Approval Pending</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
            Hello <strong>{user.fullName || user.username}</strong>, your account registration has been submitted and is currently awaiting approval from the library administrator.
          </p>
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '24px',
            textAlign: 'left',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Roll Number:</span>
              <span style={{ fontWeight: 600 }}>{user.rollNumber || 'Pending'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Branch:</span>
              <span style={{ fontWeight: 600 }}>{user.branchName || 'Not Assigned'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account Status:</span>
              <span style={{
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#fbbf24',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}>
                Pending Approval
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ flex: 1, padding: '10px' }}
            >
              Refresh Status
            </button>
            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '10px' }}
            >
              Sign Out
            </button>
          </div>
        </div>
        <ThemeToggle />
      </div>
    );
  }

  // Student View (Reader or Dashboard)
  if (selectedBook) {
    return (
      <div style={{ padding: '40px 20px', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <BookReader
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
        />
        <ThemeToggle />
      </div>
    );
  }

  return (
    <>
      <StudentDashboard
        onSelectBook={(book) => setSelectedBook(book)}
      />
      <ThemeToggle />
    </>
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
