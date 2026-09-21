import { describe, expect, it } from 'vitest';

import type { BukAsistenciaIntegrationSettings } from '../types/asistencia';
import {
  autoRefreshIntervalMs,
  isWithinAutoRefreshWindow,
  shouldRunAutoRefresh,
} from './asistenciaAutoRefresh';

function buk(
  patch: Partial<BukAsistenciaIntegrationSettings> = {}
): BukAsistenciaIntegrationSettings {
  return {
    apiBaseUrl: 'https://example.test',
    apiToken: 'token',
    enabled: true,
    autoRefreshEnabled: true,
    autoRefreshIntervalMinutes: 30,
    autoRefreshWindowStart: '06:00',
    autoRefreshWindowEnd: '22:00',
    ...patch,
  };
}

describe('isWithinAutoRefreshWindow', () => {
  it('incluye el rango diurno normal', () => {
    const cfg = buk({ autoRefreshWindowStart: '06:00', autoRefreshWindowEnd: '22:00' });
    expect(isWithinAutoRefreshWindow(cfg, new Date(2026, 8, 21, 10, 0))).toBe(true);
    expect(isWithinAutoRefreshWindow(cfg, new Date(2026, 8, 21, 5, 59))).toBe(false);
    expect(isWithinAutoRefreshWindow(cfg, new Date(2026, 8, 21, 22, 0))).toBe(true);
    expect(isWithinAutoRefreshWindow(cfg, new Date(2026, 8, 21, 22, 1))).toBe(false);
  });

  it('soporta ventana que cruza medianoche', () => {
    const cfg = buk({ autoRefreshWindowStart: '22:00', autoRefreshWindowEnd: '06:00' });
    expect(isWithinAutoRefreshWindow(cfg, new Date(2026, 8, 21, 23, 0))).toBe(true);
    expect(isWithinAutoRefreshWindow(cfg, new Date(2026, 8, 21, 3, 0))).toBe(true);
    expect(isWithinAutoRefreshWindow(cfg, new Date(2026, 8, 21, 12, 0))).toBe(false);
  });
});

describe('autoRefreshIntervalMs', () => {
  it('usa minutos y fuerza mínimo 5', () => {
    expect(autoRefreshIntervalMs(buk({ autoRefreshIntervalMinutes: 15 }))).toBe(15 * 60_000);
    expect(autoRefreshIntervalMs(buk({ autoRefreshIntervalMinutes: 1 }))).toBe(5 * 60_000);
  });
});

describe('shouldRunAutoRefresh', () => {
  const noon = new Date(2026, 8, 21, 12, 0);
  const night = new Date(2026, 8, 21, 23, 0);

  it('exige integración activa, token y opt-in explícito', () => {
    expect(
      shouldRunAutoRefresh({
        buk: buk(),
        loading: false,
        documentVisible: true,
        now: noon,
      })
    ).toBe(true);

    expect(
      shouldRunAutoRefresh({
        buk: buk({ autoRefreshEnabled: false }),
        loading: false,
        documentVisible: true,
        now: noon,
      })
    ).toBe(false);

    expect(
      shouldRunAutoRefresh({
        buk: buk({ autoRefreshEnabled: undefined }),
        loading: false,
        documentVisible: true,
        now: noon,
      })
    ).toBe(false);

    expect(
      shouldRunAutoRefresh({
        buk: buk({ enabled: false }),
        loading: false,
        documentVisible: true,
        now: noon,
      })
    ).toBe(false);

    expect(
      shouldRunAutoRefresh({
        buk: buk({ apiToken: '   ' }),
        loading: false,
        documentVisible: true,
        now: noon,
      })
    ).toBe(false);

    expect(
      shouldRunAutoRefresh({
        buk: buk(),
        loading: true,
        documentVisible: true,
        now: noon,
      })
    ).toBe(false);

    expect(
      shouldRunAutoRefresh({
        buk: buk(),
        loading: false,
        documentVisible: false,
        now: noon,
      })
    ).toBe(false);
  });

  it('respeta la ventana horaria operativa', () => {
    expect(
      shouldRunAutoRefresh({
        buk: buk(),
        loading: false,
        documentVisible: true,
        now: noon,
      })
    ).toBe(true);
    expect(
      shouldRunAutoRefresh({
        buk: buk(),
        loading: false,
        documentVisible: true,
        now: night,
      })
    ).toBe(false);
  });
});
