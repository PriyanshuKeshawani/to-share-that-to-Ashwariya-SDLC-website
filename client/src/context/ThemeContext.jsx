"use client";

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

export const COLOR_PALETTES = [
  { id: 'sistec-navy',   label: 'SISTec Royal Blue × Sky', primary: '#2563eb', secondary: '#0ea5e9' },
  { id: 'indigo-cyan',   label: 'Indigo × Cyan',     primary: '#6366f1', secondary: '#06b6d4' },
  { id: 'sky-blue',      label: 'Sky × Blue',        primary: '#0ea5e9', secondary: '#2563eb' },
  { id: 'emerald-teal',  label: 'Emerald × Teal',    primary: '#10b981', secondary: '#14b8a6' },
  { id: 'amber-yellow',  label: 'Amber × Gold',      primary: '#f59e0b', secondary: '#eab308' },
  { id: 'violet-pink',   label: 'Violet × Pink',     primary: '#8b5cf6', secondary: '#ec4899' },
  { id: 'custom',        label: 'Custom',            primary: '#2563eb', secondary: '#0ea5e9' },
];

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return '0, 0, 0';
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return '0, 0, 0';
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const applyTheme = (mode, primary, secondary) => {
  const root = document.documentElement;
  const isDark = mode === 'dark';
  const pRgb = hexToRgb(primary);
  const sRgb = hexToRgb(secondary);

  // Smooth transition
  root.style.setProperty('--transition-fast', '0.15s cubic-bezier(0.4, 0, 0.2, 1)');
  root.style.setProperty('--transition-normal', '0.25s cubic-bezier(0.4, 0, 0.2, 1)');

  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', primary);
  root.style.setProperty('--primary-glow', `rgba(${pRgb}, 0.25)`);
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--secondary-glow', `rgba(${sRgb}, 0.2)`);
  root.style.setProperty('--border-glass-focus', `rgba(${pRgb}, 0.5)`);
  root.style.setProperty('--shadow-neon', `0 4px 20px rgba(${pRgb}, 0.25)`);
  root.style.setProperty('--shadow-cyan', `0 4px 20px rgba(${sRgb}, 0.2)`);
  root.style.setProperty('--shadow-glow-primary', `0 0 20px rgba(${pRgb}, 0.2), 0 0 60px rgba(${pRgb}, 0.08)`);

  if (isDark) {
    root.style.setProperty('--bg-main', '#070c18');
    root.style.setProperty('--bg-surface', '#0c1426');
    root.style.setProperty('--bg-card', 'rgba(13, 22, 42, 0.85)');
    root.style.setProperty('--bg-card-hover', 'rgba(20, 32, 60, 0.95)');
    root.style.setProperty('--bg-card-solid', '#0d1628');
    root.style.setProperty('--border-glass', 'rgba(255, 255, 255, 0.10)');
    root.style.setProperty('--border-glass-hover', 'rgba(255, 255, 255, 0.18)');
    root.style.setProperty('--text-primary', '#f8fafc');
    root.style.setProperty('--text-secondary', '#94a3b8');
    root.style.setProperty('--text-muted', '#64748b');
    root.style.setProperty('--shadow-glass', '0 8px 32px -4px rgba(0, 0, 0, 0.6), 0 4px 8px -4px rgba(0, 0, 0, 0.4)');
    root.style.setProperty('--shadow-elevated', '0 24px 60px -12px rgba(0, 0, 0, 0.75)');
    root.style.setProperty('--sidebar-bg', 'rgba(9, 15, 30, 0.96)');
    root.style.setProperty('--input-bg', 'rgba(15, 25, 48, 0.75)');
    root.style.setProperty('--input-bg-focus', 'rgba(20, 34, 64, 0.9)');
    root.style.setProperty('--scrollbar-thumb', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--body-gradient-1', `rgba(${pRgb}, 0.07)`);
    root.style.setProperty('--body-gradient-2', `rgba(${sRgb}, 0.05)`);
    root.style.setProperty('--body-gradient-3', 'rgba(37, 99, 235, 0.03)');
    root.style.setProperty('--surface-glow', 'rgba(255, 255, 255, 0.025)');
    root.style.setProperty('--glass-bg', 'rgba(13, 22, 42, 0.97)');
    root.style.setProperty('--modal-bg', '#0d1628');
    root.style.setProperty('--modal-card-bg', 'rgba(18, 28, 52, 0.75)');
    root.style.setProperty('--modal-card-border', 'rgba(255, 255, 255, 0.09)');
    root.style.setProperty('--modal-header-bg', 'linear-gradient(180deg, rgba(37, 99, 235, 0.12) 0%, rgba(13, 22, 42, 0.6) 100%)');
    root.style.setProperty('--modal-backdrop', 'rgba(3, 7, 18, 0.82)');
  } else {
    root.style.setProperty('--bg-main', '#f8fafc');
    root.style.setProperty('--bg-surface', '#ffffff');
    root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.95)');
    root.style.setProperty('--bg-card-hover', '#ffffff');
    root.style.setProperty('--bg-card-solid', '#ffffff');
    root.style.setProperty('--border-glass', 'rgba(15, 23, 42, 0.11)');
    root.style.setProperty('--border-glass-hover', 'rgba(15, 23, 42, 0.20)');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#475569');
    root.style.setProperty('--text-muted', '#64748b');
    root.style.setProperty('--shadow-glass', '0 4px 24px -4px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)');
    root.style.setProperty('--shadow-elevated', '0 20px 50px -12px rgba(15, 23, 42, 0.12)');
    root.style.setProperty('--sidebar-bg', '#ffffff');
    root.style.setProperty('--input-bg', '#ffffff');
    root.style.setProperty('--input-bg-focus', '#ffffff');
    root.style.setProperty('--scrollbar-thumb', 'rgba(15, 23, 42, 0.18)');
    root.style.setProperty('--body-gradient-1', `rgba(${pRgb}, 0.04)`);
    root.style.setProperty('--body-gradient-2', `rgba(${sRgb}, 0.03)`);
    root.style.setProperty('--body-gradient-3', 'rgba(37, 99, 235, 0.02)');
    root.style.setProperty('--surface-glow', 'rgba(0, 0, 0, 0.015)');
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.98)');
    root.style.setProperty('--modal-bg', '#ffffff');
    root.style.setProperty('--modal-card-bg', '#f1f5f9');
    root.style.setProperty('--modal-card-border', 'rgba(15, 23, 42, 0.09)');
    root.style.setProperty('--modal-header-bg', 'linear-gradient(180deg, rgba(37, 99, 235, 0.06) 0%, rgba(241, 245, 249, 0.8) 100%)');
    root.style.setProperty('--modal-backdrop', 'rgba(15, 23, 42, 0.5)');
  }

  root.setAttribute('data-theme', mode);
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('theme-mode') : null) || 'dark');
  const [paletteId, setPaletteId] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('theme-palette') : null) || 'sistec-navy');
  const [customPrimary, setCustomPrimary] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('theme-custom-primary') : null) || '#3b82f6');
  const [customSecondary, setCustomSecondary] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('theme-custom-secondary') : null) || '#06b6d4');

  const activePalette = COLOR_PALETTES.find(p => p.id === paletteId) || COLOR_PALETTES[0];
  const primary = paletteId === 'custom' ? customPrimary : activePalette.primary;
  const secondary = paletteId === 'custom' ? customSecondary : activePalette.secondary;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    applyTheme(mode, primary, secondary);
    try {
      localStorage.setItem('theme-mode', mode);
      localStorage.setItem('theme-palette', paletteId);
      localStorage.setItem('theme-custom-primary', customPrimary);
      localStorage.setItem('theme-custom-secondary', customSecondary);
    } catch {
      // ignore
    }
  }, [mode, primary, secondary, paletteId, customPrimary, customSecondary]);

  const toggleMode = () => setMode(prev => prev === 'dark' ? 'light' : 'dark');
  const selectPalette = (id) => setPaletteId(id);

  return (
    <ThemeContext.Provider value={{
      mode,
      toggleMode,
      paletteId,
      selectPalette,
      customPrimary,
      setCustomPrimary,
      customSecondary,
      setCustomSecondary,
      primary,
      secondary,
      palettes: COLOR_PALETTES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
