// runner/server/runs.ts
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RunMeta, StageRecord } from './types.js';

export interface RunsStore {
  rootDir: string;
  allocateId(slug: string, when?: Date): Promise<string>;
  create(meta: RunMeta): Promise<void>;
  get(id: string): Promise<RunMeta>;
  update(id: string, patch: (m: RunMeta) => RunMeta): Promise<RunMeta>;
  list(): Promise<RunMeta[]>;
  recoverOrphans(): Promise<void>;
  pathFor(id: string, sub?: string): string;
}

const tsSlug = (d: Date) => d.toISOString().replace(/[:.]/g, '-').replace('Z', '').slice(0, 19);

export function createRunsStore(rootDir: string): RunsStore {
  const pathFor = (id: string, sub?: string) => sub ? join(rootDir, id, sub) : join(rootDir, id);

  const writeMetaAtomic = async (id: string, meta: RunMeta) => {
    const final = pathFor(id, 'meta.json');
    const tmp = final + '.tmp';
    await writeFile(tmp, JSON.stringify(meta, null, 2));
    await rename(tmp, final);
  };

  const store: RunsStore = {
    rootDir,
    pathFor,

    async allocateId(slug, when = new Date()) {
      const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'run';
      const base = `${tsSlug(when)}_${safeSlug}`;
      let candidate = base;
      let n = 2;
      while (existsSync(pathFor(candidate))) {
        candidate = `${base}-${n++}`;
      }
      return candidate;
    },

    async create(meta) {
      await mkdir(pathFor(meta.id, 'out'), { recursive: true });
      await writeMetaAtomic(meta.id, meta);
    },

    async get(id) {
      const txt = await readFile(pathFor(id, 'meta.json'), 'utf8');
      return JSON.parse(txt) as RunMeta;
    },

    async update(id, patch) {
      const cur = await store.get(id);
      const next = patch(cur);
      await writeMetaAtomic(id, next);
      return next;
    },

    async list() {
      if (!existsSync(rootDir)) return [];
      const entries = await readdir(rootDir);
      const metas: RunMeta[] = [];
      for (const e of entries) {
        const metaPath = pathFor(e, 'meta.json');
        if (!existsSync(metaPath)) continue;
        try {
          metas.push(JSON.parse(await readFile(metaPath, 'utf8')));
        } catch { /* skip corrupt */ }
      }
      metas.sort((a, b) => b.id.localeCompare(a.id));
      return metas;
    },

    async recoverOrphans() {
      const all = await store.list();
      for (const m of all) {
        if (m.status === 'running') {
          const stages: StageRecord[] = m.stages.map(s =>
            s.status === 'running' ? { ...s, status: 'failed', endedAt: new Date().toISOString(), error: 'server restart' } : s,
          );
          if (!stages.some(s => s.error === 'server restart')) {
            stages.push({ name: 'render', status: 'failed', error: 'server restart', endedAt: new Date().toISOString() });
          }
          await store.update(m.id, cur => ({ ...cur, status: 'failed', stages }));
        }
      }
    },
  };
  return store;
}
