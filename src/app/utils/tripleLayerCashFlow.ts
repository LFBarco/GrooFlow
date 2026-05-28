import { format, isSameDay, startOfDay } from 'date-fns';
import type { Transaction } from '../types';
import type { InvoiceDraft } from '../types';
import type { Invoice, PaymentStatus } from '../components/treasury/types';
import type { ConfigStructure, CategoryDefinition } from '../data/initialData';
import { getSubcategories } from '../data/initialData';
import { findMatchingLabel } from './labelMatch';
import { parseTransactionDate } from './transactionDate';

export type SourceLayer = 'REAL' | 'PROJ' | 'EST';

export type RowKind = 'income' | 'expense';

export interface ResolvedCashCell {
  amount: number;
  dominantLayer: SourceLayer | 'NONE';
  breakdown: Partial<Record<SourceLayer, number>>;
  locked: boolean;
}

export type LayerVisibility = Record<SourceLayer, boolean>;

const EPS = 1e-6;

function isValidCategoryDefinition(value: unknown): value is CategoryDefinition {
  return !!value && typeof value === 'object' && 'type' in (value as Record<string, unknown>);
}

export function coerceTreasuryDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(value as number);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Convierte KV/JSON suelto a `Invoice` usable. */
export function normalizeTreasuryInvoice(raw: Record<string, unknown>): Invoice {
  const status = String(raw.status || 'pending') as PaymentStatus;
  return {
    id: String(raw.id || Math.random()),
    providerName: String(raw.providerName || ''),
    providerRuc: String(raw.providerRuc || ''),
    amount: Number(raw.amount) || 0,
    currency: (raw.currency as Invoice['currency']) || 'PEN',
    issueDate: coerceTreasuryDate(raw.issueDate),
    dueDate: coerceTreasuryDate(raw.dueDate),
    tentativePaymentDate: coerceTreasuryDate(raw.tentativePaymentDate ?? raw.dueDate),
    category: String(raw.category || 'Proveedores'),
    status,
    branchId: String(raw.branchId || 'Principal'),
    description: String(raw.description || ''),
    documentType: (raw.documentType as Invoice['documentType']) || 'Factura',
    documentNumber: String(raw.documentNumber || ''),
    fileUrl: raw.fileUrl as string | undefined,
  };
}

function mapTreasuryCategoryToConfig(treasuryCat: string, config: ConfigStructure): string {
  const keys = Object.keys(config).filter((k) => isValidCategoryDefinition(config[k]));
  const norm = (treasuryCat || '').trim().toLowerCase();
  if (!norm) return keys.find((k) => config[k]?.type === 'expense') || keys[0] || '';
  const exact = keys.find((k) => k.toLowerCase() === norm);
  if (exact) return exact;
  const partial = keys.find((k) => norm.includes(k.toLowerCase()) || k.toLowerCase().includes(norm));
  if (partial) return partial;
  const exp = keys.find((k) => config[k]?.type === 'expense');
  return exp || keys[0] || '';
}

function findExpenseConceptBucket(
  categoryKey: string,
  invoice: Invoice,
  config: ConfigStructure
): { subcategory: string; concept: string } {
  const def = config[categoryKey];
  if (!isValidCategoryDefinition(def) || def.type !== 'expense')
    return { subcategory: 'General', concept: 'General' };
  const subs = getSubcategories(def, categoryKey);
  const pn = invoice.providerName.toLowerCase().trim();
  const desc = invoice.description.toLowerCase().trim();
  for (const sub of subs) {
    for (const c of sub.concepts) {
      const cn = c.name.toLowerCase();
      if (pn && (pn.includes(cn) || cn.includes(pn.slice(0, Math.min(pn.length, 6)))))
        return { subcategory: sub.name, concept: c.name };
      if (desc && desc.includes(cn)) return { subcategory: sub.name, concept: c.name };
    }
  }
  const firstSub = subs[0];
  const firstConcept = firstSub?.concepts[0];
  return {
    subcategory: firstSub?.name || 'General',
    concept: firstConcept?.name || 'General',
  };
}

