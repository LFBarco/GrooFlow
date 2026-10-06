import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { ColaboradorBuk, Telefono, TelefonoDraft, TelefonoEstado, TelefonoTipo } from '../../types/telefonos';
import { createTelefono, TelefonosApiError, updateTelefono } from '../../utils/telefonosApi';
import {
  draftFromTelefono,
  emptyTelefonoDraft,
  normalizePhone,
  suggestColaborador,
  TELEFONO_TIPO_LABEL,
} from '../../utils/telefonosRules';
import { AccountCombobox } from '../ui/account-combobox';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Telefono | null;
  colaboradores: ColaboradorBuk[];
  onSaved: () => void;
};

const NONE = '__none__';

export function TelefonoDialog({ open, onOpenChange, editing, colaboradores, onSaved }: Props) {
  const [draft, setDraft] = useState<TelefonoDraft>(emptyTelefonoDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(editing ? draftFromTelefono(editing) : emptyTelefonoDraft());
    setErrors({});
  }, [open, editing]);

  const set = <K extends keyof TelefonoDraft>(k: K, v: TelefonoDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const options = useMemo(
    () =>
      colaboradores.map((c) => ({
        value: String(c.bukId),
        label: [c.nombreCompleto, c.cargo, c.sede].filter(Boolean).join(' · '),
      })),
    [colaboradores]
  );
  const selected = colaboradores.find((c) => c.bukId === draft.bukId) ?? null;
  const suggestion =
    draft.tipo !== 'persona' ? suggestColaborador(normalizePhone(draft.numero), colaboradores) : null;

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (editing) await updateTelefono(editing.id, draft);
      else await createTelefono(draft);
      toast.success(editing ? 'Línea actualizada' : 'Línea registrada');
      onOpenChange(false);
      onSaved();
    } catch (e) {
      if (e instanceof TelefonosApiError) setErrors(e.fieldErrors);
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar línea' : 'Nueva línea'}</DialogTitle>
          <DialogDescription>
            Asigna el número a un colaborador o regístralo como bot o caso especial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Número</Label>
            <Input value={draft.numero} onChange={(e) => set('numero', e.target.value)} placeholder="987 654 321" />
            {err('numero')}
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={draft.tipo} onValueChange={(v) => set('tipo', v as TelefonoTipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TELEFONO_TIPO_LABEL) as TelefonoTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TELEFONO_TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err('tipo')}
          </div>

          {suggestion ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-300 bg-sky-50 p-2 text-sm text-sky-800 sm:col-span-2 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              <Sparkles className="h-4 w-4" />
              En Buk este número pertenece a <strong>{suggestion.nombreCompleto}</strong>
              {suggestion.cargo ? ` (${suggestion.cargo})` : ''}.
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto h-7"
                onClick={() => setDraft((d) => ({ ...d, tipo: 'persona', bukId: suggestion.bukId }))}
              >
                Asignar
              </Button>
            </div>
          ) : null}

          {draft.tipo === 'persona' ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Colaborador</Label>
              <AccountCombobox
                options={options}
                value={draft.bukId != null ? String(draft.bukId) : NONE}
                noneValue={NONE}
                noneLabel="— Selecciona un colaborador —"
                placeholder="Buscar por nombre, cargo o sede…"
                onChange={(v) => set('bukId', v === NONE ? null : Number(v))}
              />
              {selected ? (
                <p className="text-xs text-muted-foreground">
                  {[selected.cargo, selected.area, selected.sede].filter(Boolean).join(' · ') || 'Sin cargo en Buk'}
                </p>
              ) : null}
              {err('bukId')}
            </div>
          ) : null}

          {draft.tipo === 'bot' || draft.tipo === 'especial' ? (
            <>
              <div className="space-y-1.5">
                <Label>Uso / etiqueta</Label>
                <Input
                  value={draft.etiqueta}
                  onChange={(e) => set('etiqueta', e.target.value)}
                  placeholder={draft.tipo === 'bot' ? 'Bot WhatsApp citas' : 'Emergencias nocturnas'}
                />
                {err('etiqueta')}
              </div>
              <div className="space-y-1.5">
                <Label>Responsable (opcional)</Label>
                <Input
                  value={draft.responsable}
                  onChange={(e) => set('responsable', e.target.value)}
                  placeholder="Área o persona a cargo"
                />
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label>Operador</Label>
            <Input value={draft.operador} onChange={(e) => set('operador', e.target.value)} placeholder="Claro, Movistar, Entel…" />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Input value={draft.plan} onChange={(e) => set('plan', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Costo mensual (S/)</Label>
            <Input inputMode="decimal" value={draft.costoMensual} onChange={(e) => set('costoMensual', e.target.value)} />
            {err('costoMensual')}
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={draft.estado} onValueChange={(v) => set('estado', v as TelefonoEstado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
                <SelectItem value="baja">De baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Equipo</Label>
            <Input value={draft.equipo} onChange={(e) => set('equipo', e.target.value)} placeholder="Marca y modelo" />
          </div>
          <div className="space-y-1.5">
            <Label>IMEI</Label>
            <Input value={draft.imei} onChange={(e) => set('imei', e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Chip (ICCID)</Label>
            <Input value={draft.iccid} onChange={(e) => set('iccid', e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={draft.notas} onChange={(e) => set('notas', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
