"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const AdminDashboard = dynamic(() => import('../../src/views/AdminDashboard'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-main, #0b0f19)',
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
      <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '0.95rem' }}>Loading Admin Workspace...</p>
    </div>
  )
});

export default function AdminPortalPage() {
  const router = useRouter();

  return (
    <AdminDashboard
      onSelectBook={(book) => {
        if (book && book.id) {
          router.push(`/read/${book.id}`);
        }
      }}
    />
  );
}
