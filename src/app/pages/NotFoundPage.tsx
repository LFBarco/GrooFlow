import { Button } from '../components/ui/button';

type Props = {
  path?: string;
  onGoHome: () => void;
};

/** Ruta que no existe en el catálogo de la app. */
export function NotFoundPage({ path, onGoHome }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center shadow-lg"
        style={{
          background: 'var(--card)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
        }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-500/15 text-slate-400">
          <i className="fa-solid fa-compass text-2xl" aria-hidden />
        </div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Error 404</p>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Página no encontrada</h1>
        <p className="mb-1 text-sm text-muted-foreground">
          La ruta que intentas abrir no existe en GrooFlow.
        </p>
        {path ? (
          <p className="mb-6 break-all font-mono text-xs text-slate-500">{path}</p>
        ) : (
          <div className="mb-6" />
        )}
        <Button type="button" className="w-full gap-2" onClick={onGoHome}>
          <i className="fa-solid fa-house" aria-hidden />
          Ir al inicio
        </Button>
      </div>
    </div>
  );
}
