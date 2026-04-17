// runner/server/__tests__/runs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunsStore } from '../runs.js';
import type { RunMeta } from '../types.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'runs-test-'));
});

const sample = (id: string, slug: string): RunMeta => ({
  id, slug, createdAt: new Date().toISOString(),
  mode: 'composition', compositionId: 'DataChart',
  status: 'queued', stages: [],
});

describe('runs store', () => {
  it('creates a run folder and writes meta.json', async () => {
    const store = createRunsStore(dir);
    await store.create(sample('2026-04-17T00-00-00_test', 'test'));
    const txt = await readFile(join(dir, '2026-04-17T00-00-00_test', 'meta.json'), 'utf8');
    expect(JSON.parse(txt).slug).toBe('test');
  });

  it('lists runs newest-first', async () => {
    const store = createRunsStore(dir);
    await store.create(sample('2026-04-17T00-00-00_a', 'a'));
    await store.create(sample('2026-04-17T00-00-01_b', 'b'));
    const list = await store.list();
    expect(list.map(r => r.slug)).toEqual(['b', 'a']);
  });

  it('appends -2 on slug collision in the same second', async () => {
    const store = createRunsStore(dir);
    const id1 = await store.allocateId('hello', new Date('2026-04-17T00:00:00Z'));
    await store.create(sample(id1, 'hello'));
    const id2 = await store.allocateId('hello', new Date('2026-04-17T00:00:00Z'));
    expect(id1).toBe('2026-04-17T00-00-00_hello');
    expect(id2).toBe('2026-04-17T00-00-00_hello-2');
  });

  it('atomic update preserves file on partial write (smoke)', async () => {
    const store = createRunsStore(dir);
    const meta = sample('2026-04-17T00-00-00_x', 'x');
    await store.create(meta);
    await store.update('2026-04-17T00-00-00_x', m => ({ ...m, status: 'running' }));
    const after = await store.get('2026-04-17T00-00-00_x');
    expect(after.status).toBe('running');
  });

  it('marks orphaned running runs as failed on recoverOrphans()', async () => {
    const store = createRunsStore(dir);
    const meta: RunMeta = { ...sample('2026-04-17T00-00-00_o', 'o'), status: 'running' };
    await store.create(meta);
    await store.recoverOrphans();
    const after = await store.get('2026-04-17T00-00-00_o');
    expect(after.status).toBe('failed');
    expect(after.stages.find(s => s.error === 'server restart')).toBeTruthy();
  });
});
