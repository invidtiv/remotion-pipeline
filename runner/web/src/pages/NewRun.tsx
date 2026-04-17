// runner/web/src/pages/NewRun.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModeTabs } from '../components/ModeTabs.js';
import { api, type CompositionInfo } from '../lib/api.js';
import type { RunMode } from '../lib/types.js';

const SAMPLE_STRUCTURED = JSON.stringify({
  title: 'My video', width: 1080, height: 1920, fps: 30,
  scenes: [
    { kind: 'title', durationSec: 3, props: { title: 'Hello', subtitle: 'World' } },
    { kind: 'bullets', durationSec: 5, props: { items: ['One', 'Two', 'Three'] } },
    { kind: 'cta', durationSec: 3, props: { text: 'go.example' } },
  ],
}, null, 2);

export const NewRun: React.FC = () => {
  const nav = useNavigate();
  const [mode, setMode] = useState<RunMode>('prompt');
  const [slug, setSlug] = useState('');
  const [prompt, setPrompt] = useState('');
  const [json, setJson] = useState(SAMPLE_STRUCTURED);
  const [compId, setCompId] = useState('');
  const [comps, setComps] = useState<CompositionInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.compositions().then(setComps).catch(() => setComps([])); }, []);

  const onSubmit = async () => {
    setBusy(true); setErr('');
    try {
      const body: any = { mode, slug: slug || `run-${Date.now()}` };
      if (mode === 'prompt') { body.prompt = prompt; body.compositionId = compId || `Generated${Date.now()}`; }
      if (mode === 'structured') body.scriptJson = JSON.parse(json);
      if (mode === 'composition') body.compositionId = compId;
      const meta = await api.startRun(body);
      nav(`/runs/${meta.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  const input: React.CSSProperties = {
    background: '#181818', color: '#eee', border: '1px solid #333',
    padding: 8, width: '100%', borderRadius: 4, fontFamily: 'inherit',
  };

  return (
    <div>
      <ModeTabs value={mode} onChange={setMode} />
      <div style={{ display: 'grid', gap: 16 }}>
        <label>Slug<input style={input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="my-video" /></label>

        {mode === 'prompt' && (<>
          <label>Composition id (will be created)
            <input style={input} value={compId} onChange={e => setCompId(e.target.value)} placeholder="ProductDemo" />
          </label>
          <label>Prompt
            <textarea style={{ ...input, minHeight: 220, fontFamily: 'monospace' }} value={prompt} onChange={e => setPrompt(e.target.value)} />
          </label>
        </>)}

        {mode === 'structured' && (
          <label>Script JSON
            <textarea style={{ ...input, minHeight: 360, fontFamily: 'monospace' }} value={json} onChange={e => setJson(e.target.value)} />
          </label>
        )}

        {mode === 'composition' && (
          <label>Composition
            <select style={input} value={compId} onChange={e => setCompId(e.target.value)}>
              <option value="">— choose —</option>
              {comps.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id} ({c.width}×{c.height} @ {c.fps}fps, {(c.durationInFrames / c.fps).toFixed(1)}s)
                </option>
              ))}
            </select>
          </label>
        )}

        {err && <div style={{ color: '#f88' }}>{err}</div>}
        <button onClick={onSubmit} disabled={busy} style={{
          background: '#CCFF00', color: '#000', border: 'none', padding: '12px 20px',
          fontWeight: 700, borderRadius: 6, cursor: 'pointer', alignSelf: 'flex-start',
        }}>
          {busy ? 'Starting…' : 'Start render'}
        </button>
      </div>
    </div>
  );
};
