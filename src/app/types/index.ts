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
  account?: string;
  currency?: string;
  operation?: string;
  reference?: string;
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
  /** Área solicitante que, junto con el motivo, define la cuenta sugerida. */
  commercialArea?: string;
  /** Cuenta 62/63/64/65 sugerida para este motivo. */
  defaultAccountingAccount?: string;
}

export type ProviderDocIdentityType = 'RUC' | 'DNI' | 'CE';

export interface Provider {
  id: string;
  /**
   * Número de documento (solo dígitos). Longitud: 11 RUC, 8 DNI, 9 CE.
   * El nombre del campo se mantiene por compatibilidad.
   */
  ruc: string;
  /**
   * Tipo de identidad; si no existe (datos viejos), se infiere por la longitud de `ruc`.
   */
  docIdentityType?: ProviderDocIdentityType;
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
  /**
   * Ámbitos en que participa el proveedor (caja chica, compras, honorarios).
   * Si no existe en datos antiguos, se trata como activo en todos.
   */
  usageContexts?: {
    pettyCash?: boolean;
    purchases?: boolean;
    professionalFees?: boolean;
  };
  /** Cuenta N5 sugerida para requisición / reportes de compras. Si no hay, aplica `accountingAccount`. */
  defaultPurchaseAccount?: string;
  /** Cuenta N5 sugerida para recibos por honorarios. Si no hay, aplica `accountingAccount`. */
  defaultProfessionalFeeAccount?: string;
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
  /** Si está activo, el usuario participa en fondo fijo de caja chica. */
  pettyCashFundEnabled?: boolean;
  pettyCashLimit?: number; // Límite específico de caja chica para este usuario
  /** Saldo arrastrado sugerido al abrir el periodo (no suma al límite; precarga para auditoría). */
  pettyCashOpeningCarrySuggested?: number;
  /** ISO: cuando auditoría confirmó apertura con arrastre (ya no aplica el sugerido). */
  pettyCashOpeningCarryConsumedAt?: string;
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

// --- CENTROS DE COSTO (jerarquía analítica) ---

export type CostCenterNodeType = 'classification' | 'area' | 'subarea' | 'role';

export interface CostCenterNode {
  id: string;
  parentId: string | null;
  type: CostCenterNodeType;
  name: string;
  /** Código corto opcional (export / integraciones). */
  code?: string;
  active: boolean;
  sortOrder: number;
  /**
   * Si se informa, el nodo (típicamente rol) solo se ofrece al registrar gastos en esas sedes
   * (nombres exactos del catálogo de sedes). Vacío = todas las sedes.
   */
  sedeIds?: string[];
}

/** Sugerencia: al elegir este motivo de caja chica, pre-seleccionar este centro (rol). */
export interface CostCenterCategoryLink {
  id: string;
  pettyCategory: string;
  costCenterId: string;
}

export interface CostCentersSettings {
  nodes: CostCenterNode[];
  categoryLinks: CostCenterCategoryLink[];
  /**
   * Política en caja chica:
   * - `strict`: si no hay mapeo Motivo -> Centro válido para la sede, bloquea registro.
   * - `flexible`: si no hay mapeo válido, no exige centro de costo en ese registro.
   */
  pettyCashMode?: 'strict' | 'flexible';
}

// --- TIPOS PARA FONDO FIJO (CAJA CHICA) ---

export interface PettyCashTransaction {
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: 'income' | 'expense'; // Ingreso (Reposición) o Egreso
    /** Solo ingresos: reposición normal vs refuerzo de fondo por administración. */
    incomeSubtype?: 'replenishment' | 'admin_topup' | 'fund_delivery';
    location?: string; // Sede
    /** Motivo/categoría comercial: sincronizado con Configuración → Contabilidad → Catálogo. */
    category: string;
    requester: string; // Quien solicitó el dinero
    custodianId?: string; // Usuario responsable del fondo (Caja Chica)
    receiptNumber?: string;
    status: 'pending_audit' | 'approved' | 'rejected' | 'voided';
    /** Semana de operación. Formato nuevo: `YYYY-Www` (ej. `2026-W01`); legado: `1..53`. */
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
    /** Cuenta de gasto (62/63/64/65) sugerida vía config. proveedor + motivo. */
    accountingAccount?: string;
    /** Nodo tipo `role` del árbol de centros de costo (obligatorio en registros nuevos). */
    costCenterId?: string;
    /** Ruta al momento del registro (Clasificación › Área › Subárea › Rol) para reportes si el árbol cambia. */
    costCenterPathSnapshot?: string;
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
    /** Mismo criterio que `PettyCashTransaction.weekNumber` (`YYYY-Www`; compatible con legado `1..53`). */
    weekNumber: string;
    closedAt: string;
    /** Fondo con el que se abrió la semana al cerrar (para auditoría). */
    openingFund: number;
    /** Total gastado en la semana (egresos válidos). */
    expensesTotal: number;
    /** Saldo al cierre = openingFund - expensesTotal (≥ 0). */
    closingBalance: number;
    /** Saldo físico que arrastra a la semana siguiente (efectivo que quedó en caja). */
    carriedForward: number;
}

/** Entrega de dotación semanal confirmada por auditoría (fondo fijo entregado en efectivo). */
export interface PettyCashFundDelivery {
    id: string;
    custodianId: string;
    /** Semana que recibe la dotación (`YYYY-Www`). */
    weekNumber: string;
    /** Monto sugerido según límite configurado del responsable. */
    configuredAmount: number;
    /** Monto efectivamente entregado (editable por auditor). */
    deliveredAmount: number;
    deliveredAt: string;
    deliveredByUserId: string;
    deliveredByName?: string;
    /** Obligatorio si deliveredAmount ≠ configuredAmount. */
    reason?: string;
    /** Arrastre de periodo anterior confirmado en apertura (solo primera semana sin cierre previo). */
    openingCarryAmount?: number;
    /** True si es apertura de periodo (no hay cierre de semana anterior). */
    isPeriodOpening?: boolean;
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

/**
 * Serie y siguiente correlativo para impresiones de control de caja (recibo interno, planilla de movilidad).
 * Una sola serie numérica empresa (independiente de la sede; la sede se imprime en el cuerpo del documento).
 */
export interface PettyCashPrintFormCounters {
  simpleReceiptSerie: string;
  simpleReceiptNext: number;
  mobilitySerie: string;
  mobilityNext: number;
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
  /** Dotaciones semanales confirmadas por auditoría (fondo fijo entregado). */
  fundDeliveries?: PettyCashFundDelivery[];
  /** Numeración de recibo simple y planilla de movilidad (global empresa, todas las sedes). */
  printCounters?: PettyCashPrintFormCounters;
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

export type BankCurrency = 'PEN' | 'USD';

/** Cuenta bancaria de la empresa (tesorería / transacciones). */
export interface BankAccountConfig {
  id: string;
  bankName: string;
  accountNumber: string;
  currency: BankCurrency;
  /** Solo una cuenta puede ser principal en todo el catálogo. */
  isPrimary?: boolean;
}

/**
 * Cuentas “puente” para armar asientos: IGV compras, salida caja chica, banco.
 * Los códigos deben existir en el plan importado (validación en UI).
 */
export interface AccountingLinkSettings {
  /** IGV crédito fiscal (compras) — débito cuando el gasto lleva IGV. */
  igvPurchaseCreditAccountCode?: string;
  /**
   * Débito de gasto cuando el egreso no trae cuenta (histórico / proveedor sin mapeo).
   * Ej. 659 — para que aparezcan en vista previa y export; contabilidad puede corregir en Starsoft.
   */
  pettyCashUnknownExpenseAccountCode?: string;
  /** Contrapartida salida de caja chica (haber del total). */
  pettyCashCreditAccountCode?: string;
  /** Cuenta de salida de caja chica por sede (prioriza sobre la global). */
  pettyCashCreditBySede?: Record<string, string>;
  /** Opcional: pago desde cuenta bancaria (si más adelante exportas tesorería). */
  bankPaymentAccountCode?: string;
  /** Cuentas bancarias operativas (Flujo de caja / transacciones). */
  bankAccounts?: BankAccountConfig[];
}

export interface SystemSettings {
  pettyCash: PettyCashSettings;
  /** Árbol de centros de costo + reglas de motivo caja chica → centro sugerido. */
  costCenters?: CostCentersSettings;
  businessName: string;
  /** Razón social registrada de la empresa (para documentos formales). */
  businessLegalName: string;
  /** RUC de la empresa. */
  businessRuc: string;
  businessLogo?: string; // Data URL of the uploaded logo
  currency: string;
  initialBalance?: number;
  initialBalanceDate?: string;
  providers?: ProviderSettings;
  /** Enlaces contables globales (IGV, caja, banco). */
  accounting?: AccountingLinkSettings;
  /**
   * Proyección inteligente de flujo (Smart Cash Flow): programa manual + simulación.
   * Persistido en KV junto al resto de `settings:system`.
   */
  smartCashFlow?: SmartCashFlowSettings;
  /**
   * Catálogo de sedes. Formato nuevo: `{ name, enabled }[]`.
   * Legacy: `string[]` se normaliza al cargar (todas habilitadas).
   */
  sedesCatalog?: SedeCatalogEntry[] | string[];
}

/** Línea programada para la simulación (ingreso o egreso). */
export interface SmartCashFlowScheduleLine {
  id: string;
  kind: 'inflow' | 'outflow';
  label: string;
  amount: number;
  /** Fecha efectiva / vencimiento (yyyy-MM-dd). */
  date: string;
  /** Sólo egresos: fijo no se difiere en el motor. */
  flexibility: 'fixed' | 'flexible';
  /** Sólo egresos flexibles; menor = más prioritario. */
  priorityRank?: number;
}

export interface SmartCashFlowSettings {
  scheduleLines: SmartCashFlowScheduleLine[];
  /** Orden visual configurable de categorías en el flujo de caja. */
  categoryOrder?: {
    income?: string[];
    expense?: string[];
  };
  /** Proyección IA de ingresos persistida por clave de celda `categoria|subcategoria|concepto|yyyy-MM-dd`. */
  aiIncomeEstimates?: Record<string, number>;
  /** Fecha/hora del último recálculo de proyección de ingresos. */
  aiIncomeProjectionUpdatedAt?: string;
  /** Último horizonte usado en la UI (opcional). */
  horizonStart?: string;
  horizonEnd?: string;
  /** Sumar facturas con vencimiento en el horizonte como egresos flexibles. */
  includeInvoiceDueDates?: boolean;
  /**
   * Saldo inicial sólo para la simulación. Si es `undefined`, se usa `systemSettings.initialBalance`.
   */
  simulationOpeningBalance?: number | null;
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

// --- PRODUCT CATALOG (PRODUCTOS) ---

export type ProductStatus = 'active' | 'inactive' | 'discontinued';

/** Movimiento de inventario (Kardex) por producto */
export interface ProductKardexRow {
  id: string;
  date: string;
  referenceDoc: string;
  operationType: string;
  warehouse: string;
  stockInitial: number;
  qtyIn: number;
  qtyOut: number;
  stockFinal: number;
  batchNo?: string;
}

/** Lote / batch asociado al producto */
export interface ProductLotRow {
  id: string;
  registeredAt: string;
  lotNumber: string;
  warehouse: string;
  expiresAt?: string;
  qtyIn: number;
  balance: number;
}

/** Entrada de auditoría de ficha de producto */
export interface ProductAuditRow {
  id: string;
  at: string;
  action: string;
  module: string;
  previousValue?: string;
  newValue?: string;
  responsible: string;
}

/** Campos extra de ficha (pestañas Precios, factor, galería, etc.) */
export interface ProductExtended {
  sku?: string;
  customCode?: string;
  presentation?: string;
  content?: string;
  saleTaxPercent?: number;
  purchaseTaxPercent?: number;
  saleTaxExempt?: boolean;
  purchaseTaxExempt?: boolean;
  /** Valor de venta sin impuestos */
  saleValueNet?: number;
  /** Valor de compra sin impuestos */
  purchaseValueNet?: number;
  maxDiscountPercent?: number;
  commissionType?: 'fixed' | 'percent';
  commissionApplyOn?: string;
  commissionAmount?: number;
  commissionPercent?: number;
  /** Gravado ICBPER (bolsas plásticas, etc.) */
  icbperGravado?: boolean;
  loyaltyPoints?: number;
  salesAvailable?: boolean;
  applicationFrequencyDays?: string;
  usePurchaseConversion?: boolean;
  purchaseConversionLabel?: string;
  purchaseConversionFactor?: number;
  purchaseConversionUnitPurchasePrice?: number;
  /** Imágenes en galería (data URLs; uso moderado por tamaño en KV) */
  galleryDataUrls?: string[];
  kardex?: ProductKardexRow[];
  lots?: ProductLotRow[];
  audit?: ProductAuditRow[];
}

export interface Product {
  id: string;
  systemCode: number;
  barcode?: string;
  name: string;
  brand?: string;
  providerId?: string;
  providerName?: string;
  line: string;
  category: string;
  subcategory?: string;
  unit: string;
  salePrice: number;
  costPrice?: number;
  stockAccounting: number;
  stockAvailable: number;
  minStock: number;
  maxStock?: number;
  location?: string;
  status: ProductStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  extended?: ProductExtended;
}