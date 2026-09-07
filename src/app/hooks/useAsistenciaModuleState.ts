import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';
import type { TurnosSettings } from '../types/turnos';
import { fetchBukAsistenciaAllDetailed, sanitizeBukBaseUrl } from '../utils/bukAsistenciaApi';
import {
  cacheAgeLabel,
  countDistinctLocalBukDays,
  loadBukAsistenciaCache,
  mergeBukAsistenciaRecords,
  saveBukAsistenciaCache,
} from '../utils/bukAsistenciaCache';
import {
  fetchBukAsistenciaHistory,
  fetchBukAsistenciaHistoryStats,
  upsertBukAsistenciaHistory,
} from '../utils/asistenciaBukHistoryApi';
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
  const [historyStats, setHistoryStats] = useState<{
    days: number;
    records: number;
    min_ymd: string | null;
    max_ymd: string | null;
  } | null>(null);
  const [lastTruncated, setLastTruncated] = useState(false);
  const hydratedRangeRef = useRef<string>('');

  const refreshHistoryStats = useCallback(async () => {
    const stats = await fetchBukAsistenciaHistoryStats();
    if (stats) setHistoryStats(stats);
  }, []);

  useEffect(() => {
    if (!asistencia.buk?.enabled || !bukToken) {
      setModuleReady(true);
      return;
    }
    const cached = loadBukAsistenciaCache({ baseUrl: bukBaseUrl, apiToken: bukToken });
    if (cached?.records.length) {
      setRecords(cached.records);
      setCacheFetchedAt(cached.fetchedAt);
      // Migrar caché local existente al historial MySQL (best-effort).
      void upsertBukAsistenciaHistory(cached.records, cached.fetchedAt)
        .then(() => refreshHistoryStats())
        .catch(() => {
          /* offline / sin sesión */
        });
    }
    void refreshHistoryStats();
    setModuleReady(true);
  }, [asistencia.buk?.enabled, bukBaseUrl, bukToken, refreshHistoryStats]);

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

  const hydrateHistoryRange = useCallback(
    async (fromYmd: string, toYmd: string, silent = true) => {
      const rangeKey = `${fromYmd}|${toYmd}`;
      if (!silent && hydratedRangeRef.current === rangeKey) {
        hydratedRangeRef.current = '';
      }
      if (hydratedRangeRef.current === rangeKey) return;
      try {
        const remote = await fetchBukAsistenciaHistory({ fromYmd, toYmd });
        if (!remote.length) {
          hydratedRangeRef.current = rangeKey;
          if (!silent) {
            toast.message('Sin marcaciones en el servidor para ese rango.');
          }
          return;
        }
        setRecords((prev) => {
          const merged = mergeBukAsistenciaRecords(prev, remote);
          if (bukToken) {
            const save = saveBukAsistenciaCache({
              baseUrl: bukBaseUrl,
              apiToken: bukToken,
              records: merged,
              fetchedAt: cacheFetchedAt ?? Date.now(),
            });
            if (!save.ok && save.quotaExceeded && !silent) {
              toast.warning(
                'Caché local llena: el historial sigue en el servidor. Libera espacio del navegador si puedes.'
              );
            }
          }
          return merged;
        });
        hydratedRangeRef.current = rangeKey;
        void refreshHistoryStats();
      } catch {
        if (!silent) {
          toast.error('No se pudo cargar historial desde el servidor.');
        }
      }
    },
    [bukBaseUrl, bukToken, cacheFetchedAt, refreshHistoryStats]
  );

  const refreshBuk = useCallback(
    async (input: {
      activeSede: string;
      date: Date;
      onMissingStaff?: () => void;
      silent?: boolean;
    }): Promise<{ ok: boolean; records?: BukAsistenciaRecord[]; truncated?: boolean }> => {
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
        const result = await fetchBukAsistenciaAllDetailed({
          baseUrl: resolvedBase,
          apiToken: bukCfg.apiToken,
          maxPages: 50,
          onProgress: (loaded, total) => {
            setFetchProgress(
              loaded === 0
                ? 'Conectando con Buk vía servidor…'
                : `Buk ${loaded}/${total} páginas…`
            );
          },
        });
        const merged = mergeBukAsistenciaRecords(cached?.records ?? [], result.records);
        const now = Date.now();
        const save = saveBukAsistenciaCache({
          baseUrl: resolvedBase,
          apiToken: bukCfg.apiToken,
          records: merged,
          fetchedAt: now,
        });
        setRecords(merged);
        setCacheFetchedAt(now);
        setLastTruncated(result.truncated);
        hydratedRangeRef.current = '';

        try {
          await upsertBukAsistenciaHistory(merged, now);
          await refreshHistoryStats();
        } catch {
          if (!input.silent) {
            toast.warning('Marcaciones en memoria, pero no se pudo guardar el historial en el servidor.');
          }
        }

        if (!save.ok && save.quotaExceeded && !input.silent) {
          toast.warning(
            'Caché local llena: el historial completo queda en el servidor MySQL.'
          );
        } else if (save.pruned && !input.silent) {
          toast.message('Caché local podada a días recientes; historial completo en servidor.');
        }

        if (result.truncated && !input.silent) {
          toast.warning(
            `Buk devolvió más páginas de las descargadas (${result.fetchedPages}/${result.reportedTotalPages}). Puede faltar personal reciente.`
          );
        }

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
              `${merged.length} registros (${delta > 0 ? `+${delta} nuevos · ` : ''}${onDate.length} en fecha para ${input.activeSede}). Historial guardado en servidor.`
            );
          }
        }
        return { ok: true, records: merged, truncated: result.truncated };
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
    [asistencia, refreshHistoryStats]
  );

  const setRecordsDirect = useCallback((next: BukAsistenciaRecord[], fetchedAt?: number) => {
    setRecords(next);
    setCacheFetchedAt(fetchedAt ?? Date.now());
  }, []);

  const localDays = countDistinctLocalBukDays(records);

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
    hydrateHistoryRange,
    historyStats,
    localDays,
    lastTruncated,
    bukEnabled: Boolean(asistencia.buk?.enabled && bukToken),
  };
}

/** Helper para hidratar ±N días alrededor de una fecha ISO yyyy-MM-dd. */
export function historyWindowAround(selectedDateYmd: string, daysBefore = 30, daysAfter = 0) {
  const center = new Date(`${selectedDateYmd}T12:00:00`);
  const from = format(subDays(center, daysBefore), 'yyyy-MM-dd');
  const to = format(subDays(center, -daysAfter), 'yyyy-MM-dd');
  return { from, to };
}
