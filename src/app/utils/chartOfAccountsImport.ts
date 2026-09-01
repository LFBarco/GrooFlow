import type { ChartOfAccountEntry } from '../types';
import { normalizeAccountCode } from './chartOfAccountsHelpers';

export const STARSOFT_CHART_HEADERS = [
  'CUENTA',
  'DESCRIPCION',
  'NIVEL',
  'TIPO ANEXO',
  'CENTRO DE COSTO',
  'CLASE CUENTA',
  'DESTINO',
  'PARTIDA PRESUPUESTO',
  'AJUSTE DIF. CAMBIO',
  'CUENTA MONETARIA',
  'CONCEPTO ING/GASTO',
  'COD.SIT.FINANCIERA ESTANDAR',
  'COD.SIT.FINANCIERA TRIB.',
  'CUENTA CARGO',
  'CUENTA ABONO',
  'PORCENTAJE',
  'PL FUNCION GROO',
  'PLPL FUNCION GOO',
] as const;

type StarsoftHeader = (typeof STARSOFT_CHART_HEADERS)[number];

const HEADER_ALIASES: Record<StarsoftHeader, readonly string[]> = {
  CUENTA: ['CUENTA', 'CODIGO', 'COD', 'CODE', 'CUENTA CONTABLE'],
  DESCRIPCION: ['DESCRIPCION', 'NOMBRE', 'NAME', 'DESC'],
  NIVEL: ['NIVEL', 'LEVEL'],
  'TIPO ANEXO': ['TIPO ANEXO', 'TIPOANEXO'],
  'CENTRO DE COSTO': ['CENTRO DE COSTO', 'CENTRO COSTO', 'CENTROCOSTO', 'CC'],
  'CLASE CUENTA': ['CLASE CUENTA', 'CLASECUENTA', 'CLASE', 'TIPO'],
  DESTINO: ['DESTINO'],
  'PARTIDA PRESUPUESTO': ['PARTIDA PRESUPUESTO', 'PARTIDA PRESUP', 'PARTIDAPRESUPUESTO'],
  'AJUSTE DIF. CAMBIO': ['AJUSTE DIF. CAMBIO', 'AJUSTE DIF CAMBIO', 'AJUSTEDIFCAMBIO'],
  'CUENTA MONETARIA': ['CUENTA MONETARIA', 'CUENTAMONETARIA'],
  'CONCEPTO ING/GASTO': ['CONCEPTO ING/GASTO', 'CONCEPTO ING GASTO', 'CONCEPTOINGGASTO'],
  'COD.SIT.FINANCIERA ESTANDAR': [
    'COD.SIT.FINANCIERA ESTANDAR',
    'COD SIT FINANCIERA ESTANDAR',
    'CODSITFINANCIERAESTANDAR',
  ],
  'COD.SIT.FINANCIERA TRIB.': [
    'COD.SIT.FINANCIERA TRIB.',
    'COD.SIT.FINANCIERA TRIB',
    'COD SIT FINANCIERA TRIB',
    'CODSITFINANCIERATRIB',
  ],
  'CUENTA CARGO': ['CUENTA CARGO', 'CUENTACARGO'],
  'CUENTA ABONO': ['CUENTA ABONO', 'CUENTAABONO'],
  PORCENTAJE: ['PORCENTAJE', 'PORC', '%'],
  'PL FUNCION GROO': [
    'PL FUNCION GROO',
    'PL FUNCION GROOF',
    'PL FUNCION GROOFLOW',
    'PL.FUNCION GROO',
    'PLFUNCIONGROO',
  ],
  'PLPL FUNCION GOO': [
    'PLPL FUNCION GOO',
    'PLPL FUNCION GROO',
    'PLPL FUNCION GROOF',
    'PL PL FUNCION GROO',
    'PL PL FUNCION GOO',
    'PLPLFUNCIONGOO',
    'PLPLFUNCIONGROO',
  ],
};

