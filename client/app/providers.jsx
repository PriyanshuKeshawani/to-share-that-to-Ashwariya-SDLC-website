"use client";

import { useEffect } from 'react';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { initSystemDiagnostics } from '../src/utils/systemDiagnostics';

export default function Providers({ children }) {
  useEffect(() => {
    initSystemDiagnostics();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
