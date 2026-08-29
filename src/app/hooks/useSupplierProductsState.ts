import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { SupplierProductsSettings } from '../types/supplierProducts';
import { repository } from '../services/repository';
import {
  SUPPLIER_PRODUCTS_KV_KEY,
  mergeSupplierProductsSettings,
} from '../utils/supplierProductsData';

export function useSupplierProductsState(canEdit = true) {
  const [settings, setSettings] = useState<SupplierProductsSettings>(() =>
    mergeSupplierProductsSettings()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<SupplierProductsSettings>(SUPPLIER_PRODUCTS_KV_KEY);
        if (cancelled) return;
        setSettings(mergeSupplierProductsSettings(raw));
      } catch {
        if (!cancelled) toast.error('No se pudo cargar el catálogo proveedor–producto.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistNow = useCallback(async (next: SupplierProductsSettings, message?: string) => {
    setSaving(true);
    try {
      await repository.kv.set(SUPPLIER_PRODUCTS_KV_KEY, next);
      if (message) toast.success(message);
      return true;
    } catch {
      toast.error('No se pudo guardar el catálogo de proveedores.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: SupplierProductsSettings) => SupplierProductsSettings, message?: string) => {
      if (!canEdit) {
        toast.error('No tienes permiso para editar ofertas de proveedor.');
        return;
      }
      setSettings((prev) => {
        const next = updater(prev);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void persistNow(next, message);
        }, 350);
        return next;
      });
    },
    [canEdit, persistNow]
  );

  return { settings, loading, saving, updateSettings, persistNow };
}
