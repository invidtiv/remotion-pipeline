// runner/web/src/components/StageTimeline.tsx
import React from 'react';
import type { StageRecord } from '../lib/types.js';

const COLOR: Record<string, string> = {
  pending: '#444', running: '#CCFF00', done: '#3c3', failed: '#f55', skipped: '#888',
};
const fmt = (ms?: number) => ms == null ? '' : ms > 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`;

export const StageTimeline: React.FC<{ stages: StageRecord[]; progressByStage: Record<string, number> }> = ({ stages, progressByStage }) => (
  <ol style={{ listStyle: 'none', padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {stages.map(s => {
      const pct = progressByStage[s.name];
      return (
        <li key={s.name} style={{
          flex: '1 1 160px', background: '#181818',
          border: `1px solid ${COLOR[s.status]}`, borderRadius: 8, padding: 12,
        }}>
          <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{s.name}</div>
          <div style={{ color: COLOR[s.status], fontSize: 12, marginTop: 4 }}>
            {s.status} {fmt(s.durationMs)}
          </div>
          {s.status === 'running' && pct != null && (
            <div style={{ height: 4, background: '#222', marginTop: 8, borderRadius: 2 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#CCFF00' }} />
            </div>
          )}
          {s.error && <div style={{ color: '#f88', fontSize: 11, marginTop: 6 }}>{s.error}</div>}
        </li>
      );
    })}
  </ol>
);
