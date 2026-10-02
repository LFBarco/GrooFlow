import { describe, expect, it } from 'vitest';

import {
  applyQrToDraft,
  cashbackNetEffect,
  cashbackRuleWarnings,
  checkCashbackDraft,
  computeCashback,
  defaultCashbackSettings,
  emptyCashbackDraft,
  parseSunatQr,
  shiftPeriod,
  simulateCashback,
} from './cashbackRules';

const settings = { ...defaultCashbackSettings(), companyRucs: ['20601234567'] };

describe('computeCashback', () => {
  it('calcula % del IGV', () => {
    expect(computeCashback({ ...settings, calcMode: 'pct_igv', pctIgv: 50 }, 18, 118)).toBe(9);
  });

  it('calcula % del total con tope en el IGV', () => {
    expect(computeCashback({ ...settings, calcMode: 'pct_total', pctTotal: 20, capAtIgv: true }, 18, 118)).toBe(18);
    expect(computeCashback({ ...settings, calcMode: 'pct_total', pctTotal: 20, capAtIgv: false }, 18, 118)).toBe(23.6);
  });

  it('calcula monto fijo y lo recorta al IGV', () => {
    expect(computeCashback({ ...settings, calcMode: 'flat', flatAmount: 5, capAtIgv: true }, 3.05, 20)).toBe(3.05);
    expect(computeCashback({ ...settings, calcMode: 'flat', flatAmount: 5, capAtIgv: false }, 3.05, 20)).toBe(5);
  });
});

describe('parseSunatQr', () => {
  it('lee el QR estándar de SUNAT', () => {
    const qr = parseSunatQr('20100070970|01|F001|00012345|7.63|50.00|2026-09-28|6|20601234567|abc=|');
    expect(qr).toEqual({
      emisorRuc: '20100070970',
      tipoDoc: '01',
      serie: 'F001',
      numero: '12345',
      igv: 7.63,
      total: 50,
      fechaEmision: '2026-09-28',
      compradorTipoDoc: '6',
      compradorDoc: '20601234567',
    });
  });

  it('acepta fecha dd/mm/yyyy y rechaza texto sin formato', () => {
    expect(parseSunatQr('20100070970|01|F002|77|1.53|10.00|28/09/2026|6|20601234567')?.fechaEmision).toBe('2026-09-28');
    expect(parseSunatQr('hola mundo')).toBeNull();
    expect(parseSunatQr('123|01|F001|1|1|2')).toBeNull();
  });

  it('completa el borrador con base calculada', () => {
    const qr = parseSunatQr('20100070970|01|F001|12|18.00|118.00|2026-09-28|6|20601234567')!;
    const draft = applyQrToDraft(emptyCashbackDraft(settings), qr, 'raw');
    expect(draft.base).toBe('100.00');
    expect(draft.compradorRuc).toBe('20601234567');
    expect(draft.serie).toBe('F001');
  });
});

describe('checkCashbackDraft', () => {
  const now = new Date(2026, 9, 1);
  const valid = {
    ...emptyCashbackDraft(settings),
    emisorRuc: '20100070970',
    serie: 'F001',
    numero: '123',
    fechaEmision: '2026-09-28',
    igv: '18.00',
    total: '118.00',
    categoria: 'alimentacion',
    motivo: 'Almuerzo de guardia',
    declaraSinExcluidos: true,
    photo: 'data:image/jpeg;base64,AAA',
  };

  it('acepta una factura correcta', () => {
    expect(checkCashbackDraft(valid, settings, now)).toEqual({ errors: {}, warnings: [] });
  });

  it('rechaza boletas, RUC de otra empresa y facturas antiguas', () => {
    const r = checkCashbackDraft(
      { ...valid, serie: 'B001', compradorRuc: '20999999999', fechaEmision: '2026-07-01' },
      settings,
      now
    );
    expect(r.errors.serie).toMatch(/boleta/i);
    expect(r.errors.compradorRuc).toBeDefined();
    expect(r.errors.fechaEmision).toMatch(/45 días/);
  });

  it('exige IGV y advierte tasas raras', () => {
    expect(checkCashbackDraft({ ...valid, igv: '0' }, settings, now).errors.igv).toBeDefined();
    expect(checkCashbackDraft({ ...valid, igv: '5.00', total: '118.00' }, settings, now).warnings[0]).toMatch(/18%/);
    expect(checkCashbackDraft({ ...valid, igv: '10.00', total: '110.00' }, settings, now).warnings).toEqual([]);
  });
});

describe('simulateCashback', () => {
  it('muestra cuánto IGV retiene la empresa', () => {
    const r = simulateCashback(
      { ...settings, calcMode: 'pct_igv', pctIgv: 50, releaseThreshold: 50 },
      { colaboradores: 100, facturasPorColaboradorMes: 10, ticketPromedio: 59 }
    );
    expect(r.facturasMes).toBe(1000);
    expect(r.igvMes).toBe(9000);
    expect(r.cashbackMes).toBe(4500);
    expect(r.beneficioNetoMes).toBe(4500);
    expect(r.retencionIgvPct).toBe(50);
    expect(r.mesesParaLiberar).toBe(2);
  });

  it('descuenta EsSalud si se paga como remuneración', () => {
    const r = simulateCashback(
      { ...settings, pctIgv: 50, payoutTreatment: 'remuneracion', essaludRate: 9 },
      { colaboradores: 10, facturasPorColaboradorMes: 10, ticketPromedio: 118 }
    );
    expect(r.cashbackMes).toBe(900);
    expect(r.essaludMes).toBe(81);
    expect(r.beneficioNetoMes).toBe(819);
  });

  it('efecto neto real', () => {
    expect(cashbackNetEffect({ payoutTreatment: 'reembolso', essaludRate: 9 }, 1000, 400)).toEqual({
      essalud: 0,
      neto: 600,
      retencionPct: 60,
    });
  });
});

describe('advertencias y periodos', () => {
  it('avisa cuando el % del total supera el IGV contenido', () => {
    const w = cashbackRuleWarnings({ ...settings, calcMode: 'pct_total', pctTotal: 20 });
    expect(w.some((x) => x.includes('15.25%'))).toBe(true);
  });

  it('desplaza periodos entre años', () => {
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('2026-11', 3)).toBe('2027-02');
  });
});
