import type {
  CashbackInvoiceDraft,
  CashbackInvoiceState,
  CashbackSettings,
} from '../types/cashback';
import type { ParsedSunatQr } from './sunatQr';

export { parseSunatQr, type ParsedSunatQr } from './sunatQr';

export const IGV_RATE = 0.18;
/** IGV contenido en un total con IGV incluido (18/118). */
export const IGV_SHARE_OF_TOTAL = IGV_RATE / (1 + IGV_RATE);

export const CASHBACK_STATE_LABEL: Record<CashbackInvoiceState, string> = {
  en_revision: 'En revisión',
  observada: 'Observada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  liquidada: 'Pagada / liquidada',
};

export const CASHBACK_STATE_TONE: Record<CashbackInvoiceState, string> = {
  en_revision: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  observada: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  aprobada: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  rechazada: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  liquidada: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
};

export function defaultCashbackSettings(): CashbackSettings {
  return {
    companyRucs: [],
    calcMode: 'pct_igv',
    pctIgv: 50,
    pctTotal: 5,
    flatAmount: 3,
    capAtIgv: true,
    releaseThreshold: 50,
    maxDaysOld: 45,
    payoutTreatment: 'reembolso',
    essaludRate: 9,
    categories: [
      { id: 'alimentacion', label: 'Alimentación', enabled: true },
      { id: 'traslados', label: 'Traslados', enabled: true },
      { id: 'oficina', label: 'Artículos de oficina', enabled: true },
      { id: 'mantenimiento', label: 'Equipos de mantenimiento', enabled: true },
      { id: 'limpieza', label: 'Limpieza', enabled: true },
    ],
    excludedNote: 'No se aceptan facturas con bebidas alcohólicas ni bienes de uso personal.',
  };
}

