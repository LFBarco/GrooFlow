import { AlertTriangle, Clock, Mail, MapPin, Phone, User } from 'lucide-react';

import type { AsistenciaStaffLiveState } from '../../types/asistencia';
import { ASISTENCIA_LIVE_STATUS_LABELS } from '../../types/asistencia';
import type { BukDashboardRow } from '../../utils/asistenciaBukDashboard';
import { shiftLabelForStaff } from '../../utils/asistenciaShift';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { STATUS_DOT } from './asistenciaLiveUi';

const STATUS_BADGE: Record<string, string> = {
  trabajando: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
  presente: 'bg-slate-200 text-slate-800 dark:bg-slate-600/30 dark:text-slate-100',
  tarde: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  ausente: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  live?: AsistenciaStaffLiveState | null;
  bukRow?: BukDashboardRow | null;
  viewDate?: Date;
};

export function AsistenciaStaffDetailDialog({
  open,
  onOpenChange,
  live,
  bukRow,
  viewDate,
}: Props) {
  if (!live && !bukRow) return null;

  const staff = live?.staff;
  const name = staff?.fullName ?? `${bukRow?.nombre ?? ''} ${bukRow?.apellidos ?? ''}`.trim();
  const status = live?.status;
  const cargo = staff?.cargoLabel ?? bukRow?.especialidad ?? '—';
  const sede = staff?.sedeName ?? '—';
  const rut = staff?.rut ?? bukRow?.rut ?? '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {name || 'Colaborador'}
            {status ? (
              <Badge className={STATUS_BADGE[status] ?? ''}>
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                {ASISTENCIA_LIVE_STATUS_LABELS[status]}
              </Badge>
            ) : bukRow ? (
              <Badge className={bukRow.arrived ? STATUS_BADGE.trabajando : STATUS_BADGE.ausente}>
                {bukRow.arrived ? 'Con entrada Buk' : 'Sin entrada Buk'}
              </Badge>
            ) : null}
            {staff?.isCritical ? (
              <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                Crítico
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            {staff?.avatarUrl ? (
              <img src={staff.avatarUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted dark:bg-slate-800">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-foreground">{cargo}</p>
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {sede}
              </p>
              {staff && viewDate ? (
                <p className="text-xs text-indigo-600 dark:text-indigo-300">
                  {shiftLabelForStaff(staff, viewDate)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-xs text-muted-foreground">RUT</span>
              <br />
              <span className="font-mono text-xs">{rut}</span>
            </p>
            {live?.entradaFormat || bukRow?.entradaHora ? (
              <p>
                <span className="text-xs text-muted-foreground">Entrada</span>
                <br />
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {live?.entradaFormat ?? bukRow?.entradaHora}
                </span>
              </p>
            ) : null}
            {bukRow?.salidaHora ? (
              <p>
                <span className="text-xs text-muted-foreground">Salida Buk</span>
                <br />
                <span className="tabular-nums">{bukRow.salidaHora}</span>
              </p>
            ) : null}
            {staff?.expectedTime ? (
              <p>
                <span className="text-xs text-muted-foreground">Hora esperada</span>
                <br />
                {staff.expectedTime}
              </p>
            ) : null}
            {bukRow?.area ? (
              <p>
                <span className="text-xs text-muted-foreground">Área Buk</span>
                <br />
                {bukRow.area}
              </p>
            ) : null}
            {bukRow?.especialidad ? (
              <p>
                <span className="text-xs text-muted-foreground">Especialidad Buk</span>
                <br />
                {bukRow.especialidad}
              </p>
            ) : null}
            {staff?.email ? (
              <p className="sm:col-span-2">
                <span className="text-xs text-muted-foreground">Email</span>
                <br />
                <a href={`mailto:${staff.email}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="h-3.5 w-3.5" />
                  {staff.email}
                </a>
              </p>
            ) : null}
            {staff?.phone ? (
              <p>
                <span className="text-xs text-muted-foreground">Teléfono</span>
                <br />
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {staff.phone}
                </span>
              </p>
            ) : null}
          </div>

          {live?.statusNote ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
              {live.statusNote}
            </div>
          ) : null}

          {live?.matchHint ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              <p className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Diagnóstico cruce Buk
              </p>
              {live.matchHint}
            </div>
          ) : null}

          {bukRow && !live ? (
            <p className="text-xs text-muted-foreground">
              Registro solo en Buk — no vinculado al organigrama operativo de esta sede.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
