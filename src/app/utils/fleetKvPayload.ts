import type { FleetDataset, FleetInspectionRecord, FleetChecklistSection } from '../types/fleet';
import { isDefaultFleetChecklist, normalizeFleetDataset } from './fleetData';
import { isFleetSqlEnabled } from '../services/repository/fleetSql';

const KV_TARGET_MAX_BYTES = 3_500_000;

export function estimateFleetDatasetBytes(dataset: FleetDataset): number {
  try {
    return new Blob([JSON.stringify(dataset)]).size;
  } catch {
    return 0;
  }
}

function rowTimestamp(raw?: string): number {
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

/** Combina listas operativas; respeta borrados y timestamps en conflictos multi-usuario. */
function pickOperationalList<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  kvList: T[],
  sqlList: T[]
): T[] {
  const kvIds = new Set(kvList.map((r) => r.id));
  const sqlIds = new Set(sqlList.map((r) => r.id));
  const kvOnly = [...kvIds].filter((id) => !sqlIds.has(id));
  const sqlOnly = [...sqlIds].filter((id) => !kvIds.has(id));
  if (kvOnly.length === 0 && sqlOnly.length > 0) return kvList;
  if (sqlOnly.length === 0 && kvOnly.length > 0) return sqlList;
  if (kvOnly.length > 0 && sqlOnly.length > 0) {
    const merged = new Map<string, T>();
    for (const row of sqlList) merged.set(row.id, row);
    for (const row of kvList) merged.set(row.id, row);
    return [...merged.values()];
  }
  const sqlMap = new Map(sqlList.map((r) => [r.id, r]));
  const ts = (r: T) => rowTimestamp(r.updatedAt || r.createdAt);
  return kvList.map((kvRow) => {
    const sqlRow = sqlMap.get(kvRow.id);
    if (!sqlRow) return kvRow;
    return ts(sqlRow) >= ts(kvRow) ? sqlRow : kvRow;
  });
}

function mergeInspections(
  kv: FleetInspectionRecord[],
  sql: FleetInspectionRecord[]
): FleetInspectionRecord[] {
  const base = pickOperationalList(
    kv.map((r) => ({ ...r, createdAt: r.createdAt })),
    sql.map((r) => ({ ...r, createdAt: r.createdAt }))
  );
  const kvMap = new Map(kv.map((r) => [r.id, r]));
  const sqlMap = new Map(sql.map((r) => [r.id, r]));
  return base.map((row) => {
    const k = kvMap.get(row.id);
    const s = sqlMap.get(row.id);
    if (k && s) return pickRicherInspection(k, s);
    return (k ?? s ?? row) as FleetInspectionRecord;
  });
}

/** KV: metadata sin dataUrls pesados; inspecciones solo en SQL cuando está activo. */
export function slimFleetDatasetForKv(dataset: FleetDataset): FleetDataset {
  const slimInspection = (ins: FleetInspectionRecord): FleetInspectionRecord => ({
    ...ins,
    driverSignatureDataUrl: ins.driverSignatureDataUrl ? 'sql' : undefined,
    supervisorSignatureDataUrl: ins.supervisorSignatureDataUrl ? 'sql' : undefined,
    attachments: (ins.attachments ?? []).map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      uploadedAt: a.uploadedAt,
      dataUrl: '',
    })),
  });

  if (isFleetSqlEnabled()) {
    return normalizeFleetDataset({
      ...dataset,
      inspections: [],
    });
  }

  let inspections = dataset.inspections.map(slimInspection);
  let slim: FleetDataset = { ...dataset, inspections };

  while (estimateFleetDatasetBytes(slim) > KV_TARGET_MAX_BYTES && inspections.length > 30) {
    inspections = inspections.slice(0, inspections.length - 10);
    slim = { ...slim, inspections };
  }

  return slim;
}

function inspectionRichness(ins: FleetInspectionRecord): number {
  let score = 0;
  if (ins.driverSignatureDataUrl && ins.driverSignatureDataUrl !== 'sql') score += 2;
  if (ins.supervisorSignatureDataUrl && ins.supervisorSignatureDataUrl !== 'sql') score += 2;
  for (const a of ins.attachments ?? []) {
    if (a.dataUrl && a.dataUrl.length > 20) score += 1;
  }
  return score;
}

function pickRicherInspection(a: FleetInspectionRecord, b: FleetInspectionRecord): FleetInspectionRecord {
  return inspectionRichness(b) >= inspectionRichness(a) ? b : a;
}

/** Combina KV + SQL al cargar (firmas en SQL, resto en KV). */
export function mergeFleetKvAndSql(kv: FleetDataset, sql: FleetDataset): FleetDataset {
  const nk = normalizeFleetDataset(kv);
  const ns = normalizeFleetDataset(sql);

  const pickChecklist = (
    kvSections: FleetChecklistSection[],
    sqlSections: FleetChecklistSection[]
  ): FleetChecklistSection[] => {
    const kvSig = JSON.stringify(kvSections);
    const sqlSig = JSON.stringify(sqlSections);
    if (kvSig === sqlSig) return kvSections;
    if (kvSections.length === 0) return sqlSections;
    if (sqlSections.length === 0) return kvSections;
    const kvDefault = isDefaultFleetChecklist(kvSections);
    const sqlDefault = isDefaultFleetChecklist(sqlSections);
    if (kvDefault && !sqlDefault) return sqlSections;
    if (sqlDefault && !kvDefault) return kvSections;
    return sqlSections;
  };

  return normalizeFleetDataset({
    vehicles: pickOperationalList(nk.vehicles, ns.vehicles),
    maintenance: pickOperationalList(nk.maintenance, ns.maintenance),
    fuelEntries: pickOperationalList(nk.fuelEntries, ns.fuelEntries),
    inspections: mergeInspections(nk.inspections, ns.inspections),
    checklistSections: pickChecklist(nk.checklistSections, ns.checklistSections),
  });
}
