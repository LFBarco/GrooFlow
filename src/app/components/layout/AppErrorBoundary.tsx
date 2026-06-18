import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '../ui/button';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[GrooFlow] Error de interfaz:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(180deg, #0D0B1E 0%, #090718 100%)' }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(251,113,133,0.35)',
          }}
        >
          <AlertTriangle className="h-12 w-12 mx-auto text-rose-400" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Algo salió mal</h1>
            <p className="text-sm text-white/60">
              La aplicación encontró un error inesperado. Tus datos guardados en la nube no se
              pierden; recarga la página para continuar.
            </p>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre
              className="text-left text-[11px] text-rose-200/80 overflow-auto max-h-32 p-3 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.35)' }}
            >
              {this.state.error.message}
            </pre>
          )}
          <Button
            type="button"
            onClick={this.handleReload}
            className="w-full gap-2"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)' }}
          >
            <RefreshCw className="h-4 w-4" />
            Recargar GrooFlow
          </Button>
        </div>
      </div>
    );
  }
}
