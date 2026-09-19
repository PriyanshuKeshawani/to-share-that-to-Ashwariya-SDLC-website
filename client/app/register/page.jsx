"use client";

import Register from '../../src/views/Register';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  return <Register onToggleView={() => router.push('/login')} />;
}