function treasuryIsReal(status: PaymentStatus): boolean {
  return status === 'paid' || status === 'reconciled';
}

function treasuryIsProjected(status: PaymentStatus): boolean {
  return status === 'pending' || status === 'scheduled' || status === 'in_transit';
}

function paymentDate(invoice: Invoice): Date {
  const t = coerceTreasuryDate(invoice.tentativePaymentDate);
  if (!Number.isNaN(t.getTime())) return startOfDay(t);
  return startOfDay(coerceTreasuryDate(invoice.dueDate));
}

export function cellStorageKey(
  category: string,
  subcategoryName: string,
  conceptName: string,
  date: Date
): string {
  const safeDate = startOfDay(date);
  const dayKey = Number.isNaN(safeDate.getTime())
    ? 'invalid-date'
    : format(safeDate, 'yyyy-MM-dd');
  return `${category}|${subcategoryName}|${conceptName}|${dayKey}`;
}

export function resolveWithVisibility(
  breakdown: Partial<Record<SourceLayer, number>>,
  visibility: LayerVisibility
): { amount: number; dominantLayer: SourceLayer | 'NONE' } {
  const order: SourceLayer[] = ['REAL', 'PROJ', 'EST'];
  for (const layer of order) {
    if (!visibility[layer]) continue;
    const v = breakdown[layer] ?? 0;
    if (Math.abs(v) > EPS) return { amount: v, dominantLayer: layer };
  }
  return { amount: 0, dominantLayer: 'NONE' };
}

export function finalizeCell(
  breakdown: Partial<Record<SourceLayer, number>>,
  visibility: LayerVisibility,
  columnDate: Date,
  TODAY: Date
): ResolvedCashCell {
  const { amount, dominantLayer } = resolveWithVisibility(breakdown, visibility);
  const sod = startOfDay(TODAY);
  const sodCol = startOfDay(columnDate);
  /** Pasado solo lectura; bloqueamos también celdas con capa REAL (tesorería pagada/conciliada). */
  const pastCol = sodCol < sod;
  const hasRealCash = Math.abs(breakdown.REAL ?? 0) > EPS;
  const locked = pastCol || hasRealCash;

  return {
    amount,
    dominantLayer,
    breakdown: { ...breakdown },
    locked,
  };
}

type Matrix = Map<string, Partial<Record<SourceLayer, number>>>;

function addToMatrix(
  matrix: Matrix,
  key: string,
  layer: SourceLayer,
  amount: number,
  cumulative: RowKind,
  txType?: RowKind
): void {
  if (Math.abs(amount) < EPS) return;
  const cur = matrix.get(key) ?? {};
  const prev = cur[layer] ?? 0;

  /** Ingresos suman positivo en filas income; egresos almacenan magnitud positiva en filas expense. */
  let delta = cumulative === 'expense' ? Math.abs(amount) : Math.abs(amount);
  if (cumulative === 'income') {
    if (txType === 'expense') return;
    cur[layer] = prev + delta;
  } else {
    /** expense row */
    if (txType === 'income') return;
    cur[layer] = prev + delta;
  }
  matrix.set(key, cur);
}

export function iterConceptRows(
  config: ConfigStructure
): { category: string; subcategory: string; kind: RowKind; conceptName: string }[] {
  const rows: { category: string; subcategory: string; kind: RowKind; conceptName: string }[] = [];
  for (const [cat, def] of Object.entries(config)) {
    if (!isValidCategoryDefinition(def)) continue;
    const subs = getSubcategories(def, cat);
    for (const sub of subs) {
      for (const c of sub.concepts) {
        rows.push({
          category: cat,
          subcategory: sub.name,
          kind: def.type === 'income' ? 'income' : 'expense',
          conceptName: c.name,
        });
      }
    }
  }
  return rows;
}

