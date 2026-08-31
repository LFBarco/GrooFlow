import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { AsistenciaSettings } from '../types/asistencia';
import type { User } from '../types';
import type { TurnosSettings } from '../types/turnos';
import { repository } from '../services/repository';
import {
  TURNOS_SETTINGS_KV_KEY,
  buildRosterFromSources,
  mergeTurnosSettings,
} from '../utils/turnosData';

export function useTurnosModuleState(input: {
  users: User[];
  asistencia?: AsistenciaSettings | null;
  canEdit: boolean;
}) {
  const [settings, setSettings] = useState<TurnosSettings>(() => mergeTurnosSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(settings);
  latestRef.current = settings;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<TurnosSettings>(TURNOS_SETTINGS_KV_KEY);
        if (cancelled) return;
        const merged = mergeTurnosSettings(raw);
        const roster = buildRosterFromSources({
          users: input.users,
          asistencia: input.asistencia,
          existing: merged.roster,
        });
        setSettings({
          ...merged,
          roster,
          rosterSyncedAt: new Date().toISOString(),
        });
      } catch {
        if (!cancelled) toast.error('No se pudo cargar la planificación de turnos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Carga inicial única; syncRoster actualiza el roster bajo demanda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistNow = useCallback(async (next: TurnosSettings, message?: string) => {
    setSaving(true);
    try {
      await repository.kv.set(TURNOS_SETTINGS_KV_KEY, next);
      latestRef.current = next;
      if (message) toast.success(message);
      return true;
    } catch {
      toast.error('No se pudo guardar los turnos.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => {
      if (!input.canEdit) {
        toast.error('No tienes permiso para editar turnos.');
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
    [input.canEdit, persistNow]
  );

  const syncRoster = useCallback(() => {
    updateSettings(
      (prev) => ({
        ...prev,
        roster: buildRosterFromSources({
          users: input.users,
          asistencia: input.asistencia,
          existing: prev.roster,
        }),
        rosterSyncedAt: new Date().toISOString(),
      }),
      'Personal sincronizado con usuarios y asistencia.'
    );
  }, [input.users, input.asistencia, updateSettings]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    syncRoster,
    persistNow,
  };
}
