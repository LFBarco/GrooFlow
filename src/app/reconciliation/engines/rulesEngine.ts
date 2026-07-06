import { amountsEqual, operationMatchKey, operationNumbersMatch } from '../domain/normalize';
import {
  bankSalesAmountsMatch,
  isBankMovement,
  isSalesMovement,
  salesLinkedToBank,
} from '../domain/reconciliationGrouping';
import type {
  CanonicalMovement,
  PaymentMethodHint,
  ReconciliationAlert,
  ReconciliationDataset,
  ReconciliationRuleCode,
} from '../domain/types';
import { newId, sessionMovements } from '../domain/dataset';

const GATEWAY_METHOD: Record<string, PaymentMethodHint> = {
  mercado_pago: 'mercado_pago',
  niubiz: 'niubiz',
  bcp_bank: 'transfer_bcp',
};

const SUMMARY_SAMPLE_IDS = 40;

function pushAlert(
  alerts: ReconciliationAlert[],
  sessionId: string,
  ruleCode: ReconciliationRuleCode,
  severity: ReconciliationAlert['severity'],
  message: string,
  movementIds: string[]
) {
  const key = `${ruleCode}|${movementIds.sort().join(',')}`;
  if (alerts.some((a) => !a.resolved && `${a.ruleCode}|${a.movementIds.sort().join(',')}` === key)) {
    return;
  }
  alerts.push({
    id: newId('ra'),
    sessionId,
    ruleCode,
    severity,
    message,
    movementIds,
    resolved: false,
    createdAt: new Date().toISOString(),
  });
}

function pushSummaryAlert(
  alerts: ReconciliationAlert[],
  sessionId: string,
  ruleCode: ReconciliationRuleCode,
  severity: ReconciliationAlert['severity'],
  label: string,
  movementIds: string[]
) {
  if (movementIds.length === 0) return;
  const sample = movementIds.slice(0, SUMMARY_SAMPLE_IDS);
  const message =
    movementIds.length === 1
      ? `${label}: 1 movimiento — revisar pestaña Cruces.`
      : `${label}: ${movementIds.length} movimiento(s) — revisar pestaña Cruces (muestra ${sample.length}).`;
  pushAlert(alerts, sessionId, ruleCode, severity, message, sample);
}

