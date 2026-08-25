import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

import type { ConfigStructure } from '../data/initialData';
import {
  iterConceptRows,
  resolvedCell,
  type LayerVisibility,
  type TripleLayerDailyMatrix,
} from './tripleLayerCashFlow';

export type CashFlowCsvExportInput = {
  filename: string;
  columns: Date[];
  matrixDaily: TripleLayerDailyMatrix;
  visibility: LayerVisibility;
  config: ConfigStructure;
  today: Date;
  endBalances: number[];
  initialBalance: number;
};

/** Descarga la matriz diaria como Excel (.xlsx). */
export function downloadCashFlowCsv(input: CashFlowCsvExportInput): void {
  const { filename, columns, matrixDaily, visibility, config, today, endBalances, initialBalance } =
    input;

  const dayHeaders = columns.map((d) => format(d, 'd/M', { locale: es }));
  const aoa: (string | number)[][] = [
    ['Sección', 'Categoría', 'Subcategoría', 'Concepto', ...dayHeaders, 'Total'],
  ];

  const sections: Array<{ label: string; kind: 'income' | 'expense' }> = [
    { label: 'Ingresos', kind: 'income' },
    { label: 'Egresos', kind: 'expense' },
  ];

  for (const section of sections) {
    for (const row of iterConceptRows(config).filter((r) => r.kind === section.kind)) {
      const amounts = columns.map((date) =>
        resolvedCell(
          matrixDaily,
          visibility,
          row.category,
          row.subcategory,
          row.conceptName,
          date,
          today
        ).amount
      );
      const total = amounts.reduce((s, v) => s + v, 0);
      aoa.push([
        section.label,
        row.category,
        row.subcategory ?? '',
        row.conceptName ?? '',
        ...amounts,
        total,
      ]);
    }
  }

  aoa.push(['', '', '', 'Saldo inicial', ...columns.map(() => ''), initialBalance]);
  aoa.push([
    '',
    '',
    '',
    'Saldo final',
    ...endBalances,
    endBalances[endBalances.length - 1] ?? 0,
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Flujo de caja');
  XLSX.writeFile(wb, filename.replace(/\.csv$/i, '.xlsx'));
}
