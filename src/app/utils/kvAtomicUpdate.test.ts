import { describe, expect, it } from 'vitest';

import type { IKVRepository } from '../services/types';
import { kvAtomicUpdate } from './kvAtomicUpdate';

type Doc = { records: { id: string; name: string }[] };

/** KV en memoria con control de revisión como el servidor GrooFlow (409 si cambió). */
function fakeKv(initial: Doc) {
  let stored: Doc = initial;
  let revision = 1;
  const readRevision = new Map<string, number>();
  let beforeWrite: (() => void) | null = null;
  const kv: IKVRepository = {
    async get<T>() {
      return structuredClone(stored) as T;
    },
    async getWithStatus<T>(key: string) {
      readRevision.set(key, revision);
      return { ok: true, value: structuredClone(stored) as T };
    },
    async set() {
      throw new Error('set sin control de revisión no debe usarse');
    },
    async setStrict(key: string, value: unknown) {
      beforeWrite?.();
      beforeWrite = null;
      if (readRevision.get(key) !== revision) {
        const err = new Error('Los datos cambiaron. Recarga antes de guardar') as Error & {
          status: number;
        };
        err.status = 409;
        throw err;
      }
      stored = value as Doc;
      revision++;
    },
    async delete() {},
  };
  return {
    kv,
    get stored() {
      return stored;
    },
    /** Simula que otro usuario guarda justo antes de nuestra escritura. */
    otherUserWritesBeforeNext(doc: Doc) {
      beforeWrite = () => {
        stored = doc;
        revision++;
      };
    },
  };
}

const merge = (raw: Doc | null): Doc => raw ?? { records: [] };

describe('kvAtomicUpdate', () => {
  it('no pisa el registro que otro usuario guardó en medio', async () => {
    const store = fakeKv({ records: [{ id: 'a', name: 'Inicial' }] });
    store.otherUserWritesBeforeNext({
      records: [
        { id: 'a', name: 'Inicial' },
        { id: 'b', name: 'De otro usuario' },
      ],
    });

    await kvAtomicUpdate<Doc>({
      kv: store.kv,
      key: 'settings:accidentes-trabajo',
      merge,
      apply: (fresh) => ({ records: [...fresh.records, { id: 'c', name: 'Mío' }] }),
    });

    expect(store.stored.records.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('propaga errores que no son conflicto', async () => {
    const store = fakeKv({ records: [] });
    store.kv.setStrict = async () => {
      throw new Error('HTTP 500');
    };
    await expect(
      kvAtomicUpdate<Doc>({ kv: store.kv, key: 'k', merge, apply: (d) => d })
    ).rejects.toThrow('HTTP 500');
  });
});
