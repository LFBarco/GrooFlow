/**
 * Registro y lectura de security_audit_logs (producción).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditLogRow = {
  id: number;
  actor_user_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  user: string;
  action: string;
  entity: string;
  details: string;
  date: Date;
  severity: 'high' | 'low';
};

const ACTION_LABELS: Record<string, string> = {
  transaction_delete: 'Eliminación',
  transaction_bulk_delete: 'Eliminación masiva',
  transaction_create: 'Creación',
  transaction_import: 'Importación',
  petty_cash_create: 'Alta caja chica',
  operational_reset: 'Reinicio operativo',
  invoice_delete_audit: 'Eliminación',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function severityFor(action: string): 'high' | 'low' {
  if (
    action.includes('delete') ||
    action.includes('reset') ||
    action === 'operational_reset'
  ) {
    return 'high';
  }
  return 'low';
}

export function mapAuditRowToEntry(row: AuditLogRow, actorEmail?: string): AuditLogEntry {
  const meta = row.metadata ?? {};
  const entity = typeof meta.entity === 'string' ? meta.entity : 'Sistema';
  const details =
    typeof meta.details === 'string'
      ? meta.details
      : typeof meta.message === 'string'
        ? meta.message
        : JSON.stringify(meta).slice(0, 120);

  return {
    id: String(row.id),
    user: actorEmail ?? (row.actor_user_id ? row.actor_user_id.slice(0, 8) : 'Sistema'),
    action: actionLabel(row.action),
    entity,
    details,
    date: new Date(row.created_at),
    severity: severityFor(row.action),
  };
}

export async function writeAuditLog(
  client: SupabaseClient,
  action: string,
  metadata: Record<string, unknown>,
  targetUserId?: string | null
): Promise<boolean> {
  const { data: sess } = await client.auth.getSession();
  const uid = sess.session?.user?.id ?? null;
  if (!uid) return false;

  const { error } = await client.from('security_audit_logs').insert({
    actor_user_id: uid,
    action,
    target_user_id: targetUserId ?? null,
    metadata,
  });

  if (error) {
    console.warn('[auditLogSql] insert failed', action, error);
    return false;
  }
  return true;
}

export function writeAuditLogLazy(
  action: string,
  metadata: Record<string, unknown>,
  targetUserId?: string | null
): void {
  void import('./supabaseLazy').then(async ({ getSupabaseClientLazy }) => {
    const client = await getSupabaseClientLazy();
    if (!client) return;
    await writeAuditLog(client, action, metadata, targetUserId);
  });
}

export async function loadAuditLogs(
  client: SupabaseClient,
  limit = 100
): Promise<{ ok: boolean; rows: AuditLogRow[] }> {
  const { data, error } = await client
    .from('security_audit_logs')
    .select('id, actor_user_id, action, target_user_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[auditLogSql] load failed', error);
    return { ok: false, rows: [] };
  }
  return { ok: true, rows: (data ?? []) as AuditLogRow[] };
}
