export function getGrooflowApiBase(): string {
  const envUrl = (import.meta.env.VITE_GROOFLOW_API_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${base}/api`;
}

export const GROOFLOW_TOKEN_KEY = 'grooflow_auth_token';

export function getGrooflowToken(): string {
  try {
    return localStorage.getItem(GROOFLOW_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setGrooflowToken(token: string): void {
  try {
    if (token) localStorage.setItem(GROOFLOW_TOKEN_KEY, token);
    else localStorage.removeItem(GROOFLOW_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
