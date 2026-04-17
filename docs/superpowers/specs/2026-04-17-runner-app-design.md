# Runner App — Design

**Status:** Approved 2026-04-17
**Scope:** A local web app, living in this repo, that takes a video script (in three forms), drives the Remotion + FFmpeg pipeline, streams stage-level progress to the browser, and presents the result with a history of past runs.

---

## 1. Goals

- Run on Windows from a single `.bat` shortcut.
- Accept three input modes: natural-language prompt, structured JSON script, or an existing Remotion `.tsx` composition.
- Stream stage-level progress (with timings) to the UI as the pipeline executes.
- Present finished videos with player, downloads, and metadata.
- Keep an inspectable on-disk history of every run.

## 2. Non-goals

- No multi-user / auth — strictly local single-user.
- No SQLite or DB — filesystem-only.
- No frame-by-frame live preview during render (stage-level only).
- No cloud rendering, queue, or job scheduler — runs execute serially.
- No mobile / responsive design — desktop browser at one window size.

## 3. High-level architecture

```
Browser (Vite + React)
        │  fetch / EventSource (SSE)
        ▼
Express server (Node, TypeScript)
        │  child_process.spawn
        ▼
   ┌─────────┬──────────────┬────────────┐
   │ claude  │ npx remotion │ compose.sh │
   │  (CLI)  │   render     │  (FFmpeg)  │
   └─────────┴──────────────┴────────────┘
        │
        ▼
   runs/<runId>/  (filesystem)
```

One Express process serves the React build and the API. Pipeline stages are spawned as child processes; their stdout/stderr is parsed for progress signals and lifecycle events are written to disk + broadcast via SSE.

## 4. Repo layout

```
remotionPipeline/
  src/                          # existing Remotion compositions (unchanged)
    Root.tsx
    compositions/
  runner/
    server/
      index.ts                  # Express entry: routes + static + SSE
      pipeline.ts               # orchestrator: drives stages, emits events
      stages/
        claude.ts               # mode=prompt → spawn `claude`
        scaffold.ts             # mode=structured → write composition.tsx from template
        remotion.ts             # spawn `npx remotion render`
        ffmpeg.ts               # spawn ./compose.sh
      runs.ts                   # CRUD on runs/ folder, meta.json read/write
      events.ts                 # in-process pub/sub + SSE adapter
      types.ts                  # shared event/state types
    web/
      index.html
      vite.config.ts
      src/
        main.tsx
        App.tsx
        pages/
          NewRun.tsx
          RunDetail.tsx
          History.tsx
        components/
          ModeTabs.tsx
          StageTimeline.tsx
          VideoPlayer.tsx
          MetaPanel.tsx
        lib/
          api.ts                # fetch wrappers
          sse.ts                # EventSource wrapper
          types.ts              # mirror of server/types.ts
  runs/                         # gitignored; one folder per run
    2026-04-17T21-03-12_acme-promo/
      input.json
      composition.tsx           # (only for prompt + structured modes)
      out/raw.mp4
      out/web.mp4
      meta.json
      log.txt                   # raw concatenated stdout/stderr per stage
  start-runner.bat              # `npm run runner` + opens browser
  package.json                  # one set of deps for compositions + runner
```

`.gitignore` adds: `runs/`, `runner/web/dist/`.

## 5. Run lifecycle

A run is identified by `runId = <ISO timestamp>_<slug>`. Slug is user-provided (or auto-derived from the first ~30 chars of the prompt).

### 5.1 States

```
queued → running → (succeeded | failed | cancelled)
```

Only one run at a time. A second `POST /runs` while one is `running` returns `409 Conflict`. (Simpler than a queue; matches single-user reality.)

### 5.2 Stages (the "workflow" the UI monitors)

Stage list depends on mode:

| Mode               | Stages                                                          |
|--------------------|-----------------------------------------------------------------|
| `prompt`           | `claude` → `bundle` → `render` → `ffmpeg` → `done`              |
| `structured`       | `scaffold` → `bundle` → `render` → `ffmpeg` → `done`            |
| `composition`      | `bundle` → `render` → `ffmpeg` → `done`                         |

