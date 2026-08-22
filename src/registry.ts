import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { safeRelativePath } from './paths.js';
import type { ComponentManifest } from './types.js';
import { isErrnoError } from './shared.js';

/** Runtime schema for the untrusted component manifest file. */
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  description: z.string().optional(),
  files: z.array(z.object({ source: z.string(), target: z.string() }).strict()),
  dependencies: z.record(z.string().min(1), z.string().min(1)),
  components: z.array(z.object({ repository: z.string().min(1), version: z.string().min(1).optional() }).strict()),
}).strict();

/** Validates a manifest and normalizes every source and target path. */
export function validateComponentManifest(value: unknown): ComponentManifest {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) throw new Error('component.json requires schemaVersion 1, a lowercase kebab-case name, files, dependencies, and components.');
  const files = parsed.data.files.map((file, index) => ({ source: safeRelativePath(file.source, `files[${index}].source`), target: safeRelativePath(file.target, `files[${index}].target`) }));
  if (new Set(files.map((file) => file.target)).size !== files.length) throw new Error('component.json contains duplicate target paths.');
  return { ...parsed.data, files };
}

/** Reads and validates the root `component.json` from a checkout. */
export async function readComponentManifest(directory: string): Promise<ComponentManifest> {
  try { return validateComponentManifest(JSON.parse(await readFile(path.join(directory, 'component.json'), 'utf8'))); }
  catch (error) {
    if (isErrnoError(error) && error.code === 'ENOENT') throw new Error('Provided source is not a component: missing component.json.');
    if (error instanceof SyntaxError) throw new Error('component.json contains invalid JSON.');
    throw error;
  }
}
