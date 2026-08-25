import React, { useState } from 'react';
import { InvoiceIngest } from './InvoiceIngest';
import { PaymentWorkbench } from './PaymentWorkbench';
import { BankConciliation } from './BankConciliation';
import { SubscriptionManager } from './SubscriptionManager'; 
import { Invoice, BankMovement, Subscription } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  UploadCloud, 
  CheckCircle2, 
  History, 
  Building2,
  Calendar,
  Landmark
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrencyEs } from '../../utils/numberFormat';

interface TreasuryModuleProps {
  pendingFeeReceipts?: Array<{
    id: string;
    professionalName: string;
    receiptNumber: string;
    amount: number;
    description: string;
    location?: string;
    dueDate: Date;
    paymentRequestedAt?: Date;
  }>;
  onMarkReceiptPaid?: (receiptId: string, paymentDate: Date) => void;
  // Persistent state props
  treasuryInvoices?: Invoice[];
  onUpdateTreasuryInvoices?: (invoices: Invoice[]) => void;
  bankBalance?: number;
  onUpdateBankBalance?: (balance: number) => void;
  paidHistory?: Invoice[];
  onUpdatePaidHistory?: (history: Invoice[]) => void;
  bankMovements?: BankMovement[];
  onUpdateBankMovements?: (movements: BankMovement[]) => void;
  subscriptions?: Subscription[];
  onUpdateSubscriptions?: (subscriptions: Subscription[]) => void;
  sedeCount?: number;
  userInitials?: string;
}

