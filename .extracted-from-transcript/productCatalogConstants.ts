export const PRODUCT_LINES = ['FARMACIA', 'PET SHOP', 'CLINICA', 'GROOMING', 'SERVICIOS'] as const;

export const PRODUCT_CATEGORIES = [
  'Medicamentos',
  'Antiparasitarios',
  'RESTRICIVOS',
  'Alimentos',
  'Accesorios',
  'Higiene',
  'Insumos Clinicos',
  'Servicios',
] as const;

export const PRODUCT_SUBCATEGORIES = [
  'Tabletas',
  'Comprimidos',
  'Gotas',
  'Inyectables',
  'Alimento seco',
  'Arena sanitaria',
  'Juguetes',
  'Otros',
] as const;

export const PRODUCT_UNITS = ['UND', 'ML', 'LT', 'Caja', 'Bolsa', 'Frasco', 'Kg', 'Servicio'] as const;

export const PRODUCT_PRESENTATIONS = [
  'Botella',
  'Blister',
  'Caja',
  'Sachet',
  'Ampolla',
  'Frasco',
  'Bolsa',
  'Tarro',
  'Tubo',
  'Otros',
] as const;

/** Almacenes por defecto (se unen con sedes visibles en runtime) */
export const DEFAULT_WAREHOUSES = ['Principal'] as const;
