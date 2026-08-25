/**
 * Datos de ejemplo para poblar módulos operativos (persistibles en MySQL/KV).
 * Fechas relativas al mes actual para que flujo de caja, EE.RR. y reportes muestren datos.
 */
import type {
  ChartOfAccountEntry,
  InvoiceDraft,
  PettyCashTransaction,
  Product,
  Provider,
  PurchaseRequest,
  Transaction,
} from '../types';
import type { Invoice, BankMovement, Subscription } from '../components/treasury/types';
import type { FleetDataset, FleetVehicle } from '../types/fleet';
import type { InventoryDataset } from '../types/inventory';
import type { AsistenciaSettings } from '../types/asistencia';
import type { ReconciliationDataset } from '../reconciliation/domain/types';
import { createEmptyDataset, newId, monthSessionLabel } from '../reconciliation/domain/dataset';
import { DEFAULT_FLEET_CHECKLIST, normalizeFleetDataset } from '../utils/fleetData';
import { normalizeInventoryDataset } from '../utils/inventoryData';
import { mergeExampleStaffIntoSettings } from '../utils/asistenciaExampleSeed';
import { DEMO_INITIAL_INVOICES, DEMO_INITIAL_PRODUCTS, DEMO_INITIAL_PROVIDERS, DEMO_INITIAL_REQUESTS } from './demoSeedData';
import { PETTY_CASH_META_KV_KEY } from '../utils/pettyCashMeta';

export type FeeReceiptExample = {
  id: string;
  professionalId: string;
  professionalName: string;
  receiptNumber: string;
  issueDate: Date;
  amount: number;
  description: string;
  location?: string;
  dueDate: Date;
  status: 'pending' | 'approved' | 'requested_payment' | 'paid' | 'rejected';
};

