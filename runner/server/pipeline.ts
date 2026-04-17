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
  compositionId?: string;
  prompt?: string;
  scriptJson?: unknown;
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

  async function runPipeline(id: string, req: StartRunRequest, initialMeta: RunMeta, getCancelled: () => boolean) {
    const runDir = deps.store.pathFor(id);
    const stages = STAGES_BY_MODE[req.mode];
    deps.bus.publish({ kind: 'run.started', runId: id, mode: req.mode, stages });
    const runStartMs = Date.now();
    try {
      let compositionId = initialMeta.compositionId;
      let propsFile: string | undefined;

      if (req.mode === 'prompt') {
        await startStage(id, 'claude');
        await runClaude({
          prompt: req.prompt ?? '', compositionId,
          projectRoot: deps.projectRoot, runDir, claudeBin: deps.claudeBin,
          onStdout: s => log(runDir, s),
        });
        await finishStage(id, 'claude', 'done');
        if (getCancelled()) throw new Error('cancelled');
        await deps.store.update(id, m => ({ ...m, compositionId }));
      } else if (req.mode === 'structured') {
        await startStage(id, 'scaffold');
        const r = await runScaffold({ scriptJson: req.scriptJson, runDir });
        propsFile = r.propsFile;
        compositionId = r.compositionId;
        await deps.store.update(id, m => ({ ...m, compositionId }));
        await finishStage(id, 'scaffold', 'done');
        if (getCancelled()) throw new Error('cancelled');
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
      if (getCancelled()) throw new Error('cancelled');

      await startStage(id, 'ffmpeg');
      const webOut = join(runDir, 'out', 'web.mp4');
      const ff = await runFfmpeg({ inFile: rawOut, outFile: webOut, onStdout: s => log(runDir, s) });
      await finishStage(id, 'ffmpeg', 'done');

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
      const status: RunMeta['status'] = getCancelled() ? 'cancelled' : 'failed';
      await deps.store.update(id, m => ({
        ...m, status,
        stages: m.stages.map(s => s.status === 'running' ? { ...s, status: 'failed', endedAt: new Date().toISOString(), error: msg } : s),
        totals: { wallMs: Date.now() - runStartMs },
      }));
      deps.bus.publish({ kind: 'run.finished', runId: id, status, totalMs: Date.now() - runStartMs });
    } finally {
      active = null;
    }
  }

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

    let cancelled = false;
    active = { id, abort: () => { cancelled = true; } };

    void runPipeline(id, req, meta, () => cancelled);
    return meta;
  }

  function cancel(id: string): boolean {
    if (active?.id !== id) return false;
    active.abort();
    return true;
  }

  return { start, cancel, isBusy: () => active !== null };
}
