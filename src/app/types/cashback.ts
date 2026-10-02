export type CashbackCalcMode = 'pct_igv' | 'pct_total' | 'flat';

export type CashbackPayoutTreatment = 'reembolso' | 'remuneracion';

export type CashbackInvoiceState = 'en_revision' | 'observada' | 'aprobada' | 'rechazada' | 'liquidada';

export type CashbackCategory = {
  id: string;
  label: string;
  enabled: boolean;
};

export type CashbackSettings = {
  companyRucs: string[];
  calcMode: CashbackCalcMode;
  pctIgv: number;
  pctTotal: number;
  flatAmount: number;
  capAtIgv: boolean;
  releaseThreshold: number;
  maxDaysOld: number;
  payoutTreatment: CashbackPayoutTreatment;
  essaludRate: number;
  categories: CashbackCategory[];
  excludedNote: string;
  updatedAt?: string | null;
};

export type CashbackInvoice = {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  colaboradorBukId: number | null;
  colaboradorDoc: string | null;
  sede: string | null;
  emisorRuc: string;
  emisorNombre: string | null;
  emisorEstado: string | null;
  emisorCondicion: string | null;
  tipoDoc: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  periodo: string;
  base: number;
  igv: number;
  total: number;
  compradorRuc: string | null;
  categoria: string;
  motivo: string;
  centroCosto: string | null;
  alertas: string[];
  estado: CashbackInvoiceState;
  cashbackMonto: number | null;
  revisorNombre: string | null;
  revisadoAt: string | null;
  notaRevision: string | null;
  liquidacionId: string | null;
  hasPhoto: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CashbackBalance = {
  acumulado: number;
  umbral: number;
  faltante: number;
  liberable: boolean;
  enRevision: number;
  observadas: number;
  aprobadas: number;
  rechazadas: number;
  liquidado: number;
};

export type CashbackColaboradorLink = {
  linked: boolean;
  bukId: number | null;
  nombre: string | null;
  documento: string | null;
  sede: string | null;
  area: string | null;
};

export type CashbackCapabilities = {
  submit: boolean;
  review: boolean;
  export: boolean;
  configure: boolean;
};

export type CashbackMeResponse = {
  invoices: CashbackInvoice[];
  balance: CashbackBalance;
  colaborador: CashbackColaboradorLink;
  settings: CashbackSettings;
  capabilities: CashbackCapabilities;
};

export type CashbackInvoiceDraft = {
  emisorRuc: string;
  emisorNombre: string;
  emisorEstado: string;
  emisorCondicion: string;
  tipoDoc: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  base: string;
  igv: string;
  total: string;
  compradorRuc: string;
  categoria: string;
  motivo: string;
  centroCosto: string;
  declaraSinExcluidos: boolean;
  qrRaw: string;
  photo: string;
};

export type CashbackUserBalanceRow = {
  usuarioId: string;
  usuarioNombre: string;
  colaboradorDoc: string | null;
  sede: string | null;
  vinculado: boolean;
  acumulado: number;
  igvAcumulado: number;
  aprobadas: number;
  pendientes: number;
  liquidado: number;
  faltante: number;
  liberable: boolean;
};

export type CashbackLiquidationLine = {
  usuarioId: string;
  usuarioNombre: string;
  colaboradorDoc: string | null;
  sede: string | null;
  facturaIds: number[];
  facturas: number;
  igv: number;
  total: number;
  monto: number;
  essalud: number;
};

export type CashbackLiquidation = {
  id: string;
  periodo: string;
  estado: 'generada' | 'pagada';
  tratamiento: CashbackPayoutTreatment;
  colaboradores: number;
  facturas: number;
  igvTotal: number;
  montoTotal: number;
  essaludTotal: number;
  creadoPorNombre: string | null;
  pagadoAt: string | null;
  nota: string | null;
  createdAt: string;
  lineas?: CashbackLiquidationLine[];
};

export type CashbackAggRow = {
  facturas: number;
  base: number;
  igv: number;
  total: number;
  cashback: number;
  colaboradores?: number;
};

export type CashbackReport = {
  byEstado: Array<CashbackAggRow & { estado: CashbackInvoiceState }>;
  monthly: Array<CashbackAggRow & { periodo: string }>;
  byCategoria: Array<CashbackAggRow & { categoria: string }>;
  bySede: Array<CashbackAggRow & { sede: string }>;
  topEmisores: Array<CashbackAggRow & { ruc: string; nombre: string | null }>;
  topColaboradores: Array<CashbackAggRow & { usuarioId: string; nombre: string }>;
  settings: CashbackSettings;
};

export type CashbackReviewAction = 'approve' | 'observe' | 'reject' | 'reopen';
