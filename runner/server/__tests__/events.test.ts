// runner/server/__tests__/events.test.ts
import { describe, it, expect } from 'vitest';
import { createEventBus } from '../events.js';
import type { RunEvent } from '../types.js';

describe('event bus', () => {
  it('delivers events to subscribers of a runId', () => {
    const bus = createEventBus();
    const got: RunEvent[] = [];
    bus.subscribe('R1', e => got.push(e));
    bus.publish({ kind: 'run.started', runId: 'R1', mode: 'composition', stages: ['bundle','render','ffmpeg'] });
    bus.publish({ kind: 'run.started', runId: 'R2', mode: 'composition', stages: ['bundle','render','ffmpeg'] });
    expect(got).toHaveLength(1);
    expect(got[0].runId).toBe('R1');
  });

  it('unsubscribe removes the handler', () => {
    const bus = createEventBus();
    const got: RunEvent[] = [];
    const unsub = bus.subscribe('R1', e => got.push(e));
    unsub();
    bus.publish({ kind: 'run.started', runId: 'R1', mode: 'composition', stages: [] });
    expect(got).toHaveLength(0);
  });
});
