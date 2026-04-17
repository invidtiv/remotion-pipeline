// runner/server/stages/ffmpeg.ts
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createFfmpegParser } from './parsers/ffmpeg.js';

export interface FfmpegStageInput {
  inFile: string;
  outFile: string;
  ffmpegCmd: string[];      // e.g. ['ffmpeg'] or ['npx','remotion','ffmpeg']
  onStarted?: () => void;
  onStdout?: (s: string) => void;
}

export interface FfmpegStageResult { bytes: number }

export function runFfmpeg(input: FfmpegStageInput): Promise<FfmpegStageResult> {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-y', '-i', input.inFile,
      '-c:v', 'libx264', '-crf', '28', '-preset', 'slow',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '128k',
      input.outFile,
    ];
    const [bin, ...prefix] = input.ffmpegCmd;
    const child = spawn(bin, [...prefix, ...ffmpegArgs], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const parser = createFfmpegParser(e => { if (e.type === 'started') input.onStarted?.(); });
    const onChunk = (b: Buffer) => { const s = b.toString(); input.onStdout?.(s); parser.feed(s); };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.on('exit', async code => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}`));
      try { resolve({ bytes: (await stat(input.outFile)).size }); } catch (e) { reject(e); }
    });
    child.on('error', reject);
  });
}
