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
    if (!isDataLoaded || !hydratedRef.current || !when) return;
    void autosaveKvDomain({
      kvKey,
      payload: data,
      refs,
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage,
      sync: cloudSync,
    }).then((ok) => {
      if (ok) {
        void backupDomainSqlAfterKvSave(sqlEnabled, kvKey, data, saveSql, lastSaveErrorAtRef);
      }
    });
  }, [data, isDataLoaded, when]);
}

export type KvAppKeyAutosaveOptions<T> = {
  isDataLoaded: boolean;
  hydratedRef: MutableRefObject<boolean>;
  when?: boolean;
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
    if (!isDataLoaded || !hydratedRef.current || !when) return;
    if (skipIfUndefined && data === undefined) return;
    void autosaveKvDomain({
      kvKey,
      payload: data,
      refs,
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage,
      sync: cloudSync,
    }).then((ok) => {
      if (ok) {
        void backupAppKvAfterKvSave(PRODUCTION_USE_SQL, kvKey, data, lastSaveErrorAtRef);
      }
    });
  }, [data, isDataLoaded, when]);
}
