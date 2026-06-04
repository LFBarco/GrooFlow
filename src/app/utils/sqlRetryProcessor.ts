/**
 * Reintenta saves SQL pendientes (KV guardó OK pero SQL falló).
 */
import { toast } from 'sonner';

import type { SqlBackupResult } from '../services/repository/sqlDomainUtils';
import {
  bumpSqlRetryAttempt,
  dequeueSqlRetry,
  listSqlRetries,
  type SqlRetryItem,
} from '../services/repository/sqlRetryQueue';

export type SqlRetryRunner = () => Promise<SqlBackupResult>;
export type SqlRetryRunnerMap = Partial<Record<string, SqlRetryRunner>>;

export type SqlRetryProcessResult = {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

let processing = false;

const MIN_AGE_MS = 2500;

function shouldProcessItem(item: SqlRetryItem, minAgeMs: number): boolean {
  return Date.now() - item.createdAt >= minAgeMs;
}

/**
 * Ejecuta la cola de reintentos en serie. Idempotente si ya hay un proceso en curso.
 */
export async function processPendingSqlRetries(
  runners: SqlRetryRunnerMap,
  options?: { minAgeMs?: number; notify?: boolean }
): Promise<SqlRetryProcessResult> {
  const empty: SqlRetryProcessResult = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  if (processing) return empty;
  const pending = listSqlRetries();
  if (pending.length === 0) return empty;

  processing = true;
  const minAgeMs = options?.minAgeMs ?? MIN_AGE_MS;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  try {
    for (const item of pending) {
      if (!shouldProcessItem(item, minAgeMs)) {
        skipped += 1;
        continue;
      }
      const run = runners[item.storageKey];
      if (!run) {
        skipped += 1;
        continue;
      }
      processed += 1;
      try {
        const result = await run();
        if (result.ok) {
          dequeueSqlRetry(item.storageKey);
          succeeded += 1;
        } else {
          bumpSqlRetryAttempt(item.id);
          failed += 1;
        }
      } catch {
        bumpSqlRetryAttempt(item.id);
        failed += 1;
      }
    }
  } finally {
    processing = false;
  }

  const out = { processed, succeeded, failed, skipped };
  if (options?.notify && succeeded > 0) {
    toast.success(
      succeeded === 1
        ? 'Respaldo SQL recuperado para 1 dominio.'
        : `Respaldo SQL recuperado para ${succeeded} dominios.`
    );
  }
  return out;
}
