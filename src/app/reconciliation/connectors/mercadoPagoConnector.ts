import {
  getImportCell,
  getImportCellByIndex,
  isMercadoPagoApprovedStatus,
  normalizeOperationNumber,
  parseImportAmount,
  parseImportDate,
} from '../domain/normalize';
import { downloadWorkbook } from './spreadsheetUtils';
import type { ConnectorParseResult, ReconciliationConnector } from './types';

/** Columnas del reporte oficial Mercado Pago (PETMAX). */
export const MP_COL_DATE = 0; // A — Fecha de compra
export const MP_COL_OPERATION = 6; // G — Número de operación
export const MP_COL_STATUS = 7; // H — Estado
export const MP_COL_AMOUNT = 10; // K — Valor del producto

export const MERCADO_PAGO_TEMPLATE_FILENAME = 'referencia_columnas_mercado_pago_grooflow.xlsx';

export const MP_HEADER_ROW: Record<string, unknown> = {
  'Fecha de compra (date_created)': '',
  'Fecha de acreditación (date_approved)': '',
  'Fecha de liberación del dinero (date_released)': '',
  'E-mail de la contraparte (counterpart_email)': '',
  'Documento de la contraparte (buyer_doc_number)': '',
  'Número de venta en tu negocio online (merchant_order_id)': '',
  'Número de operación de Mercado Pago (operation_id)': '',
  'Estado de la operación (status)': '',
  'Detalle del estado de la operación (status_detail)': '',
  'Tipo de operación (operation_type)': '',
  'Valor del producto (transaction_amount)': '',
};

function readMpField(
  row: Record<string, unknown>,
  index: number,
  ...aliases: string[]
): unknown {
  return getImportCell(row, ...aliases) ?? getImportCellByIndex(row, index);
}

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

      const statusRaw = readMpField(
        row,
        MP_COL_STATUS,
        'Estado de la operación (status)',
        'Estado de la operación',
        'status',
        'estado'
      );
      if (statusRaw !== undefined && statusRaw !== null && String(statusRaw).trim() !== '') {
        if (!isMercadoPagoApprovedStatus(statusRaw)) {
          skipped += 1;
          return;
        }
      } else {
        skipped += 1;
        return;
      }

      const date = parseImportDate(
        readMpField(
          row,
          MP_COL_DATE,
          'Fecha de compra (date_created)',
          'Fecha de compra',
          'date_created',
          'fecha de compra'
        )
      );
      const amount = parseImportAmount(
        readMpField(
          row,
          MP_COL_AMOUNT,
          'Valor del producto (transaction_amount)',
          'Valor del producto',
          'transaction_amount',
          'valor del producto'
        )
      );
      const opRaw = readMpField(
        row,
        MP_COL_OPERATION,
        'Número de operación de Mercado Pago (operation_id)',
        'Número de operación de Mercado Pago',
        'operation_id',
        'numero de operacion'
      );
      const merchantOrder = String(
        readMpField(
          row,
          5,
          'Número de venta en tu negocio online (merchant_order_id)',
          'merchant_order_id'
        ) ?? ''
      ).trim();
      const counterpart = String(
        readMpField(row, 3, 'E-mail de la contraparte (counterpart_email)', 'counterpart_email') ?? ''
      ).trim();

      if (!date && amount === null && !opRaw) {
        skipped += 1;
        return;
      }
      if (!date) {
        errors.push(`Fila ${rowNum}: fecha de compra inválida (columna A).`);
        return;
      }
      if (amount === null || amount <= 0) {
        errors.push(`Fila ${rowNum}: valor del producto inválido (columna K).`);
        return;
      }
      if (!opRaw) {
        errors.push(`Fila ${rowNum}: falta número de operación (columna G).`);
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
        description: merchantOrder ? `Orden ${merchantOrder}` : undefined,
        customerName: counterpart || undefined,
        metadata: {
          rowIndex: rowNum,
          fileName: context.fileName,
          mpStatus: String(statusRaw),
          merchantOrderId: merchantOrder || undefined,
        },
      });
    });

    return { movements, errors, skipped };
  },
};

export function downloadMercadoPagoColumnReference() {
  downloadWorkbook(MERCADO_PAGO_TEMPLATE_FILENAME, [
    {
      name: 'Referencia columnas MP',
      rows: [
        {
          ...MP_HEADER_ROW,
          'Fecha de compra (date_created)': '2026-06-26',
          'Número de operación de Mercado Pago (operation_id)': '12345678901234',
          'Estado de la operación (status)': 'approved',
          'Valor del producto (transaction_amount)': 150.0,
        },
      ],
    },
    {
      name: 'Instrucciones',
      rows: [
        {
          Columna: 'A',
          Campo: 'Fecha de compra (date_created)',
          Uso: 'Fecha del movimiento para conciliación.',
        },
        {
          Columna: 'G',
          Campo: 'Número de operación de Mercado Pago (operation_id)',
          Uso: 'Clave de cruce: últimos 7 dígitos (ej. 12345678901234 → 8901234).',
        },
        {
          Columna: 'H',
          Campo: 'Estado de la operación (status)',
          Uso: 'Solo se importan filas approved / aprobado.',
        },
        {
          Columna: 'K',
          Campo: 'Valor del producto (transaction_amount)',
          Uso: 'Importe a conciliar.',
        },
        {
          Columna: '—',
          Campo: 'Archivo',
          Uso: 'Sube el Excel exportado desde Mercado Pago sin modificar encabezados.',
        },
      ],
    },
  ]);
}
