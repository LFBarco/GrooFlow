import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../services/api';
import { isProductionSqlEnabled } from '../../services/repository/sqlDomainUtils';
import {
  markCrossTabEchoWindow,
  subscribeKvCrossTab,
} from '../../utils/kvCrossTabSync';
import { backupAppKvAfterKvSave } from '../../utils/sqlAutosaveBackup';
import { createEmptyDataset, normalizeDataset } from '../domain/dataset';
import type { ReconciliationDataset } from '../domain/types';
import {
  getReconciliationRetrySnapshot,
  setReconciliationRemoteApply,
  setReconciliationRetrySnapshot,
} from './reconciliationPersistenceBridge';

const KV_KEY = 'data:reconciliation';
const AUTOSAVE_MS = 1200;
const AUTOSAVE_LARGE_MS = 4000;
const LARGE_DATASET_MOVEMENTS = 8000;
const PRODUCTION_USE_SQL = isProductionSqlEnabled();

export function useReconciliationDataset(enabled: boolean) {
  const [dataset, setDataset] = useState<ReconciliationDataset>(createEmptyDataset);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(dataset);
  const dirtyRef = useRef(false);
  const lastSaveErrorAtRef = useRef<Record<string, number>>({});
  const persistInFlightRef = useRef<Promise<boolean> | null>(null);
  latestRef.current = dataset;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await api.fetchKvKey(KV_KEY);
        if (cancelled) return;
        const next = normalizeDataset(raw);
        setDataset(next);
        setReconciliationRetrySnapshot(next);
        dirtyRef.current = false;
      } catch (e) {
        console.warn('[reconciliation] load', e);
        if (!cancelled) {
          const empty = createEmptyDataset();
          setDataset(empty);
          setReconciliationRetrySnapshot(empty);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const persist = useCallback(async (next: ReconciliationDataset) => {
    setSaving(true);
    setReconciliationRetrySnapshot(next);
    const run = (async () => {
      try {
        const ok = await api.saveKey(KV_KEY, next);
        if (!ok) {
          toast.error('No se pudo guardar la conciliación en la nube.');
          return false;
        }
        dirtyRef.current = false;
        markCrossTabEchoWindow(KV_KEY);
        void backupAppKvAfterKvSave(
          PRODUCTION_USE_SQL,
          KV_KEY,
          next,
          lastSaveErrorAtRef
        );
        return true;
      } catch (e) {
        console.warn('[reconciliation] save', e);
        toast.error('Error al guardar conciliación.');
        return false;
      } finally {
        setSaving(false);
        persistInFlightRef.current = null;
      }
    })();
    persistInFlightRef.current = run;
    return run;
  }, []);

  const flushPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    void persist(latestRef.current);
  }, [persist]);

  const updateDataset = useCallback(
    (updater: ReconciliationDataset | ((prev: ReconciliationDataset) => ReconciliationDataset)) => {
      setDataset((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        latestRef.current = next;
        setReconciliationRetrySnapshot(next);
        dirtyRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        const delay =
          next.movements.length >= LARGE_DATASET_MOVEMENTS ? AUTOSAVE_LARGE_MS : AUTOSAVE_MS;
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void persist(next);
        }, delay);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    if (!enabled || !loaded) return;
    setReconciliationRemoteApply((value) => {
      const next = normalizeDataset(value);
      if (dirtyRef.current) return;
      latestRef.current = next;
      setReconciliationRetrySnapshot(next);
      setDataset(next);
    });
    return () => setReconciliationRemoteApply(null);
  }, [enabled, loaded]);

  useEffect(() => {
    if (!enabled || !loaded) return;
    return subscribeKvCrossTab((msg) => {
      if (msg.key !== KV_KEY) return;
      if (dirtyRef.current) return;
      const next = normalizeDataset(msg.value);
      latestRef.current = next;
      setReconciliationRetrySnapshot(next);
      setDataset(next);
    });
  }, [enabled, loaded]);

  useEffect(() => {
    if (!enabled) return;
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      document.removeEventListener('visibilitychange', onHidden);
      flushPending();
    };
  }, [enabled, flushPending]);

  return {
    dataset,
    setDataset: updateDataset,
    loaded,
    saving,
    persist,
    getLatest: getReconciliationRetrySnapshot,
  };
}
