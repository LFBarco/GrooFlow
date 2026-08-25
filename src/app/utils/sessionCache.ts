import type { User } from '../types';

const LAST_USER_KEY = 'grooflow_last_user';

export function readCachedAppUser(): User | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed || typeof parsed !== 'object' || !parsed.id || parsed.id === 'guest') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedAppUser(user: User): void {
  try {
    if (!user.id || user.id === 'guest') {
      localStorage.removeItem(LAST_USER_KEY);
      return;
    }
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function clearCachedAppUser(): void {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* ignore */
  }
}
