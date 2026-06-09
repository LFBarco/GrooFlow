import type {
  InventoryEquipmentCategory,
  InventoryEquipmentStatus,
  InventoryMaintenanceStatus,
} from '../../types/inventory';
import {
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_STATUS_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from '../../utils/inventoryData';
import { Badge } from '../ui/badge';

const CATEGORY_STYLES: Record<InventoryEquipmentCategory, string> = {
  imagen: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  anestesia: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  laboratorio: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  monitoreo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  cirugia: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  operativo: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  otros: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_STYLES: Record<InventoryEquipmentStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300',
  critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300',
  inactive: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
};

const MAINT_STATUS_STYLES: Record<InventoryMaintenanceStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export function CategoryBadge({ category }: { category: InventoryEquipmentCategory }) {
  return (
    <Badge variant="outline" className={`border-0 font-medium ${CATEGORY_STYLES[category]}`}>
      {INVENTORY_CATEGORY_LABELS[category]}
    </Badge>
  );
}

export function EquipmentStatusBadge({ status }: { status: InventoryEquipmentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'active'
            ? 'bg-emerald-500'
            : status === 'maintenance'
              ? 'bg-amber-500'
              : status === 'critical'
                ? 'bg-red-500'
                : 'bg-slate-400'
        }`}
      />
      {INVENTORY_STATUS_LABELS[status]}
    </span>
  );
}

export function MaintenanceStatusBadge({ status }: { status: InventoryMaintenanceStatus }) {
  return (
    <Badge variant="outline" className={`border-0 ${MAINT_STATUS_STYLES[status]}`}>
      {MAINTENANCE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function UsefulLifeBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <span className="text-xs font-medium tabular-nums w-8">{p}%</span>
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${p > 40 ? 'bg-emerald-500' : p > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
