import type { Role, User } from '../types';

const GESTION_ORIGIN = 'https://gestionveterinariagroomers.com';

/** Resuelve rutas /uploads/... al origen de Gestión cuando GrooFlow corre en Vercel u otro host. */
export function resolveGrooflowMediaUrl(path: string | undefined | null): string {
  const raw = (path ?? '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  if (typeof window === 'undefined') return normalized;
  const host = window.location.hostname;
  if (
    host.endsWith('.vercel.app') ||
    (host !== 'gestionveterinariagroomers.com' &&
      host !== 'www.gestionveterinariagroomers.com' &&
      host !== 'localhost' &&
      host !== '127.0.0.1')
  ) {
    return `${GESTION_ORIGIN}${normalized}`;
  }
  return normalized;
}

/** Etiqueta visible del perfil: nivel de Gestión (Contabilidad, etc.), no el rol RBAC interno. */
export function getUserRoleLabel(user: User | null | undefined, roles: Role[] = []): string {
  if (!user) return '';
  const fromGestion = user.roleLabel?.trim() || user.nivelNombre?.trim();
  if (fromGestion) return fromGestion;
  return roles.find((r) => r.id === user.role)?.name || user.role.replace(/_/g, ' ');
}
