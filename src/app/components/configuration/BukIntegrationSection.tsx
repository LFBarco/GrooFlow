import type { SystemSettings } from '../../types';
import type { BukApiEndpointConfig } from '../../types/asistencia';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { patchAsistenciaSettings } from '../../utils/asistenciaPersistence';
import { BukAsistenciaIntegrationSection } from './BukAsistenciaIntegrationSection';
import { BukEndpointsExplorer } from './BukEndpointsExplorer';

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

/**
 * Apartado unificado de integración Buk (Ctrlit): credenciales, asistencia y explorador de APIs.
 */
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold">Integración Buk (Ctrlit)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Un solo token y URL base para todos los endpoints. Configura asistencia y explora otras APIs
          para identificar campos útiles.
        </p>
      </div>

      <BukAsistenciaIntegrationSection {...props} />

      <BukEndpointsExplorer
        baseUrl={buk.apiBaseUrl ?? 'https://app.ctrlit.cl/ctrl/api/v2'}
        apiToken={buk.apiToken ?? ''}
        endpoints={endpoints}
        readOnly={props.readOnly}
        onChangeEndpoints={patchEndpoints}
      />
    </div>
  );
}
