/** Normaliza etiquetas para comparación tolerante (acentos, espacios, mayúsculas). */
function normalizeLabel(value: string | undefined | null): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Compara dos etiquetas de categoría/subcategoría/concepto. */
export function labelsMatch(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  if (a == null || b == null) return false;
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  return na === nb;
}

/** Busca la etiqueta canónica en `candidates` que corresponde a `target`. */
export function findMatchingLabel(
  candidates: string[],
  target: string | undefined | null
): string | null {
  if (!target) return null;
  const normTarget = normalizeLabel(target);
  if (!normTarget) return null;

  const exact = candidates.find((c) => normalizeLabel(c) === normTarget);
  if (exact) return exact;

  const partial = candidates.find((c) => {
    const n = normalizeLabel(c);
    return n.includes(normTarget) || normTarget.includes(n);
  });
  return partial ?? null;
}
