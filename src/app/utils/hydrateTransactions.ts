import type { Transaction } from '../types';

/**
 * Normaliza transacciones cargadas desde KV / JSON (fechas como string, campos opcionales).
 * Mantiene compatibilidad: si no existe `concept`, el flujo usa `subcategory` como fila.
 */
export function hydrateTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item): Transaction => {
    const t = item as Record<string, unknown>;
    const dateVal = t.date;
    const date =
      dateVal instanceof Date
        ? dateVal
        : typeof dateVal === 'string' || typeof dateVal === 'number'
          ? new Date(dateVal)
          : new Date();

    return {
      id: String(t.id ?? ''),
      amount: Number(t.amount) || 0,
      type: t.type === 'income' || t.type === 'expense' ? t.type : 'expense',
      category: String(t.category ?? ''),
      subcategory: t.subcategory != null ? String(t.subcategory) : undefined,
      concept: t.concept != null ? String(t.concept) : undefined,
      description: String(t.description ?? ''),
      date: isNaN(date.getTime()) ? new Date() : date,
      providerId: t.providerId != null ? String(t.providerId) : undefined,
      location: t.location != null ? String(t.location) : undefined,
    };
  });
}
