import { describe, expect, it } from 'vitest';
import type { FleetInspectionRecord } from '../types/fleet';
import { normalizeFleetDataset } from './fleetData';
import { mergeFleetKvAndSql, slimFleetDatasetForKv } from './fleetKvPayload';

describe('fleetKvPayload', () => {
  it('slimFleetDatasetForKv quita dataUrls de firmas', () => {
    const dataset = normalizeFleetDataset({
      inspections: [
        {
          id: 'i1',
          vehicleId: 'v1',
          dateTime: '2026-06-10T10:00:00.000Z',
          driverName: 'Chofer',
          responses: {},
          compliancePercent: 100,
          driverSignatureDataUrl: 'data:image/png;base64,AAAA',
          supervisorSignatureDataUrl: 'data:image/png;base64,BBBB',
          attachments: [
            {
              id: 'a1',
              fileName: 'foto.jpg',
              mimeType: 'image/jpeg',
              dataUrl: 'data:image/jpeg;base64,CCCC',
              uploadedAt: '2026-06-10T10:00:00.000Z',
            },
          ],
          createdAt: '2026-06-10T10:00:00.000Z',
        },
      ],
    });
    const slim = slimFleetDatasetForKv(dataset);
    expect(slim.inspections[0]?.driverSignatureDataUrl).toBe('sql');
    expect(slim.inspections[0]?.attachments[0]?.dataUrl).toBe('');
  });

  it('mergeFleetKvAndSql prefiere inspección con firmas en SQL', () => {
    const kv = normalizeFleetDataset({
      inspections: [
        {
          id: 'i1',
          vehicleId: 'v1',
          dateTime: '2026-06-10T10:00:00.000Z',
          driverName: 'Chofer',
          responses: {},
          compliancePercent: 100,
          driverSignatureDataUrl: 'sql',
          createdAt: '2026-06-10T10:00:00.000Z',
        },
      ],
    });
    const sql = normalizeFleetDataset({
      inspections: [
        {
          id: 'i1',
          vehicleId: 'v1',
          dateTime: '2026-06-10T10:00:00.000Z',
          driverName: 'Chofer',
          responses: {},
          compliancePercent: 100,
          driverSignatureDataUrl: 'data:image/png;base64,REAL',
          createdAt: '2026-06-10T10:00:00.000Z',
        },
      ],
    });
    const merged = mergeFleetKvAndSql(kv, sql);
    expect(merged.inspections[0]?.driverSignatureDataUrl).toContain('base64');
  });
});
