import { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';

/**
 * Enterprise Password Reset Modal
 * SISTEC Central Library Portal
 */
const ResetPasswordModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState('request'); // 'request' | 'sent'
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!isOpen) return null;

  const handleRequestReset = async (e) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please provide your registered institutional email or username.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let targetEmail = cleanId;

      // If user provided a username or roll number without '@', look up their email
      if (!cleanId.includes('@')) {
        const { data: users, error: lookupErr } = await supabase
          .from('users')
          .select('email, username')
          .or(`username.ilike.${cleanId},roll_number.ilike.${cleanId}`)
          .limit(1);

        if (!lookupErr && users && users.length > 0 && users[0].email) {
          targetEmail = users[0].email;
        } else {
          // Standard institutional domain fallback
          targetEmail = `${cleanId.toLowerCase().replace(/[^a-z0-9_.-]/g, '')}@sistec.ac.in`;
        }
      }

      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo
      });

      if (resetErr) {
        throw resetErr;
      }

      setStep('sent');
      setSuccessMessage(`If an account is associated with ${targetEmail}, a secure password reset link has been dispatched.`);
    } catch (err) {
      console.warn('Password reset notice:', err.message);
      // For security, do not disclose whether user exists; provide safe generic response
      setStep('sent');
      setSuccessMessage('If the specified account exists in the institutional registry, recovery instructions have been dispatched.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('request');
    setIdentifier('');
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '30px 26px',
          borderRadius: '18px',
          position: 'relative',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), var(--shadow-glass)'
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.16), rgba(6, 182, 212, 0.12))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary, #3b82f6)',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}
          >
            <KeyRound size={22} />
          </div>
          <div>
            <h3 id="reset-modal-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
              Account Password Recovery
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
              SISTEC Institutional Security Service
            </span>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {step === 'sent' ? (
          <div>
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: 'var(--text-primary)',
                fontSize: '0.86rem',
                lineHeight: 1.55,
                marginBottom: '20px',
                textAlign: 'center'
              }}
            >
              <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 10px' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>{successMessage}</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Please check your inbox (and spam folder) for the password reset instructions link.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', fontWeight: 700, borderRadius: '10px' }}
            >
              Return to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRequestReset}>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Enter your institutional email, student enrollment number, or username. We will dispatch a verified password reset link.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="reset-identifier"
                style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}
              >
                Institutional Email or Student Enrollment ID
              </label>
              <input
                id="reset-identifier"
                type="text"
                className="glass-input"
                placeholder="e.g. 0187CS211045 or student@sistec.ac.in"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                required
                autoFocus
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                disabled={loading}
                style={{ flex: 1, padding: '11px', borderRadius: '10px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-shine"
                disabled={loading || !identifier.trim()}
                style={{ flex: 1.3, padding: '11px', fontWeight: 700, borderRadius: '10px' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    Send Reset Link <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal;
