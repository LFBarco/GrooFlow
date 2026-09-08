import { VET_WORK_AREAS } from '../types/accidentes';

/** Clave comparable: sin acentos, minúsculas, espacios colapsados. */
export function normalizeWorkAreaKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[_/|-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Alias frecuentes Buk / Gestión → etiqueta canónica. */
const WORK_AREA_ALIASES: Record<string, string> = {
  administracion: 'Administración',
  administrativa: 'Administración',
  admin: 'Administración',
  medica: 'Área Médica',
  'area medica': 'Área Médica',
  veterinary: 'Área Médica',
  veterinaria: 'Área Médica',
  counter: 'Recepción / Counter',
  counters: 'Recepción / Counter',
  recepcion: 'Recepción / Counter',
  'recepcion counter': 'Recepción / Counter',
  grooming: 'Grooming / Peluquería',
  peluqueria: 'Grooming / Peluquería',
  'grooming peluqueria': 'Grooming / Peluquería',
  operaciones: 'Operaciones',
  gerencia: 'Gerencia',
  gerentes: 'Gerencia',
  'gerente de tienda': 'Gerencia',
  'gerente tienda': 'Gerencia',
  marketing: 'Marketing',
  logistica: 'Logística',
  mantenimiento: 'Mantenimiento',
  limpieza: 'Limpieza',
  flota: 'Flota / Choferes',
  chofer: 'Flota / Choferes',
  choferes: 'Flota / Choferes',
  'flota choferes': 'Flota / Choferes',
  farmacia: 'Farmacia',
  laboratorio: 'Laboratorio',
  bodega: 'Bodega / Almacén',
  almacen: 'Bodega / Almacén',
  'bodega almacen': 'Bodega / Almacén',
  'sin area': 'Sin área',
  otro: 'Otro',
};

function titleCaseWords(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Una sola etiqueta legible por área (colapsa Médica/MEDICA/Medica, etc.). */
export function canonicalizeWorkArea(raw?: string | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'Sin área';
  const key = normalizeWorkAreaKey(trimmed);
  if (WORK_AREA_ALIASES[key]) return WORK_AREA_ALIASES[key];
  for (const canon of VET_WORK_AREAS) {
    if (normalizeWorkAreaKey(canon) === key) return canon;
  }
  return titleCaseWords(trimmed);
}

/** Opciones de select/filtro sin duplicados por casing/acentos/alias. */
export function uniqueWorkAreas(areas: Iterable<string | null | undefined>): string[] {
  const byKey = new Map<string, string>();
  for (const raw of areas) {
    const canon = canonicalizeWorkArea(raw);
    const key = normalizeWorkAreaKey(canon);
    if (!byKey.has(key)) byKey.set(key, canon);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

export function workAreasMatch(a?: string | null, b?: string | null): boolean {
  return normalizeWorkAreaKey(canonicalizeWorkArea(a)) === normalizeWorkAreaKey(canonicalizeWorkArea(b));
}
