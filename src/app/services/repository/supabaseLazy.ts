import { isSupabaseBackend } from '../../config/backend';
import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseModule = typeof import('./supabase');

let supabaseMod: SupabaseModule | null = null;

async function loadSupabaseModule(): Promise<SupabaseModule | null> {
  if (!isSupabaseBackend()) return null;
  if (!supabaseMod) {
    supabaseMod = await import('./supabase');
  }
  return supabaseMod;
}

/** Cliente GoTrue/PostgREST solo si VITE_BACKEND=supabase. En REST no se carga el chunk. */
export async function getSupabaseClientLazy(): Promise<SupabaseClient | null> {
  const mod = await loadSupabaseModule();
  return mod ? mod.getSupabaseClient() : null;
}

export async function getSupabaseFunctionsUrlLazy(): Promise<string> {
  const mod = await loadSupabaseModule();
  return mod ? mod.getSupabaseFunctionsUrl() : '';
}

export async function getEdgeFunctionAccessTokenLazy(): Promise<string> {
  const mod = await loadSupabaseModule();
  if (!mod) throw new Error('Supabase no está activo en este build.');
  return mod.getEdgeFunctionAccessToken();
}

export async function getConfiguredSupabaseUrlLazy(): Promise<string | undefined> {
  const mod = await loadSupabaseModule();
  return mod?.getConfiguredSupabaseUrl();
}

export async function isSupabaseKvFatalAuthErrorLazy(err: unknown): Promise<boolean> {
  const mod = await loadSupabaseModule();
  return mod ? mod.isSupabaseKvFatalAuthError(err) : false;
}
