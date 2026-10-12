import { CheckCircle2, Circle } from 'lucide-react';

/**
 * Real-Time Password Strength Meter & Policy Checklist
 * SISTEC Central Library Portal
 */
const PasswordStrengthIndicator = ({
  evaluation,
  showRules = true,
  compact = false,
  containerStyle = {}
}) => {
  if (!evaluation) return null;

  const { score, label, color, rules = [] } = evaluation;

  // 4 discrete segments representing strength progression
  const segments = [
    { level: 1, active: score >= 1, color: score === 1 ? '#ef4444' : color },
    { level: 2, active: score >= 2, color: score === 2 ? '#f59e0b' : color },
    { level: 3, active: score >= 3, color: score === 3 ? '#3b82f6' : color },
    { level: 4, active: score >= 4, color: '#10b981' }
  ];

  return (
    <div
      style={{
        marginTop: '8px',
        marginBottom: '12px',
        width: '100%',
        ...containerStyle
      }}
    >
      {/* ── Progress Bar & Strength Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px'
        }}
      >
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
          Security Strength:
        </span>
        <span
          aria-live="polite"
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            color: color || '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '2px 8px',
            borderRadius: '4px',
            background: `${color}18`,
            border: `1px solid ${color}35`,
            transition: 'all 0.25s ease'
          }}
        >
          {label}
        </span>
      </div>

      {/* ── 4-Segment Progress Bar ── */}
      <div
        role="progressbar"
        aria-valuenow={score * 25}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Password strength is ${label}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '5px',
          height: '4px',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: showRules && !compact ? '10px' : '4px'
        }}
      >
        {segments.map((seg) => (
          <div
            key={seg.level}
            style={{
              height: '100%',
              borderRadius: '2px',
              backgroundColor: seg.active ? seg.color : 'rgba(255, 255, 255, 0.1)',
              transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        ))}
      </div>

      {/* ── Requirement Checklist ── */}
      {showRules && !compact && rules.length > 0 && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '6px'
          }}
        >
          {rules.map((rule) => {
            const isMet = rule.met;
            return (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '0.75rem',
                  color: isMet ? 'var(--text-primary, #ffffff)' : 'var(--text-muted, #64748b)',
                  transition: 'color 0.2s ease'
                }}
              >
                {isMet ? (
                  <CheckCircle2
                    size={13}
                    color="#10b981"
                    strokeWidth={2.5}
                    style={{ flexShrink: 0 }}
                  />
                ) : (
                  <Circle
                    size={13}
                    color="rgba(255, 255, 255, 0.25)"
                    strokeWidth={2}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <span
                  style={{
                    lineHeight: 1.3,
                    textDecoration: isMet ? 'none' : 'none',
                    fontWeight: isMet ? 600 : 400
                  }}
                >
                  {rule.label}
                  {rule.hint && !isMet && (
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'block' }}>
                      {rule.hint}
                    </span>
                  )}
                </span>
                <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
                  {isMet ? 'Requirement met' : 'Requirement not met'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
