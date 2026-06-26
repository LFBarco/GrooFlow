import {
  getImportCell,
  normalizeOperationNumber,
  parseImportAmount,
  parseImportDate,
} from '../domain/normalize';
import type { ConnectorParseResult, ReconciliationConnector } from './types';

export const mercadoPagoConnector: ReconciliationConnector = {
  sourceType: 'mercado_pago',
  label: 'Mercado Pago',
  acceptedExtensions: ['.xlsx', '.xls', '.csv'],
  parseRows(rows, context): ConnectorParseResult {
    const movements: ConnectorParseResult['movements'] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const date = parseImportDate(
        getImportCell(row, 'Fecha', 'fecha de pago', 'date', 'fecha acreditacion', 'fecha acreditación')
      );
      const amount = parseImportAmount(
        getImportCell(row, 'Monto', 'importe', 'monto neto', 'monto bruto', 'amount')
      );
      const opRaw = getImportCell(
        row,
        'Nro Operación',
        'Nro Operacion',
        'ID operación',
        'id operacion',
        'numero operacion',
        'operation id',
        'referencia externa',
        'external reference'
      );
      const description = String(
        getImportCell(row, 'Descripción', 'Descripcion', 'detalle', 'concepto') ?? ''
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
        sourceType: 'mercado_pago',
        side: 'bank_or_gateway',
        transactionDate: date,
        amount,
        currency: 'PEN',
        operationNumber: normalized,
        operationNumberRaw: raw,
        paymentMethod: 'mercado_pago',
        description: description || undefined,
        metadata: { rowIndex: rowNum, fileName: context.fileName },
      });
    });

    return { movements, errors, skipped };
  },
};