export function buildTripleLayerDailyMatrix(opts: {
  config: ConfigStructure;
  transactions: Transaction[];
  treasuryInvoices: Invoice[];
  monthAnchor: Date;
  TODAY: Date;
  /** Monto EST opcional desde IA / presupuesto: clave cellsStorageKey sin category prefix split */
  aiEstimates?: Map<string, number>;
  /** defaultDay mensual aplicado cuando no hay datos superiores aún visibles */
  applyDefaultDayEstimates?: boolean;
}): Map<string, Partial<Record<SourceLayer, number>>> {
  const { config, transactions, treasuryInvoices, monthAnchor, TODAY } = opts;
  const matrix: Matrix = new Map();

  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sodToday = startOfDay(TODAY);

  /** Treasury */
  for (const inv of treasuryInvoices) {
    const amt = Number(inv.amount) || 0;
    if (amt <= 0) continue;
    const cat = mapTreasuryCategoryToConfig(inv.category, config);
    const bucket = findExpenseConceptBucket(cat, inv, config);
    const pd = paymentDate(inv);
    if (pd.getFullYear() !== year || pd.getMonth() !== month) continue;

    const key = cellStorageKey(cat, bucket.subcategory, bucket.concept, pd);
    const layer: SourceLayer = treasuryIsReal(inv.status)
      ? 'REAL'
      : treasuryIsProjected(inv.status)
        ? 'PROJ'
        : 'PROJ';
    if (!treasuryIsReal(inv.status) && !treasuryIsProjected(inv.status)) continue;
    addToMatrix(matrix, key, layer, amt, 'expense', 'expense');
  }

  /** Transacciones: pasado estrictamente antes de hoy → REAL; desde hoy en adelante → PROJ */
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, month, d);
    const sod = startOfDay(dayDate);

    if (Number.isNaN(sod.getTime())) continue;

    for (const t of transactions) {
      if (!isSameDay(sod, startOfDay(parseTransactionDate(t.date)))) continue;
      const category = findMatchingLabel(Object.keys(config), t.category) ?? String(t.category);
      const def = config[category];
      if (!isValidCategoryDefinition(def)) continue;
      const kind: RowKind = def.type === 'income' ? 'income' : 'expense';
      if (kind === 'income' && t.type !== 'income') continue;
      if (kind === 'expense' && t.type !== 'expense') continue;

      const subs = getSubcategories(def, category);
      const conceptName = String(t.concept || '');
      const subFromTx = (t.subcategory || '').trim();
      let subcategory = '';
      let effectiveConcept = conceptName || subFromTx;
      if (conceptName) {
        const found = subs.find((s) => s.concepts.some((c) => findMatchingLabel([c.name], conceptName)));
        subcategory = found?.name || subs[0]?.name || 'General';
        const conceptMatch = found
          ? findMatchingLabel(found.concepts.map((c) => c.name), conceptName)
          : undefined;
        effectiveConcept = conceptMatch || conceptName;
      } else if (subFromTx && findMatchingLabel(subs.map((s) => s.name), subFromTx)) {
        subcategory = findMatchingLabel(subs.map((s) => s.name), subFromTx) || subFromTx;
      } else {
        subcategory = subs[0]?.name || 'General';
      }
      if (!effectiveConcept) continue;

      const layer: SourceLayer = sod < sodToday ? 'REAL' : 'PROJ';

      const key = cellStorageKey(category, subcategory, effectiveConcept, dayDate);
      addToMatrix(matrix, key, layer, Number(t.amount) || 0, kind, t.type);
    }
  }

  /** EST: estimatedAmount + defaultDay en conceptos */
  if (opts.applyDefaultDayEstimates !== false) {
    for (const [cat, def] of Object.entries(config)) {
      if (!isValidCategoryDefinition(def)) continue;
      const subs = getSubcategories(def, cat);
      for (const sub of subs) {
        for (const con of sub.concepts) {
          if (con.estimatedAmount == null || con.defaultDay == null) continue;
          const day = Math.min(con.defaultDay, daysInMonth);
          const dayDate = new Date(year, month, day);
          const key = cellStorageKey(cat, sub.name, con.name, dayDate);
          const cur = matrix.get(key) ?? {};
          const est = cur.EST ?? 0;
          cur.EST = est + con.estimatedAmount;
          matrix.set(key, cur);
        }
      }
    }
  }

  /** Sobrescribir / sumar EST desde mapa IA (ingresos) */
  if (opts.aiEstimates?.size) {
    for (const [compoundKey, val] of opts.aiEstimates) {
      const parts = compoundKey.split('|');
      if (parts.length >= 4) {
        const day = parts[3]!;
        const monthKey = format(new Date(year, month, 1), 'yyyy-MM');
        if (!day.startsWith(monthKey)) continue;
        const cur = matrix.get(compoundKey) ?? {};
        cur.EST = (cur.EST ?? 0) + val;
        matrix.set(compoundKey, cur);
        continue;
      }
      if (parts.length < 2) continue;
      const category = parts[0]!;
      const conceptName = parts[1]!;
      /** Repartimos el sugerido mensual en modo simple: cargar cada defaultDay si existe concepto, si no día 15 */
      const def = config[category];
      if (!isValidCategoryDefinition(def) || def.type !== 'income') continue;
      const subs = getSubcategories(def, category);
      let subName = subs[0]?.name || 'General';
      const pair = subs.flatMap((s) => s.concepts.map((c) => ({ s, c }))).find((x) => x.c.name === conceptName);
      let con = pair?.c;
      if (pair) subName = pair.s.name;
      const targetDay =
        con?.defaultDay && con.defaultDay >= 1 && con.defaultDay <= daysInMonth ? con.defaultDay : 15;
      const dayDate = new Date(year, month, targetDay);
      const key = cellStorageKey(category, subName, conceptName, dayDate);
      const cur = matrix.get(key) ?? {};
      const est = cur.EST ?? 0;
      /** monthlyAmount aplicado como carga puntual ese día del mes visado */
      cur.EST = est + val;
      matrix.set(key, cur);
    }
  }

  return matrix;
}

