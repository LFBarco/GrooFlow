import { format } from 'date-fns';
import type {
  AccountingLinkSettings,
  ChartOfAccountEntry,
  PettyCashTransaction,
  Provider,
} from '../types';
import { normalizeAccountCode } from './chartOfAccountsHelpers';
import { receiptTypeUsesIgv } from './pettyCashReceiptType';

export interface JournalLine {
  accountCode: string;
  accountName?: string;
  debit: number;
  credit: number;
  memo: string;
}

function docSerieNumeroLabel(tx: PettyCashTransaction): string {
  const s = (tx.docSeries || '').trim();
  const n = (tx.voucherNumber || tx.receiptNumber || '').trim();
  if (s && n) return `${s} - ${n}`;
  if (n) return n;
  if (s) return s;
  return '—';
}

function receiptTypeLabel(tx: PettyCashTransaction): string {
  return (tx.receiptType || '').trim() || '—';
}

/** Interpreta `yyyy-MM-dd` del input type=date en medianoche / fin del día **local** (evita desfases UTC). */
function parseLocalYmd(ymd: string, endOfDay: boolean): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd || '').trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return endOfDay ? new Date(y, mo, d, 23, 59, 59, 999) : new Date(y, mo, d, 0, 0, 0, 0);
}

/**
 * Incluye egreso si la fecha de registro o la del documento cae en el rango (histórico vs comprobante).
 * `previewFromIso` / `previewToIso` en formato `yyyy-MM-dd` (inputs de fecha del navegador).
 */
export function pettyCashExpenseInPreviewDateRange(
  t: PettyCashTransaction,
  previewFromIso: string,
  previewToIso: string
): boolean {
  if (t.type !== 'expense' || t.status === 'voided' || t.status === 'rejected') return false;
  const from = parseLocalYmd(previewFromIso, false);
  const to = parseLocalYmd(previewToIso, true);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;

  const inRange = (d: Date) => !Number.isNaN(d.getTime()) && d >= from && d <= to;

  if (inRange(new Date(t.date))) return true;
  if (t.documentDate != null) {
    const doc = new Date(t.documentDate as Date | string);
    if (inRange(doc)) return true;
  }
  return false;
}

export interface PettyCashJournalBundle {
  transactionId: string;
  /** Responsable del fondo (caja chica) en el sistema. */
  custodianId?: string;
  /** Fecha de registro en sistema */
  date: Date;
  /** Fecha del documento (comprobante) */
  documentDate: Date;
  /** ej. 2025-02 */
  yearMonth: string;
  sede: string;
  /** Descripción del gasto (cabecera del movimiento) */
  description: string;
  /** Boleta, Factura, Planilla de Movilidad, etc. */
  receiptType: string;
  /** Ej. F001 - 00055342 */
  serieNumero: string;
  lines: JournalLine[];
  warnings: string[];
}

function nameFor(
  chart: ChartOfAccountEntry[],
  code: string | undefined
): string | undefined {
  if (!code) return undefined;
  const n = normalizeAccountCode(code);
  const e = chart.find((x) => normalizeAccountCode(x.code) === n && x.active);
  return e?.name;
}

/** Localiza proveedor por RUC (docNumber en caja chica). */
export function findProviderByDocNumber(
  providers: Provider[],
  docNumber: string | undefined
): Provider | undefined {
  const n = normalizeAccountCode(docNumber);
  if (n.length < 8) return undefined;
  return providers.find((p) => normalizeAccountCode(p.ruc) === n);
}

/**
 * Asiento sugerido caja chica:
 * - Factura: Debe BI + Debe IGV + Haber caja (total)
 * - Otros tipos: Debe gasto (importe total) + Haber caja (sin línea IGV)
 */
