/**
 * Flota clínica — persistencia SQL directa (Fase 5).
 * Lee/escribe tablas `fleet_*` con RLS + Realtime.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FleetDataset,
  FleetVehicle,
  FleetMaintenanceRecord,
  FleetFuelEntry,
  FleetInspectionRecord,
  FleetChecklistSection,
} from '../../types/fleet';
import { normalizeFleetDataset } from '../../utils/fleetData';
import { deleteRowsByIdBatched, fetchAllRowIds, selectAllRowsPaginated } from './sqlDomainUtils';

export type FleetSqlLoadResult = {
  ok: boolean;
  data: FleetDataset | null;
  /** Tablas SQL vacías pero accesibles */
  empty: boolean;
};

function vehicleRow(v: FleetVehicle, userId: string | null) {
  return {
    id: v.id,
    home_base: v.homeBase?.trim() || null,
    body: v as unknown as Record<string, unknown>,
    user_id: userId,
    updated_at: v.updatedAt || new Date().toISOString(),
  };
}

function maintenanceRow(m: FleetMaintenanceRecord, userId: string | null) {
  return {
    id: m.id,
    vehicle_id: m.vehicleId,
    location: m.location?.trim() || null,
    body: m as unknown as Record<string, unknown>,
    user_id: userId,
    updated_at: m.createdAt || new Date().toISOString(),
  };
}

function fuelRow(f: FleetFuelEntry, userId: string | null) {
  return {
    id: f.id,
    vehicle_id: f.vehicleId,
    location: f.location?.trim() || null,
    body: f as unknown as Record<string, unknown>,
    user_id: userId,
    updated_at: f.createdAt || new Date().toISOString(),
  };
}

function inspectionRow(
  i: FleetInspectionRecord,
  homeBase: string | undefined,
  userId: string | null
) {
  return {
    id: i.id,
    vehicle_id: i.vehicleId,
    home_base: homeBase?.trim() || null,
    body: i as unknown as Record<string, unknown>,
    user_id: userId,
    updated_at: i.createdAt || new Date().toISOString(),
  };
}

function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

async function loadFleetBodies<T>(
  client: SupabaseClient,
  table: string
): Promise<{ items: T[]; missingTable: boolean; errors: string[] }> {
  const { rows, errors, missingTable } = await selectAllRowsPaginated(client, table, {
    select: 'body',
  });
  if (missingTable || errors.length > 0) {
    return { items: [], missingTable, errors };
  }
  return {
    items: rows.map((r) => r.body as T),
    missingTable: false,
    errors: [],
  };
}

export async function loadFleetFromSql(
  client: SupabaseClient,
  vehicleHomeBaseById?: Map<string, string | undefined>
): Promise<FleetSqlLoadResult> {
  const [vehiclesLoad, maintLoad, fuelLoad, inspLoad, checklistRes] = await Promise.all([
    loadFleetBodies<FleetVehicle>(client, 'fleet_vehicles'),
    loadFleetBodies<FleetMaintenanceRecord>(client, 'fleet_maintenance'),
    loadFleetBodies<FleetFuelEntry>(client, 'fleet_fuel_entries'),
    loadFleetBodies<FleetInspectionRecord>(client, 'fleet_inspections'),
    client.from('fleet_checklist').select('sections').eq('id', 'default').maybeSingle(),
  ]);

  const firstMissing =
    vehiclesLoad.missingTable ||
    maintLoad.missingTable ||
    fuelLoad.missingTable ||
    inspLoad.missingTable;
  if (firstMissing) {
    return { ok: false, data: null, empty: true };
  }

  const loadErrors = [
    ...vehiclesLoad.errors,
    ...maintLoad.errors,
    ...fuelLoad.errors,
    ...inspLoad.errors,
    checklistRes.error?.message,
  ].filter(Boolean) as string[];
  if (loadErrors.length > 0 || checklistRes.error) {
    if (checklistRes.error && !isMissingTableError(checklistRes.error)) {
      console.warn('[fleetSql] load error', checklistRes.error);
    }
    if (loadErrors.length > 0) console.warn('[fleetSql] load error', loadErrors);
    return { ok: false, data: null, empty: false };
  }

  const vehicles = vehiclesLoad.items;
  const maintenance = maintLoad.items;
  const fuelEntries = fuelLoad.items;
  const inspections = inspLoad.items;
  const checklistSections = (checklistRes.data?.sections ?? []) as FleetChecklistSection[];

  const homeMap =
    vehicleHomeBaseById ??
    new Map(vehicles.map((v) => [v.id, v.homeBase]));

  const empty =
    vehicles.length === 0 &&
    maintenance.length === 0 &&
    fuelEntries.length === 0 &&
    inspections.length === 0 &&
    checklistSections.length === 0;

  const data = normalizeFleetDataset({
    vehicles,
    maintenance,
    fuelEntries,
    inspections,
    checklistSections,
  });

  void homeMap;
  return { ok: true, data, empty };
}

