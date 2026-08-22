import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ComponentState, UiState } from './types.js';

export const STATE_FILE = 'ui.json';

export function validateState(value: unknown): UiState {
  if (!isRecord(value) || !isRecord(value.components)) {
    throw new Error('ui.json must contain a "components" object.');
  }

  const components: Record<string, ComponentState> = {};
  for (const [name, entry] of Object.entries(value.components)) {
    if (!isRecord(entry) || typeof entry.version !== 'string' || typeof entry.path !== 'string') {
      throw new Error(`ui.json component "${name}" must contain string "version" and "path".`);
    }
    components[name] = { version: entry.version, path: entry.path };
  }

  return { ...(typeof value.$schema === 'string' ? { $schema: value.$schema } : {}), components };
}

export async function readState(cwd: string): Promise<UiState | null> {
  const file = path.join(cwd, STATE_FILE);
  try {
    return validateState(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if (isMissingFile(error)) return null;
    if (error instanceof SyntaxError) throw new Error('ui.json contains invalid JSON.');
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
