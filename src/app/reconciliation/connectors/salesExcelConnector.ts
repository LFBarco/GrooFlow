import {
  getImportCell,
  inferPaymentMethod,
  normalizeOperationNumber,
  parseImportAmount,
  parseImportDate,
} from '../domain/normalize';
import type { ConnectorParseResult, ReconciliationConnector } from './types';
import { downloadWorkbook } from './spreadsheetUtils';

export const SALES_TEMPLATE_FILENAME = 'plantilla_ventas_conciliacion_grooflow.xlsx';

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
      const date = parseImportDate(
        getImportCell(row, 'Fecha Pago', 'Fecha', 'fecha', 'fecha operacion', 'fecha operación')
      );
      const documentNumber = String(
        getImportCell(row, 'Nro Documento', 'Documento', 'Boleta', 'Factura', 'nro documento') ?? ''
      ).trim();
      const saleAmount = parseImportAmount(
        getImportCell(row, 'Monto Documento', 'Monto Venta', 'Total Venta', 'monto documento')
      );
      const payAmount = parseImportAmount(
        getImportCell(row, 'Monto Pago', 'Monto', 'Importe Pago', 'monto pago', 'importe')
      );
      const methodRaw = getImportCell(row, 'Medio Pago', 'Medio de Pago', 'metodo pago', 'método pago');
      const opRaw = getImportCell(
        row,
        'Nro Operación',
        'Nro Operacion',
        'Número operación',
        'operacion',
        'operation'
      );
      const branch = String(getImportCell(row, 'Sede', 'sucursal', 'local') ?? '').trim();
      const registeredBy = String(
        getImportCell(row, 'Usuario', 'Counter', 'Cajero', 'registrado por') ?? ''
      ).trim();
      const customerName = String(getImportCell(row, 'Cliente', 'cliente') ?? '').trim();
      const notes = String(getImportCell(row, 'Notas', 'observacion', 'observación') ?? '').trim();

      if (!date && payAmount === null && !documentNumber) {
        skipped += 1;
        return;
      }
      if (!date) {
        errors.push(`Fila ${rowNum}: fecha de pago inválida.`);
        return;
      }
      if (payAmount === null || payAmount <= 0) {
        errors.push(`Fila ${rowNum}: monto de pago inválido.`);
        return;
      }

      const { normalized, raw } = normalizeOperationNumber(opRaw);
      const paymentMethod = inferPaymentMethod(methodRaw, undefined);

      movements.push({
        sourceType: 'sales_erp',
        side: 'sales_application',
        transactionDate: date,
        amount: payAmount,
        currency: 'PEN',
        operationNumber: normalized,
        operationNumberRaw: raw,
        paymentMethod,
        documentNumber: documentNumber || undefined,
        saleAmount: saleAmount ?? undefined,
        branch: branch || undefined,
        customerName: customerName || undefined,
        registeredBy: registeredBy || undefined,
        description: notes || undefined,
        metadata: { rowIndex: rowNum, fileName: context.fileName },
      });
    });

    return { movements, errors, skipped };
  },
};

export function buildSalesImportTemplateRows(): Record<string, unknown>[] {
  return [
    {
      'Fecha Pago': '2026-06-26',
      'Nro Documento': 'B001-0001234',
      'Monto Documento': 50.0,
      'Monto Pago': 50.0,
      'Medio Pago': 'Yape',
      'Nro Operación': '1234567',
      Sede: 'Miraflores',
      Usuario: 'counter.ejemplo',
      Cliente: 'Cliente demo',
      Notas: '',
    },
    {
      'Fecha Pago': '2026-06-26',
      'Nro Documento': 'B001-0001235',
      'Monto Documento': 80.0,
      'Monto Pago': 40.0,
      'Medio Pago': 'Mercado Pago',
      'Nro Operación': '9876543',
      Sede: 'Miraflores',
      Usuario: 'counter.ejemplo',
      Cliente: 'Pago parcial',
      Notas: 'Parcial 1 de 2',
    },
  ];
}

export function downloadSalesImportTemplate() {
  downloadWorkbook(SALES_TEMPLATE_FILENAME, [
    {
      name: 'Ventas',
      rows: buildSalesImportTemplateRows(),
    },
    {
      name: 'Instrucciones',
      rows: [
        { Campo: 'Fecha Pago', Descripción: 'Fecha en que se registró el cobro (AAAA-MM-DD).' },
        { Campo: 'Nro Documento', Descripción: 'Boleta o factura del sistema de ventas.' },
        { Campo: 'Monto Documento', Descripción: 'Total del comprobante (para detectar parciales).' },
        { Campo: 'Monto Pago', Descripción: 'Importe aplicado en este registro (puede ser parcial).' },
        {
          Campo: 'Medio Pago',
          Descripción:
            'Yape, Transferencia BCP, Interbancaria, Mercado Pago, Niubiz, Efectivo, POS.',
        },
        {
          Campo: 'Nro Operación',
          Descripción: 'Código de la transacción (obligatorio salvo interbancaria pendiente).',
        },
        { Campo: 'Sede', Descripción: 'Sucursal donde se registró.' },
        { Campo: 'Usuario', Descripción: 'Counter o recepcionista.' },
      ],
    },
  ]);
}