export type FleetSqlSaveResult = {
  ok: boolean;
  errors: string[];
};

/** Guarda solo la plantilla del checklist (tabla fleet_checklist). */
export async function saveFleetChecklistToSql(
  client: SupabaseClient,
  sections: FleetChecklistSection[]
): Promise<FleetSqlSaveResult> {
  const { error } = await client.from('fleet_checklist').upsert(
    {
      id: 'default',
      sections,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[fleetSql] upsert fleet_checklist', error);
    return { ok: false, errors: [`fleet_checklist: ${error.message}`] };
  }
  return { ok: true, errors: [] };
}

export async function saveFleetToSql(
  client: SupabaseClient,
  dataset: FleetDataset,
  userId: string | null,
  options?: { allowPruneWhenEmpty?: boolean }
): Promise<FleetSqlSaveResult> {
  const errors: string[] = [];
  if (!userId) {
    return { ok: false, errors: ['Sin sesión de usuario (auth.uid)'] };
  }

  const vehicleMap = new Map(dataset.vehicles.map((v) => [v.id, v.homeBase]));

  const vehicleRows = dataset.vehicles.map((v) => vehicleRow(v, userId));
  const maintRows = dataset.maintenance.map((m) => maintenanceRow(m, userId));
  const fuelRows = dataset.fuelEntries.map((f) => fuelRow(f, userId));
  const inspRows = dataset.inspections.map((i) =>
    inspectionRow(i, vehicleMap.get(i.vehicleId), userId)
  );

  const upsert = async (table: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return true;
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      errors.push(`${table}: ${error.message}`);
      console.warn(`[fleetSql] upsert ${table}`, error);
      return false;
    }
    return true;
  };

  const prune = async (table: string, keepIds: Set<string>) => {
    const { ids: existing, errors: listErrors } = await fetchAllRowIds(client, table);
    if (listErrors.length > 0) {
      console.warn(`[fleetSql] prune list ${table}`, listErrors);
      return;
    }
    const toDelete = existing.filter((id) => !keepIds.has(id));
    if (toDelete.length === 0) return;
    const deleteErrors = await deleteRowsByIdBatched(client, table, toDelete);
    if (deleteErrors.length > 0) {
      console.warn(`[fleetSql] prune delete ${table} (no fatal)`, deleteErrors);
    }
  };

  const ids = {
    vehicles: new Set(dataset.vehicles.map((v) => v.id)),
    maintenance: new Set(dataset.maintenance.map((m) => m.id)),
    fuel: new Set(dataset.fuelEntries.map((f) => f.id)),
    inspections: new Set(dataset.inspections.map((i) => i.id)),
  };

  const results = await Promise.all([
    upsert('fleet_vehicles', vehicleRows),
    upsert('fleet_maintenance', maintRows),
    upsert('fleet_fuel_entries', fuelRows),
    upsert('fleet_inspections', inspRows),
    client
      .from('fleet_checklist')
      .upsert(
        {
          id: 'default',
          sections: dataset.checklistSections,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) {
          errors.push(`fleet_checklist: ${error.message}`);
          console.warn('[fleetSql] upsert fleet_checklist', error);
          return false;
        }
        return true;
      }),
  ]);

  if (results.every(Boolean)) {
    const isEmpty =
      dataset.vehicles.length === 0 &&
      dataset.maintenance.length === 0 &&
      dataset.fuelEntries.length === 0 &&
      dataset.inspections.length === 0;
    if (!isEmpty || options?.allowPruneWhenEmpty) {
      await Promise.all([
        prune('fleet_vehicles', ids.vehicles),
        prune('fleet_maintenance', ids.maintenance),
        prune('fleet_fuel_entries', ids.fuel),
        prune('fleet_inspections', ids.inspections),
      ]);
    }
  }

  return { ok: results.every(Boolean) && errors.length === 0, errors };
}

/** Migra blob KV → SQL (one-shot). */
export async function migrateFleetKvToSql(
  client: SupabaseClient,
  kvDataset: FleetDataset,
  userId: string | null
): Promise<boolean> {
  const normalized = normalizeFleetDataset(kvDataset);
  const result = await saveFleetToSql(client, normalized, userId);
  return result.ok;
}

export function isFleetSqlEnabled(): boolean {
  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
  if (backend !== 'supabase') return false;
  return import.meta.env.VITE_FLEET_SQL !== 'false';
}
