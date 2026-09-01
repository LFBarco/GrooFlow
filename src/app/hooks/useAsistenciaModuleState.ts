import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';
import type { TurnosSettings } from '../types/turnos';
import { fetchBukAsistenciaAll, sanitizeBukBaseUrl } from '../utils/bukAsistenciaApi';
import {
  cacheAgeLabel,
  loadBukAsistenciaCache,
  mergeBukAsistenciaRecords,
  saveBukAsistenciaCache,
} from '../utils/bukAsistenciaCache';
import { mergeAsistenciaSettings } from '../utils/asistenciaData';
import { formatSedeDateLabel } from '../utils/asistenciaStaff';
import { repository } from '../services/repository';
import { TURNOS_SETTINGS_KV_KEY, mergeTurnosSettings } from '../utils/turnosData';

export function useAsistenciaModuleState(asistenciaInput?: AsistenciaSettings | null) {
  const asistencia = mergeAsistenciaSettings(asistenciaInput);
  const bukBaseUrl = sanitizeBukBaseUrl(asistencia.buk?.apiBaseUrl || 'https://app.ctrlit.cl/ctrl/api/v2');
  const bukToken = asistencia.buk?.apiToken?.trim() ?? '';

  const [records, setRecords] = useState<BukAsistenciaRecord[]>([]);
  const [cacheFetchedAt, setCacheFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const [moduleReady, setModuleReady] = useState(false);
  const [turnosSettings, setTurnosSettings] = useState<TurnosSettings>(() => mergeTurnosSettings());
  const [turnosLoading, setTurnosLoading] = useState(true);

  useEffect(() => {
    if (!asistencia.buk?.enabled || !bukToken) {
      setModuleReady(true);
      return;
    }
    const cached = loadBukAsistenciaCache({ baseUrl: bukBaseUrl, apiToken: bukToken });
    if (cached?.records.length) {
      setRecords(cached.records);
      setCacheFetchedAt(cached.fetchedAt);
    }
    setModuleReady(true);
  }, [asistencia.buk?.enabled, bukBaseUrl, bukToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<TurnosSettings>(TURNOS_SETTINGS_KV_KEY);
        if (!cancelled) setTurnosSettings(mergeTurnosSettings(raw));
      } catch {
        if (!cancelled) toast.error('No se pudo cargar turnos para plan vs real.');
      } finally {
        if (!cancelled) setTurnosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBuk = useCallback(
    async (input: {
      activeSede: string;
      date: Date;
      onMissingStaff?: () => void;
      silent?: boolean;
    }): Promise<{ ok: boolean; records?: BukAsistenciaRecord[] }> => {
      const bukCfg = asistencia.buk;
      const resolvedBase = sanitizeBukBaseUrl(bukCfg?.apiBaseUrl || 'https://app.ctrlit.cl/ctrl/api/v2');
      if (!bukCfg?.enabled || !bukCfg.apiToken?.trim()) {
        toast.error('Activa Buk Asistencia y configura el token en Configuración → Integraciones.');
        return { ok: false };
      }

      setLoading(true);
      setFetchProgress(null);
      const cached = loadBukAsistenciaCache({
        baseUrl: resolvedBase,
        apiToken: bukCfg.apiToken,
      });
      const priorCount = cached?.records.length ?? 0;
      if (cached?.records.length) {
        setRecords(cached.records);
        setCacheFetchedAt(cached.fetchedAt);
      }
      try {
        const fresh = await fetchBukAsistenciaAll({
          baseUrl: resolvedBase,
          apiToken: bukCfg.apiToken,
          onProgress: (loaded, total) => {
            setFetchProgress(
              loaded === 0
                ? 'Conectando con Buk vía servidor…'
                : `Buk ${loaded}/${total} páginas…`
            );
          },
        });
        const merged = mergeBukAsistenciaRecords(cached?.records ?? [], fresh);
        const now = Date.now();
        saveBukAsistenciaCache({
          baseUrl: resolvedBase,
          apiToken: bukCfg.apiToken,
          records: merged,
          fetchedAt: now,
        });
        setRecords(merged);
        setCacheFetchedAt(now);
        const onDate = merged.filter((r) => {
          const key = formatSedeDateLabel(input.date);
          return r.dia_entrada === key || (r.entrada && formatSedeDateLabel(new Date(r.entrada)) === key);
        });
        const delta = Math.max(0, merged.length - priorCount);
        if (!input.silent) {
          if (merged.length === 0) {
            toast.warning(
              'Buk respondió sin registros. Verifica URL/token en Integraciones, que la integración esté activa y que haya marcaciones en Buk para la fecha.'
            );
          } else {
            toast.success(
              `${merged.length} registros (${delta > 0 ? `+${delta} nuevos · ` : ''}${onDate.length} en fecha para ${input.activeSede}). Caché 48 h.`
            );
          }
        }
        return { ok: true, records: merged };
      } catch (err) {
        if (cached?.records.length) {
          toast.error(
            err instanceof Error
              ? `${err.message} — mostrando caché ${cacheAgeLabel(cached.fetchedAt)}.`
              : 'Error Buk — mostrando caché local.'
          );
        } else {
          toast.error(err instanceof Error ? err.message : 'No se pudo cargar asistencia.');
        }
        input.onMissingStaff?.();
        return { ok: false };
      } finally {
        setLoading(false);
        setFetchProgress(null);
      }
    },
    [asistencia]
  );

  const setRecordsDirect = useCallback((next: BukAsistenciaRecord[], fetchedAt?: number) => {
    setRecords(next);
    setCacheFetchedAt(fetchedAt ?? Date.now());
  }, []);

  return {
    records,
    setRecords: setRecordsDirect,
    cacheFetchedAt,
    loading,
    fetchProgress,
    moduleReady,
    turnosSettings,
    turnosLoading,
    refreshBuk,
    bukEnabled: Boolean(asistencia.buk?.enabled && bukToken),
  };
}
