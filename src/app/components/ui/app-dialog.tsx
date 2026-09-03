import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { buttonVariants } from './button';
import { cn } from './utils';

export type AppConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
};

type DialogMode = 'confirm' | 'alert';

type DialogRequest = {
  mode: DialogMode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'destructive';
  resolve: (value: boolean) => void;
};

type AppDialogApi = {
  confirm: (message: string, options?: AppConfirmOptions) => Promise<boolean>;
  alert: (message: string, options?: Omit<AppConfirmOptions, 'cancelLabel' | 'variant'>) => Promise<void>;
};

const AppDialogContext = createContext<AppDialogApi | null>(null);

let hostApi: AppDialogApi | null = null;

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const queueRef = useRef<DialogRequest[]>([]);
  const activeRef = useRef<DialogRequest | null>(null);

  const closeWith = useCallback((value: boolean) => {
    const current = activeRef.current;
    if (current) {
      current.resolve(value);
      activeRef.current = null;
    }
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setRequest(next);
  }, []);

  const enqueue = useCallback((item: DialogRequest) => {
    if (activeRef.current) {
      queueRef.current.push(item);
      return;
    }
    activeRef.current = item;
    setRequest(item);
  }, []);

  const api = useMemo<AppDialogApi>(
    () => ({
      confirm: (message, options) =>
        new Promise<boolean>((resolve) => {
          enqueue({
            mode: 'confirm',
            title: options?.title?.trim() || 'Confirmar',
            description: (options?.description ?? message).trim(),
            confirmLabel: options?.confirmLabel ?? 'Aceptar',
            cancelLabel: options?.cancelLabel ?? 'Cancelar',
            variant: options?.variant ?? 'destructive',
            resolve,
          });
        }),
      alert: (message, options) =>
        new Promise<void>((resolve) => {
          enqueue({
            mode: 'alert',
            title: options?.title?.trim() || 'Aviso',
            description: options?.description ?? message,
            confirmLabel: options?.confirmLabel ?? 'Entendido',
            cancelLabel: '',
            variant: 'default',
            resolve: (ok) => {
              if (ok) resolve();
              else resolve();
            },
          });
        }),
    }),
    [enqueue]
  );

  hostApi = api;

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      <AlertDialog
        open={!!request}
        onOpenChange={(open) => {
          if (!open) closeWith(false);
        }}
      >
        <AlertDialogContent className="rounded-2xl border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description ? (
              <AlertDialogDescription className="whitespace-pre-wrap">
                {request.description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {request?.mode === 'confirm' ? (
              <AlertDialogCancel
                onClick={(e) => {
                  e.preventDefault();
                  closeWith(false);
                }}
              >
                {request.cancelLabel}
              </AlertDialogCancel>
            ) : null}
            <AlertDialogAction
              className={cn(
                request?.variant === 'destructive' && request.mode === 'confirm'
                  ? buttonVariants({ variant: 'destructive' })
                  : undefined
              )}
              onClick={(e) => {
                e.preventDefault();
                closeWith(true);
              }}
            >
              {request?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogApi {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog debe usarse dentro de AppDialogProvider');
  }
  return ctx;
}

export function appConfirm(message: string, options?: AppConfirmOptions): Promise<boolean> {
  if (hostApi) return hostApi.confirm(message, options);
  return Promise.resolve(window.confirm(message));
}

export function appAlert(
  message: string,
  options?: Omit<AppConfirmOptions, 'cancelLabel' | 'variant'>
): Promise<void> {
  if (hostApi) return hostApi.alert(message, options);
  window.alert(message);
  return Promise.resolve();
}
