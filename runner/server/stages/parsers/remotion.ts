// runner/server/stages/parsers/remotion.ts
export type RemotionEvent =
  | { type: 'bundle.start' }
  | { type: 'bundle.done' }
  | { type: 'render.start' }
  | { type: 'render.progress'; pct: number }
  | { type: 'render.done' };

export interface RemotionParser {
  feed(chunk: string): void;
}

export function createRemotionParser(emit: (e: RemotionEvent) => void): RemotionParser {
  let buf = '';
  let bundleStarted = false;
  let bundleDone = false;
  let renderStarted = false;
  let renderDone = false;

  const handleLine = (line: string) => {
    if (!bundleStarted && /^Bundling/i.test(line)) {
      bundleStarted = true;
      emit({ type: 'bundle.start' });
    }
    if (!bundleDone && /^Bundled in/i.test(line)) {
      bundleDone = true;
      emit({ type: 'bundle.done' });
      return;
    }
    if (bundleDone && !renderStarted) {
      renderStarted = true;
      emit({ type: 'render.start' });
    }
    if (bundleDone && !renderDone) {
      const pctMatch = line.match(/(\d+)\s*%/);
      if (pctMatch) emit({ type: 'render.progress', pct: parseInt(pctMatch[1], 10) });
    }
    if (!renderDone && /Encoded all frames/i.test(line)) {
      renderDone = true;
      emit({ type: 'render.done' });
    }
  };

  return {
    feed(chunk) {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) handleLine(line);
      }
    },
  };
}
