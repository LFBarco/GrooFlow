import {
  getImportCell,
  getImportCellByIndex,
  inferPaymentMethod,
  normalizeImportKey,
  normalizeOperationForMovement,
  parseImportAmount,
  parseImportDate,
} from '../domain/normalize';
import type { PaymentMethodHint } from '../domain/types';
import type { ConnectorParseResult, ReconciliationConnector } from './types';
import { downloadWorkbook } from './spreadsheetUtils';

export const SALES_TEMPLATE_FILENAME = 'referencia_columnas_ventas_erp_grooflow.xlsx';

/** Encabezados exactos del reporte ventas ERP (columnas A–S). */
export const SALES_ERP_HEADERS = [
  'Sucursal',
  'Fecha de Venta',
  'Concepto',
  'Comprobante',
  'Nombre Paciente',
  'Nombre Cliente',
  'Apellido Cliente',
  'Importe con Impuestos',
  'Saldo',
  'Fecha de Pago',
  'Tipo de Pago',
  'Detalle Pago',
  'Monto del Pago',
  'Usuario de Pago',
  'Fecha Registro de Pago',
  'Cod. Op. Pago 1',
  'Cod. Op. Pago 2',
  'Cod. Op. Pago 3',
  'Cod. Op. Pago 4',
] as const;

/** Índices columna reporte ventas ERP (PETMAX). */
export const SALES_COL_BRANCH = 0; // A Sucursal
export const SALES_COL_SALE_DATE = 1; // B Fecha de Venta
export const SALES_COL_CONCEPT = 2; // C Concepto
export const SALES_COL_DOCUMENT = 3; // D Comprobante
export const SALES_COL_SALE_AMOUNT = 7; // H Importe con Impuestos
export const SALES_COL_BALANCE = 8; // I Saldo
export const SALES_COL_PAY_DATE = 9; // J Fecha de Pago
export const SALES_COL_PAY_TYPE = 10; // K Tipo de Pago
export const SALES_COL_PAY_DETAIL = 11; // L Detalle Pago
export const SALES_COL_PAY_AMOUNT = 12; // M Monto del Pago
export const SALES_COL_PAY_USER = 13; // N Usuario de Pago
export const SALES_COL_PAY_REGISTERED = 14; // O Fecha Registro de Pago
export const SALES_COL_OP_CODE_START = 15; // P…S Cod. Op. Pago 1–4

const OP_CODE_SLOTS = [1, 2, 3, 4] as const;

function readSalesField(
  row: Record<string, unknown>,
  index: number,
  ...aliases: string[]
): unknown {
  return getImportCell(row, ...aliases) ?? getImportCellByIndex(row, index);
}

function readOperationCodeBySlot(row: Record<string, unknown>, slot: number): unknown {
  const index = SALES_COL_OP_CODE_START + (slot - 1);
  const aliases = [
    `Cod. Op. Pago ${slot}`,
    `Cod. Op. Pag ${slot}`,
    `Cod Op Pago ${slot}`,
    `Cod Op Pag ${slot}`,
  ];
  if (slot === 1) {
    aliases.push('Cod. Op. Pag', 'Cod. Op. Pago', 'Cod Op Pag', 'cod op pag');
  }
  return readSalesField(row, index, ...aliases);
}

export type SalesOperationCodeSlot = {
  slot: number;
  raw: string;
};

/** Lee los códigos de operación por columna (1–4), sin duplicados. */
export function readAllOperationCodes(row: Record<string, unknown>): SalesOperationCodeSlot[] {
  const seen = new Set<string>();
  const result: SalesOperationCodeSlot[] = [];

  for (const slot of OP_CODE_SLOTS) {
    const raw = String(readOperationCodeBySlot(row, slot) ?? '').trim();
    if (!raw) continue;
    const key = raw.replace(/\D/g, '') || raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ slot, raw });
  }

  if (result.length > 0) return result;

  for (const key of Object.keys(row)) {
    const nk = normalizeImportKey(key);
    if (!nk.includes('codoppag') && !nk.includes('codoperacionpago') && !nk.includes('codoppago')) {
      continue;
    }
    const raw = String(row[key] ?? '').trim();
    if (!raw) continue;
    const dedupe = raw.replace(/\D/g, '') || raw.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const slotMatch = nk.match(/(\d)$/);
    result.push({ slot: slotMatch ? Number(slotMatch[1]) : 1, raw });
  }

  return result.sort((a, b) => a.slot - b.slot);
}

