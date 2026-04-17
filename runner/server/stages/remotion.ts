// runner/server/stages/remotion.ts
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createRemotionParser, type RemotionEvent } from './parsers/remotion.js';

export interface RemotionStageInput {
  projectRoot: string;
  compositionId: string;
  outFile: string;
  propsFile?: string;
  onEvent: (e: RemotionEvent) => void;
  onStdout?: (s: string) => void;
}

export interface RemotionStageResult {
  bytes: number;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}

export function runRemotion(input: RemotionStageInput): Promise<RemotionStageResult> {
  return new Promise((resolve, reject) => {
    const args = ['remotion', 'render', 'src/index.ts', input.compositionId, input.outFile];
    if (input.propsFile) args.push(`--props=${input.propsFile}`);
    args.push('--log=info');

    const child = spawn('npx', args, {
      cwd: input.projectRoot,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const parser = createRemotionParser(input.onEvent);

    const onChunk = (b: Buffer) => {
      const s = b.toString();
      input.onStdout?.(s);
      parser.feed(s);
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);

    child.on('exit', async code => {
      if (code !== 0) return reject(new Error(`remotion render exited ${code}`));
      try {
        const st = await stat(input.outFile);
        resolve({ bytes: st.size, width: 0, height: 0, fps: 0, durationSec: 0 });
      } catch (e) { reject(e); }
    });
    child.on('error', reject);
  });
}

export interface CompInfo { id: string; width: number; height: number; fps: number; durationInFrames: number }

// Parses the human-readable `npx remotion compositions` table.
// Lines look like: "DataChart           30      1920x1080      130 (4.33 sec)"
// Strips ANSI colors, splits on whitespace, validates shape.
const ANSI = /\x1b\[[0-9;]*m/g;
export function parseCompositionsOutput(text: string): CompInfo[] {
  const out: CompInfo[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(ANSI, '').trim();
    const m = line.match(/^([A-Za-z_][\w-]*)\s+(\d+)\s+(\d+)x(\d+)\s+(\d+)\b/);
    if (!m) continue;
    out.push({
      id: m[1],
      fps: parseInt(m[2], 10),
      width: parseInt(m[3], 10),
      height: parseInt(m[4], 10),
      durationInFrames: parseInt(m[5], 10),
    });
  }
  return out;
}

export function probeCompositions(projectRoot: string): Promise<CompInfo[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['remotion', 'compositions', 'src/index.ts'], {
      cwd: projectRoot, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { out += d.toString(); });
    child.on('exit', code => {
      if (code !== 0) return reject(new Error(`compositions exited ${code}`));
      try { resolve(parseCompositionsOutput(out)); }
      catch (e) { reject(e); }
    });
    child.on('error', reject);
  });
}
