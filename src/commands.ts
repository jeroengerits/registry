import { access, copyFile, mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CommandResult, ComponentManifest, ComponentState, InstalledFile, UiState } from './types.js';
import { readState, writeState } from './state.js';
import { generateManifest, validateManifestFile } from './manifest.js';
import { checkoutGit, parseGitReference, satisfies, type GitReference } from './git.js';
import { readComponentManifest } from './registry.js';
import { safeJoin, safeRelativePath } from './paths.js';

const exec = promisify(execFile);
const errorResult = (message: string): CommandResult => ({ output: `${message}\n`, exitCode: 1 });
const hash = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');
async function packageManager(cwd: string): Promise<'npm' | 'pnpm' | 'yarn' | 'bun'> { for (const [file, manager] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['package-lock.json', 'npm']] as const) { try { await access(path.join(cwd, file)); return manager; } catch { /* continue */ } } return 'npm'; }
async function installDependencies(cwd: string, dependencies: Record<string, string>): Promise<void> { const names = Object.keys(dependencies).sort().map((name) => `${name}@${dependencies[name]}`); if (!names.length) return; const manager = await packageManager(cwd); await exec(manager === 'npm' ? 'npm' : manager, manager === 'npm' ? ['install', '--save', ...names] : ['add', ...names], { cwd }); }

interface Resolved { manifest: ComponentManifest; reference: GitReference; directory: string; version: string; commit: string; cleanup: () => Promise<void>; }
function canonical(repository: string): string { const parsed = parseGitReference(repository).repository; return path.isAbsolute(parsed) ? path.resolve(parsed) : parsed.replace(/\.git$/, '').replace(/\/$/, '').toLowerCase(); }
async function resolveReferences(references: GitReference[]): Promise<Resolved[]> {
  const selected = new Map<string, Resolved>(); const visiting = new Set<string>();
  const visit = async (reference: GitReference): Promise<void> => {
    const key = canonical(reference.repository); const current = selected.get(key);
    if (visiting.has(key)) throw new Error(`Component dependency cycle at ${reference.repository}.`);
    if (current) { if (reference.version && !satisfies(current.version, reference.version)) throw new Error(`Incompatible versions for ${reference.repository}: ${current.version} does not satisfy ${reference.version}.`); return; }
    visiting.add(key);
    const checkout = await checkoutGit(reference); let manifest: ComponentManifest;
    try { manifest = await readComponentManifest(checkout.directory); } catch (error) { await checkout.cleanup(); throw error; }
    const resolved = { manifest, reference, directory: checkout.directory, version: checkout.version, commit: checkout.commit, cleanup: checkout.cleanup };
    selected.set(key, resolved);
    for (const dependency of [...manifest.components].sort((a, b) => a.repository.localeCompare(b.repository))) await visit(parseGitReference(dependency.version ? `${dependency.repository}#${dependency.version}` : dependency.repository));
    visiting.delete(key);
  };
  try { for (const reference of references) await visit(reference); } catch (error) { await Promise.all([...selected.values()].map((item) => item.cleanup())); throw error; }
  const result: Resolved[] = []; const walked = new Set<string>();
  const order = [...selected.keys()].sort();
  const append = (key: string) => { if (walked.has(key)) return; walked.add(key); result.push(selected.get(key)!); };
  for (const key of order) append(key);
  return result;
}

