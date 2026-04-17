// runner/server/index.ts
import express from 'express';
import { z } from 'zod';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { CONFIG } from './config.js';
import { createRunsStore } from './runs.js';
import { createEventBus } from './events.js';
import { createPipeline, PipelineBusy } from './pipeline.js';
import { probeCompositions } from './stages/remotion.js';

const store = createRunsStore(join(CONFIG.projectRoot, CONFIG.runsDir));
const bus = createEventBus();
const pipeline = createPipeline({ store, bus, projectRoot: CONFIG.projectRoot, claudeBin: CONFIG.claudeBin });

await store.recoverOrphans();

const app = express();
app.use(express.json({ limit: '2mb' }));

const startSchema = z.object({
  mode: z.enum(['prompt', 'structured', 'composition']),
  slug: z.string().min(1).max(80),
  compositionId: z.string().optional(),
  prompt: z.string().optional(),
  scriptJson: z.unknown().optional(),
});

app.get('/api/compositions', async (_req, res) => {
  try { res.json(await probeCompositions(CONFIG.projectRoot)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/runs', async (_req, res) => res.json(await store.list()));

app.get('/api/runs/:id', async (req, res) => {
  try { res.json(await store.get(req.params.id)); }
  catch { res.status(404).json({ error: 'not found' }); }
});

app.post('/api/runs', async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const meta = await pipeline.start(parsed.data);
    res.status(202).json(meta);
  } catch (e) {
    if (e instanceof PipelineBusy) res.status(409).json({ error: 'pipeline busy' });
    else res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/runs/:id/cancel', (req, res) => {
  const ok = pipeline.cancel(req.params.id);
  res.status(ok ? 202 : 404).json({ cancelled: ok });
});

app.get('/api/runs/:id/events', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (e: any) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  try { send({ kind: 'snapshot', meta: await store.get(req.params.id) }); } catch {}
  const unsub = bus.subscribe(req.params.id, send);
  req.on('close', () => unsub());
});

app.get('/api/runs/:id/log', async (req, res) => {
  const p = store.pathFor(req.params.id, 'log.txt');
  if (!existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

app.use('/files/runs', express.static(join(CONFIG.projectRoot, CONFIG.runsDir)));

const webDist = join(CONFIG.projectRoot, 'runner', 'web', 'dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(join(webDist, 'index.html')));
}

app.listen(CONFIG.port, () => {
  console.log(`Runner up on http://localhost:${CONFIG.port}`);
});

const shutdown = () => { console.log('Shutting down…'); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
