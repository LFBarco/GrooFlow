import type { FleetDataset } from '../types/fleet';
import { mergeFleetKvAndSql } from './fleetKvPayload';

/** Combina snapshot remoto (SQL/Realtime) con estado local sin perder borrados recientes. */
export function mergeFleetRemoteIntoLocal(
  local: FleetDataset,
  remote: FleetDataset
): FleetDataset {
  return mergeFleetKvAndSql(local, remote);
}
