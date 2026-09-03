import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogIn, Shield, UserCheck, AlertCircle, Sparkles } from 'lucide-react';

const Login = ({ onToggleView }) => {
  const { login, loginWithGoogle, bypassLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    document.title = 'Login - SISTEC Library Portal';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setGoogleLoading(true);
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Google authentication failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleAdminBypass = () => {
    setError('');
    bypassLogin('admin');
  };

  const handleStudentBypass = () => {
    setError('');
    bypassLogin('student');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px 16px',
      background: 'radial-gradient(ellipse at 50% -20%, rgba(99, 102, 241, 0.15), transparent 70%), var(--bg-main)'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '36px 32px',
        position: 'relative',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 30px -10px rgba(99, 102, 241, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            marginBottom: '14px',
            boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.5)'
          }}>
            <BookOpen size={30} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            SISTEC Library
          </h2>
          <p style={{ marginTop: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Digital Library & Resource Management Portal
          </p>
        </div>

        {/* 1-Click Fast Bypass Section */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Sparkles size={13} /> Instant Bypass Access
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No credentials required</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={handleAdminBypass}
              type="button"
              className="btn btn-primary"
              style={{
                padding: '9px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Shield size={14} /> Admin Bypass
            </button>

            <button
              onClick={handleStudentBypass}
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '9px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              <UserCheck size={14} /> Student Bypass
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.84rem',
            marginBottom: '18px',
            lineHeight: 1.4
          }}>
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleLogin}
          className="btn"
          style={{
            width: '100%',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '0.92rem',
            fontWeight: 600,
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: googleLoading ? 'not-allowed' : 'pointer'
          }}
          disabled={loading || googleLoading}
          type="button"
        >
          {googleLoading ? (
            <div style={{
              width: '18px',
              height: '18px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {googleLoading ? 'Redirecting to Google...' : 'Sign in with Google'}
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            or with credentials
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Credentials Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Username
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. admin or student_cs"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || googleLoading}
              autoComplete="username"
              style={{ width: '100%', padding: '11px 14px', borderRadius: '8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              className="glass-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || googleLoading}
              autoComplete="current-password"
              style={{ width: '100%', padding: '11px 14px', borderRadius: '8px' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '13px',
              marginTop: '6px',
              fontSize: '0.92rem',
              fontWeight: 600,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <div style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <><LogIn size={17} /> Sign In</>
            )}
          </button>
        </form>

        {/* Switch to Register */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            New Student?{' '}
            <button
              onClick={onToggleView}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
                fontSize: '0.86rem',
                padding: 0
              }}
            >
              Create an account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
