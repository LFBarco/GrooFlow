import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { WorkplaceAccidentRecord } from '../types/accidentes';
import {
  ACCIDENT_CARE_LABELS,
  ACCIDENT_EVENT_TYPE_LABELS,
  ACCIDENT_INSURANCE_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_SHIFT_LABELS,
  ACCIDENT_WORKFLOW_LABELS,
} from '../types/accidentes';
import { formatSeniorityLabel } from './accidentesData';
import { escHtml, printHtmlDocument } from './printHtml';

function dateLabel(ymd?: string): string {
  if (!ymd) return '—';
  try {
    return format(parseISO(`${ymd.slice(0, 10)}T12:00:00`), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

function row(label: string, value?: string | number | null): string {
  const v = value === undefined || value === null || value === '' ? '—' : String(value);
  return `<tr><th>${escHtml(label)}</th><td>${escHtml(v)}</td></tr>`;
}

/**
 * Registro de accidente de trabajo (datos mínimos del Formato 1, RM 050-2013-TR).
 * Se imprime o se guarda como PDF desde el diálogo del navegador.
 */
export function printAccidentReport(record: WorkplaceAccidentRecord): void {
  const eventType = ACCIDENT_EVENT_TYPE_LABELS[record.eventType ?? 'accidente'];
  const actions = (record.correctiveActions ?? [])
    .map(
      (a) => `<tr>
        <td>${escHtml(a.description || '—')}</td>
        <td>${escHtml(a.responsible || '—')}</td>
        <td>${escHtml(a.dueDate ? dateLabel(a.dueDate) : '—')}</td>
        <td>${a.status === 'completada' ? 'Completada' : 'Pendiente'}</td>
      </tr>`
    )
    .join('');
  const leave = record.medicalLeaveFrom
    ? `${dateLabel(record.medicalLeaveFrom)} al ${dateLabel(record.medicalLeaveTo)}`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>Registro de ${escHtml(eventType)} · ${escHtml(record.affectedName)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 11px; color: #111; line-height: 1.4; }
  h1 { font-size: 16px; margin: 0; }
  h2 { font-size: 12px; margin: 14px 0 4px; text-transform: uppercase; letter-spacing: .04em; color: #333; border-bottom: 1px solid #999; padding-bottom: 2px; }
  .meta { color: #555; font-size: 10px; margin: 2px 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  .kv th { width: 34%; text-align: left; font-weight: 600; background: #f5f5f5; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; text-align: left; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .text { border: 1px solid #ccc; padding: 6px; min-height: 40px; white-space: pre-wrap; }
  .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 40px; }
  .sign div { border-top: 1px solid #333; padding-top: 6px; text-align: center; font-size: 10px; }
  .alert { border: 1px solid #b91c1c; color: #b91c1c; padding: 6px; margin-top: 8px; }
</style></head><body>
<h1>Registro de ${escHtml(eventType.toLowerCase())}</h1>
<p class="meta">Código ${escHtml(record.id)} · Estado: ${escHtml(ACCIDENT_WORKFLOW_LABELS[record.workflowStatus ?? 'reportado'])} · Impreso ${format(new Date(), 'd/MM/yyyy HH:mm')} · GrooFlow</p>

<div class="grid">
  <div>
    <h2>Datos del trabajador</h2>
    <table class="kv">
      ${row('Apellidos y nombres', record.affectedName)}
      ${row('Documento', record.documentNumber)}
      ${row('Puesto', record.jobTitle)}
      ${row('Área', record.workArea)}
      ${row('Tipo de contrato', record.contractType)}
      ${row('Fecha de ingreso', record.hireDate ? dateLabel(record.hireDate) : '')}
      ${row('Antigüedad al evento', formatSeniorityLabel(record.seniorityMonths))}
      ${row('Jefe inmediato', record.supervisorName)}
    </table>
  </div>
  <div>
    <h2>Datos del evento</h2>
    <table class="kv">
      ${row('Fecha y hora', `${dateLabel(record.eventDate)} · ${record.eventTime || '—'}`)}
      ${row('Sede', record.sede)}
      ${row('Lugar exacto', record.exactLocation)}
      ${row('Turno', ACCIDENT_SHIFT_LABELS[record.workShift])}
      ${row('Gravedad', ACCIDENT_SEVERITY_LABELS[record.severity])}
      ${row('Testigos', record.witnesses)}
      ${row('Reportado por', record.reportedBy)}
    </table>
  </div>
</div>

<h2>Lesión y atención</h2>
<table class="kv">
  ${row('Naturaleza de la lesión', record.injuryNature)}
  ${row('Parte del cuerpo', record.bodyPart)}
  ${row('Agente causante', record.causingAgent)}
  ${row('Atención inmediata', ACCIDENT_CARE_LABELS[record.immediateCare])}
  ${row('Cobertura', record.insuranceCoverage ? ACCIDENT_INSURANCE_LABELS[record.insuranceCoverage] : '')}
  ${row('Descanso médico', leave)}
  ${row('N.º CITT', record.cittNumber)}
  ${row('Días de baja', record.estimatedLostDays)}
  ${row('Notificación MTPE', record.mtpeNotifiedAt ? `${dateLabel(record.mtpeNotifiedAt)}${record.mtpeNotificationNumber ? ` · N.º ${record.mtpeNotificationNumber}` : ''}` : '')}
</table>
${record.severity === 'mortal' && !record.mtpeNotifiedAt ? '<p class="alert">Accidente mortal: la notificación al MTPE es obligatoria dentro de las 24 horas (DS 005-2012-TR, art. 110).</p>' : ''}

<h2>Descripción del evento</h2>
<div class="text">${escHtml(record.description?.trim() || '')}</div>

<h2>Medidas preventivas</h2>
<div class="text">${escHtml(record.preventiveActions?.trim() || '')}</div>

<h2>Medidas correctivas</h2>
<table>
  <thead><tr><th>Descripción</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th></tr></thead>
  <tbody>${actions || '<tr><td colspan="4">Sin medidas registradas</td></tr>'}</tbody>
</table>

<div class="sign">
  <div>Trabajador afectado<br/>${escHtml(record.affectedName)}</div>
  <div>Jefe inmediato<br/>${escHtml(record.supervisorName || '')}</div>
  <div>Responsable SST / RR. HH.</div>
</div>
</body></html>`;

  void printHtmlDocument(html);
}
