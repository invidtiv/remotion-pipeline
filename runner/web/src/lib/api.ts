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
  startRun: (body: any) => j<RunMeta>('/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }),
  cancelRun: (id: string) => fetch(`/api/runs/${id}/cancel`, { method: 'POST' }),
  fileUrl: (id: string, name: 'raw.mp4'|'web.mp4') =>
    `/files/runs/${encodeURIComponent(id)}/out/${name}`,
};
