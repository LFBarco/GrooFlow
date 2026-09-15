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
  por_tipo: Record<string, number>;
  gastos_pendientes: number;
  gastos_distribuidos: number;
  nota?: string;
};
