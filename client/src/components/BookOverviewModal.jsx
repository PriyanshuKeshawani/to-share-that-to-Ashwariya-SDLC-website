import { useState } from 'react';
import {
  BookOpen, Lock, CheckCircle2, Clock, XCircle, Share2,
  X, Layers, User, Tag, Sparkles, AlertCircle, ArrowRight
} from 'lucide-react';

const BookOverviewModal = ({
  book,
  user,
  accessInfo,
  onRequestAccess,
  onRead,
  onShare,
  onClose,
  requestLoading = false
}) => {
  if (!book) return null;

  const { hasAccess, isHomeBranch, status } = accessInfo || {
    hasAccess: false,
    isHomeBranch: false,
    status: 'none'
  };

  const isApproved = hasAccess || status === 'approved' || user?.role === 'admin';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.8)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        className="glass-panel book-overview-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.65)',
          position: 'relative'
        }}
      >
        {/* Top Floating Close Button */}
        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '6px',
            borderRadius: '50%',
            zIndex: 10
          }}
          title="Close Overview"
        >
          <X size={18} />
        </button>

        {/* Header Ribbon / Shared Book Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(59, 130, 246, 0.15)',
            color: 'var(--primary)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <Sparkles size={12} /> SISTec Library Catalog Dossier
          </span>
        </div>

        {/* Main Book Card Hero */}
        <div style={{ display: 'flex', gap: '18px', marginBottom: '20px', alignItems: 'flex-start' }}>
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              style={{
                width: '110px',
                height: '150px',
                objectFit: 'cover',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0
              }}
            />
          ) : (
            <div style={{
              width: '110px',
              height: '150px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#93c5fd',
              flexShrink: 0,
              boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <BookOpen size={36} style={{ marginBottom: '6px' }} />
              <span style={{ fontSize: '0.66rem', fontWeight: 600 }}>SISTec Digital</span>
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                {book.branch_name || 'General Engineering'}
              </span>
              {book.category_name && (
                <span className="badge" style={{
                  fontSize: '0.7rem',
                  background: 'rgba(148, 163, 184, 0.15)',
                  color: 'var(--text-secondary)'
                }}>
                  {book.category_name}
                </span>
              )}
            </div>

            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: '1.35',
              margin: '0 0 6px 0'
            }}>
              {book.title}
            </h2>

            <p style={{
              fontSize: '0.84rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: '0 0 10px 0'
            }}>
              <User size={13} /> {book.author || 'Academic Faculty / Author'}
            </p>

            <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {book.total_pages && book.total_pages > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={13} color="var(--primary)" /> {book.total_pages} Pages
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={13} color="#f59e0b" /> {book.priority === 'main' ? 'Core Syllabus' : 'Reference'}
              </span>
            </div>
          </div>
        </div>

        {/* Synopsis / Description Section */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--input-bg)',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          marginBottom: '20px'
        }}>
          <h4 style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--text-muted)',
            margin: '0 0 6px 0'
          }}>
            Synopsis & Academic Overview
          </h4>
          <p style={{
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            margin: 0
          }}>
            {book.description || `Comprehensive institutional curriculum material for ${book.branch_name || 'engineering'} students. Includes vetted lecture concepts, problem solving exercises, and exam preparation guides.`}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════
            DYNAMIC PERMISSION ACCESS STATUS CARD
            ══════════════════════════════════════════════════════════ */}
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          border: '1px solid',
          borderColor: isApproved
            ? 'rgba(34, 197, 94, 0.3)'
            : isPending
            ? 'rgba(59, 130, 246, 0.3)'
            : isRejected
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(245, 158, 11, 0.3)',
          background: isApproved
            ? 'rgba(34, 197, 94, 0.08)'
            : isPending
            ? 'rgba(59, 130, 246, 0.08)'
            : isRejected
            ? 'rgba(239, 68, 68, 0.08)'
            : 'rgba(245, 158, 11, 0.08)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            {isApproved ? (
              <CheckCircle2 size={20} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : isPending ? (
              <Clock size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : isRejected ? (
              <XCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <Lock size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
            )}

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  color: isApproved ? '#22c55e' : isPending ? '#3b82f6' : isRejected ? '#ef4444' : '#f59e0b'
                }}>
                  {isApproved
                    ? (isHomeBranch ? 'Verified Home Department Access' : 'Permission Granted by Admin')
                    : isPending
                    ? 'Access Request Pending Approval'
                    : isRejected
                    ? 'Access Request Declined'
                    : 'Permission Required for Cross-Branch Book'}
                </span>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                {isApproved
                  ? 'Your student account is authorized to access and read the complete document with full interactive tools.'
                  : isPending
                  ? 'Your access petition has been forwarded to the librarian and administrator. You will be able to read once confirmed.'
                  : isRejected
                  ? 'Your request for this specific book was not granted. You may resubmit a request or consult the department head.'
                  : `This book is managed by the ${book.branch_name || 'specified department'}. As a ${user?.branchName || user?.branch_name || 'student from another department'}, you can request reading clearance with one click.`}
              </p>
            </div>
          </div>
        </div>

        {/* Actions Footer Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isApproved ? (
            <button
              onClick={() => {
                onClose();
                onRead(book);
              }}
              className="btn btn-primary btn-shine"
              style={{
                flex: '1 1 180px',
                padding: '11px 18px',
                fontSize: '0.88rem',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <BookOpen size={16} /> Read Book Now <ArrowRight size={15} />
            </button>
          ) : isPending ? (
            <button
              disabled
              className="btn btn-secondary"
              style={{
                flex: '1 1 180px',
                padding: '11px 18px',
                fontSize: '0.88rem',
                justifyContent: 'center',
                gap: '8px',
                opacity: 0.8
              }}
            >
              <Clock size={16} /> Awaiting Admin Approval
            </button>
          ) : (
            <button
              onClick={() => onRequestAccess(book)}
              disabled={requestLoading}
              className="btn btn-primary btn-shine"
              style={{
                flex: '1 1 180px',
                padding: '11px 18px',
                fontSize: '0.88rem',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Lock size={16} /> {requestLoading ? 'Submitting Petition...' : 'Request Access from Admin'}
            </button>
          )}

          {/* Share Book Button */}
          <button
            onClick={() => onShare(book)}
            className="btn btn-secondary"
            style={{ padding: '11px 16px', fontSize: '0.86rem', gap: '6px' }}
            title="Share Book with Classmates"
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>

          {/* Dismiss Button */}
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '11px 14px', fontSize: '0.86rem' }}
          >
            Browse Library
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookOverviewModal;
