import {
  getImportCell,
  getImportCellByIndex,
  inferPaymentMethod,
  normalizeOperationNumber,
  parseImportAmount,
  parseImportDate,
} from '../domain/normalize';
import type { ConnectorParseResult, ReconciliationConnector } from './types';
import { downloadWorkbook } from './spreadsheetUtils';

export const BCP_TEMPLATE_FILENAME = 'referencia_columnas_bcp_grooflow.xlsx';

/** Columnas extracto BCP (PETMAX). */
export const BCP_COL_DATE = 0; // A FECHA
export const BCP_COL_DESCRIPTION = 1; // B DESCRIPCION
export const BCP_COL_AMOUNT = 2; // C MONTO
export const BCP_COL_OPERATION = 3; // D OPERACION
export const BCP_COL_TYPE = 4; // E TIPO

function readBcpField(
  row: Record<string, unknown>,
  index: number,
  ...aliases: string[]
): unknown {
  return getImportCell(row, ...aliases) ?? getImportCellByIndex(row, index);
}

function inferBcpPaymentMethod(tipo: string, description: string) {
  const combined = `${tipo} ${description}`.toLowerCase();
  if (combined.includes('yape')) return inferPaymentMethod('yape', undefined);
  if (combined.includes('terc') || combined.includes('interbanc') || combined.includes('otro banco')) {
    return inferPaymentMethod('interbancaria', undefined);
  }
  return inferPaymentMethod(combined, undefined);
}

function parseSignedAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = parseImportAmount(value);
  if (parsed === null) return null;
  const raw = String(value).trim();
  if (raw.startsWith('-') || raw.startsWith('(')) return -parsed;
  return parsed;
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

      const dateRaw = readBcpField(row, BCP_COL_DATE, 'FECHA', 'Fecha', 'fecha');
      const date = parseImportDate(dateRaw);
      const amountSigned = parseSignedAmount(
        readBcpField(row, BCP_COL_AMOUNT, 'MONTO', 'Monto', 'importe', 'amount')
      );
      const description = String(
        readBcpField(
          row,
          BCP_COL_DESCRIPTION,
          'DESCRIPCION',
          'DESCRIPCIÓN',
          'Descripcion',
          'Descripción',
          'detalle',
          'concepto'
        ) ?? ''
      ).trim();
      const tipo = String(
        readBcpField(row, BCP_COL_TYPE, 'TIPO', 'Tipo', 'tipo', 'categoria', 'categoría') ?? ''
      ).trim();
      const opRaw = readBcpField(
        row,
        BCP_COL_OPERATION,
        'OPERACION',
        'OPERACIÓN',
        'Operacion',
        'Operación',
        'Nro Operación',
        'Nro Operacion',
        'numero operacion',
        'operacion',
        'operation'
      );

      if (!date && amountSigned === null && !description) {
        skipped += 1;
        return;
      }
      if (!date) {
        errors.push(`Fila ${rowNum}: fecha inválida o vacía (columna FECHA).`);
        return;
      }
      if (amountSigned === null) {
        errors.push(`Fila ${rowNum}: monto inválido (columna MONTO).`);
        return;
      }

      const creditsOnly = context.creditsOnly !== false;
      if (creditsOnly && amountSigned <= 0) {
        skipped += 1;
        return;
      }

      const amount = Math.abs(amountSigned);
      const { normalized, raw } = normalizeOperationNumber(opRaw);
      const paymentMethod = inferBcpPaymentMethod(tipo, description);

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
        metadata: {
          rowIndex: rowNum,
          fileName: context.fileName,
          bcpTipo: tipo || undefined,
          bcpDescription: description || undefined,
        },
      });
    });

    return { movements, errors, skipped };
  },
};

export function buildBcpImportTemplateRows(): Record<string, unknown>[] {
  return [
    {
      FECHA: '01/06/2026',
      DESCRIPCION: 'TRAN.CTAS.TERC.BM',
      MONTO: 510.0,
      OPERACION: '05951775',
      TIPO: 'TRANSFERENCIAS',
    },
    {
      FECHA: '01/06/2026',
      DESCRIPCION: 'Yape Evelyn Mor',
      MONTO: 460.0,
      OPERACION: '00235493',
      TIPO: 'Yape',
    },
    {
      FECHA: '01/06/2026',
      DESCRIPCION: 'Yape Diego Val',
      MONTO: 340.0,
      OPERACION: '07540015',
      TIPO: 'Yape',
    },
    {
      FECHA: '01/06/2026',
      DESCRIPCION: 'TRAN.CEL.BM.',
      MONTO: 280.0,
      OPERACION: '02838482',
      TIPO: 'TRANSFERENCIAS',
    },
  ];
}

export function downloadBcpImportTemplate() {
  downloadWorkbook(BCP_TEMPLATE_FILENAME, [
    {
      name: 'BCP',
      rows: buildBcpImportTemplateRows(),
    },
    {
      name: 'Instrucciones',
      rows: [
        { Columna: 'A', Campo: 'FECHA', Uso: 'Fecha del abono (DD/MM/AAAA).' },
        { Columna: 'B', Campo: 'DESCRIPCION', Uso: 'Detalle del movimiento (Yape, transferencia, etc.).' },
        { Columna: 'C', Campo: 'MONTO', Uso: 'Importe abonado (solo ingresos se importan).' },
        {
          Columna: 'D',
          Campo: 'OPERACION',
          Uso: 'N° operación BCP (8 dígitos; se normaliza a 7 para cruce con ventas).',
        },
        { Columna: 'E', Campo: 'TIPO', Uso: 'Yape, TRANSFERENCIAS, etc. — ayuda a inferir el medio.' },
        {
          Columna: '—',
          Campo: 'Archivo',
          Uso: 'Exporta el extracto BCP sin modificar encabezados y súbelo en Conciliación.',
        },
      ],
    },
  ]);
}
