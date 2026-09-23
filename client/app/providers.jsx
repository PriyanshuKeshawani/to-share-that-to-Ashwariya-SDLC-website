"use client";

import { useEffect } from 'react';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { initDeveloperCredits } from '../src/utils/developerCredits';

export default function Providers({ children }) {
  useEffect(() => {
    initDeveloperCredits();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
