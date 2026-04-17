// src/compositions/StructuredScript/index.tsx
import React from 'react';
import { Sequence } from 'remotion';
import { Title } from './scenes/Title';
import { Bullets } from './scenes/Bullets';
import { Cta } from './scenes/Cta';
import type { StructuredScriptProps } from './schema';
export { structuredScriptSchema } from './schema';
export type { StructuredScriptProps } from './schema';

export const StructuredScript: React.FC<StructuredScriptProps> = ({ scenes, fps }) => {
  let cursor = 0;
  return (
    <>
      {scenes.map((s, i) => {
        const dur = Math.max(1, Math.round(s.durationSec * fps));
        const node = (
          <Sequence key={i} from={cursor} durationInFrames={dur}>
            {s.kind === 'title' && <Title {...s.props} />}
            {s.kind === 'bullets' && <Bullets {...s.props} />}
            {s.kind === 'cta' && <Cta {...s.props} />}
          </Sequence>
        );
        cursor += dur;
        return node;
      })}
    </>
  );
};
