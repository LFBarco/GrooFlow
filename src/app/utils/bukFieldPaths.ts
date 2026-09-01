export type BukFieldInsight = {
  path: string;
  type: string;
  sample: string;
};

function typeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function sampleValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return '{…}';
  return String(value);
}

/** Recorre un registro y devuelve rutas de campos con tipo y muestra. */
export function analyzeBukRecordFields(record: unknown): BukFieldInsight[] {
  const out: BukFieldInsight[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (value === null || value === undefined) {
      out.push({ path: prefix, type: 'null', sample: '—' });
      return;
    }
    if (Array.isArray(value)) {
      out.push({ path: prefix, type: 'array', sample: `[${value.length}]` });
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        walk(value[0], `${prefix}[]`);
      }
      return;
    }
    if (typeof value !== 'object') {
      out.push({ path: prefix, type: typeLabel(value), sample: sampleValue(value) });
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
        walk(child, next);
      } else {
        out.push({ path: next, type: typeLabel(child), sample: sampleValue(child) });
      }
    }
  };
  walk(record, '');
  return out.filter((f) => f.path !== '');
}

/** Une campos de varios registros (útil para ver columnas del endpoint). */
export function analyzeBukRecordsFields(records: unknown[]): BukFieldInsight[] {
  const map = new Map<string, BukFieldInsight>();
  for (const record of records.slice(0, 5)) {
    for (const field of analyzeBukRecordFields(record)) {
      if (!map.has(field.path)) map.set(field.path, field);
    }
  }
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function collectJsonFieldPaths(value: unknown, prefix = '', out = new Set<string>()): string[] {
  if (value === null || value === undefined) return [...out].sort();
  if (Array.isArray(value)) {
    if (value.length > 0) collectJsonFieldPaths(value[0], `${prefix}[]`, out);
    else if (prefix) out.add(prefix);
    return [...out].sort();
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      out.add(next);
      if (child !== null && typeof child === 'object') collectJsonFieldPaths(child, next, out);
    }
    return [...out].sort();
  }
  if (prefix) out.add(prefix);
  return [...out].sort();
}