export function applyPostMatchRules(dataset: ReconciliationDataset, sessionId?: string): ReconciliationDataset {
  const sid = sessionId ?? dataset.activeSessionId;
  const movements = sessionMovements(dataset, sid);
  const alerts = dataset.alerts.filter((a) => a.resolved || a.sessionId !== sid);
  const reconciledKeys = new Set(dataset.reconciledOperationKeys);
  const movementMap = new Map(movements.map((m) => [m.id, m]));

  const orphanBankIds: string[] = [];
  const orphanSalesIds: string[] = [];
  const partialIds: string[] = [];
  const overpayIds: string[] = [];
  const amountMismatchIds: string[] = [];
  const duplicateGroups: string[][] = [];

  const opIndex = new Map<string, CanonicalMovement[]>();
  for (const m of movements) {
    if (!m.operationNumber) continue;
    const key = m.operationNumber;
    const list = opIndex.get(key) ?? [];
    list.push(m);
    opIndex.set(key, list);
  }
  for (const group of opIndex.values()) {
    if (group.length > 1) {
      duplicateGroups.push(group.map((m) => m.id));
    }
  }

  const updatedMovements = movements.map((m) => {
    const rules = new Set(m.ruleCodes);

    if (m.workflowStatus !== 'reconciled') {
      if (m.side === 'bank_or_gateway' || m.sourceType !== 'sales_erp') {
        rules.add('RULE-002');
        orphanBankIds.push(m.id);
      } else {
        rules.add('RULE-003');
        orphanSalesIds.push(m.id);
      }
    }

    if (m.operationNumber) {
      const key = operationMatchKey(m.operationNumber, m.amount);
      if (reconciledKeys.has(key) && m.workflowStatus !== 'reconciled') {
        rules.add('RULE-004');
      }
    }

    if (m.side === 'sales_application' && m.saleAmount != null && !amountsEqual(m.saleAmount, m.amount)) {
      if (m.amount < m.saleAmount) {
        rules.add('RULE-007');
        partialIds.push(m.id);
        return { ...m, workflowStatus: 'difference' as const, ruleCodes: [...rules] };
      }
      if (m.amount > m.saleAmount) {
        rules.add('RULE-008');
        overpayIds.push(m.id);
        return { ...m, workflowStatus: 'difference' as const, ruleCodes: [...rules] };
      }
    }

    if (m.workflowStatus === 'reconciled' && m.matchedMovementId) {
      const pair = movementMap.get(m.matchedMovementId);
      if (
        pair &&
        !operationNumbersMatch(
          m.operationNumberRaw || m.operationNumber,
          pair.operationNumberRaw || pair.operationNumber
        )
      ) {
        rules.add('RULE-005');
        amountMismatchIds.push(m.id);
        return {
          ...m,
          workflowStatus: 'difference' as const,
          ruleCodes: [...rules],
        };
      }

      const bank = isBankMovement(m) ? m : pair;
      const salesGroup =
        bank && isSalesMovement(m) && m.matchedMovementId === bank.id
          ? salesLinkedToBank(movements, bank.id)
          : bank
            ? salesLinkedToBank(movements, bank.id)
            : [];

      if (bank && salesGroup.length > 0) {
        if (!bankSalesAmountsMatch(bank, salesGroup)) {
          rules.add('RULE-005');
          amountMismatchIds.push(m.id);
          if (pair) amountMismatchIds.push(pair.id);
        }
      } else if (pair && !amountsEqual(m.amount, pair.amount)) {
        rules.add('RULE-005');
        amountMismatchIds.push(m.id);
      }

      const expectedMethod = GATEWAY_METHOD[m.sourceType];
      if (
        expectedMethod &&
        m.side === 'sales_application' &&
        m.paymentMethod !== expectedMethod &&
        m.paymentMethod !== 'unknown'
      ) {
        rules.add('RULE-006');
      }
    }

    return { ...m, ruleCodes: [...rules] };
  });

  pushSummaryAlert(
    alerts,
    sid,
    'RULE-002',
    'warning',
    'Banco/pasarela sin venta',
    orphanBankIds
  );
  pushSummaryAlert(
    alerts,
    sid,
    'RULE-003',
    'warning',
    'Venta sin movimiento bancario',
    orphanSalesIds
  );
  pushSummaryAlert(alerts, sid, 'RULE-007', 'info', 'Pago parcial detectado', partialIds);
  pushSummaryAlert(alerts, sid, 'RULE-008', 'warning', 'Sobrepago detectado', overpayIds);
  pushSummaryAlert(
    alerts,
    sid,
    'RULE-005',
    'warning',
    'Importe distinto en par conciliado',
    amountMismatchIds
  );

  for (const ids of duplicateGroups.slice(0, 20)) {
    pushAlert(
      alerts,
      sid,
      'RULE-004',
      'critical',
      `Código de operación duplicado (${ids.length} registros)`,
      ids.slice(0, SUMMARY_SAMPLE_IDS)
    );
  }

  const otherMovements = dataset.movements.filter((m) => m.sessionId !== sid);
  const newReconciledKeys = [...dataset.reconciledOperationKeys];
  for (const m of updatedMovements) {
    if (m.workflowStatus === 'reconciled' && m.operationNumber) {
      newReconciledKeys.push(operationMatchKey(m.operationNumber, m.amount));
    }
  }

  return {
    ...dataset,
    movements: [...otherMovements, ...updatedMovements],
    alerts,
    reconciledOperationKeys: [...new Set(newReconciledKeys)],
  };
}

export function detectCrossSourceMethodMismatches(
  dataset: ReconciliationDataset,
  sessionId?: string
): ReconciliationDataset {
  const sid = sessionId ?? dataset.activeSessionId;
  const movements = sessionMovements(dataset, sid);
  const alerts = [...dataset.alerts];
  const salesPending = movements.filter(
    (m) =>
      m.side === 'sales_application' &&
      m.workflowStatus !== 'reconciled' &&
      m.operationNumber &&
      m.paymentMethod !== 'unknown' &&
      m.paymentMethod !== 'mercado_pago' &&
      m.paymentMethod !== 'niubiz'
  );
  const bankAll = movements.filter((m) => isBankSide(m));

  const mpByOp = new Map<string, CanonicalMovement>();
  const niubizByOp = new Map<string, CanonicalMovement>();
  for (const b of bankAll) {
    if (!b.operationNumber) continue;
    if (b.sourceType === 'mercado_pago') mpByOp.set(b.operationNumber, b);
    if (b.sourceType === 'niubiz') niubizByOp.set(b.operationNumber, b);
  }

  const mismatchIds: string[] = [];
  for (const sales of salesPending) {
    const inMp = mpByOp.get(sales.operationNumber);
    const inNiubiz = niubizByOp.get(sales.operationNumber);
    if (inMp && amountsEqual(inMp.amount, sales.amount)) {
      mismatchIds.push(sales.id, inMp.id);
    } else if (inNiubiz && amountsEqual(inNiubiz.amount, sales.amount)) {
      mismatchIds.push(sales.id, inNiubiz.id);
    }
  }

  pushSummaryAlert(
    alerts,
    sid,
    'RULE-006',
    'warning',
    'Posible medio de pago incorrecto (coincide en otra pasarela)',
    [...new Set(mismatchIds)]
  );

  return { ...dataset, alerts };
}

function isBankSide(m: CanonicalMovement): boolean {
  return m.side === 'bank_or_gateway' || m.sourceType !== 'sales_erp';
}
