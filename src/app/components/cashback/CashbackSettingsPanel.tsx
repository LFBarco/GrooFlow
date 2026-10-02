import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { CashbackCalcMode, CashbackSettings } from '../../types/cashback';
import { saveCashbackSettings } from '../../utils/cashbackApi';
import { cashbackRuleWarnings, computeCashback, describeCashbackRule, formatPen } from '../../utils/cashbackRules';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

type Props = {
  settings: CashbackSettings;
  onSaved: (settings: CashbackSettings) => void;
};

const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')) || 0);

export function CashbackSettingsPanel({ settings, onSaved }: Props) {
  const [form, setForm] = useState<CashbackSettings>(settings);
  const [rucsText, setRucsText] = useState(settings.companyRucs.join(', '));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
    setRucsText(settings.companyRucs.join(', '));
  }, [settings]);

  const set = (patch: Partial<CashbackSettings>) => setForm((f) => ({ ...f, ...patch }));
  const rucs = rucsText
    .split(/[\s,;]+/)
    .map((r) => r.replace(/\D/g, ''))
    .filter((r) => r.length === 11);
  const effective: CashbackSettings = { ...form, companyRucs: rucs };
  const warnings = cashbackRuleWarnings(effective);
  const examples = [20, 50, 118].map((total) => {
    const igv = Math.round((total * 18) / 118 * 100) / 100;
    return { total, igv, cb: computeCashback(effective, igv, total) };
  });

  const save = async () => {
    if (rucs.length === 0) {
      toast.error('Ingresa al menos un RUC de la empresa (11 dígitos).');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCashbackSettings(effective);
      toast.success('Reglas de Cashback guardadas.');
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Regla de cálculo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Tipo de reconocimiento</Label>
              <Select value={form.calcMode} onValueChange={(v) => set({ calcMode: v as CashbackCalcMode })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct_igv">% del IGV de la factura</SelectItem>
                  <SelectItem value="pct_total">% del total de la factura</SelectItem>
                  <SelectItem value="flat">Monto fijo por factura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.calcMode === 'pct_igv' ? (
              <div className="space-y-1">
                <Label>% del IGV que se devuelve</Label>
                <Input inputMode="decimal" value={String(form.pctIgv)} onChange={(e) => set({ pctIgv: num(e.target.value) })} />
              </div>
            ) : form.calcMode === 'pct_total' ? (
              <div className="space-y-1">
                <Label>% del total</Label>
                <Input inputMode="decimal" value={String(form.pctTotal)} onChange={(e) => set({ pctTotal: num(e.target.value) })} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Monto fijo (S/)</Label>
                <Input inputMode="decimal" value={String(form.flatAmount)} onChange={(e) => set({ flatAmount: num(e.target.value) })} />
              </div>
            )}
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Tope: no pagar más que el IGV</p>
                <p className="text-xs text-muted-foreground">Evita perder dinero en facturas pequeñas</p>
              </div>
              <Switch checked={form.capAtIgv} onCheckedChange={(v) => set({ capAtIgv: v })} />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-medium">{describeCashbackRule(effective)}</p>
            <p className="text-xs text-muted-foreground">
              Ejemplos:{' '}
              {examples.map((e) => `factura de ${formatPen(e.total)} (IGV ${formatPen(e.igv)}) → ${formatPen(e.cb)}`).join(' · ')}
            </p>
          </div>
          {warnings.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              {warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Validación y pago</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>RUC(s) de la empresa (adquirente)</Label>
            <Input value={rucsText} onChange={(e) => setRucsText(e.target.value)} placeholder="20601234567, 20509876543" />
            <p className="text-xs text-muted-foreground">Solo se aceptan facturas emitidas a estos RUC.</p>
          </div>
          <div className="space-y-1">
            <Label>Meta para liberar el pago (S/)</Label>
            <Input inputMode="decimal" value={String(form.releaseThreshold)} onChange={(e) => set({ releaseThreshold: num(e.target.value) })} />
            <p className="text-xs text-muted-foreground">El saldo se arrastra mes a mes hasta llegar.</p>
          </div>
          <div className="space-y-1">
            <Label>Antigüedad máxima (días)</Label>
            <Input inputMode="numeric" value={String(form.maxDaysOld)} onChange={(e) => set({ maxDaysOld: Math.round(num(e.target.value)) })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Tratamiento del pago (lo define el contador)</Label>
            <Select value={form.payoutTreatment} onValueChange={(v) => set({ payoutTreatment: v as CashbackSettings['payoutTreatment'] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reembolso">Reembolso de gastos</SelectItem>
                <SelectItem value="remuneracion">Remuneración (planilla, afecta EsSalud)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tasa EsSalud (%)</Label>
            <Input
              inputMode="decimal"
              value={String(form.essaludRate)}
              disabled={form.payoutTreatment !== 'remuneracion'}
              onChange={(e) => set({ essaludRate: num(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Categorías aceptadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {form.categories.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-2">
              <Switch
                checked={c.enabled}
                onCheckedChange={(v) =>
                  set({ categories: form.categories.map((x, i) => (i === idx ? { ...x, enabled: v } : x)) })
                }
              />
              <Input
                value={c.label}
                onChange={(e) =>
                  set({ categories: form.categories.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)) })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                title="Quitar"
                onClick={() => set({ categories: form.categories.filter((_, i) => i !== idx) })}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                categories: [...form.categories, { id: `cat_${Date.now().toString(36)}`, label: 'Nueva categoría', enabled: true }],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Agregar categoría
          </Button>
          <div className="space-y-1 pt-2">
            <Label>Exclusiones (se muestra al colaborador)</Label>
            <Textarea rows={2} value={form.excludedNote} onChange={(e) => set({ excludedNote: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving} className="bg-emerald-600 text-white hover:bg-emerald-500">
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Guardar reglas
        </Button>
      </div>
    </div>
  );
}
