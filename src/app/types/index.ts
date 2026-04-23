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
  /** Subcategoría (ej: Agua, Luz). Si no hay subcategorías en la config, puede usarse para el concepto. */
  subcategory?: string;
  /** Concepto/fila dentro de la subcategoría (ej: Benavides, Miraflores). Si no se usa, el row es subcategory (compatibilidad). */
  concept?: string;
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

/** Línea de “motivo de gasto” permitido en caja chica + cuenta contable sugerida (por proveedor). */
export interface ProviderPettyExpenseLine {
  id: string;
  /** Categoría / motivo (mismo catálogo que caja chica, Config. → Contabilidad). */
  commercialCategory: string;
  /** Cuenta 63/64/65 sugerida para este motivo. */
  defaultAccountingAccount?: string;
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
  /** Código de cuenta de gasto en tu plan (se valida contra plan de cuentas si está cargado). */
  accountingAccount?: string;
  /**
   * Motivos de gasto permitidos en caja chica con cuenta sugerida (varias filas).
   * Si está vacío o ausente, caja chica pide a contabilidad completar en Proveedores.
   */
  pettyExpenseLines?: ProviderPettyExpenseLine[];
  /** Origen del alta para auditoría. */
  registeredVia?: 'full' | 'petty_cash_simple';
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
    /** Solo ingresos: reposición normal vs refuerzo de fondo por administración. */
    incomeSubtype?: 'replenishment' | 'admin_topup';
    location?: string; // Sede
    /** Motivo/categoría comercial: sincronizado con Configuración → Contabilidad → Catálogo. */
    category: string;
    requester: string; // Quien solicitó el dinero
    custodianId?: string; // Usuario responsable del fondo (Caja Chica)
    receiptNumber?: string;
    status: 'pending_audit' | 'approved' | 'rejected' | 'voided';
    weekNumber: number | string; 
    receiptType?:
      | 'Boleta'
      | 'Factura'
      | 'RXH'
      | 'Recibo Simple'
      | 'Planilla de Movilidad';
    /** Fecha del comprobante; si no se indica, se usa `date` en export contable. */
    documentDate?: Date | string;

    /** Serie del comprobante de pago (ej. F001, B002). */
    docSeries?: string;
    /** Número / correlativo del comprobante (no confundir con N° de RUC/DNI). */
    voucherNumber?: string;

    // Nuevos campos
    docType?: 'RUC' | 'DNI' | 'CE';
    /** N° RUC / DNI / CE del proveedor o emisor. */
    docNumber?: string;
    providerName?: string;
    area?: string;
    isExtraExpense?: boolean;
    amountBI?: number;
    igv?: number;
    /**
     * Solo Factura: tasa de IGV aplicada sobre la base imponible (10% o 18%).
     * Si no existe, se asume 18% en cálculos y visualización.
     */
    igvRate?: 0.1 | 0.18;
    /**
     * Solo Factura: importe inafecto / no grava IGV; suma al total a pagar (caja / proveedor).
     */
    amountExempt?: number;
    /** Cuenta de gasto (63/64/65) sugerida vía config. proveedor + motivo. */
    accountingAccount?: string;
    /** Motivo u observación de auditoría (ej. al rechazar). */
    auditComment?: string;
}

export interface PettyCashFund {
    totalLimit: number;
    currentBalance: number;
}

/** Pre-cierre: el responsable presenta la semana para revisión; no bloquea nuevos gastos ni congela saldo. */
export interface PettyCashWeekPreClosure {
    id: string;
    custodianId: string;
    weekNumber: string;
    preClosedAt: string;
    preClosedByUserId?: string;
}

/** Cierre de semana de caja chica por responsable (arrastre de saldo a la semana siguiente). */
export interface PettyCashWeekClosure {
    id: string;
    custodianId: string;
    /** Mismo criterio que `PettyCashTransaction.weekNumber` (p. ej. `format(date, 'w')`). */
    weekNumber: string;
    closedAt: string;
    /** Fondo con el que se abrió la semana al cerrar (para auditoría). */
    openingFund: number;
    /** Total gastado en la semana (egresos válidos). */
    expensesTotal: number;
    /** Saldo al cierre = openingFund - expensesTotal (≥ 0). */
    closingBalance: number;
    /** Lo que arranca la semana siguiente: igual a closingBalance si > 0; si es 0, la siguiente usa el límite configurado. */
    carriedForward: number;
}

