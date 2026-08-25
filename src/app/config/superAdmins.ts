/**
 * Correos con rol super_admin (gestión de usuarios, sedes, etc.).
 * Producción: solo VITE_SUPER_ADMIN_EMAILS (sin emails hardcodeados).
 * Desarrollo: incluye defaults locales + env.
 */
const DEV_SUPER_ADMIN_EMAILS = [
  'admin@grooflow.com',
  'admin@vetflow.com',
] as const;

export function getSuperAdminEmails(): Set<string> {
  const raw = import.meta.env.VITE_SUPER_ADMIN_EMAILS;
  const fromEnv =
    typeof raw === 'string' && raw.trim().length > 0
      ? raw
          .split(/[,;\s]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];
  if (import.meta.env.PROD) {
    return new Set(fromEnv);
  }
  return new Set<string>([...DEV_SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...fromEnv]);
}
