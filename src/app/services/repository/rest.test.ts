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
