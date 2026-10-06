import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { CashbackInvoice, CashbackInvoiceDraft, CashbackSettings } from '../../types/cashback';
import {
  CashbackApiError,
  type CashbackProviderCheck,
  createCashbackInvoice,
  fetchCashbackPhoto,
  fetchCashbackProvider,
  updateCashbackInvoice,
} from '../../utils/cashbackApi';
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
import { ReceiptCapture } from '../common/ReceiptCapture';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';

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
  const [draft, setDraft] = useState<CashbackInvoiceDraft>(() => emptyCashbackDraft(settings));
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [lookingUpRuc, setLookingUpRuc] = useState(false);
  const [providerCheck, setProviderCheck] = useState<(CashbackProviderCheck & { ruc: string }) | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const editingId = editing?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setServerErrors({});
    setPhotoChanged(false);
    setPhotoPreview('');
    setProviderCheck(null);
    if (editing) {
      setDraft(draftFromInvoice(editing));
      void lookupRuc(editing.emisorRuc);
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

  const rucDigits = draft.emisorRuc.replace(/\D/g, '');
  const providerNotRegistered = providerCheck !== null && providerCheck.ruc === rucDigits && !providerCheck.registered;

  const igvNum = parseMoney(draft.igv) ?? 0;
  const totalNum = parseMoney(draft.total) ?? 0;
  const estimated = igvNum > 0 && totalNum > igvNum ? computeCashback(settings, igvNum, totalNum) : 0;

  const lookupRuc = async (ruc: string) => {
    const digits = ruc.replace(/\D/g, '');
    if (digits.length !== 11) return;
    setLookingUpRuc(true);
    fetchCashbackProvider(digits, draft.categoria)
      .then((p) => setProviderCheck({ ruc: digits, ...p }))
      .catch(() => setProviderCheck(null));
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

  const handlePhoto = (dataUrl: string) => {
    set({ photo: dataUrl });
    setPhotoChanged(true);
    setPhotoPreview(dataUrl);
    setServerErrors((e) => ({ ...e, photo: '' }));
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

          <ReceiptCapture
            photo={photoPreview}
            onPhotoChange={handlePhoto}
            onQr={applyQr}
            error={showError('photo')}
            documentLabel="factura"
            onProcessingChange={setProcessingPhoto}
          />

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
              {providerNotRegistered ? (
                <p className="text-xs text-rose-600">
                  Proveedor no registrado en el catálogo de Proveedores. Pide a Contabilidad que lo registre antes de subir
                  la factura.
                </p>
              ) : providerCheck?.registered && providerCheck.ruc === rucDigits ? (
                <p className="text-xs text-emerald-600">
                  Proveedor registrado{providerCheck.cuentaContable ? ` · Cta. ${providerCheck.cuentaContable}` : ' (Contabilidad asignará la cuenta)'}
                </p>
              ) : null}
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
            <Button onClick={() => void submit()} disabled={saving || processingPhoto || providerNotRegistered} className="bg-emerald-600 text-white hover:bg-emerald-500">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {editing ? 'Reenviar a revisión' : 'Enviar factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
