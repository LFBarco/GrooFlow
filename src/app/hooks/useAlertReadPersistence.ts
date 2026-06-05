import { useCallback, useEffect, useRef } from 'react';

import type { SystemAlert } from '../types';
import { api } from '../services/api';
import { repository } from '../services/repository';
import { backupAppKvAfterKvSave } from '../utils/sqlAutosaveBackup';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';

export const ALERT_READ_STATE_KV_KEY = 'settings:alertReadState';

export type AlertReadState = {
  readIds: string[];
  updatedAt: string;
};

const MAX_STORED_READ_IDS = 500;
const PRODUCTION_USE_SQL = isProductionSqlEnabled();

/**
 * Persiste IDs de alertas marcadas como leídas (KV + app_kv).
 * El motor regenera alertas en cada cambio de datos; el estado leído se conserva por id estable.
 */
export function useAlertReadPersistence(isDataLoaded: boolean) {
  const readIdsRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveErrorAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!isDataLoaded || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const raw = await repository.kv.get<AlertReadState>(ALERT_READ_STATE_KV_KEY);
        if (raw?.readIds?.length) {
          readIdsRef.current = new Set(raw.readIds.slice(-MAX_STORED_READ_IDS));
        }
      } catch {
        /* primer uso sin clave */
      }
    })();
  }, [isDataLoaded]);

  const schedulePersist = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload: AlertReadState = {
        readIds: [...readIdsRef.current].slice(-MAX_STORED_READ_IDS),
        updatedAt: new Date().toISOString(),
      };
      void api.saveKey(ALERT_READ_STATE_KV_KEY, payload).then((ok) => {
        if (ok) {
          void backupAppKvAfterKvSave(
            PRODUCTION_USE_SQL,
            ALERT_READ_STATE_KV_KEY,
            payload,
            lastSaveErrorAtRef
          );
        }
      });
    }, 700);
  }, []);

  const applyReadState = useCallback((alerts: SystemAlert[]): SystemAlert[] => {
    const read = readIdsRef.current;
    return alerts.map((a) => ({
      ...a,
      read: read.has(a.id) || a.read,
    }));
  }, []);

  const markAlertRead = useCallback(
    (id: string) => {
      readIdsRef.current.add(id);
      schedulePersist();
    },
    [schedulePersist]
  );

  const markAllAlertsRead = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => readIdsRef.current.add(id));
      schedulePersist();
    },
    [schedulePersist]
  );

  return { applyReadState, markAlertRead, markAllAlertsRead };
}
