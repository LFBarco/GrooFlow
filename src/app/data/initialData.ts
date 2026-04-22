import { SystemSettings, SYSTEM_SEDES, type SedeCatalogEntry, type PettyCashRenditionPrintSettings } from '../types';
import {
  DEFAULT_PROVIDER_AREAS,
  DEFAULT_PROVIDER_CATEGORIES,
} from '../utils/providerCatalog';

/** Valores por defecto de la plantilla de rendición (merge con `settings.pettyCash.renditionPrint`). */
export const defaultPettyCashRenditionPrint: PettyCashRenditionPrintSettings = {
  documentTitle: 'Rendición de caja chica',
  subtitle: 'Resumen para solicitud de reembolso y cuadre de caja',
  showSedeColumn: true,
  showRequesterColumn: true,
  showAreaColumn: true,
  showCategoryBreakdown: true,
  showSignaturesBlock: true,
  footerLegal:
    'Declaro bajo juramento que los gastos consignados corresponden al uso exclusivo de la operación de la empresa.',
};

export function mergePettyCashRenditionPrint(
  partial?: PettyCashRenditionPrintSettings | null
): PettyCashRenditionPrintSettings {
  return { ...defaultPettyCashRenditionPrint, ...(partial || {}) };
}

export type TransactionType = 'income' | 'expense';
export type Flexibility = 'fixed' | 'flexible';

export interface ConceptDefinition {
  id: string;
  name: string;
  flexibility: Flexibility;
  defaultDay?: number; // 1-31
  estimatedAmount?: number; // Opcional, para pre-llenar
}

export interface SubcategoryDefinition {
  id: string;
  name: string;
  concepts: ConceptDefinition[];
}

export interface CategoryDefinition {
  type: TransactionType;
  /** @deprecated Use subcategories. If present, treated as one subcategory "General". */
  concepts?: ConceptDefinition[];
  /** Subcategories (e.g. Agua, Luz). Each has its own concepts. */
  subcategories?: SubcategoryDefinition[];
}

export type ConfigStructure = Record<string, CategoryDefinition>;

/** Returns subcategories for a category. If only `concepts` exist, returns one virtual subcategory "General". */
export function getSubcategories(catDef: CategoryDefinition, categoryName?: string): SubcategoryDefinition[] {
  if (catDef.subcategories?.length) return catDef.subcategories;
  const concepts = catDef.concepts ?? [];
  return [{
    id: 'general',
    name: categoryName ?? 'General',
    concepts
  }];
}

/** Flatten: all concepts for a category (from all subcategories). */
export function getConceptsFlat(catDef: CategoryDefinition): ConceptDefinition[] {
  const subs = getSubcategories(catDef);
  return subs.flatMap(s => s.concepts);
}

// Helper to create concepts with stable IDs (derived from name, or custom id for uniqueness across subcategories)
const c = (name: string, flex: Flexibility = 'flexible', day?: number, customId?: string): ConceptDefinition => ({
  id: customId ?? name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 32),
  name,
  flexibility: flex,
  defaultDay: day
});

export function subcategoryId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 32);
}

