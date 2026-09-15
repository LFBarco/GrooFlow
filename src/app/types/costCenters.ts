/** Tipos del módulo maestro organizacional + centros de costo (Fase 1). */

export type GeneraIngresoTipo = 'DIRECTO' | 'INDIRECTO' | 'NO';
export type TipoCostoOrg = 'DIRECTO' | 'COMPARTIDO' | 'CORPORATIVO' | 'SOPORTE';
export type TipoCentroCosto = 'DIRECTO' | 'COMPARTIDO' | 'SEDE' | 'CORPORATIVO' | 'SOPORTE';
export type CatalogEstado = 'activo' | 'inactivo';

export type BusinessUnit = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  genera_ingreso: GeneraIngresoTipo;
  estado: CatalogEstado;
  sort_order?: number;
};

export type OrgArea = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: CatalogEstado;
  sort_order?: number;
};

export type OrgSubarea = {
  id: number;
  area_id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: CatalogEstado;
  area_nombre?: string;
  area_codigo?: string;
  sort_order?: number;
};

export type OrgPosition = {
  id: number;
  area_id?: number | null;
  subarea_id?: number | null;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  tipo_costo: TipoCostoOrg;
  genera_ingreso: GeneraIngresoTipo;
  estado: CatalogEstado;
  area_nombre?: string;
  subarea_nombre?: string;
  sort_order?: number;
};

export type CostCenter = {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoCentroCosto;
  sede_key?: string | null;
  sede_nombre?: string | null;
  unidad_negocio_id?: number | null;
  area_id?: number | null;
  subarea_id?: number | null;
  descripcion?: string;
  estado: CatalogEstado;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  unidad_negocio_nombre?: string;
  unidad_negocio_codigo?: string;
  area_nombre?: string;
  subarea_nombre?: string;
  sort_order?: number;
};

export type CostCentersDashboardStats = {
  centros_activos: number;
  unidades_negocio: number;
  areas: number;
  cargos: number;
  colaboradores_asignados?: number;
  reglas_activas?: number;
  por_tipo: Record<string, number>;
  gastos_pendientes: number;
  gastos_distribuidos: number;
  monto_distribuido_periodo?: number;
  periodo?: string;
  nota?: string;
};

/** Asignación colaborador ↔ centro de costo (Fase 2). */
export type CollaboratorCostAssignmentLine = {
  id: number;
  colaborador_id: string;
  centro_costo_id: number;
  porcentaje: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  es_principal: number | boolean;
  motivo?: string | null;
  estado: CatalogEstado;
  centro_codigo?: string;
  centro_nombre?: string;
  centro_tipo?: string;
  centro_sede?: string | null;
};

export type CollaboratorAssignmentSummary = {
  colaborador_id: string;
  buk_id: number;
  nombre: string;
  documento: string;
  cargo: string;
  area: string;
  sede: string;
  email: string;
  linked_usuario_id?: string | null;
  asignado_pct: number;
  pendiente_pct: number;
  completo: boolean;
  n_lineas: number;
  centro_principal?: { id: number; codigo: string; nombre: string } | null;
};

export type CollaboratorsAssignmentsPage = {
  items: CollaboratorAssignmentSummary[];
  total: number;
  page: number;
  pageSize: number;
  fecha_referencia: string;
};

export type AssignmentLineInput = {
  centro_costo_id: number;
  porcentaje: number;
  es_principal?: boolean;
};

export type ReplaceAssignmentsPayload = {
  colaborador_id: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  motivo?: string;
  lines: AssignmentLineInput[];
};

export type ReglaMetodo = 'PORCENTAJE' | 'POR_VENTAS' | 'POR_M2' | 'POR_HEADCOUNT' | 'IGUAL';
export type TipoAsignacionGasto = 'DIRECTO' | 'REGLA' | 'PERSONAL' | 'SIN_ASIGNAR';
export type GastoCcEstado = 'pendiente' | 'distribuido' | 'anulado';
export type GastoOrigenTipo = 'manual' | 'caja' | 'transaccion' | 'factura' | 'personal';

export type DistributionRuleDetail = {
  id?: number;
  centro_costo_id: number;
  porcentaje?: number | null;
  criterio?: string | null;
  sort_order?: number;
  centro_codigo?: string;
  centro_nombre?: string;
};

export type DistributionRule = {
  id: number;
  codigo: string;
  nombre: string;
  metodo: ReglaMetodo;
  descripcion?: string;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  estado: CatalogEstado;
  detalle: DistributionRuleDetail[];
};

export type CostExpense = {
  id: number;
  fecha: string;
  monto: number;
  moneda: string;
  concepto: string;
  sede_nombre?: string | null;
  origen_tipo: GastoOrigenTipo;
  origen_id?: string | null;
  centro_costo_origen_id?: number | null;
  tipo_asignacion: TipoAsignacionGasto;
  regla_id?: number | null;
  colaborador_id?: string | null;
  periodo: string;
  estado: GastoCcEstado;
  notas?: string | null;
  centro_origen_codigo?: string;
  centro_origen_nombre?: string;
  regla_codigo?: string;
  regla_nombre?: string;
  distribucion?: Array<{
    id: number;
    centro_costo_id: number;
    porcentaje: number;
    monto: number;
    metodo_snapshot?: string;
    centro_codigo?: string;
    centro_nombre?: string;
  }>;
};

export type CostExpensesPage = {
  items: CostExpense[];
  total: number;
  page: number;
  pageSize: number;
};

export type CostCentersReport = {
  periodo: string;
  por_centro: Array<{
    id: number;
    codigo: string;
    nombre: string;
    tipo: string;
    sede_nombre?: string | null;
    total: number;
    n_gastos: number;
  }>;
  por_sede: Array<{ sede: string; total: number }>;
  por_unidad_negocio: Array<{ unidad_negocio: string; codigo: string; total: number }>;
  por_area: Array<{ area: string; total: number }>;
  por_tipo_asignacion: Array<{ tipo_asignacion: string; total: number; n: number }>;
  pendientes: { n: number; total: number };
  personal: Array<{ colaborador_id: string; total: number; n: number }>;
};

export type CostCentersPnlFeed = {
  periodo: string;
  items: Array<{
    centro_costo_id: number;
    codigo: string;
    nombre: string;
    tipo: string;
    sede_nombre?: string | null;
    monto: number;
    naturaleza: string;
  }>;
  total: number;
  nota?: string;
};
