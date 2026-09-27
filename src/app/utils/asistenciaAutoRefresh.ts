import type { BukAsistenciaIntegrationSettings } from '../types/asistencia';

/** Clínica 24h: por defecto refresca todo el día. */
export const AUTO_REFRESH_DEFAULT_WINDOW_START = '00:00';
export const AUTO_REFRESH_DEFAULT_WINDOW_END = '23:59';

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isWithinAutoRefreshWindow(
  buk?: BukAsistenciaIntegrationSettings,
  now = new Date()
): boolean {
  const start = buk?.autoRefreshWindowStart?.trim() || AUTO_REFRESH_DEFAULT_WINDOW_START;
  const end = buk?.autoRefreshWindowEnd?.trim() || AUTO_REFRESH_DEFAULT_WINDOW_END;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = parseMinutes(start);
  const endMin = parseMinutes(end);
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin <= endMin;
  }
  return nowMin >= startMin || nowMin <= endMin;
}

export function autoRefreshIntervalMs(buk?: BukAsistenciaIntegrationSettings): number {
  const min = Math.max(5, buk?.autoRefreshIntervalMinutes ?? 15);
  return min * 60 * 1000;
}

/** Activo salvo que se haya desactivado explícitamente en Integraciones. */
export function isAutoRefreshEnabled(buk?: BukAsistenciaIntegrationSettings): boolean {
  return buk?.autoRefreshEnabled !== false;
}

export function shouldRunAutoRefresh(input: {
  buk?: BukAsistenciaIntegrationSettings;
  loading: boolean;
  documentVisible?: boolean;
  now?: Date;
}): boolean {
  if (!input.buk?.enabled || !input.buk.apiToken?.trim()) return false;
  if (!isAutoRefreshEnabled(input.buk)) return false;
  if (input.loading) return false;
  if (input.documentVisible === false) return false;
  return isWithinAutoRefreshWindow(input.buk, input.now);
}

/** Los datos en pantalla son más viejos que el intervalo configurado. */
export function isAutoRefreshDue(input: {
  lastFetchedAt: number | null;
  intervalMs: number;
  now?: number;
}): boolean {
  if (input.lastFetchedAt == null) return true;
  const now = input.now ?? Date.now();
  return now - input.lastFetchedAt >= input.intervalMs;
}
