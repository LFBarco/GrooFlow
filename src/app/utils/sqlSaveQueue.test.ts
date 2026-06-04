import { describe, expect, it } from 'vitest';

import { getSqlSaveQueue, resetSqlSaveQueuesForTests } from './sqlSaveQueue';

describe('getSqlSaveQueue', () => {
  it('serializa saves del mismo dominio', async () => {
    resetSqlSaveQueuesForTests();
    const order: number[] = [];
    const queue = getSqlSaveQueue('data:providers');

    const p1 = queue.enqueue('a', async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push(1);
      return 'a';
    });
    const p2 = queue.enqueue('b', async () => {
      order.push(2);
      return 'b';
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it('no bloquea dominios distintos', async () => {
    resetSqlSaveQueuesForTests();
    const q1 = getSqlSaveQueue('data:invoices');
    const q2 = getSqlSaveQueue('data:requests');

    let invoicesDone = false;
    const invoices = q1.enqueue('inv', async () => {
      await new Promise((r) => setTimeout(r, 40));
      invoicesDone = true;
    });
    const requests = q2.enqueue('req', async () => {
      expect(invoicesDone).toBe(false);
    });

    await Promise.all([invoices, requests]);
    expect(invoicesDone).toBe(true);
  });
});
