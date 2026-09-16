/** Tipos Contabilidad Gerencial / P&L Gerencial. */

export type MgrTipoCosto = 'DIRECTO' | 'INDIRECTO' | 'NA';

export type MgrNaturaleza = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  sort_order?: number;
  estado: string;
};

export type MgrPnlLinea = {
  id: number;
  codigo: string;
  nombre: string;
  parent_codigo?: string | null;
  nivel: number;
  es_calculo: number | boolean;
  formula?: string | null;
  sort_order?: number;
};

export type MgrDriver = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad?: string;
  estado: string;
};

export type MgrCuentaMapping = {
  id: number;
  cuenta_codigo: string;
  cuenta_nombre?: string;
  naturaleza_codigo?: string | null;
  pnl_codigo?: string | null;
  area_id?: number | null;
  subarea_id?: number | null;
  centro_costo_id?: number | null;
  tipo_costo: MgrTipoCosto;
  driver_id?: number | null;
  keyword_match?: string | null;
  prioridad?: number;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  estado: string;
  notas?: string | null;
  area_nombre?: string;
  area_codigo?: string;
  subarea_nombre?: string;
  centro_codigo?: string;
  centro_nombre?: string;
  driver_codigo?: string;
  driver_nombre?: string;
};

export type MgrClassifyProposal = {
  cuenta_codigo: string;
  naturaleza_codigo?: string | null;
  pnl_codigo?: string | null;
  area_id?: number | null;
  area_codigo?: string | null;
  subarea_id?: number | null;
  centro_costo_id?: number | null;
  centro_codigo?: string | null;
  tipo_costo: MgrTipoCosto;
  driver_id?: number | null;
  fuente?: string | null;
  confianza?: string;
  es_remuneracion?: boolean;
  requiere_driver?: boolean;
  notas?: string[];
};

export type MgrSharedDist = {
  id: number;
  codigo: string;
  nombre: string;
  area_origen_id?: number | null;
  centro_origen_id?: number | null;
  driver_id?: number | null;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  estado: string;
  area_origen_nombre?: string;
  centro_origen_codigo?: string;
  driver_codigo?: string;
  detalle: Array<{
    id?: number;
    area_destino_id?: number | null;
    centro_destino_id: number;
    porcentaje: number;
    area_destino_codigo?: string;
    centro_destino_codigo?: string;
  }>;
};

export type MgrQaReport = {
  cuentas_sin_clasificacion: Array<{
    cuenta_codigo: string;
    cuenta_nombre: string;
    plFuncionGroo?: string | null;
  }>;
  cuentas_sin_clasificacion_total: number;
  centros_duplicados: Array<{ codigo: string; n: number }>;
  cuentas_62_sin_area_cc: MgrCuentaMapping[];
  compartidos_sin_driver: Array<{ id: number; codigo: string; nombre: string }>;
  indirectos_sin_driver: Array<{ id: number; cuenta_codigo: string; cuenta_nombre?: string }>;
  matriz: Array<{
    cuenta_codigo: string;
    cuenta_nombre?: string;
    naturaleza?: string | null;
    pnl?: string | null;
    area?: string | null;
    subarea?: string | null;
    centro_costo?: string | null;
    tipo_costo?: string;
    driver?: string | null;
    vigencia_desde?: string | null;
    vigencia_hasta?: string | null;
    estado?: string;
    parametrizacion: string;
  }>;
  resumen: {
    mappings_activos: number;
    pendientes_cuenta: number;
    pendientes_62: number;
    pendientes_driver: number;
  };
};

export type MgrPnlStatement = {
  periodo: string;
  lineas: Array<{
    codigo: string;
    nombre: string;
    parent_codigo?: string | null;
    nivel: number;
    es_calculo: boolean;
    monto: number;
  }>;
  detalle_centros: Array<{
    centro_codigo: string;
    pnl_codigo: string;
    monto: number;
    tipo_costo: string;
  }>;
  nota?: string;
};

export type MgrDashboardStats = {
  naturalezas: number;
  pnl_lineas: number;
  mappings: number;
  drivers: number;
  compartidos: number;
  keyword_rules: number;
  nota?: string;
};
