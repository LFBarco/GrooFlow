import { afterEach, expect, it, vi } from 'vitest';
import { restRepository } from './rest';

afterEach(() => vi.unstubAllGlobals());

it('limits an autosave burst and releases queued writes after a failed request', async () => {
  let active = 0;
  let peak = 0;
  const requests: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requests.push(url);
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    if (url.endsWith('data%3Afail')) throw new Error('Connection failed');
    return new Response('{"ok":true,"revision":"r1"}', { status: 200 });
  }));

  const keys = ['data:fail', 'data:users', ...Array.from({ length: 18 }, (_, i) => `data:${i}`)];
  const results = await Promise.allSettled(keys.map((key) => restRepository.kv.set(key, [])));

  expect(peak).toBeLessThanOrEqual(4);
  expect(peak).toBeGreaterThan(1);
  expect(requests).toHaveLength(keys.length);
  expect(requests[1]).toContain('/kv/data%3Ausers');
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(keys.length - 1);
  expect(results[0].status).toBe('rejected');
  await expect(restRepository.kv.set('data:users', [])).resolves.toBeUndefined();
});

it('refreshes revision and retries KV PUT after HTTP 409 conflict', async () => {
  let putCount = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PUT') {
        putCount += 1;
        if (putCount === 1) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Los datos cambiaron. Recarga antes de guardar; tu borrador se conserva.' }),
            { status: 409 }
          );
        }
        return new Response(JSON.stringify({ ok: true, revision: 'rev-new' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, value: [], revision: 'rev-fresh' }), { status: 200 });
    })
  );

  await expect(restRepository.kv.set('data:users', [{ id: 'u1' }])).resolves.toBeUndefined();
  expect(putCount).toBe(2);
});

it('on 409 merges remote-only list rows before retry', async () => {
  let putCount = 0;
  let secondBody: unknown;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PUT') {
        putCount += 1;
        if (putCount === 1) {
          return new Response(JSON.stringify({ ok: false, error: 'Los datos cambiaron.' }), {
            status: 409,
          });
        }
        secondBody = JSON.parse(String(init?.body ?? '{}'));
        return new Response(JSON.stringify({ ok: true, revision: 'rev-2' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          value: [{ id: 'remote-1', amount: 1 }],
          revision: 'rev-1',
        }),
        { status: 200 }
      );
    })
  );

  await restRepository.kv.set('data:pettyCash', [{ id: 'local-1', amount: 2 }]);
  expect(putCount).toBe(2);
  const value = (secondBody as { value: Array<{ id: string }> }).value;
  expect(value.map((r) => r.id).sort()).toEqual(['local-1', 'remote-1']);
});

it('setStrict no reintenta ante 409 (no reenvía datos viejos)', async () => {
  let putCount = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'PUT') {
        putCount += 1;
        return new Response(JSON.stringify({ ok: false, error: 'Los datos cambiaron.' }), {
          status: 409,
        });
      }
      return new Response(JSON.stringify({ ok: true, value: {}, revision: 'r' }), { status: 200 });
    })
  );

  await expect(
    restRepository.kv.setStrict!('settings:accidentes-trabajo', { records: [] })
  ).rejects.toMatchObject({ status: 409 });
  expect(putCount).toBe(1);
});
