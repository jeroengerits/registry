import type { CommandResult } from '../../types.js';
import { readRootVersion, readState } from '../../state.js';
import { parseGitReference } from '../../git.js';
import { applyPlans, aggregateDependencies, errorResult, planFiles, resolveReferences } from './shared.js';
import { withSpinner } from '../ui.js';
import { colors } from '../ui.js';

export async function addComponent(cwd: string, references: string[], options: { dryRun: boolean; force: boolean; update: boolean; version?: string; json: boolean }): Promise<CommandResult> {
  if (!references.length) return errorResult('Usage: ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]');
  if (options.version && !/^v?\d+\.\d+\.\d+$/.test(options.version)) return errorResult('The --version value must be a stable semver version such as 1.2.3.');
  const resolved = await withSpinner('Resolving component versions...', () => resolveReferences(references.map((reference) => {
    const parsed = parseGitReference(reference);
    if (options.version) {
      if (parsed.version) throw new Error('Specify the component version either in the URL or with --version, not both.');
      parsed.version = options.version;
    }
    return parsed;
  })), (value) => `Resolved ${value.length} component${value.length === 1 ? '' : 's'}`, !options.json);
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
    if (options.dryRun) return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${resolved.map((item) => `Would add ${item.manifest.name}@${item.version}`).join('\n')}\n`, exitCode: 0 };
    for (const item of resolved) state.components[item.manifest.name] = { repository: item.reference.repository, constraint: item.reference.version ?? `^${item.version.split('.')[0]}`, version: item.version, path: item.manifest.files[0]?.target ?? '', files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })), dependencies: item.manifest.components };
    await withSpinner('Installing component files...', () => applyPlans(cwd, state, plans, dependencies), () => 'Component files installed', !options.json);
    const messages = resolved.flatMap((item) => [colors.info(`Available versions for ${item.manifest.name}: ${item.availableVersions.join(', ')}`), colors.success(`${options.update ? 'Updated' : 'Added'} ${item.manifest.name}@${item.version}`)]);
    return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${messages.join('\n')}\n`, exitCode: 0 };
  } finally { await Promise.all(resolved.map((item) => item.cleanup())); }
}
