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