export function resolvedCell(
  matrix: Map<string, Partial<Record<SourceLayer, number>>>,
  visibility: LayerVisibility,
  category: string,
  subcategoryName: string,
  conceptName: string,
  date: Date,
  TODAY: Date
): ResolvedCashCell {
  const key = cellStorageKey(category, subcategoryName, conceptName, date);
  const breakdown = matrix.get(key) ?? {};
  return finalizeCell(breakdown, visibility, date, TODAY);
}

export function sumIncomeExpenseForDay(
  matrix: Map<string, Partial<Record<SourceLayer, number>>>,
  visibility: LayerVisibility,
  config: ConfigStructure,
  date: Date,
  TODAY: Date
): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  const rows = iterConceptRows(config);
  for (const r of rows) {
    const cell = resolvedCell(matrix, visibility, r.category, r.subcategory, r.conceptName, date, TODAY);
    if (cell.amount <= EPS && cell.dominantLayer === 'NONE') continue;
    if (r.kind === 'income') income += cell.amount;
    else expense += cell.amount;
  }
  return { income, expense };
}

export function projectedDraftInvoicesExpense(
  invoices: InvoiceDraft[],
  date: Date,
  monthAnchor: Date
): number {
  if (
    invoices.length === 0 ||
    date.getFullYear() !== monthAnchor.getFullYear() ||
    date.getMonth() !== monthAnchor.getMonth()
  )
    return 0;
  return invoices
    .filter((inv) => inv.status !== 'paid')
    .filter((inv) => {
      const dd = parseDraftDate(inv.dueDate);
      return dd && isSameDay(startOfDay(dd), startOfDay(date));
    })
    .reduce((s, inv) => s + Number(inv.total) || 0, 0);
}

function parseDraftDate(raw: string): Date | null {
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function projectedDraftInvoicesTotal(invoices: InvoiceDraft[], monthAnchor: Date): number {
  return invoices
    .filter((inv) => inv.status !== 'paid')
    .filter((inv) => {
      const dd = parseDraftDate(inv.dueDate);
      if (!dd) return false;
      return dd.getFullYear() === monthAnchor.getFullYear() && dd.getMonth() === monthAnchor.getMonth();
    })
    .reduce((s, inv) => s + Number(inv.total) || 0, 0);
}
