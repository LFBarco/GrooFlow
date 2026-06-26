import type { CanonicalMovement, ReconciliationSourceType } from '../domain/types';

export type ConnectorParseResult = {
  movements: Omit<CanonicalMovement, 'id' | 'batchId' | 'sessionId' | 'workflowStatus' | 'ruleCodes' | 'matchId'>[];
  errors: string[];
  skipped: number;
};

export interface ReconciliationConnector {
  readonly sourceType: ReconciliationSourceType;
  readonly label: string;
  readonly acceptedExtensions: string[];
  parseRows(rows: Record<string, unknown>[], context: ConnectorContext): ConnectorParseResult;
}

export type ConnectorContext = {
  sessionId: string;
  fileName: string;
  importedBy?: string;
  /** Solo ingresos (montos positivos) en extractos bancarios. */
  creditsOnly?: boolean;
};
