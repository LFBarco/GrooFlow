import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizePettyCashMeta, type PettyCashWeekMetaPayload } from '../../utils/pettyCashMeta';
import type { SqlLoadResult, SqlSaveResult } from './sqlDomainUtils';

const GLOBAL_ROW_ID = 'global';

export async function loadPettyCashMetaFromSql(
  client: SupabaseClient
): Promise<SqlLoadResult<PettyCashWeekMetaPayload>> {
  const { data, error } = await client
    .from('petty_cash_week_meta')
    .select('payload')
    .eq('id', GLOBAL_ROW_ID)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return { ok: false, data: null, empty: true };
    }
    console.warn('[pettyCashMetaSql] load error', error.message);
    return { ok: false, data: null, empty: false };
  }

  if (!data?.payload) {
    return { ok: true, data: normalizePettyCashMeta(null), empty: true };
  }

  const meta = normalizePettyCashMeta(data.payload);
  return {
    ok: true,
    data: meta,
    empty: meta.weekClosures.length === 0 && meta.fundDeliveries.length === 0,
  };
}

export async function savePettyCashMetaToSql(
  client: SupabaseClient,
  meta: PettyCashWeekMetaPayload,
  userId: string | null
): Promise<SqlSaveResult> {
  const { error } = await client.from('petty_cash_week_meta').upsert(
    {
      id: GLOBAL_ROW_ID,
      payload: meta,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'id' }
  );

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return { ok: false, errors: ['Tabla petty_cash_week_meta no existe. Ejecuta supabase:db:push.'] };
    }
    return { ok: false, errors: [error.message] };
  }
  return { ok: true, errors: [] };
}

export async function migratePettyCashMetaKvToSql(
  client: SupabaseClient,
  meta: PettyCashWeekMetaPayload,
  userId: string | null
): Promise<boolean> {
  return (await savePettyCashMetaToSql(client, meta, userId)).ok;
}
