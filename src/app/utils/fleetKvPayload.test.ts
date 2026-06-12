import { describe, expect, it } from 'vitest';
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

  it('mergeFleetKvAndSql prefiere SQL si misma cantidad de secciones pero distinto contenido', () => {
    const kv = normalizeFleetDataset({
      checklistSections: [{ id: 's1', title: 'KV reciente', sortOrder: 0, items: [] }],
    });
    const sql = normalizeFleetDataset({
      checklistSections: [{ id: 's1', title: 'Guardado en SQL', sortOrder: 0, items: [] }],
    });
    const merged = mergeFleetKvAndSql(kv, sql);
    expect(merged.checklistSections[0]?.title).toBe('Guardado en SQL');
  });

  it('mergeFleetKvAndSql respeta borrado en KV cuando SQL aún tiene el vehículo', () => {
    const kv = normalizeFleetDataset({
      vehicles: [{ id: 'v1', plate: 'ABC-123', status: 'active', createdAt: '2026-06-10T10:00:00.000Z' }],
    });
    const sql = normalizeFleetDataset({
      vehicles: [
        { id: 'v1', plate: 'ABC-123', status: 'active', createdAt: '2026-06-10T10:00:00.000Z' },
        { id: 'v2', plate: 'XYZ-999', status: 'active', createdAt: '2026-06-10T10:00:00.000Z' },
      ],
    });
    const merged = mergeFleetKvAndSql(kv, sql);
    expect(merged.vehicles.map((v) => v.id)).toEqual(['v1']);
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
