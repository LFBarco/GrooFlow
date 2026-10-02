import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertTriangle, Camera, FileText, Loader2, QrCode, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { CashbackInvoice, CashbackInvoiceDraft, CashbackSettings } from '../../types/cashback';
import { CashbackApiError, createCashbackInvoice, fetchCashbackPhoto, updateCashbackInvoice } from '../../utils/cashbackApi';
import {
  applyQrToDraft,
  checkCashbackDraft,
  computeCashback,
  emptyCashbackDraft,
  formatPen,
  IGV_SHARE_OF_TOTAL,
  parseMoney,
  parseSunatQr,
  round2,
} from '../../utils/cashbackRules';
import { fetchSunatRucData } from '../../utils/sunatRucApi';
import { InventoryQrScannerDialog } from '../inventory/InventoryQrScannerDialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';

const MAX_IMAGE_SIDE = 1800;
const MAX_FILE_BYTES = 2_500_000;

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function draftFromInvoice(inv: CashbackInvoice): CashbackInvoiceDraft {
  return {
    emisorRuc: inv.emisorRuc,
    emisorNombre: inv.emisorNombre ?? '',
    emisorEstado: inv.emisorEstado ?? '',
    emisorCondicion: inv.emisorCondicion ?? '',
    tipoDoc: inv.tipoDoc || '01',
    serie: inv.serie,
    numero: inv.numero,
    fechaEmision: inv.fechaEmision,
    base: inv.base.toFixed(2),
    igv: inv.igv.toFixed(2),
    total: inv.total.toFixed(2),
    compradorRuc: inv.compradorRuc ?? '',
    categoria: inv.categoria,
    motivo: inv.motivo,
    centroCosto: inv.centroCosto ?? '',
    declaraSinExcluidos: true,
    qrRaw: '',
    photo: '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CashbackSettings;
  /** Factura observada a corregir; null para registrar una nueva. */
  editing: CashbackInvoice | null;
  onSaved: (invoice: CashbackInvoice) => void;
};

export function CashbackInvoiceDialog({ open, onOpenChange, settings, editing, onSaved }: Props) {
  const rawId = useId();
  const qrFileRegionId = `cb-qr-file-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<CashbackInvoiceDraft>(() => emptyCashbackDraft(settings));
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [lookingUpRuc, setLookingUpRuc] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const editingId = editing?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setServerErrors({});
    setPhotoChanged(false);
    setPhotoPreview('');
    if (editing) {
      setDraft(draftFromInvoice(editing));
      if (editing.hasPhoto) {
        fetchCashbackPhoto(editing.id)
          .then((p) => setPhotoPreview(p.dataUrl))
          .catch(() => undefined);
      }
    } else {
      setDraft(emptyCashbackDraft(settings));
    }
    // Solo al abrir o cambiar de factura: no reiniciar lo que el usuario ya escribió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId]);

  const set = (patch: Partial<CashbackInvoiceDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const draftForCheck = editing && !photoChanged ? { ...draft, photo: editing.hasPhoto ? 'existing' : '' } : draft;
  const check = checkCashbackDraft(draftForCheck, settings);
  const errors = { ...check.errors, ...serverErrors } as Record<string, string | undefined>;
  const showError = (field: keyof CashbackInvoiceDraft) => (touched || serverErrors[field] ? errors[field] : undefined);

  const igvNum = parseMoney(draft.igv) ?? 0;
  const totalNum = parseMoney(draft.total) ?? 0;
  const estimated = igvNum > 0 && totalNum > igvNum ? computeCashback(settings, igvNum, totalNum) : 0;

  const lookupRuc = async (ruc: string) => {
    const digits = ruc.replace(/\D/g, '');
    if (digits.length !== 11) return;
    setLookingUpRuc(true);
    try {
      const info = await fetchSunatRucData(digits);
      if (info) {
        setDraft((d) =>
          d.emisorRuc.replace(/\D/g, '') === digits
            ? {
                ...d,
                emisorNombre: info.razonSocial || d.emisorNombre,
                emisorEstado: info.estado ?? '',
                emisorCondicion: info.condicion ?? '',
              }
            : d
        );
      }
    } catch {
      /* la consulta SUNAT es opcional */
    } finally {
      setLookingUpRuc(false);
    }
  };

  const applyQr = (raw: string): boolean => {
    const parsed = parseSunatQr(raw);
    if (!parsed) return false;
    setDraft((d) => applyQrToDraft(d, parsed, raw));
    void lookupRuc(parsed.emisorRuc);
    return true;
  };

  const handleScan = (raw: string) => {
    setScannerOpen(false);
    if (applyQr(raw)) toast.success('Datos de la factura leídos del QR.');
    else toast.error('El código no corresponde a un QR de factura electrónica SUNAT.');
  };

  const tryReadQrFromFile = async (file: File) => {
    let reader: Html5Qrcode | null = null;
    try {
      reader = new Html5Qrcode(qrFileRegionId, { verbose: false });
      const text = await reader.scanFile(file, false);
      if (applyQr(text)) toast.success('QR detectado en la foto: datos completados.');
    } catch {
      /* sin QR legible en la foto: se completa a mano */
    } finally {
      try {
        reader?.clear();
      } catch {
        /* noop */
      }
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessingPhoto(true);
    try {
      let dataUrl: string;
      if (file.type === 'application/pdf') {
        if (file.size > MAX_FILE_BYTES) {
          toast.error('El PDF supera 2.5 MB.');
          return;
        }
        dataUrl = await readAsDataUrl(file);
      } else if (file.type.startsWith('image/')) {
        dataUrl = await compressImage(file);
        void tryReadQrFromFile(file);
      } else {
        toast.error('Formato no admitido. Usa una foto o un PDF.');
        return;
      }
      set({ photo: dataUrl });
      setPhotoChanged(true);
      setPhotoPreview(dataUrl);
      setServerErrors((e) => ({ ...e, photo: '' }));
    } catch {
      toast.error('No se pudo procesar el archivo. Intenta con otra foto.');
    } finally {
      setProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fillIgvFromTotal = () => {
    const total = parseMoney(draft.total);
    if (!total) return;
    const igv = round2(total * IGV_SHARE_OF_TOTAL);
    set({ igv: igv.toFixed(2), base: round2(total - igv).toFixed(2) });
  };

  const submit = async () => {
    setTouched(true);
    if (Object.values(check.errors).some(Boolean)) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    setSaving(true);
    setServerErrors({});
    try {
      const saved = editing
        ? await updateCashbackInvoice(editing.id, draft, photoChanged)
        : await createCashbackInvoice(draft);
      toast.success(editing ? 'Factura corregida y enviada a revisión.' : 'Factura enviada a revisión.');
      onSaved(saved);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof CashbackApiError) {
        setServerErrors(e.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error('No se pudo guardar la factura.');
      }
    } finally {
      setSaving(false);
    }
  };

  const enabledCategories = settings.categories.filter((c) => c.enabled);
  const isPdf = photoPreview.startsWith('data:application/pdf');

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Corregir factura observada' : 'Subir factura'}</DialogTitle>
            <DialogDescription>
              Toma la foto de la factura: si tiene QR, los datos se completan solos. La factura debe estar a nombre
              de la empresa.
            </DialogDescription>
          </DialogHeader>

          {editing?.notaRevision ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              <strong>Observación de Contabilidad:</strong> {editing.notaRevision}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-sm transition',
                showError('photo') ? 'border-rose-500/60 bg-rose-500/5' : 'border-emerald-500/40 hover:bg-emerald-500/5'
              )}
            >
              {processingPhoto ? (
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              ) : photoPreview && !isPdf ? (
                <img src={photoPreview} alt="Factura" className="max-h-40 rounded-md object-contain" />
              ) : photoPreview && isPdf ? (
                <>
                  <FileText className="h-8 w-8 text-emerald-500" />
                  <span className="font-medium">PDF adjunto</span>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 text-emerald-500" />
                  <span className="font-medium">Tomar foto o subir PDF</span>
                </>
              )}
              {photoPreview ? <span className="text-xs text-muted-foreground">Toca para cambiar</span> : null}
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-500/40 p-3 text-sm transition hover:bg-sky-500/5"
            >
              <QrCode className="h-8 w-8 text-sky-500" />
              <span className="font-medium">Escanear QR de la factura</span>
              <span className="text-xs text-muted-foreground">Completa RUC, serie, montos y fecha</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
          {showError('photo') ? <p className="text-xs text-rose-600">{showError('photo')}</p> : null}
          <div id={qrFileRegionId} className="hidden" />

          <div className="grid gap-3 sm:grid-cols-6">
            <div className="space-y-1 sm:col-span-3">
              <Label>RUC del emisor</Label>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  maxLength={11}
                  value={draft.emisorRuc}
                  onChange={(e) => set({ emisorRuc: e.target.value.replace(/\D/g, ''), emisorEstado: '', emisorCondicion: '' })}
                  onBlur={() => void lookupRuc(draft.emisorRuc)}
                  placeholder="20xxxxxxxxx"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => void lookupRuc(draft.emisorRuc)}>
                  {lookingUpRuc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {showError('emisorRuc') ? <p className="text-xs text-rose-600">{showError('emisorRuc')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label>Razón social</Label>
              <Input value={draft.emisorNombre} onChange={(e) => set({ emisorNombre: e.target.value })} placeholder="Se completa con SUNAT" />
              {draft.emisorEstado || draft.emisorCondicion ? (
                <p className="text-xs text-muted-foreground">
                  SUNAT: {draft.emisorEstado || '—'} / {draft.emisorCondicion || '—'}
                </p>
              ) : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Serie</Label>
              <Input value={draft.serie} maxLength={4} onChange={(e) => set({ serie: e.target.value.toUpperCase() })} placeholder="F001" />
              {showError('serie') ? <p className="text-xs text-rose-600">{showError('serie')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Número</Label>
              <Input inputMode="numeric" value={draft.numero} onChange={(e) => set({ numero: e.target.value.replace(/\D/g, '') })} placeholder="12345" />
              {showError('numero') ? <p className="text-xs text-rose-600">{showError('numero')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Fecha de emisión</Label>
              <Input type="date" value={draft.fechaEmision} onChange={(e) => set({ fechaEmision: e.target.value })} />
              {showError('fechaEmision') ? <p className="text-xs text-rose-600">{showError('fechaEmision')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Total (S/)</Label>
              <Input inputMode="decimal" value={draft.total} onChange={(e) => set({ total: e.target.value })} onBlur={() => !draft.igv && fillIgvFromTotal()} placeholder="0.00" />
              {showError('total') ? <p className="text-xs text-rose-600">{showError('total')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="flex items-center justify-between">
                IGV (S/)
                <button type="button" className="text-[11px] font-normal text-sky-600 hover:underline" onClick={fillIgvFromTotal}>
                  Calcular 18%
                </button>
              </Label>
              <Input inputMode="decimal" value={draft.igv} onChange={(e) => set({ igv: e.target.value })} placeholder="0.00" />
              {showError('igv') ? <p className="text-xs text-rose-600">{showError('igv')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Base imponible</Label>
              <Input inputMode="decimal" value={draft.base} onChange={(e) => set({ base: e.target.value })} placeholder="Total − IGV" />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label>RUC de la empresa (adquirente)</Label>
              {settings.companyRucs.length > 1 ? (
                <Select value={draft.compradorRuc} onValueChange={(v) => set({ compradorRuc: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige el RUC" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.companyRucs.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input inputMode="numeric" maxLength={11} value={draft.compradorRuc} onChange={(e) => set({ compradorRuc: e.target.value.replace(/\D/g, '') })} />
              )}
              {showError('compradorRuc') ? <p className="text-xs text-rose-600">{showError('compradorRuc')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label>Categoría</Label>
              <Select value={draft.categoria} onValueChange={(v) => set({ categoria: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="¿Qué compraste?" />
                </SelectTrigger>
                <SelectContent>
                  {enabledCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showError('categoria') ? <p className="text-xs text-rose-600">{showError('categoria')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-4">
              <Label>Motivo / detalle del consumo</Label>
              <Textarea rows={2} value={draft.motivo} onChange={(e) => set({ motivo: e.target.value })} placeholder="Ej. Almuerzo en turno de guardia, taxi a sede San Isidro…" />
              {showError('motivo') ? <p className="text-xs text-rose-600">{showError('motivo')}</p> : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Centro de costo (opcional)</Label>
              <Input value={draft.centroCosto} onChange={(e) => set({ centroCosto: e.target.value })} placeholder="Ej. SJL-OPE" />
            </div>
          </div>

          <label className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', showError('declaraSinExcluidos') ? 'border-rose-500/60' : 'border-border')}>
            <Checkbox
              checked={draft.declaraSinExcluidos}
              onCheckedChange={(v) => set({ declaraSinExcluidos: v === true })}
              className="mt-0.5"
            />
            <span>
              Declaro que esta factura corresponde a un consumo real y <strong>no incluye bebidas alcohólicas ni bienes de uso personal</strong>.
              {settings.excludedNote ? <span className="block text-xs text-muted-foreground">{settings.excludedNote}</span> : null}
            </span>
          </label>

          {check.warnings.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              {check.warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          ) : null}

          {estimated > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
              <Sparkles className="h-4 w-4 shrink-0" />
              Si Contabilidad la aprueba, sumarás aprox. <strong>{formatPen(estimated)}</strong> a tu cashback.
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={saving || processingPhoto} className="bg-emerald-600 text-white hover:bg-emerald-500">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {editing ? 'Reenviar a revisión' : 'Enviar factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InventoryQrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title="Escanear QR de la factura"
        description="Apunta la cámara al código QR impreso en la factura electrónica."
        placeholder="Pega aquí el texto del QR"
      />
    </>
  );
}
