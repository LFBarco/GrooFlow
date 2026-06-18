import { useState, useEffect, useRef, useCallback, useMemo, Suspense, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { pathToView, viewToPath, type ViewType, VIEW_REQUIRED_MODULE } from "./routes";
import { LoginPage } from "./pages/LoginPage";
import { Transaction, Category, TransactionType, InvoiceDraft, Provider, Product, PurchaseRequest, RequestStatus, User, SystemSettings, PettyCashTransaction, PettyCashWeekClosure, PettyCashWeekPreClosure, PettyCashFundDelivery, SystemAlert, AlertThresholds, ChartOfAccountEntry } from "./types";
import {
  getAllSedeNames,
  getEnabledSedeNames,
  getSedesCatalogEntries,
  migrateLocationField,
  type SedesCatalogSaveResult,
} from "./utils/sedesCatalog";
import { getBankAccounts } from "./utils/bankAccounts";
import { Role, DEFAULT_ROLES } from "./components/users/types";
import { initialStructure, ConfigStructure, initialSystemSettings, mergeSystemSettings, getSubcategories } from "./data/initialData";
import { mergeSystemSettingsSqlAndKv } from "./services/repository/appKvSql";
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet,
  PlusCircle,
  Stethoscope,
  CalendarDays,
  Settings,
  ChevronLeft,
  ChevronRight,
  PieChart,
  FileText,
  Brain,
  ShieldAlert,
  Users,
  ShoppingCart,
  Package,
  Menu,
  Coins,
  TrendingUp,
  Landmark,
  BookOpen,
  Truck,
  UserCheck,
} from "lucide-react";
// Logo: coloque logo.png en la carpeta public/ para producción
const logoUrl = '/logo.png';
import {
  AlertsCenter,
  AnalyticsDashboard,
  AuditPanel,
  ChartOfAccountsModule,
  ConfigPanel,
  MonthlySummary,
  PettyCashModule,
  ProfessionalFeesModule,
  ProviderManager,
  PurchaseRequestManager,
  CashFlowGrid,
  SmartCashFlowSimulation,
  PnLView,
  RecentTransactions,
  ProductModule,
  RouteLoader,
  TransactionForm,
  TransactionImporter,
  TreasuryModule,
  UserManager,
  FleetModule,
  InventoryModule,
  AsistenciaModule,
  Overview,
  CashFlowChart,
  UserProfileDialog,
} from "./lazyRouteModules";
import { UserMenu } from "./components/layout/UserMenu";
import { addMonths, subMonths, format, startOfDay, isValid, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/ui/dialog";
import { api, setKvSessionFatalHandler, repository } from "./services/api";
import { supabase } from "../../utils/supabase/client";
import { getSupabaseClient } from "./services/repository/supabase";
import { isFleetSqlEnabled, type FleetSqlTimestamps } from "./services/repository/fleetSql";
import { isInventorySqlEnabled } from "./services/repository/inventorySql";
import {
  syncUserProfilesToSql,
  isAdminAppUser,
} from "./services/repository/userProfileSync";
import { useFleetRealtimeSync } from "./hooks/useFleetRealtimeSync";
import { useInventoryPersistence } from "./hooks/useInventoryPersistence";
import { useInventoryRealtimeSync } from "./hooks/useInventoryRealtimeSync";
import { hydrateTransactions } from "./utils/hydrateTransactions";
import { labelsMatch } from "./utils/labelMatch";
import { formatDateInputValue, parseTransactionDate } from "./utils/transactionDate";
import { generateAlerts } from "./components/alerts/alertEngine";
import { goLiveAlertSources } from "./config/goLive";
import { Toaster } from "./components/ui/sonner";
import { AppProvider } from "./context/AppContext";
import {
  dedupeUsersByEmail,
  applySuperAdminRoleFromConfig,
  mergeAuthUserIntoUsers,
  resolveCurrentUserRow,
} from "./utils/userListMerge";
import { mergePettyCashFilterCatalog } from "./utils/providerCatalog";
import { mergeRolesWithDefaults } from "./utils/mergeRolesWithDefaults";
import { getFirstAllowedViewPath, roleRecordHasModuleAccess } from "./utils/rolePermissions";
import { getSuperAdminEmails } from "./config/superAdmins";
import { isUserSessionBlocked } from "./utils/userSessionGuard";
import { weekKeyMatches } from "./utils/pettyCashWeekKey";
import type { FleetDataset } from "./types/fleet";
import type { InventoryDataset } from "./types/inventory";
import { mergeFleetRemoteIntoLocal } from "./utils/fleetMerge";
import { normalizeFleetDataset } from "./utils/fleetData";
import { normalizeInventoryDataset } from "./utils/inventoryData";
import { isInventoryDatasetEmpty } from "./utils/inventoryDatasetEmpty";
import { getModuleSurfaces } from "./utils/moduleSurfaces";
import { getModuleIdentity } from "./utils/grooflowIdentity";
import { AmbientBackground } from "./components/layout/AmbientBackground";
import { ModuleHeader } from "./components/layout/ModuleHeader";
import {
  isTransactionsSqlEnabled,
  loadTransactionsFromSql,
  migrateTransactionsKvToSql,
  saveTransactionsToSql,
} from "./services/repository/transactionsSql";
import { useTransactionsRealtimeSync } from "./hooks/useTransactionsRealtimeSync";
import {
  resolveListFromSql,
  loadProvidersFromSql,
  migrateProvidersKvToSql,
  saveProvidersToSql,
  loadPettyCashFromSql,
  migratePettyCashKvToSql,
  loadInvoicesFromSql,
  migrateInvoicesKvToSql,
  saveInvoicesToSql,
  loadPurchaseRequestsFromSql,
  migratePurchaseRequestsKvToSql,
  savePurchaseRequestsToSql,
  loadAppUsersFromSql,
  migrateAppUsersKvToSql,
  saveAppUsersToSql,
  loadRolesFromSql,
  migrateRolesKvToSql,
  saveRolesToSql,
  savePettyCashToSql,
} from "./services/repository/businessDomainsSql";
import { isProductionSqlEnabled } from "./services/repository/sqlDomainUtils";
import { resolveAppKvFromSql, saveAppKvKey } from "./services/repository/appKvSql";
import {
  backupAppKvAfterKvSave,
  backupDomainSqlAfterKvSave,
  ensureSqlSave,
} from "./utils/sqlAutosaveBackup";
import { useProductionRealtimeSync } from "./hooks/useProductionRealtimeSync";
import { enqueueKvSerializedSave, flushKvSaveChains, KV_CHAIN_IDLE, kvSaveSucceeded, type KvSaveResult } from "./utils/kvSerializedSave";
import { flushAllSqlSaveQueues } from "./utils/sqlSaveQueue";
import {
  autosaveKvDomain,
  createCloudSyncTracker,
  persistKvDomainNow,
  resetKvDomainRefs,
  shouldAllowKvRemoteHydrate,
  KV_DOMAIN_COOLDOWN_MS,
  type CloudSyncPhase,
} from "./utils/kvDomainPersistence";
import { CloudSyncIndicator } from "./components/layout/CloudSyncIndicator";
import { useKvCrossTabSync } from "./hooks/useKvCrossTabSync";
import {
  kvKeyDisplayLabel,
  kvPayloadsEqual,
  markCrossTabEchoWindow,
  broadcastKvUpdate,
} from "./utils/kvCrossTabSync";
import { clearOperationalData } from "./utils/clearOperationalData";
import {
  FLEET_REMOTE_COOLDOWN_MS,
  shouldApplyFleetRemoteSnapshot,
} from "./utils/fleetRemoteSyncGuard";
import {
  INVENTORY_REMOTE_COOLDOWN_MS,
  shouldApplyInventoryRemoteSnapshot,
} from "./utils/inventoryRemoteSyncGuard";
import {
  TRANSACTIONS_REMOTE_COOLDOWN_MS,
  shouldApplyTransactionsRemoteSnapshot,
} from "./utils/transactionsRemoteSyncGuard";
import {
  PRODUCTION_REMOTE_COOLDOWN_MS,
  shouldApplyListRemoteSnapshot,
  shouldApplyObjectRemoteSnapshot,
  shouldApplyValueRemoteSnapshot,
} from "./utils/listRemoteSyncGuard";
import { writeAuditLog } from "./services/repository/auditLogSql";
import { generateEntityId } from "./utils/generateEntityId";
import { persistAppKvDomainNow } from "./utils/persistAppKvDomain";
import { useAlertReadPersistence } from "./hooks/useAlertReadPersistence";
import { useSqlRetryProcessor } from "./hooks/useSqlRetryProcessor";
import {
  applyPettyCashMetaRemoteUpdate,
  usePettyCashMetaPersistence,
} from "./hooks/usePettyCashMetaPersistence";
import { useConfigPersistence } from "./hooks/useConfigPersistence";
import { usePettyCashTransactionsPersistence } from "./hooks/usePettyCashTransactionsPersistence";
import { useSystemSettingsPersistence } from "./hooks/useSystemSettingsPersistence";
import { useAsistenciaPersistence } from "./hooks/useAsistenciaPersistence";
import { mergeAsistenciaSettings } from "./utils/asistenciaData";
import { useTransactionsPersistence } from "./hooks/useTransactionsPersistence";
import { useAppDataHydration } from "./hooks/useAppDataHydration";
import { useProvidersPersistence } from "./hooks/useProvidersPersistence";
import { useUsersRolesPersistence } from "./hooks/useUsersRolesPersistence";
import { useOperationalDomainsPersistence } from "./hooks/useOperationalDomainsPersistence";
import { useFleetPersistence } from "./hooks/useFleetPersistence";
import {
  extractPettyCashMeta,
  mergePettyCashMetaIntoSettings,
  normalizePettyCashMeta,
  PETTY_CASH_META_KV_KEY,
  isPettyCashMetaEmpty,
  resolvePettyCashMeta,
  stripPettyCashMetaForSystemKv,
} from "./utils/pettyCashMeta";
import {
  loadPettyCashMetaFromSql,
  migratePettyCashMetaKvToSql,
  savePettyCashMetaToSql,
} from "./services/repository/pettyCashMetaSql";

const initialTransactions: Transaction[] = [];
const TRANSACTION_HISTORY_CLEAR_MARK = '2026-05-11-clear-transaction-history-v1';
type TransactionDatePreset = 'all' | 'last7' | 'currentMonth' | 'previousMonth' | 'year' | 'custom';
const APP_BACKEND = import.meta.env.VITE_BACKEND ?? 'supabase';
const FLEET_USE_SQL = isFleetSqlEnabled();
const INVENTORY_USE_SQL = isInventorySqlEnabled();
const TRANSACTIONS_USE_SQL = isTransactionsSqlEnabled();
const PRODUCTION_USE_SQL = isProductionSqlEnabled();
const initialInvoices: InvoiceDraft[] = [
    {
        id: "mock-1",
        fileName: "Factura_E001-450.pdf",
        provider: "Distribuidora Veterinaria SAC",
        invoiceNumber: "E001-450",
        issueDate: "2024-03-01",
        dueDate: "2024-03-15",
        description: "Compra de medicamentos marzo",
        location: "Principal",
        subtotal: 1000,
        igv: 180,
        total: 1180,
        status: 'pending_approval'
    },
    {
        id: "mock-2",
        fileName: "Recibo_Luz_Marzo.pdf",
        provider: "Luz del Sur",
        invoiceNumber: "S002-998877",
        issueDate: "2024-03-05",
        dueDate: "2024-03-20",
        description: "Servicio eléctrico Sede Norte",
        location: "Norte",
        subtotal: 450,
        igv: 0,
        total: 450,
        status: 'approved'
    }
];

const initialProviders: Provider[] = [
    {
        id: "prov-1",
        name: "Distribuidora Veterinaria SAC",
        ruc: "20123456789",
        category: "Farmacia",
        defaultCreditDays: 30,
        email: "ventas@distvet.com",
        phone: "999888777",
        contactName: "Roberto Gomez",
        bankName: "BCP",
        bankAccount: "191-12345678-0-99",
        totalPurchased: 15400
    },
    {
        id: "prov-2",
        name: "Luz del Sur",
        ruc: "20555666777",
        category: "Servicios Básicos",
        defaultCreditDays: 0, // Contado
        totalPurchased: 2500
    }
];

const initialProducts: Product[] = [
    {
        id: "prod-10",
        systemCode: 10,
        barcode: "",
        name: "Bravecto 365",
        brand: "BRAVECTO",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        line: "CLINICA",
        category: "Antiparasitarios",
        subcategory: "Tabletas",
        unit: "UND",
        salePrice: 80,
        costPrice: 58,
        stockAccounting: 0,
        stockAvailable: 0,
        minStock: 2,
        location: "General",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "prod-8",
        systemCode: 8,
        barcode: "2230559328739",
        name: "Apoquel (Oclacitinib) comprimidos 5.4 mg",
        brand: "ZOETIS",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        line: "FARMACIA",
        category: "Medicamentos",
        subcategory: "Comprimidos",
        unit: "Caja",
        salePrice: 7.9,
        costPrice: 5.4,
        stockAccounting: 13,
        stockAvailable: 13,
        minStock: 5,
        location: "General",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "prod-5",
        systemCode: 5,
        barcode: "1894185441069",
        name: "Royal Canin - Persian Kitten 2 KG",
        brand: "ROYAL CANIN",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        line: "PET SHOP",
        category: "Alimentos",
        subcategory: "Alimento seco",
        unit: "Bolsa",
        salePrice: 169.9,
        costPrice: 125,
        stockAccounting: 20,
        stockAvailable: 20,
        minStock: 4,
        location: "General",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "prod-4",
        systemCode: 4,
        barcode: "6066899651338",
        name: "Cat Chow Adultos Delimix 3 KG",
        brand: "PURINA",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        line: "PET SHOP",
        category: "Alimentos",
        subcategory: "Alimento seco",
        unit: "Bolsa",
        salePrice: 57.9,
        costPrice: 42,
        stockAccounting: 30,
        stockAvailable: 30,
        minStock: 6,
        location: "General",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "prod-3",
        systemCode: 3,
        barcode: "1553668242545",
        name: "Bravecto gatos (6.25 - 12.5 kg)",
        brand: "BRAVECTO",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        line: "FARMACIA",
        category: "Antiparasitarios",
        subcategory: "Tabletas",
        unit: "UND",
        salePrice: 164.9,
        costPrice: 119,
        stockAccounting: 14,
        stockAvailable: 14,
        minStock: 4,
        location: "General",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "prod-2",
        systemCode: 2,
        barcode: "5622608233663",
        name: "Bravecto Gato Plus 1.2 a 2.8 kg. (12 semanas)",
        brand: "BRAVECTO",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        line: "FARMACIA",
        category: "Antiparasitarios",
        subcategory: "Gotas",
        unit: "UND",
        salePrice: 154.9,
        costPrice: 113,
        stockAccounting: 13,
        stockAvailable: 13,
        minStock: 4,
        location: "General",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "prod-1",
        systemCode: 1,
        barcode: "9446719976101",
        name: "Simparica 20 mg / 5 a 10 kg X 3 Tabletas",
        brand: "ZOETIS",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        line: "FARMACIA",
        category: "Antiparasitarios",
        subcategory: "Tabletas",
        unit: "Caja",
        salePrice: 167.2,
        costPrice: 120,
        stockAccounting: 11,
        stockAvailable: 11,
        minStock: 3,
        location: "General",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

const initialRequests: PurchaseRequest[] = [
    {
        id: "req-1",
        providerId: "prov-1",
        providerName: "Distribuidora Veterinaria SAC",
        requestDate: new Date(),
        description: "Reposición de stock vacunas séxtuple",
        amount: 850.00,
        location: "Principal",
        priority: "high",
        paymentCondition: 'credit',
        status: "pending",
        requesterName: "Jeny Quispes",
        requesterInitials: "JQ"
    }
];

const GUEST_USER: User = {
  id: 'guest',
  name: 'Invitado',
  initials: 'IN',
  role: 'manager',
  status: 'active',
  allSedes: true,
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [invoices, setInvoices] = useState<InvoiceDraft[]>(() =>
    APP_BACKEND === 'local' ? initialInvoices : []
  );
  /** En Supabase: arranca vacío para no volcar los 2 proveedores demo al KV con el primer autosave. En local: demo. */
  const [providers, setProviders] = useState<Provider[]>(() =>
    (import.meta.env.VITE_BACKEND ?? 'supabase') === 'local' ? initialProviders : []
  );
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccountEntry[]>([]);
  const [openQuickProviderModal, setOpenQuickProviderModal] = useState(false);
  const [products, setProducts] = useState<Product[]>(() =>
    APP_BACKEND === 'local' ? initialProducts : []
  );
  const [requests, setRequests] = useState<PurchaseRequest[]>(() =>
    APP_BACKEND === 'local' ? initialRequests : []
  );
  const [pettyCashTransactions, setPettyCashTransactions] = useState<PettyCashTransaction[]>([]);
  
  // Fee Receipts state - shared between Honorarios and Treasury
  type FeeReceiptGlobal = {
    id: string;
    professionalId: string;
    professionalName: string;
    receiptNumber: string;
    issueDate: Date;
    amount: number;
    description: string;
    location?: string;
    dueDate: Date;
    paymentRequestedAt?: Date;
    status: 'pending' | 'approved' | 'requested_payment' | 'paid' | 'rejected';
    paymentDate?: Date;
    fileUrl?: string;
  };
  const [feeReceipts, setFeeReceipts] = useState<FeeReceiptGlobal[]>([]);

  const [fleetDataset, setFleetDataset] = useState<FleetDataset>(() => normalizeFleetDataset({}));
  const [inventoryDataset, setInventoryDataset] = useState<InventoryDataset>(() =>
    normalizeInventoryDataset({})
  );

  // Treasury global state (persisted)
  const [treasuryInvoices, setTreasuryInvoices] = useState<any[]>([]);
  const [treasuryBankBalance, setTreasuryBankBalance] = useState<number | undefined>(undefined);
  const [treasuryPaidHistory, setTreasuryPaidHistory] = useState<any[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const view = pathToView(location.pathname);
  const setView = (v: ViewType) => navigate(viewToPath(v));
  const [config, setConfig] = useState<ConfigStructure>(initialStructure);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(initialSystemSettings);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const safeCurrentDate = isValid(currentDate) ? currentDate : new Date();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  /** En Supabase: solo true tras leer `data:users` del KV con HTTP 200 (evita pisar la nube si el GET falló). */
  const [canSaveUsers, setCanSaveUsers] = useState(true);
  /** Evita doble carga y, en Supabase, permite volver a cargar tras logout/login. */
  const cloudDataHydratedRef = useRef(false);
  /** Una sola función para recargar KV + usuarios (login, refresh, SIGNED_IN). */
  const hydrateFromKvRef = useRef<(() => Promise<void>) | null>(null);
  const hydrateRunningRef = useRef(false);
  /** Si llega un segundo hydrate mientras uno corre (p. ej. login + SIGNED_IN), se reintenta al terminar */
  const pendingHydrateRef = useRef(false);
  const lastSaveErrorAtRef = useRef<Record<string, number>>({});
  /**
   * Si un hydrate llega durante `await api.saveKey('data:providers')`, sin esto puede aplicarse un
   * snapshot viejo del KV y revertir altas/edits recientes (lista «no guarda» aunque el POST sí llegó).
   */
  const skipProvidersHydrateRef = useRef(false);
  /** Tras un POST exitoso a `data:providers`, ignorar GET remotos unos segundos (replica / cache puede traer lista vieja). */
  const providersKvCooldownUntilRef = useRef(0);
  const PROVIDERS_KV_COOLDOWN_MS = 8000;
  /** Evita que un hydrate fallido o incompleto sobrescriba transacciones remotas con []. */
  const transactionsCloudHydrationDoneRef = useRef(false);
  const transactionsHydratedFromKvRef = useRef(false);
  const skipTransactionsHydrateRef = useRef(false);
  const transactionsKvCooldownUntilRef = useRef(0);
  /** Evita autosave de proveedores antes de haber hidratado desde la nube (no pisar KV con [] o demos). */
  const providersCloudHydrationDoneRef = useRef(false);
  /**
   * True tras aplicar lista desde KV en un hydrate donde `allowProvidersRemote` fue true (incluye KV vacío).
   * Sin esto, un hydrate que salta ese bloque por carrera podría dejar [] en estado y el autosave borraría la nube.
   */
  const providersHydratedFromKvRef = useRef(false);
  /** Tras el primer hydrate de `data:pettyCash`; evita autosave antes de leer la nube. */
  const pettyCashHydratedFromKvRef = useRef(false);
  const skipPettyCashHydrateRef = useRef(false);
  const pettyCashKvCooldownUntilRef = useRef(0);
  const PETTY_CASH_KV_COOLDOWN_MS = 8000;
  /** Tras el primer hydrate de `settings:config`; evita autosave antes de leer la nube. */
  const configHydratedFromKvRef = useRef(false);
  const skipConfigHydrateRef = useRef(false);
  const configKvCooldownUntilRef = useRef(0);
  const CONFIG_KV_COOLDOWN_MS = 8000;
  /** Tras el primer hydrate de `data:fleet`; evita autosave antes de leer la nube. */
  const fleetHydratedFromKvRef = useRef(false);
  const skipFleetHydrateRef = useRef(false);
  const fleetKvCooldownUntilRef = useRef(0);
  const fleetKvChainRef = useRef(KV_CHAIN_IDLE);
  const fleetKvLatestRef = useRef<FleetDataset>(normalizeFleetDataset({}));
  const fleetSqlTimestampsRef = useRef<FleetSqlTimestamps>(new Map());
  const inventoryHydratedFromKvRef = useRef(false);
  const skipInventoryHydrateRef = useRef(false);
  const inventoryKvCooldownUntilRef = useRef(0);
  const inventoryKvChainRef = useRef(KV_CHAIN_IDLE);
  const inventoryKvLatestRef = useRef<InventoryDataset>(normalizeInventoryDataset({}));
  /** Umbrales de alertas (`settings:alertThresholds`). */
  const alertThresholdsHydratedFromKvRef = useRef(false);
  const skipAlertThresholdsHydrateRef = useRef(false);
  const alertThresholdsKvCooldownUntilRef = useRef(0);
  const alertThresholdsKvChainRef = useRef(KV_CHAIN_IDLE);
  const alertThresholdsKvLatestRef = useRef<AlertThresholds>({
    liquidityMinDays: 3,
    invoiceDueDays: 7,
    spendingSpikePercent: 25,
    pettyCashLowBalance: 20,
    staleRequestDays: 3,
  });
  /** Plan de cuentas contables. */
  const chartOfAccountsHydratedFromKvRef = useRef(false);
  const skipChartOfAccountsHydrateRef = useRef(false);
  const chartOfAccountsKvCooldownUntilRef = useRef(0);
  const chartOfAccountsKvChainRef = useRef(KV_CHAIN_IDLE);
  const chartOfAccountsKvLatestRef = useRef<ChartOfAccountEntry[]>([]);
  /** Catálogo de productos. */
  const productsHydratedFromKvRef = useRef(false);
  const skipProductsHydrateRef = useRef(false);
  const productsKvCooldownUntilRef = useRef(0);
  const productsKvChainRef = useRef(KV_CHAIN_IDLE);
  const productsKvLatestRef = useRef<Product[]>([]);
  /** Roles RBAC. */
  const rolesHydratedFromKvRef = useRef(false);
  const skipRolesHydrateRef = useRef(false);
  const rolesKvCooldownUntilRef = useRef(0);
  const rolesKvChainRef = useRef(KV_CHAIN_IDLE);
  const rolesKvLatestRef = useRef<Role[]>(DEFAULT_ROLES);
  /** Facturas (módulo tesorería / borradores). */
  const invoicesHydratedFromKvRef = useRef(false);
  const skipInvoicesHydrateRef = useRef(false);
  const invoicesKvCooldownUntilRef = useRef(0);
  const invoicesKvChainRef = useRef(KV_CHAIN_IDLE);
  const invoicesKvLatestRef = useRef<InvoiceDraft[]>([]);
  /** Solicitudes de compra. */
  const requestsHydratedFromKvRef = useRef(false);
  const skipRequestsHydrateRef = useRef(false);
  const requestsKvCooldownUntilRef = useRef(0);
  const requestsKvChainRef = useRef(KV_CHAIN_IDLE);
  const requestsKvLatestRef = useRef<PurchaseRequest[]>([]);
  /** Honorarios profesionales. */
  const feeReceiptsHydratedFromKvRef = useRef(false);
  const skipFeeReceiptsHydrateRef = useRef(false);
  const feeReceiptsKvCooldownUntilRef = useRef(0);
  const feeReceiptsKvChainRef = useRef(KV_CHAIN_IDLE);
  const feeReceiptsKvLatestRef = useRef<FeeReceiptGlobal[]>([]);
  /** Configuración global del sistema (sedes, caja chica, contabilidad). */
  const systemSettingsHydratedFromKvRef = useRef(false);
  const skipSystemSettingsHydrateRef = useRef(false);
  const systemSettingsKvCooldownUntilRef = useRef(0);
  const systemSettingsKvChainRef = useRef(KV_CHAIN_IDLE);
  const systemSettingsKvLatestRef = useRef<SystemSettings>(initialSystemSettings);
  const asistenciaKvLatestRef = useRef(mergeAsistenciaSettings(undefined));
  const asistenciaKvChainRef = useRef(KV_CHAIN_IDLE);
  /** Tesorería — tres claves KV relacionadas. */
  const treasuryHydratedFromKvRef = useRef(false);
  const skipTreasuryHydrateRef = useRef(false);
  const treasuryKvCooldownUntilRef = useRef(0);
  const treasuryInvoicesKvChainRef = useRef(KV_CHAIN_IDLE);
  const treasuryInvoicesKvLatestRef = useRef<any[]>([]);
  const treasuryBankBalanceKvChainRef = useRef(KV_CHAIN_IDLE);
  const treasuryBankBalanceKvLatestRef = useRef<number | undefined>(undefined);
  const treasuryPaidHistoryKvChainRef = useRef(KV_CHAIN_IDLE);
  const treasuryPaidHistoryKvLatestRef = useRef<any[]>([]);
  /** True tras leer saldo bancario del KV (aunque sea null). */
  const treasuryBankBalanceLoadedFromKvRef = useRef(false);
  /** Tema visual (settings:theme). */
  const themeHydratedFromKvRef = useRef(false);
  const skipThemeHydrateRef = useRef(false);
  const themeKvCooldownUntilRef = useRef(0);
  const themeKvChainRef = useRef(KV_CHAIN_IDLE);
  const themeKvLatestRef = useRef<'dark' | 'light'>('dark');
  /** Lista de usuarios (data:users). */
  const usersHydratedFromKvRef = useRef(false);
  const skipUsersHydrateRef = useRef(false);
  const usersKvCooldownUntilRef = useRef(0);
  const usersKvChainRef = useRef(KV_CHAIN_IDLE);
  const usersKvLatestRef = useRef<User[]>([]);
  const usersAdminReloadRef = useRef(false);
  const authUserIdRef = useRef<string | null>(null);

  /** Invalida escrituras KV encoladas antes de aplicar datos remotos o al cerrar sesión. */
  const kvApplyGenerationRef = useRef(0);

  const providersKvChainRef = useRef(KV_CHAIN_IDLE);
  const providersKvLatestRef = useRef<Provider[]>([]);

  const pettyCashKvChainRef = useRef(KV_CHAIN_IDLE);
  const pettyCashKvLatestRef = useRef<PettyCashTransaction[]>([]);
  const pettyCashMetaKvLatestRef = useRef(extractPettyCashMeta(initialSystemSettings.pettyCash));
  const pettyCashMetaKvChainRef = useRef(KV_CHAIN_IDLE);

  const transactionsKvChainRef = useRef(KV_CHAIN_IDLE);
  const transactionsKvLatestRef = useRef<Transaction[]>(initialTransactions);

  const configKvChainRef = useRef(KV_CHAIN_IDLE);
  const configKvLatestRef = useRef<ConfigStructure>(initialStructure);

  const [cloudSyncPhase, setCloudSyncPhase] = useState<CloudSyncPhase>('idle');
  const cloudSyncPendingRef = useRef(0);
  const cloudSyncErrorRef = useRef(false);
  const cloudSyncErrorKeyRef = useRef<string | null>(null);
  const cloudSyncTrackerRef = useRef(createCloudSyncTracker(
    cloudSyncPendingRef,
    cloudSyncErrorRef,
    setCloudSyncPhase,
    cloudSyncErrorKeyRef
  ));

  const resetKvSaveChains = () => {
    kvApplyGenerationRef.current += 1;
    providersKvChainRef.current = KV_CHAIN_IDLE;
    pettyCashKvChainRef.current = KV_CHAIN_IDLE;
    pettyCashMetaKvChainRef.current = KV_CHAIN_IDLE;
    asistenciaKvChainRef.current = KV_CHAIN_IDLE;
    transactionsKvChainRef.current = KV_CHAIN_IDLE;
    configKvChainRef.current = KV_CHAIN_IDLE;
    fleetKvChainRef.current = KV_CHAIN_IDLE;
    inventoryKvChainRef.current = KV_CHAIN_IDLE;
    alertThresholdsKvChainRef.current = KV_CHAIN_IDLE;
    chartOfAccountsKvChainRef.current = KV_CHAIN_IDLE;
    productsKvChainRef.current = KV_CHAIN_IDLE;
    rolesKvChainRef.current = KV_CHAIN_IDLE;
    invoicesKvChainRef.current = KV_CHAIN_IDLE;
    requestsKvChainRef.current = KV_CHAIN_IDLE;
    feeReceiptsKvChainRef.current = KV_CHAIN_IDLE;
    systemSettingsKvChainRef.current = KV_CHAIN_IDLE;
    treasuryInvoicesKvChainRef.current = KV_CHAIN_IDLE;
    treasuryBankBalanceKvChainRef.current = KV_CHAIN_IDLE;
    treasuryPaidHistoryKvChainRef.current = KV_CHAIN_IDLE;
    themeKvChainRef.current = KV_CHAIN_IDLE;
    usersKvChainRef.current = KV_CHAIN_IDLE;
  };

  const resetAllKvDomainRefs = () => {
    resetKvDomainRefs({
      hydratedFromKvRef: fleetHydratedFromKvRef,
      skipHydrateRef: skipFleetHydrateRef,
      cooldownUntilRef: fleetKvCooldownUntilRef,
      chainRef: fleetKvChainRef,
      latestRef: fleetKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: inventoryHydratedFromKvRef,
      skipHydrateRef: skipInventoryHydrateRef,
      cooldownUntilRef: inventoryKvCooldownUntilRef,
      chainRef: inventoryKvChainRef,
      latestRef: inventoryKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: alertThresholdsHydratedFromKvRef,
      skipHydrateRef: skipAlertThresholdsHydrateRef,
      cooldownUntilRef: alertThresholdsKvCooldownUntilRef,
      chainRef: alertThresholdsKvChainRef,
      latestRef: alertThresholdsKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: chartOfAccountsHydratedFromKvRef,
      skipHydrateRef: skipChartOfAccountsHydrateRef,
      cooldownUntilRef: chartOfAccountsKvCooldownUntilRef,
      chainRef: chartOfAccountsKvChainRef,
      latestRef: chartOfAccountsKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: productsHydratedFromKvRef,
      skipHydrateRef: skipProductsHydrateRef,
      cooldownUntilRef: productsKvCooldownUntilRef,
      chainRef: productsKvChainRef,
      latestRef: productsKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: rolesHydratedFromKvRef,
      skipHydrateRef: skipRolesHydrateRef,
      cooldownUntilRef: rolesKvCooldownUntilRef,
      chainRef: rolesKvChainRef,
      latestRef: rolesKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: invoicesHydratedFromKvRef,
      skipHydrateRef: skipInvoicesHydrateRef,
      cooldownUntilRef: invoicesKvCooldownUntilRef,
      chainRef: invoicesKvChainRef,
      latestRef: invoicesKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: requestsHydratedFromKvRef,
      skipHydrateRef: skipRequestsHydrateRef,
      cooldownUntilRef: requestsKvCooldownUntilRef,
      chainRef: requestsKvChainRef,
      latestRef: requestsKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: feeReceiptsHydratedFromKvRef,
      skipHydrateRef: skipFeeReceiptsHydrateRef,
      cooldownUntilRef: feeReceiptsKvCooldownUntilRef,
      chainRef: feeReceiptsKvChainRef,
      latestRef: feeReceiptsKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: systemSettingsHydratedFromKvRef,
      skipHydrateRef: skipSystemSettingsHydrateRef,
      cooldownUntilRef: systemSettingsKvCooldownUntilRef,
      chainRef: systemSettingsKvChainRef,
      latestRef: systemSettingsKvLatestRef,
    });
    treasuryHydratedFromKvRef.current = false;
    skipTreasuryHydrateRef.current = false;
    treasuryKvCooldownUntilRef.current = 0;
    treasuryBankBalanceLoadedFromKvRef.current = false;
    resetKvDomainRefs({
      hydratedFromKvRef: themeHydratedFromKvRef,
      skipHydrateRef: skipThemeHydrateRef,
      cooldownUntilRef: themeKvCooldownUntilRef,
      chainRef: themeKvChainRef,
      latestRef: themeKvLatestRef,
    });
    resetKvDomainRefs({
      hydratedFromKvRef: usersHydratedFromKvRef,
      skipHydrateRef: skipUsersHydrateRef,
      cooldownUntilRef: usersKvCooldownUntilRef,
      chainRef: usersKvChainRef,
      latestRef: usersKvLatestRef,
    });
  };

  // Alerts System
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>({
    liquidityMinDays: 3,
    invoiceDueDays: 7,
    spendingSpikePercent: 25,
    pettyCashLowBalance: 20,
    staleRequestDays: 3
  });

  /** Evita que un hydrate en curso vuelva a marcar sesión iniciada tras cerrar sesión. */
  const signingOutRef = useRef(false);
  /** Evita tratar SIGNED_OUT espurio (race al refrescar / pestaña) y cortar auto-guardado. */
  const authNullDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transaction Filters State
  const [txDatePreset, setTxDatePreset] = useState<TransactionDatePreset>("all");
  const [txFilterDateStart, setTxFilterDateStart] = useState("");
  const [txFilterDateEnd, setTxFilterDateEnd] = useState("");
  const [txFilterCategory, setTxFilterCategory] = useState<string>("all");
  const [txFilterSubcategory, setTxFilterSubcategory] = useState<string>("all");
  const [txFilterConcept, setTxFilterConcept] = useState<string>("all");
  const [txFilterProvider, setTxFilterProvider] = useState<string>("all");
  
  // Transaction Editing State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransactionImporterOpen, setIsTransactionImporterOpen] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useAppDataHydration({
    resetAllKvDomainRefs,
    resetKvSaveChains,
    hydrateFromKvRef,
    authNullDebounceRef,
    signingOutRef,
    pendingHydrateRef,
    hydrateRunningRef,
    cloudDataHydratedRef,
    cloudSyncPendingRef,
    cloudSyncErrorRef,
    transactionsCloudHydrationDoneRef,
    transactionsHydratedFromKvRef,
    skipTransactionsHydrateRef,
    transactionsKvCooldownUntilRef,
    transactionsKvLatestRef,
    providersCloudHydrationDoneRef,
    providersHydratedFromKvRef,
    skipProvidersHydrateRef,
    providersKvCooldownUntilRef,
    providersKvLatestRef,
    pettyCashHydratedFromKvRef,
    skipPettyCashHydrateRef,
    pettyCashKvCooldownUntilRef,
    pettyCashKvLatestRef,
    pettyCashMetaKvLatestRef,
    configHydratedFromKvRef,
    skipConfigHydrateRef,
    configKvCooldownUntilRef,
    configKvLatestRef,
    systemSettingsHydratedFromKvRef,
    skipSystemSettingsHydrateRef,
    systemSettingsKvCooldownUntilRef,
    systemSettingsKvLatestRef,
    asistenciaKvLatestRef,
    invoicesHydratedFromKvRef,
    skipInvoicesHydrateRef,
    invoicesKvCooldownUntilRef,
    invoicesKvLatestRef,
    requestsHydratedFromKvRef,
    skipRequestsHydrateRef,
    requestsKvCooldownUntilRef,
    requestsKvLatestRef,
    chartOfAccountsHydratedFromKvRef,
    skipChartOfAccountsHydrateRef,
    chartOfAccountsKvCooldownUntilRef,
    chartOfAccountsKvLatestRef,
    productsHydratedFromKvRef,
    skipProductsHydrateRef,
    productsKvCooldownUntilRef,
    productsKvLatestRef,
    rolesHydratedFromKvRef,
    skipRolesHydrateRef,
    rolesKvCooldownUntilRef,
    rolesKvLatestRef,
    usersHydratedFromKvRef,
    skipUsersHydrateRef,
    usersKvCooldownUntilRef,
    usersKvLatestRef,
    feeReceiptsHydratedFromKvRef,
    skipFeeReceiptsHydrateRef,
    feeReceiptsKvCooldownUntilRef,
    feeReceiptsKvLatestRef,
    alertThresholdsHydratedFromKvRef,
    skipAlertThresholdsHydrateRef,
    alertThresholdsKvCooldownUntilRef,
    alertThresholdsKvLatestRef,
    themeHydratedFromKvRef,
    skipThemeHydrateRef,
    themeKvCooldownUntilRef,
    themeKvLatestRef,
    fleetHydratedFromKvRef,
    skipFleetHydrateRef,
    fleetKvCooldownUntilRef,
    fleetKvLatestRef,
    fleetSqlTimestampsRef,
    inventoryHydratedFromKvRef,
    skipInventoryHydrateRef,
    inventoryKvCooldownUntilRef,
    inventoryKvLatestRef,
    treasuryHydratedFromKvRef,
    skipTreasuryHydrateRef,
    treasuryKvCooldownUntilRef,
    treasuryInvoicesKvLatestRef,
    treasuryBankBalanceKvLatestRef,
    treasuryBankBalanceLoadedFromKvRef,
    treasuryPaidHistoryKvLatestRef,
    setIsAuthChecking,
    setCloudSyncPhase,
    setCanSaveUsers,
    setIsAuthenticated,
    setCurrentUser,
    setIsDataLoaded,
    setConfig,
    setSystemSettings,
    setTransactions,
    setInvoices,
    setProviders,
    setPettyCashTransactions,
    setUsers,
    setRoles,
    setFeeReceipts,
    setAlertThresholds,
    setChartOfAccounts,
    setProducts,
    setRequests,
    setTheme,
    setFleetDataset,
    setInventoryDataset,
    setTreasuryInvoices,
    setTreasuryBankBalance,
    setTreasuryPaidHistory,
    GUEST_USER,
    initialInvoices,
    initialProducts,
    initialRequests,
  });

  const getSqlRetryLatestSnapshot = useCallback(
    () => ({
      config: configKvLatestRef.current,
      systemSettings: systemSettingsKvLatestRef.current,
      theme: themeKvLatestRef.current,
      alertThresholds: alertThresholdsKvLatestRef.current,
      transactions: transactionsKvLatestRef.current,
      providers: providersKvLatestRef.current,
      pettyCash: pettyCashKvLatestRef.current,
      invoices: invoicesKvLatestRef.current,
      requests: requestsKvLatestRef.current,
      users: usersKvLatestRef.current,
      roles: rolesKvLatestRef.current,
      feeReceipts: feeReceiptsKvLatestRef.current,
      products: productsKvLatestRef.current,
      chartOfAccounts: chartOfAccountsKvLatestRef.current,
      treasuryInvoices: treasuryInvoicesKvLatestRef.current,
      treasuryBankBalance: treasuryBankBalanceKvLatestRef.current,
      treasuryPaidHistory: treasuryPaidHistoryKvLatestRef.current,
      fleet: fleetKvLatestRef.current,
      inventory: inventoryKvLatestRef.current,
      pettyCashMeta: pettyCashMetaKvLatestRef.current,
      asistencia: asistenciaKvLatestRef.current,
    }),
    []
  );

  useSqlRetryProcessor({
    isDataLoaded,
    getLatestSnapshot: getSqlRetryLatestSnapshot,
    canWriteUsersRoles: isAdminAppUser(currentUser),
  });

  const { applyReadState, markAlertRead, markAllAlertsRead } = useAlertReadPersistence(isDataLoaded);

  useConfigPersistence({
    isDataLoaded,
    config,
    hydratedRef: configHydratedFromKvRef,
    chainRef: configKvChainRef,
    latestRef: configKvLatestRef,
    cooldownUntilRef: configKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  });

  usePettyCashTransactionsPersistence({
    isDataLoaded,
    transactions: pettyCashTransactions,
    hydratedRef: pettyCashHydratedFromKvRef,
    chainRef: pettyCashKvChainRef,
    latestRef: pettyCashKvLatestRef,
    cooldownUntilRef: pettyCashKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  });

  const { persistSystemSettingsNow, handlePersistSystemSettings } = useSystemSettingsPersistence({
    isDataLoaded,
    systemSettings,
    setSystemSettings,
    hydratedRef: systemSettingsHydratedFromKvRef,
    skipHydrateRef: skipSystemSettingsHydrateRef,
    chainRef: systemSettingsKvChainRef,
    latestRef: systemSettingsKvLatestRef,
    cooldownUntilRef: systemSettingsKvCooldownUntilRef,
    pettyCashMetaLatestRef: pettyCashMetaKvLatestRef,
    pettyCashMetaChainRef: pettyCashMetaKvChainRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync: cloudSyncTrackerRef.current,
  });

  const { persistAsistenciaNow } = useAsistenciaPersistence({
    isDataLoaded,
    systemSettingsHydratedRef: systemSettingsHydratedFromKvRef,
    setSystemSettings,
    systemSettingsLatestRef: systemSettingsKvLatestRef,
    asistenciaLatestRef: asistenciaKvLatestRef,
    asistenciaChainRef: asistenciaKvChainRef,
    skipHydrateRef: skipSystemSettingsHydrateRef,
    cooldownUntilRef: systemSettingsKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  });

  usePettyCashMetaPersistence({
    isDataLoaded,
    systemSettingsHydratedRef: systemSettingsHydratedFromKvRef,
    systemSettings,
    pettyCashMetaLatestRef: pettyCashMetaKvLatestRef,
    pettyCashMetaChainRef: pettyCashMetaKvChainRef,
    cooldownUntilRef: systemSettingsKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync: cloudSyncTrackerRef.current,
  });

  const { persistTransactionsNow } = useTransactionsPersistence({
    isDataLoaded,
    transactions,
    setTransactions,
    cloudHydrationDoneRef: transactionsCloudHydrationDoneRef,
    hydratedFromKvRef: transactionsHydratedFromKvRef,
    chainRef: transactionsKvChainRef,
    latestRef: transactionsKvLatestRef,
    cooldownUntilRef: transactionsKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  });

  const { handleUpdateProviders } = useProvidersPersistence({
    isDataLoaded,
    providers,
    setProviders,
    cloudHydrationDoneRef: providersCloudHydrationDoneRef,
    hydratedRef: providersHydratedFromKvRef,
    skipHydrateRef: skipProvidersHydrateRef,
    chainRef: providersKvChainRef,
    latestRef: providersKvLatestRef,
    cooldownUntilRef: providersKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  });

  const { persistUsersToCloud, handleUpdateRoles } = useUsersRolesPersistence({
    isDataLoaded,
    canSaveUsers,
    canWriteUsersRoles: isAdminAppUser(currentUser),
    users,
    roles,
    setUsers,
    setRoles,
    setCanSaveUsers,
    usersHydratedRef: usersHydratedFromKvRef,
    rolesHydratedRef: rolesHydratedFromKvRef,
    skipUsersHydrateRef,
    skipRolesHydrateRef,
    usersChainRef: usersKvChainRef,
    usersLatestRef: usersKvLatestRef,
    usersCooldownRef: usersKvCooldownUntilRef,
    rolesChainRef: rolesKvChainRef,
    rolesLatestRef: rolesKvLatestRef,
    rolesCooldownRef: rolesKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync: cloudSyncTrackerRef.current,
  });

  useOperationalDomainsPersistence({
    isDataLoaded,
    cloudSync: cloudSyncTrackerRef.current,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    invoices,
    invoicesRefs: {
      chainRef: invoicesKvChainRef,
      latestRef: invoicesKvLatestRef,
      cooldownUntilRef: invoicesKvCooldownUntilRef,
    },
    invoicesHydratedRef: invoicesHydratedFromKvRef,
    requests,
    requestsRefs: {
      chainRef: requestsKvChainRef,
      latestRef: requestsKvLatestRef,
      cooldownUntilRef: requestsKvCooldownUntilRef,
    },
    requestsHydratedRef: requestsHydratedFromKvRef,
    chartOfAccounts,
    chartRefs: {
      hydratedFromKvRef: chartOfAccountsHydratedFromKvRef,
      skipHydrateRef: skipChartOfAccountsHydrateRef,
      chainRef: chartOfAccountsKvChainRef,
      latestRef: chartOfAccountsKvLatestRef,
      cooldownUntilRef: chartOfAccountsKvCooldownUntilRef,
    },
    chartHydratedRef: chartOfAccountsHydratedFromKvRef,
    products,
    productsRefs: {
      chainRef: productsKvChainRef,
      latestRef: productsKvLatestRef,
      cooldownUntilRef: productsKvCooldownUntilRef,
    },
    productsHydratedRef: productsHydratedFromKvRef,
    feeReceipts,
    feeReceiptsRefs: {
      chainRef: feeReceiptsKvChainRef,
      latestRef: feeReceiptsKvLatestRef,
      cooldownUntilRef: feeReceiptsKvCooldownUntilRef,
    },
    feeReceiptsHydratedRef: feeReceiptsHydratedFromKvRef,
    alertThresholds,
    alertRefs: {
      chainRef: alertThresholdsKvChainRef,
      latestRef: alertThresholdsKvLatestRef,
      cooldownUntilRef: alertThresholdsKvCooldownUntilRef,
    },
    alertHydratedRef: alertThresholdsHydratedFromKvRef,
    theme,
    themeRefs: {
      chainRef: themeKvChainRef,
      latestRef: themeKvLatestRef,
      cooldownUntilRef: themeKvCooldownUntilRef,
    },
    themeHydratedRef: themeHydratedFromKvRef,
    treasuryInvoices,
    treasuryInvoicesRefs: {
      chainRef: treasuryInvoicesKvChainRef,
      latestRef: treasuryInvoicesKvLatestRef,
      cooldownUntilRef: treasuryKvCooldownUntilRef,
    },
    treasuryBankBalance,
    treasuryBankBalanceRefs: {
      chainRef: treasuryBankBalanceKvChainRef,
      latestRef: treasuryBankBalanceKvLatestRef,
      cooldownUntilRef: treasuryKvCooldownUntilRef,
    },
    treasuryPaidHistory,
    treasuryPaidHistoryRefs: {
      chainRef: treasuryPaidHistoryKvChainRef,
      latestRef: treasuryPaidHistoryKvLatestRef,
      cooldownUntilRef: treasuryKvCooldownUntilRef,
    },
    treasuryHydratedRef: treasuryHydratedFromKvRef,
    treasuryBankBalanceLoadedRef: treasuryBankBalanceLoadedFromKvRef,
  });

  const { persistFleetNow, persistFleetChecklistNow, handleFleetDatasetUpdate } = useFleetPersistence({
    isDataLoaded,
    fleetDataset,
    setFleetDataset,
    hydratedRef: fleetHydratedFromKvRef,
    skipHydrateRef: skipFleetHydrateRef,
    chainRef: fleetKvChainRef,
    latestRef: fleetKvLatestRef,
    cooldownUntilRef: fleetKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync: cloudSyncTrackerRef.current,
    sqlTimestampsRef: fleetSqlTimestampsRef,
  });

  const { persistInventoryNow, handleInventoryDatasetUpdate } = useInventoryPersistence({
    isDataLoaded,
    inventoryDataset,
    setInventoryDataset,
    hydratedRef: inventoryHydratedFromKvRef,
    skipHydrateRef: skipInventoryHydrateRef,
    chainRef: inventoryKvChainRef,
    latestRef: inventoryKvLatestRef,
    cooldownUntilRef: inventoryKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync: cloudSyncTrackerRef.current,
  });

  const handleProductsUpdate = useCallback(
    async (next: Product[], successMessage?: string): Promise<boolean> => {
      const prevRef = productsKvLatestRef.current;
      const ok = await persistAppKvDomainNow({
        kvKey: 'data:products',
        payload: next,
        refs: {
          hydratedFromKvRef: productsHydratedFromKvRef,
          skipHydrateRef: skipProductsHydrateRef,
          cooldownUntilRef: productsKvCooldownUntilRef,
          chainRef: productsKvChainRef,
          latestRef: productsKvLatestRef,
        },
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        cloudSync: cloudSyncTrackerRef.current,
        errorMessage:
          'No se pudo guardar el catálogo de productos en la nube. Revisa sesión/red y vuelve a intentar.',
        successMessage,
        isDataLoaded,
        hydratedRef: productsHydratedFromKvRef,
      });
      if (ok) {
        setProducts(next);
      } else {
        productsKvLatestRef.current = prevRef;
      }
      return ok;
    },
    [isDataLoaded]
  );

  const handleInvoicesUpdate = useCallback((next: InvoiceDraft[]) => {
    invoicesKvLatestRef.current = next;
    setInvoices(next);
  }, []);

  const handleRequestsUpdate = useCallback((next: PurchaseRequest[]) => {
    requestsKvLatestRef.current = next;
    setRequests(next);
  }, []);

  const handleFeeReceiptsUpdate = useCallback((next: FeeReceiptGlobal[]) => {
    feeReceiptsKvLatestRef.current = next;
    setFeeReceipts(next);
  }, []);

  const handleTreasuryInvoicesUpdate = useCallback((next: any[]) => {
    treasuryInvoicesKvLatestRef.current = next;
    setTreasuryInvoices(next);
  }, []);

  const handleTreasuryBankBalanceUpdate = useCallback((next: number | undefined) => {
    treasuryBankBalanceLoadedFromKvRef.current = true;
    treasuryBankBalanceKvLatestRef.current = next;
    setTreasuryBankBalance(next);
  }, []);

  const handleTreasuryPaidHistoryUpdate = useCallback((next: any[]) => {
    treasuryPaidHistoryKvLatestRef.current = next;
    setTreasuryPaidHistory(next);
  }, []);

  const handleChartOfAccountsUpdate = useCallback(
    async (next: ChartOfAccountEntry[], successMessage?: string): Promise<boolean> => {
      setChartOfAccounts(next);
      chartOfAccountsKvLatestRef.current = next;
      return persistAppKvDomainNow({
        kvKey: 'data:chartOfAccounts',
        payload: next,
        refs: {
          hydratedFromKvRef: chartOfAccountsHydratedFromKvRef,
          skipHydrateRef: skipChartOfAccountsHydrateRef,
          cooldownUntilRef: chartOfAccountsKvCooldownUntilRef,
          chainRef: chartOfAccountsKvChainRef,
          latestRef: chartOfAccountsKvLatestRef,
        },
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        cloudSync: cloudSyncTrackerRef.current,
        errorMessage:
          'No se pudo guardar el plan de cuentas en la nube. Revisa sesión/red y vuelve a intentar.',
        successMessage,
        isDataLoaded,
        hydratedRef: chartOfAccountsHydratedFromKvRef,
      });
    },
    [isDataLoaded]
  );

  const applyRemoteKvRef = useRef<((key: string, value: unknown) => void) | null>(null);
  const remoteKvToastLastAtRef = useRef(0);

  applyRemoteKvRef.current = (key: string, value: unknown) => {
    if (!isDataLoaded || signingOutRef.current) return;
    if (key === 'maintenance:transactionsClearedAt') return;

    let applied = false;

    const finish = () => {
      if (!applied) return;
      markCrossTabEchoWindow(key);
      const now = Date.now();
      if (now - remoteKvToastLastAtRef.current >= 4000) {
        remoteKvToastLastAtRef.current = now;
        toast.info('Actualizado desde otra pestaña', {
          description: kvKeyDisplayLabel(key),
          duration: 2500,
        });
      }
      cloudSyncErrorRef.current = false;
      setCloudSyncPhase('synced');
    };

    switch (key) {
      case 'settings:config': {
        if (PRODUCTION_USE_SQL) return;
        if (!configHydratedFromKvRef.current) return;
        const next = value as ConfigStructure;
        if (kvPayloadsEqual(configKvLatestRef.current, next)) return;
        configKvLatestRef.current = next;
        configKvCooldownUntilRef.current = Date.now() + CONFIG_KV_COOLDOWN_MS;
        setConfig(next);
        applied = true;
        break;
      }
      case 'settings:system': {
        if (PRODUCTION_USE_SQL) return;
        if (!systemSettingsHydratedFromKvRef.current) return;
        const base = mergeSystemSettings(value as Partial<SystemSettings>);
        const merged = mergePettyCashMetaIntoSettings(
          base,
          pettyCashMetaKvLatestRef.current
        );
        if (kvPayloadsEqual(systemSettingsKvLatestRef.current, merged)) return;
        systemSettingsKvLatestRef.current = merged;
        systemSettingsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setSystemSettings(merged);
        applied = true;
        break;
      }
      case PETTY_CASH_META_KV_KEY: {
        if (!systemSettingsHydratedFromKvRef.current) return;
        setSystemSettings((prev) => {
          const next = applyPettyCashMetaRemoteUpdate(
            prev,
            value,
            pettyCashMetaKvLatestRef
          );
          if (!next) return prev;
          systemSettingsKvLatestRef.current = next;
          systemSettingsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
          return next;
        });
        applied = true;
        break;
      }
      case 'settings:theme': {
        if (PRODUCTION_USE_SQL) return;
        if (!themeHydratedFromKvRef.current) return;
        if (value !== 'dark' && value !== 'light') return;
        if (kvPayloadsEqual(themeKvLatestRef.current, value)) return;
        themeKvLatestRef.current = value;
        themeKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        markCrossTabEchoWindow(key);
        setTheme(value);
        applied = true;
        break;
      }
      case 'settings:alertThresholds': {
        if (PRODUCTION_USE_SQL) return;
        if (!alertThresholdsHydratedFromKvRef.current) return;
        const next = value as AlertThresholds;
        if (kvPayloadsEqual(alertThresholdsKvLatestRef.current, next)) return;
        alertThresholdsKvLatestRef.current = next;
        alertThresholdsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setAlertThresholds(next);
        applied = true;
        break;
      }
      case 'data:transactions': {
        if (!transactionsCloudHydrationDoneRef.current) return;
        if (TRANSACTIONS_USE_SQL) return;
        if (Date.now() < transactionsKvCooldownUntilRef.current) return;
        const remote = Array.isArray(value) ? hydrateTransactions(value) : [];
        const unique = Array.from(new Map(remote.map((t) => [t.id, t])).values());
        if (kvPayloadsEqual(transactionsKvLatestRef.current, unique)) return;
        transactionsKvLatestRef.current = unique;
        transactionsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setTransactions(unique);
        transactionsHydratedFromKvRef.current = true;
        applied = true;
        break;
      }
      case 'data:invoices': {
        if (PRODUCTION_USE_SQL) return;
        if (!invoicesHydratedFromKvRef.current) return;
        const unique = Array.isArray(value)
          ? (Array.from(
              new Map((value as InvoiceDraft[]).map((i) => [i.id, i])).values()
            ) as InvoiceDraft[])
          : [];
        if (kvPayloadsEqual(invoicesKvLatestRef.current, unique)) return;
        invoicesKvLatestRef.current = unique;
        invoicesKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setInvoices(unique);
        applied = true;
        break;
      }
      case 'data:providers': {
        if (PRODUCTION_USE_SQL) return;
        if (!providersHydratedFromKvRef.current) return;
        const list = Array.isArray(value)
          ? (Array.from(new Map((value as Provider[]).map((p) => [p.id, p])).values()) as Provider[])
          : [];
        if (kvPayloadsEqual(providersKvLatestRef.current, list)) return;
        providersKvLatestRef.current = list;
        providersKvCooldownUntilRef.current = Date.now() + PROVIDERS_KV_COOLDOWN_MS;
        setProviders(list);
        applied = true;
        break;
      }
      case 'data:products': {
        if (PRODUCTION_USE_SQL) return;
        if (!productsHydratedFromKvRef.current) return;
        const unique = Array.isArray(value)
          ? (Array.from(
              new Map((value as Product[]).map((p) => [p.id, p])).values()
            ) as Product[])
          : [];
        const mapped = unique.map((p) => ({
          ...p,
          createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt),
          updatedAt: p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt),
        }));
        if (kvPayloadsEqual(productsKvLatestRef.current, mapped)) return;
        productsKvLatestRef.current = mapped;
        productsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setProducts(mapped);
        applied = true;
        break;
      }
      case 'data:requests': {
        if (PRODUCTION_USE_SQL) return;
        if (!requestsHydratedFromKvRef.current) return;
        const unique = Array.isArray(value)
          ? (Array.from(
              new Map((value as PurchaseRequest[]).map((r) => [r.id, r])).values()
            ) as PurchaseRequest[])
          : [];
        if (kvPayloadsEqual(requestsKvLatestRef.current, unique)) return;
        requestsKvLatestRef.current = unique;
        requestsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setRequests(unique);
        applied = true;
        break;
      }
      case 'data:pettyCash': {
        if (PRODUCTION_USE_SQL) return;
        if (!pettyCashHydratedFromKvRef.current) return;
        const ptx = Array.isArray(value) ? (value as PettyCashTransaction[]) : [];
        const mapped = ptx.map((t) => ({
          ...t,
          date: parseTransactionDate(t.date),
          documentDate:
            t.documentDate != null ? parseTransactionDate(t.documentDate) : undefined,
        }));
        if (kvPayloadsEqual(pettyCashKvLatestRef.current, mapped)) return;
        pettyCashKvLatestRef.current = mapped;
        pettyCashKvCooldownUntilRef.current = Date.now() + PETTY_CASH_KV_COOLDOWN_MS;
        setPettyCashTransactions(mapped);
        applied = true;
        break;
      }
      case 'data:users': {
        if (PRODUCTION_USE_SQL && !usersAdminReloadRef.current) return;
        if (!canSaveUsers || !usersHydratedFromKvRef.current || !Array.isArray(value)) return;
        let list = dedupeUsersByEmail(value as User[]);
        list = applySuperAdminRoleFromConfig(list);
        if (kvPayloadsEqual(usersKvLatestRef.current, list)) return;
        usersKvLatestRef.current = list;
        usersKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setUsers(list);
        const em = currentUser.email?.trim().toLowerCase();
        if (em) {
          const row = resolveCurrentUserRow(list, em);
          if (row) setCurrentUser(row);
        }
        applied = true;
        break;
      }
      case 'data:roles': {
        if (PRODUCTION_USE_SQL && !usersAdminReloadRef.current) return;
        if (!rolesHydratedFromKvRef.current) return;
        const merged = mergeRolesWithDefaults(Array.isArray(value) ? (value as Role[]) : []);
        if (kvPayloadsEqual(rolesKvLatestRef.current, merged)) return;
        rolesKvLatestRef.current = merged;
        rolesKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setRoles(merged);
        applied = true;
        break;
      }
      case 'data:feeReceipts': {
        if (PRODUCTION_USE_SQL) return;
        if (!feeReceiptsHydratedFromKvRef.current) return;
        const list = Array.isArray(value) ? (value as FeeReceiptGlobal[]) : [];
        if (kvPayloadsEqual(feeReceiptsKvLatestRef.current, list)) return;
        feeReceiptsKvLatestRef.current = list;
        feeReceiptsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setFeeReceipts(list);
        applied = true;
        break;
      }
      case 'data:treasuryInvoices': {
        if (PRODUCTION_USE_SQL) return;
        if (!treasuryHydratedFromKvRef.current) return;
        const list = Array.isArray(value) ? value : [];
        if (kvPayloadsEqual(treasuryInvoicesKvLatestRef.current, list)) return;
        treasuryInvoicesKvLatestRef.current = list;
        treasuryKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setTreasuryInvoices(list);
        applied = true;
        break;
      }
      case 'data:treasuryBankBalance': {
        if (PRODUCTION_USE_SQL) return;
        if (!treasuryBankBalanceLoadedFromKvRef.current && !treasuryHydratedFromKvRef.current) return;
        const bal =
          value !== undefined && value !== null ? Number(value) : undefined;
        if (kvPayloadsEqual(treasuryBankBalanceKvLatestRef.current, bal)) return;
        treasuryBankBalanceKvLatestRef.current = bal;
        treasuryBankBalanceLoadedFromKvRef.current = true;
        treasuryKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setTreasuryBankBalance(bal);
        applied = true;
        break;
      }
      case 'data:treasuryPaidHistory': {
        if (PRODUCTION_USE_SQL) return;
        if (!treasuryHydratedFromKvRef.current) return;
        const list = Array.isArray(value) ? value : [];
        if (kvPayloadsEqual(treasuryPaidHistoryKvLatestRef.current, list)) return;
        treasuryPaidHistoryKvLatestRef.current = list;
        treasuryKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setTreasuryPaidHistory(list);
        applied = true;
        break;
      }
      case 'data:fleet': {
        if (FLEET_USE_SQL) return;
        if (!fleetHydratedFromKvRef.current) return;
        const next = normalizeFleetDataset(value as Partial<FleetDataset>);
        if (kvPayloadsEqual(fleetKvLatestRef.current, next)) return;
        fleetKvLatestRef.current = next;
        fleetKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setFleetDataset(next);
        applied = true;
        break;
      }
      case 'data:inventory': {
        if (INVENTORY_USE_SQL) return;
        if (!inventoryHydratedFromKvRef.current) return;
        const next = normalizeInventoryDataset(value as Partial<InventoryDataset>);
        if (kvPayloadsEqual(inventoryKvLatestRef.current, next)) return;
        inventoryKvLatestRef.current = next;
        inventoryKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setInventoryDataset(next);
        applied = true;
        break;
      }
      case 'data:chartOfAccounts': {
        if (PRODUCTION_USE_SQL) return;
        if (!chartOfAccountsHydratedFromKvRef.current) return;
        const list = Array.isArray(value) ? (value as ChartOfAccountEntry[]) : [];
        if (kvPayloadsEqual(chartOfAccountsKvLatestRef.current, list)) return;
        chartOfAccountsKvLatestRef.current = list;
        chartOfAccountsKvCooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        setChartOfAccounts(list);
        applied = true;
        break;
      }
      default:
        return;
    }

    finish();
  };

  useKvCrossTabSync(isAuthenticated && isDataLoaded, applyRemoteKvRef);

  const applyFleetRemoteRef = useRef<((dataset: FleetDataset) => void) | null>(null);
  const fleetRemoteToastLastAtRef = useRef(0);

  applyFleetRemoteRef.current = (dataset: FleetDataset) => {
    if (!isDataLoaded || signingOutRef.current || !fleetHydratedFromKvRef.current) return;
    const normalized = normalizeFleetDataset(dataset);
    if (
      !shouldApplyFleetRemoteSnapshot(
        fleetKvLatestRef.current,
        normalized,
        fleetKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    if (kvPayloadsEqual(fleetKvLatestRef.current, normalized)) return;
    const merged = mergeFleetRemoteIntoLocal(fleetKvLatestRef.current, normalized);
    if (kvPayloadsEqual(fleetKvLatestRef.current, merged)) return;
    fleetKvLatestRef.current = merged;
    if (!FLEET_USE_SQL) markCrossTabEchoWindow('data:fleet');
    fleetKvCooldownUntilRef.current = Date.now() + FLEET_REMOTE_COOLDOWN_MS;
    setFleetDataset(merged);
    const now = Date.now();
    if (now - fleetRemoteToastLastAtRef.current >= 4000) {
      fleetRemoteToastLastAtRef.current = now;
      toast.info('Flota actualizada desde la nube', { duration: 2500 });
    }
    cloudSyncErrorRef.current = false;
    setCloudSyncPhase('synced');
  };

  useFleetRealtimeSync(
    isAuthenticated && isDataLoaded && FLEET_USE_SQL,
    applyFleetRemoteRef,
    fleetKvLatestRef,
    fleetKvCooldownUntilRef
  );

  const applyInventoryRemoteRef = useRef<((dataset: InventoryDataset) => void) | null>(null);
  const inventoryRemoteToastLastAtRef = useRef(0);

  applyInventoryRemoteRef.current = (dataset: InventoryDataset) => {
    if (!isDataLoaded || signingOutRef.current || !inventoryHydratedFromKvRef.current) return;
    const normalized = normalizeInventoryDataset(dataset);
    if (
      !shouldApplyInventoryRemoteSnapshot(
        inventoryKvLatestRef.current,
        normalized,
        inventoryKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    if (kvPayloadsEqual(inventoryKvLatestRef.current, normalized)) return;
    inventoryKvLatestRef.current = normalized;
    markCrossTabEchoWindow('data:inventory');
    inventoryKvCooldownUntilRef.current = Date.now() + INVENTORY_REMOTE_COOLDOWN_MS;
    setInventoryDataset(normalized);
    const now = Date.now();
    if (now - inventoryRemoteToastLastAtRef.current >= 4000) {
      inventoryRemoteToastLastAtRef.current = now;
      toast.info('Inventario actualizado desde la nube', { duration: 2500 });
    }
    cloudSyncErrorRef.current = false;
    setCloudSyncPhase('synced');
  };

  useInventoryRealtimeSync(
    isAuthenticated && isDataLoaded && INVENTORY_USE_SQL,
    applyInventoryRemoteRef,
    inventoryKvLatestRef,
    inventoryKvCooldownUntilRef
  );

  const applyTransactionsRemoteRef = useRef<((items: Transaction[]) => void) | null>(null);
  applyTransactionsRemoteRef.current = (items: Transaction[]) => {
    if (!isDataLoaded || signingOutRef.current || !transactionsCloudHydrationDoneRef.current) return;
    const unique = Array.from(new Map(items.map((t) => [t.id, t])).values());
    if (
      !shouldApplyTransactionsRemoteSnapshot(
        transactionsKvLatestRef.current,
        unique,
        transactionsKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    if (kvPayloadsEqual(transactionsKvLatestRef.current, unique)) return;
    transactionsKvLatestRef.current = unique;
    transactionsKvCooldownUntilRef.current = Date.now() + TRANSACTIONS_REMOTE_COOLDOWN_MS;
    setTransactions(unique);
    cloudSyncErrorRef.current = false;
    setCloudSyncPhase('synced');
  };

  useTransactionsRealtimeSync(
    isAuthenticated && isDataLoaded && TRANSACTIONS_USE_SQL,
    applyTransactionsRemoteRef,
    transactionsKvLatestRef,
    transactionsKvCooldownUntilRef
  );

  const applyProvidersRemoteRef = useRef<((items: Provider[]) => void) | null>(null);
  applyProvidersRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !providersHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        providersKvLatestRef.current,
        items,
        providersKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    providersKvLatestRef.current = items;
    providersKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setProviders(items);
  };

  const applyPettyCashRemoteRef = useRef<((items: PettyCashTransaction[]) => void) | null>(null);
  applyPettyCashRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !pettyCashHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        pettyCashKvLatestRef.current,
        items,
        pettyCashKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    pettyCashKvLatestRef.current = items;
    pettyCashKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setPettyCashTransactions(items);
  };

  const applyInvoicesRemoteRef = useRef<((items: InvoiceDraft[]) => void) | null>(null);
  applyInvoicesRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !invoicesHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        invoicesKvLatestRef.current,
        items,
        invoicesKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    invoicesKvLatestRef.current = items;
    invoicesKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setInvoices(items);
  };

  const applyRequestsRemoteRef = useRef<((items: PurchaseRequest[]) => void) | null>(null);
  applyRequestsRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !requestsHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        requestsKvLatestRef.current,
        items,
        requestsKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    requestsKvLatestRef.current = items;
    requestsKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setRequests(items);
  };

  const applyUsersRemoteRef = useRef<((items: User[]) => void) | null>(null);
  applyUsersRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !usersHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        usersKvLatestRef.current,
        items,
        usersKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    usersKvLatestRef.current = items;
    usersKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setUsers(items);
  };

  const applyRolesRemoteRef = useRef<((items: Role[]) => void) | null>(null);
  applyRolesRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !rolesHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        rolesKvLatestRef.current,
        items,
        rolesKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    rolesKvLatestRef.current = items;
    rolesKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setRoles(items);
  };

  const applyProductsRemoteRef = useRef<((items: Product[]) => void) | null>(null);
  applyProductsRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !productsHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        productsKvLatestRef.current,
        items,
        productsKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    productsKvLatestRef.current = items;
    productsKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setProducts(items);
  };

  const applyFeeReceiptsRemoteRef = useRef<((items: FeeReceiptGlobal[]) => void) | null>(null);
  applyFeeReceiptsRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !feeReceiptsHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        feeReceiptsKvLatestRef.current,
        items,
        feeReceiptsKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    feeReceiptsKvLatestRef.current = items;
    feeReceiptsKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setFeeReceipts(items);
  };

  const applyChartRemoteRef = useRef<((items: ChartOfAccountEntry[]) => void) | null>(null);
  applyChartRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !chartOfAccountsHydratedFromKvRef.current) return;
    if (
      !shouldApplyListRemoteSnapshot(
        chartOfAccountsKvLatestRef.current,
        items,
        chartOfAccountsKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    chartOfAccountsKvLatestRef.current = items;
    chartOfAccountsKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setChartOfAccounts(items);
  };

  const applyConfigRemoteRef = useRef<((items: ConfigStructure) => void) | null>(null);
  applyConfigRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !configHydratedFromKvRef.current) return;
    if (
      !shouldApplyObjectRemoteSnapshot(
        configKvLatestRef.current,
        items,
        configKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    configKvLatestRef.current = items;
    configKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setConfig(items);
  };

  const applySystemSettingsRemoteRef = useRef<((items: SystemSettings) => void) | null>(null);
  applySystemSettingsRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !systemSettingsHydratedFromKvRef.current) return;
    const merged = mergeSystemSettingsSqlAndKv(
      items,
      systemSettingsKvLatestRef.current
    );
    if (
      !shouldApplyObjectRemoteSnapshot(
        systemSettingsKvLatestRef.current,
        merged,
        systemSettingsKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    systemSettingsKvLatestRef.current = merged;
    asistenciaKvLatestRef.current = mergeAsistenciaSettings(merged.asistencia);
    pettyCashMetaKvLatestRef.current = extractPettyCashMeta(merged.pettyCash);
    systemSettingsKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setSystemSettings(merged);
  };

  const applyPettyCashMetaRemoteRef = useRef<((items: SystemSettings) => void) | null>(null);
  applyPettyCashMetaRemoteRef.current = (items) => {
    applySystemSettingsRemoteRef.current?.(items);
  };

  const applyAlertThresholdsRemoteRef = useRef<((items: AlertThresholds) => void) | null>(null);
  applyAlertThresholdsRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !alertThresholdsHydratedFromKvRef.current) return;
    if (
      !shouldApplyObjectRemoteSnapshot(
        alertThresholdsKvLatestRef.current,
        items,
        alertThresholdsKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    alertThresholdsKvLatestRef.current = items;
    alertThresholdsKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setAlertThresholds(items);
  };

  const applyThemeRemoteRef = useRef<((t: 'dark' | 'light') => void) | null>(null);
  applyThemeRemoteRef.current = (t) => {
    if (!isDataLoaded || signingOutRef.current || !themeHydratedFromKvRef.current) return;
    if (
      !shouldApplyValueRemoteSnapshot(themeKvLatestRef.current, t, themeKvCooldownUntilRef.current)
    ) {
      return;
    }
    themeKvLatestRef.current = t;
    themeKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setTheme(t);
  };

  const applyTreasuryInvoicesRemoteRef = useRef<((items: unknown[]) => void) | null>(null);
  applyTreasuryInvoicesRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !treasuryHydratedFromKvRef.current) return;
    const local = treasuryInvoicesKvLatestRef.current;
    const remote = Array.isArray(items) ? items : [];
    if (
      !shouldApplyListRemoteSnapshot(
        Array.isArray(local) ? local : [],
        remote,
        treasuryKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    treasuryInvoicesKvLatestRef.current = remote;
    treasuryKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setTreasuryInvoices(remote);
  };

  const applyTreasuryBankBalanceRemoteRef = useRef<((v: number | undefined) => void) | null>(null);
  applyTreasuryBankBalanceRemoteRef.current = (v) => {
    if (!isDataLoaded || signingOutRef.current || !treasuryHydratedFromKvRef.current) return;
    if (
      !shouldApplyValueRemoteSnapshot(
        treasuryBankBalanceKvLatestRef.current,
        v,
        treasuryKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    treasuryBankBalanceKvLatestRef.current = v;
    treasuryBankBalanceLoadedFromKvRef.current = true;
    treasuryKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setTreasuryBankBalance(v);
  };

  const applyTreasuryPaidHistoryRemoteRef = useRef<((items: unknown[]) => void) | null>(null);
  applyTreasuryPaidHistoryRemoteRef.current = (items) => {
    if (!isDataLoaded || signingOutRef.current || !treasuryHydratedFromKvRef.current) return;
    const local = treasuryPaidHistoryKvLatestRef.current;
    const remote = Array.isArray(items) ? items : [];
    if (
      !shouldApplyListRemoteSnapshot(
        Array.isArray(local) ? local : [],
        remote,
        treasuryKvCooldownUntilRef.current
      )
    ) {
      return;
    }
    treasuryPaidHistoryKvLatestRef.current = remote;
    treasuryKvCooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
    setTreasuryPaidHistory(remote);
  };

  const productionRealtimeHandlers = useMemo(
    () => ({
      providers: applyProvidersRemoteRef,
      providersLatest: providersKvLatestRef,
      pettyCash: applyPettyCashRemoteRef,
      pettyCashLatest: pettyCashKvLatestRef,
      pettyCashMeta: applyPettyCashMetaRemoteRef,
      pettyCashMetaLatest: pettyCashMetaKvLatestRef,
      invoices: applyInvoicesRemoteRef,
      invoicesLatest: invoicesKvLatestRef,
      requests: applyRequestsRemoteRef,
      requestsLatest: requestsKvLatestRef,
      users: applyUsersRemoteRef,
      usersLatest: usersKvLatestRef,
      usersAdminReload: usersAdminReloadRef,
      authUserId: authUserIdRef,
      roles: applyRolesRemoteRef,
      rolesLatest: rolesKvLatestRef,
      products: applyProductsRemoteRef,
      productsLatest: productsKvLatestRef,
      feeReceipts: applyFeeReceiptsRemoteRef,
      feeReceiptsLatest: feeReceiptsKvLatestRef,
      chartOfAccounts: applyChartRemoteRef,
      chartOfAccountsLatest: chartOfAccountsKvLatestRef,
      config: applyConfigRemoteRef,
      configLatest: configKvLatestRef,
      systemSettings: applySystemSettingsRemoteRef,
      systemSettingsLatest: systemSettingsKvLatestRef,
      alertThresholds: applyAlertThresholdsRemoteRef,
      alertThresholdsLatest: alertThresholdsKvLatestRef,
      theme: applyThemeRemoteRef,
      themeLatest: themeKvLatestRef,
      treasuryInvoices: applyTreasuryInvoicesRemoteRef,
      treasuryInvoicesLatest: treasuryInvoicesKvLatestRef,
      treasuryBankBalance: applyTreasuryBankBalanceRemoteRef,
      treasuryBankBalanceLatest: treasuryBankBalanceKvLatestRef,
      treasuryPaidHistory: applyTreasuryPaidHistoryRemoteRef,
      treasuryPaidHistoryLatest: treasuryPaidHistoryKvLatestRef,
    }),
    []
  );

  usersAdminReloadRef.current = isAdminAppUser(currentUser);
  authUserIdRef.current = currentUser.id !== 'guest' ? currentUser.id : null;

  useProductionRealtimeSync(
    isAuthenticated && isDataLoaded && PRODUCTION_USE_SQL,
    productionRealtimeHandlers
  );

  const handleCloudSyncRetry = useCallback(() => {
    cloudSyncErrorRef.current = false;
    void hydrateFromKvRef.current?.();
  }, []);

  // --- ALERTS ENGINE (diferido al idle: no bloquea el hilo al hidratar datos) ---
  useEffect(() => {
    if (!isDataLoaded) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const newAlerts = generateAlerts({
        transactions,
        invoices,
        requests,
        pettyCash: pettyCashTransactions,
        users,
        thresholds: alertThresholds,
        fleetDataset,
        alertSources: goLiveAlertSources(),
      });
      setAlerts(applyReadState(newAlerts));
    };
    let ricId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback !== "undefined") {
      ricId = requestIdleCallback(run, { timeout: 1500 });
    } else {
      timeoutId = setTimeout(run, 1);
    }
    return () => {
      cancelled = true;
      if (ricId !== undefined) cancelIdleCallback(ricId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [
    transactions,
    invoices,
    requests,
    pettyCashTransactions,
    users,
    alertThresholds,
    fleetDataset,
    isDataLoaded,
    applyReadState,
  ]);

  const handleMarkAlertAsRead = (id: string) => {
    markAlertRead(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  };

  const handleMarkAllAlertsAsRead = () => {
    setAlerts((prev) => {
      markAllAlertsRead(prev.map((a) => a.id));
      return prev.map((a) => ({ ...a, read: true }));
    });
  };


  // Handle Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handlePrevMonth = () =>
    setCurrentDate((prev) => subMonths(isValid(prev) ? prev : new Date(), 1));
  const handleNextMonth = () =>
    setCurrentDate((prev) => addMonths(isValid(prev) ? prev : new Date(), 1));

  /**
   * Tras signIn en LoginPage: SIGNED_IN ya dispara hydrateFromKv en Supabase.
   * Solo se usa en modo local/demo.
   */
  const handleLogin = () => {
    if ((import.meta.env.VITE_BACKEND ?? 'supabase') === 'supabase') return;
    void hydrateFromKvRef.current?.();
  };

  const handleLogout = async () => {
      signingOutRef.current = true;
      await flushKvSaveChains([
        transactionsKvChainRef,
        providersKvChainRef,
        pettyCashKvChainRef,
        pettyCashMetaKvChainRef,
        fleetKvChainRef,
        inventoryKvChainRef,
        configKvChainRef,
        invoicesKvChainRef,
        requestsKvChainRef,
        usersKvChainRef,
        rolesKvChainRef,
        systemSettingsKvChainRef,
        asistenciaKvChainRef,
        productsKvChainRef,
        feeReceiptsKvChainRef,
        chartOfAccountsKvChainRef,
        alertThresholdsKvChainRef,
        themeKvChainRef,
        treasuryInvoicesKvChainRef,
        treasuryBankBalanceKvChainRef,
        treasuryPaidHistoryKvChainRef,
      ]);
      await flushAllSqlSaveQueues();
      pendingHydrateRef.current = false;
      setIsAuthChecking(false);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('grooflow_local_session');
      }
      const signOutWithTimeout = async () => {
        await Promise.race([
          supabase.auth.signOut({ scope: 'global' }),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);
      };
      try {
        await signOutWithTimeout();
      } catch (e) {
        console.error('[GrooFlow] signOut', e);
      }
      try {
        const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
        if (backend === 'supabase') {
          const {
            data: { session: still },
          } = await supabase.auth.getSession();
          if (still?.access_token) {
            await signOutWithTimeout();
          }
        }
      } catch {
        /* ignore */
      }
      cloudDataHydratedRef.current = false;
      providersCloudHydrationDoneRef.current = false;
      providersHydratedFromKvRef.current = false;
      pettyCashHydratedFromKvRef.current = false;
      providersKvCooldownUntilRef.current = 0;
      pettyCashKvCooldownUntilRef.current = 0;
      configHydratedFromKvRef.current = false;
      configKvCooldownUntilRef.current = 0;
      skipProvidersHydrateRef.current = false;
      skipPettyCashHydrateRef.current = false;
      skipConfigHydrateRef.current = false;
      resetAllKvDomainRefs();
      resetKvSaveChains();
      cloudSyncPendingRef.current = 0;
      cloudSyncErrorRef.current = false;
      setCloudSyncPhase('idle');
      setProviders((import.meta.env.VITE_BACKEND ?? 'supabase') === 'local' ? initialProviders : []);
      setPettyCashTransactions([]);
      setCanSaveUsers(true);
      setIsDataLoaded(false);
      setCurrentUser(GUEST_USER);
      setIsAuthenticated(false);
      setIsProfileOpen(false);
      signingOutRef.current = false;
      navigate(viewToPath('dashboard'), { replace: true });
  };

  const handleLogoutRef = useRef(handleLogout);
  handleLogoutRef.current = handleLogout;

  const syncUserAuthAccess = useCallback(async (user: User, enabled: boolean) => {
    if ((import.meta.env.VITE_BACKEND ?? 'supabase') !== 'supabase') return true;
    const key = user.email?.trim() || user.id;
    if (!key || key === 'guest') return true;
    try {
      await repository.auth.setUserAuthEnabled(key, enabled);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el acceso en Auth');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'guest') return;
    const row =
      users.find((u) => u.id === currentUser.id) ??
      users.find(
        (u) =>
          currentUser.email &&
          (u.email || '').trim().toLowerCase() === currentUser.email!.trim().toLowerCase()
      );
    const blocked = isUserSessionBlocked(row ?? currentUser);
    if (!blocked) return;
    toast.error('Tu cuenta fue desactivada. Contacta al Administrador.');
    void handleLogoutRef.current();
  }, [isAuthenticated, currentUser, users]);

  useEffect(() => {
    setKvSessionFatalHandler(() => {
      void handleLogoutRef.current();
    });
    return () => setKvSessionFatalHandler(null);
  }, []);

  const handleSaveSedesCatalog = (result: SedesCatalogSaveResult) => {
    const fallback =
      result.entries.find((e) => e.enabled)?.name ??
      result.entries[0]?.name ??
      'Principal';
    const loc = (x?: string) => migrateLocationField(x, result, fallback);

    setSystemSettings((s) => ({ ...s, sedesCatalog: result.entries }));

    setUsers((prev) =>
      prev.map((u) => ({
        ...u,
        sedes: u.sedes?.map((sede) => result.renames[sede] ?? sede),
        location: u.location ? loc(u.location) ?? fallback : u.location,
      }))
    );

    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        location: t.location ? loc(t.location) ?? fallback : t.location,
      }))
    );

    setInvoices((prev) =>
      prev.map((inv) => ({
        ...inv,
        location: inv.location ? loc(inv.location) ?? fallback : inv.location,
      }))
    );

    setRequests((prev) =>
      prev.map((r) => ({
        ...r,
        location: r.location ? loc(r.location) ?? fallback : r.location,
      }))
    );

    setPettyCashTransactions((prev) =>
      prev.map((tx) => ({
        ...tx,
        location: tx.location ? loc(tx.location) ?? fallback : tx.location,
      }))
    );

    setFeeReceipts((prev) =>
      prev.map((fr) => ({
        ...fr,
        location: fr.location ? loc(fr.location) ?? fallback : fr.location,
      }))
    );

    setProducts((prev) =>
      prev.map((product) => ({
        ...product,
        location: product.location ? loc(product.location) ?? fallback : product.location,
      }))
    );

    setTreasuryInvoices((prev) =>
      prev.map((row: { location?: string } & Record<string, unknown>) => ({
        ...row,
        location: row.location ? loc(row.location) ?? fallback : row.location,
      }))
    );

    setCurrentUser((cu) => ({
      ...cu,
      sedes: cu.sedes?.map((sede) => result.renames[sede] ?? sede),
      location: cu.location ? loc(cu.location) ?? fallback : cu.location,
    }));
  };

  const handleUpdateTransaction = async (updatedData: any) => {
     if (!editingTransaction) return;

     const updatedTx: Transaction = {
         ...editingTransaction,
         ...updatedData,
         amount: parseFloat(updatedData.amount),
         date: parseTransactionDate(updatedData.date),
         id: editingTransaction.id
     };

     const updatedList = transactions.map(t => t.id === updatedTx.id ? updatedTx : t);
     await persistTransactionsNow(updatedList, "Transacción actualizada correctamente");
     setIsEditDialogOpen(false);
     setEditingTransaction(null);
  };

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleBulkDeleteTransactions = async (transactionIds: string[]) => {
    const ids = new Set(transactionIds);
    const next = transactions.filter((transaction) => !ids.has(transaction.id));
    const ok = await persistTransactionsNow(
      next,
      `${transactionIds.length} transacción(es) eliminada(s)`
    );
    if (ok) {
      void writeAuditLog(getSupabaseClient(), 'transaction_bulk_delete', {
        entity: 'Transacciones',
        details: `Eliminó ${transactionIds.length} transacción(es)`,
        count: transactionIds.length,
      });
    }
  };

  const handleAddTransaction = async (data: any) => {
    const newTransaction: Transaction = {
      id: generateEntityId('tx'),
      amount: Number(data.amount),
      type: data.type as TransactionType,
      category: data.category as Category,
      subcategory: data.subcategory,
      concept: data.concept,
      description: data.description,
      date: parseTransactionDate(data.date),
      account: data.account || undefined,
      currency: data.currency || undefined,
      operation: data.operation || undefined,
      reference: data.reference || undefined,
      providerId: data.providerId,
      location: data.location || undefined,
    };
    const ok = await persistTransactionsNow(
      [newTransaction, ...transactions],
      'Transacción guardada correctamente'
    );
    if (ok) {
      void writeAuditLog(getSupabaseClient(), 'transaction_create', {
        entity: 'Transacciones',
        details: `Creó transacción ${newTransaction.type} · S/ ${newTransaction.amount}`,
        transactionId: newTransaction.id,
      });
    }
  };

  const handleImportTransactions = async (newTransactions: Transaction[]) => {
    const ok = await persistTransactionsNow(
      [...newTransactions, ...transactions],
      `${newTransactions.length} transacción(es) importada(s) y guardada(s)`
    );
    if (ok && newTransactions.length > 0) {
      void writeAuditLog(getSupabaseClient(), 'transaction_import', {
        entity: 'Transacciones',
        details: `Importó ${newTransactions.length} transacción(es)`,
        count: newTransactions.length,
      });
    }
  };

  const handleProjectTransactions = async (projectedTxs: Transaction[]) => {
     await persistTransactionsNow([...transactions, ...projectedTxs], `${projectedTxs.length} transacciones proyectadas guardadas`);
  };

  const mergedTreasuryForCashflow = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const x of treasuryPaidHistory) {
      if (x && typeof x === "object" && "id" in x && (x as { id: unknown }).id != null) {
        m.set(String((x as { id: unknown }).id), x as Record<string, unknown>);
      }
    }
    for (const x of treasuryInvoices) {
      if (x && typeof x === "object" && "id" in x && (x as { id: unknown }).id != null) {
        m.set(String((x as { id: unknown }).id), x as Record<string, unknown>);
      }
    }
    return Array.from(m.values());
  }, [treasuryInvoices, treasuryPaidHistory]);

  const handleUpsertCashFlowCell = useCallback(
    async (payload: {
      category: string;
      subcategory?: string;
      concept?: string;
      type: TransactionType;
      date: Date;
      amount: number;
    }) => {
      const day = startOfDay(payload.date).getTime();
      const idx = transactions.findIndex((t) => {
        const td = startOfDay(parseTransactionDate(t.date)).getTime();
        return (
          t.category === payload.category &&
          (t.concept || "") === (payload.concept || "") &&
          (t.subcategory || "") === (payload.subcategory || "") &&
          t.type === payload.type &&
          td === day
        );
      });
      const next = [...transactions];
      let createdId: string | null = null;
      if (idx >= 0) {
        next[idx] = { ...next[idx]!, amount: payload.amount };
      } else {
        createdId = generateEntityId('cf');
        next.unshift({
          id: createdId,
          amount: payload.amount,
          type: payload.type,
          category: payload.category as Category,
          subcategory: payload.subcategory || undefined,
          concept: payload.concept || undefined,
          description: 'Proyección flujo (triple capa)',
          date: startOfDay(payload.date),
        });
      }
      const ok = await persistTransactionsNow(next, 'Valor guardado en transacciones');
      if (ok && createdId) {
        void writeAuditLog(getSupabaseClient(), 'transaction_create', {
          entity: 'Flujo de caja',
          details: `Proyección en celda · S/ ${payload.amount}`,
          transactionId: createdId,
        });
      }
    },
    [persistTransactionsNow, transactions]
  );

  const handleDeleteTransaction = async (id: string) => {
    const removed = transactions.find((t) => t.id === id);
    const ok = await persistTransactionsNow(
      transactions.filter((t) => t.id !== id),
      'Transacción eliminada correctamente'
    );
    if (ok && removed) {
      void writeAuditLog(getSupabaseClient(), 'transaction_delete', {
        entity: 'Transacción',
        details: `Eliminó: ${(removed.description || removed.category || id).slice(0, 120)}`,
        transactionId: id,
        amount: removed.amount,
        location: removed.location ?? null,
      });
    }
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast.info("Factura eliminada desde auditoría");
  };

  const handleRegisterPayment = async (invoice: InvoiceDraft) => {
    // 1. Create the Transaction
    const newTransaction: Transaction = {
        id: `pay-${invoice.id}`,
        amount: invoice.total,
        type: 'expense',
        category: 'Insumos', // Default category, in real app should be selectable
        subcategory: 'Proveedores',
        description: `Pago Factura ${invoice.invoiceNumber} - ${invoice.provider}`,
        date: new Date(), // Paid today
    };

    await persistTransactionsNow([newTransaction, ...transactions]);

    // 2. Update Invoice Status
    setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, status: 'paid' } : inv));

    toast.success("Pago registrado correctamente", {
        description: `Se ha descontado S/${invoice.total} del flujo de caja.`
    });
  };

    const handleRequestStatusChange = (id: string, newStatus: RequestStatus, comment?: string) => {
        // Actualizar estado de la solicitud
        const reqIndex = requests.findIndex(r => r.id === id);
        if (reqIndex === -1) return;

        const req = requests[reqIndex];
        const updatedReq = { ...req, status: newStatus };

        // Si se aprueba, firmamos con el usuario actual
        if (newStatus === 'approved') {
            updatedReq.approverName = currentUser.name;
            updatedReq.approverInitials = currentUser.initials;
            updatedReq.approvalComment = comment;
        } else if (newStatus === 'rejected') {
            updatedReq.rejectionReason = comment;
        }

        const newRequests = [...requests];
        newRequests[reqIndex] = updatedReq;
        setRequests(newRequests);

        // Si se aprueba, crear la obligación de pago en Finanzas
        if (newStatus === 'approved') {
            if (req) {
                // Calcular fecha de vencimiento según la condición de pago
                const issueDate = new Date();
                const dueDate = req.paymentCondition === 'cash' 
                    ? issueDate 
                    : new Date(Date.now() + 86400000 * 30); // 30 días si es crédito
                
                // Incluir comentario en la descripción si existe
                const commentText = comment ? ` (Nota: ${comment})` : '';

                const newInvoice: InvoiceDraft = {
                    id: `inv-from-req-${req.id}`,
                    fileName: 'Generado desde Solicitud',
                    provider: req.providerName,
                    invoiceNumber: 'PENDIENTE', // Se actualizará cuando llegue la factura real
                    issueDate: format(issueDate, 'yyyy-MM-dd'),
                    dueDate: format(dueDate, 'yyyy-MM-dd'),
                    description: `[SOLICITUD APROBADA por ${currentUser.initials}] ${req.description}${commentText}`,
                    location: req.location,
                    subtotal: Number((req.amount / 1.18).toFixed(2)),
                    igv: Number((req.amount - (req.amount / 1.18)).toFixed(2)),
                    total: req.amount,
                    status: 'approved' // Ya nace aprobada para pago
                };
                setInvoices(prev => [...prev, newInvoice]);
                toast.success(`Solicitud aprobada por ${currentUser.name}`, {
                    description: `Vencimiento programado para: ${format(dueDate, 'dd/MM/yyyy')}`
                });
            }
        } else if (newStatus === 'rejected') {
            toast.info("Solicitud rechazada");
        }
    };

    const handleStressTest = async () => {
        const { generateStressData } = await import("./utils/stressTestGenerator");
        const { transactions: newTx, invoices: newInv, users: newUsrs } = generateStressData();
        setTransactions((prev) => [...newTx, ...prev]);
        setInvoices((prev) => [...newInv, ...prev]);
        setUsers((prev) => [...prev, ...newUsrs]);

        toast.success("STRESS TEST COMPLETADO", {
            description: `Se han generado ${newTx.length} transacciones, ${newInv.length} facturas y ${newUsrs.length} usuarios.`,
        });
    };

    const handleResetData = async () => {
      const email = currentUser.email?.trim().toLowerCase();
      const canReset =
        currentUser.role === 'super_admin' ||
        !!(email && getSuperAdminEmails().has(email));
      if (!canReset) {
        toast.error('Solo super administradores pueden reiniciar datos operativos.');
        return;
      }
      if (!isDataLoaded) {
        toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');
        return;
      }

      const toastId = toast.loading('Reiniciando datos operativos…');
      const { data: sess } = await getSupabaseClient().auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      const { ok, failed } = await clearOperationalData(uid);

      const emptyFleet = normalizeFleetDataset({});
      transactionsKvLatestRef.current = [];
      invoicesKvLatestRef.current = [];
      providersKvLatestRef.current = [];
      pettyCashKvLatestRef.current = [];
      requestsKvLatestRef.current = [];
      productsKvLatestRef.current = [];
      feeReceiptsKvLatestRef.current = [];
      chartOfAccountsKvLatestRef.current = [];
      fleetKvLatestRef.current = emptyFleet;
      fleetSqlTimestampsRef.current = new Map();
      treasuryInvoicesKvLatestRef.current = [];
      treasuryBankBalanceKvLatestRef.current = undefined;
      treasuryPaidHistoryKvLatestRef.current = [];

      setTransactions([]);
      setInvoices([]);
      setProviders([]);
      setPettyCashTransactions([]);
      setRequests([]);
      setProducts([]);
      setFeeReceipts([]);
      setChartOfAccounts([]);
      setFleetDataset(emptyFleet);
      setTreasuryInvoices([]);
      setTreasuryBankBalance(undefined);
      setTreasuryPaidHistory([]);

      toast.dismiss(toastId);
      if (!ok) {
        toast.error('Reinicio incompleto', {
          description: `Algunos dominios no se limpiaron: ${failed.slice(0, 4).join(', ')}${failed.length > 4 ? '…' : ''}`,
          duration: 12_000,
        });
        return;
      }
      void writeAuditLog(getSupabaseClient(), 'operational_reset', {
        entity: 'Sistema',
        details: 'Reinicio de datos operativos (super admin)',
        failedDomains: failed,
      });
      toast.success('Base de datos reiniciada correctamente.', {
        description: 'Se conservaron usuarios, roles y configuración.',
      });
    };

  const { totalIncome, totalExpense, netCashFlow } = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { totalIncome: income, totalExpense: expense, netCashFlow: income - expense };
  }, [transactions]);

  const transactionSubcategoryOptions = useMemo(() => {
    const subcategories = new Set<string>();

    Object.entries(config)
      .filter(([category]) => txFilterCategory === "all" || labelsMatch(category, txFilterCategory))
      .forEach(([category, definition]) => {
        getSubcategories(definition, category).forEach((subcategory) => {
          if (subcategory.name) subcategories.add(subcategory.name);
        });
      });

    transactions
      .filter((transaction) => txFilterCategory === "all" || labelsMatch(transaction.category, txFilterCategory))
      .forEach((transaction) => {
        const subcategory = String(transaction.subcategory || '').trim();
        if (subcategory) subcategories.add(subcategory);
      });

    return Array.from(subcategories).sort((a, b) => a.localeCompare(b));
  }, [config, transactions, txFilterCategory]);

  const transactionConceptOptions = useMemo(() => {
    const concepts = new Set<string>();

    Object.entries(config)
      .filter(([category]) => txFilterCategory === "all" || labelsMatch(category, txFilterCategory))
      .forEach(([category, definition]) => {
        getSubcategories(definition, category)
          .filter((subcategory) => txFilterSubcategory === "all" || labelsMatch(subcategory.name, txFilterSubcategory))
          .forEach((subcategory) => {
            subcategory.concepts.forEach((concept) => concepts.add(concept.name));
          });
      });

    transactions
      .filter((transaction) => txFilterCategory === "all" || labelsMatch(transaction.category, txFilterCategory))
      .filter((transaction) => txFilterSubcategory === "all" || labelsMatch(transaction.subcategory, txFilterSubcategory))
      .forEach((transaction) => {
        const concept = String(transaction.concept || transaction.subcategory || '').trim();
        if (concept) concepts.add(concept);
      });

    return Array.from(concepts).sort((a, b) => a.localeCompare(b));
  }, [config, transactions, txFilterCategory, txFilterSubcategory]);

  const applyTransactionDatePreset = useCallback((preset: TransactionDatePreset) => {
    setTxDatePreset(preset);
    const today = startOfDay(new Date());
    if (preset === "all") {
      setTxFilterDateStart("");
      setTxFilterDateEnd("");
      return;
    }
    if (preset === "custom") return;
    if (preset === "last7") {
      setTxFilterDateStart(formatDateInputValue(subDays(today, 6)));
      setTxFilterDateEnd(formatDateInputValue(today));
      return;
    }
    if (preset === "currentMonth") {
      setTxFilterDateStart(formatDateInputValue(startOfMonth(today)));
      setTxFilterDateEnd(formatDateInputValue(endOfMonth(today)));
      return;
    }
    if (preset === "previousMonth") {
      const previous = subMonths(today, 1);
      setTxFilterDateStart(formatDateInputValue(startOfMonth(previous)));
      setTxFilterDateEnd(formatDateInputValue(endOfMonth(previous)));
      return;
    }
    if (preset === "year") {
      setTxFilterDateStart(formatDateInputValue(startOfYear(today)));
      setTxFilterDateEnd(formatDateInputValue(endOfYear(today)));
    }
  }, []);

  useEffect(() => {
    if (txFilterConcept !== "all" && !transactionConceptOptions.includes(txFilterConcept)) {
      setTxFilterConcept("all");
    }
  }, [transactionConceptOptions, txFilterConcept]);

  useEffect(() => {
    if (txFilterSubcategory !== "all" && !transactionSubcategoryOptions.includes(txFilterSubcategory)) {
      setTxFilterSubcategory("all");
    }
  }, [transactionSubcategoryOptions, txFilterSubcategory]);

  // Filter Logic (evita re-filtrar en cada re-render)
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const tDate = parseTransactionDate(t.date);
        const start = txFilterDateStart ? parseTransactionDate(txFilterDateStart) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = txFilterDateEnd ? parseTransactionDate(txFilterDateEnd) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const dateMatch = (!start || tDate >= start) && (!end || tDate <= end);
        const categoryMatch = txFilterCategory === "all" || labelsMatch(t.category, txFilterCategory);
        const subcategoryMatch = txFilterSubcategory === "all" || labelsMatch(t.subcategory, txFilterSubcategory);
        const conceptValue = String(t.concept || t.subcategory || '').trim();
        const conceptMatch = txFilterConcept === "all" || labelsMatch(conceptValue, txFilterConcept);
        const providerMatch = txFilterProvider === "all" || t.providerId === txFilterProvider;

        return dateMatch && categoryMatch && subcategoryMatch && conceptMatch && providerMatch;
      })
      .sort((a, b) => parseTransactionDate(b.date).getTime() - parseTransactionDate(a.date).getTime());
  }, [
    transactions,
    txFilterDateStart,
    txFilterDateEnd,
    txFilterCategory,
    txFilterSubcategory,
    txFilterConcept,
    txFilterProvider,
  ]);

  // Rol resuelto contra la tabla de roles (tolerante a mayúsculas; fallback a defaults si el id es de sistema)
  const userRole = useMemo((): Role | undefined => {
    const id = (currentUser.role || '').trim();
    if (!id) return undefined;
    const exact = roles.find((r) => r.id === id);
    if (exact) return exact;
    const low = id.toLowerCase();
    const ci = roles.find((r) => r.id.toLowerCase() === low);
    if (ci) return ci;
    return DEFAULT_ROLES.find((r) => r.id === id || r.id.toLowerCase() === low);
  }, [roles, currentUser.role]);

  const isSuperAdmin =
    currentUser.role === 'super_admin' ||
    currentUser.role === 'admin' ||
    !!(currentUser.email && getSuperAdminEmails().has(currentUser.email.trim().toLowerCase()));

  const canViewAuditLogs = isAdminAppUser(currentUser);

  const hasPermission = (moduleName: string): boolean => {
    if (isSuperAdmin) return true;
    return roleRecordHasModuleAccess(userRole, moduleName);
  };

  // Enlace / URL: no se puede abrir un módulo sin permiso (antes solo se ocultaba el botón)
  useEffect(() => {
    if (!isAuthenticated || !isDataLoaded) return;
    if (isSuperAdmin) return;
    const mod = VIEW_REQUIRED_MODULE[view];
    if (!mod) return;
    if (roleRecordHasModuleAccess(userRole, mod)) return;
    const targetPath = getFirstAllowedViewPath(userRole, isSuperAdmin);
    if (targetPath === viewToPath(view)) {
      return;
    }
    navigate(targetPath, { replace: true });
    toast.error('No tienes permiso para acceder a esta sección. Se redirigió a un módulo permitido.');
  }, [isAuthenticated, isDataLoaded, isSuperAdmin, view, userRole, navigate]);

  const FINANCE_NAV_MODULES = [
    "Finanzas",
    "Tesorería",
    "Transacciones",
    "Flujo de Caja",
    "Estado de Resultados",
    "Honorarios",
    "Cuentas por Pagar",
    "Caja Chica",
  ] as const;
  const canSeeFinanzasNavGroup = FINANCE_NAV_MODULES.some((m) => hasPermission(m));

  const canSeeGestionNavGroup =
    hasPermission("Proveedores") ||
    hasPermission("Contabilidad") ||
    hasPermission("Compras") ||
    hasPermission("Productos") ||
    hasPermission("Auditoría") ||
    hasPermission("Gestión Vehicular") ||
    hasPermission("Gestión de Inventario") ||
    hasPermission("Asistencia");

  // --- SEDE FILTERING HELPERS (memoizado: menos re-renders en vistas que filtran por sede) ---
  const catalogSedes = useMemo(() => getAllSedeNames(systemSettings), [systemSettings]);
  const enabledSedesForForms = useMemo(() => getEnabledSedeNames(systemSettings), [systemSettings]);
  const bankAccountsForForms = useMemo(
    () => getBankAccounts(systemSettings.accounting),
    [systemSettings.accounting]
  );
  const sedesEntriesForDialog = useMemo(
    () => getSedesCatalogEntries(systemSettings),
    [systemSettings]
  );
  const enabledCatalog = useMemo(
    () => (enabledSedesForForms.length > 0 ? enabledSedesForForms : catalogSedes),
    [enabledSedesForForms, catalogSedes]
  );
  const seesAllSedesInCatalog = useMemo(
    () => isSuperAdmin || currentUser.allSedes === true,
    [isSuperAdmin, currentUser.allSedes]
  );
  const visibleSedes = useMemo((): string[] => {
    if (seesAllSedesInCatalog) {
      return [...enabledCatalog];
    }
    return (currentUser.sedes || []).filter((s) => enabledCatalog.includes(s));
  }, [seesAllSedesInCatalog, enabledCatalog, currentUser.sedes]);

  const canSeeSede = useCallback(
    (sede: string): boolean => {
      const loc = (sede || "Principal").trim();
      if (seesAllSedesInCatalog) {
        return catalogSedes.length === 0 || catalogSedes.includes(loc);
      }
      return visibleSedes.includes(loc);
    },
    [seesAllSedesInCatalog, catalogSedes, visibleSedes]
  );
  /** Vista consolidada caja chica: requiere permiso del módulo + criterio de sede/rol. */
  const canAccessPettyCashConsolidated =
    hasPermission('Caja Chica') &&
    (currentUser.allSedes === true ||
      currentUser.role === 'super_admin' ||
      currentUser.role === 'admin' ||
      currentUser.role === 'auditoria' ||
      currentUser.role === 'manager' ||
      !!(currentUser.email && getSuperAdminEmails().has(currentUser.email.trim().toLowerCase())));

  const { categories: commercialCategories, areas: commercialAreas } = useMemo(
    () => mergePettyCashFilterCatalog(systemSettings, pettyCashTransactions),
    [systemSettings, pettyCashTransactions]
  );

  const handleClosePettyCashWeek = useCallback(
    (closure: PettyCashWeekClosure) => {
      setSystemSettings((prev) => {
        const next: SystemSettings = {
          ...prev,
          pettyCash: {
            ...initialSystemSettings.pettyCash,
            ...prev.pettyCash,
            weekClosures: [...(prev.pettyCash?.weekClosures ?? []), closure],
          },
        };
        return next;
      });
    },
    [isDataLoaded]
  );

  const handleConfirmPettyCashFundDelivery = useCallback(
    (delivery: PettyCashFundDelivery) => {
      setSystemSettings((prev) => {
        const existing = prev.pettyCash?.fundDeliveries ?? [];
        const dup = existing.some(
          (d) =>
            d.custodianId === delivery.custodianId &&
            weekKeyMatches(d.weekNumber, delivery.weekNumber)
        );
        if (dup) return prev;
        const next: SystemSettings = {
          ...prev,
          pettyCash: {
            ...initialSystemSettings.pettyCash,
            ...prev.pettyCash,
            fundDeliveries: [...existing, delivery],
          },
        };
        return next;
      });
    },
    [isDataLoaded]
  );

  const handleConsumeOpeningCarry = useCallback(
    (custodianId: string) => {
      setUsers((prev) => {
        const next = prev.map((u) =>
          u.id === custodianId
            ? { ...u, pettyCashOpeningCarryConsumedAt: new Date().toISOString() }
            : u
        );
        if (isDataLoaded) {
          void persistUsersToCloud(next);
        }
        return next;
      });
    },
    [isDataLoaded, persistUsersToCloud]
  );

  const handleRevokePettyCashFundDelivery = useCallback(
    (custodianId: string, weekNumber: string) => {
      const delivery = (systemSettings.pettyCash?.fundDeliveries ?? []).find(
        (d) => d.custodianId === custodianId && weekKeyMatches(d.weekNumber, weekNumber)
      );
      if (!delivery) {
        toast.error('No hay dotación registrada para revocar.');
        return;
      }
      const weekClosed = (systemSettings.pettyCash?.weekClosures ?? []).some(
        (c) => c.custodianId === custodianId && weekKeyMatches(c.weekNumber, weekNumber)
      );
      if (weekClosed) {
        toast.error('La semana está cerrada; no se puede revocar la dotación.');
        return;
      }

      const nextSettings = mergeSystemSettings({
        ...systemSettings,
        pettyCash: {
          ...systemSettings.pettyCash,
          fundDeliveries: (systemSettings.pettyCash?.fundDeliveries ?? []).filter(
            (d) => !(d.custodianId === custodianId && weekKeyMatches(d.weekNumber, weekNumber))
          ),
        },
      });
      setSystemSettings(nextSettings);

      if (delivery.isPeriodOpening) {
        setUsers((prev) => {
          const next = prev.map((u) =>
            u.id === custodianId ? { ...u, pettyCashOpeningCarryConsumedAt: undefined } : u
          );
          if (isDataLoaded) {
            void persistUsersToCloud(next);
          }
          return next;
        });
      }
    },
    [systemSettings, isDataLoaded, persistUsersToCloud]
  );

  const handleResetCustodianPettyCash = useCallback(
    async (custodianId: string): Promise<boolean> => {
      const nextTx = pettyCashTransactions.filter((t) => t.custodianId !== custodianId);
      setPettyCashTransactions(nextTx);
      pettyCashKvLatestRef.current = nextTx;

      const nextSettings = mergeSystemSettings({
        ...systemSettings,
        pettyCash: {
          ...systemSettings.pettyCash,
          weekClosures: (systemSettings.pettyCash?.weekClosures ?? []).filter(
            (c) => c.custodianId !== custodianId
          ),
          weekPreClosures: (systemSettings.pettyCash?.weekPreClosures ?? []).filter(
            (p) => p.custodianId !== custodianId
          ),
          fundDeliveries: (systemSettings.pettyCash?.fundDeliveries ?? []).filter(
            (d) => d.custodianId !== custodianId
          ),
        },
      });
      setSystemSettings(nextSettings);
      systemSettingsKvLatestRef.current = nextSettings;
      pettyCashMetaKvLatestRef.current = extractPettyCashMeta(nextSettings.pettyCash);

      const nextUsers = users.map((u) =>
        u.id === custodianId ? { ...u, pettyCashOpeningCarryConsumedAt: undefined } : u
      );
      setUsers(nextUsers);

      if (!isDataLoaded) return true;

      const meta = extractPettyCashMeta(nextSettings.pettyCash);
      const systemPayload = stripPettyCashMetaForSystemKv(nextSettings);

      skipPettyCashHydrateRef.current = true;
      try {
        const [txOk, settingsOk, metaOk, usersOk] = await Promise.all([
          enqueueKvSerializedSave(
            pettyCashKvChainRef,
            kvApplyGenerationRef,
            pettyCashKvLatestRef,
            'data:pettyCash',
            nextTx
          ),
          autosaveKvDomain({
            kvKey: 'settings:system',
            payload: systemPayload,
            refs: {
              chainRef: systemSettingsKvChainRef,
              latestRef: systemSettingsKvLatestRef,
              cooldownUntilRef: systemSettingsKvCooldownUntilRef,
            },
            kvApplyGenerationRef,
            lastSaveErrorAtRef,
            errorMessage: 'No se pudo guardar la configuración del sistema en la nube.',
            sync: cloudSyncTrackerRef.current,
          }),
          enqueueKvSerializedSave(
            pettyCashMetaKvChainRef,
            kvApplyGenerationRef,
            pettyCashMetaKvLatestRef,
            PETTY_CASH_META_KV_KEY,
            meta
          ),
          persistUsersToCloud(nextUsers),
        ]);
        if (!txOk || !settingsOk || !kvSaveSucceeded(metaOk) || !usersOk) {
          toast.error('No se pudo guardar el reinicio completo en la nube. Reintente.');
          return false;
        }
        pettyCashHydratedFromKvRef.current = true;
        return true;
      } finally {
        skipPettyCashHydrateRef.current = false;
      }
    },
    [
      pettyCashTransactions,
      systemSettings,
      users,
      isDataLoaded,
      persistUsersToCloud,
    ]
  );

  const handlePreClosePettyCashWeek = useCallback((pre: PettyCashWeekPreClosure) => {
    setSystemSettings((prev) => {
      const existing = prev.pettyCash?.weekPreClosures ?? [];
      const dup = existing.some(
        (p) => p.custodianId === pre.custodianId && weekKeyMatches(p.weekNumber, pre.weekNumber)
      );
      if (dup) return prev;
      const next: SystemSettings = {
        ...prev,
        pettyCash: {
          ...initialSystemSettings.pettyCash,
          ...prev.pettyCash,
          weekPreClosures: [...existing, pre],
        },
      };
      return next;
    });
  }, []);

  const applyProviderCategoryRename = (from: string, to: string) => {
    const t = to.trim();
    if (!t || from === t) return;
    setProviders((prev) => prev.map((p) => (p.category === from ? { ...p, category: t } : p)));
    setPettyCashTransactions((prev) =>
      prev.map((x) => (x.category === from ? { ...x, category: t } : x))
    );
  };
  const applyProviderAreaRename = (from: string, to: string) => {
    const t = to.trim();
    if (!t || from === t) return;
    setProviders((prev) => prev.map((p) => (p.area === from ? { ...p, area: t } : p)));
    setPettyCashTransactions((prev) =>
      prev.map((x) => (x.area === from ? { ...x, area: t } : x))
    );
  };
  const applyProviderCategoryRemoved = (removed: string, replacement: string) => {
    const rep = replacement.trim() || commercialCategories[0] || "Otros";
    setProviders((prev) =>
      prev.map((p) => (p.category === removed ? { ...p, category: rep } : p))
    );
    setPettyCashTransactions((prev) =>
      prev.map((x) => (x.category === removed ? { ...x, category: rep } : x))
    );
  };
  const applyProviderAreaRemoved = (removed: string, replacement: string) => {
    const rep = replacement.trim() || commercialAreas[0] || "";
    setProviders((prev) =>
      prev.map((p) => (p.area === removed ? { ...p, area: rep || undefined } : p))
    );
    setPettyCashTransactions((prev) =>
      prev.map((x) => (x.area === removed ? { ...x, area: rep || undefined } : x))
    );
  };
  const filteredPettyCashBySede = useMemo(
    () => pettyCashTransactions.filter((tx) => !tx.location || canSeeSede(tx.location)),
    [pettyCashTransactions, canSeeSede]
  );

  const handleUpdatePettyCashTransactions = useCallback(
    async (nextVisibleTransactions: PettyCashTransaction[]): Promise<boolean> => {
      const prevVisibleIds = new Set(
        pettyCashTransactions
          .filter((tx) => !tx.location || canSeeSede(tx.location))
          .map((tx) => tx.id)
      );
      const newMovements = nextVisibleTransactions.filter((tx) => !prevVisibleIds.has(tx.id));

      if (!isDataLoaded) {
        toast.error(
          'Los datos siguen cargando desde la nube. Espera el aviso «Datos sincronizados con la nube» e intenta de nuevo.'
        );
        return false;
      }
      if (!pettyCashHydratedFromKvRef.current) {
        toast.error(
          'Caja chica aún no terminó de sincronizar. Espera unos segundos antes de registrar gastos.'
        );
        return false;
      }

      let merged: PettyCashTransaction[] = [];
      setPettyCashTransactions((prev) => {
        const hiddenTransactions = prev.filter(
          (tx) => tx.location && !canSeeSede(tx.location)
        );
        merged = [...nextVisibleTransactions, ...hiddenTransactions];
        pettyCashKvLatestRef.current = merged;
        return merged;
      });

      skipPettyCashHydrateRef.current = true;
      try {
        const result = await enqueueKvSerializedSave(
          pettyCashKvChainRef,
          kvApplyGenerationRef,
          pettyCashKvLatestRef,
          'data:pettyCash',
          merged
        );
        if (!kvSaveSucceeded(result)) {
          toast.error(
            'No se pudo guardar Caja chica en la nube. Revisa sesión/red antes de cerrar o actualizar la página.'
          );
          return false;
        }
        pettyCashKvCooldownUntilRef.current = Date.now() + PETTY_CASH_KV_COOLDOWN_MS;
        pettyCashHydratedFromKvRef.current = true;
        if (PRODUCTION_USE_SQL) {
          void backupDomainSqlAfterKvSave(
            true,
            'data:pettyCash',
            merged,
            savePettyCashToSql,
            lastSaveErrorAtRef
          );
        }
        if (newMovements.length > 0) {
          void writeAuditLog(getSupabaseClient(), 'petty_cash_create', {
            entity: 'Caja chica',
            details: `Registró ${newMovements.length} movimiento(s)`,
            count: newMovements.length,
          });
        }
        return true;
      } catch (e) {
        console.warn('[GrooFlow] pettyCash persist:', e);
        toast.error('Error al guardar caja chica en la nube.');
        return false;
      } finally {
        skipPettyCashHydrateRef.current = false;
      }
    },
    [canSeeSede, isDataLoaded, pettyCashTransactions]
  );

  const filteredRequestsBySede = useMemo(
    () => requests.filter((r) => !r.location || canSeeSede(r.location)),
    [requests, canSeeSede]
  );

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-500 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Verificando sesión...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-background text-foreground transition-colors duration-500">
        <LoginPage onLogin={handleLogin} currentTheme={theme} onToggleTheme={toggleTheme} />
      </div>
    );
  }

  const NavButton = ({ targetView, icon: Icon, label, iconColorClass, requiredModule }: { targetView: ViewType, icon: typeof LayoutDashboard, label: string, iconColorClass?: string, requiredModule?: string }) => {
    // Hide if user doesn't have permission for this module
    if (requiredModule && !hasPermission(requiredModule)) return null;
    
    const isActive = view === targetView;
    return (
    <div className="relative group/tooltip px-2">
      <button
        onClick={() => {
          navigate(viewToPath(targetView));
          setMobileMenuOpen(false);
        }}
        className={`relative flex items-center w-full py-2.5 transition-all duration-300 rounded-xl group/btn overflow-hidden
        ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'}
        ${isActive 
            ? 'text-white border border-cyan-500/30' 
            : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
        }`}
        style={isActive ? {
          background: 'linear-gradient(90deg, rgba(34,211,238,0.12) 0%, rgba(139,92,246,0.06) 100%)',
          boxShadow: '0 0 20px rgba(34,211,238,0.08)'
        } : {}}
      >
        {/* Active left glow bar */}
        {isActive && !isSidebarCollapsed && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #22d3ee, #a855f7)', boxShadow: '0 0 8px rgba(34,211,238,0.8)' }} />
        )}

        <Icon className={`w-[19px] h-[19px] transition-all duration-300 shrink-0
            ${isActive ? 'text-cyan-300' : (iconColorClass || 'text-slate-500 group-hover/btn:text-slate-200')} 
            ${!isSidebarCollapsed ? 'mr-3' : ''}`}
          style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.7))' } : {}}
        />
        
        {!isSidebarCollapsed && (
            <>
                <span className={`text-[13px] flex-1 text-left tracking-wide truncate font-medium ${isActive ? 'text-cyan-50' : ''}`}>{label}</span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1 shrink-0" style={{ boxShadow: '0 0 8px rgba(34,211,238,0.9)' }} />}
            </>
        )}
      </button>
      
      {/* Tooltip for collapsed mode */}
      {isSidebarCollapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-[#22203A] text-white text-xs font-semibold rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 whitespace-nowrap z-[60] shadow-xl border border-[#3D3B5C] translate-x-2 group-hover/tooltip:translate-x-0 pointer-events-none">
          {label}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 border-4 border-transparent border-r-[#22203A]" />
        </div>
      )}
    </div>
    );
  };

  const isDarkTheme = theme === 'dark';
  const surfaces = getModuleSurfaces(isDarkTheme);
  const moduleIdentity = getModuleIdentity(view);

  return (
    <div
      className="min-h-screen bg-background text-foreground font-sans transition-colors duration-500 relative overflow-x-hidden"
      style={
        {
          '--grooflow-sidebar-w': isSidebarCollapsed ? '76px' : '256px',
        } as CSSProperties
      }
    >
      <AppProvider value={{ currentUser, roles, theme, toggleTheme }}>
      {isDarkTheme && (
        <>
          <div className="orb-cyan bg-orb" />
          <div className="orb-violet bg-orb" />
          <div className="orb-pink bg-orb" />
          <div className="bg-circuit fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.5 }} />
        </>
      )}
      <AmbientBackground moduleId={view} isDark={isDarkTheme} />

      {/* Sidebar */}
      <div 
        className={`sidebar-hybrid ${isSidebarCollapsed ? 'w-[76px]' : 'w-[256px]'} fixed inset-y-0 left-0 z-50 flex flex-col`}
        style={{
          transition: 'width 500ms cubic-bezier(0.2, 0, 0, 1)',
          background: 'linear-gradient(180deg, #0B0F19 0%, #070a12 50%, #0B0F19 100%)',
          borderRight: '1px solid rgba(139,92,246,0.12)',
          boxShadow: theme === 'light' ? '4px 0 32px rgba(15,23,42,0.18)' : '4px 0 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Cyber border glow line */}
        <div className="absolute inset-y-0 right-0 w-px pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(34,211,238,0.3) 30%, rgba(139,92,246,0.3) 70%, transparent 100%)' }} />

        {/* Brand Header */}
        <div className={`h-[80px] flex items-center transition-all duration-500 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className={`relative flex items-center justify-center rounded-xl transition-all duration-300 shrink-0
             ${isSidebarCollapsed ? 'w-10 h-10' : 'w-14 h-14'}`}
             style={{ 
               background: 'transparent',
               overflow: 'hidden'
             }}>
             <img src={systemSettings.businessLogo || logoUrl} alt="GrooFlow" className="w-full h-full object-contain" />
          </div>
          
          <div className={`ml-3 overflow-hidden transition-all duration-500 ${isSidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'}`}>
            <span className="text-2xl font-bold tracking-tight block gradient-text-cyber truncate max-w-[180px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{systemSettings.businessName || 'GrooFlow'}</span>
            {isAuthenticated && isDataLoaded && (
              <div className="mt-1.5">
                <CloudSyncIndicator
                  phase={cloudSyncPhase}
                  visible
                  onRetry={handleCloudSyncRetry}
                  compact
                  errorKey={cloudSyncPhase === 'error' ? cloudSyncErrorKeyRef.current : null}
                  errorKeyLabel={kvKeyDisplayLabel}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto py-2.5 space-y-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/5 [&::-webkit-scrollbar-track]:bg-transparent">
          {!isSidebarCollapsed && (
            <div className="px-3 pb-1 pt-0.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.2)' }}>Principal</span>
            </div>
          )}
           <NavButton targetView="dashboard" icon={LayoutDashboard} label="Dashboard" iconColorClass="text-sky-400 group-hover/btn:text-sky-300" requiredModule="Dashboard" />
           <NavButton targetView="alerts" icon={ShieldAlert} label="Alertas" iconColorClass="text-rose-400 group-hover/btn:text-rose-300" requiredModule="Alertas" />
           <NavButton targetView="analytics" icon={Brain} label="Analítica" iconColorClass="text-violet-400 group-hover/btn:text-violet-300" requiredModule="Analítica" />
           
           {canSeeFinanzasNavGroup && !isSidebarCollapsed && (
            <div className="px-3 pb-1 pt-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.2)' }}>Finanzas</span>
            </div>
          )}
           <NavButton targetView="treasury" icon={Landmark} label="Tesorería" iconColorClass="text-amber-400 group-hover/btn:text-amber-300" requiredModule="Tesorería" />
           <NavButton targetView="transactions" icon={Wallet} label="Transacciones" iconColorClass="text-emerald-400 group-hover/btn:text-emerald-300" requiredModule="Transacciones" />
           <NavButton targetView="cashflow" icon={CalendarDays} label="Flujo de Caja" iconColorClass="text-cyan-400 group-hover/btn:text-cyan-300" requiredModule="Flujo de Caja" />
           <NavButton targetView="pnl" icon={TrendingUp} label="Estado de Resultados" iconColorClass="text-pink-400 group-hover/btn:text-pink-300" requiredModule="Estado de Resultados" />
           <NavButton targetView="reports" icon={FileText} label="Reportes" iconColorClass="text-amber-400 group-hover/btn:text-amber-300" requiredModule="Reportes" />
           <NavButton targetView="pettycash" icon={Coins} label="Caja Chica" iconColorClass="text-teal-400 group-hover/btn:text-teal-300" requiredModule="Caja Chica" />
           <NavButton targetView="fees" icon={Stethoscope} label="Honorarios" iconColorClass="text-violet-400 group-hover/btn:text-violet-300" requiredModule="Honorarios" />
           
           {canSeeGestionNavGroup && !isSidebarCollapsed && (
            <div className="px-3 pb-1 pt-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.2)' }}>Gestión</span>
            </div>
          )}
           <NavButton targetView="providers" icon={Users} label="Proveedores" iconColorClass="text-indigo-400 group-hover/btn:text-indigo-300" requiredModule="Proveedores" />
           <NavButton targetView="accounting" icon={BookOpen} label="Contabilidad" iconColorClass="text-sky-400 group-hover/btn:text-sky-300" requiredModule="Contabilidad" />
           <NavButton targetView="fleet" icon={Truck} label="Flota Clínica" iconColorClass="text-cyan-400 group-hover/btn:text-cyan-300" requiredModule="Gestión Vehicular" />
           <NavButton targetView="inventory" icon={Package} label="Inventario Equipos" iconColorClass="text-sky-400 group-hover/btn:text-sky-300" requiredModule="Gestión de Inventario" />
           <NavButton targetView="asistencia" icon={UserCheck} label="Asistencia" iconColorClass="text-indigo-400 group-hover/btn:text-indigo-300" requiredModule="Asistencia" />
           <NavButton targetView="products" icon={Package} label="Productos" iconColorClass="text-fuchsia-400 group-hover/btn:text-fuchsia-300" requiredModule="Productos" />
           <NavButton targetView="requests" icon={ShoppingCart} label="Solicitudes" iconColorClass="text-purple-400 group-hover/btn:text-purple-300" requiredModule="Compras" />
           <NavButton targetView="audit" icon={ShieldAlert} label="Auditoría" iconColorClass="text-orange-400 group-hover/btn:text-orange-300" requiredModule="Auditoría" />
           
           {(hasPermission('Usuarios') || hasPermission('Configuración')) && (
           <div className="mt-2 pt-2 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
             <NavButton targetView="users" icon={Users} label="Usuarios y Roles" iconColorClass="text-lime-400 group-hover/btn:text-lime-300" requiredModule="Usuarios" />
             <NavButton targetView="config" icon={Settings} label="Configuración" iconColorClass="text-slate-400 group-hover/btn:text-slate-300" requiredModule="Configuración" />
           </div>
           )}
        </nav>
        
        {/* Footer */}
        <div className="mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(6,4,18,0.7)' }}>
             <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'p-2 flex justify-center' : 'p-2.5'}`}>
                <UserMenu 
                    onLogout={handleLogout} 
                    onProfileClick={() => setIsProfileOpen(true)} 
                    showDetails={!isSidebarCollapsed}
                    side="right"
                    align="end"
                />
             </div>
             
             {/* Collapse Toggle */}
             <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="w-full h-7 flex items-center justify-center hover:bg-white/5 transition-all group"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}
             >
                {isSidebarCollapsed ? 
                    <ChevronRight className="w-3.5 h-3.5 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" /> : 
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:text-cyan-400 group-hover:-translate-x-0.5 transition-all" />
                }
             </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden h-14 flex items-center px-4 justify-between sticky top-0 z-40 shadow-lg"
        style={
          theme === 'light'
            ? { background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #CBD5E1', boxShadow: '0 4px 20px -6px rgba(15,23,42,0.08)' }
            : { background: 'rgba(13,11,30,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(139,92,246,0.15)' }
        }
      >
        <div className="flex items-center">
             <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="mr-3 p-2 rounded-xl hover:bg-white/8 active:scale-95 transition-all">
                 <Menu className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.6)' }} />
             </button>
            {systemSettings.businessLogo ? (
              <div className="w-7 h-7 mr-2 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(34,211,238,0.25)' }}>
                <img src={systemSettings.businessLogo} alt="Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <Stethoscope className="h-5 w-5 mr-2" style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.6))' }} />
            )}
            <span className="text-base font-bold tracking-tight gradient-text-cyber truncate max-w-[150px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{systemSettings.businessName || 'GrooFlow'}</span>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && isDataLoaded && (
            <CloudSyncIndicator
              phase={cloudSyncPhase}
              visible
              onRetry={handleCloudSyncRetry}
              compact
              errorKey={cloudSyncPhase === 'error' ? cloudSyncErrorKeyRef.current : null}
              errorKeyLabel={kvKeyDisplayLabel}
            />
          )}
        <UserMenu 
            onLogout={handleLogout} 
            onProfileClick={() => setIsProfileOpen(true)} 
        />
        </div>
      </div>

       {/* Mobile Menu Dropdown */}
       {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setMobileMenuOpen(false)}>
            <div className="fixed inset-y-0 left-0 w-64 shadow-2xl p-4 pt-20 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #0D0B1E 0%, #090718 100%)', borderRight: '1px solid rgba(139,92,246,0.15)' }} onClick={e => e.stopPropagation()}>
                <nav className="space-y-0.5">
                    <NavButton targetView="dashboard" icon={LayoutDashboard} label="Dashboard" iconColorClass="text-sky-400" requiredModule="Dashboard" />
                    <NavButton targetView="alerts" icon={ShieldAlert} label="Alertas" iconColorClass="text-rose-400" requiredModule="Alertas" />
                    <NavButton targetView="analytics" icon={Brain} label="Analítica AI" iconColorClass="text-violet-400" requiredModule="Analítica" />
                    <NavButton targetView="treasury" icon={Landmark} label="Tesorería" iconColorClass="text-amber-400" requiredModule="Tesorería" />
                    <NavButton targetView="transactions" icon={Wallet} label="Transacciones" iconColorClass="text-emerald-400" requiredModule="Transacciones" />
                    <NavButton targetView="cashflow" icon={CalendarDays} label="Flujo de Caja" iconColorClass="text-cyan-400" requiredModule="Flujo de Caja" />
                    <NavButton targetView="pnl" icon={TrendingUp} label="Estado de Resultados" iconColorClass="text-pink-400" requiredModule="Estado de Resultados" />
                    <NavButton targetView="reports" icon={FileText} label="Reportes" iconColorClass="text-amber-400" requiredModule="Reportes" />
                    <NavButton targetView="audit" icon={ShieldAlert} label="Auditoría" iconColorClass="text-orange-400" requiredModule="Auditoría" />
                    <NavButton targetView="pettycash" icon={Coins} label="Caja Chica" iconColorClass="text-teal-400" requiredModule="Caja Chica" />
                    <NavButton targetView="fees" icon={Stethoscope} label="Honorarios" iconColorClass="text-violet-400" requiredModule="Honorarios" />
                    <NavButton targetView="providers" icon={Users} label="Proveedores" iconColorClass="text-indigo-400" requiredModule="Proveedores" />
                    <NavButton targetView="accounting" icon={BookOpen} label="Contabilidad" iconColorClass="text-sky-400" requiredModule="Contabilidad" />
                    <NavButton targetView="fleet" icon={Truck} label="Flota Clínica" iconColorClass="text-cyan-400" requiredModule="Gestión Vehicular" />
                    <NavButton targetView="inventory" icon={Package} label="Inventario Equipos" iconColorClass="text-sky-400" requiredModule="Gestión de Inventario" />
                    <NavButton targetView="asistencia" icon={UserCheck} label="Asistencia" iconColorClass="text-indigo-400" requiredModule="Asistencia" />
                    <NavButton targetView="products" icon={Package} label="Productos" iconColorClass="text-fuchsia-400" requiredModule="Productos" />
                    <NavButton targetView="requests" icon={ShoppingCart} label="Solicitudes" requiredModule="Compras" />
                    <div className="pt-4 border-t border-border mt-4 space-y-2">
                        <NavButton targetView="users" icon={Users} label="Usuarios y Roles" requiredModule="Usuarios" />
                        <NavButton targetView="config" icon={Settings} label="Configuración" requiredModule="Configuración" />
                    </div>
                </nav>
            </div>
        </div>
       )}

      {/* Main Content */}
      <main className={`min-h-screen relative z-10 pt-6 md:pt-0 ${isSidebarCollapsed ? 'md:pl-[76px]' : 'md:pl-[256px]'}`}
        style={{ transition: 'padding-left 500ms cubic-bezier(0.2, 0, 0, 1)' }}
      >
        <div className={`w-full ${view !== 'treasury' ? 'px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8' : ''}`}>
        <Suspense fallback={<RouteLoader />}>
          {/* Header Section for Views using Generic Wrapper */}
          {['dashboard', 'analytics', 'transactions', 'cashflow', 'pettycash', 'products'].includes(view) && (
            <ModuleHeader
              icon={moduleIdentity.icon}
              title={moduleIdentity.title}
              subtitle={moduleIdentity.subtitle}
              accent={moduleIdentity.accent}
              accentGlow={moduleIdentity.accentGlow}
              isDark={isDarkTheme}
              trailing={
                currentUser.role === 'admin' ? (
                  <div
                    className={
                      isDarkTheme
                        ? 'hidden lg:flex items-center gap-2 p-1.5 rounded-xl'
                        : 'hidden lg:flex items-center gap-2 p-1.5 rounded-xl gf-glass-card'
                    }
                    style={
                      isDarkTheme
                        ? { background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }
                        : undefined
                    }
                  >
                    <div className="px-2">
                      <div
                        className="text-[9px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: isDarkTheme ? 'rgba(192,132,252,0.6)' : '#6366f1' }}
                      >
                        Simulador
                      </div>
                    </div>
                    <Select
                      value={currentUser.id}
                      onValueChange={(val) => {
                        const selectedUser = users.find((u) => u.id === val);
                        if (selectedUser) setCurrentUser(selectedUser);
                      }}
                    >
                      <SelectTrigger
                        className="w-[160px] h-8 text-xs border-0 shadow-none focus:ring-0"
                        style={
                          isDarkTheme
                            ? { background: 'rgba(255,255,255,0.04)', color: '#c084fc' }
                            : { color: '#4f46e5' }
                        }
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <span className="font-bold mr-1">{user.initials}</span> {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : undefined
              }
            >
              {view === 'cashflow' && (
                <div
                  className={`flex items-center rounded-xl h-9 self-start sm:self-center ml-0 sm:ml-4 overflow-hidden ${!isDarkTheme ? 'gf-glass-card' : ''}`}
                  style={{ background: surfaces.monthPicker.background, border: surfaces.monthPicker.border }}
                >
                  <button
                    onClick={handlePrevMonth}
                    className="p-2 h-full flex items-center transition-colors"
                    style={{ color: surfaces.monthPicker.icon }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = surfaces.monthPicker.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span
                    className="px-3 text-sm font-medium min-w-[140px] text-center capitalize"
                    style={{ color: surfaces.monthPicker.text }}
                  >
                    {format(safeCurrentDate, 'MMMM yyyy', { locale: es })}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 h-full flex items-center transition-colors"
                    style={{ color: surfaces.monthPicker.icon }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = surfaces.monthPicker.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </ModuleHeader>
          )}

          {view === 'treasury' && (
             <TreasuryModule 
               pendingFeeReceipts={feeReceipts.filter(r => r.status === 'requested_payment')}
               onMarkReceiptPaid={(receiptId, paymentDate) => {
                 setFeeReceipts((prev) => {
                   const next = prev.map((r) =>
                     r.id === receiptId ? { ...r, status: 'paid' as const, paymentDate } : r
                   );
                   feeReceiptsKvLatestRef.current = next;
                   return next;
                 });
               }}
               treasuryInvoices={treasuryInvoices.length > 0 ? treasuryInvoices : undefined}
               onUpdateTreasuryInvoices={handleTreasuryInvoicesUpdate}
               bankBalance={treasuryBankBalance}
               onUpdateBankBalance={handleTreasuryBankBalanceUpdate}
               paidHistory={treasuryPaidHistory.length > 0 ? treasuryPaidHistory : undefined}
               onUpdatePaidHistory={handleTreasuryPaidHistoryUpdate}
             />
          )}

          {view === 'fees' && (
             <ProfessionalFeesModule 
                providers={providers}
                onUpdateProviders={handleUpdateProviders}
                receipts={feeReceipts.length > 0 ? (feeReceipts as any[]) : undefined}
                onUpdateReceipts={(receipts) => handleFeeReceiptsUpdate(receipts as FeeReceiptGlobal[])}
                onSendToTreasury={(receipts) => {
                  setFeeReceipts((prev) => {
                    const existingIds = new Set(prev.map((r) => r.id));
                    const newReceipts = (receipts as any[])
                      .filter((r: any) => !existingIds.has(r.id))
                      .map((r: any) => ({
                        id: r.id,
                        professionalId: r.professionalId || '',
                        professionalName: r.professionalName,
                        receiptNumber: r.receiptNumber,
                        issueDate: r.issueDate || new Date(),
                        amount: r.amount,
                        description: r.description,
                        location: r.location,
                        dueDate: r.dueDate,
                        paymentRequestedAt: r.paymentRequestedAt,
                        status: 'requested_payment' as const,
                        fileUrl: r.fileUrl,
                      }));
                    const updated = prev.map(r => {
                      const match = (receipts as any[]).find((nr: any) => nr.id === r.id);
                      if (match) return { ...r, status: 'requested_payment' as const, paymentRequestedAt: match.paymentRequestedAt };
                      return r;
                    });
                    const next = [...updated, ...newReceipts];
                    feeReceiptsKvLatestRef.current = next;
                    return next;
                  });
                  toast.success("Recibos enviados a Tesorería - Mesa de Pagos", { description: "Ve a Tesorería para aprobar los pagos." });
                }}
             />
          )}

          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Suspense fallback={<RouteLoader />}>
                <Overview 
                    transactions={transactions} 
                    alerts={alerts}
                    onOpenAlerts={() => navigate(viewToPath('alerts'))}
                    fleetDataset={fleetDataset}
                    onOpenFleet={() => navigate(viewToPath('fleet'))}
                />
              </Suspense>

              <Suspense fallback={<RouteLoader />}>
                <CashFlowChart transactions={transactions} currentDate={safeCurrentDate} />
              </Suspense>
            </div>
          )}

          {view === 'alerts' && (
             <div className="h-[calc(100vh-10rem)] min-h-[500px]">
                 <AlertsCenter 
                     alerts={alerts}
                     onMarkAsRead={handleMarkAlertAsRead}
                     onMarkAllAsRead={handleMarkAllAlertsAsRead}
                     onNavigate={(targetView) => navigate(viewToPath(targetView as ViewType))}
                     thresholds={alertThresholds}
                     onUpdateThresholds={setAlertThresholds}
                 />
             </div>
          )}

          {view === 'analytics' && (
            <AnalyticsDashboard
              transactions={transactions}
              visibleSedes={visibleSedes}
              seesAllSedesCatalog={seesAllSedesInCatalog}
            />
          )}

            {view === 'transactions' && (
            <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="lg:col-span-4 xl:col-span-3 space-y-5">
                <div className={`rounded-2xl p-5 ${!isDarkTheme ? 'gf-glass-card' : ''}`} style={{ background: surfaces.chartCard.background, border: surfaces.chartCard.border, boxShadow: surfaces.chartCard.boxShadow }}>
                  <h3 className="mb-5 flex items-center gap-2" style={{ color: surfaces.pageTitle, fontWeight: 700 }}>
                    <PlusCircle className="h-5 w-5" style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.5))' }} />
                    Nueva Transacción
                  </h3>
                  <TransactionForm
                    onSubmit={handleAddTransaction}
                    config={config}
                    providers={providers}
                    bankAccounts={bankAccountsForForms}
                    sedesCatalog={enabledSedesForForms}
                  />
                </div>
              </div>
              
              <div className="lg:col-span-8 xl:col-span-9">
                <div className={`rounded-2xl p-5 ${!isDarkTheme ? 'gf-glass-card' : ''}`} style={{ background: surfaces.chartCard.background, border: surfaces.chartCard.border, boxShadow: surfaces.chartCard.boxShadow }}>
                  <div className="flex flex-col space-y-4 mb-5">
                    <div className="flex items-center justify-between pb-4" style={{ borderBottom: `1px solid ${surfaces.divider}` }}>
                      <h3 style={{ color: surfaces.pageTitle, fontWeight: 700 }}>Historial de Transacciones</h3>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-cyan-500/30 bg-transparent text-cyan-200 hover:bg-cyan-500/10"
                          onClick={() => setIsTransactionImporterOpen(true)}
                        >
                          Importar Excel
                        </Button>
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b7cf8' }}>{filteredTransactions.length} registros</span>
                      </div>
                    </div>
                    
                    {/* Filters Toolbar */}
                    <div className="flex flex-wrap gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2 min-w-[180px]">
                             <Select value={txDatePreset} onValueChange={(value) => applyTransactionDatePreset(value as TransactionDatePreset)}>
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Fecha" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las fechas</SelectItem>
                                    <SelectItem value="last7">Últimos 7 días</SelectItem>
                                    <SelectItem value="currentMonth">Mes en curso</SelectItem>
                                    <SelectItem value="previousMonth">Mes anterior</SelectItem>
                                    <SelectItem value="year">Año en curso</SelectItem>
                                    <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                             </Select>
                        </div>
                        {txDatePreset === 'custom' && (
                          <>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: '#6b5fa5' }}>Desde:</span>
                                <Input 
                                    type="date" 
                                    className="h-8 w-auto" 
                                    value={txFilterDateStart} 
                                    onChange={(e) => {
                                      setTxDatePreset("custom");
                                      setTxFilterDateStart(e.target.value);
                                    }} 
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: '#6b5fa5' }}>Hasta:</span>
                                <Input 
                                    type="date" 
                                    className="h-8 w-auto" 
                                    value={txFilterDateEnd} 
                                    onChange={(e) => {
                                      setTxDatePreset("custom");
                                      setTxFilterDateEnd(e.target.value);
                                    }} 
                                />
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-2 min-w-[150px]">
                             <Select
                               value={txFilterCategory}
                               onValueChange={(value) => {
                                 setTxFilterCategory(value);
                                 setTxFilterSubcategory("all");
                                 setTxFilterConcept("all");
                               }}
                             >
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las categorías</SelectItem>
                                    {Object.keys(config).map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                        </div>
                        <div className="flex items-center gap-2 min-w-[150px]">
                             <Select value={txFilterSubcategory} onValueChange={setTxFilterSubcategory}>
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Subcategoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las subcategorías</SelectItem>
                                    {transactionSubcategoryOptions.map(subcategory => (
                                        <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                        </div>
                        <div className="flex items-center gap-2 min-w-[150px]">
                             <Select value={txFilterConcept} onValueChange={setTxFilterConcept}>
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Concepto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los conceptos</SelectItem>
                                    {transactionConceptOptions.map(concept => (
                                        <SelectItem key={concept} value={concept}>{concept}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                        </div>
                        <div className="flex items-center gap-2 min-w-[150px]">
                             <Select value={txFilterProvider} onValueChange={setTxFilterProvider}>
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Proveedor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los proveedores</SelectItem>
                                    {providers.map(prov => (
                                        <SelectItem key={prov.id} value={prov.id}>{prov.name}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                        </div>
                        {(txDatePreset !== 'all' || txFilterDateStart || txFilterDateEnd || txFilterCategory !== 'all' || txFilterSubcategory !== 'all' || txFilterConcept !== 'all' || txFilterProvider !== 'all') && (
                            <button 
                                onClick={() => {
                                    setTxDatePreset("all");
                                    setTxFilterDateStart("");
                                    setTxFilterDateEnd("");
                                    setTxFilterCategory("all");
                                    setTxFilterSubcategory("all");
                                    setTxFilterConcept("all");
                                    setTxFilterProvider("all");
                                }}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg transition-colors hover:bg-cyan-500/15"
                                style={{ color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                  </div>
                  <RecentTransactions
                    transactions={filteredTransactions}
                    bankAccounts={bankAccountsForForms}
                    onEdit={openEditDialog}
                    onDelete={handleDeleteTransaction}
                    onBulkDelete={handleBulkDeleteTransactions}
                  />
                </div>
              </div>
            </div>
          )}

          {view === 'cashflow' && (
             <div className="flex min-h-[calc(100vh-120px)] flex-1 flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
               <Tabs defaultValue="matrix" className="flex min-h-0 flex-1 flex-col gap-4">
                 <TabsList className="w-full max-w-md shrink-0 bg-slate-900/70 border border-cyan-500/20">
                   <TabsTrigger value="matrix" className="data-[state=active]:bg-cyan-600/40 data-[state=active]:text-cyan-50">
                     Matriz diaria / anual
                   </TabsTrigger>
                   <TabsTrigger value="smart" className="data-[state=active]:bg-cyan-600/40 data-[state=active]:text-cyan-50">
                     Proyección inteligente
                   </TabsTrigger>
                 </TabsList>
                 <TabsContent value="matrix" className="mt-0 flex min-h-[min(560px,calc(100vh-220px))] flex-1 flex-col overflow-hidden focus-visible:outline-none">
                   <CashFlowGrid 
                     transactions={transactions} 
                     config={config} 
                     onAddProjectedTransactions={handleProjectTransactions}
                     currentDate={safeCurrentDate}
                     onViewDateChange={setCurrentDate}
                     systemSettings={systemSettings}
                     onUpdateSettings={handlePersistSystemSettings}
                     invoices={invoices}
                     treasuryInvoices={mergedTreasuryForCashflow}
                     onUpsertProjectedCell={handleUpsertCashFlowCell}
                   />
                 </TabsContent>
                 <TabsContent value="smart" className="mt-0 flex min-h-[min(480px,calc(100vh-240px))] flex-1 flex-col overflow-auto focus-visible:outline-none">
                   <SmartCashFlowSimulation 
                     config={config}
                     systemSettings={systemSettings}
                     transactions={transactions}
                     invoices={invoices}
                     currentDate={safeCurrentDate}
                     onUpdateSystemSettings={handlePersistSystemSettings}
                   />
                 </TabsContent>
               </Tabs>
             </div>
          )}

          {view === 'pnl' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <PnLView 
                 transactions={transactions} 
                 currentDate={safeCurrentDate} 
                 onPrevMonth={handlePrevMonth}
                 onNextMonth={handleNextMonth}
               />
             </div>
          )}

          {view === 'reports' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between gap-4 mb-4">
                 <h2 className="text-xl font-semibold">Resumen mensual</h2>
                 <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                     <ChevronLeft className="h-4 w-4" />
                   </Button>
                   <span className="text-sm font-medium min-w-[140px] text-center">
                     {format(safeCurrentDate, 'MMMM yyyy', { locale: es })}
                   </span>
                   <Button variant="outline" size="sm" onClick={handleNextMonth}>
                     <ChevronRight className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
               <MonthlySummary transactions={transactions} currentDate={safeCurrentDate} />
             </div>
          )}

          {view === 'providers' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ProviderManager 
                    providers={providers} 
                    onUpdateProviders={handleUpdateProviders} 
                    config={config}
                    systemSettings={systemSettings}
                    onUpdateSystemSettings={setSystemSettings}
                    userRole={currentUser.role}
                    openSimplePettyOnMount={openQuickProviderModal}
                    onSimplePettyOpenHandled={() => setOpenQuickProviderModal(false)}
                    chartOfAccounts={chartOfAccounts}
                    pettyCashCommercialCategories={commercialCategories}
                />
             </div>
          )}

          {view === 'accounting' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ChartOfAccountsModule
                chartOfAccounts={chartOfAccounts}
                onUpdateChart={handleChartOfAccountsUpdate}
                systemSettings={systemSettings}
                onUpdateSystemSettings={handlePersistSystemSettings}
              />
            </div>
          )}

          {view === 'fleet' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <FleetModule
                dataset={fleetDataset}
                setDataset={handleFleetDatasetUpdate}
                onPersistDataset={persistFleetNow}
                onPersistChecklist={persistFleetChecklistNow}
                persistenceReady={isDataLoaded}
                visibleSedes={visibleSedes.length > 0 ? visibleSedes : enabledCatalog}
                defaultHomeBase={
                  currentUser.sedes?.[0] ||
                  currentUser.location ||
                  visibleSedes[0] ||
                  enabledCatalog[0] ||
                  'Principal'
                }
              />
            </div>
          )}

          {view === 'inventory' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Suspense fallback={<RouteLoader />}>
                <InventoryModule
                  dataset={inventoryDataset}
                  setDataset={handleInventoryDatasetUpdate}
                  onPersistDataset={persistInventoryNow}
                  visibleSedes={visibleSedes.length > 0 ? visibleSedes : enabledCatalog}
                  defaultSede={
                    currentUser.sedes?.[0] ||
                    currentUser.location ||
                    visibleSedes[0] ||
                    enabledCatalog[0] ||
                    'Principal'
                  }
                  providers={providers}
                />
              </Suspense>
            </div>
          )}

          {view === 'asistencia' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Suspense fallback={<RouteLoader />}>
                <AsistenciaModule
                  systemSettings={systemSettings}
                  onUpdateSystemSettings={handlePersistSystemSettings}
                  onPersistAsistenciaSettings={persistAsistenciaNow}
                  onPersistSystemSettings={persistSystemSettingsNow}
                  visibleSedes={visibleSedes.length > 0 ? visibleSedes : enabledCatalog}
                  canConfigure={isAdminAppUser(currentUser)}
                />
              </Suspense>
            </div>
          )}

          {view === 'products' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ProductModule 
                    products={products}
                    providers={providers}
                    onUpdateProducts={handleProductsUpdate}
                    visibleSedes={visibleSedes}
                    currentUserName={currentUser.name}
                />
             </div>
          )}

          {view === 'requests' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PurchaseRequestManager 
                    requests={filteredRequestsBySede} 
                    providers={providers}
                    onRequestCreate={(req) => {
                        const signedRequest = {
                            ...req,
                            requesterName: currentUser.name,
                            requesterInitials: currentUser.initials,
                            location: req.location || (visibleSedes[0] || 'Principal')
                        };
                        handleRequestsUpdate([signedRequest, ...requests]);
                    }}
                    onRequestStatusChange={handleRequestStatusChange}
                    currentUser={currentUser}
                    visibleSedes={visibleSedes}
                />
             </div>
          )}

          {view === 'users' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <UserManager 
                    users={users} 
                    roles={roles}
                    sedesCatalog={enabledSedesForForms}
                    knownSedeNames={catalogSedes}
                    sedesCatalogEntries={sedesEntriesForDialog}
                    onSaveSedesCatalog={handleSaveSedesCatalog}
                    onUpdateRoles={handleUpdateRoles}
                    onUpdateUser={async (updatedUser) => {
                        const prev = users.find((u) => u.id === updatedUser.id);
                        if (prev?.status !== updatedUser.status) {
                          const ok = await syncUserAuthAccess(
                            updatedUser,
                            updatedUser.status !== 'inactive'
                          );
                          if (!ok) return;
                        }
                        setUsers((prevList) => {
                          const next = prevList.map((u) =>
                            u.id === updatedUser.id ? updatedUser : u
                          );
                          void persistUsersToCloud(next);
                          return next;
                        });
                        if (prev?.status !== updatedUser.status) {
                          toast.success(
                            updatedUser.status === 'inactive'
                              ? `Usuario desactivado: ${updatedUser.name}`
                              : `Usuario activado: ${updatedUser.name}`
                          );
                        } else {
                          toast.success('Usuario actualizado correctamente');
                        }
                    }}
                    onAddUser={(newUser) => {
                        setUsers(prev => {
                            const e = newUser.email?.toLowerCase();
                            const rest = e ? prev.filter(u => u.email?.toLowerCase() !== e) : prev;
                            const next = [...rest, newUser];
                            void persistUsersToCloud(next);
                            return next;
                        });
                    }}
                    onDeleteUser={async (userId) => {
                        const target = users.find((u) => u.id === userId);
                        if (target) {
                          const ok = await syncUserAuthAccess(target, false);
                          if (!ok) return;
                        }
                        setUsers((prev) => {
                          const next = prev.filter((u) => u.id !== userId);
                          void persistUsersToCloud(next);
                          return next;
                        });
                    }}
                    onRefreshUsers={() => hydrateFromKvRef.current?.()}
                />
             </div>
          )}

          {view === 'config' && (
            <ConfigPanel 
              config={config} 
              onUpdateConfig={setConfig} 
              systemSettings={systemSettings}
              onUpdateSystemSettings={handlePersistSystemSettings}
              onPersistSystemSettings={persistSystemSettingsNow}
              onPersistAsistenciaSettings={persistAsistenciaNow}
              onStressTest={handleStressTest}
              onResetData={handleResetData}
              users={users}
              roles={roles}
              onUpdateUsers={setUsers}
              currentUser={currentUser}
              onApplyProviderCategoryRename={applyProviderCategoryRename}
              onApplyProviderAreaRename={applyProviderAreaRename}
              onApplyProviderCategoryRemoved={applyProviderCategoryRemoved}
              onApplyProviderAreaRemoved={applyProviderAreaRemoved}
              onResetCustodianPettyCash={handleResetCustodianPettyCash}
            />
          )}

          {view === 'audit' && (
            <AuditPanel 
                transactions={transactions} 
                invoices={invoices} 
                onDeleteTransaction={handleDeleteTransaction}
                onDeleteInvoice={handleDeleteInvoice}
                canViewAuditLogs={canViewAuditLogs}
                currentUserEmail={currentUser.email}
            />
          )}

          {view === 'pettycash' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PettyCashModule 
                  transactions={filteredPettyCashBySede}
                  onUpdateTransactions={handleUpdatePettyCashTransactions}
                  settings={systemSettings.pettyCash ?? initialSystemSettings.pettyCash}
                  users={users}
                  currentUser={currentUser}
                  roles={roles}
                  visibleSedes={visibleSedes}
                  canAccessConsolidated={canAccessPettyCashConsolidated}
                  businessName={systemSettings.businessName}
                  businessLegalName={systemSettings.businessLegalName}
                  businessRuc={systemSettings.businessRuc}
                  businessLogo={systemSettings.businessLogo}
                  commercialCategories={commercialCategories}
                  commercialAreas={commercialAreas}
                  providers={providers}
                  onRequestProviderRegistration={() => {
                    setOpenQuickProviderModal(true);
                    navigate(viewToPath('providers'));
                  }}
                  onClosePettyCashWeek={handleClosePettyCashWeek}
                  onPreClosePettyCashWeek={handlePreClosePettyCashWeek}
                  onConfirmFundDelivery={handleConfirmPettyCashFundDelivery}
                  onConsumeOpeningCarry={handleConsumeOpeningCarry}
                  onRevokeFundDelivery={handleRevokePettyCashFundDelivery}
                  onPettyCashSettingsPatch={(patch) =>
                    handlePersistSystemSettings(
                      mergeSystemSettings({
                        ...systemSettings,
                        pettyCash: { ...systemSettings.pettyCash, ...patch },
                      })
                    )
                  }
                  chartOfAccounts={chartOfAccounts}
                  accountingLinks={systemSettings.accounting ?? {}}
                  journalPettyCashTransactions={pettyCashTransactions}
                />
             </div>
          )}

          {/* User Profile Dialog - Always Available */}
          <Suspense fallback={null}>
            <UserProfileDialog 
              open={isProfileOpen} 
              onOpenChange={setIsProfileOpen} 
              onLogout={handleLogout}
              onUpdateUser={(updatedUser) => {
                setUsers((prev) => {
                  const next = prev.map((u) => (u.id === updatedUser.id ? updatedUser : u));
                  void persistUsersToCloud(next);
                  return next;
                });
                setCurrentUser(updatedUser);
              }}
            />
          </Suspense>

          {/* Alert View - now integrated as a main view */}

          {/* Edit Transaction Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[680px]">
              <DialogHeader>
                <DialogTitle>Editar Transacción</DialogTitle>
                <DialogDescription>
                  Modifica los detalles de la transacción.
                </DialogDescription>
              </DialogHeader>
              {editingTransaction && (
                <TransactionForm 
                  onSubmit={handleUpdateTransaction} 
                  config={config} 
                  providers={providers}
                  bankAccounts={bankAccountsForForms}
                  sedesCatalog={enabledSedesForForms}
                  initialData={editingTransaction}
                  onCancel={() => setIsEditDialogOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isTransactionImporterOpen} onOpenChange={setIsTransactionImporterOpen}>
            <DialogContent className="sm:max-w-[840px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importar transacciones desde Excel</DialogTitle>
                <DialogDescription>
                  Descarga la plantilla actualizada o carga el archivo histórico de ingresos y egresos.
                </DialogDescription>
              </DialogHeader>
              <TransactionImporter
                onImport={async (items) => {
                  await handleImportTransactions(items);
                  setIsTransactionImporterOpen(false);
                }}
                config={config}
                sedesCatalog={enabledSedesForForms}
                providers={providers}
                bankAccounts={bankAccountsForForms}
                canManageHistoricalImport={isSuperAdmin}
              />
            </DialogContent>
          </Dialog>
        </Suspense>
        </div>
      </main>
      <Toaster />
      </AppProvider>
    </div>
  );
}
