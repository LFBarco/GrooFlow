import { describe, expect, it } from 'vitest';

import {
  buildStarsoftHeaderMap,
  getImportCell,
  parseChartOfAccountsImportRows,
} from './chartOfAccountsImport';

describe('chartOfAccountsImport', () => {
  it('lee PL FUNCION GROO y PLPL FUNCION GROO con cabeceras alternativas', () => {
    const row = {
      CUENTA: '601111',
      DESCRIPCION: 'Mercaderías',
      NIVEL: 5,
      PORCENTAJE: '18',
      'PL FUNCION GROO': 'GASTO-ADM',
      'PLPL FUNCION GROO': 'SUB-GASTO',
    };
    const { rows, skipped } = parseChartOfAccountsImportRows([row]);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].porcentaje).toBe('18');
    expect(rows[0].plFuncionGroo).toBe('GASTO-ADM');
    expect(rows[0].plplFuncionGoo).toBe('SUB-GASTO');
  });

  it('resuelve columnas finales por posición si el encabezado difiere', () => {
    const row = {
      Col1: '701010',
      Col2: 'Ventas',
      Col3: 4,
      Col4: '',
      Col5: '',
      Col6: 'INGRESO',
      Col7: '',
      Col8: '',
      Col9: '',
      Col10: '',
      Col11: '',
      Col12: '',
      Col13: '',
      Col14: '',
      Col15: '',
      Col16: '10',
      Col17: 'FN-GROO',
      Col18: 'FN-PLPL',
    };
    const map = buildStarsoftHeaderMap(row);
    expect(getImportCell(row, map, 'PORCENTAJE')).toBe('10');
    expect(getImportCell(row, map, 'PL FUNCION GROO')).toBe('FN-GROO');
    expect(getImportCell(row, map, 'PLPL FUNCION GOO')).toBe('FN-PLPL');
  });
});
