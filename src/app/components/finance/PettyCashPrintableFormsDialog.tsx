import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import type { PettyCashSettings } from '../../types';
import { mergePettyCashPrintCounters } from '../../data/initialData';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { format } from 'date-fns';
import { Printer, FileText, Car } from 'lucide-react';
import { toast } from 'sonner';

function escHtml(s: string): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function padCorr(n: number, len = 7): string {
    const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    return String(v).padStart(len, '0');
}

/** Abre ventana de impresión con HTML listo para A4. */
function printFormattedHtml(title: string, innerBody: string) {
    try {
        const w = window.open('', '_blank');
        if (!w) {
            toast.error('No se abrió la ventana emergente — permitir pop-ups para imprimir.');
            return;
        }
        w.document.write(`<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"/><title>${escHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 18mm 14mm; max-width: 210mm; margin: 0 auto; color: #111; font-size: 11px; line-height: 1.35; }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; letter-spacing: 0.04em; text-transform: uppercase; }
  h2 { font-size: 12px; margin: 0 0 8px; text-align: center; color: #333; font-weight: 600; }
  .muted { font-size: 10px; color: #444; margin-bottom: 12px; text-align: center; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 10px; }
  .lbl { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.06em; }
  .bd { margin-top: 2px; min-height: 18px; border-bottom: 1px solid #333; padding: 2px 0; word-break: break-word; font-size: 11px; }
  table.mv { width: 100%; border-collapse: collapse; margin: 8px 0; }
  table.mv th, table.mv td { border: 1px solid #222; padding: 5px 6px; vertical-align: top; font-size: 10px; }
  table.mv th { background: #f3f4f6; font-weight: 600; font-size: 9px; text-transform: uppercase; }
  .tot { margin-top: 8px; text-align: right; font-weight: 700; font-size: 12px; }
  .sign { display: flex; gap: 32px; margin-top: 28px; justify-content: space-between; flex-wrap: wrap; }
  .sign .sig { flex: 1; min-width: 120px; text-align: center; }
  .line { margin-top: 36px; border-top: 1px solid #111; padding-top: 4px; font-size: 10px; }
  @media print {
    body { padding: 10mm 12mm; }
    .no-print { display: none !important; }
  }
</style>
</head><body>${innerBody}</body></html>`);
        w.document.close();
        w.focus();
        setTimeout(() => {
            try {
                w.print();
            } finally {
                w.close();
            }
        }, 160);
    } catch {
        toast.error('Error al imprimir.');
    }
}

const MOBILITY_ROWS_DEFAULT = 6;

export interface PettyCashPrintableFormsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    businessName: string;
    businessLegalName?: string;
    businessRuc?: string;
    settings: PettyCashSettings;
    currentUserName: string;
    sede: string;
    onPatchPettyCash: (patch: Partial<PettyCashSettings>) => void;
}

