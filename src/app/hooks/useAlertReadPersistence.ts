import { useCallback, useEffect, useRef } from 'react';

import type { SystemAlert } from '../types';
import { api } from '../services/api';
import { repository } from '../services/repository';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import {
  markCrossTabEchoWindow,
  subscribeKvCrossTab,
} from '../utils/kvCrossTabSync';
import { backupAppKvAfterKvSave } from '../utils/sqlAutosaveBackup';
import {
  getAlertReadRetrySnapshot,
  setAlertReadForceApply,
  setAlertReadRemoteApply,
  setAlertReadRetrySnapshot,
  type AlertReadState,
} from './alertReadPersistenceBridge';

export const ALERT_READ_STATE_KV_KEY = 'settings:alertReadState';
export type { AlertReadState };

const MAX_STORED_READ_IDS = 500;
const PRODUCTION_USE_SQL = isProductionSqlEnabled();

/**
 * Persiste IDs de alertas marcadas como leídas (KV + app_kv).
 * El motor regenera alertas en cada cambio de datos; el estado leído se conserva por id estable.
 */
export function useAlertReadPersistence(isDataLoaded: boolean) {
  const readIdsRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveErrorAtRef = useRef<Record<string, number>>({});

  const buildPayload = useCallback((): AlertReadState => {
    const payload: AlertReadState = {
      readIds: [...readIdsRef.current].slice(-MAX_STORED_READ_IDS),
      updatedAt: new Date().toISOString(),
    };
    setAlertReadRetrySnapshot(payload);
    return payload;
  }, []);

  const persistNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!dirtyRef.current) return;
    const payload = buildPayload();
    try {
      const ok = await api.saveKey(ALERT_READ_STATE_KV_KEY, payload);
      if (ok) {
        dirtyRef.current = false;
        markCrossTabEchoWindow(ALERT_READ_STATE_KV_KEY);
        void backupAppKvAfterKvSave(
          PRODUCTION_USE_SQL,
          ALERT_READ_STATE_KV_KEY,
          payload,
          lastSaveErrorAtRef
        );
      }
    } catch {
      /* reintento vía cola SQL si aplica */
    }
  }, [buildPayload]);

  useEffect(() => {
    if (!isDataLoaded || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const raw = await repository.kv.get<AlertReadState>(ALERT_READ_STATE_KV_KEY);
        if (raw?.readIds?.length) {
          readIdsRef.current = new Set(raw.readIds.slice(-MAX_STORED_READ_IDS));
          setAlertReadRetrySnapshot({
            readIds: [...readIdsRef.current],
            updatedAt: raw.updatedAt || new Date().toISOString(),
          });
        }
      } catch {
        /* primer uso sin clave */
      }
    })();
  }, [isDataLoaded]);

  const applyRemotePayload = useCallback((value: unknown) => {
    if (dirtyRef.current) return;
    const raw = value as AlertReadState | null;
    if (!raw || !Array.isArray(raw.readIds)) return;
    readIdsRef.current = new Set(raw.readIds.slice(-MAX_STORED_READ_IDS));
    setAlertReadRetrySnapshot({
      readIds: [...readIdsRef.current],
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    });
  }, []);

  const applyForcePayload = useCallback((value: unknown) => {
    dirtyRef.current = false;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const raw = value as AlertReadState | null;
    const ids = Array.isArray(raw?.readIds) ? raw!.readIds.slice(-MAX_STORED_READ_IDS) : [];
    readIdsRef.current = new Set(ids);
    setAlertReadRetrySnapshot({
      readIds: ids,
      updatedAt:
        typeof raw?.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;
    setAlertReadRemoteApply(applyRemotePayload);
    setAlertReadForceApply(applyForcePayload);
    const unsub = subscribeKvCrossTab((msg) => {
      if (msg.key !== ALERT_READ_STATE_KV_KEY) return;
      applyRemotePayload(msg.value);
    });
    return () => {
      setAlertReadRemoteApply(null);
      setAlertReadForceApply(null);
      unsub();
    };
  }, [isDataLoaded, applyRemotePayload, applyForcePayload]);

  const schedulePersist = useCallback(() => {
    dirtyRef.current = true;
    buildPayload();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistNow();
    }, 700);
  }, [buildPayload, persistNow]);

  useEffect(() => {
    if (!isDataLoaded) return;
    const onPageHide = () => {
      void persistNow();
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void persistNow();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onHidden);
      void persistNow();
    };
  }, [isDataLoaded, persistNow]);

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

  return {
    applyReadState,
    markAlertRead,
    markAllAlertsRead,
    getLatest: getAlertReadRetrySnapshot,
  };
}