function buildCustomerName(row: Record<string, unknown>): string {
  const patient = String(
    readSalesField(row, 4, 'Nombre Paciente', 'Nombre Pacie', 'nombre paciente') ?? ''
  ).trim();
  const first = String(
    readSalesField(row, 5, 'Nombre Cliente', 'Nombre Clie', 'nombre cliente') ?? ''
  ).trim();
  const last = String(
    readSalesField(row, 6, 'Apellido Cliente', 'Apellido Clie', 'apellido cliente') ?? ''
  ).trim();
  const combined = [first, last].filter(Boolean).join(' ').trim();
  return patient || combined || '';
}

function resolvePaymentMethodForSlot(
  slot: number,
  methodRaw: unknown,
  singleOpOnly: boolean
): PaymentMethodHint {
  if (slot === 1) return inferPaymentMethod(methodRaw, undefined);
  if (singleOpOnly && slot !== 1) return 'unknown';
  return 'unknown';
}

function resolveAmountForSlot(
  slot: number,
  payAmount: number,
  singleOpOnly: boolean
): { amount: number; erpAmountFromBank: boolean } {
  if (singleOpOnly) {
    return { amount: payAmount, erpAmountFromBank: false };
  }
  if (slot === 1) {
    return { amount: payAmount, erpAmountFromBank: false };
  }
  return { amount: 0, erpAmountFromBank: true };
}

