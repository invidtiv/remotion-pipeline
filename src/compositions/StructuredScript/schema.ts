// src/compositions/StructuredScript/schema.ts
import { z } from 'zod';

export const sceneSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('title'), durationSec: z.number(), props: z.object({ title: z.string(), subtitle: z.string().optional() }) }),
  z.object({ kind: z.literal('bullets'), durationSec: z.number(), props: z.object({ items: z.array(z.string()) }) }),
  z.object({ kind: z.literal('cta'), durationSec: z.number(), props: z.object({ text: z.string() }) }),
]);

export const structuredScriptSchema = z.object({
  title: z.string(),
  width: z.union([z.literal(1080), z.literal(1920)]),
  height: z.union([z.literal(1080), z.literal(1920)]),
  fps: z.union([z.literal(30), z.literal(60)]),
  scenes: z.array(sceneSchema),
});

export type StructuredScriptProps = z.infer<typeof structuredScriptSchema>;
export type ScenePropsT = z.infer<typeof sceneSchema>;
