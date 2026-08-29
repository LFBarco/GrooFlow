import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Check,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Provider } from '../../types';
import type { SupplierProductOffer, SupplierProductsSettings } from '../../types/supplierProducts';
import {
  approvePendingPrice,
  bestOfferForProduct,
  deactivateOffer,
  offersForProduct,
  priceHistoryForOffer,
  rejectPendingPrice,
  setOfferPreferred,
  upsertSupplierOffer,
  variationPercent,
} from '../../utils/supplierProductsData';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';

type Props = {
  productId: string;
  productName: string;
  providers: Provider[];
  settings: SupplierProductsSettings;
  canEdit: boolean;
  currentUserName: string;
  preferredProviderId?: string;
  onUpdateSettings: (
    updater: (prev: SupplierProductsSettings) => SupplierProductsSettings,
    message?: string
  ) => void;
  /** Sync preferred offer → Product.providerId */
  onPreferredProviderChange?: (providerId: string, providerName: string) => void;
};

type FormState = {
  providerId: string;
  supplierSku: string;
  lastPrice: string;
  currency: 'PEN' | 'USD';
  conversionFactor: string;
  purchaseUnit: string;
  minimumOrderQty: string;
  leadTimeDays: string;
  brand: string;
  presentation: string;
  isPreferred: boolean;
  reason: string;
};

const emptyForm = (providers: Provider[]): FormState => ({
  providerId: providers[0]?.id ?? '',
  supplierSku: '',
  lastPrice: '',
  currency: 'PEN',
  conversionFactor: '1',
  purchaseUnit: 'UND',
  minimumOrderQty: '',
  leadTimeDays: '',
  brand: '',
  presentation: '',
  isPreferred: false,
  reason: '',
});

