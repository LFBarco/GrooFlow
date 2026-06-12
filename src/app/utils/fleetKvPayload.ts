import type { FleetDataset, FleetInspectionRecord, FleetChecklistSection } from '../types/fleet';
import { isDefaultFleetChecklist, normalizeFleetDataset } from './fleetData';
const KV_TARGET_MAX_BYTES = 3_500_000;

export function estimateFleetDatasetBytes(dataset: FleetDataset): number {
  try {
    return new Blob([JSON.stringify(dataset)]).size;
  } catch {
    return 0;
  }
}

/** KV: metadata sin dataUrls pesados; SQL guarda el documento completo en fleet_inspections. */
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
  const inspMap = new Map<string, FleetInspectionRecord>();
  for (const ins of nk.inspections) inspMap.set(ins.id, ins);
  for (const ins of ns.inspections) {
    const prev = inspMap.get(ins.id);
    inspMap.set(ins.id, prev ? pickRicherInspection(prev, ins) : ins);
  }

  /** SQL es fuente de verdad para listas operativas (vehículos, mantenimiento, combustible). */
  const pickOperational = <T>(_kvList: T[], sqlList: T[]) => sqlList;

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
    if (kvSections.length !== sqlSections.length) {
      return sqlSections;
    }
    /** Misma cantidad pero contenido distinto: SQL (tabla fleet_checklist). */
    return sqlSections;
  };
  return normalizeFleetDataset({
    vehicles: pickOperational(nk.vehicles, ns.vehicles),
    maintenance: pickOperational(nk.maintenance, ns.maintenance),
    fuelEntries: pickOperational(nk.fuelEntries, ns.fuelEntries),
    inspections: [...inspMap.values()],
    checklistSections: pickChecklist(nk.checklistSections, ns.checklistSections),
  });
}