export function emptyCashbackDraft(settings?: CashbackSettings | null): CashbackInvoiceDraft {
  return {
    emisorRuc: '',
    emisorNombre: '',
    emisorEstado: '',
    emisorCondicion: '',
    tipoDoc: '01',
    serie: '',
    numero: '',
    fechaEmision: '',
    base: '',
    igv: '',
    total: '',
    compradorRuc: settings?.companyRucs[0] ?? '',
    categoria: '',
    motivo: '',
    centroCosto: '',
    declaraSinExcluidos: false,
    qrRaw: '',
    photo: '',
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? round2(value) : null;
  const cleaned = value.replace(/S\/|\s/gi, '').replace(/,/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

export function formatPen(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Monto de cashback para una factura según la regla vigente (mismo cálculo que el backend). */
export function computeCashback(
  settings: Pick<CashbackSettings, 'calcMode' | 'pctIgv' | 'pctTotal' | 'flatAmount' | 'capAtIgv'>,
  igv: number,
  total: number
): number {
  let amount: number;
  if (settings.calcMode === 'pct_total') amount = (total * settings.pctTotal) / 100;
  else if (settings.calcMode === 'flat') amount = settings.flatAmount;
  else amount = (igv * settings.pctIgv) / 100;
  if (settings.capAtIgv) amount = Math.min(amount, igv);
  return Math.max(0, round2(amount));
}

export function describeCashbackRule(settings: CashbackSettings): string {
  const cap = settings.capAtIgv ? ' (tope: el IGV de la factura)' : '';
  if (settings.calcMode === 'pct_total') return `${settings.pctTotal}% del total de cada factura${cap}`;
  if (settings.calcMode === 'flat') return `${formatPen(settings.flatAmount)} por factura aprobada${cap}`;
  return `${settings.pctIgv}% del IGV de cada factura${cap}`;
}

/** Advertencias de configuración: reglas que pagan más IGV del que se recupera. */
export function cashbackRuleWarnings(settings: CashbackSettings, avgTicket = 40): string[] {
  const warnings: string[] = [];
  const shareOfTotalPct = IGV_SHARE_OF_TOTAL * 100;
  if (settings.calcMode === 'pct_igv' && settings.pctIgv > 100 && !settings.capAtIgv) {
    warnings.push('Devolver más del 100% del IGV genera pérdida en cada factura.');
  }
  if (settings.calcMode === 'pct_total' && settings.pctTotal > shareOfTotalPct) {
    warnings.push(
      `Un ${settings.pctTotal}% del total supera el IGV contenido (${shareOfTotalPct.toFixed(2)}%): ` +
        (settings.capAtIgv ? 'el tope por IGV recortará el pago.' : 'la empresa pierde dinero por factura.')
    );
  }
  if (settings.calcMode === 'flat') {
    const avgIgv = avgTicket * IGV_SHARE_OF_TOTAL;
    if (settings.flatAmount > avgIgv) {
      warnings.push(
        `El monto fijo (${formatPen(settings.flatAmount)}) supera el IGV de un ticket promedio de ${formatPen(avgTicket)} ` +
          `(${formatPen(avgIgv)}).` +
          (settings.capAtIgv ? ' El tope por IGV limitará el pago en facturas pequeñas.' : '')
      );
    }
  }
  if (settings.companyRucs.length === 0) {
    warnings.push('Configura el RUC de la empresa para validar que las facturas estén a su nombre.');
  }
  return warnings;
}

export function applyQrToDraft(draft: CashbackInvoiceDraft, qr: ParsedSunatQr, raw: string): CashbackInvoiceDraft {
  const total = qr.total ?? parseMoney(draft.total);
  const igv = qr.igv ?? parseMoney(draft.igv);
  const base = total !== null && igv !== null ? round2(total - igv) : null;
  return {
    ...draft,
    emisorRuc: qr.emisorRuc,
    tipoDoc: qr.tipoDoc || '01',
    serie: qr.serie,
    numero: qr.numero,
    igv: igv !== null ? igv.toFixed(2) : draft.igv,
    total: total !== null ? total.toFixed(2) : draft.total,
    base: base !== null ? base.toFixed(2) : draft.base,
    fechaEmision: qr.fechaEmision || draft.fechaEmision,
    compradorRuc: qr.compradorDoc.length === 11 ? qr.compradorDoc : draft.compradorRuc,
    qrRaw: raw.slice(0, 500),
  };
}

export type CashbackDraftCheck = {
  errors: Partial<Record<keyof CashbackInvoiceDraft, string>>;
  warnings: string[];
};

function isoToday(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Validación previa en el navegador (el backend repite estas reglas). */
export function checkCashbackDraft(
  draft: CashbackInvoiceDraft,
  settings: CashbackSettings,
  now: Date = new Date()
): CashbackDraftCheck {
  const errors: CashbackDraftCheck['errors'] = {};
  const warnings: string[] = [];

  const ruc = draft.emisorRuc.replace(/\D/g, '');
  if (ruc.length !== 11 || !['10', '15', '17', '20'].includes(ruc.slice(0, 2))) {
    errors.emisorRuc = 'RUC del emisor inválido (11 dígitos).';
  }

  const serie = draft.serie.trim().toUpperCase();
  if (draft.tipoDoc === '03' || serie.startsWith('B')) {
    errors.serie = 'Es una boleta: no sirve. Pide factura con el RUC de la empresa.';
  } else if (draft.tipoDoc !== '01') {
    errors.serie = 'Solo se aceptan facturas.';
  } else if (!/^(F[A-Z0-9]{3}|E001|\d{4})$/.test(serie)) {
    errors.serie = 'Serie inválida (ej. F001).';
  }

  const numero = draft.numero.replace(/\D/g, '').replace(/^0+/, '');
  if (!numero || numero.length > 8) errors.numero = 'Número inválido.';

  const fecha = draft.fechaEmision;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    errors.fechaEmision = 'Indica la fecha de emisión.';
  } else {
    const today = isoToday(now);
    const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - settings.maxDaysOld);
    if (fecha > today) errors.fechaEmision = 'La fecha no puede ser futura.';
    else if (fecha < isoToday(limit)) {
      errors.fechaEmision = `Supera los ${settings.maxDaysOld} días permitidos.`;
    }
  }

  const total = parseMoney(draft.total);
  const igv = parseMoney(draft.igv);
  if (total === null || total <= 0) errors.total = 'Ingresa el total.';
  if (igv === null || igv <= 0) errors.igv = 'La factura debe tener IGV.';
  if (total !== null && igv !== null && total > 0 && igv > 0) {
    if (igv >= total) errors.igv = 'El IGV no puede ser mayor o igual al total.';
    else {
      const base = parseMoney(draft.base) ?? round2(total - igv);
      const rate = base > 0 ? igv / base : 0;
      const okRate = (rate >= 0.17 && rate <= 0.19) || (rate >= 0.095 && rate <= 0.105);
      if (!okRate) warnings.push(`El IGV no parece 18% de la base (${(rate * 100).toFixed(1)}%). Revisa los montos.`);
    }
  }

  const buyer = draft.compradorRuc.replace(/\D/g, '');
  if (settings.companyRucs.length > 0 && !settings.companyRucs.includes(buyer)) {
    errors.compradorRuc = `La factura debe estar a nombre de la empresa (RUC ${settings.companyRucs.join(' / ')}).`;
  }

  if (!settings.categories.some((c) => c.enabled && c.id === draft.categoria)) {
    errors.categoria = 'Elige una categoría.';
  }
  if (draft.motivo.trim().length < 4) errors.motivo = 'Describe brevemente el consumo.';
  if (!draft.declaraSinExcluidos) errors.declaraSinExcluidos = 'Confirma la declaración.';
  if (!draft.photo) errors.photo = 'Adjunta la foto de la factura.';

  const estado = draft.emisorEstado.trim().toUpperCase();
  const condicion = draft.emisorCondicion.trim().toUpperCase();
  if (estado && estado !== 'ACTIVO') warnings.push(`El emisor figura ${estado} en SUNAT.`);
  if (condicion && condicion !== 'HABIDO') warnings.push(`El emisor figura ${condicion} en SUNAT.`);

  return { errors, warnings };
}

export type CashbackSimulationInput = {
  colaboradores: number;
  facturasPorColaboradorMes: number;
  ticketPromedio: number;
};

export type CashbackSimulationResult = {
  facturasMes: number;
  comprasMes: number;
  igvMes: number;
  cashbackMes: number;
  essaludMes: number;
  beneficioNetoMes: number;
  beneficioNetoAnual: number;
  cashbackPorColaboradorMes: number;
  mesesParaLiberar: number | null;
  /** Qué parte del IGV recuperado se queda la empresa. */
  retencionIgvPct: number;
};

/** Simula el efecto mensual: IGV que recupera la empresa vs. lo que paga en cashback. */
export function simulateCashback(
  settings: CashbackSettings,
  input: CashbackSimulationInput
): CashbackSimulationResult {
  const colaboradores = Math.max(0, input.colaboradores);
  const perUser = Math.max(0, input.facturasPorColaboradorMes);
  const ticket = Math.max(0, input.ticketPromedio);
  const igvPorFactura = round2(ticket * IGV_SHARE_OF_TOTAL);
  const cbPorFactura = computeCashback(settings, igvPorFactura, ticket);
  const facturasMes = colaboradores * perUser;
  const igvMes = round2(igvPorFactura * facturasMes);
  const cashbackMes = round2(cbPorFactura * facturasMes);
  const essaludMes =
    settings.payoutTreatment === 'remuneracion' ? round2((cashbackMes * settings.essaludRate) / 100) : 0;
  const beneficioNetoMes = round2(igvMes - cashbackMes - essaludMes);
  const cashbackPorColaboradorMes = round2(cbPorFactura * perUser);
  return {
    facturasMes,
    comprasMes: round2(ticket * facturasMes),
    igvMes,
    cashbackMes,
    essaludMes,
    beneficioNetoMes,
    beneficioNetoAnual: round2(beneficioNetoMes * 12),
    cashbackPorColaboradorMes,
    mesesParaLiberar:
      cashbackPorColaboradorMes > 0 ? Math.ceil(settings.releaseThreshold / cashbackPorColaboradorMes) : null,
    retencionIgvPct: igvMes > 0 ? round2((beneficioNetoMes / igvMes) * 100) : 0,
  };
}

/** Efecto neto real a partir de montos acumulados (reportes). */
export function cashbackNetEffect(
  settings: Pick<CashbackSettings, 'payoutTreatment' | 'essaludRate'>,
  igv: number,
  cashback: number
): { essalud: number; neto: number; retencionPct: number } {
  const essalud = settings.payoutTreatment === 'remuneracion' ? round2((cashback * settings.essaludRate) / 100) : 0;
  const neto = round2(igv - cashback - essalud);
  return { essalud, neto, retencionPct: igv > 0 ? round2((neto / igv) * 100) : 0 };
}

export function categoryLabel(settings: CashbackSettings, id: string): string {
  return settings.categories.find((c) => c.id === id)?.label ?? id;
}

export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return currentPeriod(d);
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTHS[m - 1]} ${y}`;
}
