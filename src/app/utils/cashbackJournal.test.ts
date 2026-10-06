import { describe, expect, it } from 'vitest';

import type { CashbackInvoice } from '../types/cashback';
import { buildCashbackInvoiceJournal, cashbackInvoiceHasJournal } from './cashbackJournal';

const inv = (patch: Partial<CashbackInvoice> = {}): CashbackInvoice => ({
  id: '7',
  usuarioId: '3',
  usuarioNombre: 'Ana Pérez',
  colaboradorBukId: 1,
  colaboradorDoc: '44556677',
  sede: 'San Isidro',
  emisorRuc: '20100070970',
  emisorNombre: 'Restaurante SAC',
  emisorEstado: 'ACTIVO',
  emisorCondicion: 'HABIDO',
  tipoDoc: '01',
  serie: 'F001',
  numero: '123',
  fechaEmision: '2026-09-30',
  periodo: '2026-09',
  base: 100,
  igv: 18,
  total: 118,
  compradorRuc: '20999999991',
  categoria: 'alimentacion',
  motivo: 'Almuerzo de turno',
  centroCosto: null,
  cuentaContable: '6311101',
  alertas: [],
  estado: 'aprobada',
  cashbackMonto: 9,
  revisorNombre: 'Conta',
  revisadoAt: '2026-10-01 10:00:00',
  notaRevision: null,
  liquidacionId: null,
  hasPhoto: true,
  createdAt: '2026-09-30 20:00:00',
  updatedAt: '2026-10-01 10:00:00',
  ...patch,
});

const links = { igvPurchaseCreditAccountCode: '4011101', cashbackCreditAccountCode: '4699001' };

describe('buildCashbackInvoiceJournal', () => {
  it('genera Debe gasto + Debe IGV y Haber contrapartida por el total', () => {
    const b = buildCashbackInvoiceJournal(inv(), [], links, 'Alimentación');
    expect(b.warnings).toEqual([]);
    expect(b.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([
      ['6311101', 100, 0],
      ['4011101', 18, 0],
      ['4699001', 0, 118],
    ]);
    expect(b.serieNumero).toBe('F001 - 123');
    expect(b.yearMonth).toBe('2026-09');
  });

  it('sin cuenta de gasto no exporta líneas y avisa', () => {
    const b = buildCashbackInvoiceJournal(inv({ cuentaContable: null }), [], links, 'Alimentación');
    expect(b.lines).toEqual([]);
    expect(b.warnings[0]).toMatch(/sin cuenta de gasto/i);
  });

  it('sin contrapartida configurada no exporta líneas', () => {
    const b = buildCashbackInvoiceJournal(inv(), [], { igvPurchaseCreditAccountCode: '4011101' }, 'Alimentación');
    expect(b.lines).toEqual([]);
  });

  it('solo aprobadas y liquidadas generan asiento', () => {
    expect(cashbackInvoiceHasJournal(inv())).toBe(true);
    expect(cashbackInvoiceHasJournal(inv({ estado: 'liquidada' }))).toBe(true);
    expect(cashbackInvoiceHasJournal(inv({ estado: 'en_revision' }))).toBe(false);
  });
});
