// src/compositions/StructuredScript/scenes/Bullets.tsx
import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
export const Bullets: React.FC<{ items: string[] }> = ({ items }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#0a0a0a', color: '#fff', padding: 96, justifyContent: 'center', fontFamily: 'sans-serif' }}>
      {items.map((it, i) => {
        const delay = i * 12;
        const o = spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.5 } });
        return (
          <div key={i} style={{ opacity: o, fontSize: 56, margin: '12px 0', transform: `translateX(${(1 - o) * -40}px)` }}>
            • {it}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
