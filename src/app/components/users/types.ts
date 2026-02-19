
export interface Role {
    id: string;
    name: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    isSystem: boolean;
    permissions: Record<string, boolean>;
}

export const SYSTEM_MODULES = [
    'Dashboard',
    'Analítica',
    'Finanzas',
    'Cuentas por Pagar',
    'Caja Chica',
    'Compras',
    'Proveedores',
    'Reportes',
    'Auditoría',
    'Usuarios',
    'Configuración'
] as const;

export type ModuleName = typeof SYSTEM_MODULES[number];

export const DEFAULT_ROLES: Role[] = [
    {
        id: 'super_admin',
        name: 'Super Administrador',
        description: 'Acceso total al sistema sin restricciones',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        isSystem: true,
        permissions: {
            'Dashboard': true,
            'Analítica': true,
            'Finanzas': true,
            'Cuentas por Pagar': true,
            'Caja Chica': true,
            'Compras': true,
            'Proveedores': true,
            'Reportes': true,
            'Auditoría': true,
            'Usuarios': true,
            'Configuración': true
        }
    },
    {
        id: 'manager',
        name: 'Gerente',
        description: 'Acceso a reportes, finanzas y operaciones',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        isSystem: false,
        permissions: {
            'Dashboard': true,
            'Analítica': true,
            'Finanzas': true,
            'Cuentas por Pagar': true,
            'Caja Chica': true,
            'Compras': true,
            'Proveedores': true,
            'Reportes': true,
            'Auditoría': false,
            'Usuarios': false,
            'Configuración': false
        }
    },
    {
        id: 'groomer',
        name: 'Groomer',
        description: 'Acceso a citas y servicios',
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-50 dark:bg-teal-900/20',
        borderColor: 'border-teal-200 dark:border-teal-800',
        isSystem: false,
        permissions: {
            'Dashboard': true,
            'Analítica': false,
            'Finanzas': false,
            'Cuentas por Pagar': false,
            'Caja Chica': false,
            'Compras': false,
            'Proveedores': false,
            'Reportes': false,
            'Auditoría': false,
            'Usuarios': false,
            'Configuración': false
        }
    }
];

export const COLOR_OPTIONS = [
    { name: 'Rojo', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
    { name: 'Azul', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
    { name: 'Verde', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
    { name: 'Morado', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' },
    { name: 'Naranja', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
    { name: 'Rosa', text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800' },
    { name: 'Gris', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
    { name: 'Indigo', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800' },
    { name: 'Teal', text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800' },
    { name: 'Cyan', text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800' },
];