export const initialStructure: ConfigStructure = {
  'Ingresos': {
    type: 'income',
    concepts: [
      c('Banco BCP', 'flexible'),
      c('POS', 'flexible'),
      c('Yape/Plin', 'flexible'),
      c('Transferencia', 'flexible'),
      c('Efectivo', 'flexible')
    ]
  },
  'Servicios Básicos': {
    type: 'expense',
    subcategories: [
      { id: 'agua', name: 'Agua', concepts: [ c('Benavides', 'fixed', 10, 'agua-benavides'), c('Miraflores', 'fixed', 10, 'agua-miraflores'), c('San Borja', 'fixed', 10, 'agua-san-borja') ] },
      { id: 'alquiler', name: 'Alquiler', concepts: [ c('Chavez', 'fixed', 5), c('San Borja', 'fixed', 5, 'alquiler-san-borja'), c('Benavides', 'fixed', 5, 'alquiler-benavides'), c('Magdalena', 'fixed', 5), c('La Molina', 'fixed', 5, 'alquiler-la-molina') ] },
      { id: 'luz', name: 'Luz', concepts: [ c('La Molina', 'fixed', 15, 'luz-la-molina'), c('San Borja', 'fixed', 15, 'luz-san-borja') ] },
      { id: 'otros', name: 'Otros', concepts: [ c('TELEFONO - ENTEL', 'fixed', 20), c('INTERNET - WIN', 'fixed', 20), c('VIGILANCIA - PROSEGUR', 'fixed', 30) ] }
    ]
  },
  'Planilla': {
    type: 'expense',
    concepts: [
      c('(1) Pagos Recibos x Honorarios', 'flexible', 15),
      c('(2) Planilla Base', 'fixed', 30),
      c('(7) Planilla Médicos', 'fixed', 30),
      c('(11) AFP', 'fixed', 18)
    ]
  },
  'Impuestos': {
    type: 'expense',
    concepts: [
      c('IGV', 'fixed', 20),
      c('RENTA', 'fixed', 20)
    ]
  },
  'Área Médica': {
    type: 'expense',
    concepts: [
      c('Compras Farmacia', 'flexible'),
      c('Compras Equipos', 'flexible'),
      c('(1) Gosac', 'flexible'),
      c('Gastos Varios', 'flexible')
    ]
  },
  'Área Operativa': {
    type: 'expense',
    concepts: [
      c('Compras Limpieza', 'flexible'),
      c('Mantenimiento sedes', 'flexible'),
      c('Movilidad', 'flexible')
    ]
  },
  'Préstamos': {
    type: 'expense',
    concepts: [
      c('(1) PRESTAMOS BCP', 'fixed', 2),
      c('(2) PRESTAMOS BBVA', 'fixed', 10)
    ]
  }
};

export const initialSystemSettings: SystemSettings = {
  businessName: 'GrooFlow',
  sedesCatalog: SYSTEM_SEDES.map(
    (name): SedeCatalogEntry => ({ name, enabled: true })
  ),
  currency: 'PEN',
  initialBalance: 0,
  initialBalanceDate: '2025-01-01',
  pettyCash: {
    totalFundLimit: 1000,
    maxTransactionAmount: 150,
    alertThreshold: 20, // 20%
    requireReceiptAbove: 20, // S/ 20
    weeklyClosingDay: 5, // Viernes
    renditionPrint: { ...defaultPettyCashRenditionPrint },
    weekClosures: [],
    weekPreClosures: [],
  },
  providers: {
    categories: [...DEFAULT_PROVIDER_CATEGORIES],
    areas: [...DEFAULT_PROVIDER_AREAS],
  },
  accounting: {},
};

/**
 * Fusiona ajustes leídos del KV con valores por defecto.
 * Evita `pettyCash` indefinido / incompleto (pantalla en blanco o crash al abrir Caja chica / Config).
 */
export function mergeSystemSettings(incoming: Partial<SystemSettings> | null | undefined): SystemSettings {
  const base = initialSystemSettings;
  if (!incoming || typeof incoming !== 'object') {
    return { ...base };
  }
  const pc = incoming.pettyCash;
  return {
    ...base,
    ...incoming,
    pettyCash: {
      ...base.pettyCash,
      ...(pc || {}),
      renditionPrint: mergePettyCashRenditionPrint(
        pc?.renditionPrint ?? base.pettyCash.renditionPrint
      ),
      weekClosures: Array.isArray(pc?.weekClosures)
        ? pc.weekClosures
        : (base.pettyCash.weekClosures ?? []),
      weekPreClosures: Array.isArray(pc?.weekPreClosures)
        ? pc.weekPreClosures
        : (base.pettyCash.weekPreClosures ?? []),
    },
    providers: {
      categories:
        incoming.providers?.categories && incoming.providers.categories.length > 0
          ? incoming.providers.categories
          : base.providers.categories,
      areas:
        incoming.providers?.areas && incoming.providers.areas.length > 0
          ? incoming.providers.areas
          : base.providers.areas,
    },
    sedesCatalog: incoming.sedesCatalog ?? base.sedesCatalog,
    accounting: {
      ...base.accounting,
      ...(incoming.accounting || {}),
    },
  };
}
