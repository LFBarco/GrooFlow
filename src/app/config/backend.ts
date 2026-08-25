export type GrooflowBackend = 'supabase' | 'local' | 'rest';

/** Hostinger y el build de producción usan REST. Supabase solo si se pide explícito. */
export function getGrooflowBackend(): GrooflowBackend {
  const raw = String(import.meta.env.VITE_BACKEND ?? 'rest').trim().toLowerCase();
  if (raw === 'supabase' || raw === 'local' || raw === 'rest') {
    return raw;
  }
  return 'rest';
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
