# Claude Code + Remotion + FFmpeg Video Pipeline

A concrete, runnable setup for driving deterministic video generation from Claude Code. You describe a video in natural language; Claude Code writes/edits React components; Remotion renders frames; FFmpeg does post-processing (compression, format targeting, audio mixing).

This is the **deterministic, code-first** path — the opposite of prompting a generative model and praying. Perfect for data-driven videos, branded motion graphics, explainers, social clips, and any pipeline where you need the same inputs to produce the same output every time.

---

## Prerequisites

- **Node.js 20+** (`node --version`)
- **Bun** or **npm** (Bun is faster; either works)
- **FFmpeg 6+** on your PATH (`ffmpeg -version`) — Remotion bundles its own, but having system FFmpeg lets you do heavier post-processing
- **Claude Code** installed: `npm install -g @anthropic-ai/claude-code`

Optional but recommended:
- **uv** (for running Python-based MCP servers later): `curl -LsSf https://astral.sh/uv/install.sh | sh`

---

## Step 1 — Scaffold a Remotion project

From the directory where you want the project to live:

```bash
npx create-video@latest my-video-pipeline
# Choose the "Hello World" or "Empty" template
cd my-video-pipeline
```

When the scaffolder asks whether to install agent skills, **say yes**. That drops a `.claude/skills/` directory into the project containing Remotion-specific guidance Claude Code auto-loads.

If you skipped it or are adding to an existing project:

```bash
npx skills add remotion-dev/skills
```

---

## Step 2 — Verify the skills are in place

```bash
ls .claude/skills/
# You should see: remotion/  (with SKILL.md and a rules/ folder)
```

The skill's `SKILL.md` tells Claude Code when to load which rule file: subtitles, FFmpeg operations, 3D, charts, audio visualization, fonts, etc. Claude Code reads these on demand — you don't need to.

---

## Step 3 — Add the project CLAUDE.md

Create `CLAUDE.md` at the project root. This is the long-lived instruction file Claude Code reads on every session in this directory. Copy the one from `CLAUDE.md` in this setup kit (see adjacent file).

---

## Step 4 — Launch Claude Code

```bash
claude
```

In the Claude Code session, try a smoke test:

```
Render the default composition to out/hello.mp4 at 1080p, then use ffmpeg to
compress it with -crf 28 -preset slow and save as out/hello-web.mp4.
Tell me the file sizes before and after.
```

Claude Code will:
1. Read `CLAUDE.md` and the Remotion skill
2. Run `npx remotion render` with the right flags
3. Run `ffmpeg` to compress
4. Report back with `ls -lh` sizes

---

## Step 5 — A real request

Once the smoke test works, try something real:

```
Create a new composition called "ProductDemo" — 15 seconds at 30fps, 1080x1920
(vertical for TikTok). Three scenes:
  1. Title card "Meet Acme Pro" with dark background, logo fade-in (3s)
  2. Bullet points appearing one at a time: "10x faster", "Zero setup",
     "Works offline" (8s)
  3. CTA "acme.com/pro" with a subtle pulse (4s)
Use spring animations. Brand color #CCFF00. Sans-serif, bold.
Render it to out/product-demo.mp4 and show me a 3-frame preview strip
(frames 30, 150, 400) as PNGs in out/preview/.
```

Claude Code will write the React components, register the composition in `src/Root.tsx`, render the video, and extract preview frames with FFmpeg.

---

## Step 6 — Iteration loop

Remotion's killer feature for agent workflows is the **live preview**:

```bash
npm run dev   # opens Remotion Studio at http://localhost:3000
```

Ask Claude Code to tweak: *"The title card feels too fast — slow the fade to 1.2s and add a slight Y-axis rise."* It edits the component, the Studio hot-reloads, you see the change instantly.

---

## What's in this kit

- `CLAUDE.md` — project-level instructions for Claude Code (paste into your repo root)
- `compose.sh` — example FFmpeg post-processing script Claude can invoke
- `examples/DataChart.tsx` — example data-driven composition you can adapt
- `examples/Root.tsx` — how to register compositions with dynamic metadata

---

## Optional — add an MCP server for generative clips

If you want Claude Code to also be able to *generate* raw footage (not just render deterministic code), add an MCP server to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "heygen": {
      "url": "https://mcp.heygen.com/sse"
    },
    "mcp-video": {
      "command": "uvx",
      "args": ["mcp-video"]
    }
  }
}
```

Now Claude Code can generate an avatar clip via HeyGen, then composite it into a Remotion scene. The deterministic Remotion layer handles layout/branding; the generative MCP layer handles the organic content.

---

## Runner App (local web UI)

A bundled local web app drives the pipeline interactively. From the repo root:

```bash
npm install
npm run runner          # production: builds web, starts server on :4317
# or
npm run runner:dev      # dev: vite + tsx watch on :4318 (web) + :4317 (api)
```

Or double-click `start-runner.bat` on Windows.

Open http://localhost:4317. Three input modes:
- **Prompt** — natural language; spawns `claude` CLI to write a new composition.
- **Structured JSON** — fills the bundled `StructuredScript` composition.
- **Existing composition** — pick any composition registered in `src/Root.tsx`.

Stage progress streams over SSE. Completed runs are stored under `runs/<timestamp>_<slug>/` with the script, the rendered MP4s, a `meta.json`, and the full log.

---

## Troubleshooting

- **`ffmpeg: command not found` during post-processing** — either install system FFmpeg, or have Claude use `npx remotion ffmpeg` (ships with Remotion v4+, supports H.264/H.265/VP8/VP9/ProRes).
- **Renders are slow** — render at lower scale first (`--scale=0.5`), iterate, then do a final full-res pass.
- **Out of memory on long videos** — use `--concurrency=2` or render in chunks with `--frames=0-300` then concatenate via FFmpeg.
- **Claude Code not finding the skill** — check `.claude/skills/remotion/SKILL.md` exists and your `CLAUDE.md` references it.
