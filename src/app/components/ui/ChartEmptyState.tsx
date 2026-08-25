/**
 * Empty state for charts (avoid bare axes with zero months).
 */
export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 text-center">
      <p className="text-sm font-medium text-foreground/80">{message}</p>
      <p className="text-xs text-muted-foreground">Los gráficos aparecen cuando hay datos registrados.</p>
    </div>
  );
}

export function seriesHasValues(
  rows: Array<Record<string, unknown>>,
  keys: string[]
): boolean {
  return rows.some((row) =>
    keys.some((k) => {
      const v = Number(row[k]);
      return Number.isFinite(v) && v !== 0;
    })
  );
}
