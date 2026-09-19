import type { BukPeEmployeeRow } from '../types/rrhh';
import { fetchRrhhEmployeesPage } from './rrhhApi';

export type BukPeOrgLookupEntry = {
  roleFamilyName?: string;
  orgAreaParentName?: string;
  orgAreaName?: string;
  cargo?: string;
};

function rutKey(raw?: string | null): string {
  const n = (raw ?? '').replace(/[.\-\s]/g, '').toUpperCase();
  if (!n) return '';
  if (/^\d{7,8}$/.test(n)) return n;
  if (/^\d{7,8}[0-9K]$/.test(n)) return n.slice(0, -1);
  return n;
}

/** Construye mapa DNI → jerarquía Buk.pe (familia → padre → org). */
export function buildBukPeOrgLookup(employees: BukPeEmployeeRow[]): Map<string, BukPeOrgLookupEntry> {
  const map = new Map<string, BukPeOrgLookupEntry>();
  for (const emp of employees) {
    const key =
      rutKey(emp.documentKey) ||
      rutKey(emp.documentNumber) ||
      '';
    if (!key) continue;
    const roleFamilyName = (emp.roleFamilyName || emp.area || '').trim() || undefined;
    const orgAreaParentName = (emp.orgAreaParentName || '').trim() || undefined;
    const orgAreaName = (emp.orgAreaName || '').trim() || undefined;
    const cargo = (emp.cargo || '').trim() || undefined;
    if (!roleFamilyName && !orgAreaParentName && !orgAreaName && !cargo) continue;
    map.set(key, { roleFamilyName, orgAreaParentName, orgAreaName, cargo });
  }
  return map;
}

/**
 * Carga colaboradores activos desde RRHH (páginas) para enriquecer el Dashboard Buk.
 * Falla en silencio → mapa vacío (el dashboard sigue con datos Ctrlit).
 */
export async function fetchBukPeOrgLookupByRut(options?: {
  maxPages?: number;
  pageSize?: number;
}): Promise<Map<string, BukPeOrgLookupEntry>> {
  const pageSize = Math.min(100, Math.max(25, options?.pageSize ?? 100));
  const maxPages = Math.min(30, Math.max(1, options?.maxPages ?? 20));
  const all: BukPeEmployeeRow[] = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const chunk = await fetchRrhhEmployeesPage({
        page,
        pageSize,
        tab: 'activos',
        orderBy: 'full_name',
        orderDir: 'ASC',
      });
      all.push(...chunk.items);
      const totalPages = Math.max(1, Math.ceil((chunk.filtered || chunk.total || 0) / pageSize));
      if (page >= totalPages || chunk.items.length < pageSize) break;
    }
  } catch {
    return new Map();
  }
  return buildBukPeOrgLookup(all);
}

export function lookupBukPeOrgByRut(
  map: Map<string, BukPeOrgLookupEntry> | undefined,
  rut?: string | null
): BukPeOrgLookupEntry | undefined {
  if (!map?.size) return undefined;
  const key = rutKey(rut);
  if (!key) return undefined;
  return map.get(key);
}
