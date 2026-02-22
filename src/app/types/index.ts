export type TransactionType = 'income' | 'expense';

export type Category = 
  | 'Ingresos'
  | 'Servicios Básicos' 
  | 'Planilla'
  | 'Proveedores'
  | 'Mantenimiento'
  | 'Impuestos'
  | 'Seguros'
  | 'Área Médica'
  | 'Área Grooming'
  | 'Área Operativa'
  | 'Obras Sedes'
  | 'Préstamos'
  | 'Regalías'
  | 'Comisiones Bancarias'
  | 'Consultas' 
  | 'Cirugías' 
  | 'Farmacia' 
  | 'Alimentos' 
  | 'Alquiler' 
  | 'Sueldos' 
  | 'Servicios' 
  | 'Otros';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: Category | string;
  subcategory?: string;
  description: string;
  date: Date;
  providerId?: string; // Nuevo: Proveedor asociado
  location?: string; // Nuevo: Sede (Principal, Norte, etc.)
}

export interface MonthlyStats {
  name: string;
  total: number;
}

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  id: string;
  name: string;
  provider: string;
  amount: number;
  category: string;
  frequency: Frequency;
  nextDueDate: Date; // La fecha en la que se debe generar el siguiente pago
  active: boolean;
  description?: string;
  lastGeneratedDate?: Date; // Para evitar duplicados el mismo día
}

export interface Provider {
  id: string;
  ruc: string;
  name: string;
  category: Category | string;
  defaultCreditDays: number; // Días de crédito habituales (ej: 0, 15, 30)
  email?: string;
  phone?: string;
  area?: string; // Nuevo: Área de la empresa (ej: Logística, Ventas)
  contactName?: string; // Nuevo: Persona de contacto
  bankName?: string;    // Nuevo: Banco
  bankAccount?: string; // Nuevo: N° de Cuenta / CCI
  defaultExpenseCategory?: string; // Nuevo: Para automatizar clasificación en flujo de caja
  totalPurchased?: number; // Campo calculado para analítica
  type?: 'Mercaderia' | 'Servicios' | 'Médico Externo'; // Nuevo: Tipo de proveedor
  specialty?: string; // Nuevo: Solo para 'Médico Externo'
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type Priority = 'low' | 'medium' | 'high';
export type PaymentCondition = 'cash' | 'credit';

// Lista oficial de sedes del sistema
export const SYSTEM_SEDES = [
  'Benavides',
  'Miraflores',
  'La Molina',
  'San Borja',
  'Magdalena',
  'Chavez',
  'Norte',
  'Principal',
] as const;

export type SedeType = typeof SYSTEM_SEDES[number] | string;

export interface User {
  id: string;
  name: string;
  initials: string;
  role: string;
  email?: string;
  location?: string; // Sede principal (legado)
  sedes?: string[]; // Sedes a las que tiene acceso (vacío o ausente = todas las sedes)
  allSedes?: boolean; // true = acceso a todas las sedes (admin)
  pettyCashLimit?: number; // Límite específico de caja chica para este usuario
  lastLogin?: string; // ISO timestamp del último acceso
  tempPassword?: string; // Contraseña temporal asignada por el super admin
  status?: 'active' | 'inactive'; // Estado del usuario
}

export interface PurchaseRequest {
  id: string;
  providerId: string;
  providerName: string;
  requestDate: Date;
  description: string;
  amount: number;
  location: string;
  priority: Priority;
  paymentCondition: PaymentCondition;
  status: RequestStatus;
  
  // Auditoría
  requesterName: string;
  requesterInitials: string;
  approverName?: string;
  approverInitials?: string;
  rejectionReason?: string;
  approvalComment?: string;
  attachmentUrl?: string;
}

export type InvoiceStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'rejected';

export interface InvoiceDraft {
  id: string;
  file?: File;
  fileName: string;
  provider: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  description: string;
  location: string; // Sede
  subtotal: number;
  igv: number;
  total: number;
  status: InvoiceStatus;
}

// --- TIPOS PARA FONDO FIJO (CAJA CHICA) ---

export interface PettyCashTransaction {
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: 'income' | 'expense'; // Ingreso (Reposición) o Egreso
    location?: string; // Sede
    category: 'Movilidad' | 'Refrigerio' | 'Insumos Limpieza' | 'Material Oficina' | 'Mantenimiento Menor' | 'Otros' | 'Reposición';
    requester: string; // Quien solicitó el dinero
    custodianId?: string; // Usuario responsable del fondo (Caja Chica)
    receiptNumber?: string;
    status: 'pending_audit' | 'approved' | 'rejected' | 'voided';
    weekNumber: number | string; 
    receiptType?: 'Boleta' | 'Factura' | 'RXH' | 'Recibo Simple';
    
