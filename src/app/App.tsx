import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { pathToView, viewToPath, type ViewType } from "./routes";
import { LoginPage } from "./pages/LoginPage";
import { Overview } from "./components/dashboard/Overview";
import { RecentTransactions } from "./components/dashboard/RecentTransactions";
import { TransactionForm } from "./components/transactions/TransactionForm";
import { TransactionImporter } from "./components/transactions/TransactionImporter";
import { PnLView } from "./components/finance/PnLView";
import { PettyCashModule } from "./components/finance/PettyCashModule";
import { CashFlowChart } from "./components/dashboard/CashFlowChart";
import { CashFlowGrid } from "./components/dashboard/CashFlowGrid";
import { AnalyticsDashboard } from "./components/dashboard/AnalyticsDashboard";
import { ConfigPanel } from "./components/configuration/ConfigPanel";
import { Transaction, Category, TransactionType, InvoiceDraft, Provider, PurchaseRequest, RequestStatus, User, SystemSettings, PettyCashTransaction, SystemAlert, AlertThresholds, Requisition } from "./types";
import {
  getAllSedeNames,
  getEnabledSedeNames,
  getSedesCatalogEntries,
  migrateLocationField,
  type SedesCatalogSaveResult,
} from "./utils/sedesCatalog";
import { Role, DEFAULT_ROLES } from "./components/users/types";
import { initialStructure, ConfigStructure, initialSystemSettings } from "./data/initialData";
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
  Landmark
} from "lucide-react";
// Logo: coloque logo.png en la carpeta public/ para producción
const logoUrl = '/logo.png';
import { AuditPanel } from "./components/audit/AuditPanel";
import { MonthlySummary } from "./components/reports/MonthlySummary";

