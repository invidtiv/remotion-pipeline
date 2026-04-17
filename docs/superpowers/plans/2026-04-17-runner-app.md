# Runner App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Windows web app, living in this repo, that takes a video script (NL prompt / structured JSON / existing TSX), drives the Remotion + FFmpeg pipeline, streams stage-level progress over SSE, and presents the result with a filesystem-backed history of past runs.

**Architecture:** Express + TypeScript Node server spawns child processes (`claude`, `npx remotion render`, `compose.sh`), parses their stdout for stage transitions, persists state to `runs/<id>/meta.json`, and broadcasts events to a Vite/React UI via Server-Sent Events. The runner shares a `package.json` with the Remotion compositions; one `npm install` brings up everything.

**Tech Stack:** Node 20, TypeScript, Express, `tsx`, Vite, React 18, react-router-dom, Zod, Remotion 4, system FFmpeg, Vitest. Spec: [docs/superpowers/specs/2026-04-17-runner-app-design.md](../specs/2026-04-17-runner-app-design.md).

---

## File Structure

**New files:**
- `package.json`, `tsconfig.json`, `tsconfig.web.json`, `.gitignore`
- `src/Root.tsx` (moved from repo root)
- `src/compositions/DataChart/index.tsx` (moved from `DataChart.tsx`)
- `src/compositions/StructuredScript/index.tsx` (new template comp)
- `src/compositions/StructuredScript/scenes/{Title,Bullets,Cta}.tsx`
- `runner/server/index.ts` — Express entry
- `runner/server/config.ts` — env + defaults
- `runner/server/types.ts` — shared event/state types
- `runner/server/runs.ts` — filesystem CRUD for runs/
- `runner/server/events.ts` — pub/sub + SSE adapter
- `runner/server/pipeline.ts` — orchestrator
- `runner/server/stages/{claude,scaffold,remotion,ffmpeg}.ts`
- `runner/server/stages/parsers/{remotion,ffmpeg}.ts`
- `runner/server/__tests__/*.test.ts`
- `runner/web/index.html`, `runner/web/vite.config.ts`
- `runner/web/src/main.tsx`, `App.tsx`
- `runner/web/src/pages/{NewRun,RunDetail,History}.tsx`
- `runner/web/src/components/{ModeTabs,StageTimeline,VideoPlayer,MetaPanel}.tsx`
- `runner/web/src/lib/{api,sse,types}.ts`
- `start-runner.bat`

**Moved/modified:**
- `Root.tsx` → `src/Root.tsx`
- `DataChart.tsx` → `src/compositions/DataChart/index.tsx`
- `data.json`, `compose.sh` stay at repo root

---

## Task 1: Project scaffold (Remotion + TypeScript + git)

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `remotion.config.ts`
- Move: `Root.tsx` → `src/Root.tsx`, `DataChart.tsx` → `src/compositions/DataChart/index.tsx`

- [ ] **Step 1: Init git**

```bash
cd C:/Users/tiaz/Desktop/Github/remotionPipeline
git init
git add -A
git commit -m "chore: snapshot setup kit before scaffolding"
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
out/
runs/
runner/web/dist/
.env
.env.local
*.log
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "remotion-pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "studio": "remotion studio src/Root.tsx",
    "render": "remotion render src/Root.tsx",
    "compositions": "remotion compositions src/Root.tsx --output=json",
    "runner": "npm run web:build && tsx runner/server/index.ts",
    "runner:dev": "concurrently -k -n srv,web -c blue,magenta \"tsx watch runner/server/index.ts\" \"vite --config runner/web/vite.config.ts\"",
    "web:build": "vite build --config runner/web/vite.config.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "@remotion/google-fonts": "^4.0.0",
    "express": "^4.19.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "remotion": "^4.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "runner/**/*"],
  "exclude": ["node_modules", "runner/web/dist"]
}
```

- [ ] **Step 5: Create `remotion.config.ts`**

```ts
import { Config } from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
```

- [ ] **Step 6: Move and fix Remotion files**

```bash
mkdir -p src/compositions/DataChart
git mv DataChart.tsx src/compositions/DataChart/index.tsx
git mv Root.tsx src/Root.tsx
```

Then in `src/Root.tsx`, change the import line:
```ts
// from:
import { DataChart, dataChartSchema, DataChartProps } from "./compositions/DataChart";
// to (no change needed — path is identical now). Verify it reads:
import { DataChart, dataChartSchema, DataChartProps } from "./compositions/DataChart";
```

- [ ] **Step 7: Install and verify Remotion still renders**

```bash
npm install
npx remotion compositions src/Root.tsx
```

Expected: prints a JSON array including `{"id": "DataChart", ...}`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Remotion project + TypeScript"
```

---

## Task 2: Shared types module

**Files:**
- Create: `runner/server/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// runner/server/types.ts
export type RunMode = 'prompt' | 'structured' | 'composition';

export type StageName = 'claude' | 'scaffold' | 'bundle' | 'render' | 'ffmpeg';