export const salesExcelConnector: ReconciliationConnector = {
  sourceType: 'sales_erp',
  label: 'Ventas (ERP externo)',
  acceptedExtensions: ['.xlsx', '.xls', '.csv'],
  parseRows(rows, context): ConnectorParseResult {
    const movements: ConnectorParseResult['movements'] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;

      const payAmount = parseImportAmount(
        readSalesField(
          row,
          SALES_COL_PAY_AMOUNT,
          'Monto del Pago',
          'Monto del Pa',
          'monto del pago',
          'monto pago'
        )
      );
      const documentNumber = String(
        readSalesField(row, SALES_COL_DOCUMENT, 'Comprobante', 'Comprobant', 'comprobante') ?? ''
      ).trim();
      const date = parseImportDate(
        readSalesField(
          row,
          SALES_COL_PAY_DATE,
          'Fecha de Pago',
          'Fecha de Pag',
          'fecha de pago'
        )
      );

      if (!date && payAmount === null && !documentNumber) {
        skipped += 1;
        return;
      }

      if (payAmount === null || payAmount <= 0) {
        skipped += 1;
        return;
      }

      if (!date) {
        errors.push(`Fila ${rowNum}: fecha de pago inválida (columna J).`);
        return;
      }

      const saleAmount = parseImportAmount(
        readSalesField(
          row,
          SALES_COL_SALE_AMOUNT,
          'Importe con Impuestos',
          'Importe con Impuesto',
          'Importe con Imp',
          'importe con impuestos',
          'importe con impuesto'
        )
      );
      const balance = parseImportAmount(
        readSalesField(row, SALES_COL_BALANCE, 'Saldo', 'saldo') ?? undefined
      );
      const concept = String(
        readSalesField(row, SALES_COL_CONCEPT, 'Concepto', 'concepto') ?? ''
      ).trim();
      const methodRaw = readSalesField(
        row,
        SALES_COL_PAY_TYPE,
        'Tipo de Pago',
        'Tipo de Pag',
        'tipo de pago',
        'medio de pago'
      );
      const branch = String(
        readSalesField(row, SALES_COL_BRANCH, 'Sucursal', 'Sucu', 'sucursal', 'sede') ?? ''
      ).trim();
      const registeredBy = String(
        readSalesField(
          row,
          SALES_COL_PAY_USER,
          'Usuario de Pago',
          'Usuario de Pa',
          'usuario de pago',
          'usuario pago'
        ) ?? ''
      ).trim();
      const payDetail = String(
        readSalesField(
          row,
          SALES_COL_PAY_DETAIL,
          'Detalle Pago',
          'Detalle Pag',
          'detalle pago'
        ) ?? ''
      ).trim();
      const payRegisteredRaw = readSalesField(
        row,
        SALES_COL_PAY_REGISTERED,
        'Fecha Registro de Pago',
        'Fecha Registro de Pa',
        'fecha registro de pago'
      );
      const customerName = buildCustomerName(row);
      const saleDate = parseImportDate(
        readSalesField(row, SALES_COL_SALE_DATE, 'Fecha de Venta', 'Fecha de Ven', 'fecha de venta')
      );

      const operationCodes = readAllOperationCodes(row);
      const multiPaymentRow = operationCodes.length > 1;
      const singleOpOnly = operationCodes.length === 1;

      const slotsToImport =
        operationCodes.length > 0 ? operationCodes : [{ slot: 1, raw: '' }];

      for (const op of slotsToImport) {
        const paymentMethod = resolvePaymentMethodForSlot(op.slot, methodRaw, singleOpOnly);
        const { amount, erpAmountFromBank } = resolveAmountForSlot(
          op.slot,
          payAmount,
          singleOpOnly
        );
        const { normalized, raw } = op.raw
          ? normalizeOperationForMovement(op.raw, paymentMethod)
          : { normalized: '', raw: '' };

        movements.push({
          sourceType: 'sales_erp',
          side: 'sales_application',
          transactionDate: date,
          amount,
          currency: 'PEN',
          operationNumber: normalized,
          operationNumberRaw: raw,
          paymentMethod,
          documentNumber: documentNumber || undefined,
          saleAmount: saleOpPrimarySlot(op.slot) ? saleAmount ?? undefined : undefined,
          branch: branch || undefined,
          customerName: customerName || undefined,
          registeredBy: registeredBy || undefined,
          description: payDetail || undefined,
          metadata: {
            rowIndex: rowNum,
            fileName: context.fileName,
            saleDate: saleDate ?? undefined,
            concept: concept || undefined,
            balance: balance ?? undefined,
            paymentType: methodRaw != null ? String(methodRaw) : undefined,
            payRegisteredAt: payRegisteredRaw != null ? String(payRegisteredRaw) : undefined,
            erpOpCodeSlot: op.slot,
            erpMultiPaymentRow: multiPaymentRow,
            erpAmountFromBank,
          },
        });
      }
    });

    return { movements, errors, skipped };
  },
};

function saleOpPrimarySlot(slot: number): boolean {
  return slot === 1;
}

export function buildSalesImportTemplateRows(): Record<string, unknown>[] {
  return [
    {
      Sucursal: 'MA',
      'Fecha de Venta': '01/01/2026',
      Concepto: 'Ingreso',
      Comprobante: 'B006-0008784',
      'Nombre Paciente': 'Max',
      'Nombre Cliente': 'Juan',
      'Apellido Cliente': 'Pérez',
      'Importe con Impuestos': 'S/212.00',
      Saldo: 'S/0.00',
      'Fecha de Pago': '01/01/2026',
      'Tipo de Pago': 'Yape',
      'Detalle Pago': '',
      'Monto del Pago': 'S/212.00',
      'Usuario de Pago': 'Teresa Uceda',
      'Fecha Registro de Pago': '01/01/2026 3:03 AM',
      'Cod. Op. Pago 1': '02525188',
      'Cod. Op. Pago 2': '',
      'Cod. Op. Pago 3': '',
      'Cod. Op. Pago 4': '',
    },
    {
      Sucursal: 'SB',
      'Fecha de Venta': '01/01/2026',
      Concepto: 'Ingreso',
      Comprobante: 'B006-0008785',
      'Nombre Paciente': 'Luna',
      'Nombre Cliente': 'María',
      'Apellido Cliente': 'García',
      'Importe con Impuestos': 'S/150.00',
      Saldo: 'S/0.00',
      'Fecha de Pago': '01/01/2026',
      'Tipo de Pago': 'VISA',
      'Detalle Pago': '',
      'Monto del Pago': 'S/150.00',
      'Usuario de Pago': 'Carolina Melendez',
      'Fecha Registro de Pago': '01/01/2026 10:15 AM',
      'Cod. Op. Pago 1': '01234567',
      'Cod. Op. Pago 2': '',
      'Cod. Op. Pago 3': '',
      'Cod. Op. Pago 4': '',
    },
    {
      Sucursal: 'LM',
      'Fecha de Venta': '02/01/2026',
      Concepto: 'Ingreso',
      Comprobante: 'B006-0008786',
      'Nombre Paciente': 'Rocky',
      'Nombre Cliente': 'Carlos',
      'Apellido Cliente': 'López',
      'Importe con Impuestos': 'S/320.00',
      Saldo: 'S/0.00',
      'Fecha de Pago': '02/01/2026',
      'Tipo de Pago': 'Yape',
      'Detalle Pago': '',
      'Monto del Pago': 'S/320.00',
      'Usuario de Pago': 'Teresa Uceda',
      'Fecha Registro de Pago': '02/01/2026 2:45 PM',
      'Cod. Op. Pago 1': '1111111',
      'Cod. Op. Pago 2': '9876543210123',
      'Cod. Op. Pago 3': '2222222',
      'Cod. Op. Pago 4': '',
    },
  ];
}

