import { Button } from '../components/ui/button';

type Props = {
  moduleLabel?: string;
  path?: string;
  onGoHome: () => void;
};

/** Ruta válida a la que el usuario no tiene permiso (menú BD). */
export function AccessDeniedPage({ moduleLabel, path, onGoHome }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center shadow-lg"
        style={{
          background: 'var(--card)',
          borderColor: 'rgba(244, 63, 94, 0.35)',
        }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
          <i className="fa-solid fa-lock text-2xl" aria-hidden />
        </div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-400/80">Acceso denegado</p>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Sin permiso</h1>
        <p className="mb-1 text-sm text-muted-foreground">
          No tienes acceso a esta sección.
          {moduleLabel ? (
            <>
              {' '}
              Se requiere el módulo <span className="font-semibold text-foreground">{moduleLabel}</span>.
            </>
          ) : null}
        </p>
        <p className="mb-1 text-sm text-muted-foreground">
          Si crees que es un error, pide a un administrador que te asigne el menú correspondiente.
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
