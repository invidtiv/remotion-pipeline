// src/compositions/StructuredScript/scenes/Title.tsx
import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
export const Title: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = spring({ frame: f, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: '#0a0a0a', color: '#fff', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ opacity: o, transform: `translateY(${interpolate(o, [0, 1], [20, 0])}px)`, textAlign: 'center' }}>
        <h1 style={{ fontSize: 96, margin: 0, fontWeight: 800 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 36, margin: '16px 0 0', opacity: 0.7 }}>{subtitle}</p>}
      </div>
    </AbsoluteFill>
  );
};
