/**
 * Respaldo SQL tras autosave KV — verifica errores y muestra toast throttled.
 */
import type { MutableRefObject } from 'react';
import { toast } from 'sonner';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
import { saveAppKvKey, type AppKvSaveResult } from '../services/repository/appKvSql';
import { getAuthUserId } from '../services/productionSqlBridge';
import { enqueueSqlRetry, dequeueSqlRetry } from '../services/repository/sqlRetryQueue';
import type { SqlSaveResult } from '../services/repository/sqlDomainUtils';
import { getSqlSaveQueue } from './sqlSaveQueue';

export type SqlBackupResult = { ok: boolean; errors: string[] };

const SQL_THROTTLE_MS = 8000;

/** Mensajes de error SQL por clave KV (misma clave que autosave). */
export const SQL_BACKUP_ERROR_MESSAGES: Record<string, string> = {
  'settings:config':
    'No se pudo guardar Configuración en SQL. Revisa sesión o permisos antes de cerrar.',
  'settings:system':
    'No se pudo guardar la configuración del sistema en SQL. Revisa sesión o permisos.',
  'settings:asistencia':
    'No se pudo guardar la configuración de Asistencia en SQL. Revisa sesión o permisos.',
  'settings:theme': 'No se pudo guardar el tema en SQL. Revisa sesión o permisos.',
  'settings:alertThresholds':
    'No se pudieron guardar los umbrales de alertas en SQL. Revisa sesión o permisos.',
  'settings:alertReadState':
    'No se pudo guardar el estado de alertas leídas en SQL. Revisa sesión o permisos.',
  'data:transactions':
    'No se pudieron guardar las transacciones en SQL. Revisa sesión o permisos antes de cerrar.',
  'data:providers':
    'No se pudo guardar el directorio de proveedores en SQL. Revisa sesión o permisos.',
  'data:pettyCash':
    'No se pudo guardar Caja chica en SQL. Revisa sesión o permisos antes de cerrar.',
  'data:pettyCashMeta':
    'No se pudieron guardar cierres y dotaciones de caja chica en SQL. Revisa sesión o permisos.',
  'data:invoices':
    'No se pudieron guardar las facturas en SQL. Revisa sesión o permisos.',
  'data:requests':
    'No se pudieron guardar las solicitudes de compra en SQL. Revisa sesión o permisos.',
  'data:users':
    'No se pudo guardar la lista de usuarios en SQL. Revisa sesión o permisos.',
  'data:roles':
    'No se pudo guardar la configuración de roles en SQL. Revisa sesión o permisos.',
  'data:feeReceipts':
    'No se pudieron guardar los honorarios en SQL. Revisa sesión o permisos.',
  'data:products':
    'No se pudo guardar el catálogo de productos en SQL. Revisa sesión o permisos.',
  'data:chartOfAccounts':
    'No se pudo guardar el plan de cuentas en SQL. Revisa sesión o permisos.',
  'data:treasuryInvoices':
    'No se pudieron guardar las facturas de tesorería en SQL. Revisa sesión o permisos.',
  'data:treasuryBankBalance':
    'No se pudo guardar el saldo bancario en SQL. Revisa sesión o permisos.',
  'data:treasuryPaidHistory':
    'No se pudo guardar el historial de pagos en SQL. Revisa sesión o permisos.',
  'data:treasurySubscriptions':
    'No se pudieron guardar las suscripciones de tesorería en SQL. Revisa sesión o permisos.',
  'data:treasuryBankMovements':
    'No se pudo guardar el extracto bancario en SQL. Revisa sesión o permisos.',
  'data:reconciliation':
    'No se pudo guardar la conciliación en SQL. Revisa sesión o permisos.',
  'data:fleet':
    'No se pudo guardar Flota clínica en SQL. Revisa sesión o permisos.',
  'data:inventory':
    'No se pudo guardar el inventario de equipos en SQL. Revisa sesión o permisos.',
};

