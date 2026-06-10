import type { FleetDataset, FleetInspectionRecord } from '../types/fleet';
import { normalizeFleetDataset } from './fleetData';

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

  const pickLonger = <T>(a: T[], b: T[]) => (a.length >= b.length ? a : b);

  return normalizeFleetDataset({
    vehicles: pickLonger(nk.vehicles, ns.vehicles),
    maintenance: pickLonger(nk.maintenance, ns.maintenance),
    fuelEntries: pickLonger(nk.fuelEntries, ns.fuelEntries),
    inspections: [...inspMap.values()],
    checklistSections:
      nk.checklistSections.length >= ns.checklistSections.length
        ? nk.checklistSections
        : ns.checklistSections,
  });
}
