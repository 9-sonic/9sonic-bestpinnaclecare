import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Light and dark theme, driven by the Profile switch.
// index.html applies the saved theme before first paint; this keeps it in sync
// afterwards and writes any change back to storage.

const THEME_KEY = 'bpc.theme';
const ThemeContext = createContext(null);

function initialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    // The phone tints its status bar with this. Read back off --color-bg rather
    // than repeated as a literal, so the bar can never drift from the canvas it
    // sits above the way the old hard-coded teal had.
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);
  const value = useMemo(() => ({ dark, toggle }), [dark, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