export function downloadSalesImportTemplate() {
  downloadWorkbook(SALES_TEMPLATE_FILENAME, [
    {
      name: 'Ventas ERP',
      rows: buildSalesImportTemplateRows(),
    },
    {
      name: 'Instrucciones',
      rows: [
        { Columna: 'A', Campo: 'Sucursal', Uso: 'Código sede (MA, SB, LM, etc.).' },
        { Columna: 'B', Campo: 'Fecha de Venta', Uso: 'Fecha del comprobante.' },
        { Columna: 'C', Campo: 'Concepto', Uso: 'Tipo de ingreso (ej. Ingreso).' },
        { Columna: 'D', Campo: 'Comprobante', Uso: 'Boleta / factura.' },
        { Columna: 'E', Campo: 'Nombre Paciente', Uso: 'Mascota / paciente.' },
        { Columna: 'F', Campo: 'Nombre Cliente', Uso: 'Nombre del titular.' },
        { Columna: 'G', Campo: 'Apellido Cliente', Uso: 'Apellido del titular.' },
        { Columna: 'H', Campo: 'Importe con Impuestos', Uso: 'Total venta con IGV (S/…).' },
        { Columna: 'I', Campo: 'Saldo', Uso: 'Saldo pendiente del comprobante.' },
        { Columna: 'J', Campo: 'Fecha de Pago', Uso: 'Fecha del cobro para conciliación.' },
        {
          Columna: 'K',
          Campo: 'Tipo de Pago',
          Uso: 'Medio del Cod. Op. Pago 1 (Yape, VISA, Mercado Pago, etc.).',
        },
        { Columna: 'L', Campo: 'Detalle Pago', Uso: 'Observación opcional del pago.' },
        { Columna: 'M', Campo: 'Monto del Pago', Uso: 'Importe aplicado (S/…).' },
        { Columna: 'N', Campo: 'Usuario de Pago', Uso: 'Counter / recepcionista.' },
        { Columna: 'O', Campo: 'Fecha Registro de Pago', Uso: 'Timestamp de registro en ERP.' },
        { Columna: 'P', Campo: 'Cod. Op. Pago 1', Uso: 'Código principal — usa Tipo y Monto de pago.' },
        { Columna: 'Q', Campo: 'Cod. Op. Pago 2', Uso: 'Código adicional — cruce solo por N° operación.' },
        { Columna: 'R', Campo: 'Cod. Op. Pago 3', Uso: 'Código adicional — cruce solo por N° operación.' },
        { Columna: 'S', Campo: 'Cod. Op. Pago 4', Uso: 'Código adicional — cruce solo por N° operación.' },
        {
          Columna: '—',
          Campo: 'Archivo',
          Uso: 'Exporta el reporte del ERP sin modificar encabezados y súbelo en Conciliación.',
        },
      ],
    },
  ]);
}
