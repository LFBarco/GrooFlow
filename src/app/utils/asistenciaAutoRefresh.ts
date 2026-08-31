import type { BukAsistenciaIntegrationSettings } from '../types/asistencia';

const DEFAULT_START = '06:00';
const DEFAULT_END = '22:00';

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isWithinAutoRefreshWindow(
  buk?: BukAsistenciaIntegrationSettings,
  now = new Date()
): boolean {
  const start = buk?.autoRefreshWindowStart?.trim() || DEFAULT_START;
  const end = buk?.autoRefreshWindowEnd?.trim() || DEFAULT_END;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = parseMinutes(start);
  const endMin = parseMinutes(end);
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin <= endMin;
  }
  return nowMin >= startMin || nowMin <= endMin;
}

export function autoRefreshIntervalMs(buk?: BukAsistenciaIntegrationSettings): number {
  const min = Math.max(5, buk?.autoRefreshIntervalMinutes ?? 30);
  return min * 60 * 1000;
}

export function shouldRunAutoRefresh(input: {
  buk?: BukAsistenciaIntegrationSettings;
  loading: boolean;
  documentVisible?: boolean;
}): boolean {
  if (!input.buk?.enabled || !input.buk.apiToken?.trim()) return false;
  if (input.buk.autoRefreshEnabled === false) return false;
  if (input.loading) return false;
  if (input.documentVisible === false) return false;
  return isWithinAutoRefreshWindow(input.buk);
}