import { ProviderManager } from "./components/providers/ProviderManager";
import { PurchaseRequestManager } from "./components/purchases/PurchaseRequestManager";
import { UserManager } from "./components/users/UserManager";
import { TreasuryModule } from "./components/treasury/TreasuryModule";
import { ProfessionalFeesModule } from "./components/finance/ProfessionalFeesModule";
import { RequisitionModule } from "./components/procurement/RequisitionModule";
import { UserMenu } from "./components/layout/UserMenu";
import { UserProfileDialog } from "./components/users/UserProfileDialog";
import { addMonths, subMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/ui/dialog";
import { api } from "./services/api";
import { supabase } from "../../utils/supabase/client";
import { generateStressData } from "./utils/stressTestGenerator";
import { hydrateTransactions } from "./utils/hydrateTransactions";
import { generateAlerts } from "./components/alerts/alertEngine";
import { AlertsCenter } from "./components/alerts/AlertsCenter";
import { Toaster } from "./components/ui/sonner";
import { AppProvider } from "./context/AppContext";

// Mock data
const MOCK_USERS: User[] = [
    { id: 'usr-3', name: 'Admin Principal', role: 'super_admin', initials: 'ADM', email: 'admin@grooflow.com', status: 'active', allSedes: true },
    { id: '2', name: 'Luis Barco', initials: 'LB', role: 'manager', email: 'luis@grooflow.com', pettyCashLimit: 1500, status: 'active', sedes: ['Benavides'], allSedes: false },
    { id: '3', name: 'Juandy Gomez', initials: 'JG', role: 'manager', email: 'juandy@grooflow.com', pettyCashLimit: 1800, status: 'active', allSedes: true },
    { id: '4', name: 'Pierre Diaz', initials: 'PD', role: 'manager', email: 'pierre@grooflow.com', status: 'active', allSedes: true },
    { id: 'usr-1', name: 'Ana Silva', role: 'manager', initials: 'AS', email: 'ana@grooflow.com', status: 'active', allSedes: true },
    { id: 'usr-2', name: 'Carlos Ruiz', role: 'manager', initials: 'CR', email: 'carlos@grooflow.com', status: 'active', allSedes: true },
    { id: '1', name: 'Jeny Quispes', initials: 'JQ', role: 'manager', email: 'jeny@grooflow.com', status: 'active', allSedes: true },
    { id: 'usr-4', name: 'Dr. Pedro', role: 'groomer', initials: 'PG', email: 'pedro@grooflow.com', status: 'active', sedes: ['La Molina'], allSedes: false },
    { id: 'usr-5', name: 'Lucia Contadora', role: 'manager', initials: 'LC', email: 'lucia@grooflow.com', status: 'active', allSedes: true },
    { id: 'usr-6', name: 'Barbara Torres', role: 'manager', initials: 'BT', email: 'barbara@grooflow.com', pettyCashLimit: 1000, status: 'active', sedes: ['Miraflores'], allSedes: false }
];

const SUPER_ADMIN_EMAILS = new Set([
  'admin@grooflow.com',
  'admin@vetflow.com',
  'luisfrancisco.barco@gmail.com',
]);

/**
 * Tras cargar `data:users` desde KV, alinea la fila del usuario con `auth.users`
 * (mismo email puede tener id `usr-…` en KV y UUID en Supabase Auth).
 */
function mergeAuthUserIntoUsers(
  list: User[],
  authUser: { id: string; email?: string | null; user_metadata?: { name?: string } }
): User[] {
  const emailRaw = (authUser.email || '').trim();
  const emailLower = emailRaw.toLowerCase();
  if (!emailLower) return list;

  const isPrivileged = SUPER_ADMIN_EMAILS.has(emailLower);
  const byId = list.findIndex((u) => u.id === authUser.id);
  if (byId >= 0) {
    return list.map((u, i) =>
      i === byId
        ? ({
            ...u,
            email: emailRaw || u.email,
            name: u.name || authUser.user_metadata?.name || u.name,
            ...(isPrivileged
              ? { role: 'super_admin' as const, allSedes: true, status: 'active' as const }
              : {}),
          } as User)
        : u
    );
  }

  const byEmail = list.findIndex((u) => (u.email || '').toLowerCase() === emailLower);
  if (byEmail >= 0) {
    return list.map((u, i) =>
      i === byEmail
        ? ({
            ...u,
            id: authUser.id,
            email: emailRaw || u.email,
            name: u.name || authUser.user_metadata?.name || u.name,
            ...(isPrivileged
              ? { role: 'super_admin' as const, allSedes: true, status: 'active' as const }
              : {}),
          } as User)
        : u
    );
  }

  const row: User = {
    id: authUser.id,
    email: emailRaw,
    name: authUser.user_metadata?.name || emailRaw.split('@')[0],
    initials: (authUser.user_metadata?.name || emailRaw).slice(0, 2).toUpperCase(),
    role: isPrivileged ? 'super_admin' : 'manager',
    status: 'active',
    lastLogin: new Date().toISOString(),
    ...(isPrivileged ? { allSedes: true } : {}),
  };
  return [...list, row];
}

const initialTransactions: Transaction[] = [
  {
    id: "1",
    amount: 150.00,
    type: "income",
    category: "Ingresos",
    subcategory: "Efectivo",
    description: "Venta de mostrador",
    date: new Date("2024-03-10"),
    location: "Principal"
  },
  {
    id: "2",
    amount: 5000.00,
    type: "expense",
    category: "Servicios Básicos",
    subcategory: "Alquiler",
    concept: "Chavez",
    description: "Alquiler Marzo Sede Chavez",
    date: new Date("2024-03-05"),
    location: "Norte"
  },
  {
    id: "3",
    amount: 350.00,
    type: "expense",
    category: "Área Médica",
    subcategory: "Fumigación Ecocontratista",
    description: "Servicio de fumigación mensual",
    date: new Date("2024-03-12"),
    location: "Sur"
  },
  {
    id: "4",
    amount: 1200.00,
    type: "expense",
    category: "Planilla",
    subcategory: "(7) Planilla Médicos",
    description: "Adelanto Dr. Perez",
    date: new Date("2024-03-15"),
  },
  {
    id: "5",
    amount: 850.50,
    type: "income",
    category: "Ingresos",
    subcategory: "POS",
    description: "Cobro tarjeta",
    date: new Date("2024-03-12"),
  },
];

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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'guest',
    name: 'Invitado',
    initials: 'IN',
    role: 'manager',
    status: 'active',
    allSedes: true,
  });
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [invoices, setInvoices] = useState<InvoiceDraft[]>(initialInvoices);
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [requests, setRequests] = useState<PurchaseRequest[]>(initialRequests);
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

  // Requisitions global state
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  /** En Supabase: solo true tras leer `data:users` del KV con HTTP 200 (evita pisar la nube si el GET falló). */
  const [canSaveUsers, setCanSaveUsers] = useState(true);
  /** Evita doble carga y, en Supabase, permite volver a cargar tras logout/login. */
  const cloudDataHydratedRef = useRef(false);

  // Alerts System
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>({
    liquidityMinDays: 3,
    invoiceDueDays: 7,
    spendingSpikePercent: 25,
    pettyCashLowBalance: 20,
    staleRequestDays: 3
  });

  // Transaction Filters State
  const [txFilterDateStart, setTxFilterDateStart] = useState("");
  const [txFilterDateEnd, setTxFilterDateEnd] = useState("");
  const [txFilterCategory, setTxFilterCategory] = useState<string>("all");
  const [txFilterProvider, setTxFilterProvider] = useState<string>("all");
  
  // Transaction Editing State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- SUPABASE AUTH CHECK ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleLogin(
          session.user.email || '',
          session.user.user_metadata?.name,
          session.user.id
        );
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleLogin(
          session.user.email || '',
          session.user.user_metadata?.name,
          session.user.id
        );
      } else {
        setIsAuthenticated(false);
        cloudDataHydratedRef.current = false;
        setCanSaveUsers(true);
        setIsDataLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- CLOUD / KV SYNC ---
  // Con Supabase, el KV exige JWT. Si loadData corre antes de la sesión, los GET fallan,
  // users queda [] y el autosave pisa data:users en la nube → "desaparecen" los usuarios.
  useEffect(() => {
    let cancelled = false;
    const backend = import.meta.env.VITE_BACKEND ?? 'supabase';

    const loadData = async () => {
      if (backend === 'supabase') {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return;
        }
        setCanSaveUsers(false);
      }

      if (cloudDataHydratedRef.current) {
        return;
      }

      let data = await api.fetchInitialData();
      let attempt = 0;
      while (backend === 'supabase' && data.__usersKvFetchFailed && attempt < 3) {
        attempt += 1;
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 350 * attempt));
        await supabase.auth.refreshSession();
        data = await api.fetchInitialData();
      }

      if (cancelled) return;

      if (backend === 'supabase' && data.__usersKvFetchFailed) {
        toast.error(
          'No se pudieron leer los usuarios desde la nube. Los cambios en la lista no se guardarán hasta que recargues o vuelvas a iniciar sesión.'
        );
        setCanSaveUsers(false);
      } else {
        setCanSaveUsers(true);
      }

      if (data['settings:config']) setConfig(data['settings:config']);
      if (data['settings:system']) setSystemSettings(data['settings:system']);

      if (data['data:transactions']) {
        const hydrated = hydrateTransactions(data['data:transactions']);
        const unique = Array.from(new Map(hydrated.map((t) => [t.id, t])).values());
        setTransactions(unique);
      }

      if (data['data:invoices']) {
        const unique = Array.from(
          new Map(data['data:invoices'].map((i: InvoiceDraft) => [i.id, i])).values()
        ) as InvoiceDraft[];
        setInvoices(unique);
      }

      if (data['data:providers']) {
        const unique = Array.from(
          new Map(data['data:providers'].map((p: Provider) => [p.id, p])).values()
        ) as Provider[];
        setProviders(unique);
      }

      if (data['data:requests']) {
        const unique = Array.from(
          new Map(data['data:requests'].map((r: PurchaseRequest) => [r.id, r])).values()
        ) as PurchaseRequest[];
        setRequests(unique);
      }

      if (data['data:pettyCash']) setPettyCashTransactions(data['data:pettyCash']);

      // Importante: `if (data['data:users'])` falla cuando es [] (falsy) y se ignora el KV → autosave pisa la lista.
      let nextUsers: User[] = [];
      const usersFromKv = data['data:users'];
      if (Array.isArray(usersFromKv)) {
        const uniqueUsers = Array.from(
          new Map(usersFromKv.map((u: User) => [u.id, u])).values()
        ) as User[];
        nextUsers = uniqueUsers.map((u) => {
          const email = (u.email || '').toLowerCase();
          if (!SUPER_ADMIN_EMAILS.has(email)) return u;
          return {
            ...u,
            role: 'super_admin',
            allSedes: true,
            status: 'active',
          } as User;
        });
      }

      {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session?.user) {
          nextUsers = mergeAuthUserIntoUsers(nextUsers, session.user);
        }
      }

      setUsers(nextUsers);
      // Marcar hidratación ANTES del resto de setState: si handleLogin corre justo después de setUsers,
      // debe ver ref=true y no añadir 1 usuario ficticio encima del array ya cargado.
      cloudDataHydratedRef.current = true;

      // Tras hidratar desde KV, alinear usuario actual con la fila real (evita estado “1 usuario” por carrera con handleLogin).
      {
        const {
          data: { session: sess },
        } = await supabase.auth.getSession();
        if (!cancelled && sess?.user?.email) {
          const em = sess.user.email.toLowerCase();
          const row = nextUsers.find((u) => (u.email || '').toLowerCase() === em);
          if (row) {
            setCurrentUser(row);
            setIsAuthenticated(true);
          }
        }
      }

      if (data['data:roles']) setRoles(data['data:roles']);
      if (data['data:feeReceipts']) setFeeReceipts(data['data:feeReceipts']);
      if (data['data:requisitions']) setRequisitions(data['data:requisitions']);
      if (data['data:alertThresholds']) setAlertThresholds(data['data:alertThresholds']);
      if (data['settings:theme']) setTheme(data['settings:theme']);
      if (data['data:treasuryInvoices']) setTreasuryInvoices(data['data:treasuryInvoices']);
      if (data['data:treasuryBankBalance'] !== undefined)
        setTreasuryBankBalance(data['data:treasuryBankBalance']);
      if (data['data:treasuryPaidHistory'])
        setTreasuryPaidHistory(data['data:treasuryPaidHistory']);

      setIsDataLoaded(true);
      toast.success('Datos sincronizados con la nube');
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Auto-save Effects
  useEffect(() => {
    if (isDataLoaded) api.saveKey('settings:config', config);
  }, [config, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:pettyCash', pettyCashTransactions);
  }, [pettyCashTransactions, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('settings:system', systemSettings);
  }, [systemSettings, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:transactions', transactions);
  }, [transactions, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:invoices', invoices);
  }, [invoices, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:providers', providers);
  }, [providers, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:requests', requests);
  }, [requests, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded && canSaveUsers) api.saveKey('data:users', users);
  }, [users, isDataLoaded, canSaveUsers]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:roles', roles);
  }, [roles, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:feeReceipts', feeReceipts);
  }, [feeReceipts, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:requisitions', requisitions);
  }, [requisitions, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('data:alertThresholds', alertThresholds);
  }, [alertThresholds, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) api.saveKey('settings:theme', theme);
  }, [theme, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded && treasuryInvoices.length > 0) api.saveKey('data:treasuryInvoices', treasuryInvoices);
  }, [treasuryInvoices, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded && treasuryBankBalance !== undefined) api.saveKey('data:treasuryBankBalance', treasuryBankBalance);
  }, [treasuryBankBalance, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded && treasuryPaidHistory.length > 0) api.saveKey('data:treasuryPaidHistory', treasuryPaidHistory);
  }, [treasuryPaidHistory, isDataLoaded]);

  // --- ALERTS ENGINE ---
  useEffect(() => {
    if (!isDataLoaded) return;

    // Generar nuevas alertas basadas en los datos actuales
    const newAlerts = generateAlerts({
        transactions,
        invoices,
        requests,
        pettyCash: pettyCashTransactions,
        users,
        thresholds: alertThresholds
    });

    // Merge con el estado actual para preservar 'read' status
    setAlerts(prevAlerts => {
        const readMap = new Map(prevAlerts.map(a => [a.id, a.read]));
        
        return newAlerts.map(alert => ({
            ...alert,
            read: readMap.get(alert.id) || false
        }));
    });
  }, [transactions, invoices, requests, pettyCashTransactions, alertThresholds, isDataLoaded]);

  const handleMarkAlertAsRead = (id: string) => {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const handleMarkAllAlertsAsRead = () => {
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
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

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  /** authUserId = Supabase user.id (UUID). Evita duplicados usr-… vs UUID mismo email. */
  const handleLogin = (email: string, name?: string, authUserId?: string) => {
      const now = new Date().toISOString();
      const emailLower = email.toLowerCase();
      const isPrivileged = SUPER_ADMIN_EMAILS.has(emailLower);

      setUsers(prevUsers => {
          const sameEmail = prevUsers.filter(u => u.email?.toLowerCase() === emailLower);
          let existingUser =
            authUserId && sameEmail.length
              ? sameEmail.find(u => u.id === authUserId)
              : undefined;
          if (!existingUser && sameEmail.length) {
              // Preferir fila con id real de Auth (no sintético usr-…)
              existingUser =
                sameEmail.find(u => !String(u.id).startsWith('usr-')) ?? sameEmail[0];
          }

          if (existingUser) {
              if (existingUser.status === 'inactive' && !isPrivileged) {
                  toast.error("Tu cuenta está desactivada. Contacta al Administrador.");
                  return prevUsers;
              }

              const updatedUser: User = {
                  ...existingUser,
                  ...(authUserId && existingUser.id !== authUserId
                      ? { id: authUserId, name: name || existingUser.name }
                      : { name: name || existingUser.name }),
                  ...(isPrivileged ? { role: 'super_admin', allSedes: true } : {}),
                  lastLogin: now,
                  status: 'active',
              };

              // Quitar duplicados legacy (mismo email, otro id)
              const withoutDupes = prevUsers.filter(u => {
                  if (u.email?.toLowerCase() !== emailLower) return true;
                  return u.id === existingUser!.id;
              });

              const updatedUsers = withoutDupes.map(u =>
                  u.id === existingUser!.id ? updatedUser : u
              );
              setCurrentUser(updatedUser);
              setIsAuthenticated(true);
              return updatedUsers;
          }

          // Antes de que loadData termine de leer el KV, prevUsers suele ser []. Añadir aquí 1 fila hace que,
          // si este setState se aplica DESPUÉS de setUsers(KV), se pisa toda la lista → “desaparecen” usuarios.
          if (!cloudDataHydratedRef.current) {
              setIsAuthenticated(true);
              setCurrentUser({
                  id: authUserId || 'guest-pending',
                  email,
                  name: name || email.split('@')[0],
                  role: isPrivileged ? 'super_admin' : 'manager',
                  initials: (name || email).slice(0, 2).toUpperCase(),
                  lastLogin: now,
                  status: 'active',
                  allSedes: isPrivileged ? true : undefined,
              } as User);
              return prevUsers;
          }

          const newUser: User = {
              id: authUserId || `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              email: email,
              name: name || email.split('@')[0],
              role: isPrivileged ? 'super_admin' : 'manager',
              initials: (name || email).slice(0, 2).toUpperCase(),
              lastLogin: now,
              status: 'active',
              allSedes: isPrivileged ? true : undefined,
          };

          setCurrentUser(newUser);
          setIsAuthenticated(true);

          return [...prevUsers, newUser];
      });
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      cloudDataHydratedRef.current = false;
      setCanSaveUsers(true);
      setIsDataLoaded(false);
      setIsAuthenticated(false);
      setIsProfileOpen(false);
      navigate(viewToPath('dashboard'));
  };

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

    setRequisitions((prev) =>
      prev.map((req) => ({
        ...req,
        location: req.location ? loc(req.location) ?? fallback : req.location,
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
         date: new Date(updatedData.date),
         id: editingTransaction.id
     };

     const updatedList = transactions.map(t => t.id === updatedTx.id ? updatedTx : t);
     setTransactions(updatedList);
     setIsEditDialogOpen(false);
     setEditingTransaction(null);
     toast.success("Transacción actualizada correctamente");
  };

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleAddTransaction = (data: any) => {
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      amount: Number(data.amount),
      type: data.type as TransactionType,
      category: data.category as Category,
      subcategory: data.subcategory,
      concept: data.concept,
      description: data.description,
      date: new Date(data.date),
      providerId: data.providerId,
      location: data.location,
    };
    setTransactions([newTransaction, ...transactions]);
  };

  const handleImportTransactions = (newTransactions: Transaction[]) => {
    setTransactions(prev => [...newTransactions, ...prev]);
  };

  const handleProjectTransactions = (projectedTxs: Transaction[]) => {
     setTransactions(prev => [...prev, ...projectedTxs]);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    toast.success("Transacción eliminada correctamente");
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast.info("Factura eliminada desde auditoría");
  };

  const handleRegisterPayment = (invoice: InvoiceDraft) => {
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

    setTransactions(prev => [newTransaction, ...prev]);

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

    const handleStressTest = () => {
        const { transactions: newTx, invoices: newInv, users: newUsrs } = generateStressData();
        setTransactions(prev => [...newTx, ...prev]);
        setInvoices(prev => [...newInv, ...prev]);
        setUsers(prev => [...prev, ...newUsrs]);
        
        toast.success("STRESS TEST COMPLETADO", {
            description: `Se han generado ${newTx.length} transacciones, ${newInv.length} facturas y ${newUsrs.length} usuarios.`
        });
    };

    const handleResetData = () => {
      setTransactions([]);
      setInvoices([]);
      setPettyCashTransactions([]);
      // We keep users and providers to avoid locking out the admin
      toast.success("Base de datos reiniciada correctamente.");
    };

    // Filter Logic
    const filteredTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      // Ajustar fechas para comparación correcta (inicio del día y fin del día)
      const start = txFilterDateStart ? new Date(txFilterDateStart) : null;
      if(start) start.setHours(0,0,0,0);
      
      const end = txFilterDateEnd ? new Date(txFilterDateEnd) : null;
      if(end) end.setHours(23,59,59,999);

      const dateMatch = (!start || tDate >= start) && (!end || tDate <= end);
      const categoryMatch = txFilterCategory === "all" || t.category === txFilterCategory;
      const providerMatch = txFilterProvider === "all" || t.providerId === txFilterProvider;

      return dateMatch && categoryMatch && providerMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netCashFlow = totalIncome - totalExpense;

  if (!isAuthenticated) {
    return (
      <div className="bg-background text-foreground transition-colors duration-500">
        <LoginPage onLogin={handleLogin} currentTheme={theme} onToggleTheme={toggleTheme} />
      </div>
    );
  }

  // Check if current user has permission for a specific module
  const userRole = roles.find(r => r.id === currentUser.role);
  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';
  const hasPermission = (moduleName: string): boolean => {
    if (isSuperAdmin) return true;
    return userRole?.permissions?.[moduleName] === true;
  };

  // --- SEDE FILTERING HELPERS ---
  const canSeeSede = (sede: string): boolean => {
      if (isSuperAdmin || currentUser.allSedes) return true;
      if (!currentUser.sedes || currentUser.sedes.length === 0) return true;
      return currentUser.sedes.includes(sede);
  };
  const catalogSedes = getAllSedeNames(systemSettings);
  const enabledSedesForForms = getEnabledSedeNames(systemSettings);
  const sedesEntriesForDialog = getSedesCatalogEntries(systemSettings);
  const visibleSedes: string[] = (isSuperAdmin || currentUser.allSedes || !currentUser.sedes?.length)
      ? [...catalogSedes]
      : (currentUser.sedes || []);
  const filteredPettyCashBySede = pettyCashTransactions.filter(tx =>
      !tx.location || canSeeSede(tx.location)
  );
  const filteredRequestsBySede = requests.filter(r =>
      !r.location || canSeeSede(r.location)
  );

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

  return (
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-500 relative overflow-x-hidden">
      <AppProvider value={{ currentUser, theme, toggleTheme }}>
      {/* Animated Neon Orbs */}
      <div className="orb-cyan bg-orb"></div>
      <div className="orb-violet bg-orb"></div>
      <div className="orb-pink bg-orb"></div>
      {/* Circuit Grid */}
      <div className="bg-circuit fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.5 }} />

      {/* Sidebar */}
      <div 
        className={`${isSidebarCollapsed ? 'w-[76px]' : 'w-[256px]'} fixed inset-y-0 left-0 z-50 flex flex-col`}
        style={{
          transition: 'width 500ms cubic-bezier(0.2, 0, 0, 1)',
          background: 'linear-gradient(180deg, #0D0B1E 0%, #090718 50%, #0D0B1E 100%)',
          borderRight: '1px solid rgba(139,92,246,0.12)',
          boxShadow: '4px 0 40px rgba(0,0,0,0.6)'
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
           <NavButton targetView="alerts" icon={ShieldAlert} label="Alertas" iconColorClass="text-rose-400 group-hover/btn:text-rose-300" requiredModule="Dashboard" />
           <NavButton targetView="analytics" icon={Brain} label="Analítica AI" iconColorClass="text-violet-400 group-hover/btn:text-violet-300" requiredModule="Analítica" />
           
           {hasPermission('Finanzas') && !isSidebarCollapsed && (
            <div className="px-3 pb-1 pt-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.2)' }}>Finanzas</span>
            </div>
          )}
           <NavButton targetView="treasury" icon={Landmark} label="Tesorería" iconColorClass="text-amber-400 group-hover/btn:text-amber-300" requiredModule="Finanzas" />
           <NavButton targetView="transactions" icon={Wallet} label="Transacciones" iconColorClass="text-emerald-400 group-hover/btn:text-emerald-300" requiredModule="Finanzas" />
           <NavButton targetView="cashflow" icon={CalendarDays} label="Flujo de Caja" iconColorClass="text-cyan-400 group-hover/btn:text-cyan-300" requiredModule="Finanzas" />
           <NavButton targetView="pnl" icon={TrendingUp} label="Estado de Resultados" iconColorClass="text-pink-400 group-hover/btn:text-pink-300" requiredModule="Finanzas" />
           <NavButton targetView="reports" icon={FileText} label="Reportes" iconColorClass="text-amber-400 group-hover/btn:text-amber-300" requiredModule="Reportes" />
           <NavButton targetView="pettycash" icon={Coins} label="Caja Chica" iconColorClass="text-teal-400 group-hover/btn:text-teal-300" requiredModule="Caja Chica" />
           <NavButton targetView="fees" icon={Stethoscope} label="Honorarios" iconColorClass="text-violet-400 group-hover/btn:text-violet-300" requiredModule="Finanzas" />
           
           {(hasPermission('Proveedores') || hasPermission('Compras') || hasPermission('Auditoría')) && !isSidebarCollapsed && (
            <div className="px-3 pb-1 pt-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.2)' }}>Gestión</span>
            </div>
          )}
           <NavButton targetView="providers" icon={Users} label="Proveedores" iconColorClass="text-indigo-400 group-hover/btn:text-indigo-300" requiredModule="Proveedores" />
           <NavButton targetView="requisitions" icon={Package} label="Requerimientos" iconColorClass="text-fuchsia-400 group-hover/btn:text-fuchsia-300" requiredModule="Compras" />
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
        style={{ background: 'rgba(13,11,30,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(139,92,246,0.15)' }}
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
        <UserMenu 
            onLogout={handleLogout} 
            onProfileClick={() => setIsProfileOpen(true)} 
        />
      </div>

       {/* Mobile Menu Dropdown */}
       {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setMobileMenuOpen(false)}>
            <div className="fixed inset-y-0 left-0 w-64 shadow-2xl p-4 pt-20 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #0D0B1E 0%, #090718 100%)', borderRight: '1px solid rgba(139,92,246,0.15)' }} onClick={e => e.stopPropagation()}>
                <nav className="space-y-0.5">
                    <NavButton targetView="dashboard" icon={LayoutDashboard} label="Dashboard" iconColorClass="text-sky-400" requiredModule="Dashboard" />
                    <NavButton targetView="alerts" icon={ShieldAlert} label="Alertas" iconColorClass="text-rose-400" requiredModule="Dashboard" />
                    <NavButton targetView="analytics" icon={Brain} label="Analítica AI" iconColorClass="text-violet-400" requiredModule="Analítica" />
                    <NavButton targetView="treasury" icon={Landmark} label="Tesorería" iconColorClass="text-amber-400" requiredModule="Finanzas" />
                    <NavButton targetView="transactions" icon={Wallet} label="Transacciones" iconColorClass="text-emerald-400" requiredModule="Finanzas" />
                    <NavButton targetView="cashflow" icon={CalendarDays} label="Flujo de Caja" iconColorClass="text-cyan-400" requiredModule="Finanzas" />
                    <NavButton targetView="pnl" icon={TrendingUp} label="Estado de Resultados" iconColorClass="text-pink-400" requiredModule="Finanzas" />
                    <NavButton targetView="reports" icon={FileText} label="Reportes" iconColorClass="text-amber-400" requiredModule="Reportes" />
                    <NavButton targetView="audit" icon={ShieldAlert} label="Auditoría" iconColorClass="text-orange-400" requiredModule="Auditoría" />
                    <NavButton targetView="pettycash" icon={Coins} label="Caja Chica" iconColorClass="text-teal-400" requiredModule="Caja Chica" />
                    <NavButton targetView="fees" icon={Stethoscope} label="Honorarios" iconColorClass="text-violet-400" requiredModule="Finanzas" />
                    <NavButton targetView="providers" icon={Users} label="Proveedores" iconColorClass="text-indigo-400" requiredModule="Proveedores" />
                    <NavButton targetView="requisitions" icon={Package} label="Requerimientos" iconColorClass="text-fuchsia-400" requiredModule="Compras" />
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
          
          {/* Header Section for Views using Generic Wrapper */}
          {['dashboard', 'alerts', 'transactions', 'cashflow', 'pettycash', 'requisitions'].includes(view) && (
          <div className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
            
            {/* Title & Date Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="space-y-0.5">
                    <h1 className="flex items-center gap-2.5" style={{ color: '#F0EEFF', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {view === 'dashboard' && <LayoutDashboard className="w-7 h-7" style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.5))' }} />}
                        {view === 'alerts' && <ShieldAlert className="w-7 h-7" style={{ color: '#fb7185', filter: 'drop-shadow(0 0 8px rgba(251,113,133,0.5))' }} />}
                        {view === 'transactions' && <Wallet className="w-7 h-7" style={{ color: '#34d399', filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.5))' }} />}
                        {view === 'cashflow' && <CalendarDays className="w-7 h-7" style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.5))' }} />}
                        {view === 'pettycash' && <Coins className="w-7 h-7" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.5))' }} />}
                        {view === 'requisitions' && <Package className="w-7 h-7" style={{ color: '#e879f9', filter: 'drop-shadow(0 0 8px rgba(232,121,249,0.5))' }} />}
                        
                        {view === 'dashboard' ? 'Resumen Operativo' : 
                        view === 'alerts' ? 'Centro de Alertas' :
                        view === 'transactions' ? 'Gestión de Transacciones' :
                        view === 'cashflow' ? 'Flujo de Caja' : 
                        view === 'requisitions' ? 'Requerimientos de Sede' :
                        'Control de Caja Chica'}
                    </h1>
                    <p style={{ color: '#6b5fa5', fontSize: '0.875rem' }}>
                        {view === 'dashboard' ? 'Bienvenido al panel de control financiero.' : 
                        view === 'alerts' ? 'Notificaciones y avisos del sistema.' :
                        view === 'transactions' ? 'Registro y control de movimientos financieros.' :
                        view === 'cashflow' ? 'Proyección y análisis de liquidez.' : 
                        view === 'requisitions' ? 'Gestión de insumos y pedidos internos.' :
                        'Control de fondo fijo y gastos menores.'}
                    </p>
                </div>

                {/* Date Controls for Cashflow */}
                {view === 'cashflow' && (
                <div className="flex items-center rounded-xl h-9 self-start sm:self-center ml-0 sm:ml-4 overflow-hidden"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}
                >
                    <button onClick={handlePrevMonth} className="p-2 h-full flex items-center transition-colors hover:bg-white/5" style={{ color: '#8b7cf8' }}>
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 text-sm font-medium min-w-[140px] text-center capitalize" style={{ color: '#F0EEFF' }}>
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </span>
                    <button onClick={handleNextMonth} className="p-2 h-full flex items-center transition-colors hover:bg-white/5" style={{ color: '#8b7cf8' }}>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
                )}
            </div>

            {/* Right Side: Admin Tools */}
            <div className="flex items-center gap-4 self-end sm:self-auto">
                {/* Admin User Simulator */}
                {currentUser.role === 'admin' && (
                    <div className="hidden lg:flex items-center gap-2 p-1.5 rounded-xl"
                      style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                        <div className="px-2">
                            <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(192,132,252,0.6)' }}>Simulador</div>
                        </div>
                        <Select 
                            value={currentUser.id} 
                            onValueChange={(val) => {
                                const selectedUser = users.find(u => u.id === val);
                                if (selectedUser) setCurrentUser(selectedUser);
                            }}
                        >
                            <SelectTrigger className="w-[160px] h-8 text-xs border-0 shadow-none focus:ring-0" style={{ background: 'rgba(255,255,255,0.04)', color: '#c084fc' }}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                        <span className="font-bold mr-1">{user.initials}</span> {user.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
          </div>
          )}

          {view === 'treasury' && (
             <TreasuryModule 
               pendingFeeReceipts={feeReceipts.filter(r => r.status === 'requested_payment')}
               onMarkReceiptPaid={(receiptId, paymentDate) => {
                 setFeeReceipts(prev => prev.map(r => 
                   r.id === receiptId ? { ...r, status: 'paid' as const, paymentDate } : r
                 ));
               }}
               treasuryInvoices={treasuryInvoices.length > 0 ? treasuryInvoices : undefined}
               onUpdateTreasuryInvoices={setTreasuryInvoices}
               bankBalance={treasuryBankBalance}
               onUpdateBankBalance={setTreasuryBankBalance}
               paidHistory={treasuryPaidHistory.length > 0 ? treasuryPaidHistory : undefined}
               onUpdatePaidHistory={setTreasuryPaidHistory}
             />
          )}

          {view === 'fees' && (
             <ProfessionalFeesModule 
                providers={providers}
                onUpdateProviders={setProviders}
                receipts={feeReceipts.length > 0 ? (feeReceipts as any[]) : undefined}
                onUpdateReceipts={(receipts) => setFeeReceipts(receipts as any[])}
                onSendToTreasury={(receipts) => {
                  setFeeReceipts(prev => {
                    const existingIds = new Set(prev.map(r => r.id));
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
                    return [...updated, ...newReceipts];
                  });
                  toast.success("Recibos enviados a Tesorería - Mesa de Pagos", { description: "Ve a Tesorería para aprobar los pagos." });
                }}
             />
          )}

          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Financial Cockpit - Full Dashboard */}
              <Overview 
                  transactions={transactions} 
                  alerts={alerts}
                  onOpenAlerts={() => navigate(viewToPath('alerts'))}
              />

              {/* Cash Flow Chart */}
              <CashFlowChart transactions={transactions} currentDate={currentDate} />
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
            <AnalyticsDashboard transactions={transactions} />
          )}

            {view === 'transactions' && (
            <div className="grid gap-6 md:grid-cols-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="md:col-span-4 lg:col-span-3 space-y-5">
                <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                  <h3 className="mb-5 flex items-center gap-2" style={{ color: '#F0EEFF', fontWeight: 700 }}>
                    <PlusCircle className="h-5 w-5" style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.5))' }} />
                    Nueva Transacción
                  </h3>
                  <TransactionForm onSubmit={handleAddTransaction} config={config} providers={providers} />
                </div>

                <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                  <h3 className="mb-4" style={{ color: '#F0EEFF', fontWeight: 700 }}>Importar Excel</h3>
                  <TransactionImporter onImport={handleImportTransactions} />
                </div>
              </div>
              
              <div className="md:col-span-8 lg:col-span-9">
                <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                  <div className="flex flex-col space-y-4 mb-5">
                    <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <h3 style={{ color: '#F0EEFF', fontWeight: 700 }}>Historial de Transacciones</h3>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b7cf8' }}>{filteredTransactions.length} registros</span>
                    </div>
                    
                    {/* Filters Toolbar */}
                    <div className="flex flex-wrap gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: '#6b5fa5' }}>Desde:</span>
                            <Input 
                                type="date" 
                                className="h-8 w-auto" 
                                value={txFilterDateStart} 
                                onChange={(e) => setTxFilterDateStart(e.target.value)} 
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: '#6b5fa5' }}>Hasta:</span>
                            <Input 
                                type="date" 
                                className="h-8 w-auto" 
                                value={txFilterDateEnd} 
                                onChange={(e) => setTxFilterDateEnd(e.target.value)} 
                            />
                        </div>
                        <div className="flex items-center gap-2 min-w-[150px]">
                             <Select value={txFilterCategory} onValueChange={setTxFilterCategory}>
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
                        {(txFilterDateStart || txFilterDateEnd || txFilterCategory !== 'all' || txFilterProvider !== 'all') && (
                            <button 
                                onClick={() => {
                                    setTxFilterDateStart("");
                                    setTxFilterDateEnd("");
                                    setTxFilterCategory("all");
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
                  <RecentTransactions transactions={filteredTransactions.slice(0, 50)} onEdit={openEditDialog} />
                </div>
              </div>
            </div>
          )}

          {view === 'cashflow' && (
             <div className="h-[calc(100vh-120px)] min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
               <CashFlowGrid 
                 transactions={transactions} 
                 config={config} 
                 onAddProjectedTransactions={handleProjectTransactions}
                 currentDate={currentDate}
                 systemSettings={systemSettings}
                 onUpdateSettings={setSystemSettings}
                 invoices={invoices}
               />
             </div>
          )}

          {view === 'pnl' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <PnLView 
                 transactions={transactions} 
                 currentDate={currentDate} 
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
                     {format(currentDate, 'MMMM yyyy', { locale: es })}
                   </span>
                   <Button variant="outline" size="sm" onClick={handleNextMonth}>
                     <ChevronRight className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
               <MonthlySummary transactions={transactions} currentDate={currentDate} />
             </div>
          )}

          {view === 'providers' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ProviderManager 
                    providers={providers} 
                    onUpdateProviders={setProviders} 
                    config={config}
                    systemSettings={systemSettings}
                    onUpdateSystemSettings={setSystemSettings}
                    userRole={currentUser.role}
                />
             </div>
          )}

          {view === 'requisitions' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <RequisitionModule 
                    currentUser={currentUser}
                    users={users}
                    visibleSedes={visibleSedes}
                    requisitions={requisitions}
                    onUpdateRequisitions={setRequisitions}
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
                        setRequests([signedRequest, ...requests]);
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
                    onUpdateRoles={setRoles}
                    onUpdateUser={(updatedUser) => {
                        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
                        toast.success("Usuario actualizado correctamente");
                    }}
                    onAddUser={(newUser) => {
                        setUsers(prev => {
                            const e = newUser.email?.toLowerCase();
                            const rest = e ? prev.filter(u => u.email?.toLowerCase() !== e) : prev;
                            return [...rest, newUser];
                        });
                    }}
                    onDeleteUser={(userId) => {
                        setUsers(prev => prev.filter(u => u.id !== userId));
                    }}
                />
             </div>
          )}

          {view === 'config' && (
            <ConfigPanel 
              config={config} 
              onUpdateConfig={setConfig} 
              systemSettings={systemSettings}
              onUpdateSystemSettings={setSystemSettings}
              onStressTest={handleStressTest}
              onResetData={handleResetData}
              users={users}
              onUpdateUsers={setUsers}
              currentUser={currentUser}
            />
          )}

          {view === 'audit' && (
            <AuditPanel 
                transactions={transactions} 
                invoices={invoices} 
                onDeleteTransaction={handleDeleteTransaction}
                onDeleteInvoice={handleDeleteInvoice}
            />
          )}

          {view === 'pettycash' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PettyCashModule 
                  transactions={filteredPettyCashBySede}
                  onUpdateTransactions={setPettyCashTransactions}
                  settings={systemSettings.pettyCash}
                  users={users}
                  currentUser={currentUser}
                  visibleSedes={visibleSedes}
                />
             </div>
          )}

          {/* User Profile Dialog - Always Available */}
          <UserProfileDialog 
            open={isProfileOpen} 
            onOpenChange={setIsProfileOpen} 
            onLogout={handleLogout}
          />

          {/* Alert View - now integrated as a main view */}

          {/* Edit Transaction Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
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
                  initialData={editingTransaction}
                  onCancel={() => setIsEditDialogOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <Toaster />
      </AppProvider>
    </div>
  );
}