export function normalizeHeaderKey(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/** Mapea cabecera canónica Starsoft → clave real en la fila importada. */
export function buildStarsoftHeaderMap(sampleRow: Record<string, unknown>): Map<StarsoftHeader, string> {
  const rowKeys = Object.keys(sampleRow);
  const byNorm = new Map(rowKeys.map((k) => [normalizeHeaderKey(k), k] as const));
  const used = new Set<string>();
  const map = new Map<StarsoftHeader, string>();

  for (const header of STARSOFT_CHART_HEADERS) {
    const aliases = HEADER_ALIASES[header];
    let hit: string | undefined;
    for (const alias of aliases) {
      const raw = byNorm.get(normalizeHeaderKey(alias));
      if (raw && !used.has(raw)) {
        hit = raw;
        break;
      }
    }
    if (!hit) {
      const target = normalizeHeaderKey(header);
      for (const [norm, raw] of byNorm.entries()) {
        if (used.has(raw)) continue;
        if (norm === target || norm.includes(target) || target.includes(norm)) {
          hit = raw;
          break;
        }
      }
    }
    if (hit) {
      map.set(header, hit);
      used.add(hit);
    }
  }

  // Fallback por posición: plantilla Starsoft en orden fijo (18 columnas).
  if (rowKeys.length >= STARSOFT_CHART_HEADERS.length) {
    for (let i = 0; i < STARSOFT_CHART_HEADERS.length; i++) {
      const header = STARSOFT_CHART_HEADERS[i];
      if (map.has(header)) continue;
      const raw = rowKeys[i];
      if (raw && !used.has(raw)) {
        map.set(header, raw);
        used.add(raw);
      }
    }
  }

  return map;
}

export function getImportCell(
  row: Record<string, unknown>,
  headerMap: Map<StarsoftHeader, string>,
  header: StarsoftHeader
): unknown {
  const rawKey = headerMap.get(header);
  if (rawKey) {
    const v = row[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  for (const alias of HEADER_ALIASES[header]) {
    for (const k of [alias, alias.toLowerCase(), alias.toUpperCase()]) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  }
  const target = normalizeHeaderKey(header);
  for (const [rk, v] of Object.entries(row)) {
    if (v === undefined || v === null || String(v).trim() === '') continue;
    const norm = normalizeHeaderKey(rk);
    if (norm === target || norm.includes(target) || target.includes(norm)) return v;
  }
  return undefined;
}

function parseKind(raw: string | undefined): ChartOfAccountEntry['kind'] {
  const t = (raw || '').toLowerCase().trim();
  if (t.includes('igv') || t.includes('igc')) return 'tax_igv';
  if (t.includes('banco') || t.includes('caja') || t.includes('cash')) return 'cash_bank';
  if (t.includes('gasto') || t.includes('expense')) return 'expense';
  return 'other';
}

function cellString(row: Record<string, unknown>, headerMap: Map<StarsoftHeader, string>, header: StarsoftHeader) {
  const v = getImportCell(row, headerMap, header);
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export type ChartImportResult = {
  rows: ChartOfAccountEntry[];
  skipped: number;
};

/** Parsea filas JSON de una hoja Excel (sheet_to_json) al plan de cuentas. */
export function parseChartOfAccountsImportRows(json: Record<string, unknown>[]): ChartImportResult {
  if (!json.length) return { rows: [], skipped: 0 };

  const headerMap = buildStarsoftHeaderMap(json[0]);
  const seen = new Set<string>();
  const rows: ChartOfAccountEntry[] = [];
  let skipped = 0;

  for (let i = 0; i < json.length; i++) {
    const row = json[i];
    const codeRaw = getImportCell(row, headerMap, 'CUENTA');
    const nameRaw = getImportCell(row, headerMap, 'DESCRIPCION');
    const code = String(codeRaw ?? '').trim();
    const name = String(nameRaw ?? '').trim();
    if (!code || !name) {
      skipped++;
      continue;
    }
    const norm = normalizeAccountCode(code) || code.replace(/\s/g, '');
    if (seen.has(norm)) {
      skipped++;
      continue;
    }
    seen.add(norm);

    const nivel = getImportCell(row, headerMap, 'NIVEL');
    const tipo = getImportCell(row, headerMap, 'CLASE CUENTA');

    rows.push({
      id: `coa-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      code: norm,
      name,
      level: typeof nivel === 'number' ? nivel : Number(nivel) || undefined,
      parentCode: undefined,
      tipoAnexo: cellString(row, headerMap, 'TIPO ANEXO'),
      centroCosto: cellString(row, headerMap, 'CENTRO DE COSTO'),
      claseCuenta: cellString(row, headerMap, 'CLASE CUENTA'),
      destino: cellString(row, headerMap, 'DESTINO'),
      partidaPresupuesto: cellString(row, headerMap, 'PARTIDA PRESUPUESTO'),
      ajusteDifCambio: cellString(row, headerMap, 'AJUSTE DIF. CAMBIO'),
      cuentaMonetaria: cellString(row, headerMap, 'CUENTA MONETARIA'),
      conceptoIngGasto: cellString(row, headerMap, 'CONCEPTO ING/GASTO'),
      codSitFinancieraEstandar: cellString(row, headerMap, 'COD.SIT.FINANCIERA ESTANDAR'),
      codSitFinancieraTrib: cellString(row, headerMap, 'COD.SIT.FINANCIERA TRIB.'),
      cuentaCargo: cellString(row, headerMap, 'CUENTA CARGO'),
      cuentaAbono: cellString(row, headerMap, 'CUENTA ABONO'),
      porcentaje: cellString(row, headerMap, 'PORCENTAJE'),
      plFuncionGroo: cellString(row, headerMap, 'PL FUNCION GROO'),
      plplFuncionGoo: cellString(row, headerMap, 'PLPL FUNCION GOO'),
      kind: parseKind(tipo != null ? String(tipo) : undefined),
      active: true,
    });
  }

  return { rows, skipped };
}
