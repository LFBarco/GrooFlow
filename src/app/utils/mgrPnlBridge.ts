import { mgrPnlApi } from './mgrPnlApi';
import type { ChartOfAccountEntry } from '../types';

export type IngestExpenseInput = {
  fecha: string | Date;
  monto: number;
  concepto: string;
  cuenta_codigo?: string;
  accountingAccount?: string;
  sede_nombre?: string;
  location?: string;
  origen_tipo: 'manual' | 'caja' | 'transaccion' | 'factura' | 'personal';
  origen_id?: string;
  colaborador_id?: string;
  auto_distribute?: boolean;
  notas?: string;
  created_by?: string;
};

function toIsoDate(v: string | Date): string {
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1]!;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }
  return v.toISOString().slice(0, 10);
}

/** Fire-and-forget: no rompe el flujo operativo si el backend falla. */
export async function ingestExpenseQuiet(
  input: IngestExpenseInput
): Promise<{ ok: boolean; distributed?: boolean; error?: string }> {
  try {
    const res = await mgrPnlApi.ingestExpense({
      ...input,
      fecha: toIsoDate(input.fecha),
      auto_distribute: input.auto_distribute !== false,
    });
    return { ok: true, distributed: Boolean(res.distributed) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Tras importar el plan: propone y aplica mappings de confianza media/alta. */
export async function syncMappingsFromChart(
  chart: ChartOfAccountEntry[],
  opts?: { apply?: boolean; overwrite?: boolean }
): Promise<{ applied: number; usable: number; proposed: number; skipped_existing: number }> {
  const res = await mgrPnlApi.autoMapFromChart(chart, {
    apply: opts?.apply !== false,
    overwrite: Boolean(opts?.overwrite),
    min_confianza: 'media',
  });
  return {
    applied: res.applied,
    usable: res.usable,
    proposed: res.proposed,
    skipped_existing: res.skipped_existing,
  };
}
