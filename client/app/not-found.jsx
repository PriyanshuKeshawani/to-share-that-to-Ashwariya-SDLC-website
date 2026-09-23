import Link from 'next/link';
import { BookX, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 100%)',
      color: '#f8fafc',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        padding: '40px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          color: '#818cf8'
        }}>
          <BookX size={36} />
        </div>

        <h1 style={{
          fontSize: '48px',
          fontWeight: '900',
          margin: '0 0 8px 0',
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          404
        </h1>

        <h2 style={{
          fontSize: '22px',
          fontWeight: '700',
          marginBottom: '12px',
          letterSpacing: '-0.02em',
          color: '#ffffff'
        }}>
          Book or Page Not Found
        </h2>

        <p style={{
          color: '#94a3b8',
          fontSize: '15px',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          The page or digital book you are looking for might have been moved, renamed, or is temporarily unavailable in the SISTEC digital catalog.
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              transition: 'background 0.2s',
              boxShadow: '0 4px 14px 0 rgba(79, 70, 229, 0.4)'
            }}
          >
            <Home size={16} />
            Explore Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
