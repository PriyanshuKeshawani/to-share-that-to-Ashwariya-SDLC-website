import React from 'react';
import { CheckCircle, MapPin, Clock, ArrowRight, Sparkles } from 'lucide-react';

const DeskCheckinSuccessModal = ({ sessionData, tableInfo, onClose }) => {
  if (!tableInfo && !sessionData) return null;

  const tableNumber = tableInfo?.table_number || sessionData?.table_number || 'Desk';
  const roomName = tableInfo?.room?.name || tableInfo?.room_name || 'Central Reading Hall';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2, 6, 18, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in-scale" style={{
        width: '100%',
        maxWidth: '440px',
        borderRadius: '26px',
        padding: '32px 28px',
        boxShadow: '0 20px 60px -10px rgba(16, 185, 129, 0.3)',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background glow orb */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Animated Celebration Icon */}
        <div style={{
          position: 'relative',
          width: '74px',
          height: '74px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.15))',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 0 30px rgba(16, 185, 129, 0.35)'
        }}>
          <CheckCircle size={44} strokeWidth={2.2} className="animate-float-bob" />
          <span className="status-live-ping" style={{ backgroundColor: '#10b981', inset: '-6px' }} />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '999px',
          background: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          fontSize: '0.74rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '10px'
        }}>
          <Sparkles size={12} /> Registration Confirmed
        </div>

        <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
          You're All Checked In!
        </h3>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Your study desk presence is now officially recorded in the SISTec Digital Library system.
        </p>

        {/* Details Card */}
        <div style={{
          background: 'var(--input-bg)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid var(--border-glass)',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assigned Desk:</span>
            <span style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              padding: '3px 12px',
              borderRadius: '8px'
            }}>
              Table {tableNumber}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Location / Room:</span>
            <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
              {roomName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Session Started:</span>
            <span style={{ fontWeight: 600, fontSize: '0.84rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={13} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn btn-primary btn-shine"
          style={{ width: '100%', padding: '12px', fontSize: '0.92rem', gap: '8px', borderRadius: '12px' }}
        >
          <span>Start Studying</span>
          <ArrowRight size={16} />
        </button>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '14px' }}>
          * When you leave your table, remember to tap "Leave" on your dashboard so other students can take the seat.
        </p>
      </div>
    </div>
  );
};

export default DeskCheckinSuccessModal;
