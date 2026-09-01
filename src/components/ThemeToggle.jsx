'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'dulcevalentin_theme';

export default function ThemeToggle({ style, className }) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  if (!theme) return null;

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={className}
      style={{
        width: '38px',
        height: '38px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-surface-elevated)',
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        ...style
      }}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
