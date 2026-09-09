import { describe, expect, it } from 'vitest';

interface DoctorFeeReceipt {
  id: string;
  doctorName: string;
  grossAmount: number; // Monto Bruto RXH
  commissionRate: number; // e.g. 0.40 (40%)
  taxRetentionRate: number; // e.g. 0.08 (8% Impuesto a la Renta de 4ta categoría)
  applyRetention: boolean;
}

function calculateDoctorFeePayment(receipt: DoctorFeeReceipt) {
  const doctorCommission = receipt.grossAmount * receipt.commissionRate;
  const taxRetention = receipt.applyRetention ? doctorCommission * receipt.taxRetentionRate : 0;
  const netPayable = doctorCommission - taxRetention;

  return {
    doctorCommission,
    taxRetention,
    netPayable,
  };
}

describe('Professional Fees Module', () => {
  it('calcula honorario de médico con retención del 8%', () => {
    const receipt: DoctorFeeReceipt = {
      id: 'rxh-101',
      doctorName: 'Dr. Barco',
      grossAmount: 5000,
      commissionRate: 0.50, // 50%
      taxRetentionRate: 0.08, // 8%
      applyRetention: true,
    };
    const payment = calculateDoctorFeePayment(receipt);

    expect(payment.doctorCommission).toBe(2500);
    expect(payment.taxRetention).toBe(200);
    expect(payment.netPayable).toBe(2300);
  });

  it('calcula honorario sin retención cuando applyRetention es false', () => {
    const receipt: DoctorFeeReceipt = {
      id: 'rxh-102',
      doctorName: 'Dra. Pérez',
      grossAmount: 2000,
      commissionRate: 0.30,
      taxRetentionRate: 0.08,
      applyRetention: false,
    };
    const payment = calculateDoctorFeePayment(receipt);

    expect(payment.doctorCommission).toBe(600);
    expect(payment.taxRetention).toBe(0);
    expect(payment.netPayable).toBe(600);
  });
});
