// runner/web/src/pages/History.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import type { RunMeta } from '../lib/types.js';

const STATUS_COLOR: Record<string, string> = {
  running: '#CCFF00', succeeded: '#3c3', failed: '#f55', cancelled: '#888', queued: '#888',
};

export const History: React.FC = () => {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  useEffect(() => { api.listRuns().then(setRuns); }, []);
  if (!runs.length) return <p>No runs yet. <Link to="/">Start one →</Link></p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th align="left">When</th>
          <th align="left">Slug</th>
          <th align="left">Mode</th>
          <th align="left">Status</th>
          <th align="right">Wall</th>
        </tr>
      </thead>
      <tbody>
        {runs.map(r => (
          <tr key={r.id} style={{ borderTop: '1px solid #222' }}>
            <td><Link to={`/runs/${r.id}`} style={{ color: '#9bf' }}>{new Date(r.createdAt).toLocaleString()}</Link></td>
            <td>{r.slug}</td>
            <td style={{ color: '#888' }}>{r.mode}</td>
            <td><span style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span></td>
            <td align="right" style={{ color: '#888' }}>
              {r.totals ? `${(r.totals.wallMs / 1000).toFixed(1)}s` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
