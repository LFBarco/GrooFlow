import { describe, expect, it } from 'vitest';

import { readAllOperationCodes, salesExcelConnector } from './salesExcelConnector';

describe('salesExcelConnector', () => {
  it('importa fila con columnas del reporte ERP PETMAX', () => {
    const row: Record<string, unknown> = {
      Sucursal: 'Miraflores',
      'Fecha de Venta': '2026-06-25',
      Comprobante: 'B001-99',
      'Importe con Impuesto': 150,
      'Fecha de Pago': '2026-06-26',
      'Tipo de Pago': 'Mercado Pago',
      'Monto del Pago': 150,
      'Usuario de Pago': 'jperez',
      'Cod. Op. Pago 1': '9876543210123',
    };

    const result = salesExcelConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'ventas.xlsx',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.documentNumber).toBe('B001-99');
    expect(result.movements[0]?.amount).toBe(150);
    expect(result.movements[0]?.operationNumber).toBe('9876543210123');
    expect(result.movements[0]?.paymentMethod).toBe('mercado_pago');
    expect(result.movements[0]?.branch).toBe('Miraflores');
    expect(result.movements[0]?.registeredBy).toBe('jperez');
  });

  it('genera un movimiento por cada Cod. Op. Pago con medio solo en columna 1', () => {
    const row: Record<string, unknown> = {
      Comprobante: 'B001-200',
      'Importe con Impuesto': 200,
      'Fecha de Pago': '2026-06-26',
      'Tipo de Pago': 'Yape',
      'Monto del Pago': 200,
      'Cod. Op. Pago 1': '1111111',
      'Cod. Op. Pago 2': '9876543210123',
      'Cod. Op. Pago 3': '2222222',
    };

    const result = salesExcelConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'ventas.xlsx',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.movements).toHaveLength(3);

    const op1 = result.movements.find((m) => m.metadata.erpOpCodeSlot === 1);
    const op2 = result.movements.find((m) => m.metadata.erpOpCodeSlot === 2);
    const op3 = result.movements.find((m) => m.metadata.erpOpCodeSlot === 3);

    expect(op1?.paymentMethod).toBe('yape');
    expect(op1?.amount).toBe(200);
    expect(op1?.metadata.erpAmountFromBank).toBe(false);

    expect(op2?.paymentMethod).toBe('unknown');
    expect(op2?.amount).toBe(0);
    expect(op2?.metadata.erpAmountFromBank).toBe(true);
    expect(op2?.operationNumber).toBe('9876543210123');

    expect(op3?.paymentMethod).toBe('unknown');
    expect(op3?.operationNumber).toBe('2222222');
    expect(op3?.metadata.erpMultiPaymentRow).toBe(true);
  });

  it('readAllOperationCodes lee columnas numeradas', () => {
    const codes = readAllOperationCodes({
      'Cod. Op. Pago 1': '111',
      'Cod. Op. Pago 2': '222',
    });
    expect(codes).toEqual([
      { slot: 1, raw: '111' },
      { slot: 2, raw: '222' },
    ]);
  });

  it('omite filas sin monto de pago', () => {
    const row: Record<string, unknown> = {
      Comprobante: 'B002-1',
      'Importe con Impuesto': 80,
      Saldo: 80,
    };
    const result = salesExcelConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'ventas.xlsx',
    });
    expect(result.movements).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });
});
