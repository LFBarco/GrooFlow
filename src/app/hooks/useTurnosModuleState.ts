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
  sedeCatalog?: string[];
  canEdit: boolean;
}) {
  const [settings, setSettings] = useState<TurnosSettings>(() => mergeTurnosSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(settings);
  const turnosRawRef = useRef<TurnosSettings | null>(null);
  const builtOnceRef = useRef(false);
  latestRef.current = settings;

  const usersLen = input.users.length;
  const staffLen = input.asistencia?.staff?.length ?? 0;
  const sedeCatalogKey = (input.sedeCatalog ?? []).join('\0');

  const rebuildRoster = useCallback(
    (base: TurnosSettings): TurnosSettings => ({
      ...base,
      roster: buildRosterFromSources({
        users: input.users,
        asistencia: input.asistencia,
        existing: base.roster,
        sedeCatalog: input.sedeCatalog,
      }),
      rosterSyncedAt: new Date().toISOString(),
    }),
    [input.users, input.asistencia, input.sedeCatalog]
  );

  // Carga KV. Solo construye roster si ya hay organigrama/usuarios (evita flash código→nombre).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<TurnosSettings>(TURNOS_SETTINGS_KV_KEY);
        if (cancelled) return;
        const merged = mergeTurnosSettings(raw);
        turnosRawRef.current = merged;
        if (staffLen > 0 || usersLen > 0) {
          setSettings(rebuildRoster(merged));
          builtOnceRef.current = true;
        } else {
          setSettings({ ...merged, roster: [] });
        }
      } catch {
        if (!cancelled) toast.error('No se pudo cargar la planificación de turnos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si al montar aún no había fuentes, construir una sola vez cuando lleguen.
  useEffect(() => {
    if (loading || builtOnceRef.current) return;
    if (staffLen === 0 && usersLen === 0) return;
    const base = turnosRawRef.current ?? latestRef.current;
    setSettings(rebuildRoster(base));
    builtOnceRef.current = true;
  }, [loading, staffLen, usersLen, sedeCatalogKey, rebuildRoster]);

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
      (prev) => rebuildRoster(prev),
      'Personal sincronizado desde organigrama (maestro Buk.pe).'
    );
  }, [rebuildRoster, updateSettings]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    syncRoster,
    persistNow,
  };
}
