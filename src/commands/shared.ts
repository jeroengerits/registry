import { access, copyFile, mkdir, mkdtemp, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ComponentManifest, UiState } from '../types.js';
import { writeState } from '../state.js';
import { checkoutGit, parseGitReference, satisfies, type GitReference } from '../git.js';
import { readComponentManifest } from '../registry.js';
import { safeJoin, safeRelativePath } from '../paths.js';

const exec = promisify(execFile);
export const errorResult = (message: string) => ({ output: `${message}\n`, exitCode: 1 });
async function packageManager(cwd: string): Promise<'npm' | 'pnpm' | 'yarn' | 'bun'> {
  for (const [file, manager] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['package-lock.json', 'npm']] as const) {
    try { await access(path.join(cwd, file)); return manager; } catch { /* continue */ }
  }
  return 'npm';
}

export async function installDependencies(cwd: string, dependencies: Record<string, string>): Promise<void> {
  const names = Object.keys(dependencies).sort().map((name) => `${name}@${dependencies[name]}`);
  if (!names.length) return;
  const manager = await packageManager(cwd);
  await exec(manager === 'npm' ? 'npm' : manager, manager === 'npm' ? ['install', '--save', ...names] : ['add', ...names], { cwd });
}

export interface Resolved { manifest: ComponentManifest; reference: GitReference; directory: string; version: string; commit: string; cleanup: () => Promise<void>; }

function canonical(repository: string): string {
  const parsed = parseGitReference(repository).repository;
  return path.isAbsolute(parsed) ? path.resolve(parsed) : parsed.replace(/\.git$/, '').replace(/\/$/, '').toLowerCase();
}

export async function resolveReferences(references: GitReference[]): Promise<Resolved[]> {
  const selected = new Map<string, Resolved>();
  const visiting = new Set<string>();
  const visit = async (reference: GitReference): Promise<void> => {
    const key = canonical(reference.repository);
    const current = selected.get(key);
    if (visiting.has(key)) throw new Error(`Component dependency cycle at ${reference.repository}.`);
    if (current) {
      if (reference.version && !satisfies(current.version, reference.version)) throw new Error(`Incompatible versions for ${reference.repository}: ${current.version} does not satisfy ${reference.version}.`);
      return;
    }
    visiting.add(key);
    const checkout = await checkoutGit(reference);
    let manifest: ComponentManifest;
    try { manifest = await readComponentManifest(checkout.directory); } catch (error) { await checkout.cleanup(); throw error; }
    selected.set(key, { manifest, reference, directory: checkout.directory, version: checkout.version, commit: checkout.commit, cleanup: checkout.cleanup });
    for (const dependency of [...manifest.components].sort((a, b) => a.repository.localeCompare(b.repository))) await visit(parseGitReference(dependency.version ? `${dependency.repository}#${dependency.version}` : dependency.repository));
    visiting.delete(key);
  };
  try { for (const reference of references) await visit(reference); } catch (error) { await Promise.all([...selected.values()].map((item) => item.cleanup())); throw error; }
  const result: Resolved[] = [];
  const walked = new Set<string>();
  const append = (key: string) => { if (walked.has(key)) return; walked.add(key); result.push(selected.get(key)!); };
  for (const key of [...selected.keys()].sort()) append(key);
  return result;
}

export interface FilePlan { component: Resolved; source: string; target: string; }

export async function planFiles(cwd: string, resolved: Resolved[]): Promise<FilePlan[]> {
  const plans: FilePlan[] = [];
  const targets = new Set<string>();
  for (const component of resolved) for (const file of component.manifest.files) {
    const target = safeRelativePath(file.target, 'target');
    const source = safeJoin(component.directory, file.source, 'source');
    await stat(source);
    if (targets.has(target)) throw new Error(`Duplicate target path ${target}.`);
    targets.add(target);
    try { await access(safeJoin(cwd, target, 'target')); throw new Error(`Target already exists: ${target}.`); }
    catch (error) { if (error instanceof Error && error.message.startsWith('Target already exists')) throw error; }
    plans.push({ component, source, target });
  }
  return plans;
}

async function stageFiles(cwd: string, plans: FilePlan[]): Promise<{ directory: string }> {
  const directory = await mkdtemp(path.join(cwd, '.ui-stage-'));
  for (const plan of plans) {
    const staged = safeJoin(directory, plan.target, 'staged target');
    await mkdir(path.dirname(staged), { recursive: true });
    await copyFile(plan.source, staged);
  }
  return { directory };
}

export function aggregateDependencies(resolved: Resolved[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of resolved) for (const [name, range] of Object.entries(item.manifest.dependencies)) {
    if (result[name] && result[name] !== range) throw new Error(`Conflicting npm dependency ranges for ${name}: ${result[name]} and ${range}.`);
    result[name] = range;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

export async function applyPlans(cwd: string, state: UiState, plans: FilePlan[], dependencies: Record<string, string>): Promise<void> {
  const stage = await stageFiles(cwd, plans);
  const created: string[] = [];
  try {
    for (const plan of plans) {
      const destination = safeJoin(cwd, plan.target, 'target');
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(safeJoin(stage.directory, plan.target, 'staged target'), destination);
      created.push(destination);
    }
    await writeState(cwd, state);
    await installDependencies(cwd, dependencies);
  } catch (error) {
    for (const file of created) await unlink(file).catch(() => undefined);
    throw error;
  } finally {
    await rm(stage.directory, { recursive: true, force: true });
  }
}
