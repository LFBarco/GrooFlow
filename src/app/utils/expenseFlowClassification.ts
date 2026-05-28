import type { ConfigStructure } from '../data/initialData';
import { getSubcategories } from '../data/initialData';

export type FlowClassificationToken = {
  v: 2;
  cat: string;
  subId: string;
  conceptId: string;
};

const PREFIX = 'gf:fc:';

export function encodeFlowClassification(t: FlowClassificationToken): string {
  return `${PREFIX}${JSON.stringify(t)}`;
}

export function tryParseFlowClassification(
  stored: string | undefined | null
): FlowClassificationToken | null {
  if (!stored || !stored.startsWith(PREFIX)) return null;
  try {
    const o = JSON.parse(stored.slice(PREFIX.length)) as FlowClassificationToken;
    if (o?.v === 2 && o.cat && o.subId && o.conceptId) return o;
  } catch {
    /* ignore */
  }
  return null;
}

/** Si el valor guardado es legado (solo nombre de concepto) y hay coincidencia única, devuelve la clave encodes. */
export function migrateLegacyFlowClassification(
  stored: string | undefined | null,
  config: ConfigStructure | undefined
): string | undefined {
  if (!stored?.trim() || !config) return stored ?? undefined;
  const trimmed = stored.trim();
  if (tryParseFlowClassification(trimmed)) return trimmed;

  const matches: FlowClassificationToken[] = [];
  for (const [catName, def] of Object.entries(config)) {
    if (def.type !== 'expense') continue;
    for (const sub of getSubcategories(def, catName)) {
      for (const c of sub.concepts) {
        if ((c.name || '').trim() === trimmed) {
          matches.push({ v: 2, cat: catName, subId: sub.id, conceptId: c.id });
        }
      }
    }
  }
  if (matches.length === 1) return encodeFlowClassification(matches[0]!);
  return stored;
}

export function resolveFlowClassificationLabel(
  stored: string | undefined | null,
  config: ConfigStructure | undefined
): string {
  if (!stored?.trim()) return '';
  const tok = tryParseFlowClassification(stored.trim());
  if (!tok || !config) return stored.trim();
  const def = config[tok.cat];
  if (!def || def.type !== 'expense') return stored.trim();
  const sub = getSubcategories(def, tok.cat).find((s) => s.id === tok.subId);
  const concept = sub?.concepts.find((c) => c.id === tok.conceptId);
  if (!concept) return stored.trim();
  const subLabel = sub?.name ? `${sub.name} › ` : '';
  return `${tok.cat} › ${subLabel}${concept.name}`;
}

/** Texto corto para tablas (concepto + subcategoría si el nombre se repite). */
export function resolveFlowClassificationShortLabel(
  stored: string | undefined | null,
  config: ConfigStructure | undefined
): string {
  if (!stored?.trim()) return '';
  const tok = tryParseFlowClassification(stored.trim());
  if (!tok || !config) return stored.trim();
  const def = config[tok.cat];
  if (!def || def.type !== 'expense') return stored.trim();
  const sub = getSubcategories(def, tok.cat).find((s) => s.id === tok.subId);
  const concept = sub?.concepts.find((c) => c.id === tok.conceptId);
  if (!concept) return stored.trim();
  return sub?.name ? `${sub.name} › ${concept.name}` : concept.name;
}

export function getAllFlowClassificationValidKeys(config: ConfigStructure | undefined): Set<string> {
  const set = new Set<string>();
  if (!config) return set;
  for (const [catName, def] of Object.entries(config)) {
    if (def.type !== 'expense') continue;
    for (const sub of getSubcategories(def, catName)) {
      for (const c of sub.concepts) {
        set.add(encodeFlowClassification({ v: 2, cat: catName, subId: sub.id, conceptId: c.id }));
        const n = (c.name || '').trim();
        if (n) set.add(n);
      }
    }
  }
  return set;
}
