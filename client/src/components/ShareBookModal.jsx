import { useState, useCallback } from 'react';
import { Share2, Copy, Check, X, ExternalLink, MessageCircle, Send, BookOpen } from 'lucide-react';

const ShareBookModal = ({ book, onClose, onShowFeedback }) => {
  const [copied, setCopied] = useState(false);

  if (!book) return null;

  // Fully dynamic canonical URL - automatically resolves the active origin, port, and deployment subpath
  const shareUrl = (() => {
    if (typeof window === 'undefined') return '';
    try {
      const origin = window.location.origin.replace(/\/+$/, '');
      let pathname = window.location.pathname || '/';
      // Strip trailing index.html if present
      pathname = pathname.replace(/\/index\.html$/i, '/');
      if (!pathname.endsWith('/')) pathname += '/';

      const hash = window.location.hash || '';
      if (hash.startsWith('#/')) {
        const hashBase = hash.split('?')[0];
        return `${origin}${pathname}${hashBase}?book=${book.id}`;
      }
      return `${origin}${pathname}?book=${book.id}`;
    } catch {
      return `${window.location.origin}/?book=${book.id}`;
    }
  })();

  const shareText = `Explore "${book.title}" by ${book.author} on SISTec Digital Library Portal!`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (onShowFeedback) {
        onShowFeedback('Shareable link copied to clipboard!', 'success');
      }
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.getElementById('share-link-input');
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${book.title} - SISTec Digital Library`,
          text: shareText,
          url: shareUrl
        });
        if (onShowFeedback) {
          onShowFeedback('Shared successfully!', 'success');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--modal-backdrop, rgba(5, 8, 16, 0.75))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="glass-panel share-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid var(--border-glass)',
          background: 'var(--modal-bg, var(--bg-card-solid))',
          boxShadow: 'var(--shadow-elevated)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Share2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Share Book Link
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                Share with classmates or study groups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: '50%' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Book Preview Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          background: 'var(--modal-card-bg, var(--input-bg))',
          borderRadius: '12px',
          border: '1px solid var(--modal-card-border, var(--border-glass))',
          marginBottom: '20px'
        }}>
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              style={{
                width: '44px',
                height: '58px',
                objectFit: 'cover',
                borderRadius: '6px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}
            />
          ) : (
            <div style={{
              width: '44px',
              height: '58px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <BookOpen size={20} />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 4px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {book.title}
            </h4>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
              By {book.author}
            </p>
            <span className="badge badge-primary" style={{ fontSize: '0.64rem', padding: '2px 6px' }}>
              {book.branch_name || 'Engineering'}
            </span>
          </div>
        </div>

        {/* Direct Link Input with Copy Button */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Direct Shareable URL
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="share-link-input"
              type="text"
              readOnly
              value={shareUrl}
              onClick={(e) => e.target.select()}
              className="glass-input"
              style={{
                flex: 1,
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                padding: '8px 12px',
                background: 'var(--input-bg)'
              }}
            />
            <button
              onClick={handleCopyLink}
              className={`btn ${copied ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '8px 14px',
                fontSize: '0.8rem',
                gap: '6px',
                minWidth: '95px',
                justifyContent: 'center'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Social / Direct App Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              padding: '9px 12px',
              fontSize: '0.8rem',
              gap: '6px',
              justifyContent: 'center',
              textDecoration: 'none',
              color: '#22c55e',
              borderColor: 'rgba(34, 197, 94, 0.25)'
            }}
          >
            <MessageCircle size={15} /> WhatsApp
          </a>

          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              padding: '9px 12px',
              fontSize: '0.8rem',
              gap: '6px',
              justifyContent: 'center',
              textDecoration: 'none',
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.25)'
            }}
          >
            <Send size={15} /> Telegram
          </a>
        </div>

        {/* Native Web Share Button (if supported on mobile/tablet) */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <button
            onClick={handleNativeShare}
            className="btn btn-primary btn-shine"
            style={{ width: '100%', padding: '10px', fontSize: '0.84rem', justifyContent: 'center', gap: '6px' }}
          >
            <ExternalLink size={15} /> Share via Phone Apps
          </button>
        )}
      </div>
    </div>
  );
};

export default ShareBookModal;
