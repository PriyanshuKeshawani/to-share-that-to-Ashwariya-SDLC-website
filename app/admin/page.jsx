"use client";

import AdminDashboard from '../../src/views/AdminDashboard';
import { useRouter } from 'next/navigation';

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
