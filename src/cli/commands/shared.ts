import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import type { ComponentManifest, UiState } from '../../types.js';
import { writeState } from '../../state.js';
import { checkoutGit, parseGitReference, satisfies, type GitReference } from '../../git.js';
import { readComponentManifest } from '../../registry.js';
import { safeJoin, safeRelativePath } from '../../paths.js';
import { copySafeFile, projectFileExists, removeSafePath, safeFilePath, sha256File } from '../../filesystem.js';
import { isErrnoError } from '../../shared.js';
import { failure } from '../presentation.js';

/** Creates the standard failed-command result without throwing. */
export const errorResult = (message: string, json = false) => failure(json, message, message.startsWith('Usage:') ? 'invalid_usage' : 'command_failed', message.startsWith('Usage:') ? 2 : 1);
/** Detects the package manager from the project's lockfile. */
async function packageManager(cwd: string): Promise<'npm' | 'pnpm' | 'yarn' | 'bun'> {
  for (const [file, manager] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['package-lock.json', 'npm']] as const) {
    if (await projectFileExists(cwd, file, 'lockfile')) return manager;
  }
  return 'npm';
}

/** Installs declared dependencies with the package manager detected in the project. */
export async function installDependencies(cwd: string, dependencies: Record<string, string>): Promise<void> {
  const names = Object.keys(dependencies).sort().map((name) => `${name}@${dependencies[name]}`);
  if (!names.length) return;
  const manager = await packageManager(cwd);
  await execa(manager === 'npm' ? 'npm' : manager, manager === 'npm' ? ['install', '--save', ...names] : ['add', ...names], { cwd });
}

/** A component checkout plus manifest and cleanup data needed by planning. */
export interface Resolved { manifest: ComponentManifest; reference: GitReference; directory: string; version: string; availableVersions: string[]; commit: string; cleanup: () => Promise<void>; }

/** Creates a stable key for dependency de-duplication across URL spellings. */
function canonical(repository: string): string {
  const parsed = parseGitReference(repository).repository;
  return path.isAbsolute(parsed) ? path.resolve(parsed) : parsed.replace(/\.git$/, '').replace(/\/$/, '').toLowerCase();
}

/** Resolves root and recursive component references with cycle detection. */
export async function resolveReferences(references: GitReference[], sourceRoot?: string): Promise<Resolved[]> {
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
    const checkout = await checkoutGit(reference, sourceRoot);
    let manifest: ComponentManifest;
    try { manifest = await readComponentManifest(checkout.directory); } catch (error) { await checkout.cleanup(); throw error; }
    // Register before walking dependencies so cycles are visible through `visiting`.
    selected.set(key, { manifest, reference, directory: checkout.directory, version: checkout.version, availableVersions: checkout.versions, commit: checkout.commit, cleanup: checkout.cleanup });
    for (const dependency of [...manifest.components].sort((a, b) => a.repository.localeCompare(b.repository))) await visit(parseGitReference(dependency.version ? `${dependency.repository}#${dependency.version}` : dependency.repository, selected.get(key)?.directory ?? process.cwd()));
    visiting.delete(key);
  };
  try { for (const reference of references) await visit(reference); } catch (error) { await Promise.all([...selected.values()].map((item) => item.cleanup())); throw error; }
  const result: Resolved[] = [];
  const walked = new Set<string>();
  const append = (key: string) => { if (walked.has(key)) return; walked.add(key); result.push(selected.get(key)!); };
  for (const key of [...selected.keys()].sort()) append(key);
  return result;
}

/** Describes one validated copy from a checkout into the project. */
export interface FilePlan { component: Resolved; source: string; target: string; }

