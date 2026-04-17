// runner/server/stages/claude.ts
import { spawn } from 'node:child_process';
import { copyFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface ClaudeStageInput {
  prompt: string;
  compositionId: string;
  projectRoot: string;
  runDir: string;
  claudeBin: string;
  onStdout?: (s: string) => void;
}

export interface ClaudeStageResult {
  compositionFile: string;
}

const WRAPPER = (id: string, prompt: string) => `Create or update a Remotion composition with id "${id}".
Place it under src/compositions/${id}/index.tsx and register it in src/Root.tsx if missing.
The user wants:

${prompt}

When you are done, print exactly this on its own line, with the absolute path:
COMPOSITION_FILE: <absolute path to the .tsx file you wrote>
`;

const findNewestTsx = async (root: string): Promise<string | null> => {
  const dir = join(root, 'src', 'compositions');
  let newest: { p: string; m: number } | null = null;
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && e.name.endsWith('.tsx')) {
        const s = await stat(p);
        if (!newest || s.mtimeMs > newest.m) newest = { p, m: s.mtimeMs };
      }
    }
  };
  await walk(dir);
  return newest ? newest.p : null;
};

export function runClaude(input: ClaudeStageInput): Promise<ClaudeStageResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.claudeBin, ['--dangerously-skip-permissions'], {
      cwd: input.projectRoot,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let markerPath: string | null = null;
    const lineRe = /^COMPOSITION_FILE:\s*(.+)$/m;

    const onChunk = (data: Buffer) => {
      const s = data.toString();
      stdout += s;
      input.onStdout?.(s);
      const m = stdout.match(lineRe);
      if (m && !markerPath) markerPath = m[1].trim();
    };

    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.stdin.write(WRAPPER(input.compositionId, input.prompt));
    child.stdin.end();

    child.on('exit', async code => {
      if (code !== 0) return reject(new Error(`claude exited ${code}`));
      let file = markerPath;
      if (!file) file = await findNewestTsx(input.projectRoot);
      if (!file) return reject(new Error('claude finished but no composition file found'));
      try {
        await copyFile(file, join(input.runDir, 'composition.tsx'));
      } catch { /* non-fatal */ }
      resolve({ compositionFile: file });
    });
    child.on('error', reject);
  });
}
