/**
 * Panel de ayuda contextual para la flota — visible solo en el Dashboard principal.
 */
import { useMemo, type ComponentType, type CSSProperties } from 'react';
import { Sparkles, Truck, AlertTriangle, Wrench, Fuel, ClipboardCheck, ArrowRight } from 'lucide-react';

import type { FleetDataset } from '../../types/fleet';
import { buildFleetAlerts, computeFleetKpis, monthlyCostsSeries } from '../../utils/fleetData';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { useModuleSurfaces } from '../../utils/moduleSurfaces';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export interface FleetDecisionAssistantProps {
  dataset: FleetDataset;
  onOpenFleet?: () => void;
}

export function FleetDecisionAssistant({ dataset, onOpenFleet }: FleetDecisionAssistantProps) {
  const s = useModuleSurfaces();
  const a = s.assistant;
  const kpis = useMemo(() => computeFleetKpis(dataset), [dataset]);
  const alerts = useMemo(() => buildFleetAlerts(dataset), [dataset]);
  const costSeries = useMemo(() => monthlyCostsSeries(dataset, 3), [dataset]);

  const critical = alerts.filter((al) => al.severity === 'critical');
  const warnings = alerts.filter((al) => al.severity === 'warning');
  const topAlerts = [...critical, ...warnings].slice(0, 4);

  const monthFuelCost = costSeries.length
    ? costSeries[costSeries.length - 1].fuel + costSeries[costSeries.length - 1].maintenance
    : 0;

  const bullets = useMemo(() => {
    const crit = alerts.filter((al) => al.severity === 'critical');
    const warn = alerts.filter((al) => al.severity === 'warning');
    const out: string[] = [];
    if (kpis.total === 0) {
      out.push('Aún no hay vehículos registrados. Carga la flota en Gestión vehicular para activar alertas y KPIs.');
      return out;
    }
    const firstCrit = crit[0];
    if (crit.length > 0 && firstCrit) {
      out.push(
        `Hay ${crit.length} alerta(s) crítica(s) (SOAT, revisión técnica o servicio). Prioriza la unidad ${firstCrit.plate ?? ''} y bloquea salidas si corresponde.`.trim()
      );
    } else if (warn.length > 0) {
      out.push(`Programa ${warn.length} advertencia(s) en los próximos días antes de que pasen a críticas.`);
    }
    if (kpis.maintenance > 0) {
      out.push(`${kpis.maintenance} unidad(es) en mantenimiento · verifica calendario y repuestos.`);
    }
    if (kpis.available <= 1 && kpis.total > 2) {
      out.push('Disponibilidad baja: redistribuye rutas caninas o aplaza trayectos no urgentes.');
    }
    const lastCompliance = [...dataset.vehicles]
      .filter((v) => typeof v.lastInspectionCompliance === 'number')
      .sort((b, c) => (c.lastInspectionCompliance ?? 0) - (b.lastInspectionCompliance ?? 0))[0];
    if (lastCompliance && (lastCompliance.lastInspectionCompliance ?? 100) < 70) {
      out.push(`Checklist pendiente en ${lastCompliance.plate}: refuerza inspección antes de salida (${lastCompliance.lastInspectionCompliance}%).`);
    }
    if (monthFuelCost > 0) {
      out.push(`Últimos meses operativos: costo combustible + taller ≈ ${formatCurrencyEs(monthFuelCost, 0)} · revisa consumo L/100 km.`);
    }
    if (out.length === 0) {
      out.push('Sin alertas destacadas · mantén el ritmo de inspecciones y registros de combustible.');
    }
    return out;
  }, [alerts, kpis, monthFuelCost, dataset.vehicles]);

  return (
    <div
      className={`rounded-2xl p-5 space-y-4 ${s.isDark ? '' : 'gf-glass-card'}`}
      style={{
        background: a.background,
        border: a.border,
        boxShadow: a.boxShadow,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="p-2.5 rounded-xl shrink-0"
            style={{
              background: s.isDark ? 'rgba(52,211,153,0.12)' : 'rgba(16,185,129,0.14)',
              border: s.isDark ? '1px solid rgba(52,211,153,0.28)' : '1px solid rgba(16,185,129,0.32)',
              boxShadow: s.isDark ? '0 0 20px rgba(52,211,153,0.15)' : '0 8px 20px -10px rgba(16,185,129,0.35)',
            }}
          >
            <Sparkles
              className={`w-6 h-6 ${s.isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
              style={s.isDark ? { filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.5))' } : undefined}
            />
          </div>
          <div>
            <h3 className="text-base font-bold flex items-center gap-2 flex-wrap" style={{ color: a.title }}>
              Asistente de decisiones
              <Badge
                variant="outline"
                className={
                  s.isDark
                    ? 'text-[10px] border-emerald-500/40 text-emerald-300/95 bg-emerald-500/10'
                    : 'text-[10px] border-emerald-600/35 text-emerald-700 bg-emerald-50'
                }
              >
                Flota clínica
              </Badge>
            </h3>
            <p className="text-xs mt-0.5" style={{ color: a.subtitle }}>
              Resumen ejecutivo para priorizar movilidad hoy · no sustituye el módulo de gestión vehicular.
            </p>
          </div>
        </div>
        {onOpenFleet && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={
              s.isDark
                ? 'border-emerald-500/35 text-emerald-200 hover:bg-emerald-500/10 shrink-0'
                : 'border-emerald-600/35 text-emerald-700 hover:bg-emerald-50 shrink-0'
            }
            onClick={onOpenFleet}
          >
            Ir a Gestión vehicular
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniStat
          icon={Truck}
          label="Flota"
          value={`${kpis.total}`}
          sub="vehículos"
          accent={s.isDark ? 'rgba(129,230,217,0.9)' : '#0f766e'}
          surfaces={a}
        />
        <MiniStat
          icon={AlertTriangle}
          label="Alertas"
          value={`${critical.length + warnings.length}`}
          sub={`${critical.length} crít.`}
          accent={s.isDark ? 'rgba(251,191,36,0.95)' : '#b45309'}
          surfaces={a}
        />
        <MiniStat
          icon={Wrench}
          label="En taller"
          value={`${kpis.maintenance}`}
          sub="unidades"
          accent={s.isDark ? 'rgba(251,146,60,0.9)' : '#c2410c'}
          surfaces={a}
        />
        <MiniStat
          icon={Fuel}
          label="Mes (comb.)"
          value={`${kpis.monthFuelLiters.toFixed(0)} L`}
          sub="consumo"
          accent={s.isDark ? 'rgba(96,165,250,0.95)' : '#1d4ed8'}
          surfaces={a}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: a.innerBg, border: a.innerBorder }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: a.label }}>
            <ClipboardCheck className="w-3.5 h-3.5" />
            Sugerencias
          </p>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: a.body }}>
                <span className={s.isDark ? 'text-emerald-400 shrink-0' : 'text-emerald-600 shrink-0'}>•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: a.innerBg, border: a.innerBorder }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: a.label }}>
            Próximas prioridades ({topAlerts.length || 'sin'})
          </p>
          {topAlerts.length === 0 ? (
            <p className="text-xs" style={{ color: a.subtitle }}>
              Sin alertas de severidad alta en este momento.
            </p>
          ) : (
            <ul className="space-y-2">
              {topAlerts.map((al) => (
                <li
                  key={al.id}
                  className="text-xs rounded-lg p-2.5"
                  style={{
                    background: s.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                    border: `1px solid ${al.severity === 'critical' ? 'rgba(251,113,133,0.22)' : 'rgba(251,191,36,0.22)'}`,
                  }}
                >
                  <div className="font-semibold flex items-center gap-2" style={{ color: a.value }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: al.severity === 'critical' ? '#fb7185' : '#fbbf24',
                        boxShadow: `0 0 8px ${al.severity === 'critical' ? '#fb7185' : '#fbbf24'}`,
                      }}
                    />
                    {al.title}
                    {al.plate && (
                      <span className="font-mono text-[10px] opacity-80" style={{ color: a.label }}>
                        {al.plate}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 leading-snug" style={{ color: s.isDark ? '#8b7cf8' : '#4f46e5' }}>
                    {al.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  surfaces: a,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  label: string;
  value: string;
  sub: string;
  accent: string;
  surfaces: {
    miniBg: string;
    miniBorder: string;
    label: string;
    value: string;
  };
}) {
  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-2"
      style={{ background: a.miniBg, border: a.miniBorder }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: a.label }}>
          {label}
        </p>
        <p className="text-sm font-bold font-mono truncate" style={{ color: a.value }}>
          {value}
        </p>
        <p className="text-[9px] truncate" style={{ color: accent, opacity: 0.85 }}>
          {sub}
        </p>
      </div>
    </div>
  );
}
