import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
} from 'date-fns';
import type { SmartCashFlowScheduleLine } from '../types';
import type { ConfigStructure } from '../data/initialData';
import { getConceptsFlat } from '../data/initialData';
import type { IsoDate } from './types';
import { listDaysInclusive } from './projectEngine';

/**
 * Genera líneas sugeridas a partir de la estructura de flujo (conceptos con `estimatedAmount` y `defaultDay`).
 * Un ingreso/egreso por concepto y por mes natural dentro del horizonte.
 */
export function suggestScheduleLinesFromConfig(
  config: ConfigStructure,
  horizonStart: IsoDate,
  horizonEnd: IsoDate
): SmartCashFlowScheduleLine[] {
  const days = listDaysInclusive(horizonStart, horizonEnd);
  if (days.length === 0) return [];

  const startM = startOfMonth(parseISO(horizonStart));
  const endM = endOfMonth(parseISO(horizonEnd));
  const months = eachMonthOfInterval({ start: startM, end: endM });

  const lines: SmartCashFlowScheduleLine[] = [];

  for (const monthDate of months) {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth() + 1;
    const dim = getDaysInMonth(monthDate);

    for (const [categoryName, catDef] of Object.entries(config)) {
      const concepts = getConceptsFlat(catDef);
      for (const concept of concepts) {
        const amt = concept.estimatedAmount;
        if (amt == null || !Number.isFinite(amt) || amt <= 0) continue;

        const rawDay = concept.defaultDay ?? 15;
        const dayClamped = Math.min(Math.max(1, rawDay), dim);
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayClamped).padStart(2, '0')}`;

        if (dateStr < horizonStart || dateStr > horizonEnd) continue;

        if (catDef.type === 'income') {
          lines.push({
            id: `scf-sug-inc-${concept.id}-${y}-${String(m).padStart(2, '0')}`,
            kind: 'inflow',
            label: `${categoryName} › ${concept.name}`,
            amount: amt,
            date: dateStr,
            flexibility: 'flexible',
          });
        } else {
          lines.push({
            id: `scf-sug-exp-${concept.id}-${y}-${String(m).padStart(2, '0')}`,
            kind: 'outflow',
            label: `${categoryName} › ${concept.name}`,
            amount: amt,
            date: dateStr,
            flexibility: concept.flexibility,
            priorityRank: concept.flexibility === 'flexible' ? 80 : undefined,
          });
        }
      }
    }
  }

  lines.sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date.localeCompare(b.date)));

  return lines;
}
