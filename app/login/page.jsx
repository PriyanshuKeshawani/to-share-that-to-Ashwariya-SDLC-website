"use client";

import Login from '../../src/views/Login';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  return <Login onToggleView={() => router.push('/register')} />;
}
