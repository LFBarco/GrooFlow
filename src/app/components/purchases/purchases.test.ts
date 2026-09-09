import { describe, expect, it } from 'vitest';
import type { PurchaseRequest, PurchaseRequestLineItem } from '../../types';

function calculatePurchaseRequestTotal(items: PurchaseRequestLineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function processPurchaseRequestApproval(
  request: PurchaseRequest,
  action: 'approve' | 'reject',
  approver: { name: string; initials: string },
  comment?: string
): PurchaseRequest {
  if (action === 'approve') {
    return {
      ...request,
      status: 'approved',
      approverName: approver.name,
      approverInitials: approver.initials,
      approvalComment: comment,
    };
  }
  return {
    ...request,
    status: 'rejected',
    approverName: approver.name,
    approverInitials: approver.initials,
    rejectionReason: comment,
  };
}

describe('Purchase Request Manager', () => {
  const lineItems: PurchaseRequestLineItem[] = [
    { id: 'l1', productId: 'p1', productName: 'Vacuna Sextuple', providerId: 'pr1', providerName: 'Lab Vet', quantity: 10, unitPrice: 45, lineTotal: 450 },
    { id: 'l2', productId: 'p2', productName: 'Jeringa 3ml', providerId: 'pr1', providerName: 'Lab Vet', quantity: 100, unitPrice: 1.5, lineTotal: 150 },
  ];

  const baseRequest: PurchaseRequest = {
    id: 'req-501',
    providerId: 'pr1',
    providerName: 'Lab Vet',
    requestDate: new Date('2026-09-08'),
    description: 'Compra mensual de vacunas e insumos',
    amount: 600,
    location: 'Principal',
    priority: 'high',
    paymentCondition: 'credit',
    status: 'pending',
    lineItems,
    requesterName: 'Juan Pérez',
    requesterInitials: 'JP',
  };

  it('calcula la suma total de las líneas del requerimiento', () => {
    const total = calculatePurchaseRequestTotal(lineItems);
    expect(total).toBe(600);
  });

  it('aprueba la solicitud de compra y registra el usuario aprobador', () => {
    const approved = processPurchaseRequestApproval(baseRequest, 'approve', { name: 'Luis Barco', initials: 'LB' }, 'Conforme con presupuesto');
    expect(approved.status).toBe('approved');
    expect(approved.approverName).toBe('Luis Barco');
    expect(approved.approvalComment).toBe('Conforme con presupuesto');
  });

  it('rechaza la solicitud de compra y registra el motivo de rechazo', () => {
    const rejected = processPurchaseRequestApproval(baseRequest, 'reject', { name: 'Luis Barco', initials: 'LB' }, 'Supera límite de caja');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Supera límite de caja');
  });
});