Each stage transitions: `pending → running → (done | failed | skipped)`. Each carries `startedAt`, `endedAt`, `durationMs`.

`bundle` is reported as a sub-phase of the `npx remotion render` invocation — Remotion's CLI prints "Bundling" then "Rendering"; the `remotion.ts` stage parser splits these into two visible stages.

### 5.3 Persisted run state (`meta.json`)

```ts
{
  id: string;
  slug: string;
  createdAt: string;       // ISO
  mode: 'prompt' | 'structured' | 'composition';
  compositionId: string;   // Remotion <Composition id="...">
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  stages: Array<{
    name: 'claude' | 'scaffold' | 'bundle' | 'render' | 'ffmpeg';
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
    error?: string;        // short message; full text in log.txt
  }>;
  outputs?: {
    raw:  { path: string; bytes: number; };
    web:  { path: string; bytes: number; };
    durationSec: number;
    width: number;
    height: number;
    fps: number;
  };
  totals?: { wallMs: number; };
}
```

`meta.json` is rewritten on every state transition (atomic write: tmp file + rename).

## 6. Input modes

### 6.1 `prompt` mode
- UI: textarea + composition-id input + slug input.
- Server writes `input.json`, then runs the `claude` stage:
  - Spawns `claude --dangerously-skip-permissions` in the project root with stdin set to a wrapper prompt: *"Create or update a Remotion composition with id `<id>`. Register it in src/Root.tsx. The user wants: <user prompt>. When done, print the line `COMPOSITION_FILE: <absolute path>` on its own line."*
  - Captures the path from the marker line. Fallback: if no marker, snapshot `git status --porcelain` before/after and use the newest `.tsx` under `src/compositions/`. Copies the resulting `.tsx` into `runs/<id>/composition.tsx` for the record.
  - On non-zero exit, stage fails; pipeline halts.

### 6.2 `structured` mode
- UI: JSON editor (Monaco or just `<textarea>` for v1) with a schema hint.
- Schema (v1, intentionally minimal):
  ```ts
  {
    title: string;
    width: 1080 | 1920;
    height: 1080 | 1920;
    fps: 30 | 60;
    scenes: Array<{ kind: 'title' | 'bullets' | 'cta'; durationSec: number; props: Record<string, unknown> }>;
  }
  ```
- `scaffold` stage renders this through a fixed template composition `StructuredScript` (lives in `src/compositions/StructuredScript/`) that switches on `kind`. No code generation; the composition reads the JSON as input props. The "scaffold" step is therefore mostly: write the input props file and pick the comp id `StructuredScript`.

### 6.3 `composition` mode
- UI: dropdown listing composition ids from `src/Root.tsx` (parsed at server start by importing the bundle metadata via `npx remotion compositions --output=json`, cached).
- No `claude` or `scaffold` stage; goes straight to `bundle`.

## 7. HTTP API

| Method | Path                       | Purpose                                                |
|--------|----------------------------|--------------------------------------------------------|
| GET    | `/api/compositions`        | List comp ids from current Remotion project            |
| GET    | `/api/runs`                | List runs (newest first), summary fields only          |
| GET    | `/api/runs/:id`            | Full run meta                                          |
| POST   | `/api/runs`                | Create + start a run; body = `{mode, slug, ...}`       |
| POST   | `/api/runs/:id/cancel`     | Kill the running pipeline                              |
| GET    | `/api/runs/:id/events`     | SSE stream of pipeline events for that run             |
| GET    | `/api/runs/:id/log`        | Raw `log.txt` (text/plain)                             |
| GET    | `/files/runs/:id/out/:f`   | Static serve of MP4s for `<video>` and downloads       |

## 8. SSE event shape

One event type, payload discriminated by `kind`:

```ts
type RunEvent =
  | { kind: 'run.started';   runId: string; mode: string; stages: string[] }
  | { kind: 'stage.started'; runId: string; stage: string; at: string }
  | { kind: 'stage.progress'; runId: string; stage: string; pct?: number; note?: string }
  | { kind: 'stage.finished'; runId: string; stage: string; status: 'done'|'failed'|'skipped'; durationMs: number; error?: string }
  | { kind: 'run.finished'; runId: string; status: 'succeeded'|'failed'|'cancelled'; totalMs: number };
```

