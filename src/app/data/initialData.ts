import { SystemSettings } from '../types';

export type TransactionType = 'income' | 'expense';
export type Flexibility = 'fixed' | 'flexible';

export interface ConceptDefinition {
  id: string;
  name: string;
  flexibility: Flexibility;
  defaultDay?: number; // 1-31
  estimatedAmount?: number; // Opcional, para pre-llenar
}

export interface CategoryDefinition {
  type: TransactionType;
  concepts: ConceptDefinition[];
}

export type ConfigStructure = Record<string, CategoryDefinition>;

// Helper to create simple concepts quickly
const c = (name: string, flex: Flexibility = 'flexible', day?: number): ConceptDefinition => ({
  id: Math.random().toString(36).substr(2, 9),
  name,
  flexibility: flex,
  defaultDay: day
});

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
    concepts: [
      c('(1) Alquiler Chavez', 'fixed', 5),
      c('(2) Alquiler San Borja', 'fixed', 5),
      c('(3) Alquiler Benavides', 'fixed', 5),
      c('(4) Alquiler Magdalena', 'fixed', 5),
      c('(5) Alquiler La molina', 'fixed', 5),
      c('(1) Luz La Molina', 'fixed', 15),
      c('(2) Luz San Borja', 'fixed', 15),
      c('TELEFONO - ENTEL', 'fixed', 20),
      c('INTERNET - WIN', 'fixed', 20),
      c('VIGILANCIA - PROSEGUR', 'fixed', 30)
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
  businessName: 'VetFlow Veterinaria',
  currency: 'PEN',
  initialBalance: 0,
  initialBalanceDate: '2025-01-01',
  pettyCash: {
    totalFundLimit: 1000,
    maxTransactionAmount: 150,
    alertThreshold: 20, // 20%
    requireReceiptAbove: 20, // S/ 20
    weeklyClosingDay: 5 // Viernes
  },
  providers: {
    categories: [
      "Farmacia", "Insumos Médicos", "Servicios Básicos", "Mantenimiento", 
      "Alquileres", "Laboratorio", "Marketing", "Otros"
    ],
    areas: [
      "Dirección General", "Administración", "Logística", "Ventas", 
      "Recursos Humanos", "Sistemas", "Operaciones", "Mantenimiento"
    ]
  }
};
