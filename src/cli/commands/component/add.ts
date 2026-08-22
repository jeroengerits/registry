import type { CommandResult } from '../../../types.js';
import { readRootVersion, readState } from '../../../state.js';
import { availableVersions, parseGitReference } from '../../../git.js';
import { applyPlans, aggregateDependencies, errorResult, planFiles, resolveReferences } from '../shared.js';
import { chooseVersion, frame, interactive, outcome, withSpinner } from '../../ui.js';

/** Resolves, validates, stages, and installs one or more components. */
export async function addComponent(cwd: string, references: string[], options: { dryRun: boolean; force: boolean; update: boolean; version?: string; json: boolean; command?: string }): Promise<CommandResult> {
  if (!references.length) return errorResult('Usage: ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]');
  if (options.version && !/^v?\d+\.\d+\.\d+$/.test(options.version)) return errorResult('The --version value must be a stable semver version such as 1.2.3.');
  const referencesWithVersion = references.map(parseGitReference);
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
    const state = (await readState(cwd)) ?? { components: {} };
    const rootVersion = await readRootVersion(cwd);
    if (rootVersion) state.version = rootVersion;
    const alreadyInstalled = resolved.filter((item) => state.components[item.manifest.name]);
    if (options.update) {
      const unchanged = resolved.filter((item) => item.version === state.components[item.manifest.name]?.version);
      if (unchanged.length) throw new Error(`${unchanged.map((item) => `Component "${item.manifest.name}" is already at the latest compatible version (${item.version}).`).join('\n')}`);
    }
    if (alreadyInstalled.length && !options.force) {
      const names = alreadyInstalled.map((item) => `"${item.manifest.name}"`).join(', ');
      throw new Error(`${alreadyInstalled.length === 1 ? 'Component' : 'Components'} ${names} ${alreadyInstalled.length === 1 ? 'is' : 'are'} already installed. Use --force to overwrite${alreadyInstalled.length === 1 ? ' it' : ' them'}.`);
    }
    const overwrite = new Set(alreadyInstalled.flatMap((item) => [item.manifest.files[0]?.target, ...(state.components[item.manifest.name]?.files ?? []).map((file) => file.path)].filter((target): target is string => Boolean(target))));
    const plans = await planFiles(cwd, resolved, overwrite);
    const dependencies = aggregateDependencies(resolved);
    const result = { components: resolved.map((item) => ({ name: item.manifest.name, version: item.version, availableVersions: item.availableVersions, commit: item.commit, files: item.manifest.files.map((file) => file.target), dependencies })) };
    if (options.dryRun) {
      const preview = [`${resolved.length} component${resolved.length === 1 ? '' : 's'} would be changed`, '', ...resolved.map((item) => `  ${item.manifest.name.padEnd(16)} v${item.version}`), '', outcome('Dry run complete. No files changed.', 'warning')];
      return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : frame(options.command ?? 'component add', preview.join('\n'), 'Next: remove --dry-run to apply'), exitCode: 0 };
    }
    for (const item of resolved) state.components[item.manifest.name] = { enabled: state.components[item.manifest.name]?.enabled ?? true, repository: item.reference.repository, constraint: item.reference.version ?? `^${item.version.split('.')[0]}`, version: item.version, path: item.manifest.files[0]?.target ?? '', files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })), dependencies: item.manifest.components };
    await withSpinner('Installing component files...', () => applyPlans(cwd, state, plans, dependencies), () => 'Component files installed', !options.json);
    const action = options.update ? 'Updated' : 'Added';
    const messages = [`${resolved.length} component${resolved.length === 1 ? '' : 's'} ${options.update ? 'updated' : 'added'}`, '', ...resolved.flatMap((item) => [outcome(`${action} ${item.manifest.name}@${item.version}`), ...(showAvailableVersions ? [`  Available: ${item.availableVersions.join(', ') || 'none'}`] : [])])];
    return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : frame(options.command ?? `component ${options.update ? 'update' : 'add'}`, messages.join('\n'), 'Next: ui component list'), exitCode: 0 };
  } finally { await Promise.all(resolved.map((item) => item.cleanup())); }
}