export const TreasuryModule: React.FC<TreasuryModuleProps> = ({ 
  pendingFeeReceipts = [], 
  onMarkReceiptPaid,
  treasuryInvoices: externalInvoices,
  onUpdateTreasuryInvoices,
  bankBalance: externalBankBalance,
  onUpdateBankBalance,
  paidHistory: externalPaidHistory,
  onUpdatePaidHistory,
  bankMovements: externalBankMovements,
  onUpdateBankMovements,
  subscriptions: externalSubscriptions,
  onUpdateSubscriptions,
  sedeCount = 0,
  userInitials,
}) => {
  const [activeTab, setActiveTab] = useState<'ingest' | 'workbench' | 'conciliation' | 'subscriptions' | 'history'>('workbench');
  
  const [bankBalance, setBankBalanceState] = useState<number>(externalBankBalance ?? 0);
  const setBankBalance = (updater: number | ((prev: number) => number)) => {
    setBankBalanceState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onUpdateBankBalance?.(next);
      return next;
    });
  };

  const [paidHistory, setPaidHistoryState] = useState<Invoice[]>(externalPaidHistory ?? []);
  const setPaidHistory = (updater: Invoice[] | ((prev: Invoice[]) => Invoice[])) => {
    setPaidHistoryState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onUpdatePaidHistory?.(next);
      return next;
    });
  };

  const [invoices, setInvoicesState] = useState<Invoice[]>(externalInvoices ?? []);
  const setInvoices = (updater: Invoice[] | ((prev: Invoice[]) => Invoice[])) => {
    setInvoicesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onUpdateTreasuryInvoices?.(next);
      return next;
    });
  };

  // Sync from external props when they change
  React.useEffect(() => { if (externalInvoices !== undefined) setInvoicesState(externalInvoices); }, [externalInvoices]);
  React.useEffect(() => { if (externalBankBalance !== undefined) setBankBalanceState(externalBankBalance); }, [externalBankBalance]);
  React.useEffect(() => { if (externalPaidHistory !== undefined) setPaidHistoryState(externalPaidHistory); }, [externalPaidHistory]);
  React.useEffect(() => { if (externalBankMovements !== undefined) setBankMovementsState(externalBankMovements); }, [externalBankMovements]);

  const [bankMovements, setBankMovementsState] = useState<BankMovement[]>(externalBankMovements ?? []);
  const setBankMovements = (updater: BankMovement[] | ((prev: BankMovement[]) => BankMovement[])) => {
    setBankMovementsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onUpdateBankMovements?.(next);
      return next;
    });
  };

  const handleIngestComplete = (newInvoices: Invoice[]) => {
    setInvoices(prev => [...prev, ...newInvoices]);
    setActiveTab('workbench'); // Auto-redirect to workbench after upload
  };

  const handleSchedulePayment = (invoiceIds: string[]) => {
    setInvoices(prev => prev.map(inv => {
      if (invoiceIds.includes(inv.id)) {
        return { ...inv, status: 'in_transit' };
      }
      return inv;
    }));
    setActiveTab('conciliation');
  };

  const handleApprovePayment = (invoiceIds: string[]) => {
    const now = new Date();
    
    // Separate regular invoices from fee receipt IDs (prefixed with rxh-)
    const regularIds = invoiceIds.filter(id => !id.startsWith('rxh-'));
    const feeIds = invoiceIds.filter(id => id.startsWith('rxh-'));
    
    const approved = invoices.filter(inv => regularIds.includes(inv.id));
    
    // Build fee receipt invoice objects for history from pendingFeeReceipts
    const approvedFees: Invoice[] = feeIds.map(id => {
      const receipt = pendingFeeReceipts.find(r => `rxh-${r.id}` === id);
      if (!receipt) return null;
      return {
        id,
        documentNumber: receipt.receiptNumber,
        documentType: 'RxH' as const,
        providerName: receipt.professionalName,
        providerRuc: '-',
        amount: receipt.amount,
        currency: 'PEN' as const,
        issueDate: receipt.paymentRequestedAt || now,
        dueDate: receipt.dueDate,
        tentativePaymentDate: receipt.dueDate,
        category: 'Honorarios Profesionales',
        status: 'paid' as const,
        branchId: receipt.location || 'Principal',
        description: receipt.description,
      };
    }).filter(Boolean) as Invoice[];
    
    const allApproved = [...approved, ...approvedFees];
    const totalPaid = allApproved.reduce((sum, inv) => sum + inv.amount, 0);
    setBankBalance(prev => prev - totalPaid);
    
    const paidInvoices = [...approved.map(inv => ({ ...inv, status: 'paid' as const })), ...approvedFees];
    setPaidHistory(prev => [...paidInvoices, ...prev]);
    
    setInvoices(prev => prev.filter(inv => !regularIds.includes(inv.id)));
    
    // Notify fee receipt payments
    feeIds.forEach(id => {
      if (onMarkReceiptPaid) {
        onMarkReceiptPaid(id.replace('rxh-', ''), now);
      }
    });

    toast.success(`${allApproved.length} pago(s) aprobado(s) — ${formatCurrencyEs(totalPaid)} debitados`, {
      description: feeIds.length > 0 ? `Incluye ${feeIds.length} recibo(s) de honorarios` : undefined
    });
  };

  const handleConciliation = (movementId: string, invoiceId: string) => {
    setBankMovements(prev => prev.map(m => m.id === movementId ? { ...m, status: 'matched', matchedInvoiceId: invoiceId } : m));
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'reconciled' } : i));
    
    // Update real balance if not already done
    const movement = bankMovements.find(m => m.id === movementId);
    if (movement) {
      setBankBalance(prev => prev + movement.amount); // amount is negative
    }
  };

  const handleSubscriptionGenerate = (newInvoice: Invoice) => {
    setInvoices(prev => [newInvoice, ...prev]);
    setActiveTab('workbench'); 
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background text-foreground font-sans animate-in fade-in duration-150">
      
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            Tesorería Centralizada
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {sedeCount === 1 ? '1 sede conectada' : `${sedeCount} sedes conectadas`}
          </p>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-6">
           <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
             <Landmark className="w-4 h-4" />
             <span className="text-xs sm:text-sm font-semibold">Caja Global: {formatCurrencyEs(bankBalance)}</span>
           </div>
           {userInitials ? (
             <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground border border-border">
               {userInitials}
             </div>
           ) : null}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-card border-b border-border px-4 sm:px-6 lg:px-8 sticky top-[88px] z-10 overflow-x-auto">
        <nav className="flex space-x-4 sm:space-x-8 min-w-max" aria-label="Tabs">
          {[
            { id: 'ingest', name: 'Buzón de Recepción', icon: UploadCloud },
            { id: 'workbench', name: 'Mesa de Pagos', icon: LayoutDashboard },
            { id: 'subscriptions', name: 'Suscripciones y Fijos', icon: Calendar },
            { id: 'conciliation', name: 'Conciliación Bancaria', icon: CheckCircle2 },
            { id: 'history', name: 'Histórico', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all outline-none",
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className={clsx(
                "mr-2 h-5 w-5",
                activeTab === tab.id ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 relative bg-muted/5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'ingest' && (
              <InvoiceIngest onProcessComplete={handleIngestComplete} />
            )}
            
            {activeTab === 'workbench' && (
              <PaymentWorkbench 
                invoices={[
                  ...invoices,
                  ...pendingFeeReceipts.map(r => ({
                    id: `rxh-${r.id}`,
                    documentNumber: r.receiptNumber,
                    documentType: 'RxH' as const,
                    providerName: r.professionalName,
                    providerRuc: '-',
                    amount: r.amount,
                    currency: 'PEN' as const,
                    issueDate: r.paymentRequestedAt || new Date(),
                    dueDate: r.dueDate,
                    tentativePaymentDate: r.dueDate,
                    category: 'Honorarios Profesionales',
                    status: 'pending' as const,
                    branchId: r.location || 'Principal',
                    description: r.description,
                  }))
                ]}
                onSchedulePayment={handleSchedulePayment}
                onApprovePayment={handleApprovePayment}
                bankBalance={bankBalance}
              />
            )}

            {activeTab === 'subscriptions' && (
              <SubscriptionManager 
                onGenerateInvoice={handleSubscriptionGenerate}
                subscriptions={externalSubscriptions ?? []}
                onUpdateSubscriptions={onUpdateSubscriptions}
              />
            )}
            
            {activeTab === 'conciliation' && (
              <BankConciliation 
                movements={bankMovements}
                systemPayments={invoices}
                onConciliate={handleConciliation}
                onImportMovements={(imported) => setBankMovements((prev) => [...imported, ...prev])}
              />
            )}
            
            {activeTab === 'history' && (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-foreground flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-400" />
                      Historial de Pagos Aprobados
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{paidHistory.length} pagos registrados</p>
                  </div>
                </div>
                {paidHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground space-y-3">
                    <History className="w-12 h-12 opacity-20" />
                    <p className="text-sm">No hay pagos aprobados aún</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">
                        <tr>
                          <th className="px-4 py-3">FECHA PAGO</th>
                          <th className="px-4 py-3">PROVEEDOR / PROFESIONAL</th>
                          <th className="px-4 py-3">DOCUMENTO</th>
                          <th className="px-4 py-3">CATEGORÍA</th>
                          <th className="px-4 py-3 text-right">IMPORTE</th>
                          <th className="px-4 py-3">SEDE</th>
                          <th className="px-4 py-3">ESTADO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paidHistory.map(inv => (
                          <tr key={inv.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {format(inv.issueDate, 'dd/MM/yyyy', { locale: es })}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">{inv.providerName}</div>
                              <div className="text-xs text-muted-foreground font-mono">{inv.providerRuc !== '-' ? `RUC: ${inv.providerRuc}` : ''}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs font-medium">{inv.documentType}</div>
                              <div className="text-xs text-muted-foreground font-mono">{inv.documentNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border">{inv.category}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-500">
                              {formatCurrencyEs(inv.amount)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{inv.branchId}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Pagado</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};