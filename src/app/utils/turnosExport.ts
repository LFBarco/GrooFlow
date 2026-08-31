import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { TurnosRosterEntry, TurnosSettings } from '../types/turnos';
import { TURNO_SHIFT_SHORT } from '../types/turnos';
import { assignmentForCell } from './turnosData';
import { toDateKey, weekRangeLabel } from './turnosCalendar';

function shiftLabel(
  settings: TurnosSettings,
  staff: TurnosRosterEntry,
  dateKey: string,
  workSede: string
): string {
  const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
  const a = assignmentForCell(settings, staff.id, dateKey, cellSede);
  if (!a) return '';
  const base = TURNO_SHIFT_SHORT[a.shift];
  const extras: string[] = [];
  if (a.startTime || a.endTime) extras.push(`${a.startTime ?? ''}-${a.endTime ?? ''}`);
  if (a.notes?.trim()) extras.push(a.notes.trim());
  return extras.length ? `${base} (${extras.join('; ')})` : base;
}

export function exportTurnosWeekExcel(input: {
  settings: TurnosSettings;
  roster: TurnosRosterEntry[];
  weekDays: Date[];
  workSede: string;
  anchor: Date;
}): void {
  const dateKeys = input.weekDays.map(toDateKey);
  const headers = ['Personal', 'Cargo', 'Área', 'Sede', ...dateKeys];
  const rows = input.roster.map((staff) => [
    staff.fullName,
    staff.roleLabel,
    staff.workArea ?? '',
    staff.homeSede,
    ...dateKeys.map((dk) => shiftLabel(input.settings, staff, dk, input.workSede)),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Turnos');
  const sedeSlug = input.workSede.replace(/\s+/g, '-').toLowerCase();
  XLSX.writeFile(
    wb,
    `turnos-${sedeSlug}-${input.weekDays[0] ? toDateKey(input.weekDays[0]) : 'semana'}.xlsx`
  );
}

export function printTurnosWeek(input: {
  settings: TurnosSettings;
  roster: TurnosRosterEntry[];
  weekDays: Date[];
  workSede: string;
  anchor: Date;
}): void {
  const dateKeys = input.weekDays.map(toDateKey);
  const dayHeaders = input.weekDays.map((d) => format(d, 'EEE d', { locale: es }));
  const title = `Turnos · ${input.workSede} · ${weekRangeLabel(input.anchor)}`;

  const rowsHtml = input.roster
    .map((staff) => {
      const cells = dateKeys
        .map((dk) => {
          const label = shiftLabel(input.settings, staff, dk, input.workSede) || '·';
          return `<td>${label}</td>`;
        })
        .join('');
      return `<tr>
        <td class="name">${staff.fullName}<br/><small>${staff.roleLabel}${staff.workArea ? ` · ${staff.workArea}` : ''}</small></td>
        ${cells}
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: landscape; margin: 12mm; }
  body { font-family: system-ui, sans-serif; font-size: 11px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; }
  th { background: #f1f5f9; font-size: 10px; }
  td.name { text-align: left; min-width: 140px; }
  td.name small { color: #64748b; }
  tr:nth-child(even) td { background: #fafafa; }
</style></head>
<body>
  <h1>${title}</h1>
  <p>Generado ${format(new Date(), "d MMM yyyy HH:mm", { locale: es })} · GrooFlow</p>
  <table>
    <thead><tr><th>Personal</th>${dayHeaders.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export function printTurnosDay(input: {
  settings: TurnosSettings;
  roster: TurnosRosterEntry[];
  date: Date;
  workSede: string;
}): void {
  const dateKey = toDateKey(input.date);
  const title = format(input.date, "EEEE d 'de' MMMM yyyy", { locale: es });
  const rowsHtml = input.roster
    .map((staff) => {
      const label = shiftLabel(input.settings, staff, dateKey, input.workSede) || 'Sin turno';
      return `<tr><td class="name">${staff.fullName}</td><td>${staff.roleLabel}</td><td>${label}</td></tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Turno del día</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 12px; padding: 16px; }
  h1 { font-size: 18px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
</style></head>
<body>
  <h1>${title}</h1>
  <p>${input.workSede} · GrooFlow</p>
  <table>
    <thead><tr><th>Personal</th><th>Cargo</th><th>Turno</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
