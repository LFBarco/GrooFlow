import { describe, expect, it } from 'vitest';

import type { Telefono } from '../types/telefonos';
import {
  computeTelefonosStats,
  detectImportColumns,
  findHeaderRow,
  formatPhone,
  normalizePhone,
  rowsFromMatrix,
  suggestColaborador,
} from './telefonosRules';

const tel = (patch: Partial<Telefono>): Telefono => ({
  id: '1',
  numero: '987654321',
  tipo: 'sin_asignar',
  bukId: null,
  etiqueta: null,
  responsable: null,
  operador: null,
  plan: null,
  costoMensual: null,
  equipo: null,
  imei: null,
  iccid: null,
  estado: 'activo',
  notas: null,
  colaborador: null,
  updatedAt: '',
  ...patch,
});

describe('normalizePhone / formatPhone', () => {
  it('quita espacios, guiones y el +51', () => {
    expect(normalizePhone('+51 987-654-321')).toBe('987654321');
    expect(normalizePhone(987654321)).toBe('987654321');
    expect(normalizePhone('(01) 4567890')).toBe('014567890');
  });
  it('formatea móviles en bloques de 3', () => {
    expect(formatPhone('987654321')).toBe('987 654 321');
    expect(formatPhone('014567890')).toBe('014567890');
  });
});

describe('detección de columnas del Excel del operador', () => {
  it('reconoce encabezados típicos aunque no estén en la primera fila', () => {
    const matrix = [
      ['Reporte de líneas - Octubre'],
      [],
      ['N° Línea', 'Plan Tarifario', 'Cargo Fijo S/', 'Modelo Equipo', 'IMEI', 'Nro. Chip (ICCID)', 'Usuario'],
      ['987 654 321', 'Max 69.90', '69.90', 'Galaxy A15', '356789012345678', '8951100000000000001', 'Juan Pérez'],
      ['', '', '', '', '', '', ''],
      ['+51 912345678', 'Max 39.90', '39.90', '', '', '', ''],
    ];
    const h = findHeaderRow(matrix);
    expect(h).toBe(2);
    const m = detectImportColumns(matrix[h]);
    expect(m).toMatchObject({ numero: 0, plan: 1, costoMensual: 2, equipo: 3, imei: 4, iccid: 5, nombre: 6 });
    const rows = rowsFromMatrix(matrix, h, m);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ numero: '987654321', plan: 'Max 69.90', costoMensual: '69.90', nombre: 'Juan Pérez' });
    expect(rows[1].numero).toBe('912345678');
  });
});

describe('computeTelefonosStats', () => {
  it('cuenta por tipo, suma costo y excluye las líneas dadas de baja', () => {
    const s = computeTelefonosStats([
      tel({ tipo: 'persona', costoMensual: 50, colaborador: { nombreCompleto: 'A', nombres: null, apellidos: null, cargo: null, area: null, sede: null, activo: false } }),
      tel({ tipo: 'bot', costoMensual: 20 }),
      tel({ tipo: 'especial' }),
      tel({ tipo: 'sin_asignar' }),
      tel({ tipo: 'persona', estado: 'baja', costoMensual: 99 }),
    ]);
    expect(s.total).toBe(4);
    expect(s.porTipo).toEqual({ persona: 1, bot: 1, especial: 1, sin_asignar: 1 });
    expect(s.costoMensual).toBe(70);
    expect(s.cesados).toBe(1);
  });
});

describe('suggestColaborador', () => {
  it('sugiere al colaborador con el mismo teléfono en Buk', () => {
    const c = { bukId: 5, nombreCompleto: 'Ana', nombres: 'Ana', apellidos: 'Ríos', documento: null, cargo: 'Vet', area: null, sede: null, telefono: '987654321' };
    expect(suggestColaborador('987654321', [c])?.bukId).toBe(5);
    expect(suggestColaborador('900000000', [c])).toBeNull();
  });
});
