import React, { useState } from 'react';
import { InvoiceIngest } from './InvoiceIngest';
import { PaymentWorkbench } from './PaymentWorkbench';
import { BankConciliation } from './BankConciliation';
import { SubscriptionManager } from './SubscriptionManager'; 
import { Invoice, BankMovement } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  UploadCloud, 
  CheckCircle2, 
  History, 
  Wallet,
  Building2,
  Calendar,
  Landmark
} from 'lucide-react';
import { clsx } from 'clsx';

export const TreasuryModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ingest' | 'workbench' | 'conciliation' | 'subscriptions' | 'history'>('workbench');
  const [bankBalance, setBankBalance] = useState<number>(54230.50);
  
  // Mock Data Initialization
  const [invoices, setInvoices] = useState<Invoice[]>([
    {
      id: 'inv-001',
      documentNumber: 'F001-4390',
      documentType: 'Factura',
      providerName: 'Distribuidora Farmavet S.A.C.',
      providerRuc: '20556789012',
      amount: 1250.00,
      currency: 'PEN',
      issueDate: new Date(2023, 10, 15),
      dueDate: new Date(2023, 10, 25),
      tentativePaymentDate: new Date(2023, 10, 24),
      category: 'Insumos Médicos',
      status: 'pending',
      branchId: 'Sede Central',
      description: 'Compra mensual antibióticos',
      fileUrl: '#'
    },
    {
      id: 'inv-002',
      documentNumber: 'RxH-E001-22',
      documentType: 'RxH',
      providerName: 'Dr. Carlos Mendez',
      providerRuc: '10445566778',
      amount: 3500.00,
      currency: 'PEN',
      issueDate: new Date(2023, 10, 20),
      dueDate: new Date(2023, 10, 30),
      tentativePaymentDate: new Date(2023, 10, 28),
      category: 'Honorarios Médicos',
      status: 'pending',
      branchId: 'Sede Norte',
      description: 'Servicios cardiología',
      fileUrl: '#'
    },
    {
      id: 'inv-003',
      documentNumber: 'S003-112',
      documentType: 'Factura',
      providerName: 'Luz del Sur S.A.A.',
      providerRuc: '20100156789',
      amount: 845.20,
      currency: 'PEN',
      issueDate: new Date(2023, 10, 10),
      dueDate: new Date(2023, 10, 22),
      tentativePaymentDate: new Date(2023, 10, 21),
      category: 'Servicios Básicos',
      status: 'in_transit', // Already sent to bank
      branchId: 'Sede Sur',
      description: 'Consumo eléctrico Octubre',
      fileUrl: '#'
    }
  ]);

  const [bankMovements, setBankMovements] = useState<BankMovement[]>([
    {
      id: 'mov-001',
      operationNumber: '0089221',
      description: 'Pago de Servicios - Luz del Sur',
      amount: -845.20,
      date: new Date(2023, 10, 21),
      status: 'unmatched',
    },
    {
      id: 'mov-002',
      operationNumber: '0089225',
      description: 'Transferencia Interbancaria - C. Mendez',
      amount: -3500.00,
      date: new Date(2023, 10, 28),
      status: 'unmatched',
    }
  ]);

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
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background text-foreground font-sans animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="bg-card border-b border-border px-8 py-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-8 h-8 text-orange-500" />
            Tesorería Centralizada
          </h1>
          <p className="text-muted-foreground text-sm">GrooFlow Finance Suite • 5 Sedes Conectadas</p>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
             <Landmark className="w-4 h-4" />
             <span className="text-sm font-semibold">Caja Global: S/ {bankBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
           </div>
           <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground border border-border">
             JD
           </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-card border-b border-border px-8 sticky top-[88px] z-10">
        <nav className="flex space-x-8" aria-label="Tabs">
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
              {tab.id === 'ingest' && (
                <span className="ml-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 py-0.5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide">
                  Nuevo
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden p-8 relative bg-muted/5">
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
                invoices={invoices} 
                onSchedulePayment={handleSchedulePayment}
                bankBalance={bankBalance}
              />
            )}

            {activeTab === 'subscriptions' && (
              <SubscriptionManager 
                onGenerateInvoice={handleSubscriptionGenerate}
              />
            )}
            
            {activeTab === 'conciliation' && (
              <BankConciliation 
                movements={bankMovements}
                systemPayments={invoices}
                onConciliate={handleConciliation}
              />
            )}
            
            {activeTab === 'history' && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground space-y-4 border border-dashed border-border rounded-xl bg-card">
                <History className="w-16 h-16 opacity-20" />
                <p className="text-lg font-medium">Historial de pagos conciliados</p>
                <p className="text-sm">Próximamente disponible</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};