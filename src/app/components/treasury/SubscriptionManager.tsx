import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Invoice, Subscription } from './types';
import { clsx } from 'clsx';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { toast } from 'sonner';
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

export type { Subscription } from './types';

interface SubscriptionManagerProps {
  onGenerateInvoice: (invoice: Invoice) => void;
  subscriptions?: Subscription[];
  onUpdateSubscriptions?: (subscriptions: Subscription[]) => void;
}

const EMPTY_FORM = {
  name: '',
  providerName: '',
  amount: '',
  dayOfMonth: '1',
  category: 'Servicios Básicos',
  frequency: 'monthly' as Subscription['frequency'],
};

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  onGenerateInvoice,
  subscriptions: externalSubscriptions,
  onUpdateSubscriptions,
}) => {
  const [subscriptions, setSubscriptionsState] = useState<Subscription[]>(externalSubscriptions ?? []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const setSubscriptions = (updater: Subscription[] | ((prev: Subscription[]) => Subscription[])) => {
    setSubscriptionsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onUpdateSubscriptions?.(next);
      return next;
    });
  };

  React.useEffect(() => {
    if (externalSubscriptions !== undefined) setSubscriptionsState(externalSubscriptions);
  }, [externalSubscriptions]);

  const handleGenerate = (sub: Subscription) => {
    const newInvoice: Invoice = {
      id: `auto-${Date.now()}`,
      documentNumber: `REC-${new Date().getMonth() + 1}-${sub.dayOfMonth}`,
      documentType: 'Servicio',
      providerName: sub.providerName,
      providerRuc: '',
      amount: sub.amount,
      currency: 'PEN',
      issueDate: new Date(),
      dueDate: sub.nextDueDate,
      tentativePaymentDate: sub.nextDueDate,
      category: sub.category,
      status: 'pending',
      branchId: 'Global',
      description: `Generado automáticamente: ${sub.name}`,
    };

    onGenerateInvoice(newInvoice);
    setSubscriptions(prev => prev.map(s =>
      s.id === sub.id ? { ...s, lastGenerated: new Date() } : s
    ));
    toast.success(`Obligación generada: ${sub.name}`);
  };

  const handleCreate = () => {
    const amount = Number(form.amount);
    const dayOfMonth = Math.min(28, Math.max(1, Number(form.dayOfMonth) || 1));
    if (!form.name.trim() || !form.providerName.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Completa nombre, proveedor y un monto válido.');
      return;
    }
    const now = new Date();
    const nextDueDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    if (nextDueDate < now) {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }
    const sub: Subscription = {
      id: `sub-${Date.now()}`,
      name: form.name.trim(),
      providerName: form.providerName.trim(),
      amount,
      frequency: form.frequency,
      dayOfMonth,
      category: form.category.trim() || 'Servicios',
      autoGenerate: true,
      nextDueDate,
    };
    setSubscriptions(prev => [sub, ...prev]);
    setForm(EMPTY_FORM);
    setDialogOpen(false);
    toast.success('Suscripción registrada');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-indigo-500" />
            Suscripciones y Gastos Recurrentes
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Define pagos fijos (alquileres, servicios). Genera la cuenta por pagar cuando corresponda.
          </p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Suscripción
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 px-6 text-center">
          <RefreshCw className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No hay suscripciones registradas</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Agrega alquileres, internet u otros gastos fijos para generar obligaciones de pago cada mes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subscriptions.map(sub => {
            const daysUntilDue = Math.ceil((sub.nextDueDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            const isDueSoon = daysUntilDue <= 7 && daysUntilDue >= 0;
            const alreadyGeneratedThisMonth = sub.lastGenerated && sub.lastGenerated.getMonth() === new Date().getMonth();

            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className={clsx(
                  "absolute top-0 left-0 w-1 h-full",
                  isDueSoon ? "bg-amber-500" : "bg-border"
                )} />

                <div className="flex justify-between items-start mb-4 pl-2">
                  <div>
                    <h3 className="font-bold text-foreground">{sub.name}</h3>
                    <p className="text-sm text-muted-foreground">{sub.providerName}</p>
                  </div>
                  <div className="bg-muted p-2 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-3 pl-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monto Fijo:</span>
                    <span className="font-bold text-foreground">{formatCurrencyEs(sub.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frecuencia:</span>
                    <span className="capitalize bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{sub.frequency}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Próximo Vencimiento:</span>
                    <div className={clsx(
                      "flex items-center gap-1 font-medium",
                      isDueSoon ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                    )}>
                      <Calendar className="w-3.5 h-3.5" />
                      {sub.nextDueDate.toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pl-2 pt-4 border-t border-border flex items-center justify-between">
                  {alreadyGeneratedThisMonth ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Generado este mes
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGenerate(sub)}
                      className="flex-1 bg-background border border-primary/30 text-primary hover:bg-primary/5 text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      Generar Obligación
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
                      toast.success('Suscripción eliminada');
                    }}
                    className="ml-2 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    aria-label="Eliminar suscripción"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva suscripción</DialogTitle>
            <DialogDescription>Registra un gasto recurrente. La obligación se genera cuando pulses el botón del mes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">Nombre</Label>
              <Input id="sub-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alquiler sede central" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-provider">Proveedor</Label>
              <Input id="sub-provider" value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} placeholder="Razón social" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-amount">Monto (S/)</Label>
                <Input id="sub-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-day">Día del mes</Label>
                <Input id="sub-day" type="number" min="1" max="28" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-cat">Categoría</Label>
              <Input id="sub-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleCreate}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
