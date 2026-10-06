import type { ColaboradorBuk, Telefono, TelefonoDraft, TelefonoImportRow, TelefonoTipo } from '../types/telefonos';

export const TELEFONO_TIPO_LABEL: Record<TelefonoTipo, string> = {
  persona: 'Persona',
  bot: 'Bot / sistema',
  especial: 'Caso especial',
  sin_asignar: 'Sin asignar',
};

/** Solo dígitos; quita el 51 de los móviles peruanos con código de país. */
export function normalizePhone(raw: string | number | null | undefined): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
  return d;
}

export function formatPhone(numero: string): string {
  return /^9\d{8}$/.test(numero) ? `${numero.slice(0, 3)} ${numero.slice(3, 6)} ${numero.slice(6)}` : numero;
}

export function emptyTelefonoDraft(): TelefonoDraft {
  return {
    numero: '',
    tipo: 'sin_asignar',
    bukId: null,
    etiqueta: '',
    responsable: '',
    operador: '',
    plan: '',
    costoMensual: '',
    equipo: '',
    imei: '',
    iccid: '',
    estado: 'activo',
    notas: '',
  };
}

export function draftFromTelefono(t: Telefono): TelefonoDraft {
  return {
    numero: t.numero,
    tipo: t.tipo,
    bukId: t.bukId,
    etiqueta: t.etiqueta ?? '',
    responsable: t.responsable ?? '',
    operador: t.operador ?? '',
    plan: t.plan ?? '',
    costoMensual: t.costoMensual != null ? t.costoMensual.toFixed(2) : '',
    equipo: t.equipo ?? '',
    imei: t.imei ?? '',
    iccid: t.iccid ?? '',
    estado: t.estado,
    notas: t.notas ?? '',
  };
}

/** Nombre visible de la línea: colaborador, etiqueta del bot/caso especial o «Sin asignar». */
export function telefonoTitular(t: Telefono): string {
  if (t.tipo === 'persona') return t.colaborador?.nombreCompleto ?? 'Colaborador no encontrado';
  return t.etiqueta || TELEFONO_TIPO_LABEL[t.tipo];
}

export type TelefonosStats = {
  total: number;
  porTipo: Record<TelefonoTipo, number>;
  costoMensual: number;
  cesados: number;
};

export function computeTelefonosStats(items: Telefono[]): TelefonosStats {
  const porTipo: Record<TelefonoTipo, number> = { persona: 0, bot: 0, especial: 0, sin_asignar: 0 };
  let costo = 0;
  let cesados = 0;
  for (const t of items) {
    if (t.estado === 'baja') continue;
    porTipo[t.tipo]++;
    costo += t.costoMensual ?? 0;
    if (t.tipo === 'persona' && t.colaborador && !t.colaborador.activo) cesados++;
  }
  const total = porTipo.persona + porTipo.bot + porTipo.especial + porTipo.sin_asignar;
  return { total, porTipo, costoMensual: Math.round(costo * 100) / 100, cesados };
}

/** Colaborador cuyo teléfono en Buk coincide con el número (sugerencia para líneas sin asignar). */
export function suggestColaborador(numero: string, colaboradores: ColaboradorBuk[]): ColaboradorBuk | null {
  if (numero.length < 7) return null;
  return colaboradores.find((c) => c.telefono === numero) ?? null;
}

const FIELD_HINTS: Array<[keyof TelefonoImportRow, string[]]> = [
  ['imei', ['imei']],
  ['iccid', ['iccid', 'simcard', 'sim card', 'chip', 'sim']],
  ['numero', ['numero', 'telefono', 'celular', 'linea', 'movil', 'msisdn', 'nro', 'servicio', 'anexo']],
  ['operador', ['operador', 'compania', 'empresa', 'proveedor', 'carrier']],
  ['plan', ['plan', 'tarifa', 'paquete']],
  ['costoMensual', ['cargo fijo', 'costo', 'renta', 'importe', 'monto', 'precio', 'mensual', 'total']],
  ['equipo', ['equipo', 'modelo', 'marca', 'terminal', 'dispositivo']],
  ['nombre', ['usuario', 'nombre', 'titular', 'asignado', 'responsable', 'colaborador']],
];

const key = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export type ImportMapping = Partial<Record<keyof TelefonoImportRow, number>>;

/** Asocia cada campo con la columna del Excel cuyo encabezado lo menciona (cada columna se usa una vez). */
export function detectImportColumns(headers: unknown[]): ImportMapping {
  const norm = headers.map(key);
  const used = new Set<number>();
  const mapping: ImportMapping = {};
  for (const [field, hints] of FIELD_HINTS) {
    const idx = norm.findIndex((h, i) => !used.has(i) && h !== '' && hints.some((hint) => h.includes(hint)));
    if (idx >= 0) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

/**
 * Busca en las primeras filas la que parece encabezado: columna de número y al menos otra conocida
 * (un título como «Reporte de líneas» también menciona «línea»).
 */
export function findHeaderRow(matrix: unknown[][]): number {
  let fallback = -1;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const m = detectImportColumns(matrix[i] ?? []);
    if (m.numero === undefined) continue;
    if (Object.keys(m).length >= 2) return i;
    if (fallback < 0) fallback = i;
  }
  return Math.max(fallback, 0);
}

export function rowsFromMatrix(matrix: unknown[][], headerRow: number, mapping: ImportMapping): TelefonoImportRow[] {
  const out: TelefonoImportRow[] = [];
  const col = mapping.numero;
  if (col === undefined) return out;
  for (const row of matrix.slice(headerRow + 1)) {
    const numero = normalizePhone(row?.[col] as string);
    if (numero.length < 3) continue;
    const r: TelefonoImportRow = { numero };
    for (const [field, idx] of Object.entries(mapping) as Array<[keyof TelefonoImportRow, number]>) {
      if (field === 'numero') continue;
      const v = String(row?.[idx] ?? '').trim();
      if (v) r[field] = v;
    }
    out.push(r);
  }
  return out;
}
