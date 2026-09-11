import { Sun, Moon, Palette, Check, User, Shield, Laptop } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const SettingsView = ({ isAdmin = false }) => {
  const {
    mode,
    toggleMode,
    paletteId,
    selectPalette,
    palettes
  } = useTheme();

  const { user } = useAuth();
  const isDark = mode === 'dark';

  return (
    <div className="animate-fade-in" style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Settings & Appearance
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Personalize your library portal interface, select color palettes, and view account details
        </p>
      </div>

      {/* ── Section 1: Theme Mode ── */}
      <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ 
            padding: '10px', borderRadius: '12px', 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(6, 182, 212, 0.08))', 
            color: 'var(--primary)' 
          }}>
            <Laptop size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Theme Mode</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Choose between dark academic study mode or crisp daylight mode</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Dark Mode Card */}
          <div
            onClick={() => { if (!isDark) toggleMode(); }}
            style={{
              padding: '18px',
              borderRadius: '14px',
              border: isDark ? '2px solid var(--primary)' : '1.5px solid var(--border-glass)',
              background: isDark ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: isDark ? 'var(--shadow-glow-primary)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: '#0a0f1d', color: '#38bdf8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Moon size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Dark Academic</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Comfortable night reading</div>
              </div>
            </div>
            {isDark && (
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                background: 'var(--primary)', color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}>
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </div>

          {/* Light Mode Card */}
          <div
            onClick={() => { if (isDark) toggleMode(); }}
            style={{
              padding: '18px',
              borderRadius: '14px',
              border: !isDark ? '2px solid var(--primary)' : '1.5px solid var(--border-glass)',
              background: !isDark ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: !isDark ? 'var(--shadow-glow-primary)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (isDark) {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: '#ffffff', color: '#f59e0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}>
                <Sun size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Daylight Campus</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>High contrast daylight</div>
              </div>
            </div>
            {!isDark && (
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                background: 'var(--primary)', color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}>
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Color Palettes ── */}
      <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ 
            padding: '10px', borderRadius: '12px', 
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.08))', 
            color: 'var(--secondary)' 
          }}>
            <Palette size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Institutional Color Palettes</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Select your primary college accent and button highlights</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }}>
          {palettes.filter(p => p.id !== 'custom').map((p) => {
            const isSelected = paletteId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => selectPalette(p.id)}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: isSelected ? `2px solid ${p.primary}` : '1.5px solid var(--border-glass)',
                  background: isSelected ? `${p.primary}08` : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ 
                      width: '22px', height: '22px', borderRadius: '50%', 
                      background: p.primary, 
                      border: '2px solid rgba(255,255,255,0.15)',
                      boxShadow: `0 2px 6px ${p.primary}40`
                    }} />
                    <div style={{ 
                      width: '22px', height: '22px', borderRadius: '50%', 
                      background: p.secondary, marginLeft: '-10px', 
                      border: '2px solid rgba(255,255,255,0.15)',
                      boxShadow: `0 2px 6px ${p.secondary}40`
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.primary}</div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ 
                    width: '20px', height: '20px', borderRadius: '50%', 
                    background: p.primary, color: '#fff', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 2px 8px ${p.primary}40`
                  }}>
                    <Check size={13} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Profile Details ── */}
      {user && (
        <div className="glass-panel settings-section-card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ 
              padding: '10px', borderRadius: '12px', 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.08))', 
              color: 'var(--success)' 
            }}>
              {isAdmin ? <Shield size={20} /> : <User size={20} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {isAdmin ? 'System Administrator Profile' : 'Student Academic Credentials'}
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Registered identity details on SISTec Central Library</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
            {[
              { label: 'Full Name', value: user.fullName || user.username },
              { label: 'Username', value: user.username },
              ...(!isAdmin ? [
                { label: 'Enrollment / Roll No', value: user.rollNumber || user.roll_number || 'Not Assigned' },
                { label: 'BT Library Number', value: user.btNumber || user.bt_number || 'Not Assigned' },
                { label: 'Department / Branch', value: user.branchName || 'Engineering' },
                { label: 'Academic Year & Semester', value: `${user.year || '1st Year'} • ${user.semester || '1st Sem'}` }
              ] : []),
              { 
                label: 'Account Role', 
                value: user.role, 
                valueColor: isAdmin ? 'var(--primary)' : 'var(--success)',
                uppercase: true 
              },
              { label: 'Auth Provider', value: user.authProvider || 'Database', capitalize: true }
            ].map((item, i) => (
              <div key={i} style={{ 
                background: 'var(--input-bg)', 
                padding: '14px 16px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-glass)',
                transition: 'all 0.2s ease'
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                  e.currentTarget.style.background = 'var(--input-bg-focus)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                  e.currentTarget.style.background = 'var(--input-bg)';
                }}
              >
                <span style={{ 
                  fontSize: '0.72rem', color: 'var(--text-muted)', 
                  display: 'block', textTransform: 'uppercase', 
                  letterSpacing: '0.06em', marginBottom: '4px',
                  fontWeight: 600
                }}>{item.label}</span>
                <strong style={{ 
                  fontSize: '0.95rem', 
                  color: item.valueColor || 'var(--text-primary)',
                  textTransform: item.uppercase ? 'uppercase' : item.capitalize ? 'capitalize' : 'none'
                }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="glass-panel settings-footer" style={{ 
        padding: '18px 28px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        fontSize: '0.8rem', 
        color: 'var(--text-muted)',
        borderRadius: '14px'
      }}>
        <span>SISTec Central Library Portal v2.0 • Academic Edition</span>
        <span style={{
          padding: '3px 10px',
          borderRadius: '6px',
          background: 'var(--surface-glow)',
          border: '1px solid var(--border-glass)',
          fontSize: '0.72rem',
          fontWeight: 600
        }}>
          Sagar Institute of Science & Technology
        </span>
      </div>
    </div>
  );
};

export default SettingsView;
