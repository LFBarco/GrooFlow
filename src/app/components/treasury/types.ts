export type PaymentStatus = 'pending' | 'scheduled' | 'in_transit' | 'paid' | 'reconciled';
export type BankMovementStatus = 'unmatched' | 'matched' | 'review_required';

export interface Invoice {
  id: string;
  providerName: string;
  providerRuc: string;
  amount: number;
  currency: 'PEN' | 'USD';
  issueDate: Date;
  dueDate: Date; // Fecha de vencimiento real
  tentativePaymentDate: Date; // Fecha planificada de pago
  category: string;
  status: PaymentStatus;
  branchId: string; // Sede
  description: string;
  documentType: 'Factura' | 'RxH' | 'Servicio' | 'Planilla';
  documentNumber: string;
  fileUrl?: string;
}

export interface BankMovement {
  id: string;
  operationNumber: string;
  description: string;
  amount: number; // Negativo para egresos
  date: Date;
  status: BankMovementStatus;
  matchedInvoiceId?: string;
}

export interface TreasuryStats {
  totalPending: number;
  totalScheduledToday: number;
  bankBalance: number;
  projectedBalance: number;
}
