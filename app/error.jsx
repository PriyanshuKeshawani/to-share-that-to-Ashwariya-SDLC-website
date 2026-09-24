"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    // Log the error to console or monitoring service
    console.error('Unhandled Application Error:', error);
  }, [error]);

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
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          color: '#f87171'
        }}>
          <AlertCircle size={32} />
        </div>

        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '12px',
          letterSpacing: '-0.02em',
          color: '#ffffff'
        }}>
          Something went wrong
        </h2>

        <p style={{
          color: '#94a3b8',
          fontSize: '15px',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          The library portal encountered an unexpected runtime state. Your reading progress and saved bookmarks are safely preserved in local storage.
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => reset()}
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
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 4px 14px 0 rgba(79, 70, 229, 0.4)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#4338ca'}
            onMouseOut={(e) => e.currentTarget.style.background = '#4f46e5'}
          >
            <RefreshCw size={16} />
            Try Again
          </button>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              textDecoration: 'none',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
          >
            <Home size={16} />
            Back to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