export function buildPettyCashExpenseJournal(
  tx: PettyCashTransaction,
  providers: Provider[],
  chart: ChartOfAccountEntry[],
  links: AccountingLinkSettings | undefined
): PettyCashJournalBundle {
  const registrationDate = new Date(tx.date);
  const docRaw = tx.documentDate != null ? new Date(tx.documentDate as Date | string) : registrationDate;
  const documentDate = !Number.isNaN(docRaw.getTime()) ? docRaw : registrationDate;
  const yearMonth = format(documentDate, 'yyyy-MM');
  const headDesc = (tx.description || '').trim() || tx.id;
  const sede = (tx.location || 'Principal').trim();
  const tipoDoc = receiptTypeLabel(tx);
  const serieNro = docSerieNumeroLabel(tx);

  const warnings: string[] = [];
  if (tx.type !== 'expense' || tx.status === 'voided' || tx.status === 'rejected') {
    warnings.push('Movimiento no es un egreso válido para asiento.');
    return {
      transactionId: tx.id,
      custodianId: tx.custodianId,
      date: registrationDate,
      documentDate,
      yearMonth,
      sede,
      description: headDesc,
      receiptType: tipoDoc,
      serieNumero: serieNro,
      lines: [],
      warnings,
    };
  }

  const splitIgv =
    receiptTypeUsesIgv(tx.receiptType) ||
    (typeof tx.igv === 'number' && !Number.isNaN(tx.igv) && tx.igv > 0.009);

  const provider = findProviderByDocNumber(providers, tx.docNumber);
  const fromTx = (tx.accountingAccount || '').trim();
  const fromProvider = (provider?.accountingAccount || '').trim();
  const cat = (tx.category || '').trim();
  const fromPettyLine =
    provider?.pettyExpenseLines?.find(
      (l) => (l.commercialCategory || '').trim() === cat && (l.defaultAccountingAccount || '').trim()
    )?.defaultAccountingAccount;
  let fromPetty = (fromPettyLine || '').trim();
  /** Un solo motivo con cuenta en el proveedor: útil para histórico sin `accountingAccount` en el movimiento. */
  if (!fromPetty && provider?.pettyExpenseLines?.length) {
    const linesWithAcc = provider.pettyExpenseLines.filter(
      (l) => (l.defaultAccountingAccount || '').trim().length > 0
    );
    if (linesWithAcc.length === 1) {
      fromPetty = (linesWithAcc[0].defaultAccountingAccount || '').trim();
    }
  }
  const unknownFallback = (links?.pettyCashUnknownExpenseAccountCode || '').trim();
  const expenseCode = fromTx || fromProvider || fromPetty || unknownFallback;
  if (!fromTx && !fromProvider && !fromPetty && unknownFallback) {
    warnings.push(
      'Usada cuenta de gasto genérica (enlaces contables). Revise proveedor/motivo caja chica para asignar cuenta específica.'
    );
  } else if (!expenseCode) {
    warnings.push(
      'Sin cuenta de gasto: configure «Gasto caja chica sin cuenta» en enlaces, o motivo/cuenta en proveedor/comprobante.'
    );
  }

  const total = tx.amount;
  const amountBI = splitIgv
    ? typeof tx.amountBI === 'number' && !Number.isNaN(tx.amountBI)
      ? tx.amountBI
      : total / 1.18
    : total;
  const igv = splitIgv
    ? typeof tx.igv === 'number' && !Number.isNaN(tx.igv)
      ? tx.igv
      : Math.max(0, total - amountBI)
    : 0;

  const igvCode = (links?.igvPurchaseCreditAccountCode || '').trim();
  const txSede = (tx.location || 'Principal').trim();
  const bySede = links?.pettyCashCreditBySede?.[txSede];
  const cajaCode = (bySede || links?.pettyCashCreditAccountCode || '').trim();

  if (splitIgv && igv > 0.009 && !igvCode) {
    warnings.push('Falta configurar cuenta IGV (compras) en enlaces contables.');
  }
  if (!cajaCode) {
    warnings.push(`Falta configurar cuenta de salida de caja chica (haber) para sede ${txSede}.`);
  }

  const lines: JournalLine[] = [];
  const memoBase = `${tx.docSeries || ''}-${tx.voucherNumber || ''} ${(tx.providerName || '').slice(0, 40)}`.trim();

  const expenseDebit = splitIgv ? amountBI : total;
  if (expenseCode && expenseDebit > 0.009) {
    lines.push({
      accountCode: expenseCode,
      accountName: nameFor(chart, expenseCode),
      debit: Math.round(expenseDebit * 100) / 100,
      credit: 0,
      memo: memoBase || tx.description?.slice(0, 80) || tx.id,
    });
  }

  if (splitIgv && igv > 0.009 && igvCode) {
    lines.push({
      accountCode: igvCode,
      accountName: nameFor(chart, igvCode),
      debit: Math.round(igv * 100) / 100,
      credit: 0,
      memo: `IGV ${memoBase}`,
    });
  }

  if (cajaCode && total > 0.009) {
    lines.push({
      accountCode: cajaCode,
      accountName: nameFor(chart, cajaCode),
      debit: 0,
      credit: Math.round(total * 100) / 100,
      memo: memoBase || 'Salida caja chica',
    });
  }

  const sumDr = lines.reduce((s, l) => s + l.debit, 0);
  const sumCr = lines.reduce((s, l) => s + l.credit, 0);
  if (lines.length > 0 && Math.abs(sumDr - sumCr) > 0.02) {
    warnings.push(
      `Asiento descuadrado: debe ${sumDr.toFixed(2)} vs haber ${sumCr.toFixed(2)} (revisar BI/IGV/total).`
    );
  }

  return {
    transactionId: tx.id,
    custodianId: tx.custodianId,
    date: registrationDate,
    documentDate,
    yearMonth,
    sede,
    description: headDesc,
    receiptType: tipoDoc,
    serieNumero: serieNro,
    lines,
    warnings,
  };
}

export type JournalExportRow = {
  'Cuenta Contable': string;
  'Nombre Cuenta Contable': string;
  'Año y Mes': string;
  'Fecha Documento': string;
  'Fecha de Registro': string;
  'Tipo de documento': string;
  'Serie - Número de documento': string;
  Descripción: string;
  Sede: string;
  Debe: number;
  Haber: number;
};

function fmtDay(d: Date): string {
  return format(d, 'dd/MM/yyyy');
}

/** Filas listas para Excel / Starsoft: columnas acordadas. */
export function flattenJournalsToExportRows(
  bundles: PettyCashJournalBundle[]
): JournalExportRow[] {
  const rows: JournalExportRow[] = [];

  for (const b of bundles) {
    for (const ln of b.lines) {
      rows.push({
        'Cuenta Contable': ln.accountCode,
        'Nombre Cuenta Contable': ln.accountName || '',
        'Año y Mes': b.yearMonth,
        'Fecha Documento': fmtDay(b.documentDate),
        'Fecha de Registro': fmtDay(b.date),
        'Tipo de documento': b.receiptType,
        'Serie - Número de documento': b.serieNumero,
        Descripción: b.description,
        Sede: b.sede,
        Debe: Math.round(ln.debit * 100) / 100,
        Haber: Math.round(ln.credit * 100) / 100,
      });
    }
  }
  return rows;
}