`stage.progress` is best-effort (Remotion prints frame counts; we parse them into a percentage). Absent for `claude` and `ffmpeg` stages — those just spin until done.

## 9. UI screens

### NewRun (`/`)
- Tabs: `Prompt | Structured | Composition`.
- Slug input + composition-id input (auto-filled per mode).
- "Start" button → `POST /api/runs` → redirect to `/runs/:id`.

### RunDetail (`/runs/:id`)
- **StageTimeline**: horizontal stepper, each stage shows status icon + elapsed time. Live-updated from SSE.
- **MetaPanel**: mode, composition id, total elapsed.
- When `status === 'succeeded'`:
  - **VideoPlayer** with `out/web.mp4`.
  - Download buttons for `raw.mp4` and `web.mp4`.
  - Metadata: dimensions, duration, fps, file sizes, render wall time.
- When `status === 'failed'`:
  - Red banner with the failing stage and short error.
  - Collapsible "Show full log" with `log.txt`.
- "Cancel" button while running.

### History (`/history`)
- Reverse-chrono list of runs: timestamp, slug, mode, status badge, duration.
- Click → RunDetail. Replay any past run (in v1, "replay" means clone its `input.json` into a new run).

## 10. Process management

- Server tracks at most one active child-process tree per stage.
- On `POST /runs/:id/cancel`: send `SIGTERM` (Windows: `taskkill /T /F /PID <pid>`) to the active child, mark stage `failed` with `error: 'cancelled'`, mark run `cancelled`, emit `run.finished`.
- On server shutdown: any running child gets the same treatment; run is marked `failed` with `error: 'server shutdown'`.
- On server **startup**: scan `runs/` for any `meta.json` with `status: 'running'` (orphaned by a crash) and rewrite to `failed` with `error: 'server restart'`.

## 11. Error handling

- Stage parsers wrap stdout reading in try/catch; parse failures are non-fatal — they just mean we don't get a `pct`.
- Any non-zero exit code from `claude`, `npx remotion render`, or `compose.sh` fails the stage and halts the pipeline.
- All stdout/stderr goes to `log.txt` regardless of parsing success.
- Atomic writes for `meta.json` so partial writes can't corrupt history.
- If `runs/<id>/` already exists (slug collision), append `-2`, `-3`, etc.

## 12. Configuration

- Hardcoded defaults: server port `4317`, Vite dev port `4318` (only used in dev), web build served from same port as API in production.
- `runner/server/config.ts` reads optional env: `RUNNER_PORT`, `CLAUDE_BIN` (default `claude`), `COMPOSE_SCRIPT` (default `./compose.sh`).
- No config file in v1.

## 13. `start-runner.bat`

```bat
@echo off
cd /d "%~dp0"
start "" http://localhost:4317
npm run runner
```

`npm run runner` (in `package.json`) is: `node --import tsx runner/server/index.ts` after `vite build` of the web app. Dev mode: `npm run runner:dev` runs `tsx watch` and `vite` concurrently.

## 14. Dependencies added

Server: `express`, `tsx` (dev), `concurrently` (dev), `@types/express`, `@types/node`.
Web: `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`.
Shared: `typescript`, `zod` (for validating `POST /runs` bodies and structured-script JSON).

No new render-pipeline deps — we shell out to existing `claude`, `npx remotion`, `compose.sh`.

## 15. Testing strategy

- Unit-test `runs.ts` (atomic write, listing, slug collision) with a temp dir.
- Unit-test each stage parser with recorded stdout fixtures (Remotion frame lines, FFmpeg progress lines).
- One end-to-end smoke test: `composition` mode against a tiny built-in 1-second composition; assert `meta.json.status === 'succeeded'` and that `out/web.mp4` exists and is non-empty. Skipped in CI if `ffmpeg` isn't on PATH.

## 16. Out of scope (explicit YAGNI)

- Auth, multi-user, remote access.
- Job queue / parallel runs.
- Frame-level live preview.
- Editing past runs in place (replay always creates a new run).
- Telemetry / analytics.
- Auto-update of the runner.
