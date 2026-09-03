import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, UserCheck, AlertCircle, Sparkles, BookOpen, GraduationCap, CheckCircle2 } from 'lucide-react';

const Login = ({ onToggleView }) => {
  const { login, loginWithGoogle, bypassLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    document.title = 'Login - SISTec Library Portal';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
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
      setError(err.message || 'Google authentication failed.');
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
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'var(--bg-main)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="login-split-card">
        
        {/* ── Left Hero Side (Desktop/Tablet) ── */}
        <div className="login-hero-side">
          {/* Subtle Ambient Radial Glow */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.18) 0%, transparent 60%)',
            pointerEvents: 'none'
          }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
              <img
                src="/logo.png"
                alt="SISTec Logo"
                style={{
                  height: '52px',
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em', color: '#ffffff', lineHeight: 1.15 }}>
                  SISTec
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Central Library Portal
                </span>
              </div>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.25, color: '#f8fafc', marginBottom: '14px' }}>
              Sagar Institute of Science & Technology
            </h1>
            <p style={{ fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '28px' }}>
              Access university textbooks, departmental references, research publications, and manage your library presence seamlessly.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#38bdf8" />
                <span>Instant cross-department catalog search</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#38bdf8" />
                <span>QR-based study table check-in & occupancy</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#38bdf8" />
                <span>Digital reader with offline bookmarks & tracking</span>
              </div>
            </div>
          </div>

          <div style={{
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: '#64748b'
          }}>
            <span>© SISTec Central Library</span>
            <span>v2.0 Academic Portal</span>
          </div>
        </div>

        {/* ── Right Form Side (Login Card) ── */}
        <div className="login-form-side">
          {/* Mobile-Only Header */}
          <div className="login-mobile-header" style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img
              src="/logo.png"
              alt="SISTec Logo"
              style={{
                height: '68px',
                width: 'auto',
                objectFit: 'contain',
                margin: '0 auto 10px'
              }}
            />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              SISTec Library Portal
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Digital Library & Resource Management
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Sign In
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Enter your college credentials or sign in with Google
            </p>
          </div>

          {/* ── 1-CLICK INSTANT BYPASS ACCESS (PRESERVED & FULLY FUNCTIONAL) ── */}
          <div style={{
            background: 'rgba(37, 99, 235, 0.06)',
            border: '1px solid rgba(37, 99, 235, 0.22)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Sparkles size={12} /> Instant Bypass Access
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Demo / Testing</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={handleAdminBypass}
                type="button"
                className="btn btn-primary"
                style={{
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                title="1-Click Admin Access"
              >
                <Shield size={14} /> Admin Bypass
              </button>

              <button
                onClick={handleStudentBypass}
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                title="1-Click Student Access"
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
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              fontSize: '0.82rem',
              marginBottom: '16px',
              lineHeight: 1.4
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>{error}</div>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleLogin}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '11px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '0.88rem',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: googleLoading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading || googleLoading}
            type="button"
          >
            {googleLoading ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {googleLoading ? 'Connecting to Google...' : 'Sign in with Google'}
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              or with username
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. rohan or admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || googleLoading}
                autoComplete="username"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                marginTop: '4px',
                fontSize: '0.9rem'
              }}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              ) : (
                'Sign In to Portal'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
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
                  fontSize: '0.84rem',
                  padding: 0
                }}
              >
                Register Account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
