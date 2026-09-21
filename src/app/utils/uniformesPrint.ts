import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { UniformDeliveryRecord } from '../types/uniformes';
import {
  UNIFORM_ITEM_LABELS,
  UNIFORM_REASON_LABELS,
  UNIFORM_STATUS_LABELS,
} from '../types/uniformes';

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateLabel(ymd: string): string {
  try {
    return format(parseISO(ymd), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

/** Acta de entrega imprimible / guardar como PDF (window.print). */
export function printUniformDeliveryActa(record: UniformDeliveryRecord): void {
  const title = `Acta de entrega de uniformes · ${record.staffName}`;
  const itemsRows = record.items
    .map(
      (item) => `<tr>
        <td>${escHtml(UNIFORM_ITEM_LABELS[item.itemType] ?? item.itemType)}</td>
        <td>${escHtml(item.size)}</td>
        <td>${escHtml(String(item.quantity || 1))}</td>
        <td>${escHtml(item.color?.trim() || '—')}</td>
      </tr>`
    )
    .join('');

  const confirmed = record.receptionConfirmedAt
    ? `<p class="ok">Recepción confirmada el ${escHtml(
        format(new Date(record.receptionConfirmedAt), "d/MM/yyyy HH:mm")
      )}${
        record.receptionConfirmedBy
          ? ` por ${escHtml(record.receptionConfirmedBy)}`
          : ''
      }.</p>`
    : `<p class="warn">Pendiente de confirmación de recepción por el colaborador.</p>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 12px; color: #111; line-height: 1.45; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #555; margin: 0 0 16px; font-size: 11px; }
  .box { border: 1px solid #ccc; padding: 12px; margin: 12px 0; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-size: 11px; }
  .sign { display: flex; gap: 24px; margin-top: 36px; }
  .sign > div { flex: 1; border-top: 1px solid #333; padding-top: 8px; min-height: 64px; }
  .ok { color: #047857; }
  .warn { color: #b45309; }
  .clause { font-size: 11px; color: #333; margin-top: 12px; }
</style></head><body>
<h1>Acta de entrega de uniformes</h1>
<p class="meta">Documento generado ${format(new Date(), "d/MM/yyyy HH:mm")} · GrooFlow</p>

<div class="box">
  <p><strong>Colaborador:</strong> ${escHtml(record.staffName)}</p>
  <p><strong>Documento:</strong> ${escHtml(record.documentNumber || '—')}</p>
  <p><strong>Cargo:</strong> ${escHtml(record.jobTitle || '—')}</p>
  <p><strong>Área padre:</strong> ${escHtml(record.workArea || '—')}</p>
  <p><strong>Sede base:</strong> ${escHtml(record.sede || '—')}</p>
  <p><strong>Fecha de entrega:</strong> ${escHtml(formatDateLabel(record.deliveryDate))}</p>
  <p><strong>Motivo:</strong> ${escHtml(UNIFORM_REASON_LABELS[record.reason] ?? record.reason)}</p>
  <p><strong>Estado:</strong> ${escHtml(UNIFORM_STATUS_LABELS[record.status] ?? record.status)}</p>
  <p><strong>Entregado por:</strong> ${escHtml(record.deliveredBy || '—')}</p>
</div>

<p><strong>Prendas entregadas</strong></p>
<table>
  <thead><tr><th>Prenda</th><th>Talla</th><th>Cant.</th><th>Color</th></tr></thead>
  <tbody>${itemsRows || '<tr><td colspan="4">Sin ítems</td></tr>'}</tbody>
</table>

${record.notes?.trim() ? `<p><strong>Observaciones:</strong> ${escHtml(record.notes.trim())}</p>` : ''}

<p class="clause">
  Declaro haber recibido en buen estado las prendas detalladas, comprometerme a su uso correcto
  según las normas internas y a devolverlas o reponerlas cuando corresponda.
</p>

${confirmed}

<div class="sign">
  <div>
    <strong>Entrega (RRHH / sede)</strong><br/>
    ${escHtml(record.deliveredBy || '________________')}
  </div>
  <div>
    <strong>Recepción (colaborador)</strong><br/>
    ${escHtml(record.staffName)}
  </div>
</div>

<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