function reportSqlBackupError(
  storageKey: string,
  errorMessage: string,
  errors: string[],
  lastSaveErrorAtRef?: MutableRefObject<Record<string, number>>
): void {
  const throttleKey = `sql:${storageKey}`;
  const now = Date.now();
  const last = lastSaveErrorAtRef?.current[throttleKey] ?? 0;
  if (now - last < SQL_THROTTLE_MS) return;
  if (lastSaveErrorAtRef) {
    lastSaveErrorAtRef.current[throttleKey] = now;
  }
  toast.error(errorMessage, {
    description: errors[0],
    duration: 10_000,
  });
  console.warn(`[sqlAutosave] ${storageKey}`, errors);
}

async function backupToSqlAfterKvSaveUnqueued(options: {
  storageKey: string;
  errorMessage?: string;
  lastSaveErrorAtRef?: MutableRefObject<Record<string, number>>;
  run: () => Promise<SqlBackupResult>;
}): Promise<boolean> {
  const message =
    options.errorMessage ??
    SQL_BACKUP_ERROR_MESSAGES[options.storageKey] ??
    'No se pudo guardar en SQL. Revisa sesión o permisos.';
  try {
    const result = await options.run();
    if (result.ok) {
      dequeueSqlRetry(options.storageKey);
      return true;
    }
    enqueueSqlRetry(options.storageKey);
    reportSqlBackupError(options.storageKey, message, result.errors, options.lastSaveErrorAtRef);
    return false;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    enqueueSqlRetry(options.storageKey);
    reportSqlBackupError(options.storageKey, message, [errMsg], options.lastSaveErrorAtRef);
    return false;
  }
}

/**
 * Ejecuta respaldo SQL tras KV OK (serializado por dominio). Retorna false si SQL falló.
 */
export async function backupToSqlAfterKvSave(options: {
  enabled: boolean;
  storageKey: string;
  errorMessage?: string;
  lastSaveErrorAtRef?: MutableRefObject<Record<string, number>>;
  run: () => Promise<SqlBackupResult>;
}): Promise<boolean> {
  if (!options.enabled) return true;
  return getSqlSaveQueue(options.storageKey).enqueue(
    `backup:${options.storageKey}`,
    () => backupToSqlAfterKvSaveUnqueued(options)
  );
}

export async function backupAppKvAfterKvSave(
  enabled: boolean,
  kvKey: string,
  value: unknown,
  lastSaveErrorAtRef?: MutableRefObject<Record<string, number>>
): Promise<boolean> {
  return backupToSqlAfterKvSave({
    enabled,
    storageKey: kvKey,
    lastSaveErrorAtRef,
    run: async (): Promise<AppKvSaveResult> => {
      const uid = await getAuthUserId();
      const client = await getSupabaseClientLazy();
      if (!client) return { ok: true, errors: [] };
      return saveAppKvKey(client, kvKey, value, uid);
    },
  });
}

export async function backupDomainSqlAfterKvSave<T>(
  enabled: boolean,
  kvKey: string,
  items: T,
  saver: (
    client: SupabaseClient,
    data: T,
    userId: string | null
  ) => Promise<SqlSaveResult>,
  lastSaveErrorAtRef?: MutableRefObject<Record<string, number>>
): Promise<boolean> {
  return backupToSqlAfterKvSave({
    enabled,
    storageKey: kvKey,
    lastSaveErrorAtRef,
    run: async () => {
      const uid = await getAuthUserId();
      const client = await getSupabaseClientLazy();
      if (!client) return { ok: true, errors: [] };
      return saver(client, items, uid);
    },
  });
}

/** Para saves SQL explícitos (persistNow) — mismo toast throttled. */
export async function ensureSqlSave(
  enabled: boolean,
  storageKey: string,
  run: () => Promise<SqlBackupResult>,
  lastSaveErrorAtRef?: MutableRefObject<Record<string, number>>,
  errorMessage?: string
): Promise<boolean> {
  return backupToSqlAfterKvSave({
    enabled,
    storageKey,
    errorMessage,
    lastSaveErrorAtRef,
    run,
  });
}
