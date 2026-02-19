import { Transaction, InvoiceDraft, User, TransactionType, Category, InvoiceStatus } from "../types";
import { addDays, subDays, format } from "date-fns";

const CATEGORIES: Category[] = [
    'Ingresos', 'Servicios Básicos', 'Planilla', 'Proveedores', 'Mantenimiento', 
    'Impuestos', 'Seguros', 'Área Médica', 'Farmacia', 'Alimentos', 'Alquiler', 'Otros'
];

const NAMES = [
    "Juan", "Maria", "Carlos", "Ana", "Luis", "Sofia", "Pedro", "Lucia", "Miguel", "Elena",
    "Roberto", "Patricia", "Fernando", "Laura", "Diego", "Carmen", "Javier", "Rosa", "Alberto", "Isabel"
];

const LAST_NAMES = [
    "Perez", "Garcia", "Lopez", "Rodriguez", "Martinez", "Hernandez", "Gonzalez", "Diaz", "Sanchez", "Ramirez"
];

const PROVIDERS = [
    "Distribuidora Vet SAC", "Luz del Sur", "Sedapal", "Internet Provider", 
    "Laboratorios X", "Limpieza Total", "Seguridad Pro", "Alquileres SA",
    "Insumos Medicos EIRL", "Grooming Supplies"
];

export const generateStressData = () => {
    const transactions: Transaction[] = [];
    const invoices: InvoiceDraft[] = [];
    const users: User[] = [];
    
    // Use performance.now() + Date.now() for maximum uniqueness to prevent any key collisions
    const uniqueRunId = `${Date.now()}-${Math.floor(performance.now())}`;

    // Generate Users
    for (let i = 0; i < 20; i++) {
        const name = `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
        
        users.push({
            id: `st-user-${uniqueRunId}-${i}`,
            name,
            initials,
            role: Math.random() > 0.8 ? 'admin' : (Math.random() > 0.5 ? 'manager' : 'assistant'),
            email: `user_${uniqueRunId}_${i}@stress.test`
        });
    }

    // Generate Transactions (1000)
    for (let i = 0; i < 1000; i++) {
        const date = subDays(new Date(), Math.floor(Math.random() * 365));
        const isIncome = Math.random() > 0.4; // 60% are incomes
        const amount = Number((Math.random() * (isIncome ? 500 : 2000) + 20).toFixed(2));
        
        transactions.push({
            id: `st-tx-${uniqueRunId}-${i}`,
            amount,
            type: isIncome ? 'income' : 'expense',
            category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
            subcategory: 'Stress Test',
            description: `Transacción de prueba #${i}`,
            date
        });
    }

    // Generate Invoices (500)
    for (let i = 0; i < 500; i++) {
        const issueDate = subDays(new Date(), Math.floor(Math.random() * 365));
        const dueDate = addDays(issueDate, 30);
        const amount = Number((Math.random() * 3000 + 100).toFixed(2));
        const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)];
        
        const statuses: InvoiceStatus[] = ['paid', 'approved', 'pending_approval', 'rejected'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        invoices.push({
            id: `st-inv-${uniqueRunId}-${i}`,
            fileName: `stress_invoice_${i}.pdf`,
            provider,
            invoiceNumber: `F${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 10000)}`,
            issueDate: format(issueDate, 'yyyy-MM-dd'),
            dueDate: format(dueDate, 'yyyy-MM-dd'),
            description: `Factura de prueba ${provider}`,
            location: Math.random() > 0.5 ? 'Principal' : 'Norte',
            subtotal: Number((amount / 1.18).toFixed(2)),
            igv: Number((amount - (amount / 1.18)).toFixed(2)),
            total: amount,
            status
        });
    }

    return { transactions, invoices, users };
};