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
