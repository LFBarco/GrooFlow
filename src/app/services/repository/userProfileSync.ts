/**
 * Sincroniza `data:users` (KV) → `app_user_profiles` (SQL/RLS).
 * Sin esto, usuarios no admin quedan sin sedes/rol en RLS y no pueden guardar ni recibir Realtime.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Roles de la app → roles permitidos en app_user_profiles SQL. */
export function mapAppRoleToSqlRole(role: string | undefined): string {
  const r = (role || 'manager').trim().toLowerCase();
  if (r === 'super_admin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'analyst' || r === 'auditoria' || r === 'groomer') return 'analyst';
  return 'manager';
}

export function isAdminAppUser(user: User | null | undefined): boolean {
  const r = (user?.role || '').trim().toLowerCase();
  return r === 'admin' || r === 'super_admin';
}

export function userRowToProfileRow(u: User) {
  const role = mapAppRoleToSqlRole(u.role);
  return {
    user_id: u.id,
    role,
    sedes: Array.isArray(u.sedes) ? u.sedes : [],
    all_sedes:
      u.allSedes === true ||
      role === 'admin' ||
      role === 'super_admin' ||
      !u.sedes?.length,
    status: u.status === 'inactive' ? 'inactive' : 'active',
  };
}

export type SyncUserProfilesOptions = {
  authUserId?: string;
  /** Solo admin puede sincronizar la lista completa (RLS). */
  isAdmin?: boolean;
};

/**
 * Sincroniza perfiles SQL.
 * - Admin: upsert de todos los usuarios KV.
 * - No admin: solo su propio perfil (evita 403 RLS en bulk upsert).
 */
export async function syncUserProfilesToSql(
  client: SupabaseClient,
  users: User[],
  options?: SyncUserProfilesOptions
): Promise<void> {
  const authUserId = options?.authUserId;
  const isAdmin = options?.isAdmin === true;

  if (!isAdmin) {
    if (!authUserId) return;
    const self =
      users.find((u) => u.id === authUserId) ??
      users.find((u) => UUID_RE.test(u.id) && u.id === authUserId);
    await syncCurrentUserProfileToSql(client, authUserId, self ?? null);
    return;
  }

  const rows = users.filter((u) => UUID_RE.test(u.id)).map((u) => userRowToProfileRow(u));
  if (rows.length === 0) return;
  const { error } = await client.from('app_user_profiles').upsert(rows, { onConflict: 'user_id' });
  if (error) {
    console.warn('[userProfileSync] sync all failed', error.message);
  }
}

/** Sincroniza solo el usuario en sesión tras login/hydrate. */
export async function syncCurrentUserProfileToSql(
  client: SupabaseClient,
  authUserId: string,
  userRow: User | null | undefined
): Promise<void> {
  if (!UUID_RE.test(authUserId)) return;

  const row = userRowToProfileRow(
    userRow ? { ...userRow, id: authUserId } : { id: authUserId, role: 'manager', sedes: [] }
  );

  const { error: rpcError } = await client.rpc('upsert_own_app_user_profile', {
    p_role: row.role,
    p_sedes: row.sedes,
    p_all_sedes: row.all_sedes,
    p_status: row.status,
  });

  if (!rpcError) return;

  if (rpcError.code !== 'PGRST202' && !rpcError.message?.includes('upsert_own_app_user_profile')) {
    console.warn('[userProfileSync] sync self rpc failed', rpcError.message);
  }

  const { error } = await client.from('app_user_profiles').upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.warn('[userProfileSync] sync self failed', error.message);
  }
}
