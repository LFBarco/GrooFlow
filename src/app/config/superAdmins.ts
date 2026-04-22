/**
 * Correos con rol super_admin (gestión de usuarios, sedes, etc.).
 * Ampliable sin tocar código: VITE_SUPER_ADMIN_EMAILS=uno@x.com,otro@y.com
 */
const DEFAULT_SUPER_ADMIN_EMAILS = [
  'admin@grooflow.com',
  'admin@vetflow.com',
  'luisfrancisco.barco@gmail.com',
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
  return new Set<string>([...DEFAULT_SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...fromEnv]);
}
