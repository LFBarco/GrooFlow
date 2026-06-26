import {
  getImportCell,
  inferPaymentMethod,
  normalizeOperationNumber,
  parseImportAmount,
  parseImportDate,
} from '../domain/normalize';
import type { ConnectorParseResult, ReconciliationConnector } from './types';

export const niubizConnector: ReconciliationConnector = {
  sourceType: 'niubiz',
  label: 'PagoLink Niubiz',
  acceptedExtensions: ['.xlsx', '.xls', '.csv'],
  parseRows(rows, context): ConnectorParseResult {
    const movements: ConnectorParseResult['movements'] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const date = parseImportDate(
        getImportCell(row, 'Fecha', 'fecha transaccion', 'fecha transacción', 'fecha pago', 'date')
      );
      const amount = parseImportAmount(
        getImportCell(row, 'Monto', 'importe', 'monto venta', 'amount', 'total')
      );
      const opRaw = getImportCell(
        row,
        'Nro Operación',
        'Nro Operacion',
        'codigo operacion',
        'código operación',
        'id transaccion',
        'id transacción',
        'referencia',
        'operation'
      );
      const description = String(
        getImportCell(row, 'Descripción', 'Descripcion', 'comercio', 'detalle') ?? ''
      ).trim();

      if (!date && amount === null) {
        skipped += 1;
        return;
      }
      if (!date) {
        errors.push(`Fila ${rowNum}: fecha inválida.`);
        return;
      }
      if (amount === null || amount <= 0) {
        errors.push(`Fila ${rowNum}: monto inválido.`);
        return;
      }

      const { normalized, raw } = normalizeOperationNumber(opRaw);
      movements.push({
        sourceType: 'niubiz',
        side: 'bank_or_gateway',
        transactionDate: date,
        amount,
        currency: 'PEN',
        operationNumber: normalized,
        operationNumberRaw: raw,
        paymentMethod: 'niubiz',
        description: description || undefined,
        metadata: { rowIndex: rowNum, fileName: context.fileName },
      });
    });

    return { movements, errors, skipped };
  },
};