export function ProductSupplierOffersPanel({
  productId,
  productName,
  providers,
  settings,
  canEdit,
  currentUserName,
  preferredProviderId,
  onUpdateSettings,
  onPreferredProviderChange,
}: Props) {
  const purchaseProviders = useMemo(
    () =>
      providers
        .filter((p) => p.usageContexts?.purchases !== false)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [providers]
  );

  const offers = useMemo(
    () => offersForProduct(settings, productId, false),
    [settings, productId]
  );
  const activeOffers = offers.filter((o) => o.isActive);
  const best = bestOfferForProduct(settings, productId);
  const [form, setForm] = useState<FormState>(() => emptyForm(purchaseProviders));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyOfferId, setHistoryOfferId] = useState<string | null>(null);

  const pendingForProduct = useMemo(
    () =>
      settings.priceHistory.filter(
        (p) =>
          p.status === 'pending_approval' &&
          offers.some((o) => o.id === p.supplierProductId)
      ),
    [settings.priceHistory, offers]
  );

  const startEdit = (offer: SupplierProductOffer) => {
    setEditingId(offer.id);
    setForm({
      providerId: offer.providerId,
      supplierSku: offer.supplierSku ?? '',
      lastPrice: String(offer.lastPrice),
      currency: offer.currency,
      conversionFactor: String(offer.conversionFactor),
      purchaseUnit: offer.purchaseUnit ?? 'UND',
      minimumOrderQty: offer.minimumOrderQty != null ? String(offer.minimumOrderQty) : '',
      leadTimeDays: offer.leadTimeDays != null ? String(offer.leadTimeDays) : '',
      brand: offer.brand ?? '',
      presentation: offer.presentation ?? '',
      isPreferred: offer.isPreferred,
      reason: '',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm(purchaseProviders));
  };

  const saveOffer = () => {
    const provider = purchaseProviders.find((p) => p.id === form.providerId);
    if (!provider) {
      toast.error('Selecciona un proveedor.');
      return;
    }
    const price = Number(form.lastPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Ingresa un precio válido.');
      return;
    }
    const factor = Number(form.conversionFactor) || 1;
    const existing = editingId ? offers.find((o) => o.id === editingId) : undefined;
    const prev = existing?.lastPrice;
    const varPct = prev != null ? Math.abs(variationPercent(prev, price)) : 0;
    if (
      prev != null &&
      varPct > settings.pricePolicy.autoApproveMaxPercent &&
      !form.reason.trim()
    ) {
      toast.error(
        `Variación ${varPct}% supera el umbral auto (${settings.pricePolicy.autoApproveMaxPercent}%). Indica el motivo.`
      );
      return;
    }

    onUpdateSettings((prevSettings) => {
      const { settings: next, priceChangeRequiresApproval } = upsertSupplierOffer(prevSettings, {
        id: editingId ?? undefined,
        productId,
        providerId: provider.id,
        providerName: provider.name,
        supplierSku: form.supplierSku.trim() || undefined,
        brand: form.brand.trim() || undefined,
        presentation: form.presentation.trim() || undefined,
        purchaseUnit: form.purchaseUnit.trim() || undefined,
        conversionFactor: factor,
        lastPrice: price,
        currency: form.currency,
        minimumOrderQty: form.minimumOrderQty ? Number(form.minimumOrderQty) : undefined,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
        isPreferred: form.isPreferred,
        createdBy: currentUserName,
        reason: form.reason.trim() || undefined,
        source: 'manual',
      });
      if (form.isPreferred) {
        onPreferredProviderChange?.(provider.id, provider.name);
      }
      if (priceChangeRequiresApproval) {
        toast.warning('Cambio de precio pendiente de aprobación por la variación detectada.');
      }
      return next;
    }, editingId ? 'Oferta actualizada.' : 'Proveedor vinculado al producto.');

    resetForm();
  };

  const history = historyOfferId ? priceHistoryForOffer(settings, historyOfferId) : [];

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Proveedores y precios</h3>
            <p className="text-xs text-muted-foreground">
              El producto <strong>{productName || 'sin nombre'}</strong> es único. Aquí vinculas
              proveedores, precios y condiciones sin duplicar el ítem.
            </p>
          </div>

          {best && activeOffers.length > 1 ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
              Mejor precio unitario comparable:{' '}
              <strong>
                {best.providerName} — {best.currency} {best.unitComparablePrice.toFixed(4)}
              </strong>
              {preferredProviderId && preferredProviderId !== best.providerId
                ? ' (distinto al preferido configurado)'
                : ''}
            </div>
          ) : null}

          {pendingForProduct.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Precios pendientes de aprobación
              </p>
              {pendingForProduct.map((p) => {
                const offer = offers.find((o) => o.id === p.supplierProductId);
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span>
                      {offer?.providerName ?? 'Proveedor'} · {p.currency} {p.price}
                      {p.variationPercent != null
                        ? ` (${p.variationPercent > 0 ? '+' : ''}${p.variationPercent}%)`
                        : ''}
                      {p.reason ? ` — ${p.reason}` : ''}
                    </span>
                    {canEdit ? (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() =>
                            onUpdateSettings(
                              (s) => approvePendingPrice(s, p.id, currentUserName),
                              'Precio aprobado.'
                            )
                          }
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-rose-600"
                          onClick={() =>
                            onUpdateSettings(
                              (s) => rejectPendingPrice(s, p.id, currentUserName),
                              'Precio rechazado; se revirtió.'
                            )
                          }
                        >
                          <X className="mr-1 h-3 w-3" />
                          Rechazar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">Precio</th>
                  <th className="px-3 py-2 text-right">Unit. equiv.</th>
                  <th className="px-3 py-2">Entrega</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 w-[120px]" />
                </tr>
              </thead>
              <tbody>
                {offers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Aún no hay proveedores vinculados. Agrega la primera oferta abajo.
                    </td>
                  </tr>
                ) : (
                  offers.map((o) => (
                    <tr
                      key={o.id}
                      className="border-t border-border/60 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 font-medium">
                          {o.isPreferred ? (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          ) : null}
                          {o.providerName}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {[o.brand, o.presentation, o.purchaseUnit]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{o.supplierSku || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {o.currency} {o.lastPrice.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {o.currency} {o.unitComparablePrice.toFixed(4)}
                        {o.conversionFactor !== 1 ? (
                          <span className="block text-[10px] text-muted-foreground">
                            factor {o.conversionFactor}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {o.leadTimeDays != null ? `${o.leadTimeDays} d` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={o.isActive ? 'secondary' : 'outline'}>
                          {o.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              setHistoryOfferId((id) => (id === o.id ? null : o.id))
                            }
                          >
                            Hist.
                          </Button>
                          {canEdit && o.isActive ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => startEdit(o)}
                              >
                                Editar
                              </Button>
                              {!o.isPreferred ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  title="Marcar preferido"
                                  onClick={() => {
                                    onUpdateSettings(
                                      (s) => setOfferPreferred(s, o.id),
                                      'Proveedor preferido actualizado.'
                                    );
                                    onPreferredProviderChange?.(o.providerId, o.providerName);
                                  }}
                                >
                                  <Star className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-rose-600"
                                onClick={() =>
                                  onUpdateSettings(
                                    (s) => deactivateOffer(s, o.id),
                                    'Oferta desactivada.'
                                  )
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {historyOfferId && history.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <p className="mb-2 font-medium">Historial de precios</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <span>
                      {format(parseISO(h.createdAt), "d MMM yyyy HH:mm", { locale: es })} ·{' '}
                      {h.currency} {h.price}
                      {h.variationPercent != null
                        ? ` (${h.variationPercent > 0 ? '+' : ''}${h.variationPercent}%)`
                        : ''}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {h.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card className="border-border bg-card">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">
              {editingId ? 'Editar oferta' : 'Vincular proveedor'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Proveedor</Label>
                <Select
                  value={form.providerId}
                  onValueChange={(v) => setForm((f) => ({ ...f, providerId: v }))}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU proveedor</Label>
                <Input
                  value={form.supplierSku}
                  onChange={(e) => setForm((f) => ({ ...f, supplierSku: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precio de compra</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.lastPrice}
                  onChange={(e) => setForm((f) => ({ ...f, lastPrice: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Moneda</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, currency: v as 'PEN' | 'USD' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">PEN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidad compra</Label>
                <Input
                  value={form.purchaseUnit}
                  onChange={(e) => setForm((f) => ({ ...f, purchaseUnit: e.target.value }))}
                  placeholder="UND / CAJA"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Factor → unidad master</Label>
                <Input
                  type="number"
                  min={0.0001}
                  step="1"
                  value={form.conversionFactor}
                  onChange={(e) => setForm((f) => ({ ...f, conversionFactor: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">MOQ</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.minimumOrderQty}
                  onChange={(e) => setForm((f) => ({ ...f, minimumOrderQty: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lead time (días)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.leadTimeDays}
                  onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marca / presentación</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Marca"
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  />
                  <Input
                    placeholder="Presentación"
                    value={form.presentation}
                    onChange={(e) => setForm((f) => ({ ...f, presentation: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <Label className="text-xs">Motivo (si hay alza / cambio de precio)</Label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Ej. Actualización de lista del proveedor"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isPreferred}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, isPreferred: c === true }))}
                />
                Marcar como proveedor preferido de este producto
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={saveOffer}>
                <Plus className="mr-1 h-4 w-4" />
                {editingId ? 'Guardar oferta' : 'Agregar oferta'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Política: hasta {settings.pricePolicy.autoApproveMaxPercent}% se aplica directo; por
              encima queda pendiente de aprobación. Umbral compras{' '}
              {settings.pricePolicy.purchasesApproveMaxPercent}%.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
