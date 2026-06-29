import { describe, expect, it } from 'vitest';

import {
  readAllOperationCodes,
  SALES_ERP_HEADERS,
  salesExcelConnector,
} from './salesExcelConnector';

describe('salesExcelConnector', () => {
  it('define las 19 columnas del reporte ERP', () => {
    expect(SALES_ERP_HEADERS).toHaveLength(19);
    expect(SALES_ERP_HEADERS[7]).toBe('Importe con Impuestos');
    expect(SALES_ERP_HEADERS[15]).toBe('Cod. Op. Pago 1');
  });

  it('importa fila con formato real S/ e Importe con Impuestos', () => {
    const row: Record<string, unknown> = {
      Sucursal: 'MA',
      'Fecha de Venta': '01/01/2026',
      Concepto: 'Ingreso',
      Comprobante: 'B006-0008784',
      'Nombre Paciente': 'Max',
      'Importe con Impuestos': 'S/212.00',
      Saldo: 'S/0.00',
      'Fecha de Pago': '01/01/2026',
      'Tipo de Pago': 'Yape',
      'Monto del Pago': 'S/212.00',
      'Usuario de Pago': 'Teresa Uceda',
      'Fecha Registro de Pago': '01/01/2026 3:03 AM',
      'Cod. Op. Pago 1': '02525188',
    };

    const result = salesExcelConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'ventas.xlsx',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.documentNumber).toBe('B006-0008784');
    expect(result.movements[0]?.amount).toBe(212);
    expect(result.movements[0]?.saleAmount).toBe(212);
    expect(result.movements[0]?.operationNumber).toBe('2525188');
    expect(result.movements[0]?.paymentMethod).toBe('yape');
    expect(result.movements[0]?.branch).toBe('MA');
    expect(result.movements[0]?.registeredBy).toBe('Teresa Uceda');
    expect(result.movements[0]?.metadata.concept).toBe('Ingreso');
    expect(result.movements[0]?.metadata.balance).toBe(0);
  });

  it('genera un movimiento por cada Cod. Op. Pago con medio solo en columna 1', () => {
    const row: Record<string, unknown> = {
      Comprobante: 'B006-0008786',
      'Importe con Impuestos': 'S/320.00',
      'Fecha de Pago': '02/01/2026',
      'Tipo de Pago': 'Yape',
      'Monto del Pago': 'S/320.00',
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
    expect(op1?.amount).toBe(320);
    expect(op1?.metadata.erpAmountFromBank).toBe(false);

    expect(op2?.paymentMethod).toBe('unknown');
    expect(op2?.amount).toBe(0);
    expect(op2?.metadata.erpAmountFromBank).toBe(true);
    expect(op2?.operationNumber).toBe('3210123');

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
      'Importe con Impuestos': 'S/80.00',
      Saldo: 'S/80.00',
    };
    const result = salesExcelConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'ventas.xlsx',
    });
    expect(result.movements).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });
});
