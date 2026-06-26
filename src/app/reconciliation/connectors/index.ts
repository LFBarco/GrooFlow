import { bcpBankConnector } from './bcpBankConnector';
import { mercadoPagoConnector } from './mercadoPagoConnector';
import { niubizConnector } from './niubizConnector';
import { salesExcelConnector } from './salesExcelConnector';
import type { ReconciliationConnector } from './types';
import type { ReconciliationSourceType } from '../domain/types';

export const RECONCILIATION_CONNECTORS: ReconciliationConnector[] = [
  bcpBankConnector,
  mercadoPagoConnector,
  niubizConnector,
  salesExcelConnector,
];

export function getConnectorBySource(source: ReconciliationSourceType): ReconciliationConnector {
  const found = RECONCILIATION_CONNECTORS.find((c) => c.sourceType === source);
  if (!found) throw new Error(`Conector no registrado: ${source}`);
  return found;
}
