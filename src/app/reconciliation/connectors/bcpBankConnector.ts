import {
  getImportCell,
  inferPaymentMethod,
  normalizeOperationNumber,
  parseImportDate,
} from '../domain/normalize';
import type { ConnectorContext, ConnectorParseResult, ReconciliationConnector } from './types';

function parseSignedAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim().replace(/\s/g, '').replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const bcpBankConnector: ReconciliationConnector = {
  sourceType: 'bcp_bank',
  label: 'Estado de cuenta BCP',
  acceptedExtensions: ['.xlsx', '.xls', '.csv'],
  parseRows(rows, context): ConnectorParseResult {
    const movements: ConnectorParseResult['movements'] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const dateRaw = getImportCell(row, 'Fecha', 'fecha operacion', 'fecha operación', 'date');
      const date = parseImportDate(dateRaw);
      const amountSigned = parseSignedAmount(
        getImportCell(row, 'Monto', 'importe', 'cargo/abono', 'abono', 'amount')
      );
      const description = String(
        getImportCell(row, 'Descripción', 'Descripcion', 'detalle', 'concepto', 'description') ?? ''
      ).trim();
      const opRaw = getImportCell(
        row,
        'Nro Operación',
        'Nro Operacion',
        'Número operación',
        'numero operacion',
        'operacion',
        'operation',
        'referencia'
      );

      if (!date && amountSigned === null && !description) {
        skipped += 1;
        return;
      }
      if (!date) {
        errors.push(`Fila ${rowNum}: fecha inválida o vacía.`);
        return;
      }
      if (amountSigned === null) {
        errors.push(`Fila ${rowNum}: monto inválido.`);
        return;
      }

      const creditsOnly = context.creditsOnly !== false;
      if (creditsOnly && amountSigned <= 0) {
        skipped += 1;
        return;
      }

      const amount = Math.abs(amountSigned);
      const { normalized, raw } = normalizeOperationNumber(opRaw);
      const paymentMethod = inferPaymentMethod(`${description} ${raw}`, undefined);

      movements.push({
        sourceType: 'bcp_bank',
        side: 'bank_or_gateway',
        transactionDate: date,
        amount,
        currency: 'PEN',
        operationNumber: normalized,
        operationNumberRaw: raw,
        paymentMethod,
        description: description || undefined,
        metadata: { rowIndex: rowNum, fileName: context.fileName },
      });
    });

    return { movements, errors, skipped };
  },
};
