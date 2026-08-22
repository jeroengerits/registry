import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { parseGitReference } from '../../git.js';
import { applyPlans, aggregateDependencies, errorResult, planFiles, resolveReferences } from './shared.js';

export async function addComponents(cwd: string, references: string[], options: { dryRun: boolean; yes: boolean; json: boolean }): Promise<CommandResult> {
  if (!references.length) return errorResult('Usage: ui components add <github-url> [--dry-run] [--yes] [--json]');
  if (!options.yes && !options.dryRun) return errorResult('Refusing to modify files without --yes (or use --dry-run).');
  const resolved = await resolveReferences(references.map(parseGitReference));
  try {
    const names = new Set<string>();
    for (const item of resolved) { if (names.has(item.manifest.name)) throw new Error(`Duplicate component ${item.manifest.name}.`); names.add(item.manifest.name); }
    const state = (await readState(cwd)) ?? { components: {} };
    const plans = await planFiles(cwd, resolved);
    const dependencies = aggregateDependencies(resolved);
    const result = { components: resolved.map((item) => ({ name: item.manifest.name, version: item.version, commit: item.commit, files: item.manifest.files.map((file) => file.target), dependencies })) };
    if (options.dryRun) return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${resolved.map((item) => `Would add ${item.manifest.name}@${item.version}`).join('\n')}\n`, exitCode: 0 };
    for (const item of resolved) state.components[item.manifest.name] = { repository: item.reference.repository, version: item.version, path: item.manifest.files[0]?.target ?? '', files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })), dependencies: item.manifest.components };
    await applyPlans(cwd, state, plans, dependencies);
    return { output: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${resolved.map((item) => `Added ${item.manifest.name}@${item.version}`).join('\n')}\n`, exitCode: 0 };
  } finally { await Promise.all(resolved.map((item) => item.cleanup())); }
}
