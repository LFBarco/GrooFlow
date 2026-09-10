import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { MarketingEventosSettings } from '../types/marketingEventos';
import { repository } from '../services/repository';
import {
  MARKETING_EVENTOS_SETTINGS_KV_KEY,
  mergeMarketingEventosSettings,
} from '../utils/marketingEventosData';

export function useMarketingEventosModuleState(canEdit: boolean) {
  const [settings, setSettings] = useState<MarketingEventosSettings>(() =>
    mergeMarketingEventosSettings()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<MarketingEventosSettings>(
          MARKETING_EVENTOS_SETTINGS_KV_KEY
        );
        if (cancelled) return;
        setSettings(mergeMarketingEventosSettings(raw));
      } catch {
        if (!cancelled) toast.error('No se pudo cargar Marketing Eventos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistNow = useCallback(async (next: MarketingEventosSettings, message?: string) => {
    setSaving(true);
    try {
      await repository.kv.set(MARKETING_EVENTOS_SETTINGS_KV_KEY, next);
      if (message) toast.success(message);
      return true;
    } catch {
      toast.error('No se pudo guardar Marketing Eventos.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: MarketingEventosSettings) => MarketingEventosSettings, message?: string) => {
      if (!canEdit) {
        toast.error('No tienes permiso para editar Marketing Eventos.');
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
