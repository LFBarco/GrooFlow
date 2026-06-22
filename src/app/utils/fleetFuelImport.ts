import { format } from 'date-fns';
import * as XLSX from 'xlsx';

import type { FleetFuelEntry, FleetVehicle } from '../types/fleet';
import { formatDateInputValue, parseTransactionDate } from './transactionDate';

export const FLEET_FUEL_TEMPLATE_FILENAME = 'plantilla_combustible_flota_grooflow.xlsx';

function normalizeImportKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Lee la primera columna con valor entre varios alias. */
export function getFleetFuelImportCell(row: Record<string, unknown>, ...aliases: string[]): unknown {
  for (const a of aliases) {
    const target = normalizeImportKey(a);
    for (const key of Object.keys(row)) {
      if (normalizeImportKey(key) === target) {
        const v = row[key];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
    }
  }
  for (const a of aliases) {
    if (a in row) {
      const v = row[a];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  }
  return undefined;
}

export function normalizeFleetPlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, '');
}

export function parseFleetFuelImportNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim().replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseFullTank(value: unknown): boolean {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  return s === 'si' || s === 'sí' || s === 'yes' || s === '1' || s === 'true' || s === 'x';
}

function newFuelEntryId(): string {
  return `ff_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
}

export type FleetFuelImportParseResult = {
  entries: FleetFuelEntry[];
  /** Máximo odómetro por vehículo importado (para actualizar km actual). */
  vehicleMaxOdometer: Map<string, number>;
  errors: string[];
  skipped: number;
};

export function parseFleetFuelImportRows(
  rows: Record<string, unknown>[],
  vehicles: FleetVehicle[],
  options?: { defaultSede?: string }
): FleetFuelImportParseResult {
  const plateToVehicle = new Map<string, FleetVehicle>();
  for (const v of vehicles) {
    plateToVehicle.set(normalizeFleetPlate(v.plate), v);
  }

  const entries: FleetFuelEntry[] = [];
  const vehicleMaxOdometer = new Map<string, number>();
  const errors: string[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const plateRaw = getFleetFuelImportCell(row, 'Placa', 'PLACA', 'Vehículo', 'Vehiculo');
    if (plateRaw === undefined) {
      skipped += 1;
      return;
    }
    const plate = normalizeFleetPlate(String(plateRaw));
    if (!plate) {
      skipped += 1;
      return;
    }

    const vehicle = plateToVehicle.get(plate);
    if (!vehicle) {
      errors.push(`Fila ${rowNum}: placa «${plateRaw}» no existe en la flota.`);
      return;
    }

    const dateRaw = getFleetFuelImportCell(row, 'Fecha', 'FECHA');
    if (dateRaw === undefined) {
      errors.push(`Fila ${rowNum} (${plate}): falta Fecha.`);
      return;
    }
    const dateStr = formatDateInputValue(parseTransactionDate(dateRaw));

    const odometer = parseFleetFuelImportNumber(
      getFleetFuelImportCell(row, 'Odómetro km', 'Odometro km', 'Odometro', 'Odómetro', 'Km odómetro', 'Km')
    );
    if (odometer === null || odometer < 0) {
      errors.push(`Fila ${rowNum} (${plate}): Odómetro km inválido.`);
      return;
    }

    const liters = parseFleetFuelImportNumber(
      getFleetFuelImportCell(row, 'Litros', 'LITROS', 'L')
    );
    if (liters === null || liters <= 0) {
      errors.push(`Fila ${rowNum} (${plate}): Litros debe ser mayor a 0.`);
      return;
    }

    const totalCost = parseFleetFuelImportNumber(
      getFleetFuelImportCell(row, 'Costo total S/', 'Costo total', 'Costo', 'Total S/', 'Total soles')
    );
    if (totalCost === null || totalCost < 0) {
      errors.push(`Fila ${rowNum} (${plate}): Costo total S/ inválido.`);
      return;
    }

    const locationRaw = getFleetFuelImportCell(row, 'Sede', 'SEDE', 'Base', 'Ubicación', 'Ubicacion');
    const location =
      locationRaw !== undefined
        ? String(locationRaw).trim()
        : (options?.defaultSede?.trim() || vehicle.homeBase?.trim() || undefined);

    const stationRaw = getFleetFuelImportCell(row, 'Estación', 'Estacion', 'Grifo', 'Proveedor');
    const station = stationRaw !== undefined ? String(stationRaw).trim() : undefined;

    const notesRaw = getFleetFuelImportCell(row, 'Notas', 'Nota', 'Observaciones');
    const notes = notesRaw !== undefined ? String(notesRaw).trim() : undefined;

    const fullTankRaw = getFleetFuelImportCell(row, 'Tanque lleno', 'Tanque lleno (Si/No)', 'Full tank');
    const fullTank = fullTankRaw !== undefined ? parseFullTank(fullTankRaw) : false;

    const now = new Date().toISOString();
    entries.push({
      id: newFuelEntryId(),
      vehicleId: vehicle.id,
      date: dateStr,
      odometerKm: odometer,
      liters,
      totalCost,
      station: station || undefined,
      location: location || undefined,
      fullTank,
      notes: notes || undefined,
      createdAt: now,
    });

    const prevMax = vehicleMaxOdometer.get(vehicle.id) ?? vehicle.currentOdometerKm;
    vehicleMaxOdometer.set(vehicle.id, Math.max(prevMax, odometer));
  });

  return { entries, vehicleMaxOdometer, errors, skipped };
}

export function findFleetFuelImportSheet(workbook: XLSX.WorkBook): string {
  const preferred = workbook.SheetNames.find((n) => {
    const lower = n.toLowerCase();
    return (
      lower.includes('combust') ||
      lower.includes('repost') ||
      lower.includes('fuel') ||
      (lower.includes('flota') && !lower.includes('instruc') && !lower.includes('vehic'))
    );
  });
  if (preferred) return preferred;
  const nonMeta = workbook.SheetNames.find(
    (n) =>
      !n.toLowerCase().includes('instruc') &&
      !n.toLowerCase().includes('vehic') &&
      !n.toLowerCase().includes('catalog')
  );
  return nonMeta ?? workbook.SheetNames[0] ?? 'Combustible';
}

export function parseFleetFuelWorkbook(
  data: ArrayBuffer,
  vehicles: FleetVehicle[],
  options?: { defaultSede?: string }
): FleetFuelImportParseResult {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true });
  const sheetName = findFleetFuelImportSheet(workbook);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return {
      entries: [],
      vehicleMaxOdometer: new Map(),
      errors: ['No se encontró una hoja de datos en el archivo.'],
      skipped: 0,
    };
  }
  const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
  if (rows.length === 0) {
    return {
      entries: [],
      vehicleMaxOdometer: new Map(),
      errors: ['La hoja de combustible está vacía.'],
      skipped: 0,
    };
  }
  return parseFleetFuelImportRows(rows, vehicles, options);
}

export function downloadFleetFuelImportTemplate(
  vehicles: FleetVehicle[],
  sedes: string[] = []
): void {
  const sampleVehicle = vehicles[0];
  const sampleDate = format(new Date(), 'yyyy-MM-dd');
  const sampleRows = sampleVehicle
    ? [
        {
          Placa: sampleVehicle.plate,
          Fecha: sampleDate,
          'Odómetro km': sampleVehicle.currentOdometerKm || 0,
          Litros: 45,
          'Costo total S/': 195.5,
          Sede: sampleVehicle.homeBase || sedes[0] || '',
          Estación: 'Grifo ejemplo',
          'Tanque lleno': 'No',
          Notas: 'Ejemplo — borre esta fila antes de importar datos reales',
        },
      ]
    : [
        {
          Placa: 'ABC-123',
          Fecha: sampleDate,
          'Odómetro km': 45000,
          Litros: 45,
          'Costo total S/': 195.5,
          Sede: sedes[0] || 'Principal',
          Estación: 'Grifo ejemplo',
          'Tanque lleno': 'No',
          Notas: 'Registre primero vehículos en la pestaña Flota',
        },
      ];

  const vehiclesSheet = vehicles.length
    ? vehicles.map((v) => ({
        Placa: v.plate,
        Marca: v.brand,
        Modelo: v.model,
        'Sede base': v.homeBase ?? '',
        'Km actual': v.currentOdometerKm,
      }))
    : [{ Nota: 'Sin vehículos registrados — agregue unidades en la pestaña Flota' }];

  const sedesSheet =
    sedes.length > 0
      ? sedes.map((s) => ({ Sede: s }))
      : [{ Sede: 'Principal', Nota: 'Configure sedes en Configuración del sistema' }];

  const instructions = [
    ['Carga masiva de combustible — GrooFlow Flota clínica'],
    [''],
    ['Columnas obligatorias (hoja Combustible):'],
    ['  Placa — debe coincidir con un vehículo registrado (ver hoja Vehículos).'],
    ['  Fecha — yyyy-MM-dd o dd/MM/yyyy (Excel puede usar formato fecha).'],
    ['  Odómetro km — entero o decimal, km al repostar.'],
    ['  Litros — cantidad repostada (> 0).'],
    ['  Costo total S/ — soles pagados por el repostaje.'],
    [''],
    ['Columnas opcionales:'],
    ['  Sede — base del repostaje; si está vacía se usa la sede base del vehículo.'],
    ['  Estación — grifo o proveedor.'],
    ['  Tanque lleno — Si / No (por defecto No).'],
    ['  Notas — observaciones libres.'],
    [''],
    ['Consejos:'],
    ['  · Puede agregar varias filas (un repostaje por fila).'],
    ['  · Tras importar se actualiza el odómetro del vehículo si el km importado es mayor.'],
    ['  · No modifique los nombres de las columnas de la primera fila.'],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows), 'Combustible');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vehiclesSheet), 'Vehículos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sedesSheet), 'Sedes');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instrucciones');
  XLSX.writeFile(wb, FLEET_FUEL_TEMPLATE_FILENAME);
}
