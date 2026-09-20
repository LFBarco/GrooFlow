import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { AccidentesSettings } from '../types/accidentes';
import { repository } from '../services/repository';
import {
  ACCIDENTES_SETTINGS_KV_KEY,
  mergeAccidentesSettings,
} from '../utils/accidentesData';
import { isKvPermissionDeniedError, markKvPermissionDenied } from '../utils/kvWriteAccess';

export function useAccidentesModuleState(canPersist: boolean) {
  const [settings, setSettings] = useState<AccidentesSettings>(() => mergeAccidentesSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<AccidentesSettings | null>(null);
  const pendingMessageRef = useRef<string | undefined>(undefined);

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
      pendingRef.current = null;
      pendingMessageRef.current = undefined;
      if (message) toast.success(message);
      return true;
    } catch (e) {
      if (isKvPermissionDeniedError(e)) {
        markKvPermissionDenied(ACCIDENTES_SETTINGS_KV_KEY);
        toast.error('Sin permiso para guardar accidentes de trabajo.');
      } else {
        toast.error('No se pudo guardar el registro de accidentes.');
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Flush pendiente al desmontar (evita perder el último autosave).
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const pending = pendingRef.current;
      if (pending && canPersist) {
        void repository.kv.set(ACCIDENTES_SETTINGS_KV_KEY, pending).catch(() => {
          /* ignore on unmount */
        });
      }
    };
  }, [canPersist]);

  const updateSettings = useCallback(
    (updater: (prev: AccidentesSettings) => AccidentesSettings, message?: string) => {
      if (!canPersist) {
        toast.error('No tienes permiso para modificar accidentes de trabajo.');
        return;
      }
      setSettings((prev) => {
        const next = updater(prev);
        pendingRef.current = next;
        pendingMessageRef.current = message;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void persistNow(next, message);
        }, 400);
        return next;
      });
    },
    [canPersist, persistNow]
  );

  return { settings, loading, saving, updateSettings, persistNow };
}