export async function listComponents(cwd: string, json: boolean): Promise<CommandResult> { const state = await readState(cwd); if (!state) return { output: json ? '[]\n' : 'No installed components.\n', exitCode: 0 }; const components = Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b)).map(([name, details]) => ({ name, ...details })); return { output: json ? `${JSON.stringify(components, null, 2)}\n` : components.map((component) => `${component.name}@${component.version} (${component.path})`).join('\n') + (components.length ? '\n' : 'No installed components.\n'), exitCode: 0 }; }
export async function createComponent(cwd: string, name: string | undefined, json: boolean): Promise<CommandResult> {
  if (!name) return errorResult('Usage: ui components create <name> [--json]');
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) return errorResult('Component name must be a lowercase kebab-case name, such as "date-picker".');
  const directory = safeJoin(cwd, path.join('components', name), 'component directory');
  try {
    await access(directory);
    return errorResult(`Component directory already exists: ${path.relative(cwd, directory)}`);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  await mkdir(path.join(directory, 'src'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({ name, version: '0.1.0', private: true, type: 'module' }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(directory, 'components.json'), `${JSON.stringify({ schemaVersion: 1, name, files: [], dependencies: {}, components: [] }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(directory, 'src', '.gitkeep'), '', 'utf8');
  const result = { name, directory: path.relative(cwd, directory), files: ['package.json', 'components.json', 'src/.gitkeep'] };
  return { output: json ? `${JSON.stringify(result, null, 2)}\n` : `Created ${result.directory}\n`, exitCode: 0 };
}

export async function infoComponent(cwd: string, name?: string, json = false): Promise<CommandResult> { if (!name) return errorResult('Usage: ui components info <name> [--json]'); const component = (await readState(cwd))?.components[name]; if (!component) return errorResult(`Component "${name}" is not installed.`); return { output: json ? `${JSON.stringify({ name, ...component }, null, 2)}\n` : `${name}@${component.version}\nPath: ${component.path}\n`, exitCode: 0 }; }

interface FilePlan { component: Resolved; source: string; target: string; }
async function planFiles(cwd: string, resolved: Resolved[], replacing: Map<string, ComponentState> = new Map()): Promise<FilePlan[]> {
  const plans: FilePlan[] = []; const targets = new Set<string>(); const replaceTargets = new Set<string>(); for (const state of replacing.values()) for (const file of state.files ?? [{ path: state.path, sha256: '' }]) replaceTargets.add(file.path);
  for (const component of resolved) for (const file of component.manifest.files) { const target = safeRelativePath(file.target, 'target'); const source = safeJoin(component.directory, file.source, 'source'); await stat(source); if (targets.has(target)) throw new Error(`Duplicate target path ${target}.`); targets.add(target); if (!replaceTargets.has(target)) { try { await access(safeJoin(cwd, target, 'target')); throw new Error(`Target already exists: ${target}.`); } catch (error) { if (error instanceof Error && error.message.startsWith('Target already exists')) throw error; } } plans.push({ component, source, target }); }
  return plans;
}
async function stageFiles(cwd: string, plans: FilePlan[]): Promise<{ directory: string; paths: string[] }> { const directory = await mkdtemp(path.join(cwd, '.ui-stage-')); const paths: string[] = []; for (const plan of plans) { const staged = safeJoin(directory, plan.target, 'staged target'); await mkdir(path.dirname(staged), { recursive: true }); await copyFile(plan.source, staged); paths.push(staged); } return { directory, paths }; }
function aggregateDependencies(resolved: Resolved[]): Record<string, string> { const result: Record<string, string> = {}; for (const item of resolved) for (const [name, range] of Object.entries(item.manifest.dependencies)) { if (result[name] && result[name] !== range) throw new Error(`Conflicting npm dependency ranges for ${name}: ${result[name]} and ${range}.`); result[name] = range; } return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b))); }

async function applyPlans(cwd: string, state: UiState, plans: FilePlan[], replacing: Map<string, ComponentState>, dependencies: Record<string, string>, dryRun: boolean, overwrite = false): Promise<void> {
  const stage = await stageFiles(cwd, plans); const created: string[] = []; const backup = await mkdtemp(path.join(cwd, '.ui-backup-')); const oldFiles: InstalledFile[] = []; for (const item of replacing.values()) oldFiles.push(...(item.files ?? [{ path: item.path, sha256: '' }]));
  try {
    if (dryRun) return;
    for (const file of oldFiles) { const destination = safeJoin(cwd, file.path, 'path'); try { if (!overwrite && file.sha256 && file.sha256 !== await hash(destination)) throw new Error(`Local changes detected in ${file.path}; use --overwrite.`); await access(destination); const saved = safeJoin(backup, file.path, 'backup'); await mkdir(path.dirname(saved), { recursive: true }); await copyFile(destination, saved); } catch (error) { if (error instanceof Error && error.message.startsWith('Local changes')) throw error; } }
    for (const file of oldFiles) { try { await unlink(safeJoin(cwd, file.path, 'path')); } catch { /* missing tracked files are harmless */ } }
    for (const plan of plans) { const destination = safeJoin(cwd, plan.target, 'target'); await mkdir(path.dirname(destination), { recursive: true }); await copyFile(safeJoin(stage.directory, plan.target, 'staged target'), destination); created.push(destination); }
    for (const plan of plans) { const destination = safeJoin(cwd, plan.target, 'target'); const entry = state.components[plan.component.manifest.name]; const file = entry?.files?.find((candidate) => candidate.path === plan.target); if (file) file.sha256 = await hash(destination); }
    await writeState(cwd, state); await installDependencies(cwd, dependencies);
  } catch (error) {
    for (const file of created) await unlink(file).catch(() => undefined);
    for (const file of oldFiles) { const saved = safeJoin(backup, file.path, 'backup'); try { await mkdir(path.dirname(safeJoin(cwd, file.path, 'path')), { recursive: true }); await copyFile(saved, safeJoin(cwd, file.path, 'path')); } catch { /* no prior file */ } }
    throw error;
  } finally { await rm(stage.directory, { recursive: true, force: true }); await rm(backup, { recursive: true, force: true }); }
}

export async function addComponents(cwd: string, references: string[], options: { dryRun: boolean; yes: boolean; json: boolean }): Promise<CommandResult> {
  if (!references.length) return errorResult('Usage: ui add <git-reference> [--dry-run] [--yes] [--json]'); if (!options.yes && !options.dryRun) return errorResult('Refusing to modify files without --yes (or use --dry-run).');
  const resolved = await resolveReferences(references.map(parseGitReference)); try { const names = new Set<string>(); for (const item of resolved) { if (names.has(item.manifest.name)) throw new Error(`Duplicate component ${item.manifest.name}.`); names.add(item.manifest.name); } const state = (await readState(cwd)) ?? { components: {} }; const plans = await planFiles(cwd, resolved); const dependencies = aggregateDependencies(resolved); const result = { components: resolved.map((item) => ({ name: item.manifest.name, version: item.version, commit: item.commit, files: item.manifest.files.map((file) => file.target), dependencies })) }; if (options.dryRun) return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${resolved.map((item) => `Would add ${item.manifest.name}@${item.version}`).join('\n')}\n`, exitCode: 0 }; for (const item of resolved) state.components[item.manifest.name] = { repository: item.reference.repository, version: item.version, path: item.manifest.files[0]?.target ?? '', files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })), dependencies: item.manifest.components }; await applyPlans(cwd, state, plans, new Map(), dependencies, false); return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${resolved.map((item) => `Added ${item.manifest.name}@${item.version}`).join('\n')}\n`, exitCode: 0 }; } finally { await Promise.all(resolved.map((item) => item.cleanup())); }
}

async function protectedDelete(cwd: string, component: ComponentState, overwrite: boolean): Promise<void> { for (const file of component.files ?? [{ path: component.path, sha256: '' }]) { try { if (!overwrite && file.sha256 && file.sha256 !== await hash(safeJoin(cwd, file.path, 'path'))) throw new Error(`Local changes detected in ${file.path}; use --overwrite.`); } catch (error) { if (error instanceof Error && error.message.startsWith('Local changes')) throw error; } } }
export async function removeComponent(cwd: string, name: string | undefined, overwrite: boolean): Promise<CommandResult> { if (!name) return errorResult('Usage: ui remove <name> [--overwrite]'); const state = await readState(cwd); const component = state?.components[name]; if (!state || !component) return errorResult(`Component "${name}" is not installed.`); await protectedDelete(cwd, component, overwrite); const backup = await mkdtemp(path.join(cwd, '.ui-remove-backup-')); const files = component.files ?? [{ path: component.path, sha256: '' }]; try { for (const file of files) { const source = safeJoin(cwd, file.path, 'path'); try { const saved = safeJoin(backup, file.path, 'backup'); await mkdir(path.dirname(saved), { recursive: true }); await copyFile(source, saved); await unlink(source); } catch { /* missing tracked files are harmless */ } } delete state.components[name]; await writeState(cwd, state); return { output: `Removed ${name}.\n`, exitCode: 0 }; } catch (error) { for (const file of files) { const saved = safeJoin(backup, file.path, 'backup'); try { const destination = safeJoin(cwd, file.path, 'path'); await mkdir(path.dirname(destination), { recursive: true }); await copyFile(saved, destination); } catch { /* no prior file */ } } throw error; } finally { await rm(backup, { recursive: true, force: true }); } }
export async function updateComponent(cwd: string, reference: string | undefined, overwrite: boolean): Promise<CommandResult> {
  const state = await readState(cwd); if (!state) return errorResult('No installed components.'); const names = reference ? [reference] : Object.keys(state.components).sort(); if (!names.length) return errorResult('No installed components.'); const refs: GitReference[] = [];
  for (const name of names) { const old = state.components[name]; if (!old?.repository) return errorResult(`Component "${name}" has no repository in ui.json.`); refs.push(parseGitReference(old.repository)); }
  if (reference && !state.components[reference]) refs.splice(0, refs.length, parseGitReference(reference));
  const resolved = await resolveReferences(refs); try { const replacing = new Map<string, ComponentState>(); for (const item of resolved) { const old = state.components[item.manifest.name]; if (old) { await protectedDelete(cwd, old, overwrite); replacing.set(item.manifest.name, old); } } const plans = await planFiles(cwd, resolved, replacing); const next: UiState = { ...state, components: { ...state.components } }; for (const item of resolved) next.components[item.manifest.name] = { repository: item.reference.repository, version: item.version, path: item.manifest.files[0]?.target ?? '', files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })), dependencies: item.manifest.components }; await applyPlans(cwd, next, plans, replacing, aggregateDependencies(resolved), false, overwrite); return { output: `${resolved.map((item) => `Updated ${item.manifest.name}@${item.version}`).join('\n')}\n`, exitCode: 0 }; } finally { await Promise.all(resolved.map((item) => item.cleanup())); }
}
export async function doctor(cwd: string): Promise<CommandResult> { await readState(cwd); return { output: 'ui.json is valid.\n', exitCode: 0 }; }
export async function validateManifestCommand(file?: string): Promise<CommandResult> { if (!file) return errorResult('Usage: ui manifest check <components.json>'); await validateManifestFile(file); return { output: `Manifest is valid: ${file}\n`, exitCode: 0 }; }
export async function generateManifestCommand(directory?: string, output?: string): Promise<CommandResult> { if (!directory) return errorResult('Usage: ui manifest generate <repository-directory> [output]'); const target = output ?? path.join(directory, 'components.json'); await generateManifest(directory, target); return { output: `Manifest generated: ${target}\n`, exitCode: 0 }; }
