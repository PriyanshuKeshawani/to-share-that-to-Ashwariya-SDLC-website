"use client";

import StudentDashboard from '../../src/views/StudentDashboard';
import { useRouter } from 'next/navigation';

export default function StudentPortalPage() {
  const router = useRouter();

  return (
    <StudentDashboard
      onSelectBook={(book) => {
        if (book && book.id) {
          router.push(`/read/${book.id}`);
        }
      }}
    />
  );
}
