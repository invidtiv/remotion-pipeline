// runner/server/stages/scaffold.ts
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { structuredScriptSchema } from '../../../src/compositions/StructuredScript/schema.js';

export interface ScaffoldInput {
  scriptJson: unknown;
  runDir: string;
}

export interface ScaffoldResult {
  propsFile: string;
  compositionId: 'StructuredScript';
}

export async function runScaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
  const parsed = structuredScriptSchema.parse(input.scriptJson);
  const propsFile = join(input.runDir, 'props.json');
  await writeFile(propsFile, JSON.stringify(parsed, null, 2));
  return { propsFile, compositionId: 'StructuredScript' };
}
