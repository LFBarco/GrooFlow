import { describe, expect, it } from 'vitest';

import { qrToPettyCashFields, splitInvoiceAmounts } from './pettyCashQr';
import { parseSunatQr } from './sunatQr';

const qr = (raw: string) => {
  const parsed = parseSunatQr(raw);
  if (!parsed) throw new Error('QR inválido en test');
  return parsed;
};

describe('splitInvoiceAmounts', () => {
  it('detecta IGV 18 %', () => {
    expect(splitInvoiceAmounts(18, 118)).toEqual({ base: 100, exempt: 0, igv10: false });
  });

  it('detecta IGV 10 % (restaurantes MYPE)', () => {
    expect(splitInvoiceAmounts(10, 110)).toEqual({ base: 100, exempt: 0, igv10: true });
  });

  it('separa la parte inafecta cuando el IGV no cuadra con el total', () => {
    expect(splitInvoiceAmounts(18, 130)).toEqual({ base: 100, exempt: 12, igv10: false });
  });

  it('sin IGV: todo el total va a la base', () => {
    expect(splitInvoiceAmounts(0, 50)).toEqual({ base: 50, exempt: 0, igv10: false });
  });
});

describe('qrToPettyCashFields', () => {
  it('factura: completa RUC, serie, número, fecha y base imponible', () => {
    const f = qrToPettyCashFields(qr('20100070970|01|F001|00012345|18.00|118.00|2026-09-30|6|20999999991|'));
    expect(f).toMatchObject({
      classification: 'Factura',
      docType: 'RUC',
      docNumber: '20100070970',
      docSeries: 'F001',
      voucherNumber: '12345',
      documentDate: '2026-09-30',
      amountBI: '100.00',
      amountExempt: '',
      invoiceIgv10: false,
      compradorDoc: '20999999991',
    });
  });

  it('boleta: el monto es el total', () => {
    const f = qrToPettyCashFields(qr('20100070970|03|B002|778|7.63|50.00|30/09/2026|1|44556677|'));
    expect(f.classification).toBe('Boleta');
    expect(f.amountBI).toBe('50.00');
    expect(f.documentDate).toBe('2026-09-30');
  });

  it('tipo no reconocido: no cambia la clasificación', () => {
    const f = qrToPettyCashFields(qr('20100070970|07|FC01|5|0|20|2026-09-30'));
    expect(f.classification).toBeNull();
  });
});
