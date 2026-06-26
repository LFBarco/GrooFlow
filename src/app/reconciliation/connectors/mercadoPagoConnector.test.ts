import { describe, expect, it } from 'vitest';

import { isMercadoPagoApprovedStatus } from '../domain/normalize';
import { mercadoPagoConnector } from './mercadoPagoConnector';

describe('mercadoPagoConnector', () => {
  it('acepta estado approved y aprobado', () => {
    expect(isMercadoPagoApprovedStatus('approved')).toBe(true);
    expect(isMercadoPagoApprovedStatus('aprobado')).toBe(true);
    expect(isMercadoPagoApprovedStatus('pending')).toBe(false);
  });

  it('importa fila con columnas A, G, H, K del reporte MP', () => {
    const row: Record<string, unknown> = {
      'Fecha de compra (date_created)': '2026-06-26',
      'Fecha de acreditación (date_approved)': '',
      'Fecha de liberación del dinero (date_released)': '',
      'E-mail de la contraparte (counterpart_email)': 'cliente@test.com',
      'Documento de la contraparte (buyer_doc_number)': '',
      'Número de venta en tu negocio online (merchant_order_id)': 'ORD-99',
      'Número de operación de Mercado Pago (operation_id)': '9876543210123',
      'Estado de la operación (status)': 'approved',
      'Detalle del estado de la operación (status_detail)': '',
      'Tipo de operación (operation_type)': 'payment',
      'Valor del producto (transaction_amount)': 150,
    };

    const result = mercadoPagoConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'mp.xlsx',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.amount).toBe(150);
    expect(result.movements[0]?.operationNumber).toBe('9876543210123');
    expect(result.movements[0]?.transactionDate).toBe('2026-06-26');
  });

  it('omite filas no aprobadas', () => {
    const row: Record<string, unknown> = {
      'Fecha de compra (date_created)': '2026-06-26',
      'Número de operación de Mercado Pago (operation_id)': '111',
      'Estado de la operación (status)': 'rejected',
      'Valor del producto (transaction_amount)': 50,
    };
    const result = mercadoPagoConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'mp.xlsx',
    });
    expect(result.movements).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });
});
