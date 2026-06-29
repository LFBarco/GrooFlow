import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../services/api';
import { createEmptyDataset, normalizeDataset } from '../domain/dataset';
import type { ReconciliationDataset } from '../domain/types';

const KV_KEY = 'data:reconciliation';
const AUTOSAVE_MS = 1200;
const AUTOSAVE_LARGE_MS = 4000;
const LARGE_DATASET_MOVEMENTS = 8000;

export function useReconciliationDataset(enabled: boolean) {
  const [dataset, setDataset] = useState<ReconciliationDataset>(createEmptyDataset);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(dataset);
  latestRef.current = dataset;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await api.fetchKvKey(KV_KEY);
        if (cancelled) return;
        setDataset(normalizeDataset(raw));
      } catch (e) {
        console.warn('[reconciliation] load', e);
        if (!cancelled) setDataset(createEmptyDataset());
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
    try {
      const ok = await api.saveKey(KV_KEY, next);
      if (!ok) toast.error('No se pudo guardar la conciliación en la nube.');
      return ok;
    } catch (e) {
      console.warn('[reconciliation] save', e);
      toast.error('Error al guardar conciliación.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateDataset = useCallback(
    (updater: ReconciliationDataset | ((prev: ReconciliationDataset) => ReconciliationDataset)) => {
      setDataset((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        latestRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        const delay =
          next.movements.length >= LARGE_DATASET_MOVEMENTS ? AUTOSAVE_LARGE_MS : AUTOSAVE_MS;
        timerRef.current = setTimeout(() => {
          void persist(next);
        }, delay);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { dataset, setDataset: updateDataset, loaded, saving, persist };
}
