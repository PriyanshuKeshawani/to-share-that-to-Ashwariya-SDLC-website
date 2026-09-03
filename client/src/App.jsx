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

const AppContent = () => {
  const { user, loading, needsProfile } = useAuth();
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
