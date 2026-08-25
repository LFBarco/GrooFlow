import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GROOFLOW_THEME_KEY,
  parseTheme,
  readInitialTheme,
  readStoredTheme,
  resolveTheme,
  themeLatestForAutosave,
  writeStoredTheme,
} from './themePreference';

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

describe('themePreference', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parseTheme solo acepta light/dark', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme('')).toBeNull();
    expect(parseTheme('system')).toBeNull();
  });

  it('en REST no usa el KV global: local y perfil ganan', () => {
    expect(resolveTheme('light', 'dark', 'dark')).toBe('light');
    expect(resolveTheme(null, 'light', 'dark')).toBe('light');
  });

  it('lee y escribe grooflow_theme', () => {
    expect(readStoredTheme()).toBeNull();
    expect(readInitialTheme()).toBe('dark');
    writeStoredTheme('light');
    expect(localStorage.getItem(GROOFLOW_THEME_KEY)).toBe('light');
    expect(readStoredTheme()).toBe('light');
    expect(readInitialTheme()).toBe('light');
  });

  it('fuerza autosave si el remoto no coincide con lo aplicado', () => {
    expect(themeLatestForAutosave('light', 'light')).toBe('light');
    expect(themeLatestForAutosave('light', null)).toBe('dark');
    expect(themeLatestForAutosave('light', 'dark')).toBe('dark');
    expect(themeLatestForAutosave('dark', null)).toBe('light');
  });
});
