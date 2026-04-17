// runner/web/src/components/MetaPanel.tsx
import React from 'react';
import type { RunMeta } from '../lib/types.js';

const kb = (b: number) => b < 1024 * 1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`;

export const MetaPanel: React.FC<{ meta: RunMeta }> = ({ meta }) => (
  <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '6px 16px', fontSize: 14 }}>
    <dt style={{ color: '#888' }}>Mode</dt><dd style={{ margin: 0 }}>{meta.mode}</dd>
    <dt style={{ color: '#888' }}>Composition</dt><dd style={{ margin: 0 }}>{meta.compositionId}</dd>
    <dt style={{ color: '#888' }}>Status</dt><dd style={{ margin: 0 }}>{meta.status}</dd>
    {meta.outputs && (<>
      <dt style={{ color: '#888' }}>Resolution</dt>
      <dd style={{ margin: 0 }}>{meta.outputs.width}×{meta.outputs.height} @ {meta.outputs.fps}fps</dd>
      <dt style={{ color: '#888' }}>Duration</dt>
      <dd style={{ margin: 0 }}>{meta.outputs.durationSec.toFixed(1)}s</dd>
      <dt style={{ color: '#888' }}>Raw size</dt><dd style={{ margin: 0 }}>{kb(meta.outputs.raw.bytes)}</dd>
      <dt style={{ color: '#888' }}>Web size</dt><dd style={{ margin: 0 }}>{kb(meta.outputs.web.bytes)}</dd>
    </>)}
    {meta.totals && (<>
      <dt style={{ color: '#888' }}>Wall time</dt>
      <dd style={{ margin: 0 }}>{(meta.totals.wallMs / 1000).toFixed(1)}s</dd>
    </>)}
  </dl>
);
