/**
 * Configuración Supabase.
 * En producción use variables de entorno (VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_ANON_KEY)
 * definidas en .env o en el panel de su hosting.
 */
const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {} as Record<string, string | undefined>;

export const projectId = env.VITE_SUPABASE_PROJECT_ID ?? "sklseqxhhanuzsancbgn";
export const publicAnonKey = env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrbHNlcXhoaGFudXpzYW5jYmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Mzg4NzMsImV4cCI6MjA4MzQxNDg3M30.GwTYNF7LXNbFBpM6xFVuMowFLGezvnm393OcjibnVu0";