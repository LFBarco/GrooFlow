import type { SystemSettings } from '../../types';
import type { BukApiEndpointConfig } from '../../types/asistencia';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { patchAsistenciaSettings } from '../../utils/asistenciaPersistence';
import { BukAsistenciaIntegrationSection } from './BukAsistenciaIntegrationSection';
import { BukEndpointsExplorer } from './BukEndpointsExplorer';
import { BukPeIntegrationSection } from './BukPeIntegrationSection';

type Props = {
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (
    nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings)
  ) => void;
  onPersistSystemSettings?: (
    nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings),
    successMessage?: string
  ) => Promise<boolean>;
  onPersistAsistenciaSettings?: (
    updater: (prev: import('../../types/asistencia').AsistenciaSettings) => import('../../types/asistencia').AsistenciaSettings,
    successMessage?: string
  ) => Promise<boolean>;
  readOnly?: boolean;
};

/** Apartado unificado: Buk Asistencia (Ctrlit) + Buk.pe (RRHH). */
export function BukIntegrationSection(props: Props) {
  const asistencia = mergeAsistenciaSettings(props.systemSettings.asistencia);
  const buk = asistencia.buk ?? {};
  const endpoints = buk.catalogEndpoints ?? [];

  const patchEndpoints = (next: BukApiEndpointConfig[], message?: string) => {
    const apply = (prev: import('../../types/asistencia').AsistenciaSettings) =>
      patchAsistenciaSettings(prev, {
        buk: { ...mergeAsistenciaSettings(prev).buk, catalogEndpoints: next },
      });

    if (props.onPersistAsistenciaSettings) {
      void props.onPersistAsistenciaSettings(apply, message);
      return;
    }
    if (props.onPersistSystemSettings) {
      void props.onPersistSystemSettings(
        (prev) => ({ ...prev, asistencia: apply(mergeAsistenciaSettings(prev.asistencia)) }),
        message
      );
      return;
    }
    props.onUpdateSystemSettings((prev) => ({
      ...prev,
      asistencia: apply(mergeAsistenciaSettings(prev.asistencia)),
    }));
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold">Integraciones Buk</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Dos APIs distintas con el mismo proveedor: <strong>Ctrlit</strong> (marcaciones / asistencia) y{' '}
          <strong>Buk.pe</strong> (empleados / RRHH). Cada una tiene su URL base y token.
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Asistencia — Ctrlit
        </h4>
        <BukAsistenciaIntegrationSection {...props} />
        <BukEndpointsExplorer
          provider="ctrlit"
          baseUrl={buk.apiBaseUrl ?? 'https://app.ctrlit.cl/ctrl/api/v2'}
          apiToken={buk.apiToken ?? ''}
          endpoints={endpoints}
          readOnly={props.readOnly}
          onChangeEndpoints={patchEndpoints}
        />
      </div>

      <div className="space-y-2 border-t pt-6">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          RRHH — Buk.pe
        </h4>
        <BukPeIntegrationSection
          systemSettings={props.systemSettings}
          onUpdateSystemSettings={props.onUpdateSystemSettings}
          onPersistSystemSettings={props.onPersistSystemSettings}
          readOnly={props.readOnly}
        />
      </div>
    </div>
  );
}
