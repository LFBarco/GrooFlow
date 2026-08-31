import * as XLSX from 'xlsx';

import type { WorkplaceAccidentRecord } from '../types/accidentes';
import {
  ACCIDENT_CARE_LABELS,
  ACCIDENT_EVENT_TYPE_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_SHIFT_LABELS,
  ACCIDENT_WORKFLOW_LABELS,
} from '../types/accidentes';

export function exportAccidentesExcel(
  records: WorkplaceAccidentRecord[],
  dateFrom: string,
  dateTo: string
): void {
  const headers = [
    'Fecha',
    'Hora',
    'Afectado',
    'Cargo',
    'Área',
    'Sede',
    'Ubicación',
    'Turno',
    'Tipo evento',
    'Estado flujo',
    'Gravedad',
    'Lesión',
    'Parte cuerpo',
    'Agente',
    'Atención',
    'Días baja',
    'Costo médico',
    'Indemnización',
    'Descripción',
    'Acciones preventivas',
    'Acciones correctivas',
    'Adjuntos',
    'Reportado por',
  ];

  const rows = records.map((r) => [
    r.eventDate,
    r.eventTime,
    r.affectedName,
    r.jobTitle,
    r.workArea,
    r.sede,
    r.exactLocation,
    ACCIDENT_SHIFT_LABELS[r.workShift],
    ACCIDENT_EVENT_TYPE_LABELS[r.eventType ?? 'accidente'],
    ACCIDENT_WORKFLOW_LABELS[r.workflowStatus ?? 'reportado'],
    ACCIDENT_SEVERITY_LABELS[r.severity],
    r.injuryNature,
    r.bodyPart,
    r.causingAgent,
    ACCIDENT_CARE_LABELS[r.immediateCare],
    r.estimatedLostDays,
    r.medicalCost,
    r.indemnizationCost,
    r.description ?? '',
    r.preventiveActions ?? '',
    (r.correctiveActions ?? [])
      .map((a) => `${a.description}${a.status === 'completada' ? ' [OK]' : ''}`)
      .join(' | '),
    (r.attachments ?? []).map((a) => a.name).join(', '),
    r.reportedBy ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Accidentes');
  XLSX.writeFile(wb, `accidentes-sst-${dateFrom}_${dateTo}.xlsx`);
}
