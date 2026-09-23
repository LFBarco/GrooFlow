import type { BukAsistenciaRecord } from '../types/asistencia';

/** Formato Ctrlit: DD-MM-YYYY. */
export function formatCtrlitDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Ventana incremental diaria (máx. 35 días en la API).
 * Por defecto: hoy − lookbackDays … hoy.
 */
export function incrementalAsistenciaDateRange(
  now = new Date(),
  lookbackDays = 2
): { desde: string; hasta: string; fromYmd: string; toYmd: string } {
  const days = Math.max(0, Math.min(34, lookbackDays));
  const hasta = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - days);
  const toYmd = [
    hasta.getFullYear(),
    String(hasta.getMonth() + 1).padStart(2, '0'),
    String(hasta.getDate()).padStart(2, '0'),
  ].join('-');
  const fromYmd = [
    desde.getFullYear(),
    String(desde.getMonth() + 1).padStart(2, '0'),
    String(desde.getDate()).padStart(2, '0'),
  ].join('-');
  return {
    desde: formatCtrlitDate(desde),
    hasta: formatCtrlitDate(hasta),
    fromYmd,
    toYmd,
  };
}

/** ID huellero/recinto: obra_id o id_recinto. */
export function bukHuelleroId(r: Pick<BukAsistenciaRecord, 'obra_id' | 'id_recinto'>): number | undefined {
  const n = Number(r.obra_id ?? r.id_recinto ?? 0);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Normaliza marcación Ctrlit: asegura obra_id / id_recinto / codigo_recinto
 * para mapear sede por ID de huellero.
 */
export function normalizeBukAsistenciaRecord(
  raw: BukAsistenciaRecord | Record<string, unknown>
): BukAsistenciaRecord {
  const r = raw as BukAsistenciaRecord & Record<string, unknown>;
  const obraRaw = r.obra_id ?? r.id_recinto ?? (r as { obraId?: number }).obraId;
  const obra = Number(obraRaw);
  const obraId = Number.isFinite(obra) && obra > 0 ? obra : undefined;
  const codigo =
    String(r.codigo_recinto ?? '').trim() ||
    (obraId != null ? String(obraId) : undefined);
  const rut =
    String(r.rut_trabajador ?? r.DNI ?? r.dni ?? '').trim() ||
    String(r.rut_trabajador ?? '');

  return {
    ...(r as BukAsistenciaRecord),
    id: Number(r.id) || (obraId ? Number(`${obraId}${String(rut).slice(-6)}`) || 0 : 0),
    trab_id: Number(r.trab_id) || 0,
    rut_trabajador: rut,
    nombre: String(r.nombre ?? ''),
    obra_id: obraId,
    id_recinto: r.id_recinto != null ? Number(r.id_recinto) || obraId : obraId,
    codigo_recinto: codigo,
    nombre_recinto: r.nombre_recinto ? String(r.nombre_recinto) : r.nombre_recinto,
  };
}

export function normalizeBukAsistenciaRecords(
  records: Array<BukAsistenciaRecord | Record<string, unknown>>
): BukAsistenciaRecord[] {
  return records.map((r) => normalizeBukAsistenciaRecord(r));
}

/** Punch crudo de GET /obtenerRegistroAsistencia. */
export type BukRegistroAsistenciaPunch = {
  obra_id?: number;
  DNI?: string | number;
  dni?: string | number;
  ano?: number;
  mes?: number;
  dia?: number;
  hora?: number;
  minutos?: number;
  segundos?: number;
  sentido?: string;
  dispositivo?: string;
  origen?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Agrupa punches de obtenerRegistroAsistencia → jornada diaria
 * (entrada = primera marca entrada; salida = última marca salida).
 */
export function aggregateRegistroAsistenciaPunches(
  punches: BukRegistroAsistenciaPunch[]
): BukAsistenciaRecord[] {
  type Acc = {
    obra_id: number;
    dni: string;
    ymd: string;
    dia_entrada: string;
    entradaIso?: string;
    salidaIso?: string;
    dispositivo?: string;
  };
  const byKey = new Map<string, Acc>();

  for (const p of punches) {
    const obra = Number(p.obra_id ?? 0);
    const dni = String(p.DNI ?? p.dni ?? '').replace(/\D+/g, '');
    const ano = Number(p.ano);
    const mes = Number(p.mes);
    const dia = Number(p.dia);
    if (!obra || !dni || !ano || !mes || !dia) continue;

    const ymd = `${ano}-${pad2(mes)}-${pad2(dia)}`;
    const diaEntrada = `${pad2(dia)}/${pad2(mes)}/${ano}`;
    const hh = Number(p.hora ?? 0);
    const mm = Number(p.minutos ?? 0);
    const ss = Number(p.segundos ?? 0);
    const iso = `${ymd}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
    const sentido = String(p.sentido ?? '').toLowerCase();
    const key = `${obra}|${dni}|${ymd}`;

    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        obra_id: obra,
        dni,
        ymd,
        dia_entrada: diaEntrada,
        dispositivo: p.dispositivo ? String(p.dispositivo) : undefined,
      };
      byKey.set(key, acc);
    }

    if (sentido === 'entrada') {
      if (!acc.entradaIso || iso < acc.entradaIso) acc.entradaIso = iso;
    } else if (sentido === 'salida') {
      if (!acc.salidaIso || iso > acc.salidaIso) acc.salidaIso = iso;
    } else if (!acc.entradaIso) {
      // Marca sin sentido: primera como entrada, posteriores como posible salida.
      acc.entradaIso = iso;
    } else if (!acc.salidaIso || iso > acc.salidaIso) {
      acc.salidaIso = iso;
    }
    if (p.dispositivo) acc.dispositivo = String(p.dispositivo);
  }

  const out: BukAsistenciaRecord[] = [];
  for (const acc of byKey.values()) {
    if (!acc.entradaIso && !acc.salidaIso) continue;
    const entrada = acc.entradaIso ?? null;
    const salida = acc.salidaIso ?? null;
    out.push(
      normalizeBukAsistenciaRecord({
        id: Number(`${acc.obra_id}${acc.dni.slice(-4)}${acc.ymd.replace(/-/g, '').slice(-4)}`) || acc.obra_id,
        trab_id: 0,
        rut_trabajador: acc.dni,
        nombre: '',
        obra_id: acc.obra_id,
        id_recinto: acc.obra_id,
        codigo_recinto: String(acc.obra_id),
        nombre_recinto: undefined,
        dia_entrada: acc.dia_entrada,
        entrada,
        salida,
        entrada_format: entrada ? entrada.slice(11, 16) : undefined,
        salida_format: salida ? salida.slice(11, 16) : undefined,
        dispositivo: acc.dispositivo,
      })
    );
  }
  return out;
}
