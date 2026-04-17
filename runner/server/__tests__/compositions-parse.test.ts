// runner/server/__tests__/compositions-parse.test.ts
import { describe, it, expect } from 'vitest';
import { parseCompositionsOutput } from '../stages/remotion.js';

describe('parseCompositionsOutput', () => {
  it('parses the human-readable remotion table', () => {
    const sample = `Bundling code        ━━━━━━━━━━━━━━━━━━ 100%
Bundled code         ━━━━━━━━━━━━━━━━━━ 1480ms

The following compositions are available:

DataChart           30      1920x1080      130 (4.33 sec)
StructuredScript    30      1080x1920      300 (10.00 sec)
`;
    expect(parseCompositionsOutput(sample)).toEqual([
      { id: 'DataChart', fps: 30, width: 1920, height: 1080, durationInFrames: 130 },
      { id: 'StructuredScript', fps: 30, width: 1080, height: 1920, durationInFrames: 300 },
    ]);
  });

  it('strips ANSI color codes', () => {
    const colored = '\x1b[36mFoo\x1b[0m  60  3840x2160  600 (10 sec)\n';
    expect(parseCompositionsOutput(colored)).toEqual([
      { id: 'Foo', fps: 60, width: 3840, height: 2160, durationInFrames: 600 },
    ]);
  });
});
