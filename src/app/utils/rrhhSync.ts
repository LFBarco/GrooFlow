import type { BukPeEmployeeRow, RrhhSyncStats } from '../types/rrhh';

const HASH_KEYS: (keyof BukPeEmployeeRow)[] = [
  'fullName',
  'documentNumber',
  'email',
  'personalEmail',
  'phone',
  'status',
  'cargo',
  'area',
  'sede',
  'contractType',
  'startDate',
  'endDate',
  'rutAsistencia',
  'recintoNombre',
  'recintoCodigo',
  'areaAsistencia',
  'especialidad',
  'supervisor',
  'turnoAsistencia',
  'codigoTurno',
  'ultimaMarcacionEntrada',
  'ultimaMarcacionSalida',
  'ultimaAsistenciaDia',
];

function stableValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v).trim();
}

/** Huella para detectar cambios entre sincronizaciones. */
export function employeeSyncHash(emp: BukPeEmployeeRow): string {
  return HASH_KEYS.map((k) => stableValue(emp[k])).join('\x1f');
}

export type MergeEmployeesResult = {
  employees: BukPeEmployeeRow[];
  stats: RrhhSyncStats;
};

/**
 * Fusiona empleados descargados con el caché local: conserva historial,
 * solo actualiza filas con cambios reales.
 */
export function mergeEmployeesIncremental(
  existing: BukPeEmployeeRow[],
  incoming: BukPeEmployeeRow[]
): MergeEmployeesResult {
  const prevById = new Map(existing.map((e) => [e.bukId, e]));
  const now = new Date().toISOString();
  const next: BukPeEmployeeRow[] = [];
  const stats: RrhhSyncStats = {
    added: 0,
    updated: 0,
    unchanged: 0,
    removedFromSource: 0,
    total: 0,
  };

  const seen = new Set<number>();

  for (const inc of incoming) {
    seen.add(inc.bukId);
    const prev = prevById.get(inc.bukId);
    const hash = employeeSyncHash(inc);

    if (!prev) {
      next.push({
        ...inc,
        firstSyncedAt: now,
        lastUpdatedAt: now,
        contentHash: hash,
      });
      stats.added++;
      continue;
    }

    const prevHash = prev.contentHash ?? employeeSyncHash(prev);
    if (prevHash === hash) {
      next.push(prev);
      stats.unchanged++;
    } else {
      next.push({
        ...inc,
        firstSyncedAt: prev.firstSyncedAt ?? now,
        lastUpdatedAt: now,
        contentHash: hash,
      });
      stats.updated++;
    }
  }

  for (const prev of existing) {
    if (seen.has(prev.bukId)) continue;
    next.push({
      ...prev,
      missingFromSource: true,
      lastUpdatedAt: now,
    });
    stats.removedFromSource++;
  }

  stats.total = next.length;
  return { employees: next, stats };
}

export function formatSyncStatsMessage(stats: RrhhSyncStats, asistenciaMatched?: number): string {
  const parts = [
    `${stats.total} colaborador(es) en caché`,
    stats.added ? `${stats.added} nuevo(s)` : null,
    stats.updated ? `${stats.updated} actualizado(s)` : null,
    stats.unchanged ? `${stats.unchanged} sin cambios` : null,
    stats.removedFromSource ? `${stats.removedFromSource} ya no en API` : null,
    asistenciaMatched != null && asistenciaMatched > 0
      ? `${asistenciaMatched} con datos de asistencia`
      : null,
  ].filter(Boolean);
  return parts.join(' · ');
}
