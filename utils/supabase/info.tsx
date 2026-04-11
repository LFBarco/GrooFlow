/**
 * @deprecated El cliente real está en `src/app/services/repository/supabase.ts` (getSupabaseClient).
 * Este archivo solo se mantiene por si algún import antiguo lo usa; sin .env los valores quedan vacíos.
 */
const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {} as Record<string, string | undefined>;

function envStr(key: string): string | undefined {
  const v = env[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export const projectId = envStr("VITE_SUPABASE_PROJECT_ID") ?? "";
export const publicAnonKey = envStr("VITE_SUPABASE_ANON_KEY") ?? "";