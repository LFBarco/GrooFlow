import type { TurnosChangeLogEntry, TurnosSettings, TurnosWeekPublish } from '../types/turnos';
import { toDateKey } from './turnosCalendar';

const MAX_LOG = 200;

export function newChangeLogId(): string {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export function appendChangeLog(
  settings: TurnosSettings,
  entry: Omit<TurnosChangeLogEntry, 'id' | 'at'>
): TurnosSettings {
  const row: TurnosChangeLogEntry = {
    ...entry,
    id: newChangeLogId(),
    at: new Date().toISOString(),
  };
  const log = [row, ...(settings.changeLog ?? [])].slice(0, MAX_LOG);
  return { ...settings, changeLog: log };
}

export function weekKeyFromDate(date: Date): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getWeekPublishStatus(
  settings: TurnosSettings,
  weekKey: string,
  sede: string
): TurnosWeekPublish | undefined {
  return (settings.publishedWeeks ?? []).find((p) => p.weekKey === weekKey && p.sede === sede);
}

export function isWeekPublished(
  settings: TurnosSettings,
  weekKey: string,
  sede: string
): boolean {
  return getWeekPublishStatus(settings, weekKey, sede)?.status === 'published';
}

export function publishWeek(
  settings: TurnosSettings,
  weekKey: string,
  sede: string,
  by?: string
): TurnosSettings {
  const rest = (settings.publishedWeeks ?? []).filter(
    (p) => !(p.weekKey === weekKey && p.sede === sede)
  );
  const row: TurnosWeekPublish = {
    weekKey,
    sede,
    status: 'published',
    publishedAt: new Date().toISOString(),
    publishedBy: by,
  };
  let next: TurnosSettings = { ...settings, publishedWeeks: [...rest, row] };
  next = appendChangeLog(next, {
    by,
    action: 'week_published',
    detail: `${sede} · ${weekKey}`,
  });
  return next;
}

export function unpublishWeek(
  settings: TurnosSettings,
  weekKey: string,
  sede: string,
  by?: string
): TurnosSettings {
  const rest = (settings.publishedWeeks ?? []).filter(
    (p) => !(p.weekKey === weekKey && p.sede === sede)
  );
  const row: TurnosWeekPublish = { weekKey, sede, status: 'draft' };
  let next: TurnosSettings = { ...settings, publishedWeeks: [...rest, row] };
  next = appendChangeLog(next, {
    by,
    action: 'week_unpublished',
    detail: `${sede} · ${weekKey}`,
  });
  return next;
}

export function weekKeyForAnchor(anchor: Date): string {
  return weekKeyFromDate(anchor);
}

export function todayKeyAudit(): string {
  return toDateKey(new Date());
}
