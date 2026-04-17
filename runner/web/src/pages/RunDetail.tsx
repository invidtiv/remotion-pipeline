// runner/web/src/pages/RunDetail.tsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRunStream } from '../lib/sse.js';
import { api } from '../lib/api.js';
import { StageTimeline } from '../components/StageTimeline.js';
import { VideoPlayer } from '../components/VideoPlayer.js';
import { MetaPanel } from '../components/MetaPanel.js';

export const RunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { meta, progressByStage } = useRunStream(id);
  const [showLog, setShowLog] = useState(false);
  const [logText, setLogText] = useState('');

  if (!meta) return <p>Loading…</p>;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{meta.slug}</h2>
          <code style={{ color: '#888', fontSize: 12 }}>{meta.id}</code>
        </div>
        {meta.status === 'running' && (
          <button onClick={() => api.cancelRun(meta.id)} style={{
            background: '#f55', color: '#000', border: 'none',
            padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
          }}>Cancel</button>
        )}
      </header>

      <StageTimeline stages={meta.stages} progressByStage={progressByStage} />

      {meta.status === 'succeeded' && (
        <>
          <VideoPlayer src={api.fileUrl(meta.id, 'web.mp4')} />
          <div style={{ display: 'flex', gap: 12 }}>
            <a href={api.fileUrl(meta.id, 'web.mp4')} download style={{
              background: '#CCFF00', color: '#000', padding: '8px 14px',
              borderRadius: 6, textDecoration: 'none', fontWeight: 700,
            }}>Download web.mp4</a>
            <a href={api.fileUrl(meta.id, 'raw.mp4')} download style={{
              background: '#222', color: '#eee', padding: '8px 14px',
              borderRadius: 6, textDecoration: 'none',
            }}>Download raw.mp4</a>
          </div>
        </>
      )}

      <MetaPanel meta={meta} />

      {meta.status === 'failed' && (
        <div style={{ background: '#3a1414', border: '1px solid #f55', padding: 12, borderRadius: 6 }}>
          <strong>Failed.</strong>
          <button
            onClick={async () => {
              setShowLog(s => !s);
              if (!showLog && !logText) setLogText(await (await fetch(`/api/runs/${meta.id}/log`)).text());
            }}
            style={{ background: 'transparent', color: '#9bf', border: 'none', cursor: 'pointer', marginLeft: 12 }}
          >
            {showLog ? 'Hide log' : 'Show full log'}
          </button>
          {showLog && (
            <pre style={{ maxHeight: 300, overflow: 'auto', background: '#0a0a0a', padding: 12, marginTop: 12, fontSize: 11 }}>
              {logText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
