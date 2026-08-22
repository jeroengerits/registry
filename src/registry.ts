import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { safeRelativePath } from './paths.js';
import type { ComponentManifest } from './types.js';

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function validateComponentManifest(value: unknown): ComponentManifest {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.name !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.name) || (value.description !== undefined && typeof value.description !== 'string') || !Array.isArray(value.files) || !record(value.dependencies) || !Array.isArray(value.components)) throw new Error('component.json requires schemaVersion 1, a lowercase kebab-case name, files, dependencies, and components.');
  const files = value.files.map((file, index) => { if (!record(file) || typeof file.source !== 'string' || typeof file.target !== 'string') throw new Error(`component.json files[${index}] requires source and target.`); return { source: safeRelativePath(file.source, `files[${index}].source`), target: safeRelativePath(file.target, `files[${index}].target`) }; });
  if (new Set(files.map((file) => file.target)).size !== files.length) throw new Error('component.json contains duplicate target paths.');
  const dependencies: Record<string, string> = {};
  for (const [name, range] of Object.entries(value.dependencies)) { if (!name || typeof range !== 'string' || !range) throw new Error('component.json dependencies must map package names to non-empty ranges.'); dependencies[name] = range; }
  const components = value.components.map((item, index) => { if (!record(item) || typeof item.repository !== 'string' || !item.repository || (item.version !== undefined && (typeof item.version !== 'string' || !item.version))) throw new Error(`component.json components[${index}] requires repository and optional non-empty version.`); return { repository: item.repository, ...(item.version === undefined ? {} : { version: item.version }) }; });
  return { schemaVersion: 1, name: value.name, ...(value.description === undefined ? {} : { description: value.description }), files, dependencies, components };
}
export async function readComponentManifest(directory: string): Promise<ComponentManifest> {
  try { return validateComponentManifest(JSON.parse(await readFile(path.join(directory, 'component.json'), 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Provided source is not a component: missing component.json.');
    if (error instanceof SyntaxError) throw new Error('component.json contains invalid JSON.');
    throw error;
  }
}
