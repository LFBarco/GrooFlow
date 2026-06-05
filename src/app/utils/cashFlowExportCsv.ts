import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { ConfigStructure } from '../data/initialData';
import { formatNumberEs } from './numberFormat';
import {
  iterConceptRows,
  resolvedCell,
  type LayerVisibility,
  type TripleLayerDailyMatrix,
} from './tripleLayerCashFlow';

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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

/** Descarga la matriz diaria como CSV (separador `;`, UTF-8 BOM). */
export function downloadCashFlowCsv(input: CashFlowCsvExportInput): void {
  const { filename, columns, matrixDaily, visibility, config, today, endBalances, initialBalance } =
    input;

  const dayHeaders = columns.map((d) => format(d, 'd/M', { locale: es }));
  const lines: string[] = [
    ['Sección', 'Categoría', 'Subcategoría', 'Concepto', ...dayHeaders, 'Total'].map(csvCell).join(';'),
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
      lines.push(
        [
          section.label,
          row.category,
          row.subcategory ?? '',
          row.conceptName ?? '',
          ...amounts.map((v) => formatNumberEs(v, 2)),
          formatNumberEs(total, 2),
        ]
          .map(csvCell)
          .join(';')
      );
    }
  }

  lines.push(
    ['', '', '', 'Saldo inicial', ...columns.map(() => ''), formatNumberEs(initialBalance, 2)]
      .map(csvCell)
      .join(';')
  );
  lines.push(
    [
      '',
      '',
      '',
      'Saldo final',
      ...endBalances.map((v) => formatNumberEs(v, 2)),
      formatNumberEs(endBalances[endBalances.length - 1] ?? 0, 2),
    ]
      .map(csvCell)
      .join(';')
  );

  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
