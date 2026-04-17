// runner/web/src/components/ModeTabs.tsx
import React from 'react';
import type { RunMode } from '../lib/types.js';

const MODES: { value: RunMode; label: string }[] = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'structured', label: 'Structured JSON' },
  { value: 'composition', label: 'Existing composition' },
];

export const ModeTabs: React.FC<{ value: RunMode; onChange: (m: RunMode) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #333' }}>
    {MODES.map(m => (
      <button key={m.value} onClick={() => onChange(m.value)} style={{
        background: 'transparent',
        color: value === m.value ? '#CCFF00' : '#aaa',
        border: 'none',
        borderBottom: value === m.value ? '2px solid #CCFF00' : '2px solid transparent',
        padding: '10px 16px', cursor: 'pointer', fontSize: 14,
      }}>{m.label}</button>
    ))}
  </div>
);
