"use client";

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Critical Root Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#090d16',
        color: '#f8fafc',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        <div style={{
          maxWidth: '480px',
          width: '90%',
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(16px)',
          borderRadius: '20px',
          padding: '36px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            color: '#f87171'
          }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '10px' }}>
            System Error
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
            The application experienced a critical layout error. Your saved bookmarks and local data are safe.
          </p>
          <button
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} />
            Reload Portal
          </button>
        </div>
      </body>
    </html>
  );
}
