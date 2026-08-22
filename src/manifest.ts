import { readFile } from 'node:fs/promises';
import type { ComponentState } from './types.js';

export function validateManifest(value: unknown): ComponentState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Manifest must be a JSON object.');
  }
  const manifest = value as Record<string, unknown>;
  if (typeof manifest.version !== 'string' || typeof manifest.path !== 'string') {
    throw new Error('Manifest must contain string "version" and "path".');
  }
  return { version: manifest.version, path: manifest.path };
}

export async function validateManifestFile(file: string): Promise<ComponentState> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Manifest ${file} contains invalid JSON.`);
    throw new Error(`Unable to read manifest ${file}.`);
  }
  return validateManifest(value);
}
