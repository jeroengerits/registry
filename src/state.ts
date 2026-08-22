import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { ComponentState, UiState } from './types.js';

export const STATE_FILE = 'ui.json';
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function validateState(value: unknown): UiState {
  if (!record(value) || !record(value.components)) throw new Error('ui.json must contain a "components" object.');
  const components: Record<string, ComponentState> = {};
  for (const [name, entry] of Object.entries(value.components)) {
    if (!record(entry) || typeof entry.version !== 'string' || typeof entry.path !== 'string' || (entry.constraint !== undefined && typeof entry.constraint !== 'string') || (entry.repository !== undefined && typeof entry.repository !== 'string')) throw new Error(`ui.json component "${name}" must contain string "version" and "path".`);
    if (entry.files !== undefined && (!Array.isArray(entry.files) || !entry.files.every((file) => record(file) && typeof file.path === 'string' && typeof file.sha256 === 'string'))) throw new Error(`ui.json component "${name}" has invalid file hashes.`);
    if (entry.dependencies !== undefined && (!Array.isArray(entry.dependencies) || !entry.dependencies.every((item) => record(item) && typeof item.repository === 'string'))) throw new Error(`ui.json component "${name}" has invalid dependencies.`);
    components[name] = { version: entry.version, path: entry.path, ...(typeof entry.constraint === 'string' ? { constraint: entry.constraint } : {}), ...(typeof entry.repository === 'string' ? { repository: entry.repository } : {}), ...(entry.files ? { files: entry.files as ComponentState['files'] } : {}), ...(Array.isArray(entry.dependencies) ? { dependencies: entry.dependencies as ComponentState['dependencies'] } : {}) };
  }
  return { ...(typeof value.$schema === 'string' ? { $schema: value.$schema } : {}), ...(typeof value.version === 'string' ? { version: value.version } : {}), components };
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
