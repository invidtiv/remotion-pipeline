# Remotion Video Pipeline — Claude Code Instructions

This project generates videos programmatically using Remotion (React) + FFmpeg.
Output lives in `out/`. Source compositions live in `src/`.

## When working in this project

- **Always load the Remotion skill first** (`.claude/skills/remotion/SKILL.md`)
  before writing or modifying composition code. It contains the authoritative
  API patterns and common pitfalls.
- **For FFmpeg operations**, load `.claude/skills/remotion/rules/ffmpeg.md`.
- **For subtitles/captions**, load `.claude/skills/remotion/rules/subtitles.md`.
- **For charts/data viz**, load `.claude/skills/remotion/rules/charts.md`.
- **For 3D**, load `.claude/skills/remotion/rules/3d.md`.

## Conventions

### File layout
```
src/
  Root.tsx              # Register all compositions here
  compositions/
    <Name>/
      index.tsx         # The main <Composition> component
      schema.ts         # Zod schema for props (enables dynamic metadata)
      scenes/           # Break long videos into scene components
out/
  <name>.mp4            # Raw Remotion output (lossless-ish, large)
  <name>-web.mp4        # Post-processed, web-optimized
  preview/              # Preview frame PNGs
```

### Composition naming
- PascalCase component names: `ProductDemo`, `QuarterlyReport`
- kebab-case output filenames: `product-demo.mp4`, `quarterly-report.mp4`
- The composition `id` in `<Composition id="...">` matches the component name.

### Animation defaults
- Prefer `spring()` over linear `interpolate()` for anything that enters/exits —
  springs feel more natural. Only use `interpolate()` for continuous motion
  (scrolling, rotation, parallax).
- Default spring config: `{ damping: 200, mass: 0.5 }` for snappy UI feel;
  `{ damping: 100, mass: 1 }` for softer.
- Always guard with `extrapolateLeft: 'clamp', extrapolateRight: 'clamp'` on
  `interpolate` calls unless deliberately extrapolating.

### Fonts
- Use `@remotion/google-fonts` with `preload` — do NOT load fonts via `<link>`
  tags, it causes flash-of-unstyled-text during frame-by-frame render.

### Performance
- Keep single compositions under ~30 seconds. For longer videos, split into
  multiple compositions and concatenate via FFmpeg post-render (see
  `compose.sh`).
- Use `<Sequence>` liberally; it's free and makes timing explicit.

## Render commands

Standard render:
```bash
npx remotion render <CompositionId> out/<name>.mp4
```

Fast iteration render (half resolution, lower quality):
```bash
npx remotion render <CompositionId> out/<name>.mp4 --scale=0.5 --crf=32
```

Render a still for preview:
```bash
npx remotion still <CompositionId> out/preview/frame-<N>.png --frame=<N>
```

## Post-processing

After every final render, unless told otherwise:
1. Produce a web-optimized version with `compose.sh` (CRF 28, preset slow,
   `-movflags +faststart` for streaming, yuv420p for broad compatibility).
2. Report original vs. compressed file sizes to the user.

## What NOT to do

- Do not use `localStorage`, `sessionStorage`, or any browser storage in
  Remotion compositions — they run in a rendering context and will throw.
- Do not use dynamic `playbackRate` with `interpolate()` — Remotion evaluates
  frames independently; the playback rate must be constant per `<Video>` or
  `<OffthreadVideo>` instance.
- Do not install `ffmpeg` as an npm dependency — use system FFmpeg or
  `npx remotion ffmpeg`.
- Do not commit files in `out/` — it's gitignored.

## When asked to "create a video about X"

1. Propose a scene breakdown (duration, content per scene) in chat before writing code.
2. Wait for confirmation, then scaffold the composition folder.
3. Write scenes as separate components, composed via `<Sequence>` in `index.tsx`.
4. Register in `src/Root.tsx`.
5. Render at `--scale=0.5` first for a preview.
6. On approval, render full-res and post-process.