export type ExampleOperationalPayload = {
  transactions: Transaction[];
  invoices: InvoiceDraft[];
  providers: Provider[];
  products: Product[];
  requests: PurchaseRequest[];
  pettyCash: PettyCashTransaction[];
  pettyCashMeta: {
    weekClosures: unknown[];
    weekPreClosures: unknown[];
    fundDeliveries: unknown[];
  };
  feeReceipts: FeeReceiptExample[];
  chartOfAccounts: ChartOfAccountEntry[];
  treasuryInvoices: Invoice[];
  treasuryBankBalance: number;
  treasuryPaidHistory: Invoice[];
  treasurySubscriptions: Subscription[];
  treasuryBankMovements: BankMovement[];
  fleet: FleetDataset;
  inventory: InventoryDataset;
  reconciliation: ReconciliationDataset;
  asistenciaPatch: (prev: AsistenciaSettings | undefined) => AsistenciaSettings;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildTransactions(): Transaction[] {
  return [
    {
      id: 'ej-tx-1',
      amount: 4850,
      type: 'income',
      category: 'Ventas',
      subcategory: 'Clínica',
      concept: 'Benavides',
      description: 'Ventas clínicas sede Benavides',
      date: daysAgo(2),
      location: 'Benavides',
      currency: 'PEN',
    },
    {
      id: 'ej-tx-2',
      amount: 3120,
      type: 'income',
      category: 'Ventas',
      subcategory: 'Farmacia',
      concept: 'Benavides',
      description: 'Ventas farmacia',
      date: daysAgo(5),
      location: 'Benavides',
      currency: 'PEN',
    },
    {
      id: 'ej-tx-3',
      amount: 890,
      type: 'expense',
      category: 'Servicios',
      subcategory: 'Luz',
      concept: 'Benavides',
      description: 'Recibo eléctrico',
      date: daysAgo(8),
      location: 'Benavides',
      providerId: 'prov-2',
      currency: 'PEN',
    },
    {
      id: 'ej-tx-4',
      amount: 2450,
      type: 'expense',
      category: 'Compras',
      subcategory: 'Farmacia',
      concept: 'Stock',
      description: 'Compra medicamentos Distvet',
      date: daysAgo(10),
      location: 'Benavides',
      providerId: 'prov-1',
      currency: 'PEN',
    },
    {
      id: 'ej-tx-5',
      amount: 1680,
      type: 'income',
      category: 'Ventas',
      subcategory: 'Peluquería',
      concept: 'Benavides',
      description: 'Servicios de grooming',
      date: daysAgo(1),
      location: 'Benavides',
      currency: 'PEN',
    },
    {
      id: 'ej-tx-6',
      amount: 520,
      type: 'expense',
      category: 'Operativos',
      subcategory: 'Combustible',
      concept: 'Flota',
      description: 'Carga combustible unidad ABC-123',
      date: daysAgo(3),
      location: 'Benavides',
      currency: 'PEN',
    },
    {
      id: 'ej-tx-7',
      amount: 2200,
      type: 'income',
      category: 'Ventas',
      subcategory: 'Clínica',
      concept: 'Miraflores',
      description: 'Consultas sede Miraflores',
      date: daysAgo(4),
      location: 'Miraflores',
      currency: 'PEN',
    },
    {
      id: 'ej-tx-8',
      amount: 350,
      type: 'expense',
      category: 'Servicios',
      subcategory: 'Internet',
      concept: 'Benavides',
      description: 'Fibra óptica mes',
      date: daysAgo(12),
      location: 'Benavides',
      currency: 'PEN',
    },
  ];
}

function buildChartOfAccounts(): ChartOfAccountEntry[] {
  return [
    { id: 'ej-coa-1', code: '1011', name: 'Caja MN', kind: 'cash_bank', active: true },
    { id: 'ej-coa-2', code: '1041', name: 'Bancos MN', kind: 'cash_bank', active: true },
    { id: 'ej-coa-3', code: '40111', name: 'IGV', kind: 'tax_igv', active: true },
    { id: 'ej-coa-4', code: '6011', name: 'Mercaderías', kind: 'expense', active: true },
    { id: 'ej-coa-5', code: '6311', name: 'Energía eléctrica', kind: 'expense', active: true },
    { id: 'ej-coa-6', code: '6591', name: 'Otros gastos de gestión', kind: 'expense', active: true },
    { id: 'ej-coa-7', code: '7011', name: 'Ventas de mercaderías', kind: 'other', active: true },
  ];
}

function buildPettyCash(): PettyCashTransaction[] {
  const week = (() => {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  })();

  return [
    {
      id: 'ej-pc-1',
      date: daysAgo(6),
      description: 'Dotación semanal fondo',
      amount: 500,
      type: 'income',
      incomeSubtype: 'fund_delivery',
      location: 'Benavides',
      category: 'Dotación',
      requester: 'Administración',
      status: 'approved',
      weekNumber: week,
    },
    {
      id: 'ej-pc-2',
      date: daysAgo(4),
      description: 'Taxi traslado muestras',
      amount: 35,
      type: 'expense',
      location: 'Benavides',
      category: 'Movilidad',
      requester: 'Carla Counter',
      status: 'pending_audit',
      weekNumber: week,
      receiptType: 'Recibo Simple',
      providerName: 'Taxi Independiente',
    },
    {
      id: 'ej-pc-3',
      date: daysAgo(2),
      description: 'Útiles de limpieza',
      amount: 68.5,
      type: 'expense',
      location: 'Benavides',
      category: 'Limpieza',
      requester: 'Andrea Baño',
      status: 'approved',
      weekNumber: week,
      receiptType: 'Boleta',
      docType: 'RUC',
      docNumber: '20111111111',
      providerName: 'Distribuidora Limpieza SAC',
    },
  ];
}

function buildFeeReceipts(): FeeReceiptExample[] {
  return [
    {
      id: 'ej-fee-1',
      professionalId: 'prof-1',
      professionalName: 'Dr. Diego Veterinario',
      receiptNumber: 'RXH-00125',
      issueDate: daysAgo(7),
      amount: 1200,
      description: 'Honorarios consultas semana',
      location: 'Benavides',
      dueDate: daysFromNow(7),
      status: 'approved',
    },
    {
      id: 'ej-fee-2',
      professionalId: 'prof-2',
      professionalName: 'Dra. Lucía Asistente',
      receiptNumber: 'RXH-00126',
      issueDate: daysAgo(3),
      amount: 650,
      description: 'Apoyo quirúrgico',
      location: 'Benavides',
      dueDate: daysFromNow(14),
      status: 'pending',
    },
  ];
}

function buildTreasury(): {
  invoices: Invoice[];
  paid: Invoice[];
  balance: number;
  subscriptions: Subscription[];
  movements: BankMovement[];
} {
  const inv1: Invoice = {
    id: 'ej-tr-inv-1',
    providerName: 'Distribuidora Veterinaria SAC',
    providerRuc: '20123456789',
    amount: 2450,
    currency: 'PEN',
    issueDate: daysAgo(15),
    dueDate: daysFromNow(5),
    tentativePaymentDate: daysFromNow(3),
    category: 'Farmacia',
    status: 'scheduled',
    branchId: 'Benavides',
    description: 'Pedido medicamentos marzo',
    documentType: 'Factura',
    documentNumber: 'F001-4580',
  };
  const inv2: Invoice = {
    id: 'ej-tr-inv-2',
    providerName: 'Luz del Sur',
    providerRuc: '20555666777',
    amount: 890,
    currency: 'PEN',
    issueDate: daysAgo(20),
    dueDate: daysAgo(2),
    tentativePaymentDate: daysAgo(1),
    category: 'Servicios',
    status: 'pending',
    branchId: 'Benavides',
    description: 'Energía eléctrica',
    documentType: 'Servicio',
    documentNumber: 'S-998877',
  };
  const paid: Invoice = {
    ...inv1,
    id: 'ej-tr-paid-1',
    amount: 1180,
    status: 'paid',
    documentNumber: 'F001-4500',
    description: 'Pedido anterior pagado',
    dueDate: daysAgo(10),
    tentativePaymentDate: daysAgo(10),
  };

  return {
    invoices: [inv1, inv2],
    paid: [paid],
    balance: 28500,
    subscriptions: [
      {
        id: 'ej-sub-1',
        name: 'Internet corporativo',
        providerName: 'Fibra Total',
        amount: 350,
        frequency: 'monthly',
        dayOfMonth: 5,
        category: 'Servicios',
        autoGenerate: true,
        nextDueDate: daysFromNow(8),
      },
    ],
    movements: [
      {
        id: 'ej-bm-1',
        operationNumber: '0012345',
        description: 'Transferencia Distvet',
        amount: -2450,
        date: daysAgo(1),
        status: 'unmatched',
      },
      {
        id: 'ej-bm-2',
        operationNumber: '0012346',
        description: 'Abono ventas Yape',
        amount: 1850,
        date: daysAgo(0),
        status: 'unmatched',
      },
    ],
  };
}

function buildFleet(): FleetDataset {
  const now = new Date().toISOString();
  const vehicle: FleetVehicle = {
    id: 'ej-veh-1',
    plate: 'ABC-123',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2021,
    color: 'Blanco',
    fuelType: 'diesel',
    status: 'available',
    currentOdometerKm: 45200,
    assignedDriverName: 'Juan Chofer',
    assignedDriverLicense: 'Q12345678',
    homeBase: 'Benavides',
    technicalInspectionDue: isoDate(daysFromNow(40)),
    insuranceDue: isoDate(daysFromNow(90)),
    insuranceCompany: 'Rimac',
    nextServiceKm: 50000,
    nextOilChangeDate: isoDate(daysFromNow(20)),
    createdAt: now,
    updatedAt: now,
  };
  const vehicle2: FleetVehicle = {
    id: 'ej-veh-2',
    plate: 'XYZ-789',
    brand: 'Nissan',
    model: 'Urvan',
    year: 2019,
    fuelType: 'gasoline',
    status: 'maintenance',
    currentOdometerKm: 98100,
    assignedDriverName: 'Luis Movilidad',
    homeBase: 'Miraflores',
    technicalInspectionDue: isoDate(daysAgo(5)),
    insuranceDue: isoDate(daysFromNow(30)),
    createdAt: now,
    updatedAt: now,
  };

  return normalizeFleetDataset({
    vehicles: [vehicle, vehicle2],
    maintenance: [
      {
        id: 'ej-fm-1',
        vehicleId: vehicle2.id,
        kind: 'corrective',
        date: isoDate(daysAgo(1)),
        odometerKm: 98100,
        workshopName: 'Taller Sur',
        description: 'Cambio de pastillas de freno',
        laborCost: 180,
        partsCost: 300,
        parts: [{ name: 'Pastillas', qty: 1, unitCost: 300 }],
        createdAt: now,
      },
    ],
    fuelEntries: [
      {
        id: 'ej-ff-1',
        vehicleId: vehicle.id,
        date: isoDate(daysAgo(3)),
        liters: 40,
        totalCost: 520,
        odometerKm: 45180,
        station: 'Primax Benavides',
        location: 'Benavides',
        createdAt: now,
      },
    ],
    checklistSections: DEFAULT_FLEET_CHECKLIST,
    inspections: [],
  });
}

function buildInventory(): InventoryDataset {
  const now = new Date().toISOString();
  return normalizeInventoryDataset({
    equipment: [
      {
        id: 'ej-eq-1',
        code: 'EQ-RX-01',
        name: 'Equipo de rayos X dental',
        brand: 'iM3',
        model: 'CR7',
        kind: 'medical',
        category: 'diagnostico',
        status: 'active',
        sede: 'Benavides',
        floor: '1',
        room: 'Consultorio 2',
        purchaseDate: isoDate(daysAgo(400)),
        purchaseValue: 18500,
        currentValue: 14200,
        usefulLifeYears: 8,
        nextMaintenanceDate: isoDate(daysFromNow(25)),
        providerName: 'Distribuidora Veterinaria SAC',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ej-eq-2',
        code: 'EQ-AUT-02',
        name: 'Autoclave 23L',
        brand: 'Tuttnauer',
        model: '2340M',
        kind: 'medical',
        category: 'esterilizacion',
        status: 'maintenance',
        sede: 'Benavides',
        purchaseValue: 6200,
        currentValue: 4100,
        nextMaintenanceDate: isoDate(daysAgo(2)),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ej-eq-3',
        code: 'EQ-PC-03',
        name: 'PC recepción',
        brand: 'Dell',
        model: 'OptiPlex',
        kind: 'operational',
        category: 'computo',
        status: 'active',
        sede: 'Benavides',
        purchaseValue: 2800,
        currentValue: 1500,
        createdAt: now,
        updatedAt: now,
      },
    ],
    maintenance: [
      {
        id: 'ej-im-1',
        equipmentId: 'ej-eq-2',
        kind: 'preventive',
        status: 'in_progress',
        scheduledDate: isoDate(daysAgo(1)),
        technicianName: 'Servicio Técnico Med',
        companyName: 'SterilCare',
        description: 'Cambio de empaquetadura',
        laborCost: 200,
        partsCost: 120,
        parts: [{ name: 'Empaque', qty: 1, unitCost: 120 }],
        resultNotes: 'En proceso',
        createdAt: now,
      },
    ],
  });
}

function buildReconciliation(): ReconciliationDataset {
  const base = createEmptyDataset();
  const sessionId = base.activeSessionId;
  const batchId = newId('rb');
  const bankId = newId('cm');
  const saleId = newId('cm');
  const today = isoDate(new Date());

  return {
    ...base,
    batches: [
      {
        id: batchId,
        sessionId,
        sourceType: 'bcp_bank',
        fileName: 'ejemplo_bcp.csv',
        importedAt: new Date().toISOString(),
        recordCount: 2,
      },
    ],
    movements: [
      {
        id: bankId,
        batchId,
        sessionId,
        sourceType: 'bcp_bank',
        side: 'bank_or_gateway',
        transactionDate: today,
        amount: 1850,
        currency: 'PEN',
        operationNumber: '0012346',
        operationNumberRaw: '0012346',
        paymentMethod: 'yape',
        description: 'Abono Yape ejemplo',
        workflowStatus: 'pending',
        ruleCodes: [],
        metadata: {},
      },
      {
        id: saleId,
        batchId,
        sessionId,
        sourceType: 'sales_erp',
        side: 'sales_application',
        transactionDate: today,
        amount: 1850,
        currency: 'PEN',
        operationNumber: '0012346',
        operationNumberRaw: '0012346',
        paymentMethod: 'yape',
        description: 'Venta ERP ejemplo',
        branch: 'Benavides',
        workflowStatus: 'pending',
        ruleCodes: [],
        metadata: {},
      },
    ],
  };
}

/** Construye el paquete completo de ejemplo (no escribe a la nube). */
export function buildExampleOperationalPayload(sedeNames: string[] = ['Benavides']): ExampleOperationalPayload {
  const treasury = buildTreasury();
  const sedes = sedeNames.length > 0 ? sedeNames : ['Benavides'];

  const products = DEMO_INITIAL_PRODUCTS.map((p) => ({
    ...p,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
  }));

  const requests = DEMO_INITIAL_REQUESTS.map((r) => ({
    ...r,
    requestDate: daysAgo(2),
  }));

  const invoices = DEMO_INITIAL_INVOICES.map((inv, i) => ({
    ...inv,
    issueDate: isoDate(daysAgo(20 - i * 3)),
    dueDate: isoDate(daysFromNow(5 + i)),
  }));

  return {
    transactions: buildTransactions(),
    invoices,
    providers: DEMO_INITIAL_PROVIDERS,
    products,
    requests,
    pettyCash: buildPettyCash(),
    pettyCashMeta: { weekClosures: [], weekPreClosures: [], fundDeliveries: [] },
    feeReceipts: buildFeeReceipts(),
    chartOfAccounts: buildChartOfAccounts(),
    treasuryInvoices: treasury.invoices,
    treasuryBankBalance: treasury.balance,
    treasuryPaidHistory: treasury.paid,
    treasurySubscriptions: treasury.subscriptions,
    treasuryBankMovements: treasury.movements,
    fleet: buildFleet(),
    inventory: buildInventory(),
    reconciliation: buildReconciliation(),
    asistenciaPatch: (prev) => {
      let next = prev;
      for (const sede of sedes) {
        next = mergeExampleStaffIntoSettings(next, sede, { replaceSede: true });
      }
      return next;
    },
  };
}

export { PETTY_CASH_META_KV_KEY, monthSessionLabel };
