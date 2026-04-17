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
