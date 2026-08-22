import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { ComponentManifest } from './types.js';
import { validateComponentManifest } from './registry.js';
import { safeRelativePath } from './paths.js';

const exec = promisify(execFile);

export function validateManifest(value: unknown): ComponentManifest {
  return validateComponentManifest(value);
}

export async function validateManifestFile(file: string): Promise<ComponentManifest> {
  try {
    const manifest = validateManifest(JSON.parse(await readFile(file, 'utf8')));
    const root = path.dirname(file);
    for (const entry of manifest.files) await stat(path.join(root, entry.source));
    return manifest;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Manifest ${file} contains invalid JSON.`);
    if (error instanceof Error && (error.message.startsWith('components.json') || error.message.startsWith('Manifest'))) throw error;
    throw new Error(`Unable to read manifest ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function trackedSources(root: string, directory = 'src'): Promise<string[]> {
  const current = path.join(root, directory); let entries;
  try { entries = await readdir(current, { withFileTypes: true }); } catch { return []; }
  const result: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await trackedSources(root, relative));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/(\.test|\.spec)\.(ts|tsx)$/.test(entry.name) && !/(^|\/)(stories|__tests__)(\/|\.)/.test(relative)) result.push(relative);
  }
  return result;
}

export async function generateManifest(directory: string, output = path.join(directory, 'components.json')): Promise<void> {
  const packageFile = path.join(directory, 'package.json'); let packageJson: Record<string, unknown> = {};
  try { packageJson = JSON.parse(await readFile(packageFile, 'utf8')) as Record<string, unknown>; } catch { /* directory-only repositories are valid */ }
  const name = typeof packageJson.name === 'string' ? packageJson.name : path.basename(path.resolve(directory));
  const description = typeof packageJson.description === 'string' ? packageJson.description : undefined;
  const dependencies = packageJson.dependencies && typeof packageJson.dependencies === 'object' && !Array.isArray(packageJson.dependencies) ? packageJson.dependencies as Record<string, string> : {};
  let sources: string[];
  try { sources = (await exec('git', ['ls-files', '--', 'src'], { cwd: directory })).stdout.split(/\r?\n/).filter(Boolean); } catch { sources = await trackedSources(directory); }
  sources = sources.filter((source) => /\.(ts|tsx)$/.test(source) && !/(\.test|\.spec)\.(ts|tsx)$/.test(source) && !/(^|\/)(stories|__tests__)(\/|\.)/.test(source)).sort();
  const files = sources.map((source) => ({ source: safeRelativePath(source, 'source'), target: source }));
  const manifest = validateManifest({ schemaVersion: 1, name, ...(description ? { description } : {}), files, dependencies, components: [] });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
