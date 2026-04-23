import type { ChartOfAccountEntry } from '../types';

/** Cuentas “analíticas” u operativas: en Starsoft/PCGE suelen usarse de este nivel. */
export const CHART_OPERATIVE_LEVEL = 5;

/** Nivel numérico de la fila del plan (columna NIVEL). */
export function chartEntryLevel(e: ChartOfAccountEntry | undefined | null): number | undefined {
  if (e == null || e.level == null) return undefined;
  const n = Number(e.level);
  return Number.isFinite(n) ? n : undefined;
}

export function isChartOperativeAccount(e: ChartOfAccountEntry, level: number = CHART_OPERATIVE_LEVEL): boolean {
  return chartEntryLevel(e) === level;
}

/** Normaliza código para comparar (solo dígitos; quita espacios/guiones). */
export function normalizeAccountCode(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/\D/g, '');
}

export function findChartEntryByCode(
  chart: ChartOfAccountEntry[],
  codeRaw: string | undefined | null
): ChartOfAccountEntry | undefined {
  const n = normalizeAccountCode(codeRaw);
  if (!n) return undefined;
  return chart.find((e) => normalizeAccountCode(e.code) === n && e.active);
}

export type ChartSelectOptions = { value: string; label: string };

/**
 * Opciones para desplegables (IGV, caja, proveedor, etc.).
 * Por defecto solo cuentas del nivel operativo (p. ej. 5) según el plan importado.
 */
export function chartCodesForSelect(
  chart: ChartOfAccountEntry[],
  opts?: { useLevel?: number }
): ChartSelectOptions[] {
  const wantLevel = opts?.useLevel;
  return chart
    .filter((e) => {
      if (!e.active) return false;
      if (wantLevel != null) return isChartOperativeAccount(e, wantLevel);
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((e) => ({
      value: e.code,
      label: `${e.code} — ${e.name}`,
    }));
}

/**
 * Lista para desplegables + conserva un código ya guardado aunque no sea nivel 5
 * (muestra advertencia en la etiqueta).
 */
export function chartSelectOptionsWithOrphan(
  chart: ChartOfAccountEntry[],
  savedCode: string | undefined | null,
  opts?: { useLevel?: number }
): ChartSelectOptions[] {
  const base = chartCodesForSelect(chart, opts);
  const raw = (savedCode || '').trim();
  if (!raw) return base;
  if (base.some((o) => normalizeAccountCode(o.value) === normalizeAccountCode(raw))) {
    return base;
  }
  const entry = findChartEntryByCode(chart, raw);
  const want = opts?.useLevel;
  const lvl = entry ? chartEntryLevel(entry) : undefined;
  const code = entry?.code?.trim() || raw;
  const warn =
    !entry
      ? ' (no está en el plan importado)'
      : want != null && lvl !== want
        ? ` (nivel ${lvl ?? '—'}; enlaces usan NIVEL ${want})`
        : '';
  const label = entry ? `${code} — ${entry.name}${warn}` : `${raw}${warn}`;
  return [{ value: code, label }, ...base];
}

/** Clases de gasto habituales en PCGE (6): solo cuentas cuyo código empieza por 63, 64 o 65. */
const DEFAULT_EXPENSE_CLASS_PREFIXES = ['63', '64', '65'] as const;

export function chartAccountStartsWithExpenseClasses(
  code: string | undefined | null,
  classPrefixes: readonly string[] = DEFAULT_EXPENSE_CLASS_PREFIXES
): boolean {
  const n = normalizeAccountCode(code);
  if (n.length < 2) return false;
  return classPrefixes.some((p) => n.startsWith(p));
}

/** Opciones de cuentas de gasto (63/64/65) para proveedores y similares. */
export function chartCodesForSelectExpenseClasses(
  chart: ChartOfAccountEntry[],
  opts?: { useLevel?: number; classPrefixes?: readonly string[] }
): ChartSelectOptions[] {
  const wantLevel = opts?.useLevel ?? CHART_OPERATIVE_LEVEL;
  const prefixes = opts?.classPrefixes ?? DEFAULT_EXPENSE_CLASS_PREFIXES;
  return chart
    .filter((e) => {
      if (!e.active) return false;
      if (!isChartOperativeAccount(e, wantLevel)) return false;
      return chartAccountStartsWithExpenseClasses(e.code, prefixes);
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((e) => ({
      value: e.code,
      label: `${e.code} — ${e.name}`,
    }));
}

export function chartSelectOptionsWithOrphanExpenseClasses(
  chart: ChartOfAccountEntry[],
  savedCode: string | undefined | null,
  opts?: { useLevel?: number; classPrefixes?: readonly string[] }
): ChartSelectOptions[] {
  const base = chartCodesForSelectExpenseClasses(chart, opts);
  const raw = (savedCode || '').trim();
  if (!raw) return base;
  if (base.some((o) => normalizeAccountCode(o.value) === normalizeAccountCode(raw))) {
    return base;
  }
  const entry = findChartEntryByCode(chart, raw);
  const want = opts?.useLevel ?? CHART_OPERATIVE_LEVEL;
  const prefixes = opts?.classPrefixes ?? DEFAULT_EXPENSE_CLASS_PREFIXES;
  const lvl = entry ? chartEntryLevel(entry) : undefined;
  const inTargetClass = entry ? chartAccountStartsWithExpenseClasses(entry.code, prefixes) : false;
  const code = entry?.code?.trim() || raw;
  const warn = !entry
    ? ' (no está en el plan importado)'
    : !inTargetClass
      ? ' (clase 63/64/65 requerida para proveedores)'
      : want != null && lvl !== want
        ? ` (nivel ${lvl ?? '—'}; enlaces usan NIVEL ${want})`
        : '';
  const label = entry ? `${code} — ${entry.name}${warn}` : `${raw}${warn}`;
  return [{ value: code, label }, ...base];
}
