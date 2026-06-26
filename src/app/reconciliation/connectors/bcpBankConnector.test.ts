import { describe, expect, it } from 'vitest';

import { bcpBankConnector } from './bcpBankConnector';

describe('bcpBankConnector', () => {
  it('importa fila con columnas del extracto BCP PETMAX', () => {
    const row: Record<string, unknown> = {
      FECHA: '01/06/2026',
      DESCRIPCION: 'Yape Evelyn Mor',
      MONTO: 460.0,
      OPERACION: '00235493',
      TIPO: 'Yape',
    };

    const result = bcpBankConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'bcp.xlsx',
      creditsOnly: true,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.transactionDate).toBe('2026-06-01');
    expect(result.movements[0]?.amount).toBe(460);
    expect(result.movements[0]?.operationNumber).toBe('0235493');
    expect(result.movements[0]?.operationNumberRaw).toBe('00235493');
    expect(result.movements[0]?.paymentMethod).toBe('yape');
    expect(result.movements[0]?.description).toBe('Yape Evelyn Mor');
  });

  it('normaliza OPERACION de 8 dígitos a 7 para cruce', () => {
    const row: Record<string, unknown> = {
      FECHA: '01/06/2026',
      DESCRIPCION: 'TRAN.CTAS.TERC.BM',
      MONTO: 510,
      OPERACION: '05951775',
      TIPO: 'TRANSFERENCIAS',
    };

    const result = bcpBankConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'bcp.xlsx',
    });

    expect(result.movements[0]?.operationNumber).toBe('5951775');
    expect(result.movements[0]?.paymentMethod).toBe('transfer_interbank');
  });

  it('omite cargos (montos negativos) cuando creditsOnly', () => {
    const row: Record<string, unknown> = {
      FECHA: '01/06/2026',
      DESCRIPCION: 'COMISION',
      MONTO: -15,
      OPERACION: '99999999',
      TIPO: 'CARGO',
    };

    const result = bcpBankConnector.parseRows([row], {
      sessionId: 's1',
      fileName: 'bcp.xlsx',
      creditsOnly: true,
    });

    expect(result.movements).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });
});
