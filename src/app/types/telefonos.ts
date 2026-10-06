export type TelefonoTipo = 'persona' | 'bot' | 'especial' | 'sin_asignar';
export type TelefonoEstado = 'activo' | 'suspendido' | 'baja';

export type TelefonoColaborador = {
  nombreCompleto: string;
  nombres: string | null;
  apellidos: string | null;
  cargo: string | null;
  area: string | null;
  sede: string | null;
  activo: boolean;
};

export type Telefono = {
  id: string;
  numero: string;
  tipo: TelefonoTipo;
  bukId: number | null;
  /** Uso del número cuando no es una persona (ej. «Bot WhatsApp citas»). */
  etiqueta: string | null;
  responsable: string | null;
  operador: string | null;
  plan: string | null;
  costoMensual: number | null;
  equipo: string | null;
  imei: string | null;
  iccid: string | null;
  estado: TelefonoEstado;
  notas: string | null;
  colaborador: TelefonoColaborador | null;
  updatedAt: string;
};

export type ColaboradorBuk = {
  bukId: number;
  nombreCompleto: string;
  nombres: string | null;
  apellidos: string | null;
  documento: string | null;
  cargo: string | null;
  area: string | null;
  sede: string | null;
  telefono: string | null;
};

export type TelefonosCapabilities = {
  agregar: boolean;
  editar: boolean;
  eliminar: boolean;
  exportar: boolean;
};

export type TelefonosResponse = {
  items: Telefono[];
  colaboradores: ColaboradorBuk[];
  capabilities: TelefonosCapabilities;
};

export type TelefonoDraft = {
  numero: string;
  tipo: TelefonoTipo;
  bukId: number | null;
  etiqueta: string;
  responsable: string;
  operador: string;
  plan: string;
  costoMensual: string;
  equipo: string;
  imei: string;
  iccid: string;
  estado: TelefonoEstado;
  notas: string;
};

/** Fila leída del Excel del operador. */
export type TelefonoImportRow = {
  numero: string;
  operador?: string;
  plan?: string;
  costoMensual?: string;
  equipo?: string;
  imei?: string;
  iccid?: string;
  nombre?: string;
};

export type TelefonoImportResult = {
  creados: number;
  actualizados: number;
  vinculados: number;
  omitidos: string[];
};
