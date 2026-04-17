// src/compositions/StructuredScript/scenes/Cta.tsx
import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
export const Cta: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = spring({ frame: f, fps });
  const pulse = 1 + 0.04 * Math.sin((f / fps) * 2 * Math.PI);
  return (
    <AbsoluteFill style={{ background: '#CCFF00', color: '#0a0a0a', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ opacity: o, transform: `scale(${pulse})`, fontSize: 88, fontWeight: 800 }}>{text}</div>
    </AbsoluteFill>
  );
};
