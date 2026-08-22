import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { UiState } from './types.js';

export const STATE_FILE = 'ui.json';

const installedFileSchema = z.object({
  path: z.string(),
  sha256: z.string(),
}).strict();

const componentReferenceSchema = z.object({
  repository: z.string(),
  version: z.string().optional(),
}).strict();

const componentStateSchema = z.object({
  enabled: z.boolean().default(true),
  version: z.string(),
  constraint: z.string().optional(),
  path: z.string(),
  repository: z.string().optional(),
  files: z.array(installedFileSchema).optional(),
  dependencies: z.array(componentReferenceSchema).optional(),
}).strict();

const uiStateSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().optional(),
  components: z.record(z.string(), componentStateSchema),
}).strict();

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

export function validateState(value: unknown): UiState {
  const parsed = uiStateSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const component = parsed.error.issues.find((issue) => issue.path[0] === 'components')?.path[1];
  if (component && parsed.error.issues.some((issue) => issue.path.includes('files'))) throw new Error(`ui.json component "${String(component)}" has invalid file hashes.`);
  if (component && parsed.error.issues.some((issue) => issue.path.includes('dependencies'))) throw new Error(`ui.json component "${String(component)}" has invalid dependencies.`);
  if (component) throw new Error(`ui.json component "${String(component)}" must contain string "version" and "path".`);
  throw new Error('ui.json must contain a valid "components" object.');
}
export async function readState(cwd: string): Promise<UiState | null> {
  try { return validateState(JSON.parse(await readFile(path.join(cwd, STATE_FILE), 'utf8'))); }
  catch (error) { if (record(error) && error.code === 'ENOENT') return null; if (error instanceof SyntaxError) throw new Error('ui.json contains invalid JSON.'); throw error; }
}
export async function writeState(cwd: string, state: UiState): Promise<void> {
  const file = path.join(cwd, STATE_FILE); const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8'); await rename(temporary, file);
}

export async function readRootVersion(cwd: string): Promise<string | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
    return record(value) && typeof value.version === 'string' ? value.version : undefined;
  } catch (error) {
    if (record(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }
}
