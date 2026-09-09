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
    return new Response('{"ok":true}', { status: 200 });
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
