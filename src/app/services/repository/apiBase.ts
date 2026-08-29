export const HOSTINGER_GROOFLOW_API = 'https://gestionveterinariagroomers.com/grooflow/api';

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isHostingerHost(hostname: string): boolean {
  return hostname === 'gestionveterinariagroomers.com' || hostname === 'www.gestionveterinariagroomers.com';
}

export function resolveGrooflowApiBase(envUrl: string | undefined, baseUrl: string, hostname = ''): string {
  const base = (baseUrl || '/').replace(/\/+$/, '');
  const fallback = `${base}/api`;
  const url = envUrl?.trim() ? envUrl.trim().replace(/\/+$/, '') : fallback;
  if (!hostname || isLocalHost(hostname) || isHostingerHost(hostname)) {
    return url;
  }
  if (url.startsWith('/')) {
    return HOSTINGER_GROOFLOW_API;
  }
  return url;
}

export function getGrooflowApiBase(): string {
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  return resolveGrooflowApiBase(
    import.meta.env.VITE_GROOFLOW_API_URL as string | undefined,
    import.meta.env.BASE_URL || '/',
    hostname
  );
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
