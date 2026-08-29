import { cn } from '../ui/utils';

type PartCount = { part: string; count: number };

/** Zonas corporales mapeadas a coordenadas SVG simplificadas. */
const BODY_ZONES: Array<{
  part: string;
  cx: number;
  cy: number;
  r: number;
  label: string;
}> = [
  { part: 'Cabeza', cx: 100, cy: 28, r: 18, label: 'Cabeza' },
  { part: 'Ojos', cx: 100, cy: 32, r: 10, label: 'Ojos' },
  { part: 'Cara', cx: 100, cy: 38, r: 12, label: 'Cara' },
  { part: 'Cuello', cx: 100, cy: 52, r: 8, label: 'Cuello' },
  { part: 'Hombro derecho', cx: 72, cy: 68, r: 12, label: 'Hombro D' },
  { part: 'Hombro izquierdo', cx: 128, cy: 68, r: 12, label: 'Hombro I' },
  { part: 'Brazo derecho', cx: 58, cy: 95, r: 14, label: 'Brazo D' },
  { part: 'Brazo izquierdo', cx: 142, cy: 95, r: 14, label: 'Brazo I' },
  { part: 'Mano derecha', cx: 48, cy: 125, r: 10, label: 'Mano D' },
  { part: 'Mano izquierda', cx: 152, cy: 125, r: 10, label: 'Mano I' },
  { part: 'Tórax', cx: 100, cy: 85, r: 20, label: 'Tórax' },
  { part: 'Espalda', cx: 100, cy: 85, r: 18, label: 'Espalda' },
  { part: 'Abdomen', cx: 100, cy: 115, r: 16, label: 'Abdomen' },
  { part: 'Cadera', cx: 100, cy: 135, r: 14, label: 'Cadera' },
  { part: 'Pierna derecha', cx: 88, cy: 175, r: 14, label: 'Pierna D' },
  { part: 'Pierna izquierda', cx: 112, cy: 175, r: 14, label: 'Pierna I' },
  { part: 'Rodilla derecha', cx: 86, cy: 205, r: 10, label: 'Rodilla D' },
  { part: 'Rodilla izquierda', cx: 114, cy: 205, r: 10, label: 'Rodilla I' },
  { part: 'Pie derecho', cx: 84, cy: 235, r: 10, label: 'Pie D' },
  { part: 'Pie izquierdo', cx: 116, cy: 235, r: 10, label: 'Pie I' },
];

function heatColor(count: number, max: number): string {
  if (count === 0) return 'rgba(148, 163, 184, 0.25)';
  const intensity = Math.min(1, count / Math.max(max, 1));
  if (intensity < 0.33) return 'rgba(251, 191, 36, 0.55)';
  if (intensity < 0.66) return 'rgba(249, 115, 22, 0.7)';
  return 'rgba(239, 68, 68, 0.85)';
}

type Props = {
  data: PartCount[];
  className?: string;
};

export function BodyHeatMap({ data, className }: Props) {
  const countMap = new Map(data.map((d) => [d.part, d.count]));
  const max = Math.max(1, ...data.map((d) => d.count));
  const multiple = countMap.get('Múltiples zonas') ?? 0;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 dark:border-slate-700', className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Mapa de calor corporal</h3>
        <p className="text-xs text-muted-foreground">Frecuencia por parte del cuerpo afectada</p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <svg viewBox="0 0 200 260" className="h-[280px] w-[200px] shrink-0">
          <ellipse cx="100" cy="130" rx="55" ry="110" fill="rgba(148,163,184,0.08)" />
          {BODY_ZONES.map((zone) => {
            const count = countMap.get(zone.part) ?? 0;
            return (
              <g key={zone.part}>
                <circle
                  cx={zone.cx}
                  cy={zone.cy}
                  r={zone.r}
                  fill={heatColor(count, max)}
                  stroke={count > 0 ? 'rgba(239,68,68,0.5)' : 'rgba(148,163,184,0.3)'}
                  strokeWidth={1}
                />
                {count > 0 ? (
                  <text
                    x={zone.cx}
                    y={zone.cy + 4}
                    textAnchor="middle"
                    className="fill-slate-900 text-[9px] font-bold dark:fill-white"
                  >
                    {count}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <div className="flex-1 space-y-2 text-xs">
          {data.length === 0 ? (
            <p className="text-muted-foreground">Sin incidentes en el periodo filtrado.</p>
          ) : (
            data.slice(0, 8).map((d) => (
              <div key={d.part} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{d.part}</span>
                <span className="font-semibold tabular-nums">{d.count}</span>
              </div>
            ))
          )}
          {multiple > 0 ? (
            <p className="text-amber-700 dark:text-amber-300">
              Múltiples zonas: {multiple} registro{multiple === 1 ? '' : 's'}
            </p>
          ) : null}
          <div className="flex items-center gap-2 pt-2">
            <span className="h-3 w-3 rounded-full bg-amber-300" /> Bajo
            <span className="h-3 w-3 rounded-full bg-orange-500" /> Medio
            <span className="h-3 w-3 rounded-full bg-red-500" /> Alto
          </div>
        </div>
      </div>
    </div>
  );
}
