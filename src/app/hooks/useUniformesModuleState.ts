import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { UniformesSettings } from '../types/uniformes';
import { repository } from '../services/repository';
import { UNIFORMES_SETTINGS_KV_KEY, mergeUniformesSettings } from '../utils/uniformesData';

export function useUniformesModuleState(canEdit: boolean) {
  const [settings, setSettings] = useState<UniformesSettings>(() => mergeUniformesSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<UniformesSettings>(UNIFORMES_SETTINGS_KV_KEY);
        if (cancelled) return;
        setSettings(mergeUniformesSettings(raw));
      } catch {
        if (!cancelled) toast.error('No se pudo cargar el módulo de entrega de uniformes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistNow = useCallback(async (next: UniformesSettings, message?: string) => {
    setSaving(true);
    try {
      await repository.kv.set(UNIFORMES_SETTINGS_KV_KEY, next);
      if (message) toast.success(message);
      return true;
    } catch {
      toast.error('No se pudo guardar el registro de uniformes.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: UniformesSettings) => UniformesSettings, message?: string) => {
      if (!canEdit) {
        toast.error('No tienes permiso para editar entregas de uniformes.');
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
