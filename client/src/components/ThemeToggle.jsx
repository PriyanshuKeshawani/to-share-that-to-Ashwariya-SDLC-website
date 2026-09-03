import { useState } from 'react';
import { Sun, Moon, Palette, X, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const {
    mode, toggleMode,
    paletteId, selectPalette,
    palettes,
    customPrimary, setCustomPrimary,
    customSecondary, setCustomSecondary,
  } = useTheme();

  const [panelOpen, setPanelOpen] = useState(false);
  const isDark = mode === 'dark';

  return (
    <>
      <style>{`
        @keyframes themePanelIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .theme-fab:hover { transform: scale(1.1) !important; }
        .palette-swatch:hover { transform: scale(1.15) !important; }
      `}</style>

      <div className="theme-fab-container">
        <button
          className="theme-fab theme-fab-btn"
          onClick={toggleMode}
          title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle dark/light mode"
        >
          {isDark
            ? <Sun size={20} color="#fbbf24" />
            : <Moon size={20} color="var(--primary)" />
          }
        </button>

        <button
          className={`theme-fab theme-fab-btn ${panelOpen ? 'active' : ''}`}
          onClick={() => setPanelOpen(o => !o)}
          title="Customize theme palette"
          aria-label="Open theme panel"
        >
          {panelOpen
            ? <X size={20} />
            : <Palette size={20} />
          }
        </button>
      </div>

      {panelOpen && (
        <div className="theme-studio-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: `linear-gradient(135deg, var(--primary), var(--secondary))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Palette size={16} color="#fff" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Theme Studio
              </span>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              style={{ 
                background: 'var(--input-bg)', 
                border: '1px solid var(--border-glass)', 
                cursor: 'pointer', 
                color: 'var(--text-muted)', 
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--input-bg-focus)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--input-bg)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Mode Toggle */}
          <div style={{ marginBottom: '24px' }}>
            <p className="theme-studio-section-title">Mode</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isDark
                  ? <Moon size={16} color="var(--primary)" />
                  : <Sun size={16} color="#f59e0b" />
                }
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
              <button className={`theme-mode-track ${isDark ? 'active' : ''}`} onClick={toggleMode} aria-label="Toggle mode">
                <div className={`theme-mode-knob ${isDark ? 'active' : ''}`}>
                  {isDark
                    ? <Moon size={11} color="var(--primary)" />
                    : <Sun size={11} color="#f59e0b" />
                  }
                </div>
              </button>
            </div>
          </div>

          {/* Preset Palettes */}
          <div style={{ marginBottom: '24px' }}>
            <p className="theme-studio-section-title">Colour Palette</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {palettes.filter(p => p.id !== 'custom').map(palette => {
                const isActive = paletteId === palette.id;
                return (
                  <button
                    key={palette.id}
                    className="palette-swatch"
                    onClick={() => selectPalette(palette.id)}
                    title={palette.label}
                    aria-label={`Select ${palette.label} palette`}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '12px',
                      border: isActive ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                      background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), border 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isActive ? `0 4px 12px rgba(0,0,0,0.2)` : 'none',
                    }}
                  >
                    {isActive && (
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.35)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '8px' }}>
              {palettes.filter(p => p.id !== 'custom').map(palette => (
                <span key={palette.id} style={{
                  fontSize: '0.6rem',
                  color: paletteId === palette.id ? 'var(--primary)' : 'var(--text-muted)',
                  textAlign: 'center',
                  fontWeight: paletteId === palette.id ? 700 : 400,
                  lineHeight: 1.2,
                }}>
                  {palette.label}
                </span>
              ))}
            </div>
          </div>

          {/* Custom Colours */}
          <div>
            <p className="theme-studio-section-title">Custom Colours</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Primary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: customPrimary,
                  border: '2px solid var(--border-glass)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: `0 2px 8px ${customPrimary}40`
                }}>
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => { setCustomPrimary(e.target.value); selectPalette('custom'); }}
                    style={{
                      position: 'absolute', inset: '-4px',
                      width: 'calc(100% + 8px)', height: 'calc(100% + 8px)',
                      border: 'none', cursor: 'pointer', opacity: 0,
                    }}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Palette size={14} color="rgba(255,255,255,0.8)" />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Primary</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{customPrimary}</span>
                </div>
                <label style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem',
                  fontWeight: 600, cursor: 'pointer',
                  background: 'var(--primary)', color: '#fff',
                  border: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'filter 0.2s ease'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  Pick
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => { setCustomPrimary(e.target.value); selectPalette('custom'); }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* Secondary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: customSecondary,
                  border: '2px solid var(--border-glass)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: `0 2px 8px ${customSecondary}40`
                }}>
                  <input
                    type="color"
                    value={customSecondary}
                    onChange={(e) => { setCustomSecondary(e.target.value); selectPalette('custom'); }}
                    style={{
                      position: 'absolute', inset: '-4px',
                      width: 'calc(100% + 8px)', height: 'calc(100% + 8px)',
                      border: 'none', cursor: 'pointer', opacity: 0,
                    }}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Palette size={14} color="rgba(255,255,255,0.8)" />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Accent</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{customSecondary}</span>
                </div>
                <label style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem',
                  fontWeight: 600, cursor: 'pointer',
                  background: 'var(--secondary)', color: '#fff',
                  border: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'filter 0.2s ease'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  Pick
                  <input
                    type="color"
                    value={customSecondary}
                    onChange={(e) => { setCustomSecondary(e.target.value); selectPalette('custom'); }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Live preview */}
            <div style={{
              marginTop: '18px',
              height: '8px',
              borderRadius: '4px',
              background: `linear-gradient(90deg, var(--primary), var(--secondary))`,
              transition: 'background 0.3s ease',
            }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', marginTop: '6px' }}>
              Live preview ↑
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default ThemeToggle;
