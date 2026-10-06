import type { AccountingLinkSettings, ChartOfAccountEntry } from '../types';
import type { CashbackInvoice } from '../types/cashback';
import type { JournalLine, PettyCashJournalBundle } from './accountingJournal';
import { normalizeAccountCode } from './chartOfAccountsHelpers';
import { formatNumberEs } from './numberFormat';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function accountName(chart: ChartOfAccountEntry[], code: string): string | undefined {
  const n = normalizeAccountCode(code);
  return chart.find((x) => x.active && normalizeAccountCode(x.code) === n)?.name;
}

function ymdLocal(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}

/** Facturas que generan asiento: aprobadas o ya liquidadas. */
export function cashbackInvoiceHasJournal(inv: CashbackInvoice): boolean {
  return inv.estado === 'aprobada' || inv.estado === 'liquidada';
}

/**
 * Asiento de la compra al aprobar (mismo formato que Caja Chica):
 * Debe gasto (base, cuenta del proveedor) + Debe IGV crédito fiscal, Haber contrapartida Cashback (total).
 */
export function buildCashbackInvoiceJournal(
  inv: CashbackInvoice,
  chart: ChartOfAccountEntry[],
  links: AccountingLinkSettings | undefined,
  categoryLabel: string
): PettyCashJournalBundle {
  const documentDate = ymdLocal(inv.fechaEmision) ?? new Date();
  const date = ymdLocal(inv.revisadoAt) ?? ymdLocal(inv.createdAt) ?? documentDate;
  const warnings: string[] = [];
  const expenseCode = (inv.cuentaContable || '').trim();
  const igvCode = (links?.igvPurchaseCreditAccountCode || '').trim();
  const creditCode = (links?.cashbackCreditAccountCode || '').trim();
  if (!expenseCode) warnings.push('Factura sin cuenta de gasto: asígnela al revisar o en la ficha del proveedor.');
  if (inv.igv > 0.009 && !igvCode) warnings.push('Falta configurar cuenta IGV (compras) en enlaces contables.');
  if (!creditCode) warnings.push('Falta configurar «Cashback: contrapartida de facturas» en Contabilidad → Plan de cuentas.');

  const memo = `${inv.serie}-${inv.numero} ${(inv.emisorNombre || inv.emisorRuc).slice(0, 40)}`.trim();
  const base = inv.base > 0 ? inv.base : r2(inv.total - inv.igv);
  const lines: JournalLine[] = [];
  if (expenseCode && base > 0.009) {
    lines.push({ accountCode: expenseCode, accountName: accountName(chart, expenseCode), debit: r2(base), credit: 0, memo });
  }
  if (igvCode && inv.igv > 0.009) {
    lines.push({ accountCode: igvCode, accountName: accountName(chart, igvCode), debit: r2(inv.igv), credit: 0, memo: `IGV ${memo}` });
  }
  if (creditCode && inv.total > 0.009) {
    lines.push({ accountCode: creditCode, accountName: accountName(chart, creditCode), debit: 0, credit: r2(inv.total), memo });
  }
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  if (lines.length > 0 && Math.abs(dr - cr) > 0.02) {
    warnings.push(`Asiento descuadrado: debe ${formatNumberEs(dr)} vs haber ${formatNumberEs(cr)} (revisar base/IGV/total).`);
  }

  return {
    transactionId: inv.id,
    custodianId: inv.usuarioId,
    date,
    documentDate,
    yearMonth: inv.fechaEmision.slice(0, 7),
    sede: inv.sede || '—',
    description: `${categoryLabel} — ${inv.emisorNombre || inv.emisorRuc} (Cashback ${inv.usuarioNombre})`,
    receiptType: 'Factura',
    serieNumero: `${inv.serie} - ${inv.numero}`,
    lines: warnings.length > 0 && lines.length < 3 ? [] : lines,
    warnings,
  };
}
