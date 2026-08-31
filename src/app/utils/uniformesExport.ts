import * as XLSX from 'xlsx';

import type { UniformDeliveryRecord } from '../types/uniformes';
import {
  UNIFORM_ITEM_LABELS,
  UNIFORM_REASON_LABELS,
  UNIFORM_STATUS_LABELS,
} from '../types/uniformes';
import { countItemsInRecord } from './uniformesData';

export function exportUniformesExcel(
  records: UniformDeliveryRecord[],
  dateFrom: string,
  dateTo: string
): void {
  const headers = [
    'Fecha',
    'Colaborador',
    'Cargo',
    'Área',
    'Sede',
    'Motivo',
    'Estado',
    'Prendas (detalle)',
    'Cantidad total',
    'Entregado por',
    'Acta firmada',
    'Observaciones',
  ];

  const rows = records.map((r) => {
    const itemsDetail = r.items
      .map((i) => {
        const label = UNIFORM_ITEM_LABELS[i.itemType] ?? i.itemType;
        return `${label} ${i.size}${i.color ? ` (${i.color})` : ''} ×${i.quantity || 1}`;
      })
      .join('; ');

    return [
      r.deliveryDate,
      r.staffName,
      r.jobTitle,
      r.workArea,
      r.sede,
      UNIFORM_REASON_LABELS[r.reason],
      UNIFORM_STATUS_LABELS[r.status],
      itemsDetail,
      countItemsInRecord(r),
      r.deliveredBy ?? '',
      r.signatureActName ?? (r.signatureActDataUrl ? 'Sí' : ''),
      r.notes ?? '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Uniformes');
  XLSX.writeFile(wb, `entregas-uniformes-${dateFrom}_${dateTo}.xlsx`);
}
