import * as XLSX from 'xlsx';

import type {
  CashbackInvoice,
  CashbackLiquidation,
  CashbackReport,
  CashbackSettings,
} from '../types/cashback';
import { CASHBACK_STATE_LABEL, cashbackNetEffect, categoryLabel } from './cashbackRules';

function download(wb: XLSX.WorkBook, name: string): void {
  XLSX.writeFile(wb, name, { compression: true });
}

function sheet(headers: string[], rows: Array<Array<string | number | null>>, widths?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h, i) => ({ wch: widths?.[i] ?? Math.max(12, h.length + 2) }));
  return ws;
}

/** Detalle de facturas: sirve como base para el registro de compras del contador. */
export function exportCashbackInvoicesExcel(
  invoices: CashbackInvoice[],
  settings: CashbackSettings,
  fileLabel: string
): void {
  const headers = [
    'Periodo', 'Fecha emisión', 'Tipo', 'Serie', 'Número', 'RUC emisor', 'Razón social emisor',
    'RUC adquirente', 'Base imponible', 'IGV', 'Total', 'Categoría', 'Motivo', 'Colaborador',
    'Documento', 'Sede', 'Centro de costo', 'Estado', 'Cashback', 'Revisado por', 'Nota revisión',
    'Liquidación', 'Alertas',
  ];
  const rows = invoices.map((i) => [
    i.periodo, i.fechaEmision, i.tipoDoc, i.serie, i.numero, i.emisorRuc, i.emisorNombre ?? '',
    i.compradorRuc ?? '', i.base, i.igv, i.total, categoryLabel(settings, i.categoria), i.motivo, i.usuarioNombre,
    i.colaboradorDoc ?? '', i.sede ?? '', i.centroCosto ?? '', CASHBACK_STATE_LABEL[i.estado],
    i.cashbackMonto ?? '', i.revisorNombre ?? '', i.notaRevision ?? '', i.liquidacionId ?? '', i.alertas.join(' · '),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheet(headers, rows, [9, 12, 6, 7, 10, 13, 32, 13, 12, 10, 11, 20, 32, 28, 12, 16, 14, 14, 10, 22, 30, 11, 40]),
    'Facturas'
  );
  download(wb, `cashback_facturas_${fileLabel}.xlsx`);
}

export function exportCashbackLiquidationExcel(liq: CashbackLiquidation): void {
  const lines = liq.lineas ?? [];
  const headers = ['Colaborador', 'Documento', 'Sede', 'Facturas', 'Total compras', 'IGV sustentado', 'Monto a pagar'];
  const withEssalud = liq.tratamiento === 'remuneracion';
  if (withEssalud) headers.push('EsSalud (costo empresa)');
  const rows = lines.map((l) => {
    const row: Array<string | number> = [
      l.usuarioNombre, l.colaboradorDoc ?? '', l.sede ?? '', l.facturas, l.total, l.igv, l.monto,
    ];
    if (withEssalud) row.push(l.essalud);
    return row;
  });
  const totals: Array<string | number> = [
    'TOTAL', '', '', liq.facturas,
    lines.reduce((s, l) => s + l.total, 0), liq.igvTotal, liq.montoTotal,
  ];
  if (withEssalud) totals.push(liq.essaludTotal);
  rows.push(totals);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(headers, rows, [32, 12, 18, 9, 13, 13, 13, 16]), 'Liquidación');
  const info = sheet(['Campo', 'Valor'], [
    ['Liquidación', liq.id],
    ['Periodo', liq.periodo],
    ['Tratamiento', liq.tratamiento === 'remuneracion' ? 'Remuneración (planilla)' : 'Reembolso'],
    ['Estado', liq.estado === 'pagada' ? 'Pagada' : 'Generada'],
    ['Generada por', liq.creadoPorNombre ?? ''],
    ['Fecha', liq.createdAt],
    ['Nota', liq.nota ?? ''],
  ], [18, 40]);
  XLSX.utils.book_append_sheet(wb, info, 'Datos');
  download(wb, `cashback_liquidacion_${liq.id}_${liq.periodo}.xlsx`);
}

export function exportCashbackReportExcel(report: CashbackReport, rangeLabel: string): void {
  const s = report.settings;
  const wb = XLSX.utils.book_new();
  const monthly = report.monthly.map((m) => {
    const eff = cashbackNetEffect(s, m.igv, m.cashback);
    return [m.periodo, m.colaboradores ?? 0, m.facturas, m.total, m.igv, m.cashback, eff.essalud, eff.neto, eff.retencionPct];
  });
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ['Periodo', 'Colaboradores', 'Facturas', 'Compras', 'IGV recuperado', 'Cashback', 'EsSalud', 'Beneficio neto', '% IGV retenido'],
      monthly
    ),
    'Mensual'
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ['Categoría', 'Facturas', 'Compras', 'IGV', 'Cashback'],
      report.byCategoria.map((c) => [categoryLabel(s, c.categoria), c.facturas, c.total, c.igv, c.cashback])
    ),
    'Por categoría'
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ['Sede', 'Colaboradores', 'Facturas', 'Compras', 'IGV', 'Cashback'],
      report.bySede.map((c) => [c.sede, c.colaboradores ?? 0, c.facturas, c.total, c.igv, c.cashback])
    ),
    'Por sede'
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ['RUC', 'Emisor', 'Facturas', 'Compras', 'IGV'],
      report.topEmisores.map((e) => [e.ruc, e.nombre ?? '', e.facturas, e.total, e.igv])
    ),
    'Top emisores'
  );
  download(wb, `cashback_reporte_${rangeLabel}.xlsx`);
}
