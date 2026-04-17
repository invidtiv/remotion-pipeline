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
