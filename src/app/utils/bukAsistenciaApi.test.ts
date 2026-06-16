import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUK_ASISTENCIA_BASE_URL,
  buildBukAsistenciaUrl,
  sanitizeBukBaseUrl,
} from './bukAsistenciaApi';

describe('sanitizeBukBaseUrl', () => {
  it('mantiene la base correcta', () => {
    expect(sanitizeBukBaseUrl('https://app.ctrlit.cl/ctrl/api/v2')).toBe(
      DEFAULT_BUK_ASISTENCIA_BASE_URL
    );
  });

  it('quita /asistencia-empresa si pegaron la URL de Postman', () => {
    expect(
      sanitizeBukBaseUrl('https://app.ctrlit.cl/ctrl/api/v2/asistencia-empresa?page=1')
    ).toBe(DEFAULT_BUK_ASISTENCIA_BASE_URL);
  });

  it('corrige host ctrlit sin ruta api', () => {
    expect(sanitizeBukBaseUrl('https://app.ctrlit.cl')).toBe(DEFAULT_BUK_ASISTENCIA_BASE_URL);
  });

  it('construye endpoint sin duplicar ruta', () => {
    const url = buildBukAsistenciaUrl(
      'https://app.ctrlit.cl/ctrl/api/v2/asistencia-empresa',
      1,
      5
    );
    expect(url).toBe('https://app.ctrlit.cl/ctrl/api/v2/asistencia-empresa?page=1&page_size=5');
  });
});
