import { useState } from 'react';
import { Sun, Moon, Palette, Check, Sparkles, User, Shield, BookOpen, Layers, Laptop } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const SettingsView = ({ isAdmin = false }) => {
  const {
    mode,
    toggleMode,
    paletteId,
    selectPalette,
    palettes,
    customPrimary,
    setCustomPrimary,
    customSecondary,
    setCustomSecondary
  } = useTheme();

  const { user } = useAuth();
  const isDark = mode === 'dark';

  return (
    <div className="animate-fade-in" style={{ maxWidth: '860px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Settings & Appearance
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Personalize your library portal interface, select color palettes, and view account credentials
        </p>
      </div>

      {/* ── Section 1: Display Mode (Dark vs Light) ── */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.12)', color: 'var(--primary)' }}>
            <Laptop size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Theme Mode</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Choose between dark academic study mode or crisp daylight mode</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {/* Dark Mode Card */}
          <div
            onClick={() => { if (!isDark) toggleMode(); }}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: isDark ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
              background: isDark ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              boxShadow: isDark ? '0 0 0 1px var(--primary)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#0a0f1d',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Moon size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Dark Academic</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Comfortable night reading</div>
              </div>
            </div>
            {isDark && (
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={14} />
              </div>
            )}
          </div>

          {/* Light Mode Card */}
          <div
            onClick={() => { if (isDark) toggleMode(); }}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: !isDark ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
              background: !isDark ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              boxShadow: !isDark ? '0 0 0 1px var(--primary)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#ffffff',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
              }}>
                <Sun size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Daylight Campus</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>High contrast daylight</div>
              </div>
            </div>
            {!isDark && (
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={14} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Institutional Color Palettes ── */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.12)', color: 'var(--secondary)' }}>
            <Palette size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Institutional Color Palettes</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Select your primary college accent and button highlights</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {palettes.filter(p => p.id !== 'custom').map((p) => {
            const isSelected = paletteId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => selectPalette(p.id)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: isSelected ? `2px solid ${p.primary}` : '1px solid var(--border-glass)',
                  background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: p.primary, border: '2px solid rgba(255,255,255,0.2)' }} />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: p.secondary, marginLeft: '-8px', border: '2px solid rgba(255,255,255,0.2)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.primary}</div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: p.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Profile & Institutional Credentials ── */}
      {user && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
              {isAdmin ? <Shield size={18} /> : <User size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                {isAdmin ? 'System Administrator Profile' : 'Student Academic Credentials'}
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Registered identity details on SISTec Central Library server</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</span>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{user.fullName || user.username}</strong>
            </div>

            <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</span>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{user.username}</strong>
            </div>

            {!isAdmin && (
              <>
                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrollment / Roll No</span>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{user.rollNumber || user.roll_number || 'Not Assigned'}</strong>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BT Library Number</span>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{user.btNumber || user.bt_number || 'Not Assigned'}</strong>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department / Branch</span>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{user.branchName || 'Engineering'}</strong>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academic Year & Semester</span>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{user.year || '1st Year'} • {user.semester || '1st Sem'}</strong>
                </div>
              </>
            )}

            <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Role</span>
              <strong style={{ fontSize: '0.92rem', color: isAdmin ? 'var(--primary)' : 'var(--success)', textTransform: 'uppercase' }}>{user.role}</strong>
            </div>

            <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auth Provider</span>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{user.authProvider || 'Database'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 4: Portal System Information ── */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>SISTec Central Library Portal v2.0 • Academic Edition</span>
        <span>Sagar Institute of Science & Technology</span>
      </div>
    </div>
  );
};

export default SettingsView;