    // Nuevos campos
    docType?: 'RUC' | 'DNI' | 'CE';
    docNumber?: string;
    providerName?: string;
    area?: string;
    isExtraExpense?: boolean;
    amountBI?: number;
    igv?: number;
}

export interface PettyCashFund {
    totalLimit: number;
    currentBalance: number;
}

export interface PettyCashSettings {
  totalFundLimit: number; // Monto total del fondo fijo (ej. 1000)
  maxTransactionAmount: number; // Tope por gasto individual (ej. 150)
  alertThreshold: number; // % para alerta de saldo bajo (ej. 20%)
  requireReceiptAbove: number; // Monto mínimo para exigir foto de recibo (ej. 10)
  weeklyClosingDay: number; // Día de la semana para cierre sugerido (5 = Viernes)
}

export interface ProviderSettings {
  categories: string[]; // Categorías comerciales
  areas: string[];      // Áreas de la empresa
}

export interface SystemSettings {
  pettyCash: PettyCashSettings;
  businessName: string;
  businessLogo?: string; // Data URL of the uploaded logo
  currency: string;
  initialBalance?: number;
  initialBalanceDate?: string;
  providers?: ProviderSettings;
}

// --- ALERTS SYSTEM ---
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';
export type AlertType = 'liquidity' | 'expiration' | 'provider_risk' | 'spending_deviation' | 'operational' | 'system' | 'audit' | 'personnel';

export interface SystemAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  type: AlertType;
  category: 'financial' | 'operational' | 'hr' | 'system'; // Nueva agrupación macro
  date: Date; // Fecha de generación
  actionLink?: string; // Ruta interna si se requiere acción (ej. 'invoices')
  actionLabel?: string;
  read: boolean;
  metadata?: any; // Datos extra para contexto
}

// Configuración de umbrales para alertas
export interface AlertThresholds {
    liquidityMinDays: number; // Días de liquidez mínima antes de alerta (ej. 3 días)
    invoiceDueDays: number; // Días antes del vencimiento para alertar (ej. 7 días)
    spendingSpikePercent: number; // % de aumento de gasto para considerar anomalía (ej. 25%)
    pettyCashLowBalance: number; // % de saldo bajo en caja chica (ej. 20%)
    staleRequestDays: number; // Días que una solicitud puede estar pendiente (ej. 3 días)
}

// --- REQUISITION SYSTEM (REQUERIMIENTOS) ---

export type RequisitionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'ordered' | 'partial_received' | 'received';

export interface RequisitionItem {
  id: string;
  name: string; // Nombre del producto/insumo
  quantity: number;
  unit: string; // und, caja, litro, paquete
  category: 'Médico' | 'Grooming' | 'Limpieza' | 'Oficina' | 'Otros';
  notes?: string;
  approvedQuantity?: number; // Cantidad aprobada por Jefa de Compras
  currentStock?: number; // Stock actual en sede (opcional, para referencia)
  status?: 'pending' | 'approved' | 'rejected'; // Estado por ítem
}

export interface Requisition {
  id: string;
  location: string; // Sede solicitante
  requesterId: string;
  requesterName: string;
  date: Date;
  dueDate?: Date; // Fecha esperada
  status: RequisitionStatus;
  items: RequisitionItem[];
  priority: 'low' | 'medium' | 'high';
  
  // Auditoría
  approverId?: string;
  approvalDate?: Date;
  rejectionReason?: string;
  purchaseRequestIds?: string[]; // IDs de las Solicitudes de Compra generadas
  
  // Recepción
  receivedDate?: Date;
  receivedBy?: string;
}