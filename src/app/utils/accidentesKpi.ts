import { differenceInMonths, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { User } from '../types';
import type {
  AccidentSeverity,
  AccidentWorkShift,
  AccidentesFilters,
  AccidentesKpiSnapshot,
  AccidentesSettings,
  WorkplaceAccidentRecord,
} from '../types/accidentes';
import {
  countActiveWorkers,
  daysWithoutAccident,
  estimateManHours,
  filterAccidentRecords,
} from './accidentesData';

function monthsInRange(dateFrom: string, dateTo: string): number {
  const from = parseISO(`${dateFrom}T12:00:00`);
  const to = parseISO(`${dateTo}T12:00:00`);
  return Math.max(1, differenceInMonths(to, from) + 1);
}

function hasLostTime(r: WorkplaceAccidentRecord): boolean {
  return r.estimatedLostDays > 0 || r.immediateCare === 'dias_baja';
}

export function computeAccidentesKpis(input: {
  settings: AccidentesSettings;
  filters: AccidentesFilters;
  users: User[];
}): AccidentesKpiSnapshot {
  const { settings, filters, users } = input;
  const records = filterAccidentRecords(settings.records, filters);
  const config = settings.config;

  const accidentsWithLostTime = records.filter(hasLostTime);
  const totalLostDays = records.reduce((sum, r) => sum + (r.estimatedLostDays ?? 0), 0);
  const activeWorkers = countActiveWorkers(users, config);
  const manHours = estimateManHours(
    activeWorkers,
    config,
    monthsInRange(filters.dateFrom, filters.dateTo)
  );

  const frequencyIndex =
    manHours > 0 ? (accidentsWithLostTime.length * 1_000_000) / manHours : 0;
  const gravityIndex = manHours > 0 ? (totalLostDays * 1_000) / manHours : 0;

  const affectedWorkerKeys = new Set(
    records.filter(hasLostTime).map((r) => r.userId ?? r.affectedName.trim().toLowerCase())
  );
  const sinistralityRate =
    activeWorkers > 0 ? (affectedWorkerKeys.size / activeWorkers) * 100 : 0;

  const medicalCost = records.reduce((s, r) => s + (r.medicalCost ?? 0), 0);
  const indemnizationCost = records.reduce((s, r) => s + (r.indemnizationCost ?? 0), 0);
  const lostDaysCost = totalLostDays * config.dailyLostDayCost;
  const totalCost = medicalCost + indemnizationCost + lostDaysCost;

  const lastAccident = [...records].sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0];

  const byAreaMap = new Map<string, number>();
  const bySeverityMap = new Map<AccidentSeverity, number>();
  const byBodyMap = new Map<string, number>();
  const byShiftMap = new Map<AccidentWorkShift, number>();
  const byMonthMap = new Map<string, { count: number; lostDays: number }>();

  for (const r of records) {
    byAreaMap.set(r.workArea, (byAreaMap.get(r.workArea) ?? 0) + 1);
    bySeverityMap.set(r.severity, (bySeverityMap.get(r.severity) ?? 0) + 1);
    byBodyMap.set(r.bodyPart, (byBodyMap.get(r.bodyPart) ?? 0) + 1);
    byShiftMap.set(r.workShift, (byShiftMap.get(r.workShift) ?? 0) + 1);
    const monthKey = r.eventDate.slice(0, 7);
    const prev = byMonthMap.get(monthKey) ?? { count: 0, lostDays: 0 };
    byMonthMap.set(monthKey, {
      count: prev.count + 1,
      lostDays: prev.lostDays + (r.estimatedLostDays ?? 0),
    });
  }

  return {
    totalAccidents: records.length,
    accidentsWithLostTime: accidentsWithLostTime.length,
    totalLostDays,
    frequencyIndex: Math.round(frequencyIndex * 100) / 100,
    gravityIndex: Math.round(gravityIndex * 100) / 100,
    sinistralityRate: Math.round(sinistralityRate * 10) / 10,
    daysWithoutAccident: daysWithoutAccident(settings.records),
    lastAccidentDate: lastAccident?.eventDate ?? null,
    totalCost,
    medicalCost,
    indemnizationCost,
    lostDaysCost,
    manHours: Math.round(manHours),
    activeWorkers,
    byArea: [...byAreaMap.entries()]
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count),
    bySeverity: (['leve', 'grave', 'muy_grave', 'mortal'] as AccidentSeverity[])
      .map((severity) => ({
        severity,
        count: bySeverityMap.get(severity) ?? 0,
      }))
      .filter((x) => x.count > 0),
    byBodyPart: [...byBodyMap.entries()]
      .map(([part, count]) => ({ part, count }))
      .sort((a, b) => b.count - a.count),
    byMonth: [...byMonthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: format(parseISO(`${month}-01T12:00:00`), 'MMM yyyy', { locale: es }),
        count: data.count,
        lostDays: data.lostDays,
      })),
    byShift: (['day', 'night', 'mixed', 'off_duty'] as AccidentWorkShift[])
      .map((shift) => ({
        shift,
        count: byShiftMap.get(shift) ?? 0,
      }))
      .filter((x) => x.count > 0),
  };
}