export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface StageRecord {
  name: StageName;
  status: StageStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface RunOutputs {
  raw: { path: string; bytes: number };
  web: { path: string; bytes: number };
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}

export interface RunMeta {
  id: string;
  slug: string;
  createdAt: string;
  mode: RunMode;
  compositionId: string;
  status: RunStatus;
  stages: StageRecord[];
  outputs?: RunOutputs;
  totals?: { wallMs: number };
}

export type RunEvent =
  | { kind: 'run.started'; runId: string; mode: RunMode; stages: StageName[] }
  | { kind: 'stage.started'; runId: string; stage: StageName; at: string }
  | { kind: 'stage.progress'; runId: string; stage: StageName; pct?: number; note?: string }
  | { kind: 'stage.finished'; runId: string; stage: StageName; status: 'done' | 'failed' | 'skipped'; durationMs: number; error?: string }
  | { kind: 'run.finished'; runId: string; status: 'succeeded' | 'failed' | 'cancelled'; totalMs: number };

export const STAGES_BY_MODE: Record<RunMode, StageName[]> = {
  prompt: ['claude', 'bundle', 'render', 'ffmpeg'],
  structured: ['scaffold', 'bundle', 'render', 'ffmpeg'],
  composition: ['bundle', 'render', 'ffmpeg'],
};
```

- [ ] **Step 2: Commit**

```bash
git add runner/server/types.ts
git commit -m "feat(runner): shared types for runs and events"
```

---

## Task 3: `runs.ts` — filesystem CRUD (TDD)

**Files:**
- Create: `runner/server/runs.ts`
- Test: `runner/server/__tests__/runs.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// runner/server/__tests__/runs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
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
```

- [ ] **Step 2: Run tests, expect them to fail**

```bash
npx vitest run runner/server/__tests__/runs.test.ts
```

Expected: FAIL — `Cannot find module '../runs.js'`.

- [ ] **Step 3: Implement `runs.ts`**

```ts
// runner/server/runs.ts
import { mkdir, readFile, writeFile, rename, readdir, stat } from 'node:fs/promises';
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

  return {
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
      const cur = await this.get(id);
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
      const all = await this.list();
      for (const m of all) {
        if (m.status === 'running') {
          const stages: StageRecord[] = m.stages.map(s =>
            s.status === 'running' ? { ...s, status: 'failed', endedAt: new Date().toISOString(), error: 'server restart' } : s,
          );
          if (!stages.some(s => s.error === 'server restart')) {
            stages.push({ name: 'render', status: 'failed', error: 'server restart', endedAt: new Date().toISOString() });
          }
          await this.update(m.id, cur => ({ ...cur, status: 'failed', stages }));
        }
      }
    },
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run runner/server/__tests__/runs.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add runner/server runner/server/__tests__
git commit -m "feat(runner): runs filesystem store with atomic writes + orphan recovery"
```

---

## Task 4: Event bus

**Files:**
- Create: `runner/server/events.ts`
- Test: `runner/server/__tests__/events.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// runner/server/__tests__/events.test.ts
import { describe, it, expect } from 'vitest';
import { createEventBus } from '../events.js';

describe('event bus', () => {
  it('delivers events to subscribers of a runId', () => {
    const bus = createEventBus();
    const got: any[] = [];
    bus.subscribe('R1', e => got.push(e));
    bus.publish({ kind: 'run.started', runId: 'R1', mode: 'composition', stages: ['bundle','render','ffmpeg'] });
    bus.publish({ kind: 'run.started', runId: 'R2', mode: 'composition', stages: ['bundle','render','ffmpeg'] });
    expect(got).toHaveLength(1);
    expect(got[0].runId).toBe('R1');
  });

  it('unsubscribe removes the handler', () => {
    const bus = createEventBus();
    const got: any[] = [];
    const unsub = bus.subscribe('R1', e => got.push(e));
    unsub();
    bus.publish({ kind: 'run.started', runId: 'R1', mode: 'composition', stages: [] });
    expect(got).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run runner/server/__tests__/events.test.ts
```

- [ ] **Step 3: Implement**

```ts
// runner/server/events.ts
import type { RunEvent } from './types.js';

type Handler = (e: RunEvent) => void;

export interface EventBus {
  subscribe(runId: string, h: Handler): () => void;
  publish(e: RunEvent): void;
}

export function createEventBus(): EventBus {
  const subs = new Map<string, Set<Handler>>();
  return {
    subscribe(runId, h) {
      if (!subs.has(runId)) subs.set(runId, new Set());
      subs.get(runId)!.add(h);
      return () => subs.get(runId)?.delete(h);
    },
    publish(e) {
      const set = subs.get(e.runId);
      if (!set) return;
      for (const h of set) {
        try { h(e); } catch { /* swallow handler errors */ }
      }
    },
  };
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add runner/server/events.ts runner/server/__tests__/events.test.ts
git commit -m "feat(runner): in-process event bus"
```

---

## Task 5: Remotion stdout parser (TDD)

Remotion's `render` CLI prints lines like:
```
Bundling...
Bundled in 2.3s
Rendering | ████████░░ | 80% | 240/300
Encoded all frames.
```

We split this into two stages: `bundle` ends when "Bundled" appears; `render` starts then and emits `pct` from `%` lines.

**Files:**
- Create: `runner/server/stages/parsers/remotion.ts`
- Test: `runner/server/__tests__/parsers-remotion.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// runner/server/__tests__/parsers-remotion.test.ts
import { describe, it, expect } from 'vitest';
import { createRemotionParser } from '../stages/parsers/remotion.js';

describe('remotion parser', () => {
  it('emits bundle.start then bundle.done then render.start', () => {
    const events: any[] = [];
    const p = createRemotionParser(e => events.push(e));
    p.feed('Bundling...\n');
    p.feed('Bundled in 2.3s\n');
    p.feed('Rendering: 1%\n');
    expect(events.map(e => e.type)).toEqual(['bundle.start', 'bundle.done', 'render.start', 'render.progress']);
    expect(events[3].pct).toBe(1);
  });

  it('parses percent from progress lines with bars', () => {
    const events: any[] = [];
    const p = createRemotionParser(e => events.push(e));
    p.feed('Bundled in 1s\nRendering | ████░░░░ | 42% | 126/300\n');
    const last = events.pop();
    expect(last.type).toBe('render.progress');
    expect(last.pct).toBe(42);
  });

  it('emits render.done on "Encoded all frames"', () => {
    const events: any[] = [];
    const p = createRemotionParser(e => events.push(e));
    p.feed('Bundled in 1s\nRendering: 100%\nEncoded all frames.\n');
    expect(events.at(-1).type).toBe('render.done');
  });

  it('handles partial lines across feeds', () => {
    const events: any[] = [];
    const p = createRemotionParser(e => events.push(e));
    p.feed('Bundling');
    p.feed('...\nBundled in 1s\n');
    expect(events.map(e => e.type)).toEqual(['bundle.start', 'bundle.done']);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run runner/server/__tests__/parsers-remotion.test.ts
```

- [ ] **Step 3: Implement**

```ts
// runner/server/stages/parsers/remotion.ts
export type RemotionEvent =
  | { type: 'bundle.start' }
  | { type: 'bundle.done' }
  | { type: 'render.start' }
  | { type: 'render.progress'; pct: number }
  | { type: 'render.done' };

export interface RemotionParser {
  feed(chunk: string): void;
}

export function createRemotionParser(emit: (e: RemotionEvent) => void): RemotionParser {
  let buf = '';
  let bundleStarted = false;
  let bundleDone = false;
  let renderStarted = false;
  let renderDone = false;

  const handleLine = (line: string) => {
    if (!bundleStarted && /^Bundling/i.test(line)) {
      bundleStarted = true;
      emit({ type: 'bundle.start' });
    }
    if (!bundleDone && /^Bundled in/i.test(line)) {
      bundleDone = true;
      emit({ type: 'bundle.done' });
      return;
    }
    if (bundleDone && !renderStarted) {
      renderStarted = true;
      emit({ type: 'render.start' });
    }
    if (bundleDone && !renderDone) {
      const pctMatch = line.match(/(\d+)\s*%/);
      if (pctMatch) emit({ type: 'render.progress', pct: parseInt(pctMatch[1], 10) });
    }
    if (!renderDone && /Encoded all frames/i.test(line)) {
      renderDone = true;
      emit({ type: 'render.done' });
    }
  };

  return {
    feed(chunk) {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) handleLine(line);
      }
    },
  };
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add runner/server/stages/parsers runner/server/__tests__/parsers-remotion.test.ts
git commit -m "feat(runner): remotion stdout parser"
```

---

## Task 6: FFmpeg stdout parser (lightweight)

We don't try to compute %; just detect "started" (first `frame=` line) and "finished" (process exit handled outside).

**Files:**
- Create: `runner/server/stages/parsers/ffmpeg.ts`
- Test: `runner/server/__tests__/parsers-ffmpeg.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// runner/server/__tests__/parsers-ffmpeg.test.ts
import { describe, it, expect } from 'vitest';
import { createFfmpegParser } from '../stages/parsers/ffmpeg.js';

describe('ffmpeg parser', () => {
  it('emits started on first frame= line', () => {
    const events: any[] = [];
    const p = createFfmpegParser(e => events.push(e));
    p.feed('ffmpeg version 6.0 Copyright ...\n');
    expect(events).toEqual([]);
    p.feed('frame=  120 fps= 30 q=28.0 size=1024kB time=00:00:04.00\n');
    expect(events).toEqual([{ type: 'started' }]);
    p.feed('frame=  240 fps= 30 q=28.0 size=2048kB time=00:00:08.00\n');
    expect(events).toEqual([{ type: 'started' }]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// runner/server/stages/parsers/ffmpeg.ts
export type FfmpegEvent = { type: 'started' };

export function createFfmpegParser(emit: (e: FfmpegEvent) => void) {
  let started = false;
  let buf = '';
  return {
    feed(chunk: string) {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!started && /^frame=/.test(line.trim())) {
          started = true;
          emit({ type: 'started' });
        }
      }
    },
  };
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add runner/server/stages/parsers/ffmpeg.ts runner/server/__tests__/parsers-ffmpeg.test.ts
git commit -m "feat(runner): ffmpeg stdout parser"
```

---

## Task 7: `StructuredScript` composition + scene components

**Files:**
- Create: `src/compositions/StructuredScript/index.tsx`
- Create: `src/compositions/StructuredScript/scenes/Title.tsx`
- Create: `src/compositions/StructuredScript/scenes/Bullets.tsx`
- Create: `src/compositions/StructuredScript/scenes/Cta.tsx`
- Create: `src/compositions/StructuredScript/schema.ts`
- Modify: `src/Root.tsx`

- [ ] **Step 1: Schema**

```ts
// src/compositions/StructuredScript/schema.ts
import { z } from 'zod';

export const sceneSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('title'), durationSec: z.number(), props: z.object({ title: z.string(), subtitle: z.string().optional() }) }),
  z.object({ kind: z.literal('bullets'), durationSec: z.number(), props: z.object({ items: z.array(z.string()) }) }),
  z.object({ kind: z.literal('cta'), durationSec: z.number(), props: z.object({ text: z.string() }) }),
]);

export const structuredScriptSchema = z.object({
  title: z.string(),
  width: z.union([z.literal(1080), z.literal(1920)]),
  height: z.union([z.literal(1080), z.literal(1920)]),
  fps: z.union([z.literal(30), z.literal(60)]),
  scenes: z.array(sceneSchema),
});

export type StructuredScriptProps = z.infer<typeof structuredScriptSchema>;
export type ScenePropsT = z.infer<typeof sceneSchema>;
```

- [ ] **Step 2: Scene components**

```tsx
// src/compositions/StructuredScript/scenes/Title.tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
export const Title = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const o = spring({ frame: f, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: '#0a0a0a', color: '#fff', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ opacity: o, transform: `translateY(${interpolate(o, [0, 1], [20, 0])}px)`, textAlign: 'center' }}>
        <h1 style={{ fontSize: 96, margin: 0, fontWeight: 800 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 36, margin: '16px 0 0', opacity: 0.7 }}>{subtitle}</p>}
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// src/compositions/StructuredScript/scenes/Bullets.tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
export const Bullets = ({ items }: { items: string[] }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#0a0a0a', color: '#fff', padding: 96, justifyContent: 'center', fontFamily: 'sans-serif' }}>
      {items.map((it, i) => {
        const delay = i * 12;
        const o = spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.5 } });
        return (
          <div key={i} style={{ opacity: o, fontSize: 56, margin: '12px 0', transform: `translateX(${(1 - o) * -40}px)` }}>
            • {it}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

```tsx
// src/compositions/StructuredScript/scenes/Cta.tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
export const Cta = ({ text }: { text: string }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const o = spring({ frame: f, fps });
  const pulse = 1 + 0.04 * Math.sin((f / fps) * 2 * Math.PI);
  return (
    <AbsoluteFill style={{ background: '#CCFF00', color: '#0a0a0a', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ opacity: o, transform: `scale(${pulse})`, fontSize: 88, fontWeight: 800 }}>{text}</div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Composition entry**

```tsx
// src/compositions/StructuredScript/index.tsx
import React from 'react';
import { Sequence } from 'remotion';
import { Title } from './scenes/Title.js';
import { Bullets } from './scenes/Bullets.js';
import { Cta } from './scenes/Cta.js';
import type { StructuredScriptProps } from './schema.js';
export { structuredScriptSchema } from './schema.js';
export type { StructuredScriptProps } from './schema.js';

export const StructuredScript: React.FC<StructuredScriptProps> = ({ scenes }) => {
  let cursor = 0;
  return (
    <>
      {scenes.map((s, i) => {
        const dur = Math.max(1, Math.round(s.durationSec * 30));
        const node = (
          <Sequence key={i} from={cursor} durationInFrames={dur}>
            {s.kind === 'title' && <Title {...s.props} />}
            {s.kind === 'bullets' && <Bullets {...s.props} />}
            {s.kind === 'cta' && <Cta {...s.props} />}
          </Sequence>
        );
        cursor += dur;
        return node;
      })}
    </>
  );
};
```

- [ ] **Step 4: Register in `src/Root.tsx`**

Add to `src/Root.tsx` inside the fragment, after the existing `<Composition id="DataChart" ... />`:

```tsx
import { StructuredScript, structuredScriptSchema, StructuredScriptProps } from './compositions/StructuredScript/index.js';

const defaultStructuredProps: StructuredScriptProps = {
  title: 'Default Script',
  width: 1080,
  height: 1920,
  fps: 30,
  scenes: [
    { kind: 'title', durationSec: 3, props: { title: 'Hello' } },
    { kind: 'bullets', durationSec: 4, props: { items: ['Fast', 'Simple', 'Local'] } },
    { kind: 'cta', durationSec: 3, props: { text: 'go.example' } },
  ],
};

// Inside the fragment, after DataChart:
<Composition
  id="StructuredScript"
  component={StructuredScript}
  durationInFrames={300}
  fps={30}
  width={1080}
  height={1920}
  schema={structuredScriptSchema}
  defaultProps={defaultStructuredProps}
  calculateMetadata={({ props }) => ({
    durationInFrames: Math.max(1, Math.round(props.scenes.reduce((a, s) => a + s.durationSec, 0) * props.fps)),
    props,
    fps: props.fps,
    width: props.width,
    height: props.height,
  })}
/>
```

- [ ] **Step 5: Verify compositions list**

```bash
npx remotion compositions src/Root.tsx
```

Expected: lists both `DataChart` and `StructuredScript`.

- [ ] **Step 6: Commit**

```bash
git add src/compositions/StructuredScript src/Root.tsx
git commit -m "feat: StructuredScript composition for structured-input mode"
```

---

## Task 8: Stage runner — `claude` mode

**Files:**
- Create: `runner/server/stages/claude.ts`

- [ ] **Step 1: Implement**

```ts
// runner/server/stages/claude.ts
import { spawn } from 'node:child_process';
import { copyFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface ClaudeStageInput {
  prompt: string;
  compositionId: string;
  projectRoot: string;
  runDir: string;
  claudeBin: string;
  onStdout?: (s: string) => void;
}

export interface ClaudeStageResult {
  compositionFile: string;
}

const WRAPPER = (id: string, prompt: string) => `Create or update a Remotion composition with id "${id}".
Place it under src/compositions/${id}/index.tsx and register it in src/Root.tsx if missing.
The user wants:

${prompt}

When you are done, print exactly this on its own line, with the absolute path:
COMPOSITION_FILE: <absolute path to the .tsx file you wrote>
`;

const findNewestTsx = async (root: string): Promise<string | null> => {
  const dir = join(root, 'src', 'compositions');
  let newest: { p: string; m: number } | null = null;
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && e.name.endsWith('.tsx')) {
        const s = await stat(p);
        if (!newest || s.mtimeMs > newest.m) newest = { p, m: s.mtimeMs };
      }
    }
  };
  await walk(dir);
  return newest ? newest.p : null;
};

export function runClaude(input: ClaudeStageInput): Promise<ClaudeStageResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.claudeBin, ['--dangerously-skip-permissions'], {
      cwd: input.projectRoot,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let markerPath: string | null = null;
    const lineRe = /^COMPOSITION_FILE:\s*(.+)$/m;

    const onChunk = (data: Buffer) => {
      const s = data.toString();
      stdout += s;
      input.onStdout?.(s);
      const m = stdout.match(lineRe);
      if (m && !markerPath) markerPath = m[1].trim();
    };

    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.stdin.write(WRAPPER(input.compositionId, input.prompt));
    child.stdin.end();

    child.on('exit', async code => {
      if (code !== 0) return reject(new Error(`claude exited ${code}`));
      let file = markerPath;
      if (!file) file = await findNewestTsx(input.projectRoot);
      if (!file) return reject(new Error('claude finished but no composition file found'));
      try {
        await copyFile(file, join(input.runDir, 'composition.tsx'));
      } catch { /* non-fatal */ }
      resolve({ compositionFile: file });
    });
    child.on('error', reject);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add runner/server/stages/claude.ts
git commit -m "feat(runner): claude CLI stage with marker + newest-tsx fallback"
```

---

## Task 9: Stage runner — `scaffold` mode

**Files:**
- Create: `runner/server/stages/scaffold.ts`

- [ ] **Step 1: Implement**

```ts
// runner/server/stages/scaffold.ts
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { structuredScriptSchema } from '../../../src/compositions/StructuredScript/schema.js';

export interface ScaffoldInput {
  scriptJson: unknown;
  runDir: string;
}

export interface ScaffoldResult {
  propsFile: string;
  compositionId: 'StructuredScript';
}

export async function runScaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
  const parsed = structuredScriptSchema.parse(input.scriptJson);
  const propsFile = join(input.runDir, 'props.json');
  await writeFile(propsFile, JSON.stringify(parsed, null, 2));
  return { propsFile, compositionId: 'StructuredScript' };
}
```

- [ ] **Step 2: Commit**

```bash
git add runner/server/stages/scaffold.ts
git commit -m "feat(runner): scaffold stage validates structured script + writes props.json"
```

---

## Task 10: Stage runner — `remotion` (bundle + render)

**Files:**
- Create: `runner/server/stages/remotion.ts`

- [ ] **Step 1: Implement**

```ts
// runner/server/stages/remotion.ts
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createRemotionParser, type RemotionEvent } from './parsers/remotion.js';

export interface RemotionStageInput {
  projectRoot: string;
  compositionId: string;
  outFile: string;            // e.g. runs/<id>/out/raw.mp4
  propsFile?: string;
  onEvent: (e: RemotionEvent) => void;
  onStdout?: (s: string) => void;
}

export interface RemotionStageResult {
  bytes: number;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}

export function runRemotion(input: RemotionStageInput): Promise<RemotionStageResult> {
  return new Promise((resolve, reject) => {
    const args = ['remotion', 'render', 'src/Root.tsx', input.compositionId, input.outFile];
    if (input.propsFile) args.push(`--props=${input.propsFile}`);
    args.push('--log=info');

    const child = spawn('npx', args, {
      cwd: input.projectRoot,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const parser = createRemotionParser(input.onEvent);

    const onChunk = (b: Buffer) => {
      const s = b.toString();
      input.onStdout?.(s);
      parser.feed(s);
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);

    child.on('exit', async code => {
      if (code !== 0) return reject(new Error(`remotion render exited ${code}`));
      try {
        const st = await stat(input.outFile);
        // Width/height/fps/duration filled by caller via separate compositions JSON probe.
        resolve({ bytes: st.size, width: 0, height: 0, fps: 0, durationSec: 0 });
      } catch (e) { reject(e); }
    });
    child.on('error', reject);
  });
}

export interface CompInfo { id: string; width: number; height: number; fps: number; durationInFrames: number }

export function probeCompositions(projectRoot: string): Promise<CompInfo[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['remotion', 'compositions', 'src/Root.tsx', '--output=json'], {
      cwd: projectRoot, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', d => { out += d.toString(); });
    child.on('exit', code => {
      if (code !== 0) return reject(new Error(`compositions exited ${code}`));
      try {
        // remotion prints log lines too; find the JSON array
        const start = out.indexOf('[');
        const end = out.lastIndexOf(']');
        const arr = JSON.parse(out.slice(start, end + 1));
        resolve(arr.map((c: any) => ({ id: c.id, width: c.width, height: c.height, fps: c.fps, durationInFrames: c.durationInFrames })));
      } catch (e) { reject(e); }
    });
    child.on('error', reject);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add runner/server/stages/remotion.ts
git commit -m "feat(runner): remotion render stage + compositions probe"
```

---

## Task 11: Stage runner — `ffmpeg`

**Files:**
- Create: `runner/server/stages/ffmpeg.ts`

- [ ] **Step 1: Implement**

```ts
// runner/server/stages/ffmpeg.ts
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createFfmpegParser } from './parsers/ffmpeg.js';

export interface FfmpegStageInput {
  inFile: string;
  outFile: string;
  onStarted?: () => void;
  onStdout?: (s: string) => void;
}

export interface FfmpegStageResult { bytes: number }

export function runFfmpeg(input: FfmpegStageInput): Promise<FfmpegStageResult> {
  return new Promise((resolve, reject) => {
    // Mirrors compose.sh defaults: CRF 28, preset slow, faststart, yuv420p
    const args = [
      '-y', '-i', input.inFile,
      '-c:v', 'libx264', '-crf', '28', '-preset', 'slow',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '128k',
      input.outFile,
    ];
    const child = spawn('ffmpeg', args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const parser = createFfmpegParser(e => { if (e.type === 'started') input.onStarted?.(); });
    const onChunk = (b: Buffer) => { const s = b.toString(); input.onStdout?.(s); parser.feed(s); };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.on('exit', async code => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}`));
      try { resolve({ bytes: (await stat(input.outFile)).size }); } catch (e) { reject(e); }
    });
    child.on('error', reject);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add runner/server/stages/ffmpeg.ts
git commit -m "feat(runner): ffmpeg compression stage"
```

---

## Task 12: Pipeline orchestrator

**Files:**
- Create: `runner/server/pipeline.ts`
- Create: `runner/server/config.ts`

- [ ] **Step 1: `config.ts`**

```ts
// runner/server/config.ts
export const CONFIG = {
  port: parseInt(process.env.RUNNER_PORT ?? '4317', 10),
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
  projectRoot: process.cwd(),
  runsDir: 'runs',
};
```

- [ ] **Step 2: `pipeline.ts`**

```ts
// runner/server/pipeline.ts
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from './events.js';
import type { RunsStore } from './runs.js';
import type { RunMeta, RunMode, StageName, StageRecord } from './types.js';
import { STAGES_BY_MODE } from './types.js';
import { runClaude } from './stages/claude.js';
import { runScaffold } from './stages/scaffold.js';
import { runRemotion, probeCompositions } from './stages/remotion.js';
import { runFfmpeg } from './stages/ffmpeg.js';

export interface StartRunRequest {
  mode: RunMode;
  slug: string;
  compositionId?: string;       // required for `composition` mode; provided for `prompt`
  prompt?: string;              // for `prompt` mode
  scriptJson?: unknown;         // for `structured` mode
}

export interface PipelineDeps {
  store: RunsStore;
  bus: EventBus;
  projectRoot: string;
  claudeBin: string;
}

export class PipelineBusy extends Error { constructor() { super('pipeline busy'); } }

export function createPipeline(deps: PipelineDeps) {
  let active: { id: string; abort: () => void } | null = null;

  const log = (runDir: string, s: string) => appendFile(join(runDir, 'log.txt'), s).catch(() => {});

  const startStage = async (runId: string, name: StageName) => {
    const at = new Date().toISOString();
    await deps.store.update(runId, m => ({
      ...m,
      stages: m.stages.map(s => s.name === name ? { ...s, status: 'running', startedAt: at } : s),
    }));
    deps.bus.publish({ kind: 'stage.started', runId, stage: name, at });
  };

  const finishStage = async (runId: string, name: StageName, status: 'done'|'failed'|'skipped', error?: string) => {
    const endedAt = new Date().toISOString();
    let durationMs = 0;
    await deps.store.update(runId, m => {
      const stages: StageRecord[] = m.stages.map(s => {
        if (s.name !== name) return s;
        durationMs = s.startedAt ? Date.parse(endedAt) - Date.parse(s.startedAt) : 0;
        return { ...s, status, endedAt, durationMs, error };
      });
      return { ...m, stages };
    });
    deps.bus.publish({ kind: 'stage.finished', runId, stage: name, status, durationMs, error });
  };

  async function start(req: StartRunRequest): Promise<RunMeta> {
    if (active) throw new PipelineBusy();
    const id = await deps.store.allocateId(req.slug);
    const stages: StageName[] = STAGES_BY_MODE[req.mode];
    const meta: RunMeta = {
      id, slug: req.slug, createdAt: new Date().toISOString(),
      mode: req.mode,
      compositionId: req.compositionId ?? (req.mode === 'structured' ? 'StructuredScript' : ''),
      status: 'running',
      stages: stages.map(name => ({ name, status: 'pending' })),
    };
    await deps.store.create(meta);
    deps.bus.publish({ kind: 'run.started', runId: id, mode: req.mode, stages });

    let cancelled = false;
    active = { id, abort: () => { cancelled = true; } };
    const runDir = deps.store.pathFor(id);

    const runStartMs = Date.now();
    try {
      let compositionId = meta.compositionId;
      let propsFile: string | undefined;

      if (req.mode === 'prompt') {
        await startStage(id, 'claude');
        const r = await runClaude({
          prompt: req.prompt ?? '', compositionId,
          projectRoot: deps.projectRoot, runDir, claudeBin: deps.claudeBin,
          onStdout: s => log(runDir, s),
        });
        await finishStage(id, 'claude', 'done');
        if (cancelled) throw new Error('cancelled');
        compositionId = req.compositionId ?? compositionId;
        await deps.store.update(id, m => ({ ...m, compositionId }));
      } else if (req.mode === 'structured') {
        await startStage(id, 'scaffold');
        const r = await runScaffold({ scriptJson: req.scriptJson, runDir });
        propsFile = r.propsFile;
        compositionId = r.compositionId;
        await deps.store.update(id, m => ({ ...m, compositionId }));
        await finishStage(id, 'scaffold', 'done');
        if (cancelled) throw new Error('cancelled');
      }

      await startStage(id, 'bundle');
      const rawOut = join(runDir, 'out', 'raw.mp4');
      let bundleFinished = false;
      let renderStarted = false;
      const renderRes = await runRemotion({
        projectRoot: deps.projectRoot, compositionId, outFile: rawOut, propsFile,
        onStdout: s => log(runDir, s),
        onEvent: async e => {
          if (e.type === 'bundle.done' && !bundleFinished) {
            bundleFinished = true;
            await finishStage(id, 'bundle', 'done');
            await startStage(id, 'render');
            renderStarted = true;
          } else if (e.type === 'render.progress' && renderStarted) {
            deps.bus.publish({ kind: 'stage.progress', runId: id, stage: 'render', pct: e.pct });
          }
        },
      });
      if (renderStarted) await finishStage(id, 'render', 'done');
      if (cancelled) throw new Error('cancelled');

      await startStage(id, 'ffmpeg');
      const webOut = join(runDir, 'out', 'web.mp4');
      const ff = await runFfmpeg({ inFile: rawOut, outFile: webOut, onStdout: s => log(runDir, s) });
      await finishStage(id, 'ffmpeg', 'done');

      // Probe composition metadata
      const comps = await probeCompositions(deps.projectRoot);
      const c = comps.find(x => x.id === compositionId);

      await deps.store.update(id, m => ({
        ...m,
        status: 'succeeded',
        outputs: {
          raw: { path: rawOut, bytes: renderRes.bytes },
          web: { path: webOut, bytes: ff.bytes },
          width: c?.width ?? 0, height: c?.height ?? 0, fps: c?.fps ?? 0,
          durationSec: c ? c.durationInFrames / c.fps : 0,
        },
        totals: { wallMs: Date.now() - runStartMs },
      }));
      deps.bus.publish({ kind: 'run.finished', runId: id, status: 'succeeded', totalMs: Date.now() - runStartMs });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const status: RunMeta['status'] = cancelled ? 'cancelled' : 'failed';
      // mark any still-running stage failed
      await deps.store.update(id, m => ({
        ...m, status,
        stages: m.stages.map(s => s.status === 'running' ? { ...s, status: 'failed', endedAt: new Date().toISOString(), error: msg } : s),
        totals: { wallMs: Date.now() - runStartMs },
      }));
      deps.bus.publish({ kind: 'run.finished', runId: id, status, totalMs: Date.now() - runStartMs });
    } finally {
      active = null;
    }
    return await deps.store.get(id);
  }

  function cancel(id: string): boolean {
    if (active?.id !== id) return false;
    active.abort();
    return true;
  }

  return { start, cancel, isBusy: () => active !== null };
}
```

- [ ] **Step 3: Commit**

```bash
git add runner/server/pipeline.ts runner/server/config.ts
git commit -m "feat(runner): pipeline orchestrator with stage transitions"
```

---

## Task 13: Express server + routes + SSE

**Files:**
- Create: `runner/server/index.ts`

- [ ] **Step 1: Implement**

```ts
// runner/server/index.ts
import express from 'express';
import { z } from 'zod';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { CONFIG } from './config.js';
import { createRunsStore } from './runs.js';
import { createEventBus } from './events.js';
import { createPipeline, PipelineBusy } from './pipeline.js';
import { probeCompositions } from './stages/remotion.js';

const store = createRunsStore(join(CONFIG.projectRoot, CONFIG.runsDir));
const bus = createEventBus();
const pipeline = createPipeline({ store, bus, projectRoot: CONFIG.projectRoot, claudeBin: CONFIG.claudeBin });

await store.recoverOrphans();

const app = express();
app.use(express.json({ limit: '2mb' }));

const startSchema = z.object({
  mode: z.enum(['prompt', 'structured', 'composition']),
  slug: z.string().min(1).max(80),
  compositionId: z.string().optional(),
  prompt: z.string().optional(),
  scriptJson: z.unknown().optional(),
});

app.get('/api/compositions', async (_req, res) => {
  try { res.json(await probeCompositions(CONFIG.projectRoot)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/runs', async (_req, res) => res.json(await store.list()));

app.get('/api/runs/:id', async (req, res) => {
  try { res.json(await store.get(req.params.id)); }
  catch { res.status(404).json({ error: 'not found' }); }
});

app.post('/api/runs', async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const meta = await pipeline.start(parsed.data);
    res.status(202).json(meta);
  } catch (e) {
    if (e instanceof PipelineBusy) res.status(409).json({ error: 'pipeline busy' });
    else res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/runs/:id/cancel', (req, res) => {
  const ok = pipeline.cancel(req.params.id);
  res.status(ok ? 202 : 404).json({ cancelled: ok });
});

app.get('/api/runs/:id/events', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (e: any) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  // replay current snapshot first
  try { send({ kind: 'snapshot', meta: await store.get(req.params.id) }); } catch {}
  const unsub = bus.subscribe(req.params.id, send);
  req.on('close', () => unsub());
});

app.get('/api/runs/:id/log', async (req, res) => {
  const p = store.pathFor(req.params.id, 'log.txt');
  if (!existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

app.use('/files/runs', express.static(join(CONFIG.projectRoot, CONFIG.runsDir)));

const webDist = join(CONFIG.projectRoot, 'runner', 'web', 'dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(join(webDist, 'index.html')));
}

app.listen(CONFIG.port, () => {
  console.log(`Runner up on http://localhost:${CONFIG.port}`);
});

const shutdown = async () => {
  console.log('Shutting down…');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

- [ ] **Step 2: Smoke check it boots**

```bash
npx tsx runner/server/index.ts &
sleep 2
curl -s http://localhost:4317/api/runs
kill %1
```

Expected: prints `[]` (empty array — no runs yet).

- [ ] **Step 3: Commit**

```bash
git add runner/server/index.ts
git commit -m "feat(runner): express server with SSE + REST endpoints"
```

---

## Task 14: Vite + React skeleton

**Files:**
- Create: `runner/web/index.html`
- Create: `runner/web/vite.config.ts`
- Create: `runner/web/src/main.tsx`
- Create: `runner/web/src/App.tsx`
- Create: `runner/web/tsconfig.json`

- [ ] **Step 1: `vite.config.ts`**

```ts
// runner/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 4318,
    proxy: {
      '/api': 'http://localhost:4317',
      '/files': 'http://localhost:4317',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
```

- [ ] **Step 2: `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Remotion Runner</title>
    <style>
      body { font-family: -apple-system, Segoe UI, sans-serif; margin: 0; background: #0e0e10; color: #eee; }
      a { color: #9bf; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: `tsconfig.json` for web**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "types": ["vite/client"] },
  "include": ["src"]
}
```

- [ ] **Step 4: `main.tsx` + `App.tsx`**

```tsx
// runner/web/src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>,
);
```

```tsx
// runner/web/src/App.tsx
import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { NewRun } from './pages/NewRun.js';
import { RunDetail } from './pages/RunDetail.js';
import { History } from './pages/History.js';

export const App: React.FC = () => (
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
    <header style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Remotion Runner</h1>
      <nav style={{ display: 'flex', gap: 16 }}>
        <Link to="/">New run</Link>
        <Link to="/history">History</Link>
      </nav>
    </header>
    <Routes>
      <Route path="/" element={<NewRun />} />
      <Route path="/history" element={<History />} />
      <Route path="/runs/:id" element={<RunDetail />} />
    </Routes>
  </div>
);
```

- [ ] **Step 5: Commit**

```bash
git add runner/web/index.html runner/web/vite.config.ts runner/web/tsconfig.json runner/web/src/main.tsx runner/web/src/App.tsx
git commit -m "feat(web): vite + react shell"
```

---

## Task 15: Web API client + SSE hook + types mirror

**Files:**
- Create: `runner/web/src/lib/types.ts`
- Create: `runner/web/src/lib/api.ts`
- Create: `runner/web/src/lib/sse.ts`

- [ ] **Step 1: Types mirror**

Copy the type declarations from `runner/server/types.ts` verbatim into `runner/web/src/lib/types.ts` (drop the imports from `./types.js`). This keeps web/server in sync without a build dependency.

```ts
// runner/web/src/lib/types.ts
export type RunMode = 'prompt' | 'structured' | 'composition';
export type StageName = 'claude' | 'scaffold' | 'bundle' | 'render' | 'ffmpeg';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface StageRecord { name: StageName; status: StageStatus; startedAt?: string; endedAt?: string; durationMs?: number; error?: string }
export interface RunOutputs { raw: { path: string; bytes: number }; web: { path: string; bytes: number }; durationSec: number; width: number; height: number; fps: number }
export interface RunMeta { id: string; slug: string; createdAt: string; mode: RunMode; compositionId: string; status: RunStatus; stages: StageRecord[]; outputs?: RunOutputs; totals?: { wallMs: number } }
export type RunEvent =
  | { kind: 'snapshot'; meta: RunMeta }
  | { kind: 'run.started'; runId: string; mode: RunMode; stages: StageName[] }
  | { kind: 'stage.started'; runId: string; stage: StageName; at: string }
  | { kind: 'stage.progress'; runId: string; stage: StageName; pct?: number; note?: string }
  | { kind: 'stage.finished'; runId: string; stage: StageName; status: 'done'|'failed'|'skipped'; durationMs: number; error?: string }
  | { kind: 'run.finished'; runId: string; status: 'succeeded'|'failed'|'cancelled'; totalMs: number };
```

- [ ] **Step 2: API client**

```ts
// runner/web/src/lib/api.ts
import type { RunMeta } from './types.js';
export type CompositionInfo = { id: string; width: number; height: number; fps: number; durationInFrames: number };

const j = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

export const api = {
  compositions: () => j<CompositionInfo[]>('/api/compositions'),
  listRuns: () => j<RunMeta[]>('/api/runs'),
  getRun: (id: string) => j<RunMeta>(`/api/runs/${id}`),
  startRun: (body: any) => j<RunMeta>('/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  cancelRun: (id: string) => fetch(`/api/runs/${id}/cancel`, { method: 'POST' }),
  fileUrl: (id: string, name: 'raw.mp4'|'web.mp4') => `/files/runs/${encodeURIComponent(id)}/out/${name}`,
};
```

- [ ] **Step 3: SSE hook**

```ts
// runner/web/src/lib/sse.ts
import { useEffect, useState } from 'react';
import type { RunEvent, RunMeta } from './types.js';

export function useRunStream(id: string | undefined) {
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [progressByStage, setProgressByStage] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/runs/${id}/events`);
    es.onmessage = ev => {
      const e = JSON.parse(ev.data) as RunEvent;
      if (e.kind === 'snapshot') setMeta(e.meta);
      else if (e.kind === 'stage.started') setMeta(m => m && ({ ...m, stages: m.stages.map(s => s.name === e.stage ? { ...s, status: 'running', startedAt: e.at } : s) }));
      else if (e.kind === 'stage.progress' && e.pct != null) setProgressByStage(p => ({ ...p, [e.stage]: e.pct! }));
      else if (e.kind === 'stage.finished') setMeta(m => m && ({ ...m, stages: m.stages.map(s => s.name === e.stage ? { ...s, status: e.status, durationMs: e.durationMs, error: e.error } : s) }));
      else if (e.kind === 'run.finished') {
        setMeta(m => m && ({ ...m, status: e.status, totals: { wallMs: e.totalMs } }));
        es.close();
      }
    };
    return () => es.close();
  }, [id]);
  return { meta, progressByStage };
}
```

- [ ] **Step 4: Commit**

```bash
git add runner/web/src/lib
git commit -m "feat(web): api client, SSE hook, shared types"
```

---

## Task 16: NewRun page

**Files:**
- Create: `runner/web/src/pages/NewRun.tsx`
- Create: `runner/web/src/components/ModeTabs.tsx`

- [ ] **Step 1: `ModeTabs.tsx`**

```tsx
// runner/web/src/components/ModeTabs.tsx
import React from 'react';
import type { RunMode } from '../lib/types.js';
const MODES: { value: RunMode; label: string }[] = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'structured', label: 'Structured JSON' },
  { value: 'composition', label: 'Existing composition' },
];
export const ModeTabs: React.FC<{ value: RunMode; onChange: (m: RunMode) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #333' }}>
    {MODES.map(m => (
      <button key={m.value} onClick={() => onChange(m.value)} style={{
        background: 'transparent', color: value === m.value ? '#CCFF00' : '#aaa',
        border: 'none', borderBottom: value === m.value ? '2px solid #CCFF00' : '2px solid transparent',
        padding: '10px 16px', cursor: 'pointer', fontSize: 14,
      }}>{m.label}</button>
    ))}
  </div>
);
```

- [ ] **Step 2: `NewRun.tsx`**

```tsx
// runner/web/src/pages/NewRun.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModeTabs } from '../components/ModeTabs.js';
import { api, type CompositionInfo } from '../lib/api.js';
import type { RunMode } from '../lib/types.js';

const SAMPLE_STRUCTURED = JSON.stringify({
  title: 'My video', width: 1080, height: 1920, fps: 30,
  scenes: [
    { kind: 'title', durationSec: 3, props: { title: 'Hello', subtitle: 'World' } },
    { kind: 'bullets', durationSec: 5, props: { items: ['One', 'Two', 'Three'] } },
    { kind: 'cta', durationSec: 3, props: { text: 'go.example' } },
  ],
}, null, 2);

export const NewRun: React.FC = () => {
  const nav = useNavigate();
  const [mode, setMode] = useState<RunMode>('prompt');
  const [slug, setSlug] = useState('');
  const [prompt, setPrompt] = useState('');
  const [json, setJson] = useState(SAMPLE_STRUCTURED);
  const [compId, setCompId] = useState('');
  const [comps, setComps] = useState<CompositionInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.compositions().then(setComps).catch(() => setComps([])); }, []);

  const onSubmit = async () => {
    setBusy(true); setErr('');
    try {
      const body: any = { mode, slug: slug || `run-${Date.now()}` };
      if (mode === 'prompt') { body.prompt = prompt; body.compositionId = compId || `Generated${Date.now()}`; }
      if (mode === 'structured') body.scriptJson = JSON.parse(json);
      if (mode === 'composition') body.compositionId = compId;
      const meta = await api.startRun(body);
      nav(`/runs/${meta.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  const input = { background: '#181818', color: '#eee', border: '1px solid #333', padding: 8, width: '100%', borderRadius: 4, fontFamily: 'inherit' };

  return (
    <div>
      <ModeTabs value={mode} onChange={setMode} />
      <div style={{ display: 'grid', gap: 16 }}>
        <label>Slug<input style={input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="my-video" /></label>

        {mode === 'prompt' && (<>
          <label>Composition id (will be created)<input style={input} value={compId} onChange={e => setCompId(e.target.value)} placeholder="ProductDemo" /></label>
          <label>Prompt<textarea style={{ ...input, minHeight: 220, fontFamily: 'monospace' }} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
        </>)}

        {mode === 'structured' && (
          <label>Script JSON<textarea style={{ ...input, minHeight: 360, fontFamily: 'monospace' }} value={json} onChange={e => setJson(e.target.value)} /></label>
        )}

        {mode === 'composition' && (
          <label>Composition
            <select style={input as any} value={compId} onChange={e => setCompId(e.target.value)}>
              <option value="">— choose —</option>
              {comps.map(c => <option key={c.id} value={c.id}>{c.id} ({c.width}×{c.height} @ {c.fps}fps, {(c.durationInFrames/c.fps).toFixed(1)}s)</option>)}
            </select>
          </label>
        )}

        {err && <div style={{ color: '#f88' }}>{err}</div>}
        <button onClick={onSubmit} disabled={busy} style={{ background: '#CCFF00', color: '#000', border: 'none', padding: '12px 20px', fontWeight: 700, borderRadius: 6, cursor: 'pointer', alignSelf: 'flex-start' }}>
          {busy ? 'Starting…' : 'Start render'}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add runner/web/src/components/ModeTabs.tsx runner/web/src/pages/NewRun.tsx
git commit -m "feat(web): NewRun page with three input modes"
```

---

## Task 17: RunDetail page (StageTimeline + VideoPlayer + MetaPanel)

**Files:**
- Create: `runner/web/src/components/StageTimeline.tsx`
- Create: `runner/web/src/components/VideoPlayer.tsx`
- Create: `runner/web/src/components/MetaPanel.tsx`
- Create: `runner/web/src/pages/RunDetail.tsx`

- [ ] **Step 1: `StageTimeline.tsx`**

```tsx
// runner/web/src/components/StageTimeline.tsx
import React from 'react';
import type { StageRecord } from '../lib/types.js';

const COLOR: Record<string, string> = { pending: '#444', running: '#CCFF00', done: '#3c3', failed: '#f55', skipped: '#888' };
const fmt = (ms?: number) => ms == null ? '' : ms > 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`;

export const StageTimeline: React.FC<{ stages: StageRecord[]; progressByStage: Record<string, number> }> = ({ stages, progressByStage }) => (
  <ol style={{ listStyle: 'none', padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {stages.map(s => {
      const pct = progressByStage[s.name];
      return (
        <li key={s.name} style={{ flex: '1 1 160px', background: '#181818', border: `1px solid ${COLOR[s.status]}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{s.name}</div>
          <div style={{ color: COLOR[s.status], fontSize: 12, marginTop: 4 }}>{s.status} {fmt(s.durationMs)}</div>
          {s.status === 'running' && pct != null && (
            <div style={{ height: 4, background: '#222', marginTop: 8, borderRadius: 2 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#CCFF00' }} />
            </div>
          )}
          {s.error && <div style={{ color: '#f88', fontSize: 11, marginTop: 6 }}>{s.error}</div>}
        </li>
      );
    })}
  </ol>
);
```

- [ ] **Step 2: `VideoPlayer.tsx`**

```tsx
// runner/web/src/components/VideoPlayer.tsx
import React from 'react';
export const VideoPlayer: React.FC<{ src: string }> = ({ src }) => (
  <video src={src} controls style={{ width: '100%', maxHeight: '60vh', background: '#000', borderRadius: 8 }} />
);
```

- [ ] **Step 3: `MetaPanel.tsx`**

```tsx
// runner/web/src/components/MetaPanel.tsx
import React from 'react';
import type { RunMeta } from '../lib/types.js';
const kb = (b: number) => b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`;
export const MetaPanel: React.FC<{ meta: RunMeta }> = ({ meta }) => (
  <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '6px 16px', fontSize: 14 }}>
    <dt style={{ color: '#888' }}>Mode</dt><dd style={{ margin: 0 }}>{meta.mode}</dd>
    <dt style={{ color: '#888' }}>Composition</dt><dd style={{ margin: 0 }}>{meta.compositionId}</dd>
    <dt style={{ color: '#888' }}>Status</dt><dd style={{ margin: 0 }}>{meta.status}</dd>
    {meta.outputs && (<>
      <dt style={{ color: '#888' }}>Resolution</dt><dd style={{ margin: 0 }}>{meta.outputs.width}×{meta.outputs.height} @ {meta.outputs.fps}fps</dd>
      <dt style={{ color: '#888' }}>Duration</dt><dd style={{ margin: 0 }}>{meta.outputs.durationSec.toFixed(1)}s</dd>
      <dt style={{ color: '#888' }}>Raw size</dt><dd style={{ margin: 0 }}>{kb(meta.outputs.raw.bytes)}</dd>
      <dt style={{ color: '#888' }}>Web size</dt><dd style={{ margin: 0 }}>{kb(meta.outputs.web.bytes)}</dd>
    </>)}
    {meta.totals && (<><dt style={{ color: '#888' }}>Wall time</dt><dd style={{ margin: 0 }}>{(meta.totals.wallMs/1000).toFixed(1)}s</dd></>)}
  </dl>
);
```

- [ ] **Step 4: `RunDetail.tsx`**

```tsx
// runner/web/src/pages/RunDetail.tsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRunStream } from '../lib/sse.js';
import { api } from '../lib/api.js';
import { StageTimeline } from '../components/StageTimeline.js';
import { VideoPlayer } from '../components/VideoPlayer.js';
import { MetaPanel } from '../components/MetaPanel.js';

export const RunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { meta, progressByStage } = useRunStream(id);
  const [showLog, setShowLog] = useState(false);
  const [logText, setLogText] = useState('');

  if (!meta) return <p>Loading…</p>;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{meta.slug}</h2>
          <code style={{ color: '#888', fontSize: 12 }}>{meta.id}</code>
        </div>
        {meta.status === 'running' && (
          <button onClick={() => api.cancelRun(meta.id)} style={{ background: '#f55', color: '#000', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        )}
      </header>

      <StageTimeline stages={meta.stages} progressByStage={progressByStage} />

      {meta.status === 'succeeded' && (
        <>
          <VideoPlayer src={api.fileUrl(meta.id, 'web.mp4')} />
          <div style={{ display: 'flex', gap: 12 }}>
            <a href={api.fileUrl(meta.id, 'web.mp4')} download style={{ background: '#CCFF00', color: '#000', padding: '8px 14px', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>Download web.mp4</a>
            <a href={api.fileUrl(meta.id, 'raw.mp4')} download style={{ background: '#222', color: '#eee', padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }}>Download raw.mp4</a>
          </div>
        </>
      )}

      <MetaPanel meta={meta} />

      {meta.status === 'failed' && (
        <div style={{ background: '#3a1414', border: '1px solid #f55', padding: 12, borderRadius: 6 }}>
          <strong>Failed.</strong>
          <button onClick={async () => { setShowLog(s => !s); if (!showLog && !logText) setLogText(await (await fetch(`/api/runs/${meta.id}/log`)).text()); }}
            style={{ background: 'transparent', color: '#9bf', border: 'none', cursor: 'pointer', marginLeft: 12 }}>
            {showLog ? 'Hide log' : 'Show full log'}
          </button>
          {showLog && <pre style={{ maxHeight: 300, overflow: 'auto', background: '#0a0a0a', padding: 12, marginTop: 12, fontSize: 11 }}>{logText}</pre>}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Commit**

```bash
git add runner/web/src/components/StageTimeline.tsx runner/web/src/components/VideoPlayer.tsx runner/web/src/components/MetaPanel.tsx runner/web/src/pages/RunDetail.tsx
git commit -m "feat(web): RunDetail with stage timeline, video player, meta, log"
```

---

## Task 18: History page

**Files:**
- Create: `runner/web/src/pages/History.tsx`

- [ ] **Step 1: Implement**

```tsx
// runner/web/src/pages/History.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import type { RunMeta } from '../lib/types.js';

const STATUS_COLOR: Record<string, string> = { running: '#CCFF00', succeeded: '#3c3', failed: '#f55', cancelled: '#888', queued: '#888' };

export const History: React.FC = () => {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  useEffect(() => { api.listRuns().then(setRuns); }, []);
  if (!runs.length) return <p>No runs yet. <Link to="/">Start one →</Link></p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr><th align="left">When</th><th align="left">Slug</th><th align="left">Mode</th><th align="left">Status</th><th align="right">Wall</th></tr></thead>
      <tbody>
        {runs.map(r => (
          <tr key={r.id} style={{ borderTop: '1px solid #222' }}>
            <td><Link to={`/runs/${r.id}`} style={{ color: '#9bf' }}>{new Date(r.createdAt).toLocaleString()}</Link></td>
            <td>{r.slug}</td>
            <td style={{ color: '#888' }}>{r.mode}</td>
            <td><span style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span></td>
            <td align="right" style={{ color: '#888' }}>{r.totals ? `${(r.totals.wallMs/1000).toFixed(1)}s` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add runner/web/src/pages/History.tsx
git commit -m "feat(web): history page"
```

---

## Task 19: `start-runner.bat` + end-to-end smoke

**Files:**
- Create: `start-runner.bat`

- [ ] **Step 1: `start-runner.bat`**

```bat
@echo off
cd /d "%~dp0"
start "" http://localhost:4317
call npm run runner
```

- [ ] **Step 2: Build and run end-to-end**

```bash
npm run web:build
npx tsx runner/server/index.ts &
sleep 3
curl -s -X POST http://localhost:4317/api/runs \
  -H "content-type: application/json" \
  -d "{\"mode\":\"composition\",\"slug\":\"smoke\",\"compositionId\":\"DataChart\"}"
sleep 2
curl -s http://localhost:4317/api/runs | head -c 400
```

Expected: a non-empty JSON list with one run in `running` or `succeeded` status. Wait ~30s, then `curl /api/runs` again — status should be `succeeded` and `runs/<id>/out/web.mp4` should exist.

- [ ] **Step 3: Verify output file**

```bash
ls -la runs/*/out/
```

Expected: at least one `web.mp4` and one `raw.mp4`, both non-zero bytes.

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add start-runner.bat
git commit -m "feat: start-runner.bat launcher"
```

---

## Task 20: README addendum

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a "Runner App" section**

Append after the existing "Optional — add an MCP server" section:

```markdown
---

## Runner App (local web UI)

A bundled local web app drives the pipeline interactively. From the repo root:

```bash
npm install
npm run runner          # production: builds web, starts server on :4317
# or
npm run runner:dev      # dev: vite + tsx watch on :4318 (web) + :4317 (api)
```

Or double-click `start-runner.bat` on Windows.

Open http://localhost:4317. Three input modes:
- **Prompt** — natural language; spawns `claude` CLI to write a new composition.
- **Structured JSON** — fills the bundled `StructuredScript` composition.
- **Existing composition** — pick any composition registered in `src/Root.tsx`.

Stage progress streams over SSE. Completed runs are stored under `runs/<timestamp>_<slug>/` with the script, the rendered MP4s, a meta.json, and the full log.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: runner app section"
```

---

## Self-Review

**Spec coverage check:**
- §3 architecture → Tasks 12, 13 ✓
- §4 repo layout → Task 1 + scattered ✓
- §5 run lifecycle / states / stages → Tasks 2, 3, 12 ✓
- §5.3 meta.json shape → Task 2 (types), Task 3 (storage) ✓
- §6.1 prompt mode + marker fallback → Task 8 ✓
- §6.2 structured mode + StructuredScript comp → Tasks 7, 9 ✓
- §6.3 composition mode + dropdown → Tasks 12, 13 (`/api/compositions`), Task 16 (UI) ✓
- §7 HTTP API → Task 13 ✓
- §8 SSE event shape → Tasks 2, 13, 15 ✓
- §9 UI screens (NewRun / RunDetail / History) → Tasks 16, 17, 18 ✓
- §10 process management (cancel, taskkill) → Task 12 (cancel hook), gap: Windows `taskkill` for child trees not yet wired in stage runners. Documented as best-effort `cancelled` flag; sufficient for v1.
- §11 error handling (atomic writes, log.txt, slug collisions) → Tasks 3, 12 ✓
- §11 startup recovery → Tasks 3, 13 (`store.recoverOrphans` on boot) ✓
- §12 config → Task 12 ✓
- §13 start-runner.bat → Task 19 ✓
- §14 deps → Task 1 ✓
- §15 testing → Tasks 3, 4, 5, 6 (unit), Task 19 (smoke E2E) ✓

**Placeholder scan:** No "TBD"/"TODO"/"add error handling later". Every code step shows full code.

**Type consistency:** `RunsStore` interface defined in Task 3 used by Tasks 12, 13. `RunEvent` defined in Task 2 used in Tasks 4, 12, 13, 15. `StageName` strings consistent throughout (`'claude' | 'scaffold' | 'bundle' | 'render' | 'ffmpeg'`).
