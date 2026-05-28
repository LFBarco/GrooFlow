/**
 * Formato numérico corporativo: 1.000,00
 */
export function formatNumberEs(value: number | string, decimals = 2): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatCurrencyEs(value: number | string, decimals = 2): string {
  return `S/ ${formatNumberEs(value, decimals)}`;
}

/** Porcentajes con coma decimal tipo `12,5%` */
export function formatPercentEs(value: number | string, decimals = 1): string {
  return `${formatNumberEs(value, decimals)}%`;
}

/** Etiquetas de eje en miles: `S/ 15k` usando el mismo grupo de miles. */
export function formatAxisThousandsPEN(v: number): string {
  if (!Number.isFinite(v)) return 'S/ 0';
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `S/${formatNumberEs(v / 1000, 0)}k`;
  }
  return formatCurrencyEs(v, 0);
}
