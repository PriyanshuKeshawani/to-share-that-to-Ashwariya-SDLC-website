"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../../src/supabaseClient';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

const DynamicBookReader = dynamic(() => import('../../../src/views/BookReader'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-main, #070c18)',
      color: 'var(--text-primary, #ffffff)'
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: 'var(--primary, #2563eb)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '16px'
      }} />
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem' }}>Loading Book Reader Engine...</p>
    </div>
  )
});

export default function BookReaderPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const bookId = params?.id;

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);

    supabase
      .from('books')
      .select('*, category:category_id(name), branch:branch_id(name)')
      .eq('id', bookId)
      .maybeSingle()
      .then(({ data, error: fetchErr }) => {
        setLoading(false);
        if (fetchErr) {
          setError(fetchErr.message);
        } else if (!data) {
          setError('Book not found in library catalog');
        } else {
          setBook(data);
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(err.message);
      });
  }, [bookId]);

  const handleClose = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/student');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-main, #070c18)',
        color: 'var(--text-primary, #ffffff)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: 'var(--primary, #2563eb)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem' }}>Fetching Book Information...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px 16px',
        background: 'var(--bg-main, #070c18)',
        color: 'var(--text-primary, #ffffff)'
      }}>
        <div className="glass-panel" style={{ padding: '36px 28px', maxWidth: '460px', borderRadius: '16px', textAlign: 'center' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', fontWeight: 700 }}>
            Unable to Load E-Book
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '22px', lineHeight: '1.6' }}>
            {error || 'This book could not be found or has been removed from the catalog.'}
          </p>
          <button
            onClick={handleClose}
            className="btn btn-primary"
            style={{ padding: '11px 20px', fontSize: '0.88rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} /> Return to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reader-page-wrapper">
      <DynamicBookReader book={book} onClose={handleClose} />
    </div>
  );
}
