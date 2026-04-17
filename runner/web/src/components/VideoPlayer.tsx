// runner/web/src/components/VideoPlayer.tsx
import React from 'react';
export const VideoPlayer: React.FC<{ src: string }> = ({ src }) => (
  <video src={src} controls style={{ width: '100%', maxHeight: '60vh', background: '#000', borderRadius: 8 }} />
);
