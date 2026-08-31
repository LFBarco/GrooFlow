import type {
  AsistenciaDailySnapshot,
  AsistenciaSettings,
  BukAsistenciaRecord,
} from '../types/asistencia';
import { repository } from '../services/repository';
import { buildAsistenciaDaySummary } from './asistenciaData';
import { buildLiveSedeSummary } from './asistenciaStaff';
import { toDateKey } from './turnosCalendar';

const STORAGE_KEY = 'gooflow:asistencia-snapshots:v1';
export const ASISTENCIA_SNAPSHOTS_KV_KEY = 'data:asistencia-snapshots';
const MAX_SNAPSHOTS = 180;

function loadAll(): AsistenciaDailySnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AsistenciaDailySnapshot[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: AsistenciaDailySnapshot[]): void {
  const trimmed = list.slice(-MAX_SNAPSHOTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  void repository.kv.set(ASISTENCIA_SNAPSHOTS_KV_KEY, trimmed).catch(() => {
    /* offline / sin sesión */
  });
}

export function listAsistenciaSnapshots(): AsistenciaDailySnapshot[] {
  return loadAll().sort((a, b) => b.dateYmd.localeCompare(a.dateYmd) || b.capturedAt.localeCompare(a.capturedAt));
}

/** Hidrata localStorage desde la nube si hay datos remotos. */
export async function hydrateAsistenciaSnapshotsFromCloud(): Promise<AsistenciaDailySnapshot[]> {
  try {
    const remote = await repository.kv.get<AsistenciaDailySnapshot[]>(ASISTENCIA_SNAPSHOTS_KV_KEY);
    if (Array.isArray(remote) && remote.length > 0) {
      const byId = new Map<string, AsistenciaDailySnapshot>();
      for (const s of [...loadAll(), ...remote]) {
        if (s?.id) byId.set(s.id, s);
      }
      const merged = [...byId.values()].sort(
        (a, b) => b.dateYmd.localeCompare(a.dateYmd) || b.capturedAt.localeCompare(a.capturedAt)
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, MAX_SNAPSHOTS)));
      } catch {
        /* ignore */
      }
      return merged;
    }
  } catch {
    /* ignore */
  }
  return listAsistenciaSnapshots();
}

export function snapshotsForMonth(monthPrefix: string): AsistenciaDailySnapshot[] {
  return listAsistenciaSnapshots().filter((s) => s.dateYmd.startsWith(monthPrefix));
}

export function captureAsistenciaDailySnapshots(input: {
  date: Date;
  sedeNames: string[];
  settings: AsistenciaSettings;
  records: BukAsistenciaRecord[];
  source: 'manual' | 'auto';
}): AsistenciaDailySnapshot[] {
  const dateYmd = toDateKey(input.date);
  const capturedAt = new Date().toISOString();
  const daySummary = buildAsistenciaDaySummary({
    date: input.date,
    records: input.records,
    settings: input.settings,
    visibleSedes: input.sedeNames,
  });

  const created: AsistenciaDailySnapshot[] = input.sedeNames.map((sedeName) => {
    const live = buildLiveSedeSummary({
      sedeName,
      settings: input.settings,
      records: input.records,
      date: input.date,
    });
    const cov = daySummary.sedes.find((s) => s.sedeName === sedeName);
    return {
      id: `${dateYmd}:${sedeName}`,
      dateYmd,
      sedeName,
      capturedAt,
      source: input.source,
      workingCount: live.workingCount,
      absentCount: live.absentCount,
      lateCount: live.lateCount,
      criticalAbsentCount: live.criticalMissing.length,
      totalRequired: cov?.totalRequired ?? 0,
      totalPresent: cov?.totalPresent ?? 0,
      bukRecordsOnDate: live.recordsOnDateCount,
    };
  });

  const existing = loadAll().filter((s) => !(s.dateYmd === dateYmd && input.sedeNames.includes(s.sedeName)));
  saveAll([...existing, ...created]);
  return created;
}

export function clearAsistenciaSnapshots(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  void repository.kv.set(ASISTENCIA_SNAPSHOTS_KV_KEY, []).catch(() => undefined);
}