export function PettyCashPrintableFormsDialog({
    open,
    onOpenChange,
    businessName,
    businessLegalName,
    businessRuc,
    settings,
    currentUserName,
    sede,
    onPatchPettyCash,
}: PettyCashPrintableFormsDialogProps) {
    const merged = useMemo(() => mergePettyCashPrintCounters(settings.printCounters), [settings.printCounters]);

    /* ——— Recibo simple ——— */
    const [rsSerie, setRsSerie] = useState(merged.simpleReceiptSerie);
    const [rsNum, setRsNum] = useState(padCorr(merged.simpleReceiptNext));
    const [rsFecha, setRsFecha] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [rsEmpresaRuc, setRsEmpresaRuc] = useState('');
    const [rsRecibe, setRsRecibe] = useState('');
    const [rsConcepto, setRsConcepto] = useState('');
    const [rsImporteText, setRsImporteText] = useState('');
    const [rsEnLetras, setRsEnLetras] = useState('');
    const [rsObs, setRsObs] = useState('');
    const [rsAdvance, setRsAdvance] = useState(true);

    /* ——— Planilla movilidad ——— */
    const [mvSerie, setMvSerie] = useState(merged.mobilitySerie);
    const [mvNum, setMvNum] = useState(padCorr(merged.mobilityNext));
    const [mvFecha, setMvFecha] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [mvTrabajador, setMvTrabajador] = useState('');
    const [mvDocumentNumber, setMvDocumentNumber] = useState('');
    const [mvCargoArea, setMvCargoArea] = useState('');
    const [mvOrigen, setMvOrigen] = useState('');
    const [mvDestino, setMvDestino] = useState('');
    const [mvMotivo, setMvMotivo] = useState('');
    const [mvRows, setMvRows] = useState<Array<{ detalle: string; monto: string }>>(() =>
        Array.from({ length: MOBILITY_ROWS_DEFAULT }, () => ({ detalle: '', monto: '' }))
    );
    const [mvAdvance, setMvAdvance] = useState(true);

    useEffect(() => {
        if (!open) return;
        const c = mergePettyCashPrintCounters(settings.printCounters);
        setRsSerie(c.simpleReceiptSerie);
        setRsNum(padCorr(c.simpleReceiptNext));
        setMvSerie(c.mobilitySerie);
        setMvNum(padCorr(c.mobilityNext));
        setRsFecha(format(new Date(), 'yyyy-MM-dd'));
        setMvFecha(format(new Date(), 'yyyy-MM-dd'));
        setMvDocumentNumber('');
        setMvRows(Array.from({ length: MOBILITY_ROWS_DEFAULT }, () => ({ detalle: '', monto: '' })));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- al abrir: tomar correlativos vigentes del servidor
    }, [open]);

    const parseLooseAmount = (raw: string): number => {
        const t = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
        const n = parseFloat(t);
        return Number.isFinite(n) ? n : 0;
    };

    const parseImporteRecibo = (): number => parseLooseAmount(rsImporteText);

    const mobilityTotal = useMemo(() => {
        let s = 0;
        mvRows.forEach((r) => {
            s += parseLooseAmount(r.monto);
        });
        return s;
    }, [mvRows]);

    const buildSimpleReceiptHtml = () => {
        const amt = parseImporteRecibo();
        const fullDoc = `${escHtml(rsSerie.trim())}-${escHtml(rsNum.trim())}`;
        return `
<section>
  <p class="muted">${escHtml(format(new Date(), 'dd/MM/yyyy HH:mm'))} · Sede: ${escHtml(sede)}</p>
  <h1>Recibo interno — Caja</h1>
  <h2>${escHtml(businessName || 'Empresa')}</h2>
  <div class="grid2">
    <div><span class="lbl">RUC empresa (opcional)</span><div class="bd">${rsEmpresaRuc ? escHtml(rsEmpresaRuc) : '—'}</div></div>
    <div><span class="lbl">Documento Serie — Nº</span><div class="bd">${fullDoc}</div></div>
    <div><span class="lbl">Fecha</span><div class="bd">${escHtml(rsFecha)}</div></div>
    <div><span class="lbl">Pagado elaborado desde caja</span><div class="bd">${escHtml(currentUserName)}</div></div>
  </div>
  <div><span class="lbl">Recibí de</span><div class="bd">${escHtml(rsRecibe) || '—'}</div></div>
  <div style="margin-top:8px"><span class="lbl">Concepto / detalle</span><div class="bd">${escHtml(rsConcepto) || '—'}</div></div>
  <div class="grid2" style="margin-top:10px;">
    <div><span class="lbl">Importe (S/)</span><div class="bd font-bold">${escHtml(formatCurrencyEs(amt))}</div></div>
    <div><span class="lbl">Son</span><div class="bd">${escHtml(rsEnLetras) || '—'}</div></div>
  </div>
  ${rsObs.trim() ? `<div style="margin-top:8px"><span class="lbl">Observaciones</span><div class="bd">${escHtml(rsObs)}</div></div>` : ''}
  <div class="sign">
    <div class="sig"><div class="line">Firma y sello solicitante</div></div>
    <div class="sig"><div class="line">${escHtml(currentUserName)} — Cajero/a</div></div>
  </div>
</section>`;
    };

    const buildMobilityHtml = () => {
        const rowsHtml = mvRows
            .map(
                (r, i) =>
                    `<tr><td>${i + 1}</td><td>${escHtml(r.detalle)}</td><td style="text-align:right">${escHtml(formatCurrencyEs(parseLooseAmount(r.monto)))}</td></tr>`
            )
            .join('');
        const doc = `${escHtml(mvSerie.trim())}-${escHtml(mvNum.trim())}`;
        const legalName = (businessLegalName || '').trim() || businessName || 'Empresa';
        const companyRuc = (businessRuc || '').trim();
        return `
<section>
  <p class="muted">${escHtml(format(new Date(), 'dd/MM/yyyy HH:mm'))} · Sede: ${escHtml(sede)} · ${escHtml(businessName || '')}</p>
  <h1>Planilla / liquidación de movilidad</h1>
  <h2>Documento ${doc}</h2>
  <div class="grid2">
    <div><span class="lbl">Razón social</span><div class="bd">${escHtml(legalName)}</div></div>
    <div><span class="lbl">RUC</span><div class="bd">${escHtml(companyRuc || '—')}</div></div>
    <div><span class="lbl">Fecha viático / viaje</span><div class="bd">${escHtml(mvFecha)}</div></div>
    <div><span class="lbl">Nº interno empresa</span><div class="bd">${doc}</div></div>
    <div><span class="lbl">Nombre trabajador</span><div class="bd">${escHtml(mvTrabajador) || '—'}</div></div>
    <div><span class="lbl">Nro de documento</span><div class="bd">${escHtml(mvDocumentNumber) || '—'}</div></div>
    <div><span class="lbl">Cargo / área</span><div class="bd">${escHtml(mvCargoArea) || '—'}</div></div>
  </div>
  <div class="grid2">
    <div><span class="lbl">Origen</span><div class="bd">${escHtml(mvOrigen) || '—'}</div></div>
    <div><span class="lbl">Destino</span><div class="bd">${escHtml(mvDestino) || '—'}</div></div>
  </div>
  <div style="margin-top:8px"><span class="lbl">Motivo del desplazamiento</span><div class="bd">${escHtml(mvMotivo) || '—'}</div></div>
  <table class="mv"><thead><tr><th>N°</th><th>Concepto del gasto (peajes, combustible, estacionamiento, etc.)</th><th>Monto (S/)</th></tr></thead><tbody>${rowsHtml}</tbody></table>
  <div class="tot">Total solicitado — ${escHtml(formatCurrencyEs(mobilityTotal))}</div>
  <div class="sign">
    <div class="sig"><div class="line">${escHtml(mvTrabajador)} (trabajador)</div></div>
    <div class="sig"><div class="line">V°B° Supervisor / jefe directo</div></div>
    <div class="sig"><div class="line">V°B° Administración / tesorería</div></div>
  </div>
  <div style="margin-top: 18px; font-size: 9px; color: #222; line-height: 1.45;">
    <p style="margin: 0 0 6px 0;">
      <strong>Base Legal:</strong> Inciso a1) del artículo 37º del TUO de la Ley del Impuesto a la Renta e inciso v) del artículo 21º del Reglamento de la Ley del Impuesto a la Renta.
    </p>
    <p style="margin: 0;">
      <strong>Nota:</strong> La falta de consignación de la fecha en que se incurrió en el gasto, nombres y apellidos de cada trabajador, número de DNI, motivo y destino del desplazamiento y monto gastado, respecto a cada desplazamiento sólo inhabilita la planilla para la sustentación del gasto que corresponda a tal desplazamiento.
    </p>
  </div>
</section>`;
    };

    const printSimpleOnly = () => {
        printFormattedHtml(`Recibo ${rsSerie}-${rsNum}`, buildSimpleReceiptHtml());
    };

    const printMobilityOnly = () => {
        printFormattedHtml(`Movilidad ${mvSerie}-${mvNum}`, buildMobilityHtml());
    };

    const emitSimple = () => {
        printFormattedHtml(`Recibo ${rsSerie}-${rsNum}`, buildSimpleReceiptHtml());
        if (!rsAdvance) return;
        const parsed = parseInt(rsNum.replace(/\D/g, ''), 10);
        const issued = Number.isFinite(parsed) ? parsed : merged.simpleReceiptNext;
        const nextCounters = mergePettyCashPrintCounters({
            ...merged,
            simpleReceiptSerie: rsSerie.trim() || merged.simpleReceiptSerie,
            simpleReceiptNext: Math.max(merged.simpleReceiptNext, issued + 1),
        });
        onPatchPettyCash({ printCounters: nextCounters });
        setRsSerie(nextCounters.simpleReceiptSerie);
        setRsNum(padCorr(nextCounters.simpleReceiptNext));
        toast.success(
            `Emitido ${nextCounters.simpleReceiptSerie}-${padCorr(issued)}. Siguiente correlativo: ${padCorr(nextCounters.simpleReceiptNext)}.`,
        );
    };

    const emitMobility = () => {
        printFormattedHtml(`Movilidad ${mvSerie}-${mvNum}`, buildMobilityHtml());
        if (!mvAdvance) return;
        const parsed = parseInt(mvNum.replace(/\D/g, ''), 10);
        const issued = Number.isFinite(parsed) ? parsed : merged.mobilityNext;
        const nextCounters = mergePettyCashPrintCounters({
            ...merged,
            mobilitySerie: mvSerie.trim() || merged.mobilitySerie,
            mobilityNext: Math.max(merged.mobilityNext, issued + 1),
        });
        onPatchPettyCash({ printCounters: nextCounters });
        setMvSerie(nextCounters.mobilitySerie);
        setMvNum(padCorr(nextCounters.mobilityNext));
        toast.success(
            `Emitido ${nextCounters.mobilitySerie}-${padCorr(issued)}. Siguiente correlativo: ${padCorr(nextCounters.mobilityNext)}.`,
        );
    };

    const addMobilityRow = () => setMvRows((r) => [...r, { detalle: '', monto: '' }]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5 text-cyan-500" />
                        Recibo simple y planilla de movilidad
                    </DialogTitle>
                    <DialogDescription>
                        Numeración <strong>única a nivel empresa</strong> para todas las sedes. Elija sólo imprimir o emitir correlativo después de imprimir (se guarda en
                        configuración de caja chica).
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="receipt">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="receipt" className="gap-1">
                            <FileText className="h-4 w-4" /> Recibo simple
                        </TabsTrigger>
                        <TabsTrigger value="mobility" className="gap-1">
                            <Car className="h-4 w-4" /> Planilla movilidad
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="receipt" className="space-y-3 pt-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                                <Label>Serie</Label>
                                <Input value={rsSerie} onChange={(e) => setRsSerie(e.target.value)} placeholder="RCC" />
                            </div>
                            <div>
                                <Label>Correlativo</Label>
                                <Input value={rsNum} onChange={(e) => setRsNum(e.target.value)} placeholder="0000001" />
                            </div>
                            <div>
                                <Label>Fecha</Label>
                                <Input type="date" value={rsFecha} onChange={(e) => setRsFecha(e.target.value)} />
                            </div>
                            <div>
                                <Label>Sede impresa</Label>
                                <Input value={sede} readOnly disabled className="bg-muted/60" />
                            </div>
                        </div>
                        <div>
                            <Label>RUC empresa (opcional)</Label>
                            <Input value={rsEmpresaRuc} onChange={(e) => setRsEmpresaRuc(e.target.value)} placeholder="Solo texto de referencia" />
                        </div>
                        <div>
                            <Label>Recibí de (nombre / referencia)</Label>
                            <Input value={rsRecibe} onChange={(e) => setRsRecibe(e.target.value)} />
                        </div>
                        <div>
                            <Label>Concepto / detalle</Label>
                            <Textarea rows={3} value={rsConcepto} onChange={(e) => setRsConcepto(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <Label>Importe S/</Label>
                                <Input value={rsImporteText} onChange={(e) => setRsImporteText(e.target.value)} placeholder="0.00" />
                            </div>
                            <div>
                                <Label>Importe en letras</Label>
                                <Input value={rsEnLetras} onChange={(e) => setRsEnLetras(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <Label>Observaciones</Label>
                            <Textarea rows={2} value={rsObs} onChange={(e) => setRsObs(e.target.value)} />
                        </div>
                        <div className="flex items-center space-x-2 rounded-md border p-2">
                            <Checkbox id="rsa" checked={rsAdvance} onCheckedChange={(c) => setRsAdvance(!!c)} />
                            <label htmlFor="rsa" className="text-xs leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Tras <strong>emitir con correlativo</strong>, grabar siguiente número global (serie arriba; todas las sedes comparten correlativo).
                            </label>
                        </div>
                        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
                            <Button type="button" variant="outline" onClick={printSimpleOnly}>
                                Solo imprimir
                            </Button>
                            <Button type="button" onClick={emitSimple} className="bg-cyan-600 hover:bg-cyan-700">
                                {rsAdvance ? 'Emitir correlativo + imprimir' : 'Abrir vista de impresión'}
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    <TabsContent value="mobility" className="space-y-3 pt-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                                <Label>Serie</Label>
                                <Input value={mvSerie} onChange={(e) => setMvSerie(e.target.value)} />
                            </div>
                            <div>
                                <Label>Correlativo</Label>
                                <Input value={mvNum} onChange={(e) => setMvNum(e.target.value)} />
                            </div>
                            <div>
                                <Label>Fecha viaje/gasto</Label>
                                <Input type="date" value={mvFecha} onChange={(e) => setMvFecha(e.target.value)} />
                            </div>
                            <div>
                                <Label>Sede impresa</Label>
                                <Input value={sede} disabled className="bg-muted/60" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <Label>Razón social</Label>
                                <Input value={businessLegalName || businessName || 'Empresa'} readOnly disabled className="bg-muted/60" />
                            </div>
                            <div>
                                <Label>RUC empresa</Label>
                                <Input value={businessRuc || ''} readOnly disabled className="bg-muted/60" placeholder="Configurar en Información del Negocio" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <Label>Trabajador</Label>
                                <Input value={mvTrabajador} onChange={(e) => setMvTrabajador(e.target.value)} />
                            </div>
                            <div>
                                <Label>Nro de Documento</Label>
                                <Input value={mvDocumentNumber} onChange={(e) => setMvDocumentNumber(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
                            <div>
                                <Label>Cargo / área</Label>
                                <Input value={mvCargoArea} onChange={(e) => setMvCargoArea(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <Label>Origen</Label>
                                <Input value={mvOrigen} onChange={(e) => setMvOrigen(e.target.value)} />
                            </div>
                            <div>
                                <Label>Destino</Label>
                                <Input value={mvDestino} onChange={(e) => setMvDestino(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <Label>Motivo del desplazamiento</Label>
                            <Textarea rows={2} value={mvMotivo} onChange={(e) => setMvMotivo(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Detalle de gastos</Label>
                                <Button type="button" variant="ghost" size="sm" onClick={addMobilityRow}>
                                    + fila
                                </Button>
                            </div>
                            {mvRows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                                    <Input
                                        placeholder={`Concepto ${idx + 1}`}
                                        value={row.detalle}
                                        onChange={(e) => {
                                            const next = [...mvRows];
                                            next[idx] = { ...next[idx]!, detalle: e.target.value };
                                            setMvRows(next);
                                        }}
                                    />
                                    <Input
                                        placeholder="Monto"
                                        value={row.monto}
                                        onChange={(e) => {
                                            const next = [...mvRows];
                                            next[idx] = { ...next[idx]!, monto: e.target.value };
                                            setMvRows(next);
                                        }}
                                    />
                                </div>
                            ))}
                            <p className="text-right text-sm font-medium">Total: {formatCurrencyEs(mobilityTotal)}</p>
                        </div>
                        <div className="flex items-center space-x-2 rounded-md border p-2">
                            <Checkbox id="mva" checked={mvAdvance} onCheckedChange={(c) => setMvAdvance(!!c)} />
                            <label htmlFor="mva" className="text-xs leading-snug">
                                Tras emitir, actualizar correlativo global de planilla (todas las sedes).
                            </label>
                        </div>
                        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
                            <Button type="button" variant="outline" onClick={printMobilityOnly}>
                                Solo imprimir
                            </Button>
                            <Button type="button" onClick={emitMobility} className="bg-cyan-600 hover:bg-cyan-700">
                                {mvAdvance ? 'Emitir correlativo + imprimir' : 'Abrir vista de impresión'}
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