/** Formato de impresión de rendición (solo super_admin edita en Configuración). */
export interface PettyCashRenditionPrintSettings {
  documentTitle: string;
  subtitle: string;
  showSedeColumn: boolean;
  showRequesterColumn: boolean;
  showAreaColumn: boolean;
  showCategoryBreakdown: boolean;
  showSignaturesBlock: boolean;
  footerLegal: string;
  /** Logo en data URL (PNG/JPEG/WebP) para encabezado del PDF/HTML de rendición. Si vacío, se puede usar el logo general del negocio como respaldo. */
  reportLogoDataUrl?: string;
}

export interface PettyCashSettings {
  totalFundLimit: number; // Monto total del fondo fijo (ej. 1000)
  maxTransactionAmount: number; // Tope por gasto individual (ej. 150)
  alertThreshold: number; // % para alerta de saldo bajo (ej. 20%)
  requireReceiptAbove: number; // Monto mínimo para exigir foto de recibo (ej. 10)
  weeklyClosingDay: number; // Día de la semana para cierre sugerido (5 = Viernes)
  /** Plantilla de impresión de rendición de caja chica. */
  renditionPrint?: PettyCashRenditionPrintSettings;
  /** Cierres de semana por responsable (saldo arrastrado a la semana siguiente). */
  weekClosures?: PettyCashWeekClosure[];
  /** Pre-cierres presentados por responsables (no sustituyen al cierre ni bloquean gastos). */
  weekPreClosures?: PettyCashWeekPreClosure[];
}

export interface ProviderSettings {
  categories: string[]; // Categorías comerciales
  areas: string[];      // Áreas de la empresa
}

/** Entrada del catálogo de sedes (no se borran; solo se deshabilitan). */
export interface SedeCatalogEntry {
  name: string;
  enabled: boolean;
}

/** Una cuenta del plan contable importado (tu plantilla). */
export interface ChartOfAccountEntry {
  id: string;
  /** Código único (ej. 659121, 42121) — se normaliza a dígitos para comparar. */
  code: string;
  name: string;
  level?: number;
  parentCode?: string;
  /** Cabeceras Starsoft de la plantilla de plan contable. */
  tipoAnexo?: string;
  centroCosto?: string;
  claseCuenta?: string;
  destino?: string;
  partidaPresupuesto?: string;
  ajusteDifCambio?: string;
  cuentaMonetaria?: string;
  conceptoIngGasto?: string;
  codSitFinancieraEstandar?: string;
  codSitFinancieraTrib?: string;
  cuentaCargo?: string;
  cuentaAbono?: string;
  porcentaje?: string;
  plFuncionGroo?: string;
  plplFuncionGoo?: string;
  /** Ayuda para filtros y reglas futuras. */
  kind?: 'expense' | 'tax_igv' | 'cash_bank' | 'other';
  active: boolean;
}

/**
 * Cuentas “puente” para armar asientos: IGV compras, salida caja chica, banco.
 * Los códigos deben existir en el plan importado (validación en UI).
 */
export interface AccountingLinkSettings {
  /** IGV crédito fiscal (compras) — débito cuando el gasto lleva IGV. */
  igvPurchaseCreditAccountCode?: string;
  /** Contrapartida salida de caja chica (haber del total). */
  pettyCashCreditAccountCode?: string;
  /** Cuenta de salida de caja chica por sede (prioriza sobre la global). */
  pettyCashCreditBySede?: Record<string, string>;
  /** Opcional: pago desde cuenta bancaria (si más adelante exportas tesorería). */
  bankPaymentAccountCode?: string;
}

export interface SystemSettings {
  pettyCash: PettyCashSettings;
  businessName: string;
  businessLogo?: string; // Data URL of the uploaded logo
  currency: string;
  initialBalance?: number;
  initialBalanceDate?: string;
  providers?: ProviderSettings;
  /** Enlaces contables globales (IGV, caja, banco). */
  accounting?: AccountingLinkSettings;
  /**
   * Catálogo de sedes. Formato nuevo: `{ name, enabled }[]`.
   * Legacy: `string[]` se normaliza al cargar (todas habilitadas).
   */
  sedesCatalog?: SedeCatalogEntry[] | string[];
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