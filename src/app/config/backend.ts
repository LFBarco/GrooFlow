export type GrooflowBackend = 'supabase' | 'local' | 'rest';

export function browserHostname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname;
}

/** Previews y prod de Vercel siempre hablan con el PHP de Hostinger. */
export function isVercelHostname(hostname: string): boolean {
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
}

export function resolveGrooflowBackend(raw: string, hostname = ''): GrooflowBackend {
  const value = raw.trim().toLowerCase();
  if (value === 'local') return 'local';
  if (isVercelHostname(hostname)) return 'rest';
  if (value === 'supabase' || value === 'rest') return value;
  return 'rest';
}

/** Hostinger y Vercel usan REST. Supabase solo en local si se pide explícito. */
export function getGrooflowBackend(): GrooflowBackend {
  return resolveGrooflowBackend(String(import.meta.env.VITE_BACKEND ?? 'rest'), browserHostname());
}

export function isSupabaseBackend(): boolean {
  return getGrooflowBackend() === 'supabase';
}

export function isRestBackend(): boolean {
  return getGrooflowBackend() === 'rest';
}

export function isLocalBackend(): boolean {
  return getGrooflowBackend() === 'local';
}
