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
