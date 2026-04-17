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
