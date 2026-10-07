"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AlertCircle, CheckCircle2, Sun, Moon, Mail, RefreshCw } from 'lucide-react';

const LIBRARY_WALLPAPERS = [
  {
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1920&q=80&fm=webp',
    name: 'SISTec Central Library'
  },
  {
    url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1920&q=80&fm=webp',
    name: 'Academic Knowledge Repository'
  },
  {
    url: 'https://images.unsplash.com/photo-1507842229451-76b1e60058ec?auto=format&fit=crop&w=1920&q=80&fm=webp',
    name: 'Reference & Archives Hall'
  },
  {
    url: 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1920&q=80&fm=webp',
    name: 'Digital & Research Commons'
  },
  {
    url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1920&q=80&fm=webp',
    name: 'Departmental Study Stacks'
  }
];

const Login = ({ onToggleView }) => {
  const { login, loginWithGoogle, resendVerificationEmail } = useAuth();
  const { mode, toggleMode } = useTheme();
  const isDark = mode === 'dark';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  useEffect(() => {
    document.title = 'Login - SISTec Digital Library Club';

    LIBRARY_WALLPAPERS.forEach((item) => {
      const img = new Image();
      img.src = item.url;
    });

    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % LIBRARY_WALLPAPERS.length);
    }, 6500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter both institutional email/username and password.');
      setUnverifiedEmail('');
      return;
    }

    try {
      setError('');
      setResendSuccess('');
      setUnverifiedEmail('');
      setLoading(true);
      await login(identifier.trim(), password);
    } catch (err) {
      if (err.isUnverified) {
        setUnverifiedEmail(err.email || identifier.trim());
        setError(err.message || 'Please verify your email before continuing.');
      } else {
        setUnverifiedEmail('');
        setError(err.message || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = unverifiedEmail || identifier.trim();
    if (!targetEmail || resendCooldown > 0 || resending) return;
    try {
      setResending(true);
      setResendSuccess('');
      await resendVerificationEmail(targetEmail);
      setResendSuccess(`Verification email sent to ${targetEmail}! Please check your inbox and spam folder.`);
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setUnverifiedEmail('');
      setResendSuccess('');
      setGoogleLoading(true);
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflow: 'hidden'
    }}>
      {/* ── Background Wallpaper Carousel ── */}
      <div className="login-bg-container">
        {LIBRARY_WALLPAPERS.map((wallpaper, index) => {
          const isActive = currentBgIndex === index;
          return (
            <div
              key={wallpaper.url}
              className="login-bg-slide"
              style={{
                backgroundImage: `url(${wallpaper.url})`,
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scale(1.08)' : 'scale(1.0)',
                zIndex: isActive ? 1 : 0
              }}
            />
          );
        })}
        <div className="login-backdrop-overlay" style={{ zIndex: 2 }} />
      </div>

      {/* ── Theme Toggle ── */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '24px',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button
          onClick={toggleMode}
          className="btn btn-secondary"
          style={{
            padding: '8px 16px',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="var(--primary)" />}
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* ── Main Login Card ── */}
      <div className="login-split-card" style={{ position: 'relative', zIndex: 5 }}>
        
        {/* ── Left Hero Side ── */}
        <div className="login-hero-side">
          {/* Ambient Floating Glow Orb Motion Graphic */}
          <div style={{
            position: 'absolute',
            top: '-25%',
            right: '-15%',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(6, 182, 212, 0.08) 50%, transparent 70%)',
            filter: 'blur(35px)',
            animation: 'orbDrift 8s ease-in-out infinite',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.25)',
                flexShrink: 0
              }}>
                <img
                  src="/logo.png"
                  alt="SISTec Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff', lineHeight: 1.15 }}>
                  SISTec
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Digital Library Club
                </span>
              </div>
            </div>

            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1.2, color: '#f8fafc', marginBottom: '16px', letterSpacing: '-0.03em' }}>
              Sagar Institute of Science & Technology
            </h1>
            <p style={{ fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '32px' }}>
              Access university textbooks, departmental references, research publications, and manage your library presence seamlessly.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                'Instant cross-department catalog search',
                'Digital reader with offline bookmarks & tracking',
                'Personalized reading history & analytics'
              ].map((text, i) => (
                <div 
                  key={i} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    fontSize: '0.88rem', 
                    color: '#cbd5e1',
                    animation: `fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.1}s forwards`,
                    opacity: 0
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle2 size={15} color="#60a5fa" />
                  </div>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            paddingTop: '24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.76rem',
            color: '#475569',
            position: 'relative',
            zIndex: 1
          }}>
            <span>© SISTec Central Library</span>
            <span style={{
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              fontWeight: 600
            }}>
              v2.0 Academic Portal
            </span>
          </div>
        </div>

        {/* ── Right Form Side ── */}
        <div className="login-form-side">
          {/* Mobile Header */}
          <div className="login-mobile-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.25)',
              margin: '0 auto 14px'
            }}>
              <img
                src="/logo.png"
                alt="SISTec Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              SISTec Library Portal
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Digital Library & Resource Management
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Welcome Back
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Sign in with your college credentials or Google account
            </p>
          </div>

          {/* Resend Success Alert */}
          {resendSuccess && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.84rem',
              marginBottom: '16px',
              lineHeight: 1.5,
              animation: 'fadeIn 0.3s ease forwards'
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>{resendSuccess}</div>
            </div>
          )}

          {/* Unverified Account Banner */}
          {unverifiedEmail ? (
            <div style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1.5px solid rgba(245, 158, 11, 0.35)',
              marginBottom: '18px',
              animation: 'fadeIn 0.3s ease forwards'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <Mail size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fbbf24', marginBottom: '2px' }}>
                    Please verify your email before continuing
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Your account is registered with <strong style={{ color: 'var(--text-primary)' }}>{unverifiedEmail}</strong>, but your email has not been confirmed yet. Please check your inbox and spam folder for the verification link.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending || resendCooldown > 0}
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    cursor: (resending || resendCooldown > 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <RefreshCw size={12} style={{ animation: resending ? 'spin 0.8s linear infinite' : 'none' }} />
                  {resending
                    ? 'Sending email...'
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Verification Email'}
                </button>
              </div>
            </div>
          ) : error ? (
            /* General Error Alert */
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              fontSize: '0.84rem',
              marginBottom: '16px',
              lineHeight: 1.5,
              animation: 'fadeIn 0.3s ease forwards'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>{error}</div>
            </div>
          ) : null}

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: '10px',
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              border: '1.5px solid var(--border-glass-hover)'
            }}
            disabled={loading || googleLoading}
            type="button"
          >
            {googleLoading ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
            gap: '12px',
            marginBottom: '18px'
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
              or sign in with credentials
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Enrollment / Roll No, Username, BT No, or Email
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. 0187CS211045, rohan_sharma, BT-4029, or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading || googleLoading}
                autoComplete="username"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
              className="btn btn-primary btn-shine"
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '4px',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: '10px'
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
                  animation: 'spin 0.8s linear infinite'
                }} />
              ) : (
                'Sign In to Portal'
              )}
            </button>
          </form>

          {/* Register Link */}
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
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  padding: 0,
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--secondary)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--primary)'}
              >
                Create Account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
