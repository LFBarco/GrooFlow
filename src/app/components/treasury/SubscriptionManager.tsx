import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Invoice } from './types'; // Using the Treasury types
import { clsx } from 'clsx';

export interface Subscription {
  id: string;
  name: string;
  providerName: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'quarterly';
  dayOfMonth: number; // Day to generate the obligation (e.g., 5th)
  category: string;
  autoGenerate: boolean;
  lastGenerated?: Date;
  nextDueDate: Date;
}

interface SubscriptionManagerProps {
  onGenerateInvoice: (invoice: Invoice) => void;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onGenerateInvoice }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([
    {
      id: 'sub-1',
      name: 'Alquiler Sede Central',
      providerName: 'Inmobiliaria Centenario',
      amount: 4500.00,
      frequency: 'monthly',
      dayOfMonth: 1,
      category: 'Alquileres',
      autoGenerate: true,
      nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    },
    {
      id: 'sub-2',
      name: 'Internet Fibra Óptica (5 Sedes)',
      providerName: 'Movistar Empresas',
      amount: 890.00,
      frequency: 'monthly',
      dayOfMonth: 15,
      category: 'Servicios Básicos',
      autoGenerate: true,
      nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 15)
    },
    {
      id: 'sub-3',
      name: 'Suscripción Software GrooFlow',
      providerName: 'SaaS Provider Inc',
      amount: 150.00,
      frequency: 'monthly',
      dayOfMonth: 28,
      category: 'Software y Licencias',
      autoGenerate: true,
      nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 28)
    }
  ]);

  const handleGenerate = (sub: Subscription) => {
    // Logic to convert a subscription into a payable invoice
    const newInvoice: Invoice = {
      id: `auto-${Date.now()}`,
      documentNumber: `REC-${new Date().getMonth()+1}-${sub.dayOfMonth}`,
      documentType: 'Servicio',
      providerName: sub.providerName,
      providerRuc: '00000000000', // Placeholder
      amount: sub.amount,
      currency: 'PEN',
      issueDate: new Date(),
      dueDate: sub.nextDueDate,
      tentativePaymentDate: sub.nextDueDate,
      category: sub.category,
      status: 'pending',
      branchId: 'Global', // Or specific branch
      description: `Generado automáticamente: ${sub.name}`,
      fileUrl: '#'
    };

    onGenerateInvoice(newInvoice);
    
    // Update last generated date
    setSubscriptions(prev => prev.map(s => 
      s.id === sub.id ? { ...s, lastGenerated: new Date() } : s
    ));
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-indigo-600" />
            Suscripciones y Gastos Recurrentes
          </h2>
          <p className="text-gray-500 mt-1">
            Define pagos fijos (Alquileres, Servicios, Nómina Fija). El sistema generará las cuentas por pagar automáticamente cada mes.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Nueva Suscripción
        </button>
      </div>

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
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
            >
              {/* Status Indicator Stripe */}
              <div className={clsx(
                "absolute top-0 left-0 w-1 h-full",
                isDueSoon ? "bg-amber-500" : "bg-gray-200"
              )} />

              <div className="flex justify-between items-start mb-4 pl-2">
                <div>
                  <h3 className="font-bold text-gray-900">{sub.name}</h3>
                  <p className="text-sm text-gray-500">{sub.providerName}</p>
                </div>
                <div className="bg-gray-100 p-2 rounded-lg">
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                </div>
              </div>

              <div className="space-y-3 pl-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monto Fijo:</span>
                  <span className="font-bold text-gray-900">S/ {sub.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Frecuencia:</span>
                  <span className="capitalize bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{sub.frequency}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500">Próximo Vencimiento:</span>
                  <div className={clsx(
                    "flex items-center gap-1 font-medium",
                    isDueSoon ? "text-amber-600" : "text-gray-700"
                  )}>
                    <Calendar className="w-3.5 h-3.5" />
                    {sub.nextDueDate.toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="mt-6 pl-2 pt-4 border-t border-gray-100 flex items-center justify-between">
                {alreadyGeneratedThisMonth ? (
                   <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                     <CheckCircle2 className="w-3 h-3" />
                     Generado este mes
                   </span>
                ) : (
                  <button 
                    onClick={() => handleGenerate(sub)}
                    className="flex-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    Generar Obligación
                  </button>
                )}
                
                {!alreadyGeneratedThisMonth && (
                    <button className="ml-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};