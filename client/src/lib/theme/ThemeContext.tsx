'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'normal' | 'large' | 'larger';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  fontSize: 'normal',
  setFontSize: () => {},
});

const STORAGE_KEY = 'sih26032_theme';
const FONT_STORAGE_KEY = 'sih26032_font_size';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [fontSize, setFontSizeState] = useState<FontSize>('normal');
  const [mounted, setMounted] = useState(false);

  // Apply resolved theme to HTML root element
  const applyTheme = useCallback((resolved: 'light' | 'dark') => {
    setResolvedTheme(resolved);
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, []);

  // Determine system preference
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Apply font sizing for accessibility compliance
  const applyFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    const root = document.documentElement;
    if (size === 'larger') {
      root.style.fontSize = '18px';
    } else if (size === 'large') {
      root.style.fontSize = '17px';
    } else {
      root.style.fontSize = '';
    }
  }, []);

  // Initialization on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initialTheme = savedTheme || 'system';
      setThemeState(initialTheme);

      const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
      applyTheme(resolved);

      const savedFontSize = localStorage.getItem(FONT_STORAGE_KEY) as FontSize | null;
      if (savedFontSize) {
        applyFontSize(savedFontSize);
      }
    } catch {
      // Ignore storage restrictions
    }
  }, [applyTheme, getSystemTheme, applyFontSize]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // ignore
      }

      const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
      applyTheme(resolved);
    },
    [applyTheme, getSystemTheme]
  );

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const setFontSize = useCallback(
    (newSize: FontSize) => {
      applyFontSize(newSize);
      try {
        localStorage.setItem(FONT_STORAGE_KEY, newSize);
      } catch {
        // ignore
      }
    },
    [applyFontSize]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme: mounted ? resolvedTheme : 'light',
        setTheme,
        toggleTheme,
        fontSize,
        setFontSize,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
