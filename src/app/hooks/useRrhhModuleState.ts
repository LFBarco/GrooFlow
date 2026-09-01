import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { RrhhSettings } from '../types/rrhh';
import { repository } from '../services/repository';
import { RRHH_SETTINGS_KV_KEY, mergeRrhhSettings } from '../utils/rrhhData';

export function useRrhhModuleState(canEdit: boolean) {
  const [settings, setSettings] = useState<RrhhSettings>(() => mergeRrhhSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<RrhhSettings>(RRHH_SETTINGS_KV_KEY);
        if (cancelled) return;
        setSettings(mergeRrhhSettings(raw));
      } catch {
        if (!cancelled) toast.error('No se pudo cargar el módulo de Recursos Humanos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistNow = useCallback(async (next: RrhhSettings, message?: string) => {
    setSaving(true);
    try {
      await repository.kv.set(RRHH_SETTINGS_KV_KEY, next);
      if (message) toast.success(message);
      return true;
    } catch {
      toast.error('No se pudo guardar Recursos Humanos.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: RrhhSettings) => RrhhSettings, message?: string) => {
      if (!canEdit) {
        toast.error('No tienes permiso para editar Recursos Humanos.');
        return;
      }
      setSettings((prev) => {
        const next = updater(prev);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void persistNow(next, message);
        }, 400);
        return next;
      });
    },
    [canEdit, persistNow]
  );

  return { settings, loading, saving, updateSettings, persistNow };
}
