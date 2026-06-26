import { amountsEqual, operationMatchKey } from '../domain/normalize';
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

export function applyPostMatchRules(dataset: ReconciliationDataset, sessionId?: string): ReconciliationDataset {
  const sid = sessionId ?? dataset.activeSessionId;
  const movements = sessionMovements(dataset, sid);
  const alerts = [...dataset.alerts];
  const reconciledKeys = new Set(dataset.reconciledOperationKeys);
  const movementMap = new Map(movements.map((m) => [m.id, m]));

  const updatedMovements = movements.map((m) => ({ ...m, ruleCodes: [...m.ruleCodes] }));

  const applyRules = (m: CanonicalMovement): CanonicalMovement => {
    const rules = new Set(m.ruleCodes);

    if (m.workflowStatus !== 'reconciled') {
      if (m.side === 'bank_or_gateway' || m.sourceType !== 'sales_erp') {
        rules.add('RULE-002');
        m = { ...m, workflowStatus: m.workflowStatus === 'imported' ? 'pending' : m.workflowStatus };
        pushAlert(
          alerts,
          sid,
          'RULE-002',
          'warning',
          `Movimiento banco/pasarela sin venta: S/ ${m.amount.toFixed(2)} (${m.operationNumberRaw || 'sin N°'})`,
          [m.id]
        );
      } else {
        rules.add('RULE-003');
        const slot = m.metadata?.erpOpCodeSlot;
        const needsBankAmount = m.metadata?.erpAmountFromBank === true;
        const message =
          needsBankAmount && typeof slot === 'number' && slot > 1
            ? `Cod. Op. Pago ${slot} sin medio en ERP (${m.documentNumber ?? 'doc'}) — cruce por N° ${m.operationNumberRaw || m.operationNumber || '—'}`
            : `Venta sin movimiento bancario: ${m.documentNumber ?? 'doc'} — S/ ${m.amount.toFixed(2)}`;
        pushAlert(
          alerts,
          sid,
          'RULE-003',
          needsBankAmount ? 'info' : 'warning',
          message,
          [m.id]
        );
      }
    }

    if (m.operationNumber) {
      const key = operationMatchKey(m.operationNumber, m.amount);
      const duplicates = updatedMovements.filter(
        (o) =>
          o.id !== m.id &&
          o.operationNumber === m.operationNumber &&
          amountsEqual(o.amount, m.amount)
      );
      if (duplicates.length > 0) {
        rules.add('RULE-004');
        pushAlert(
          alerts,
          sid,
          'RULE-004',
          'critical',
          `Código de operación duplicado: ${m.operationNumberRaw || m.operationNumber}`,
          [m.id, ...duplicates.map((d) => d.id)]
        );
      }
      if (reconciledKeys.has(key) && m.workflowStatus !== 'reconciled') {
        rules.add('RULE-004');
        pushAlert(
          alerts,
          sid,
          'RULE-004',
          'critical',
          `N° operación ya conciliado previamente: ${m.operationNumberRaw || m.operationNumber}`,
          [m.id]
        );
      }
    }

    if (m.side === 'sales_application' && m.saleAmount != null && !amountsEqual(m.saleAmount, m.amount)) {
      if (m.amount < m.saleAmount) {
        rules.add('RULE-007');
        m = { ...m, workflowStatus: 'difference' };
        pushAlert(
          alerts,
          sid,
          'RULE-007',
          'info',
          `Pago parcial en ${m.documentNumber ?? 'documento'}: venta S/ ${m.saleAmount.toFixed(2)}, pago S/ ${m.amount.toFixed(2)}`,
          [m.id]
        );
      } else if (m.amount > m.saleAmount) {
        rules.add('RULE-008');
        m = { ...m, workflowStatus: 'difference' };
        pushAlert(
          alerts,
          sid,
          'RULE-008',
          'warning',
          `Sobrepago en ${m.documentNumber ?? 'documento'}: venta S/ ${m.saleAmount.toFixed(2)}, pago S/ ${m.amount.toFixed(2)}`,
          [m.id]
        );
      }
    }

  if (m.workflowStatus === 'reconciled' && m.matchedMovementId) {
      const pair = movementMap.get(m.matchedMovementId);
      if (pair && !amountsEqual(m.amount, pair.amount)) {
        rules.add('RULE-005');
        pushAlert(
          alerts,
          sid,
          'RULE-005',
          'warning',
          `Importe distinto entre par conciliado: S/ ${m.amount.toFixed(2)} vs S/ ${pair.amount.toFixed(2)}`,
          [m.id, pair.id]
        );
      }
      const expectedMethod = GATEWAY_METHOD[m.sourceType];
      if (
        expectedMethod &&
        m.side === 'sales_application' &&
        m.paymentMethod !== expectedMethod &&
        m.paymentMethod !== 'unknown'
      ) {
        rules.add('RULE-006');
        pushAlert(
          alerts,
          sid,
          'RULE-006',
          'info',
          `Medio de pago distinto al esperado para la fuente emparejada (${m.documentNumber ?? m.id})`,
          [m.id, m.matchedMovementId]
        );
      }
    }

    return { ...m, ruleCodes: [...rules] };
  };

  const nextSessionMovements = updatedMovements.map(applyRules);

  const otherMovements = dataset.movements.filter((m) => m.sessionId !== sid);
  const newReconciledKeys = [...dataset.reconciledOperationKeys];
  for (const m of nextSessionMovements) {
    if (m.workflowStatus === 'reconciled' && m.operationNumber) {
      newReconciledKeys.push(operationMatchKey(m.operationNumber, m.amount));
    }
  }

  return {
    ...dataset,
    movements: [...otherMovements, ...nextSessionMovements],
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
    (m) => m.side === 'sales_application' && m.workflowStatus !== 'reconciled' && m.operationNumber
  );
  const bankAll = movements.filter((m) => isBankSide(m));

  function isBankSide(m: CanonicalMovement): boolean {
    return m.side === 'bank_or_gateway' || m.sourceType !== 'sales_erp';
  }

  for (const sales of salesPending) {
    if (sales.paymentMethod === 'unknown') continue;
    if (sales.paymentMethod === 'mercado_pago' || sales.paymentMethod === 'niubiz') continue;
    const inMp = bankAll.find(
      (b) =>
        b.sourceType === 'mercado_pago' &&
        b.operationNumber === sales.operationNumber &&
        amountsEqual(b.amount, sales.amount)
    );
    const inNiubiz = bankAll.find(
      (b) =>
        b.sourceType === 'niubiz' &&
        b.operationNumber === sales.operationNumber &&
        amountsEqual(b.amount, sales.amount)
    );
    if (inMp) {
      pushAlert(
        alerts,
        sid,
        'RULE-006',
        'warning',
        `Posible medio incorrecto: registrado como ${sales.paymentMethod}, coincide en Mercado Pago (${sales.operationNumberRaw})`,
        [sales.id, inMp.id]
      );
    } else if (inNiubiz) {
      pushAlert(
        alerts,
        sid,
        'RULE-006',
        'warning',
        `Posible medio incorrecto: registrado como ${sales.paymentMethod}, coincide en Niubiz (${sales.operationNumberRaw})`,
        [sales.id, inNiubiz.id]
      );
    }
  }

  return { ...dataset, alerts };
}
