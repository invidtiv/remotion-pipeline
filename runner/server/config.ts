// runner/server/config.ts
export const CONFIG = {
  port: parseInt(process.env.RUNNER_PORT ?? '4317', 10),
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
  projectRoot: process.cwd(),
  runsDir: 'runs',
};