/** Builds safe file-copy operations and rejects collisions before mutation. */
export async function planFiles(cwd: string, resolved: Resolved[], overwrite = new Set<string>()): Promise<FilePlan[]> {
  const plans: FilePlan[] = [];
  const targets = new Set<string>();
  for (const component of resolved) for (const file of component.manifest.files) {
    const target = safeRelativePath(file.target, 'target');
    const source = await safeFilePath(component.directory, file.source, 'source');
    if (targets.has(target)) throw new Error(`Duplicate target path ${target}.`);
    targets.add(target);
    try { await safeFilePath(cwd, target, 'target'); if (!overwrite.has(target)) throw new Error(`Target already exists: ${target}.`); }
    catch (error) { if (error instanceof Error && error.message.startsWith('Target already exists')) throw error; }
    plans.push({ component, source, target });
  }
  return plans;
}

/** Copies planned files to a temporary staging tree before mutation. */
async function stageFiles(cwd: string, plans: FilePlan[]): Promise<{ directory: string }> {
  const directory = await mkdtemp(path.join(cwd, '.ui-stage-'));
  try {
    for (const plan of plans) {
      const staged = safeJoin(directory, plan.target, 'staged target');
      await copySafeFile(plan.source, staged, 'staged file');
    }
    return { directory };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Combines component dependency maps and rejects conflicting ranges. */
export function aggregateDependencies(resolved: Resolved[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of resolved) for (const [name, range] of Object.entries(item.manifest.dependencies)) {
    if (result[name] && result[name] !== range) throw new Error(`Conflicting npm dependency ranges for ${name}: ${result[name]} and ${range}.`);
    result[name] = range;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

/** Applies staged files, state, and dependencies with rollback on failure. */
export async function applyPlans(cwd: string, state: UiState, plans: FilePlan[], dependencies: Record<string, string>, obsolete: string[] = [], previousState: UiState | null = state): Promise<void> {
  const stage = await stageFiles(cwd, plans);
  const created: string[] = [];
  const overwritten: { destination: string; backup: string }[] = [];
  const removed: { destination: string; backup: string }[] = [];
  try {
    // Remove files no longer declared by the updated manifest before copying replacements.
    for (const relative of obsolete) {
      try {
        const destination = await safeFilePath(cwd, relative, 'obsolete target');
        const backup = safeJoin(stage.directory, `.backup/${relative}`, 'obsolete backup');
        await copySafeFile(destination, backup, 'obsolete backup');
        removed.push({ destination, backup });
        await removeSafePath(destination, 'obsolete target');
      } catch (error) {
        if (!isErrnoError(error) || error.code !== 'ENOENT') throw error;
      }
    }
    for (const plan of plans) {
      const destination = safeJoin(cwd, plan.target, 'target');
      try {
        await safeFilePath(cwd, plan.target, 'target');
        const backup = safeJoin(stage.directory, `.backup/${plan.target}`, 'backup');
        await copySafeFile(destination, backup, 'backup');
        overwritten.push({ destination, backup });
      } catch (error) {
        if (!isErrnoError(error) || error.code !== 'ENOENT') throw error;
      }
      await copySafeFile(safeJoin(stage.directory, plan.target, 'staged target'), destination, 'installed file');
      const installed = state.components[plan.component.manifest.name]?.files?.find((file) => file.path === plan.target);
      if (installed) installed.sha256 = await sha256File(destination, 'installed file');
      created.push(destination);
    }
    await writeState(cwd, state);
    await installDependencies(cwd, dependencies);
  } catch (error) {
    for (const file of created) await removeSafePath(file, 'rollback file').catch(() => undefined);
    for (const { destination, backup } of overwritten) await copySafeFile(backup, destination, 'rollback file').catch(() => undefined);
    for (const { destination, backup } of removed) await copySafeFile(backup, destination, 'rollback file').catch(() => undefined);
    try {
      if (previousState) await writeState(cwd, previousState);
      else await rm(path.join(cwd, 'ui.json'), { force: true });
    } catch { /* Preserve the original failure while making a best-effort rollback. */ }
    throw error;
  } finally {
    await rm(stage.directory, { recursive: true, force: true });
  }
}
