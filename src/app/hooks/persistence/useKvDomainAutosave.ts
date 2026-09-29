import { useEffect, type MutableRefObject } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { SqlSaveResult } from '../../services/repository/sqlDomainUtils';
import {
  backupAppKvAfterKvSave,
  backupDomainSqlAfterKvSave,
} from '../../utils/sqlAutosaveBackup';
import {
  autosaveKvDomain,
  type CloudSyncTracker,
  type KvDomainRefs,
} from '../../utils/kvDomainPersistence';
import { isProductionSqlEnabled } from '../../services/repository/sqlDomainUtils';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

/** Esperas antes de reintentar un guardado fallido (red/deploy); el indicador se recupera solo. */
const AUTOSAVE_RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

type AutosaveParams<T> = Omit<Parameters<typeof autosaveKvDomain<T>>[0], 'silentError' | 'onOutcome'>;

/** Guarda y, si falla por algo distinto de permisos, reintenta mientras el efecto siga vigente. */
function autosaveWithRetry<T>(
  params: AutosaveParams<T>,
  onSaved: () => void
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const attempt = (index: number) => {
    let outcome: 'ok' | 'denied' | 'failed' = 'failed';
    void autosaveKvDomain({
      ...params,
      silentError: index > 0,
      onOutcome: (o) => {
        outcome = o;
      },
    }).then((ok) => {
      if (cancelled) return;
      if (ok) {
        onSaved();
        return;
      }
      if (outcome !== 'failed' || index >= AUTOSAVE_RETRY_DELAYS_MS.length) return;
      timer = setTimeout(() => attempt(index + 1), AUTOSAVE_RETRY_DELAYS_MS[index]);
    });
  };

  attempt(0);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

type SqlTableSaver<T> = (
  client: SupabaseClient,
  data: T,
  userId: string | null
) => Promise<SqlSaveResult>;

export type KvSqlTableAutosaveOptions<T> = {
  isDataLoaded: boolean;
  hydratedRef: MutableRefObject<boolean>;
  /** Condición extra (ej. providersCloudHydrationDone). */
  when?: boolean;
  /** Si false, no intenta PUT (usuario sin módulo). Default true. */
  canWrite?: boolean;
  kvKey: string;
  data: T;
  refs: KvDomainRefs<T>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync: CloudSyncTracker;
  errorMessage: string;
  saveSql: SqlTableSaver<T>;
  sqlEnabled?: boolean;
};

/** Autosave KV + respaldo tabla SQL normalizada. */
export function useKvSqlTableAutosave<T>(options: KvSqlTableAutosaveOptions<T>): void {
  const {
    isDataLoaded,
    hydratedRef,
    when = true,
    canWrite = true,
    kvKey,
    data,
    refs,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
    errorMessage,
    saveSql,
    sqlEnabled = PRODUCTION_USE_SQL,
  } = options;

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current || !when || !canWrite) return;
    return autosaveWithRetry(
      {
        kvKey,
        payload: data,
        refs,
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        errorMessage,
        sync: cloudSync,
      },
      () => {
        void backupDomainSqlAfterKvSave(sqlEnabled, kvKey, data, saveSql, lastSaveErrorAtRef);
      }
    );
  }, [data, isDataLoaded, when, canWrite]);
}

export type KvAppKeyAutosaveOptions<T> = {
  isDataLoaded: boolean;
  hydratedRef: MutableRefObject<boolean>;
  when?: boolean;
  /** Si false, no intenta PUT (usuario sin módulo). Default true. */
  canWrite?: boolean;
  kvKey: string;
  data: T;
  refs: KvDomainRefs<T>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync: CloudSyncTracker;
  errorMessage: string;
  /** Omitir save si valor undefined (ej. treasury bank balance). */
  skipIfUndefined?: boolean;
};

/** Autosave KV + respaldo `app_kv`. */
export function useKvAppKeyAutosave<T>(options: KvAppKeyAutosaveOptions<T>): void {
  const {
    isDataLoaded,
    hydratedRef,
    when = true,
    canWrite = true,
    kvKey,
    data,
    refs,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
    errorMessage,
    skipIfUndefined,
  } = options;

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current || !when || !canWrite) return;
    if (skipIfUndefined && data === undefined) return;
    return autosaveWithRetry(
      {
        kvKey,
        payload: data,
        refs,
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        errorMessage,
        sync: cloudSync,
      },
      () => {
        void backupAppKvAfterKvSave(PRODUCTION_USE_SQL, kvKey, data, lastSaveErrorAtRef);
      }
    );
  }, [data, isDataLoaded, when, canWrite]);
}
