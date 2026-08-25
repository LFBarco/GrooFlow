export const GROOFLOW_THEME_KEY = 'grooflow_theme';

export type GrooflowTheme = 'dark' | 'light';

export function parseTheme(value: unknown): GrooflowTheme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function readStoredTheme(): GrooflowTheme | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return parseTheme(localStorage.getItem(GROOFLOW_THEME_KEY));
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: GrooflowTheme): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GROOFLOW_THEME_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyThemeClass(theme: GrooflowTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function persistAndApplyTheme(theme: GrooflowTheme): void {
  writeStoredTheme(theme);
  applyThemeClass(theme);
}

export function readInitialTheme(): GrooflowTheme {
  return readStoredTheme() ?? 'dark';
}

/** Preferencia local, luego perfil/KV; nunca fuerza dark si ya hay light guardado. */
export function resolveTheme(...candidates: unknown[]): GrooflowTheme {
  for (const candidate of candidates) {
    const parsed = parseTheme(candidate);
    if (parsed) return parsed;
  }
  return 'dark';
}

/**
 * `latestRef` debe diferir del tema aplicado cuando el remoto no coincide,
 * para que el autosave escriba la preferencia local en BD.
 */
export function themeLatestForAutosave(
  applied: GrooflowTheme,
  remote: GrooflowTheme | null
): GrooflowTheme {
  if (remote === applied) return applied;
  return remote ?? (applied === 'light' ? 'dark' : 'light');
}
