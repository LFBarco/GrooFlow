import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { AccidentesSettings } from '../types/accidentes';
import { repository } from '../services/repository';
import {
  ACCIDENTES_SETTINGS_KV_KEY,
  mergeAccidentesSettings,
} from '../utils/accidentesData';

export function useAccidentesModuleState(canEdit: boolean) {
  const [settings, setSettings] = useState<AccidentesSettings>(() => mergeAccidentesSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<AccidentesSettings>(ACCIDENTES_SETTINGS_KV_KEY);
        if (cancelled) return;
        setSettings(mergeAccidentesSettings(raw));
      } catch {
        if (!cancelled) toast.error('No se pudo cargar el módulo de accidentes de trabajo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistNow = useCallback(async (next: AccidentesSettings, message?: string) => {
    setSaving(true);
    try {
      await repository.kv.set(ACCIDENTES_SETTINGS_KV_KEY, next);
      if (message) toast.success(message);
      return true;
    } catch {
      toast.error('No se pudo guardar el registro de accidentes.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: AccidentesSettings) => AccidentesSettings, message?: string) => {
      if (!canEdit) {
        toast.error('No tienes permiso para editar accidentes de trabajo.');
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
