import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaLiveSedeSummary, AsistenciaStaffLiveState } from '../types/asistencia';
import { ASISTENCIA_LIVE_STATUS_LABELS } from '../types/asistencia';

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function staffRows(staff: AsistenciaStaffLiveState[]): string {
  if (staff.length === 0) {
    return '<tr><td colspan="5" class="muted">Sin personal</td></tr>';
  }
  return staff
    .map(
      (s) => `<tr>
        <td>${escHtml(s.staff.fullName)}</td>
        <td>${escHtml(s.staff.cargoLabel)}</td>
        <td>${escHtml(s.staff.sedeName)}</td>
        <td>${escHtml(ASISTENCIA_LIVE_STATUS_LABELS[s.status])}</td>
        <td>${escHtml(s.entradaFormat ?? s.staff.expectedTime ?? '—')}</td>
      </tr>`
    )
    .join('');
}

export function printAsistenciaLive(input: {
  summaries: AsistenciaLiveSedeSummary[];
  date: Date;
  titleSuffix?: string;
}): void {
  const dateLabel = format(input.date, "EEEE d 'de' MMMM yyyy", { locale: es });
  const title = `Asistencia · ${dateLabel}${input.titleSuffix ? ` · ${input.titleSuffix}` : ''}`;

  const blocks = input.summaries
    .map((summary) => {
      const allStaff = summary.areas.flatMap((a) => a.staff);
      const header = `<h2>${escHtml(summary.sedeName)}</h2>
        <p class="meta">${summary.workingCount} trabajando · ${summary.absentCount} ausentes · ${summary.lateCount} tarde</p>`;
      const table = `<table>
        <thead><tr><th>Nombre</th><th>Cargo</th><th>Sede</th><th>Estado</th><th>Hora</th></tr></thead>
        <tbody>${staffRows(allStaff)}</tbody>
      </table>`;
      return `<section>${header}${table}</section>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: system-ui, sans-serif; font-size: 11px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 16px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #555; margin: 0 0 8px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
  th { background: #f3f4f6; font-size: 10px; }
  .muted { color: #888; text-align: center; }
</style></head><body>
<h1>${escHtml(title)}</h1>
<p class="meta">Impreso ${format(new Date(), "d/MM/yyyy HH:mm")}</p>
${blocks}
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
