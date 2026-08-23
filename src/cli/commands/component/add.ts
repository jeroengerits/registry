import type { CommandResult } from '../../../types.js';
import { readRootVersion, readState } from '../../../state.js';
import { availableVersions, parseGitReference, updateConstraint } from '../../../git.js';
import { applyPlans, aggregateDependencies, errorResult, planFiles, resolveReferences } from '../shared.js';
import { chooseVersion, confirmAction, frame, interactive, withSpinner } from '../../ui.js';
import { present } from '../../presentation.js';
import { saveRollback } from './revert.js';
import { renderUpdateIntent, updateProgress, type UpdateItem } from '../../update-flow.js';

/** Resolves, validates, stages, and installs one or more components. */
export async function addComponent(cwd: string, references: string[], options: { dryRun: boolean; force: boolean; update: boolean; version?: string; json: boolean; command?: string }): Promise<CommandResult> {
  if (!references.length) return errorResult('Usage: ui add <repository-or-path> [--version <version>] [--dry-run] [--force] [--json]', options.json);
  if (options.version && !/^v?\d+\.\d+\.\d+$/.test(options.version)) return errorResult('The --version value must be a stable semver version such as 1.2.3.', options.json);
  const referencesWithVersion = references.map((reference) => parseGitReference(reference, cwd));
  const showAvailableVersions = !interactive() && !options.version && referencesWithVersion.some((reference) => !reference.version);
  if (options.version) {
    for (const reference of referencesWithVersion) {
      if (reference.version) throw new Error('Specify the component version either in the URL or with --version, not both.');
      reference.version = options.version;
    }
  } else if (interactive()) {
    for (const reference of referencesWithVersion) {
      if (reference.version) continue;
      const versions = await availableVersions(reference.repository);
      if (!versions.length) throw new Error(`Repository ${reference.repository} has no stable semver tag.`);
      reference.version = await chooseVersion(reference.repository, versions);
    }
  }
  const resolved = await withSpinner('Resolving component versions...', () => resolveReferences(referencesWithVersion), (value) => `Resolved ${value.length} component${value.length === 1 ? '' : 's'}`, !options.json);
  try {
    const names = new Set<string>();
    for (const item of resolved) { if (names.has(item.manifest.name)) throw new Error(`Duplicate component ${item.manifest.name}.`); names.add(item.manifest.name); }
    const loadedState = await readState(cwd);
    const state = loadedState ?? { components: {} };
    const previousState = loadedState ? JSON.parse(JSON.stringify(loadedState)) as typeof loadedState : null;
    const rootVersion = await readRootVersion(cwd);
    if (rootVersion) state.version = rootVersion;
    const rootRepositories = new Set(referencesWithVersion.map((reference) => reference.repository));
    const roots = resolved.filter((item) => rootRepositories.has(item.reference.repository));
    const unchangedRoots = options.update ? roots.filter((item) => item.version === state.components[item.manifest.name]?.version) : [];
    if (unchangedRoots.length) throw new Error(`${unchangedRoots.map((item) => `Component "${item.manifest.name}" is already at the latest compatible version (${item.version}).`).join('\n')}`);
    const selected = options.update ? resolved.filter((item) => rootRepositories.has(item.reference.repository) || item.version !== state.components[item.manifest.name]?.version) : resolved;
    const alreadyInstalled = selected.filter((item) => state.components[item.manifest.name]);
    if (alreadyInstalled.length && !options.force) {
      const names = alreadyInstalled.map((item) => `"${item.manifest.name}"`).join(', ');
      throw new Error(`${alreadyInstalled.length === 1 ? 'Component' : 'Components'} ${names} ${alreadyInstalled.length === 1 ? 'is' : 'are'} already installed. Use --force to overwrite${alreadyInstalled.length === 1 ? ' it' : ' them'}.`);
    }
    const overwrite = new Set(alreadyInstalled.flatMap((item) => [item.manifest.files[0]?.target, ...(state.components[item.manifest.name]?.files ?? []).map((file) => file.path)].filter((target): target is string => Boolean(target))));
    const plans = await planFiles(cwd, selected, overwrite);
    const dependencies = aggregateDependencies(selected);
    const obsolete = selected.flatMap((item) => {
      const current = new Set(item.manifest.files.map((file) => file.target));
      return (state.components[item.manifest.name]?.files ?? []).map((file) => file.path).filter((file) => !current.has(file));
    });
    const changes: UpdateItem[] = selected.map((item) => ({ name: item.manifest.name, current: `v${loadedState?.components[item.manifest.name]?.version ?? 'new'}`, next: `v${item.version}`, status: 'updated' }));
    if (options.update && !options.dryRun && !options.json && interactive()) {
      process.stdout.write(`${renderUpdateIntent(changes)}\n\n`);
      if (!(await confirmAction('Apply this update plan?'))) return errorResult('Update cancelled.');
    }
    if (options.update && !options.dryRun && loadedState) await saveRollback(cwd, loadedState);
    const result = { components: selected.map((item) => ({ name: item.manifest.name, version: item.version, availableVersions: item.availableVersions, commit: item.commit, files: item.manifest.files.map((file) => file.target), dependencies })), updates: changes };
    if (options.dryRun) {
      const preview = [`would ${options.update ? 'update' : 'add'} ${selected.length} component${selected.length === 1 ? '' : 's'}`, '', ...selected.map((item) => `  ${item.manifest.name} ${item.version}`), '', 'no files changed'];
      return present(options.json, result, frame(options.command ?? 'component add', preview.join('\n'), 'Next: remove --dry-run to apply'));
    }
    for (const item of selected) state.components[item.manifest.name] = { enabled: state.components[item.manifest.name]?.enabled ?? true, repository: item.reference.repository, constraint: updateConstraint(item.version, item.reference.version), version: item.version, path: item.manifest.files[0]?.target ?? '', files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })), dependencies: item.manifest.components };
    await withSpinner(options.update ? updateProgress(changes) : 'Installing component files...', () => applyPlans(cwd, state, plans, dependencies, obsolete, previousState), () => 'Component files installed', !options.json);
    const messages = selected.flatMap((item) => {
      const previous = changes.find((change) => change.name === item.manifest.name)?.current.replace(/^v/, '') ?? 'new';
      const change = options.update ? `updated ${item.manifest.name} ${previous} -> ${item.version}` : `added ${item.manifest.name}@${item.version}`;
      return [change, ...(showAvailableVersions ? [`  available: ${item.availableVersions.join(', ') || 'none'}`] : [])];
    });
     return present(options.json, result, frame(options.command ?? `component ${options.update ? 'update' : 'add'}`, messages.join('\n'), 'Next: ui component'));
  } finally { await Promise.all(resolved.map((item) => item.cleanup())); }
}
