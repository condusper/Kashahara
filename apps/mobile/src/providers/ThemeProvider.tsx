import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkColors,
  lightColors,
  type ColorScheme,
  type ThemeColors,
} from '../theme/tokens';
import { getStoredItem, setStoredItem, storageKeys } from '../lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  scheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let active = true;
    getStoredItem(storageKeys.themeMode).then((stored) => {
      if (!active) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void setStoredItem(storageKeys.themeMode, next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: ColorScheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
    return {
      mode,
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      isDark: scheme === 'dark',
      setMode,
    };
  }, [mode, system, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
