// runner/server/config.ts
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Resolves an absolute path to the `claude` CLI by checking, in order:
//   1. CLAUDE_BIN env var (if it points to an existing file or is just "claude")
//   2. The platform's `where`/`which` lookup
//   3. The npm globals prefix + `claude(.cmd)` (covers the common Windows case
//      where the npm prefix isn't on PATH)
//   4. Bare "claude" — last resort, may fail at spawn time with a clear error
function resolveClaudeBin(): string {
  const env = process.env.CLAUDE_BIN;
  if (env && (env === 'claude' || existsSync(env))) return env;

  const lookup = process.platform === 'win32' ? 'where' : 'which';
  try {
    const found = execFileSync(lookup, ['claude'], { encoding: 'utf8', shell: false })
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
    if (found && existsSync(found)) return found;
  } catch { /* not on PATH */ }

  try {
    const prefix = execFileSync('npm', ['config', 'get', 'prefix'], { encoding: 'utf8', shell: true }).trim();
    if (prefix) {
      const candidates = process.platform === 'win32'
        ? [join(prefix, 'claude.cmd'), join(prefix, 'claude.exe'), join(prefix, 'claude')]
        : [join(prefix, 'bin', 'claude')];
      for (const c of candidates) if (existsSync(c)) return c;
    }
  } catch { /* npm not on PATH either */ }

  return 'claude';
}

// Resolves the ffmpeg invocation as an array (binary + leading args).
// Prefers a system install; falls back to `npx remotion ffmpeg` which ships
// with Remotion 4. Returning an array lets the caller spawn either a single
// binary or `npx remotion ffmpeg <args>` uniformly.
function resolveFfmpegCmd(): string[] {
  const env = process.env.FFMPEG_BIN;
  if (env && existsSync(env)) return [env];

  const lookup = process.platform === 'win32' ? 'where' : 'which';
  try {
    const found = execFileSync(lookup, ['ffmpeg'], { encoding: 'utf8', shell: false })
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
    if (found && existsSync(found)) return [found];
  } catch { /* not on PATH */ }

  // Bundled with Remotion 4 — guaranteed available since `remotion` is a dep.
  return ['npx', 'remotion', 'ffmpeg'];
}

export const CONFIG = {
  port: parseInt(process.env.RUNNER_PORT ?? '4317', 10),
  claudeBin: resolveClaudeBin(),
  ffmpegCmd: resolveFfmpegCmd(),
  projectRoot: process.cwd(),
  runsDir: 'runs',
};
